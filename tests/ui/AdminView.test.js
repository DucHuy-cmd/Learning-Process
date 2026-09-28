/**
 * @file AdminView.test.js
 * Unit Test Suite for AdminView (Dedicated Admin Database & Student Management)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { AdminView } from '../../src/ui/views/AdminView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { quizHistoryManager } from '../../src/core/quiz/QuizHistoryManager.js';

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
    expect(container.textContent).toContain('Bảng Xếp Hạng');
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

  it('resets leaderboard scores when clicking Reset Bảng Xếp Hạng button', async () => {
    authManager.quickLogin('user_admin');
    quizHistoryManager.clearLeaderboard();

    await adminView.render();

    window.confirm = () => true;
    const btnReset = container.querySelector('#btnAdminResetLeaderboard');
    expect(btnReset).not.toBeNull();

    btnReset.click();
    await new Promise(r => setTimeout(r, 60));

    expect(container.textContent).toContain('Bảng xếp hạng trắc nghiệm đã được reset sạch sẽ');
  });
});
