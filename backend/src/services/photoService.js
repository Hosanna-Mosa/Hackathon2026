const mongoose = require('mongoose');
const Photo = require('../models/Photo');
const Person = require('../models/Person');
const Face = require('../models/Face');
const Delivery = require('../models/Delivery');
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolves a date string into a MongoDB date range query.
 * Handles: "today", "yesterday", "last week", "last month", "last year", "2024", "YYYY-MM-DD"
 */
const parseDateRange = (dateStr) => {
    if (!dateStr) return null;

    const now = new Date();
    const lower = dateStr.toLowerCase();

    let start = new Date();
    let end = new Date();

    if (lower === 'today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (lower === 'yesterday') {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
    } else if (lower === 'last week') { // last 7 days
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    } else if (lower === 'last month') { // last 30 days
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
    } else if (lower === 'last year') { // last 365 days or previous calendar year? Assuming previous calendar year for simplicity
        const currentYear = now.getFullYear();
        start = new Date(`${currentYear - 1}-01-01`);
        end = new Date(`${currentYear - 1}-12-31T23:59:59.999Z`);
    } else if (/^\d{4}$/.test(dateStr)) { // "2024"
        start = new Date(`${dateStr}-01-01`);
        end = new Date(`${dateStr}-12-31T23:59:59.999Z`);
    } else {
        // try parsing as date string
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            start = new Date(d);
            start.setHours(0, 0, 0, 0);
            end = new Date(d);
            end.setHours(23, 59, 59, 999);
        } else {
            return null;
        }
    }

    return { $gte: start, $lte: end };
};

/**
 * Builds a MongoDB query object based on structured parameters.
 */
const buildPhotoQuery = async (params) => {
    const query = {};
    const { userId, person, event, location, date_range, tags } = params;

    if (userId) {
        query.ownerId = userId;
    }

    // 1. Person Filter (Complex because it involves Face join)
    let photoIdsFromFaces = null;

    if (person) {
        // Try to find the person
        const safePerson = escapeRegex(person.trim());
        const personFilters = { name: { $regex: new RegExp(`^${safePerson}$`, 'i') } };
        if (userId) {
            personFilters.ownerId = userId;
        }
        const personDoc = await Person.findOne(personFilters) || await Person.findOne({
            ...(userId ? { ownerId: userId } : {}),
            name: { $regex: new RegExp(safePerson, 'i') }
        });

        if (personDoc) {
            const faceQuery = { personId: personDoc._id };
            if (userId) {
                faceQuery.ownerId = userId;
            }
            const faces = await Face.find(faceQuery).select('photoId');
            photoIdsFromFaces = faces.map(f => f.photoId);
        } else {
            // If specific person requested but not found, ensure no results (or handle gracefully)
            // For now, return a query that finds nothing
            return {
                ...(userId ? { ownerId: userId } : {}),
                _id: { $in: [] }
            };
        }
    }

    // 2. Date Filter
    if (date_range) {
        const range = parseDateRange(date_range);
        if (range) {
            // Check both 'date' (metadata) and 'createdAt' (upload time) to be safe
            query.$or = [
                { date: range },
                { createdAt: range }
            ];
        }
    }

    // 3. Event / Location / Tags (Simple string matches)
    if (event) {
        query.event = { $regex: new RegExp(event, 'i') };
    }
    if (location) {
        query.location = { $regex: new RegExp(location, 'i') };
    }
    // Tags could be passed as array or string (from LLM)
    if (tags && Array.isArray(tags) && tags.length > 0) {
        query.tags = { $in: tags.map(t => new RegExp(t, 'i')) };
    }

    // Combine Photo IDs from Person lookup
    if (photoIdsFromFaces !== null) {
        query._id = { $in: photoIdsFromFaces };
    }

    return query;
};

const searchPhotos = async (params) => {
    const query = await buildPhotoQuery(params);
    const parsedLimit = Number(params.count);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 50)
        : 20;

    const photos = await Photo.find(query)
        .sort({ date: -1, createdAt: -1 })
        .limit(limit)
        .lean();

    return photos;
};

const countPhotos = async (params) => {
    const query = await buildPhotoQuery(params);
    const count = await Photo.countDocuments(query);
    return count;
};

const getStats = async (metric, userId) => {
    if (metric === 'most_photos' || metric === 'least_photos') {
        const sort = metric === 'most_photos' ? -1 : 1;
        const ownerObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : null;
        const matchStage = ownerObjectId ? [{ $match: { ownerId: ownerObjectId } }] : [];
        const stats = await Face.aggregate([
            ...matchStage,
            {
                $group: {
                    _id: '$personId',
                    photoIds: { $addToSet: '$photoId' }
                }
            },
            {
                $project: {
                    _id: 1,
                    count: { $size: '$photoIds' }
                }
            },
            {
                $match: {
                    _id: { $ne: null }
                }
            },
            { $sort: { count: sort } },
            { $limit: 1 }
        ]);

        console.log('DEBUG STATS:', JSON.stringify(stats));

        if (stats.length > 0) {
            const person = await Person.findOne({
                _id: stats[0]._id,
                ...(ownerObjectId ? { ownerId: ownerObjectId } : {})
            });
            return {
                person: person ? person.name : 'Unknown',
                count: stats[0].count,
                metric
            };
        }
    }
    return null;
};

const sendPhotos = async (params) => {
    // Simulation of sending
    // In a real app, this would use a messaging service
    const { person, platform, userId } = params;
    const recipient = person || "requested contact";
    const channel = String(platform || "email").trim().toLowerCase() === 'whatsapp' ? 'whatsapp' : 'email';

    // Log the action
    await Delivery.create({
        ownerId: userId,
        person: recipient,
        type: channel,
        status: 'sent',
        timestamp: new Date()
    });

    return {
        success: true,
        message: `Successfully sent photos to ${recipient} via ${channel}`
    };
};

module.exports = {
    searchPhotos,
    countPhotos,
    getStats,
    sendPhotos
};
