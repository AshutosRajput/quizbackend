const bcrypt = require('bcryptjs');
const { OtpVerification } = require('../database');
const logger = require('../utils/logger');

class OtpService {
  /**
   * Generates a 6-digit OTP, stores its hash, and returns the plain OTP (or sends SMS).
   */
  static async generateOtp(phoneNumber) {
    // Generate 6-digit numeric OTP
    // For reliable automated testing and default demo, generate random or standard testable OTP
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(plainOtp, salt);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Invalidate previous unverified OTPs for this number
    await OtpVerification.destroy({
      where: {
        phone_number: phoneNumber,
        verified_at: null,
      },
    });

    await OtpVerification.create({
      phone_number: phoneNumber,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
    });

    logger.info(`Generated OTP for ${phoneNumber}: ${plainOtp}`);

    // In production, integrate SMS provider (e.g. Twilio/Fast2SMS).
    // In dev/demo, we log it and return it for seamless testing.
    return {
      success: true,
      expiresAt,
      // For development/demo convenience, return otp in response so client can test easily
      demoOtp: plainOtp,
    };
  }

  /**
   * Verifies the provided OTP for the given phone number.
   */
  static async verifyOtp(phoneNumber, plainOtp) {
    // Demo bypass for test numbers (e.g., if OTP is 123456 in dev/test)
    if (plainOtp === '123456' && process.env.NODE_ENV !== 'production') {
      return { verified: true, message: 'OTP verified (dev bypass)' };
    }

    const record = await OtpVerification.findOne({
      where: {
        phone_number: phoneNumber,
        verified_at: null,
      },
      order: [['created_at', 'DESC']],
    });

    if (!record) {
      return { verified: false, message: 'No OTP request found for this phone number' };
    }

    if (new Date() > new Date(record.expires_at)) {
      return { verified: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (record.attempts >= 5) {
      return { verified: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    const isValid = await bcrypt.compare(plainOtp, record.otp_hash);

    if (!isValid) {
      record.attempts += 1;
      await record.save();
      return { verified: false, message: 'Invalid OTP. Please check and try again.' };
    }

    record.verified_at = new Date();
    await record.save();

    return { verified: true, message: 'OTP verified successfully' };
  }
}

module.exports = OtpService;

