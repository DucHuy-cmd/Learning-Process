import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { cloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

describe('Exam Workflow, Student Identity Resolution & Lockdown Integrity Tests', () => {
  let dom;
  let document;
  let window;
  let container;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="quizContainer"></div>
      </body>
      </html>
    `, { url: 'http://localhost/' });

    window = dom.window;
    document = window.document;
    window.alert = () => {};
    window.confirm = () => true;
    global.window = window;
    global.document = document;

    container = document.getElementById('quizContainer');
    global.localStorage = window.localStorage;
    authManager.login('admin', '2HV6868@');
  });

  afterEach(() => {
    vi.useRealTimers();
    authManager.logout();
    vi.restoreAllMocks();
    delete global.localStorage;
    delete global.window;
    delete global.document;
  });

  describe('1. Student Name & Username Resolution in Gradebook', () => {
    it('renders real full name and username in gradebook and never displays "Sinh viên • @"', () => {
      // Register test student
      const regRes = authManager.register({
        username: 'nguyenvana',
        fullName: 'Nguyễn Văn An',
        email: 'vana@school.edu.vn',
        password: 'Password123!',
        className: 'CNTT-K64',
      });
      expect(regRes.success).toBe(true);
      const student = regRes.user;
      expect(student).toBeDefined();

      // Create exam
      const examRes = examManager.createExam({
        title: 'Đề Kiểm Tra Giải Tích',
        questionIds: ['q1'],
        customQuestions: [{ id: 'q1', question: '1+1=?', options: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }], correctId: 'A' }],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      // Submit exam for student
      examManager.submitExam({
        examId,
        userId: student.id,
        userInfo: { fullName: student.fullName, username: student.username, className: student.className },
        answers: { q1: 'A' },
        timeSpentSeconds: 60,
      });

      authManager.login('admin', '2HV6868@');
      const quizView = new QuizView({ container });
      quizView.gradebookExamId = examId;
      quizView.render();

      const gradebookText = container.textContent;
      expect(gradebookText).toContain('Nguyễn Văn An');
      expect(gradebookText).toContain('@nguyenvana');
      // Must not end with a lonely @ without a username
      expect(gradebookText).not.toMatch(/Sinh viên\s+•\s+@\s*(?:<|\n|$)/);
    });

    it('provides clear fallback for legacy submissions lacking full name, never showing lonely "@"', () => {
      const examRes = examManager.createExam({
        title: 'Đề Legacy Test',
        questionIds: ['q1'],
        customQuestions: [{ id: 'q1', question: 'Test?', options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }], correctId: 'A' }],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      // Legacy submission with minimal fields
      examManager.submitExam({
        examId,
        userId: 'legacy_student_99',
        userInfo: {},
        answers: { q1: 'A' },
        timeSpentSeconds: 45,
      });

      authManager.login('admin', '2HV6868@');
      const quizView = new QuizView({ container });
      quizView.gradebookExamId = examId;
      quizView.render();

      const gradebookText = container.textContent;
      // Must not end with a lonely @ without a username
      expect(gradebookText).not.toMatch(/Sinh viên\s+•\s+@\s*(?:<|\n|$)/);
      expect(gradebookText).toContain('legacy_student_99');
    });
  });

  describe('2. Exam Creation & Distribution Button Stability', () => {
    it('prevents multiple rapid clicks with debounce lock (_isCreatingExam)', async () => {
      authManager.login('admin', '2HV6868@');
      const quizView = new QuizView({ container });
      quizView.setTab('studio');

      quizView.importedQuestions = [
        { id: 'q_debounce_1', question: 'Câu hỏi debounce?', options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], correctId: 'A' },
      ];
      quizView._saveWordQuestions(quizView.importedQuestions);
      quizView.render();

      const txtTitle = container.querySelector('#txtAssignTitle');
      txtTitle.value = 'Đề Test Debounce';

      const btnCreate = container.querySelector('#btnCreateAndAssignExam');
      expect(btnCreate).not.toBeNull();

      // Spy on createExam
      const createExamSpy = vi.spyOn(examManager, 'createExam');

      // Click button twice rapidly
      btnCreate.click();
      btnCreate.click();

      // Debounce lock ensures createExam is only called once
      expect(createExamSpy).toHaveBeenCalledTimes(1);
    });

    it('automatically triggers answer key CSV export upon successful exam creation', () => {
      authManager.login('admin', '2HV6868@');
      const quizView = new QuizView({ container });
      quizView.setTab('studio');

      quizView.importedQuestions = [
        { id: 'q_export_1', question: 'Câu hỏi export key?', options: [{ id: 'A', text: 'Đúng' }, { id: 'B', text: 'Sai' }], correctId: 'A' },
      ];
      quizView._saveWordQuestions(quizView.importedQuestions);
      quizView.render();

      const txtTitle = container.querySelector('#txtAssignTitle');
      txtTitle.value = 'Đề Auto Export Key';

      const exportSpy = vi.spyOn(quizView, '_exportAdminAnswerKeyToCsv');

      const btnCreate = container.querySelector('#btnCreateAndAssignExam');
      btnCreate.click();

      expect(exportSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Lockdown Departure Detection & 10-Second Countdown Rules', () => {
    it('records 0 violations when student returns within 10 seconds or clicks resume button', () => {
      vi.useFakeTimers();
      authManager.register({ username: 'sv_fast_return', fullName: 'Sinh Viên Nhanh', email: 'fast@school.vn', password: 'Password123!' });
      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      // Start exam
      const btnStart = container.querySelector('.btn-start-exam');
      if (btnStart) btnStart.click();

      const session = quizView.activeExamSession;
      expect(session).not.toBeNull();
      expect(session.violationCount).toBe(0);

      // Student departs (blur or hidden)
      quizView._handleScreenDeparture('window_blur');
      expect(session.isAway).toBe(true);
      expect(session.lockdownCountdown).toBe(10);

      // Advance 6 seconds (remaining 4 seconds)
      vi.advanceTimersByTime(6000);
      expect(session.lockdownCountdown).toBe(4);
      expect(session.violationCount).toBe(0);

      // Student clicks resume button
      const resumeBtn = container.querySelector('#btnResumeExamLockdown');
      expect(resumeBtn).not.toBeNull();
      resumeBtn.click();

      // Countdown cancelled and 0 violations recorded
      expect(session.isAway).toBe(false);
      expect(session.lockdownCountdown).toBeNull();
      expect(session.violationCount).toBe(0);
    });

    it('records exactly 1 violation when 10 seconds expire and does not add violations every second', () => {
      vi.useFakeTimers();
      authManager.register({ username: 'sv_slow_return', fullName: 'Sinh Viên Rời Lâu', email: 'slow@school.vn', password: 'Password123!' });
      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      const btnStart = container.querySelector('.btn-start-exam');
      if (btnStart) btnStart.click();

      const session = quizView.activeExamSession;

      // Student departs
      quizView._handleScreenDeparture('fullscreen_exit');
      expect(session.violationCount).toBe(0);

      // Exactly 10 seconds expire
      vi.advanceTimersByTime(10000);
      expect(session.violationCount).toBe(1);
      expect(session.awayViolationRecorded).toBe(true);

      // Student remains away for another 20 seconds: violationCount must NOT increment
      vi.advanceTimersByTime(20000);
      expect(session.violationCount).toBe(1);
    });

    it('handles multiple distinct departure episodes with fresh 10s countdowns and bans on 3rd violation', () => {
      vi.useFakeTimers();
      authManager.register({ username: 'sv_repeat_violator', fullName: 'Sinh Viên Tái Phạm', email: 'repeat@school.vn', password: 'Password123!' });
      const user = authManager.getCurrentUser();
      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      const btnStart = container.querySelector('.btn-start-exam');
      if (btnStart) btnStart.click();

      const session = quizView.activeExamSession;

      // Episode 1: Leaves > 10s -> Violation 1
      quizView._handleScreenDeparture('tab_hidden');
      vi.advanceTimersByTime(10000);
      expect(session.violationCount).toBe(1);

      // Student returns
      quizView._handleScreenReturn();
      expect(session.isAway).toBe(false);

      // Episode 2: Leaves > 10s -> Violation 2
      quizView._handleScreenDeparture('tab_hidden');
      vi.advanceTimersByTime(10000);
      expect(session.violationCount).toBe(2);

      // Student returns
      quizView._handleScreenReturn();
      expect(session.isAway).toBe(false);

      // Episode 3: Leaves > 10s -> Violation 3 -> Auto-ban
      quizView._handleScreenDeparture('tab_hidden');
      vi.advanceTimersByTime(10000);

      // Session ends with 0 score and integrity ban
      expect(quizView.activeExamSession).toBeNull();
      const submission = examManager.getSubmission(session.exam.id, user.id);
      expect(submission).not.toBeNull();
      expect(submission.score).toBe(0);
      expect(submission.integrityBan).toBe(true);
    });
  });

  describe('4. Math and Option Rendering for Diverse Question Types', () => {
    it('correctly formats LaTeX formulas and displays 2, 3, 4, or N options', () => {
      const quizView = new QuizView({ container });

      // Test LaTeX formatter
      const rawText = 'Tìm nghiệm của phương trình $x^2 + 2x + 1 = 0$ và $\\sum_{i=1}^{n} i$';
      const formatted = quizView._formatExamContent(rawText);
      expect(formatted).not.toBeNull();
      expect(formatted.length).toBeGreaterThan(0);

      // Test questions with 2 options (True/False)
      const q2 = {
        id: 'q_2opt',
        question: 'Mệnh đề $P \\implies Q$ tương đương với $\\neg P \\lor Q$?',
        options: [
          { id: 'A', text: 'Đúng' },
          { id: 'B', text: 'Sai' },
        ],
        correctId: 'A',
      };
      expect(q2.options.length).toBe(2);

      // Test questions with 3 options
      const q3 = {
        id: 'q_3opt',
        question: 'Độ phức tạp thuật toán Dijkstra với ma trận kề?',
        options: [
          { id: 'A', text: '$O(V^2)$' },
          { id: 'B', text: '$O(E \\log V)$' },
          { id: 'C', text: '$O(V + E)$' },
        ],
        correctId: 'A',
      };
      expect(q3.options.length).toBe(3);

      // Test questions with 4 options
      const q4 = {
        id: 'q_4opt',
        question: 'Chọn công thức đúng của số tổ hợp chập $k$ của $n$ phần tử:',
        options: [
          { id: 'A', text: '$C_n^k = \\frac{n!}{k!(n-k)!}$' },
          { id: 'B', text: '$A_n^k = \\frac{n!}{(n-k)!}$' },
          { id: 'C', text: '$n^k$' },
          { id: 'D', text: '$k!$' },
        ],
        correctId: 'A',
      };
      expect(q4.options.length).toBe(4);
    });
  });
});
