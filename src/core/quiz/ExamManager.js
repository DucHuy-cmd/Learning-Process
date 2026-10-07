/**
 * @file ExamManager.js
 * Core Examination & Assignment Management System for Toán Rời Rạc Platform.
 * 
 * Features:
 * - Timed examination lifecycle with client-side countdown enforcement.
 * - Targeted exam assignment (assign to all students or specific student IDs).
 * - "1 Attempt Only" strict examination integrity rule (mỗi đề chỉ được làm 1 lần).
 * - Standardized Grading Scale 10 (Thang điểm 10, e.g. 8.5/10).
 * - Official GPA / Average Score-based Leaderboard (Bảng xếp hạng điểm trung bình).
 * - Offline-First persistence in LocalStorage with Cloud Synchronization.
 */

import { STATIC_QUESTION_BANK } from './QuizBank.js';

export const STORAGE_KEY_EXAMS = 'trr_assigned_exams_v1';
export const STORAGE_KEY_SUBMISSIONS = 'trr_exam_submissions_v1';
export const STORAGE_KEY_EXAM_VIOLATIONS = 'trr_exam_violations_v1';

export const DEFAULT_EXAMS = [
  {
    id: 'exam_intro_eval_2026',
    title: 'Đề Khảo Sát Năng Lực Đầu Khóa: Toán Rời Rạc',
    description: 'Đề thi trắc nghiệm tổng hợp 4 chương: Logic mệnh đề, Tổ hợp đếm, Quan hệ hai ngôi và Lý thuyết đồ thị.',
    durationMinutes: 15,
    questionIds: [
      'logic_q01',
      'logic_q03',
      'circuit_q01',
      'count_q01',
      'count_q07',
      'count_q12',
      'rel_q01',
      'rel_q03',
      'graph_q01',
      'dijkstra_q01',
    ],
    assignedTo: ['all'],
    createdAt: '2026-09-29T10:00:00.000Z',
    createdBy: 'user_admin',
    shuffleQuestions: true,
    shuffleOptions: true,
  },
];

export class ExamManager {
  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage]
   */
  constructor(options = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this.listeners = new Set();
    this.memoryExams = [...DEFAULT_EXAMS];
    this.memorySubmissions = [];
    this.memoryExamViolations = [];
    this._initStorage();
  }

  _initStorage() {
    if (!this.storage) return;
    try {
      if (!this.storage.getItem(STORAGE_KEY_EXAMS)) {
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(DEFAULT_EXAMS));
      }
      if (!this.storage.getItem(STORAGE_KEY_SUBMISSIONS)) {
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify([]));
      }
      if (!this.storage.getItem(STORAGE_KEY_EXAM_VIOLATIONS)) {
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify([]));
      }
    } catch {}
  }

  /**
   * Subscribes to exam / submission state change events.
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (err) {
        console.error('[ExamManager] Listener error:', err);
      }
    });
  }

  /**
   * Retrieves all exams.
   * @returns {Array<Object>}
   */
  getExams() {
    if (!this.storage) return this.memoryExams.map(exam => ({ ...exam }));
    try {
      const raw = this.storage.getItem(STORAGE_KEY_EXAMS);
      return raw ? JSON.parse(raw) : this.memoryExams.map(exam => ({ ...exam }));
    } catch {
      return this.memoryExams.map(exam => ({ ...exam }));
    }
  }

  /**
   * Finds an exam by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getExamById(id) {
    return this.getExams().find(e => e.id === id) || null;
  }

  /**
   * Returns list of exams assigned to a given user.
   * @param {string} userId
   * @returns {Array<Object>}
   */
  getExamsForUser(userId) {
    if (!userId || userId === 'guest') return [];
    return this.getExams().filter(exam => {
      if (!Array.isArray(exam.assignedTo)) return false;
      return exam.assignedTo.includes('all') || exam.assignedTo.includes(userId);
    });
  }

  /**
   * Admin creates a new exam and assigns it.
   * @param {Object} data
   * @returns {{ success: boolean, error?: string, exam?: Object }}
   */
  createExam({
    title,
    description = '',
    durationMinutes = 15,
    questionIds = [],
    assignedTo = ['all'],
    createdBy = 'user_admin',
    shuffleQuestions = true,
    shuffleOptions = true,
  }) {
    if (typeof title !== 'string' || title.trim().length < 3) {
      return { success: false, error: 'Tiêu đề đề thi phải có ít nhất 3 ký tự.' };
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0 || questionIds.length !== new Set(questionIds).size) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi cho đề thi.' };
    }
    const availableQuestionIds = new Set(STATIC_QUESTION_BANK.map(question => question.id));
    if (questionIds.some(id => !availableQuestionIds.has(id))) {
      return { success: false, error: 'Danh sách câu hỏi chứa câu hỏi không tồn tại.' };
    }
    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration < 1 || duration > 180) {
      return { success: false, error: 'Thời gian làm bài phải từ 1 đến 180 phút.' };
    }

    const exam = {
      id: `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      durationMinutes: duration,
      questionIds: [...questionIds],
      assignedTo: Array.isArray(assignedTo) && assignedTo.length > 0 ? assignedTo : ['all'],
      createdAt: new Date().toISOString(),
      createdBy,
      shuffleQuestions: Boolean(shuffleQuestions),
      shuffleOptions: Boolean(shuffleOptions),
    };

    const exams = this.getExams();
    exams.unshift(exam);

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(exams));
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      this.memoryExams = exams;
    }

    this._notifyListeners('exam_created', exam);
    return { success: true, exam };
  }

  /**
   * Admin deletes an exam and its submissions.
   * @param {string} examId
   * @returns {{ success: boolean }}
   */
  deleteExam(examId) {
    const exams = this.getExams().filter(e => e.id !== examId);
    const submissions = this.getSubmissions().filter(s => s.examId !== examId);
    const violations = this.getExamViolationRecords().filter(record => record.examId !== examId);

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(exams));
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify(violations));
      } catch {}
    } else {
      this.memoryExams = exams;
      this.memorySubmissions = submissions;
      this.memoryExamViolations = violations;
    }

    this._notifyListeners('exam_deleted', { examId });
    return { success: true };
  }

  /**
   * Retrieves all submissions.
   * @returns {Array<Object>}
   */
  getSubmissions() {
    if (!this.storage) return this.memorySubmissions.map(submission => ({ ...submission }));
    try {
      const raw = this.storage.getItem(STORAGE_KEY_SUBMISSIONS);
      return raw ? JSON.parse(raw) : this.memorySubmissions.map(submission => ({ ...submission }));
    } catch {
      return this.memorySubmissions.map(submission => ({ ...submission }));
    }
  }

  /**
   * Finds submission for a specific user and exam.
   * @param {string} examId
   * @param {string} userId
   * @returns {Object|null}
   */
  getSubmission(examId, userId) {
    if (!examId || !userId) return null;
    return this.getSubmissions().find(s => s.examId === examId && s.userId === userId) || null;
  }

  /**
   * Gets all submissions for an exam.
   * @param {string} examId
   * @returns {Array<Object>}
   */
  getSubmissionsForExam(examId) {
    return this.getSubmissions().filter(s => s.examId === examId);
  }

  getExamViolationRecords() {
    if (!this.storage) return this.memoryExamViolations.map(record => ({ ...record }));
    try {
      const raw = this.storage.getItem(STORAGE_KEY_EXAM_VIOLATIONS);
      const records = raw ? JSON.parse(raw) : [];
      return Array.isArray(records) ? records : [];
    } catch {
      return this.memoryExamViolations.map(record => ({ ...record }));
    }
  }

  getExamViolationRecord(examId, userId) {
    if (!examId || !userId) return { examId, userId, count: 0, banned: false };
    return this.getExamViolationRecords().find(record =>
      record.examId === examId && record.userId === userId
    ) || { examId, userId, count: 0, banned: false };
  }

  recordExamViolation(examId, userId) {
    if (!examId || !userId || userId === 'guest') {
      return { success: false, error: 'Không thể ghi nhận vi phạm thi.' };
    }

    const records = this.getExamViolationRecords();
    const record = records.find(item => item.examId === examId && item.userId === userId);
    const nextRecord = record || { examId, userId, count: 0 };
    nextRecord.count = Math.min(3, Math.max(0, Number(nextRecord.count) || 0) + 1);
    nextRecord.banned = nextRecord.count >= 3;
    nextRecord.updatedAt = new Date().toISOString();
    if (!record) records.push(nextRecord);

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify(records));
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      this.memoryExamViolations = records;
    }

    this._notifyListeners('exam_violation_recorded', { ...nextRecord });
    return { success: true, record: { ...nextRecord } };
  }

  /**
   * Student submits an exam.
   * Strict enforcement: Each user can ONLY submit once per exam.
   * Graded on Standard Scale 10 (Thang điểm 10).
   * 
   * @param {Object} data
   * @param {string} data.examId
   * @param {string} data.userId
   * @param {Object} [data.userInfo]
   * @param {Record<string, string>} data.answers - Map of questionId -> selectedOptionId
   * @param {number} [data.timeSpentSeconds=0]
   * @returns {{ success: boolean, error?: string, submission?: Object }}
   */
  submitExam({
    examId,
    userId,
    userInfo = {},
    answers = {},
    timeSpentSeconds = 0,
    optionOrder = {},
  }) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return { success: false, error: 'Danh sách đáp án không hợp lệ.' };
    }
    if (!userId || userId === 'guest') {
      return { success: false, error: 'Bạn cần đăng nhập tài khoản sinh viên để làm và nộp đề thi chính thức.' };
    }

    const exam = this.getExamById(examId);
    if (!exam) {
      return { success: false, error: 'Đề thi không tồn tại hoặc đã bị xóa.' };
    }
    if (!Array.isArray(exam.assignedTo) || (!exam.assignedTo.includes('all') && !exam.assignedTo.includes(userId))) {
      return { success: false, error: 'Đề thi này không được giao cho tài khoản của bạn.' };
    }

    // Strict 1-attempt rule
    const existing = this.getSubmission(examId, userId);
    if (existing) {
      return {
        success: false,
        error: 'Bạn đã nộp bài thi này rồi! Theo quy chế thi cử, mỗi đề thi chỉ được làm 1 lần duy nhất.',
        submission: existing,
      };
    }

    // Calculate score on scale 10
    const questionMap = new Map();
    STATIC_QUESTION_BANK.forEach(q => questionMap.set(q.id, q));

    const totalQuestions = exam.questionIds.length;
    let correctCount = 0;

    exam.questionIds.forEach(qId => {
      const q = questionMap.get(qId);
      if (q && answers[qId] === q.correctId) {
        correctCount++;
      }
    });

    // Score on scale 10, rounded to 1 decimal place
    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
    const score = Math.round(rawScore * 10) / 10;

    const submission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      examId,
      examTitle: exam.title,
      userId,
      username: userInfo.username || userId,
      fullName: userInfo.fullName || userInfo.username || userId,
      className: userInfo.className || 'Sinh viên',
      avatar: userInfo.avatar || '👤',
      answers: { ...answers },
      optionOrder: Object.fromEntries(
        exam.questionIds.map(questionId => {
          const question = questionMap.get(questionId);
          const requestedOrder = optionOrder && typeof optionOrder === 'object' && !Array.isArray(optionOrder)
            ? optionOrder[questionId]
            : null;
          const validOptionIds = question ? question.options.map(option => option.id) : [];
          const isValidOrder = Array.isArray(requestedOrder) &&
            requestedOrder.length === validOptionIds.length &&
            new Set(requestedOrder).size === validOptionIds.length &&
            requestedOrder.every(id => validOptionIds.includes(id));
          return [questionId, isValidOrder ? [...requestedOrder] : validOptionIds];
        })
      ),
      score,
      correctCount,
      totalQuestions,
      timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)),
      submittedAt: new Date().toISOString(),
    };

    const submissions = this.getSubmissions();
    submissions.push(submission);

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      this.memorySubmissions = submissions;
    }

    this._notifyListeners('exam_submitted', submission);
    return { success: true, submission };
  }

  /**
   * Computes the Official Exam Leaderboard ranked by Average GPA (Điểm Trung Bình Thang 10).
   * 
   * Primary: Average Score (Điểm trung bình) descending
   * Secondary: Number of exams completed descending
   * Tertiary: Accuracy percentage descending
   * Quaternary: Total time spent ascending (faster is better)
   * 
   * @param {number} [limit=50]
   * @returns {Array<Object>}
   */
  getLeaderboard(limit = 50) {
    const submissions = this.getSubmissions();
    const userMap = new Map();

    submissions.forEach(sub => {
      if (!sub.userId || sub.userId === 'guest' || sub.userId === 'user_admin' || sub.username === 'admin') {
        return; // Exclude guests and system admin from student rankings
      }

      if (!userMap.has(sub.userId)) {
        userMap.set(sub.userId, {
          userId: sub.userId,
          username: sub.username,
          fullName: sub.fullName,
          className: sub.className,
          avatar: sub.avatar || '👤',
          submissions: [],
          totalScore: 0,
          totalCorrect: 0,
          totalQuestions: 0,
          totalTimeSeconds: 0,
        });
      }

      const record = userMap.get(sub.userId);
      record.submissions.push(sub);
      record.totalScore += sub.score;
      record.totalCorrect += sub.correctCount;
      record.totalQuestions += sub.totalQuestions;
      record.totalTimeSeconds += sub.timeSpentSeconds;
    });

    const studentList = Array.from(userMap.values()).map(item => {
      const examsCompleted = item.submissions.length;
      const averageScore = examsCompleted > 0 
        ? Math.round((item.totalScore / examsCompleted) * 10) / 10 
        : 0;
      const accuracy = item.totalQuestions > 0 
        ? Math.round((item.totalCorrect / item.totalQuestions) * 100) 
        : 0;

      return {
        userId: item.userId,
        username: item.username,
        fullName: item.fullName,
        className: item.className,
        avatar: item.avatar,
        averageScore,
        examsCompleted,
        totalCorrect: item.totalCorrect,
        totalQuestions: item.totalQuestions,
        accuracy,
        totalTimeSeconds: item.totalTimeSeconds,
      };
    });

    studentList.sort((a, b) => {
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }
      if (b.examsCompleted !== a.examsCompleted) {
        return b.examsCompleted - a.examsCompleted;
      }
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      return a.totalTimeSeconds - b.totalTimeSeconds;
    });

    return studentList.slice(0, limit).map((item, idx) => {
      const rank = idx + 1;
      let rankBadge = `${rank}`;
      let badge = 'Học viên năng nổ';

      if (rank === 1) {
        rankBadge = '🥇';
        badge = '🥇 Quán Quân Đấu Trường';
      } else if (rank === 2) {
        rankBadge = '🥈';
        badge = '🥈 Á Khoa Toàn Diện';
      } else if (rank === 3) {
        rankBadge = '🥉';
        badge = '🥉 Quý Quân Toán Rời Rạc';
      } else if (rank <= 10) {
        rankBadge = `⭐ ${rank}`;
        badge = 'Top 10 Xuất Sắc';
      }

      return {
        ...item,
        rank,
        rankBadge,
        badge,
      };
    });
  }

  /**
   * Resets all exams and submissions back to default seed.
   */
  clearAllData() {
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(DEFAULT_EXAMS));
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify([]));
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify([]));
      } catch {}
    } else {
      this.memoryExams = [...DEFAULT_EXAMS];
      this.memorySubmissions = [];
      this.memoryExamViolations = [];
    }
    this._notifyListeners('data_reset', {});
  }
}

export const examManager = new ExamManager();
