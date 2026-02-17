const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const extractPersonFromMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) {
    return null;
  }

  const patterns = [
    /\bsend\s+([a-z][a-z\s'.-]{1,80}?)\s+(?:photos|pictures|pics)\b/i,
    /\b(?:photos|pictures|pics)\s+of\s+([a-z][a-z\s'.-]{1,80}?)(?=\s+(?:to|on|via|using|from)\b|[?.!,]|$)/i,
    /\bof\s+([a-z][a-z\s'.-]{1,80}?)(?=\s+(?:to|on|via|using|from)\b|[?.!,]|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = String(match[1]).trim();
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
};

const extractEventFromMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) {
    return null;
  }

  const patterns = [
    /\b(?:show|find|get|search)\s+([a-z][a-z0-9\s'.-]{1,80}?)\s+(?:photos|pictures|pics)\b/i,
    /\b(?:photos|pictures|pics)\s+(?:from|of)\s+([a-z][a-z0-9\s'.-]{1,80}?)(?=\s+(?:in|at|for|on|to|via)\b|[?.!,]|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const candidate = String(match[1] || '')
      .replace(/\b(my|our|the|all|latest|old|recent)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const parseIntentFallback = (message) => {
  const normalized = String(message || '').toLowerCase();

  const emptySchema = {
    intent: 'unknown',
    person: null,
    event: null,
    location: null,
    date_range: null,
    count: null,
    platform: null
  };

  // 1. Check for SEND/SHARE intent first (highest priority for actions)
  if (normalized.includes('deliver') || normalized.includes('send') || normalized.includes('share')) {
    const isWhatsapp = normalized.includes('whatsapp');
    const isEmail = normalized.includes('mail') || normalized.includes('email');
    return {
      ...emptySchema,
      intent: 'send_photos',
      person: extractPersonFromMessage(message),
      platform: isWhatsapp ? 'whatsapp' : isEmail ? 'email' : 'email'
    };
  }

  // 2. Check for COUNT intent
  if (normalized.includes('count') || normalized.includes('how many')) {
    const person = extractPersonFromMessage(message);
    const inferredEvent = extractEventFromMessage(message);
    const event =
      person && inferredEvent && person.trim().toLowerCase() === inferredEvent.trim().toLowerCase()
        ? null
        : inferredEvent;
    return {
      ...emptySchema,
      intent: 'count_photos',
      person,
      event
    };
  }

  // 3. Check for SEARCH intent (show, find, get, or just "photos of...")
  if (normalized.includes('show') || normalized.includes('find') || normalized.includes('get') || normalized.includes('photos') || normalized.includes('pictures')) {
    const person = extractPersonFromMessage(message);
    const inferredEvent = extractEventFromMessage(message);
    const event =
      person && inferredEvent && person.trim().toLowerCase() === inferredEvent.trim().toLowerCase()
        ? null
        : inferredEvent;
    return {
      ...emptySchema,
      intent: 'search_photos',
      person,
      event
    };
  }

  return emptySchema;
};

const getGroqAgentDecision = async (message) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('Groq API key missing, falling back to regex parser');
    return parseIntentFallback(message);
  }

  const systemPrompt = `You are the core intelligence of "DrishyaMitra", a photo management assistant.
  Your ONLY job is to extract structured data from user queries into a strict JSON format.

  OUTPUT SCHEMA (Strict JSON):
  {
    "intent": "search_photos" | "count_photos" | "send_photos" | "get_most_photos" | "get_least_photos" | "get_latest_uploads" | "unknown",
    "person": string | null,    // e.g., "John", "Mom", "Dad"
    "event": string | null,     // e.g., "birthday", "wedding"
    "location": string | null,  // e.g., "Paris", "beach", "home"
    "date_range": string | null,// e.g., "last year", "2024", "yesterday", "last week"
    "count": number | null,     // e.g., 5, 10 (if user asks for specific number)
    "platform": string | null   // e.g., "whatsapp", "email"
  }

  INTENT RULES:
  - "Show/Find/Get photos...": -> "search_photos"
  - "How many...": -> "count_photos"
  - "Send/Share...": -> "send_photos"
  - "Who has most/least...": -> "get_most_photos" / "get_least_photos"
  - "Latest uploads...": -> "get_latest_uploads"
  - Anything else/Greeting: -> "unknown" (Front-end handles greeting fallback)

  EXAMPLES:
  1. "Show birthday photos of John from last year"
     -> {"intent": "search_photos", "person": "John", "event": "birthday", "date_range": "last year", "location": null, "count": null, "platform": null}
  
  2. "Send latest 5 photos of Mom on WhatsApp"
     -> {"intent": "send_photos", "person": "Mom", "count": 5, "platform": "WhatsApp", "event": null, "location": null, "date_range": "latest"}

  3. "How many photos of Babai do I have?"
     -> {"intent": "count_photos", "person": "Babai", "event": null, "location": null, "date_range": null, "count": null, "platform": null}

  4. "Show beach pictures from 2024"
     -> {"intent": "search_photos", "location": "beach", "date_range": "2024", "person": null, "event": null, "count": null, "platform": null}

  5. "Find happy family moments"
     -> {"intent": "search_photos", "event": "happy family moments", "person": null, "location": null, "date_range": null, "count": null, "platform": null} 

  Return ONLY valid JSON. No markdown.`;

  try {
    console.log('Sending request to Groq API with message:', message);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile', // Updated model as previous was decommissioned
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    console.log('Groq API Response Content:', content);

    if (!content) {
      throw new Error('Empty response from Groq');
    }

    // Attempt to clean markdown code blocks if present (though json_object format attempts to prevent this)
    const jsonString = content.replace(/^```json/, '').replace(/```$/, '').trim();
    return JSON.parse(jsonString);

  } catch (error) {
    console.error('Groq API Error Details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    return parseIntentFallback(message);
  }
};

module.exports = {
  getGroqAgentDecision
};
