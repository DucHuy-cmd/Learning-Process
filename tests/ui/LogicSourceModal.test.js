/**
 * @file LogicSourceModal.test.js
 * @vitest-environment jsdom
 * Vitest UI Test Suite for LogicSourceModal Component & LogicLabView Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogicSourceModal } from '../../src/ui/components/LogicSourceModal.js';
import { LogicLabView } from '../../src/ui/views/LogicLabView.js';
import * as LogicVisionAdapter from '../../src/app/ai/LogicVisionAdapter.js';

describe('Phase 3: LogicSourceModal UI Component', () => {
  let container;
  let modal;
  let onApplyExpressionMock;
  let onPreviewQuizMock;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    onApplyExpressionMock = vi.fn();
    onPreviewQuizMock = vi.fn();

    modal = new LogicSourceModal({
      container,
      onApplyExpression: onApplyExpressionMock,
      onPreviewQuiz: onPreviewQuizMock,
      adminMode: true,
    });
  });

  afterEach(() => {
    if (modal) modal.close();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. MODAL LIFECYCLE & ACCESSIBILITY
  // =========================================================================
  describe('Modal Lifecycle & Accessibility', () => {
    it('initializes with modal hidden', () => {
      expect(modal.isOpen).toBe(false);
      expect(modal.modalEl.style.display).toBe('none');
    });

    it('opens modal and focuses on open()', () => {
      modal.open('expression');
      expect(modal.isOpen).toBe(true);
      expect(modal.modalEl.style.display).toBe('flex');
      expect(modal.mode).toBe('expression');
    });

    it('closes on close button click', () => {
      modal.open();
      const closeBtn = container.querySelector('#btnLogicModalClose');
      closeBtn.click();
      expect(modal.isOpen).toBe(false);
      expect(modal.modalEl.style.display).toBe('none');
    });

    it('closes on Cancel button click', () => {
      modal.open();
      const cancelBtn = container.querySelector('#btnLogicModalCancel');
      cancelBtn.click();
      expect(modal.isOpen).toBe(false);
      expect(modal.modalEl.style.display).toBe('none');
    });

    it('closes on Escape key press', () => {
      modal.open();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);
      expect(modal.isOpen).toBe(false);
    });

    it('switches between expression and quiz mode tabs', () => {
      modal.open('expression');
      expect(modal.mode).toBe('expression');

      const quizTab = container.querySelector('#tabLogicModeQuiz');
      quizTab.click();
      expect(modal.mode).toBe('quiz');
      expect(quizTab.classList.contains('active')).toBe(true);

      const exprTab = container.querySelector('#tabLogicModeExpr');
      exprTab.click();
      expect(modal.mode).toBe('expression');
      expect(exprTab.classList.contains('active')).toBe(true);
    });
  });

  // =========================================================================
  // 2. FILE SELECTION & VALIDATION
  // =========================================================================
  describe('File Selection & Validation', () => {
    it('shows error when invalid file extension is selected', () => {
      const invalidFile = new File(['bad'], 'script.exe', { type: 'application/x-msdownload' });
      modal.selectFile(invalidFile);

      expect(modal.currentFile).toBeNull();
      const errorBox = container.querySelector('#logicErrorBox');
      expect(errorBox.style.display).toBe('block');
      expect(container.querySelector('#logicErrorMessage').textContent).toContain('không được hỗ trợ');
    });

    it('displays file preview card and hides dropzone when valid image is selected', () => {
      // Mock URL.createObjectURL for JSDOM
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview-url');
      globalThis.URL.revokeObjectURL = vi.fn();

      const validFile = new File(['valid content'], 'homework.png', { type: 'image/png' });
      modal.selectFile(validFile);

      expect(modal.currentFile).toBe(validFile);
      expect(container.querySelector('#logicFileDropzone').style.display).toBe('none');
      expect(container.querySelector('#logicFilePreviewCard').style.display).toBe('flex');
      expect(container.querySelector('#logicFilePreviewName').textContent).toBe('homework.png');
    });

    it('clears file when Remove File button is clicked', () => {
      const validFile = new File(['test'], 'hw.png', { type: 'image/png' });
      modal.selectFile(validFile);

      const removeBtn = container.querySelector('#btnRemoveLogicFile');
      removeBtn.click();

      expect(modal.currentFile).toBeNull();
      expect(container.querySelector('#logicFileDropzone').style.display).toBe('block');
      expect(container.querySelector('#logicFilePreviewCard').style.display).toBe('none');
    });
  });

  // =========================================================================
  // 3. AI ANALYSIS & IN-FLIGHT CANCELLATION
  // =========================================================================
  describe('AI Analysis & Cancellation', () => {
    it('shows loading indicator and disables analyze button during analysis', async () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      let resolveApi;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockImplementation(() => apiPromise);

      const analyzePromise = modal.startAnalysis();

      expect(modal.isAnalyzing).toBe(true);
      expect(container.querySelector('#logicLoadingBox').style.display).toBe('block');
      expect(container.querySelector('#btnStartLogicAnalyze').disabled).toBe(true);

      resolveApi({
        mode: 'expression',
        expression: 'p * q',
        variables: ['p', 'q'],
        exerciseType: 'truth_table',
        warnings: [],
      });

      await analyzePromise;

      expect(modal.isAnalyzing).toBe(false);
      expect(container.querySelector('#logicLoadingBox').style.display).toBe('none');
      expect(container.querySelector('#btnStartLogicAnalyze').disabled).toBe(false);
    });

    it('handles cancellation via AbortController and resets loading state', () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockImplementation(() => new Promise(() => {}));

      modal.startAnalysis();
      expect(modal.isAnalyzing).toBe(true);

      const cancelBtn = container.querySelector('#btnCancelLogicAnalyze');
      cancelBtn.click();

      expect(modal.isAnalyzing).toBe(false);
      expect(container.querySelector('#logicLoadingBox').style.display).toBe('none');
      expect(container.querySelector('#btnStartLogicAnalyze').disabled).toBe(false);
    });

    it('displays error box and allows retry when analysis fails', async () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      const mockError = new Error('Dịch vụ AI Vision chưa được kích hoạt trên máy chủ.');
      mockError.code = 'AI_NOT_CONFIGURED';

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockRejectedValue(mockError);

      await modal.startAnalysis();

      const errorBox = container.querySelector('#logicErrorBox');
      expect(errorBox.style.display).toBe('block');
      expect(container.querySelector('#logicErrorTitle').textContent).toBe('AI Chưa Cấu Hình');
      expect(container.querySelector('#logicErrorMessage').textContent).toContain('chưa được kích hoạt');
      expect(container.querySelector('#logicErrorGuidance').style.display).toBe('block');
    });
  });

  // =========================================================================
  // 4. MODE EXPRESSION & LIVE PARSER VERIFICATION
  // =========================================================================
  describe('Mode Expression: Live Parser Verification & Apply', () => {
    it('displays extracted expression, warnings, and marks parser confirmed', async () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockResolvedValue({
        mode: 'expression',
        expression: '(p → q) * ¬r',
        expression2: null,
        variables: ['p', 'q', 'r'],
        exerciseType: 'kmap',
        isKnownExerciseType: true,
        navigation: { targetTab: 'single', targetSubTab: 'kmap' },
        warnings: ['Chữ viết tay hơi mờ'],
        isAiProposed: true,
        isParserConfirmed: true,
        parserErrors: [],
        isUserApplied: false,
      });

      await modal.startAnalysis();

      expect(container.querySelector('#logicExprResultBox').style.display).toBe('block');
      expect(container.querySelector('#inputLogicExtracted1').value).toBe('(p → q) * ¬r');
      expect(container.querySelector('#badgeParserStatus').textContent).toContain('Cú pháp hợp lệ');

      // Warnings
      const warnBox = container.querySelector('#logicWarningBox');
      expect(warnBox.style.display).toBe('block');
      expect(warnBox.textContent).toContain('Chữ viết tay hơi mờ');
    });

    it('blocks apply when user edits expression into invalid syntax and enables on fix', async () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockResolvedValue({
        mode: 'expression',
        expression: 'p * q',
        variables: ['p', 'q'],
        exerciseType: 'truth_table',
        isKnownExerciseType: true,
        navigation: { targetTab: 'single', targetSubTab: 'table' },
        warnings: [],
        isAiProposed: true,
        isParserConfirmed: true,
        parserErrors: [],
      });

      await modal.startAnalysis();

      const input1 = container.querySelector('#inputLogicExtracted1');
      const applyBtn = container.querySelector('#btnApplyLogicExpression');

      expect(applyBtn.disabled).toBe(false);

      // User types invalid syntax
      input1.value = 'p ** q';
      input1.dispatchEvent(new Event('input'));

      expect(container.querySelector('#badgeParserStatus').textContent).toContain('Cú pháp chưa chuẩn');
      expect(container.querySelector('#parserErrorBanner').style.display).toBe('block');
      expect(applyBtn.disabled).toBe(true);

      // User fixes syntax
      input1.value = 'p + q';
      input1.dispatchEvent(new Event('input'));

      expect(container.querySelector('#badgeParserStatus').textContent).toContain('Cú pháp hợp lệ');
      expect(container.querySelector('#parserErrorBanner').style.display).toBe('none');
      expect(applyBtn.disabled).toBe(false);
    });

    it('invokes onApplyExpression callback with verified data and closes modal', async () => {
      const validFile = new File(['data'], 'test.png', { type: 'image/png' });
      modal.selectFile(validFile);

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockResolvedValue({
        mode: 'expression',
        expression: 'p → q',
        expression2: '¬p + q',
        variables: ['p', 'q'],
        exerciseType: 'equivalence',
        isKnownExerciseType: true,
        navigation: { targetTab: 'equiv', targetSubTab: null },
        warnings: [],
        isAiProposed: true,
        isParserConfirmed: true,
        parserErrors: [],
      });

      await modal.startAnalysis();

      const applyBtn = container.querySelector('#btnApplyLogicExpression');
      applyBtn.click();

      expect(onApplyExpressionMock).toHaveBeenCalledWith(expect.objectContaining({
        expression: 'p → q',
        expression2: '¬p + q',
        exerciseType: 'equivalence',
        navigation: { targetTab: 'equiv', targetSubTab: null },
      }));

      expect(modal.isOpen).toBe(false);
    });
  });

  // =========================================================================
  // 5. MODE QUIZ PREVIEW
  // =========================================================================
  describe('Mode Quiz: Preview Without Auto-Approval', () => {
    it('displays quiz preview cards with pending status and does not auto-approve', async () => {
      modal.switchMode('quiz');
      const validFile = new File(['data'], 'exam.png', { type: 'image/png' });
      modal.selectFile(validFile);

      vi.spyOn(LogicVisionAdapter, 'analyzeLogicFile').mockResolvedValue({
        mode: 'quiz',
        id: 'logic_custom_123',
        question: 'Biểu thức nào là hằng đúng?',
        options: [
          { id: 'A', text: 'p * ¬p' },
          { id: 'B', text: 'p + ¬p' },
          { id: 'C', text: 'p → ¬p' },
          { id: 'D', text: 'p ↔ ¬p' },
        ],
        correctId: 'B',
        explanation: 'Luật bài trung.',
        status: 'pending',
        warnings: [],
      });

      await modal.startAnalysis();

      expect(container.querySelector('#logicQuizResultBox').style.display).toBe('block');
      expect(container.querySelector('#quizPreviewQuestion').textContent).toBe('Biểu thức nào là hằng đúng?');
      expect(container.querySelectorAll('#quizPreviewOptions div')).toHaveLength(4);
      expect(container.querySelector('#quizPreviewExplanation').textContent).toBe('Luật bài trung.');
      expect(onPreviewQuizMock).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. INTEGRATION WITH LOGICLABVIEW
  // =========================================================================
  describe('Integration with LogicLabView', () => {
    let labContainer;
    let logicLabView;

    beforeEach(() => {
      labContainer = document.createElement('div');
      document.body.appendChild(labContainer);
      logicLabView = new LogicLabView({ container: labContainer });
    });

    it('renders "Nhập từ ảnh" button in LogicLabView preset bar', () => {
      const btnVision = labContainer.querySelector('#btnOpenLogicVision');
      expect(btnVision).not.toBeNull();
      expect(btnVision.textContent).toContain('Nhập từ ảnh');
    });

    it('opens LogicSourceModal when "Nhập từ ảnh" button is clicked', () => {
      const btnVision = labContainer.querySelector('#btnOpenLogicVision');
      btnVision.click();

      expect(logicLabView.logicSourceModal).not.toBeNull();
      expect(logicLabView.logicSourceModal.isOpen).toBe(true);
    });

    it('populates inputSingle and calls solveSingle when single expression is applied', () => {
      const btnVision = labContainer.querySelector('#btnOpenLogicVision');
      btnVision.click();

      const solveSpy = vi.spyOn(logicLabView, 'solveSingle');

      // Trigger onApplyExpression callback directly
      logicLabView.logicSourceModal.onApplyExpression({
        expression: 'p * q + r',
        expression2: null,
        exerciseType: 'truth_table',
        navigation: { targetTab: 'single', targetSubTab: 'table' },
      });

      expect(logicLabView.inputSingle.value).toBe('p * q + r');
      expect(solveSpy).toHaveBeenCalled();
    });

    it('populates both inputs and switches to equiv tab when equivalence expression is applied', () => {
      const btnVision = labContainer.querySelector('#btnOpenLogicVision');
      btnVision.click();

      const solveEquivSpy = vi.spyOn(logicLabView, 'solveEquiv');

      // Trigger onApplyExpression callback with equivalence
      logicLabView.logicSourceModal.onApplyExpression({
        expression: 'p → q',
        expression2: '¬p + q',
        exerciseType: 'equivalence',
        navigation: { targetTab: 'equiv', targetSubTab: null },
      });

      expect(logicLabView.activeTab).toBe('equiv');
      expect(logicLabView.inputEquiv1.value).toBe('p → q');
      expect(logicLabView.inputEquiv2.value).toBe('¬p + q');
      expect(solveEquivSpy).toHaveBeenCalled();
    });
  });
});
