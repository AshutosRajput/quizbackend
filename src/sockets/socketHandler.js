const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { setSocketIO } = require('./socketEmitter');

const setupSocketIO = (httpServer, allowedOrigin) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setSocketIO(io);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Admin joins admin dashboard room
    socket.on('admin:join', () => {
      socket.join('admin-room');
      logger.info(`Socket ${socket.id} joined admin-room`);
      socket.emit('admin:joined', { success: true });
    });

    // Participant joins their specific quiz room
    socket.on('quiz:join', (data) => {
      const quizId = data?.quizId;
      if (quizId) {
        socket.join(`quiz-${quizId}`);
        logger.info(`Socket ${socket.id} joined quiz-${quizId}`);
        socket.emit('quiz:joined', { quizId });
      }
    });

    // Participant joins their individual room for private notifications
    socket.on('participant:join', (data) => {
      const participantId = data?.participantId;
      if (participantId) {
        socket.join(`participant-${participantId}`);
        logger.info(`Socket ${socket.id} joined participant-${participantId}`);
        socket.emit('participant:joined', { participantId });
      }
    });

    // Admin commands via socket
    socket.on('admin:quiz:start', async (data) => {
      logger.info(`Socket admin:quiz:start received for quizId: ${data?.quizId}`);
      // Broadcast to participants
      io.to(`quiz-${data.quizId}`).emit('quiz:started', {
        quizId: data.quizId,
        startTime: new Date(),
      });
    });

    socket.on('admin:quiz:stop', async (data) => {
      logger.info(`Socket admin:quiz:stop received for quizId: ${data?.quizId}`);
      io.to(`quiz-${data.quizId}`).emit('quiz:stopped', {
        quizId: data.quizId,
        endTime: new Date(),
      });
    });

    socket.on('admin:question:broadcast', async (data) => {
      io.to(`quiz-${data.quizId}`).emit('question:new', data);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

module.exports = { setupSocketIO };

