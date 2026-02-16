const Photo = require('../models/Photo');
const Face = require('../models/Face');
const { uploadFilesToCloud } = require('../services/cloudUploadService');
const { runFaceApiDetection } = require('../services/faceApiDetection');
const { findBestPersonMatch } = require('../services/recognitionService');
const { runFaceApiTest } = require('../services/faceApiTestService');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const logUpload = (message, payload) => {
  if (payload === undefined) {
    console.log(`[upload-controller] ${message}`);
    return;
  }
  console.log(`[upload-controller] ${message}`, payload);
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]);
const ALLOWED_FACE_ORDER = new Set(['left_to_right', 'right_to_left']);
const SINGLE_REFERENCE_MIN_SIMILARITY = Number(process.env.SINGLE_REFERENCE_MIN_SIMILARITY || 0.55);
const SINGLE_REFERENCE_BEST_MARGIN = Number(process.env.SINGLE_REFERENCE_BEST_MARGIN || 0.03);
const EVALUATED_MIN_SIMILARITY = Number(process.env.EVALUATED_MIN_SIMILARITY || 0.95);
const EVALUATED_MIN_GAP = Number(process.env.EVALUATED_MIN_GAP || 0.02);
const FACEAPI_COMPARE_ON_UPLOAD = String(process.env.FACEAPI_COMPARE_ON_UPLOAD || 'false').toLowerCase() === 'true';

const toBoolean = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const resolveFaceOrder = (rawOrder) => {
  const normalized = String(rawOrder || '').trim().toLowerCase();
  return ALLOWED_FACE_ORDER.has(normalized) ? normalized : 'left_to_right';
};

const shouldRunFaceApiComparison = (req) => {
  const queryFlag = toBoolean(req?.query?.compareFaceApi);
  const bodyFlag = toBoolean(req?.body?.compareFaceApi);
  return FACEAPI_COMPARE_ON_UPLOAD || queryFlag || bodyFlag;
};

const centerX = (face) => Number(face?.box?.x || 0) + Number(face?.box?.width || 0) / 2;
const centerY = (face) => Number(face?.box?.y || 0) + Number(face?.box?.height || 0) / 2;

const sortFacesByOrder = (faces, faceOrder) => {
  const sorted = [...faces].sort((a, b) => {
    const deltaX = centerX(a) - centerX(b);
    if (Math.abs(deltaX) > 2) {
      return faceOrder === 'right_to_left' ? -deltaX : deltaX;
    }
    return centerY(a) - centerY(b);
  });
  return sorted;
};

const validateFiles = (files) => {
  for (const file of files) {
    const mime = String(file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      const error = new Error(`Unsupported file type: ${file.mimetype}`);
      error.statusCode = 400;
      throw error;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const error = new Error(`File too large: ${file.originalname}`);
      error.statusCode = 400;
      throw error;
    }
  }
};

const uploadPhotos = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    logUpload('handler started');

    if (!req.files || req.files.length === 0) {
      logUpload('rejected request with no files');
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    logUpload(
      'received files',
      req.files.map((file) => ({
        name: file.originalname,
        mime: file.mimetype,
        size: file.size
      }))
    );

    validateFiles(req.files);
    const faceOrder = resolveFaceOrder(req.body?.faceOrder);
    const runFaceApiComparison = shouldRunFaceApiComparison(req);

    // Start cloud upload and face detection in parallel
    const cloudUploadPromise = uploadFilesToCloud(req.files, req.body?.folder);

    // Start detection for all files
    const detectionPromises = req.files.map(async (file) => {
      try {
        return await runFaceApiDetection(file.buffer);
      } catch (error) {
        logUpload('faceapi detection failed for file', {
          fileName: file.originalname,
          message: error.message
        });
        return {
          attempts: 0,
          totalPersons: 0,
          validFaces: 0,
          uncertainPersons: 0,
          faces: []
        };
      }
    });

    // Wait for cloud upload first to get URLs (or fail early if upload fails)
    const { urls, folder } = await cloudUploadPromise;

    logUpload('cloud upload returned', {
      returnedUrlCount: urls.length,
      folder,
      faceOrder,
      runFaceApiComparison
    });

    const usableCount = Math.min(req.files.length, urls.length);

    if (usableCount === 0) {
      logUpload('no usable urls returned from cloud');
      return res.status(502).json({
        success: false,
        message: 'Cloud upload completed but no file URLs were returned.'
      });
    }

    // Wait for detections to finish
    const detections = await Promise.all(detectionPromises);

    const savedPhotos = [];
    const createdPhotoIds = [];
    const createdFaceIds = [];
    const touchedPersonIds = new Set();
    let personsDetected = 0;
    let facesConfirmed = 0;
    let uncertain = 0;

    for (let index = 0; index < usableCount; index += 1) {
      const imageUrl = urls[index];
      const sourceFile = req.files[index];
      const detection = detections[index];

      personsDetected += detection.totalPersons;
      facesConfirmed += detection.validFaces;
      uncertain += detection.uncertainPersons;

      logUpload('faceapi detection completed', {
        fileName: sourceFile.originalname,
        ...detection
      });

      if (runFaceApiComparison) {
        try {
          const faceApiResult = await runFaceApiTest(sourceFile.buffer);
          logUpload('faceapi comparison for upload', {
            fileName: sourceFile.originalname,
            faceApi: {
              facesDetected: faceApiResult.facesDetected,
              timingMs: faceApiResult.timingMs
            },
            currentPipeline: faceApiResult.compare?.currentPipeline || null
          });
        } catch (error) {
          logUpload('faceapi comparison failed', {
            fileName: sourceFile.originalname,
            message: error.message
          });
        }
      }

      const photo = await Photo.create({
        ownerId: userId,
        imageUrl,
        folder,
        faceCount: detection.validFaces,
        detectionResult: detection
      });
      createdPhotoIds.push(String(photo._id));
      const persistedFaces = [];
      const detectedFaces = Array.isArray(detection.faces) ? detection.faces : [];
      const orderedFaces = sortFacesByOrder(detectedFaces, faceOrder);
      const evaluatedFaces = [];
      for (let faceIndex = 0; faceIndex < orderedFaces.length; faceIndex += 1) {
        const face = orderedFaces[faceIndex];
        const safeEmbedding = Array.isArray(face.embedding) ? face.embedding : [];
        let match = null;
        let evaluatedMatched = false;
        let ambiguousCandidate = false;
        let similarity = 0;
        let secondBestSimilarity = 0;
        let similarityDifference = 0;
        if (face.accepted) {
          try {
            match = await findBestPersonMatch(safeEmbedding, { userId });
            similarity = Number(match?.similarity || 0);
            secondBestSimilarity = Number(match?.secondBestSimilarity || 0);
            similarityDifference = similarity - secondBestSimilarity;
            evaluatedMatched =
              Boolean(match?.matched) &&
              similarity >= EVALUATED_MIN_SIMILARITY &&
              similarityDifference >= EVALUATED_MIN_GAP;
            ambiguousCandidate =
              !evaluatedMatched &&
              Array.isArray(match?.topCandidates) &&
              match.topCandidates.length > 1 &&
              similarity >= EVALUATED_MIN_SIMILARITY &&
              similarityDifference < EVALUATED_MIN_GAP;

            logUpload('face recognition evaluated', {
              fileName: sourceFile.originalname,
              faceIndex,
              similarity,
              secondBestSimilarity,
              similarityDifference: Number(similarityDifference.toFixed(6)),
              matched: evaluatedMatched,
              rawMatched: Boolean(match?.matched),
              evaluatedMinSimilarity: EVALUATED_MIN_SIMILARITY,
              evaluatedMinGap: EVALUATED_MIN_GAP,
              peopleCompared: match.peopleCompared,
              strategy: match.strategy,
              matchedPerson: evaluatedMatched && match.person ? match.person.name : null,
              topCandidates: match.topCandidates,
              chinnuSimilarity: match.chinnuSimilarity,
              chinnuVsBestDiff: match.chinnuVsBestDiff,
              chinnuVsSecondBestDiff: match.chinnuVsSecondBestDiff
            });
          } catch (error) {
            logUpload('face recognition match failed', {
              fileName: sourceFile.originalname,
              faceIndex,
              message: error.message
            });
          }
        }
        evaluatedFaces.push({
          faceIndex,
          face,
          safeEmbedding,
          match,
          evaluatedMatched,
          ambiguousCandidate,
          similarity: Number(similarity.toFixed(6)),
          secondBestSimilarity: Number(secondBestSimilarity.toFixed(6)),
          similarityDifference: Number(similarityDifference.toFixed(6))
        });
      }

      let singleRefAllowedFaceIndex = null;
      const singleReferenceCandidates = evaluatedFaces
        .filter((item) => item.face.accepted && item.match && item.match.peopleCompared === 1)
        .sort((a, b) => Number(b.match?.similarity || 0) - Number(a.match?.similarity || 0));

      if (singleReferenceCandidates.length > 0) {
        const best = singleReferenceCandidates[0];
        const bestSimilarity = Number(best.match?.similarity || 0);
        const secondBestSimilarity = Number(singleReferenceCandidates[1]?.match?.similarity || 0);
        const margin = bestSimilarity - secondBestSimilarity;
        const meetsEvaluatedGate = bestSimilarity >= EVALUATED_MIN_SIMILARITY && margin >= EVALUATED_MIN_GAP;
        const canAssignSingleRef =
          Boolean(best.match?.matched) &&
          bestSimilarity >= SINGLE_REFERENCE_MIN_SIMILARITY &&
          margin >= SINGLE_REFERENCE_BEST_MARGIN &&
          meetsEvaluatedGate;

        logUpload('single-reference disambiguation', {
          fileName: sourceFile.originalname,
          candidates: singleReferenceCandidates.length,
          bestFaceIndex: best.faceIndex,
          bestSimilarity,
          secondBestSimilarity,
          margin: Number(margin.toFixed(6)),
          minSimilarity: SINGLE_REFERENCE_MIN_SIMILARITY,
          minMargin: SINGLE_REFERENCE_BEST_MARGIN,
          evaluatedMinSimilarity: EVALUATED_MIN_SIMILARITY,
          evaluatedMinGap: EVALUATED_MIN_GAP,
          meetsEvaluatedGate,
          accepted: canAssignSingleRef
        });

        if (canAssignSingleRef) {
          singleRefAllowedFaceIndex = best.faceIndex;
        }
      }

      for (let faceIndex = 0; faceIndex < evaluatedFaces.length; faceIndex += 1) {
        const {
          face,
          safeEmbedding,
          match,
          evaluatedMatched,
          ambiguousCandidate,
          similarity,
          secondBestSimilarity,
          similarityDifference
        } = evaluatedFaces[faceIndex];
        const usesSingleReferenceStrategy = Boolean(match?.peopleCompared === 1);
        const matchedPerson = usesSingleReferenceStrategy
          ? singleRefAllowedFaceIndex === faceIndex
            ? match?.person || null
            : null
          : evaluatedMatched
            ? match.person
            : null;
        const isAmbiguous = !usesSingleReferenceStrategy && !matchedPerson && ambiguousCandidate;
        const topCandidates = Array.isArray(match?.topCandidates)
          ? match.topCandidates
            .map((candidate) => ({
              name: String(candidate?.name || '').trim(),
              similarity: Number(Number(candidate?.similarity || 0).toFixed(6))
            }))
            .filter((candidate) => candidate.name.length > 0)
          : [];
        const suggestedName = isAmbiguous
          ? topCandidates[0]?.name || String(match?.person?.name || '').trim() || 'unknown'
          : null;
        const faceMatchStatus = matchedPerson
          ? 'matched'
          : isAmbiguous
            ? 'ambiguous'
            : 'unknown';

        try {
          const faceDoc = await Face.create({
            ownerId: userId,
            photoId: photo._id,
            box: {
              x: Number(face?.box?.x || 0),
              y: Number(face?.box?.y || 0),
              width: Number(face?.box?.width || 1),
              height: Number(face?.box?.height || 1)
            },
            personId: matchedPerson ? matchedPerson._id : null,
            embedding: safeEmbedding,
            learningConfirmed: false,
            orderIndex: faceIndex
          });
          createdFaceIds.push(String(faceDoc._id));
          if (matchedPerson?._id) {
            touchedPersonIds.add(String(matchedPerson._id));
          }

          persistedFaces.push({
            faceId: String(faceDoc._id),
            orderIndex: faceDoc.orderIndex,
            box: faceDoc.box,
            confidence: Number(Number(face.confidence || 0).toFixed(6)),
            personId: matchedPerson ? String(matchedPerson._id) : null,
            name: matchedPerson ? matchedPerson.name : suggestedName || 'unknown',
            learningConfirmed: faceDoc.learningConfirmed,
            faceMatchStatus,
            similarity,
            secondBestSimilarity,
            similarityGap: similarityDifference,
            candidateNames: topCandidates
          });
        } catch (error) {
          // Face DB persistence is isolated; upload should never fail because of one face.
          logUpload('face record persist failed', {
            fileName: sourceFile.originalname,
            message: error.message
          });
        }
      }

      savedPhotos.push({
        photoId: String(photo._id),
        imageUrl: photo.imageUrl,
        faceOrder,
        faces: persistedFaces
      });
    }

    await linkEntitiesToUser({
      userId,
      photoIds: createdPhotoIds,
      faceIds: createdFaceIds,
      personIds: Array.from(touchedPersonIds)
    });

    logUpload('upload completed', { savedPhotos: savedPhotos.length });
    const uncertainOnlyMessage =
      personsDetected > 0 && facesConfirmed === 0 && uncertain > 0
        ? 'We detected people but couldn’t confirm clear faces. Try uploading a closer or cropped photo.'
        : 'Photos uploaded and face-api detection completed.';

    res.status(201).json({
      success: true,
      status: 'faceapi_detection_completed',
      message: uncertainOnlyMessage,
      count: savedPhotos.length,
      personsDetected,
      facesConfirmed,
      uncertain,
      photos: savedPhotos
    });

    return;
  } catch (error) {
    logUpload('handler failed', {
      message: error.message,
      statusCode: error.statusCode
    });
    if (!res.headersSent && error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  uploadPhotos
};
