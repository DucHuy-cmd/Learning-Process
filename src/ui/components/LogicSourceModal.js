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
            <!-- Mode Switcher Tabs -->
            <div class="modal-tabs" role="tablist" style="margin-bottom:14px;">
              <button type="button" class="modal-tab-btn active" data-mode="expression" id="tabLogicModeExpr" role="tab" aria-selected="true">
                🔍 Trích xuất Biểu thức Logic
              </button>
              <button type="button" class="modal-tab-btn" data-mode="quiz" id="tabLogicModeQuiz" role="tab" aria-selected="false">
                🎯 Tạo Câu hỏi Trắc nghiệm
              </button>
            </div>

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

            <!-- Result Box: Quiz Mode (Preview & Editable Review) -->
            <div id="logicQuizResultBox" style="display:none;margin-top:14px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:8px;">
                <span style="font-weight:700;color:var(--text);font-size:13px;display:flex;align-items:center;gap:6px;">
                  <span>🎯</span> Duyệt &amp; Biên Tập Câu Hỏi Trắc Nghiệm:
                </span>
                <span id="quizStatusBadge" style="padding:2px 8px;border-radius:12px;background:rgba(245,158,11,0.15);color:#f59e0b;font-size:11px;font-weight:700;">
                  ⏳ Chờ duyệt (Pending)
                </span>
              </div>

              <!-- Quiz Preview Card (Pending AI Extraction Summary) -->
              <div id="quizPreviewCard" style="background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;padding:12px;margin-bottom:14px;">
                <div style="font-size:11px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">
                  👁️ Xem trước câu hỏi (Chờ duyệt):
                </div>
                <div id="quizPreviewQuestion" style="font-weight:600;font-size:13.5px;color:var(--text);margin-bottom:8px;line-height:1.4;"></div>
                <div id="quizPreviewOptions" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:6px;margin-bottom:8px;"></div>
                <div style="font-size:12px;color:var(--dim);line-height:1.4;">
                  <strong>💡 Lời giải thích:</strong> <span id="quizPreviewExplanation"></span>
                </div>
              </div>

              <!-- Topic & Difficulty Controls -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                <div>
                  <label for="selQuizTopic" style="display:block;font-size:11.5px;font-weight:600;color:var(--text);margin-bottom:4px;">Chuyên đề:</label>
                  <select id="selQuizTopic" class="form-input" style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
                    <option value="logic">⚡ Chương 1: Cơ sở Logic &amp; Suy luận</option>
                    <option value="boolean">🔌 Chương 2: Đại số Boole &amp; Mạch Logic</option>
                    <option value="counting">🎲 Chương 3: Đại số Tổ hợp &amp; Đếm</option>
                    <option value="relation">🔗 Chương 4: Quan hệ 2 ngôi &amp; Thứ tự</option>
                    <option value="graph">🌐 Chương 5: Lý thuyết Đồ thị &amp; Cây</option>
                  </select>
                </div>
                <div>
                  <label for="selQuizDifficulty" style="display:block;font-size:11.5px;font-weight:600;color:var(--text);margin-bottom:4px;">Độ khó:</label>
                  <select id="selQuizDifficulty" class="form-input" style="width:100%;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
                    <option value="easy">🟢 Cơ bản (Dễ)</option>
                    <option value="medium" selected>🟡 Trung bình</option>
                    <option value="hard">🔴 Nâng cao (Khó)</option>
                  </select>
                </div>
              </div>

              <!-- Question Textarea -->
              <div style="margin-bottom:12px;">
                <label for="txtQuizQuestion" style="display:block;font-size:11.5px;font-weight:600;color:var(--text);margin-bottom:4px;">Nội dung câu hỏi: *</label>
                <textarea id="txtQuizQuestion" rows="3" class="form-input" style="width:100%;padding:8px 10px;font-size:13px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);line-height:1.4;resize:vertical;"></textarea>
              </div>

              <!-- Options A, B, C, D Inputs & Correct Option Selector -->
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:11.5px;font-weight:600;color:var(--text);">4 Lựa chọn trả lời: *</span>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <label for="selQuizCorrectId" style="font-size:11.5px;font-weight:600;color:var(--accent);">Đáp án đúng: *</label>
                    <select id="selQuizCorrectId" class="form-input" style="padding:3px 8px;font-size:12px;font-weight:700;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--accent);">
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:700;font-size:12px;color:var(--text);width:16px;">A:</span>
                    <input type="text" id="txtQuizOptA" class="form-input" placeholder="Lựa chọn A" style="flex:1;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" />
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:700;font-size:12px;color:var(--text);width:16px;">B:</span>
                    <input type="text" id="txtQuizOptB" class="form-input" placeholder="Lựa chọn B" style="flex:1;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" />
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:700;font-size:12px;color:var(--text);width:16px;">C:</span>
                    <input type="text" id="txtQuizOptC" class="form-input" placeholder="Lựa chọn C" style="flex:1;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" />
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:700;font-size:12px;color:var(--text);width:16px;">D:</span>
                    <input type="text" id="txtQuizOptD" class="form-input" placeholder="Lựa chọn D" style="flex:1;padding:6px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" />
                  </div>
                </div>
              </div>

              <!-- Explanation Textarea -->
              <div style="margin-bottom:12px;">
                <label for="txtQuizExplanation" style="display:block;font-size:11.5px;font-weight:600;color:var(--text);margin-bottom:4px;">💡 Lời giải thích / Hướng dẫn giải:</label>
                <textarea id="txtQuizExplanation" rows="2" class="form-input" placeholder="Giải thích chi tiết vì sao đáp án này đúng..." style="width:100%;padding:8px 10px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);line-height:1.4;resize:vertical;"></textarea>
              </div>

              <!-- Validation Feedback -->
              <div id="quizValidationBanner" style="display:none;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px 12px;font-size:12px;color:#ef4444;margin-bottom:10px;"></div>

              <!-- Save Notification Alert -->
              <div id="quizSaveAlert" style="display:none;margin-bottom:10px;padding:8px 12px;border-radius:6px;font-size:12.5px;"></div>

              <!-- Action Bar -->
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="font-size:11.5px;color:var(--dim);">
                  Nguồn: <strong style="color:var(--accent);">AI Vision</strong> • Sẵn sàng đưa vào ngân hàng đề thi
                </div>
                <button type="button" class="btn-primary" id="btnSaveQuizQuestion" style="padding:8px 18px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
                  <span>💾</span>
                  <span>Lưu vào Ngân Hàng Câu Hỏi</span>
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

    this.tabExpr = this.container.querySelector('#tabLogicModeExpr');
    this.tabQuiz = this.container.querySelector('#tabLogicModeQuiz');

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

    // Quiz result elements
    this.quizResultBox = this.container.querySelector('#logicQuizResultBox');
    this.quizPreviewQuestion = this.container.querySelector('#quizPreviewQuestion');
    this.quizPreviewOptions = this.container.querySelector('#quizPreviewOptions');
    this.quizPreviewExplanation = this.container.querySelector('#quizPreviewExplanation');
    this.quizStatusBadge = this.container.querySelector('#quizStatusBadge');
    this.selQuizTopic = this.container.querySelector('#selQuizTopic');
    this.selQuizDifficulty = this.container.querySelector('#selQuizDifficulty');
    this.txtQuizQuestion = this.container.querySelector('#txtQuizQuestion');
    this.selQuizCorrectId = this.container.querySelector('#selQuizCorrectId');
    this.txtQuizOptA = this.container.querySelector('#txtQuizOptA');
    this.txtQuizOptB = this.container.querySelector('#txtQuizOptB');
    this.txtQuizOptC = this.container.querySelector('#txtQuizOptC');
    this.txtQuizOptD = this.container.querySelector('#txtQuizOptD');
    this.txtQuizExplanation = this.container.querySelector('#txtQuizExplanation');
    this.quizValidationBanner = this.container.querySelector('#quizValidationBanner');
    this.quizSaveAlert = this.container.querySelector('#quizSaveAlert');
    this.btnSaveQuizQuestion = this.container.querySelector('#btnSaveQuizQuestion');
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

    // Mode tab switcher
    this.tabExpr?.addEventListener('click', () => this.switchMode('expression'));
    this.tabQuiz?.addEventListener('click', () => this.switchMode('quiz'));

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

    // Live validation on quiz edit fields
    const quizInputs = [
      this.txtQuizQuestion,
      this.txtQuizOptA,
      this.txtQuizOptB,
      this.txtQuizOptC,
      this.txtQuizOptD,
      this.selQuizCorrectId,
      this.selQuizTopic,
      this.selQuizDifficulty,
      this.txtQuizExplanation,
    ];
    quizInputs.forEach(el => {
      el?.addEventListener('input', () => this._onQuizInputChanged());
      el?.addEventListener('change', () => this._onQuizInputChanged());
    });

    // Save quiz question button
    this.btnSaveQuizQuestion?.addEventListener('click', () => this._onSaveQuizConfirmed());
  }

  /**
   * Opens the modal dialog.
   * @param {'expression'|'quiz'} [initialMode='expression']
   */
  open(initialMode = 'expression') {
    this.isOpen = true;
    this.switchMode(initialMode);
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
   * Switches modal mode: 'expression' | 'quiz'.
   * @param {'expression'|'quiz'} mode
   */
  switchMode(mode) {
    this.mode = mode === 'quiz' ? 'quiz' : 'expression';

    this.tabExpr?.classList.toggle('active', this.mode === 'expression');
    this.tabExpr?.setAttribute('aria-selected', this.mode === 'expression' ? 'true' : 'false');

    this.tabQuiz?.classList.toggle('active', this.mode === 'quiz');
    this.tabQuiz?.setAttribute('aria-selected', this.mode === 'quiz' ? 'true' : 'false');

    this._hideErrors();

    // If result already extracted for this mode, display it
    if (this.mode === 'expression') {
      if (this.quizResultBox) this.quizResultBox.style.display = 'none';
      if (this.extractedExpressionResult && this.exprResultBox) {
        this.exprResultBox.style.display = 'block';
      }
    } else {
      if (this.exprResultBox) this.exprResultBox.style.display = 'none';
      if (this.extractedQuizResult && this.quizResultBox) {
        this.quizResultBox.style.display = 'block';
      }
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
    if (this.quizResultBox) this.quizResultBox.style.display = 'none';

    this.abortController = new AbortController();

    try {
      const result = await analyzeLogicFile(this.currentFile, {
        mode: this.mode,
        signal: this.abortController.signal,
      });

      this.isAnalyzing = false;
      if (this.loadingBox) this.loadingBox.style.display = 'none';
      if (this.btnStartAnalyze) this.btnStartAnalyze.disabled = false;

      if (this.mode === 'quiz') {
        this.extractedQuizResult = result;
        this._renderQuizResult(result);
        if (typeof this.onPreviewQuiz === 'function') {
          this.onPreviewQuiz(result);
        }
      } else {
        this.extractedExpressionResult = result;
        this._renderExpressionResult(result);
      }

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

  _getTopicName(topic) {
    const map = {
      logic: 'Cơ sở Logic & Suy luận',
      boolean: 'Đại số Boole & Mạch Logic',
      counting: 'Đại số Tổ hợp & Đếm',
      relation: 'Quan hệ 2 ngôi & Thứ tự',
      graph: 'Lý thuyết Đồ thị & Cây',
    };
    return map[topic] || 'Toán Rời Rạc';
  }

  _updateQuizPreviewCard(qText, opts, correctId, explanation) {
    if (this.quizPreviewQuestion) {
      this.quizPreviewQuestion.textContent = qText || '';
    }
    if (this.quizPreviewExplanation) {
      this.quizPreviewExplanation.textContent = explanation || '';
    }
    if (this.quizPreviewOptions) {
      this.quizPreviewOptions.innerHTML = '';
      (opts || []).forEach((opt, idx) => {
        const optDiv = document.createElement('div');
        optDiv.style.cssText = 'padding:6px 10px;border-radius:6px;background:var(--panel);border:1px solid var(--line);font-size:12px;color:var(--text);display:flex;align-items:center;gap:6px;';
        const optLetter = opt.id || ['A', 'B', 'C', 'D'][idx] || '';
        const isCorrect = optLetter === correctId;
        const badge = document.createElement('strong');
        badge.style.color = isCorrect ? '#10b981' : 'var(--accent)';
        badge.style.fontSize = '12px';
        badge.textContent = `[${optLetter}]`;
        const textSpan = document.createElement('span');
        textSpan.textContent = opt.text || '';
        optDiv.appendChild(badge);
        optDiv.appendChild(textSpan);
        this.quizPreviewOptions.appendChild(optDiv);
      });
    }
  }

  _renderQuizResult(result) {
    if (!this.quizResultBox) return;
    this.quizResultBox.style.display = 'block';

    const questionText = result.question || '';
    const explanationText = result.explanation || '';
    const opts = Array.isArray(result.options) ? result.options : [];
    const correctId = (result.correctId || 'A').toUpperCase();

    // 1. Populate Preview Card
    const optA = opts.find(o => o.id === 'A') || opts[0];
    const optB = opts.find(o => o.id === 'B') || opts[1];
    const optC = opts.find(o => o.id === 'C') || opts[2];
    const optD = opts.find(o => o.id === 'D') || opts[3];

    const normalizedOpts = [
      { id: 'A', text: optA?.text || '' },
      { id: 'B', text: optB?.text || '' },
      { id: 'C', text: optC?.text || '' },
      { id: 'D', text: optD?.text || '' },
    ];
    this._updateQuizPreviewCard(questionText, normalizedOpts, correctId, explanationText);

    // 2. Populate Editable Form Fields
    if (this.txtQuizQuestion) {
      this.txtQuizQuestion.value = questionText;
    }

    if (this.txtQuizOptA) this.txtQuizOptA.value = optA?.text || '';
    if (this.txtQuizOptB) this.txtQuizOptB.value = optB?.text || '';
    if (this.txtQuizOptC) this.txtQuizOptC.value = optC?.text || '';
    if (this.txtQuizOptD) this.txtQuizOptD.value = optD?.text || '';

    if (this.selQuizCorrectId) {
      this.selQuizCorrectId.value = ['A', 'B', 'C', 'D'].includes(correctId) ? correctId : 'A';
    }

    if (this.txtQuizExplanation) {
      this.txtQuizExplanation.value = explanationText;
    }

    if (this.selQuizTopic && result.topic) {
      this.selQuizTopic.value = result.topic;
    }

    if (this.selQuizDifficulty && result.difficulty) {
      this.selQuizDifficulty.value = result.difficulty;
    }

    if (this.quizStatusBadge) {
      const isApproved = result.status === 'approved';
      this.quizStatusBadge.textContent = isApproved ? '✓ Đã duyệt' : '⏳ Chờ duyệt (Pending)';
      this.quizStatusBadge.style.background = isApproved ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
      this.quizStatusBadge.style.color = isApproved ? '#10b981' : '#f59e0b';
    }

    if (this.quizSaveAlert) {
      this.quizSaveAlert.style.display = 'none';
    }

    this._onQuizInputChanged();
  }

  _onQuizInputChanged() {
    const qText = (this.txtQuizQuestion?.value || '').trim();
    const optA = (this.txtQuizOptA?.value || '').trim();
    const optB = (this.txtQuizOptB?.value || '').trim();
    const optC = (this.txtQuizOptC?.value || '').trim();
    const optD = (this.txtQuizOptD?.value || '').trim();
    const correctId = (this.selQuizCorrectId?.value || 'A').trim().toUpperCase();
    const explanation = (this.txtQuizExplanation?.value || '').trim();

    // Sync preview card in real time
    this._updateQuizPreviewCard(qText, [
      { id: 'A', text: optA },
      { id: 'B', text: optB },
      { id: 'C', text: optC },
      { id: 'D', text: optD },
    ], correctId, explanation);

    let error = '';
    if (qText.length < 5) {
      error = 'Nội dung câu hỏi phải có ít nhất 5 ký tự.';
    } else if (!optA || !optB || !optC || !optD) {
      error = 'Tất cả 4 lựa chọn (A, B, C, D) đều phải có nội dung.';
    } else if (!['A', 'B', 'C', 'D'].includes(correctId)) {
      error = 'Đáp án đúng phải là một trong các lựa chọn: A, B, C, D.';
    }

    if (error) {
      this._showQuizValidation(error);
      if (this.btnSaveQuizQuestion) this.btnSaveQuizQuestion.disabled = true;
      if (this.quizStatusBadge) {
        this.quizStatusBadge.textContent = '⚠️ Chưa hoàn tất';
        this.quizStatusBadge.style.background = 'rgba(239,68,68,0.15)';
        this.quizStatusBadge.style.color = '#ef4444';
      }
    } else {
      this._hideQuizValidation();
      if (this.btnSaveQuizQuestion) this.btnSaveQuizQuestion.disabled = false;
      if (this.quizStatusBadge) {
        const isApproved = this.extractedQuizResult?.status === 'approved';
        this.quizStatusBadge.textContent = isApproved ? '✓ Đã duyệt' : '⏳ Chờ duyệt (Pending)';
        this.quizStatusBadge.style.background = isApproved ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
        this.quizStatusBadge.style.color = isApproved ? '#10b981' : '#f59e0b';
      }
    }
  }

  _showQuizValidation(message) {
    if (this.quizValidationBanner) {
      this.quizValidationBanner.textContent = message;
      this.quizValidationBanner.style.display = 'block';
    }
  }

  _hideQuizValidation() {
    if (this.quizValidationBanner) {
      this.quizValidationBanner.style.display = 'none';
      this.quizValidationBanner.textContent = '';
    }
  }

  _showQuizSaveAlert(message, type = 'success') {
    if (this.quizSaveAlert) {
      this.quizSaveAlert.textContent = message;
      this.quizSaveAlert.style.display = 'block';
      if (type === 'success') {
        this.quizSaveAlert.style.background = 'rgba(16,185,129,0.15)';
        this.quizSaveAlert.style.color = '#10b981';
        this.quizSaveAlert.style.border = '1px solid rgba(16,185,129,0.3)';
      } else {
        this.quizSaveAlert.style.background = 'rgba(239,68,68,0.15)';
        this.quizSaveAlert.style.color = '#ef4444';
        this.quizSaveAlert.style.border = '1px solid rgba(239,68,68,0.3)';
      }
    }
  }

  async _onSaveQuizConfirmed() {
    const qText = (this.txtQuizQuestion?.value || '').trim();
    const optA = (this.txtQuizOptA?.value || '').trim();
    const optB = (this.txtQuizOptB?.value || '').trim();
    const optC = (this.txtQuizOptC?.value || '').trim();
    const optD = (this.txtQuizOptD?.value || '').trim();
    const correctId = (this.selQuizCorrectId?.value || 'A').trim().toUpperCase();
    const explanation = (this.txtQuizExplanation?.value || '').trim();
    const topic = (this.selQuizTopic?.value || 'logic').trim();
    const difficulty = (this.selQuizDifficulty?.value || 'medium').trim();

    if (qText.length < 5 || !optA || !optB || !optC || !optD) {
      this._onQuizInputChanged();
      return;
    }

    const questionData = {
      id: this.extractedQuizResult?.id || `custom_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      topic,
      topicName: this._getTopicName(topic),
      difficulty,
      question: qText,
      options: [
        { id: 'A', text: optA },
        { id: 'B', text: optB },
        { id: 'C', text: optC },
        { id: 'D', text: optD },
      ],
      correctId,
      explanation,
      source: 'ai_vision',
      status: 'approved',
      createdAt: new Date().toISOString(),
    };

    if (typeof this.onSaveQuizQuestion === 'function') {
      try {
        if (this.btnSaveQuizQuestion) {
          this.btnSaveQuizQuestion.disabled = true;
          this.btnSaveQuizQuestion.innerHTML = `<span>⏳</span><span>Đang lưu...</span>`;
        }
        const res = await this.onSaveQuizQuestion(questionData);
        if (res === false || (res && res.success === false)) {
          this._showQuizValidation(res?.error || res?.message || 'Lỗi khi lưu câu hỏi.');
          if (this.btnSaveQuizQuestion) {
            this.btnSaveQuizQuestion.disabled = false;
            this.btnSaveQuizQuestion.innerHTML = `<span>💾</span><span>Lưu vào Ngân Hàng Câu Hỏi</span>`;
          }
          return;
        }

        if (this.extractedQuizResult) {
          this.extractedQuizResult.status = 'approved';
        }
        if (this.quizStatusBadge) {
          this.quizStatusBadge.textContent = '✓ Đã duyệt';
          this.quizStatusBadge.style.background = 'rgba(16,185,129,0.15)';
          this.quizStatusBadge.style.color = '#10b981';
        }

        this._showQuizSaveAlert('✓ Đã lưu câu hỏi thành công vào Ngân hàng câu hỏi!', 'success');
        setTimeout(() => {
          this.close();
        }, 1000);
      } catch (err) {
        this._showQuizValidation(err?.message || 'Lỗi khi lưu câu hỏi.');
        if (this.btnSaveQuizQuestion) {
          this.btnSaveQuizQuestion.disabled = false;
          this.btnSaveQuizQuestion.innerHTML = `<span>💾</span><span>Lưu vào Ngân Hàng Câu Hỏi</span>`;
        }
      }
    } else {
      if (this.extractedQuizResult) {
        this.extractedQuizResult.status = 'approved';
      }
      if (this.quizStatusBadge) {
        this.quizStatusBadge.textContent = '✓ Đã duyệt';
        this.quizStatusBadge.style.background = 'rgba(16,185,129,0.15)';
        this.quizStatusBadge.style.color = '#10b981';
      }
      this._showQuizSaveAlert('✓ Câu hỏi đã được xác nhận!', 'success');
      setTimeout(() => this.close(), 1000);
    }
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
