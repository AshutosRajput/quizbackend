const { Op } = require('sequelize');
const { QuizAttempt, Participant, Quiz, QuizEvent } = require('../database');
const { emitElimination, emitActiveCount } = require('../sockets/socketEmitter');
const logger = require('../utils/logger');
const config = require('../config/env');

let workerIntervalId = null;

const checkTimeouts = async () => {
  try {
    const now = new Date();
    // Allow 1.5s tolerance for network latency before forceful server elimination
    const cutoff = new Date(now.getTime() - 1500);

    const expiredAttempts = await QuizAttempt.findAll({
      where: {
        status: 'active',
        question_deadline_at: {
          [Op.lt]: cutoff,
        },
      },
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'name', 'phone_number'],
        },
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title'],
        },
      ],
      limit: 100, // Batch process
    });

    if (expiredAttempts.length === 0) return;

    logger.info(`[TimeoutWorker] Found ${expiredAttempts.length} expired attempt(s) to eliminate.`);

    for (const attempt of expiredAttempts) {
      attempt.status = 'eliminated';
      attempt.eliminated_at = now;
      attempt.elimination_reason = 'Time expired (40 seconds timeout)';
      await attempt.save();

      await QuizEvent.create({
        quiz_id: attempt.quiz_id,
        participant_id: attempt.participant_id,
        event_type: 'participant:eliminated',
        event_data: {
          reason: 'Time expired (40 seconds timeout)',
          questionNumber: attempt.current_question_number,
          detectedBy: 'timeoutWorker',
        },
      });

      // Emit real-time elimination
      emitElimination(attempt.quiz_id, {
        participantId: attempt.participant_id,
        name: attempt.participant ? attempt.participant.name : 'Participant',
        phone: attempt.participant ? attempt.participant.phone_number : '',
        reason: 'Time expired (40 seconds timeout)',
        eliminatedAt: now,
        questionNumber: attempt.current_question_number,
      });

      // Update active counts
      const activeCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'active' } });
      const eliminatedCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'eliminated' } });
      emitActiveCount(attempt.quiz_id, { active: activeCount, eliminated: eliminatedCount });
    }
  } catch (error) {
    logger.error('[TimeoutWorker] Error during timeout processing:', error);
  }
};

const startTimeoutWorker = (intervalMs = 1000) => {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
  }
  logger.info(`Starting Quiz Timeout Worker (interval: ${intervalMs}ms, window: ${config.processingWindowMinutes}m)`);
  workerIntervalId = setInterval(checkTimeouts, intervalMs);
};

const stopTimeoutWorker = () => {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    logger.info('Quiz Timeout Worker stopped.');
  }
};

module.exports = {
  startTimeoutWorker,
  stopTimeoutWorker,
  checkTimeouts,
};

