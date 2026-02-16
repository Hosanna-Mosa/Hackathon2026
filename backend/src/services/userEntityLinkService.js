const mongoose = require('mongoose');

const User = require('../models/User');

const normalizeIdList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const candidate of value) {
    const cast = String(candidate || '').trim();
    if (!cast || !mongoose.isValidObjectId(cast)) {
      continue;
    }
    unique.add(cast);
  }

  return Array.from(unique);
};

const linkEntitiesToUser = async ({
  userId,
  photoIds = [],
  faceIds = [],
  personIds = [],
  deliveryIds = []
}) => {
  const safePhotoIds = normalizeIdList(photoIds);
  const safeFaceIds = normalizeIdList(faceIds);
  const safePersonIds = normalizeIdList(personIds);
  const safeDeliveryIds = normalizeIdList(deliveryIds);

  const addToSet = {};
  if (safePhotoIds.length > 0) {
    addToSet.photos = { $each: safePhotoIds };
  }
  if (safeFaceIds.length > 0) {
    addToSet.faces = { $each: safeFaceIds };
  }
  if (safePersonIds.length > 0) {
    addToSet.people = { $each: safePersonIds };
  }
  if (safeDeliveryIds.length > 0) {
    addToSet.deliveries = { $each: safeDeliveryIds };
  }

  if (Object.keys(addToSet).length === 0) {
    return;
  }

  await User.findByIdAndUpdate(userId, { $addToSet: addToSet });
};

module.exports = {
  linkEntitiesToUser
};
