import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { examManager, ExamManager } from '../../src/core/quiz/ExamManager.js';
import { generateExamPaper } from '../../src/core/quiz/QuizBank.js';

describe('Fixed Exam Code & Stable Question Order Verification', () => {
  let dom;
  let window;
  let document;
  let container;
  let quizView;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="quizContainer"></div></body></html>', {
      url: 'http://localhost/',
    });
    window = dom.window;
    document = window.document;
    window.alert = () => {};
    window.confirm = () => true;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;

    authManager.login('admin', '2HV0789@@');
    examManager.clearAllData();

    container = document.getElementById('quizContainer');
    quizView = new QuizView({ container });
  });

  afterEach(() => {
    authManager.logout();
    vi.restoreAllMocks();
    delete global.localStorage;
    delete global.window;
    delete global.document;
  });

  it('QuizBank generateExamPaper defaults to fixed code 101 and respects custom examCode', () => {
    const paper1 = generateExamPaper({ count: 5 });
    const paper2 = generateExamPaper({ count: 5 });
    expect(paper1.examCode).toBe(101);
    expect(paper2.examCode).toBe(101);

    const paperCustom = generateExamPaper({ count: 5, examCode: 'TRR-CUSTOM-999' });
    expect(paperCustom.examCode).toBe('TRR-CUSTOM-999');
  });

  it('ExamManager defaults fallback code to sequential 101, 102 instead of random TRR-XXX', () => {
    const manager = new ExamManager({ storage: null });
    manager.memoryExams = [];

    const res1 = manager.createExam({
      title: 'Đề 1',
      questionIds: ['logic_q01', 'circuit_q01'],
      durationMinutes: 15,
    });
    expect(res1.success).toBe(true);
    expect(res1.exam.examCode).toBe('101');

    const res2 = manager.createExam({
      title: 'Đề 2',
      questionIds: ['logic_q01', 'circuit_q01'],
      durationMinutes: 15,
    });
    expect(res2.success).toBe(true);
    expect(res2.exam.examCode).toBe('102');
  });

  it('QuizView Tab 2 has fixed default exam code, smooth in-place count editing, and preview accordion is removed', () => {
    quizView.importedFiles = [
      {
        id: 'file1',
        name: 'Đề_gk_toan_roi_rac.docx',
        questions: [
          { id: 'q1', question: 'Q1' },
          { id: 'q2', question: 'Q2' },
          { id: 'q3', question: 'Q3' },
        ],
      },
    ];
    quizView.fileDistributions = { file1: 3 };

    quizView.setTab('studio');
    quizView.studioSubTab = 'publish';
    quizView.render();

    const inputBefore = container.querySelector('#txtAssignExamCode');
    expect(inputBefore).not.toBeNull();
    const codeValBefore = inputBefore.value;
    expect(codeValBefore).toMatch(/^\d+$/);

    // In-place editing on .input-distribute-file-count
    const distInput = container.querySelector('.input-distribute-file-count');
    expect(distInput).not.toBeNull();
    distInput.value = '2';
    distInput.dispatchEvent(new window.Event('input'));

    expect(quizView.fileDistributions.file1).toBe(2);
    const distTotalQuick = container.querySelector('#distQuickTotalSummary');
    expect(distTotalQuick.textContent).toContain('2 / 3 câu');

    // Question preview accordion ("Xem trước câu hỏi sẽ phát") must be completely removed
    const previewDetails = container.querySelector('details summary');
    expect(previewDetails).toBeNull();
    expect(container.textContent).not.toContain('Xem trước câu hỏi sẽ phát');
  });

  it('QuizView Tab 3 keeps question order fixed until user clicks "Đổi Mã Ngẫu Nhiên"', () => {
    const dummyQuestions = Array.from({ length: 20 }, (_, i) => ({
      id: `q_${i + 1}`,
      question: `Nội dung câu hỏi ${i + 1}`,
      options: [
        { id: 'A', text: `Đáp án A của câu ${i + 1}` },
        { id: 'B', text: `Đáp án B của câu ${i + 1}` },
        { id: 'C', text: `Đáp án C của câu ${i + 1}` },
        { id: 'D', text: `Đáp án D của câu ${i + 1}` },
      ],
      correctId: 'A',
    }));

    quizView.importedQuestions = dummyQuestions;
    quizView.studioConfig.count = 10;
    quizView.setTab('studio');
    quizView.studioSubTab = 'print';
    quizView.render();

    // Verify [Mã đề: XX] badge in toolbar is removed
    const toolbarCodeInput = container.querySelector('#txtPrintExamCode');
    expect(toolbarCodeInput).toBeNull();

    // Verify first 10 questions in exact sequential order
    const exam1 = quizView._getStudioPrintExam();
    expect(exam1.questions.length).toBe(10);
    expect(exam1.questions.map(q => q.id)).toEqual(dummyQuestions.slice(0, 10).map(q => q.id));

    // Re-render: question IDs must stay still
    quizView.render();
    const exam2 = quizView._getStudioPrintExam();
    expect(exam2.questions.map(q => q.id)).toEqual(dummyQuestions.slice(0, 10).map(q => q.id));

    // Clicking "🎲 Đổi Mã Ngẫu Nhiên" changes examCode and shuffles questions/options
    const btnRandom = container.querySelector('#btnGenNewExam');
    expect(btnRandom.textContent).toContain('Đổi Mã Ngẫu Nhiên');
    btnRandom.click();

    expect(Number(quizView.printExamCode)).toBeGreaterThanOrEqual(100);
    expect(Number(quizView.printExamCode)).toBeLessThan(1000);

    const printHeaderBadge = container.querySelector('#printHeaderExamCode');
    expect(printHeaderBadge.textContent).toContain(`MÃ ĐỀ THI: ${quizView.printExamCode}`);

    // Shuffled exam version is preserved on subsequent renders
    const examShuffled = quizView._getStudioPrintExam();
    expect(examShuffled.questions.length).toBe(10);
    quizView.render();
    const examShuffled2 = quizView._getStudioPrintExam();
    expect(examShuffled2.questions.map(q => q.id)).toEqual(examShuffled.questions.map(q => q.id));
  });
});
