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

describe('Admin Clean UI: AI Vision Question Bank Removed from AdminView', () => {
  let dom;
  let document;
  let window;

  beforeAll(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="adminContainer"></div></body></html>', {
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

  it('AdminView does NOT render AI Vision buttons, metric card, or question bank table', async () => {
    const container = document.getElementById('adminContainer');
    const adminView = new AdminView({ container });
    await adminView.render();

    // Verify header button is removed
    const btnAddAi = container.querySelector('#btnAdminAddQuestionAi');
    expect(btnAddAi).toBeNull();

    // Verify section trigger button is removed
    const btnTriggerSection = container.querySelector('#btnAdminTriggerAddQuestionAi');
    expect(btnTriggerSection).toBeNull();

    // Verify AI Question Bank table section is removed
    const tableSection = container.querySelector('.admin-ai-questions-section');
    expect(tableSection).toBeNull();

    // Verify general admin buttons remain
    expect(container.querySelector('#btnAdminManualSync')).not.toBeNull();
    expect(container.querySelector('#btnAdminClearAllExams')).not.toBeNull();
  });

  it('AdminView header description focuses on student management and sync', async () => {
    const container = document.getElementById('adminContainer');
    const adminView = new AdminView({ container });
    await adminView.render();

    expect(container.textContent).not.toContain('ngân hàng câu hỏi AI Vision');
    expect(container.textContent).toContain('Quản Trị Cơ Sở Dữ Liệu & Sinh Viên');
  });

  it('Core customQuestionBank functions remain intact in core QuizBank', () => {
    expect(getCustomQuestionBank()).toEqual([]);
    addCustomQuestion({
      id: 'core_test_q_01',
      question: 'Test question',
      options: [{ id: 'A', text: 'Opt A' }],
      correctId: 'A',
    });
    expect(getCustomQuestionBank().length).toBe(1);
  });
});
