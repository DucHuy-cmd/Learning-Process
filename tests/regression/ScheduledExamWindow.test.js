// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExamManager, examManager } from '../../src/core/quiz/ExamManager.js';
import { AuthManager, authManager } from '../../src/core/auth/AuthManager.js';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { handleRequest } from '../../src/server/app.js';

describe('Scheduled Exam Window & Fixed Entry Enforcement', () => {
  let container;
  let resCode;
  let resData;
  let mockRes;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorage.clear();

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:test');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }

    resCode = 0;
    resData = {};
    mockRes = {
      writeHead: (code) => { resCode = code; },
      setHeader: () => {},
      end: (data) => { resData = data ? JSON.parse(data) : {}; },
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    authManager.logout();
    vi.restoreAllMocks();
  });

  describe('1. ExamManager.getExamScheduleStatus', () => {
    it('returns open and canEnter: true for flexible / unscheduled exams', () => {
      const flexibleExam = {
        id: 'exam_flex',
        title: 'Đề linh hoạt',
        scheduleType: 'flexible',
      };

      const status = examManager.getExamScheduleStatus(flexibleExam);
      expect(status.status).toBe('open');
      expect(status.isScheduled).toBe(false);
      expect(status.canEnter).toBe(true);
    });

    it('returns upcoming and canEnter: false before start time', () => {
      const exam = {
        id: 'exam_sched_1',
        title: 'Đề thi định kỳ',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '07:00',
        lateEntryGraceMinutes: 15,
      };

      // Mock current time: 06:55 (5 minutes before opening)
      const nowMs = new Date(2026, 9, 22, 6, 55, 0, 0).getTime();
      const status = examManager.getExamScheduleStatus(exam, nowMs);

      expect(status.status).toBe('upcoming');
      expect(status.isScheduled).toBe(true);
      expect(status.canEnter).toBe(false);
      expect(status.remainingBeforeOpenMs).toBe(5 * 60 * 1000);
      expect(status.message).toContain('07:00');
    });

    it('returns open and canEnter: true within entry grace window', () => {
      const exam = {
        id: 'exam_sched_2',
        title: 'Đề thi định kỳ',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '07:00',
        lateEntryGraceMinutes: 15, // window: 07:00 to 07:15
      };

      // Mock current time: 07:08 (inside window)
      const nowMs = new Date(2026, 9, 22, 7, 8, 0, 0).getTime();
      const status = examManager.getExamScheduleStatus(exam, nowMs);

      expect(status.status).toBe('open');
      expect(status.isScheduled).toBe(true);
      expect(status.canEnter).toBe(true);
      expect(status.remainingOpenMs).toBe(7 * 60 * 1000);
    });

    it('returns closed and canEnter: false after grace entry deadline has passed', () => {
      const exam = {
        id: 'exam_sched_3',
        title: 'Đề thi định kỳ',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '07:00',
        entryDeadline: '07:15',
        lateEntryGraceMinutes: 15,
      };

      // Mock current time: 07:16 (1 minute after deadline)
      const nowMs = new Date(2026, 9, 22, 7, 16, 0, 0).getTime();
      const status = examManager.getExamScheduleStatus(exam, nowMs);

      expect(status.status).toBe('closed');
      expect(status.isScheduled).toBe(true);
      expect(status.canEnter).toBe(false);
      expect(status.message).toContain('Đã đóng cổng vào thi');
    });
  });

  describe('2. Fuzzy Class Matching & Student Resolution', () => {
    it('correctly resolves students with varying class formats (CQ.67, CQ. 67, Lớp CQ.67)', () => {
      const mockStudents = [
        { id: 'st1', username: 'sv1', fullName: 'Nguyen Van A', className: 'CQ.67', role: 'student' },
        { id: 'st2', username: 'sv2', fullName: 'Tran Thi B', className: 'CQ. 67', role: 'student' },
        { id: 'st3', username: 'sv3', fullName: 'Le Van C', className: 'Lớp CQ.67', role: 'student' },
        { id: 'st4', username: 'sv4', fullName: 'Pham Van D', className: 'lớp CQ. 67', role: 'student' },
        { id: 'st5', username: 'sv5', fullName: 'Hoang Van E', className: 'CNTT.01', role: 'student' },
      ];

      vi.spyOn(authManager, 'getUsers').mockReturnValue(mockStudents);

      const quizView = new QuizView({ container });
      const assigned = quizView._resolveAssignedStudents(['class:CQ.67']);

      expect(assigned.length).toBe(4);
      expect(assigned.map(s => s.id)).toEqual(expect.arrayContaining(['st1', 'st2', 'st3', 'st4']));
      expect(assigned.map(s => s.id)).not.toContain('st5');

      const formatted = quizView._formatExamTarget(['class:CQ.67']);
      expect(formatted).toBe('Lớp CQ.67 (4 sinh viên)');
    });
  });

  describe('3. Student Exam Card UI & Start Lockout', () => {
    it('disables start button and shows countdown badge when exam is upcoming', () => {
      authManager.quickLogin('user_admin');
      const studentCreated = authManager.adminCreateUser({
        username: 'sv_test_upcoming',
        fullName: 'Sinh Viên Chuẩn Bị Thi',
        className: 'CQ.67',
        password: '123',
      });
      authManager.quickLogin(studentCreated.user.id);

      const exam = {
        id: 'exam_upcoming_test',
        title: 'Đề Toán Rời Rạc Chuẩn Bị Mở',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '08:00',
        lateEntryGraceMinutes: 15,
        durationMinutes: 30,
        questionIds: ['q1'],
        assignedTo: ['all'],
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(examManager, 'getExams').mockReturnValue([exam]);
      vi.spyOn(examManager, 'getExamsForUser').mockReturnValue([exam]);
      vi.spyOn(examManager, 'getSubmission').mockReturnValue(null);
      vi.spyOn(examManager, 'loadDraft').mockReturnValue(null);

      // Mock Date.now to 07:30 (before opening)
      const nowMs = new Date(2026, 9, 22, 7, 30, 0, 0).getTime();
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      const quizView = new QuizView({ container });
      quizView.setTab('my-exams');
      quizView.render();

      const card = container.querySelector('.exam-card');
      expect(card).not.toBeNull();
      expect(card.textContent).toContain('CHƯA ĐẾN GIỜ MỞ THI');

      const startBtn = card.querySelector('button[disabled]');
      expect(startBtn).not.toBeNull();
      expect(startBtn.textContent).toContain('Chưa Mở Cổng');
    });

    it('disables start button and marks absent with 0 points when entry deadline has passed', () => {
      authManager.quickLogin('user_admin');
      const studentCreated = authManager.adminCreateUser({
        username: 'sv_test_closed',
        fullName: 'Sinh Viên Hết Giờ',
        className: 'CQ.67',
        password: '123',
      });
      authManager.quickLogin(studentCreated.user.id);

      const exam = {
        id: 'exam_closed_test',
        title: 'Đề Toán Rời Rạc Đã Hết Giờ',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '08:00',
        entryDeadline: '08:15',
        lateEntryGraceMinutes: 15,
        durationMinutes: 30,
        questionIds: ['q1'],
        assignedTo: ['all'],
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(examManager, 'getExams').mockReturnValue([exam]);
      vi.spyOn(examManager, 'getExamsForUser').mockReturnValue([exam]);
      vi.spyOn(examManager, 'getSubmission').mockReturnValue(null);
      vi.spyOn(examManager, 'loadDraft').mockReturnValue(null);

      // Mock Date.now to 08:20 (after deadline 08:15)
      const nowMs = new Date(2026, 9, 22, 8, 20, 0, 0).getTime();
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      const quizView = new QuizView({ container });
      quizView.setTab('my-exams');
      quizView.render();

      const card = container.querySelector('.exam-card');
      expect(card).not.toBeNull();
      expect(card.textContent).toContain('ĐÃ KHÓA CỔNG THI: 0 / 10 ĐIỂM (VẮNG THI)');

      const startBtn = card.querySelector('button[disabled]');
      expect(startBtn).not.toBeNull();
      expect(startBtn.textContent).toContain('Đã Hết Giờ Vào');
    });
  });

  describe('4. Gradebook Modal & CSV Export for Absent Students', () => {
    it('lists unsubmitted students as absent with 0 points when exam is closed', () => {
      const exam = {
        id: 'exam_gradebook_test',
        title: 'Khảo Sát Đồ Thị Định Kỳ',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '07:00',
        entryDeadline: '07:15',
        lateEntryGraceMinutes: 15,
        durationMinutes: 30,
        questionIds: ['q1', 'q2'],
        assignedTo: ['class:CQ.67'],
        createdAt: new Date().toISOString(),
      };

      const mockStudents = [
        { id: 'user_1', username: 'sv1', fullName: 'Nguyễn Văn Đã Nộp', className: 'CQ.67', role: 'student' },
        { id: 'user_2', username: 'sv2', fullName: 'Trần Văn Vắng', className: 'CQ.67', role: 'student' },
      ];

      const mockSubmissions = [
        {
          examId: exam.id,
          userId: 'user_1',
          fullName: 'Nguyễn Văn Đã Nộp',
          className: 'CQ.67',
          score: 10,
          correctCount: 2,
          totalQuestions: 2,
          timeSpentSeconds: 600,
          submittedAt: new Date(2026, 9, 22, 7, 20, 0, 0).toISOString(),
        },
      ];

      vi.spyOn(examManager, 'getExamById').mockReturnValue(exam);
      vi.spyOn(examManager, 'getSubmissionsForExam').mockReturnValue(mockSubmissions);
      vi.spyOn(examManager, 'getSubmission').mockImplementation((examId, userId) => {
        return mockSubmissions.find(s => s.examId === examId && s.userId === userId) || null;
      });
      vi.spyOn(authManager, 'getUsers').mockReturnValue(mockStudents);

      // Current time is 08:00 (closed)
      const nowMs = new Date(2026, 9, 22, 8, 0, 0, 0).getTime();
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      authManager.quickLogin('user_admin');
      const quizView = new QuizView({ container });
      quizView.gradebookExamId = exam.id;
      quizView.render();

      const modal = container.querySelector('.gradebook-modal-card');
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('Nguyễn Văn Đã Nộp');
      expect(modal.textContent).toContain('Trần Văn Vắng');
      expect(modal.textContent).toContain('Vắng thi');

      // Check review button exists for submitted student
      const reviewBtn = modal.querySelector('.btn-admin-review-sub');
      expect(reviewBtn).not.toBeNull();
      expect(reviewBtn.getAttribute('data-user-id')).toBe('user_1');
    });

    it('exports absent students with 0 points into the CSV file', () => {
      const exam = {
        id: 'exam_csv_test',
        title: 'Kỳ Thi Toán',
        scheduleType: 'scheduled',
        examDate: '2026-10-22',
        startTime: '07:00',
        entryDeadline: '07:15',
        lateEntryGraceMinutes: 15,
        durationMinutes: 30,
        questionIds: ['q1'],
        assignedTo: ['class:CQ.67'],
      };

      const mockStudents = [
        { id: 'user_absent', username: 'sv_absent', fullName: 'Hoàng Vắng Mặt', className: 'CQ.67', role: 'student' },
      ];

      vi.spyOn(examManager, 'getExamById').mockReturnValue(exam);
      vi.spyOn(examManager, 'getSubmissionsForExam').mockReturnValue([]);
      vi.spyOn(authManager, 'getUsers').mockReturnValue(mockStudents);

      const nowMs = new Date(2026, 9, 22, 9, 0, 0, 0).getTime();
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);

      let downloadedFilename = null;
      const quizView = new QuizView({ container });
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          el.click = () => {
            downloadedFilename = el.download;
          };
        }
        return el;
      });

      quizView._exportExamSubmissionsToCsv(exam.id);

      expect(downloadedFilename).toContain('Bang_Diem_');
      expect(downloadedFilename).toContain('.csv');
    });
  });

  describe('5. Server API Time & Exam Scheduling Endpoint', () => {
    it('/api/time returns current server time timestamp', async () => {
      const req = {
        method: 'GET',
        url: '/api/time',
        headers: {},
      };

      await handleRequest(req, mockRes);
      expect(resCode).toBe(200);
      expect(resData.success).toBe(true);
      expect(typeof resData.serverTime).toBe('number');
      expect(resData.serverTime).toBeGreaterThan(0);
    });
  });
});
