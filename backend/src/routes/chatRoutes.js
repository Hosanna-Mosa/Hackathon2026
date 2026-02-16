const express = require('express');

const { chatWithAgent, getChatHistory } = require('../controllers/chatController');
const { chatWithAgent, sendPhotosEmailFromDialog } = require('../controllers/chatController');

const router = express.Router();

router.post('/', chatWithAgent);
router.get('/history', getChatHistory);
router.post('/send-email', sendPhotosEmailFromDialog);

module.exports = router;
