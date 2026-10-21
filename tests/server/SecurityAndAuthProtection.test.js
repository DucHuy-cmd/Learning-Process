import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  handleRequest, 
  createSessionToken, 
  isRequestFromAdmin, 
  getRequestAuth, 
  sanitizeUserForAdmin,
  hashPassword,
  verifyPassword,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  clearAllLoginRateLimits
} from '../../src/server/app.js';
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
    expect(JSON.stringify(DEMO_USERS)).not.toContain('2HV0789@@');
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

  describe('Part 1: Password Hashing (scrypt) & Backward Compatibility', () => {
    it('hashPassword creates a salted scrypt hash with distinct salts', () => {
      const plain = 'SecretPassword123!';
      const hash1 = hashPassword(plain);
      const hash2 = hashPassword(plain);

      expect(hash1.startsWith('scrypt$')).toBe(true);
      expect(hash2.startsWith('scrypt$')).toBe(true);
      // Even with the same password, salts must differ, so hashes differ
      expect(hash1).not.toBe(hash2);

      const parts = hash1.split('$');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('scrypt');
      expect(parts[1].length).toBe(32); // 16 bytes = 32 hex chars
      expect(parts[2].length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('verifyPassword verifies correct password against scrypt hash and rejects wrong password', () => {
      const plain = 'StrongPass@2026';
      const hash = hashPassword(plain);

      expect(verifyPassword(plain, hash)).toBe(true);
      expect(verifyPassword('WrongPassword', hash)).toBe(false);
      expect(verifyPassword('', hash)).toBe(false);
      expect(verifyPassword(plain, null)).toBe(false);
      expect(verifyPassword(plain, '')).toBe(false);
    });

    it('verifyPassword maintains seamless backward-compatibility with legacy plaintext passwords', () => {
      const legacyPlain = '123456';
      expect(verifyPassword('123456', legacyPlain)).toBe(true);
      expect(verifyPassword('wrongpass', legacyPlain)).toBe(false);
    });

    it('POST /api/auth/login auto-upgrades legacy plaintext password to scrypt hash upon login', async () => {
      clearAllLoginRateLimits();
      const testUsername = `legacy_user_${Date.now()}`;
      const legacyUser = {
        id: `user_${testUsername}`,
        username: testUsername,
        fullName: 'Sinh Viên Cũ',
        className: 'K65',
        email: `${testUsername}@school.edu.vn`,
        password: 'plain_password_123',
        role: 'student',
      };
      serverUsers.push(legacyUser);

      // Perform login with plaintext password
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: testUsername, password: 'plain_password_123' }),
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);

      // Verify that user's password in memory was automatically upgraded to scrypt
      const updatedUser = serverUsers.find(u => u.username === testUsername);
      expect(updatedUser.password.startsWith('scrypt$')).toBe(true);
      expect(verifyPassword('plain_password_123', updatedUser.password)).toBe(true);

      // Cleanup
      const idx = serverUsers.findIndex(u => u.username === testUsername);
      if (idx !== -1) serverUsers.splice(idx, 1);
    });
  });

  describe('Part 1: Login Rate Limiting (Brute-force protection)', () => {
    beforeEach(() => {
      clearAllLoginRateLimits();
    });

    afterEach(() => {
      clearAllLoginRateLimits();
    });

    it('checkLoginRateLimit tracks attempts and locks out after 5 consecutive failed attempts', () => {
      const ip = '192.168.1.100';
      const user = 'hacker_target';

      // 4 failures are allowed
      for (let i = 0; i < 4; i++) {
        expect(checkLoginRateLimit(ip, user).limited).toBe(false);
        recordLoginFailure(ip, user);
      }
      expect(checkLoginRateLimit(ip, user).remainingAttempts).toBe(1);

      // 5th failure triggers lockout
      recordLoginFailure(ip, user);
      const status = checkLoginRateLimit(ip, user);
      expect(status.limited).toBe(true);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
      expect(status.remainingAttempts).toBe(0);

      // Reset clears lockout
      resetLoginRateLimit(ip, user);
      expect(checkLoginRateLimit(ip, user).limited).toBe(false);
    });

    it('POST /api/auth/login responds with HTTP 429 when rate limited after 5 failed attempts', async () => {
      const ip = '10.0.0.55';
      const targetUser = 'victim_user';

      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip, targetUser);
      }

      // Next login attempt from that IP for that user is blocked with 429
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({ username: targetUser, password: 'any_password' }),
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(429);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Tài khoản hoặc IP tạm thời bị khóa do thử sai quá 5 lần liên tiếp');
      expect(data.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('Global Session Invalidation on Password Change & Stranger Access Prevention', () => {
    it('authenticates admin with new password "2HV0789@@" and firmly rejects old password "2HV6868@"', async () => {
      // 1. Old password rejected
      const oldLogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '2HV6868@' }),
      });
      await handleRequest(oldLogin.req, oldLogin.res);
      expect(oldLogin.res.statusCode).toBe(401);

      // 2. New password accepted
      const newLogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '2HV0789@@' }),
      });
      await handleRequest(newLogin.req, newLogin.res);
      expect(newLogin.res.statusCode).toBe(200);
      const data = JSON.parse(newLogin.res.body);
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('admin');
      expect(typeof data.token).toBe('string');
    });

    it('immediately invalidates admin sessions on other devices when admin changes password', async () => {
      // 1. Device A: Admin logged in with current password
      const deviceALogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '2HV0789@@' }),
      });
      await handleRequest(deviceALogin.req, deviceALogin.res);
      expect(deviceALogin.res.statusCode).toBe(200);
      const tokenDeviceA = JSON.parse(deviceALogin.res.body).token;

      // Device A can access admin API
      const testReq1 = createMockHttp({
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${tokenDeviceA}` },
      });
      await handleRequest(testReq1.req, testReq1.res);
      expect(testReq1.res.statusCode).toBe(200);

      // 2. Device B: Admin changes password to a new password
      const changePwdReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${tokenDeviceA}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: '2HV0789@@',
          newPassword: '2HV0789@@_updated',
        }),
      });
      await handleRequest(changePwdReq.req, changePwdReq.res);
      expect(changePwdReq.res.statusCode).toBe(200);
      const changeRes = JSON.parse(changePwdReq.res.body);
      expect(changeRes.success).toBe(true);
      const tokenDeviceB = changeRes.token;

      // 3. Now Device A with the OLD token is REVOKED and rejected with 401
      const testReqOld = createMockHttp({
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${tokenDeviceA}` },
      });
      await handleRequest(testReqOld.req, testReqOld.res);
      expect(testReqOld.res.statusCode).toBe(401);

      // 4. Device B with the NEW token works
      const testReqNew = createMockHttp({
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${tokenDeviceB}` },
      });
      await handleRequest(testReqNew.req, testReqNew.res);
      expect(testReqNew.res.statusCode).toBe(200);

      // Restore admin password back to 2HV0789@@
      const restorePwdReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${tokenDeviceB}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: '2HV0789@@_updated',
          newPassword: '2HV0789@@',
        }),
      });
      await handleRequest(restorePwdReq.req, restorePwdReq.res);
      expect(restorePwdReq.res.statusCode).toBe(200);
    });

    it('immediately invalidates student sessions across all devices when student changes password', async () => {
      // 1. Create a student account
      const studentUsername = `sv_test_logout_${Date.now()}`;
      const regReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: studentUsername,
          fullName: 'Sinh Viên Kiểm Thử Đăng Xuất',
          email: `${studentUsername}@toanrr.edu.vn`,
          password: 'OldPassword123!',
        }),
      });
      await handleRequest(regReq.req, regReq.res);
      expect(regReq.res.statusCode).toBe(200);

      // 2. Student logs in on Phone (Device 1)
      const loginPhone = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: studentUsername, password: 'OldPassword123!' }),
      });
      await handleRequest(loginPhone.req, loginPhone.res);
      expect(loginPhone.res.statusCode).toBe(200);
      const tokenPhone = JSON.parse(loginPhone.res.body).token;

      // 3. Student logs in on Laptop (Device 2) and changes password
      const loginLaptop = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: studentUsername, password: 'OldPassword123!' }),
      });
      await handleRequest(loginLaptop.req, loginLaptop.res);
      const tokenLaptop = JSON.parse(loginLaptop.res.body).token;

      const changeReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${tokenLaptop}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        }),
      });
      await handleRequest(changeReq.req, changeReq.res);
      expect(changeReq.res.statusCode).toBe(200);
      const newTokenLaptop = JSON.parse(changeReq.res.body).token;

      // 4. Phone (Device 1) with OLD token is now REVOKED
      const phoneCheck = createMockHttp({
        method: 'GET',
        url: '/api/auth/verify?username=' + studentUsername,
        headers: { authorization: `Bearer ${tokenPhone}` },
      });
      const authPhone = getRequestAuth(phoneCheck.req);
      expect(authPhone.authenticated).toBe(false);
      expect(authPhone.revoked).toBe(true);

      // 5. Laptop with NEW token is valid
      const laptopCheck = createMockHttp({
        method: 'GET',
        url: '/api/auth/verify?username=' + studentUsername,
        headers: { authorization: `Bearer ${newTokenLaptop}` },
      });
      const authLaptop = getRequestAuth(laptopCheck.req);
      expect(authLaptop.authenticated).toBe(true);
      expect(authLaptop.user.username).toBe(studentUsername);

      // Cleanup
      const idx = serverUsers.findIndex(u => u.username === studentUsername);
      if (idx !== -1) serverUsers.splice(idx, 1);
    });

    it('invalidates student sessions when Admin resets their password', async () => {
      // 1. Create a student account
      const studentUsername = `sv_admin_reset_${Date.now()}`;
      const regReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: studentUsername,
          fullName: 'Sinh Viên Bị Reset MK',
          email: `${studentUsername}@toanrr.edu.vn`,
          password: 'InitialPassword123!',
        }),
      });
      await handleRequest(regReq.req, regReq.res);
      expect(regReq.res.statusCode).toBe(200);

      // Student logs in on device
      const studentLogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: studentUsername, password: 'InitialPassword123!' }),
      });
      await handleRequest(studentLogin.req, studentLogin.res);
      const studentToken = JSON.parse(studentLogin.res.body).token;

      // Admin logs in
      const adminLogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '2HV0789@@' }),
      });
      await handleRequest(adminLogin.req, adminLogin.res);
      const adminToken = JSON.parse(adminLogin.res.body).token;

      // Admin resets student password
      const resetReq = createMockHttp({
        method: 'POST',
        url: `/api/admin/users/${studentUsername}/reset-password`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ newPassword: '123456' }),
      });
      await handleRequest(resetReq.req, resetReq.res);
      expect(resetReq.res.statusCode).toBe(200);

      // Student's previous session token is now completely REVOKED
      const studentCheck = createMockHttp({
        method: 'GET',
        url: '/api/auth/verify?username=' + studentUsername,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      const authRes = getRequestAuth(studentCheck.req);
      expect(authRes.authenticated).toBe(false);
      expect(authRes.revoked).toBe(true);

      // Student can log in with new password '123456'
      const reLogin = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: studentUsername, password: '123456' }),
      });
      await handleRequest(reLogin.req, reLogin.res);
      expect(reLogin.res.statusCode).toBe(200);

      // Cleanup
      const idx = serverUsers.findIndex(u => u.username === studentUsername);
      if (idx !== -1) serverUsers.splice(idx, 1);
    });
  });
});
