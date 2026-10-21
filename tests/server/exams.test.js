import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest, createSessionToken, verifySessionToken } from '../../src/server/app.js';
import { serverExams, serverExamSubmissions, serverUsers } from '../../src/server/auth/ServerDataStore.js';
import { sqlDb } from '../../src/server/db/SqlDatabaseAdapter.js';

function createMockHttp({ method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  const normalizedHeaders = { host: 'localhost:3000', 'content-type': 'application/json' };
  for (const [k, v] of Object.entries(headers)) {
    normalizedHeaders[k.toLowerCase()] = v;
  }
  req.headers = normalizedHeaders;

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
    if (body !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    }
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
      // Clean any existing test users to ensure test isolation
      for (let i = serverUsers.length - 1; i >= 0; i--) {
        if (serverUsers[i].username === 'sv_batch_01' || serverUsers[i].username === 'sv_batch_02') {
          serverUsers.splice(i, 1);
        }
      }
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

    it('allows newly provisioned batch accounts to log in immediately with their credentials', async () => {
      const testUser = {
        username: 'sv_login_batch_test',
        fullName: 'Sinh Viên Kiểm Tra Đăng Nhập',
        className: 'K66-CNTT',
        password: 'Password@2026',
      };

      // Provision user
      const provisionRes = await sendRequest({
        method: 'POST',
        url: '/api/admin/users/batch',
        headers: { 'x-user-id': 'user_admin', Authorization: 'Bearer user_admin' },
        body: { users: [testUser] },
      });
      expect(provisionRes.statusCode).toBe(200);
      expect(provisionRes.data.addedCount).toBe(1);

      // Attempt login with new user credentials
      const loginRes = await sendRequest({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          username: testUser.username,
          password: testUser.password,
        },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.data.success).toBe(true);
      expect(loginRes.data.user.username).toBe(testUser.username);
      expect(loginRes.data.user.password).toBeUndefined();
      expect(typeof loginRes.data.token).toBe('string');

      // Cleanup
      const cleanIdx = serverUsers.findIndex(u => u.username === testUser.username);
      if (cleanIdx >= 0) serverUsers.splice(cleanIdx, 1);
    });

    it('reports per-row errors for missing fields without breaking valid accounts', async () => {
      const mixedBatch = [
        { username: '', fullName: 'Không có username' }, // Missing username
        { username: 'sv_valid_row_01', fullName: '' }, // Missing fullName
        { username: 'sv_valid_row_01', fullName: 'Nguyễn Văn Hợp Lệ', password: 'pass' }, // Valid
      ];

      const res = await sendRequest({
        method: 'POST',
        url: '/api/admin/users/batch',
        headers: { 'x-user-id': 'user_admin', Authorization: 'Bearer user_admin' },
        body: { users: mixedBatch },
      });

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.errorCount).toBe(2);
      expect(res.data.addedCount).toBe(1);
      expect(res.data.results.find(r => r.line === 1).status).toBe('error');
      expect(res.data.results.find(r => r.line === 2).status).toBe('error');
      expect(res.data.results.find(r => r.line === 3).status).toBe('success');

      // Cleanup
      const cleanIdx = serverUsers.findIndex(u => u.username === 'sv_valid_row_01');
      if (cleanIdx >= 0) serverUsers.splice(cleanIdx, 1);
    });
  });

  describe('Single Exam Deletion API (DELETE /api/exams/:id)', () => {
    it('deletes exam and its submissions from server', async () => {
      const examId = `exam_delete_test_${Date.now()}`;
      serverExams.push({ id: examId, title: 'Đề thi cần xóa', questionIds: ['logic_q01'] });
      serverExamSubmissions.push({ id: `sub_${examId}`, examId, userId: 'user_1', score: 9 });

      const delRes = await sendRequest({
        method: 'DELETE',
        url: `/api/exams/${examId}`,
        headers: { Authorization: 'Bearer user_admin' },
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.data.success).toBe(true);
      expect(serverExams.some(e => e.id === examId)).toBe(false);
      expect(serverExamSubmissions.some(s => s.examId === examId)).toBe(false);
    });

    it('rejects DELETE /api/exams/:id when unauthenticated or from student', async () => {
      const examId = 'exam_protected_test';
      const unauthRes = await sendRequest({
        method: 'DELETE',
        url: `/api/exams/${examId}`,
      });
      expect(unauthRes.statusCode).toBe(403);
      expect(unauthRes.data.error).toBe('FORBIDDEN');

      // Student token
      const studentToken = createSessionToken({ id: 'user_student_1', username: 'student1', role: 'student' });
      const studentRes = await sendRequest({
        method: 'DELETE',
        url: `/api/exams/${examId}`,
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(studentRes.statusCode).toBe(403);
      expect(studentRes.data.error).toBe('FORBIDDEN');
    });

    it('accepts DELETE /api/exams/:id with a valid cryptographically signed admin session token', async () => {
      const examId = `exam_token_test_${Date.now()}`;
      serverExams.push({ id: examId, title: 'Đề test token' });
      serverExamSubmissions.push({ id: `sub_${examId}`, examId, userId: 'user_1', score: 8 });

      const adminToken = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
      const delRes = await sendRequest({
        method: 'DELETE',
        url: `/api/exams/${examId}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.data.success).toBe(true);
      expect(serverExams.some(e => e.id === examId)).toBe(false);
    });
  });

  describe('Cryptographic Session Tokens & Security Verification', () => {
    it('creates and verifies legitimate signed session tokens', () => {
      const adminToken = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
      expect(typeof adminToken).toBe('string');
      expect(adminToken.includes('.')).toBe(true);

      const payload = verifySessionToken(adminToken);
      expect(payload).not.toBeNull();
      expect(payload.username).toBe('admin');
      expect(payload.role).toBe('admin');
    });

    it('rejects tampered or forged session tokens', () => {
      const legitimateToken = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
      const [payloadB64, sig] = legitimateToken.split('.');

      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 'user_admin', username: 'admin', role: 'admin', exp: Date.now() + 99999 })).toString('base64url');
      const forgedToken = `${tamperedPayload}.${sig}`;

      expect(verifySessionToken(forgedToken)).toBeNull();
      expect(verifySessionToken('random_invalid_token')).toBeNull();
      expect(verifySessionToken('')).toBeNull();
    });
  });

  describe('Database Failure / Network Disconnection Simulation', () => {
    it('returns HTTP 500 without false success when database transaction throws error', async () => {
      // Temporarily enable cloud and mock executeTransaction to fail
      const originalIsCloud = sqlDb.isCloudEnabled;
      const originalExecTx = sqlDb.executeTransaction;
      const originalUrl = sqlDb.postgresUrl;

      sqlDb.isCloudEnabled = true;
      sqlDb.postgresUrl = 'postgresql://mock:mock@localhost:5432/test';
      sqlDb.executeTransaction = async () => {
        throw new Error('Connection terminated unexpectedly by peer');
      };

      try {
        const res = await sendRequest({
          method: 'DELETE',
          url: '/api/exams/exam_fail_test',
          headers: { Authorization: 'Bearer user_admin' },
        });

        expect(res.statusCode).toBe(500);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toContain('Lỗi cơ sở dữ liệu khi xóa đề thi');
      } finally {
        sqlDb.isCloudEnabled = originalIsCloud;
        sqlDb.executeTransaction = originalExecTx;
        sqlDb.postgresUrl = originalUrl;
      }
    });
  });

});
