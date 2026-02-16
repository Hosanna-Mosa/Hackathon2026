const { getGroqAgentDecision } = require('../services/groqService');
const photoService = require('../services/photoService');

const chatWithAgent = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'message is required in request body.' });
    }

    // 1. Get structured intent from Groq
    const decision = await getGroqAgentDecision(message);
    console.log('Agent Decision:', decision);

    if (!decision || !decision.intent) {
      return res.json({
        success: true,
        agentDecision: decision,
        result: {
          action: 'unknown',
          message: "Sorry, I didn't understand your request."
        }
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
        const photos = await photoService.searchPhotos({ person, event, location, date_range, tags: [], count });
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
        const total = await photoService.countPhotos({ person, event, location, date_range, tags: [] });
        let msg = '';
        if (person) msg = `You have ${total} photos of ${person}.`;
        else if (event) msg = `You have ${total} photos from the ${event}.`;
        else msg = `You have a total of ${total} photos.`;

        result.message = msg;
        result.data = { count: total };
        break;

      case 'send_photos':
        const sendResult = await photoService.sendPhotos({ person, platform, count });
        result.message = sendResult.message;
        result.data = sendResult;
        break;

      case 'get_most_photos':
        const most = await photoService.getStats('most_photos');
        result.message = most
          ? `${most.person} has the most photos (${most.count}).`
          : "Not enough data to determine statistics.";
        result.data = most || {};
        break;

      case 'get_least_photos':
        const least = await photoService.getStats('least_photos');
        result.message = least
          ? `${least.person} has the least photos (${least.count}).`
          : "Not enough data to determine statistics.";
        result.data = least || {};
        break;

      case 'unknown':
      default:
        // Attempt to catch basic greetings if Groq categorized them as unknown
        if (message.match(/^(hi|hello|hey)/i)) {
          result.message = "Hi there! I'm Drishyamitra. I can help find photos, count them, or show you stats. Try 'Show photos of John'!";
          result.action = 'chat_reply';
        } else {
          result.message = "Sorry, I didn't verify that command. Try asking to 'Show photos', 'Count photos', or 'Send photos'.";
        }
        break;
    }

    return res.status(200).json({
      success: true,
      agentDecision: decision,
      result: result
    });

  } catch (error) {
    console.error('Chat Controller Error:', error);
    next(error);
  }
};

module.exports = {
  chatWithAgent
};
