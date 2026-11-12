let ioInstance = null;

const setSocketIO = (io) => {
  ioInstance = io;
};

const getSocketIO = () => ioInstance;

const emitToAdmin = (event, data) => {
  if (ioInstance) {
    ioInstance.to('admin-room').emit(event, data);
  }
};

const emitToQuiz = (quizId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`quiz-${quizId}`).emit(event, data);
  }
};

const emitToParticipant = (participantId, event, data) => {
  if (ioInstance) {
    ioInstance.to(`participant-${participantId}`).emit(event, data);
  }
};

const emitElimination = (quizId, participantData) => {
  if (ioInstance) {
    // Notify the specific participant
    ioInstance.to(`participant-${participantData.participantId}`).emit('participant:eliminated', {
      quizId,
      reason: participantData.reason,
      eliminatedAt: participantData.eliminatedAt,
      questionNumber: participantData.questionNumber,
    });

    // Notify admins
    ioInstance.to('admin-room').emit('dashboard:elimination:update', {
      quizId,
      participant: participantData,
    });
  }
};

const emitActiveCount = (quizId, counts) => {
  if (ioInstance) {
    ioInstance.to('admin-room').emit('dashboard:active-count', {
      quizId,
      ...counts,
    });
  }
};

const emitLeaderboard = (quizId, leaderboard) => {
  if (ioInstance) {
    ioInstance.to('admin-room').emit('dashboard:leaderboard:update', {
      quizId,
      leaderboard,
    });
  }
};

module.exports = {
  setSocketIO,
  getSocketIO,
  emitToAdmin,
  emitToQuiz,
  emitToParticipant,
  emitElimination,
  emitActiveCount,
  emitLeaderboard,
};

