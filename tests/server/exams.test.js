import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest } from '../../src/server/app.js';
import { serverExams, serverExamSubmissions, serverUsers } from '../../src/server/auth/ServerDataStore.js';

function createMockHttp({ method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json', ...headers };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    end(chunk) {
      if (chunk) this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
    },
    getJson() {
      return JSON.parse(this.body);
    },
  };

  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    req.emit('end');
  });

  return { req, res };
}

async function sendRequest(options) {
  const { req, res } = createMockHttp(options);
  await handleRequest(req, res);
  return { statusCode: res.statusCode, data: res.getJson() };
}

describe('Assigned exam API', () => {
  let savedExams;
  let savedSubmissions;

  beforeEach(() => {
    savedExams = [...serverExams];
    savedSubmissions = [...serverExamSubmissions];
  });

  afterEach(() => {
    serverExams.splice(0, serverExams.length, ...savedExams);
    serverExamSubmissions.splice(0, serverExamSubmissions.length, ...savedSubmissions);
  });

  it('creates an exam with a stable ID and shuffle settings', async () => {
    const exam = {
      id: `exam_api_${Date.now()}`,
      title: 'Đề kiểm tra API',
      durationMinutes: 30,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
      shuffleQuestions: true,
      shuffleOptions: true,
    };

    const result = await sendRequest({
      method: 'POST',
      url: '/api/exams',
      body: exam,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.exam.id).toBe(exam.id);
    expect(result.data.exam.shuffleOptions).toBe(true);
  });

  it('rejects a submission for an exam not assigned to that student', async () => {
    const examId = `exam_private_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề riêng',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['user_assigned'],
    });

    const result = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { examId, userId: 'user_other', answers: { logic_q01: 'B' } },
    });

    expect(result.statusCode).toBe(403);
    expect(result.data.error).toContain('không được giao');
  });

  it('grades submissions on the server and enforces one attempt per student', async () => {
    const examId = `exam_submit_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề tính điểm',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    const payload = {
      examId,
      userId: 'user_api_student',
      userInfo: { username: 'api_student', fullName: 'Sinh viên API' },
      answers: { logic_q01: 'B' },
      optionOrder: { logic_q01: ['D', 'C', 'B', 'A'] },
      timeSpentSeconds: 75,
    };

    const first = await sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload });
    const second = await sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload });

    expect(first.statusCode).toBe(201);
    expect(first.data.submission.score).toBe(10);
    expect(first.data.submission.fullName).toBe('Sinh viên API');
    expect(first.data.submission.optionOrder.logic_q01).toEqual(['D', 'C', 'B', 'A']);
    expect(second.statusCode).toBe(409);

    const otherExamId = `${examId}_other`;
    serverExams.unshift({
      id: otherExamId,
      title: 'Đề khác',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    const otherExamSubmission = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { ...payload, examId: otherExamId },
    });
    expect(otherExamSubmission.statusCode).toBe(201);
  });

  it('forces score to 0 when submission has integrityBan=true', async () => {
    const examId = `exam_integrity_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề kiểm tra vi phạm',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    const payload = {
      examId,
      userId: 'user_cheater',
      userInfo: { username: 'cheater', fullName: 'Sinh viên vi phạm' },
      answers: { logic_q01: 'B' },
      integrityBan: true,
    };
    const res = await sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload });
    expect(res.statusCode).toBe(201);
    expect(res.data.submission.score).toBe(0);
    expect(res.data.submission.integrityBan).toBe(true);
  });

  it('clears all exams and submissions on the server with admin credentials', async () => {
    serverExams.push({ id: 'test_clear_exam', title: 'Đề xóa', durationMinutes: 10, questionIds: ['logic_q01'], assignedTo: ['all'] });
    serverExamSubmissions.push({ id: 'test_clear_sub', examId: 'test_clear_exam', userId: 'user_1', score: 10 });

    const result = await sendRequest({
      method: 'POST',
      url: '/api/exams/clear-all',
      headers: {
        'x-user-id': 'user_admin',
        Authorization: 'Bearer user_admin',
      },
      body: {},
    });

    expect(result.statusCode).toBe(200);
    expect(result.data.success).toBe(true);
    expect(serverExams.length).toBe(0);
    expect(serverExamSubmissions.length).toBe(0);
  });

  it('rejects POST /api/exams/clear-all when request is unauthenticated or not from admin', async () => {
    const result = await sendRequest({
      method: 'POST',
      url: '/api/exams/clear-all',
      body: {},
    });

    expect(result.statusCode).toBe(403);
    expect(result.data.error).toBe('FORBIDDEN');
  });

  describe('Batch user provisioning API (POST /api/admin/users/batch)', () => {
    it('rejects batch user creation if not admin', async () => {
      const result = await sendRequest({
        method: 'POST',
        url: '/api/admin/users/batch',
        body: { users: [{ username: 'sv_test', fullName: 'Sinh Vien Test' }] },
      });
      expect(result.statusCode).toBe(403);
      expect(result.data.success).toBe(false);
    });

    it('rejects empty user list with 400', async () => {
      const result = await sendRequest({
        method: 'POST',
        url: '/api/admin/users/batch',
        headers: { 'x-user-id': 'user_admin', Authorization: 'Bearer user_admin' },
        body: { users: [] },
      });
      expect(result.statusCode).toBe(400);
      expect(result.data.success).toBe(false);
    });

    it('successfully provisions multiple users in a single batch call', async () => {
      const initialCount = serverUsers.length;
      const batchData = [
        { username: 'sv_batch_01', fullName: 'SV Batch 1', className: 'K66-CNTT' },
        { username: 'sv_batch_02', fullName: 'SV Batch 2', className: 'K66-KTPM' },
        { username: 'sv_batch_01', fullName: 'SV Batch 1 Dupe' }, // Duplicate, should be skipped
      ];

      const result = await sendRequest({
        method: 'POST',
        url: '/api/admin/users/batch',
        headers: { 'x-user-id': 'user_admin', Authorization: 'Bearer user_admin' },
        body: { users: batchData },
      });

      expect(result.statusCode).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.addedCount).toBe(2);
      expect(result.data.skippedCount).toBe(1);
      expect(result.data.createdUsers.length).toBe(2);
      expect(result.data.createdUsers[0].password).toBeUndefined(); // passwords must be redacted

      // Verify in server data store
      expect(serverUsers.some(u => u.username === 'sv_batch_01')).toBe(true);
      expect(serverUsers.some(u => u.username === 'sv_batch_02')).toBe(true);

      // Cleanup
      const idx1 = serverUsers.findIndex(u => u.username === 'sv_batch_01');
      if (idx1 >= 0) serverUsers.splice(idx1, 1);
      const idx2 = serverUsers.findIndex(u => u.username === 'sv_batch_02');
      if (idx2 >= 0) serverUsers.splice(idx2, 1);
    });
  });

});
