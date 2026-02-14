require('./tfjsCompat');
const tf = require('@tensorflow/tfjs-node');
const canvas = require('canvas');
const { getFaceApi } = require('./faceApiLoader');

const MIN_CONFIDENCE = Number(process.env.FACEAPI_MIN_CONFIDENCE || 0.5);

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

const runFaceApiDetection = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return emptyResult();
  }

  const startedAt = Date.now();
  let imageTensor;

  try {
    const faceapi = await getFaceApi();
    imageTensor = await imageBufferToTensor(imageBuffer);

    const detections = await faceapi
      .detectAllFaces(imageTensor, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    const faces = (Array.isArray(detections) ? detections : [])
      .map(toFaceRecord)
      .filter((face) => Array.isArray(face.embedding) && face.embedding.length > 0);

    const timingMs = Date.now() - startedAt;
    console.log('[faceapi-detection] completed', {
      timingMs,
      facesDetected: faces.length,
      minConfidence: MIN_CONFIDENCE
    });

    return {
      attempts: 1,
      totalPersons: faces.length,
      validFaces: faces.length,
      uncertainPersons: 0,
      faces,
      rawDetections: faces.length,
      finalFaces: faces.length,
      detectionPasses: 1,
      detectorUsed: 'faceapi'
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
