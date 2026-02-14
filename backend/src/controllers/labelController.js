const Face = require('../models/Face');
const Person = require('../models/Person');

const DUPLICATE_SIMILARITY_THRESHOLD = Number(process.env.EMBEDDING_DUPLICATE_SIMILARITY_THRESHOLD || 0.9995);

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

const labelFace = async (req, res, next) => {
  try {
    const faceId = String(req.body?.faceId || '').trim();
    const name = String(req.body?.name || '').trim();

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

    let person = await Person.findOne({ name });
    if (!person) {
      // Upsert prevents duplicate creation during concurrent labels.
      person = await Person.findOneAndUpdate(
        { name },
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
      const existingEmbeddings = normalizeEmbeddingBank(person.embeddings);
      if (existingEmbeddings.length > 0 && existingEmbeddings[0].length !== newEmbedding.length) {
        return res.status(400).json({
          success: false,
          message: 'Embedding length mismatch for this person.'
        });
      }

      if (!isDuplicateEmbedding(existingEmbeddings, newEmbedding)) {
        existingEmbeddings.push(newEmbedding);
      }

      person.embeddings = existingEmbeddings;
      person.averageEmbedding = computeAverageEmbedding(existingEmbeddings);
      await person.save();
    }

    face.personId = person._id;
    face.learningConfirmed = true;
    await face.save();

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

module.exports = {
  labelFace
};
