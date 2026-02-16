const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const uploadRoutes = require('./routes/uploadRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const labelRoutes = require('./routes/labelRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const manualFaceRoutes = require('./routes/manualFaceRoutes');
const faceApiTestRoutes = require('./routes/faceApiTestRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'drishyamitra-backend' });
});

app.use('/api/upload', uploadRoutes);
app.use('/api/photos', galleryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api', labelRoutes);
app.use('/api', manualFaceRoutes);
app.use('/api', faceApiTestRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
