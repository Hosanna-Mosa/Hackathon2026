const Photo = require('../models/Photo');
const Delivery = require('../models/Delivery');
const { getGroqAgentDecision } = require('../services/groqService');

const handleGetPhotosIntent = async (decision) => {
  const personFilter = decision?.person || null;

  const query = personFilter
    ? { detectedPersons: { $in: [String(personFilter).toLowerCase()] } }
    : {};

  const photos = await Photo.find(query).sort({ createdAt: -1 }).limit(30);

  return {
    action: 'get_photos',
    message: `Found ${photos.length} photos.`,
    data: { photos }
  };
};

const handleDeliveryIntent = async (decision) => {
  const person = decision?.person || 'unknown_person';
  const type = decision?.channel === 'whatsapp' ? 'whatsapp' : 'email';

  const delivery = await Delivery.create({
    person,
    type,
    timestamp: new Date()
  });

  return {
    action: 'log_delivery',
    message: `Delivery logged for ${person} via ${type}.`,
    data: { delivery }
  };
};

const chatWithAgent = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'message is required in request body.' });
    }

    const decision = await getGroqAgentDecision(message);
    const action = decision?.action || 'chat_reply';

    let payload;

    if (action === 'get_photos') {
      payload = await handleGetPhotosIntent(decision);
    } else if (action === 'log_delivery') {
      payload = await handleDeliveryIntent(decision);
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
