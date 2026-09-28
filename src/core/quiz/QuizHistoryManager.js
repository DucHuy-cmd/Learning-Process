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

export const INITIAL_LEADERBOARD = [
  {
    userId: 'user_duchuy',
    username: 'duchuy',
    fullName: 'Đức Huy',
    className: 'Khóa 66 Công nghệ thông tin',
    avatar: '👨‍🎓',
    score: 2850,
    totalAnswered: 40,
    correctCount: 38,
    accuracy: 95,
    maxStreak: 18,
    badge: '🏆 Thủ Khoa K66',
  },
  {
    userId: 'user_nhatvu',
    username: 'nhatvu',
    fullName: 'Nhất Vũ',
    className: 'Khóa 66 Công nghệ thông tin',
    avatar: '👨‍💻',
    score: 2720,
    totalAnswered: 38,
    correctCount: 35,
    accuracy: 92,
    maxStreak: 15,
    badge: '🥈 Á Khoa K66',
  },
  {
    userId: 'user_truongvu',
    username: 'truongvu',
    fullName: 'Trường Vũ',
    className: 'Khóa 66 Công nghệ thông tin',
    avatar: '👨‍🔬',
    score: 2590,
    totalAnswered: 35,
    correctCount: 31,
    accuracy: 89,
    maxStreak: 14,
    badge: '🥉 Hạng Ba K66',
  },
  {
    userId: 'user_ngochung',
    username: 'ngochung',
    fullName: 'Ngọc Hưng',
    className: 'Khóa 66 Công nghệ thông tin',
    avatar: '👨‍🏫',
    score: 2480,
    totalAnswered: 34,
    correctCount: 30,
    accuracy: 88,
    maxStreak: 12,
    badge: '🎖️ Top 4 K66',
  },
];

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
        const statsMap = {};
        for (const item of INITIAL_LEADERBOARD) {
          statsMap[item.userId] = {
            ...item,
            history: [
              {
                id: `quiz_init_${item.userId}`,
                examTitle: 'Đề thi tổng hợp 4 phân môn Toán Rời Rạc',
                score: item.score / 100,
                maxScore: 30,
                accuracy: item.accuracy,
                date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
              },
            ],
          };
        }
        storage.setItem(STORAGE_KEY_QUIZ_STATS, JSON.stringify(statsMap));
      }
    } catch {
      // fallback
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
