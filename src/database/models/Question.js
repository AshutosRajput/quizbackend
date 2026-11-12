const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Question = sequelize.define('Question', {
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
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  question_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  question_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    defaultValue: 40,
  },
}, {
  tableName: 'questions',
  timestamps: true,
});

module.exports = Question;

