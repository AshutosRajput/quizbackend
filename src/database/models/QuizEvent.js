const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuizEvent = sequelize.define('QuizEvent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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
  participant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'participants',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  event_data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'quiz_events',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      fields: ['quiz_id', 'event_type'],
      name: 'idx_quiz_event_type',
    },
  ],
});

module.exports = QuizEvent;

