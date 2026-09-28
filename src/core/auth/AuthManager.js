/**
 * @file AuthManager.js
 * Client-Side Authentication & User State Management for Toán Rời Rạc Platform.
 * 
 * Features:
 * - Offline-first LocalStorage persistence with optional backend synchronization.
 * - Pre-configured accounts for author & system administration.
 * - Registration, Login, Logout, Profile update.
 * - Reactive event subscriptions (onAuthStateChanged).
 */

export const DEMO_USERS = [
  {
    id: 'user_admin',
    username: 'admin',
    fullName: 'Quản Trị Viên (Thầy/Cô)',
    className: 'Khoa CNTT - Giảng viên & Quản trị',
    email: 'admin@toanrr.edu.vn',
    password: 'admin123',
    avatar: '👑',
    role: 'admin',
    bio: 'Quản trị viên duy nhất của hệ thống • Giảng viên Toán Rời Rạc',
  },
  {
    id: 'user_duchuy',
    username: 'duchuy',
    fullName: 'Đức Huy',
    className: 'Sinh viên',
    email: 'duchuy@toanrr.edu.vn',
    password: '123456',
    avatar: '👨‍🎓',
    role: 'student',
    bio: 'Tác giả • Sinh viên Toán Rời Rạc',
  },
];

const STORAGE_KEY_CURRENT = 'trr_current_user';
const STORAGE_KEY_USERS = 'trr_registered_users';

export class AuthManager {
  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage] - Defaults to window.localStorage
   */
  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this.currentUser = null;
    this.listeners = new Set();

    this._initStorage();
  }

  /**
   * Initializes default demo users in storage if not already present.
   * Cleans out obsolete accounts and ensures exactly 1 single Admin account.
   * @private
   */
  _initStorage() {
    if (!this.storage) return;

    try {
      const storedUsers = this.storage.getItem(STORAGE_KEY_USERS);
      if (!storedUsers) {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEMO_USERS));
      } else {
        try {
          const list = JSON.parse(storedUsers);
          if (Array.isArray(list)) {
            // Clean out legacy demo accounts
            const legacyIds = new Set(['user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
            let filtered = list.filter(u => !legacyIds.has(u.id));

            // Ensure single admin is always present
            const adminIdx = filtered.findIndex(u => u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin');
            if (adminIdx === -1) {
              filtered.unshift({ ...DEMO_USERS[0] });
            } else {
              // Guarantee role is 'admin' and username is 'admin'
              filtered[adminIdx] = { ...DEMO_USERS[0], ...filtered[adminIdx], role: 'admin', username: 'admin' };
            }

            // Ensure author duchuy is present
            if (!filtered.some(u => u.username === 'duchuy' || u.id === 'user_duchuy')) {
              filtered.push({ ...DEMO_USERS[1] });
            }

            // Ensure no other accounts have admin role
            filtered = filtered.map(u => {
              if (u.username !== 'admin' && u.id !== 'user_admin' && u.role === 'admin') {
                return { ...u, role: 'student' };
              }
              return u;
            });

            this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered));
          }
        } catch {}
      }

      const activeUser = this.storage.getItem(STORAGE_KEY_CURRENT);
      if (activeUser) {
        this.currentUser = JSON.parse(activeUser);
      }
    } catch {
      // Fallback for restricted storage environments
      this.currentUser = null;
    }
  }

  /**
   * Returns all registered users (demo + custom registered).
   * @returns {Array<Object>}
   */
  getUsers() {
    if (!this.storage) return [...DEMO_USERS];
    try {
      const data = this.storage.getItem(STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : [...DEMO_USERS];
    } catch {
      return [...DEMO_USERS];
    }
  }

  /**
   * Returns current logged in user, or null if guest.
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Checks whether a user is currently authenticated.
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.currentUser !== null;
  }

  /**
   * Checks whether the current active user is the single Admin.
   * @returns {boolean}
   */
  isAdmin() {
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'admin' || this.currentUser.username?.toLowerCase() === 'admin')
    );
  }

  /**
   * 1-Click Fast Login for Demo Accounts.
   * @param {string} userId - e.g. 'user_admin' or 'user_duchuy'
   * @returns {{ success: boolean, user?: Object, error?: string }}
   */
  quickLogin(userId) {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId || u.username === userId);
    if (!target) {
      return { success: false, error: 'Không tìm thấy tài khoản tương ứng.' };
    }

    this.currentUser = { ...target };
    this._persistCurrent();
    this._notifyListeners('login', this.currentUser);
    return { success: true, user: this.currentUser };
  }

  /**
   * Deletes a user account from LocalStorage database.
   * Restricted to Admin only. Cannot delete the single Admin account.
   * @param {string} userId
   * @returns {{ success: boolean, error?: string, deletedUser?: Object }}
   */
  deleteUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên (admin) mới có quyền xóa tài khoản.' };
    }
    if (userId === 'user_admin' || userId === 'admin') {
      return { success: false, error: 'Không thể xóa tài khoản Quản trị viên duy nhất.' };
    }

    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId || u.username === userId);
    if (index === -1) {
      return { success: false, error: 'Không tìm thấy tài khoản cần xóa.' };
    }

    const deleted = users.splice(index, 1)[0];
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch {
        return { success: false, error: 'Lỗi cập nhật bộ nhớ trình duyệt.' };
      }
    }

    this._notifyListeners('user_deleted', { deletedUser: deleted, users });
    return { success: true, deletedUser: deleted };
  }

  /**
   * Admin creates a new student account.
   * @param {Object} data
   * @returns {{ success: boolean, error?: string, user?: Object }}
   */
  adminCreateUser({ username, fullName, className = 'Sinh viên', email, password = '123', avatar = '👤' }) {
    if (!this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên (admin) mới có quyền cấp tài khoản.' };
    }
    if (!username || username.trim().length < 3) {
      return { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' };
    }
    if (!fullName || fullName.trim().length < 2) {
      return { success: false, error: 'Vui lòng nhập họ và tên đầy đủ.' };
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanUsername}@toanrr.edu.vn`;
    const users = this.getUsers();

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Tên đăng nhập đã tồn tại trong hệ thống.' };
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: cleanUsername,
      fullName: fullName.trim(),
      className: className.trim(),
      email: cleanEmail,
      password: password || '123456',
      avatar: avatar || '👨‍🎓',
      role: 'student',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch {
        return { success: false, error: 'Lỗi bộ nhớ khi lưu tài khoản.' };
      }
    }

    this._notifyListeners('user_created', { newUser, users });
    return { success: true, user: newUser };
  }

  /**
   * Log in with username/email and password.
   * For demo users, password can be '123456' or any non-empty password.
   * @param {string} usernameOrEmail
   * @param {string} password
   * @returns {{ success: boolean, user?: Object, error?: string }}
   */
  login(usernameOrEmail, password) {
    if (!usernameOrEmail || !usernameOrEmail.trim()) {
      return { success: false, error: 'Vui lòng nhập tên đăng nhập hoặc email.' };
    }
    if (!password || !password.trim()) {
      return { success: false, error: 'Vui lòng nhập mật khẩu.' };
    }

    const query = usernameOrEmail.trim().toLowerCase();
    const users = this.getUsers();
    const found = users.find(
      u => u.username.toLowerCase() === query || u.email.toLowerCase() === query
    );

    if (!found) {
      return { success: false, error: 'Tài khoản không tồn tại. Vui lòng kiểm tra lại hoặc Đăng ký mới.' };
    }

    // Verify password if stored (demo accounts accept their predefined passwords)
    const isValidDemoPass = (found.username === 'admin' && (password === 'admin123' || password === '123456')) ||
                            (found.username === 'duchuy' && (password === '123456' || password === 'duchuy'));
    if (!isValidDemoPass && found.password && found.password !== password) {
      return { success: false, error: 'Mật khẩu không chính xác.' };
    }

    this.currentUser = { ...found };
    delete this.currentUser.password; // Do not expose password hash in memory

    this._persistCurrent();
    this._notifyListeners('login', this.currentUser);
    return { success: true, user: this.currentUser };
  }

  /**
   * Registers a new student or teacher account.
   * @param {Object} data
   * @param {string} data.username
   * @param {string} data.fullName
   * @param {string} [data.className]
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} [data.avatar]
   * @returns {{ success: boolean, user?: Object, error?: string }}
   */
  register({ username, fullName, className = 'Sinh viên', email, password, avatar = '👤' }) {
    if (!username || username.trim().length < 3) {
      return { success: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' };
    }
    if (!fullName || fullName.trim().length < 2) {
      return { success: false, error: 'Vui lòng nhập họ và tên đầy đủ.' };
    }
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Địa chỉ email không hợp lệ.' };
    }
    if (!password || password.length < 4) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 4 ký tự.' };
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.' };
    }
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Địa chỉ email đã được đăng ký.' };
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: cleanUsername,
      fullName: fullName.trim(),
      className: className.trim(),
      email: cleanEmail,
      password,
      avatar,
      role: 'student',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch {
        return { success: false, error: 'Bộ nhớ trình duyệt đầy, không thể lưu tài khoản.' };
      }
    }

    // Auto-login newly registered user
    const publicUser = { ...newUser };
    delete publicUser.password;
    this.currentUser = publicUser;
    this._persistCurrent();
    this._notifyListeners('register', this.currentUser);

    return { success: true, user: this.currentUser };
  }

  /**
   * Log out current user and return to Guest mode.
   */
  logout() {
    const prevUser = this.currentUser;
    this.currentUser = null;
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY_CURRENT);
      } catch {
        // no-op
      }
    }
    this._notifyListeners('logout', prevUser);
  }

  /**
   * Subscribes to auth state changes (login, register, logout).
   * @param {Function} callback - (event, user) => void
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChanged(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Alias for onAuthStateChanged
   * @param {Function} callback
   */
  subscribe(callback) {
    return this.onAuthStateChanged(callback);
  }

  /**
   * @private
   */
  _persistCurrent() {
    if (!this.storage) return;
    try {
      if (this.currentUser) {
        this.storage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(this.currentUser));
      } else {
        this.storage.removeItem(STORAGE_KEY_CURRENT);
      }
    } catch {
      // storage unavailable
    }
  }

  /**
   * @private
   */
  _notifyListeners(event, user) {
    for (const listener of this.listeners) {
      try {
        listener(event, user);
      } catch (err) {
        console.error('[AuthManager] Listener error:', err);
      }
    }
  }
}

// Global Singleton for easy app-wide sharing
export const authManager = new AuthManager();
