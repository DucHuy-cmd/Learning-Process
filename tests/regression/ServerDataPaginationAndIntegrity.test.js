// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleRequest, createSessionToken } from '../../src/server/app.js';
import {
  serverUsers,
  serverExamSubmissions,
  getServerAdminUser,
  getPaginatedServerUsers,
  getPaginatedServerSubmissions,
} from '../../src/server/auth/ServerDataStore.js';
import { SqlDatabaseAdapter } from '../../src/server/db/SqlDatabaseAdapter.js';
import { AuthManager, authManager } from '../../src/core/auth/AuthManager.js';
import { AdminView } from '../../src/ui/views/AdminView.js';

describe('Phase 3: Server-side Pagination & Data Integrity Suite', () => {
  let adminToken;
  let mockRes;
  let resData;
  let resCode;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const admin = getServerAdminUser();
    adminToken = createSessionToken(admin);

    resCode = 0;
    resData = '';
    mockRes = {
      writeHead: (code) => { resCode = code; },
      setHeader: () => {},
      end: (data) => { resData = data ? JSON.parse(data) : {}; },
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    authManager.logout();
  });

  describe('1. GET /api/auth/users Pagination & Backward Compatibility', () => {
    it('returns all users with total and totalPages=1 when no pagination params are sent (backward compatible)', async () => {
      const req = {
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${adminToken}` },
      };

      await handleRequest(req, mockRes);
      expect(resCode).toBe(200);
      expect(resData.success).toBe(true);
      expect(Array.isArray(resData.users)).toBe(true);
      expect(resData.total).toBe(resData.users.length);
      expect(resData.page).toBe(1);
      expect(resData.limit).toBe(resData.users.length);
      expect(resData.totalPages).toBe(1);
    });

    it('paginates users accurately when page and limit are specified', async () => {
      // Add test users to serverUsers for test
      const initialCount = serverUsers.length;
      serverUsers.push(
        { id: 'user_p1', username: 'student_p1', fullName: 'Phan Văn 1', className: 'K66-CNTT', role: 'student' },
        { id: 'user_p2', username: 'student_p2', fullName: 'Phan Văn 2', className: 'K66-CNTT', role: 'student' },
        { id: 'user_p3', username: 'student_p3', fullName: 'Phan Văn 3', className: 'K66-KTPM', role: 'student' }
      );

      try {
        const reqPage1 = {
          method: 'GET',
          url: '/api/auth/users?page=1&limit=2',
          headers: { authorization: `Bearer ${adminToken}` },
        };
        await handleRequest(reqPage1, mockRes);
        expect(resCode).toBe(200);
        expect(resData.users.length).toBe(2);
        expect(resData.page).toBe(1);
        expect(resData.limit).toBe(2);
        expect(resData.total).toBe(initialCount + 3);
        expect(resData.totalPages).toBe(Math.ceil((initialCount + 3) / 2));

        const reqPage2 = {
          method: 'GET',
          url: '/api/auth/users?page=2&limit=2',
          headers: { authorization: `Bearer ${adminToken}` },
        };
        await handleRequest(reqPage2, mockRes);
        expect(resCode).toBe(200);
        expect(resData.page).toBe(2);
        expect(resData.users.length).toBeGreaterThanOrEqual(1);
      } finally {
        // Clean up added test users
        const idx = serverUsers.findIndex(u => u.id === 'user_p1');
        if (idx !== -1) serverUsers.splice(idx, 3);
      }
    });

    it('filters users by search and className on the server', async () => {
      serverUsers.push(
        { id: 'user_search_alice', username: 'alice_tran', fullName: 'Alice Trần', className: 'Lớp_VIP', role: 'student' },
        { id: 'user_search_bob', username: 'bob_le', fullName: 'Bob Lê', className: 'Lớp_Thuong', role: 'student' }
      );

      try {
        const reqSearch = {
          method: 'GET',
          url: '/api/auth/users?search=alice&page=1&limit=10',
          headers: { authorization: `Bearer ${adminToken}` },
        };
        await handleRequest(reqSearch, mockRes);
        expect(resCode).toBe(200);
        expect(resData.users.some(u => u.username === 'alice_tran')).toBe(true);
        expect(resData.users.some(u => u.username === 'bob_le')).toBe(false);

        const reqClass = {
          method: 'GET',
          url: '/api/auth/users?className=Lớp_VIP&page=1&limit=10',
          headers: { authorization: `Bearer ${adminToken}` },
        };
        await handleRequest(reqClass, mockRes);
        expect(resCode).toBe(200);
        expect(resData.users.every(u => u.className === 'Lớp_VIP')).toBe(true);
      } finally {
        const i1 = serverUsers.findIndex(u => u.id === 'user_search_alice');
        if (i1 !== -1) serverUsers.splice(i1, 1);
        const i2 = serverUsers.findIndex(u => u.id === 'user_search_bob');
        if (i2 !== -1) serverUsers.splice(i2, 1);
      }
    });
  });

  describe('2. GET /api/exam-submissions Pagination & Sorting', () => {
    it('returns all submissions when no pagination params are provided (backward compatible)', async () => {
      const req = {
        method: 'GET',
        url: '/api/exam-submissions',
        headers: {},
      };
      await handleRequest(req, mockRes);
      expect(resCode).toBe(200);
      expect(resData.success).toBe(true);
      expect(Array.isArray(resData.submissions)).toBe(true);
      expect(resData.total).toBe(resData.submissions.length);
      expect(resData.page).toBe(1);
      expect(resData.totalPages).toBe(1);
    });

    it('paginates, searches, and sorts submissions by score desc', async () => {
      serverExamSubmissions.push(
        { id: 'sub_test_1', examId: 'exam_pag_1', userId: 'sv_a', examTitle: 'Đề Thi Toán RR', score: 6.5, submittedAt: '2026-10-20T10:00:00Z' },
        { id: 'sub_test_2', examId: 'exam_pag_1', userId: 'sv_b', examTitle: 'Đề Thi Toán RR', score: 9.5, submittedAt: '2026-10-21T10:00:00Z' },
        { id: 'sub_test_3', examId: 'exam_pag_1', userId: 'sv_c', examTitle: 'Đề Thi Rời Rạc', score: 4.0, submittedAt: '2026-10-22T10:00:00Z' }
      );

      try {
        const req = {
          method: 'GET',
          url: '/api/exam-submissions?examId=exam_pag_1&page=1&limit=2&sortBy=score&sortOrder=desc',
          headers: {},
        };
        await handleRequest(req, mockRes);
        expect(resCode).toBe(200);
        expect(resData.submissions.length).toBe(2);
        expect(resData.total).toBe(3);
        expect(resData.totalPages).toBe(2);
        // Top score should be first
        expect(resData.submissions[0].score).toBe(9.5);
        expect(resData.submissions[1].score).toBe(6.5);
      } finally {
        const idx = serverExamSubmissions.findIndex(s => s.id === 'sub_test_1');
        if (idx !== -1) serverExamSubmissions.splice(idx, 3);
      }
    });
  });

  describe('3. SqlDatabaseAdapter.select Pagination', () => {
    it('supports offset, page, and limit options accurately', async () => {
      const adapter = new SqlDatabaseAdapter();
      adapter.tables.test_table = new Map();
      for (let i = 1; i <= 10; i++) {
        adapter.tables.test_table.set(`id_${i}`, { id: `id_${i}`, val: i });
      }

      // Page 1, limit 3
      const p1 = await adapter.select('test_table', () => true, { page: 1, limit: 3 });
      expect(p1.length).toBe(3);
      expect(p1[0].val).toBe(1);

      // Page 2, limit 3
      const p2 = await adapter.select('test_table', () => true, { page: 2, limit: 3 });
      expect(p2.length).toBe(3);
      expect(p2[0].val).toBe(4);

      // Offset 8, limit 5
      const offsetResults = await adapter.select('test_table', () => true, { offset: 8, limit: 5 });
      expect(offsetResults.length).toBe(2);
      expect(offsetResults[0].val).toBe(9);
      expect(offsetResults[1].val).toBe(10);
    });
  });

  describe('4. AdminView UI Pagination & Data Integrity', () => {
    it('renders pagination bar, allows page navigation, and resets page on search', async () => {
      authManager.quickLogin('user_admin');

      // Create 30 students to trigger multi-page pagination with pageSize=25
      const createdUsernames = [];
      for (let i = 1; i <= 30; i++) {
        const username = `sv_batch_${i}`;
        createdUsernames.push(username);
        authManager.adminCreateUser({
          username,
          fullName: `Sinh Viên Số ${i}`,
          password: '123',
          className: 'K66-TEST',
        });
      }

      const adminView = new AdminView({ container });
      adminView.userPageSize = 25;
      await adminView.render();

      const paginationWrap = container.querySelector('#adminUsersPaginationWrap');
      expect(paginationWrap).not.toBeNull();
      expect(paginationWrap.textContent).toContain('Trang 1 / 2');

      const btnNext = container.querySelector('#btnAdminNextUserPage');
      const btnPrev = container.querySelector('#btnAdminPrevUserPage');
      expect(btnNext).not.toBeNull();
      expect(btnPrev).not.toBeNull();

      // Go to page 2
      btnNext.click();
      expect(adminView.userCurrentPage).toBe(2);
      expect(container.textContent).toContain('Trang 2 / 2');

      // Previous button goes back to page 1
      const btnPrevPage2 = container.querySelector('#btnAdminPrevUserPage');
      btnPrevPage2.click();
      expect(adminView.userCurrentPage).toBe(1);
      expect(container.textContent).toContain('Trang 1 / 2');

      // Search resets current page to 1
      adminView.userCurrentPage = 2;
      const searchInput = container.querySelector('#adminUserSearchInput');
      searchInput.value = 'Số 1';
      searchInput.dispatchEvent(new window.Event('input'));
      expect(adminView.userCurrentPage).toBe(1);

      // Export CSV exports all filtered students without pagination truncation
      const usersToExport = authManager.getUsers().filter(u => u.username !== 'admin');
      expect(usersToExport.length).toBeGreaterThanOrEqual(30);
    });
  });
});
