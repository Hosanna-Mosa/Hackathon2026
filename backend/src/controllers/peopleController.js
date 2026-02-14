const Person = require('../models/Person');
const { runFaceApiDetection } = require('../services/faceApiDetection');
const { uploadFilesToCloud } = require('../services/cloudUploadService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LABEL_MIN_FACE_CONFIDENCE = Number(process.env.LABEL_MIN_FACE_CONFIDENCE || 0.9);

const getPeople = async (_req, res, next) => {
  try {
    const results = await Person.aggregate([
      {
        $lookup: {
          from: 'faces',
          let: { personId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$personId', '$$personId'] }
              }
            },
            {
              $sort: {
                createdAt: -1
              }
            }
          ],
          as: 'faces'
        }
      },
      {
        $addFields: {
          latestFace: { $arrayElemAt: ['$faces', 0] },
          photos: {
            $size: {
              $setUnion: [
                {
                  $map: {
                    input: '$faces',
                    as: 'face',
                    in: '$$face.photoId'
                  }
                },
                []
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'photos',
          localField: 'latestFace.photoId',
          foreignField: '_id',
          as: 'latestPhoto'
        }
      },
      {
        $unwind: {
          path: '$latestPhoto',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          personId: { $toString: '$_id' },
          name: '$name',
          photos: '$photos',
          sampleImageUrl: { $ifNull: ['$latestPhoto.imageUrl', '$imageUrl'] },
          lastLabeledAt: '$latestFace.createdAt'
        }
      },
      {
        $sort: {
          photos: -1,
          name: 1
        }
      }
    ]);

    return res.status(200).json({
      people: results,
      count: results.length
    });
  } catch (error) {
    return next(error);
  }
};

const createPerson = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.'
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'One clear reference photo is required.'
      });
    }

    const safeName = escapeRegex(name);
    const existing = await Person.findOne({
      name: { $regex: `^${safeName}$`, $options: 'i' }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A person with this label already exists.'
      });
    }

    const detection = await runFaceApiDetection(req.file.buffer);
    const acceptedFaces = (Array.isArray(detection.faces) ? detection.faces : []).filter((face) => face?.accepted);

    if (acceptedFaces.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Label photo must contain exactly one person.'
      });
    }

    const bestFace = acceptedFaces[0];
    const confidence = Number(bestFace?.confidence || 0);
    if (confidence < LABEL_MIN_FACE_CONFIDENCE) {
      return res.status(400).json({
        success: false,
        message: `Face is not clear enough. Please upload a clearer photo (confidence >= ${LABEL_MIN_FACE_CONFIDENCE}).`
      });
    }

    const { urls } = await uploadFilesToCloud([req.file], 'people_labels');
    const imageUrl = urls[0];
    const embedding = Array.isArray(bestFace?.embedding) ? bestFace.embedding : [];

    const person = await Person.create({
      name,
      embeddings: embedding.length > 0 ? [embedding] : [],
      averageEmbedding: embedding.length > 0 ? embedding : [],
      imageUrl
    });

    return res.status(201).json({
      success: true,
      person: {
        personId: String(person._id),
        name: person.name,
        photos: 0,
        sampleImageUrl: person.imageUrl
      }
    });
  } catch (error) {
    if (!res.headersSent && error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A person with this label already exists.'
      });
    }
    return next(error);
  }
};

module.exports = {
  getPeople,
  createPerson
};
