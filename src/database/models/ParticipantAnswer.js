const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ParticipantAnswer = sequelize.define('ParticipantAnswer', {
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
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  selected_option_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'question_options',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  is_correct: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  response_time: {
    type: DataTypes.FLOAT,
    allowNull: false,
    comment: 'Response time in seconds or milliseconds',
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'participant_answers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['participant_id', 'question_id'],
      name: 'unique_participant_question_answer',
    },
    {
      fields: ['quiz_id', 'is_correct'],
      name: 'idx_quiz_answers_correctness',
    },
  ],
});

module.exports = ParticipantAnswer;

