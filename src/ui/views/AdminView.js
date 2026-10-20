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
    this.activeTab = 'students';
    this.gradebookSearchQuery = '';
    this.dbStatus = { storageMode: 'unknown', databaseLabel: 'Đang kiểm tra...', kvConfigured: false };

    authManager.onAuthStateChanged(() => {
      if (this.container && this.container.classList.contains('active')) {
        this.render();
      }
    });

    if (this.container) {
      this.render();
    }
  }

  /**
   * Mounts and renders the Admin Management dashboard.
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

    // Check cloud connection state
    try {
      this.isServerConnected = await cloudSyncManager.checkConnection();
      if (this.isServerConnected) {
        this.dbStatus = await cloudSyncManager.getDatabaseStatus();
        await cloudSyncManager.syncUsers(authManager);
        await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
        await cloudSyncManager.syncExams(examManager);
        await cloudSyncManager.syncExamSubmissions(examManager);
      } else {
        this.dbStatus = { storageMode: 'offline', databaseLabel: 'Chế độ Ngoại tuyến', kvConfigured: false };
      }
    } catch {
      this.isServerConnected = false;
      this.dbStatus = { storageMode: 'offline', databaseLabel: 'Chế độ Ngoại tuyến', kvConfigured: false };
    }

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
            <button type="button" class="btn-secondary" id="btnAdminPingDb" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;">
              <span>⚡</span>
              <span>Kiểm tra Kết nối DB</span>
            </button>
            <button type="button" class="btn-secondary" id="btnAdminManualSync" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;">
              <span>🔄</span>
              <span>Đồng bộ Máy chủ</span>
            </button>
            <button type="button" class="btn-danger" id="btnAdminClearAllExams" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:#ef4444;color:#fff;border:none;">
              <span>🗑️</span>
              <span>Xóa Đề Thi &amp; Điểm Sinh Viên</span>
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
            <div style="font-size:26px;font-weight:800;color:var(--text);">${studentCount}</div>
          </div>

          <!-- Card 2: Server Status -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Trạng Thái Máy Chủ</span>
              <span style="font-size:20px;">🌐</span>
            </div>
            <div style="font-size:16px;font-weight:800;color:${this.isServerConnected ? '#10b981' : '#f59e0b'};display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span>${this.isServerConnected ? '● Đã kết nối' : '○ Chế độ Ngoại tuyến'}</span>
            </div>
            <div style="font-size:11.5px;font-weight:700;color:${this.dbStatus.kvConfigured ? '#10b981' : '#3b82f6'};">
              🗄️ ${this.dbStatus.databaseLabel || (this.dbStatus.kvConfigured ? 'Cloud KV (Upstash Redis)' : 'Local File Store')}
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

        <!-- Navigation Tabs -->
        <div class="admin-nav-tabs" style="display:none;">
          <button type="button" class="btn-admin-tab ${this.activeTab === 'students' ? 'active' : ''}" data-tab="students" style="padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;border:none;background:transparent;color:${this.activeTab === 'students' ? 'var(--accent)' : 'var(--dim)'};border-bottom:2px solid ${this.activeTab === 'students' ? 'var(--accent)' : 'transparent'};">
            👥 Quản Lý Sinh Viên (${studentCount})
          </button>
          <button type="button" class="btn-admin-tab ${this.activeTab === 'gradebook' ? 'active' : ''}" data-tab="gradebook" style="padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;border:none;background:transparent;color:${this.activeTab === 'gradebook' ? 'var(--accent)' : 'var(--dim)'};border-bottom:2px solid ${this.activeTab === 'gradebook' ? 'var(--accent)' : 'transparent'};">
            📊 Bảng Điểm &amp; Bài Nộp (${examManager.getSubmissions().length})
          </button>
          <button type="button" class="btn-admin-tab ${this.activeTab === 'maintenance' ? 'active' : ''}" data-tab="maintenance" style="padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;border:none;background:transparent;color:${this.activeTab === 'maintenance' ? 'var(--accent)' : 'var(--dim)'};border-bottom:2px solid ${this.activeTab === 'maintenance' ? 'var(--accent)' : 'transparent'};">
            ⚙️ Cấu Hình Database Cloud
          </button>
        </div>

        <div id="tabContentStudents" style="display:${this.activeTab === 'students' ? 'block' : 'none'};">
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

        <!-- User Accounts Table Section -->
        <section class="admin-users-table-section" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div>
              <h3 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
                <span>📋</span>
                <span>Danh Sách Cơ Sở Dữ Liệu Tài Khoản (${allUsers.length})</span>
              </h3>
              <p style="margin:0;font-size:12px;color:var(--dim);">
                Quản trị viên có toàn quyền kiểm tra, xem thông tin và xóa bỏ các tài khoản kiểm thử hoặc sinh viên không hợp lệ.
              </p>
            </div>

            <!-- Search box -->
            <div style="position:relative;min-width:240px;">
              <input type="text" id="adminUserSearchInput" value="${this.searchQuery}" placeholder="🔍 Tìm theo tên, username, lớp..." style="width:100%;box-sizing:border-box;padding:7px 12px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);">
            </div>
          </div>

          <!-- Table -->
          <div style="overflow-x:auto;border:1px solid var(--line);border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
              <thead style="background:var(--panel-alt);border-bottom:1px solid var(--line);">
                <tr>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Thành viên</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Username</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Vai trò</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Lớp / Email</th>
                  <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;text-align:center;">Hành động</th>
                </tr>
              </thead>
              <tbody id="adminUsersTbody">
                ${this._renderUserTableRows(allUsers)}
              </tbody>
            </table>
          </div>
        </section>
        </div>

        <!-- TAB 2: GRADEBOOK -->
        <div id="tabContentGradebook" style="display:${this.activeTab === 'gradebook' ? 'block' : 'none'};">
          <section style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
              <div>
                <h3 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
                  <span>📊</span>
                  <span>Bảng Điểm &amp; Bài Nộp Của Sinh Viên (${examManager.getSubmissions().length})</span>
                </h3>
                <p style="margin:0;font-size:12px;color:var(--dim);">
                  Điểm số các bài thi chính thức, thời gian làm bài và số câu đúng được đồng bộ tự động.
                </p>
              </div>

              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <input type="text" id="adminGradebookSearchInput" value="${this.gradebookSearchQuery}" placeholder="🔍 Tìm theo tên SV, đề thi..." style="box-sizing:border-box;padding:7px 12px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);min-width:220px;">
                <button type="button" id="btnAdminExportGradebook" class="btn-sm" style="padding:7px 14px;font-size:12px;font-weight:600;background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--text);">
                  <span>📥</span> Xuất File Điểm (.csv)
                </button>
              </div>
            </div>

            <div style="overflow-x:auto;border:1px solid var(--line);border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
                <thead style="background:var(--panel-alt);border-bottom:1px solid var(--line);">
                  <tr>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Sinh viên</th>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Đề thi</th>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;text-align:center;">Điểm số</th>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;text-align:center;">Số câu đúng</th>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;text-align:center;">Thời gian</th>
                    <th style="padding:10px 14px;font-weight:700;color:var(--dim);font-size:12px;text-transform:uppercase;">Ngày nộp</th>
                  </tr>
                </thead>
                <tbody id="adminGradebookTbody">
                  ${this._renderGradebookRows(examManager.getSubmissions())}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- TAB 3: MAINTENANCE -->
        <div id="tabContentMaintenance" style="display:${this.activeTab === 'maintenance' ? 'block' : 'none'};">
          <section style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:22px;margin-bottom:24px;">
            <h3 style="margin:0 0 12px;font-size:16px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
              <span>🌐</span>
              <span>Thông Tin &amp; Cấu Hình Cơ Sở Dữ Liệu Cloud</span>
            </h3>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
              <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px 16px;">
                <div style="font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Loại Database máy chủ</div>
                <div style="font-size:15px;font-weight:700;color:var(--text);">
                  ${this.dbStatus.databaseLabel || (this.dbStatus.kvConfigured ? 'Cloud KV (Upstash Redis)' : 'Local File Store')}
                </div>
              </div>

              <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px 16px;">
                <div style="font-size:12px;color:var(--dim);margin-bottom:4px;font-weight:600;">Trạng thái lưu trữ Cloud</div>
                <div style="font-size:15px;font-weight:700;color:${this.dbStatus.kvConfigured ? '#10b981' : '#3b82f6'};">
                  ${this.dbStatus.kvConfigured ? '● Cloud KV Đang Hoạt Động (Lưu Vĩnh Viễn)' : '● File Cục Bộ (data/server_db.json)'}
                </div>
              </div>
            </div>

            <div style="background:var(--panel-alt);border:1px dashed var(--line);border-radius:8px;padding:16px;font-size:12.5px;color:var(--text);line-height:1.6;">
              <h4 style="margin:0 0 8px;font-size:13.5px;font-weight:700;color:var(--accent);">
                💡 Kết nối máy tính ở nhà (Localhost) chung Database với Vercel:
              </h4>
              <p style="margin:0 0 8px;">
                Để máy tính cá nhân (<code>npm start</code>) đồng bộ và đọc ghi trực tiếp vào cùng Database đám mây của trang online <code>mathplatform-ten.vercel.app</code>, thêm 2 biến sau vào file <code>.env</code> trên máy:
              </p>
              <pre style="background:var(--bg);border:1px solid var(--line);padding:10px 14px;border-radius:6px;font-family:monospace;font-size:12px;overflow-x:auto;">KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...</pre>
            </div>
          </section>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Renders rows for the users table based on search filter.
   * @param {Array<Object>} users
   * @returns {string}
   * @private
   */
  _renderUserTableRows(users) {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = q
      ? users.filter(u =>
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.className || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        )
      : users;

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="5" style="text-align:center;padding:24px;color:var(--dim);">
            Không tìm thấy tài khoản nào phù hợp với từ khóa "${this.searchQuery}".
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
        <tr style="border-bottom:1px solid var(--line);background:${isUserAdmin ? 'rgba(245,158,11,0.04)' : 'transparent'};">
          <td style="padding:10px 14px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">${u.avatar || '👤'}</span>
              <div>
                <strong style="color:var(--text);font-weight:700;">${cleanFullName}</strong>
                ${isUserAdmin ? '<span style="margin-left:6px;font-size:11px;color:#f59e0b;font-weight:700;">(Hệ thống)</span>' : ''}
              </div>
            </div>
          </td>
          <td style="padding:10px 14px;">
            <code style="background:var(--panel-alt);padding:2px 6px;border-radius:4px;font-size:12px;color:var(--accent);">@${u.username}</code>
          </td>
          <td style="padding:10px 14px;">
            <span style="font-size:11.5px;padding:3px 8px;border-radius:4px;font-weight:700;background:${isUserAdmin ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.12)'};color:${isUserAdmin ? '#f59e0b' : '#3b82f6'};border:1px solid ${isUserAdmin ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)'};">
              ${isUserAdmin ? '👑 Quản trị viên' : '👨‍🎓 Sinh viên'}
            </span>
          </td>
          <td style="padding:10px 14px;color:var(--dim);font-size:12.5px;">
            <div>${cleanClassName}</div>
            <div style="font-size:11px;color:var(--dim);">${u.email || ''}</div>
          </td>
          <td style="padding:10px 14px;text-align:center;">
            ${isUserAdmin ? `
              <span style="font-size:11.5px;color:var(--dim);font-style:italic;">Admin gốc</span>
            ` : `
              <button type="button" class="btn-admin-reset-pwd" data-reset-user-id="${u.id}" data-username="${u.username}" data-user-name="${cleanFullName}" style="padding:4px 8px;font-size:11.5px;font-weight:600;color:var(--accent);background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;margin-right:6px;" title="Đặt lại mật khẩu về 123456">
                🔑 Reset MK
              </button>
              <button type="button" class="btn-admin-delete-user" data-user-id="${u.id}" data-username="${u.username}" data-user-name="${cleanFullName}" style="padding:4px 10px;font-size:12px;font-weight:600;color:#ef4444;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;transition:all 0.15s;">
                🗑️ Xóa tài khoản
              </button>
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
   * Binds interaction events.
   * @private
   */
  _bindEvents() {
    // Tabs
    this.container.querySelectorAll('.btn-admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Ping DB
    const btnPing = this.container.querySelector('#btnAdminPingDb');
    if (btnPing) {
      btnPing.addEventListener('click', async () => {
        btnPing.disabled = true;
        btnPing.textContent = '⏳ Đang kiểm tra...';
        const start = Date.now();
        const status = await cloudSyncManager.getDatabaseStatus();
        const latency = Date.now() - start;
        btnPing.disabled = false;
        btnPing.textContent = '⚡ Kiểm tra Kết nối DB';
        if (status && status.connected) {
          const type = status.databaseLabel || (status.kvConfigured ? 'Cloud KV (Upstash Redis)' : 'Local File Store');
          const users = status.metrics?.usersCount || 0;
          this._showAlert(`✓ Kết nối Database thành công! Loại DB: ${type} • Phản hồi: ${latency}ms • Dữ liệu: ${users} tài khoản.`, 'success');
        } else {
          this._showAlert('❌ Không thể kết nối tới cơ sở dữ liệu máy chủ. Đang ở chế độ Ngoại tuyến.', 'error');
        }
      });
    }

    // Gradebook search
    const gradebookSearch = this.container.querySelector('#adminGradebookSearchInput');
    if (gradebookSearch) {
      gradebookSearch.addEventListener('input', (e) => {
        this.gradebookSearchQuery = e.target.value;
        const tbody = this.container.querySelector('#adminGradebookTbody');
        if (tbody) {
          tbody.innerHTML = this._renderGradebookRows(examManager.getSubmissions());
        }
      });
    }

    // Export Gradebook CSV
    const btnExportGradebook = this.container.querySelector('#btnAdminExportGradebook');
    if (btnExportGradebook) {
      btnExportGradebook.addEventListener('click', () => {
        const subs = examManager.getSubmissions();
        if (subs.length === 0) {
          this._showAlert('Chưa có bài thi nào để xuất bảng điểm!', 'error');
          return;
        }
        let csv = '\uFEFFMSSV,Họ và tên,Lớp,Đề thi,Điểm số,Số câu đúng,Tổng câu,Thời gian (giây),Ngày nộp\r\n';
        for (const s of subs) {
          csv += `"${s.username || ''}","${s.fullName || ''}","${s.className || ''}","${s.examTitle || ''}",${s.score || 0},${s.correctCount || 0},${s.totalQuestions || 0},${s.timeSpentSeconds || 0},"${s.submittedAt || ''}"\r\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bang_Diem_Sinh_Vien_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this._showAlert('✓ Đã xuất bảng điểm sinh viên thành công!', 'success');
      });
    }
    // 1. Search box filtering
    const searchInput = this.container.querySelector('#adminUserSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        const tbody = this.container.querySelector('#adminUsersTbody');
        if (tbody) {
          tbody.innerHTML = this._renderUserTableRows(authManager.getUsers());
          this._bindTableActionButtons();
        }
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

        const res = authManager.adminCreateUser({ username, fullName, className, email, password });
        if (res.success) {
          try {
            await cloudSyncManager.adminCreateUser({ id: res.user?.id, username, fullName, className, email, password });
          } catch {}
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

        try {
          const text = await file.text();
          const records = this._parseUserImportText(text);

          if (records.length === 0) {
            this._showAlert('Không tìm thấy dòng dữ liệu tài khoản hợp lệ trong file.', 'error');
            return;
          }

          const res = authManager.batchImportUsers(records);
          if (res.success) {
            if (res.createdUsers && res.createdUsers.length > 0) {
              for (const u of res.createdUsers) {
                try {
                  await cloudSyncManager.adminCreateUser(u);
                } catch {}
              }
            }
            await this.render();
            let msg = `✓ Đã nhập thành công ${res.addedCount} tài khoản mới!`;
            if (res.skippedCount > 0) {
              msg += ` (Bỏ qua ${res.skippedCount} tài khoản do đã tồn tại hoặc không hợp lệ)`;
            }
            this._showAlert(msg, 'success');
          } else {
            this._showAlert(res.error || 'Lỗi khi nhập tài khoản hàng loạt.', 'error');
          }
        } catch (err) {
          this._showAlert(`Lỗi đọc file: ${err.message}`, 'error');
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

    // 4. Clear All Exams & Student Submissions Button
    const btnClearExams = this.container.querySelector('#btnAdminClearAllExams');
    if (btnClearExams) {
      btnClearExams.addEventListener('click', async () => {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(
          '⚠️ CẢNH BÁO QUAN TRỌNG:\n\nBạn có chắc chắn muốn xóa TOÀN BỘ đề thi đã giao và tất cả dữ liệu bài làm, điểm số thi trong tài khoản sinh viên không?\n\nHành động này không thể hoàn tác!'
        )) {
          return;
        }

        btnClearExams.disabled = true;
        btnClearExams.textContent = '⏳ Đang xóa...';

        examManager.clearAllExams();
        quizHistoryManager.clearAllExamHistory();

        try {
          await cloudSyncManager.serverClearAllExams();
          await cloudSyncManager.syncExams(examManager);
          await cloudSyncManager.syncExamSubmissions(examManager);
        } catch {}

        await this.render();
        this._showAlert('✓ Đã xóa sạch toàn bộ đề thi và làm sạch dữ liệu bài làm trong tài khoản sinh viên!', 'success');
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
        btnFullReset.textContent = '⏳ Đang xóa database...';

        authManager.resetUsersToDefault();
        quizHistoryManager.clearLeaderboard();
        quizHistoryManager.clearAllExamHistory();
        examManager.clearAllExams();
        if (aiHistoryManager && typeof aiHistoryManager._writeAll === 'function') {
          aiHistoryManager._writeAll({});
        }

        try {
          await cloudSyncManager.adminResetDatabase();
          await cloudSyncManager.syncUsers(authManager);
          await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
          await cloudSyncManager.syncExams(examManager);
          await cloudSyncManager.syncExamSubmissions(examManager);
        } catch {}

        await this.render();
        this._showAlert('✓ Toàn bộ Database đã được xóa sạch và khôi phục về trạng thái ban đầu!', 'success');
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

        const res = authManager.deleteUser(targetId, targetUsername);
        if (res.success) {
          try {
            await cloudSyncManager.adminDeleteUser(targetId, targetUsername);
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
   * Renders rows for the exam submissions gradebook table.
   * @param {Array<Object>} submissions
   * @returns {string}
   * @private
   */
  _renderGradebookRows(submissions) {
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return `
        <tr>
          <td colspan="6" style="text-align:center;padding:32px;color:var(--dim);">
            <div style="font-size:32px;margin-bottom:8px;">📝</div>
            <div>Chưa có bài thi nào được sinh viên nộp lên hệ thống.</div>
            <div style="font-size:12px;margin-top:4px;">Khi sinh viên làm bài thi, kết quả sẽ tự động đồng bộ vào đây.</div>
          </td>
        </tr>
      `;
    }

    const q = this.gradebookSearchQuery.trim().toLowerCase();
    const filtered = q
      ? submissions.filter(s =>
          (s.fullName || '').toLowerCase().includes(q) ||
          (s.username || '').toLowerCase().includes(q) ||
          (s.examTitle || '').toLowerCase().includes(q) ||
          (s.className || '').toLowerCase().includes(q)
        )
      : submissions;

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px;color:var(--dim);">
            Không tìm thấy bài nộp nào phù hợp với từ khóa "${this.gradebookSearchQuery}".
          </td>
        </tr>
      `;
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    return sorted.map(s => {
      const score = typeof s.score === 'number' ? s.score : 0;
      const scoreColor = score >= 8 ? '#10b981' : (score >= 5 ? '#3b82f6' : '#ef4444');
      const scoreBg = score >= 8 ? 'rgba(16,185,129,0.12)' : (score >= 5 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)');
      const durationMin = Math.floor((s.timeSpentSeconds || 0) / 60);
      const durationSec = (s.timeSpentSeconds || 0) % 60;
      const timeStr = `${durationMin}p ${durationSec < 10 ? '0' : ''}${durationSec}s`;
      const dateStr = s.submittedAt ? new Date(s.submittedAt).toLocaleString('vi-VN') : '—';

      return `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:10px 14px;">
            <div style="font-weight:700;color:var(--text);">${this._escapeHtml(s.fullName || s.username || 'Sinh viên')}</div>
            <div style="font-size:11.5px;color:var(--dim);">@${this._escapeHtml(s.username || s.userId || '')} • ${this._escapeHtml(s.className || 'Sinh viên')}</div>
          </td>
          <td style="padding:10px 14px;">
            <strong style="color:var(--text);font-size:12.5px;">${this._escapeHtml(s.examTitle || s.examId || 'Đề thi')}</strong>
          </td>
          <td style="padding:10px 14px;text-align:center;">
            <span style="font-size:14px;font-weight:800;padding:2px 8px;border-radius:6px;background:${scoreBg};color:${scoreColor};">
              ${score.toFixed(1)} / 10
            </span>
          </td>
          <td style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text);">
            ${s.correctCount || 0} / ${s.totalQuestions || 0}
          </td>
          <td style="padding:10px 14px;text-align:center;color:var(--dim);font-size:12px;">
            ${timeStr}
          </td>
          <td style="padding:10px 14px;color:var(--dim);font-size:12px;">
            ${dateStr}
          </td>
        </tr>
      `;
    }).join('');
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
        h === 'taikhoan' || h === 'mssv' || h === 'masv' || h === 'masinhvien' || h === 'id'
      )) {
        colUsername = idx;
      } else if (colFullName === -1 && (
        h === 'fullname' || h === 'hovaten' || h === 'hoten' || h === 'tensinhvien' ||
        h === 'name' || h === 'hovatensinhvien' || h === 'ten'
      )) {
        colFullName = idx;
      } else if (colPassword === -1 && (
        h === 'password' || h === 'matkhau' || h === 'pass' || h === 'matma'
      )) {
        colPassword = idx;
      } else if (colClass === -1 && (
        h === 'class' || h === 'classname' || h === 'lop' || h === 'donvi' || h === 'lopdonvi'
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
