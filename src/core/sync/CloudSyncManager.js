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
          this.flushPendingSubmissions().catch(() => {});
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
        if (examManager) {
          examManager.memoryExams = [...data.exams];
          if (examManager.storage) {
            examManager.storage.setItem('trr_assigned_exams_v1', JSON.stringify(data.exams));
          }
          examManager._notifyListeners('exams_synced', data.exams);
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
   * Requests server to clear all exams, submissions, and student exam records.
   * @returns {Promise<Object|null>}
   */
  async serverClearAllExams() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/exams/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes exam submissions from server to local ExamManager with safe merging.
   * @param {Object} examManager
   * @param {string} [examId]
   */
  async syncExamSubmissions(examManager, examId = null) {
    if (typeof fetch === 'undefined') return;
    try {
      const url = examId 
        ? `${this.baseUrl}/api/exam-submissions?examId=${encodeURIComponent(examId)}`
        : `${this.baseUrl}/api/exam-submissions`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        if (examManager) {
          const map = new Map(examManager.memorySubmissions.map(s => [`${s.examId}:${s.userId}`, s]));
          data.submissions.forEach(s => {
            if (s && s.examId && s.userId) map.set(`${s.examId}:${s.userId}`, s);
          });
          examManager.memorySubmissions = Array.from(map.values());
          if (examManager.storage) {
            examManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify(examManager.memorySubmissions));
          }
          examManager._notifyListeners('submissions_synced', examManager.memorySubmissions);
        }
      }
    } catch {}
  }

  /**
   * Retrieves pending submissions queue from localStorage.
   * @private
   * @returns {Array<Object>}
   */
  _getPendingSubmissions() {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem('trr_pending_submissions_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves a submission to the pending queue in localStorage.
   * @private
   * @param {Object} submission
   */
  _savePendingSubmission(submission) {
    if (typeof window === 'undefined' || !window.localStorage || !submission) return;
    try {
      const pending = this._getPendingSubmissions().filter(
        s => !(s.examId === submission.examId && s.userId === submission.userId)
      );
      pending.push(submission);
      window.localStorage.setItem('trr_pending_submissions_v1', JSON.stringify(pending));
    } catch {}
  }

  /**
   * Removes a submission from the pending queue.
   * @param {string} examId
   * @param {string} userId
   */
  _removePendingSubmission(examId, userId) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const pending = this._getPendingSubmissions().filter(
        s => !(s.examId === examId && s.userId === userId)
      );
      window.localStorage.setItem('trr_pending_submissions_v1', JSON.stringify(pending));
    } catch {}
  }

  /**
   * Checks whether a submission is still pending upload.
   * @param {string} examId
   * @param {string} userId
   * @returns {boolean}
   */
  hasPendingSubmission(examId, userId) {
    return this._getPendingSubmissions().some(
      s => s.examId === examId && s.userId === userId
    );
  }

  /**
   * Automatically flushes all pending submissions in the queue.
   */
  async flushPendingSubmissions() {
    const pending = this._getPendingSubmissions();
    if (pending.length === 0) return;
    for (const sub of pending) {
      await this.serverSubmitExam(sub, 1).catch(() => {});
    }
  }

  /**
   * Pushes an exam submission to server with auto-retry and persistent queue.
   * Ensures 100 students submitting simultaneously never lose their results.
   * @param {Object} submissionData
   * @param {number} [maxRetries=3]
   * @returns {Promise<Object|null>}
   */
  async serverSubmitExam(submissionData, maxRetries = 3) {
    if (typeof fetch === 'undefined') return null;
    const { examId, userId, username, fullName, className, avatar, answers, optionOrder, timeSpentSeconds, integrityBan = false } = submissionData;
    
    // Store in offline queue in case network drops
    this._savePendingSubmission(submissionData);

    if (!this.isConnected) {
      return { success: false, queued: true };
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;

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
            integrityBan,
          }),
          signal: controller ? controller.signal : undefined,
        });

        if (timer) clearTimeout(timer);

        if (res.ok || res.status === 409) {
          // Success or already registered on server
          this._removePendingSubmission(examId, userId);
          return await res.json().catch(() => ({ success: true }));
        }
      } catch {
        // Network timeout / packet loss
      }

      attempt++;
      if (attempt <= maxRetries) {
        // Exponential backoff: 1s, 2s, 3s
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    return null;
  }
}

export const cloudSyncManager = new CloudSyncManager();
