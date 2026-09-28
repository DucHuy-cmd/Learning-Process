/**
 * @file AuthModal.js
 * User Authentication & Profile Modal Dialog.
 * 
 * Provides:
 * - Guest mode quick start without account registration.
 * - Standard Login & Registration forms with validation.
 * - User Profile details and Account Switcher.
 */

import { authManager } from '../../core/auth/AuthManager.js';
import { aiHistoryManager } from '../../core/ai/AiHistoryManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';

export class AuthModal {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onAuthChange]
   */
  constructor(options = {}) {
    this.onAuthChange = options.onAuthChange || (() => {});
    this.activeTab = 'quick'; // 'quick' | 'login' | 'register' | 'profile'
    this.isOpen = false;
    this.domElement = null;

    this._createDom();
    authManager.onAuthStateChanged(() => {
      this._renderContent();
      this.onAuthChange(authManager.getCurrentUser());
    });
  }

  /**
   * Opens the modal on a specific tab.
   * @param {'quick'|'login'|'register'|'profile'} [tab]
   */
  open(tab = null) {
    const user = authManager.getCurrentUser();
    if (tab) {
      this.activeTab = tab;
    } else {
      this.activeTab = user ? 'profile' : 'quick';
    }

    this.isOpen = true;
    this._renderContent();
    this.domElement.classList.add('open');
    document.body.classList.add('modal-open');
  }

  /**
   * Closes the modal.
   */
  close() {
    this.isOpen = false;
    if (this.domElement) {
      this.domElement.classList.remove('open');
    }
    document.body.classList.remove('modal-open');
  }

  /**
   * @private
   */
  _createDom() {
    this.domElement = document.createElement('div');
    this.domElement.className = 'auth-modal-overlay';
    this.domElement.id = 'authModalOverlay';

    this.domElement.innerHTML = `
      <div class="auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
        <div class="auth-modal-header">
          <div class="auth-modal-title-wrap">
            <span class="auth-modal-icon">🔐</span>
            <div>
              <h3 class="auth-modal-title" id="authModalTitle">Hệ Thống Tài Khoản</h3>
              <span class="auth-modal-sub">Toán Rời Rạc Platform</span>
            </div>
          </div>
          <button type="button" class="btn-close-modal" id="btnCloseAuthModal" title="Đóng (Esc)">✕</button>
        </div>

        <div class="auth-modal-tabs" id="authModalTabs">
          <!-- Rendered dynamically -->
        </div>

        <div class="auth-modal-body" id="authModalBody">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(this.domElement);

    // Event listeners
    this.domElement.querySelector('#btnCloseAuthModal').addEventListener('click', () => this.close());
    this.domElement.addEventListener('click', (e) => {
      if (e.target === this.domElement) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * @private
   */
  _renderContent() {
    const user = authManager.getCurrentUser();
    const tabsContainer = this.domElement.querySelector('#authModalTabs');
    const bodyContainer = this.domElement.querySelector('#authModalBody');

    // 1. Render Tabs
    if (user) {
      const isAdmin = authManager.isAdmin();
      tabsContainer.innerHTML = `
        <button type="button" class="auth-tab-btn ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
          ${isAdmin ? '👑 Hồ sơ Quản trị' : '👤 Hồ sơ cá nhân'}
        </button>
        ${isAdmin ? `
          <button type="button" class="auth-tab-btn ${this.activeTab === 'adminDb' ? 'active' : ''}" data-tab="adminDb">
            🗄️ Quản trị Database
          </button>
        ` : ''}
        <button type="button" class="auth-tab-btn ${this.activeTab === 'quick' ? 'active' : ''}" data-tab="quick">
          👤 Chế độ Khách
        </button>
      `;
    } else {
      tabsContainer.innerHTML = `
        <button type="button" class="auth-tab-btn ${this.activeTab === 'quick' ? 'active' : ''}" data-tab="quick">
          👤 Trải nghiệm Khách
        </button>
        <button type="button" class="auth-tab-btn ${this.activeTab === 'login' ? 'active' : ''}" data-tab="login">
          🔑 Đăng nhập
        </button>
        <button type="button" class="auth-tab-btn ${this.activeTab === 'register' ? 'active' : ''}" data-tab="register">
          📝 Đăng ký
        </button>
      `;
    }

    tabsContainer.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this._renderContent();
      });
    });

    // 2. Render Body Content based on activeTab
    if (user && this.activeTab === 'profile') {
      const userSessions = aiHistoryManager.getUserSessions(user.id);
      const isAdmin = authManager.isAdmin();
      bodyContainer.innerHTML = `
        <div class="auth-profile-card">
          <div class="profile-avatar-large">${user.avatar || (isAdmin ? '👑' : '👨‍🎓')}</div>
          <h4 class="profile-name">${user.fullName}</h4>
          <span class="profile-class-badge">${user.className || 'Toán Rời Rạc Platform'}</span>
          <p class="profile-bio">${user.bio || (isAdmin ? 'Quản trị viên duy nhất của hệ thống' : 'Sinh viên Toán Rời Rạc')}</p>
          
          <div class="profile-info-grid">
            <div class="profile-info-item">
              <span class="info-label">Tên đăng nhập:</span>
              <span class="info-val">@${user.username}</span>
            </div>
            <div class="profile-info-item">
              <span class="info-label">Email:</span>
              <span class="info-val">${user.email}</span>
            </div>
            <div class="profile-info-item">
              <span class="info-label">Vai trò:</span>
              <span class="info-val" style="font-weight:700;color:${isAdmin ? '#f59e0b' : '#3b82f6'};">
                ${isAdmin ? '👑 Quản Trị Viên (Duy nhất)' : (user.role === 'author' ? 'Nhóm tác giả' : '👨‍🎓 Sinh viên')}
              </span>
            </div>
            <div class="profile-info-item">
              <span class="info-label">Lịch sử chat AI:</span>
              <span class="info-val highlight">${userSessions.length} phiên đã lưu</span>
            </div>
          </div>

          <div class="profile-actions">
            ${isAdmin ? `
              <button type="button" class="btn-primary" id="btnGoToAdminDb" style="padding:9px 18px;font-size:13px;background:#f59e0b;border-color:#f59e0b;color:#ffffff;">
                🗄️ Quản Trị Database
              </button>
            ` : ''}
            <button type="button" class="btn-primary" id="btnGoToAiFromProfile" style="padding:9px 18px;font-size:13px;">
              💬 Xem Lịch sử AI
            </button>
            <button type="button" class="btn-danger-outline" id="btnLogoutUser" style="padding:9px 18px;font-size:13px;">
              🚪 Đăng xuất
            </button>
          </div>
        </div>
      `;

      bodyContainer.querySelector('#btnLogoutUser').addEventListener('click', () => {
        authManager.logout();
        this.activeTab = 'quick';
        this._renderContent();
      });

      const btnGoToAdmin = bodyContainer.querySelector('#btnGoToAdminDb');
      if (btnGoToAdmin) {
        btnGoToAdmin.addEventListener('click', () => {
          this.activeTab = 'adminDb';
          this._renderContent();
        });
      }

      const btnGoToAi = bodyContainer.querySelector('#btnGoToAiFromProfile');
      if (btnGoToAi) {
        btnGoToAi.addEventListener('click', () => {
          this.close();
          const navAiBtn = document.querySelector('.nav-btn[data-view="ai"]');
          if (navAiBtn) navAiBtn.click();
        });
      }
      return;
    }

    // 2B. Admin Database Management Tab
    if (user && this.activeTab === 'adminDb') {
      if (!authManager.isAdmin()) {
        this.activeTab = 'profile';
        this._renderContent();
        return;
      }

      const allUsers = authManager.getUsers();
      bodyContainer.innerHTML = `
        <div class="admin-db-panel" style="padding:8px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <div>
              <h4 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;">🗄️ Quản Trị Cơ Sở Dữ Liệu Tài Khoản</h4>
              <p style="margin:0;font-size:12.5px;color:var(--dim);">
                Xem danh sách tất cả tài khoản, cấp tài khoản cho sinh viên hoặc xóa tài khoản thử nghiệm.
              </p>
            </div>
            <span style="font-size:12px;background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:12px;font-weight:600;border:1px solid rgba(245,158,11,0.3);">
              👥 Tổng số: ${allUsers.length} tài khoản
            </span>
          </div>

          <div id="adminDbAlert" class="auth-alert" style="display:none;margin-bottom:12px;"></div>

          <!-- Add User Form -->
          <details style="margin-bottom:16px;background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:10px 14px;">
            <summary style="font-size:13px;font-weight:700;color:var(--accent);cursor:pointer;">➕ Cấp tài khoản sinh viên mới</summary>
            <form id="formAdminAddUser" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;">
              <div>
                <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:3px;">Tên đăng nhập *</label>
                <input type="text" id="adminNewUsername" placeholder="Ví dụ: sv01, user..." required style="width:100%;padding:6px 10px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--text);">
              </div>
              <div>
                <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:3px;">Mật khẩu *</label>
                <input type="password" id="adminNewPassword" placeholder="Mật khẩu..." required style="width:100%;padding:6px 10px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--text);">
              </div>
              <div>
                <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:3px;">Họ và tên sinh viên *</label>
                <input type="text" id="adminNewFullName" placeholder="Họ và tên..." required style="width:100%;padding:6px 10px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--text);">
              </div>
              <div>
                <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:3px;">Lớp / Đơn vị</label>
                <input type="text" id="adminNewClass" placeholder="Sinh viên / Lớp học" value="Sinh viên" style="width:100%;padding:6px 10px;font-size:12.5px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--text);">
              </div>
              <div style="grid-column:1 / -1;display:flex;justify-content:flex-end;">
                <button type="submit" class="btn-primary" style="padding:7px 16px;font-size:12.5px;font-weight:600;">
                  ✓ Tạo tài khoản
                </button>
              </div>
            </form>
          </details>

          <!-- Users Table -->
          <div style="overflow-x:auto;max-height:280px;border:1px solid var(--line);border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:left;">
              <thead style="background:var(--panel-alt);position:sticky;top:0;z-index:2;">
                <tr style="border-bottom:1px solid var(--line);">
                  <th style="padding:8px 10px;">Người dùng</th>
                  <th style="padding:8px 10px;">Username</th>
                  <th style="padding:8px 10px;">Vai trò</th>
                  <th style="padding:8px 10px;">Lớp / Email</th>
                  <th style="padding:8px 10px;text-align:center;">Hành động</th>
                </tr>
              </thead>
              <tbody>
                ${allUsers.map(u => {
                  const isUserAdmin = u.username === 'admin' || u.role === 'admin' || u.id === 'user_admin';
                  return `
                    <tr style="border-bottom:1px solid var(--line);background:${isUserAdmin ? 'rgba(245,158,11,0.05)' : 'transparent'};">
                      <td style="padding:8px 10px;">
                        <span style="font-size:16px;margin-right:6px;">${u.avatar || '👤'}</span>
                        <strong>${u.fullName}</strong>
                      </td>
                      <td style="padding:8px 10px;"><code>@${u.username}</code></td>
                      <td style="padding:8px 10px;">
                        <span style="font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;background:${isUserAdmin ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.15)'};color:${isUserAdmin ? '#f59e0b' : '#3b82f6'};">
                          ${isUserAdmin ? '👑 Admin' : '👨‍🎓 Sinh viên'}
                        </span>
                      </td>
                      <td style="padding:8px 10px;color:var(--dim);font-size:12px;">
                        ${u.className || u.email}
                      </td>
                      <td style="padding:8px 10px;text-align:center;">
                        ${isUserAdmin ? `
                          <span style="font-size:11px;color:var(--dim);font-style:italic;">Admin gốc</span>
                        ` : `
                          <button type="button" class="btn-admin-delete-user" data-user-id="${u.id}" data-user-name="${u.fullName}" style="padding:3px 8px;font-size:11.5px;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:4px;cursor:pointer;">
                            🗑️ Xóa
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Bind Admin DB Events
      const formAdd = bodyContainer.querySelector('#formAdminAddUser');
      if (formAdd) {
        formAdd.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = bodyContainer.querySelector('#adminNewUsername').value;
          const password = bodyContainer.querySelector('#adminNewPassword').value;
          const fullName = bodyContainer.querySelector('#adminNewFullName').value;
          const className = bodyContainer.querySelector('#adminNewClass').value;
          const alertBox = bodyContainer.querySelector('#adminDbAlert');

          const res = authManager.adminCreateUser({ username, fullName, className, password });
          if (res.success) {
            try {
              await cloudSyncManager.adminCreateUser({ username, fullName, className, password });
            } catch {}
            this._renderContent();
          } else {
            alertBox.textContent = res.error;
            alertBox.style.display = 'block';
          }
        });
      }

      bodyContainer.querySelectorAll('.btn-admin-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const targetId = btn.getAttribute('data-user-id');
          const targetName = btn.getAttribute('data-user-name') || targetId;
          if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Xóa tài khoản sinh viên "${targetName}" khỏi hệ thống?`)) {
            return;
          }
          const res = authManager.deleteUser(targetId);
          if (res.success) {
            try {
              await cloudSyncManager.adminDeleteUser(targetId);
            } catch {}
            this._renderContent();
          } else {
            const alertBox = bodyContainer.querySelector('#adminDbAlert');
            if (alertBox) {
              alertBox.textContent = res.error;
              alertBox.style.display = 'block';
            }
          }
        });
      });
      return;
    }

    if (this.activeTab === 'quick') {
      bodyContainer.innerHTML = `
        <div class="auth-quick-section" style="text-align:center;padding:12px 6px;">
          <div style="font-size:46px;margin-bottom:10px;">👤</div>
          <h4 style="font-size:16px;font-weight:700;color:var(--text);margin:0 0 8px 0;">Trải Nghiệm Chế Độ Khách (Guest Mode)</h4>
          <p class="auth-hint-text" style="font-size:13px;color:var(--dim);margin:0 auto 16px auto;max-width:380px;line-height:1.5;">
            Sử dụng đầy đủ mọi tính năng: 4 phòng Lab thực nghiệm, mô phỏng thuật toán đồ thị và hỏi đáp AI không cần đăng nhập.
          </p>
          <div style="background:rgba(245,158,11,0.08);border:1px dashed rgba(245,158,11,0.35);border-radius:8px;padding:10px 14px;margin:0 auto 20px auto;max-width:380px;font-size:12px;color:var(--accent);line-height:1.5;text-align:left;">
            ⚠️ <strong>Lưu ý:</strong> Chế độ khách sẽ <strong>không lưu lại lịch sử thi trắc nghiệm và điểm số</strong> lên bảng xếp hạng hệ thống.
          </div>
          <button type="button" class="btn-primary" id="btnGuestContinue" style="width:100%;max-width:380px;padding:10px 20px;font-size:13.5px;font-weight:700;border-radius:8px;cursor:pointer;">
            ${user ? 'Chuyển sang Chế độ Khách →' : 'Tiếp tục với Chế độ Khách →'}
          </button>
        </div>
      `;

      const btnGuest = bodyContainer.querySelector('#btnGuestContinue');
      if (btnGuest) {
        btnGuest.addEventListener('click', () => {
          authManager.logout();
          this.close();
        });
      }
      return;
    }

    if (this.activeTab === 'login') {
      bodyContainer.innerHTML = `
        <form class="auth-form" id="formLogin">
          <div id="authAlert" class="auth-alert" style="display:none;"></div>

          <div class="auth-field">
            <label for="loginUsername">Tên đăng nhập hoặc Email</label>
            <input type="text" id="loginUsername" placeholder="Nhập tên đăng nhập hoặc email..." required autocomplete="username">
          </div>

          <div class="auth-field">
            <label for="loginPassword">Mật khẩu</label>
            <input type="password" id="loginPassword" placeholder="Nhập mật khẩu..." required autocomplete="current-password">
          </div>

          <button type="submit" class="btn-primary auth-submit-btn">
            Đăng Nhập
          </button>
        </form>
      `;

      bodyContainer.querySelector('#formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = bodyContainer.querySelector('#loginUsername').value;
        const password = bodyContainer.querySelector('#loginPassword').value;
        const alertBox = bodyContainer.querySelector('#authAlert');

        // 1. Check local users first
        const localResult = authManager.login(username, password);
        if (localResult.success) {
          this.close();
          return;
        }

        // 2. If not found locally, query backend server API
        try {
          const remoteResult = await cloudSyncManager.login(username, password);
          if (remoteResult && remoteResult.success && remoteResult.user) {
            // Adopt into local storage so subsequent logins are instant
            const users = authManager.getUsers();
            if (!users.some(u => u.id === remoteResult.user.id)) {
              users.push({ ...remoteResult.user, password });
              if (authManager.storage) {
                try {
                  authManager.storage.setItem('trr_registered_users', JSON.stringify(users));
                } catch {}
              }
            }
            authManager.currentUser = { ...remoteResult.user };
            authManager._persistCurrent();
            authManager._notifyListeners('login', authManager.currentUser);
            this.close();
            return;
          }
          if (remoteResult && remoteResult.error) {
            alertBox.textContent = remoteResult.error;
            alertBox.style.display = 'block';
            return;
          }
        } catch {}

        alertBox.textContent = localResult.error;
        alertBox.style.display = 'block';
      });
      return;
    }

    if (this.activeTab === 'register') {
      bodyContainer.innerHTML = `
        <form class="auth-form" id="formRegister">
          <div id="authAlert" class="auth-alert" style="display:none;"></div>

          <div class="auth-field">
            <label for="regFullName">Họ và tên</label>
            <input type="text" id="regFullName" placeholder="Ví dụ: Nguyễn Văn A" required>
          </div>

          <div class="auth-field">
            <label for="regUsername">Tên đăng nhập</label>
            <input type="text" id="regUsername" placeholder="Ít nhất 3 ký tự (chữ thường)..." required>
          </div>

          <div class="auth-field">
            <label for="regEmail">Email</label>
            <input type="email" id="regEmail" placeholder="sinhvien@email.edu.vn" required>
          </div>

          <div class="auth-field">
            <label for="regPassword">Mật khẩu</label>
            <input type="password" id="regPassword" placeholder="Ít nhất 4 ký tự..." required autocomplete="new-password">
          </div>

          <button type="submit" class="btn-primary auth-submit-btn">
            Tạo Tài Khoản &amp; Đăng Nhập
          </button>
        </form>
      `;

      bodyContainer.querySelector('#formRegister').addEventListener('submit', (e) => {
        e.preventDefault();
        const fullName = bodyContainer.querySelector('#regFullName').value;
        const username = bodyContainer.querySelector('#regUsername').value;
        const email = bodyContainer.querySelector('#regEmail').value;
        const password = bodyContainer.querySelector('#regPassword').value;
        const alertBox = bodyContainer.querySelector('#authAlert');

        const result = authManager.register({ fullName, username, email, password });
        if (result.success) {
          try {
            cloudSyncManager.pushRegister({ fullName, username, email, password });
          } catch {}
          this.close();
        } else {
          alertBox.textContent = result.error;
          alertBox.style.display = 'block';
        }
      });
    }
  }
}
