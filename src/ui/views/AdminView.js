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
        await cloudSyncManager.syncUsers(authManager);
        await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
      }
    } catch {
      this.isServerConnected = false;
    }

    const allUsers = authManager.getUsers();
    const leaderboard = quizHistoryManager.getLeaderboard ? quizHistoryManager.getLeaderboard(50) : [];
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
              Bảng điều khiển quản lý tập trung tài khoản sinh viên, đồng bộ máy chủ và dữ liệu bảng xếp hạng Toán Rời Rạc.
            </p>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" id="btnAdminManualSync" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;">
              <span>🔄</span>
              <span>Đồng bộ Máy chủ</span>
            </button>
            <button type="button" class="btn-danger-outline" id="btnAdminResetLeaderboard" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:600;border-radius:8px;cursor:pointer;color:#ef4444;border-color:rgba(239,68,68,0.4);">
              <span>🏆</span>
              <span>Reset Bảng Xếp Hạng</span>
            </button>
            <button type="button" class="btn-danger" id="btnAdminFullDatabaseReset" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:#ef4444;color:#fff;border:none;">
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
            <div style="font-size:18px;font-weight:800;color:${this.isServerConnected ? '#10b981' : '#f59e0b'};display:flex;align-items:center;gap:6px;">
              <span>${this.isServerConnected ? '● Đã kết nối' : '○ Chế độ Ngoại tuyến'}</span>
            </div>
          </div>

          <!-- Card 3: Leaderboard -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Bảng Xếp Hạng</span>
              <span style="font-size:20px;">🏆</span>
            </div>
            <div style="font-size:26px;font-weight:800;color:var(--text);">${leaderboard.length}</div>
          </div>

          <!-- Card 4: System Admin -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.5px;">Quản Trị Hệ Thống</span>
              <span style="font-size:20px;">👑</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:#f59e0b;">@admin</div>
          </div>
        </div>

        <!-- Add Student Form Section (Collapsible/Accordion) -->
        <section class="admin-create-user-section" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;font-size:15px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
              <span>➕</span>
              <span>Cấp Tài Khoản Sinh Viên Mới</span>
            </h3>
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

        <!-- Leaderboard Management Section -->
        <section class="admin-leaderboard-section" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 22px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <div>
              <h3 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;display:flex;align-items:center;gap:8px;">
                <span>🏆</span>
                <span>Quản Lý Bảng Xếp Hạng Trắc Nghiệm (${leaderboard.length})</span>
              </h3>
              <p style="margin:0;font-size:12px;color:var(--dim);">
                Theo dõi thành tích làm bài thi, xóa điểm số sai lệch của từng sinh viên hoặc làm mới toàn bộ bảng xếp hạng.
              </p>
            </div>
          </div>

          ${leaderboard.length === 0 ? `
            <div style="text-align:center;padding:24px;color:var(--dim);font-size:13px;background:var(--panel-alt);border-radius:8px;">
              Chưa có kết quả trắc nghiệm nào trên bảng xếp hạng.
            </div>
          ` : `
            <div style="overflow-x:auto;max-height:300px;border:1px solid var(--line);border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:left;">
                <thead style="background:var(--panel-alt);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:2;">
                  <tr>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;">Hạng</th>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;">Sinh viên</th>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;text-align:center;">Điểm</th>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;text-align:center;">Độ chính xác</th>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;text-align:center;">Số câu đã làm</th>
                    <th style="padding:8px 12px;font-weight:700;color:var(--dim);font-size:11.5px;text-align:center;">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  ${leaderboard.map(item => `
                    <tr style="border-bottom:1px solid var(--line);">
                      <td style="padding:8px 12px;font-weight:700;">${item.rankBadge || item.rank}</td>
                      <td style="padding:8px 12px;">
                        <span style="margin-right:6px;">${item.avatar || '👨‍🎓'}</span>
                        <strong>${item.fullName}</strong>
                        <span style="font-size:11px;color:var(--dim);margin-left:4px;">(${item.className || 'Sinh viên'})</span>
                      </td>
                      <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--accent);">${item.score} đ</td>
                      <td style="padding:8px 12px;text-align:center;">${item.accuracy}%</td>
                      <td style="padding:8px 12px;text-align:center;">${item.totalAnswered} câu</td>
                      <td style="padding:8px 12px;text-align:center;">
                        <button type="button" class="btn-admin-del-score" data-user-id="${item.userId}" data-name="${item.fullName}" style="padding:3px 8px;font-size:11px;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:4px;cursor:pointer;">
                          🗑️ Xóa điểm
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </section>
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
              <button type="button" class="btn-admin-delete-user" data-user-id="${u.id}" data-username="${u.username}" data-user-name="${cleanFullName}" style="padding:4px 10px;font-size:12px;font-weight:600;color:#ef4444;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;transition:all 0.15s;">
                🗑️ Xóa tài khoản
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
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

    // 4. Reset Leaderboard Button
    const btnResetLb = this.container.querySelector('#btnAdminResetLeaderboard');
    if (btnResetLb) {
      btnResetLb.addEventListener('click', async () => {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn RESET toàn bộ bảng xếp hạng điểm số trắc nghiệm? Dữ liệu điểm sẽ trở về trống!')) {
          return;
        }
        quizHistoryManager.clearLeaderboard();
        try {
          await cloudSyncManager.resetQuizLeaderboard();
        } catch {}
        await this.render();
        this._showAlert('✓ Bảng xếp hạng trắc nghiệm đã được reset sạch sẽ.', 'success');
      });
    }

    // 5. Full Database Reset Button (Nuclear option: clears users, scores, AI chat)
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
        if (aiHistoryManager && typeof aiHistoryManager._writeAll === 'function') {
          aiHistoryManager._writeAll({});
        }

        try {
          await cloudSyncManager.adminResetDatabase();
          await cloudSyncManager.syncUsers(authManager);
          await cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
        } catch {}

        await this.render();
        this._showAlert('✓ Toàn bộ Database đã được xóa sạch và khôi phục về trạng thái ban đầu!', 'success');
      });
    }

    this._bindTableActionButtons();
  }

  /**
   * Binds delete buttons in users table and leaderboard table.
   * @private
   */
  _bindTableActionButtons() {
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

    // Delete single leaderboard score buttons
    this.container.querySelectorAll('.btn-admin-del-score').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-id');
        const userName = btn.getAttribute('data-name') || userId;
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Xóa điểm số của "${userName}" khỏi bảng xếp hạng?`)) {
          return;
        }
        quizHistoryManager.removeUserStats(userId);
        try {
          await cloudSyncManager.deleteQuizLeaderboardUser(userId);
        } catch {}
        await this.render();
        this._showAlert(`✓ Đã xóa điểm số của "${userName}" khỏi bảng xếp hạng.`, 'success');
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
}
