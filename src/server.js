const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { initDatabase } = require('./database');
const { setupSocketIO } = require('./sockets/socketHandler');
const { startTimeoutWorker, stopTimeoutWorker } = require('./cron/timeoutWorker');

const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocketIO(server, config.corsOrigin);

// Start server
const startServer = async () => {
  try {
    // 1. Initialize MySQL database
    await initDatabase();

    // 2. Start timeout worker
    startTimeoutWorker(1000);

    // 3. Listen on all network interfaces
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Quiz Eliminate Server running on http://0.0.0.0:${config.port} (${config.nodeEnv})`);
      logger.info(`Local Wi-Fi Network Access: http://192.168.1.106:${config.port}`);
      logger.info(`Socket.IO listening for real-time events.`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  stopTimeoutWorker();
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  stopTimeoutWorker();
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };

