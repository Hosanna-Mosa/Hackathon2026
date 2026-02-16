const mongoose = require('mongoose');

const Person = require('../models/Person');
const { runFaceApiDetection } = require('../services/faceApiDetection');
const { uploadPersonDpFromImageBuffer } = require('../services/personDpService');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const normalizePersonName = (value) => String(value || '').trim().toLowerCase();
const normalizePersonEmail = (value) => String(value || '').trim().toLowerCase();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
          email: { $ifNull: ['$email', ''] },
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
    const email = normalizePersonEmail(req.body?.email);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.'
      });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email is invalid.'
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
      email,
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
        email: person.email || '',
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

const updatePersonEmail = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const personId = String(req.params?.personId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(personId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid person id.'
      });
    }

    const email = normalizePersonEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email is invalid.'
      });
    }

    const person = await Person.findOneAndUpdate(
      {
        _id: personId,
        ownerId: userId
      },
      {
        $set: { email }
      },
      {
        new: true
      }
    );

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Email saved for ${person.name}.`,
      person: {
        personId: String(person._id),
        name: person.name,
        email: person.email || ''
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPeople,
  createPerson,
  updatePersonEmail
};
