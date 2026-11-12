const { z } = require('zod');

const adminLoginSchema = {
  body: z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
};

const createQuizSchema = {
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().optional(),
    unique_quiz_code: z.string().optional(),
    registration_slug: z.string().optional(),
    total_questions: z.number().int().positive().optional().default(10),
    question_duration: z.number().int().positive().optional().default(40),
    start_time: z.string().datetime().optional().nullable(),
    end_time: z.string().datetime().optional().nullable(),
  }),
};

const singleQuestionItemSchema = z.object({
  question_text: z.string().min(1, 'Question text is required'),
  question_image: z.string().url().optional().nullable(),
  question_order: z.number().int().positive().optional(),
  duration_seconds: z.number().int().positive().optional().default(40),
  options: z.array(
    z.object({
      option_text: z.string().min(1, 'Option text is required'),
      option_image: z.string().url().optional().nullable(),
      is_correct: z.boolean().optional(),
    })
  ).min(2, 'At least 2 options are required (4 recommended)'),
  correct_option_index: z.number().int().min(0).optional(),
  correct_option_id: z.number().int().positive().optional(),
});

const addQuestionSchema = {
  body: z.union([
    singleQuestionItemSchema,
    z.object({
      questions: z.union([
        z.array(singleQuestionItemSchema).min(1),
        singleQuestionItemSchema,
      ]),
    }),
    z.object({
      question: singleQuestionItemSchema,
    }),
  ]),
};

const phoneSchema = z.string()
  .transform((val) => val.replace(/[\s\-\(\)]/g, ''))
  .pipe(z.string().regex(/^[0-9+]{8,15}$/, 'Invalid phone number format'));

const registerParticipantSchema = {
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone_number: phoneSchema,
    email: z.string().email('Please enter a valid email'),
    entry_code: z.string().optional().nullable(),
  }),
};

const sendOtpSchema = {
  body: z.object({
    phone_number: phoneSchema,
  }),
};

const verifyOtpSchema = {
  body: z.object({
    phone_number: phoneSchema,
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
  }),
};

const mobileLoginSchema = {
  body: z.object({
    phone_number: phoneSchema,
    otp: z.string().min(4, 'OTP must be at least 4 digits'),
    quiz_code: z.string().optional(),
  }),
};

const submitAnswerSchema = {
  body: z.object({
    question_id: z.number().int().positive('Question ID is required'),
    selected_option_id: z.number().int().positive('Option ID is required'),
    response_time_ms: z.number().optional(),
  }),
};

module.exports = {
  adminLoginSchema,
  createQuizSchema,
  addQuestionSchema,
  registerParticipantSchema,
  sendOtpSchema,
  verifyOtpSchema,
  mobileLoginSchema,
  submitAnswerSchema,
};

