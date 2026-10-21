/**
 * @file AdminView.test.js
 * Unit Test Suite for AdminView (Dedicated Admin Database & Student Management)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { AdminView } from '../../src/ui/views/AdminView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { quizHistoryManager } from '../../src/core/quiz/QuizHistoryManager.js';
import { cloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

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

describe('AdminView (Dedicated Database & Student Management Tab)', () => {
  let dom;
  let document;
  let window;
  let container;
  let onNavigate;
  let adminView;
  let storage;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="adminView"></div></body></html>`, {
      url: 'http://localhost:3000',
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.Event = window.Event;
    global.CustomEvent = window.CustomEvent;

    storage = new MockStorage();
    authManager.storage = storage;
    authManager._initStorage();
    authManager.logout();

    container = document.getElementById('adminView');
    onNavigate = vi.fn();
    adminView = new AdminView({ container, onNavigate });
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.Event;
  });

  it('renders Access Denied state when current user is a guest or non-admin', () => {
    adminView.render();
    expect(container.textContent).toContain('Quyền Truy Cập Bị Hạn Chế');
    expect(container.textContent).toContain('@admin');

    const btnReturn = container.querySelector('#btnAdminReturnHome');
    expect(btnReturn).not.toBeNull();
    btnReturn.click();
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('renders full Admin Dashboard when logged in as single admin account', async () => {
    authManager.quickLogin('user_admin');
    expect(authManager.isAdmin()).toBe(true);

    await adminView.render();

    // 1. Header banner
    expect(container.textContent).toContain('Quản Trị Cơ Sở Dữ Liệu & Sinh Viên');
    expect(container.textContent).toContain('Administrator');

    // 2. Metrics cards
    expect(container.textContent).toContain('Tổng Sinh Viên');
    expect(container.textContent).toContain('Trạng Thái Máy Chủ');
    expect(container.textContent).toContain('@admin');

    // 3. User table shows admin labeled cleanly without Thầy/Cô
    expect(container.textContent).toContain('Quản trị viên');
    expect(container.textContent).not.toContain('Thầy/Cô');
    expect(container.textContent).not.toContain('Khoa CNTT - Giảng viên');

    // 4. Admin account has "Admin gốc" label instead of delete button
    expect(container.textContent).toContain('Admin gốc');
  });

  it('creates new student account via the admin view form', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    const usernameInp = container.querySelector('#adminInpUsername');
    const passwordInp = container.querySelector('#adminInpPassword');
    const fullNameInp = container.querySelector('#adminInpFullName');
    const classInp = container.querySelector('#adminInpClass');
    const form = container.querySelector('#adminViewAddUserForm');

    usernameInp.value = 'sv_newbie';
    passwordInp.value = 'mypass123';
    fullNameInp.value = 'Trần Văn Mới';
    classInp.value = 'K66-CNTT';

    form.dispatchEvent(new window.Event('submit'));
    await new Promise(r => setTimeout(r, 60));

    expect(authManager.getUsers().some(u => u.username === 'sv_newbie')).toBe(true);
    expect(container.textContent).toContain('Trần Văn Mới');
    expect(container.textContent).toContain('@sv_newbie');
  });

  it('filters users in real-time using search input', async () => {
    authManager.quickLogin('user_admin');
    authManager.adminCreateUser({
      username: 'sv_alice',
      fullName: 'Alice Johnson',
      password: '123',
    });
    authManager.adminCreateUser({
      username: 'sv_bob',
      fullName: 'Bob Smith',
      password: '123',
    });

    await adminView.render();

    const searchInput = container.querySelector('#adminUserSearchInput');
    const tbody = container.querySelector('#adminUsersTbody');

    expect(tbody.textContent).toContain('Alice Johnson');
    expect(tbody.textContent).toContain('Bob Smith');

    // Search "Alice"
    searchInput.value = 'Alice';
    searchInput.dispatchEvent(new window.Event('input'));
    expect(tbody.textContent).toContain('Alice Johnson');
    expect(tbody.textContent).not.toContain('Bob Smith');

    // Search nonexistent
    searchInput.value = 'NonExistentUser';
    searchInput.dispatchEvent(new window.Event('input'));
    expect(tbody.textContent).toContain('Không tìm thấy tài khoản nào phù hợp');
  });

  it('deletes student user when clicking delete button in table', async () => {
    authManager.quickLogin('user_admin');
    const createRes = authManager.adminCreateUser({
      username: 'sv_to_delete',
      fullName: 'Sinh Viên Xóa',
      password: '123',
    });

    await adminView.render();
    expect(container.textContent).toContain('Sinh Viên Xóa');

    // Mock confirm
    window.confirm = () => true;

    const delBtn = container.querySelector(`button[data-user-id="${createRes.user.id}"]`);
    expect(delBtn).not.toBeNull();
    delBtn.click();
    await new Promise(r => setTimeout(r, 60));

    expect(authManager.getUsers().some(u => u.username === 'sv_to_delete')).toBe(false);
  });

  it('verifies leaderboard section is removed and database reset button is present', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    expect(container.querySelector('#btnAdminResetLeaderboard')).toBeNull();
    expect(container.querySelector('.admin-leaderboard-section')).toBeNull();
    expect(container.querySelector('#btnAdminFullDatabaseReset')).not.toBeNull();
  });

  it('provides template download and batch user import from file', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    const btnTemplate = container.querySelector('#btnAdminDownloadUserTemplate');
    const btnImport = container.querySelector('#btnAdminTriggerImportUsers');
    const fileInput = container.querySelector('#adminFileInputUsers');

    expect(btnTemplate).not.toBeNull();
    expect(btnImport).not.toBeNull();
    expect(fileInput).not.toBeNull();

    // Clicking trigger triggers click on hidden file input
    const clickSpy = vi.spyOn(fileInput, 'click');
    btnImport.click();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('imports accounts via CSV using single batch sync call without freezing', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    const fileInput = container.querySelector('#adminFileInputUsers');
    const batchSpy = vi.spyOn(cloudSyncManager, 'adminBatchCreateUsers').mockResolvedValue({
      success: true,
      addedCount: 2,
      skippedCount: 0,
      createdUsers: [],
    });

    const csvContent = 'username,password,fullName,className,email\nsv_test_batch1,123456,SV Batch 1,CNTT,sv1@mail.com\nsv_test_batch2,123456,SV Batch 2,CNTT,sv2@mail.com';
    const mockFile = {
      text: async () => csvContent,
      name: 'test.csv',
    };

    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      configurable: true,
    });

    fileInput.dispatchEvent(new window.Event('change'));
    await new Promise(r => setTimeout(r, 80));

    expect(batchSpy).toHaveBeenCalled();
    batchSpy.mockRestore();
  });

  it('renders unified continuous dashboard without tabs, with ping button, maintenance, and gradebook sections removed', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    // 1. Navigation tabs, Ping button, maintenance, and gradebook are removed as requested
    expect(container.querySelector('.admin-nav-tabs')).toBeNull();
    expect(container.querySelector('#btnAdminPingDb')).toBeNull();
    expect(container.querySelector('#tabContentMaintenance')).toBeNull();
    expect(container.querySelector('#tabContentGradebook')).toBeNull();

    // 2. Active students section is rendered and visible
    const studentsSection = container.querySelector('#tabContentStudents');
    expect(studentsSection).not.toBeNull();
    expect(studentsSection.style.display).not.toBe('none');
  });

  it('provides student list export to CSV button', async () => {
    authManager.quickLogin('user_admin');
    await adminView.render();

    const btnExport = container.querySelector('#btnAdminExportUsers');
    expect(btnExport).not.toBeNull();
  });

  it('renders re-auth notification and button when server session expired due to password change', async () => {
    authManager.quickLogin('user_admin');

    // Simulate server connection ok, but users sync returns 401 with needsReauth: true
    vi.spyOn(cloudSyncManager, 'checkConnection').mockResolvedValue(true);
    vi.spyOn(cloudSyncManager, 'getDatabaseStatus').mockResolvedValue({ storageMode: 'postgresql', databaseLabel: 'PostgreSQL Relational DB' });
    vi.spyOn(cloudSyncManager, 'syncUsers').mockResolvedValue({
      success: false,
      error: 'Phiên quản trị viên đã hết hạn hoặc mật khẩu đã đổi (HTTP 401). Vui lòng đăng nhập lại.',
      needsReauth: true,
    });
    vi.spyOn(cloudSyncManager, 'syncQuizLeaderboard').mockResolvedValue({ success: true });
    vi.spyOn(cloudSyncManager, 'syncExams').mockResolvedValue({ success: true, count: 0 });
    vi.spyOn(cloudSyncManager, 'syncExamSubmissions').mockResolvedValue({ success: true, count: 0 });

    const openModalListener = vi.fn();
    window.addEventListener('open-auth-modal', openModalListener);

    await adminView.render();

    const statusWrap = container.querySelector('#adminMetricServerStatusWrap');
    expect(statusWrap.textContent).toContain('Cần đăng nhập lại');

    const btnReLogin = container.querySelector('#btnAdminReLogin');
    expect(btnReLogin).not.toBeNull();

    const bannerBtn = container.querySelector('#btnAdminBannerReLogin');
    expect(bannerBtn).not.toBeNull();

    // Clicking re-login button triggers open-auth-modal event
    btnReLogin.click();
    expect(openModalListener).toHaveBeenCalled();
    expect(openModalListener.mock.calls[0][0].detail).toEqual({ tab: 'login', username: 'admin' });
  });

  it('renders full connection and sync status when all background tasks succeed', async () => {
    authManager.quickLogin('user_admin');

    vi.spyOn(cloudSyncManager, 'checkConnection').mockResolvedValue(true);
    vi.spyOn(cloudSyncManager, 'getDatabaseStatus').mockResolvedValue({ storageMode: 'postgresql', databaseLabel: 'PostgreSQL Relational DB' });
    vi.spyOn(cloudSyncManager, 'syncUsers').mockResolvedValue({ success: true, count: 5 });
    vi.spyOn(cloudSyncManager, 'syncQuizLeaderboard').mockResolvedValue({ success: true });
    vi.spyOn(cloudSyncManager, 'syncExams').mockResolvedValue({ success: true, count: 2 });
    vi.spyOn(cloudSyncManager, 'syncExamSubmissions').mockResolvedValue({ success: true, count: 3 });

    await adminView.render();

    const statusWrap = container.querySelector('#adminMetricServerStatusWrap');
    expect(statusWrap.textContent).toContain('Đã kết nối & Đồng bộ hoàn tất');
    expect(container.querySelector('#btnAdminReLogin')).toBeNull();
    expect(container.querySelector('#adminReauthWarningWrap').textContent.trim()).toBe('');
  });
});
