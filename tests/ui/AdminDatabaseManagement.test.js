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

  it('renders Database status indicator and ping button', async () => {
    await adminView.render();
    const btnPing = container.querySelector('#btnAdminPingDb');
    expect(btnPing).not.toBeNull();
    expect(container.textContent).toContain('Cấu Hình Database Cloud');
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

  it('renders student exam submissions in the gradebook tab', async () => {
    await adminView.render();

    // Switch to gradebook tab
    const tabGradebook = container.querySelector('.btn-admin-tab[data-tab="gradebook"]');
    expect(tabGradebook).not.toBeNull();
    tabGradebook.click();

    expect(adminView.activeTab).toBe('gradebook');
    const tbody = container.querySelector('#adminGradebookTbody');
    expect(tbody).not.toBeNull();
  });
});
