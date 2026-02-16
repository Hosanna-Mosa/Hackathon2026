const { getGroqAgentDecision } = require('../services/groqService');
const photoService = require('../services/photoService');
const Photo = require('../models/Photo');
const Delivery = require('../models/Delivery');
const Face = require('../models/Face');
const Person = require('../models/Person');
const ChatHistory = require('../models/ChatHistory');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeHistoryLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
};

const storeChatHistory = async ({
  userId,
  prompt,
  status = 'success',
  agentDecision = null,
  result = null,
  errorMessage = null
}) => {
  if (!userId || !prompt) return;
  try {
    await ChatHistory.create({
      ownerId: userId,
      prompt,
      command: prompt,
      status,
      agentDecision,
      assistant: {
        action: result?.action || 'unknown',
        message: result?.message || '',
        data: result?.data || null
      },
      errorMessage: errorMessage || null
    });
  } catch (historyError) {
    console.error('Chat History Persist Error:', historyError);
  }
};

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
    status: 'sent',
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
  let userId = '';
  let userPrompt = '';
  try {
    userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const { message } = req.body || {};
    userPrompt = String(message || '').trim();
    if (!userPrompt) {
      return res.status(400).json({ message: 'message is required in request body.' });
    }

    // 1. Get structured intent from Groq
    const decision = await getGroqAgentDecision(userPrompt);
    console.log('Agent Decision:', decision);

    if (!decision || !decision.intent) {
      const fallbackResult = {
        action: 'unknown',
        message: "Sorry, I didn't understand your request."
      };
      await storeChatHistory({
        userId,
        prompt: userPrompt,
        status: 'success',
        agentDecision: decision || null,
        result: fallbackResult
      });
      return res.json({
        success: true,
        agentDecision: decision,
        result: fallbackResult
      });
    }

    const { intent, person, event, location, date_range, count, platform } = decision;

    let result = {
      action: intent,
      message: '',
      data: {}
    };

    // 2. Switch based on intent
    switch (intent.toLowerCase()) {
      case 'search_photos':
      case 'get_latest_uploads': // searchPhotos already sorts by date descending
        const photos = await photoService.searchPhotos({
          person,
          event,
          location,
          date_range,
          tags: [],
          count,
          ownerId: userId
        });
        const hasPhotos = photos.length > 0;

        result.message = hasPhotos
          ? `Found ${photos.length} photos matching your request. Taking you to the gallery...`
          : "I couldn't find any photos matching that description.";

        // Construct navigation URL for frontend
        let targetUrl = '/gallery';
        if (hasPhotos) {
          const queryParams = new URLSearchParams();
          if (person) queryParams.set('person', person);
          if (event) queryParams.set('search', event); // Assuming gallery has generic search
          if (location) queryParams.set('location', location);

          const queryString = queryParams.toString();
          if (queryString) targetUrl += `?${queryString}`;
        }

        result.data = {
          photos,
          navigate: hasPhotos, // Only navigate if photos exist
          targetUrl: hasPhotos ? targetUrl : undefined
        };
        break;

      case 'count_photos':
        const total = await photoService.countPhotos({
          person,
          event,
          location,
          date_range,
          tags: [],
          ownerId: userId
        });
        let msg = '';
        if (person) msg = `You have ${total} photos of ${person}.`;
        else if (event) msg = `You have ${total} photos from the ${event}.`;
        else msg = `You have a total of ${total} photos.`;

        result.message = msg;
        result.data = { count: total };
        break;

      case 'send_photos':
        const sendResult = await photoService.sendPhotos({ person, platform, count, ownerId: userId });
        result.message = sendResult.message;
        result.data = sendResult;
        break;

      case 'get_most_photos':
        const most = await photoService.getStats('most_photos', userId);
        result.message = most
          ? `${most.person} has the most photos (${most.count}).`
          : "Not enough data to determine statistics.";
        result.data = most || {};
        break;

      case 'get_least_photos':
        const least = await photoService.getStats('least_photos', userId);
        result.message = least
          ? `${least.person} has the least photos (${least.count}).`
          : "Not enough data to determine statistics.";
        result.data = least || {};
        break;

      case 'unknown':
      default:
        // Attempt to catch basic greetings if Groq categorized them as unknown
        if (userPrompt.match(/^(hi|hello|hey)/i)) {
          result.message = "Hi there! I'm Drishyamitra. I can help find photos, count them, or show you stats. Try 'Show photos of John'!";
          result.action = 'chat_reply';
        } else {
          result.message = "Sorry, I didn't verify that command. Try asking to 'Show photos', 'Count photos', or 'Send photos'.";
        }
        break;
    }

    await storeChatHistory({
      userId,
      prompt: userPrompt,
      status: 'success',
      agentDecision: decision,
      result
    });

    return res.status(200).json({
      success: true,
      agentDecision: decision,
      result: result
    });

  } catch (error) {
    console.error('Chat Controller Error:', error);
    await storeChatHistory({
      userId,
      prompt: userPrompt,
      status: 'failed',
      result: {
        action: 'error',
        message: 'Failed to process your request.'
      },
      errorMessage: error?.message || 'Unknown error'
    });
    next(error);
  }
};

const getChatHistory = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const limit = normalizeHistoryLimit(req.query.limit);
    const history = await ChatHistory.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatWithAgent,
  getChatHistory
};
