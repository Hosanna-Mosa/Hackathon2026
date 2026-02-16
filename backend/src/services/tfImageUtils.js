const canvas = require('canvas');
const { tf, hasNodeBinding } = require('./tensorflowRuntime');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const decodeImageBufferToTensor = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error('A valid image buffer is required.');
  }

  if (hasNodeBinding && tf.node && typeof tf.node.decodeImage === 'function') {
    return tf.node.decodeImage(imageBuffer, 3);
  }

  const image = await canvas.loadImage(imageBuffer);
  const drawCanvas = canvas.createCanvas(image.width, image.height);
  const ctx = drawCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0, image.width, image.height);

  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const rgbaTensor = tf.tensor3d(data, [image.height, image.width, 4], 'int32');
  const rgbTensor = rgbaTensor.slice([0, 0, 0], [image.height, image.width, 3]);
  rgbaTensor.dispose();
  return rgbTensor;
};

const tensorToJpegBuffer = (rgbTensor, quality = 0.92) => {
  if (!rgbTensor || !Array.isArray(rgbTensor.shape) || rgbTensor.shape.length !== 3) {
    throw new Error('Expected a rank-3 RGB tensor.');
  }

  const safeQuality = clamp(Number(quality) || 0.92, 0, 1);

  if (hasNodeBinding && tf.node && typeof tf.node.encodeJpeg === 'function') {
    const encoded = tf.node.encodeJpeg(rgbTensor, 'rgb', Math.round(safeQuality * 100));
    return Buffer.from(encoded);
  }

  const [height, width, channels] = rgbTensor.shape;
  if (channels !== 3) {
    throw new Error('Expected tensor with 3 channels for JPEG encoding.');
  }

  const intTensor = tf.tidy(() => rgbTensor.clipByValue(0, 255).round().cast('int32'));
  try {
    const rgbValues = intTensor.dataSync();
    const rgbaValues = new Uint8ClampedArray(width * height * 4);
    for (let rgbIndex = 0, rgbaIndex = 0; rgbIndex < rgbValues.length; rgbIndex += 3, rgbaIndex += 4) {
      rgbaValues[rgbaIndex] = rgbValues[rgbIndex];
      rgbaValues[rgbaIndex + 1] = rgbValues[rgbIndex + 1];
      rgbaValues[rgbaIndex + 2] = rgbValues[rgbIndex + 2];
      rgbaValues[rgbaIndex + 3] = 255;
    }

    const outCanvas = canvas.createCanvas(width, height);
    const ctx = outCanvas.getContext('2d');
    const imageData = new canvas.ImageData(rgbaValues, width, height);
    ctx.putImageData(imageData, 0, 0);
    return outCanvas.toBuffer('image/jpeg', { quality: safeQuality });
  } finally {
    intTensor.dispose();
  }
};

module.exports = {
  decodeImageBufferToTensor,
  tensorToJpegBuffer
};
