const Face = require('../models/Face');
const Person = require('../models/Person');
const Photo = require('../models/Photo');
const { uploadPersonDpFromImageUrl } = require('../services/personDpService');

const DUPLICATE_SIMILARITY_THRESHOLD = Number(process.env.EMBEDDING_DUPLICATE_SIMILARITY_THRESHOLD || 0.9995);
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizePersonName = (value) => String(value || '').trim().toLowerCase();

const toVector = (value) => (Array.isArray(value) ? value.map((v) => Number(v) || 0) : []);
const normalizeEmbeddingBank = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  // Backward compatibility: migrate legacy flat vector in-memory.
  if (typeof value[0] === 'number') {
    return [toVector(value)];
  }
  return value
    .filter((item) => Array.isArray(item))
    .map((item) => toVector(item))
    .filter((item) => item.length > 0);
};
const hasValidEmbedding = (embedding) => Array.isArray(embedding) && embedding.length > 0;

const cosineSimilarity = (left, right) => {
  const a = toVector(left);
  const b = toVector(right);
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
};

const toEmbeddingKey = (embedding) => toVector(embedding).map((v) => Number(v).toFixed(6)).join(',');

const isDuplicateEmbedding = (existingEmbeddings, nextEmbedding) => {
  if (!hasValidEmbedding(nextEmbedding)) {
    return true;
  }
  const nextKey = toEmbeddingKey(nextEmbedding);
  return existingEmbeddings.some((existing) => {
    if (!Array.isArray(existing) || existing.length !== nextEmbedding.length) {
      return false;
    }
    if (toEmbeddingKey(existing) === nextKey) {
      return true;
    }
    return cosineSimilarity(existing, nextEmbedding) >= DUPLICATE_SIMILARITY_THRESHOLD;
  });
};

const computeAverageEmbedding = (embeddings) => {
  const bank = normalizeEmbeddingBank(embeddings);
  if (bank.length === 0) {
    return [];
  }

  const dimension = bank[0].length;
  const sums = new Array(dimension).fill(0);
  let count = 0;

  for (const embedding of bank) {
    if (embedding.length !== dimension) {
      continue;
    }
    for (let i = 0; i < dimension; i += 1) {
      sums[i] += embedding[i];
    }
    count += 1;
  }

  if (count === 0) {
    return [];
  }

  return sums.map((value) => Number((value / count).toFixed(8)));
};

const attachEmbeddingToPerson = async (person, embedding) => {
  const newEmbedding = toVector(embedding);
  if (!hasValidEmbedding(newEmbedding)) {
    const error = new Error('Face embedding is missing or invalid.');
    error.statusCode = 400;
    throw error;
  }

  const existingEmbeddings = normalizeEmbeddingBank(person.embeddings);
  if (existingEmbeddings.length > 0 && existingEmbeddings[0].length !== newEmbedding.length) {
    const error = new Error('Embedding length mismatch for this person.');
    error.statusCode = 400;
    throw error;
  }

  if (!isDuplicateEmbedding(existingEmbeddings, newEmbedding)) {
    existingEmbeddings.push(newEmbedding);
  }

  person.embeddings = existingEmbeddings;
  person.averageEmbedding = computeAverageEmbedding(existingEmbeddings);
  await person.save();
};

const labelFace = async (req, res, next) => {
  try {
    const faceId = String(req.body?.faceId || '').trim();
    const name = normalizePersonName(req.body?.name);

    if (!faceId || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both faceId and name are required.'
      });
    }

    const face = await Face.findById(faceId);
    if (!face) {
      return res.status(404).json({
        success: false,
        message: 'Face record not found.'
      });
    }
    const newEmbedding = toVector(face.embedding);
    if (!hasValidEmbedding(newEmbedding)) {
      return res.status(400).json({
        success: false,
        message: 'Face embedding is missing or invalid.'
      });
    }

    const safeName = escapeRegex(name);
    let person = await Person.findOne({
      name: { $regex: `^${safeName}$`, $options: 'i' }
    });
    if (!person) {
      // Upsert prevents duplicate creation during concurrent labels.
      person = await Person.findOneAndUpdate(
        { name: { $regex: `^${safeName}$`, $options: 'i' } },
        {
          $setOnInsert: {
            name,
            embeddings: [newEmbedding],
            averageEmbedding: newEmbedding
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      await attachEmbeddingToPerson(person, newEmbedding);
    }

    face.personId = person._id;
    face.learningConfirmed = true;
    await face.save();

    try {
      const photo = await Photo.findById(face.photoId).lean();
      if (photo?.imageUrl) {
        const dpUrl = await uploadPersonDpFromImageUrl({
          imageUrl: photo.imageUrl,
          box: face.box,
          fileStem: person.name,
          folder: 'people_labels'
        });
        if (dpUrl) {
          person.imageUrl = dpUrl;
          await person.save();
        }
      }
    } catch (_error) {
      // DP generation failure should never block labeling flow.
    }

    return res.status(200).json({
      success: true,
      faceId: String(face._id),
      personId: String(person._id),
      name: person.name,
      embeddingsCount: normalizeEmbeddingBank(person.embeddings).length,
      learningConfirmed: face.learningConfirmed
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Failed to label face.${error?.message ? ` ${error.message}` : ''}`
      });
    }
    return next(error);
  }
};

const confirmPhotoLabels = async (req, res, next) => {
  try {
    const photoId = String(req.body?.photoId || '').trim();

    if (!photoId) {
      return res.status(400).json({
        success: false,
        message: 'photoId is required.'
      });
    }

    const faces = await Face.find({ photoId });
    if (!Array.isArray(faces) || faces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No faces found for this photo.'
      });
    }

    const unresolvedFaces = faces.filter((face) => !face.personId);
    if (unresolvedFaces.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please label all faces before confirming this photo.',
        unresolvedFaceIds: unresolvedFaces.map((face) => String(face._id))
      });
    }

    const toConfirm = faces.filter((face) => !face.learningConfirmed);
    const confirmedFaceIds = [];
    const personIdsTouched = new Set();

    for (const face of toConfirm) {
      const person = await Person.findById(face.personId);
      if (!person) {
        return res.status(400).json({
          success: false,
          message: `Linked person record missing for face ${String(face._id)}.`
        });
      }

      await attachEmbeddingToPerson(person, face.embedding);
      personIdsTouched.add(String(person._id));
      face.learningConfirmed = true;
      await face.save();
      try {
        const photo = await Photo.findById(face.photoId).lean();
        if (photo?.imageUrl) {
          const dpUrl = await uploadPersonDpFromImageUrl({
            imageUrl: photo.imageUrl,
            box: face.box,
            fileStem: person.name,
            folder: 'people_labels'
          });
          if (dpUrl) {
            person.imageUrl = dpUrl;
            await person.save();
          }
        }
      } catch (_error) {
        // DP generation failure should not block bulk confirmation.
      }
      confirmedFaceIds.push(String(face._id));
    }

    return res.status(200).json({
      success: true,
      photoId,
      confirmedCount: confirmedFaceIds.length,
      confirmedFaceIds,
      peopleUpdated: personIdsTouched.size
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Failed to confirm photo labels.${error?.message ? ` ${error.message}` : ''}`
      });
    }
    return next(error);
  }
};

module.exports = {
  labelFace,
  confirmPhotoLabels
};
