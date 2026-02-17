const Photo = require('../models/Photo');
const Person = require('../models/Person');
const Face = require('../models/Face');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseDateAtBoundary = (value, boundary) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!dateOnly) {
    return null;
  }

  const [_, y, m, d] = dateOnly;
  if (boundary === 'start') {
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }
  return new Date(`${y}-${m}-${d}T23:59:59.999Z`);
};

const buildDateFilter = (dateFrom, dateTo) => {
  const from = parseDateAtBoundary(dateFrom, 'start');
  const to = parseDateAtBoundary(dateTo, 'end');

  if (!from && !to) {
    return null;
  }

  const createdAt = {};
  if (from) {
    createdAt.$gte = from;
  }
  if (to) {
    createdAt.$lte = to;
  }
  return { createdAt };
};

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

const getPhotos = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const { person, dateFrom, dateTo, event, privateOnly } = req.query;
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const eventValue = String(event || '').trim();
    const eventFilter = eventValue
      ? { event: { $regex: escapeRegex(eventValue), $options: 'i' } }
      : null;
    const privateFlag = parseBooleanFlag(privateOnly);
    const privacyFilter =
      privateFlag === true
        ? { isPrivate: true }
        : { isPrivate: { $ne: true } };

    if (person) {
      const safePerson = escapeRegex(String(person).trim());
      const personDoc = await Person.findOne({
        ownerId: userId,
        name: { $regex: `^${safePerson}$`, $options: 'i' }
      });

      if (!personDoc) {
        return res.status(200).json({ photos: [], count: 0 });
      }

      const photoIds = await Face.distinct('photoId', { ownerId: userId, personId: personDoc._id });
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(200).json({ photos: [], count: 0 });
      }

      const photoQuery = {
        ownerId: userId,
        _id: { $in: photoIds },
        ...privacyFilter
      };
      if (dateFilter?.createdAt) {
        photoQuery.createdAt = dateFilter.createdAt;
      }
      if (eventFilter?.event) {
        photoQuery.event = eventFilter.event;
      }

      const photos = await Photo.find(photoQuery).sort({ createdAt: -1 });

      return res.status(200).json({
        photos,
        count: photos.length
      });
    }

    const query = {
      ownerId: userId,
      ...(dateFilter || {}),
      ...(eventFilter || {}),
      ...privacyFilter
    };
    const photos = await Photo.find(query).sort({ createdAt: -1 });

    return res.status(200).json({ photos, count: photos.length });
  } catch (error) {
    return next(error);
  }
};

const deletePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId || '').trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const photo = await Photo.findOne({ _id: id, ownerId: userId });
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found.'
      });
    }

    // Delete associated faces
    await Face.deleteMany({ photoId: photo._id });

    // Delete the photo document
    await Photo.deleteOne({ _id: photo._id });

    return res.status(200).json({
      success: true,
      message: 'Photo deleted successfully.'
    });
  } catch (error) {
    return next(error);
  }
};

const updatePhotoPrivacy = async (req, res, next) => {
  try {
    const userId = String(req.userId || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized request.'
      });
    }

    const photoId = String(req.params?.id || '').trim();
    if (!photoId) {
      return res.status(400).json({
        success: false,
        message: 'Photo id is required.'
      });
    }

    const privateFlag = parseBooleanFlag(req.body?.isPrivate);
    if (privateFlag === null) {
      return res.status(400).json({
        success: false,
        message: 'isPrivate must be true or false.'
      });
    }

    const photo = await Photo.findOneAndUpdate(
      { _id: photoId, ownerId: userId },
      { $set: { isPrivate: privateFlag } },
      { new: true }
    );

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: privateFlag ? 'Photo moved to private gallery.' : 'Photo removed from private gallery.',
      photo
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPhotos,
  updatePhotoPrivacy,
  deletePhoto
};
