const path = require('path');
const fs = require('fs');
require('./tfjsCompat');
const tf = require('@tensorflow/tfjs');
const faceapi = require('face-api.js');
const canvas = require('canvas');

const DEFAULT_MODEL_DIR_CANDIDATES = [
  path.resolve(__dirname, '../models/faceapi'),
  path.resolve(__dirname, '../../models/faceapi')
];

let loadPromise = null;

// Patch Node.js canvas bindings for face-api.js environment.
faceapi.env.monkeyPatch({
  Canvas: canvas.Canvas,
  Image: canvas.Image,
  ImageData: canvas.ImageData,
  createCanvasElement: () => canvas.createCanvas(1, 1),
  createImageElement: () => new canvas.Image()
});

const getModelDir = () => {
  const configured = String(process.env.FACEAPI_MODEL_DIR || '').trim();
  if (configured) {
    return path.resolve(configured);
  }

  const existing = DEFAULT_MODEL_DIR_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  return existing || DEFAULT_MODEL_DIR_CANDIDATES[0];
};

const preloadFaceApiModels = async () => {
  if (!loadPromise) {
    loadPromise = (async () => {
      const modelDir = getModelDir();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir),
        faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir)
      ]);

      console.log('[faceapi-loader] models loaded', { modelDir });
      return { faceapi, modelDir };
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
};

const getFaceApi = async () => {
  const context = await preloadFaceApiModels();
  return context.faceapi;
};

module.exports = {
  preloadFaceApiModels,
  getFaceApi
};
