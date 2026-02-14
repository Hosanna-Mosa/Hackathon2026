const express = require('express');
const multer = require('multer');

const { runFaceApiTest } = require('../services/faceApiTestService');

const router = express.Router();

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file?.mimetype || '').toLowerCase();
    if (ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed.'), false);
  }
});

router.post('/test-faceapi', (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10MB size limit.' : error.message;
      return res.status(400).json({ success: false, message });
    }

    return res.status(400).json({ success: false, message: error.message });
  });
}, async (req, res, next) => {
  try {
    if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        message: 'A photo file is required in field "photo".'
      });
    }

    const result = await runFaceApiTest(req.file.buffer);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (!res.headersSent && error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message || 'face-api test failed.' });
    }
    return next(error);
  }
});

module.exports = router;
