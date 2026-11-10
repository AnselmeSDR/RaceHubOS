import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { IMAGE_TYPES } from '../server/coreRoutes.js';
import { HttpError, route } from '../lib/http.js';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

/** Image uploads of drivers, cars, tracks and teams, served back by `/api/img/<type>/<file>`. */
export function createUploadRouter(uploadsDir) {
  const router = express.Router();

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const folder = path.join(uploadsDir, req.params.type);
        fs.mkdirSync(folder, { recursive: true });
        cb(null, folder);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
    },
    limits: { fileSize: MAX_SIZE },
  }).single('img');

  router.param('type', (req, res, next, type) => {
    if (!IMAGE_TYPES.includes(type)) return res.status(400).json({ success: false, error: 'Invalid type' });
    next();
  });

  router.post('/:type', (req, res) => {
    upload(req, res, (error) => {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB' });
      }
      if (error) return res.status(500).json({ success: false, error: error.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
      const { filename, originalname, size } = req.file;
      res.json({
        success: true,
        data: { url: `/api/img/${req.params.type}/${filename}`, filename, originalName: originalname, size },
      });
    });
  });

  router.delete(
    '/:type/:filename',
    route(null, (req, res) => {
      // basename: a decoded %2F must not climb out of the uploads
      const filePath = path.join(uploadsDir, req.params.type, path.basename(req.params.filename));
      if (!fs.existsSync(filePath)) throw new HttpError(404, 'File not found');
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted' });
    })
  );

  return router;
}
