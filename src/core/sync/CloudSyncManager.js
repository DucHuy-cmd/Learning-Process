/**
 * @file CloudSyncManager.js
 * Multi-device Live Cloud Synchronization Service for Discrete Math EdTech Platform.
 * 
 * Features:
 * - Real-time sync of user accounts, AI conversation history, and Quiz Leaderboard.
 * - Graceful fallback to LocalStorage when offline or running in standalone static mode.
 * - Reactive connection status listener (online/offline/syncing).
 */

import { setCustomQuestionBank, addCustomQuestion, removeCustomQuestion } from '../quiz/QuizBank.js';

export class CloudSyncManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - API Base URL (defaults to window.location.origin or '')
   * @param {number} [options.timeoutMs=2000] - Connection ping timeout
   */
  constructor({ baseUrl = '', timeoutMs = 15000 } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.isConnected = false;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.authToken = '';
    this.dataSkewInfo = null;
    this.listeners = new Set();
  }

  /**
   * Safe fetch with automatic AbortController timeout to prevent indefinite hanging.
   * @param {string} url
   * @param {Object} [options]
   * @param {number} [timeoutMs]
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = null) {
    const ms = timeoutMs || this.timeoutMs || 15000;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;

    if (controller) {
      timer = setTimeout(() => {
        controller.abort(new Error(`TIMEOUT: Yêu cầu mạng quá thời gian (${ms}ms)`));
      }, ms);
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller ? controller.signal : options.signal,
      });
      return response;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Subscribes to sync status changes.
   * @param {Function} callback - ({ isConnected, isSyncing, lastSyncTime }) => void
   * @returns {Function} Unsubscribe
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  _notify() {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // no-op
      }
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      serverAiConfigured: Boolean(this.serverAiConfigured),
    };
  }

  /**
   * Checks whether the backend server is reachable.
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    if (typeof fetch === 'undefined') {
      this.isConnected = false;
      this._notify();
      return false;
    }

    const testUrls = [];
    if (this.baseUrl) {
      testUrls.push(`${this.baseUrl}/api/health`);
    } else {
      testUrls.push('/api/health');
    }

    // If on browser localhost/127.0.0.1 on a different dev port (e.g. 5500, 8888, 5173), also test localhost:3000
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || '';
      const port = window.location.port || '';
      const protocol = window.location.protocol || '';

      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:';
      if (isLocal && port !== '3000') {
        testUrls.push('http://localhost:3000/api/health');
        testUrls.push('http://127.0.0.1:3000/api/health');
      }

      // If running locally or on static preview (and not in unit tests), fallback to cloud production
      const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
      const isAlreadyOnProd = window.location.origin && window.location.origin.includes('mathplatform-ten.vercel.app');
      if (!isTestEnv && !isAlreadyOnProd) {
        testUrls.push('https://mathplatform-ten.vercel.app/api/health');
      }
    }

    for (const url of testUrls) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller ? controller.signal : undefined,
        });

        if (timer) clearTimeout(timer);
        if (res.ok) {
          this.isConnected = true;
          try {
            if (typeof res.json === 'function') {
              const data = await res.json();
              if (data && typeof data.aiConfigured === 'boolean') {
                this.serverAiConfigured = data.aiConfigured;
              }
            }
          } catch {}
          if (url.startsWith('http://localhost:3000')) {
            this.baseUrl = 'http://localhost:3000';
          } else if (url.startsWith('http://127.0.0.1:3000')) {
            this.baseUrl = 'http://127.0.0.1:3000';
          } else if (url.startsWith('https://mathplatform-ten.vercel.app')) {
            this.baseUrl = 'https://mathplatform-ten.vercel.app';
          }
          this._notify();
          return true;
        }
      } catch {
        // try next endpoint
      }
    }

    this.isConnected = false;
    this._notify();
    return false;
  }

  async syncUsers(authManager) {
    if (!authManager || typeof fetch === 'undefined') {
      return { success: false, error: 'Môi trường ngoại tuyến hoặc thiếu authManager' };
    }

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/users`);
      if (!res.ok) {
        return { success: false, error: `Máy chủ trả mã HTTP ${res.status}` };
      }

      const contentType = typeof res.headers?.get === 'function' ? (res.headers.get('content-type') || '') : '';
      if (contentType && !contentType.includes('application/json')) {
        return { success: false, error: 'Phản hồi không phải định dạng JSON' };
      }

      const data = await res.json().catch(() => null);
      if (!data || !data.success || !Array.isArray(data.users)) {
        return { success: false, error: data?.error || 'Dữ liệu tài khoản từ máy chủ không hợp lệ' };
      }

      // 1. Check for server database reset event
      const serverDbResetTime = data.dbResetTime || 0;
      const localDbResetTime = parseInt(authManager.storage?.getItem('trr_last_db_reset') || '0', 10);
      if (serverDbResetTime > 0 && serverDbResetTime > localDbResetTime) {
        console.info('[CloudSync] Server database reset detected. Purging local non-admin accounts and records.');
        authManager.resetUsersToDefault({ force: true });
        if (authManager.storage) {
          try {
            authManager.storage.setItem('trr_last_db_reset', String(serverDbResetTime));
            authManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify([]));
            authManager.storage.setItem('trr_exam_violations_v1', JSON.stringify([]));
            authManager.storage.setItem('trr_quiz_stats_map', JSON.stringify({}));
            authManager.storage.setItem('trr_ai_sessions_v1', JSON.stringify({}));
            authManager.storage.setItem('trr_deleted_users_v1', JSON.stringify([]));
          } catch {}
        }
      }

      // 2. Process tombstones of deleted accounts from server
      if (Array.isArray(data.deletedUsers)) {
        const activeUsernames = new Set((data.users || []).map(u => (u.username || '').toLowerCase()));
        const activeIds = new Set((data.users || []).map(u => (u.id || '').toLowerCase()));
        const activeEmails = new Set((data.users || []).map(u => (u.email || '').toLowerCase()).filter(Boolean));

        for (const delId of data.deletedUsers) {
          const cleanDel = String(delId).trim().toLowerCase();
          if (activeUsernames.has(cleanDel) || activeIds.has(cleanDel) || activeEmails.has(cleanDel)) {
            authManager.unmarkDeletedLocally(cleanDel);
            continue;
          }
          authManager.markDeletedLocally(delId);
          if (authManager.storage) {
            try {
              const subs = JSON.parse(authManager.storage.getItem('trr_exam_submissions_v1') || '[]');
              const clean = subs.filter(s => 
                s.userId?.toLowerCase() !== delId.toLowerCase() && 
                s.username?.toLowerCase() !== delId.toLowerCase()
              );
              if (clean.length !== subs.length) {
                authManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify(clean));
              }
            } catch {}
          }
        }
      }

      // 3. Clear any stale deletion tombstones for active users returned by authoritative server
      for (const su of (data.users || [])) {
        if (su.username) authManager.unmarkDeletedLocally(su.username);
        if (su.id) authManager.unmarkDeletedLocally(su.id);
        if (su.email) authManager.unmarkDeletedLocally(su.email);
      }

      const localUsers = authManager.getUsers();

      // 4. Server users are authoritative active accounts
      const serverUsers = (data.users || []).filter(su => {
        return !authManager.isLocallyDeleted(su.id) && !authManager.isLocallyDeleted(su.username);
      });

      // 5. Anti-Data-Loss Protection: Check for data skew before saving
      // If server returns only admin, but local has student accounts, do NOT wipe local accounts!
      const serverNonAdmin = serverUsers.filter(u => u.username !== 'admin' && u.id !== 'user_admin');
      const localNonAdmin = localUsers.filter(u => u.username !== 'admin' && u.id !== 'user_admin');

      let mergedUsers = [];
      if (serverNonAdmin.length === 0 && localNonAdmin.length > 0) {
        // Skew detected: Server only returned admin, but local has student accounts.
        // Protect local accounts from being wiped!
        this.dataSkewInfo = {
          hasSkew: true,
          serverCount: serverUsers.length,
          serverUserCount: serverUsers.length,
          localCount: localUsers.length,
          localStudentCount: localNonAdmin.length,
          message: `Máy chủ hiện chỉ trả về ${serverUsers.length} tài khoản (Admin), trong khi thiết bị này đang lưu ${localUsers.length} tài khoản. Toàn bộ tài khoản cục bộ đã được bảo toàn an toàn.`
        };
        mergedUsers = localUsers.map(lu => ({ ...lu }));
      } else {
        // Standard merge: server accounts are primary
        const serverUserIds = new Set(serverUsers.map(su => (su.id || '').toLowerCase()));
        const serverUsernames = new Set(serverUsers.map(su => (su.username || '').toLowerCase()));

        mergedUsers = serverUsers.map(su => {
          const copy = { ...su };
          delete copy.password;
          return copy;
        });

        // Retain any valid local non-admin account not tombstoned
        const localOnly = localNonAdmin.filter(lu =>
          !serverUserIds.has((lu.id || '').toLowerCase()) &&
          !serverUsernames.has((lu.username || '').toLowerCase()) &&
          !authManager.isLocallyDeleted(lu.id) &&
          !authManager.isLocallyDeleted(lu.username)
        );

        if (localOnly.length > 0) {
          this.dataSkewInfo = {
            hasSkew: true,
            serverCount: serverUsers.length,
            localCount: serverUsers.length + localOnly.length,
            message: `Có ${localOnly.length} tài khoản sinh viên được lưu trên thiết bị nhưng chưa có trên máy chủ. Đã giữ nguyên các tài khoản này.`
          };
          mergedUsers.push(...localOnly.map(u => ({ ...u })));
        } else {
          this.dataSkewInfo = null;
        }
      }

      if (authManager.storage) {
        try {
          authManager.storage.setItem('trr_registered_users', JSON.stringify(mergedUsers));
        } catch {}
      }

      // 6. Verify if currently logged-in user still exists and wasn't deleted
      const currentUser = authManager.getCurrentUser();
      if (currentUser && currentUser.username !== 'admin' && currentUser.id !== 'user_admin') {
        const isDel = authManager.isLocallyDeleted(currentUser.id) || authManager.isLocallyDeleted(currentUser.username);
        const stillExists = !isDel && mergedUsers.some(u => u.id === currentUser.id || u.username === currentUser.username);
        if (!stillExists) {
          console.warn('[CloudSync] Current user was removed from server. Logging out immediately.');
          authManager.logout();
          if (typeof window !== 'undefined' && window.alert) {
            window.alert('⚠️ Tài khoản của bạn đã bị Quản trị viên xóa khỏi hệ thống. Bạn đã được tự động chuyển về chế độ Khách.');
          }
        }
      }
      this.lastSyncTime = new Date().toISOString();
      this._notify();
      return {
        success: true,
        count: mergedUsers.length,
        serverCount: serverUsers.length,
        dataSkewInfo: this.dataSkewInfo,
      };
    } catch (err) {
      console.warn('[CloudSync] syncUsers error:', err.message || err);
      return {
        success: false,
        error: err.message || 'Lỗi mạng khi đồng bộ tài khoản',
      };
    }
  }

  /**
   * Directly verifies if the currently logged-in user still exists on the server.
   * Logs out immediately if deleted.
   * @param {Object} authManager
   * @returns {Promise<boolean>}
   */
  async verifyCurrentUser(authManager) {
    if (!authManager || typeof fetch === 'undefined') return true;
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) return true;
    if (currentUser.id === 'user_admin' || currentUser.username === 'admin') return true;

    try {
      const url = `${this.baseUrl}/api/auth/verify?userId=${encodeURIComponent(currentUser.id)}&username=${encodeURIComponent(currentUser.username)}`;
      const res = await fetch(url);
      if (res.status === 404 || res.status === 401) {
        console.warn('[CloudSync] Session verification failed. User does not exist on server. Logging out.');
        authManager.logout();
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('⚠️ Tài khoản của bạn đã bị Quản trị viên xóa khỏi hệ thống. Bạn đã được tự động chuyển về chế độ Khách.');
        }
        return false;
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.valid === false) {
          authManager.logout();
          if (typeof window !== 'undefined' && window.alert) {
            window.alert('⚠️ Tài khoản của bạn đã bị Quản trị viên xóa khỏi hệ thống. Bạn đã được tự động chuyển về chế độ Khách.');
          }
          return false;
        }
      }
    } catch {
      // network fallback
    }
    return true;
  }

  /**
   * Pushes a new registration to the server.
   * @param {Object} userData
   */
  async pushRegister(userData) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Logs in a user via the backend server API.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ success: boolean, user?: Object, error?: string }>}
   */
  async login(username, password) {
    if (typeof fetch === 'undefined') {
      return { success: false, error: 'Không có kết nối mạng.' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Lỗi phản hồi máy chủ.' }));
      if (data && data.success && data.token) {
        this.setAuthToken(data.token);
      }
      return data;
    } catch {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ.' };
    }
  }

  /**
   * Synchronizes AI history sessions from the server for a user.
   * @param {string} userId
   * @param {Object} aiHistoryManager
   */
  async syncAiHistory(userId, aiHistoryManager) {
    if (!userId || !aiHistoryManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/ai/history?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        const all = aiHistoryManager._readAll();
        for (const s of data.sessions) {
          if (!all[s.id] || new Date(s.updatedAt) > new Date(all[s.id].updatedAt)) {
            all[s.id] = s;
          }
        }
        aiHistoryManager._writeAll(all);
        this.lastSyncTime = new Date().toISOString();
        this._notify();
      }
    } catch {
      // offline fallback
    }
  }

  /**
   * Pushes an AI conversation session to the server.
   * @param {Object} session
   */
  async pushAiSession(session) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/ai/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Pushes a session deletion to the server.
   * @param {string} sessionId
   */
  async pushDeleteAiSession(sessionId) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/ai/history/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes Quiz Leaderboard & stats from the server.
   * Overwrites local cache with authoritative server records.
   * @param {Object} quizHistoryManager
   */
  async syncQuizLeaderboard(quizHistoryManager) {
    if (!quizHistoryManager || typeof fetch === 'undefined') {
      return { success: false, error: 'Môi trường ngoại tuyến' };
    }

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/quiz/leaderboard`);
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.leaderboard)) {
        const cleanMap = {};
        for (const item of data.leaderboard) {
          if (item && item.userId && item.userId !== 'user_admin' && item.username !== 'admin') {
            cleanMap[item.userId] = item;
          }
        }
        quizHistoryManager._writeMap(cleanMap);
        this.lastSyncTime = new Date().toISOString();
        this._notify();
        return { success: true, count: Object.keys(cleanMap).length };
      }
      return { success: false, error: data?.error || 'Dữ liệu bảng điểm không hợp lệ' };
    } catch (err) {
      return { success: false, error: err.message || 'Lỗi mạng' };
    }
  }

  /**
   * Pushes a quiz answer attempt to the server.
   * @param {string} userId
   * @param {boolean} isCorrect
   * @param {Object} [userInfo]
   */
  async pushQuizAnswer(userId, isCorrect, userInfo = {}) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isCorrect, userInfo }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Pushes an exam record to the server.
   * @param {string} userId
   * @param {Object} examResult
   * @param {Object} [userInfo]
   */
  async pushQuizExam(userId, examResult, userInfo = {}) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, examResult, userInfo }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  /**
   * Sets the active session authentication token.
   * Persists token to localStorage so it survives page reloads.
   * @param {string} token
   */
  setAuthToken(token) {
    this.authToken = token || '';
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (token) {
          window.localStorage.setItem('trr_auth_token', token);
        } else {
          window.localStorage.removeItem('trr_auth_token');
        }
      } catch {}
    }
  }

  /**
   * Retrieves the current authenticated session token.
   * @returns {string}
   */
  getAuthToken() {
    if (this.authToken) return this.authToken;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('trr_auth_token');
        if (stored) {
          this.authToken = stored;
          return stored;
        }
      } catch {}
    }
    return '';
  }

  /**
   * Helper to retrieve admin credentials headers for authenticated admin operations.
   * In production, sends the cryptographically signed session token.
   * In automated test mode (NODE_ENV === 'test'), falls back to test headers.
   * @private
   */
  _getAdminAuthHeaders() {
    const token = this.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      headers['Authorization'] = 'Bearer user_admin';
      headers['x-user-id'] = 'user_admin';
    }
    return headers;
  }

  /**
   * Helper to retrieve student user authorization headers for student operations.
   * @param {string} [userId]
   * @private
   */
  _getUserAuthHeaders(userId = '') {
    const token = this.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      headers['Authorization'] = `Bearer ${userId || 'student_test'}`;
    }
    if (userId) {
      headers['x-user-id'] = userId;
    }
    return headers;
  }

    /**
   * Admin batch-creates multiple users on the server in a single request.
   * Reduces N sequential HTTP calls to 1, and server writes DB only once.
   * @param {Array<Object>} usersArray - Array of user objects to create
   * @returns {Promise<{ success: boolean, addedCount: number, skippedCount: number, createdUsers: Array } | null>}
   */
  async adminBatchCreateUsers(usersArray) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    if (!Array.isArray(usersArray) || usersArray.length === 0) return { success: false, error: 'Danh sách rỗng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify({ users: usersArray }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Admin creates a user on the server.
   * @param {Object} userData
   */
  async adminCreateUser(userData) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify(userData),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Admin deletes a user on the server.
   * @param {string} userId
   * @param {string} [username]
   */
  async adminDeleteUser(userId, username = '') {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const q = username ? `?username=${encodeURIComponent(username)}` : '';
      const res = await fetch(`${this.baseUrl}/api/admin/users/${encodeURIComponent(userId)}${q}`, {
        method: 'DELETE',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Admin resets the entire quiz leaderboard on the server.
   */
  async resetQuizLeaderboard() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/leaderboard/reset`, {
        method: 'POST',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Admin deletes a single user's score from the quiz leaderboard.
   * @param {string} userId
   */
  async deleteQuizLeaderboardUser(userId) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/leaderboard/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Admin resets entire database on server (keeps only admin).
   */
  async adminResetDatabase() {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/database/reset`, {
        method: 'POST',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Synchronizes exams from server to local ExamManager.
   * Protects against wiping local exams when server returns empty or encounters errors.
   * @param {Object} examManager
   */
  async syncExams(examManager) {
    if (typeof fetch === 'undefined') {
      return { success: false, error: 'Môi trường ngoại tuyến' };
    }
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/exams`);
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.exams)) {
        if (examManager) {
          const localExams = examManager.getExams();
          const serverExams = data.exams;

          // Intelligently merge:
          // Keep all server exams
          const serverIds = new Set(serverExams.map(e => e.id));
          const merged = [...serverExams];

          // Retain local exams not on server if they haven't been deleted
          for (const le of localExams) {
            if (le && le.id && !serverIds.has(le.id) && !examManager._isExamDeletedLocally(le.id)) {
              merged.push(le);
            }
          }

          examManager.memoryExams = merged;
          if (examManager.storage) {
            examManager.storage.setItem('trr_assigned_exams_v1', JSON.stringify(merged));
          }
          examManager._notifyListeners('exams_synced', merged);
        }
        return { success: true, count: data.exams.length };
      }
      return { success: false, error: data?.error || 'Dữ liệu đề thi không hợp lệ' };
    } catch (err) {
      return { success: false, error: err.message || 'Lỗi mạng khi tải đề thi' };
    }
  }

  /**
   * Pushes exam creation to server with guaranteed error reporting.
   * @param {Object} examData
   */
  async serverCreateExam(examData) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify(examData),
      }, 25000);
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.submission) {
        return {
          success: true,
          submission: data.submission,
          alreadySubmitted: true,
        };
      }
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})`, status: res.status };
      }
      this.isConnected = true;
      this._notify();
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Deletes an exam on server.
   * @param {string} examId
   */
  async serverDeleteExam(examId) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/exams/${encodeURIComponent(examId)}`, {
        method: 'DELETE',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Requests server to clear all exams, submissions, and student exam records.
   * @returns {Promise<Object>}
   */
  async serverClearAllExams() {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/exams/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Synchronizes exam submissions from server to local ExamManager.
   * Merges server submissions intelligently to protect offline / pending records.
   * @param {Object} examManager
   */
  async syncExamSubmissions(examManager) {
    if (typeof fetch === 'undefined') {
      return { success: false, error: 'Môi trường ngoại tuyến' };
    }
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/exam-submissions`);
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.submissions)) {
        if (examManager) {
          const localSubmissions = examManager.getSubmissions();
          const serverSubmissions = data.submissions;

          // Merge: server submissions are primary
          const serverKeySet = new Set(serverSubmissions.map(s => `${s.examId}___${s.userId}`));
          const merged = [...serverSubmissions];

          // Retain local submissions not yet on server
          for (const ls of localSubmissions) {
            if (ls && ls.examId && ls.userId && !serverKeySet.has(`${ls.examId}___${ls.userId}`)) {
              merged.push(ls);
            }
          }

          // Backfill profile details if any were present locally
          for (const s of merged) {
            const localMatch = localSubmissions.find(ls => ls && ls.examId === s.examId && ls.userId === s.userId);
            if (localMatch) {
              if (!s.fullName && (localMatch.fullName || localMatch.studentName)) s.fullName = localMatch.fullName || localMatch.studentName;
              if (!s.studentName && (localMatch.studentName || localMatch.fullName)) s.studentName = localMatch.studentName || localMatch.fullName;
              if (!s.username && localMatch.username) s.username = localMatch.username;
              if ((!s.className || s.className === 'Sinh viên') && localMatch.className) s.className = localMatch.className;
              if ((!s.avatar || s.avatar === '👤') && localMatch.avatar) s.avatar = localMatch.avatar;
            }
          }

          examManager.memorySubmissions = merged;
          if (examManager.storage) {
            examManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify(merged));
          }
          examManager._notifyListeners('submissions_synced', merged);
        }
        return { success: true, count: data.submissions.length };
      }
      return { success: false, error: data?.error || 'Dữ liệu bài nộp không hợp lệ' };
    } catch (err) {
      return { success: false, error: err.message || 'Lỗi mạng khi tải bài nộp' };
    }
  }

  /**
   * Pushes an exam submission to server with idempotent retry and structured response.
   * @param {Object} submissionData
   */
  async serverSubmitExam(submissionData) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const { examId, userId, username, fullName, className, avatar, answers, optionOrder, timeSpentSeconds, integrityBan = false } = submissionData;
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/exam-submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getUserAuthHeaders(userId),
        },
        body: JSON.stringify({
          examId,
          userId,
          userInfo: { username, fullName, className, avatar },
          answers,
          optionOrder,
          timeSpentSeconds,
          integrityBan,
        }),
      }, 25000);
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.submission) {
        this.isConnected = true;
        this._notify();
        return {
          success: true,
          submission: data.submission,
          alreadySubmitted: true,
        };
      }
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})`, status: res.status };
      }
      this.isConnected = true;
      this._notify();
      return {
        success: true,
        submission: data?.submission || submissionData,
        alreadySubmitted: Boolean(data?.alreadySubmitted),
      };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi gửi bài thi: ' + err.message };
    }
  }

  /**
   * Synchronizes custom AI questions between backend server and local QuizBank.
   * @returns {Promise<Array<Object>|null>}
   */
  async syncCustomQuestions() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/custom-question`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        setCustomQuestionBank(data.questions);
        return data.questions;
      }
    } catch (err) {
      console.warn('[CloudSyncManager] Error syncing custom questions:', err);
    }
    return null;
  }

  /**
   * Retrieves custom questions list from server.
   * @returns {Promise<Array<Object>>}
   */
  async fetchCustomQuestions() {
    if (typeof fetch === 'undefined') return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/custom-question`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.success && Array.isArray(data.questions)) ? data.questions : [];
    } catch {
      return [];
    }
  }

  /**
   * Pushes a custom approved question to the backend server.
   * @param {Object} questionData
   * @param {Object} [authHeaders={}]
   * @returns {Promise<{ success: boolean, question?: Object, error?: string }>}
   */
  async saveCustomQuestion(questionData, authHeaders = {}) {
    // Optimistically update local question bank
    if (questionData && questionData.id) {
      addCustomQuestion(questionData);
    }

    if (typeof fetch === 'undefined') {
      return { success: true, question: questionData };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...authHeaders,
      };
      const res = await fetch(`${this.baseUrl}/api/quiz/custom-question`, {
        method: 'POST',
        headers,
        body: JSON.stringify(questionData),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.message || data.error || `Lỗi máy chủ (${res.status})`,
        };
      }

      if (data.success && data.question) {
        addCustomQuestion(data.question);
        return { success: true, question: data.question };
      }
      return { success: false, error: 'Không thể lưu câu hỏi lên máy chủ.' };
    } catch {
      // In offline mode, the question is already saved locally
      return { success: true, question: questionData, offline: true };
    }
  }

  /**
   * Deletes a custom question from the backend server.
   * @param {string} questionId
   * @param {Object} [authHeaders={}]
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async deleteCustomQuestion(questionId, authHeaders = {}) {
    removeCustomQuestion(questionId);

    if (typeof fetch === 'undefined') {
      return { success: true };
    }

    try {
      const headers = {
        ...authHeaders,
      };
      const res = await fetch(`${this.baseUrl}/api/quiz/custom-question/${encodeURIComponent(questionId)}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: data.message || data.error || `Lỗi máy chủ (${res.status})`,
        };
      }
      return { success: true };
    } catch {
      return { success: true, offline: true };
    }
  }

  /**
   * Synchronizes imported Word files from backend server.
   * @returns {Promise<Array<Object>|null>}
   */
  async syncImportedFiles() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.success && Array.isArray(data.files)) {
        this.lastSyncTime = new Date().toISOString();
        this._notify();
        const filesArray = data.files;
        Object.defineProperties(filesArray, {
          deletedFiles: { value: Array.isArray(data.deletedFiles) ? data.deletedFiles : [], enumerable: false },
          resetTime: { value: data.resetTime || 0, enumerable: false },
        });
        return filesArray;
      }
    } catch (err) {
      console.warn('[CloudSyncManager] Error syncing imported files:', err);
    }
    return null;
  }

  /**
   * Pushes an imported file to the backend server.
   * @param {Object} fileEntry
   * @returns {Promise<Object|null>}
   */
  async pushImportedFile(fileEntry) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify({ file: fileEntry }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Pushes a batch of imported files to the backend server.
   * @param {Array<Object>} files
   * @returns {Promise<Object|null>}
   */
  async pushBatchImportedFiles(files) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Deletes an imported file from the backend server.
   * @param {string} fileId
   * @returns {Promise<Object|null>}
   */
  async pushDeleteImportedFile(fileId) {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: {
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }

  /**
   * Clears all imported files from the backend server.
   * @returns {Promise<Object>}
   */
  async pushClearAllImportedFiles() {
    if (typeof fetch === 'undefined') return { success: false, error: 'Không có kết nối mạng.' };
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, error: data?.error || `Lỗi máy chủ (${res.status})` };
      }
      return data || { success: false, error: 'Phản hồi rỗng từ máy chủ' };
    } catch (err) {
      return { success: false, error: 'Lỗi mạng khi kết nối máy chủ: ' + err.message };
    }
  }


  /**
   * Fetches detailed database connectivity and health metrics.
   * @returns {Promise<Object>}
   */
  async getDatabaseStatus() {
    if (typeof fetch === 'undefined') {
      return { success: false, connected: false, error: 'Offline environment' };
    }
    const endpoints = [];
    if (this.baseUrl) {
      endpoints.push(`${this.baseUrl}/api/database/status`);
      endpoints.push(`${this.baseUrl}/api/health`);
    } else {
      endpoints.push('/api/database/status');
      endpoints.push('/api/health');
      const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
      if (!isTestEnv) {
        endpoints.push('https://mathplatform-ten.vercel.app/api/database/status');
        endpoints.push('https://mathplatform-ten.vercel.app/api/health');
      }
    }

    for (const ep of endpoints) {
      try {
        const res = await this.fetchWithTimeout(ep, {}, 6000);
        if (res && res.ok) {
          const data = await res.json().catch(() => null);
          if (data) {
            if (ep.startsWith('https://mathplatform-ten.vercel.app')) {
              this.baseUrl = 'https://mathplatform-ten.vercel.app';
            }
            return {
              ...data,
              success: true,
              connected: true,
              storageMode: data.storageMode || (data.kvConfigured ? 'cloud_kv' : 'local_file'),
              databaseLabel: data.databaseLabel || (data.kvConfigured ? 'Cloud KV (Upstash Redis)' : 'Local File Store'),
            };
          }
        }
      } catch {
        // Fallback to next endpoint
      }
    }

    return {
      success: false,
      connected: false,
      storageMode: 'offline',
      databaseLabel: 'Chế độ Ngoại tuyến',
    };
  }

  async adminResetPassword(userId, username = '', newPassword = '123456') {
    if (typeof fetch === 'undefined' || !userId) return { success: false };
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user_admin',
          'Authorization': 'Bearer user_admin',
        },
        body: JSON.stringify({ username, newPassword }),
      });
      if (!res.ok) return { success: false, status: res.status };
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

}

export const cloudSyncManager = new CloudSyncManager();

