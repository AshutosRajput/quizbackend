const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuizAttempt = sequelize.define('QuizAttempt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  participant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'participants',
      key: 'id',
    },
    onDelete: 'CASCADE',
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
  current_question_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'questions',
      key: 'id',
    },
  },
  current_question_number: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM('registered', 'waiting', 'active', 'eliminated', 'completed'),
    defaultValue: 'waiting',
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  eliminated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  elimination_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  question_started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  question_deadline_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'quiz_attempts',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['participant_id', 'quiz_id'],
      name: 'unique_participant_quiz_attempt',
    },
    {
      fields: ['quiz_id', 'status'],
      name: 'idx_quiz_status',
    },
    {
      fields: ['question_deadline_at'],
      name: 'idx_question_deadline',
    },
  ],
});

module.exports = QuizAttempt;

