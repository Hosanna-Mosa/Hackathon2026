const express = require('express');

const { getPhotos, updatePhotoPrivacy, deletePhoto } = require('../controllers/galleryController');

const router = express.Router();

router.get('/', getPhotos);
router.patch('/:id/privacy', updatePhotoPrivacy);
router.delete('/:id', deletePhoto);

module.exports = router;
