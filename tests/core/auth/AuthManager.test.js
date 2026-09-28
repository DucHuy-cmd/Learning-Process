/**
 * @file AuthManager.test.js
 * Unit Test Suite for AuthManager & AiHistoryManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthManager, DEMO_USERS } from '../../../src/core/auth/AuthManager.js';
import { AiHistoryManager } from '../../../src/core/ai/AiHistoryManager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('AuthManager & User Accounts', () => {
  let storage;
  let auth;

  beforeEach(() => {
    storage = new MockStorage();
    auth = new AuthManager({ storage });
  });

  it('initializes with guest mode and single admin account', () => {
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getCurrentUser()).toBeNull();
    const users = auth.getUsers();
    expect(users.length).toBe(1);
    expect(users[0].username).toBe('admin');
  });

  it('performs 1-click quick login for admin', () => {
    const res = auth.quickLogin('user_admin');
    expect(res.success).toBe(true);
    expect(res.user.username).toBe('admin');
    expect(res.user.role).toBe('admin');
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('allows logging in with admin credentials', () => {
    const res = auth.login('admin', 'admin123');
    expect(res.success).toBe(true);
    expect(auth.getCurrentUser().username).toBe('admin');
  });

  it('rejects invalid credentials with informative error message', () => {
    const emptyRes = auth.login('', '');
    expect(emptyRes.success).toBe(false);

    const nonExist = auth.login('unknown_user_999', 'pass');
    expect(nonExist.success).toBe(false);
    expect(nonExist.error).toContain('Tài khoản không tồn tại');
  });

  it('registers new student account and logs in automatically', () => {
    const regRes = auth.register({
      username: 'sv_k66_test',
      fullName: 'Nguyễn Văn A',
      email: 'nguyenvana@k66.edu.vn',
      password: 'password123',
    });

    expect(regRes.success).toBe(true);
    expect(regRes.user.fullName).toBe('Nguyễn Văn A');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getCurrentUser().username).toBe('sv_k66_test');
  });

  it('rejects duplicate username or email during registration', () => {
    auth.register({
      username: 'student1',
      fullName: 'Student One',
      email: 'student1@k66.edu.vn',
      password: 'password123',
    });

    const dupUsername = auth.register({
      username: 'student1',
      fullName: 'Student Two',
      email: 'other@k66.edu.vn',
      password: 'password123',
    });
    expect(dupUsername.success).toBe(false);
    expect(dupUsername.error).toContain('Tên đăng nhập đã được sử dụng');
  });

  it('logs out and triggers onAuthStateChanged listener', () => {
    auth.quickLogin('user_admin');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isAdmin()).toBe(true);

    let eventFired = null;
    auth.onAuthStateChanged((event) => {
      eventFired = event;
    });

    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getCurrentUser()).toBeNull();
    expect(auth.isAdmin()).toBe(false);
    expect(eventFired).toBe('logout');
  });

  it('verifies single admin RBAC permissions and user database management', () => {
    // 1. Student cannot delete users or admin-create accounts
    auth.register({
      username: 'student_rbac',
      fullName: 'Sinh Viên',
      email: 'student@toanrr.edu.vn',
      password: 'password123',
    });
    expect(auth.isAdmin()).toBe(false);
    const failDel = auth.deleteUser('user_admin');
    expect(failDel.success).toBe(false);

    // 2. Admin can create new student accounts
    auth.quickLogin('user_admin');
    expect(auth.isAdmin()).toBe(true);

    const createRes = auth.adminCreateUser({
      username: 'sv_test_rbac',
      fullName: 'Sinh Viên Test',
      password: '123',
    });
    expect(createRes.success).toBe(true);
    expect(auth.getUsers().some(u => u.username === 'sv_test_rbac')).toBe(true);

    // 3. Admin cannot delete the single admin account
    const delAdminRes = auth.deleteUser('user_admin');
    expect(delAdminRes.success).toBe(false);

    // 4. Admin can delete the created student account
    const delRes = auth.deleteUser(createRes.user.id);
    expect(delRes.success).toBe(true);
    expect(auth.getUsers().some(u => u.username === 'sv_test_rbac')).toBe(false);
  });
});

describe('AiHistoryManager', () => {
  let storage;
  let history;

  beforeEach(() => {
    storage = new MockStorage();
    history = new AiHistoryManager({ storage });
  });

  it('creates and retrieves sessions indexed by userId', () => {
    const session = history.createSession('user_duchuy', {
      title: 'Hỏi về Bìa K-Map 4 biến',
      mode: 'bridge',
      messages: [{ role: 'user', text: 'Tối thiểu hóa hàm Boole 4 biến' }],
    });

    expect(session.id).toBeDefined();
    expect(session.userId).toBe('user_duchuy');

    const list = history.getUserSessions('user_duchuy');
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Hỏi về Bìa K-Map 4 biến');

    // Guest has no sessions yet
    expect(history.getUserSessions('guest').length).toBe(0);
  });

  it('updates session messages and lab snapshot', () => {
    const session = history.createSession('guest', {
      title: 'Khảo sát Dijkstra',
      messages: [{ role: 'user', text: 'Tìm đường đi ngắn nhất từ A đến Z' }],
    });

    history.updateSession(session.id, {
      labSnapshot: { type: 'graph', algo: 'dijkstra', nodeCount: 6 },
    });

    const retrieved = history.getSession(session.id);
    expect(retrieved.labSnapshot.algo).toBe('dijkstra');
  });

  it('deletes session and clears all user sessions', () => {
    const s1 = history.createSession('user_truongvu', { title: 'Session 1' });
    const s2 = history.createSession('user_truongvu', { title: 'Session 2' });

    expect(history.getUserSessions('user_truongvu').length).toBe(2);

    history.deleteSession(s1.id);
    expect(history.getUserSessions('user_truongvu').length).toBe(1);

    history.clearUserSessions('user_truongvu');
    expect(history.getUserSessions('user_truongvu').length).toBe(0);
  });

  it('exports and imports session JSON for team sharing', () => {
    const original = history.createSession('user_duchuy', {
      title: 'Đề thi cuối kỳ Dirichlet',
      messages: [{ role: 'user', text: '15 con thỏ vào 4 cái chuồng' }],
    });

    const json = history.exportSessionJson(original.id);
    expect(json).toContain('15 con thỏ');

    const imported = history.importSessionJson(json, 'user_ngochung');
    expect(imported).not.toBeNull();
    expect(imported.userId).toBe('user_ngochung');
    expect(imported.title).toContain('Dirichlet');
  });
});
