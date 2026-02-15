const express = require('express');
const { labelFace, confirmPhotoLabels } = require('../controllers/labelController');

const router = express.Router();

router.post('/label-face', labelFace);
router.post('/confirm-photo-labels', confirmPhotoLabels);

module.exports = router;
