import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure upload directories exist
const uploadDirs = ['drivers', 'cars', 'tracks', 'teams'];
uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '../../public/uploads', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'misc';
    const validTypes = ['drivers', 'cars', 'tracks', 'teams'];
    const folder = validTypes.includes(type) ? type : 'misc';
    const uploadPath = path.join(__dirname, '../../public/uploads', folder);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

/**
 * POST /api/upload/:type
 * Upload an image for drivers, cars, or tracks
 * Returns the URL path to access the image
 */
router.post('/:type', upload.single('img'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const type = req.params.type;
    const photoUrl = `/uploads/${type}/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        url: photoUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/upload/:type/:filename
 * Delete an uploaded image
 */
router.delete('/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    const validTypes = ['drivers', 'cars', 'tracks', 'teams'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type'
      });
    }

    const filePath = path.join(__dirname, '../../public/uploads', type, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: 'File deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handler for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB'
      });
    }
  }
  res.status(500).json({
    success: false,
    error: error.message
  });
});

export default router;
