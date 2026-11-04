const { GoogleGenAI, Type } = require('@google/genai');

let mockGenerator = null;

function setMockGenerator(fn) {
  mockGenerator = fn;
}

function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

function isGeminiConfigured() {
  if (mockGenerator) return true;
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  return (
    key !== 'your_gemini_api_key_here' &&
    !lower.includes('your_gemini') &&
    !lower.includes('placeholder')
  );
}

function createClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function generateStructuredJson({ task, systemInstruction, prompt, responseSchema, timeoutMs = 18000 }) {
  if (mockGenerator) {
    return await mockGenerator({ task, systemInstruction, prompt, responseSchema });
  }

  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = createClient();
  const model = getModelName();

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs);
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema
        }
      }),
      timeoutPromise
    ]);

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Empty response from Gemini');
    }

    return JSON.parse(rawText);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  Type,
  setMockGenerator,
  getModelName,
  isGeminiConfigured,
  generateStructuredJson
};
