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
    global.localStorage = window.localStorage;
    authManager.login('admin', '2HV6868@');
    examManager.clearAllData();
  });

  afterEach(() => {
    vi.useRealTimers();
    authManager.logout();
    vi.restoreAllMocks();
    delete global.localStorage;
    delete global.window;
    delete global.document;
  });

  it('renders Word exam import section in Studio tab with clean toolbar', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    expect(container.querySelector('#importExamBox')).not.toBeNull();
    expect(container.querySelector('#btnDownloadSampleWord')).not.toBeNull();
    expect(container.querySelector('#btnClearAllWordData')).not.toBeNull();
    expect(container.querySelector('#fileImportWord')).not.toBeNull();

    // Verify removed buttons and raw text input are gone
    expect(container.querySelector('#btnStudioAddQuestionAi')).toBeNull();
    expect(container.querySelector('#btnFillSampleText')).toBeNull();
    expect(container.querySelector('#txtImportRaw')).toBeNull();
    expect(container.querySelector('#btnParseImportText')).toBeNull();
  });

  it('saves imported questions to localStorage and displays compact count badge without full question dump', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    // Set 5 sample questions
    const sampleQuestions = [
      { id: 'q1', question: 'Mệnh đề 1', options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }], correctId: 'A' },
      { id: 'q2', question: 'Mệnh đề 2', options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }], correctId: 'B' },
      { id: 'q3', question: 'Mệnh đề 3', options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }], correctId: 'A' },
      { id: 'q4', question: 'Mệnh đề 4', options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }], correctId: 'A' },
      { id: 'q5', question: 'Mệnh đề 5', options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }], correctId: 'B' },
    ];
    quizView.importedQuestions = sampleQuestions;
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();

    expect(quizView.importedQuestions.length).toBe(5);
    expect(container.textContent).toContain('Đã nạp thành công: 5 câu hỏi tự soạn');
    expect(container.textContent).toContain('Sẵn Sàng Phát Đề');

    // Verify full question dump list is NOT rendered in import exam box
    expect(container.querySelector('#importExamBox').querySelector('.exam-question-item')).toBeNull();
    expect(container.querySelector('#importExamBox').textContent).not.toContain('Mệnh đề 1');

    // Verify persisted in localStorage
    const saved = localStorage.getItem('toanrr_custom_imported_questions_v1');
    expect(saved).not.toBeNull();
    const parsedSaved = JSON.parse(saved);
    expect(parsedSaved.length).toBe(5);
  });

  it('downloads standard Word template (.doc) when clicking "Tải File Mẫu Word Chuẩn"', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    const downloadBtn = container.querySelector('#btnDownloadSampleWord');
    expect(downloadBtn).not.toBeNull();

    const downloadSpy = vi.spyOn(quizView, '_downloadFile').mockImplementation(() => {});
    downloadBtn.click();
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining('ĐỀ THI TRẮC NGHIỆM MÔN TOÁN RỜI RẠC'),
      'Mau_De_Thi_Toan_Roi_Rac.doc',
      'application/msword;charset=utf-8;'
    );
  });

  it('preserves previously imported questions across new uploads and appends them', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    // First load 5 questions
    const q1to5 = [1, 2, 3, 4, 5].map(i => ({ id: `q${i}`, question: `Câu ${i}`, options: [{ id: 'A', text: 'A' }], correctId: 'A' }));
    quizView.importedQuestions = q1to5;
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();
    expect(quizView.importedQuestions.length).toBe(5);

    // Simulate appending 2 new questions
    const newQuestions = [
      { id: 'q_extra_1', question: 'Câu hỏi mới 1?', options: [{ id: 'A', text: 'Đúng' }], correctId: 'A' },
      { id: 'q_extra_2', question: 'Câu hỏi mới 2?', options: [{ id: 'A', text: 'Đúng' }], correctId: 'A' },
    ];
    quizView.importedQuestions = quizView.importedQuestions.concat(newQuestions);
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();

    expect(quizView.importedQuestions.length).toBe(7);

    // Instantiate a new QuizView to simulate reload - data must persist!
    const reloadedView = new QuizView({ container });
    reloadedView.setTab('studio');
    reloadedView.render();
    expect(reloadedView.importedQuestions.length).toBe(7);
  });

  it('clears all old Word data when clicking "Xóa Hết Dữ Liệu Đề Thi Cũ (Word)"', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    quizView.importedQuestions = [
      { id: 'q1', question: 'Câu 1', options: [{ id: 'A', text: 'A' }], correctId: 'A' },
    ];
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();
    expect(quizView.importedQuestions.length).toBe(1);

    const btnClear = container.querySelector('#btnClearAllWordData');
    expect(btnClear).not.toBeNull();
    btnClear.click();

    expect(quizView.importedQuestions.length).toBe(0);
    expect(localStorage.getItem('toanrr_custom_imported_questions_v1')).toBeNull();
    expect(container.textContent).toContain('Chưa có câu hỏi tự soạn nào');
  });

  it('creates an exam from imported custom questions and automatically opens Admin Answer Key modal', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    // Provide 5 questions
    quizView.importedQuestions = [1, 2, 3, 4, 5].map(i => ({
      id: `q_sample_${i}`,
      question: `Câu hỏi mẫu số ${i}?`,
      options: [{ id: 'A', text: 'Đáp án A' }, { id: 'B', text: 'Đáp án B' }],
      correctId: 'A',
      explanation: `Giải thích chi tiết cho câu ${i}.`,
    }));
    quizView._saveWordQuestions(quizView.importedQuestions);
    quizView.render();
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
    authManager.login('admin', '2HV6868@');
    quizView.setTab('myExams');
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

  it('displays imported files table with filename, question count, and individual file delete button', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    const file1Questions = [
      { id: 'q1', question: 'Câu 1', options: [{ id: 'A', text: '1' }], correctId: 'A' },
      { id: 'q2', question: 'Câu 2', options: [{ id: 'A', text: '2' }], correctId: 'A' },
    ];
    const file2Questions = [
      { id: 'q3', question: 'Câu 3', options: [{ id: 'A', text: '3' }], correctId: 'A' },
      { id: 'q4', question: 'Câu 4', options: [{ id: 'A', text: '4' }], correctId: 'A' },
      { id: 'q5', question: 'Câu 5', options: [{ id: 'A', text: '5' }], correctId: 'A' },
    ];

    quizView._saveWordFiles([
      { id: 'f1', name: 'De_Thi_Chuong_1.docx', uploadedAt: new Date().toISOString(), questionCount: 2, questions: file1Questions },
      { id: 'f2', name: 'De_Thi_Chuong_2.docx', uploadedAt: new Date().toISOString(), questionCount: 3, questions: file2Questions },
    ]);
    quizView.render();

    expect(container.textContent).toContain('De_Thi_Chuong_1.docx');
    expect(container.textContent).toContain('De_Thi_Chuong_2.docx');
    expect(container.textContent).toContain('2 câu');
    expect(container.textContent).toContain('3 câu');

    // Individual delete button exists
    const deleteButtons = container.querySelectorAll('.btn-delete-imported-file');
    expect(deleteButtons.length).toBe(2);

    // Delete file 1
    window.confirm = () => true;
    deleteButtons[0].click();

    expect(quizView.importedFiles.length).toBe(1);
    expect(quizView.importedFiles[0].name).toBe('De_Thi_Chuong_2.docx');
    expect(quizView.importedQuestions.length).toBe(3);
  });

  it('rejects uploading duplicate file name and alerts user', async () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    quizView._saveWordFiles([
      { id: 'f1', name: 'De_Toan_Roi_Rac.docx', uploadedAt: new Date().toISOString(), questionCount: 5, questions: [] },
    ]);
    quizView.render();

    const alertSpy = vi.spyOn(quizView, '_showAlert').mockImplementation(() => {});
    const fileInput = container.querySelector('#fileImportWord');

    // Mock duplicate file
    const fakeFile = new File(['dummy content'], 'De_Toan_Roi_Rac.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    Object.defineProperty(fileInput, 'files', { value: [fakeFile], configurable: true });

    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('đã tồn tại'));
    expect(quizView.importedFiles.length).toBe(1);
  });

  it('allows selecting source file and picking random number of questions for assignment', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';

    // 15 questions in file 1
    const file1Questions = Array.from({ length: 15 }, (_, i) => ({
      id: `q_pool_${i + 1}`,
      question: `Câu hỏi số ${i + 1}`,
      options: [{ id: 'A', text: 'Đáp án A' }, { id: 'B', text: 'Đáp án B' }],
      correctId: 'A',
      explanation: `Giải thích ${i + 1}`,
    }));

    quizView._saveWordFiles([
      { id: 'file_ch1', name: 'De_15_Cau.docx', uploadedAt: new Date().toISOString(), questionCount: 15, questions: file1Questions },
    ]);
    quizView.selectedAssignFileId = 'file_ch1';
    quizView.selectedAssignCount = '10'; // Pick 10 out of 15
    quizView.render();

    const selSource = container.querySelector('#selAssignFileSource');
    expect(selSource).not.toBeNull();
    const selCount = container.querySelector('#selAssignQuestionCount');
    expect(selCount).not.toBeNull();
    expect(selCount.textContent).toContain('Bốc ngẫu nhiên 10 câu');

    // Click assign
    const titleInput = container.querySelector('#txtAssignTitle');
    titleInput.value = 'Đề Thi 10 Câu Ngẫu Nhiên';
    const assignBtn = container.querySelector('#btnCreateAndAssignExam');
    assignBtn.click();

    expect(quizView.adminAnswerKeyExamId).not.toBeNull();
    const createdExam = examManager.getExamById(quizView.adminAnswerKeyExamId);
    expect(createdExam).not.toBeNull();
    expect(createdExam.questionIds.length).toBe(10);
  });

  it('integrates imported Word questions with A4 Print and LaTeX Studio', () => {
    const quizView = new QuizView({ container });
    quizView.setTab('studio');
    quizView.studioSubTab = 'print';

    const wordQuestions = [
      {
        id: 'q_word_p1',
        question: 'Toán Rời Rạc gồm những chương nào?',
        options: [{ id: 'A', text: '5 chương' }, { id: 'B', text: '3 chương' }],
        correctId: 'A',
        explanation: 'Gồm 5 chương trọng tâm.',
      },
      {
        id: 'q_word_p2',
        question: 'Đồ thị vô hướng là gì?',
        options: [{ id: 'A', text: 'Cạnh không có hướng' }, { id: 'B', text: 'Cung có hướng' }],
        correctId: 'A',
        explanation: 'Các cạnh không định hướng.',
      },
    ];

    quizView._saveWordFiles([
      { id: 'f_word_print', name: 'De_In_An.docx', uploadedAt: new Date().toISOString(), questionCount: 2, questions: wordQuestions },
    ]);
    quizView.studioPrintSource = 'all_word';
    quizView.render();

    // Check print section has word questions rendered
    const printSection = container.querySelector('#studioPrintSection');
    expect(printSection).not.toBeNull();
    expect(printSection.textContent).toContain('Toán Rời Rạc gồm những chương nào?');
    expect(printSection.textContent).toContain('Đồ thị vô hướng là gì?');

    // LaTeX export uses word questions
    const exam = quizView._getStudioPrintExam();
    expect(exam.questions.length).toBe(2);
    expect(exam.questions[0].question).toContain('Toán Rời Rạc');
  });

  it('moves distributed exams table to Quản Lý Đề Thi tab for admin tracking', () => {
    const quizView = new QuizView({ container });
    authManager.login('admin', '2HV6868@');
    quizView.setTab('myExams');
    quizView.render();

    // Distributed exams table is present in myExams
    expect(container.textContent).toContain('Danh Sách Các Đề Thi Đã Phân Phối');
    expect(container.querySelector('#btnAdminClearAllExams')).not.toBeNull();

    // In studio assign tab, it is NOT there
    quizView.setTab('studio');
    quizView.studioSubTab = 'assign';
    quizView.render();

    expect(container.querySelector('#studioAssignSection').querySelector('#btnAdminClearAllExams')).toBeNull();
    expect(container.querySelector('#btnGoToExamManagement')).toBeNull();
    authManager.logout();
  });
});
