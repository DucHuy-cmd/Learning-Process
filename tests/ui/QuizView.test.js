import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { quizHistoryManager } from '../../src/core/quiz/QuizHistoryManager.js';

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
    global.window = window;
    global.document = document;

    container = document.getElementById('quizContainer');
  });

  afterEach(() => {
    authManager.logout();
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

    quizView.setTab('leaderboard');
    expect(quizView.activeTab).toBe('leaderboard');
    expect(container.querySelector('#paneLeaderboard').style.display).not.toBe('none');
    expect(container.querySelector('#panePractice').style.display).toBe('none');
    expect(container.querySelector('#paneStudio').style.display).toBe('none');
  });

  it('blocks non-admin users from accessing Teacher Exam Studio', () => {
    authManager.logout(); // Guest mode
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    expect(quizView.activeTab).toBe('practice');
  });

  it('renders Leaderboard tab with Podium, Rankings Table, and Guest prompt', () => {
    const quizView = new QuizView({ container });
    const tabLeaderboard = container.querySelector('#tabBtnLeaderboard');
    expect(tabLeaderboard).not.toBeNull();

    tabLeaderboard.click();
    expect(quizView.activeTab).toBe('leaderboard');
    expect(container.querySelector('#paneLeaderboard').style.display).not.toBe('none');

    // Header & Podium
    expect(container.textContent).toContain('BẢNG VÀNG THÀNH TÍCH');
    expect(container.textContent).toContain('Sinh viên Toán Rời Rạc');
    expect(container.querySelector('.leaderboard-podium-row')).not.toBeNull();
    expect(container.querySelector('.podium-rank-1')).not.toBeNull();
    expect(container.querySelector('.podium-rank-2')).not.toBeNull();
    expect(container.querySelector('.podium-rank-3')).not.toBeNull();

    // Empty state message when freshly initialized
    expect(container.textContent).toContain('Bảng xếp hạng hiện đang trống');

    // Rankings table
    expect(container.querySelector('.leaderboard-table')).not.toBeNull();

    // CTA back to practice
    const btnGoPractice = container.querySelector('#btnGoToPracticeFromLb');
    expect(btnGoPractice).not.toBeNull();
    btnGoPractice.click();
    expect(quizView.activeTab).toBe('practice');
    expect(container.querySelector('#panePractice').style.display).not.toBe('none');
  });

  it('records practice answers into quizHistoryManager for logged-in user', () => {
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

    // Click correct answer
    const btnOpt = container.querySelector(`.btn-quiz-option[data-opt-id="${correctId}"]`);
    btnOpt.click();

    const updatedStats = quizHistoryManager.getUserStats(user.id);
    expect(updatedStats.totalAnswered).toBe(prevAnswered + 1);
    expect(updatedStats.correctCount).toBe(prevCorrect + 1);

    authManager.logout();
  });

  it('restricts Studio tab and Leaderboard reset button based on Admin RBAC', () => {
    // 1. As normal student: Studio tab is hidden and Leaderboard reset button does not exist
    authManager.register({ username: 'sv_rbac_test', fullName: 'Sinh Viên RBAC', email: 'sv_rbac@toanrr.edu.vn', password: '123456' });
    expect(authManager.isAdmin()).toBe(false);

    const studentQuiz = new QuizView({ container });
    const tabStudioStudent = container.querySelector('#tabBtnStudio');
    expect(tabStudioStudent.style.display).toBe('none');

    studentQuiz.setTab('leaderboard');
    expect(container.querySelector('#btnAdminResetLeaderboard')).toBeNull();

    authManager.logout();

    // 2. As single Admin: Studio tab is visible and Leaderboard reset button is displayed
    authManager.quickLogin('user_admin');
    expect(authManager.isAdmin()).toBe(true);

    const adminQuiz = new QuizView({ container });
    const tabStudioAdmin = container.querySelector('#tabBtnStudio');
    expect(tabStudioAdmin.style.display).not.toBe('none');

    adminQuiz.setTab('leaderboard');
    const btnResetLb = container.querySelector('#btnAdminResetLeaderboard');
    expect(btnResetLb).not.toBeNull();

    // 3. Reset leaderboard clears all scores
    window.confirm = () => true;
    btnResetLb.click();
    expect(quizHistoryManager.getLeaderboard().length).toBe(0);

    authManager.logout();
  });
});
