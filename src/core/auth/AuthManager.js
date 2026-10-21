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
    fullName: 'Quản Trị Viên',
    className: 'Quản trị viên',
    email: 'admin@toanrr.edu.vn',
    password: '2HV6868@',
    avatar: '👑',
    role: 'admin',
    bio: 'Quản trị viên hệ thống',
  },
];

export const STORAGE_KEY_CURRENT = 'trr_current_user';
export const STORAGE_KEY_USERS = 'trr_registered_users';
export const STORAGE_KEY_DELETED = 'trr_deleted_users_v1';
export const STORAGE_KEY_DB_RESET = 'trr_last_db_reset';

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
   * Retrieves the set of permanently deleted user identifiers (id, username, email).
   * @returns {string[]}
   */
  getDeletedUsers() {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY_DELETED);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /**
   * Marks an identifier as permanently deleted in local storage and removes matching user.
   * @param {string} identifier
   */
  markDeletedLocally(identifier) {
    if (!identifier || !this.storage) return;
    const clean = String(identifier).trim().toLowerCase();
    if (clean === 'admin' || clean === 'user_admin') return;

    try {
      const current = this.getDeletedUsers();
      if (!current.includes(clean)) {
        current.push(clean);
        this.storage.setItem(STORAGE_KEY_DELETED, JSON.stringify(current));
      }

      // Purge matching user from registered list
      const users = this.getUsers();
      const remaining = users.filter(u => 
        u.id?.toLowerCase() !== clean && 
        u.username?.toLowerCase() !== clean && 
        u.email?.toLowerCase() !== clean
      );
      if (remaining.length !== users.length) {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(remaining));
      }

      // If active user is deleted, logout immediately
      if (this.currentUser && (
        this.currentUser.id?.toLowerCase() === clean ||
        this.currentUser.username?.toLowerCase() === clean ||
        this.currentUser.email?.toLowerCase() === clean
      )) {
        this.logout();
      }
    } catch {}
  }

  /**
   * Removes an identifier from the deleted tombstone list (e.g. when admin re-creates account).
   * @param {string} identifier
   */
  unmarkDeletedLocally(identifier) {
    if (!identifier || !this.storage) return;
    const clean = String(identifier).trim().toLowerCase();
    try {
      const current = this.getDeletedUsers();
      const updated = current.filter(x => x !== clean);
      this.storage.setItem(STORAGE_KEY_DELETED, JSON.stringify(updated));
    } catch {}
  }

  /**
   * Checks whether an identifier is marked as deleted in local storage.
   * @param {string} identifier
   * @returns {boolean}
   */
  isLocallyDeleted(identifier) {
    if (!identifier) return false;
    const clean = String(identifier).trim().toLowerCase();
    return this.getDeletedUsers().includes(clean);
  }

  /**
   * Safe public method to purge a deleted user locally.
   * @param {string} query
   */
  deleteUserLocally(query) {
    this.markDeletedLocally(query);
  }

  /**
   * Resets a student's password to default '123456' or specified password. Restricted to admin.
   * @param {string} userIdOrUsername
   * @param {string} [newPassword='123456']
   * @returns {{ success: boolean, error?: string, user?: Object }}
   */
  adminResetPassword(userIdOrUsername, newPassword = '123456') {
    if (!this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên mới có quyền đặt lại mật khẩu.' };
    }
    const clean = String(userIdOrUsername || '').trim().toLowerCase();
    if (clean === 'admin' || clean === 'user_admin') {
      return { success: false, error: 'Không thể reset mật khẩu tài khoản Quản trị viên gốc qua tính năng này.' };
    }
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id?.toLowerCase() === clean || u.username?.toLowerCase() === clean);
    if (idx === -1) {
      return { success: false, error: 'Không tìm thấy tài khoản sinh viên.' };
    }
    const targetPassword = String(newPassword || '123456').trim();
    users[idx].password = targetPassword;
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch {}
    }
    return { success: true, user: users[idx] };
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
            // Clean out legacy accounts and ensure only valid accounts
            const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
            let filtered = list.filter(u => !legacyIds.has(u.id) && u.username !== 'duchuy');

            // Ensure single admin is always present
            const adminIdx = filtered.findIndex(u => u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin');
            if (adminIdx === -1) {
              filtered.unshift({ ...DEMO_USERS[0] });
            } else {
              filtered[adminIdx] = {
                ...filtered[adminIdx],
                ...DEMO_USERS[0],
                fullName: 'Quản Trị Viên',
                className: 'Quản trị viên',
                bio: 'Quản trị viên hệ thống',
                role: 'admin',
                username: 'admin',
              };
            }

            // Ensure no other accounts have admin role and strip (Thầy/Cô)
            filtered = filtered.map(u => {
              if (u.username === 'admin' || u.id === 'user_admin') {
                return {
                  ...u,
                  ...DEMO_USERS[0],
                  fullName: 'Quản Trị Viên',
                  className: 'Quản trị viên',
                  bio: 'Quản trị viên hệ thống',
                  role: 'admin',
                  username: 'admin',
                  password: DEMO_USERS[0].password,
                };
              }
              const clean = { ...u };
              if (clean.role === 'admin') clean.role = 'student';
              if (clean.fullName) {
                clean.fullName = clean.fullName.replace(/\s*\(Thầy\/Cô\)/gi, '').replace(/\s*\(Cô\)/gi, '').replace(/\s*\(Thầy\)/gi, '').trim();
              }
              return clean;
            });

            // Filter out locally deleted users
            const deletedList = this.getDeletedUsers();
            if (deletedList.length > 0) {
              const deletedSet = new Set(deletedList);
              filtered = filtered.filter(u => 
                !deletedSet.has(u.id?.toLowerCase()) && 
                !deletedSet.has(u.username?.toLowerCase()) &&
                (!u.email || !deletedSet.has(u.email?.toLowerCase()))
              );
            }

            this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(filtered));
          }
        } catch {
          this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEMO_USERS));
        }
      }

      const activeUser = this.storage.getItem(STORAGE_KEY_CURRENT);
      if (activeUser) {
        try {
          const parsed = JSON.parse(activeUser);
          if (parsed && (parsed.id === 'user_admin' || parsed.username === 'admin')) {
            this.currentUser = { ...parsed, ...DEMO_USERS[0], role: 'admin', username: 'admin' };
            delete this.currentUser.password;
            this.storage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(this.currentUser));
          } else if (parsed && parsed.id) {
            // Check if user still exists in registered list and is not deleted
            const isDel = this.isLocallyDeleted(parsed.id) || this.isLocallyDeleted(parsed.username);
            const currentUsers = JSON.parse(this.storage.getItem(STORAGE_KEY_USERS) || '[]');
            const stillValid = !isDel && Array.isArray(currentUsers) && currentUsers.some(u => u.id === parsed.id || u.username === parsed.username);
            if (stillValid && parsed.id !== 'user_duchuy' && parsed.username !== 'duchuy') {
              this.currentUser = parsed;
            } else {
              this.currentUser = null;
              this.storage.removeItem(STORAGE_KEY_CURRENT);
            }
          } else {
            this.currentUser = null;
            this.storage.removeItem(STORAGE_KEY_CURRENT);
          }
        } catch {
          this.currentUser = null;
          this.storage.removeItem(STORAGE_KEY_CURRENT);
        }
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
      const list = data ? JSON.parse(data) : [...DEMO_USERS];
      return list.map(u => {
        if (u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin') {
          return {
            ...u,
            fullName: 'Quản Trị Viên',
            className: 'Quản trị viên',
            bio: 'Quản trị viên hệ thống',
            role: 'admin',
          };
        }
        if (u.fullName) {
          u.fullName = u.fullName.replace(/\s*\(Thầy\/Cô\)/gi, '').replace(/\s*\(Cô\)/gi, '').replace(/\s*\(Thầy\)/gi, '').trim();
        }
        return u;
      });
    } catch {
      return [...DEMO_USERS];
    }
  }

  /**
   * Returns current logged in user, or null if guest.
   * @returns {Object|null}
   */
  getCurrentUser() {
    if (this.currentUser && (this.currentUser.username === 'admin' || this.currentUser.id === 'user_admin' || this.currentUser.role === 'admin')) {
      this.currentUser.fullName = 'Quản Trị Viên';
      this.currentUser.className = 'Quản trị viên';
      this.currentUser.bio = 'Quản trị viên hệ thống';
      this.currentUser.role = 'admin';
    }
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
   * @param {string} [username]
   * @returns {{ success: boolean, error?: string, deletedUser?: Object }}
   */
  deleteUser(userId, username = '') {
    if (!this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên (admin) mới có quyền xóa tài khoản.' };
    }
    if (userId === 'user_admin' || userId === 'admin' || username === 'admin') {
      return { success: false, error: 'Không thể xóa tài khoản Quản trị viên duy nhất.' };
    }

    const targetLower = String(userId || '').trim().toLowerCase();
    const userLower = String(username || '').trim().toLowerCase();
    const users = this.getUsers();

    const matched = users.filter(u => 
      u.id === userId || 
      u.username.toLowerCase() === targetLower ||
      (userLower && u.username.toLowerCase() === userLower)
    );

    const remaining = users.filter(u => 
      u.id !== userId && 
      u.username.toLowerCase() !== targetLower &&
      (!userLower || u.username.toLowerCase() !== userLower)
    );

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(remaining));
      } catch {
        return { success: false, error: 'Lỗi cập nhật bộ nhớ trình duyệt.' };
      }
    }

    // Record tombstones locally
    if (userId) this.markDeletedLocally(userId);
    if (username) this.markDeletedLocally(username);
    if (matched[0]?.email) this.markDeletedLocally(matched[0].email);

    // If the active user itself is deleted, immediately clear session and notify logout
    if (this.currentUser && (
      this.currentUser.id === userId || 
      this.currentUser.username.toLowerCase() === targetLower ||
      (userLower && this.currentUser.username.toLowerCase() === userLower)
    )) {
      this.currentUser = null;
      if (this.storage) {
        try {
          this.storage.removeItem(STORAGE_KEY_CURRENT);
        } catch {}
      }
      this._notifyListeners('logout', null);
    }

    this._notifyListeners('user_deleted', { deletedUser: matched[0] || { id: userId, username }, users: remaining });
    return { success: true, deletedUser: matched[0] };
  }

  /**
   * Resets users list to only the default admin account.
   * @param {Object} [options]
   * @param {boolean} [options.force] - Allow internal sync override
   * @returns {{ success: boolean, error?: string }}
   */
  resetUsersToDefault({ force = false } = {}) {
    if (!force && !this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên mới có quyền reset dữ liệu tài khoản.' };
    }
    const currentUsers = this.getUsers();
    // On a full reset to default, clear deletion tombstones so clean new accounts can be added
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_DELETED, JSON.stringify([]));
      } catch {}
    }

    const admin = currentUsers.find(u => u.username === 'admin' || u.id === 'user_admin') || DEMO_USERS[0];
    const defaultList = [{ ...admin, fullName: 'Quản Trị Viên', className: 'Quản trị viên', role: 'admin' }];
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(defaultList));
        this.storage.setItem(STORAGE_KEY_DB_RESET, String(Date.now()));
      } catch {}
    }
    if (this.currentUser && this.currentUser.username !== 'admin' && this.currentUser.id !== 'user_admin') {
      this.currentUser = null;
      if (this.storage) {
        try {
          this.storage.removeItem(STORAGE_KEY_CURRENT);
        } catch {}
      }
      this._notifyListeners('logout', null);
    }
    this._notifyListeners('users_reset', { users: defaultList });
    return { success: true };
  }

  /**
   * Admin creates a new student account.
   * @param {Object} data
   * @returns {{ success: boolean, error?: string, user?: Object }}
   */
  adminCreateUser({ id, username, fullName, className = 'Sinh viên', email, password = '123', avatar = '👤' } = {}) {
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
    const cleanPassword = (password && String(password).trim()) ? String(password).trim() : '123456';

    // Clear any previous deletion tombstone
    this.unmarkDeletedLocally(cleanUsername);
    if (cleanEmail) this.unmarkDeletedLocally(cleanEmail);
    if (id) this.unmarkDeletedLocally(id);

    const users = this.getUsers();

    if (users.some(u => u.username && u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Tên đăng nhập đã tồn tại trong hệ thống.' };
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: cleanUsername,
      fullName: fullName.trim(),
      className: className.trim(),
      email: cleanEmail,
      password: cleanPassword,
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
   * Admin batch imports multiple user accounts from parsed file records.
   * @param {Array<Object>} records - [{ username, password, fullName, className, email }]
   * @returns {{ success: boolean, addedCount: number, skippedCount: number, errors: string[], createdUsers: Array<Object>, error?: string }}
   */
  batchImportUsers(records = []) {
    if (!this.isAdmin()) {
      return { success: false, error: 'Chỉ có Quản trị viên (admin) mới có quyền nhập tài khoản hàng loạt.', addedCount: 0, skippedCount: 0, errors: [] };
    }
    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, error: 'Danh sách tài khoản nhập vào trống hoặc không hợp lệ.', addedCount: 0, skippedCount: 0, errors: [] };
    }

    const users = this.getUsers();
    const existingUsernames = new Set(users.map(u => u.username.toLowerCase()));
    const errors = [];
    const createdUsers = [];
    let addedCount = 0;
    let skippedCount = 0;

    records.forEach((rec, index) => {
      const lineNo = index + 1;
      const rawUser = String(rec.username || '').trim();
      const rawFullName = String(rec.fullName || rec.name || '').trim();
      const rawClass = String(rec.className || rec.class || 'Sinh viên').trim();
      const rawPass = String(rec.password || '123456').trim();
      const rawEmail = String(rec.email || '').trim();

      if (!rawUser || rawUser.length < 3) {
        errors.push(`Dòng ${lineNo}: Tên đăng nhập "${rawUser}" không hợp lệ (ít nhất 3 ký tự).`);
        skippedCount++;
        return;
      }

      const cleanUsername = rawUser.toLowerCase();
      if (existingUsernames.has(cleanUsername)) {
        skippedCount++;
        return;
      }

      const fullName = rawFullName || rawUser;
      const cleanEmail = rawEmail || `${cleanUsername}@toanrr.edu.vn`;

      // Clear any previous deletion tombstone when admin intentionally imports
      this.unmarkDeletedLocally(cleanUsername);
      if (cleanEmail) this.unmarkDeletedLocally(cleanEmail);
      if (rec.id) this.unmarkDeletedLocally(rec.id);

      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${index}`,
        username: cleanUsername,
        fullName,
        className: rawClass || 'Sinh viên',
        email: cleanEmail,
        password: rawPass || '123456',
        avatar: '👨‍🎓',
        role: 'student',
        createdAt: new Date().toISOString(),
      };

      existingUsernames.add(cleanUsername);
      users.push(newUser);
      createdUsers.push(newUser);
      addedCount++;
    });

    if (addedCount > 0 && this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch {
        return { success: false, error: 'Lỗi bộ nhớ khi lưu danh sách tài khoản.', addedCount: 0, skippedCount, errors };
      }
    }

    if (addedCount > 0) {
      this._notifyListeners('users_batch_imported', { createdUsers, totalUsers: users });
    }

    return {
      success: true,
      addedCount,
      skippedCount,
      errors,
      createdUsers,
    };
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
      u => (u.username && u.username.toLowerCase() === query) || (u.email && u.email.toLowerCase() === query)
    );

    if (found) {
      // User actively exists in database -> clear any stale deletion tombstones
      this.unmarkDeletedLocally(query);
      if (found.username) this.unmarkDeletedLocally(found.username);
      if (found.email) this.unmarkDeletedLocally(found.email);
      if (found.id) this.unmarkDeletedLocally(found.id);
    } else {
      // User is not in active users list. Check if they were deleted by admin
      if (this.isLocallyDeleted(query)) {
        return { success: false, error: 'Tài khoản này đã bị Quản trị viên xóa khỏi hệ thống.' };
      }
      return { success: false, error: 'Tài khoản không tồn tại. Vui lòng kiểm tra lại hoặc Đăng ký mới.' };
    }

    // Strict password verification: single admin account strictly requires DEMO_USERS[0].password
    if (found.username === 'admin' || found.id === 'user_admin' || found.role === 'admin') {
      if (password !== DEMO_USERS[0].password) {
        return { success: false, error: 'Mật khẩu không chính xác.' };
      }
    } else {
      if (found.password && found.password !== password) {
        return { success: false, error: 'Mật khẩu không chính xác.' };
      }
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

    if (this.isLocallyDeleted(cleanUsername) || this.isLocallyDeleted(cleanEmail)) {
      return { success: false, error: 'Tài khoản này đã bị Quản trị viên xóa khỏi hệ thống.' };
    }

    const users = this.getUsers();

    if (users.some(u => u.username && u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.' };
    }
    if (users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
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
    this.currentUser = null;
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY_CURRENT);
      } catch {
        // no-op
      }
    }
    this._notifyListeners('logout', null);
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
