import express from 'express';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Use environment variable with fallback for local development
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || 'e9412f8586757fed5ce6c2233c22ff9f3756e149';

// Generate TTS audio from text
router.post('/generate', authenticate, async (req, res) => {
  const { text, voice = 'aura-asteria-en' } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required' });
  }

  // Limit text length to prevent abuse (Deepgram has limits)
  const maxLength = 10000;
  const truncatedText = text.slice(0, maxLength);

  try {
    const response = await fetch('https://api.deepgram.com/v1/speak', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: truncatedText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to generate audio',
        details: errorText
      });
    }

    // Get the audio buffer
    const audioBuffer = await response.arrayBuffer();

    // Return as audio/mpeg
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
    });
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('TTS generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get available voices
router.get('/voices', authenticate, async (req, res) => {
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
