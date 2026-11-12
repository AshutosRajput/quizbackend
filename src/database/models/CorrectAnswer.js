const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const CorrectAnswer = sequelize.define('CorrectAnswer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  question_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'questions',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  correct_option_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'question_options',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'correct_answers',
  timestamps: true,
});

module.exports = CorrectAnswer;

