const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { Parser } = require('json2csv');
const {
  Admin,
  Quiz,
  Question,
  QuestionOption,
  CorrectAnswer,
  Participant,
  QuizAttempt,
  ParticipantAnswer,
  EntryCode,
  QuizEvent,
  sequelize,
} = require('../database');
const config = require('../config/env');
const logger = require('../utils/logger');
const { emitToQuiz, emitToAdmin, emitActiveCount } = require('../sockets/socketEmitter');

class AdminService {
  /**
   * Admin Login
   */
  static async login(email, password) {
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid email or password' };
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      config.jwt.adminSecret,
      { expiresIn: config.jwt.adminExpiresIn }
    );

    return {
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      token,
    };
  }

  /**
   * Admin Profile
   */
  static async getProfile(adminId) {
    const admin = await Admin.findByPk(adminId, {
      attributes: ['id', 'name', 'email', 'role', 'created_at'],
    });
    if (!admin) {
      throw { statusCode: 404, message: 'Admin not found' };
    }
    return admin;
  }

  /**
   * Create Quiz
   */
  static async createQuiz(adminId, data) {
    const codeSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const uniqueQuizCode = data.unique_quiz_code || `QUIZ-${codeSuffix}`;
    const slug = data.registration_slug || `quiz-${codeSuffix.toLowerCase()}`;

    const quiz = await Quiz.create({
      title: data.title,
      description: data.description || '',
      unique_quiz_code: uniqueQuizCode,
      registration_slug: slug,
      total_questions: data.total_questions || 10,
      question_duration: data.question_duration || config.questionDefaultDuration,
      quiz_status: 'draft',
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      created_by: adminId,
    });

    return quiz;
  }

  /**
   * Get Quizzes with counts
   */
  static async getQuizzes(adminId) {
    const quizzes = await Quiz.findAll({
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Question,
          as: 'questions',
          attributes: ['id'],
        },
        {
          model: Participant,
          as: 'participants',
          attributes: ['id'],
        },
      ],
    });

    return quizzes.map((q) => {
      const plain = q.toJSON();
      return {
        ...plain,
        question_count: plain.questions ? plain.questions.length : 0,
        participant_count: plain.participants ? plain.participants.length : 0,
      };
    });
  }

  /**
   * Get Quiz by ID with full details
   */
  static async getQuizById(quizId) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: QuestionOption,
              as: 'options',
            },
            {
              model: CorrectAnswer,
              as: 'correctAnswer',
            },
          ],
        },
        {
          model: EntryCode,
          as: 'entryCodes',
        },
      ],
      order: [
        [{ model: Question, as: 'questions' }, 'question_order', 'ASC'],
        [{ model: Question, as: 'questions' }, { model: QuestionOption, as: 'options' }, 'option_order', 'ASC'],
      ],
    });

    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    return quiz;
  }

  /**
   * Update Quiz
   */
  static async updateQuiz(quizId, updateData) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    if (quiz.quiz_status === 'active') {
      throw { statusCode: 400, message: 'Cannot edit an active quiz' };
    }

    await quiz.update(updateData);
    return quiz;
  }

  /**
   * Delete Quiz
   */
  static async deleteQuiz(quizId) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }
    await quiz.destroy();
    return { success: true, message: 'Quiz deleted successfully' };
  }

  /**
   * Add / Replace Questions for a Quiz
   * Accepts single question or array of questions
   */
  static async addQuestions(quizId, questionsData) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    const items = Array.isArray(questionsData) ? questionsData : [questionsData];
    const results = [];

    // Use transaction for consistency
    const transaction = await sequelize.transaction();
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const questionOrder = item.question_order || (await Question.count({ where: { quiz_id: quizId }, transaction })) + 1;

        const question = await Question.create(
          {
            quiz_id: quizId,
            question_text: item.question_text,
            question_image: item.question_image || null,
            question_order: questionOrder,
            duration_seconds: item.duration_seconds || quiz.question_duration || 40,
          },
          { transaction }
        );

        const createdOptions = [];
        let correctOptionId = null;

        if (item.options && Array.isArray(item.options)) {
          for (let j = 0; j < item.options.length; j++) {
            const opt = item.options[j];
            const optText = typeof opt === 'string' ? opt : opt.option_text;
            const optImage = typeof opt === 'object' ? opt.option_image : null;
            const isCorrect = typeof opt === 'object' ? opt.is_correct : false;

            const createdOpt = await QuestionOption.create(
              {
                question_id: question.id,
                option_text: optText,
                option_image: optImage || null,
                option_order: j + 1,
              },
              { transaction }
            );

            createdOptions.push(createdOpt);

            if (isCorrect || item.correct_option_index === j) {
              correctOptionId = createdOpt.id;
            }
          }
        }

        // If explicit correct_option_id provided or inferred
        if (!correctOptionId && item.correct_option_id) {
          correctOptionId = item.correct_option_id;
        }

        if (correctOptionId) {
          await CorrectAnswer.create(
            {
              question_id: question.id,
              correct_option_id: correctOptionId,
            },
            { transaction }
          );
        }

        results.push(question);
      }

      // Update total_questions in Quiz
      const totalQuestions = await Question.count({ where: { quiz_id: quizId }, transaction });
      await quiz.update({ total_questions: totalQuestions }, { transaction });

      await transaction.commit();
      return results;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Update a specific question
   */
  static async updateQuestion(questionId, data) {
    const question = await Question.findByPk(questionId, {
      include: [
        { model: QuestionOption, as: 'options' },
        { model: CorrectAnswer, as: 'correctAnswer' },
      ],
    });

    if (!question) {
      throw { statusCode: 404, message: 'Question not found' };
    }

    const transaction = await sequelize.transaction();
    try {
      await question.update(
        {
          question_text: data.question_text || question.question_text,
          question_image: data.question_image !== undefined ? data.question_image : question.question_image,
          question_order: data.question_order || question.question_order,
          duration_seconds: data.duration_seconds || question.duration_seconds,
        },
        { transaction }
      );

      // If options are provided to replace
      if (data.options && Array.isArray(data.options)) {
        await QuestionOption.destroy({ where: { question_id: questionId }, transaction });
        let correctOptionId = null;

        for (let j = 0; j < data.options.length; j++) {
          const opt = data.options[j];
          const optText = typeof opt === 'string' ? opt : opt.option_text;
          const optImage = typeof opt === 'object' ? opt.option_image : null;
          const isCorrect = typeof opt === 'object' ? opt.is_correct : false;

          const createdOpt = await QuestionOption.create(
            {
              question_id: question.id,
              option_text: optText,
              option_image: optImage || null,
              option_order: j + 1,
            },
            { transaction }
          );

          if (isCorrect || data.correct_option_index === j) {
            correctOptionId = createdOpt.id;
          }
        }

        if (correctOptionId) {
          const existingCorrect = await CorrectAnswer.findOne({ where: { question_id: questionId }, transaction });
          if (existingCorrect) {
            await existingCorrect.update({ correct_option_id: correctOptionId }, { transaction });
          } else {
            await CorrectAnswer.create({ question_id: questionId, correct_option_id: correctOptionId }, { transaction });
          }
        }
      } else if (data.correct_option_id) {
        const existingCorrect = await CorrectAnswer.findOne({ where: { question_id: questionId }, transaction });
        if (existingCorrect) {
          await existingCorrect.update({ correct_option_id: data.correct_option_id }, { transaction });
        } else {
          await CorrectAnswer.create({ question_id: questionId, correct_option_id: data.correct_option_id }, { transaction });
        }
      }

      await transaction.commit();
      return this.getQuizById(question.quiz_id);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Delete a question
   */
  static async deleteQuestion(questionId) {
    const question = await Question.findByPk(questionId);
    if (!question) {
      throw { statusCode: 404, message: 'Question not found' };
    }
    const quizId = question.quiz_id;
    await question.destroy();

    const count = await Question.count({ where: { quiz_id: quizId } });
    await Quiz.update({ total_questions: count }, { where: { id: quizId } });

    return { success: true, message: 'Question deleted successfully' };
  }

  /**
   * Publish Quiz
   */
  static async publishQuiz(quizId, clientBaseUrl = '') {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Question, as: 'questions' }],
    });

    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    if (!quiz.questions || quiz.questions.length === 0) {
      throw { statusCode: 400, message: 'Cannot publish a quiz with no questions. Please add questions first.' };
    }

    await quiz.update({ quiz_status: 'published' });

    const baseUrl = clientBaseUrl || 'http://localhost:5173';
    const registrationUrl = `${baseUrl}/register/${quiz.registration_slug}`;
    const qrCodeDataUrl = await QRCode.toDataURL(registrationUrl, { width: 300 });

    return {
      quiz,
      registration_url: registrationUrl,
      qr_code: qrCodeDataUrl,
    };
  }

  /**
   * Generate Entry Codes
   */
  static async generateEntryCodes(quizId, count = 10, usageLimit = 1, expiresAt = null) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz not found' };
    }

    const createdCodes = [];
    for (let i = 0; i < count; i++) {
      const code = `${quiz.unique_quiz_code.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const entryCode = await EntryCode.create({
        quiz_id: quizId,
        code,
        usage_limit: usageLimit,
        used_count: 0,
        expires_at: expiresAt,
        status: 'active',
      });
      createdCodes.push(entryCode);
    }

    return createdCodes;
  }

  /**
   * Get Participants for a Quiz
   */
  static async getParticipants(quizId, filter = {}) {
    const where = { quiz_id: quizId };
    if (filter.status) {
      where.registration_status = filter.status;
    }

    const participants = await Participant.findAll({
      where,
      include: [
        {
          model: QuizAttempt,
          as: 'attempt',
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return participants;
  }

  /**
   * Get Live Dashboard Stats & Counts
   */
  static async getLiveStats(quizId) {
    const totalParticipants = await Participant.count({ where: { quiz_id: quizId } });
    const waiting = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'waiting' } });
    const active = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'active' } });
    const eliminated = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'eliminated' } });
    const completed = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'completed' } });

    // Recent eliminations feed (last 20)
    const recentEliminations = await QuizAttempt.findAll({
      where: { quiz_id: quizId, status: 'eliminated' },
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'name', 'phone_number'],
        },
      ],
      order: [['eliminated_at', 'DESC']],
      limit: 20,
    });

    return {
      quizId,
      totalParticipants,
      waiting,
      active,
      eliminated,
      completed,
      recentEliminations,
    };
  }

  /**
   * Get Leaderboard
   */
  static async getLeaderboard(quizId) {
    const attempts = await QuizAttempt.findAll({
      where: { quiz_id: quizId },
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'name', 'phone_number', 'email'],
        },
      ],
      order: [
        // Sort: completed first, then by score descending, then by time
        ['status', 'ASC'], // 'completed' is alphabetically first or we can sort custom
        ['score', 'DESC'],
        ['current_question_number', 'DESC'],
      ],
    });

    // Custom sort: completed > active > eliminated > waiting
    const statusWeight = { completed: 4, active: 3, eliminated: 2, waiting: 1, registered: 0 };
    const sorted = attempts.map((a) => a.toJSON()).sort((a, b) => {
      const weightDiff = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
      if (weightDiff !== 0) return weightDiff;
      if (b.score !== a.score) return b.score - a.score;
      return (b.current_question_number || 1) - (a.current_question_number || 1);
    });

    return sorted.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  }

  /**
   * Get Analytics
   */
  static async getAnalytics(quizId) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) throw { statusCode: 404, message: 'Quiz not found' };

    const questions = await Question.findAll({
      where: { quiz_id: quizId },
      order: [['question_order', 'ASC']],
    });

    const questionStats = [];
    for (const q of questions) {
      const totalAnswers = await ParticipantAnswer.count({ where: { question_id: q.id } });
      const correctAnswers = await ParticipantAnswer.count({ where: { question_id: q.id, is_correct: true } });
      const wrongAnswers = totalAnswers - correctAnswers;
      const successRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

      questionStats.push({
        questionId: q.id,
        questionOrder: q.question_order,
        questionText: q.question_text.substring(0, 50) + (q.question_text.length > 50 ? '...' : ''),
        totalAnswers,
        correctAnswers,
        wrongAnswers,
        successRate,
      });
    }

    const totalParticipants = await Participant.count({ where: { quiz_id: quizId } });
    const eliminated = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'eliminated' } });
    const completed = await QuizAttempt.count({ where: { quiz_id: quizId, status: 'completed' } });

    // Elimination reason breakdown
    const timeoutEliminations = await QuizAttempt.count({
      where: {
        quiz_id: quizId,
        status: 'eliminated',
        elimination_reason: { [sequelize.Sequelize.Op.like]: '%Time%' },
      },
    });
    const wrongAnswerEliminations = eliminated - timeoutEliminations;

    return {
      quizId,
      totalParticipants,
      eliminated,
      completed,
      questionStats,
      eliminationBreakdown: {
        timeout: timeoutEliminations,
        wrongAnswer: wrongAnswerEliminations,
      },
    };
  }

  /**
   * Export Results as CSV
   */
  static async exportResults(quizId) {
    const quiz = await Quiz.findByPk(quizId);
    if (!quiz) throw { statusCode: 404, message: 'Quiz not found' };

    const participants = await Participant.findAll({
      where: { quiz_id: quizId },
      include: [
        {
          model: QuizAttempt,
          as: 'attempt',
        },
      ],
    });

    const data = participants.map((p) => ({
      ParticipantId: p.id,
      Name: p.name,
      Phone: p.phone_number,
      Email: p.email,
      EntryCode: p.entry_code || 'N/A',
      Status: p.attempt ? p.attempt.status : p.registration_status,
      Score: p.attempt ? p.attempt.score : 0,
      CurrentQuestion: p.attempt ? p.attempt.current_question_number : 0,
      EliminatedAt: p.attempt?.eliminated_at ? new Date(p.attempt.eliminated_at).toISOString() : '',
      EliminationReason: p.attempt?.elimination_reason || '',
      CompletedAt: p.attempt?.completed_at ? new Date(p.attempt.completed_at).toISOString() : '',
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    return csv;
  }
}

module.exports = AdminService;

