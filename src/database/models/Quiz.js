const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  unique_quiz_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  registration_slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  total_questions: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  question_duration: {
    type: DataTypes.INTEGER,
    defaultValue: 40,
    comment: 'Duration in seconds per question',
  },
  quiz_status: {
    type: DataTypes.ENUM('draft', 'published', 'active', 'completed'),
    defaultValue: 'draft',
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
}, {
  tableName: 'quizzes',
  timestamps: true,
});

module.exports = Quiz;

