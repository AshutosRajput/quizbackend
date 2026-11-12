const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { Admin, Participant } = require('../database');
const { errorResponse } = require('../utils/response');

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No admin token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.adminSecret);

    const admin = await Admin.findByPk(decoded.id, {
      attributes: ['id', 'name', 'email', 'role', 'created_at'],
    });

    if (!admin) {
      return errorResponse(res, 'Admin not found or token invalid.', 401);
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Admin token has expired.', 401);
    }
    return errorResponse(res, 'Invalid admin authentication token.', 401);
  }
};

const authenticateParticipant = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No participant token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const participant = await Participant.findByPk(decoded.id, {
      attributes: ['id', 'name', 'phone_number', 'email', 'quiz_id', 'registration_status', 'app_install_status'],
    });

    if (!participant) {
      return errorResponse(res, 'Participant not found or token invalid.', 401);
    }

    req.participant = participant;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Participant token has expired.', 401);
    }
    return errorResponse(res, 'Invalid participant authentication token.', 401);
  }
};

module.exports = {
  authenticateAdmin,
  authenticateParticipant,
};

