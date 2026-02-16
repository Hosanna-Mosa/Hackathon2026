const Face = require('../models/Face');
const Photo = require('../models/Photo');
const Person = require('../models/Person');
const { extractManualFaceEmbedding } = require('../services/manualFaceService');
const { uploadPersonDpFromImageUrl } = require('../services/personDpService');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const DUPLICATE_SIMILARITY_THRESHOLD = Number(process.env.EMBEDDING_DUPLICATE_SIMILARITY_THRESHOLD || 0.9995);

const normalizePersonName = (value) => String(value || '').trim().toLowerCase();
const INVALID_PERSON_LABELS = new Set(['unknown', 'unknown_person', 'unknown person']);
const toVector = (value) => (Array.isArray(value) ? value.map((v) => Number(v) || 0) : []);

const normalizeEmbeddingBank = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  if (typeof value[0] === 'number') {
    return [toVector(value)];
  }
  return value
    .filter((item) => Array.isArray(item))
    .map((item) => toVector(item))
    .filter((item) => item.length > 0);
};

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
  const next = toVector(nextEmbedding);
  if (next.length === 0) {
    return true;
  }

  const nextKey = toEmbeddingKey(next);
  return existingEmbeddings.some((existing) => {
    if (!Array.isArray(existing) || existing.length !== next.length) {
      return false;
    }
    if (toEmbeddingKey(existing) === nextKey) {
      return true;
    }
    return cosineSimilarity(existing, next) >= DUPLICATE_SIMILARITY_THRESHOLD;
  });
};

const computeAverageEmbedding = (embeddings) => {
  const bank = normalizeEmbeddingBank(embeddings);
  if (bank.length === 0) {
    return [];
  }

  const dim = bank[0].length;
  const sums = new Array(dim).fill(0);
  let count = 0;

  for (const embedding of bank) {
    if (embedding.length !== dim) {
      continue;
    }
    for (let i = 0; i < dim; i += 1) {
      sums[i] += embedding[i];
    }
    count += 1;
  }

  if (count === 0) {
    return [];
  }

  return sums.map((value) => Number((value / count).toFixed(8)));
};

const appendEmbeddingToPerson = async (userId, name, embedding) => {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    const error = new Error('Unauthorized request.');
    error.statusCode = 401;
    throw error;
  }

  const normalizedName = normalizePersonName(name);
  if (!normalizedName) {
    const error = new Error('Name is required.');
    error.statusCode = 400;
    throw error;
  }

  const personQuery = {
    ownerId: safeUserId,
    name: normalizedName
  };

  let person = await Person.findOne(personQuery);
  if (!person) {
    person = await Person.create({
      ownerId: safeUserId,
      name: normalizedName,
      embeddings: [embedding],
      averageEmbedding: embedding
    });
    return person;
  }

  const bank = normalizeEmbeddingBank(person.embeddings);
  if (bank.length > 0 && bank[0].length !== embedding.length) {
    const error = new Error('Embedding length mismatch for this person.');
    error.statusCode = 400;
    throw error;
  }

  if (!isDuplicateEmbedding(bank, embedding)) {
    bank.push(embedding);
  }

  person.embeddings = bank;
  person.averageEmbedding = computeAverageEmbedding(bank);
  await person.save();
  return person;
};

const manualFaceLabel = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const photoId = String(req.body?.photoId || '').trim();
    const name = normalizePersonName(req.body?.name);
    const box = req.body?.box;

    if (!photoId || !name || !box) {
      return res.status(400).json({
        success: false,
        message: 'photoId, box, and name are required.'
      });
    }

    if (INVALID_PERSON_LABELS.has(name)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a real person name. "unknown" labels are not allowed.'
      });
    }

    const photo = await Photo.findOne({ _id: photoId, ownerId: userId });
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found.'
      });
    }

    const { embedding, box: clampedBox } = await extractManualFaceEmbedding(photo.imageUrl, box);
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract embedding from selected region.'
      });
    }

    const person = await appendEmbeddingToPerson(userId, name, embedding);
    try {
      const dpUrl = await uploadPersonDpFromImageUrl({
        imageUrl: photo.imageUrl,
        box: clampedBox,
        fileStem: person.name,
        folder: 'people_labels'
      });
      if (dpUrl) {
        person.imageUrl = dpUrl;
        await person.save();
      }
    } catch (_error) {
      // DP generation failure should not block manual labeling.
    }

    const face = await Face.create({
      ownerId: userId,
      photoId: photo._id,
      box: {
        x: clampedBox.x,
        y: clampedBox.y,
        width: clampedBox.width,
        height: clampedBox.height
      },
      personId: person._id,
      embedding,
      learningConfirmed: true,
      orderIndex: 0
    });

    await Photo.findOneAndUpdate({ _id: photo._id, ownerId: userId }, {
      $inc: { faceCount: 1 }
    });

    await linkEntitiesToUser({
      userId,
      faceIds: [String(face._id)],
      personIds: [String(person._id)]
    });

    return res.status(201).json({
      success: true,
      face: {
        faceId: String(face._id),
        box: face.box,
        personId: String(person._id),
        name: person.name,
        learningConfirmed: true,
        confidence: 1
      }
    });
  } catch (error) {
    if (!res.headersSent && error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to label manual face region.'
      });
    }
    return next(error);
  }
};

module.exports = {
  manualFaceLabel
};
