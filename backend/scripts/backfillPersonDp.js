require('dotenv').config();

const connectDB = require('../src/config/db');
const Person = require('../src/models/Person');
const Face = require('../src/models/Face');
const Photo = require('../src/models/Photo');
const { uploadPersonDpFromImageUrl } = require('../src/services/personDpService');

const run = async () => {
  await connectDB();

  const people = await Person.find({}, { _id: 1, name: 1, imageUrl: 1 }).lean();
  let updated = 0;
  let skipped = 0;

  for (const person of people) {
    const face = await Face.findOne({ personId: person._id }).sort({ createdAt: -1 }).lean();
    if (!face) {
      skipped += 1;
      continue;
    }

    const photo = await Photo.findById(face.photoId, { imageUrl: 1 }).lean();
    if (!photo?.imageUrl) {
      skipped += 1;
      continue;
    }

    try {
      const dpUrl = await uploadPersonDpFromImageUrl({
        imageUrl: photo.imageUrl,
        box: face.box,
        fileStem: person.name,
        folder: 'people_labels'
      });
      if (!dpUrl) {
        skipped += 1;
        continue;
      }

      await Person.updateOne({ _id: person._id }, { $set: { imageUrl: dpUrl } });
      updated += 1;
      console.log('[backfill-person-dp] updated', { personId: String(person._id), name: person.name });
    } catch (error) {
      skipped += 1;
      console.warn('[backfill-person-dp] failed', {
        personId: String(person._id),
        name: person.name,
        message: error.message
      });
    }
  }

  console.log('[backfill-person-dp] completed', {
    total: people.length,
    updated,
    skipped
  });
  process.exit(0);
};

run().catch((error) => {
  console.error('[backfill-person-dp] fatal', error.message);
  process.exit(1);
});
