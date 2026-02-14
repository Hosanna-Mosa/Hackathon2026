const Photo = require('../models/Photo');
const Person = require('../models/Person');
const Face = require('../models/Face');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPhotos = async (req, res, next) => {
  try {
    const { person } = req.query;

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

      const photos = await Photo.find({ _id: { $in: photoIds } }).sort({ createdAt: -1 });

      return res.status(200).json({
        photos,
        count: photos.length
      });
    }

    const photos = await Photo.find().sort({ createdAt: -1 });

    return res.status(200).json({ photos, count: photos.length });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPhotos
};
