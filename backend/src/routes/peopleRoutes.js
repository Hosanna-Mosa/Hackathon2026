const express = require('express');
const multer = require('multer');

const { getPeople, createPerson, updatePersonEmail } = require('../controllers/peopleController');

const router = express.Router();
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

const imageFileFilter = (_req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

router.get('/', getPeople);
router.post('/', (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (!error) {
      return next();
    }
    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Photo exceeds the 10MB size limit.'
          : error.code === 'LIMIT_FILE_COUNT'
            ? 'Only one photo is allowed.'
            : error.message;
      return res.status(400).json({ success: false, message });
    }
    return res.status(400).json({ success: false, message: error.message });
  });
}, createPerson);
router.patch('/:personId/email', updatePersonEmail);

module.exports = router;
