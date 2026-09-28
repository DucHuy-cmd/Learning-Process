/**
 * @file AuthModal.js
 * User Authentication & Profile Modal Dialog.
 * 
 * Provides:
 * - 1-Click Fast Login for K66 CNTT team members (Đức Huy, Nhất Vũ, Trường Vũ, Ngọc Hưng) & Teachers.
 * - Standard Login & Registration forms with validation.
 * - User Profile details and Account Switcher.
 */

import { authManager, DEMO_USERS } from '../../core/auth/AuthManager.js';
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
              <span class="auth-modal-sub">Toán Rời Rạc Platform • K66 CNTT</span>
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
      tabsContainer.innerHTML = `
        <button type="button" class="auth-tab-btn active" data-tab="profile">
          👤 Hồ sơ cá nhân
        </button>
        <button type="button" class="auth-tab-btn" data-tab="quick">
          🔄 Đổi tài khoản
        </button>
      `;
    } else {
      tabsContainer.innerHTML = `
        <button type="button" class="auth-tab-btn ${this.activeTab === 'quick' ? 'active' : ''}" data-tab="quick">
          ⚡ Đăng nhập 1 chạm
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
      bodyContainer.innerHTML = `
        <div class="auth-profile-card">
          <div class="profile-avatar-large">${user.avatar || '🎓'}</div>
          <h4 class="profile-name">${user.fullName}</h4>
          <span class="profile-class-badge">${user.className || 'Khóa 66 Công nghệ thông tin'}</span>
          <p class="profile-bio">${user.bio || 'Học viên Toán Rời Rạc Platform'}</p>
          
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
              <span class="info-val">${user.role === 'author' ? 'Nhóm tác giả K66' : (user.role === 'teacher' ? 'Giảng viên' : 'Sinh viên')}</span>
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
        <div class="auth-quick-section">
          <p class="auth-hint-text">
            Chọn nhanh tài khoản tác giả Đức Huy hoặc Giảng viên để trải nghiệm ngay mà không cần tạo mới:
          </p>
          <div class="demo-accounts-grid">
            ${DEMO_USERS.map(u => `
              <button type="button" class="demo-account-pill ${user && user.id === u.id ? 'current' : ''}" data-user-id="${u.id}">
                <span class="demo-avatar">${u.avatar}</span>
                <div class="demo-meta">
                  <span class="demo-name">${u.fullName}</span>
                  <span class="demo-sub">${u.role === 'teacher' ? 'Giảng viên' : 'K66 CNTT'}</span>
                </div>
                ${user && user.id === u.id ? '<span class="demo-check">✓ Đang dùng</span>' : '<span class="demo-arrow">➔</span>'}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      bodyContainer.querySelectorAll('.demo-account-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const userId = pill.getAttribute('data-user-id');
          authManager.quickLogin(userId);
          this.close();
        });
      });
      return;
    }

    if (this.activeTab === 'login') {
      bodyContainer.innerHTML = `
        <form class="auth-form" id="formLogin">
          <div id="authAlert" class="auth-alert" style="display:none;"></div>

          <div class="auth-field">
            <label for="loginUsername">Tên đăng nhập hoặc Email</label>
            <input type="text" id="loginUsername" placeholder="duchuy hoặc email..." required autocomplete="username">
          </div>

          <div class="auth-field">
            <label for="loginPassword">Mật khẩu</label>
            <input type="password" id="loginPassword" placeholder="Nhập mật khẩu (Demo: 123456)..." required autocomplete="current-password">
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
            <input type="email" id="regEmail" placeholder="sinhvien@k66.edu.vn" required>
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
