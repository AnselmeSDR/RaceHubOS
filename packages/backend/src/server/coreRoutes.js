import path from 'path';

export const IMAGE_TYPES = ['drivers', 'cars', 'tracks', 'teams'];

/** The endpoints every API listing points to. */
const ENDPOINTS = {
  drivers: '/api/drivers',
  cars: '/api/cars',
  tracks: '/api/tracks',
  teams: '/api/teams',
  championships: '/api/championships',
  sessions: '/api/sessions',
  config: '/api/config',
  records: '/api/records',
  stats: '/api/stats',
  bluetooth: '/api/bluetooth',
  settings: '/api/settings',
  sync: '/api/sync',
  simulator: '/api/simulator',
};

/** Uploaded images (`/api/img/<type>/<file>` from `uploadsDir`), the health check and the API listing. */
export function addCoreRoutes(app, { version, uploadsDir }) {
  // Images through the API: no port to guess for the browser
  app.get('/api/img/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    if (!IMAGE_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid image type' });
    // basename: a decoded %2F must not climb out of the uploads
    res.sendFile(path.join(uploadsDir, type, path.basename(filename)), (err) => {
      if (err) res.status(404).json({ error: 'Image not found' });
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version });
  });

  app.get('/api', (req, res) => {
    res.json({ name: 'RaceHubOS API', version, endpoints: ENDPOINTS });
  });
}
