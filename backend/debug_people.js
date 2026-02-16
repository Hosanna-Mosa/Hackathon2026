const mongoose = require('mongoose');
const Person = require('./src/models/Person');
require('dotenv').config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const people = await Person.find({});
        console.log('--- People in DB ---');
        people.forEach(p => console.log(`"${p.name}" (ID: ${p._id})`));
        console.log('--------------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
