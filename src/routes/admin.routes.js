const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  adminLoginSchema,
  createQuizSchema,
  addQuestionSchema,
} = require('../validators');

// Public admin authentication
router.post('/login', validate(adminLoginSchema), AdminController.login);

// Protected admin routes
router.use(authenticateAdmin);

router.get('/profile', AdminController.getProfile);

// Quiz management
router.post('/quizzes', validate(createQuizSchema), AdminController.createQuiz);
router.get('/quizzes', AdminController.getQuizzes);
router.get('/quizzes/:id', AdminController.getQuizById);
router.put('/quizzes/:id', AdminController.updateQuiz);
router.delete('/quizzes/:id', AdminController.deleteQuiz);

// Question management
router.post('/quizzes/:id/questions', validate(addQuestionSchema), AdminController.addQuestions);
router.put('/questions/:id', AdminController.updateQuestion);
router.delete('/questions/:id', AdminController.deleteQuestion);

// Quiz lifecycle
router.post('/quizzes/:id/publish', AdminController.publishQuiz);
router.post('/quizzes/:id/start', AdminController.startQuiz);
router.post('/quizzes/:id/stop', AdminController.stopQuiz);

// Live monitoring, participants, analytics
router.get('/quizzes/:id/participants', AdminController.getParticipants);
router.get('/quizzes/:id/stats', AdminController.getLiveStats);
router.get('/quizzes/:id/leaderboard', AdminController.getLeaderboard);
router.get('/quizzes/:id/analytics', AdminController.getAnalytics);
router.get('/quizzes/:id/export', AdminController.exportResults);

// Entry codes
router.post('/quizzes/:id/entry-codes', AdminController.generateEntryCodes);

module.exports = router;

