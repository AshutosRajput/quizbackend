const express = require('express');
const router = express.Router();
const MobileController = require('../controllers/mobile.controller');
const { authenticateParticipant } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { answerLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  mobileLoginSchema,
  submitAnswerSchema,
} = require('../validators');

// Mobile login
router.post('/login', validate(mobileLoginSchema), MobileController.login);

// Protected routes (requires participant JWT)
router.use(authenticateParticipant);

router.get('/profile', MobileController.getProfile);
router.get('/quiz/status', MobileController.getQuizStatus);
router.post('/quiz/join', MobileController.joinQuiz);
router.get('/quiz/current-question', MobileController.getCurrentQuestion);
router.post('/quiz/submit-answer', answerLimiter, validate(submitAnswerSchema), MobileController.submitAnswer);
router.get('/quiz/result', MobileController.getResult);
router.get('/quiz/participant-status', MobileController.getParticipantStatus);

module.exports = router;

