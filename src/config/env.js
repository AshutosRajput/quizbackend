const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root',
    database: process.env.DB_NAME || 'quiz_eliminate',
    socketPath: process.env.DB_SOCKET_PATH || (process.platform === 'darwin' ? '/tmp/mysql.sock' : undefined),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    adminSecret: process.env.ADMIN_JWT_SECRET || 'default_admin_jwt_secret',
    adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  questionDefaultDuration: parseInt(process.env.QUESTION_DEFAULT_DURATION, 10) || 40,
  processingWindowMinutes: parseInt(process.env.PROCESSING_WINDOW_MINUTES, 10) || 3,
  apkDownloadUrl: process.env.APK_DOWNLOAD_URL || '/downloads/quizeliminate.apk',
};
