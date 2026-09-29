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
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'Enter') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'BUTTON' && activeTag !== 'A') {
          const activeForm = this.domElement.querySelector('form');
          if (activeForm) {
            const submitBtn = activeForm.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
            }
          }
        }
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
          <span class="profile-class-badge">${user.className || (isAdmin ? 'Quản trị viên' : 'Sinh viên')}</span>
          <p class="profile-bio">${user.bio || (isAdmin ? 'Quản trị viên hệ thống' : 'Sinh viên Toán Rời Rạc')}</p>
          
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
                ${isAdmin ? '👑 Quản trị viên' : (user.role === 'author' ? 'Nhóm tác giả' : '👨‍🎓 Sinh viên')}
              </span>
            </div>
            <div class="profile-info-item">
              <span class="info-label">Lịch sử chat AI:</span>
              <span class="info-val highlight">${userSessions.length} phiên đã lưu</span>
            </div>
          </div>

          <div class="profile-actions">
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
            <input type="password" id="loginPassword" placeholder="Nhập mật khẩu..." required autocomplete="current-password" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellcheck="false">
          </div>

          <button type="submit" class="btn-primary auth-submit-btn">
            Đăng Nhập
          </button>
        </form>
      `;

      bodyContainer.querySelector('#formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = bodyContainer.querySelector('#loginUsername').value.trim();
        const password = bodyContainer.querySelector('#loginPassword').value;
        const alertBox = bodyContainer.querySelector('#authAlert');

        // 1. If not admin and server is connected, verify against authoritative server first
        if (username.toLowerCase() !== 'admin') {
          try {
            const isOnline = await cloudSyncManager.checkConnection();
            if (isOnline) {
              const remoteResult = await cloudSyncManager.login(username, password);
              if (remoteResult && remoteResult.success && remoteResult.user) {
                // Verified active user on server -> sync into local
                const users = authManager.getUsers();
                const idx = users.findIndex(u => u.id === remoteResult.user.id || u.username.toLowerCase() === username.toLowerCase());
                if (idx === -1) {
                  users.push({ ...remoteResult.user, password });
                } else {
                  users[idx] = { ...users[idx], ...remoteResult.user, password };
                }
                if (authManager.storage) {
                  try {
                    authManager.storage.setItem('trr_registered_users', JSON.stringify(users));
                  } catch {}
                }
                authManager.currentUser = { ...remoteResult.user };
                authManager._persistCurrent();
                authManager._notifyListeners('login', authManager.currentUser);
                this.close();
                return;
              } else if (remoteResult && remoteResult.error) {
                // Server rejected -> if user was deleted on server, purge locally as well
                if (remoteResult.error.includes('không tồn tại')) {
                  authManager.deleteUser(username, username);
                }
                alertBox.textContent = remoteResult.error;
                alertBox.style.display = 'block';
                return;
              }
            }
          } catch {}
        }

        // 2. Local check (for admin or offline mode)
        const localResult = authManager.login(username, password);
        if (localResult.success) {
          this.close();
          return;
        }

        alertBox.textContent = localResult.error;
        alertBox.style.display = 'block';
      });

      const firstInp = bodyContainer.querySelector('#loginUsername');
      if (firstInp) setTimeout(() => firstInp.focus(), 60);
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
            <input type="password" id="regPassword" placeholder="Ít nhất 4 ký tự..." required autocomplete="new-password" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" spellcheck="false">
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
            cloudSyncManager.pushRegister({ id: result.user?.id, fullName, username, email, password });
          } catch {}
          this.close();
        } else {
          alertBox.textContent = result.error;
          alertBox.style.display = 'block';
        }
      });

      const firstInp = bodyContainer.querySelector('#regFullName');
      if (firstInp) setTimeout(() => firstInp.focus(), 60);
    }
  }
}
