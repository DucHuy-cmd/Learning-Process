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

    it('accumulates away time across tab switches (e.g. 5s + 5s = 10s) to record violations', () => {
      vi.useFakeTimers();
      authManager.register({ username: 'sv_cumulative_away', fullName: 'Sinh Viên Chuyển Tab', email: 'cumulative@school.vn', password: 'Password123!' });
      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      const btnStart = container.querySelector('.btn-start-exam');
      if (btnStart) btnStart.click();

      const session = quizView.activeExamSession;

      // Student departs 1st time for 5 seconds
      quizView._handleScreenDeparture('window_blur');
      expect(session.violationCount).toBe(0);
      vi.advanceTimersByTime(5000);
      expect(session.lockdownCountdown).toBe(5);

      // Returns within 5 seconds: 0 violations so far, 5s cumulative
      const resumeBtn = container.querySelector('#btnResumeExamLockdown');
      if (resumeBtn) resumeBtn.click();
      expect(session.isAway).toBe(false);
      expect(session.violationCount).toBe(0);

      // Student departs 2nd time (e.g. Alt+Tab to another tab)
      quizView._handleScreenDeparture('tab_hidden');
      // Countdown continues from remaining 5 seconds
      expect(session.lockdownCountdown).toBe(5);

      // 5 more seconds pass -> total 10 cumulative seconds -> 1 violation recorded!
      vi.advanceTimersByTime(5000);
      expect(session.violationCount).toBe(1);
      expect(session.awayViolationRecorded).toBe(true);
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

  describe('5. Student Dashboard Stats & Score Reset When Exams Are Deleted', () => {
    it('resets submitted count and average score to match exactly the remaining active exams', () => {
      // 1. Create a student
      authManager.logout();
      authManager.register({
        username: 'sv_reset_test',
        fullName: 'Sinh Viên Kiểm Tra Reset',
        email: 'reset@school.edu.vn',
        password: 'Password123!',
      });
      const student = authManager.getCurrentUser();
      expect(student).not.toBeNull();

      // Clear any previous exams
      examManager.clearAllExams();

      // 2. Create 2 exams assigned to all
      const exam1 = examManager.createExam({
        id: 'exam_res_1',
        title: 'Đề Thi 1',
        durationMinutes: 15,
        questionIds: ['logic_q01'],
        assignedTo: ['all'],
      }).exam;

      const exam2 = examManager.createExam({
        id: 'exam_res_2',
        title: 'Đề Thi 2',
        durationMinutes: 15,
        questionIds: ['logic_q02'],
        assignedTo: ['all'],
      }).exam;

      // 3. Student submits both exams
      examManager.submitExam({
        examId: exam1.id,
        userId: student.id,
        answers: { logic_q01: 'B' },
        timeSpentSeconds: 60,
      });

      examManager.submitExam({
        examId: exam2.id,
        userId: student.id,
        answers: { logic_q02: 'A' },
        timeSpentSeconds: 60,
      });

      // 4. Render QuizView for student
      const quizView = new QuizView({ container });
      quizView.setTab('myExams');

      // Check initial badges with 2 exams: "ĐỀ ĐƯỢC GIAO" = 2, "ĐÃ NỘP BÀI" = 2, "ĐIỂM TB" = 5.0 / 10 (10 + 0)/2
      expect(container.textContent).toContain('ĐỀ ĐƯỢC GIAO');
      expect(container.textContent).toContain('ĐÃ NỘP BÀI');
      expect(container.textContent).toContain('5.0 / 10');

      // 5. Admin deletes exam 2 (which had score 0)
      examManager.deleteExam(exam2.id);
      quizView.render();

      // Badges must now reflect only exam 1: "ĐỀ ĐƯỢC GIAO" = 1, "ĐÃ NỘP BÀI" = 1, "ĐIỂM TB" = 10.0 / 10
      expect(container.textContent).toContain('10.0 / 10');

      // 6. Admin deletes remaining exam 1 (or clears all exams)
      examManager.deleteExam(exam1.id);
      quizView.render();

      // Badges must reset completely to 0 and 0 / 10!
      expect(container.textContent).toContain('0 / 10');
      expect(container.textContent).toContain('Hiện chưa có đề thi nào được phân công');
    });

    it('smoothly switches Studio subtabs without DOM tearing or recursive re-rendering', () => {
      authManager.login('admin', '2HV6868@');
      const quizView = new QuizView({ container });
      quizView.setTab('studio');

      const btnDist = container.querySelector('#tabStudioDistribute');
      const btnPub = container.querySelector('#tabStudioPublish');
      const btnPrint = container.querySelector('#tabStudioPrint');

      expect(btnDist).not.toBeNull();
      expect(btnPub).not.toBeNull();
      expect(btnPrint).not.toBeNull();

      // Switch to publish subtab
      btnPub.click();
      expect(quizView.studioSubTab).toBe('publish');
      expect(container.querySelector('#studioPublishSection').style.display).toBe('block');
      expect(container.querySelector('#studioDistributeSection').style.display).toBe('none');

      // Switch to print subtab
      btnPrint.click();
      expect(quizView.studioSubTab).toBe('print');
      expect(container.querySelector('#studioPrintSection').style.display).toBe('block');

      // Switch back to distribute subtab
      btnDist.click();
      expect(quizView.studioSubTab).toBe('distribute');
      expect(container.querySelector('#studioDistributeSection').style.display).toBe('block');
    });
  });

  describe('6. Anti-Cheat & Screen Lockdown Robustness (F11, Alt+Tab, DevTools, Cumulative 10s Timer)', () => {
    it('catches F11 keydown, triggers countdown, and bans with 0 points after 3 consecutive 10s cycles', () => {
      vi.useFakeTimers();
      authManager.register({
        username: 'sv_anticheat_f11',
        fullName: 'Sinh Viên F11',
        email: 'f11@school.edu.vn',
        password: 'Password123!',
      });
      const student = authManager.getCurrentUser();
      examManager.clearAllData();

      const examRes = examManager.createExam({
        title: 'Đề Thi Chống Gian Lận F11',
        questionIds: ['logic_q01'],
        durationMinutes: 15,
        assignedTo: [student.id],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      const startBtn = container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`);
      expect(startBtn).not.toBeNull();
      startBtn.click();

      expect(quizView.activeExamSession).not.toBeNull();
      const session = quizView.activeExamSession;
      expect(session.violationCount).toBe(0);

      // 1. Simulate pressing F11
      const f11Event = new window.KeyboardEvent('keydown', { key: 'F11', keyCode: 122, cancelable: true, bubbles: true });
      window.dispatchEvent(f11Event);

      expect(f11Event.defaultPrevented).toBe(true);
      expect(session.isAway).toBe(true);
      expect(session.awayReason).toBe('f11_pressed');
      expect(session.lockdownPending).toBe(true);
      expect(session.lockdownCountdown).toBe(10);

      // 2. 10s elapse without returning -> 1st violation recorded
      vi.advanceTimersByTime(10000);
      expect(session.violationCount).toBe(1);
      expect(session.lockdownCountdown).toBe(10);

      // 3. Another 10s elapse without returning -> 2nd violation recorded
      vi.advanceTimersByTime(10000);
      expect(session.violationCount).toBe(2);
      expect(session.lockdownCountdown).toBe(10);

      // 4. Another 10s elapse without returning -> 3rd violation triggers ban & 0 points
      vi.advanceTimersByTime(10000);
      expect(quizView.activeExamSession).toBeNull();

      const sub = examManager.getSubmission(examId, student.id);
      expect(sub).not.toBeNull();
      expect(sub.score).toBe(0);
      expect(sub.integrityBan).toBe(true);
    });

    it('catches Alt+Tab keydown and accumulates departure time across brief exits', () => {
      vi.useFakeTimers();
      authManager.register({
        username: 'sv_anticheat_alttab',
        fullName: 'Sinh Viên AltTab',
        email: 'alttab@school.edu.vn',
        password: 'Password123!',
      });
      const student = authManager.getCurrentUser();
      examManager.clearAllData();

      const examRes = examManager.createExam({
        title: 'Đề Thi Chống Gian Lận AltTab',
        questionIds: ['logic_q01'],
        durationMinutes: 15,
        assignedTo: [student.id],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
      const session = quizView.activeExamSession;

      // Departure 1: Alt + Tab
      const altTabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, altKey: true, cancelable: true, bubbles: true });
      window.dispatchEvent(altTabEvent);

      expect(altTabEvent.defaultPrevented).toBe(true);
      expect(session.isAway).toBe(true);
      expect(session.awayReason).toBe('alt_tab_pressed');

      // Away for 5 seconds
      vi.advanceTimersByTime(5000);
      expect(session.violationCount).toBe(0);
      expect(session.lockdownCountdown).toBe(5);

      // Returns in time
      container.querySelector('#btnResumeExamLockdown').click();
      expect(session.isAway).toBe(false);
      expect(session.cumulativeAwaySeconds).toBe(5);

      // Departure 2: Window blur
      window.dispatchEvent(new window.Event('blur'));
      expect(session.isAway).toBe(true);
      expect(session.lockdownCountdown).toBe(5);

      // Another 5 seconds -> cumulative reaches 10s -> 1st violation!
      vi.advanceTimersByTime(5000);
      expect(session.violationCount).toBe(1);
    });

    it('blocks DevTools shortcuts, text selection, copy, cut, and right-click context menu', () => {
      authManager.register({
        username: 'sv_anticheat_devtools',
        fullName: 'Sinh Viên DevTools',
        email: 'devtools@school.edu.vn',
        password: 'Password123!',
      });
      const student = authManager.getCurrentUser();
      examManager.clearAllData();

      const examRes = examManager.createExam({
        title: 'Đề Thi Chống DevTools & Copy',
        questionIds: ['logic_q01'],
        durationMinutes: 15,
        assignedTo: [student.id],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
      const session = quizView.activeExamSession;

      // 1. F12 keydown
      const f12Event = new window.KeyboardEvent('keydown', { key: 'F12', keyCode: 123, cancelable: true, bubbles: true });
      window.dispatchEvent(f12Event);
      expect(f12Event.defaultPrevented).toBe(true);
      expect(session.awayReason).toBe('devtools_attempt');

      // Return
      container.querySelector('#btnResumeExamLockdown').click();

      // 2. Ctrl + Shift + I
      const ctrlShiftIEvent = new window.KeyboardEvent('keydown', { key: 'I', ctrlKey: true, shiftKey: true, cancelable: true, bubbles: true });
      window.dispatchEvent(ctrlShiftIEvent);
      expect(ctrlShiftIEvent.defaultPrevented).toBe(true);
      expect(session.awayReason).toBe('devtools_attempt');

      // 3. Right-click contextmenu
      const contextMenuEvent = new window.MouseEvent('contextmenu', { cancelable: true, bubbles: true });
      document.dispatchEvent(contextMenuEvent);
      expect(contextMenuEvent.defaultPrevented).toBe(true);

      // 4. Copy & Cut
      const copyEvent = new window.Event('copy', { cancelable: true, bubbles: true });
      document.dispatchEvent(copyEvent);
      expect(copyEvent.defaultPrevented).toBe(true);

      const cutEvent = new window.Event('cut', { cancelable: true, bubbles: true });
      document.dispatchEvent(cutEvent);
      expect(cutEvent.defaultPrevented).toBe(true);

      // 5. Selectstart
      const selectEvent = new window.Event('selectstart', { cancelable: true, bubbles: true });
      document.dispatchEvent(selectEvent);
      expect(selectEvent.defaultPrevented).toBe(true);
    });

    it('handles mobile app switching via pagehide and visibilitychange correctly', () => {
      vi.useFakeTimers();
      authManager.register({
        username: 'sv_anticheat_mobile',
        fullName: 'Sinh Viên Mobile',
        email: 'mobile@school.edu.vn',
        password: 'Password123!',
      });
      const student = authManager.getCurrentUser();
      examManager.clearAllData();

      const examRes = examManager.createExam({
        title: 'Đề Mobile Test',
        questionIds: ['logic_q01'],
        durationMinutes: 15,
        assignedTo: [student.id],
        createdBy: 'user_admin',
      });
      const examId = examRes.exam.id;

      const quizView = new QuizView({ container });
      quizView.setTab('myExams');
      window.confirm = () => true;

      container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
      const session = quizView.activeExamSession;

      // Mobile swipe to home / app switch triggers pagehide
      window.dispatchEvent(new window.Event('pagehide'));
      expect(session.isAway).toBe(true);
      expect(session.awayReason).toBe('pagehide');

      // Away on mobile for 32 seconds (switched to chat app)
      vi.advanceTimersByTime(32000);

      // Exam must be banned and auto-submitted with 0 points
      expect(quizView.activeExamSession).toBeNull();
      const sub = examManager.getSubmission(examId, student.id);
      expect(sub).not.toBeNull();
      expect(sub.score).toBe(0);
      expect(sub.integrityBan).toBe(true);
    });
  });
});
