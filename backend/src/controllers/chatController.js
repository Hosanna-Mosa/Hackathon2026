const Photo = require('../models/Photo');
const Delivery = require('../models/Delivery');
const Face = require('../models/Face');
const Person = require('../models/Person');
const { getGroqAgentDecision } = require('../services/groqService');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const handleGetPhotosIntent = async (decision, userId) => {
  const personFilter = decision?.person || null;
  const query = { ownerId: userId };

  if (personFilter) {
    const personName = String(personFilter || '').trim();
    const safeName = escapeRegex(personName);
    const personDoc = await Person.findOne({
      ownerId: userId,
      name: { $regex: `^${safeName}$`, $options: 'i' }
    }).lean();

    if (!personDoc) {
      return {
        action: 'get_photos',
        message: 'Found 0 photos.',
        data: { photos: [] }
      };
    }

    const photoIds = await Face.distinct('photoId', {
      ownerId: userId,
      personId: personDoc._id
    });
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return {
        action: 'get_photos',
        message: 'Found 0 photos.',
        data: { photos: [] }
      };
    }
    query._id = { $in: photoIds };
  }

  const photos = await Photo.find(query).sort({ createdAt: -1 }).limit(30);

  return {
    action: 'get_photos',
    message: `Found ${photos.length} photos.`,
    data: { photos }
  };
};

const handleDeliveryIntent = async (decision, userId) => {
  const person = decision?.person || 'unknown_person';
  const type = decision?.channel === 'whatsapp' ? 'whatsapp' : 'email';

  const delivery = await Delivery.create({
    ownerId: userId,
    person,
    type,
    timestamp: new Date()
  });

  await linkEntitiesToUser({
    userId,
    deliveryIds: [String(delivery._id)]
  });

  return {
    action: 'log_delivery',
    message: `Delivery logged for ${person} via ${type}.`,
    data: { delivery }
  };
};

const chatWithAgent = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'message is required in request body.' });
    }

    const decision = await getGroqAgentDecision(message);
    const action = decision?.action || 'chat_reply';

    let payload;

    if (action === 'get_photos') {
      payload = await handleGetPhotosIntent(decision, userId);
    } else if (action === 'log_delivery') {
      payload = await handleDeliveryIntent(decision, userId);
    } else {
      payload = {
        action: 'chat_reply',
        message:
          'I can help with photo lookup and delivery logging. Try: "show my photos" or "send delivery to John on whatsapp".',
        data: { decision }
      };
    }

    return res.status(200).json({
      success: true,
      agentDecision: decision,
      result: payload
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatWithAgent
};
