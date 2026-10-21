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

import { STATIC_QUESTION_BANK, getAllQuestions } from './QuizBank.js';

export const STORAGE_KEY_EXAMS = 'trr_assigned_exams_v1';
export const STORAGE_KEY_SUBMISSIONS = 'trr_exam_submissions_v1';
export const STORAGE_KEY_EXAM_VIOLATIONS = 'trr_exam_violations_v1';
export const STORAGE_KEY_DELETED_EXAMS = 'trr_deleted_exams_v1';
export const STORAGE_KEY_EXAMS_CLEARED = 'trr_exams_cleared_by_admin';

// ── Zero Data Loss ────────────────────────────────────────────────────────────
// Active exam draft key pattern : trr_active_exam_${examId}_${userId}
// Offline submission queue key  : trr_offline_submission_queue_v1
export const STORAGE_KEY_OFFLINE_QUEUE = 'trr_offline_submission_queue_v1';

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
    this._memoryDeletedExams = [];
    this._initStorage();
  }

  _initStorage() {
    if (!this.storage) return;
    try {
      const isCleared = this.storage.getItem('trr_exams_cleared_by_admin') === 'true';
      if (!this.storage.getItem(STORAGE_KEY_EXAMS)) {
        this.storage.setItem(STORAGE_KEY_EXAMS, isCleared ? JSON.stringify([]) : JSON.stringify(DEFAULT_EXAMS));
      }
      if (!this.storage.getItem(STORAGE_KEY_SUBMISSIONS)) {
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify([]));
      }
      if (!this.storage.getItem(STORAGE_KEY_EXAM_VIOLATIONS)) {
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify([]));
      }
      if (!this.storage.getItem(STORAGE_KEY_DELETED_EXAMS)) {
        this.storage.setItem(STORAGE_KEY_DELETED_EXAMS, JSON.stringify([]));
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

  _getDeletedExamIds() {
    if (!this.storage) return this._memoryDeletedExams || [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY_DELETED_EXAMS);
      return raw ? JSON.parse(raw) : (this._memoryDeletedExams || []);
    } catch {
      return this._memoryDeletedExams || [];
    }
  }

  _markExamDeletedLocally(examId) {
    if (!examId) return;
    const strId = String(examId).trim();
    if (!this._memoryDeletedExams) this._memoryDeletedExams = [];
    if (!this._memoryDeletedExams.includes(strId)) {
      this._memoryDeletedExams.push(strId);
    }

    // Immediately purge deleted exam and its submissions from memory
    this.memoryExams = (this.memoryExams || []).filter(e => e && e.id !== strId);
    this.memorySubmissions = (this.memorySubmissions || []).filter(s => s && s.examId !== strId);
    this.memoryExamViolations = (this.memoryExamViolations || []).filter(v => v && v.examId !== strId);

    if (this.storage) {
      try {
        const list = this._getDeletedExamIds();
        if (!list.includes(strId)) {
          list.push(strId);
          this.storage.setItem(STORAGE_KEY_DELETED_EXAMS, JSON.stringify(list));
        }

        const remainingExams = this.getExams().filter(e => e && e.id !== strId);
        const remainingSubs = this.getSubmissions().filter(s => s && s.examId !== strId);
        const remainingViols = this.getExamViolationRecords().filter(v => v && v.examId !== strId);

        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(remainingExams));
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(remainingSubs));
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify(remainingViols));
      } catch {}
    }
  }

  _unmarkExamDeletedLocally(examId) {
    if (!examId) return;
    const strId = String(examId).trim();
    if (this._memoryDeletedExams) {
      this._memoryDeletedExams = this._memoryDeletedExams.filter(id => id !== strId);
    }
    if (this.storage) {
      try {
        const list = this._getDeletedExamIds().filter(id => id !== strId);
        this.storage.setItem(STORAGE_KEY_DELETED_EXAMS, JSON.stringify(list));
      } catch {}
    }
  }

  _isExamDeletedLocally(examId) {
    if (!examId) return false;
    const strId = String(examId).trim();
    if (this._memoryDeletedExams && this._memoryDeletedExams.includes(strId)) return true;
    return this._getDeletedExamIds().includes(strId);
  }

  /**
   * Retrieves all exams.
   * @returns {Array<Object>}
   */
  getExams() {
    const isCleared = this.storage ? this.storage.getItem(STORAGE_KEY_EXAMS_CLEARED) === 'true' : false;
    let list = [];
    if (!this.storage) {
      list = this.memoryExams.map(exam => ({ ...exam }));
    } else {
      try {
        const raw = this.storage.getItem(STORAGE_KEY_EXAMS);
        list = raw ? JSON.parse(raw) : (isCleared ? [] : this.memoryExams.map(exam => ({ ...exam })));
      } catch {
        list = isCleared ? [] : this.memoryExams.map(exam => ({ ...exam }));
      }
    }
    if (!Array.isArray(list)) list = [];
    return list.filter(e => e && e.id && !this._isExamDeletedLocally(e.id));
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
   * Prevents newly created student accounts from receiving obsolete past exams.
   * @param {string} userId
   * @param {Object} [userContext]
   * @returns {Array<Object>}
   */
  getExamsForUser(userId, userContext = null) {
    if (!userId || userId === 'guest') return [];

    let user = userContext;
    if (!user && this.storage) {
      try {
        const usersRaw = this.storage.getItem('trr_registered_users');
        if (usersRaw) {
          const list = JSON.parse(usersRaw);
          user = list.find(u => u.id === userId || u.username === userId);
        }
        if (!user) {
          const currRaw = this.storage.getItem('trr_current_user');
          if (currRaw) {
            const curr = JSON.parse(currRaw);
            if (curr && (curr.id === userId || curr.username === userId)) user = curr;
          }
        }
      } catch {}
    }

    const username = (user && user.username ? user.username : userId).toLowerCase();
    const userClass = (user && user.className ? user.className : '').trim().toLowerCase();

    return this.getExams().filter(exam => {
      if (!Array.isArray(exam.assignedTo)) return false;
      // If targeted specifically to this student ID or username, always include
      if (exam.assignedTo.includes(userId) || exam.assignedTo.some(a => (a || '').toLowerCase() === username)) {
        return true;
      }

      // If targeted to a specific class (e.g. 'class:K66-CNTT' or 'K66-CNTT')
      if (userClass && exam.assignedTo.some(a => {
        const target = (a || '').trim().toLowerCase();
        return target === `class:${userClass}` || target === userClass;
      })) {
        return true;
      }

      // If assigned to 'all':
      if (exam.assignedTo.includes('all')) {
        return true;
      }
      return false;
    });
  }

  /**
   * Alias for getExamsForUser.
   * @param {string} userId
   * @param {Object} [userContext]
   * @returns {Array<Object>}
   */
  getAssignedExams(userId, userContext = null) {
    return this.getExamsForUser(userId, userContext);
  }

  /**
   * Admin creates a new exam and assigns it.
   * Supports both question IDs from question bank and custom imported questions.
   * @param {Object} data
   * @returns {{ success: boolean, error?: string, exam?: Object }}
   */
  createExam({
    id = null,
    title,
    description = '',
    durationMinutes = 15,
    questionIds = [],
    customQuestions = [],
    examCode = null,
    assignedTo = ['all'],
    createdAt = null,
    createdBy = 'user_admin',
    shuffleQuestions = true,
    shuffleOptions = true,
    maxAttempts = 1,
    isPublished = true,
    allowReview = true,
    showAnswersOnComplete = true,
  }) {
    if (typeof title !== 'string' || title.trim().length < 3) {
      return { success: false, error: 'Tiêu đề đề thi phải có ít nhất 3 ký tự.' };
    }

    const customList = Array.isArray(customQuestions) ? customQuestions : [];
    const resolvedIds = (Array.isArray(questionIds) && questionIds.length > 0)
      ? questionIds
      : customList.map(q => q.id);

    if (!Array.isArray(resolvedIds) || resolvedIds.length === 0 || resolvedIds.length !== new Set(resolvedIds).size) {
      return { success: false, error: 'Vui lòng chọn ít nhất 1 câu hỏi cho đề thi.' };
    }

    const customMap = new Map(customList.map(q => [q.id, q]));
    const availableQuestionIds = new Set([
      ...getAllQuestions().map(question => question.id),
      ...customMap.keys(),
    ]);

    if (resolvedIds.some(id => !availableQuestionIds.has(id))) {
      return { success: false, error: 'Danh sách câu hỏi chứa câu hỏi không tồn tại.' };
    }

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || duration < 1 || duration > 180) {
      return { success: false, error: 'Thời gian làm bài phải từ 1 đến 180 phút.' };
    }

    let generatedCode;
    if (examCode && typeof examCode === 'string' && examCode.trim()) {
      generatedCode = examCode.trim().toUpperCase();
    } else {
      const existingExams = this.getExams();
      let maxNum = 100;
      (existingExams || []).forEach(ex => {
        if (!ex) return;
        if (ex.examCode) {
          const m = String(ex.examCode).match(/(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n >= 100 && n < 1000 && n > maxNum) {
              maxNum = n;
            }
          }
        }
      });
      generatedCode = String(maxNum + 1);
    }

    const examId = id && typeof id === 'string' && id.trim()
      ? id.trim()
      : `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const exam = {
      id: examId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      durationMinutes: duration,
      questionIds: [...resolvedIds],
      customQuestions: [...customList],
      examCode: generatedCode,
      assignedTo: Array.isArray(assignedTo) && assignedTo.length > 0 ? assignedTo : ['all'],
      createdAt: createdAt || new Date().toISOString(),
      createdBy,
      shuffleQuestions: Boolean(shuffleQuestions),
      shuffleOptions: Boolean(shuffleOptions),
      maxAttempts: Number(maxAttempts) || 1,
      isPublished: isPublished !== false,
      allowReview: allowReview !== false,
      showAnswersOnComplete: showAnswersOnComplete !== false,
    };

    this._unmarkExamDeletedLocally(examId);

    const exams = this.getExams();
    const existingIdx = exams.findIndex(e => e.id === examId);
    if (existingIdx !== -1) {
      exams[existingIdx] = exam;
    } else {
      exams.unshift(exam);
    }

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
   * Resolves question objects for an exam, checking both built-in bank and custom questions.
   * @param {Object|string} examOrId
   * @returns {Array<Object>}
   */
  getExamQuestions(examOrId) {
    const exam = typeof examOrId === 'string' ? this.getExamById(examOrId) : examOrId;
    if (!exam || !Array.isArray(exam.questionIds)) return [];

    const questionMap = new Map();
    getAllQuestions().forEach(q => questionMap.set(q.id, q));
    if (Array.isArray(exam.customQuestions)) {
      exam.customQuestions.forEach(q => questionMap.set(q.id, q));
    }

    return exam.questionIds.map(id => questionMap.get(id)).filter(Boolean);
  }

  /**
   * Admin deletes an exam and its submissions.
   * @param {string} examId
   * @returns {{ success: boolean }}
   */
  deleteExam(examId) {
    if (!examId) return { success: false };
    this._markExamDeletedLocally(examId);

    const exams = this.getExams().filter(e => e.id !== examId);
    const submissions = this.getSubmissions().filter(s => s.examId !== examId);
    const violations = this.getExamViolationRecords().filter(record => record.examId !== examId);

    this.memoryExams = exams;
    this.memorySubmissions = submissions;
    this.memoryExamViolations = violations;

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(exams));
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify(violations));
      } catch {}
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
   * @param {boolean} [data.integrityBan=false] - Force a zero score after an integrity ban.
   * @returns {{ success: boolean, error?: string, submission?: Object }}
   */
  submitExam({
    examId,
    userId,
    userInfo = {},
    answers = {},
    timeSpentSeconds = 0,
    optionOrder = {},
    integrityBan = false,
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
    let userClass = (userInfo?.className || '').trim().toLowerCase();
    if (!userClass && typeof localStorage !== 'undefined') {
      try {
        const currRaw = localStorage.getItem('trr_current_user');
        if (currRaw) {
          const curr = JSON.parse(currRaw);
          if (curr && (curr.id === userId || curr.username === userId)) {
            userClass = (curr.className || '').trim().toLowerCase();
          }
        }
      } catch {}
    }
    const isTargeted = Array.isArray(exam.assignedTo) && (
      exam.assignedTo.includes('all') ||
      exam.assignedTo.includes(userId) ||
      (userClass && exam.assignedTo.some(a => {
        const target = (a || '').trim().toLowerCase();
        return target === `class:${userClass}` || target === userClass;
      }))
    );
    if (!isTargeted) {
      return { success: false, error: 'Đề thi này không được giao cho tài khoản hoặc lớp của bạn.' };
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
    getAllQuestions().forEach(q => questionMap.set(q.id, q));
    if (Array.isArray(exam.customQuestions)) {
      exam.customQuestions.forEach(q => questionMap.set(q.id, q));
    }

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
    const score = integrityBan ? 0 : Math.round(rawScore * 10) / 10;

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
      integrityBan: Boolean(integrityBan),
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
   * Completely clears all exams, submissions, and violations from storage.
   * @returns {{ success: boolean }}
   */
  clearAllExams() {
    this.memoryExams = [];
    this.memorySubmissions = [];
    this.memoryExamViolations = [];
    this._markExamDeletedLocally('exam_intro_eval_2026');

    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY_EXAMS_CLEARED, 'true');
        this.storage.setItem('trr_exams_cleared_at', String(Date.now()));
        this.storage.setItem(STORAGE_KEY_EXAMS, JSON.stringify([]));
        this.storage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify([]));
        this.storage.setItem(STORAGE_KEY_EXAM_VIOLATIONS, JSON.stringify([]));
        const list = this._getDeletedExamIds();
        if (!list.includes('exam_intro_eval_2026')) {
          list.push('exam_intro_eval_2026');
          this.storage.setItem(STORAGE_KEY_DELETED_EXAMS, JSON.stringify(list));
        }
      } catch {}
    }
    this._notifyListeners('exams_cleared', []);
    return { success: true };
  }

  /**
   * Resets all exams and submissions back to default seed.
   */
  clearAllData() {
    if (this.storage) {
      try {
        this.storage.removeItem('trr_exams_cleared_by_admin');
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

  // ── Zero Data Loss: Draft Management ────────────────────────────────────────

  /**
   * Builds the localStorage key for an active exam draft.
   * @param {string} examId
   * @param {string} userId
   * @returns {string}
   */
  _draftKey(examId, userId) {
    return `trr_active_exam_${examId}_${userId}`;
  }

  /**
   * Saves the current exam session state as a draft into localStorage.
   * Called after every answer selection so no progress is ever lost.
   *
   * @param {string} examId
   * @param {string} userId
   * @param {Object} draftData - { examId, answers, startedAt, timeRemaining, currentQIndex, questionIds, optionOrder }
   */
  saveDraft(examId, userId, draftData) {
    if (!this.storage || !examId || !userId) return;
    try {
      const payload = {
        examId,
        answers:       draftData.answers       || {},
        startedAt:     draftData.startedAt     || Date.now(),
        timeRemaining: draftData.timeRemaining != null ? draftData.timeRemaining : 0,
        currentQIndex: draftData.currentQIndex != null ? draftData.currentQIndex : 0,
        questionIds:   draftData.questionIds   || [],
        optionOrder:   draftData.optionOrder   || {},
      };
      this.storage.setItem(this._draftKey(examId, userId), JSON.stringify(payload));
    } catch {
      // localStorage may be full or unavailable — silently ignore to never crash the exam
    }
  }

  /**
   * Loads a valid (non-expired) draft for the given exam and user.
   * A draft is considered valid when: Date.now() - startedAt < durationMinutes * 60 * 1000
   *
   * @param {string} examId
   * @param {string} userId
   * @returns {Object|null} Draft data or null if absent / expired / corrupt
   */
  loadDraft(examId, userId) {
    if (!this.storage || !examId || !userId) return null;
    try {
      const raw = this.storage.getItem(this._draftKey(examId, userId));
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return null;

      // Validate required fields
      if (!draft.examId || !draft.startedAt) return null;

      // Check expiry against the exam's durationMinutes
      const exam = this.getExamById(examId);
      if (!exam) return null;
      const durationMs = (exam.durationMinutes || 15) * 60 * 1000;
      if (Date.now() - draft.startedAt >= durationMs) {
        // Draft has expired — clean it up
        this.clearDraft(examId, userId);
        return null;
      }

      return draft;
    } catch {
      return null;
    }
  }

  /**
   * Removes the active exam draft from localStorage.
   * Called after a successful submission or when a session is cleanly ended.
   *
   * @param {string} examId
   * @param {string} userId
   */
  clearDraft(examId, userId) {
    if (!this.storage || !examId || !userId) return;
    try {
      this.storage.removeItem(this._draftKey(examId, userId));
    } catch {}
  }

  // ── Zero Data Loss: Offline Submission Queue ─────────────────────────────────

  /**
   * Reads all pending offline submissions from the queue.
   * @returns {Array<Object>}
   */
  getOfflineQueue() {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      const queue = raw ? JSON.parse(raw) : [];
      return Array.isArray(queue) ? queue : [];
    } catch {
      return [];
    }
  }

  /**
   * Adds a submission payload to the offline queue so it can be retried
   * automatically when the network recovers.
   *
   * @param {Object} submissionPayload - Same shape as submitExam() params
   */
  enqueueOfflineSubmission(submissionPayload) {
    if (!this.storage || !submissionPayload) return;
    try {
      const queue = this.getOfflineQueue();
      // Avoid duplicate entries for the same exam+user
      const isDuplicate = queue.some(
        item => item.examId === submissionPayload.examId && item.userId === submissionPayload.userId
      );
      if (!isDuplicate) {
        queue.push({ ...submissionPayload, enqueuedAt: Date.now() });
        this.storage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue));
      }
    } catch {}
  }

  /**
   * Attempts to flush all queued offline submissions to the live system and server.
   * Each item that succeeds is removed from the queue.
   * Safe to call at any time — idempotently skips already-submitted entries.
   *
   * @param {Function} [onFlushed] - Optional callback(submission) called per successful flush
   */
  async flushOfflineQueue(onFlushed) {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      let localSub = this.getSubmission(item.examId, item.userId);
      if (!localSub) {
        const result = this.submitExam(item);
        if (result.success) {
          localSub = result.submission;
        } else if (result.submission) {
          localSub = result.submission;
        } else {
          remaining.push(item);
          continue;
        }
      }

      this.clearDraft(item.examId, item.userId);

      // Attempt to push to server if online
      if (typeof window !== 'undefined') {
        try {
          const { cloudSyncManager } = await import('../sync/CloudSyncManager.js');
          if (cloudSyncManager) {
            const isOnline = await cloudSyncManager.checkConnection().catch(() => false);
            if (isOnline) {
              const serverRes = await cloudSyncManager.serverSubmitExam(localSub);
              if (!serverRes || !serverRes.success) {
                remaining.push(item);
                continue;
              }
            }
          }
        } catch {}
      }

      if (typeof onFlushed === 'function') {
        try { onFlushed(localSub); } catch {}
      }
    }

    try {
      if (this.storage) {
        this.storage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(remaining));
      }
    } catch {}
  }
}

export const examManager = new ExamManager();
