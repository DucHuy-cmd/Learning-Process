/**
 * @file QuizHistoryManager.js
 * Manages Quiz History, User Statistics, and K66 CNTT Class Leaderboard.
 * 
 * Features:
 * - Persistent score, accuracy, streak, and exam results indexed by userId.
 * - Dynamic leaderboard ranking (Top 1, 2, 3 with gold, silver, bronze medals).
 * - Pre-seeded benchmark data for K66 CNTT author team members.
 */

const STORAGE_KEY_QUIZ_STATS = 'trr_quiz_stats_v1';

export const INITIAL_LEADERBOARD = [];

export class QuizHistoryManager {
  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage]
   */
  constructor(options = {}) {
    this.storage = options.storage || null;
    this._initStorage();
  }

  _getStorage() {
    return this.storage || (typeof window !== 'undefined' ? window.localStorage : null) || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  _initStorage() {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      const existing = storage.getItem(STORAGE_KEY_QUIZ_STATS);
      if (!existing) {
        storage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify({}));
      } else {
        // Clean out legacy demo leaderboard users if present
        try {
          const map = JSON.parse(existing);
          let changed = false;
          for (const key of ['user_nhatvu', 'user_truongvu', 'user_ngochung', 'user_admin']) {
            if (map[key]) {
              delete map[key];
              changed = true;
            }
          }
          if (changed) {
            storage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify(map));
          }
        } catch {}
      }
    } catch {
      // fallback
    }
  }

  /**
   * Resets all leaderboard stats.
   */
  clearLeaderboard() {
    const storage = this._getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify({}));
      } catch {}
    }
  }

  _readMap() {
    const storage = this._getStorage();
    if (!storage) return {};
    try {
      let raw = storage.getItem(STORAGE_KEY_QUIZ_STATS);
      if (!raw) {
        this._initStorage();
        raw = storage.getItem(STORAGE_KEY_QUIZ_STATS);
      }
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _writeMap(map) {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify(map));
    } catch (err) {
      console.error('[QuizHistoryManager] Storage write failed:', err);
    }
  }

  /**
   * Gets statistics for a specific user.
   * @param {string} userId
   * @returns {Object}
   */
  getUserStats(userId = 'guest') {
    const map = this._readMap();
    if (map[userId]) return map[userId];

    return {
      userId,
      username: userId,
      fullName: userId === 'guest' ? 'Khách' : userId,
      className: 'Khóa 66 Công nghệ thông tin',
      avatar: '👤',
      score: 0,
      totalAnswered: 0,
      correctCount: 0,
      accuracy: 0,
      maxStreak: 0,
      history: [],
    };
  }

  /**
   * Records a single answer attempt in interactive practice mode.
   * @param {string} userId
   * @param {boolean} isCorrect
   * @param {Object} [userInfo]
   */
  recordAnswer(userId = 'guest', isCorrect, userInfo = {}) {
    const map = this._readMap();
    const current = map[userId] || {
      userId,
      username: userInfo.username || userId,
      fullName: userInfo.fullName || (userId === 'guest' ? 'Khách' : userId),
      className: userInfo.className || 'Khóa 66 Công nghệ thông tin',
      avatar: userInfo.avatar || '👤',
      score: 0,
      totalAnswered: 0,
      correctCount: 0,
      accuracy: 0,
      maxStreak: 0,
      currentStreak: 0,
      history: [],
    };

    current.totalAnswered += 1;
    if (isCorrect) {
      current.correctCount += 1;
      current.score += 100;
      current.currentStreak = (current.currentStreak || 0) + 1;
      if (current.currentStreak > current.maxStreak) {
        current.maxStreak = current.currentStreak;
      }
    } else {
      current.currentStreak = 0;
    }

    current.accuracy = Math.round((current.correctCount / current.totalAnswered) * 100);
    map[userId] = current;
    this._writeMap(map);
    return current;
  }

  /**
   * Records completed exam / test session.
   * @param {string} userId
   * @param {Object} examResult
   */
  recordExam(userId = 'guest', examResult, userInfo = {}) {
    const map = this._readMap();
    const current = this.getUserStats(userId);

    const record = {
      id: `exam_${Date.now()}`,
      examTitle: examResult.title || 'Đề thi trắc nghiệm',
      score: examResult.score || 0,
      maxScore: examResult.maxScore || 10,
      accuracy: Math.round(((examResult.score || 0) / (examResult.maxScore || 10)) * 100),
      topic: examResult.topic || 'all',
      date: new Date().toISOString(),
    };

    if (!current.history) current.history = [];
    current.history.unshift(record);
    if (current.history.length > 20) current.history.pop();

    if (userInfo.fullName) current.fullName = userInfo.fullName;
    if (userInfo.avatar) current.avatar = userInfo.avatar;
    if (userInfo.className) current.className = userInfo.className;

    map[userId] = current;
    this._writeMap(map);
    return current;
  }

  /**
   * Returns sorted leaderboard list.
   * @returns {Array<Object>}
   */
  getLeaderboard() {
    const map = this._readMap();
    const list = Object.values(map).filter(u => u.userId !== 'guest' && u.totalAnswered > 0);

    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.accuracy - a.accuracy;
    });

    return list.map((item, index) => {
      let rankBadge = `${index + 1}`;
      if (index === 0) rankBadge = '🥇';
      if (index === 1) rankBadge = '🥈';
      if (index === 2) rankBadge = '🥉';

      return {
        ...item,
        rank: index + 1,
        rankBadge,
      };
    });
  }
}

export const quizHistoryManager = new QuizHistoryManager();
