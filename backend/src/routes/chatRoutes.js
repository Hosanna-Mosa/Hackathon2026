const express = require('express');

const { chatWithAgent, getChatHistory, sendPhotosEmailFromDialog } = require('../controllers/chatController');

const router = express.Router();

router.post('/', chatWithAgent);
router.get('/history', getChatHistory);
router.post('/send-email', sendPhotosEmailFromDialog);

module.exports = router;
