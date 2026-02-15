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

const getPhotos = async (req, res, next) => {
  try {
    const { person, dateFrom, dateTo } = req.query;
    const dateFilter = buildDateFilter(dateFrom, dateTo);

    if (person) {
      const safePerson = escapeRegex(String(person).trim());
      const personDoc = await Person.findOne({
        name: { $regex: `^${safePerson}$`, $options: 'i' }
      });

      if (!personDoc) {
        return res.status(200).json({ photos: [], count: 0 });
      }

      const photoIds = await Face.distinct('photoId', { personId: personDoc._id });
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(200).json({ photos: [], count: 0 });
      }

      const photoQuery = {
        _id: { $in: photoIds }
      };
      if (dateFilter?.createdAt) {
        photoQuery.createdAt = dateFilter.createdAt;
      }

      const photos = await Photo.find(photoQuery).sort({ createdAt: -1 });

      return res.status(200).json({
        photos,
        count: photos.length
      });
    }

    const photos = await Photo.find(dateFilter || {}).sort({ createdAt: -1 });

    return res.status(200).json({ photos, count: photos.length });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPhotos
};
