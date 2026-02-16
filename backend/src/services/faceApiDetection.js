const { tf } = require('./tensorflowRuntime');
const canvas = require('canvas');
const { getFaceApi } = require('./faceApiLoader');

const MIN_CONFIDENCE = Number(process.env.FACEAPI_MIN_CONFIDENCE || 0.5);
const SSD_FALLBACK_MIN_CONFIDENCE = Number(process.env.FACEAPI_SSD_FALLBACK_MIN_CONFIDENCE || 0.35);
const TINY_INPUT_SIZE = Number(process.env.FACEAPI_TINY_INPUT_SIZE || 608);
const TINY_SCORE_THRESHOLD = Number(process.env.FACEAPI_TINY_SCORE_THRESHOLD || 0.25);
const DETECTION_DEDUP_IOU = Number(process.env.FACEAPI_DEDUP_IOU || 0.4);
const TINY_MIN_KEEP_CONFIDENCE = Number(process.env.FACEAPI_TINY_MIN_KEEP_CONFIDENCE || 0.42);
const TINY_ISOLATED_MIN_CONFIDENCE = Number(process.env.FACEAPI_TINY_ISOLATED_MIN_CONFIDENCE || 0.58);
const MIN_FACE_BOX_SIZE_PX = Number(process.env.FACEAPI_MIN_FACE_BOX_SIZE_PX || 24);
const MAX_FACE_ASPECT_RATIO = Number(process.env.FACEAPI_MAX_FACE_ASPECT_RATIO || 1.9);
const MIN_FACE_ASPECT_RATIO = Number(process.env.FACEAPI_MIN_FACE_ASPECT_RATIO || 0.5);
const MIN_SINGLE_DETECTOR_CONFIDENCE = Number(process.env.FACEAPI_MIN_SINGLE_DETECTOR_CONFIDENCE || 0.72);

const toNumber = (value, fallback = 0) => {
  const cast = Number(value);
  return Number.isFinite(cast) ? cast : fallback;
};

const toFaceRecord = (item) => {
  const box = item?.detection?.box;
  const confidence = Number(toNumber(item?.detection?.score, 0).toFixed(6));
  const descriptor = Array.from(item?.descriptor || []).map((value) => Number(Number(value).toFixed(8)));

  return {
    box: {
      x: Math.max(0, Math.round(toNumber(box?.x, 0))),
      y: Math.max(0, Math.round(toNumber(box?.y, 0))),
      width: Math.max(1, Math.round(toNumber(box?.width, 1))),
      height: Math.max(1, Math.round(toNumber(box?.height, 1)))
    },
    embedding: descriptor,
    confidence,
    accepted: true
  };
};

const imageBufferToTensor = async (imageBuffer) => {
  const image = await canvas.loadImage(imageBuffer);
  const drawCanvas = canvas.createCanvas(image.width, image.height);
  const ctx = drawCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0, image.width, image.height);

  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const rgbaTensor = tf.tensor3d(data, [image.height, image.width, 4], 'int32');
  const rgbTensor = rgbaTensor.slice([0, 0, 0], [image.height, image.width, 3]);
  rgbaTensor.dispose();
  return rgbTensor;
};

const emptyResult = () => ({
  attempts: 0,
  totalPersons: 0,
  validFaces: 0,
  uncertainPersons: 0,
  faces: [],
  rawDetections: 0,
  finalFaces: 0,
  detectionPasses: 1,
  detectorUsed: 'faceapi'
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sanitizeOption = (value, fallback, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(numeric, min, max);
};

const calculateIoU = (left, right) => {
  const leftX1 = toNumber(left?.x, 0);
  const leftY1 = toNumber(left?.y, 0);
  const leftX2 = leftX1 + Math.max(0, toNumber(left?.width, 0));
  const leftY2 = leftY1 + Math.max(0, toNumber(left?.height, 0));

  const rightX1 = toNumber(right?.x, 0);
  const rightY1 = toNumber(right?.y, 0);
  const rightX2 = rightX1 + Math.max(0, toNumber(right?.width, 0));
  const rightY2 = rightY1 + Math.max(0, toNumber(right?.height, 0));

  const overlapX1 = Math.max(leftX1, rightX1);
  const overlapY1 = Math.max(leftY1, rightY1);
  const overlapX2 = Math.min(leftX2, rightX2);
  const overlapY2 = Math.min(leftY2, rightY2);

  const overlapWidth = Math.max(0, overlapX2 - overlapX1);
  const overlapHeight = Math.max(0, overlapY2 - overlapY1);
  const intersection = overlapWidth * overlapHeight;

  if (intersection <= 0) {
    return 0;
  }

  const leftArea = Math.max(0, leftX2 - leftX1) * Math.max(0, leftY2 - leftY1);
  const rightArea = Math.max(0, rightX2 - rightX1) * Math.max(0, rightY2 - rightY1);
  const union = leftArea + rightArea - intersection;

  return union > 0 ? intersection / union : 0;
};

const calculateCenterDistance = (left, right) => {
  const leftCenterX = toNumber(left?.x, 0) + toNumber(left?.width, 0) / 2;
  const leftCenterY = toNumber(left?.y, 0) + toNumber(left?.height, 0) / 2;
  const rightCenterX = toNumber(right?.x, 0) + toNumber(right?.width, 0) / 2;
  const rightCenterY = toNumber(right?.y, 0) + toNumber(right?.height, 0) / 2;
  return Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY);
};

const isReasonableFaceBox = (box, imageWidth, imageHeight) => {
  const width = Math.max(0, toNumber(box?.width, 0));
  const height = Math.max(0, toNumber(box?.height, 0));
  if (width < MIN_FACE_BOX_SIZE_PX || height < MIN_FACE_BOX_SIZE_PX) {
    return false;
  }

  const ratio = width / Math.max(1, height);
  if (ratio < MIN_FACE_ASPECT_RATIO || ratio > MAX_FACE_ASPECT_RATIO) {
    return false;
  }

  const imageArea = Math.max(1, imageWidth * imageHeight);
  const areaRatio = (width * height) / imageArea;
  return areaRatio < 0.35;
};

const mergeDetectionSets = (sets, dedupIou, imageWidth, imageHeight) => {
  const merged = [];
  const iouThreshold = sanitizeOption(dedupIou, DETECTION_DEDUP_IOU, 0.1, 0.95);
  const tinyMinKeepConfidence = sanitizeOption(TINY_MIN_KEEP_CONFIDENCE, 0.42, 0.1, 0.99);
  const tinyIsolatedMinConfidence = sanitizeOption(TINY_ISOLATED_MIN_CONFIDENCE, 0.58, 0.1, 0.99);
  const ssdSeedBoxes = sets
    .filter((set) => String(set?.detector || '').startsWith('ssd'))
    .flatMap((set) =>
      (Array.isArray(set?.detections) ? set.detections : [])
        .map((item) => ({
          box: toFaceRecord(item).box
        }))
        .filter((item) => item?.box)
    );

  for (const set of sets) {
    const detections = Array.isArray(set?.detections) ? set.detections : [];
    const detector = String(set?.detector || 'unknown');
    for (const item of detections) {
      const candidate = toFaceRecord(item);
      if (!Array.isArray(candidate.embedding) || candidate.embedding.length === 0) {
        continue;
      }
      if (!isReasonableFaceBox(candidate.box, imageWidth, imageHeight)) {
        continue;
      }
      if (detector === 'tiny') {
        const maxIouWithSsd = ssdSeedBoxes.reduce(
          (best, seed) => Math.max(best, calculateIoU(candidate.box, seed.box)),
          0
        );
        const hasSsdSupport = maxIouWithSsd >= 0.1;
        const minRequiredConfidence = hasSsdSupport ? tinyMinKeepConfidence : tinyIsolatedMinConfidence;
        if (candidate.confidence < minRequiredConfidence) {
          continue;
        }
      }

      let duplicateIndex = -1;
      for (let i = 0; i < merged.length; i += 1) {
        const existing = merged[i];
        const overlap = calculateIoU(candidate.box, existing.box);
        const centerDistance = calculateCenterDistance(candidate.box, existing.box);
        const minDimension = Math.max(
          1,
          Math.min(
            toNumber(candidate.box?.width, 0),
            toNumber(candidate.box?.height, 0),
            toNumber(existing.box?.width, 0),
            toNumber(existing.box?.height, 0)
          )
        );
        const nearSameCenter = centerDistance <= minDimension * 0.55;
        if (overlap >= iouThreshold || nearSameCenter) {
          duplicateIndex = i;
          break;
        }
      }

      const enriched = {
        ...candidate,
        detector,
        detectorSet: [detector]
      };

      if (duplicateIndex === -1) {
        merged.push(enriched);
        continue;
      }

      const existing = merged[duplicateIndex];
      const candidateArea = toNumber(candidate.box?.width, 1) * toNumber(candidate.box?.height, 1);
      const existingArea = toNumber(existing.box?.width, 1) * toNumber(existing.box?.height, 1);
      const shouldReplace =
        candidate.confidence > existing.confidence + 0.05 ||
        (candidate.confidence >= existing.confidence - 0.02 && candidateArea < existingArea * 0.85);

      if (shouldReplace) {
        merged[duplicateIndex] = {
          ...enriched,
          detectorSet: Array.from(new Set([...(existing.detectorSet || []), detector]))
        };
      } else {
        merged[duplicateIndex] = {
          ...existing,
          detectorSet: Array.from(new Set([...(existing.detectorSet || []), detector]))
        };
      }
    }
  }

  return merged
    .filter((item) => {
      const supportCount = Array.isArray(item.detectorSet) ? item.detectorSet.length : 1;
      return supportCount >= 2 || Number(item.confidence || 0) >= MIN_SINGLE_DETECTOR_CONFIDENCE;
    })
    .map((item) => ({
      box: item.box,
      embedding: item.embedding,
      confidence: item.confidence,
      accepted: item.accepted,
      detector: item.detector
    }));
};

const runFaceApiDetection = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return emptyResult();
  }

  const startedAt = Date.now();
  let imageTensor;

  try {
    const faceapi = await getFaceApi();
    imageTensor = await imageBufferToTensor(imageBuffer);
    const [imageHeight, imageWidth] = imageTensor.shape;

    const primaryMinConfidence = sanitizeOption(MIN_CONFIDENCE, 0.5, 0.05, 0.99);
    const fallbackMinConfidence = sanitizeOption(SSD_FALLBACK_MIN_CONFIDENCE, 0.35, 0.05, primaryMinConfidence);
    const tinyInputSize = Math.max(128, Math.round(sanitizeOption(TINY_INPUT_SIZE, 608, 128, 1024)));
    const tinyScoreThreshold = sanitizeOption(TINY_SCORE_THRESHOLD, 0.25, 0.05, 0.95);

    const [ssdPrimary, ssdFallback, tinyDetections] = await Promise.all([
      faceapi
        .detectAllFaces(imageTensor, new faceapi.SsdMobilenetv1Options({ minConfidence: primaryMinConfidence }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi
        .detectAllFaces(imageTensor, new faceapi.SsdMobilenetv1Options({ minConfidence: fallbackMinConfidence }))
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi
        .detectAllFaces(
          imageTensor,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: tinyInputSize,
            scoreThreshold: tinyScoreThreshold
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors()
    ]);

    const faces = mergeDetectionSets(
      [
        { detector: 'ssd_primary', detections: ssdPrimary },
        { detector: 'ssd_fallback', detections: ssdFallback },
        { detector: 'tiny', detections: tinyDetections }
      ],
      DETECTION_DEDUP_IOU,
      imageWidth,
      imageHeight
    );

    const timingMs = Date.now() - startedAt;
    console.log('[faceapi-detection] completed', {
      timingMs,
      facesDetected: faces.length,
      detector: 'ssd+tiny',
      ssdPrimaryMinConfidence: primaryMinConfidence,
      ssdFallbackMinConfidence: fallbackMinConfidence,
      tinyInputSize,
      tinyScoreThreshold,
      ssdPrimaryCount: Array.isArray(ssdPrimary) ? ssdPrimary.length : 0,
      ssdFallbackCount: Array.isArray(ssdFallback) ? ssdFallback.length : 0,
      tinyCount: Array.isArray(tinyDetections) ? tinyDetections.length : 0
    });

    return {
      attempts: 1,
      totalPersons: faces.length,
      validFaces: faces.length,
      uncertainPersons: 0,
      faces,
      rawDetections:
        (Array.isArray(ssdPrimary) ? ssdPrimary.length : 0) +
        (Array.isArray(ssdFallback) ? ssdFallback.length : 0) +
        (Array.isArray(tinyDetections) ? tinyDetections.length : 0),
      finalFaces: faces.length,
      detectionPasses: 3,
      detectorUsed: 'faceapi-ssd-tiny'
    };
  } catch (error) {
    const timingMs = Date.now() - startedAt;
    console.error('[faceapi-detection] failed', {
      timingMs,
      message: error.message
    });
    return emptyResult();
  } finally {
    if (imageTensor) {
      imageTensor.dispose();
    }
  }
};

module.exports = {
  runFaceApiDetection
};
