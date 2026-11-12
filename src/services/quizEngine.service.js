const {
  Quiz,
  Question,
  QuestionOption,
  CorrectAnswer,
  Participant,
  QuizAttempt,
  ParticipantAnswer,
  QuizEvent,
  sequelize,
} = require('../database');
const config = require('../config/env');
const logger = require('../utils/logger');
const {
  emitToQuiz,
  emitToAdmin,
  emitToParticipant,
  emitElimination,
  emitActiveCount,
  emitLeaderboard,
} = require('../sockets/socketEmitter');

class QuizEngineService {
  /**
   * Start a Quiz competition (Admin action)
   * Sets quiz to 'active', initializes all registered/waiting participant attempts to Question 1,
   * sets question_started_at and question_deadline_at.
   */
  static async startQuiz(quizId) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Question,
          as: 'questions',
          order: [['question_order', 'ASC']],
        },
      ],
    });

    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    if (!quiz.questions || quiz.questions.length === 0) {
      throw { statusCode: 400, message: 'Cannot start quiz without questions' };
    }

    const firstQuestion = quiz.questions.sort((a, b) => a.question_order - b.question_order)[0];
    const durationSeconds = firstQuestion.duration_seconds || quiz.question_duration || config.questionDefaultDuration;

    const now = new Date();
    const deadline = new Date(now.getTime() + durationSeconds * 1000);

    const transaction = await sequelize.transaction();
    try {
      await quiz.update(
        {
          quiz_status: 'active',
          start_time: now,
        },
        { transaction }
      );

      // Activate all waiting/registered attempts for this quiz
      await QuizAttempt.update(
        {
          status: 'active',
          current_question_id: firstQuestion.id,
          current_question_number: 1,
          started_at: now,
          question_started_at: now,
          question_deadline_at: deadline,
        },
        {
          where: {
            quiz_id: quizId,
            status: ['waiting', 'registered'],
          },
          transaction,
        }
      );

      await QuizEvent.create(
        {
          quiz_id: quizId,
          event_type: 'quiz:started',
          event_data: { startTime: now, firstQuestionId: firstQuestion.id },
        },
        { transaction }
      );

      await transaction.commit();

      // Emit Socket.IO events to all participants
      emitToQuiz(quizId, 'quiz:started', {
        quizId,
        startTime: now,
        durationSeconds,
      });

      // Update admin dashboard
      const activeCount = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'active' } });
      const eliminatedCount = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'eliminated' } });
      emitActiveCount(quizId, { active: activeCount, eliminated: eliminatedCount });

      return {
        success: true,
        message: 'Quiz started successfully',
        quiz,
        firstQuestionId: firstQuestion.id,
        durationSeconds,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Stop a Quiz competition (Admin action)
   */
  static async stopQuiz(quizId) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) throw { statusCode: 404, message: 'Quiz not found' };

    const now = new Date();
    await quiz.update({ quiz_status: 'completed', end_time: now });

    // Mark remaining active participants as completed
    await QuizAttempt.update(
      { status: 'completed', completed_at: now },
      { where: { quiz_id: quizId, status: 'active' } }
    );

    emitToQuiz(quizId, 'quiz:completed', {
      quizId,
      message: 'The quiz has concluded.',
    });

    return { success: true, message: 'Quiz stopped successfully' };
  }

  /**
   * Participant joins the active quiz session
   */
  static async joinQuiz(participantId) {
    const participant = await Participant.findByPk(participantId, {
      include: [
        { model: Quiz, as: 'quiz' },
        { model: QuizAttempt, as: 'attempt' },
      ],
    });

    if (!participant) {
      throw { statusCode: 404, message: 'Participant not found' };
    }

    const { quiz, attempt } = participant;
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    if (quiz.quiz_status === 'draft' || quiz.quiz_status === 'published') {
      return {
        status: 'waiting',
        message: 'Quiz has not started yet. Please wait for the host.',
        quizTitle: quiz.title,
      };
    }

    if (quiz.quiz_status === 'completed') {
      return {
        status: 'completed',
        message: 'Quiz has already finished.',
      };
    }

    if (attempt && attempt.status === 'eliminated') {
      return {
        status: 'eliminated',
        message: 'You have been eliminated from this quiz.',
        reason: attempt.elimination_reason,
        eliminatedAt: attempt.eliminated_at,
        questionNumber: attempt.current_question_number,
      };
    }

    return this.getCurrentQuestion(participantId);
  }

  /**
   * Get Current Question for a participant
   * SERVER TIME CHECK: If deadline has passed, automatically eliminates participant!
   * NEVER returns correct answers or answers from other questions!
   */
  static async getCurrentQuestion(participantId) {
    const attempt = await QuizAttempt.findOne({
      where: { participant_id: participantId },
      include: [
        {
          model: Quiz,
          as: 'quiz',
        },
        {
          model: Participant,
          as: 'participant',
        },
      ],
    });

    if (!attempt) {
      throw { statusCode: 404, message: 'No quiz attempt found for this participant' };
    }

    const { quiz } = attempt;

    // Check if participant is already eliminated
    if (attempt.status === 'eliminated') {
      return {
        status: 'eliminated',
        eliminated: true,
        reason: attempt.elimination_reason,
        eliminated_at: attempt.eliminated_at,
        question_number: attempt.current_question_number,
      };
    }

    // Check if participant has completed all questions
    if (attempt.status === 'completed') {
      return {
        status: 'completed',
        completed: true,
        score: attempt.score,
        completed_at: attempt.completed_at,
      };
    }

    // Check if quiz is still in waiting mode
    if (attempt.status === 'waiting' || quiz.quiz_status !== 'active') {
      return {
        status: 'waiting',
        message: 'The quiz has not started yet. Standby!',
        quizTitle: quiz.title,
      };
    }

    // Attempt is active: check server deadline
    const now = new Date();
    const deadline = new Date(attempt.question_deadline_at);
    const remainingMs = deadline.getTime() - now.getTime();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    // If remaining time has elapsed past deadline (with 1.5s tolerance for clock jitter)
    if (remainingMs < -1500) {
      // Automatic elimination by timeout!
      await this.eliminateParticipant(
        attempt,
        'Time expired (40 seconds timeout)',
        attempt.current_question_number
      );

      return {
        status: 'eliminated',
        eliminated: true,
        reason: 'Time expired (40 seconds timeout)',
        eliminated_at: attempt.eliminated_at,
        question_number: attempt.current_question_number,
      };
    }

    // Fetch question and options strictly without correct answers!
    const question = await Question.findByPk(attempt.current_question_id, {
      attributes: ['id', 'question_text', 'question_image', 'question_order', 'duration_seconds'],
      include: [
        {
          model: QuestionOption,
          as: 'options',
          attributes: ['id', 'option_text', 'option_image', 'option_order'],
        },
      ],
      order: [[{ model: QuestionOption, as: 'options' }, 'option_order', 'ASC']],
    });

    if (!question) {
      throw { statusCode: 404, message: 'Current question could not be loaded' };
    }

    const totalQuestions = quiz.total_questions || (await Question.count({ where: { quiz_id: quiz.id } }));

    return {
      status: 'active',
      eliminated: false,
      completed: false,
      question: {
        id: question.id,
        question_text: question.question_text,
        question_image: question.question_image,
        question_order: question.question_order,
        duration_seconds: question.duration_seconds || quiz.question_duration || 40,
        options: question.options,
      },
      current_question_number: attempt.current_question_number,
      total_questions: totalQuestions,
      remaining_seconds: remainingSeconds,
      server_time: now.toISOString(),
      question_started_at: attempt.question_started_at,
      question_deadline_at: attempt.question_deadline_at,
    };
  }

  /**
   * Submit an answer for the current question
   * Strictly validates server deadline, correctness, prevents duplicates, handles elimination.
   */
  static async submitAnswer(participantId, questionId, selectedOptionId, responseTimeMs = null) {
    const attempt = await QuizAttempt.findOne({
      where: { participant_id: participantId },
      include: [
        { model: Quiz, as: 'quiz' },
        { model: Participant, as: 'participant' },
      ],
    });

    if (!attempt) {
      throw { statusCode: 404, message: 'No active quiz attempt found' };
    }

    // Rule: Eliminated participants cannot submit further answers
    if (attempt.status === 'eliminated') {
      return {
        is_correct: false,
        eliminated: true,
        status: 'eliminated',
        reason: attempt.elimination_reason,
        message: 'You have been eliminated and cannot submit further answers.',
      };
    }

    // Rule: Completed participants cannot submit answers
    if (attempt.status === 'completed') {
      return {
        is_correct: false,
        eliminated: false,
        completed: true,
        status: 'completed',
        message: 'You have already completed the quiz.',
      };
    }

    // Rule: Must be active
    if (attempt.status !== 'active') {
      throw { statusCode: 400, message: 'Quiz is not currently active for you.' };
    }

    // Rule: Question must match current question (participants cannot skip or jump forward)
    if (attempt.current_question_id !== parseInt(questionId, 10)) {
      throw {
        statusCode: 400,
        message: 'Invalid question. You can only answer the current question assigned to you.',
      };
    }

    const now = new Date();
    const deadlineWithGrace = new Date(new Date(attempt.question_deadline_at).getTime() + 1500); // 1.5s grace for network latency

    // Rule: Late submissions must be rejected & eliminated
    if (now > deadlineWithGrace) {
      await this.eliminateParticipant(
        attempt,
        'Late submission (Time expired)',
        attempt.current_question_number
      );

      return {
        is_correct: false,
        eliminated: true,
        status: 'eliminated',
        reason: 'Late submission (Time expired)',
        message: 'Time expired before your answer reached the server. You have been eliminated.',
      };
    }

    // Rule: Prevent duplicate submissions for the same question
    const existingAnswer = await ParticipantAnswer.findOne({
      where: {
        participant_id: participantId,
        question_id: questionId,
      },
    });

    if (existingAnswer) {
      throw { statusCode: 400, message: 'You have already submitted an answer for this question.' };
    }

    // Verify answer correctness from database
    const correctAnswer = await CorrectAnswer.findOne({
      where: { question_id: questionId },
    });

    const isCorrect = correctAnswer && correctAnswer.correct_option_id === parseInt(selectedOptionId, 10);

    // Calculate response time
    const calcResponseTime = responseTimeMs
      ? responseTimeMs / 1000
      : (now.getTime() - new Date(attempt.question_started_at).getTime()) / 1000;

    const transaction = await sequelize.transaction();
    try {
      // Record participant answer
      await ParticipantAnswer.create(
        {
          participant_id: participantId,
          quiz_id: attempt.quiz_id,
          question_id: questionId,
          selected_option_id: selectedOptionId,
          is_correct: isCorrect,
          response_time: Math.max(0.1, Number(calcResponseTime.toFixed(2))),
          submitted_at: now,
        },
        { transaction }
      );

      if (!isCorrect) {
        // Wrong Answer = Immediate Elimination
        attempt.status = 'eliminated';
        attempt.eliminated_at = now;
        attempt.elimination_reason = 'Wrong answer submitted';
        await attempt.save({ transaction });

        await QuizEvent.create(
          {
            quiz_id: attempt.quiz_id,
            participant_id: participantId,
            event_type: 'participant:eliminated',
            event_data: {
              reason: 'Wrong answer submitted',
              questionNumber: attempt.current_question_number,
              questionId,
            },
          },
          { transaction }
        );

        await transaction.commit();

        // Emit real-time elimination
        emitElimination(attempt.quiz_id, {
          participantId,
          name: attempt.participant.name,
          phone: attempt.participant.phone_number,
          reason: 'Wrong answer submitted',
          eliminatedAt: now,
          questionNumber: attempt.current_question_number,
        });

        // Update active count on admin dashboard
        const activeCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'active' } });
        const eliminatedCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'eliminated' } });
        emitActiveCount(attempt.quiz_id, { active: activeCount, eliminated: eliminatedCount });

        return {
          is_correct: false,
          eliminated: true,
          status: 'eliminated',
          reason: 'Wrong answer submitted',
          message: 'Incorrect answer. You have been eliminated from the competition.',
          question_number: attempt.current_question_number,
        };
      }

      // Answer was correct!
      attempt.score += 1;

      // Check if there is a next question
      const nextQuestion = await Question.findOne({
        where: {
          quiz_id: attempt.quiz_id,
          question_order: attempt.current_question_number + 1,
        },
        transaction,
      });

      if (nextQuestion) {
        // Advance to next question
        const nextDuration = nextQuestion.duration_seconds || attempt.quiz.question_duration || 40;
        const nextStartedAt = new Date();
        const nextDeadline = new Date(nextStartedAt.getTime() + nextDuration * 1000);

        attempt.current_question_id = nextQuestion.id;
        attempt.current_question_number += 1;
        attempt.question_started_at = nextStartedAt;
        attempt.question_deadline_at = nextDeadline;
        await attempt.save({ transaction });

        await transaction.commit();

        emitToParticipant(participantId, 'participant:correct', {
          score: attempt.score,
          nextQuestionNumber: attempt.current_question_number,
        });

        return {
          is_correct: true,
          eliminated: false,
          completed: false,
          status: 'active',
          next_question_number: attempt.current_question_number,
          score: attempt.score,
          message: 'Correct answer! Moving to the next question.',
        };
      } else {
        // Final question answered correctly: Quiz Completed!
        attempt.status = 'completed';
        attempt.completed_at = now;
        await attempt.save({ transaction });

        await QuizEvent.create(
          {
            quiz_id: attempt.quiz_id,
            participant_id: participantId,
            event_type: 'participant:completed',
            event_data: { score: attempt.score, completedAt: now },
          },
          { transaction }
        );

        await transaction.commit();

        emitToParticipant(participantId, 'quiz:completed', {
          score: attempt.score,
          completedAt: now,
          message: 'Congratulations! You successfully completed all questions!',
        });

        const activeCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'active' } });
        const completedCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'completed' } });
        emitActiveCount(attempt.quiz_id, { active: activeCount, completed: completedCount });

        return {
          is_correct: true,
          eliminated: false,
          completed: true,
          status: 'completed',
          score: attempt.score,
          message: 'Congratulations! You answered all questions correctly and completed the quiz!',
        };
      }
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Helper: Eliminate a participant on server side
   */
  static async eliminateParticipant(attempt, reason, questionNumber) {
    const now = new Date();
    await attempt.update({
      status: 'eliminated',
      eliminated_at: now,
      elimination_reason: reason,
    });

    await QuizEvent.create({
      quiz_id: attempt.quiz_id,
      participant_id: attempt.participant_id,
      event_type: 'participant:eliminated',
      event_data: { reason, questionNumber },
    });

    const participant = attempt.participant || (await Participant.findByPk(attempt.participant_id));

    emitElimination(attempt.quiz_id, {
      participantId: attempt.participant_id,
      name: participant ? participant.name : 'Participant',
      phone: participant ? participant.phone_number : '',
      reason,
      eliminatedAt: now,
      questionNumber,
    });

    const activeCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'active' } });
    const eliminatedCount = await QuizAttempt.count({ where: { quiz_id: attempt.quiz_id, status: 'eliminated' } });
    emitActiveCount(attempt.quiz_id, { active: activeCount, eliminated: eliminatedCount });
  }

  /**
   * Get Participant Quiz Status (for app reopen, polling, or sync)
   */
  static async getParticipantStatus(participantId) {
    const attempt = await QuizAttempt.findOne({
      where: { participant_id: participantId },
      include: [
        { model: Quiz, as: 'quiz' },
        { model: Participant, as: 'participant' },
      ],
    });

    if (!attempt) {
      throw { statusCode: 404, message: 'No attempt found' };
    }

    // If active, check if deadline has already expired while the app was closed!
    if (attempt.status === 'active' && attempt.question_deadline_at) {
      const now = new Date();
      const deadlineWithGrace = new Date(new Date(attempt.question_deadline_at).getTime() + 1500);
      if (now > deadlineWithGrace) {
        await this.eliminateParticipant(
          attempt,
          'Time expired (40 seconds timeout)',
          attempt.current_question_number
        );
      }
    }

    // Refresh state
    await attempt.reload();

    return {
      status: attempt.status,
      current_question_number: attempt.current_question_number,
      score: attempt.score,
      quiz_status: attempt.quiz.quiz_status,
      eliminated: attempt.status === 'eliminated',
      elimination_reason: attempt.elimination_reason,
      eliminated_at: attempt.eliminated_at,
      completed: attempt.status === 'completed',
      completed_at: attempt.completed_at,
    };
  }

  /**
   * Get Final Result for mobile app
   */
  static async getResult(participantId) {
    const attempt = await QuizAttempt.findOne({
      where: { participant_id: participantId },
      include: [
        { model: Quiz, as: 'quiz' },
        { model: Participant, as: 'participant' },
      ],
    });

    if (!attempt) {
      throw { statusCode: 404, message: 'No attempt found' };
    }

    const totalQuestions = attempt.quiz.total_questions || (await Question.count({ where: { quiz_id: attempt.quiz_id } }));

    return {
      participant_id: attempt.participant_id,
      name: attempt.participant.name,
      quiz_id: attempt.quiz_id,
      quiz_title: attempt.quiz.title,
      status: attempt.status,
      score: attempt.score,
      total_questions: totalQuestions,
      current_question_number: attempt.current_question_number,
      eliminated: attempt.status === 'eliminated',
      elimination_reason: attempt.elimination_reason,
      eliminated_at: attempt.eliminated_at,
      completed: attempt.status === 'completed',
      completed_at: attempt.completed_at,
    };
  }
}

module.exports = QuizEngineService;

