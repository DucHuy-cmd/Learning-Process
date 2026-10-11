import { describe, it, expect, beforeEach } from 'vitest';
import {
  STATIC_QUESTION_BANK,
  customQuestionBank,
  getCustomQuestionBank,
  setCustomQuestionBank,
  addCustomQuestion,
  removeCustomQuestion,
  getAllQuestions,
  generateExamPaper,
} from '../../src/core/quiz/QuizBank.js';
import { ExamManager } from '../../src/core/quiz/ExamManager.js';
import { CloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

describe('Custom Quiz Bank Core & Integration Suite', () => {
  beforeEach(() => {
    customQuestionBank.length = 0;
  });

  it('preserves STATIC_QUESTION_BANK untouched (150 questions)', () => {
    expect(STATIC_QUESTION_BANK.length).toBe(150);
    expect(Object.isFrozen(STATIC_QUESTION_BANK) || Array.isArray(STATIC_QUESTION_BANK)).toBe(true);
  });

  it('manages customQuestionBank independently without mutating static bank', () => {
    expect(getCustomQuestionBank().length).toBe(0);
    expect(getAllQuestions().length).toBe(150);

    const customQ = {
      id: 'ai_logic_q_01',
      topic: 'logic',
      topicName: 'Mệnh đề tương đương',
      difficulty: 'medium',
      question: 'Mệnh đề ¬(p ∨ q) tương đương logic với biểu thức nào?',
      options: [
        { id: 'A', text: '¬p ∧ ¬q' },
        { id: 'B', text: '¬p ∨ ¬q' },
        { id: 'C', text: 'p ∧ q' },
        { id: 'D', text: '¬p → q' },
      ],
      correctId: 'A',
      explanation: 'Theo luật De Morgan: Phủ định của tuyển bằng hội các phủ định.',
      source: 'ai_vision',
      status: 'approved',
    };

    const added = addCustomQuestion(customQ);
    expect(added).toBe(true);

    expect(getCustomQuestionBank().length).toBe(1);
    expect(STATIC_QUESTION_BANK.length).toBe(150); // Untouched!
    expect(getAllQuestions().length).toBe(151);

    // Update same question
    addCustomQuestion({ ...customQ, difficulty: 'hard' });
    expect(getCustomQuestionBank().length).toBe(1);
    expect(getCustomQuestionBank()[0].difficulty).toBe('hard');

    // Remove question
    const removed = removeCustomQuestion('ai_logic_q_01');
    expect(removed).toBe(true);
    expect(getCustomQuestionBank().length).toBe(0);
    expect(getAllQuestions().length).toBe(150);
  });

  it('generateExamPaper draws from pool including custom questions', () => {
    const customQ = {
      id: 'ai_unique_exam_q_01',
      topic: 'logic',
      topicName: 'Logic Suy Luận',
      difficulty: 'hard',
      question: 'Một bài toán suy luận logic đặc biệt được sinh từ ảnh đề.',
      options: [
        { id: 'A', text: 'Đáp án 1' },
        { id: 'B', text: 'Đáp án 2' },
        { id: 'C', text: 'Đáp án 3' },
        { id: 'D', text: 'Đáp án 4' },
      ],
      correctId: 'C',
      explanation: 'Giải thích chi tiết.',
      source: 'ai_vision',
      status: 'approved',
    };
    addCustomQuestion(customQ);

    const all = getAllQuestions();
    expect(all.some(q => q.id === 'ai_unique_exam_q_01')).toBe(true);

    // Paper generated for logic topic
    const paper = generateExamPaper({ count: 10, topic: 'logic' });
    expect(paper.questions.length).toBe(10);
    expect(paper.answerKey).toBeDefined();
  });

  it('ExamManager creates exam with custom question and grades submission accurately', () => {
    const examManager = new ExamManager();

    const customQ = {
      id: 'ai_exam_manager_q',
      topic: 'boolean',
      difficulty: 'easy',
      question: 'Phép AND logic giữa 1 và 0 bằng mấy?',
      options: [
        { id: 'A', text: '0' },
        { id: 'B', text: '1' },
        { id: 'C', text: 'Không xác định' },
        { id: 'D', text: 'Cả 0 và 1' },
      ],
      correctId: 'A',
      explanation: '1 * 0 = 0.',
      source: 'ai_vision',
    };
    addCustomQuestion(customQ);

    // Create exam including custom question
    const createRes = examManager.createExam({
      title: 'Đề kiểm tra tùy chỉnh',
      durationMinutes: 15,
      questionIds: ['logic_q01', 'ai_exam_manager_q'],
      assignedTo: ['sv_test_01'],
    });

    expect(createRes.success).toBe(true);
    const examId = createRes.exam.id;

    // Submit exam: 2/2 correct
    const submitRes = examManager.submitExam({
      examId,
      userId: 'sv_test_01',
      answers: {
        logic_q01: 'B',
        ai_exam_manager_q: 'A',
      },
    });

    expect(submitRes.success).toBe(true);
    expect(submitRes.submission.score).toBe(10);
    expect(submitRes.submission.correctCount).toBe(2);

    // Clean up
    examManager.deleteExam(examId);
  });

  it('CloudSyncManager offline fallback works gracefully', async () => {
    const sync = new CloudSyncManager({ baseUrl: 'http://127.0.0.1:9999' });

    const q = {
      id: 'offline_q_1',
      question: 'Test Offline question',
      options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }],
      correctId: 'A',
    };

    const saveRes = await sync.saveCustomQuestion(q);
    expect(saveRes.success).toBe(true);
    expect(getCustomQuestionBank().some(item => item.id === 'offline_q_1')).toBe(true);

    const delRes = await sync.deleteCustomQuestion('offline_q_1');
    expect(delRes.success).toBe(true);
    expect(getCustomQuestionBank().some(item => item.id === 'offline_q_1')).toBe(false);
  });
});
