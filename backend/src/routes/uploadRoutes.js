const express = require('express');
const multer = require('multer');

const { uploadPhotos } = require('../controllers/uploadController');

const router = express.Router();
const logUpload = (message, payload) => {
  if (payload === undefined) {
    console.log(`[upload-route] ${message}`);
    return;
  }
  console.log(`[upload-route] ${message}`, payload);
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]);

const imageFileFilter = (_req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const upload = multer({
  // Keep files in memory so they can be proxied to the VPS upload server.
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  }
});

router.post('/', (req, res, next) => {
  logUpload('incoming request', {
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers['content-type']
  });

  upload.array('photos', 10)(req, res, (error) => {
    if (!error) {
      logUpload('multer parsed files', {
        fileCount: Array.isArray(req.files) ? req.files.length : 0
      });
      return next();
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'One or more files exceed the 10MB size limit.'
          : error.message;
      logUpload('multer error', { code: error.code, message });
      return res.status(400).json({ success: false, message });
    }

    logUpload('file filter/error', { message: error.message });
    return res.status(400).json({ success: false, message: error.message });
  });
}, uploadPhotos);

module.exports = router;
