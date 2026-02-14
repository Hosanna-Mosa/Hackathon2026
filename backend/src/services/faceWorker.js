const axios = require('axios');

const Photo = require('../models/Photo');
const Person = require('../models/Person');
const { runFaceApiDetection } = require('./faceApiDetection');

const logWorker = (message, payload) => {
  if (payload === undefined) {
    console.log(`[face-worker] ${message}`);
    return;
  }
  console.log(`[face-worker] ${message}`, payload);
};

const upsertPersonMappings = async (personNames, photoId) => {
  await Promise.all(
    personNames.map(async (name) => {
      await Person.findOneAndUpdate(
        { name },
        { $addToSet: { photoIds: photoId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    })
  );
};

const processPhotoFaceDetection = async (photoId) => {
  try {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      logWorker('photo not found', { photoId });
      return;
    }

    if (!photo.imageUrl) {
      logWorker('photo has no imageUrl', { photoId });
      return;
    }

    const imageResponse = await axios.get(photo.imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    const detection = await runFaceApiDetection(imageBuffer);
    const faces = Array.isArray(detection?.faces) ? detection.faces : [];
    const detectedPersons = faces.map((_, index) => `person_${index + 1}`);

    await Photo.findByIdAndUpdate(photoId, { detectedPersons });
    await upsertPersonMappings(detectedPersons, photoId);

    logWorker('face detection completed', {
      photoId: String(photoId),
      detectedPersonsCount: detectedPersons.length
    });
  } catch (error) {
    // Errors are contained in worker scope so upload API never crashes.
    logWorker('face detection failed', {
      photoId: String(photoId),
      message: error.message
    });
  }
};

const runFaceDetectionAsync = (photoId) => {
  setImmediate(() => {
    processPhotoFaceDetection(photoId);
  });
};

module.exports = {
  runFaceDetectionAsync
};
