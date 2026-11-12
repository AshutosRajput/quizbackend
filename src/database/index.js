const sequelize = require('../config/database');
const Admin = require('./models/Admin');
const Quiz = require('./models/Quiz');
const Question = require('./models/Question');
const QuestionOption = require('./models/QuestionOption');
const CorrectAnswer = require('./models/CorrectAnswer');
const Participant = require('./models/Participant');
const OtpVerification = require('./models/OtpVerification');
const QuizAttempt = require('./models/QuizAttempt');
const ParticipantAnswer = require('./models/ParticipantAnswer');
const EntryCode = require('./models/EntryCode');
const QuizEvent = require('./models/QuizEvent');

// Associations
Admin.hasMany(Quiz, { foreignKey: 'created_by', as: 'quizzes' });
Quiz.belongsTo(Admin, { foreignKey: 'created_by', as: 'creator' });

Quiz.hasMany(Question, { foreignKey: 'quiz_id', as: 'questions', onDelete: 'CASCADE' });
Question.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

Question.hasMany(QuestionOption, { foreignKey: 'question_id', as: 'options', onDelete: 'CASCADE' });
QuestionOption.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

Question.hasOne(CorrectAnswer, { foreignKey: 'question_id', as: 'correctAnswer', onDelete: 'CASCADE' });
CorrectAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });
CorrectAnswer.belongsTo(QuestionOption, { foreignKey: 'correct_option_id', as: 'correctOption' });

Quiz.hasMany(Participant, { foreignKey: 'quiz_id', as: 'participants', onDelete: 'CASCADE' });
Participant.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

Participant.hasOne(QuizAttempt, { foreignKey: 'participant_id', as: 'attempt', onDelete: 'CASCADE' });
QuizAttempt.belongsTo(Participant, { foreignKey: 'participant_id', as: 'participant' });

Quiz.hasMany(QuizAttempt, { foreignKey: 'quiz_id', as: 'attempts', onDelete: 'CASCADE' });
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

QuizAttempt.belongsTo(Question, { foreignKey: 'current_question_id', as: 'currentQuestion' });

Participant.hasMany(ParticipantAnswer, { foreignKey: 'participant_id', as: 'answers', onDelete: 'CASCADE' });
ParticipantAnswer.belongsTo(Participant, { foreignKey: 'participant_id', as: 'participant' });

Quiz.hasMany(ParticipantAnswer, { foreignKey: 'quiz_id', as: 'answers', onDelete: 'CASCADE' });
ParticipantAnswer.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

Question.hasMany(ParticipantAnswer, { foreignKey: 'question_id', as: 'answers', onDelete: 'CASCADE' });
ParticipantAnswer.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

ParticipantAnswer.belongsTo(QuestionOption, { foreignKey: 'selected_option_id', as: 'selectedOption' });

Quiz.hasMany(EntryCode, { foreignKey: 'quiz_id', as: 'entryCodes', onDelete: 'CASCADE' });
EntryCode.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

Quiz.hasMany(QuizEvent, { foreignKey: 'quiz_id', as: 'events', onDelete: 'CASCADE' });
QuizEvent.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });
QuizEvent.belongsTo(Participant, { foreignKey: 'participant_id', as: 'participant' });

const initDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database models synchronized.');
  } catch (error) {
    console.error('Unable to connect to database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  initDatabase,
  Admin,
  Quiz,
  Question,
  QuestionOption,
  CorrectAnswer,
  Participant,
  OtpVerification,
  QuizAttempt,
  ParticipantAnswer,
  EntryCode,
  QuizEvent,
};

