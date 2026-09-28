/**
 * @file CloudSyncManager.js
 * Multi-device Live Cloud Synchronization Service for Discrete Math EdTech Platform.
 * 
 * Features:
 * - Real-time sync of user accounts, AI conversation history, and Quiz Leaderboard.
 * - Graceful fallback to LocalStorage when offline or running in standalone static mode.
 * - Reactive connection status listener (online/offline/syncing).
 */

export class CloudSyncManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - API Base URL (defaults to window.location.origin or '')
   * @param {number} [options.timeoutMs=2000] - Connection ping timeout
   */
  constructor({ baseUrl = '', timeoutMs = 2500 } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.isConnected = false;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.listeners = new Set();
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
      const hostname = window.location.hostname;
      const port = window.location.port;
      if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000') {
        testUrls.push('http://localhost:3000/api/health');
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

  /**
   * Synchronizes registered users from the server into AuthManager.
   * @param {Object} authManager
   */
  async syncUsers(authManager) {
    if (!authManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/users`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const localUsers = authManager.getUsers();
        const userMap = new Map();
        for (const u of localUsers) userMap.set(u.username.toLowerCase(), u);
        for (const u of data.users) userMap.set(u.username.toLowerCase(), u);

        const merged = Array.from(userMap.values());
        if (authManager.storage) {
          try {
            authManager.storage.setItem('trr_registered_users', JSON.stringify(merged));
          } catch {}
        }
        this.lastSyncTime = new Date().toISOString();
        this._notify();
      }
    } catch {
      // offline fallback
    }
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
   * @param {Object} quizHistoryManager
   */
  async syncQuizLeaderboard(quizHistoryManager) {
    if (!quizHistoryManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        const localMap = quizHistoryManager._readMap();
        for (const item of data.leaderboard) {
          if (!localMap[item.userId] || (item.score > (localMap[item.userId].score || 0))) {
            localMap[item.userId] = {
              ...(localMap[item.userId] || {}),
              ...item,
            };
          }
        }
        quizHistoryManager._writeMap(localMap);
        this.lastSyncTime = new Date().toISOString();
        this._notify();
      }
    } catch {
      // offline fallback
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
   * Admin creates a user on the server.
   * @param {Object} userData
   */
  async adminCreateUser(userData) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users`, {
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
   * Admin deletes a user on the server.
   * @param {string} userId
   */
  async adminDeleteUser(userId) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
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
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const cloudSyncManager = new CloudSyncManager();
