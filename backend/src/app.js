const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const labelRoutes = require('./routes/labelRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const manualFaceRoutes = require('./routes/manualFaceRoutes');
const faceApiTestRoutes = require('./routes/faceApiTestRoutes');
const { protect } = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'drishyamitra-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/upload', protect, uploadRoutes);
app.use('/api/photos', protect, galleryRoutes);
app.use('/api/chat', protect, chatRoutes);
app.use('/api/people', protect, peopleRoutes);
app.use('/api', protect, labelRoutes);
app.use('/api', protect, manualFaceRoutes);
app.use('/api', protect, faceApiTestRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
