const express = require('express');

const { chatWithAgent } = require('../controllers/chatController');

const router = express.Router();

router.post('/', chatWithAgent);

module.exports = router;
