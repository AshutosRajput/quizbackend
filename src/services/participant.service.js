const jwt = require('jsonwebtoken');
const {
  Quiz,
  Participant,
  QuizAttempt,
  EntryCode,
  QuizEvent,
  Question,
  sequelize,
} = require('../database');
const config = require('../config/env');
const OtpService = require('./otp.service');
const logger = require('../utils/logger');
const { emitToAdmin, emitActiveCount } = require('../sockets/socketEmitter');

class ParticipantService {
  /**
   * Get public quiz info by registration slug (NEVER expose questions or correct answers!)
   */
  static async getQuizBySlug(slug) {
    const quiz = await Quiz.findOne({
      where: { registration_slug: slug },
      attributes: [
        'id',
        'title',
        'description',
        'unique_quiz_code',
        'registration_slug',
        'total_questions',
        'question_duration',
        'quiz_status',
        'start_time',
        'end_time',
      ],
    });

    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz competition not found' };
    }

    const requiresEntryCode = (await EntryCode.count({ where: { quiz_id: quiz.id, status: 'active' } })) > 0;

    return {
      ...quiz.toJSON(),
      requiresEntryCode,
    };
  }

  /**
   * Verify an entry code for a quiz
   */
  static async verifyEntryCode(quizId, code) {
    const entry = await EntryCode.findOne({
      where: {
        quiz_id: quizId,
        code,
        status: 'active',
      },
    });

    if (!entry) {
      return { valid: false, message: 'Invalid entry code' };
    }

    if (entry.used_count >= entry.usage_limit) {
      return { valid: false, message: 'This entry code has reached its usage limit' };
    }

    if (entry.expires_at && new Date() > new Date(entry.expires_at)) {
      return { valid: false, message: 'Entry code has expired' };
    }

    return { valid: true, message: 'Valid entry code', entryCode: entry };
  }

  /**
   * Register Participant
   */
  static async registerParticipant(slug, data) {
    const quiz = await Quiz.findOne({ where: { registration_slug: slug } });
    if (!quiz) {
      throw { statusCode: 404, message: 'Quiz competition not found' };
    }

    if (quiz.quiz_status === 'completed') {
      throw { statusCode: 400, message: 'Registration closed. This quiz has already completed.' };
    }

    // Check if phone already registered for this quiz
    const existing = await Participant.findOne({
      where: {
        phone_number: data.phone_number,
        quiz_id: quiz.id,
      },
    });

    if (existing) {
      throw {
        statusCode: 409,
        message: 'This mobile number is already registered for this quiz competition.',
      };
    }

    // Check entry code if required
    let usedEntryCode = null;
    const entryCodeCount = await EntryCode.count({ where: { quiz_id: quiz.id, status: 'active' } });
    if (entryCodeCount > 0) {
      if (!data.entry_code) {
        throw { statusCode: 400, message: 'Entry code is required for this competition.' };
      }
      const codeCheck = await this.verifyEntryCode(quiz.id, data.entry_code);
      if (!codeCheck.valid) {
        throw { statusCode: 400, message: codeCheck.message };
      }
      usedEntryCode = codeCheck.entryCode;
    }

    const transaction = await sequelize.transaction();
    try {
      const participant = await Participant.create(
        {
          name: data.name,
          phone_number: data.phone_number,
          email: data.email,
          quiz_id: quiz.id,
          entry_code: data.entry_code || null,
          registration_status: 'registered',
          app_install_status: 'pending',
        },
        { transaction }
      );

      // Create initial QuizAttempt record in 'waiting' status
      const attempt = await QuizAttempt.create(
        {
          participant_id: participant.id,
          quiz_id: quiz.id,
          current_question_number: 1,
          status: quiz.quiz_status === 'active' ? 'active' : 'waiting',
          score: 0,
        },
        { transaction }
      );

      if (usedEntryCode) {
        usedEntryCode.used_count += 1;
        if (usedEntryCode.used_count >= usedEntryCode.usage_limit) {
          usedEntryCode.status = 'used';
        }
        await usedEntryCode.save({ transaction });
      }

      await QuizEvent.create(
        {
          quiz_id: quiz.id,
          participant_id: participant.id,
          event_type: 'participant:registered',
          event_data: { name: participant.name, phone: participant.phone_number },
        },
        { transaction }
      );

      await transaction.commit();

      // Emit dashboard update to admin
      emitToAdmin('dashboard:participant:update', {
        quizId: quiz.id,
        participant: {
          id: participant.id,
          name: participant.name,
          phone_number: participant.phone_number,
          status: 'registered',
        },
      });

      return {
        participant: {
          id: participant.id,
          name: participant.name,
          phone_number: participant.phone_number,
          email: participant.email,
          quiz_id: quiz.id,
          quiz_title: quiz.title,
          quiz_code: quiz.unique_quiz_code,
        },
        appDownloadUrl: config.apkDownloadUrl,
        message: 'Registration successful! Please download the mobile app to participate.',
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  /**
   * Mobile Application Login (phone + OTP / entry code)
   */
  static async mobileLogin(phoneNumber, otp, quizCodeOrSlug = null) {
    // 1. Verify OTP
    const otpResult = await OtpService.verifyOtp(phoneNumber, otp);
    if (!otpResult.verified) {
      throw { statusCode: 400, message: otpResult.message };
    }

    // 2. Find participant
    let whereClause = { phone_number: phoneNumber };
    if (quizCodeOrSlug) {
      const quiz = await Quiz.findOne({
        where: sequelize.or(
          { unique_quiz_code: quizCodeOrSlug },
          { registration_slug: quizCodeOrSlug }
        ),
      });
      if (quiz) {
        whereClause.quiz_id = quiz.id;
      }
    }

    const participant = await Participant.findOne({
      where: whereClause,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'unique_quiz_code', 'quiz_status', 'question_duration', 'total_questions'],
        },
        {
          model: QuizAttempt,
          as: 'attempt',
        },
      ],
    });

    if (!participant) {
      throw {
        statusCode: 404,
        message: 'No registration found for this mobile number. Please register via the quiz link first.',
      };
    }

    // Update app install status to 'logged_in'
    await participant.update({ app_install_status: 'logged_in' });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: participant.id,
        phone_number: participant.phone_number,
        quiz_id: participant.quiz_id,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return {
      participant: {
        id: participant.id,
        name: participant.name,
        phone_number: participant.phone_number,
        email: participant.email,
        quiz_id: participant.quiz_id,
        registration_status: participant.registration_status,
      },
      quiz: participant.quiz,
      attempt: participant.attempt,
      token,
    };
  }

  /**
   * Get Participant Profile & Attempt
   */
  static async getProfile(participantId) {
    const participant = await Participant.findByPk(participantId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
        },
        {
          model: QuizAttempt,
          as: 'attempt',
        },
      ],
    });

    if (!participant) {
      throw { statusCode: 404, message: 'Participant not found' };
    }

    return participant;
  }
}

module.exports = ParticipantService;

