const util = require('util');

if (typeof util.isNullOrUndefined !== 'function') {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}

if (util.isArray !== Array.isArray) {
  util.isArray = Array.isArray;
}
