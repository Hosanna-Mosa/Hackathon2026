const express = require('express');

const {
  getDeliveries,
  createDeliveryLog,
  updateDeliveryStatus,
  sendEmailDelivery
} = require('../controllers/deliveryController');

const router = express.Router();

router.get('/', getDeliveries);
router.post('/', createDeliveryLog);
router.post('/send-email', sendEmailDelivery);
router.patch('/:deliveryId/status', updateDeliveryStatus);

module.exports = router;
