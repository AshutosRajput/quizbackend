const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
  credentials: true,
}));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// Static files for APK downloads
const downloadsPath = path.resolve(__dirname, '../public/downloads');
app.use('/downloads', express.static(downloadsPath));

// Direct convenient APK download endpoint
app.get(['/download-apk', '/download/apk', '/downloads/quizeliminate.apk'], (req, res) => {
  const apkPath = path.join(downloadsPath, 'quizeliminate.apk');
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.download(apkPath, 'quizeliminate.apk', (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('APK file not found on server.');
    }
  });
});

// API routes
app.use('/api', routes);

// Serve frontend static files if built
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  // If request is for an API route or file, skip
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/downloads')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
