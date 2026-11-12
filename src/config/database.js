const { Sequelize } = require('sequelize');
const config = require('./env');

const dbOptions = {
  dialect: 'mysql',
  logging: config.nodeEnv === 'development' ? false : false,
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
};

if (config.db.socketPath) {
  dbOptions.dialectOptions = {
    socketPath: config.db.socketPath,
  };
} else {
  dbOptions.host = config.db.host;
  dbOptions.port = config.db.port;
}

const sequelize = new Sequelize(
  config.db.database,
  config.db.user,
  config.db.password,
  dbOptions
);

module.exports = sequelize;
