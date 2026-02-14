const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const parseIntentFallback = (message) => {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('show') || normalized.includes('gallery') || normalized.includes('photo')) {
    return { action: 'get_photos', filters: {} };
  }

  if (normalized.includes('deliver') || normalized.includes('send')) {
    return {
      action: 'log_delivery',
      person: 'unknown_person',
      channel: normalized.includes('whatsapp') ? 'whatsapp' : 'email'
    };
  }

  return { action: 'chat_reply' };
};

const getGroqAgentDecision = async (message) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return parseIntentFallback(message);
  }

  const systemPrompt =
    'You are an intent router for a photo platform. Return only JSON with action and params.';

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(rawContent);
      return parsed;
    } catch (_jsonError) {
      return parseIntentFallback(message);
    }
  } catch (error) {
    console.error('Groq request failed:', error.message);
    return parseIntentFallback(message);
  }
};

module.exports = {
  getGroqAgentDecision
};
