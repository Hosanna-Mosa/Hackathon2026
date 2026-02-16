const express = require('express');

const { chatWithAgent, getChatHistory } = require('../controllers/chatController');

const router = express.Router();

router.post('/', chatWithAgent);
router.get('/history', getChatHistory);

module.exports = router;
