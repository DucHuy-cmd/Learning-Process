// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthManager, authManager, ADMIN_GLOBAL_LOGOUT_BEFORE, STORAGE_KEY_CURRENT } from '../../src/core/auth/AuthManager.js';
import { CloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';
import { AdminView } from '../../src/ui/views/AdminView.js';
import { QuizView } from '../../src/ui/views/QuizView.js';
import {
  handleRequest,
  createSessionToken,
  getRequestAuth,
} from '../../src/server/app.js';
import {
  invalidateAllAdminSessions,
  getAdminTokenVersion,
  resetAdminSessionState,
  getServerAdminUser,
} from '../../src/server/auth/ServerDataStore.js';

describe('Admin Session Revocation, Print Polish, and Answer Key Modal Flow', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    authManager.logout();
  });

  describe('1. Auto Answer Key modal & CSV export suppression on Assign', () => {
    it('does not open Answer Key modal or trigger automatic CSV download when clicking "Phát Đề Cho Sinh Viên"', () => {
      authManager.quickLogin('user_admin');

      const quizView = new QuizView({ container });
      quizView.setTab('studio');
      quizView.studioSubTab = 'publish';

      // Mock questions in distribute
      quizView.importedQuestions = [
        {
          id: 'q_polish_1',
          question: 'Ma trận kề có đối xứng không?',
          options: [{ id: 'A', text: 'Có' }, { id: 'B', text: 'Không' }],
          correctId: 'A',
          explanation: 'Đồ thị vô hướng ma trận kề luôn đối xứng.',
        },
      ];
      quizView._saveWordQuestions(quizView.importedQuestions);
      quizView.render();

      const btnAssign = container.querySelector('#btnCreateAndAssignExam');
      expect(btnAssign).not.toBeNull();
      expect(btnAssign.textContent).toContain('Phát Đề Cho Sinh Viên');
      expect(btnAssign.textContent).not.toContain('Xuất File Đáp Án');

      const exportSpy = vi.spyOn(quizView, '_exportAdminAnswerKeyToCsv');
      const alertSpy = vi.spyOn(quizView, '_showAlert').mockImplementation(() => {});

      btnAssign.click();

      // Modal is NOT open
      expect(quizView.adminAnswerKeyExamId).toBeNull();
      expect(container.querySelector('.gradebook-modal-card')).toBeNull();

      // Automatic CSV export was NOT invoked
      expect(exportSpy).not.toHaveBeenCalled();

      // Alert confirmed success and directed teacher to "File Đáp Án" button
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Phát đề thi thành công!'));
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Bạn có thể bấm nút "🔑 File Đáp Án" trong bảng bất kỳ lúc nào'));
    });
  });

  describe('2. Studio subtab buttons on Print view', () => {
    it('has .studio-subtabs-nav and .no-print classes to ensure it is hidden during @media print', () => {
      authManager.quickLogin('user_admin');

      const quizView = new QuizView({ container });
      quizView.setTab('studio');
      quizView.studioSubTab = 'print';
      quizView.render();

      const subtabsNav = container.querySelector('.studio-subtabs-nav');
      expect(subtabsNav).not.toBeNull();
      expect(subtabsNav.classList.contains('no-print')).toBe(true);

      // Verify the 3 subtab buttons are inside this container
      expect(subtabsNav.textContent).toContain('1. Nạp File Word Đề Thi');
      expect(subtabsNav.textContent).toContain('2. Phân Phối & Phát Đề Thi');
      expect(subtabsNav.textContent).toContain('3. Soạn Đề In Ấn Chuẩn A4');
    });
  });

  describe('3. AdminView: Hiding the 2 metric cards & Unifying 4 Cards in Balanced Grid', () => {
    it('does not render "Chuẩn CSDL Quan Hệ" or "Quản Trị Hệ Thống", and unifies Backup/Restore into a balanced 4-card grid', async () => {
      authManager.quickLogin('user_admin');

      const adminView = new AdminView({ container });
      await adminView.render();

      const grid = container.querySelector('.admin-stats-grid');
      expect(grid).not.toBeNull();

      // Card 1: Users is kept
      expect(grid.textContent).toContain('Tổng Sinh Viên');
      // Card 2: Server status is kept
      expect(grid.textContent).toContain('Trạng Thái Máy Chủ');
      // Card 3: Backup
      expect(grid.textContent).toContain('Sao Lưu CSDL');
      expect(grid.querySelector('#btnAdminBackupDb')).not.toBeNull();
      // Card 4: Restore
      expect(grid.textContent).toContain('Phục Hồi Dữ Liệu');
      expect(grid.querySelector('#btnAdminTriggerRestoreDb')).not.toBeNull();
      expect(grid.querySelector('#adminFileInputRestoreDb')).not.toBeNull();

      // The 2 hidden cards must NOT be in the DOM
      expect(grid.textContent).not.toContain('Chuẩn CSDL Quan Hệ');
      expect(grid.textContent).not.toContain('PostgreSQL 3NF');
      expect(grid.textContent).not.toContain('Quản Trị Hệ Thống');
      expect(grid.textContent).not.toContain('@admin');
    });
  });

  describe('4. Global Admin Session Revocation Across Devices', () => {
    afterEach(() => {
      resetAdminSessionState();
    });

    it('rejects old admin session tokens with 401 SESSION_REVOKED after invalidateAllAdminSessions()', async () => {
      resetAdminSessionState();
      const adminUser = getServerAdminUser();

      // Generate token on device 1 before revocation
      const oldToken = createSessionToken(adminUser);
      const reqBefore = {
        headers: { authorization: `Bearer ${oldToken}` },
      };
      const authBefore = getRequestAuth(reqBefore);
      expect(authBefore.authenticated).toBe(true);
      expect(authBefore.isAdmin).toBe(true);

      // Revoke all admin sessions globally
      invalidateAllAdminSessions();
      expect(getAdminTokenVersion()).toBeGreaterThanOrEqual(100);

      // Device 1 with old token is now REVOKED
      const reqAfter = {
        headers: { authorization: `Bearer ${oldToken}` },
      };
      const authAfter = getRequestAuth(reqAfter);
      expect(authAfter.authenticated).toBe(false);
      expect(authAfter.isAdmin).toBe(false);
      expect(authAfter.revoked).toBe(true);

      // Verify server /api/auth/verify rejects old token
      let statusCode = 0;
      let responseBody = '';
      const mockRes = {
        writeHead: (code) => { statusCode = code; },
        setHeader: () => {},
        end: (data) => { responseBody = data; },
      };
      await handleRequest({
        method: 'GET',
        url: '/api/auth/verify?userId=user_admin&username=admin',
        headers: { authorization: `Bearer ${oldToken}` },
      }, mockRes);

      expect(statusCode).toBe(401);
      const parsedRes = JSON.parse(responseBody);
      expect(parsedRes.valid).toBe(false);
      expect(parsedRes.error).toBe('SESSION_REVOKED');
    });

    it('purges stale admin session from localStorage if created before ADMIN_GLOBAL_LOGOUT_BEFORE', () => {
      const mockStorage = {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; },
      };

      // Stale admin session stored on a phone or laptop with no loggedInAt or old timestamp
      mockStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({
        id: 'user_admin',
        username: 'admin',
        role: 'admin',
        loggedInAt: ADMIN_GLOBAL_LOGOUT_BEFORE - 100000,
      }));
      mockStorage.setItem('trr_auth_token', 'stale_token_abc');

      // Initialize auth manager with the mock storage (simulating device startup)
      const auth = new AuthManager({ storage: mockStorage });

      // Must be immediately purged to guest
      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.getCurrentUser()).toBeNull();
      expect(mockStorage.getItem(STORAGE_KEY_CURRENT)).toBeNull();
      expect(mockStorage.getItem('trr_auth_token')).toBeNull();
    });

    it('CloudSyncManager.verifyCurrentUser logs out admin and clears token when server returns 401', async () => {
      const auth = new AuthManager();
      auth.login('admin', '2HV0789@@');
      expect(auth.isAdmin()).toBe(true);

      const sync = new CloudSyncManager();
      sync.setAuthToken('old_revoked_admin_token');

      // Mock server returning 401 SESSION_REVOKED
      vi.spyOn(sync, 'fetchWithTimeout').mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ valid: false, error: 'SESSION_REVOKED' }),
      });

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const result = await sync.verifyCurrentUser(auth);
      expect(result).toBe(false);
      expect(auth.isLoggedIn()).toBe(false);
      expect(sync.getAuthToken()).toBe('');
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Toàn bộ phiên đăng nhập Quản trị viên đã được đăng xuất'));
    });
  });

  describe('5. AdminView: Collapsible Add User Form Accordion', () => {
    it('allows collapsing and expanding the student creation form body', async () => {
      authManager.quickLogin('user_admin');

      const adminView = new AdminView({ container });
      await adminView.render();

      const toggleBtn = container.querySelector('#btnAdminToggleAddUserForm');
      const formBody = container.querySelector('#adminAddUserFormBody');
      const iconToggle = container.querySelector('#iconAdminToggleAddUserForm');
      const lblToggle = container.querySelector('#lblAdminToggleAddUserForm');

      expect(toggleBtn).not.toBeNull();
      expect(formBody).not.toBeNull();
      expect(iconToggle).not.toBeNull();
      expect(lblToggle).not.toBeNull();

      // Initially open
      expect(adminView.isAddUserFormCollapsed).toBe(false);
      expect(formBody.style.display).toBe('block');
      expect(lblToggle.textContent).toBe('Thu Gọn');
      expect(iconToggle.textContent).toBe('🔼');

      // Click to collapse
      toggleBtn.click();
      expect(adminView.isAddUserFormCollapsed).toBe(true);
      expect(formBody.style.display).toBe('none');
      expect(lblToggle.textContent).toBe('Hiện Form');
      expect(iconToggle.textContent).toBe('🔽');

      // Click to expand again
      toggleBtn.click();
      expect(adminView.isAddUserFormCollapsed).toBe(false);
      expect(formBody.style.display).toBe('block');
      expect(lblToggle.textContent).toBe('Thu Gọn');
      expect(iconToggle.textContent).toBe('🔼');
    });
  });
});
