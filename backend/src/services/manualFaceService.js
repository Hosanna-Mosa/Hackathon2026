require('./tfjsCompat');
const axios = require('axios');
const tf = require('@tensorflow/tfjs');
const canvas = require('canvas');


const imageBufferToTensor = async (imageBuffer) => {
  const image = await canvas.loadImage(imageBuffer);
  const drawCanvas = canvas.createCanvas(image.width, image.height);
  const ctx = drawCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0, image.width, image.height);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  return tf.tidy(() => {
    const rgbaTensor = tf.tensor3d(data, [image.height, image.width, 4], 'int32');
    return rgbaTensor.slice([0, 0, 0], [image.height, image.width, 3]);
  });
};

const MIN_BOX_SIZE_PX = Number(process.env.MANUAL_FACE_MIN_BOX_SIZE || 24);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const assertAndClampBox = (rawBox, imageWidth, imageHeight) => {
  const x = toFiniteNumber(rawBox?.x, 0);
  const y = toFiniteNumber(rawBox?.y, 0);
  const width = toFiniteNumber(rawBox?.width, 0);
  const height = toFiniteNumber(rawBox?.height, 0);

  if (width <= 0 || height <= 0) {
    const error = new Error('Invalid box dimensions.');
    error.statusCode = 400;
    throw error;
  }

  const startX = clamp(Math.floor(x), 0, Math.max(0, imageWidth - 1));
  const startY = clamp(Math.floor(y), 0, Math.max(0, imageHeight - 1));
  const endX = clamp(Math.ceil(x + width), startX + 1, imageWidth);
  const endY = clamp(Math.ceil(y + height), startY + 1, imageHeight);

  const clampedWidth = Math.max(1, endX - startX);
  const clampedHeight = Math.max(1, endY - startY);

  if (clampedWidth < MIN_BOX_SIZE_PX || clampedHeight < MIN_BOX_SIZE_PX) {
    const error = new Error(`Selected box is too small. Minimum size is ${MIN_BOX_SIZE_PX}px.`);
    error.statusCode = 400;
    throw error;
  }

  return {
    x: startX,
    y: startY,
    width: clampedWidth,
    height: clampedHeight
  };
};

const toEmbedding = (faceTensor) => {
  // Same deterministic embedding pipeline used by auto detection.
  const flat = tf.tidy(() => {
    const resized = tf.image.resizeBilinear(faceTensor, [16, 16], true);
    const normalized = resized.toFloat().div(255);
    return normalized.reshape([16 * 16 * 3]);
  });

  try {
    const values = Array.from(flat.dataSync());
    let norm = 0;
    for (const value of values) {
      norm += value * value;
    }
    const denom = Math.sqrt(norm) || 1;
    return values.map((value) => Number((value / denom).toFixed(8)));
  } finally {
    flat.dispose();
  }
};

const extractManualFaceEmbedding = async (imageUrl, rawBox) => {
  if (!imageUrl) {
    const error = new Error('Photo image URL is missing.');
    error.statusCode = 400;
    throw error;
  }

  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  });

  let imageTensor;
  let cropTensor;
  try {
    imageTensor = await imageBufferToTensor(Buffer.from(response.data));
    const [imageHeight, imageWidth] = imageTensor.shape;

    const box = assertAndClampBox(rawBox, imageWidth, imageHeight);

    cropTensor = tf.slice(imageTensor, [box.y, box.x, 0], [box.height, box.width, 3]);
    const embedding = toEmbedding(cropTensor);

    return {
      embedding,
      box,
      imageMeta: {
        width: imageWidth,
        height: imageHeight
      }
    };
  } finally {
    if (cropTensor) {
      cropTensor.dispose();
    }
    if (imageTensor) {
      imageTensor.dispose();
    }
  }
};

module.exports = {
  MIN_BOX_SIZE_PX,
  extractManualFaceEmbedding
};
