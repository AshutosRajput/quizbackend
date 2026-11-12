const http = require('http');
const { app, startServer } = require('../src/server');
const { initDatabase, sequelize } = require('../src/database');

let serverInstance;
let baseUrl;

const request = async (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
};

const runAllTests = async () => {
  console.log('\n========================================');
  console.log('STARTING BACKEND API INTEGRATION TESTS');
  console.log('========================================\n');

  try {
    await initDatabase();
    // Start temporary test server on port 5099
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(5099, resolve));
    baseUrl = 'http://localhost:5099';
    console.log(`Test server running at ${baseUrl}`);

    // TEST 1: Health Check
    console.log('\n[Test 1] Health Check');
    const health = await request('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint responds with 200');
    assert(health.body.status === 'ok', 'Status is ok');

    // TEST 2: Admin Login
    console.log('\n[Test 2] Admin Authentication');
    const adminLogin = await request('POST', '/api/admin/login', {
      email: 'admin@quizeliminate.com',
      password: 'Admin@123456',
    });
    assert(adminLogin.status === 200, 'Admin login succeeds with 200');
    assert(adminLogin.body.data.token, 'Admin JWT token returned');
    const adminToken = adminLogin.body.data.token;

    // TEST 3: Admin Profile
    console.log('\n[Test 3] Admin Profile');
    const profile = await request('GET', '/api/admin/profile', null, adminToken);
    assert(profile.status === 200, 'Admin profile fetched');
    assert(profile.body.data.email === 'admin@quizeliminate.com', 'Admin email matches');

    // TEST 4: Create Quiz
    console.log('\n[Test 4] Admin Quiz Management');
    const code = `TEST-${Date.now().toString().slice(-4)}`;
    const newQuiz = await request(
      'POST',
      '/api/admin/quizzes',
      {
        title: 'Integration Test Speed Quiz',
        description: 'Test competition for automated backend testing',
        unique_quiz_code: `QUIZ-${code}`,
        registration_slug: `test-quiz-${code.toLowerCase()}`,
        total_questions: 3,
        question_duration: 40,
      },
      adminToken
    );
    assert(newQuiz.status === 201, 'Quiz created with status 201');
    const testQuizId = newQuiz.body.data.id;
    const testSlug = newQuiz.body.data.registration_slug;

    // TEST 5: Add Questions
    console.log('\n[Test 5] Add Questions to Quiz');
    const questionsRes = await request(
      'POST',
      `/api/admin/quizzes/${testQuizId}/questions`,
      {
        questions: [
          {
            question_text: 'What is 5 + 7?',
            options: [
              { option_text: '10' },
              { option_text: '12', is_correct: true },
              { option_text: '14' },
              { option_text: '15' },
            ],
            duration_seconds: 40,
          },
          {
            question_text: 'What is the capital of France?',
            options: [
              { option_text: 'Berlin' },
              { option_text: 'Madrid' },
              { option_text: 'Paris', is_correct: true },
              { option_text: 'Rome' },
            ],
            duration_seconds: 40,
          },
          {
            question_text: 'Which planet is closest to the Sun?',
            options: [
              { option_text: 'Mercury', is_correct: true },
              { option_text: 'Venus' },
              { option_text: 'Earth' },
              { option_text: 'Mars' },
            ],
            duration_seconds: 40,
          },
        ],
      },
      adminToken
    );
    assert(questionsRes.status === 201, 'Questions added with status 201');

    // TEST 6: Publish Quiz
    console.log('\n[Test 6] Publish Quiz');
    const publishRes = await request(
      'POST',
      `/api/admin/quizzes/${testQuizId}/publish`,
      { baseUrl: 'http://localhost:5173' },
      adminToken
    );
    assert(publishRes.status === 200, 'Quiz published with status 200');
    assert(publishRes.body.data.registration_url.includes(testSlug), 'Generated registration URL includes slug');
    assert(publishRes.body.data.qr_code.startsWith('data:image/png;base64,'), 'QR Code DataURL generated');

    // TEST 7: Public Quiz Details (Check security: NO answers exposed)
    console.log('\n[Test 7] Public Registration API (Data Sanitization Check)');
    const publicQuiz = await request('GET', `/api/public/quizzes/${testSlug}`);
    assert(publicQuiz.status === 200, 'Public quiz details retrieved');
    assert(publicQuiz.body.data.title === 'Integration Test Speed Quiz', 'Quiz title matches');
    assert(publicQuiz.body.data.questions === undefined, 'Security verified: Questions NOT exposed on registration API');

    // TEST 8: OTP Generation and Verification
    console.log('\n[Test 8] OTP Verification Flow');
    const phoneA = '+919876543210';
    const otpRes = await request('POST', '/api/public/auth/send-otp', {
      phone_number: phoneA,
    });
    assert(otpRes.status === 200, 'OTP generated successfully');
    const demoOtp = otpRes.body.data.demoOtp;

    const verifyRes = await request('POST', '/api/public/auth/verify-otp', {
      phone_number: phoneA,
      otp: demoOtp,
    });
    assert(verifyRes.status === 200, 'OTP verified successfully');

    // TEST 9: Participant Registration
    console.log('\n[Test 9] Participant Registration');
    const regRes = await request('POST', `/api/public/quizzes/${testSlug}/register`, {
      name: 'Alice Johnson',
      phone_number: phoneA,
      email: 'alice@example.com',
    });
    assert(regRes.status === 201, 'Participant A registered');
    assert(regRes.body.data.participant.name === 'Alice Johnson', 'Participant name saved');

    // Register Participant B (for wrong answer test)
    const phoneB = '+919876543211';
    await request('POST', `/api/public/quizzes/${testSlug}/register`, {
      name: 'Bob Smith',
      phone_number: phoneB,
      email: 'bob@example.com',
    });
    console.log('  ✓ Participant B registered for elimination test');

    // TEST 10: Mobile Login
    console.log('\n[Test 10] Mobile Login');
    // Send OTP for mobile login
    const otpLoginA = await request('POST', '/api/public/auth/send-otp', { phone_number: phoneA });
    const mobileLogin = await request('POST', '/api/mobile/login', {
      phone_number: phoneA,
      otp: otpLoginA.body.data.demoOtp,
      quiz_code: `QUIZ-${code}`,
    });
    assert(mobileLogin.status === 200, 'Mobile login succeeded');
    assert(mobileLogin.body.data.token, 'Participant JWT token returned');
    const tokenA = mobileLogin.body.data.token;

    // Login Participant B
    const otpLoginB = await request('POST', '/api/public/auth/send-otp', { phone_number: phoneB });
    const mobileLoginB = await request('POST', '/api/mobile/login', {
      phone_number: phoneB,
      otp: otpLoginB.body.data.demoOtp,
      quiz_code: `QUIZ-${code}`,
    });
    const tokenB = mobileLoginB.body.data.token;

    // TEST 11: Join Before Start (Waiting state)
    console.log('\n[Test 11] Quiz Engine Waiting State');
    const waitingStatus = await request('GET', '/api/mobile/quiz/current-question', null, tokenA);
    assert(waitingStatus.body.data.status === 'waiting', 'Participant receives waiting status before admin starts quiz');

    // TEST 12: Admin Starts Quiz
    console.log('\n[Test 12] Admin Starts Quiz Competition');
    const startRes = await request('POST', `/api/admin/quizzes/${testQuizId}/start`, null, adminToken);
    assert(startRes.status === 200, 'Admin started quiz');

    // TEST 13: Participant Retrieves Question 1
    console.log('\n[Test 13] Participant Receives Active Question with Server Countdown');
    const q1 = await request('GET', '/api/mobile/quiz/current-question', null, tokenA);
    assert(q1.status === 200, 'Current question fetched');
    assert(q1.body.data.status === 'active', 'Participant is active');
    assert(q1.body.data.question.question_text === 'What is 5 + 7?', 'Question 1 text matches');
    assert(q1.body.data.question.options.length === 4, '4 options returned');
    assert(q1.body.data.remaining_seconds > 0 && q1.body.data.remaining_seconds <= 40, 'Remaining server seconds is within 40s');
    // Ensure correct answers are NOT in the question payload
    assert(q1.body.data.question.correct_option_id === undefined, 'Security verified: correct_option_id NOT returned');

    // TEST 14: Participant A Submits Correct Answer
    console.log('\n[Test 14] Participant A Correct Answer -> Advances to Question 2');
    const correctOpt = q1.body.data.question.options.find((o) => o.option_text === '12');
    const ans1Res = await request(
      'POST',
      '/api/mobile/quiz/submit-answer',
      {
        question_id: q1.body.data.question.id,
        selected_option_id: correctOpt.id,
      },
      tokenA
    );
    assert(ans1Res.status === 200, 'Answer submitted');
    assert(ans1Res.body.data.is_correct === true, 'Answer marked correct');
    assert(ans1Res.body.data.eliminated === false, 'Participant NOT eliminated');
    assert(ans1Res.body.data.next_question_number === 2, 'Advanced to question 2');

    // TEST 15: Participant B Submits WRONG Answer -> Immediate Elimination!
    console.log('\n[Test 15] Participant B Wrong Answer -> Immediate Elimination');
    const q1B = await request('GET', '/api/mobile/quiz/current-question', null, tokenB);
    const wrongOpt = q1B.body.data.question.options.find((o) => o.option_text === '10');
    const ansBRes = await request(
      'POST',
      '/api/mobile/quiz/submit-answer',
      {
        question_id: q1B.body.data.question.id,
        selected_option_id: wrongOpt.id,
      },
      tokenB
    );
    assert(ansBRes.status === 200, 'Wrong answer processed');
    assert(ansBRes.body.data.is_correct === false, 'Answer marked incorrect');
    assert(ansBRes.body.data.eliminated === true, 'Participant B IMMEDIATELY ELIMINATED');
    assert(ansBRes.body.data.reason === 'Wrong answer submitted', 'Elimination reason recorded');

    // TEST 16: Eliminated Participant Cannot Submit Further Answers or Access Quiz
    console.log('\n[Test 16] Verify Eliminated Participant Cannot Submit More Answers');
    const reopenB = await request('GET', '/api/mobile/quiz/current-question', null, tokenB);
    assert(reopenB.body.data.status === 'eliminated', 'Reopening app strictly returns eliminated status');

    const trySubmitB = await request(
      'POST',
      '/api/mobile/quiz/submit-answer',
      {
        question_id: q1.body.data.question.id,
        selected_option_id: correctOpt.id,
      },
      tokenB
    );
    assert(trySubmitB.body.data.eliminated === true, 'Blocked: Eliminated participant cannot submit answers');

    // TEST 17: Participant A completes the quiz (Question 2 and 3)
    console.log('\n[Test 17] Participant A Completes Quiz Successfully');
    const q2 = await request('GET', '/api/mobile/quiz/current-question', null, tokenA);
    const correctOpt2 = q2.body.data.question.options.find((o) => o.option_text === 'Paris');
    await request(
      'POST',
      '/api/mobile/quiz/submit-answer',
      {
        question_id: q2.body.data.question.id,
        selected_option_id: correctOpt2.id,
      },
      tokenA
    );

    const q3 = await request('GET', '/api/mobile/quiz/current-question', null, tokenA);
    const correctOpt3 = q3.body.data.question.options.find((o) => o.option_text === 'Mercury');
    const finalAns = await request(
      'POST',
      '/api/mobile/quiz/submit-answer',
      {
        question_id: q3.body.data.question.id,
        selected_option_id: correctOpt3.id,
      },
      tokenA
    );
    assert(finalAns.body.data.completed === true, 'Participant A marked completed');
    assert(finalAns.body.data.score === 3, 'Full score of 3 achieved');

    // TEST 18: Admin Dashboard Monitoring & Leaderboard
    console.log('\n[Test 18] Admin Live Dashboard & Leaderboard Verification');
    const stats = await request('GET', `/api/admin/quizzes/${testQuizId}/stats`, null, adminToken);
    assert(stats.status === 200, 'Admin live stats fetched');
    assert(stats.body.data.totalParticipants === 2, '2 total participants counted');
    assert(stats.body.data.completed === 1, '1 completed participant counted');
    assert(stats.body.data.eliminated === 1, '1 eliminated participant counted');

    const leaderboard = await request('GET', `/api/admin/quizzes/${testQuizId}/leaderboard`, null, adminToken);
    assert(leaderboard.status === 200, 'Leaderboard fetched');
    assert(leaderboard.body.data.length === 2, 'Leaderboard contains both participants');
    assert(leaderboard.body.data[0].participant.name === 'Alice Johnson', 'Alice Johnson ranked #1 (Completed)');
    assert(leaderboard.body.data[1].status === 'eliminated', 'Bob Smith ranked #2 (Eliminated)');

    // TEST 19: Export Results
    console.log('\n[Test 19] Export Results as CSV');
    const exportRes = await request('GET', `/api/admin/quizzes/${testQuizId}/export`, null, adminToken);
    assert(exportRes.status === 200, 'CSV export endpoint returned 200');
    assert(exportRes.headers['content-type'].includes('text/csv'), 'Content type is text/csv');
    assert(exportRes.body.includes('Alice Johnson'), 'CSV contains Alice Johnson');
    assert(exportRes.body.includes('Bob Smith'), 'CSV contains Bob Smith');

    console.log('\n========================================');
    console.log('ALL BACKEND INTEGRATION TESTS PASSED! 🎉');
    console.log('========================================\n');

    serverInstance.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    if (serverInstance) serverInstance.close();
    process.exit(1);
  }
};

runAllTests();

