const express = require('express');

const { chatWithAgent, sendPhotosEmailFromDialog } = require('../controllers/chatController');

const router = express.Router();

router.post('/', chatWithAgent);
router.post('/send-email', sendPhotosEmailFromDialog);

module.exports = router;
