import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { authManager } from '../../src/core/auth/AuthManager.js';
import {
  customQuestionBank,
  addCustomQuestion,
  getCustomQuestionBank,
  getAllQuestions,
} from '../../src/core/quiz/QuizBank.js';
import { AdminView } from '../../src/ui/views/AdminView.js';
import { LogicSourceModal } from '../../src/ui/components/LogicSourceModal.js';

describe('Admin AI Vision Question Bank UI & Modal Integration', () => {
  let dom;
  let document;
  let window;

  beforeAll(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="adminContainer"></div><div id="modalContainer"></div></body></html>', {
      url: 'http://localhost/',
    });
    window = dom.window;
    document = dom.window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
  });

  beforeEach(() => {
    customQuestionBank.length = 0;
    // Login as admin
    authManager.login('admin', '2HV6868@');
  });

  it('AdminView renders AI Vision section, metric card, and triggers', async () => {
    const container = document.getElementById('adminContainer');
    const adminView = new AdminView({ container });
    await adminView.render();

    // Check header button
    const btnAddAi = container.querySelector('#btnAdminAddQuestionAi');
    expect(btnAddAi).not.toBeNull();
    expect(btnAddAi.textContent).toContain('Thêm câu hỏi từ ảnh đề');

    // Check section trigger button
    const btnTriggerSection = container.querySelector('#btnAdminTriggerAddQuestionAi');
    expect(btnTriggerSection).not.toBeNull();

    // Check AI Question Bank table
    const tableSection = container.querySelector('.admin-ai-questions-section');
    expect(tableSection).not.toBeNull();
  });

  it('AdminView renders custom question rows and supports deletion', async () => {
    const container = document.getElementById('adminContainer');
    const adminView = new AdminView({ container });

    // Seed custom question
    const q = {
      id: 'ai_ui_test_q_01',
      question: 'Biểu thức nào sau đây là hằng đúng?',
      options: [
        { id: 'A', text: 'p ∧ ¬p' },
        { id: 'B', text: 'p ∨ ¬p' },
        { id: 'C', text: 'p → ¬p' },
        { id: 'D', text: 'p ↔ ¬p' },
      ],
      correctId: 'B',
      explanation: 'p ∨ ¬p luôn nhận giá trị 1.',
      topic: 'logic',
      topicName: 'Cơ sở Logic & Suy luận',
      difficulty: 'easy',
      source: 'ai_vision',
      status: 'approved',
    };
    addCustomQuestion(q);

    await adminView.render();

    // Verify row rendered
    const row = container.querySelector('.btn-delete-custom-q[data-q-id="ai_ui_test_q_01"]');
    expect(row).not.toBeNull();
  });

  it('LogicSourceModal supports full review, edit, validation and saving in quiz mode', async () => {
    const modalContainer = document.getElementById('modalContainer');
    let savedQuestion = null;

    const modal = new LogicSourceModal({
      container: modalContainer,
      adminMode: true,
      onSaveQuizQuestion: async (data) => {
        savedQuestion = data;
        addCustomQuestion(data);
        return { success: true };
      },
    });

    modal.open('quiz');
    expect(modal.mode).toBe('quiz');

    // Simulate AI Vision result returned
    modal._renderQuizResult({
      question: 'AI trích xuất: Phủ định của ∀x P(x) là gì?',
      options: [
        { id: 'A', text: '∃x ¬P(x)' },
        { id: 'B', text: '∀x ¬P(x)' },
        { id: 'C', text: '∃x P(x)' },
        { id: 'D', text: '¬∀x ¬P(x)' },
      ],
      correctId: 'A',
      explanation: 'Theo quy tắc phủ định lượng từ: ¬(∀x P(x)) ≡ ∃x ¬P(x).',
      topic: 'logic',
      difficulty: 'medium',
    });

    // Check fields populated
    expect(modal.txtQuizQuestion.value).toContain('Phủ định của ∀x P(x)');
    expect(modal.txtQuizOptA.value).toBe('∃x ¬P(x)');
    expect(modal.selQuizCorrectId.value).toBe('A');

    // Admin edits question text
    modal.txtQuizQuestion.value = 'Phủ định của mệnh đề lượng từ ∀x P(x) là gì?';
    modal._onQuizInputChanged();

    // Check button enabled
    expect(modal.btnSaveQuizQuestion.disabled).toBe(false);

    // Save
    await modal._onSaveQuizConfirmed();

    expect(savedQuestion).not.toBeNull();
    expect(savedQuestion.question).toBe('Phủ định của mệnh đề lượng từ ∀x P(x) là gì?');
    expect(savedQuestion.correctId).toBe('A');
    expect(savedQuestion.source).toBe('ai_vision');
    expect(savedQuestion.status).toBe('approved');
    expect(getCustomQuestionBank().length).toBe(1);
    expect(getAllQuestions().length).toBe(151);
  });
});
