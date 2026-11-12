const ParticipantService = require('../services/participant.service');
const QuizEngineService = require('../services/quizEngine.service');
const { successResponse, errorResponse } = require('../utils/response');

class MobileController {
  static async login(req, res, next) {
    try {
      const { phone_number, otp, quiz_code } = req.body;
      const result = await ParticipantService.mobileLogin(phone_number, otp, quiz_code);
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const profile = await ParticipantService.getProfile(req.participant.id);
      return successResponse(res, 'Profile retrieved', profile);
    } catch (err) {
      next(err);
    }
  }

  static async getQuizStatus(req, res, next) {
    try {
      const status = await QuizEngineService.getParticipantStatus(req.participant.id);
      return successResponse(res, 'Quiz status retrieved', status);
    } catch (err) {
      next(err);
    }
  }

  static async joinQuiz(req, res, next) {
    try {
      const result = await QuizEngineService.joinQuiz(req.participant.id);
      return successResponse(res, 'Joined quiz', result);
    } catch (err) {
      next(err);
    }
  }

  static async getCurrentQuestion(req, res, next) {
    try {
      const questionData = await QuizEngineService.getCurrentQuestion(req.participant.id);
      return successResponse(res, 'Current question retrieved', questionData);
    } catch (err) {
      next(err);
    }
  }

  static async submitAnswer(req, res, next) {
    try {
      const { question_id, selected_option_id, response_time_ms } = req.body;
      const result = await QuizEngineService.submitAnswer(
        req.participant.id,
        question_id,
        selected_option_id,
        response_time_ms
      );
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async getResult(req, res, next) {
    try {
      const result = await QuizEngineService.getResult(req.participant.id);
      return successResponse(res, 'Quiz result retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  static async getParticipantStatus(req, res, next) {
    try {
      const status = await QuizEngineService.getParticipantStatus(req.participant.id);
      return successResponse(res, 'Participant status retrieved', status);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = MobileController;

