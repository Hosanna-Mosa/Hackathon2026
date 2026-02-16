const axios = require('axios');
const path = require('path');

let transporter;
const MAX_ATTACHMENT_COUNT = Number(process.env.EMAIL_MAX_ATTACHMENT_COUNT || 8);
const MAX_ATTACHMENT_FILE_BYTES = Number(process.env.EMAIL_MAX_ATTACHMENT_FILE_BYTES || 8 * 1024 * 1024);
const MAX_ATTACHMENT_TOTAL_BYTES = Number(process.env.EMAIL_MAX_ATTACHMENT_TOTAL_BYTES || 20 * 1024 * 1024);

const parseSecure = () => {
  const raw = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  if (!raw) {
    return Number(process.env.SMTP_PORT || 587) === 465;
  }
  return raw === 'true' || raw === '1' || raw === 'yes';
};

const buildTransporter = () => {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_error) {
    throw new Error('nodemailer is not installed. Run "npm install nodemailer" in backend/.');
  }

  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: parseSecure(),
    auth: {
      user,
      pass
    }
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizePhotoLinks = (photoLinks) =>
  Array.isArray(photoLinks)
    ? photoLinks.map((link) => String(link || '').trim()).filter(Boolean)
    : [];

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const normalizeFilename = (value) =>
  String(value || '')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '');

const extensionFromContentType = (contentType) => {
  const value = String(contentType || '').toLowerCase();
  if (value.includes('jpeg') || value.includes('jpg')) return '.jpg';
  if (value.includes('png')) return '.png';
  if (value.includes('webp')) return '.webp';
  if (value.includes('gif')) return '.gif';
  if (value.includes('heic')) return '.heic';
  if (value.includes('heif')) return '.heif';
  return '.jpg';
};

const buildAttachmentFilename = ({ link, index, contentType }) => {
  try {
    const parsed = new URL(link);
    const candidate = normalizeFilename(path.basename(parsed.pathname || ''));
    if (candidate) {
      if (path.extname(candidate)) {
        return candidate;
      }
      return `${candidate}${extensionFromContentType(contentType)}`;
    }
  } catch (_error) {
    // Ignore malformed URL and fallback to generated name.
  }

  return `shared-photo-${index + 1}${extensionFromContentType(contentType)}`;
};

const fetchPhotoAttachment = async (link, index) => {
  if (!isHttpUrl(link)) {
    return null;
  }

  const response = await axios.get(link, {
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: MAX_ATTACHMENT_FILE_BYTES,
    maxBodyLength: MAX_ATTACHMENT_FILE_BYTES
  });

  const content = Buffer.from(response.data || []);
  if (!content || content.length === 0 || content.length > MAX_ATTACHMENT_FILE_BYTES) {
    return null;
  }

  const contentType = String(response.headers?.['content-type'] || '').trim();
  return {
    filename: buildAttachmentFilename({ link, index, contentType }),
    content,
    contentType: contentType || undefined
  };
};

const buildPhotoAttachments = async (photoLinks) => {
  const links = normalizePhotoLinks(photoLinks).slice(0, MAX_ATTACHMENT_COUNT);
  const attachments = [];
  let totalBytes = 0;

  for (let index = 0; index < links.length; index += 1) {
    try {
      const attachment = await fetchPhotoAttachment(links[index], index);
      if (!attachment) {
        continue;
      }
      if (totalBytes + attachment.content.length > MAX_ATTACHMENT_TOTAL_BYTES) {
        continue;
      }
      attachments.push(attachment);
      totalBytes += attachment.content.length;
    } catch (_error) {
      // Ignore one failed fetch so email can still be delivered.
    }
  }

  return attachments;
};

const buildEmailHtml = ({ person, message, photoLinks = [], senderName, senderEmail }) => {
  const safeSenderName = String(senderName || '').trim();
  const safeSenderEmail = String(senderEmail || '').trim().toLowerCase();
  const senderLabel = safeSenderName || safeSenderEmail || 'Drishyamitra user';
  const senderDetails = safeSenderEmail
    ? `${senderLabel} (${safeSenderEmail})`
    : senderLabel;

  const safeLinks = normalizePhotoLinks(photoLinks);

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Photo Delivery for ${escapeHtml(person)}</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(message)}</p>
      <p style="margin: 0 0 12px;"><strong>Sent by:</strong> ${escapeHtml(senderDetails)}</p>
      <p style="margin: 0 0 12px;">
        ${
          safeLinks.length > 0
            ? `Attached ${safeLinks.length} image${safeLinks.length === 1 ? '' : 's'}. Use the download button in your email app to save them.`
            : 'No image attachments were available for this delivery.'
        }
      </p>
    </div>
  `;
};

const sendDeliveryEmail = async ({ to, person, subject, message, photoLinks, senderName, senderEmail }) => {
  const from = String(process.env.SMTP_FROM || '').trim();
  if (!from) {
    throw new Error('SMTP_FROM is missing. Set a sender email address in your environment.');
  }

  const safeSenderName = String(senderName || '').trim();
  const safeSenderEmail = String(senderEmail || '').trim().toLowerCase();
  const senderLabel = safeSenderName || safeSenderEmail || 'Drishyamitra user';
  const senderLine = safeSenderEmail
    ? `Sent by: ${senderLabel} (${safeSenderEmail})`
    : `Sent by: ${senderLabel}`;

  const safeLinks = normalizePhotoLinks(photoLinks);
  const attachments = await buildPhotoAttachments(safeLinks);
  const emailSubject = String(subject || '').trim() || `Photos shared for ${person}`;
  const attachmentLine =
    attachments.length > 0
      ? `Attached ${attachments.length} image${attachments.length === 1 ? '' : 's'} to this email.`
      : 'No image attachments could be added.';
  const emailText = [message, senderLine, attachmentLine].filter(Boolean).join('\n');
  const html = buildEmailHtml({ person, message, photoLinks: safeLinks, senderName, senderEmail });

  const info = await getTransporter().sendMail({
    from,
    to,
    subject: emailSubject,
    text: emailText || `Photos were shared for ${person}.`,
    html,
    attachments
  });

  return {
    messageId: info.messageId || null,
    accepted: info.accepted || [],
    rejected: info.rejected || []
  };
};

module.exports = {
  sendDeliveryEmail
};
