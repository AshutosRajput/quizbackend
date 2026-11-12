const AdminService = require('../services/admin.service');
const QuizEngineService = require('../services/quizEngine.service');
const { successResponse, errorResponse } = require('../utils/response');

class AdminController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AdminService.login(email, password);
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const profile = await AdminService.getProfile(req.admin.id);
      return successResponse(res, 'Admin profile retrieved', profile);
    } catch (err) {
      next(err);
    }
  }

  static async createQuiz(req, res, next) {
    try {
      const quiz = await AdminService.createQuiz(req.admin.id, req.body);
      return successResponse(res, 'Quiz created successfully', quiz, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getQuizzes(req, res, next) {
    try {
      const quizzes = await AdminService.getQuizzes(req.admin.id);
      return successResponse(res, 'Quizzes retrieved successfully', quizzes);
    } catch (err) {
      next(err);
    }
  }

  static async getQuizById(req, res, next) {
    try {
      const quiz = await AdminService.getQuizById(req.params.id);
      return successResponse(res, 'Quiz retrieved successfully', quiz);
    } catch (err) {
      next(err);
    }
  }

  static async updateQuiz(req, res, next) {
    try {
      const quiz = await AdminService.updateQuiz(req.params.id, req.body);
      return successResponse(res, 'Quiz updated successfully', quiz);
    } catch (err) {
      next(err);
    }
  }

  static async deleteQuiz(req, res, next) {
    try {
      const result = await AdminService.deleteQuiz(req.params.id);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async addQuestions(req, res, next) {
    try {
      const payload = req.body.questions || req.body.question || req.body;
      const questions = await AdminService.addQuestions(req.params.id, payload);
      return successResponse(res, 'Questions added successfully', questions, 201);
    } catch (err) {
      next(err);
    }
  }

  static async updateQuestion(req, res, next) {
    try {
      const result = await AdminService.updateQuestion(req.params.id, req.body);
      return successResponse(res, 'Question updated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteQuestion(req, res, next) {
    try {
      const result = await AdminService.deleteQuestion(req.params.id);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async publishQuiz(req, res, next) {
    try {
      const baseUrl = req.body.baseUrl || `${req.protocol}://${req.get('host')}`;
      const result = await AdminService.publishQuiz(req.params.id, baseUrl);
      return successResponse(res, 'Quiz published successfully with unique registration link', result);
    } catch (err) {
      next(err);
    }
  }

  static async startQuiz(req, res, next) {
    try {
      const result = await QuizEngineService.startQuiz(req.params.id);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async stopQuiz(req, res, next) {
    try {
      const result = await QuizEngineService.stopQuiz(req.params.id);
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async getParticipants(req, res, next) {
    try {
      const participants = await AdminService.getParticipants(req.params.id, req.query);
      return successResponse(res, 'Participants retrieved successfully', participants);
    } catch (err) {
      next(err);
    }
  }

  static async getLiveStats(req, res, next) {
    try {
      const stats = await AdminService.getLiveStats(req.params.id);
      return successResponse(res, 'Live stats retrieved', stats);
    } catch (err) {
      next(err);
    }
  }

  static async getLeaderboard(req, res, next) {
    try {
      const leaderboard = await AdminService.getLeaderboard(req.params.id);
      return successResponse(res, 'Leaderboard retrieved successfully', leaderboard);
    } catch (err) {
      next(err);
    }
  }

  static async getAnalytics(req, res, next) {
    try {
      const analytics = await AdminService.getAnalytics(req.params.id);
      return successResponse(res, 'Analytics retrieved successfully', analytics);
    } catch (err) {
      next(err);
    }
  }

  static async generateEntryCodes(req, res, next) {
    try {
      const { count, usage_limit, expires_at } = req.body;
      const codes = await AdminService.generateEntryCodes(req.params.id, count, usage_limit, expires_at);
      return successResponse(res, 'Entry codes generated successfully', codes, 201);
    } catch (err) {
      next(err);
    }
  }

  static async exportResults(req, res, next) {
    try {
      const csv = await AdminService.exportResults(req.params.id);
      res.header('Content-Type', 'text/csv');
      res.attachment(`quiz-${req.params.id}-results.csv`);
      return res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AdminController;

