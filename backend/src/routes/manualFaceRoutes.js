const express = require('express');

const { manualFaceLabel } = require('../controllers/manualFaceController');

const router = express.Router();

router.post('/manual-face', manualFaceLabel);

module.exports = router;
