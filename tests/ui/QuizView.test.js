import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { quizHistoryManager } from '../../src/core/quiz/QuizHistoryManager.js';
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
  });

  afterEach(() => {
    authManager.logout();
    vi.restoreAllMocks();
    delete global.window;
    delete global.document;
  });

  it('renders interactive practice arena by default', () => {
    const quizView = new QuizView({ container });

    expect(container.querySelector('.quiz-header')).not.toBeNull();
    expect(container.querySelector('#tabBtnPractice').classList.contains('active')).toBe(true);
    expect(container.querySelector('#panePractice').style.display).not.toBe('none');
    expect(container.querySelector('#paneStudio').style.display).toBe('none');

    // Scoreboard elements
    expect(container.textContent).toContain('Điểm Số');
    expect(container.textContent).toContain('Tỷ Lệ Đúng');
    expect(container.textContent).toContain('Chuỗi Thắng');

    // Question card
    const card = container.querySelector('.practice-question-card');
    expect(card).not.toBeNull();

    // 4 option buttons
    const options = container.querySelectorAll('.btn-quiz-option');
    expect(options.length).toBe(4);
  });

  it('handles question answering: awards points on correct answer and increments streak', () => {
    const quizView = new QuizView({ container });
    const currentQ = quizView.practiceQuestions[quizView.currentIndex];
    const correctId = currentQ.correctId;

    // Find and click the correct option button
    const correctBtn = container.querySelector(`.btn-quiz-option[data-opt-id="${correctId}"]`);
    expect(correctBtn).not.toBeNull();

    correctBtn.click();

    expect(quizView.userAnswers[currentQ.id]).toBe(correctId);
    expect(quizView.score).toBe(10);
    expect(quizView.streak).toBe(1);
    expect(quizView.maxStreak).toBe(1);

    // Explanation box should be revealed
    const explanationBox = container.querySelector('.quiz-explanation-box');
    expect(explanationBox).not.toBeNull();
    expect(explanationBox.textContent).toContain(currentQ.explanation);
  });

  it('handles incorrect answer: breaks winning streak and reveals correct answer', () => {
    const quizView = new QuizView({ container });
    const currentQ = quizView.practiceQuestions[quizView.currentIndex];
    const wrongId = ['A', 'B', 'C', 'D'].find(id => id !== currentQ.correctId);

    const wrongBtn = container.querySelector(`.btn-quiz-option[data-opt-id="${wrongId}"]`);
    wrongBtn.click();

    expect(quizView.userAnswers[currentQ.id]).toBe(wrongId);
    expect(quizView.score).toBe(0);
    expect(quizView.streak).toBe(0);

    // Explanation is revealed
    const explanationBox = container.querySelector('.quiz-explanation-box');
    expect(explanationBox).not.toBeNull();
  });

  it('navigates through questions with Next and Prev buttons', () => {
    const quizView = new QuizView({ container });
    expect(quizView.currentIndex).toBe(0);

    const btnNext = container.querySelector('#btnPracticeNext');
    btnNext.click();
    expect(quizView.currentIndex).toBe(1);

    const btnPrev = container.querySelector('#btnPracticePrev');
    btnPrev.click();
    expect(quizView.currentIndex).toBe(0);
  });

  it('triggers action link callbacks to open relevant lab with algorithm or expression', () => {
    const onOpenLogicWithExpr = vi.fn();
    const onOpenLabWithAlgo = vi.fn();
    const onOpenCounting = vi.fn();
    const onOpenRelation = vi.fn();

    const quizView = new QuizView({
      container,
      onOpenLogicWithExpr,
      onOpenLabWithAlgo,
      onOpenCounting,
      onOpenRelation,
    });

    // Find a question with an actionLink
    const targetIdx = quizView.practiceQuestions.findIndex(q => q.actionLink);
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    quizView.currentIndex = targetIdx;
    quizView.render();

    const targetQ = quizView.practiceQuestions[targetIdx];
    const correctBtn = container.querySelector(`.btn-quiz-option[data-opt-id="${targetQ.correctId}"]`);
    correctBtn.click();

    const btnOpen = container.querySelector('.btn-open-lab');
    expect(btnOpen).not.toBeNull();
    btnOpen.click();

    if (targetQ.actionLink.view === 'logic') {
      expect(onOpenLogicWithExpr).toHaveBeenCalledWith(targetQ.actionLink.expression);
    } else if (targetQ.actionLink.view === 'lab') {
      expect(onOpenLabWithAlgo).toHaveBeenCalledWith(targetQ.actionLink.algoKey);
    } else if (targetQ.actionLink.view === 'counting') {
      expect(onOpenCounting).toHaveBeenCalledWith(targetQ.actionLink.tab);
    } else if (targetQ.actionLink.view === 'relation') {
      expect(onOpenRelation).toHaveBeenCalledWith(targetQ.actionLink.tab);
    }
  });

  it('supports setTopic to dynamically filter questions across all 4 chapters', () => {
    const quizView = new QuizView({ container });

    ['logic', 'counting', 'relation', 'graph'].forEach(topic => {
      quizView.setTopic(topic);
      expect(quizView.practiceFilter.topic).toBe(topic);
      expect(quizView.practiceQuestions.length).toBeGreaterThan(0);
      quizView.practiceQuestions.forEach(q => {
        expect(q.topic).toBe(topic);
      });
    });
  });

  it('switches to Teacher Exam Studio and renders printable A4 sheet with Exam Code', () => {
    authManager.login('admin', 'admin123');
    const quizView = new QuizView({ container });

    const tabStudio = container.querySelector('#tabBtnStudio');
    tabStudio.click();

    expect(quizView.activeTab).toBe('studio');
    expect(container.querySelector('#paneStudio').style.display).not.toBe('none');
    expect(container.querySelector('#panePractice').style.display).toBe('none');

    // A4 Paper elements
    const paper = container.querySelector('.exam-paper');
    expect(paper).not.toBeNull();
    expect(paper.textContent).toContain('ĐỀ THI MÔN: TOÁN RỜI RẠC');
    expect(paper.textContent).toContain(`MÃ ĐỀ THI: ${quizView.currentExam.examCode}`);
    expect(paper.textContent).toContain('PHIẾU TRẢ LỜI TRẮC NGHIỆM');

    // Teacher Answer Key Page
    const teacherKey = container.querySelector('.teacher-key-page');
    expect(teacherKey).not.toBeNull();
    expect(teacherKey.textContent).toContain('DÀNH CHO GIẢNG VIÊN / CÔ CHẤM THI');
    expect(teacherKey.textContent).toContain('1. Bảng Đáp Án Nhanh:');
  });

  it('regenerates exam paper when question count or new exam button is clicked', () => {
    const quizView = new QuizView({ container });
    quizView.activeTab = 'studio';
    quizView.render();

    const oldCode = quizView.currentExam.examCode;

    // Change count to 5
    const selCount = container.querySelector('#selStudioCount');
    selCount.value = '5';
    selCount.dispatchEvent(new window.Event('change'));

    expect(quizView.currentExam.questions.length).toBe(5);

    // Click "Đổi Mã Đề Khác"
    const btnGenNew = container.querySelector('#btnGenNewExam');
    btnGenNew.click();
    expect(quizView.currentExam.questions.length).toBe(5);
  });

  it('toggles visibility of Teacher detailed solutions', () => {
    const quizView = new QuizView({ container });
    quizView.activeTab = 'studio';
    quizView.render();

    const chkSolutions = container.querySelector('#chkShowSolutions');
    expect(chkSolutions.checked).toBe(true);

    chkSolutions.checked = false;
    chkSolutions.dispatchEvent(new window.Event('change'));

    expect(quizView.showTeacherSolutions).toBe(false);
    const teacherKey = container.querySelector('.teacher-key-page');
    expect(teacherKey.style.display).toBe('none');
  });

  it('renders options in vertical column layout preventing text overflow', () => {
    const quizView = new QuizView({ container });
    const list = container.querySelector('.quiz-options-list');
    expect(list).not.toBeNull();
    expect(list.style.display).toBe('flex');
    expect(list.style.flexDirection).toBe('column');

    const options = container.querySelectorAll('.btn-quiz-option');
    expect(options.length).toBe(4);
    options.forEach(opt => {
      expect(opt.style.whiteSpace).toContain('normal');
      expect(opt.style.width).toBe('100%');
    });
  });

  it('handles print button click by setting is-printing-exam and invoking window.print', async () => {
    const printSpy = vi.fn();
    window.print = printSpy;

    const quizView = new QuizView({ container });
    quizView.activeTab = 'studio';
    quizView.render();

    const btnPrint = container.querySelector('#btnPrintExam');
    expect(btnPrint).not.toBeNull();

    btnPrint.click();

    expect(document.body.classList.contains('is-printing-exam')).toBe(true);

    // Wait for the setTimeout in btnPrint handler
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Simulate afterprint
    window.dispatchEvent(new window.Event('afterprint'));
    expect(document.body.classList.contains('is-printing-exam')).toBe(false);
  });

  it('switches between tabs via setTab method for admin', () => {
    authManager.login('admin', 'admin123');
    const quizView = new QuizView({ container });
    expect(quizView.activeTab).toBe('practice');

    quizView.setTab('studio');
    expect(quizView.activeTab).toBe('studio');
    expect(container.querySelector('#paneStudio').style.display).not.toBe('none');
    expect(container.querySelector('#panePractice').style.display).toBe('none');

    quizView.setTab('practice');
    expect(quizView.activeTab).toBe('practice');
    expect(container.querySelector('#panePractice').style.display).not.toBe('none');
    expect(container.querySelector('#paneStudio').style.display).toBe('none');

    quizView.setTab('myExams');
    expect(quizView.activeTab).toBe('myExams');
    expect(container.querySelector('#paneMyExams').style.display).not.toBe('none');
    expect(container.querySelector('#panePractice').style.display).toBe('none');
    expect(container.querySelector('#paneStudio').style.display).toBe('none');
  });

  it('blocks non-admin users from accessing Teacher Exam Studio', () => {
    authManager.logout(); // Guest mode
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    expect(quizView.activeTab).toBe('practice');
  });

  it('verifies that Leaderboard tab is completely removed from navigation and UI', () => {
    authManager.quickLogin('user_admin');
    const quizView = new QuizView({ container });
    expect(container.querySelector('#tabBtnLeaderboard')).toBeNull();
    expect(container.querySelector('#paneLeaderboard')).toBeNull();

    quizView.setTab('leaderboard');
    expect(quizView.activeTab).toBe('practice');

    authManager.logout();
  });

  it('keeps practice answers out of the official leaderboard and server sync', () => {
    // Register and log in as student
    authManager.register({ username: 'sv_practice_test', fullName: 'Sinh Viên Test', email: 'sv_prac@toanrr.edu.vn', password: '123456' });
    const user = authManager.getCurrentUser();
    expect(user).not.toBeNull();

    const quizView = new QuizView({ container });
    const currentQ = quizView.practiceQuestions[quizView.currentIndex];
    const correctId = currentQ.correctId;

    const initialStats = quizHistoryManager.getUserStats(user.id);
    const prevAnswered = initialStats.totalAnswered;
    const prevCorrect = initialStats.correctCount;
    const pushQuizAnswer = vi.spyOn(cloudSyncManager, 'pushQuizAnswer').mockResolvedValue(null);

    // Click correct answer
    const btnOpt = container.querySelector(`.btn-quiz-option[data-opt-id="${correctId}"]`);
    btnOpt.click();

    const updatedStats = quizHistoryManager.getUserStats(user.id);
    expect(updatedStats.totalAnswered).toBe(prevAnswered);
    expect(updatedStats.correctCount).toBe(prevCorrect);
    expect(pushQuizAnswer).not.toHaveBeenCalled();

    authManager.logout();
  });

  it('lets admins select exact questions and configure question and option shuffling', () => {
    authManager.quickLogin('user_admin');
    const quizView = new QuizView({ container });
    quizView.setTab('studio');

    const mode = container.querySelector('#selAssignSelectionMode');
    mode.value = 'manual';
    mode.dispatchEvent(new window.Event('change'));
    expect(container.querySelector('#manualQuestionList').style.display).toBe('block');

    const selectedQuestionIds = ['logic_q01', 'logic_q03'];
    selectedQuestionIds.forEach(id => {
      container.querySelector(`.chk-assign-question[value="${id}"]`).checked = true;
    });
    container.querySelector('#chkShuffleQuestions').checked = false;
    container.querySelector('#chkShuffleOptions').checked = false;
    container.querySelector('#txtAssignTitle').value = 'Đề thi chọn câu thủ công';
    container.querySelector('#btnCreateAndAssignExam').click();

    const createdExam = examManager.getExams().find(exam => exam.title === 'Đề thi chọn câu thủ công');
    expect(createdExam.questionIds).toEqual(selectedQuestionIds);
    expect(createdExam.shuffleQuestions).toBe(false);
    expect(createdExam.shuffleOptions).toBe(false);
  });

  it('restricts Studio tab based on Admin RBAC and ensures Leaderboard is removed', () => {
    // 1. As normal student: Studio tab is hidden and Leaderboard is completely absent
    authManager.register({ username: 'sv_rbac_test', fullName: 'Sinh Viên RBAC', email: 'sv_rbac@toanrr.edu.vn', password: '123456' });
    expect(authManager.isAdmin()).toBe(false);

    const studentQuiz = new QuizView({ container });
    const tabStudioStudent = container.querySelector('#tabBtnStudio');
    expect(tabStudioStudent.style.display).toBe('none');

    expect(container.querySelector('#tabBtnLeaderboard')).toBeNull();

    studentQuiz.setTab('studio');
    expect(studentQuiz.activeTab).toBe('practice');

    authManager.logout();

    // 2. As single Admin: Studio tab is visible
    authManager.quickLogin('user_admin');
    expect(authManager.isAdmin()).toBe(true);

    const adminQuiz = new QuizView({ container });
    const tabStudioAdmin = container.querySelector('#tabBtnStudio');
    expect(tabStudioAdmin.style.display).not.toBe('none');

    expect(container.querySelector('#tabBtnLeaderboard')).toBeNull();

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

    // 3. Jump to question and answer
    const qButtons = container.querySelectorAll('.exam-q-jump-btn');
    expect(qButtons.length).toBeGreaterThan(0);

    const firstOpt = container.querySelector('.btn-active-exam-opt');
    expect(firstOpt).not.toBeNull();
    firstOpt.click();

    const currQ = quizView.activeExamSession.questions[quizView.activeExamSession.currentQIndex];
    expect(quizView.activeExamSession.answers[currQ.id]).not.toBeNull();

    // 4. Submit exam
    const btnSubmit = container.querySelector('#btnSubmitActiveExam');
    expect(btnSubmit).not.toBeNull();
    btnSubmit.click();

    // Exam session should be cleared, score shown
    expect(quizView.activeExamSession).toBeNull();
    expect(quizView.reviewSubmission).not.toBeNull();
    expect(container.textContent).toContain('Kết Quả Bài Thi');
    expect(container.textContent).toContain('/ 10 điểm');
    // Ensure answers are NOT revealed to student
    expect(container.textContent).not.toContain('Đáp án chuẩn');
    expect(container.textContent).not.toContain('Lời giải chi tiết');

    // 5. Check Gradebook and Excel Export button for Admin
    authManager.quickLogin('user_admin');
    quizView.setTab('studio');
    const btnGradebook = container.querySelector('.btn-view-gradebook');
    if (btnGradebook) {
      btnGradebook.click();
      expect(container.querySelector('#btnExportGradebookExcel')).not.toBeNull();
      expect(container.textContent).toContain('Thí Sinh A');
    }

    authManager.logout();
  });

  it('blocks a banned exam but still allows the student to start a different exam', () => {
    authManager.register({ username: 'sv_exam_scope', fullName: 'Thí Sinh B', email: 'tsb@toanrr.edu.vn', password: '123456' });
    const user = authManager.getCurrentUser();
    examManager.clearAllData();
    const [bannedExam] = examManager.getExams();
    const otherExam = examManager.createExam({
      title: 'Đề thi vẫn được phép làm',
      questionIds: ['logic_q01'],
    }).exam;
    examManager.recordExamViolation(bannedExam.id, user.id);
    examManager.recordExamViolation(bannedExam.id, user.id);
    examManager.recordExamViolation(bannedExam.id, user.id);

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    const examCards = Array.from(container.querySelectorAll('.exam-card'));
    const bannedCard = examCards.find(card => card.textContent.includes('BỊ CẤM THI LẠI ĐỀ NÀY'));
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

  it('allows Admin to create new exam, assign to students, and view gradebook in Studio', () => {
    authManager.login('admin', 'admin123');
    const quizView = new QuizView({ container });
    quizView.setTab('studio');

    // Tab sub-switch to assign
    const tabAssign = container.querySelector('#tabStudioAssign');
    expect(tabAssign).not.toBeNull();
    tabAssign.click();
    expect(quizView.studioSubTab).toBe('assign');

    window.alert = () => {};

    // Fill form and create exam
    const txtTitle = container.querySelector('#txtAssignTitle');
    txtTitle.value = 'Đề Thi Kiểm Tra 15 Phút Unit Test';

    const btnCreate = container.querySelector('#btnCreateAndAssignExam');
    expect(btnCreate).not.toBeNull();
    btnCreate.click();

    expect(container.textContent).toContain('Đề Thi Kiểm Tra 15 Phút Unit Test');

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
});
