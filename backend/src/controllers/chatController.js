const { getGroqAgentDecision } = require('../services/groqService');
const photoService = require('../services/photoService');
const Photo = require('../models/Photo');
const Delivery = require('../models/Delivery');
const Face = require('../models/Face');
const Person = require('../models/Person');
const ChatHistory = require('../models/ChatHistory');
const { linkEntitiesToUser } = require('../services/userEntityLinkService');
const { sendDeliveryEmail } = require('../services/emailDeliveryService');

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EMAIL_PHOTO_LIMIT = Number(process.env.DEFAULT_EMAIL_PHOTO_LIMIT || 12);
const MAX_EMAIL_PHOTO_LIMIT = 30;
const MIN_EMAIL_PHOTO_LIMIT = 1;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeName = (value) => String(value || '').trim();

const normalizePlatform = (decisionPlatform, rawMessage) => {
  const direct = String(decisionPlatform || '').trim().toLowerCase();
  if (direct.includes('whatsapp')) {
    return 'whatsapp';
  }
  if (direct.includes('mail') || direct.includes('email')) {
    return 'email';
  }

  const message = String(rawMessage || '').toLowerCase();
  if (message.includes('whatsapp')) {
    return 'whatsapp';
  }
  if (message.includes('mail') || message.includes('email')) {
    return 'email';
  }
  return 'email';
};

const clampPhotoLimit = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EMAIL_PHOTO_LIMIT;
  }
  return Math.min(Math.max(Math.floor(parsed), MIN_EMAIL_PHOTO_LIMIT), MAX_EMAIL_PHOTO_LIMIT);
};

const extractPersonFromMessage = (rawMessage) => {
  const message = String(rawMessage || '').trim();
  if (!message) {
    return null;
  }

  const patterns = [
    /\bsend\s+([a-z][a-z\s'.-]{1,80}?)\s+(?:photos|pictures|pics)\b/i,
    /\b(?:photos|pictures|pics)\s+of\s+([a-z][a-z\s'.-]{1,80}?)(?=\s+(?:to|on|via|using|from)\b|[?.!,]|$)/i,
    /\bof\s+([a-z][a-z\s'.-]{1,80}?)(?=\s+(?:to|on|via|using|from)\b|[?.!,]|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const candidate = String(match[1] || '')
      .replace(/\b(his|her|their|my|our)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const findPersonByName = async (userId, personName) => {
  const safeName = escapeRegex(personName);
  let personDoc = await Person.findOne({
    ownerId: userId,
    name: { $regex: `^${safeName}$`, $options: 'i' }
  });

  if (personDoc) {
    return personDoc;
  }

  personDoc = await Person.findOne({
    ownerId: userId,
    name: { $regex: safeName, $options: 'i' }
  });
  return personDoc;
};

const resolvePerson = async ({ userId, personInput, personId }) => {
  const safePersonId = String(personId || '').trim();
  if (safePersonId && /^[a-f\d]{24}$/i.test(safePersonId)) {
    const byId = await Person.findOne({
      _id: safePersonId,
      ownerId: userId
    });
    if (byId) {
      return byId;
    }
  }

  const personName = String(personInput || '').trim();
  if (!personName) {
    return null;
  }

  return findPersonByName(userId, personName);
};

const fetchPhotosForPerson = async ({ userId, personId, count }) => {
  const photoIds = await Face.distinct('photoId', {
    ownerId: userId,
    personId
  });
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return [];
  }

  const limit = clampPhotoLimit(count);
  return Photo.find({
    ownerId: userId,
    _id: { $in: photoIds }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

const sendPersonPhotosByEmail = async ({ userId, personInput, personId, recipientName, recipientEmail, count, senderName, senderEmail }) => {
  // 1. Resolve Subject (Photos of whom?)
  const personDoc = await resolvePerson({ userId, personInput, personId });
  if (!personDoc) {
    return {
      action: 'send_photos',
      message: "I couldn't find that person in your People directory.",
      data: {}
    };
  }

  // 2. Fetch photos
  const photos = await fetchPhotosForPerson({
    userId,
    personId: personDoc._id,
    count
  });
  if (!Array.isArray(photos) || photos.length === 0) {
    return {
      action: 'send_photos',
      message: `I couldn't find any photos for ${personDoc.name}.`,
      data: {
        personId: String(personDoc._id),
        person: personDoc.name,
        photos: []
      }
    };
  }

  // 3. Determine Recipient Email
  let targetEmail = normalizeEmail(recipientEmail);
  let targetName = recipientName || personDoc.name;
  let targetPersonId = null; // ID of the person whose email we are using (if resolved from DB)

  if (recipientName) {
    const recipientDoc = await resolvePerson({ userId, personInput: recipientName });
    if (recipientDoc) {
      targetName = recipientDoc.name;
      targetPersonId = String(recipientDoc._id);
      if (!targetEmail) {
        targetEmail = normalizeEmail(recipientDoc.email);
      }
    } else {
      targetName = recipientName;
    }
  } else {
    targetName = personDoc.name;
    targetPersonId = String(personDoc._id);
    if (!targetEmail) {
      targetEmail = normalizeEmail(personDoc.email);
    }
  }

  // 4. Validate Email or Request It
  if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
    // If we resolved a person (targetPersonId) but they have no email, we ask for it and update them later.
    // If we have a raw name (targetName) but no person doc, we ask for it.

    // We pass back recipientName so frontend can say "Enter email for Chinnu"
    // We pass back personId/person (Subject) so we know whose photos to send.

    return {
      action: 'request_person_email',
      message: `I don't have an email for ${targetName}. Please enter it so I can send the photos.`,
      data: {
        personId: String(personDoc._id), // Subject ID
        person: personDoc.name,          // Subject Name
        recipientName: targetName,       // Target Name (for UI Prompt)
        photoCount: photos.length,
        requiresEmail: true
      }
    };
  }

  // 5. If we found a Person Doc for the recipient (and they had an email, OR we were passed an email and matched it),
  // AND the email we are using differs from stored, we update.
  // BUT logic is tricky with separate recipient.
  // If we resolved a recipientDoc separate from subject:
  if (recipientName && targetPersonId) {
    // We found a doc for recipient. Update their email if needed.
    const recipientDoc = await Person.findOne({ _id: targetPersonId, ownerId: userId });
    if (recipientDoc && normalizeEmail(recipientDoc.email) !== targetEmail) {
      recipientDoc.email = targetEmail;
      await recipientDoc.save();
    }
  } else if (!recipientName && targetPersonId) {
    // We are sending to subject.
    if (normalizeEmail(personDoc.email) !== targetEmail) {
      personDoc.email = targetEmail;
      await personDoc.save();
    }
  }

  // 6. Send Email
  const photoLinks = photos.map((photo) => String(photo.imageUrl || '').trim()).filter(Boolean);
  const safeSenderName = normalizeName(senderName) || 'Drishyamitra user';
  const safeSenderEmail = normalizeEmail(senderEmail);
  const emailMessage = `Hi ${targetName}, sharing ${photoLinks.length} photo${photoLinks.length === 1 ? '' : 's'} of ${personDoc.name} from ${safeSenderName}.`;
  const emailSubject = `Photos of ${personDoc.name}`;

  const delivery = await Delivery.create({
    ownerId: userId,
    person: targetName, // The recipient name
    type: 'email',
    recipientEmail: targetEmail,
    subject: emailSubject,
    message: emailMessage,
    photoLinks,
    status: 'pending',
    timestamp: new Date()
  });

  await linkEntitiesToUser({
    userId,
    personIds: [String(personDoc._id)], // Link to Subject
    deliveryIds: [String(delivery._id)]
  });

  try {
    const providerResult = await sendDeliveryEmail({
      to: targetEmail,
      person: targetName,
      subject: emailSubject,
      message: emailMessage,
      photoLinks,
      senderName: safeSenderName,
      senderEmail: safeSenderEmail
    });

    delivery.status = 'sent';
    delivery.providerMessageId = providerResult.messageId || undefined;
    delivery.errorMessage = '';
    await delivery.save();

    return {
      action: 'send_photos',
      message: `Sent ${photoLinks.length} photos of ${personDoc.name} to ${targetEmail} (${targetName}).`,
      data: {
        delivery,
        photos,
        personId: String(personDoc._id),
        person: personDoc.name,
        recipientEmail: targetEmail
      }
    };
  } catch (sendError) {
    delivery.status = 'failed';
    delivery.errorMessage = sendError.message || 'Failed to send email.';
    await delivery.save();

    return {
      action: 'send_photos',
      message: `I found the photos but couldn't send the email to ${targetName}: ${delivery.errorMessage}`,
      data: {
        delivery,
        photos,
        personId: String(personDoc._id),
        person: personDoc.name,
        recipientEmail: targetEmail
      }
    };
  }
};

const handleDeliveryIntent = async ({ userId, person, recipient, platform, count, messageText, senderName, senderEmail }) => {
  const resolvedPlatform = normalizePlatform(platform, messageText);
  const resolvedPerson = String(person || '').trim() || extractPersonFromMessage(messageText || '');

  if (resolvedPlatform === 'email') {
    if (!resolvedPerson) {
      return {
        action: 'send_photos',
        message: 'Please mention the person name to send photos by email.',
        data: {}
      };
    }
    return sendPersonPhotosByEmail({
      userId,
      personInput: resolvedPerson,
      recipientName: recipient, // Pass the recipient name if determined
      count,
      senderName,
      senderEmail
    });
  }

  const deliveryPerson = recipient || resolvedPerson || 'requested contact';
  const delivery = await Delivery.create({
    ownerId: userId,
    person: deliveryPerson,
    type: 'whatsapp',
    status: 'sent',
    timestamp: new Date()
  });

  await linkEntitiesToUser({
    userId,
    deliveryIds: [String(delivery._id)]
  });

  return {
    action: 'send_photos',
    message: `Delivery logged for ${deliveryPerson} via whatsapp.`,
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

    const { intent, person, recipient, event, location, date_range, count, platform } = decision;

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
          if (event) queryParams.set('event', event);
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
        // 1. Context Resolution: If person is missing, look at recent history
        if (!person) {
          try {
            const lastPersonHistory = await ChatHistory.findOne({
              ownerId: userId,
              'agentDecision.person': { $ne: null }
            }).sort({ createdAt: -1 });

            if (lastPersonHistory?.agentDecision?.person) {
              decision.person = lastPersonHistory.agentDecision.person;
              // console.log('Context inferred person:', decision.person);
            }
          } catch (ctxError) {
            console.error('Context inference failed:', ctxError);
          }
        }

        // 2. Use handleDeliveryIntent which supports email verification and prompts
        const deliveryResult = await handleDeliveryIntent({
          userId,
          person: decision.person,
          recipient: decision.recipient, // Pass extracted recipient
          platform: platform || 'email', // Default to email if not specified but intent is send
          count,
          messageText: userPrompt,
          senderName: req.user?.name,
          senderEmail: req.user?.email
        });

        result.action = deliveryResult.action;
        result.message = deliveryResult.message;
        result.data = deliveryResult.data || {};
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
    next(error);
  }
};

const sendPhotosEmailFromDialog = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const personId = String(req.body?.personId || '').trim();
    const person = String(req.body?.person || '').trim();
    const recipientName = String(req.body?.recipientName || '').trim(); // New field
    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const count = req.body?.count;

    if (!personId && !person) {
      return res.status(400).json({
        success: false,
        message: 'personId or person is required.'
      });
    }

    const result = await sendPersonPhotosByEmail({
      userId,
      personInput: person,
      personId,
      recipientName, // Pass generic recipient name
      recipientEmail,
      count,
      senderName: req.user?.name,
      senderEmail: req.user?.email
    });

    if (result.action === 'request_person_email') {
      return res.status(400).json({
        success: false,
        message: result.message || 'Please provide recipientEmail.'
      });
    }

    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  chatWithAgent,
  getChatHistory,
  sendPhotosEmailFromDialog
};
