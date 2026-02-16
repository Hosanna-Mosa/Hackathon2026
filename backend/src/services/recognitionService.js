const Person = require('../models/Person');

const DEFAULT_SIMILARITY_THRESHOLD = Number(process.env.FACE_SIMILARITY_THRESHOLD || 0.95);
const DEFAULT_SIMILARITY_MARGIN = Number(process.env.FACE_SIMILARITY_MARGIN || 0.08);
const DEFAULT_SINGLE_PERSON_THRESHOLD = Number(process.env.FACE_SIMILARITY_SINGLE_PERSON_THRESHOLD || 0.42);

const toVector = (value) => (Array.isArray(value) ? value.map((v) => Number(v) || 0) : []);
const normalizeEmbeddingBank = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  // Backward compatibility: legacy records stored a single flat vector.
  if (typeof value[0] === 'number') {
    const vector = toVector(value);
    return vector.length > 0 ? [vector] : [];
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

const findBestPersonMatch = async (
  embedding,
  {
    userId,
    threshold = DEFAULT_SIMILARITY_THRESHOLD,
    minMargin = DEFAULT_SIMILARITY_MARGIN,
    singlePersonThreshold = DEFAULT_SINGLE_PERSON_THRESHOLD
  } = {}
) => {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return { person: null, similarity: 0, secondBestSimilarity: 0, matched: false };
  }

  if (!String(userId || '').trim()) {
    return {
      person: null,
      similarity: 0,
      secondBestSimilarity: 0,
      matched: false,
      peopleCompared: 0,
      strategy: 'missing_user_scope'
    };
  }

  let people = [];
  try {
    people = await Person.find(
      { ownerId: userId, embeddings: { $exists: true, $not: { $size: 0 } } },
      { name: 1, embeddings: 1, averageEmbedding: 1 }
    ).lean();
  } catch (error) {
    return {
      person: null,
      similarity: 0,
      secondBestSimilarity: 0,
      matched: false,
      peopleCompared: 0,
      strategy: 'db_error',
      dbError: error.message
    };
  }

  let bestPerson = null;
  let bestSimilarity = 0;
  let secondBestSimilarity = 0;
  const candidateScores = [];
  for (const person of people) {
    const bank = normalizeEmbeddingBank(person.embeddings);
    if (Array.isArray(person.averageEmbedding) && person.averageEmbedding.length > 0) {
      bank.push(toVector(person.averageEmbedding));
    }

    let personBestSimilarity = 0;
    for (const candidateEmbedding of bank) {
      const similarity = cosineSimilarity(embedding, candidateEmbedding);
      if (similarity > personBestSimilarity) {
        personBestSimilarity = similarity;
      }
    }

    const similarity = personBestSimilarity;
    candidateScores.push({
      name: person.name,
      similarity: Number(similarity.toFixed(6))
    });
    if (similarity > bestSimilarity) {
      secondBestSimilarity = bestSimilarity;
      bestSimilarity = similarity;
      bestPerson = person;
    } else if (similarity > secondBestSimilarity) {
      secondBestSimilarity = similarity;
    }
  }

  const margin = bestSimilarity - secondBestSimilarity;
  const hasSingleReference = people.length === 1;
  const matched = hasSingleReference
    ? bestSimilarity >= singlePersonThreshold
    : bestSimilarity >= threshold && margin >= minMargin;
  const topCandidates = candidateScores
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
  const chinnuEntry = candidateScores.find((item) => String(item.name || '').toLowerCase() === 'chinnu');
  const chinnuSimilarity = chinnuEntry ? chinnuEntry.similarity : null;
  const chinnuVsBestDiff =
    chinnuSimilarity === null ? null : Number((bestSimilarity - Number(chinnuSimilarity)).toFixed(6));
  const chinnuVsSecondBestDiff =
    chinnuSimilarity === null ? null : Number((Number(chinnuSimilarity) - secondBestSimilarity).toFixed(6));

  return {
    person: matched ? bestPerson : null,
    similarity: Number(bestSimilarity.toFixed(6)),
    secondBestSimilarity: Number(secondBestSimilarity.toFixed(6)),
    matched,
    peopleCompared: people.length,
    strategy: hasSingleReference ? 'single_reference' : 'multi_reference',
    topCandidates,
    chinnuSimilarity,
    chinnuVsBestDiff,
    chinnuVsSecondBestDiff
  };
};

module.exports = {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_SINGLE_PERSON_THRESHOLD,
  cosineSimilarity,
  findBestPersonMatch
};
