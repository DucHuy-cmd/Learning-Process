import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { generateSampleExamText, generateSampleExamCsv } from '../../src/core/quiz/ExamParser.js';

describe('Admin Exam Import & Dedicated Answer Key Test Suite', () => {
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
    authManager.login('admin', '2HV6868@');
    examManager.clearAllData();
  });

  afterEach(() => {
    vi.useRealTimers();
    authManager.logout();
    vi.restoreAllMocks();
    delete global.window;
    delete global.document;
  });

  it('renders exam import section in Studio tab with text and csv modes', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    expect(container.querySelector('#importExamBox')).not.toBeNull();
    expect(container.querySelector('#tabImportModeText')).not.toBeNull();
    expect(container.querySelector('#tabImportModeCsv')).not.toBeNull();
    expect(container.querySelector('#txtImportRaw')).not.toBeNull();
    expect(container.querySelector('#btnParseImportText')).not.toBeNull();
    expect(container.querySelector('#btnFillSampleText')).not.toBeNull();
  });

  it('fills sample exam text, parses 5 questions, and displays live preview', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    const btnFill = container.querySelector('#btnFillSampleText');
    expect(btnFill).not.toBeNull();
    btnFill.click();

    expect(quizView.importedQuestions.length).toBe(5);
    expect(quizView.importErrors.length).toBe(0);
    expect(container.textContent).toContain('Đã nhận diện thành công: 5 câu hỏi tự soạn');
    expect(container.textContent).toContain('100% Đã Có Đáp Án Đúng');
  });

  it('switches to CSV import mode and allows downloading sample CSV', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    const tabCsv = container.querySelector('#tabImportModeCsv');
    tabCsv.click();

    expect(quizView.importMode).toBe('csv');
    const downloadBtn = container.querySelector('#btnDownloadSampleCsv');
    expect(downloadBtn).not.toBeNull();

    const downloadSpy = vi.spyOn(quizView, '_downloadFile').mockImplementation(() => {});
    downloadBtn.click();
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining('Câu hỏi'),
      'Mau_De_Thi_Toan_Roi_Rac.csv',
      'text/csv;charset=utf-8;'
    );
  });

  it('creates an exam from imported custom questions and automatically opens Admin Answer Key modal', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    // Fill sample questions
    container.querySelector('#btnFillSampleText').click();
    expect(quizView.importedQuestions.length).toBe(5);

    // Set custom title and exam code
    const txtTitle = container.querySelector('#txtAssignTitle');
    txtTitle.value = 'Đề Thi Tự Soạn Giữa Kỳ: Toán Rời Rạc';

    const txtCode = container.querySelector('#txtAssignExamCode');
    txtCode.value = 'TRR-GK-2026';

    // Click issue exam
    const btnIssue = container.querySelector('#btnCreateAndAssignExam');
    btnIssue.click();

    // Check exam was created
    const createdExams = examManager.getExams();
    const createdExam = createdExams.find(e => e.title === 'Đề Thi Tự Soạn Giữa Kỳ: Toán Rời Rạc');
    expect(createdExam).not.toBeNull();
    expect(createdExam.examCode).toBe('TRR-GK-2026');
    expect(createdExam.customQuestions.length).toBe(5);

    // Verify Admin Answer Key modal popped up immediately
    expect(quizView.adminAnswerKeyExamId).toBe(createdExam.id);
    const modal = container.querySelector('.gradebook-modal-card');
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('HỒ SƠ ĐÁP ÁN & BAREM CHẤM DÀNH CHO ADMIN');
    expect(modal.textContent).toContain('TRR-GK-2026');

    // Quick Matrix key contains all 5 questions
    expect(modal.textContent).toContain('Câu 1');
    expect(modal.textContent).toContain('Câu 5');

    // Test copy answer key button
    const btnCopy = container.querySelector('#btnCopyAnswerKeyString');
    expect(btnCopy).not.toBeNull();

    // Test download CSV button
    const btnDownloadCsv = container.querySelector('#btnDownloadAnswerKeyCsv');
    expect(btnDownloadCsv).not.toBeNull();
    const downloadSpy = vi.spyOn(quizView, '_downloadFile').mockImplementation(() => {});
    btnDownloadCsv.click();
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining('Đáp án đúng'),
      expect.stringContaining('Dap_An_'),
      'text/csv;charset=utf-8;'
    );

    // Close modal
    const btnClose = container.querySelector('#btnCloseAdminAnswerKey');
    btnClose.click();
    expect(quizView.adminAnswerKeyExamId).toBeNull();
    expect(container.querySelector('#adminAnswerKeyBackdrop')).toBeNull();
  });

  it('allows Admin to reopen Answer Key modal anytime from the Assigned Exams table via "File Đáp Án" button', () => {
    // Create an exam first
    const exam = examManager.createExam({
      title: 'Đề Thi Cần Xem Lại Đáp Án',
      customQuestions: [
        {
          id: 'q_custom_01',
          question: '2 + 2 = ?',
          options: [{ id: 'A', text: '4' }, { id: 'B', text: '5' }],
          correctId: 'A',
          explanation: '2 + 2 bằng 4.',
        },
      ],
      examCode: 'TRR-KEY-999',
    }).exam;

    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    // Find the "File Đáp Án" button for this exam
    const btnKey = container.querySelector(`.btn-view-admin-key[data-exam-id="${exam.id}"]`);
    expect(btnKey).not.toBeNull();
    expect(btnKey.textContent).toContain('File Đáp Án');

    btnKey.click();
    expect(quizView.adminAnswerKeyExamId).toBe(exam.id);
    expect(container.textContent).toContain('HỒ SƠ ĐÁP ÁN & BAREM CHẤM DÀNH CHO ADMIN');
    expect(container.textContent).toContain('TRR-KEY-999');
    expect(container.textContent).toContain('2 + 2 = ?');
    expect(container.textContent).toContain('[ A ]');
  });

  it('allows a student to take and submit the imported custom exam, grading accurately', () => {
    // 1. Admin creates custom exam
    const customQuestions = [
      {
        id: 'q_math_01',
        question: 'Phủ định của P là gì?',
        options: [{ id: 'A', text: '¬P' }, { id: 'B', text: 'P' }],
        correctId: 'A',
        explanation: 'Phủ định là ¬P.',
      },
      {
        id: 'q_math_02',
        question: 'Số tập con của tập 3 phần tử là?',
        options: [{ id: 'A', text: '6' }, { id: 'B', text: '8' }],
        correctId: 'B',
        explanation: '2^3 = 8.',
      },
    ];

    const exam = examManager.createExam({
      title: 'Đề Thi Khảo Sát Custom',
      customQuestions,
      examCode: 'TRR-CUSTOM-01',
      assignedTo: ['all'],
    }).exam;

    // 2. Student logs in
    authManager.register({ username: 'sv_student_test', fullName: 'Sinh Viên Test', email: 'sv@toanrr.edu.vn', password: '123' });
    const studentUser = authManager.getCurrentUser();
    expect(studentUser).not.toBeNull();

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    // Start custom exam
    window.confirm = () => true;
    const btnStart = container.querySelector(`.btn-start-exam[data-exam-id="${exam.id}"]`);
    expect(btnStart).not.toBeNull();
    btnStart.click();

    expect(quizView.activeExamSession).not.toBeNull();
    expect(quizView.activeExamSession.questions.length).toBe(2);

    // Answer Q1 with 'A' (correct) and Q2 with 'B' (correct)
    const q1 = quizView.activeExamSession.questions[0];
    const q2 = quizView.activeExamSession.questions[1];
    quizView.activeExamSession.answers[q1.id] = q1.correctId;
    quizView.activeExamSession.answers[q2.id] = q2.correctId;

    // Submit exam
    quizView._submitActiveExam();

    // Check submission score: 2/2 correct = 10 / 10
    const sub = examManager.getSubmission(exam.id, studentUser.id);
    expect(sub).not.toBeNull();
    expect(sub.score).toBe(10);
    expect(sub.correctCount).toBe(2);
    expect(sub.totalQuestions).toBe(2);
  });
});
