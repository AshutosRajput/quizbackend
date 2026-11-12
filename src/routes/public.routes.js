const express = require('express');
const router = express.Router();
const PublicController = require('../controllers/public.controller');
const validate = require('../middlewares/validate.middleware');
const { otpLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  registerParticipantSchema,
  sendOtpSchema,
  verifyOtpSchema,
} = require('../validators');

// Public quiz info
router.get('/quizzes/:slug', PublicController.getQuizBySlug);
router.post('/quizzes/:slug/register', validate(registerParticipantSchema), PublicController.register);

// OTP authentication endpoints
router.post('/auth/send-otp', otpLimiter, validate(sendOtpSchema), PublicController.sendOtp);
router.post('/auth/verify-otp', validate(verifyOtpSchema), PublicController.verifyOtp);

// Entry code verification
router.post('/auth/verify-entry-code', PublicController.verifyEntryCode);

// App download info
router.get('/app-download', PublicController.getAppDownload);

module.exports = router;

