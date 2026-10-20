import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { examManager, ExamManager } from '../../src/core/quiz/ExamManager.js';
import { generateExamPaper } from '../../src/core/quiz/QuizBank.js';

describe('Fixed Exam Code Verification', () => {
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

    authManager.login('admin', '2HV6868@');
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

  it('QuizView Tab 2 has fixed default exam code that does not randomly change on re-render', () => {
    quizView.setTab('studio');
    quizView.studioSubTab = 'publish';
    quizView.render();

    const inputBefore = container.querySelector('#txtAssignExamCode');
    expect(inputBefore).not.toBeNull();
    const codeValBefore = inputBefore.value;
    expect(codeValBefore).toMatch(/^\d+$/);

    // Re-render multiple times
    quizView.render();
    const inputAfter1 = container.querySelector('#txtAssignExamCode');
    expect(inputAfter1.value).toBe(codeValBefore);

    quizView.render();
    const inputAfter2 = container.querySelector('#txtAssignExamCode');
    expect(inputAfter2.value).toBe(codeValBefore);
  });

  it('QuizView Tab 3 has editable fixed exam code and sequential increment button', () => {
    quizView.importedQuestions = [
      {
        id: 'q1',
        question: 'Câu hỏi test 1',
        options: [
          { id: 'A', text: 'Đáp án A' },
          { id: 'B', text: 'Đáp án B' },
        ],
        correctId: 'A',
      },
    ];
    quizView.setTab('studio');
    quizView.studioSubTab = 'print';
    quizView.render();

    const inputCode = container.querySelector('#txtPrintExamCode');
    expect(inputCode).not.toBeNull();
    expect(inputCode.value).toBe('101');

    const btnNext = container.querySelector('#btnGenNewExam');
    expect(btnNext).not.toBeNull();
    btnNext.click();

    expect(quizView.printExamCode).toBe('102');
    const inputCodeAfter = container.querySelector('#txtPrintExamCode');
    expect(inputCodeAfter.value).toBe('102');
  });
});
