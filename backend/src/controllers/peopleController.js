const mongoose = require('mongoose');

const Person = require('../models/Person');
const { runFaceApiDetection } = require('../services/faceApiDetection');
const { uploadPersonDpFromImageBuffer } = require('../services/personDpService');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const normalizePersonName = (value) => String(value || '').trim().toLowerCase();
const LABEL_MIN_FACE_CONFIDENCE = Number(process.env.LABEL_MIN_FACE_CONFIDENCE || 0.9);

const getPeople = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(userId);
    const results = await Person.aggregate([
      {
        $match: {
          ownerId: ownerObjectId
        }
      },
      {
        $lookup: {
          from: 'faces',
          let: { personId: '$_id', ownerId: '$ownerId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$personId', '$$personId'] }, { $eq: ['$ownerId', '$$ownerId'] }]
                }
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
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const name = normalizePersonName(req.body?.name);

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

    const existing = await Person.findOne({ ownerId: userId, name });

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

    let imageUrl = '';
    try {
      const uploadedDp = await uploadPersonDpFromImageBuffer({
        imageBuffer: req.file.buffer,
        box: bestFace.box,
        fileStem: name,
        folder: 'people_labels'
      });
      imageUrl = uploadedDp || '';
    } catch (_error) {
      imageUrl = '';
    }
    const embedding = Array.isArray(bestFace?.embedding) ? bestFace.embedding : [];

    const person = await Person.create({
      ownerId: userId,
      name,
      embeddings: embedding.length > 0 ? [embedding] : [],
      averageEmbedding: embedding.length > 0 ? embedding : [],
      imageUrl
    });

    await linkEntitiesToUser({
      userId,
      personIds: [String(person._id)]
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
