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
   * Purges deleted users and auto-logs out deleted accounts.
   * @param {Object} authManager
   */
  async syncUsers(authManager) {
    if (!authManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/users`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const serverUsers = data.users;
        if (authManager.storage) {
          try {
            authManager.storage.setItem('trr_registered_users', JSON.stringify(serverUsers));
          } catch {}
        }

        // Verify if currently logged-in user still exists on server
        const currentUser = authManager.getCurrentUser();
        if (currentUser && currentUser.username !== 'admin' && currentUser.id !== 'user_admin') {
          const stillExists = serverUsers.some(u => u.id === currentUser.id || u.username === currentUser.username);
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
      }
    } catch {
      // offline fallback
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
    if (!quizHistoryManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        const cleanMap = {};
        for (const item of data.leaderboard) {
          if (item && item.userId && item.userId !== 'user_admin' && item.username !== 'admin') {
            cleanMap[item.userId] = item;
          }
        }
        quizHistoryManager._writeMap(cleanMap);
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
   * @param {string} [username]
   */
  async adminDeleteUser(userId, username = '') {
    if (typeof fetch === 'undefined') return null;
    try {
      const q = username ? `?username=${encodeURIComponent(username)}` : '';
      const res = await fetch(`${this.baseUrl}/api/admin/users/${encodeURIComponent(userId)}${q}`, {
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

  /**
   * Admin resets entire database on server (keeps only admin).
   */
  async adminResetDatabase() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/database/reset`, {
        method: 'POST',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes exams from server to local ExamManager.
   * @param {Object} examManager
   */
  async syncExams(examManager) {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`${this.baseUrl}/api/exams`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.exams)) {
        if (examManager && examManager.storage) {
          const localExams = examManager.getExams();
          const serverMap = new Map();
          data.exams.forEach(e => serverMap.set(e.id, e));
          localExams.forEach(e => {
            if (!serverMap.has(e.id)) serverMap.set(e.id, e);
          });
          const merged = Array.from(serverMap.values());
          examManager.storage.setItem('trr_assigned_exams_v1', JSON.stringify(merged));
          examManager._notifyListeners('exams_synced', merged);
        }
      }
    } catch {}
  }

  /**
   * Pushes exam creation to server.
   * @param {Object} examData
   */
  async serverCreateExam(examData) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Deletes an exam on server.
   * @param {string} examId
   */
  async serverDeleteExam(examId) {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/exams/${encodeURIComponent(examId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes exam submissions from server to local ExamManager.
   * @param {Object} examManager
   */
  async syncExamSubmissions(examManager) {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`${this.baseUrl}/api/exam-submissions`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        if (examManager && examManager.storage) {
          const localSubs = examManager.getSubmissions();
          const subMap = new Map();
          localSubs.forEach(s => subMap.set(`${s.examId}_${s.userId}`, s));
          data.submissions.forEach(s => subMap.set(`${s.examId}_${s.userId}`, s));
          const merged = Array.from(subMap.values());
          examManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify(merged));
          examManager._notifyListeners('submissions_synced', merged);
        }
      }
    } catch {}
  }

  /**
   * Pushes an exam submission to server.
   * @param {Object} submissionData
   */
  async serverSubmitExam(submissionData) {
    if (typeof fetch === 'undefined') return null;
    try {
      const { examId, userId, username, fullName, className, avatar, answers, optionOrder, timeSpentSeconds } = submissionData;
      const res = await fetch(`${this.baseUrl}/api/exam-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          userId,
          userInfo: { username, fullName, className, avatar },
          answers,
          optionOrder,
          timeSpentSeconds,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const cloudSyncManager = new CloudSyncManager();
