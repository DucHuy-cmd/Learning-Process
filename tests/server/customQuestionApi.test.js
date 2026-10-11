import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { handleRequest } from '../../src/server/app.js';
import {
  serverCustomQuestions,
  serverUsers,
  serverExams,
  serverExamSubmissions,
} from '../../src/server/auth/ServerDataStore.js';
import { STATIC_QUESTION_BANK } from '../../src/core/quiz/QuizBank.js';

describe('AI Vision Custom Question Bank API & Security RBAC Suite', () => {
  let server;
  let baseUrl;
  let savedExams;
  let savedSubmissions;

  beforeAll(async () => {
    server = http.createServer(handleRequest);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(() => {
    serverCustomQuestions.length = 0;
    savedExams = [...serverExams];
    savedSubmissions = [...serverExamSubmissions];
    for (let i = serverExams.length - 1; i >= 0; i--) {
      if (serverExams[i].id && serverExams[i].id.startsWith('exam_ai_test_')) {
        serverExams.splice(i, 1);
      }
    }
  });

  afterEach(() => {
    if (savedExams) {
      serverExams.splice(0, serverExams.length, ...savedExams);
    }
    if (savedSubmissions) {
      serverExamSubmissions.splice(0, serverExamSubmissions.length, ...savedSubmissions);
    }
  });

  it('GET /api/quiz/custom-question returns empty array initially', async () => {
    const res = await fetch(`${baseUrl}/api/quiz/custom-question`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBe(0);
  });

  it('POST /api/quiz/custom-question blocks unauthenticated or student users with 403 Forbidden', async () => {
    const invalidAuthPayloads = [
      {}, // No auth header
      { headers: { 'x-user-id': 'sv01' } }, // Student user
      { headers: { 'Authorization': 'Bearer sv_k66_01' } }, // Student user
      { headers: { 'x-user-id': 'guest' } }, // Guest
    ];

    const validBody = {
      question: 'Cho biểu thức logic p → q. Khi nào biểu thức nhận giá trị sai?',
      options: [
        { id: 'A', text: 'p=0, q=0' },
        { id: 'B', text: 'p=1, q=0' },
        { id: 'C', text: 'p=0, q=1' },
        { id: 'D', text: 'p=1, q=1' },
      ],
      correctId: 'B',
      topic: 'logic',
      difficulty: 'easy',
    };

    for (const item of invalidAuthPayloads) {
      const res = await fetch(`${baseUrl}/api/quiz/custom-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(item.headers || {}),
        },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    }
  });

  it('POST /api/quiz/custom-question blocks forged body createdBy: "user_admin" without admin headers (prevents body spoofing)', async () => {
    const spoofedBody = {
      createdBy: 'user_admin',
      userId: 'user_admin',
      question: 'Hacker question attempting privilege escalation',
      options: [
        { id: 'A', text: '1' },
        { id: 'B', text: '2' },
        { id: 'C', text: '3' },
        { id: 'D', text: '4' },
      ],
      correctId: 'A',
    };

    const res = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(spoofedBody),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('POST /api/quiz/custom-question blocks privilege escalation when student Bearer token provides spoofed x-user-id: "user_admin"', async () => {
    const maliciousHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sv_k66_01', // Student token
      'x-user-id': 'user_admin', // Spoofed admin user id
    };

    const res = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: maliciousHeaders,
      body: JSON.stringify({
        question: 'Câu hỏi nhằm leo thang đặc quyền trái phép',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' },
        ],
        correctId: 'A',
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('administrative endpoints block unauthenticated requests with 403 Forbidden', async () => {
    // 1. Reset database
    const resReset = await fetch(`${baseUrl}/api/admin/database/reset`, { method: 'POST' });
    expect(resReset.status).toBe(403);

    // 2. Clear all exams
    const resClearExams = await fetch(`${baseUrl}/api/exams/clear-all`, { method: 'POST' });
    expect(resClearExams.status).toBe(403);

    // 3. Reset leaderboard
    const resResetLb = await fetch(`${baseUrl}/api/quiz/leaderboard/reset`, { method: 'POST' });
    expect(resResetLb.status).toBe(403);
  });

  it('POST /api/quiz/custom-question rejects invalid question format (too short, wrong option count, missing correctId)', async () => {
    const adminHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': 'user_admin',
    };

    // Case 1: Question too short (< 5 chars)
    const res1 = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        question: 'p?',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' },
        ],
        correctId: 'A',
      }),
    });
    expect(res1.status).toBe(400);

    // Case 2: Less than 4 options
    const res2 = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        question: 'Cho biểu thức logic p và q.',
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
        ],
        correctId: 'A',
      }),
    });
    expect(res2.status).toBe(400);

    // Case 3: Empty option text
    const res3 = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        question: 'Cho biểu thức logic p và q.',
        options: [
          { id: 'A', text: 'Lựa chọn A' },
          { id: 'B', text: '' },
          { id: 'C', text: 'Lựa chọn C' },
          { id: 'D', text: 'Lựa chọn D' },
        ],
        correctId: 'A',
      }),
    });
    expect(res3.status).toBe(400);

    // Case 4: Invalid correctId
    const res4 = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        question: 'Cho biểu thức logic p và q.',
        options: [
          { id: 'A', text: 'A' },
          { id: 'B', text: 'B' },
          { id: 'C', text: 'C' },
          { id: 'D', text: 'D' },
        ],
        correctId: 'E',
      }),
    });
    expect(res4.status).toBe(400);

    // Case 5: Question exceeds 2000 characters limit
    const res5 = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        question: 'A'.repeat(2005),
        options: [
          { id: 'A', text: '1' },
          { id: 'B', text: '2' },
          { id: 'C', text: '3' },
          { id: 'D', text: '4' },
        ],
        correctId: 'A',
      }),
    });
    expect(res5.status).toBe(400);
  });

  it('POST /api/quiz/custom-question saves valid approved question with Admin auth', async () => {
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer user_admin',
    };

    const newQuestion = {
      id: 'custom_ai_q_01',
      question: 'Biểu thức p ∧ ¬p (luật mâu thuẫn) nhận giá trị chân trị nào?',
      options: [
        { id: 'A', text: 'Luôn đúng (1)' },
        { id: 'B', text: 'Luôn sai (0)' },
        { id: 'C', text: 'Tùy thuộc vào p' },
        { id: 'D', text: 'Không xác định' },
      ],
      correctId: 'B',
      explanation: 'Theo luật mâu thuẫn, một mệnh đề không thể vừa đúng vừa sai cùng lúc, do đó p ∧ ¬p = 0.',
      topic: 'logic',
      difficulty: 'easy',
    };

    const res = await fetch(`${baseUrl}/api/quiz/custom-question`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(newQuestion),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.question.id).toBe('custom_ai_q_01');
    expect(data.question.source).toBe('ai_vision');
    expect(data.question.status).toBe('approved');
    expect(data.question.options.length).toBe(4);

    // Verify GET retrieves it
    const getRes = await fetch(`${baseUrl}/api/quiz/custom-question`);
    const getData = await getRes.json();
    expect(getData.questions.length).toBe(1);
    expect(getData.questions[0].id).toBe('custom_ai_q_01');
  });

  it('DELETE /api/quiz/custom-question deletes question with Admin auth and rejects non-admin', async () => {
    // Seed question
    serverCustomQuestions.push({
      id: 'custom_ai_del_01',
      question: 'Câu hỏi mẫu cần xóa',
      options: [
        { id: 'A', text: '1' },
        { id: 'B', text: '2' },
        { id: 'C', text: '3' },
        { id: 'D', text: '4' },
      ],
      correctId: 'A',
      source: 'ai_vision',
    });

    // 1. Non-admin attempt -> 403 Forbidden
    const resForbidden = await fetch(`${baseUrl}/api/quiz/custom-question/custom_ai_del_01`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'sv01' },
    });
    expect(resForbidden.status).toBe(403);
    expect(serverCustomQuestions.length).toBe(1);

    // 2. Admin attempt -> 200 OK
    const resAdmin = await fetch(`${baseUrl}/api/quiz/custom-question/custom_ai_del_01`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_admin' },
    });
    expect(resAdmin.status).toBe(200);
    const delData = await resAdmin.json();
    expect(delData.success).toBe(true);
    expect(serverCustomQuestions.length).toBe(0);

    // 3. Deleting non-existent question -> 404 Not Found
    const resNotFound = await fetch(`${baseUrl}/api/quiz/custom-question/not_exist`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'user_admin' },
    });
    expect(resNotFound.status).toBe(404);
  });

  it('End-to-End Exam lifecycle: Exam created with AI Custom Question is properly accepted and graded', async () => {
    // Add custom question to server store
    const aiQ = {
      id: 'custom_exam_q_99',
      question: 'Phủ định của mệnh đề kéo theo p → q là gì?',
      options: [
        { id: 'A', text: '¬p → ¬q' },
        { id: 'B', text: 'p ∧ ¬q' },
        { id: 'C', text: '¬p ∨ q' },
        { id: 'D', text: '¬p ∧ q' },
      ],
      correctId: 'B',
      explanation: 'Ta có p → q ≡ ¬p ∨ q, do đó ¬(p → q) ≡ p ∧ ¬q.',
      topic: 'logic',
      difficulty: 'medium',
      source: 'ai_vision',
      status: 'approved',
    };
    serverCustomQuestions.push(aiQ);

    const adminHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': 'user_admin',
      'Authorization': 'Bearer user_admin',
    };

    // 1. Admin creates exam using the custom question + 1 static question
    const testExamId = `exam_ai_test_${Date.now()}`;
    const examPayload = {
      id: testExamId,
      title: 'Đề Thi Thử Nghiệm AI Vision',
      durationMinutes: 10,
      questionIds: ['logic_q01', 'custom_exam_q_99'],
      assignedTo: ['all'],
      createdBy: 'user_admin',
    };

    const examRes = await fetch(`${baseUrl}/api/exams`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(examPayload),
    });
    expect(examRes.status).toBe(201);
    const examData = await examRes.json();
    expect(examData.success).toBe(true);

    // 2. Student submits exam with correct answer for both questions
    const subRes = await fetch(`${baseUrl}/api/exam-submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: testExamId,
        userId: 'sv01',
        userInfo: { username: 'sv01', fullName: 'Sinh Viên 01' },
        answers: {
          logic_q01: 'B', // Correct in STATIC_QUESTION_BANK
          custom_exam_q_99: 'B', // Correct in custom question
        },
      }),
    });

    expect(subRes.status).toBe(201);
    const subData = await subRes.json();
    expect(subData.success).toBe(true);
    expect(subData.submission.score).toBe(10); // 2/2 correct -> 10/10
    expect(subData.submission.correctCount).toBe(2);

    // Clean up created exam with Admin credentials
    const delRes = await fetch(`${baseUrl}/api/exams/${testExamId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    expect(delRes.status).toBe(200);
  });

  it('POST /api/admin/database/reset resets serverCustomQuestions with admin credentials', async () => {
    serverCustomQuestions.push({
      id: 'q_to_reset',
      question: 'Sample',
      options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }],
      correctId: 'A',
    });
    expect(serverCustomQuestions.length).toBe(1);

    const res = await fetch(`${baseUrl}/api/admin/database/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user_admin',
        'Authorization': 'Bearer user_admin',
      },
    });
    expect(res.status).toBe(200);
    expect(serverCustomQuestions.length).toBe(0);
  });
});
