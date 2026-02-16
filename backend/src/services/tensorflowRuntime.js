require('./tfjsCompat');

let tf;
let runtime = 'tfjs-node';
let tfjsNodeError = null;

try {
  tf = require('@tensorflow/tfjs-node');
} catch (error) {
  tfjsNodeError = error;
  runtime = 'tfjs';
  tf = require('@tensorflow/tfjs');
}

const hasNodeBinding = Boolean(
  tf &&
    tf.node &&
    typeof tf.node.decodeImage === 'function' &&
    typeof tf.node.encodeJpeg === 'function'
);

if (!hasNodeBinding) {
  console.warn(
    '[tensorflow-runtime] @tensorflow/tfjs-node native binding is unavailable. Using @tensorflow/tfjs fallback; image ops may be slower.',
    tfjsNodeError ? `(${tfjsNodeError.message})` : ''
  );
}

module.exports = {
  tf,
  runtime,
  hasNodeBinding,
  tfjsNodeError
};
