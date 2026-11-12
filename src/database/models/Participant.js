const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Participant = sequelize.define('Participant', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  quiz_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'quizzes',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  entry_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  registration_status: {
    type: DataTypes.ENUM('registered', 'verified', 'active', 'eliminated', 'completed'),
    defaultValue: 'registered',
  },
  app_install_status: {
    type: DataTypes.ENUM('pending', 'installed', 'logged_in'),
    defaultValue: 'pending',
  },
}, {
  tableName: 'participants',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['phone_number', 'quiz_id'],
      name: 'unique_participant_phone_quiz',
    },
    {
      fields: ['email', 'quiz_id'],
      name: 'idx_participant_email_quiz',
    },
  ],
});

module.exports = Participant;

