const bcrypt = require('bcryptjs');
const {
  sequelize,
  Admin,
  Quiz,
  Question,
  QuestionOption,
  CorrectAnswer,
  EntryCode,
} = require('../index');
const logger = require('../../utils/logger');

const sampleQuestions = [
  {
    text: 'Which planet in our solar system is known as the "Red Planet"?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctIndex: 1, // Mars
  },
  {
    text: 'What is the chemical symbol for the element Gold?',
    options: ['Ag', 'Au', 'Fe', 'Gd'],
    correctIndex: 1, // Au
  },
  {
    text: 'Who developed the General Theory of Relativity?',
    options: ['Isaac Newton', 'Nikola Tesla', 'Albert Einstein', 'Galileo Galilei'],
    correctIndex: 2, // Albert Einstein
  },
  {
    text: 'Which data structure follows the Last In, First Out (LIFO) principle?',
    options: ['Queue', 'Stack', 'Array', 'Linked List'],
    correctIndex: 1, // Stack
  },
  {
    text: 'What is the capital city of Australia?',
    options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
    correctIndex: 2, // Canberra
  },
  {
    text: 'In computer science, what does HTTP stand for?',
    options: [
      'HyperText Transfer Protocol',
      'HyperText Transmission Package',
      'High-Speed Text Transmission Process',
      'Hyperlink Text Tool Protocol',
    ],
    correctIndex: 0, // HyperText Transfer Protocol
  },
  {
    text: 'Which element is most abundant in the Earth’s atmosphere?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'],
    correctIndex: 2, // Nitrogen
  },
  {
    text: 'What is the time complexity of binary search on a sorted array of size N?',
    options: ['O(N)', 'O(log N)', 'O(N log N)', 'O(1)'],
    correctIndex: 1, // O(log N)
  },
  {
    text: 'Which country is home to the ancient monument of Machu Picchu?',
    options: ['Chile', 'Colombia', 'Peru', 'Ecuador'],
    correctIndex: 2, // Peru
  },
  {
    text: 'What is the primary function of the mitochondria in a biological cell?',
    options: [
      'Protein synthesis',
      'Cell division',
      'ATP energy production',
      'Waste disposal',
    ],
    correctIndex: 2, // ATP energy production
  },
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected. Starting seed...');

    // 1. Create Default Admin
    const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
    const [admin, created] = await Admin.findOrCreate({
      where: { email: 'admin@quizeliminate.com' },
      defaults: {
        name: 'Super Admin',
        email: 'admin@quizeliminate.com',
        password: adminPasswordHash,
        role: 'superadmin',
      },
    });

    if (created) {
      logger.info('Default Admin created: admin@quizeliminate.com / Admin@123456');
    } else {
      logger.info('Default Admin already exists.');
    }

    // 2. Create Sample Quiz with 10 questions
    let sampleQuiz = await Quiz.findOne({ where: { unique_quiz_code: 'QUIZ-CHAMP2026' } });
    if (!sampleQuiz) {
      sampleQuiz = await Quiz.create({
        title: 'National Ultimate Knowledge Championship 2026',
        description: 'Test your knowledge across science, geography, technology, and general awareness. 10 Questions, 40-second timer per question, instant automatic elimination!',
        unique_quiz_code: 'QUIZ-CHAMP2026',
        registration_slug: 'national-championship-2026',
        total_questions: sampleQuestions.length,
        question_duration: 40,
        quiz_status: 'published',
        created_by: admin.id,
      });

      logger.info(`Sample Quiz created: ${sampleQuiz.title} (Slug: ${sampleQuiz.registration_slug})`);

      // Add Questions, Options, and Correct Answers
      for (let i = 0; i < sampleQuestions.length; i++) {
        const item = sampleQuestions[i];
        const question = await Question.create({
          quiz_id: sampleQuiz.id,
          question_text: item.text,
          question_order: i + 1,
          duration_seconds: 40,
        });

        let correctOptId = null;
        for (let j = 0; j < item.options.length; j++) {
          const opt = await QuestionOption.create({
            question_id: question.id,
            option_text: item.options[j],
            option_order: j + 1,
          });

          if (j === item.correctIndex) {
            correctOptId = opt.id;
          }
        }

        if (correctOptId) {
          await CorrectAnswer.create({
            question_id: question.id,
            correct_option_id: correctOptId,
          });
        }
      }

      // Add sample entry code
      await EntryCode.create({
        quiz_id: sampleQuiz.id,
        code: 'ENTRY-GOLD-100',
        usage_limit: 100,
        used_count: 0,
        status: 'active',
      });

      logger.info(`Added ${sampleQuestions.length} questions and entry codes to sample quiz.`);
    }

    logger.info('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seed();
}

module.exports = seed;

