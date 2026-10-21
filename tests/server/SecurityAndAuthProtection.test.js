import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleRequest, createSessionToken, isRequestFromAdmin, getRequestAuth, sanitizeUserForAdmin } from '../../src/server/app.js';
import { AuthManager, DEMO_USERS } from '../../src/core/auth/AuthManager.js';
import { ExamManager } from '../../src/core/quiz/ExamManager.js';
import { CloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';
import { serverUsers, serverExams, markExamDeleted, isExamDeleted } from '../../src/server/auth/ServerDataStore.js';

function createMockHttp({ method = 'GET', url = '/', headers = {}, body = null } = {}) {
  const req = {
    method,
    url,
    headers: { ...headers },
    on: (event, handler) => {
      if (event === 'data' && body) {
        handler(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
      }
      if (event === 'end') {
        setTimeout(handler, 0);
      }
      return req;
    },
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead: (code, hdrs) => {
      res.statusCode = code;
      if (hdrs) res.headers = { ...res.headers, ...hdrs };
    },
    setHeader: (k, v) => {
      res.headers[k] = v;
    },
    end: (data) => {
      if (data) res.body = data;
    },
  };

  return { req, res };
}

describe('Security & Admin Authentication Hardening', () => {
  it('DEMO_USERS in client AuthManager contains NO plaintext admin password', () => {
    expect(DEMO_USERS[0].password).toBeUndefined();
    expect(JSON.stringify(DEMO_USERS)).not.toContain('2HV6868@');
  });

  it('GET /api/auth/users returns 401 UNAUTHORIZED when called without credentials', async () => {
    const { req, res } = createMockHttp({ method: 'GET', url: '/api/auth/users' });
    await handleRequest(req, res);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/users returns 403 FORBIDDEN when called with student credentials', async () => {
    const studentUser = { id: 'sv_test_99', username: 'sv_test_99', role: 'student' };
    const studentToken = createSessionToken(studentUser);

    const { req, res } = createMockHttp({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${studentToken}` }
    });
    await handleRequest(req, res);

    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(false);
    expect(data.error).toBe('FORBIDDEN');
  });

  it('GET /api/auth/users returns 200 with sanitized users (no passwords) when called with admin session token', async () => {
    const adminUser = { id: 'user_admin', username: 'admin', role: 'admin' };
    const adminToken = createSessionToken(adminUser);

    const { req, res } = createMockHttp({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    await handleRequest(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
    for (const u of data.users) {
      expect(u.password).toBeUndefined();
      expect(u.hash).toBeUndefined();
      expect(u.token).toBeUndefined();
    }
  });

  it('GET /api/admin/users rejects unauthenticated (401) and student (403), allows admin token (200)', async () => {
    // 1. Unauthenticated -> 401
    const unauth = createMockHttp({ method: 'GET', url: '/api/admin/users' });
    await handleRequest(unauth.req, unauth.res);
    expect(unauth.res.statusCode).toBe(401);

    // 2. Student token -> 403
    const studentToken = createSessionToken({ id: 'user_sv_1', username: 'sv_1', role: 'student' });
    const studentReq = createMockHttp({
      method: 'GET',
      url: '/api/admin/users',
      headers: { authorization: `Bearer ${studentToken}` }
    });
    await handleRequest(studentReq.req, studentReq.res);
    expect(studentReq.res.statusCode).toBe(403);

    // 3. Admin token -> 200
    const adminToken = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
    const adminReq = createMockHttp({
      method: 'GET',
      url: '/api/admin/users',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    await handleRequest(adminReq.req, adminReq.res);
    expect(adminReq.res.statusCode).toBe(200);
    const data = JSON.parse(adminReq.res.body);
    expect(data.success).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users[0].password).toBeUndefined();
  });

  it('rejects spoofed x-user-id header in production simulation (process.env.NODE_ENV === "production")', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const fakeReq = {
        headers: {
          'x-user-id': 'user_admin',
        }
      };
      const auth = getRequestAuth(fakeReq);
      expect(auth.authenticated).toBe(false);
      expect(auth.isAdmin).toBe(false);
      expect(isRequestFromAdmin(fakeReq)).toBe(false);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('accepts valid HMAC signed token in production simulation', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const token = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
      const validReq = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const auth = getRequestAuth(validReq);
      expect(auth.authenticated).toBe(true);
      expect(auth.isAdmin).toBe(true);
      expect(isRequestFromAdmin(validReq)).toBe(true);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('single exam deletion removes exam and purges it from student synchronized storage', async () => {
    class MockStorage {
      constructor() { this.store = new Map(); }
      getItem(k) { return this.store.get(k) || null; }
      setItem(k, v) { this.store.set(k, String(v)); }
      removeItem(k) { this.store.delete(k); }
      clear() { this.store.clear(); }
    }

    const adminToken = createSessionToken({ id: 'user_admin', username: 'admin', role: 'admin' });
    const targetExamId = `exam_delete_single_${Date.now()}`;

    // 1. Create an exam on server
    const createReq = createMockHttp({
      method: 'POST',
      url: '/api/exams',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        id: targetExamId,
        title: 'Đề thi kiểm tra xóa đơn lẻ',
        durationMinutes: 15,
        questionIds: ['q1', 'q2'],
        assignedTo: ['all']
      }
    });
    await handleRequest(createReq.req, createReq.res);

    // 2. Set up student ExamManager with this exam
    const studentStorage = new MockStorage();
    const studentExamManager = new ExamManager({ storage: studentStorage });
    studentExamManager.storage.setItem('trr_assigned_exams_v1', JSON.stringify([
      { id: targetExamId, title: 'Đề thi kiểm tra xóa đơn lẻ', durationMinutes: 15, questionIds: ['q1', 'q2'], assignedTo: ['all'] }
    ]));
    studentExamManager.memoryExams = studentExamManager.getExams();

    // Student has a submission for this exam
    studentExamManager.submitExam({
      examId: targetExamId,
      userId: 'student_1',
      answers: { q1: 'A' },
      timeSpentSeconds: 60,
    });
    expect(studentExamManager.getSubmissions().some(s => s.examId === targetExamId)).toBe(true);

    // 3. Admin deletes the exam via DELETE /api/exams/:id
    const deleteReq = createMockHttp({
      method: 'DELETE',
      url: `/api/exams/${targetExamId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    await handleRequest(deleteReq.req, deleteReq.res);
    expect(deleteReq.res.statusCode).toBe(200);

    // 4. Student syncs exams
    const syncManager = new CloudSyncManager();
    globalThis.fetch = async (url) => {
      const { req, res } = createMockHttp({ method: 'GET', url: url.replace(syncManager.baseUrl, '') });
      await handleRequest(req, res);
      return {
        ok: res.statusCode === 200,
        status: res.statusCode,
        json: async () => JSON.parse(res.body),
      };
    };

    const syncResult = await syncManager.syncExams(studentExamManager);
    expect(syncResult.success).toBe(true);

    // Verify exam is gone from student's storage and memory
    const remainingExams = studentExamManager.getExams();
    expect(remainingExams.some(e => e.id === targetExamId)).toBe(false);

    // Verify submission is purged
    const remainingSubmissions = studentExamManager.getSubmissions().filter(s => s.examId === targetExamId);
    expect(remainingSubmissions.length).toBe(0);
  });
});
