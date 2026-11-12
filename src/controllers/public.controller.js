const ParticipantService = require('../services/participant.service');
const OtpService = require('../services/otp.service');
const { successResponse, errorResponse } = require('../utils/response');
const config = require('../config/env');

class PublicController {
  static async getQuizBySlug(req, res, next) {
    try {
      const quiz = await ParticipantService.getQuizBySlug(req.params.slug);
      return successResponse(res, 'Quiz details retrieved', quiz);
    } catch (err) {
      next(err);
    }
  }

  static async register(req, res, next) {
    try {
      const result = await ParticipantService.registerParticipant(req.params.slug, req.body);
      return successResponse(res, result.message, result, 201);
    } catch (err) {
      next(err);
    }
  }

  static async sendOtp(req, res, next) {
    try {
      const { phone_number } = req.body;
      const result = await OtpService.generateOtp(phone_number);
      return successResponse(res, 'OTP sent successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async verifyOtp(req, res, next) {
    try {
      const { phone_number, otp } = req.body;
      const result = await OtpService.verifyOtp(phone_number, otp);
      if (!result.verified) {
        return errorResponse(res, result.message, 400);
      }
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async verifyEntryCode(req, res, next) {
    try {
      const { quiz_id, code } = req.body;
      const result = await ParticipantService.verifyEntryCode(quiz_id, code);
      if (!result.valid) {
        return errorResponse(res, result.message, 400);
      }
      return successResponse(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  static async getAppDownload(req, res, next) {
    try {
      return successResponse(res, 'App download metadata retrieved', {
        downloadUrl: config.apkDownloadUrl,
        version: '1.0.0',
        platform: 'Android',
        instructions: [
          'Tap the download APK button',
          'Allow "Install from unknown sources" in Android settings if prompted',
          'Open the downloaded file and install the application',
          'Launch the app and log in using your registered mobile number and OTP',
        ],
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PublicController;

