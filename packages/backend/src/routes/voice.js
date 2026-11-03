import express from 'express';
import { OfflineVoices, installedVoices } from '../lib/offlineVoices.js';
import { selectPiperVoice } from '../lib/piperVoices.js';
import { PiperSpeech } from '../lib/piperSpeech.js';

export function createVoiceRouter({
  speech = new PiperSpeech(),
  manager = new OfflineVoices({ beforeChange: () => speech.close() }),
} = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/status', (req, res) => res.json(manager.status()));
  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`)
      return res.status(403).json({ error: 'Same-origin requests only' });
    next();
  });
  router.post('/install', (req, res) => {
    if (!manager.status().supported) return res.status(400).json({ error: 'Unsupported offline voice platform' });
    if (!manager.startInstall()) return res.status(409).json({ error: 'Offline voice operation in progress' });
    res.status(202).json(manager.status());
  });
  router.delete('/installation', async (req, res) => {
    try {
      if (!(await manager.remove())) return res.status(409).json({ error: 'Offline voice operation in progress' });
      res.json(manager.status());
    } catch {
      res.status(500).json({ error: 'Failed to remove offline voices' });
    }
  });
  router.post('/speak', async (req, res) => {
    const { text, language, voiceId, rate = 1.1 } = req.body || {};
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 400 ||
      typeof language !== 'string' ||
      typeof voiceId !== 'string' ||
      !Number.isFinite(rate) ||
      rate < 0.1 ||
      rate > 10
    )
      return res.status(400).json({ error: 'Invalid speech request' });
    const voice = selectPiperVoice(installedVoices(manager.home), language, voiceId);
    if (manager.phase !== 'idle' || !voice)
      return res.status(503).json({ error: 'Matching local voice is not installed' });
    try {
      res.type('audio/wav').send(await speech.speak(voice, text.trim(), rate));
    } catch (error) {
      res.status(error.status || 503).json({ error: 'Local synthesis unavailable' });
    }
  });
  return router;
}
const speech = new PiperSpeech();
process.once('exit', () => {
  speech.close().catch(() => {});
});
export default createVoiceRouter({ speech });
