/**
 * @file AdminView.js
 * Dedicated Central Administration View for Database & Student Management.
 * 
 * Features:
 * - Restricted to single Administrator account (authManager.isAdmin()).
 * - Overview statistics: Registered accounts, Leaderboard records, Cloud Sync status.
 * - Create new student accounts with direct client + server synchronization.
 * - Manage user accounts database: Search, inspect, and delete obsolete/test accounts.
 * - Leaderboard management: Inspect current rankings, delete individual scores, or reset entire leaderboard.
 * - Manual trigger for full multi-device database synchronization.
 */

import { authManager } from '../../core/auth/AuthManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';
import { quizHistoryManager } from '../../core/quiz/QuizHistoryManager.js';
import { aiHistoryManager } from '../../core/ai/AiHistoryManager.js';
import { examManager } from '../../core/quiz/ExamManager.js';

export class AdminView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onNavigate]
   */
  constructor({ container = null, onNavigate = null } = {}) {
    this.container = container;
    this.onNavigate = onNavigate || (() => {});
    this.searchQuery = '';
    this.isServerConnected = false;
    this.isSyncing = false;
    this._syncCounter = 0;
    this._activeSyncId = 0;
    this.activeTab = 'students';
    this.dbStatus = { storageMode: 'unknown', databaseLabel: 'Đang kiểm tra...', kvConfigured: false };
    this.syncTasks = {
      dbStatus: { status: 'idle', label: 'Cơ sở dữ liệu', error: null },
      users: { status: 'idle', label: 'Tài khoản', count: 0, error: null },
      leaderboard: { status: 'idle', label: 'Bảng điểm & Thống kê', error: null },
      exams: { status: 'idle', label: 'Đề thi đã giao', count: 0, error: null },
      submissions: { status: 'idle', label: 'Bài nộp', count: 0, error: null },
    };

    authManager.onAuthStateChanged(() => {
      if (this.container && this.container.classList.contains('active')) {
        this.render();
      }
    });

    if (this.container && this.container.classList.contains('active')) {
      this.render();
    }
  }

  /**
   * Mounts and renders the Admin Management dashboard.
   * Renders layout shell immediately with local data, then fetches background data in parallel.
   * @param {HTMLElement} [targetContainer]
   */
  async render(targetContainer = null) {
    if (targetContainer) {
      this.container = targetContainer;
    }
    if (!this.container) return;

    // RBAC Security Guard: Non-admin users are strictly blocked
    if (!authManager.isAdmin()) {
      this._renderAccessDenied();
      return;
    }

    // 1. Render layout shell with local data immediately (0ms delay)
    this._renderDashboardLayout();

    // 2. Fetch and sync latest cloud data in background (parallelized, race-condition protected)
    return this._triggerBackgroundSync();
  }

  /**
   * Synchronously renders the complete Admin Dashboard layout.
   * @private
   */
  _renderDashboardLayout() {
    const allUsers = authManager.getUsers();
    const studentCount = allUsers.filter(u => u.username !== 'admin' && u.id !== 'user_admin').length;

    this.container.innerHTML = `
      <div class="admin-dashboard-wrap" style="max-width:1200px;margin:0 auto;padding:24px 20px;font-family:inherit;">
        <!-- Header Banner -->
        <header class="admin-header-banner" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 4px 16px rgba(0,0,0,0.15);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:26px;">🗄️</span>
              <h2 style="margin:0;font-size:22px;color:var(--text);font-weight:800;letter-spacing:-0.3px;">Quản Trị Cơ Sở Dữ Liệu &amp; Sinh Viên</h2>
              <span style="font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,0.18);color:#f59e0b;border:1px solid rgba(245,158,11,0.35);">
                👑 Administrator
              </span>
            </div>
            <p style="margin:0;font-size:13px;color:var(--dim);line-height:1.5;">
              Bảng điều khiển quản lý tập trung tài khoản sinh viên, đồng bộ máy chủ và dữ liệu thi cử.
            </p>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" id="btnAdminManualSync" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;">
              <span>🔄</span>
              <span>Đồng bộ Máy chủ</span>
            </button>
            <button type="button" class="btn-danger" id="btnAdminFullDatabaseReset" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:#dc2626;color:#fff;border:none;">
              <span>🔥</span>
              <span>Xóa Sạch &amp; Reset Database</span>
            </button>
          </div>
        </header>

        <!-- Notification Banner -->
        <div id="adminActionAlert" class="auth-alert" style="display:none;margin-bottom:20px;padding:12px 16px;border-radius:8px;font-size:13px;line-height:1.5;"></div>

        <!-- Metric Stat Cards -->
        <div class="admin-stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px;">
          <!-- Card 1: Users -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Tổng Sinh Viên</span>
              <span style="font-size:20px;">👥</span>
            </div>
            <div id="adminMetricStudentCount" style="font-size:26px;font-weight:800;color:var(--text);">${studentCount}</div>
          </div>

          <!-- Card 2: Server Status -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Trạng Thái Máy Chủ</span>
              <span style="font-size:20px;">🌐</span>
            </div>
            <div id="adminMetricServerStatusWrap">
              <div style="font-size:16px;font-weight:800;color:${this.isSyncing ? '#3b82f6' : (this.isServerConnected ? '#10b981' : '#f59e0b')};display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span>${this.isSyncing ? '🔄 Đang đồng bộ máy chủ...' : (this.isServerConnected ? '● Đã kết nối' : '○ Chế độ Ngoại tuyến')}</span>
                ${!this.isServerConnected && !this.isSyncing ? `<button type="button" id="btnAdminRetrySync" style="font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);margin-left:6px;">🔄 Thử lại</button>` : ''}
              </div>
              <div style="font-size:11.5px;font-weight:700;color:#10b981;">
                🏛️ ${this.dbStatus.databaseLabel || 'PostgreSQL Relational DB (SQL)'}
              </div>
            </div>
          </div>

          <!-- Card 4: SQL Engine & Schema Normalization -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Chuẩn CSDL Quan Hệ</span>
              <span style="font-size:20px;">⚡</span>
            </div>
            <div style="font-size:16px;font-weight:800;color:#3b82f6;">PostgreSQL 3NF</div>
            <div style="font-size:11px;color:var(--dim);margin-top:4px;">
              Ràng buộc khóa ngoại &amp; CASCADE
            </div>
          </div>

          <!-- Card 3: System Admin -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Quản Trị Hệ Thống</span>
              <span style="font-size:20px;">👑</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:#f59e0b;">@admin</div>
          </div>
        </div>

        <!-- Tab Content 1: Students -->
        <div id="tabContentStudents">
        <!-- Add Student Form Section (Collapsible/Accordion) -->
        <section class="admin-create-user-section" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            <h3 style="margin:0;font-size:15px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
              <span>➕</span>
              <span>Cấp Tài Khoản Sinh Viên Mới</span>
            </h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" id="btnAdminDownloadUserTemplate" class="btn-sm" style="padding:6px 12px;font-size:12px;font-weight:600;background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--text);">
                <span>📄</span> Tải File Mẫu (.csv)
              </button>
              <button type="button" id="btnAdminTriggerImportUsers" class="btn-sm" style="padding:6px 12px;font-size:12px;font-weight:600;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);color:var(--accent);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                <span>📂</span> Nhập Tài Khoản Từ File
              </button>
              <input type="file" id="adminFileInputUsers" accept=".csv,.txt" style="display:none;" />
            </div>
          </div>
          <div style="font-size:12px;color:var(--dim);margin-bottom:12px;background:var(--panel-alt);padding:8px 12px;border-radius:6px;border:1px dashed var(--line);">
            💡 <strong>Quy định nhập file:</strong> File định dạng <code>.csv</code> hoặc <code>.txt</code> với các cột: <code>username,password,fullName,className,email</code>. Mật khẩu nếu bỏ trống sẽ mặc định là <code>123456</code>.
          </div>

          <form id="adminViewAddUserForm" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-top:12px;">
            <div>
              <label for="adminInpUsername" style="display:block;font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Tên đăng nhập *</label>
              <input type="text" id="adminInpUsername" placeholder="Ví dụ: sv01, hoangnam..." required autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>

            <div>
              <label for="adminInpPassword" style="display:block;font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Mật khẩu *</label>
              <input type="password" id="adminInpPassword" placeholder="Nhập mật khẩu..." required autocomplete="new-password" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellcheck="false" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>

            <div>
              <label for="adminInpFullName" style="display:block;font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Họ và tên sinh viên *</label>
              <input type="text" id="adminInpFullName" placeholder="Ví dụ: Trần Văn Nam" required autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>

            <div>
              <label for="adminInpClass" style="display:block;font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Lớp / Đơn vị</label>
              <input type="text" id="adminInpClass" placeholder="Sinh viên" value="Sinh viên" autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>

            <div>
              <label for="adminInpEmail" style="display:block;font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Email (Tùy chọn)</label>
              <input type="email" id="adminInpEmail" placeholder="sinhvien@toanrr.edu.vn" autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>

            <div style="display:flex;align-items:flex-end;">
              <button type="submit" class="btn-primary" style="width:100%;padding:9px 16px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;">
                ✓ Cấp tài khoản
              </button>
            </div>
          </form>
        </section>

        <!-- Data Skew Warning Banner -->
        <div id="adminDataSkewWarningWrap">
          ${this._renderDataSkewWarning()}
        </div>

        <!-- User Accounts Table Section -->
        <section class="admin-users-table-section" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div>
              <h3 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
                <span>📋</span>
                <span id="adminUsersTableTitle">${this._getUsersTableTitleText(allUsers)}</span>
              </h3>
              <p style="margin:0;font-size:12px;color:var(--dim);">
                Quản trị viên có toàn quyền kiểm tra, xem thông tin và xóa bỏ các tài khoản kiểm thử hoặc sinh viên không hợp lệ.
              </p>
            </div>

            <!-- Search and export -->
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <div id="adminSearchInputWrap" style="position:relative;display:inline-flex;align-items:center;">
                <input type="text" id="adminUserSearchInput" value="${this._escapeHtml(this.searchQuery)}" placeholder="🔍 Tìm theo tên, username, lớp..." style="box-sizing:border-box;padding:7px 30px 7px 12px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);min-width:240px;">
                ${this.searchQuery ? `
                  <button type="button" id="btnAdminClearSearch" title="Xóa bộ lọc tìm kiếm" style="position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--dim);font-size:13px;padding:2px 4px;font-weight:bold;line-height:1;">✕</button>
                ` : ''}
              </div>
              <button type="button" id="btnAdminExportUsers" class="btn-sm" style="padding:7px 14px;font-size:12px;font-weight:600;background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--text);">
                <span>📥</span> Xuất Danh Sách (.csv)
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="admin-table-scroll-wrap" style="overflow-x:auto;border:1px solid var(--line);border-radius:8px;">
            <table class="admin-users-table" style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
              <thead class="admin-users-thead" style="background:var(--panel-alt);border-bottom:1px solid var(--line);">
                <tr>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Thành viên</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Username</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Vai trò</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Lớp / Email</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;text-align:center;">Hành động</th>
                </tr>
              </thead>
              <tbody id="adminUsersTbody" class="admin-users-tbody">
                ${this._renderUserTableRows(allUsers)}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Returns users matching current searchQuery.
   * @param {Array<Object>} users
   * @returns {Array<Object>}
   * @private
   */
  _getFilteredUsers(users) {
    if (!Array.isArray(users)) return [];
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.className || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  /**
   * Generates title text with clear count feedback (total and filtered).
   * @param {Array<Object>} allUsers
   * @returns {string}
   * @private
   */
  _getUsersTableTitleText(allUsers) {
    const totalCount = Array.isArray(allUsers) ? allUsers.length : 0;
    const q = (this.searchQuery || '').trim();
    if (q) {
      const filtered = this._getFilteredUsers(allUsers);
      return `Danh Sách Cơ Sở Dữ Liệu Tài Khoản (${filtered.length} / ${totalCount} tài khoản)`;
    }
    return `Danh Sách Cơ Sở Dữ Liệu Tài Khoản (${totalCount})`;
  }

  /**
   * Renders warning banner when server accounts skew or mismatch local accounts (e.g. server only returns admin while local has students).
   * @returns {string}
   * @private
   */
  _renderDataSkewWarning() {
    const skew = cloudSyncManager?.dataSkewInfo;
    if (!skew) return '';

    return `
      <div class="admin-data-skew-banner" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;">
        <span style="font-size:24px;line-height:1;">⚠️</span>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:#d97706;margin-bottom:4px;">
            Phát hiện chênh lệch dữ liệu giữa Máy chủ và Trình duyệt
          </div>
          <div style="font-size:12.5px;color:var(--text);line-height:1.5;">
            Trình duyệt đang lưu an toàn <strong>${skew.localStudentCount || 0} tài khoản sinh viên</strong>, trong khi kết nối máy chủ trả về <strong>${skew.serverUserCount || 0} tài khoản</strong>.
            Hệ thống đã <strong>tự động bảo toàn dữ liệu sinh viên tại máy cục bộ</strong> và ngăn chặn việc bị ghi đè dữ liệu.
          </div>
          <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
            <button type="button" id="btnAdminDismissSkewWarning" class="btn-sm" style="padding:4px 10px;font-size:11.5px;border-radius:4px;background:var(--panel);border:1px solid var(--line);cursor:pointer;color:var(--text);">
              Đã hiểu &amp; Đóng thông báo
            </button>
            <button type="button" id="btnAdminRecheckSync" class="btn-sm" style="padding:4px 10px;font-size:11.5px;border-radius:4px;background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.5);cursor:pointer;color:#d97706;font-weight:600;">
              🔄 Kiểm tra lại đồng bộ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Triggers parallel background sync with race condition protection,
   * guaranteed finally cleanup, individual task tracking, and data skew protection.
   * @private
   */
  async _triggerBackgroundSync() {
    if (this.isSyncing) return;
    const currentSyncId = ++this._syncCounter;
    this._activeSyncId = currentSyncId;
    this.isSyncing = true;

    // Reset task statuses
    this.syncTasks.dbStatus = { status: 'loading', label: 'Cơ sở dữ liệu', error: null };
    this.syncTasks.users = { status: 'loading', label: 'Tài khoản', count: 0, error: null };
    this.syncTasks.leaderboard = { status: 'loading', label: 'Bảng điểm & Thống kê', error: null };
    this.syncTasks.exams = { status: 'loading', label: 'Đề thi đã giao', count: 0, error: null };
    this.syncTasks.submissions = { status: 'loading', label: 'Bài nộp', count: 0, error: null };

    this._updateSyncIndicatorUI(true);

    try {
      this.isServerConnected = await cloudSyncManager.checkConnection();
      if (currentSyncId !== this._activeSyncId) return;

      if (this.isServerConnected) {
        // Run independent read-only syncs concurrently with isolated error handling
        const [statusRes, usersRes, lbRes, examsRes, subsRes] = await Promise.allSettled([
          cloudSyncManager.getDatabaseStatus(),
          cloudSyncManager.syncUsers(authManager),
          cloudSyncManager.syncQuizLeaderboard(quizHistoryManager),
          cloudSyncManager.syncExams(examManager),
          cloudSyncManager.syncExamSubmissions(examManager),
        ]);

        if (currentSyncId !== this._activeSyncId) return;

        // DB Status
        if (statusRes.status === 'fulfilled' && statusRes.value) {
          this.dbStatus = statusRes.value;
          this.syncTasks.dbStatus = { status: 'success', label: 'Cơ sở dữ liệu', error: null };
        } else {
          this.syncTasks.dbStatus = { status: 'error', label: 'Cơ sở dữ liệu', error: statusRes.reason?.message || 'Lỗi kết nối' };
        }

        // Users
        if (usersRes.status === 'fulfilled' && usersRes.value && usersRes.value.success) {
          this.syncTasks.users = { status: 'success', label: 'Tài khoản', count: usersRes.value.count || authManager.getUsers().length, error: null };
        } else {
          this.syncTasks.users = { status: 'error', label: 'Tài khoản', count: authManager.getUsers().length, error: usersRes.reason?.message || usersRes.value?.error || 'Lỗi tải tài khoản' };
        }

        // Leaderboard
        if (lbRes.status === 'fulfilled' && lbRes.value && lbRes.value.success) {
          this.syncTasks.leaderboard = { status: 'success', label: 'Bảng điểm & Thống kê', error: null };
        } else {
          this.syncTasks.leaderboard = { status: 'error', label: 'Bảng điểm & Thống kê', error: lbRes.reason?.message || lbRes.value?.error || 'Lỗi đồng bộ điểm' };
        }

        // Exams
        if (examsRes.status === 'fulfilled' && examsRes.value && examsRes.value.success) {
          this.syncTasks.exams = { status: 'success', label: 'Đề thi đã giao', count: examsRes.value.count || 0, error: null };
        } else {
          this.syncTasks.exams = { status: 'error', label: 'Đề thi đã giao', count: 0, error: examsRes.reason?.message || examsRes.value?.error || 'Lỗi đồng bộ đề thi' };
        }

        // Submissions
        if (subsRes.status === 'fulfilled' && subsRes.value && subsRes.value.success) {
          this.syncTasks.submissions = { status: 'success', label: 'Bài nộp', count: subsRes.value.count || 0, error: null };
        } else {
          this.syncTasks.submissions = { status: 'error', label: 'Bài nộp', count: 0, error: subsRes.reason?.message || subsRes.value?.error || 'Lỗi đồng bộ bài nộp' };
        }
      } else {
        this.dbStatus = { storageMode: 'offline', databaseLabel: 'Chế độ Ngoại tuyến', kvConfigured: false };
        Object.keys(this.syncTasks).forEach(k => {
          this.syncTasks[k].status = 'offline';
        });
      }
    } catch {
      this.isServerConnected = false;
      this.dbStatus = { storageMode: 'offline', databaseLabel: 'Chế độ Ngoại tuyến', kvConfigured: false };
      Object.keys(this.syncTasks).forEach(k => {
        this.syncTasks[k].status = 'error';
      });
    } finally {
      // Guaranteed cleanup: isSyncing is ALWAYS reset so UI never freezes
      this.isSyncing = false;
      if (currentSyncId === this._activeSyncId) {
        this._updateDashboardDataInPlace();
      }
    }
  }

  /**
   * Updates sync status badge while syncing is in progress or completed.
   * @param {boolean} isSyncing
   * @private
   */
  _updateSyncIndicatorUI(isSyncing) {
    if (!this.container) return;
    const wrap = this.container.querySelector('#adminMetricServerStatusWrap');
    if (!wrap) return;

    let statusText = '';
    let statusColor = '#10b981';
    let showRetry = false;

    if (isSyncing) {
      statusText = '🔄 Đang đồng bộ máy chủ...';
      statusColor = '#3b82f6';
    } else if (this.isServerConnected) {
      const failedTasks = Object.values(this.syncTasks).filter(t => t.status === 'error');
      if (failedTasks.length > 0) {
        statusText = `⚠️ Kết nối một phần (${failedTasks.length} tác vụ lỗi)`;
        statusColor = '#f59e0b';
        showRetry = true;
      } else {
        statusText = '● Đã kết nối & Đồng bộ hoàn tất';
        statusColor = '#10b981';
      }
    } else {
      statusText = '○ Chế độ Ngoại tuyến';
      statusColor = '#f59e0b';
      showRetry = true;
    }

    wrap.innerHTML = `
      <div style="font-size:16px;font-weight:800;color:${statusColor};display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
        <span>${statusText}</span>
        ${showRetry ? `<button type="button" id="btnAdminRetrySync" style="font-size:11px;padding:2px 8px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);margin-left:6px;">🔄 Thử lại</button>` : ''}
      </div>
      <div style="font-size:11.5px;font-weight:700;color:#10b981;">
        🏛️ ${this.dbStatus.databaseLabel || 'PostgreSQL Relational DB (SQL)'}
      </div>
    `;

    const retryBtn = wrap.querySelector('#btnAdminRetrySync');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._triggerBackgroundSync();
      });
    }
  }

  /**
   * Updates dynamic parts of the dashboard in-place without tearing down DOM or inputs.
   * @private
   */
  _updateDashboardDataInPlace() {
    if (!this.container) return;
    const allUsers = authManager.getUsers();
    const studentCount = allUsers.filter(u => u.username !== 'admin' && u.id !== 'user_admin').length;

    // 1. Update Student Count
    const countEl = this.container.querySelector('#adminMetricStudentCount');
    if (countEl) countEl.textContent = String(studentCount);

    // 2. Update Server Status Badge
    this._updateSyncIndicatorUI(false);

    // 3. Update Data Skew Warning if any
    const skewWrap = this.container.querySelector('#adminDataSkewWarningWrap');
    if (skewWrap) {
      skewWrap.innerHTML = this._renderDataSkewWarning();
      this._bindSkewWarningEvents();
    }

    // 4. Update Table Rows and Title with count feedback
    this._updateUserTableAndTitle();
  }

  /**
   * Updates users table, title, and clear button without losing search input focus.
   * @private
   */
  _updateUserTableAndTitle() {
    if (!this.container) return;
    const allUsers = authManager.getUsers();

    // 1. Update Title with count feedback
    const titleEl = this.container.querySelector('#adminUsersTableTitle');
    if (titleEl) {
      titleEl.textContent = this._getUsersTableTitleText(allUsers);
    }

    // 2. Update Search Clear Button visibility
    const searchWrap = this.container.querySelector('#adminSearchInputWrap');
    let clearBtn = this.container.querySelector('#btnAdminClearSearch');
    if (this.searchQuery) {
      if (!clearBtn && searchWrap) {
        clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.id = 'btnAdminClearSearch';
        clearBtn.title = 'Xóa bộ lọc tìm kiếm';
        clearBtn.textContent = '✕';
        clearBtn.setAttribute('style', 'position:absolute;right:8px;background:none;border:none;cursor:pointer;color:var(--dim);font-size:13px;padding:2px 4px;font-weight:bold;line-height:1;');
        searchWrap.appendChild(clearBtn);
        clearBtn.addEventListener('click', () => {
          const searchInput = this.container.querySelector('#adminUserSearchInput');
          if (searchInput) searchInput.value = '';
          this.searchQuery = '';
          this._updateUserTableAndTitle();
          if (searchInput) searchInput.focus();
        });
      }
    } else {
      if (clearBtn) clearBtn.remove();
    }

    // 3. Render Table rows
    const tbody = this.container.querySelector('#adminUsersTbody');
    if (tbody) {
      tbody.innerHTML = this._renderUserTableRows(allUsers);
      this._bindTableActionButtons();

      const btnClearEmpty = this.container.querySelector('#btnAdminClearEmptySearch');
      if (btnClearEmpty) {
        btnClearEmpty.addEventListener('click', () => {
          const searchInput = this.container.querySelector('#adminUserSearchInput');
          if (searchInput) searchInput.value = '';
          this.searchQuery = '';
          this._updateUserTableAndTitle();
          if (searchInput) searchInput.focus();
        });
      }
    }
  }

  /**
   * Renders rows for the users table based on search filter.
   * @param {Array<Object>} users
   * @returns {string}
   * @private
   */
  _renderUserTableRows(users) {
    const filtered = this._getFilteredUsers(users);

    if (filtered.length === 0) {
      const q = (this.searchQuery || '').trim();
      return `
        <tr>
          <td colspan="5" style="text-align:center;padding:28px 16px;color:var(--dim);">
            <div style="font-size:28px;margin-bottom:8px;">🔍</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">
              Không tìm thấy tài khoản nào phù hợp
            </div>
            <div style="font-size:12.5px;color:var(--dim);margin-bottom:12px;">
              ${q ? `Không có kết quả nào khớp với từ khóa "<strong>${this._escapeHtml(q)}</strong>".` : 'Chưa có tài khoản nào trong hệ thống.'}
            </div>
            ${q ? `
              <button type="button" id="btnAdminClearEmptySearch" class="btn-sm" style="padding:6px 14px;font-size:12px;font-weight:600;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--accent);cursor:pointer;">
                ✕ Xóa bộ lọc tìm kiếm
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }

    return filtered.map(u => {
      const isUserAdmin = u.username === 'admin' || u.role === 'admin' || u.id === 'user_admin';
      const cleanFullName = isUserAdmin 
        ? 'Quản Trị Viên' 
        : (u.fullName || '').replace(/\s*\(Thầy\/Cô\)/gi, '').replace(/\s*\(Cô\)/gi, '').replace(/\s*\(Thầy\)/gi, '').trim();
      const cleanClassName = isUserAdmin
        ? 'Quản trị viên'
        : (u.className || 'Sinh viên').replace(/Khoa CNTT\s*-\s*Giảng viên & Quản trị/gi, 'Sinh viên').replace(/\s*\(Thầy\/Cô\)/gi, '').trim();
      return `
        <tr class="admin-user-row" style="border-bottom:1px solid var(--line);background:${isUserAdmin ? 'rgba(245,158,11,0.04)' : 'transparent'};">
          <td class="admin-col-user" data-label="Thành viên" style="padding:10px 14px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">${u.avatar || '👤'}</span>
              <div>
                <strong style="color:var(--text);font-weight:700;">${cleanFullName}</strong>
                ${isUserAdmin ? '<span style="margin-left:6px;font-size:11px;color:#f59e0b;font-weight:700;">(Hệ thống)</span>' : ''}
              </div>
            </div>
          </td>
          <td class="admin-col-username" data-label="Username" style="padding:10px 14px;">
            <code style="background:var(--panel-alt);padding:2px 6px;border-radius:4px;font-size:12px;color:var(--accent);">@${u.username}</code>
          </td>
          <td class="admin-col-role" data-label="Vai trò" style="padding:10px 14px;">
            <span style="font-size:11.5px;padding:3px 8px;border-radius:4px;font-weight:700;background:${isUserAdmin ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.12)'};color:${isUserAdmin ? '#f59e0b' : '#3b82f6'};border:1px solid ${isUserAdmin ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)'};">
              ${isUserAdmin ? '👑 Quản trị viên' : '👨‍🎓 Sinh viên'}
            </span>
          </td>
          <td class="admin-col-class" data-label="Lớp / Email" style="padding:10px 14px;color:var(--dim);font-size:12.5px;">
            <div>${cleanClassName}</div>
            <div style="font-size:11px;color:var(--dim);">${u.email || ''}</div>
          </td>
          <td class="admin-col-actions" data-label="Hành động" style="padding:10px 14px;text-align:center;">
            ${isUserAdmin ? `
              <span style="font-size:11.5px;color:var(--dim);font-style:italic;">Admin gốc</span>
            ` : `
              <div class="admin-row-actions" style="display:inline-flex;gap:6px;align-items:center;">
                <button type="button" class="btn-admin-reset-pwd" data-reset-user-id="${u.id}" data-username="${u.username}" data-user-name="${cleanFullName}" style="padding:6px 10px;font-size:12px;font-weight:600;color:var(--accent);background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;" title="Đặt lại mật khẩu về 123456">
                  🔑 Reset MK
                </button>
                <button type="button" class="btn-admin-delete-user" data-user-id="${u.id}" data-username="${u.username}" data-user-name="${cleanFullName}" style="padding:6px 12px;font-size:12px;font-weight:600;color:#ef4444;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;transition:all 0.15s;">
                  🗑️ Xóa tài khoản
                </button>
              </div>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Renders access denied state for non-admin visitors.
   * @private
   */
  _renderAccessDenied() {
    this.container.innerHTML = `
      <div style="max-width:540px;margin:80px auto;text-align:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:36px 24px;box-shadow:0 8px 30px rgba(0,0,0,0.15);">
        <div style="font-size:52px;margin-bottom:16px;">🔒</div>
        <h2 style="font-size:20px;font-weight:800;color:var(--text);margin:0 0 10px;">Quyền Truy Cập Bị Hạn Chế</h2>
        <p style="font-size:13.5px;color:var(--dim);line-height:1.6;margin:0 0 24px;">
          Khu vực Quản trị Database &amp; Sinh viên chỉ dành riêng cho tài khoản Quản trị viên hệ thống (<strong>@admin</strong>).
        </p>
        <button type="button" class="btn-primary" id="btnAdminReturnHome" style="padding:10px 22px;font-size:13.5px;font-weight:700;border-radius:8px;cursor:pointer;">
          ← Quay về Trang chủ
        </button>
      </div>
    `;

    const btnHome = this.container.querySelector('#btnAdminReturnHome');
    if (btnHome) {
      btnHome.addEventListener('click', () => {
        this.onNavigate('home');
      });
    }
  }

  /**
   * Binds data skew warning buttons (dismiss and recheck).
   * @private
   */
  _bindSkewWarningEvents() {
    const dismissBtn = this.container?.querySelector('#btnAdminDismissSkewWarning');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (cloudSyncManager) {
          cloudSyncManager.dataSkewInfo = null;
        }
        const wrap = this.container?.querySelector('#adminDataSkewWarningWrap');
        if (wrap) wrap.innerHTML = '';
      });
    }
    const recheckBtn = this.container?.querySelector('#btnAdminRecheckSync');
    if (recheckBtn) {
      recheckBtn.addEventListener('click', () => {
        this._triggerBackgroundSync();
      });
    }
  }

  /**
   * Binds interaction events.
   * @private
   */
  _bindEvents() {
    // 0. Data Skew Banner events
    this._bindSkewWarningEvents();

    // 1. Search box filtering & Clear Search button
    const searchInput = this.container.querySelector('#adminUserSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this._updateUserTableAndTitle();
      });
    }

    const clearBtn = this.container.querySelector('#btnAdminClearSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        this._updateUserTableAndTitle();
        if (searchInput) searchInput.focus();
      });
    }

    const btnClearEmpty = this.container.querySelector('#btnAdminClearEmptySearch');
    if (btnClearEmpty) {
      btnClearEmpty.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        this._updateUserTableAndTitle();
        if (searchInput) searchInput.focus();
      });
    }

    // Export Users CSV
    const btnExportUsers = this.container.querySelector('#btnAdminExportUsers');
    if (btnExportUsers) {
      btnExportUsers.addEventListener('click', () => {
        const users = authManager.getUsers().filter(u => u.username !== 'admin' && u.id !== 'user_admin');
        if (users.length === 0) {
          this._showAlert('Chưa có tài khoản sinh viên nào để xuất file!', 'error');
          return;
        }
        let csv = '\uFEFFusername,password,fullName,className,email\r\n';
        for (const u of users) {
          csv += `"${u.username || ''}","${u.password || '123456'}","${u.fullName || ''}","${u.className || 'Sinh viên'}","${u.email || ''}"\r\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Danh_Sach_Sinh_Vien_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this._showAlert(`✓ Đã xuất danh sách ${users.length} sinh viên thành công!`, 'success');
      });
    }

    // 2. Add student account form
    const formAdd = this.container.querySelector('#adminViewAddUserForm');
    if (formAdd) {
      formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = this.container.querySelector('#adminInpUsername').value;
        const password = this.container.querySelector('#adminInpPassword').value;
        const fullName = this.container.querySelector('#adminInpFullName').value;
        const className = this.container.querySelector('#adminInpClass').value || 'Sinh viên';
        const email = this.container.querySelector('#adminInpEmail').value;

        let cloudRes = null;
        if (cloudSyncManager && cloudSyncManager.isConnected && typeof cloudSyncManager.adminCreateUser === 'function') {
          try {
            cloudRes = await cloudSyncManager.adminCreateUser({ username, fullName, className, email, password });
          } catch (err) {
            cloudRes = { success: false, error: err.message };
          }
          if (!cloudRes || !cloudRes.success) {
            this._showAlert(`❌ Lỗi máy chủ khi tạo tài khoản: ${cloudRes?.error || 'Thất bại'}`, 'error');
            return;
          }
        }

        const res = authManager.adminCreateUser({
          id: cloudRes?.user?.id,
          username,
          fullName,
          className,
          email,
          password
        });
        if (res.success) {
          formAdd.reset();
          await this.render();
          this._showAlert(`✓ Đã cấp tài khoản thành công cho sinh viên "${fullName}" (@${username.trim().toLowerCase()}).`, 'success');
        } else {
          this._showAlert(res.error || 'Lỗi khi tạo tài khoản.', 'error');
        }
      });
    }

    // 2b. Download User Template CSV
    const btnDownloadTemplate = this.container.querySelector('#btnAdminDownloadUserTemplate');
    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener('click', () => {
        const csvContent = '\uFEFFusername,password,fullName,className,email\r\n' +
          'sv_k66_01,123456,Nguyễn Văn An,K66-CNTT,an.nv@sinhvien.edu.vn\r\n' +
          'sv_k66_02,123456,Trần Thị Mai,K66-KTPM,mai.tt@sinhvien.edu.vn\r\n' +
          'sv_k66_03,123456,Lê Hoàng Nam,K66-HTTT,nam.lh@sinhvien.edu.vn\r\n' +
          'sv_k66_04,123456,Phạm Quốc Huy,K66-KHMT,huy.pq@sinhvien.edu.vn\r\n';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Mau_Danh_Sach_Tai_Khoan.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // 2c. Batch Import Users from File
    const btnTriggerImport = this.container.querySelector('#btnAdminTriggerImportUsers');
    const fileInputUsers = this.container.querySelector('#adminFileInputUsers');
    if (btnTriggerImport && fileInputUsers) {
      btnTriggerImport.addEventListener('click', () => {
        fileInputUsers.value = '';
        fileInputUsers.click();
      });

      fileInputUsers.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          this._showAlert('⚠️ File bạn chọn là file Excel (.xlsx). Vui lòng mở file bằng Excel -> Chọn "Save As" -> Chọn định dạng "CSV (Comma delimited) (*.csv)" hoặc tải "File Mẫu (.csv)" để nạp tài khoản nhé!', 'error');
          fileInputUsers.value = '';
          return;
        }

        const originalBtnText = btnTriggerImport ? btnTriggerImport.innerHTML : '';
        if (btnTriggerImport) {
          btnTriggerImport.disabled = true;
          btnTriggerImport.style.opacity = '0.7';
          btnTriggerImport.innerHTML = '<span>⏳</span> Đang đọc file...';
        }

        try {
          const text = await file.text();
          const records = this._parseUserImportText(text);

          if (records.length === 0) {
            this._showAlert('Không tìm thấy dòng dữ liệu tài khoản hợp lệ trong file.', 'error');
            return;
          }

          if (btnTriggerImport) {
            btnTriggerImport.innerHTML = `<span>⏳</span> Đang tạo ${records.length} tài khoản...`;
          }
          this._showAlert(`Đang xử lý ${records.length} dòng dữ liệu tài khoản...`, 'info');

          // Yield thread briefly so browser renders loading state
          await new Promise(r => setTimeout(r, 10));

          if (btnTriggerImport) {
            btnTriggerImport.innerHTML = `<span>⏳</span> Đang gửi máy chủ xử lý (${records.length} tài khoản)...`;
          }
          this._showAlert(`Đang gửi máy chủ xử lý lô ${records.length} tài khoản...`, 'info');

          let batchRes = null;
          if (cloudSyncManager && typeof cloudSyncManager.adminBatchCreateUsers === 'function') {
            try {
              batchRes = await cloudSyncManager.adminBatchCreateUsers(records);
            } catch (err) {
              batchRes = { success: false, error: err.message };
            }
          }

          if (batchRes && batchRes.success) {
            // Sync newly created users into local authManager state
            if (Array.isArray(batchRes.createdUsers) && batchRes.createdUsers.length > 0) {
              authManager.batchImportUsers(batchRes.createdUsers);
            }
            try {
              await cloudSyncManager.syncUsers(authManager);
            } catch {}
            await this.render();

            let msg = `✓ Đã nhập thành công ${batchRes.addedCount} tài khoản mới!`;
            if (batchRes.skippedCount > 0) {
              msg += ` (Bỏ qua ${batchRes.skippedCount} tài khoản do đã tồn tại hoặc trùng)`;
            }
            if (batchRes.errorCount > 0) {
              msg += ` (Lỗi ${batchRes.errorCount} dòng)`;
            }
            this._showAlert(msg, 'success');
          } else if (batchRes && !batchRes.success) {
            const isForbidden = batchRes.error === 'FORBIDDEN' || (typeof batchRes.error === 'string' && batchRes.error.toLowerCase().includes('quản trị viên'));
            const errMsg = isForbidden
              ? 'Phiên đăng nhập Quản trị viên chưa được xác thực hoặc đã hết hạn. Vui lòng đăng nhập lại tài khoản admin.'
              : (batchRes.error || 'Thao tác thất bại.');
            this._showAlert(`❌ Lỗi từ máy chủ khi nhập tài khoản: ${errMsg}`, 'error');
          } else {
            // Fallback when cloudSyncManager is not available
            const res = authManager.batchImportUsers(records);
            if (res.success) {
              await this.render();
              let msg = `✓ Đã nhập thành công ${res.addedCount} tài khoản mới!`;
              if (res.skippedCount > 0) {
                msg += ` (Bỏ qua ${res.skippedCount} tài khoản do đã tồn tại)`;
              }
              this._showAlert(msg, 'success');
            } else {
              this._showAlert(res.error || 'Lỗi khi nhập tài khoản.', 'error');
            }
          }
        } catch (err) {
          this._showAlert(`Lỗi đọc file: ${err.message}`, 'error');
        } finally {
          if (btnTriggerImport) {
            btnTriggerImport.disabled = false;
            btnTriggerImport.style.opacity = '1';
            btnTriggerImport.innerHTML = originalBtnText;
          }
          fileInputUsers.value = '';
        }
      });
    }

    // 3. Manual Sync Button
    const btnSync = this.container.querySelector('#btnAdminManualSync');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        if (this.isSyncing) return;
        this.isSyncing = true;
        btnSync.disabled = true;
        btnSync.textContent = '⏳ Đang đồng bộ...';
        try {
          await cloudSyncManager.syncUsers(authManager);
          await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
          await this.render();
          this._showAlert('✓ Dữ liệu tài khoản và bảng xếp hạng đã được đồng bộ với máy chủ!', 'success');
        } catch {
          this._showAlert('Lỗi khi kết nối với máy chủ.', 'error');
        } finally {
          this.isSyncing = false;
        }
      });
    }

    // 5. Full Database Reset Button (Nuclear option: clears users, scores, AI chat, exams)
    const btnFullReset = this.container.querySelector('#btnAdminFullDatabaseReset');
    if (btnFullReset) {
      btnFullReset.addEventListener('click', async () => {
        if (typeof window !== 'undefined' && window.confirm) {
          const c1 = window.confirm('⚠️ CẢNH BÁO NGUY HIỂM:\n\nBạn có chắc chắn muốn XÓA TOÀN BỘ DỮ LIỆU DATABASE?\n- Xóa sạch toàn bộ tài khoản sinh viên (chỉ giữ lại admin)\n- Xóa sạch toàn bộ điểm số & bảng xếp hạng\n- Xóa sạch toàn bộ lịch sử AI\n\nHành động này áp dụng cho cả LocalStorage và Máy chủ Cloud!');
          if (!c1) return;
          const c2 = window.confirm('XÁC NHẬN LẦN 2:\nHành động này KHÔNG THỂ HOÀN TÁC. Bạn chắc chắn muốn xóa sạch 100% dữ liệu ngay bây giờ?');
          if (!c2) return;
        }

        btnFullReset.disabled = true;
        const originalTextReset = btnFullReset.innerHTML;
        btnFullReset.innerHTML = '<span>⏳</span> Đang xóa database...';

        try {
          let isOnline = false;
          try {
            isOnline = await cloudSyncManager.checkConnection();
          } catch {}

          let resetRes = null;
          if (isOnline) {
            resetRes = await cloudSyncManager.adminResetDatabase();
            if (!resetRes || !resetRes.success) {
              this._showAlert(`❌ Lỗi máy chủ khi reset database: ${resetRes?.error || 'Thất bại'}. Dữ liệu chưa bị xóa.`, 'error');
              return;
            }
          }

          authManager.resetUsersToDefault({ force: true });
          quizHistoryManager.clearLeaderboard();
          quizHistoryManager.clearAllExamHistory();
          examManager.clearAllExams();
          if (aiHistoryManager && typeof aiHistoryManager._writeAll === 'function') {
            aiHistoryManager._writeAll({});
          }

          // Wipe clean all local deletion tombstones, registered users, and imported questions
          if (authManager.storage) {
            try {
              authManager.storage.setItem('trr_deleted_users_v1', JSON.stringify([]));
              authManager.storage.setItem('toanrr_deleted_imported_files_v1', JSON.stringify([]));
              authManager.storage.setItem('toanrr_custom_imported_files_v1', JSON.stringify([]));
              authManager.storage.setItem('toanrr_custom_imported_questions_v1', JSON.stringify([]));
              authManager.storage.removeItem('toanrr_custom_imported_raw_v1');
              authManager.storage.setItem('trr_registered_users', JSON.stringify([{
                id: 'user_admin',
                username: 'admin',
                fullName: 'Quản Trị Viên',
                className: 'Quản trị viên',
                role: 'admin',
              }]));
              if (resetRes && resetRes.dbResetTime) {
                authManager.storage.setItem('trr_last_db_reset', String(resetRes.dbResetTime));
              } else {
                authManager.storage.setItem('trr_last_db_reset', String(Date.now()));
              }
            } catch {}
          }

          if (isOnline) {
            try {
              if (typeof cloudSyncManager.pushClearAllImportedFiles === 'function') {
                await cloudSyncManager.pushClearAllImportedFiles();
              }
              await cloudSyncManager.syncUsers(authManager);
              await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
              await cloudSyncManager.syncExams(examManager);
              await cloudSyncManager.syncExamSubmissions(examManager);
            } catch {}
          }

          await this.render();
          this._showAlert('✓ Toàn bộ Database đã được xóa sạch và khôi phục về trạng thái ban đầu! (Chỉ giữ lại admin)', 'success');
        } catch (err) {
          this._showAlert(`Lỗi khi reset database: ${err.message}`, 'error');
        } finally {
          btnFullReset.disabled = false;
          btnFullReset.innerHTML = originalTextReset;
        }
      });
    }

    this._bindTableActionButtons();
  }

  /**
   * Binds delete buttons in users table.
   * @private
   */
  _bindTableActionButtons() {
    // 1. Reset password buttons
    this.container.querySelectorAll('.btn-admin-reset-pwd').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-reset-user-id') || btn.getAttribute('data-user-id');
        const targetUsername = btn.getAttribute('data-reset-username') || btn.getAttribute('data-username') || '';
        const targetName = btn.getAttribute('data-user-name') || targetUsername || targetId;

        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Đặt lại mật khẩu cho sinh viên "${targetName}" về mặc định "123456"?`)) {
          return;
        }

        const resLocal = authManager.adminResetPassword(targetId, '123456');
        if (resLocal.success) {
          try {
            await cloudSyncManager.adminResetPassword(targetId, targetUsername, '123456');
          } catch {}
          this._showAlert(`✓ Đã đặt lại mật khẩu cho sinh viên "${targetName}" thành công (mặc định: 123456).`, 'success');
        } else {
          this._showAlert(resLocal.error || 'Lỗi khi đặt lại mật khẩu.', 'error');
        }
      });
    });

    // Delete student account buttons
    this.container.querySelectorAll('.btn-admin-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-user-id');
        const targetUsername = btn.getAttribute('data-username') || '';
        const targetName = btn.getAttribute('data-user-name') || targetUsername || targetId;
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Xác nhận xóa tài khoản sinh viên "${targetName}" khỏi hệ thống?`)) {
          return;
        }

        if (cloudSyncManager && cloudSyncManager.isConnected) {
          try {
            const delRes = await cloudSyncManager.adminDeleteUser(targetId, targetUsername);
            if (delRes && !delRes.success) {
              this._showAlert(`❌ Lỗi máy chủ khi xóa tài khoản: ${delRes.error || 'Thất bại'}`, 'error');
              return;
            }
          } catch (err) {
            this._showAlert(`❌ Lỗi kết nối khi xóa tài khoản: ${err.message}`, 'error');
            return;
          }
        }

        const res = authManager.deleteUser(targetId, targetUsername);
        if (res.success) {
          try {
            await cloudSyncManager.syncUsers(authManager);
            // Also clean from local leaderboard
            quizHistoryManager.removeUserStats(targetId);
            if (targetUsername) quizHistoryManager.removeUserStats(targetUsername);
          } catch {}
          await this.render();
          this._showAlert(`✓ Đã xóa vĩnh viễn tài khoản "${targetName}".`, 'success');
        } else {
          this._showAlert(res.error || 'Lỗi khi xóa tài khoản.', 'error');
        }
      });
    });
  }

  /**
   * Displays an alert banner at the top of the admin panel.
   * @param {string} message
   * @param {'success'|'error'} [type]
   * @private
   */
  _showAlert(message, type = 'success') {
    const alertBox = this.container.querySelector('#adminActionAlert');
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.style.display = 'block';
    if (type === 'success') {
      alertBox.style.background = 'rgba(16, 185, 129, 0.12)';
      alertBox.style.color = '#10b981';
      alertBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else if (type === 'info') {
      alertBox.style.background = 'rgba(59, 130, 246, 0.12)';
      alertBox.style.color = '#3b82f6';
      alertBox.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    } else {
      alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
      alertBox.style.color = '#ef4444';
      alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }

    setTimeout(() => {
      if (alertBox) {
        alertBox.style.display = 'none';
      }
    }, 4500);
  }

  /**
   * Smart column parser for importing user accounts from CSV/TXT with column detection.
   * @param {string} text
   * @returns {Array<{ username: string, fullName: string, password: string, className: string, email: string }>}
   * @private
   */
  _parseUserImportText(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

    const splitRow = (row) => {
      const parts = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delimiter && !inQuotes) {
          parts.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else {
          cur += c;
        }
      }
      parts.push(cur.trim().replace(/^["']|["']$/g, ''));
      return parts;
    };

    const normalizeHeader = (str) => {
      return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    };

    const rawHeaders = splitRow(firstLine);
    const normHeaders = rawHeaders.map(normalizeHeader);

    let colUsername = -1;
    let colFullName = -1;
    let colPassword = -1;
    let colClass = -1;
    let colEmail = -1;

    normHeaders.forEach((h, idx) => {
      if (colUsername === -1 && (
        h === 'username' || h === 'user' || h === 'account' || h === 'tendangnhap' ||
        h === 'taikhoan' || h === 'mssv' || h === 'masv' || h === 'masinhvien' ||
        h === 'masosinhvien' || h === 'ma' || h === 'id'
      )) {
        colUsername = idx;
      } else if (colFullName === -1 && (
        h === 'fullname' || h === 'hovaten' || h === 'hoten' || h === 'tensinhvien' ||
        h === 'name' || h === 'hovatensinhvien' || h === 'ten' || h === 'sinhvien'
      )) {
        colFullName = idx;
      } else if (colPassword === -1 && (
        h === 'password' || h === 'matkhau' || h === 'pass' || h === 'matma'
      )) {
        colPassword = idx;
      } else if (colClass === -1 && (
        h === 'class' || h === 'classname' || h === 'lop' || h === 'lophoc' || h === 'donvi' || h === 'lopdonvi'
      )) {
        colClass = idx;
      } else if (colEmail === -1 && (
        h === 'email' || h === 'thudientu' || h === 'mail'
      )) {
        colEmail = idx;
      }
    });

    const hasHeader = (colUsername !== -1 || colFullName !== -1 || colPassword !== -1);
    const startIdx = hasHeader ? 1 : 0;

    if (!hasHeader) {
      if (colUsername === -1) colUsername = 0;
      if (colFullName === -1) colFullName = 1;
      if (colPassword === -1) colPassword = 2;
      if (colClass === -1) colClass = 3;
      if (colEmail === -1) colEmail = 4;
    }

    const records = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = splitRow(lines[i]);
      if (parts.length === 0 || !parts.some(p => p)) continue;

      let rawUser = (colUsername !== -1 && colUsername < parts.length ? parts[colUsername] : '').trim();
      let rawName = (colFullName !== -1 && colFullName < parts.length ? parts[colFullName] : '').trim();
      let rawPass = (colPassword !== -1 && colPassword < parts.length ? parts[colPassword] : '').trim();
      let rawCls = (colClass !== -1 && colClass < parts.length ? parts[colClass] : '').trim();
      let rawMail = (colEmail !== -1 && colEmail < parts.length ? parts[colEmail] : '').trim();

      if (!hasHeader) {
        const passLooksLikeName = rawPass.includes(' ') || /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(rawPass);
        const nameLooksLikePass = !rawName.includes(' ') && /^[a-zA-Z0-9_!@#$%^&*]{3,20}$/.test(rawName);
        if (passLooksLikeName && nameLooksLikePass) {
          const tmp = rawName;
          rawName = rawPass;
          rawPass = tmp;
        }
      }

      if (!rawUser && rawName) {
        rawUser = normalizeHeader(rawName);
      }

      if (rawUser) {
        records.push({
          username: rawUser,
          fullName: rawName || rawUser,
          password: rawPass || '123456',
          className: rawCls || 'Sinh viên',
          email: rawMail || '',
        });
      }
    }

    return records;
  }

}
