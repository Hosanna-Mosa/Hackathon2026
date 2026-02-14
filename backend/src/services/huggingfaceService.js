const axios = require('axios');
const fs = require('fs/promises');

let hfWarningShown = false;
let tfWarningShown = false;
let tfModelPromise = null;
const DEFAULT_MODEL_ID = 'facebook/detr-resnet-50';
const DEFAULT_FALLBACK_MODEL_IDS = ['hustvl/yolos-tiny'];
const PERSON_ALIASES = new Set(['person', 'man', 'woman', 'boy', 'girl', 'human']);

const normalizeLabels = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => String(item?.label || item?.class || '').trim().toLowerCase())
    .filter(Boolean)
    .map((label) => label.replace(/\s+/g, '_'));
};

const parseFallbackModelIds = () => {
  const raw = process.env.HF_FALLBACK_MODEL_IDS || '';
  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_FALLBACK_MODEL_IDS;
};

const getCandidateModelIds = () => {
  const primary = (process.env.HF_MODEL_ID || '').trim() || DEFAULT_MODEL_ID;
  return Array.from(new Set([primary, DEFAULT_MODEL_ID, ...parseFallbackModelIds()]));
};

const modelEndpoints = (modelId) => [
  `https://router.huggingface.co/hf-inference/models/${modelId}`,
  `https://api-inference.huggingface.co/models/${modelId}`
];

const isModuleMissingError = (error) =>
  error?.code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(String(error?.message || ''));

const decodeImageToTensor = (tf, imageBytes, jpeg, png) => {
  const isPng = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47;
  const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;

  if (isPng) {
    const decoded = png.sync.read(imageBytes);
    const { width, height, data } = decoded;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    return tf.tensor3d(rgb, [height, width, 3], 'int32');
  }

  if (isJpeg) {
    const decoded = jpeg.decode(imageBytes, { useTArray: true });
    const { width, height, data } = decoded;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    return tf.tensor3d(rgb, [height, width, 3], 'int32');
  }

  return null;
};

const loadTensorflowModel = async () => {
  if (tfModelPromise) {
    return tfModelPromise;
  }

  tfModelPromise = (async () => {
    const tf = require('@tensorflow/tfjs');
    const cocoSsd = require('@tensorflow-models/coco-ssd');
    const jpeg = require('jpeg-js');
    const png = require('pngjs');
    const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    return { tf, model, jpeg, png };
  })();

  return tfModelPromise;
};

const detectWithTensorflow = async (imageInput) => {
  try {
    const imageBytes = Buffer.isBuffer(imageInput) ? imageInput : await fs.readFile(imageInput);
    const { tf, model, jpeg, png } = await loadTensorflowModel();
    const imageTensor = decodeImageToTensor(tf, imageBytes, jpeg, png);

    if (!imageTensor) {
      if (!tfWarningShown) {
        console.warn('TensorFlow decoder supports only JPEG/PNG input. Falling back.');
        tfWarningShown = true;
      }
      return null;
    }

    try {
      const predictions = await model.detect(imageTensor);
      const labels = normalizeLabels(predictions);

      if (labels.length > 0) {
        if (labels.some((label) => PERSON_ALIASES.has(label))) {
          return ['person'];
        }
        return [labels[0]];
      }
    } finally {
      imageTensor.dispose();
    }

    return ['unknown_person'];
  } catch (error) {
    if (isModuleMissingError(error)) {
      if (!tfWarningShown) {
        console.warn(
          'TensorFlow dependencies are not installed. Install @tensorflow/tfjs, @tensorflow-models/coco-ssd, jpeg-js, and pngjs.'
        );
        tfWarningShown = true;
      }
      return null;
    }

    if (!tfWarningShown) {
      console.warn(`TensorFlow detection failed: ${error.message}`);
      tfWarningShown = true;
    }

    return null;
  }
};

const detectWithHuggingFace = async (imageInput) => {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey) {
    return ['unknown_person'];
  }

  const imageBytes = Buffer.isBuffer(imageInput) ? imageInput : await fs.readFile(imageInput);
  const candidateModelIds = getCandidateModelIds();
  let lastError = null;

  for (const modelId of candidateModelIds) {
    const urls = modelEndpoints(modelId);

    for (const modelUrl of urls) {
      try {
        const response = await axios.post(modelUrl, imageBytes, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/octet-stream',
            Accept: 'application/json'
          },
          timeout: 15000
        });

        const labels = normalizeLabels(response.data);
        if (labels.length > 0) {
          if (labels.some((label) => PERSON_ALIASES.has(label))) {
            return ['person'];
          }

          return [labels[0]];
        }

        lastError = new Error(`Model "${modelId}" returned no labels.`);
        break;
      } catch (requestError) {
        lastError = requestError;
        const status = requestError?.response?.status;

        if (status === 404 || status === 410 || status === 503) {
          continue;
        }

        if (status === 401 || status === 403) {
          if (!hfWarningShown) {
            console.warn(
              `Hugging Face authorization failed (${status}). Check HF_API_KEY. Falling back to unknown_person labels.`
            );
            hfWarningShown = true;
          }
          return ['unknown_person'];
        }
      }
    }
  }

  if (!hfWarningShown) {
    const lastStatus = lastError?.response?.status;
    console.warn(
      `No Hugging Face model responded with labels${
        lastStatus ? ` (last status: ${lastStatus})` : ''
      }. Falling back to unknown_person labels.`
    );
    hfWarningShown = true;
  }

  return ['unknown_person'];
};

/**
 * Placeholder face detection hook.
 * In production, map this to a face embedding/recognition model and return real labels.
 */
const detectFacesFromImage = async (imageInput) => {
  const provider = (process.env.VISION_PROVIDER || 'huggingface').trim().toLowerCase();

  try {
    if (provider === 'tensorflow') {
      const tfResult = await detectWithTensorflow(imageInput);
      if (tfResult) {
        return tfResult;
      }
      return detectWithHuggingFace(imageInput);
    }

    const hfResult = await detectWithHuggingFace(imageInput);
    if (hfResult[0] !== 'unknown_person') {
      return hfResult;
    }

    const tfFallbackResult = await detectWithTensorflow(imageInput);
    return tfFallbackResult || hfResult;
  } catch (error) {
    console.error('Hugging Face hook failed:', error.message);
    return ['unknown_person'];
  }
};

module.exports = {
  detectFacesFromImage
};
