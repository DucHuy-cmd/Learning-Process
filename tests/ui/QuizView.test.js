import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { cloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

describe('QuizView UI Component', () => {
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

  it('completely removes practice arena tab and pane for all users, defaulting to myExams', () => {
    authManager.logout();
    const quizView = new QuizView({ container });

    expect(container.querySelector('.quiz-header')).not.toBeNull();
    expect(container.querySelector('#tabBtnPractice')).toBeNull();
    expect(container.querySelector('#panePractice')).toBeNull();
    expect(container.querySelector('#tabBtnMyExams').classList.contains('active')).toBe(true);
    expect(container.querySelector('#paneMyExams').style.display).not.toBe('none');
  });

  it('defaults to myExams for admin and provides Studio tab without practice arena', () => {
    const quizView = new QuizView({ container });

    expect(container.querySelector('.quiz-header')).not.toBeNull();
    expect(container.querySelector('#tabBtnPractice')).toBeNull();
    expect(container.querySelector('#panePractice')).toBeNull();
    expect(container.querySelector('#tabBtnMyExams').classList.contains('active')).toBe(true);

    const tabStudio = container.querySelector('#tabBtnStudio');
    expect(tabStudio).not.toBeNull();
    expect(tabStudio.style.display).not.toBe('none');
  });

  it('switches between myExams and studio tabs via setTab method for admin', () => {
    authManager.login('admin', '2HV6868@');
    const quizView = new QuizView({ container });
    expect(quizView.activeTab).toBe('myExams');

    quizView.setTab('studio');
    expect(quizView.activeTab).toBe('studio');
    expect(container.querySelector('#paneStudio').style.display).not.toBe('none');
    expect(container.querySelector('#paneMyExams').style.display).toBe('none');

    // Trying to set 'practice' redirects to 'myExams'
    quizView.setTab('practice');
    expect(quizView.activeTab).toBe('myExams');
    expect(container.querySelector('#paneMyExams').style.display).not.toBe('none');
    expect(container.querySelector('#paneStudio').style.display).toBe('none');
  });

  it('blocks non-admin users from accessing Teacher Exam Studio, redirecting to myExams', () => {
    authManager.logout(); // Guest mode
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    expect(quizView.activeTab).toBe('myExams');
    quizView.setTab('practice');
    expect(quizView.activeTab).toBe('myExams');
  });

  it('verifies that Leaderboard and Practice tabs are completely absent from navigation', () => {
    authManager.quickLogin('user_admin');
    const quizView = new QuizView({ container });
    expect(container.querySelector('#tabBtnLeaderboard')).toBeNull();
    expect(container.querySelector('#paneLeaderboard')).toBeNull();
    expect(container.querySelector('#tabBtnPractice')).toBeNull();
    expect(container.querySelector('#panePractice')).toBeNull();

    quizView.setTab('leaderboard');
    expect(quizView.activeTab).toBe('myExams');

    authManager.logout();
  });

  it('restricts Studio tab based on Admin RBAC', () => {
    // 1. As normal student: Studio tab is hidden
    authManager.register({ username: 'sv_rbac_test', fullName: 'Sinh Viên RBAC', email: 'sv_rbac@toanrr.edu.vn', password: '123456' });
    expect(authManager.isAdmin()).toBe(false);

    const studentQuiz = new QuizView({ container });
    const tabStudioStudent = container.querySelector('#tabBtnStudio');
    expect(tabStudioStudent.style.display).toBe('none');
    expect(container.querySelector('#tabBtnPractice')).toBeNull();

    studentQuiz.setTab('studio');
    expect(studentQuiz.activeTab).toBe('myExams');

    authManager.logout();

    // 2. As single Admin: Studio tab is visible
    authManager.quickLogin('user_admin');
    expect(authManager.isAdmin()).toBe(true);

    const adminQuiz = new QuizView({ container });
    const tabStudioAdmin = container.querySelector('#tabBtnStudio');
    expect(tabStudioAdmin.style.display).not.toBe('none');

    authManager.logout();
  });

  it('renders My Exams tab and prompts login for guest', () => {
    authManager.logout();
    const quizView = new QuizView({ container });
    const tabMyExams = container.querySelector('#tabBtnMyExams');
    expect(tabMyExams).not.toBeNull();

    tabMyExams.click();
    expect(quizView.activeTab).toBe('myExams');
    expect(container.querySelector('#paneMyExams').style.display).not.toBe('none');
    expect(container.textContent).toContain('Đăng Nhập Tài Khoản Sinh Viên Để Làm Đề Thi');
  });

  it('renders assigned exams for logged-in student and allows starting and submitting timed exam', () => {
    // 1. Log in student
    authManager.register({ username: 'sv_exam_taker', fullName: 'Thí Sinh A', email: 'tsa@toanrr.edu.vn', password: '123456' });
    const user = authManager.getCurrentUser();
    expect(user).not.toBeNull();

    // Reset exams for clean test
    examManager.clearAllData();

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    expect(container.textContent).toContain('Cổng Khảo Thí');
    expect(container.textContent).toContain('Thí Sinh A');
    expect(container.querySelector('.exam-card')).not.toBeNull();

    // 2. Start exam
    window.confirm = () => true;
    window.alert = () => {};

    const btnStart = container.querySelector('.btn-start-exam');
    expect(btnStart).not.toBeNull();
    btnStart.click();

    expect(quizView.activeExamSession).not.toBeNull();
    expect(container.querySelector('.active-exam-room')).not.toBeNull();
    expect(container.querySelector('#activeExamTimer')).not.toBeNull();
    expect(container.querySelector('.quiz-header').getAttribute('style')).toContain('display:none');

    // Submit active exam
    quizView._submitActiveExam();
    expect(quizView.activeExamSession).toBeNull();
    authManager.logout();
  });

  it('records exam lockdown violations and locks exam upon 3 infractions', () => {
    authManager.register({ username: 'sv_lockdown_test', fullName: 'Thí Sinh B', email: 'tsb@toanrr.edu.vn', password: '123456' });
    const user = authManager.getCurrentUser();
    examManager.clearAllData();

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;
    container.querySelector('.btn-start-exam').click();

    // Infraction 1
    quizView._recordExamLockdownViolation();
    expect(quizView.activeExamSession.violationCount).toBe(1);

    // Infraction 2 (simulating returning then violating again)
    quizView.activeExamSession.lockdownPending = false;
    quizView._recordExamLockdownViolation();
    expect(quizView.activeExamSession.violationCount).toBe(2);

    // Infraction 3: auto-submits with 0 points
    quizView.activeExamSession.lockdownPending = false;
    quizView._recordExamLockdownViolation();
    expect(quizView.activeExamSession).toBeNull();

    const sub = examManager.getSubmission(examManager.getExams()[0].id, user.id);
    expect(sub).not.toBeNull();
    expect(sub.score).toBe(0);
    expect(sub.integrityBan).toBe(true);
    authManager.logout();
  });

  it('keeps banned students locked out of banned exams while allowing other assigned exams', () => {
    authManager.register({ username: 'sv_selective_ban', fullName: 'Thí Sinh Selective', email: 'tss@toanrr.edu.vn', password: '123456' });
    const user = authManager.getCurrentUser();
    examManager.clearAllData();

    const bannedExam = examManager.createExam({
      title: 'Đề Thi Bị Khóa',
      questionIds: ['logic_q01'],
      createdBy: 'user_admin',
    }).exam;
    const otherExam = examManager.createExam({
      title: 'Đề Thi Bình Thường',
      questionIds: ['logic_q03'],
      createdBy: 'user_admin',
    }).exam;

    examManager.recordExamViolation(bannedExam.id, user.id);
    examManager.recordExamViolation(bannedExam.id, user.id);
    examManager.recordExamViolation(bannedExam.id, user.id);

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    const examCards = Array.from(container.querySelectorAll('.exam-card'));
    const bannedCard = examCards.find(card => card.querySelector('.exam-status-badge.banned') || card.textContent.includes('BỊ CẤM THI LẠI'));
    expect(bannedCard).not.toBeNull();
    expect(bannedCard.querySelector('.btn-start-exam')).toBeNull();

    const otherExamButton = container.querySelector(`.btn-start-exam[data-exam-id="${otherExam.id}"]`);
    expect(otherExamButton).not.toBeNull();
    window.confirm = () => true;
    const requestFullscreen = vi.fn().mockResolvedValue();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    otherExamButton.click();
    expect(quizView.activeExamSession.exam.id).toBe(otherExam.id);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    quizView._submitActiveExam();
    authManager.logout();
  });

  it('repeats the 10-second lockdown countdown until the third violation bans the exam without requesting fullscreen', () => {
    vi.useFakeTimers();
    authManager.register({ username: 'sv_lockdown_timeout', fullName: 'Thí Sinh C', email: 'tsc@toanrr.edu.vn', password: '123456' });
    examManager.clearAllData();
    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;
    container.querySelector('.btn-start-exam').click();

    const session = quizView.activeExamSession;
    const requestFullscreen = vi.fn();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    quizView._recordExamLockdownViolation();
    expect(session.violationCount).toBe(1);
    expect(session.lockdownCountdown).toBe(10);
    expect(container.querySelector('#examLockdownCountdown').textContent).toBe('10');

    vi.advanceTimersByTime(9000);
    expect(session.violationCount).toBe(1);
    expect(session.lockdownCountdown).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(session.violationCount).toBe(2);
    expect(container.querySelector('.exam-lockdown-warning').textContent).toContain('CẢNH BÁO');
    expect(container.querySelector('.exam-lockdown-warning').textContent).toContain('cộng thêm 1 vi phạm');
    expect(session.lockdownCountdown).toBe(10);
    expect(container.querySelector('#examLockdownCountdown').textContent).toBe('10');
    expect(session.lockdownTimerId).not.toBeNull();
    expect(requestFullscreen).not.toHaveBeenCalled();

    session.answers[session.questions[0].id] = session.questions[0].correctId;
    vi.advanceTimersByTime(10000);
    expect(session.violationCount).toBe(3);
    expect(session.lockdownTimerId).toBeNull();
    expect(quizView.activeExamSession).toBeNull();
    expect(examManager.getExamViolationRecord(session.exam.id, authManager.getCurrentUser().id))
      .toMatchObject({ count: 3, banned: true });
    expect(examManager.getSubmission(session.exam.id, authManager.getCurrentUser().id).score).toBe(0);
    authManager.logout();
  });

  it('cancels repeated lockdown countdowns when the student manually continues', async () => {
    vi.useFakeTimers();
    authManager.register({ username: 'sv_lockdown_resume', fullName: 'Thí Sinh D', email: 'tsd@toanrr.edu.vn', password: '123456' });
    examManager.clearAllData();
    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;
    container.querySelector('.btn-start-exam').click();

    const session = quizView.activeExamSession;
    const requestFullscreen = vi.fn().mockResolvedValue();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    quizView._recordExamLockdownViolation();
    vi.advanceTimersByTime(10000);
    expect(session.violationCount).toBe(2);
    expect(session.lockdownTimerId).not.toBeNull();
    container.querySelector('#btnResumeExamLockdown').click();

    expect(session.lockdownTimerId).toBeNull();
    expect(session.lockdownCountdown).toBeNull();
    expect(session.lockdownPending).toBe(false);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(40000);
    expect(session.violationCount).toBe(2);

    await Promise.resolve();
    quizView._submitActiveExam();
    authManager.logout();
  });

  it('displays accurate start exam notice and rules on student dashboard', () => {
    authManager.register({ username: 'sv_notice_check', fullName: 'Thí Sinh Notice', email: 'tsn@toanrr.edu.vn', password: '123456' });
    examManager.clearAllData();
    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    expect(container.textContent).toContain('Mỗi thí sinh chỉ có duy nhất 1 lượt làm');
    expect(container.textContent).toContain('VI PHẠM 3 lần sẽ bị 0đ');

    let confirmPrompt = '';
    window.confirm = (msg) => { confirmPrompt = msg; return false; };
    container.querySelector('.btn-start-exam').click();

    expect(confirmPrompt).toContain('Mỗi thí sinh chỉ có duy nhất 1 lượt làm');
    expect(confirmPrompt).toContain('VI PHẠM 3 lần sẽ bị 0đ');
    expect(confirmPrompt).toContain('Bạn đã sẵn sàng chưa');
    authManager.logout();
  });

  it('allows Admin to create new exam from imported questions, assign to students, and view gradebook in Studio', () => {
    authManager.login('admin', '2HV6868@');
    const quizView = new QuizView({ container });
    quizView.setTab('studio');

    // Load Word questions first
    quizView.importedQuestions = [
      { id: 'q_unit_1', question: 'Câu hỏi unit test?', options: [{ id: 'A', text: 'Đúng' }, { id: 'B', text: 'Sai' }], correctId: 'A' },
    ];
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();
    expect(quizView.importedQuestions.length).toBe(1);

    // Fill title
    const txtTitle = container.querySelector('#txtAssignTitle');
    txtTitle.value = 'Đề Thi Kiểm Tra 15 Phút Unit Test';

    const btnCreate = container.querySelector('#btnCreateAndAssignExam');
    expect(btnCreate).not.toBeNull();
    btnCreate.click();

    expect(container.textContent).toContain('Đề Thi Kiểm Tra 15 Phút Unit Test');

    // Close admin answer key modal
    const btnCloseKey = container.querySelector('#btnCloseAdminAnswerKey');
    if (btnCloseKey) btnCloseKey.click();

    // View gradebook
    const btnGradebook = container.querySelector('.btn-view-gradebook');
    expect(btnGradebook).not.toBeNull();
    btnGradebook.click();

    expect(quizView.gradebookExamId).not.toBeNull();
    expect(container.querySelector('.gradebook-modal-card')).not.toBeNull();
    expect(container.textContent).toContain('Sổ Điểm Điện Tử');

    // Close gradebook
    const btnClose = container.querySelector('#btnCloseGradebook');
    btnClose.click();
    expect(quizView.gradebookExamId).toBeNull();

    authManager.logout();
  });

  it('supports clearing all exams and student submissions from Exam Management', () => {
    const quizView = new QuizView({ container });
    authManager.login('admin', '2HV6868@');
    quizView.setTab('myExams');
    quizView.render();

    const btnClearAll = container.querySelector('#btnAdminClearAllExams');
    expect(btnClearAll).not.toBeNull();
    window.confirm = () => true;
    btnClearAll.click();

    expect(examManager.getExams().length).toBe(0);
    authManager.logout();
  });

  it('renders Teacher A4 and LaTeX print section in Studio print subtab', () => {
    authManager.login('admin', '2HV6868@');
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'print';
    quizView.render();

    const printSection = container.querySelector('#studioPrintSection');
    expect(printSection).not.toBeNull();
    expect(printSection.style.display).not.toBe('none');

    // When no Word questions uploaded yet, shows empty state card
    expect(printSection.textContent).toContain('Chưa Có Câu Hỏi Tự Soạn Nào Để In Ấn');
    expect(container.querySelector('.exam-paper')).toBeNull();

    // With imported questions, renders A4 Paper elements
    quizView.importedQuestions = [
      { id: 'q1', question: 'Câu hỏi mẫu 1', options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }], correctId: 'A' }
    ];
    quizView.render();

    const paper = container.querySelector('.exam-paper');
    expect(paper).not.toBeNull();
    expect(paper.textContent).toContain('ĐỀ THI MÔN: TOÁN RỜI RẠC');
    expect(paper.textContent).toContain('PHIẾU TRẢ LỜI TRẮC NGHIỆM');
  });

  it('persists imported Word questions across multiple sessions in localStorage and allows clearing', () => {
    authManager.login('admin', '2HV6868@');
    const quizView1 = new QuizView({ container });
    quizView1.setTab('studio');

    // Load sample questions
    quizView1.importedQuestions = [
      { id: 'q1', question: 'C1', options: [{ id: 'A', text: 'A' }], correctId: 'A' },
      { id: 'q2', question: 'C2', options: [{ id: 'A', text: 'A' }], correctId: 'A' },
    ];
    quizView1._saveWordQuestions(quizView1.importedQuestions);
    quizView1.render();
    expect(quizView1.importedQuestions.length).toBe(2);

    // Verify localStorage has questions
    const saved = JSON.parse(localStorage.getItem('toanrr_custom_imported_questions_v1') || '[]');
    expect(saved.length).toBe(2);

    // Instantiate fresh QuizView
    const quizView2 = new QuizView({ container });
    quizView2.setTab('studio');
    expect(quizView2.importedQuestions.length).toBe(2);

    // Clear questions via button
    const btnClear = container.querySelector('#btnClearAllWordData');
    btnClear.click();
    expect(quizView2.importedQuestions.length).toBe(0);
    expect(localStorage.getItem('toanrr_custom_imported_questions_v1')).toBeNull();
  });
});
