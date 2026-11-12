const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const OtpVerification = sequelize.define('OtpVerification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  otp_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'otp_verifications',
  timestamps: true,
  indexes: [
    {
      fields: ['phone_number'],
      name: 'idx_otp_phone_number',
    },
  ],
});

module.exports = OtpVerification;

