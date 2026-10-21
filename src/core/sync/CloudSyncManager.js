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
  constructor({ baseUrl = '', timeoutMs = 8000 } = {}) {
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
    if (!authManager || typeof fetch === 'undefined') return;

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/users`);
      if (!res.ok) return;

      const contentType = typeof res.headers?.get === 'function' ? (res.headers.get('content-type') || '') : '';
      if (contentType && !contentType.includes('application/json')) return;

      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.users)) {
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

        // 5. Merge server authoritative users with local users, preserving passwords
        const mergedUsers = serverUsers.map(su => {
          const matchingLocal = localUsers.find(
            lu => lu.id === su.id || lu.username.toLowerCase() === su.username.toLowerCase()
          );
          return {
            ...su,
            password: matchingLocal?.password || su.password || '123456',
          };
        });

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
   * Helper to retrieve admin credentials headers for authenticated admin operations.
   * @private
   */
  _getAdminAuthHeaders() {
    return {
      'x-user-id': 'user_admin',
      'Authorization': 'Bearer user_admin',
    };
  }

    /**
   * Admin batch-creates multiple users on the server in a single request.
   * Reduces N sequential HTTP calls to 1, and server writes DB only once.
   * @param {Array<Object>} usersArray - Array of user objects to create
   * @returns {Promise<{ success: boolean, addedCount: number, skippedCount: number, createdUsers: Array } | null>}
   */
  async adminBatchCreateUsers(usersArray) {
    if (typeof fetch === 'undefined') return null;
    if (!Array.isArray(usersArray) || usersArray.length === 0) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
        body: JSON.stringify({ users: usersArray }),
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
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
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
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/admin/database/reset`, {
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
        headers: {
          'Content-Type': 'application/json',
          ...this._getAdminAuthHeaders(),
        },
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
   * Requests server to clear all exams, submissions, and student exam records.
   * @returns {Promise<Object|null>}
   */
  async serverClearAllExams() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/exams/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        if (examManager) {
          examManager.memorySubmissions = [...data.submissions];
          if (examManager.storage) {
            examManager.storage.setItem('trr_exam_submissions_v1', JSON.stringify(data.submissions));
          }
          examManager._notifyListeners('submissions_synced', data.submissions);
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
      const { examId, userId, username, fullName, className, avatar, answers, optionOrder, timeSpentSeconds, integrityBan = false } = submissionData;
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
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files/${encodeURIComponent(fileId)}`, {
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
   * Clears all imported files from the backend server.
   * @returns {Promise<Object|null>}
   */
  async pushClearAllImportedFiles() {
    if (typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/quiz/imported-files/clear-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        const res = await fetch(ep);
        if (res.ok) {
          const data = await res.json();
          if (ep.startsWith('https://mathplatform-ten.vercel.app')) {
            this.baseUrl = 'https://mathplatform-ten.vercel.app';
          }
          return {
            ...data,
            connected: true,
            storageMode: data.storageMode || (data.kvConfigured ? 'cloud_kv' : 'local_file'),
            databaseLabel: data.databaseLabel || (data.kvConfigured ? 'Cloud KV (Upstash Redis)' : 'Local File Store'),
          };
        }
      } catch {
        // Fallback
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

