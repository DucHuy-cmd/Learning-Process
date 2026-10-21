import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { AdminView } from '../../src/ui/views/AdminView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { cloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] || null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

describe('Admin Database Management & Smart Features', () => {
  let dom;
  let document;
  let window;
  let container;
  let adminView;
  let storage;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="adminView"></div></body></html>', {
      url: 'http://localhost:3000',
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.Event = window.Event;

    storage = new MockStorage();
    authManager.storage = storage;
    authManager._initStorage();
    authManager.quickLogin('user_admin');

    container = document.getElementById('adminView');
    adminView = new AdminView({ container });
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.Event;
  });

  it('renders Database status indicator and verifies ping button is removed', async () => {
    await adminView.render();
    const btnPing = container.querySelector('#btnAdminPingDb');
    expect(btnPing).toBeNull();
    expect(container.textContent).toContain('Cấu Hình Cơ Sở Dữ Liệu SQL');
  });

  it('provides 1-click password reset for student accounts', async () => {
    const createRes = authManager.adminCreateUser({
      username: 'sv_reset_test',
      fullName: 'Sinh Viên Test MK',
      password: 'custom_secret_123',
    });
    expect(createRes.success).toBe(true);

    const resetRes = authManager.adminResetPassword(createRes.user.id, '123456');
    expect(resetRes.success).toBe(true);

    const users = authManager.getUsers();
    const found = users.find(u => u.username === 'sv_reset_test');
    expect(found.password).toBe('123456');
  });

  it('smart column parser handles natural table with varied column orders', () => {
    const csvStandard = 'Mã SV,Họ và tên,Lớp,Email,Mật khẩu\n6651071001,Nguyễn Văn A,K66-CNTT,a@st.utc2.edu.vn,pass_abc';
    const parsed1 = adminView._parseUserImportText(csvStandard);
    expect(parsed1.length).toBe(1);
    expect(parsed1[0].username).toBe('6651071001');
    expect(parsed1[0].fullName).toBe('Nguyễn Văn A');
    expect(parsed1[0].className).toBe('K66-CNTT');
    expect(parsed1[0].email).toBe('a@st.utc2.edu.vn');
    expect(parsed1[0].password).toBe('pass_abc');

    // Reversed order without password (defaults to 123456)
    const csvReversed = 'Họ tên,Lớp,Mã SV\nTrần Thị B,K66-KTPM,6651071002';
    const parsed2 = adminView._parseUserImportText(csvReversed);
    expect(parsed2.length).toBe(1);
    expect(parsed2[0].username).toBe('6651071002');
    expect(parsed2[0].fullName).toBe('Trần Thị B');
    expect(parsed2[0].className).toBe('K66-KTPM');
    expect(parsed2[0].password).toBe('123456');
  });

  it('renders student exam submissions directly in the gradebook section', async () => {
    await adminView.render();

    const gradebookSection = container.querySelector('#tabContentGradebook');
    expect(gradebookSection).not.toBeNull();
    const tbody = container.querySelector('#adminGradebookTbody');
    expect(tbody).not.toBeNull();
  });

  it('resets database cleanly, clears tombstones, and allows re-creating the same accounts', async () => {
    // 1. Create a student account
    authManager.adminCreateUser({
      username: 'sv_reset_recreate',
      fullName: 'Sinh Viên Test Reset',
      password: '123',
    });
    expect(authManager.getUsers().some(u => u.username === 'sv_reset_recreate')).toBe(true);

    // 2. Perform full database reset
    window.confirm = () => true;
    await adminView.render();
    const btnReset = container.querySelector('#btnAdminFullDatabaseReset');
    expect(btnReset).not.toBeNull();
    btnReset.click();
    await new Promise(r => setTimeout(r, 60));

    // 3. Verify user is removed and tombstones are empty
    expect(authManager.getUsers().some(u => u.username === 'sv_reset_recreate')).toBe(false);
    expect(authManager.getDeletedUsers()).toEqual([]);

    // 4. Re-create the same username
    const reCreateRes = authManager.adminCreateUser({
      username: 'sv_reset_recreate',
      fullName: 'Sinh Viên Tái Tạo',
      password: '123',
    });
    expect(reCreateRes.success).toBe(true);

    // 5. User should be able to log in without "tài khoản đã bị xóa" error
    const loginRes = authManager.login('sv_reset_recreate', '123');
    expect(loginRes.success).toBe(true);
    expect(loginRes.user.username).toBe('sv_reset_recreate');
  });
});
