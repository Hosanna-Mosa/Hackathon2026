#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../src/config/db');
const Person = require('../src/models/Person');
const Face = require('../src/models/Face');
const User = require('../src/models/User');

const CONFIRM_FLAG = '--yes';
const DRY_RUN_FLAG = '--dry-run';
const INVALID_PERSON_LABELS = ['unknown', 'unknown_person', 'unknown person'];

const hasArg = (flag) => process.argv.includes(flag);

const run = async () => {
  const shouldApply = hasArg(CONFIRM_FLAG);
  const isDryRun = hasArg(DRY_RUN_FLAG) || !shouldApply;

  await connectDB();

  const peopleToRemove = await Person.find(
    { name: { $in: INVALID_PERSON_LABELS } },
    { _id: 1, ownerId: 1, name: 1 }
  ).lean();

  if (peopleToRemove.length === 0) {
    console.log('[remove-unknown-labels] no unknown labels found');
    return;
  }

  const personIds = peopleToRemove.map((person) => person._id);
  const ownerIds = new Set(peopleToRemove.map((person) => String(person.ownerId || '')));

  const linkedFacesCount = await Face.countDocuments({ personId: { $in: personIds } });
  const linkedUsersCount = await User.countDocuments({ people: { $in: personIds } });

  console.log('[remove-unknown-labels] preview', {
    mode: isDryRun ? 'dry-run' : 'apply',
    labels: INVALID_PERSON_LABELS,
    peopleToRemove: peopleToRemove.length,
    linkedFacesCount,
    linkedUsersCount,
    ownersAffected: ownerIds.size
  });

  if (isDryRun) {
    console.log(
      '[remove-unknown-labels] dry-run only. Re-run with --yes to apply changes.\n' +
        'Example: npm run db:remove-unknown-labels -- --yes'
    );
    return;
  }

  const faceUpdate = await Face.updateMany(
    { personId: { $in: personIds } },
    { $set: { personId: null, learningConfirmed: false } }
  );

  const userUpdate = await User.updateMany(
    { people: { $in: personIds } },
    { $pull: { people: { $in: personIds } } }
  );

  const personDelete = await Person.deleteMany({ _id: { $in: personIds } });

  console.log('[remove-unknown-labels] completed', {
    facesUpdated: faceUpdate.modifiedCount || 0,
    usersUpdated: userUpdate.modifiedCount || 0,
    peopleDeleted: personDelete.deletedCount || 0
  });
};

run()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[remove-unknown-labels] failed', error?.message || error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
