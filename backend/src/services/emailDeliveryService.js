let transporter;

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

const buildEmailHtml = ({ person, message, photoLinks = [] }) => {
  const linksHtml = Array.isArray(photoLinks) && photoLinks.length > 0
    ? `<ul>${photoLinks
      .map((link) => `<li><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></li>`)
      .join('')}</ul>`
    : '<p>No photo links were attached.</p>';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Photo Delivery for ${escapeHtml(person)}</h2>
      <p style="margin: 0 0 12px;">${escapeHtml(message)}</p>
      <h3 style="margin: 0 0 8px;">Shared Links</h3>
      ${linksHtml}
    </div>
  `;
};

const sendDeliveryEmail = async ({ to, person, subject, message, photoLinks }) => {
  const from = String(process.env.SMTP_FROM || '').trim();
  if (!from) {
    throw new Error('SMTP_FROM is missing. Set a sender email address in your environment.');
  }

  const emailSubject = String(subject || '').trim() || `Photos shared for ${person}`;
  const emailText = [message, ...(Array.isArray(photoLinks) ? photoLinks : [])].filter(Boolean).join('\n');
  const html = buildEmailHtml({ person, message, photoLinks });

  const info = await getTransporter().sendMail({
    from,
    to,
    subject: emailSubject,
    text: emailText || `Photos were shared for ${person}.`,
    html
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
