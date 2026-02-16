require('./tensorflowRuntime');
const { decodeImageBufferToTensor } = require('./tfImageUtils');
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

    imageTensor = await decodeImageBufferToTensor(imageBuffer);

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
