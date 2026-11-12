const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const QuestionOption = sequelize.define('QuestionOption', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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
  option_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  option_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  option_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'question_options',
  timestamps: true,
});

module.exports = QuestionOption;

