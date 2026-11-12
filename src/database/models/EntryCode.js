const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const EntryCode = sequelize.define('EntryCode', {
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
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  usage_limit: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  used_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'used', 'expired'),
    defaultValue: 'active',
  },
}, {
  tableName: 'entry_codes',
  timestamps: true,
  indexes: [
    {
      fields: ['quiz_id', 'code'],
      name: 'idx_entry_code_quiz',
    },
  ],
});

module.exports = EntryCode;

