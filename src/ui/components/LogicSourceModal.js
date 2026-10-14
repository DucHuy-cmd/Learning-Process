/**
 * @file LogicSourceModal.js
 * User Input Modal Component for Propositional Logic with AI Vision Integration
 * 
 * Features:
 * - Drag-and-drop & file picker upload (.png, .jpg, .jpeg, .webp, .pdf, .docx up to 15MB)
 * - Image thumbnail preview & document metadata display
 * - Dual-mode switcher: "Trích xuất biểu thức" (expression) & "Tạo câu hỏi trắc nghiệm" (quiz)
 * - Complete state machine: idle, selected, analyzing, success, warning, error, invalid
 * - In-flight cancellation via AbortController to avoid race conditions
 * - Editable expressions with live recursive-descent LogicParser validation
 * - Clear 3-stage lifecycle visualization (AI Proposed -> Parser Confirmed -> User Applied)
 * - Equivalence support with both primary and secondary expressions preserved
 * - Keyboard accessibility (ESC close, trap focus, tab navigation)
 */

import {
  validateLogicFileSupport,
  validateExpressionWithParser,
  analyzeLogicFile,
  SUPPORTED_LOGIC_EXTENSIONS,
} from '../../app/ai/LogicVisionAdapter.js';

export class LogicSourceModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] - Modal parent container
   * @param {Function} [options.onApplyExpression] - Callback({ expression, expression2, exerciseType, navigation })
   * @param {Function} [options.onPreviewQuiz] - Callback(quizObject)
   * @param {Function} [options.onSaveQuizQuestion] - Callback(quizObject)
   * @param {boolean} [options.adminMode=false]
   */
  constructor({
    container = null,
    onApplyExpression = null,
    onPreviewQuiz = null,
    onSaveQuizQuestion = null,
    adminMode = false,
  } = {}) {
    this.container = container || (typeof document !== 'undefined' ? document.body : null);
    this.onApplyExpression = onApplyExpression || (() => {});
    this.onPreviewQuiz = onPreviewQuiz || (() => {});
    this.onSaveQuizQuestion = onSaveQuizQuestion || null;
    this.adminMode = Boolean(adminMode);

    this.isOpen = false;
    this.mode = 'expression'; // 'expression' | 'quiz'
    this.currentFile = null;
    this.previewUrl = null;
    this.abortController = null;
    this.isAnalyzing = false;

    // Cache of extracted results
    this.extractedExpressionResult = null;
    this.extractedQuizResult = null;

    this._render();
  }

  _render() {
    if (!this.container || typeof document === 'undefined') return;

    // Clean up any existing logic modal in container
    const existing = this.container.querySelector('#logicSourceModalBackdrop');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-backdrop" id="logicSourceModalBackdrop" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="logicModalTitle">
        <div class="modal-dialog" style="max-width:680px;width:92%;">
          <div class="modal-head">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">📷</span>
              <h3 class="modal-title" id="logicModalTitle">AI Vision — Nhập Đề Bài Logic</h3>
            </div>
            <button type="button" class="modal-close-btn" id="btnLogicModalClose" title="Đóng modal" aria-label="Đóng">&times;</button>
          </div>

          <div class="modal-body">
            <!-- Upload Dropzone Area -->
            <div class="file-dropzone" id="logicFileDropzone" tabindex="0" role="button" aria-label="Kéo thả hoặc chọn tệp">
              <input type="file" id="logicFileInput" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx" style="display:none;" />
              <div class="dropzone-icon">📄</div>
              <p class="dropzone-prompt"><strong>Kéo thả ảnh đề bài hoặc tài liệu vào đây</strong></p>
              <p class="dropzone-sub">hoặc <button type="button" class="btn-browse" id="btnBrowseLogicFile">Chọn tệp từ máy tính</button></p>
              <div class="dropzone-formats">Hỗ trợ định dạng: PNG, JPG, JPEG, WEBP, PDF, DOCX (Tối đa 15MB)</div>
            </div>

            <!-- Selected File Preview Card -->
            <div class="file-preview-card" id="logicFilePreviewCard" style="display:none;">
              <div class="file-preview-thumb" id="logicFilePreviewThumb"></div>
              <div class="file-preview-meta">
                <div class="file-preview-name" id="logicFilePreviewName">file_name.png</div>
                <div class="file-preview-size" id="logicFilePreviewSize">0 KB</div>
              </div>
              <div class="file-preview-actions">
                <button type="button" class="btn-sm" id="btnRemoveLogicFile" title="Hủy tệp đã chọn">🗑️ Xóa tệp</button>
                <button type="button" class="btn-primary btn-sm" id="btnStartLogicAnalyze">⚡ Bắt đầu phân tích AI</button>
              </div>
            </div>

            <!-- In-Flight Analysis Spinner Box -->
            <div class="ai-loading-box" id="logicLoadingBox" style="display:none;">
              <div class="spinner"></div>
              <div class="ai-loading-text" id="logicLoadingText">Đang phân tích hình ảnh đề bài logic qua AI Vision...</div>
              <button type="button" class="btn-sm" id="btnCancelLogicAnalyze" style="margin-top:10px;">✕ Hủy yêu cầu</button>
            </div>

            <!-- Error Box -->
            <div class="modal-error-box" id="logicErrorBox" style="display:none;margin-top:12px;">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="font-size:16px;">⚠️</span>
                <div style="flex:1;">
                  <strong id="logicErrorTitle">Lỗi xử lý</strong>
                  <div id="logicErrorMessage" style="font-size:12px;margin-top:3px;"></div>
                  <div id="logicErrorGuidance" style="display:none;margin-top:6px;font-size:11.5px;color:var(--text);line-height:1.4;background:rgba(0,0,0,0.12);padding:6px 10px;border-radius:4px;border-left:3px solid #f59e0b;"></div>
                </div>
                <button type="button" class="btn-sm" id="btnRetryLogicAnalyze" style="padding:4px 8px;font-size:11px;">Thử lại</button>
              </div>
            </div>

            <!-- Warnings Alert Box -->
            <div class="spec-warning-box" id="logicWarningBox" style="display:none;margin-top:12px;"></div>

            <!-- Result Box: Expression Mode -->
            <div id="logicExprResultBox" style="display:none;margin-top:14px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
              <!-- Three-Stage Lifecycle Indicator -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:8px;">
                <span style="font-size:12.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                  <span>📊</span> Biểu thức nhận diện:
                </span>
                <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;">
                  <span id="badgeAiProposed" style="padding:2px 8px;border-radius:12px;background:rgba(59,130,246,0.15);color:#38bdf8;font-weight:600;">1. AI đề xuất ✓</span>
                  <span id="badgeParserStatus" style="padding:2px 8px;border-radius:12px;background:rgba(16,185,129,0.15);color:#10b981;font-weight:600;">2. Cú pháp hợp lệ ✓</span>
                </div>
              </div>

              <!-- Exercise Type & Variables Bar -->
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--dim);margin-bottom:10px;flex-wrap:wrap;gap:6px;">
                <span id="lblExerciseType">Dạng bài: <strong>Bảng chân trị</strong></span>
                <span id="lblDetectedVars">Các biến: <strong>p, q</strong></span>
              </div>

              <!-- Primary Expression Edit Field -->
              <div style="margin-bottom:10px;">
                <label for="inputLogicExtracted1" style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
                  Biểu thức chính (E₁):
                </label>
                <input type="text" id="inputLogicExtracted1" class="form-input" style="width:100%;font-family:monospace;font-size:15px;padding:8px 12px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" />
              </div>

              <!-- Secondary Expression Field (For Equivalence) -->
              <div id="wrapLogicExtracted2" style="display:none;margin-bottom:10px;">
                <label for="inputLogicExtracted2" style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
                  Biểu thức thứ hai (E₂ - So sánh tương đương):
                </label>
                <input type="text" id="inputLogicExtracted2" class="form-input" style="width:100%;font-family:monospace;font-size:15px;padding:8px 12px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" />
              </div>

              <!-- Parser Live Syntax Feedback -->
              <div id="parserErrorBanner" style="display:none;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px 12px;font-size:12px;color:#ef4444;margin-bottom:10px;"></div>

              <div style="text-align:right;">
                <button type="button" class="btn-primary" id="btnApplyLogicExpression" style="padding:8px 18px;font-size:13px;font-weight:700;">
                  ✓ Xác nhận &amp; Nạp vào Logic Lab
                </button>
              </div>
            </div>

          </div>

          <div class="modal-foot">
            <button type="button" class="btn-sm" id="btnLogicModalCancel">Hủy</button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(wrapper.firstElementChild);
    this._bindElements();
    this._bindEvents();
  }

  _bindElements() {
    this.modalEl = this.container.querySelector('#logicSourceModalBackdrop');
    this.btnClose = this.container.querySelector('#btnLogicModalClose');
    this.btnCancel = this.container.querySelector('#btnLogicModalCancel');

    this.dropzone = this.container.querySelector('#logicFileDropzone');
    this.fileInput = this.container.querySelector('#logicFileInput');
    this.btnBrowse = this.container.querySelector('#btnBrowseLogicFile');

    this.previewCard = this.container.querySelector('#logicFilePreviewCard');
    this.previewThumb = this.container.querySelector('#logicFilePreviewThumb');
    this.previewName = this.container.querySelector('#logicFilePreviewName');
    this.previewSize = this.container.querySelector('#logicFilePreviewSize');
    this.btnRemoveFile = this.container.querySelector('#btnRemoveLogicFile');
    this.btnStartAnalyze = this.container.querySelector('#btnStartLogicAnalyze');

    this.loadingBox = this.container.querySelector('#logicLoadingBox');
    this.loadingText = this.container.querySelector('#logicLoadingText');
    this.btnCancelAnalyze = this.container.querySelector('#btnCancelLogicAnalyze');

    this.errorBox = this.container.querySelector('#logicErrorBox');
    this.errorMessage = this.container.querySelector('#logicErrorMessage');
    this.btnRetry = this.container.querySelector('#btnRetryLogicAnalyze');
    this.warningBox = this.container.querySelector('#logicWarningBox');

    // Expression result elements
    this.exprResultBox = this.container.querySelector('#logicExprResultBox');
    this.lblExerciseType = this.container.querySelector('#lblExerciseType');
    this.lblDetectedVars = this.container.querySelector('#lblDetectedVars');
    this.inputExtracted1 = this.container.querySelector('#inputLogicExtracted1');
    this.inputExtracted2 = this.container.querySelector('#inputLogicExtracted2');
    this.wrapExtracted2 = this.container.querySelector('#wrapLogicExtracted2');
    this.badgeParserStatus = this.container.querySelector('#badgeParserStatus');
    this.parserErrorBanner = this.container.querySelector('#parserErrorBanner');
    this.btnApplyExpression = this.container.querySelector('#btnApplyLogicExpression');
  }

  _bindEvents() {
    // Modal close & cancel
    this.btnClose?.addEventListener('click', () => this.close());
    this.btnCancel?.addEventListener('click', () => this.close());

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Outside backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // File selection
    this.btnBrowse?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput?.click();
    });

    this.dropzone?.addEventListener('click', () => {
      this.fileInput?.click();
    });

    this.dropzone?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput?.click();
      }
    });

    this.fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.selectFile(file);
    });

    // Drag and drop handlers
    this.dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
    });

    this.dropzone?.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('dragover');
    });

    this.dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.selectFile(file);
    });

    // Remove file
    this.btnRemoveFile?.addEventListener('click', () => this.removeFile());

    // Start analysis
    this.btnStartAnalyze?.addEventListener('click', () => this.startAnalysis());

    // Cancel in-flight analysis
    this.btnCancelAnalyze?.addEventListener('click', () => this.cancelAnalysis());

    // Retry button
    this.btnRetry?.addEventListener('click', () => this.startAnalysis());

    // Live Parser validation on user input
    this.inputExtracted1?.addEventListener('input', () => this._onExpressionInputChanged());
    this.inputExtracted2?.addEventListener('input', () => this._onExpressionInputChanged());

    // Apply button
    this.btnApplyExpression?.addEventListener('click', () => this._onApplyConfirmed());
  }

  /**
   * Opens the modal dialog.
   * @param {string} [initialMode='expression']
   */
  open(initialMode = 'expression') {
    this.isOpen = true;
    this.switchMode('expression');
    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.modalEl.focus();
    }
  }

  /**
   * Closes the modal dialog and cleans up in-flight requests.
   */
  close() {
    this.cancelAnalysis();
    this.isOpen = false;
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
  }

  /**
   * Sets modal mode.
   * @param {string} [mode='expression']
   */
  switchMode(mode = 'expression') {
    this.mode = 'expression';
    this._hideErrors();
    if (this.extractedExpressionResult && this.exprResultBox) {
      this.exprResultBox.style.display = 'block';
    }
  }

  /**
   * Selects and validates an uploaded file.
   * @param {File} file
   */
  selectFile(file) {
    this.cancelAnalysis();
    this._hideErrors();

    // Check file support
    const check = validateLogicFileSupport(file);
    if (!check.valid) {
      this._showError('Tệp không hợp lệ', check.error);
      return;
    }

    this.currentFile = file;

    // Display file preview
    if (this.dropzone) this.dropzone.style.display = 'none';
    if (this.previewCard) this.previewCard.style.display = 'flex';

    if (this.previewName) this.previewName.textContent = file.name;
    if (this.previewSize) {
      const kb = (file.size / 1024).toFixed(1);
      this.previewSize.textContent = `${kb} KB`;
    }

    // Thumbnail / icon preview
    if (this.previewThumb) {
      this.previewThumb.innerHTML = '';
      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
      }

      if (file.type && file.type.startsWith('image/')) {
        this.previewUrl = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.src = this.previewUrl;
        img.alt = 'Thumbnail đề bài';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        this.previewThumb.appendChild(img);
      } else {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        this.previewThumb.innerHTML = `<span style="font-size:24px;">${isPdf ? '📕' : '📘'}</span>`;
      }
    }
  }

  /**
   * Removes selected file and resets to dropzone state.
   */
  removeFile() {
    this.cancelAnalysis();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.currentFile = null;
    if (this.fileInput) this.fileInput.value = '';

    if (this.dropzone) this.dropzone.style.display = 'block';
    if (this.previewCard) this.previewCard.style.display = 'none';
    if (this.exprResultBox) this.exprResultBox.style.display = 'none';
    if (this.quizResultBox) this.quizResultBox.style.display = 'none';
    if (this.quizPreviewQuestion) this.quizPreviewQuestion.textContent = '';
    if (this.quizPreviewOptions) this.quizPreviewOptions.innerHTML = '';
    if (this.quizPreviewExplanation) this.quizPreviewExplanation.textContent = '';
    this._hideErrors();
  }

  /**
   * Cancels in-flight analysis request.
   */
  cancelAnalysis() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isAnalyzing = false;
    if (this.loadingBox) this.loadingBox.style.display = 'none';
    if (this.btnStartAnalyze) this.btnStartAnalyze.disabled = false;
  }

  /**
   * Starts AI analysis for the selected file and current mode.
   */
  async startAnalysis() {
    if (!this.currentFile) {
      this._showError('Chưa có tệp', 'Vui lòng chọn hoặc kéo thả ảnh đề bài trước khi phân tích.');
      return;
    }

    this._hideErrors();
    this.isAnalyzing = true;
    if (this.loadingBox) this.loadingBox.style.display = 'block';
    if (this.btnStartAnalyze) this.btnStartAnalyze.disabled = true;
    if (this.exprResultBox) this.exprResultBox.style.display = 'none';

    this.abortController = new AbortController();

    try {
      const result = await analyzeLogicFile(this.currentFile, {
        mode: 'expression',
        signal: this.abortController.signal,
      });

      this.isAnalyzing = false;
      if (this.loadingBox) this.loadingBox.style.display = 'none';
      if (this.btnStartAnalyze) this.btnStartAnalyze.disabled = false;

      this.extractedExpressionResult = result;
      this._renderExpressionResult(result);
      this._renderWarnings(result.warnings);
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') return;

      this.isAnalyzing = false;
      if (this.loadingBox) this.loadingBox.style.display = 'none';
      if (this.btnStartAnalyze) this.btnStartAnalyze.disabled = false;

      const title = err.code === 'AI_NOT_CONFIGURED' ? 'AI Chưa Cấu Hình' : 'Lỗi phân tích AI';
      this._showError(title, err.message, err.code);
    }
  }

  _renderExpressionResult(result) {
    if (!this.exprResultBox) return;
    this.exprResultBox.style.display = 'block';

    const typeNames = {
      truth_table: 'Bảng chân trị',
      kmap: 'Bìa Karnaugh',
      circuit: 'Mạch Logic',
      equivalence: 'So sánh tương đương (A ≡ B)',
      normal: 'Dạng chuẩn tắc (DNF/CNF)',
    };

    if (this.lblExerciseType) {
      const typeLabel = typeNames[result.exerciseType] || result.exerciseType || 'Bảng chân trị';
      this.lblExerciseType.innerHTML = `Dạng bài: <strong style="color:var(--text);">${typeLabel}</strong>`;
    }

    if (this.lblDetectedVars) {
      const varsText = (result.variables || []).join(', ') || 'Chưa rõ';
      this.lblDetectedVars.innerHTML = `Các biến: <strong style="color:var(--text);">${varsText}</strong>`;
    }

    if (this.inputExtracted1) {
      this.inputExtracted1.value = result.expression || '';
    }

    if (result.expression2 || result.exerciseType === 'equivalence') {
      if (this.wrapExtracted2) this.wrapExtracted2.style.display = 'block';
      if (this.inputExtracted2) this.inputExtracted2.value = result.expression2 || '';
    } else {
      if (this.wrapExtracted2) this.wrapExtracted2.style.display = 'none';
      if (this.inputExtracted2) this.inputExtracted2.value = '';
    }

    this._onExpressionInputChanged();
  }

  _onExpressionInputChanged() {
    const expr1 = (this.inputExtracted1?.value || '').trim();
    const hasExpr2 = this.wrapExtracted2 && this.wrapExtracted2.style.display !== 'none';
    const expr2 = hasExpr2 ? (this.inputExtracted2?.value || '').trim() : null;

    const check1 = validateExpressionWithParser(expr1);
    let check2 = { valid: true };
    if (expr2) {
      check2 = validateExpressionWithParser(expr2);
    }

    const isValid = check1.valid && check2.valid;

    if (this.badgeParserStatus) {
      if (isValid) {
        this.badgeParserStatus.textContent = '2. Cú pháp hợp lệ ✓';
        this.badgeParserStatus.style.background = 'rgba(16,185,129,0.15)';
        this.badgeParserStatus.style.color = '#10b981';
      } else {
        this.badgeParserStatus.textContent = '2. Cú pháp chưa chuẩn ⚠️';
        this.badgeParserStatus.style.background = 'rgba(239,68,68,0.15)';
        this.badgeParserStatus.style.color = '#ef4444';
      }
    }

    if (this.parserErrorBanner) {
      if (!isValid) {
        const errorMsg = !check1.valid
          ? `Lỗi biểu thức 1: ${check1.error}`
          : `Lỗi biểu thức 2: ${check2.error}`;
        this.parserErrorBanner.textContent = errorMsg;
        this.parserErrorBanner.style.display = 'block';
      } else {
        this.parserErrorBanner.style.display = 'none';
      }
    }

    if (this.btnApplyExpression) {
      this.btnApplyExpression.disabled = !isValid;
    }
  }

  _onApplyConfirmed() {
    const expr1 = (this.inputExtracted1?.value || '').trim();
    const hasExpr2 = this.wrapExtracted2 && this.wrapExtracted2.style.display !== 'none';
    const expr2 = hasExpr2 ? (this.inputExtracted2?.value || '').trim() : null;

    const check1 = validateExpressionWithParser(expr1);
    if (!check1.valid) {
      this._onExpressionInputChanged();
      return;
    }
    if (expr2) {
      const check2 = validateExpressionWithParser(expr2);
      if (!check2.valid) {
        this._onExpressionInputChanged();
        return;
      }
    }

    const exerciseType = expr2 ? 'equivalence' : (this.extractedExpressionResult?.exerciseType || 'truth_table');

    let targetTab = 'single';
    let targetSubTab = 'table';
    if (expr2 || exerciseType === 'equivalence') {
      targetTab = 'equiv';
      targetSubTab = null;
    } else if (exerciseType === 'kmap') {
      targetTab = 'single';
      targetSubTab = 'kmap';
    } else if (exerciseType === 'circuit') {
      targetTab = 'single';
      targetSubTab = 'circuit';
    }

    if (typeof this.onApplyExpression === 'function') {
      this.onApplyExpression({
        expression: expr1,
        expression2: expr2,
        exerciseType,
        navigation: {
          targetTab,
          targetSubTab,
        },
      });
    }

    this.close();
  }

  _renderWarnings(warnings) {
    if (!this.warningBox) return;
    if (Array.isArray(warnings) && warnings.length > 0) {
      this.warningBox.style.display = 'block';
      this.warningBox.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:4px;">⚠️ Cảnh báo từ AI Vision:</div>
        <ul style="margin:0;padding-left:18px;font-size:11.5px;color:var(--text);">
          ${warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      `;
    } else {
      this.warningBox.style.display = 'none';
      this.warningBox.innerHTML = '';
    }
  }

  _showError(title, message, code = '') {
    if (this.errorBox) {
      this.errorBox.style.display = 'block';
      const titleEl = this.errorBox.querySelector('#logicErrorTitle');
      const msgEl = this.errorBox.querySelector('#logicErrorMessage');
      const guidanceEl = this.errorBox.querySelector('#logicErrorGuidance');
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;

      if (guidanceEl) {
        if (code === 'AI_NOT_CONFIGURED') {
          guidanceEl.style.display = 'block';
          guidanceEl.innerHTML = `<strong>💡 Hướng dẫn cấu hình API Key:</strong><br>1. Mở file <code>.env</code> tại thư mục gốc dự án.<br>2. Thiết lập <code>GEMINI_API_KEY=AIzaSy...</code> (Lấy miễn phí tại Google AI Studio: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent);">aistudio.google.com</a>).<br>3. Khởi động lại server bằng lệnh <code>npm start</code> trong terminal.`;
        } else if (code === 'NETWORK_ERROR') {
          guidanceEl.style.display = 'block';
          guidanceEl.innerHTML = `<strong>💡 Gợi ý khắc phục:</strong><br>Vui lòng mở terminal trong thư mục dự án và chạy lệnh <code>npm start</code> để khởi động máy chủ backend tại <code>http://localhost:3000</code>.`;
        } else {
          guidanceEl.style.display = 'none';
          guidanceEl.innerHTML = '';
        }
      }
    }
  }

  _hideErrors() {
    if (this.errorBox) {
      this.errorBox.style.display = 'none';
      const guidanceEl = this.errorBox.querySelector('#logicErrorGuidance');
      if (guidanceEl) guidanceEl.style.display = 'none';
    }
    if (this.warningBox) this.warningBox.style.display = 'none';
  }
}
