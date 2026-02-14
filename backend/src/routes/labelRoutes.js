const express = require('express');
const { labelFace } = require('../controllers/labelController');

const router = express.Router();

router.post('/label-face', labelFace);

module.exports = router;
