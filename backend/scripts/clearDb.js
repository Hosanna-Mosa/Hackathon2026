#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

const CONFIRM_FLAG = '--yes';

const main = async () => {
  const shouldProceed = process.argv.includes(CONFIRM_FLAG);

  if (!shouldProceed) {
    console.error(
      `Refusing to clear database. Re-run with \`${CONFIRM_FLAG}\` to confirm.\n` +
        'Example: npm run db:clear -- --yes'
    );
    process.exit(1);
  }

  try {
    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not available.');
    }

    const dbName = db.databaseName;
    await db.dropDatabase();

    console.log(`Database \"${dbName}\" cleared successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear database:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
};

main();
