const Delivery = require('../models/Delivery');
const { sendDeliveryEmail } = require('../services/emailDeliveryService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TYPES = new Set(['email', 'whatsapp', 'direct_link']);
const ALLOWED_STATUSES = new Set(['pending', 'sent', 'failed']);

const normalizeType = (value) => String(value || '').trim().toLowerCase();
const normalizeStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'delivered') {
    return 'sent';
  }
  return normalized;
};

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const getDeliveries = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const typeFilters = parseCsv(req.query?.types).filter((type) => ALLOWED_TYPES.has(type));
    const statusFilters = parseCsv(req.query?.statuses).map(normalizeStatus).filter((status) => ALLOWED_STATUSES.has(status));
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const query = { ownerId: userId };
    if (typeFilters.length > 0) {
      query.type = { $in: typeFilters };
    }
    if (statusFilters.length > 0) {
      query.status = { $in: statusFilters };
    }

    const deliveries = await Delivery.find(query).sort({ timestamp: -1, createdAt: -1 }).limit(limit);
    const [total, statusStats, typeStats] = await Promise.all([
      Delivery.countDocuments(query),
      Delivery.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Delivery.aggregate([
        { $match: query },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ])
    ]);

    const byStatus = { pending: 0, sent: 0, failed: 0 };
    for (const item of statusStats) {
      const key = String(item?._id || '');
      if (Object.prototype.hasOwnProperty.call(byStatus, key)) {
        byStatus[key] = Number(item?.count || 0);
      }
    }

    const byType = { email: 0, whatsapp: 0, direct_link: 0 };
    for (const item of typeStats) {
      const key = String(item?._id || '');
      if (Object.prototype.hasOwnProperty.call(byType, key)) {
        byType[key] = Number(item?.count || 0);
      }
    }

    return res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries,
      stats: {
        total,
        byStatus,
        byType
      }
    });
  } catch (error) {
    return next(error);
  }
};

const createDeliveryLog = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const person = String(req.body?.person || '').trim();
    const type = normalizeType(req.body?.type || 'email');
    const status = normalizeStatus(req.body?.status || 'pending');
    const recipientEmail = String(req.body?.recipientEmail || '').trim().toLowerCase();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    const photoLinks = Array.isArray(req.body?.photoLinks)
      ? req.body.photoLinks.map((link) => String(link || '').trim()).filter(Boolean)
      : [];

    if (!person) {
      return res.status(400).json({ success: false, message: 'person is required.' });
    }
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: 'type must be one of: email, whatsapp, direct_link.' });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'status must be one of: pending, sent, failed.' });
    }
    if (type === 'email' && recipientEmail && !EMAIL_REGEX.test(recipientEmail)) {
      return res.status(400).json({ success: false, message: 'recipientEmail is invalid.' });
    }

    const delivery = await Delivery.create({
      ownerId: userId,
      person,
      type,
      status,
      recipientEmail: recipientEmail || undefined,
      subject,
      message,
      photoLinks,
      timestamp: new Date()
    });

    return res.status(201).json({
      success: true,
      message: 'Delivery log created.',
      delivery
    });
  } catch (error) {
    return next(error);
  }
};

const updateDeliveryStatus = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const deliveryId = String(req.params?.deliveryId || '').trim();
    const status = normalizeStatus(req.body?.status);
    const errorMessage = String(req.body?.errorMessage || '').trim();
    const providerMessageId = String(req.body?.providerMessageId || '').trim();

    if (!deliveryId) {
      return res.status(400).json({ success: false, message: 'deliveryId is required.' });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'status must be one of: pending, sent, failed.' });
    }

    const delivery = await Delivery.findOne({ _id: deliveryId, ownerId: userId });
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found.' });
    }

    delivery.status = status;
    if (status === 'failed') {
      delivery.errorMessage = errorMessage || delivery.errorMessage || 'Delivery failed.';
    } else {
      delivery.errorMessage = '';
    }
    if (providerMessageId) {
      delivery.providerMessageId = providerMessageId;
    }

    await delivery.save();

    return res.status(200).json({
      success: true,
      message: `Delivery marked as ${status}.`,
      delivery
    });
  } catch (error) {
    return next(error);
  }
};

const sendEmailDelivery = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const person = String(req.body?.person || '').trim();
    const recipientEmail = String(req.body?.recipientEmail || '').trim().toLowerCase();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    const photoLinks = Array.isArray(req.body?.photoLinks)
      ? req.body.photoLinks.map((link) => String(link || '').trim()).filter(Boolean)
      : [];

    if (!person) {
      return res.status(400).json({ success: false, message: 'person is required.' });
    }
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      return res.status(400).json({ success: false, message: 'A valid recipientEmail is required.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }

    const delivery = await Delivery.create({
      ownerId: userId,
      person,
      type: 'email',
      recipientEmail,
      subject,
      message,
      photoLinks,
      status: 'pending',
      timestamp: new Date()
    });

    try {
      const result = await sendDeliveryEmail({
        to: recipientEmail,
        person,
        subject,
        message,
        photoLinks
      });

      delivery.status = 'sent';
      delivery.providerMessageId = result.messageId || undefined;
      delivery.errorMessage = '';
      await delivery.save();

      return res.status(200).json({
        success: true,
        message: `Delivery email sent to ${recipientEmail}.`,
        delivery
      });
    } catch (sendError) {
      delivery.status = 'failed';
      delivery.errorMessage = sendError.message || 'Failed to send delivery email.';
      await delivery.save();
      return res.status(502).json({
        success: false,
        message: delivery.errorMessage,
        delivery
      });
    }
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDeliveries,
  createDeliveryLog,
  updateDeliveryStatus,
  sendEmailDelivery
};
