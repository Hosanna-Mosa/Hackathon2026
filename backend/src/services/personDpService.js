require('./tfjsCompat');
const axios = require('axios');
const tf = require('@tensorflow/tfjs-node');
const { uploadFilesToCloud } = require('./cloudUploadService');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toNumber = (value, fallback = 0) => {
  const cast = Number(value);
  return Number.isFinite(cast) ? cast : fallback;
};

const sanitizeBox = (rawBox, imageWidth, imageHeight) => {
  const x = toNumber(rawBox?.x, 0);
  const y = toNumber(rawBox?.y, 0);
  const width = toNumber(rawBox?.width, 0);
  const height = toNumber(rawBox?.height, 0);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const startX = clamp(Math.floor(x), 0, Math.max(0, imageWidth - 1));
  const startY = clamp(Math.floor(y), 0, Math.max(0, imageHeight - 1));
  const endX = clamp(Math.ceil(x + width), startX + 1, imageWidth);
  const endY = clamp(Math.ceil(y + height), startY + 1, imageHeight);

  return {
    x: startX,
    y: startY,
    width: Math.max(1, endX - startX),
    height: Math.max(1, endY - startY)
  };
};

const cropFaceJpegFromBuffer = (imageBuffer, rawBox) => {
  let imageTensor;
  let croppedTensor;
  try {
    imageTensor = tf.node.decodeImage(imageBuffer, 3);
    const [imageHeight, imageWidth] = imageTensor.shape;
    const safeBox = sanitizeBox(rawBox, imageWidth, imageHeight);
    if (!safeBox) {
      return null;
    }

    croppedTensor = tf.slice(
      imageTensor,
      [safeBox.y, safeBox.x, 0],
      [safeBox.height, safeBox.width, 3]
    );
    const encoded = tf.node.encodeJpeg(croppedTensor, 'rgb', 92);
    return Buffer.from(encoded);
  } finally {
    if (croppedTensor) {
      croppedTensor.dispose();
    }
    if (imageTensor) {
      imageTensor.dispose();
    }
  }
};

const buildFaceFile = (buffer, fileStem) => ({
  buffer,
  originalname: `${String(fileStem || 'person').replace(/[^a-z0-9_-]/gi, '_')}-dp.jpg`,
  mimetype: 'image/jpeg',
  size: buffer.length
});

const uploadPersonDpFromImageBuffer = async ({ imageBuffer, box, fileStem, folder = 'people_labels' }) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return null;
  }

  const cropped = cropFaceJpegFromBuffer(imageBuffer, box);
  if (!Buffer.isBuffer(cropped) || cropped.length === 0) {
    return null;
  }

  const { urls } = await uploadFilesToCloud([buildFaceFile(cropped, fileStem)], folder);
  return Array.isArray(urls) && urls.length > 0 ? urls[0] : null;
};

const uploadPersonDpFromImageUrl = async ({ imageUrl, box, fileStem, folder = 'people_labels' }) => {
  if (!String(imageUrl || '').trim()) {
    return null;
  }

  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  });

  const imageBuffer = Buffer.from(response.data);
  return uploadPersonDpFromImageBuffer({ imageBuffer, box, fileStem, folder });
};

module.exports = {
  uploadPersonDpFromImageBuffer,
  uploadPersonDpFromImageUrl
};
