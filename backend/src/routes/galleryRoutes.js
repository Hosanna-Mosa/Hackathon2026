const express = require('express');

const { getPhotos } = require('../controllers/galleryController');

const router = express.Router();

router.get('/', getPhotos);

module.exports = router;
