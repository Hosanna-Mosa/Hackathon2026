const express = require('express');

const { getPhotos, deletePhoto } = require('../controllers/galleryController');

const router = express.Router();

router.get('/', getPhotos);
router.delete('/:id', deletePhoto);

module.exports = router;
