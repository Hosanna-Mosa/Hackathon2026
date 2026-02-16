require('./tfjsCompat');
const tf = require('@tensorflow/tfjs');
const canvas = require('canvas');

const imageBufferToTensor = async (imageBuffer) => {
  const image = await canvas.loadImage(imageBuffer);
  const drawCanvas = canvas.createCanvas(image.width, image.height);
  const ctx = drawCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0, image.width, image.height);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  return tf.tidy(() => {
    const rgbaTensor = tf.tensor3d(data, [image.height, image.width, 4], 'int32');
    return rgbaTensor.slice([0, 0, 0], [image.height, image.width, 3]);
  });
};
const { getFaceApi } = require('./faceApiLoader');
const { runFaceApiDetection } = require('./faceApiDetection');

const runFaceApiTest = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    const error = new Error('Image buffer is required.');
    error.statusCode = 400;
    throw error;
  }

  let imageTensor;
  try {
    const faceapi = await getFaceApi();

    imageTensor = await imageBufferToTensor(imageBuffer);

    const startedAt = Date.now();
    const detections = await faceapi
      .detectAllFaces(imageTensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    const faceApiTimingMs = Date.now() - startedAt;

    const embeddings = (Array.isArray(detections) ? detections : []).map((item) =>
      Array.from(item?.descriptor || []).map((value) => Number(Number(value).toFixed(8)))
    );

    const currentPipelineStartedAt = Date.now();
    const currentPipelineResult = await runFaceApiDetection(imageBuffer);
    const currentPipelineTimingMs = Date.now() - currentPipelineStartedAt;

    console.log('[faceapi-test] compare-output', {
      faceApi: {
        facesDetected: embeddings.length,
        timingMs: faceApiTimingMs
      },
      currentPipeline: {
        facesDetected: Array.isArray(currentPipelineResult?.faces) ? currentPipelineResult.faces.length : 0,
        timingMs: currentPipelineTimingMs,
        detectorUsed: currentPipelineResult?.detectorUsed || 'faceapi',
        rawDetections: currentPipelineResult?.rawDetections,
        finalFaces: currentPipelineResult?.finalFaces
      }
    });

    return {
      facesDetected: embeddings.length,
      embeddings,
      timingMs: faceApiTimingMs,
      compare: {
        faceApi: {
          facesDetected: embeddings.length,
          timingMs: faceApiTimingMs
        },
        currentPipeline: {
          facesDetected: Array.isArray(currentPipelineResult?.faces) ? currentPipelineResult.faces.length : 0,
          timingMs: currentPipelineTimingMs,
          detectorUsed: currentPipelineResult?.detectorUsed || 'faceapi',
          rawDetections: currentPipelineResult?.rawDetections,
          finalFaces: currentPipelineResult?.finalFaces
        }
      }
    };
  } finally {
    if (imageTensor) {
      imageTensor.dispose();
    }
  }
};

module.exports = {
  runFaceApiTest
};
