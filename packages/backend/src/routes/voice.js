import express from 'express';
import { discoverVoices, selectPiperVoice } from '../lib/piperVoices.js';
import { PiperSpeech } from '../lib/piperSpeech.js';
export function createVoiceRouter({ discover = discoverVoices, speech = new PiperSpeech() } = {}) {
  const router = express.Router();
  router.get('/status', (req, res) => {
    const voices = discover().map(({ id, language, locale, name }) => ({ id, language, locale, name }));
    res.set('Cache-Control', 'no-store').json({ available: voices.length > 0, offline: true, voices });
  });
  router.post('/speak', async (req, res) => {
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`)
      return res.status(403).json({ error: 'Same-origin requests only' });
    const { text, language, voiceId = '_piper-auto', rate = 0.95 } = req.body || {};
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 400 ||
      typeof language !== 'string' ||
      !['de', 'en', 'fr'].includes(language.split(/[-_]/)[0]) ||
      typeof voiceId !== 'string' ||
      !Number.isFinite(rate) ||
      rate < 0.8 ||
      rate > 1.2
    )
      return res.status(400).json({ error: 'Invalid speech request' });
    const voice = selectPiperVoice(discover(), language, voiceId);
    if (!voice) return res.status(503).json({ error: 'Matching local voice is not installed' });
    try {
      res
        .set('Cache-Control', 'no-store')
        .type('audio/wav')
        .send(await speech.speak(voice, text.trim(), rate));
    } catch (error) {
      res
        .status(error.status || 503)
        .json({ error: error.status === 429 ? 'Local voice is busy' : 'Local synthesis unavailable' });
    }
  });
  return router;
}
const speech = new PiperSpeech();
process.once('exit', () => speech.close());
export default createVoiceRouter({ speech });
