import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

async function getDeepgramKey(userId) {
  const { data } = await supabase
    .from('app_settings')
    .select('deepgram_api_key')
    .eq('user_id', userId)
    .maybeSingle();

  return (data?.deepgram_api_key) || process.env.DEEPGRAM_API_KEY || '';
}

const DEEPGRAM_CHUNK_SIZE = 1900; // safely under 2000-char limit

/**
 * Split text into chunks of at most DEEPGRAM_CHUNK_SIZE characters,
 * breaking only at sentence boundaries (. ! ?) or, failing that, at spaces.
 */
function splitIntoChunks(text) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > DEEPGRAM_CHUNK_SIZE) {
    // Try to break at the last sentence-end within the window
    const window = remaining.slice(0, DEEPGRAM_CHUNK_SIZE);
    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('.\n'),
    );
    const breakAt = sentenceEnd > 0 ? sentenceEnd + 1 : window.lastIndexOf(' ');
    const cut = breakAt > 0 ? breakAt : DEEPGRAM_CHUNK_SIZE;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

// Generate TTS audio from text
router.post('/generate', optionalAuth, async (req, res) => {
  const { text, voice = 'aura-asteria-en' } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Use user's own key if logged in, otherwise fall back to global key
  const apiKey = req.user ? await getDeepgramKey(req.user.id) : (process.env.DEEPGRAM_API_KEY || '');
  if (!apiKey) {
    return res.status(400).json({ error: 'Deepgram API key not configured.' });
  }

  const chunks = splitIntoChunks(text);

  try {
    const audioBuffers = [];

    for (const chunk of chunks) {
      const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Deepgram API error:', response.status, errorText);
        return res.status(response.status).json({ error: 'Failed to generate audio', details: errorText });
      }

      audioBuffers.push(Buffer.from(await response.arrayBuffer()));
    }

    const combined = Buffer.concat(audioBuffers);
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': combined.byteLength });
    res.send(combined);
  } catch (err) {
    console.error('TTS generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get available voices
router.get('/voices', optionalAuth, async (req, res) => {
  // Deepgram Aura voices
  const voices = [
    { id: 'aura-asteria-en', name: 'Asteria', language: 'English', gender: 'female' },
    { id: 'aura-luna-en', name: 'Luna', language: 'English', gender: 'female' },
    { id: 'aura-stella-en', name: 'Stella', language: 'English', gender: 'female' },
    { id: 'aura-athena-en', name: 'Athena', language: 'English', gender: 'female' },
    { id: 'aura-hera-en', name: 'Hera', language: 'English', gender: 'female' },
    { id: 'aura-orion-en', name: 'Orion', language: 'English', gender: 'male' },
    { id: 'aura-arcas-en', name: 'Arcas', language: 'English', gender: 'male' },
    { id: 'aura-perseus-en', name: 'Perseus', language: 'English', gender: 'male' },
    { id: 'aura-angus-en', name: 'Angus', language: 'English', gender: 'male' },
    { id: 'aura-orpheus-en', name: 'Orpheus', language: 'English', gender: 'male' },
    { id: 'aura-helios-en', name: 'Helios', language: 'English', gender: 'male' },
    { id: 'aura-zeus-en', name: 'Zeus', language: 'English', gender: 'male' },
  ];
  res.json(voices);
});

export default router;
