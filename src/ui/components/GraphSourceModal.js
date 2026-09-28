/**
 * @file GraphSourceModal.js
 * User Graph Input Modal Component with AI Vision / File Extraction Pipeline
 * 
 * Provides:
 * 1. Edge List input tab
 * 2. Adjacency Matrix input tab
 * 3. Image / File AI Vision input tab (.png, .jpg, .jpeg, .webp, .pdf, .docx up to 15MB)
 * 
 * Features:
 * - Drag-and-drop file upload with visual state feedback
 * - File picker integration and format/size validation
 * - Thumbnail image and file metadata preview
 * - Progressive AI loading indicators
 * - Graph specification preview with semantic warning badges
 * - "Chỉnh sửa chi tiết" bridge to Edge List editor
 * - Non-destructive cancel behavior
 */

import { parseEdgeList } from '../../core/parsers/EdgeListParser.js';
import { parseAdjacencyMatrix } from '../../core/parsers/MatrixParser.js';
import { createGraphFromParser } from '../../core/models/GraphAdapter.js';
import { generateRandomGraph } from '../../core/generators/RandomGraphGenerator.js';
import {
  analyzeGraphFile,
  validateFileSupport,
  validateGraphSpecification,
  createGraphFromSpecification,
  graphToEdgeList,
  graphToAdjacencyMatrix,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  getStoredModel,
  setStoredModel,
  clearStoredModel,
  fetchAvailableGeminiModels,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../../app/ai/GraphVisionAdapter.js';
import { extractDocx } from '../../app/ai/DocxExtractor.js';

export class GraphSourceModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Function} options.onGraphCreated - Callback(graph, name, preferredAlgo)
   */
  constructor({ container, onGraphCreated }) {
    this.container = container;
    this.onGraphCreated = onGraphCreated || (() => {});
    this.isOpen = false;
    this.mode = 'list'; // 'list' | 'matrix' | 'file'
    this.isDirected = false;

    // AI / File state
    this.currentFile = null;
    this.extractedDocxImage = null;
    this.previewUrl = null;
    this.extractedSpec = null;
    this.extractedGraph = null;
    this.defaultExtractedName = '';

    this._render();
  }

  _render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="customModal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-dialog">
          <div class="modal-head">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;">✏️</span>
              <h3 class="modal-title" id="modalTitle">Tự tạo & Nạp Đồ thị vào Lab</h3>
            </div>
            <button class="modal-close-btn" id="btnModalClose" title="Đóng modal" aria-label="Đóng">&times;</button>
          </div>

          <div class="modal-body">
            <!-- Modal Tabs Switcher -->
            <div class="modal-tabs" role="tablist">
              <button type="button" class="modal-tab-btn active" data-tab="list" id="tabBtnList" role="tab" aria-selected="true">
                📝 Danh sách cạnh
              </button>
              <button type="button" class="modal-tab-btn" data-tab="matrix" id="tabBtnMatrix" role="tab" aria-selected="false">
                🔢 Ma trận kề
              </button>
              <button type="button" class="modal-tab-btn" data-tab="file" id="tabBtnFile" role="tab" aria-selected="false">
                📷 Ảnh / Tệp AI
              </button>
            </div>

            <!-- Common Configuration: Name, Directed, Preferred Algorithm -->
            <div class="modal-common-controls">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                  <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:4px;">Tên đồ thị (Tùy chọn):</label>
                  <input type="text" id="modalGraphName" class="form-input" style="width:100%;" placeholder="Ví dụ: Đồ thị tùy chỉnh 1">
                </div>
                <div>
                  <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:4px;">Thuật toán ưu tiên:</label>
                  <select id="modalPreferredAlgo" class="form-select" style="width:100%;">
                    <option value="dijkstra">Dijkstra (Đường đi ngắn nhất)</option>
                    <option value="kruskal">Kruskal (Cây khung nhỏ nhất)</option>
                    <option value="prim">Prim (Cây khung nhỏ nhất)</option>
                    <option value="euler">Euler (Chu trình / Đường đi)</option>
                    <option value="hamilton">Hamilton (Chu trình / Đường đi)</option>
                  </select>
                </div>
              </div>

              <!-- Random Graph Generator Section -->
              <div style="margin-top:10px;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <span style="font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;">
                    <span>🎲</span>
                    <span>Sinh đồ thị ngẫu nhiên:</span>
                  </span>
                  <button type="button" class="btn-sm" id="btnToggleRandomControls">
                    ▼ Mở công cụ
                  </button>
                </div>

                <div id="randomControlsWrap" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);">
                  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(105px, 1fr));gap:8px;align-items:flex-end;">
                    <div>
                      <label style="font-size:11px;color:var(--dim);display:block;margin-bottom:3px;">Số đỉnh (3-12):</label>
                      <input type="number" id="randomNodeCount" class="form-input" min="3" max="12" value="6" style="width:100%;height:30px;font-size:12px;">
                    </div>
                    <div>
                      <label style="font-size:11px;color:var(--dim);display:block;margin-bottom:3px;">Mật độ cạnh:</label>
                      <select id="randomDensity" class="form-select" style="width:100%;height:30px;font-size:12px;">
                        <option value="sparse">Thưa</option>
                        <option value="medium" selected>Vừa</option>
                        <option value="dense">Dày</option>
                      </select>
                    </div>
                    <div>
                      <label style="font-size:11px;color:var(--dim);display:block;margin-bottom:3px;">Trọng số min-max:</label>
                      <div style="display:flex;align-items:center;gap:4px;">
                        <input type="number" id="randomMinWeight" class="form-input" min="1" max="99" value="1" style="width:50%;height:30px;font-size:12px;padding:2px 4px;">
                        <span style="color:var(--dim);">-</span>
                        <input type="number" id="randomMaxWeight" class="form-input" min="1" max="99" value="15" style="width:50%;height:30px;font-size:12px;padding:2px 4px;">
                      </div>
                    </div>
                    <div>
                      <button type="button" class="btn-primary btn-sm" id="btnGenerateRandom" style="width:100%;height:30px;justify-content:center;">
                        🎲 Tạo đồ thị
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style="margin-top:8px;">
                <label style="font-size:11.5px;color:var(--dim);display:block;margin-bottom:4px;">Loại đồ thị:</label>
                <div class="algo-switch" id="modalDirectedSwitch">
                  <button type="button" class="algo-switch-btn active" data-directed="false">⇄ Vô hướng</button>
                  <button type="button" class="algo-switch-btn" data-directed="true">➔ Có hướng</button>
                </div>
              </div>
            </div>

            <!-- TAB 1: EDGE LIST -->
            <div id="listInputWrap" class="modal-tab-pane">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
                <span style="font-size:11.5px;color:var(--dim);">
                  Cú pháp: <code>A - B: 4</code> (vô hướng) hoặc <code>A -> B: 4</code> (có hướng) (mỗi dòng một cạnh):
                </span>
                <button class="btn-sm" type="button" id="btnFillSample">📋 Điền mẫu</button>
              </div>
              <textarea id="modalTextList" class="form-input" style="width:100%;height:130px;font-family:monospace;font-size:12px;" placeholder="A - B: 4&#10;A - C: 2&#10;B - C: 1&#10;B - D: 5&#10;C - D: 8"></textarea>
              <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                <button type="button" class="btn-sm" id="btnModalPreview">👁️ Kiểm tra cú pháp</button>
              </div>
            </div>

            <!-- TAB 2: ADJACENCY MATRIX -->
            <div id="matrixInputWrap" class="modal-tab-pane" style="display:none;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;">
                <span style="font-size:11.5px;color:var(--dim);">
                  Dòng 1: Tên các đỉnh cách nhau khoảng trắng. Các dòng tiếp theo: Trọng số ma trận (0, -, inf = không có cạnh):
                </span>
                <button class="btn-sm" type="button" id="btnFillSampleMatrix">📋 Điền mẫu</button>
              </div>
              <textarea id="modalTextMatrix" class="form-input" style="width:100%;height:130px;font-family:monospace;font-size:12px;" placeholder="A B C D&#10;0 4 2 0&#10;4 0 1 5&#10;2 1 0 8&#10;0 5 8 0"></textarea>
              <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                <button type="button" class="btn-sm" id="btnModalPreviewMatrix">👁️ Kiểm tra cú pháp</button>
              </div>
            </div>

            <!-- TAB 3: IMAGE / FILE AI IMPORT -->
            <div id="fileInputWrap" class="modal-tab-pane" style="display:none;">
              <!-- AI Server Status -->
              <div class="ai-config-bar" id="aiConfigBar" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-card, #1e293b);border:1px solid var(--border, #334155);border-radius:6px;margin-bottom:12px;font-size:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span id="aiStatusDot" style="width:9px;height:9px;border-radius:50%;background:#10b981;display:inline-block;"></span>
                  <span id="aiStatusText" style="color:var(--text, #f8fafc);font-weight:500;">Hệ thống AI trên máy chủ đã sẵn sàng</span>
                </div>
                <button type="button" class="btn-sm" id="btnToggleAiConfig" title="Cấu hình API Key">⚙️ Cấu hình API Key</button>
              </div>

              <!-- AI API Key Config Panel -->
              <div id="aiConfigPanel" style="display:none;padding:10px;background:var(--bg-card, #1e293b);border:1px solid var(--border, #334155);border-radius:6px;margin-bottom:12px;font-size:12px;">
                <label for="inputGeminiApiKey" style="display:block;margin-bottom:6px;color:var(--text, #f8fafc);font-weight:500;">Gemini API Key:</label>
                <input type="password" id="inputGeminiApiKey" class="form-input" style="width:100%;margin-bottom:8px;" placeholder="Nhập API Key nếu muốn gọi trực tiếp..." />
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn-sm btn-primary" id="btnSaveApiKey">💾 Lưu</button>
                  <button type="button" class="btn-sm" id="btnClearApiKey">🗑️ Xóa</button>
                </div>
                <div id="aiKeyWarning" style="display:none;margin-top:8px;padding:8px;background:rgba(245,158,11,0.15);border:1px solid #f59e0b;border-radius:4px;color:#f59e0b;font-size:11.5px;line-height:1.4;"></div>
              </div>

              <!-- Dropzone -->
              <div class="file-dropzone" id="fileDropzone" tabindex="0" role="button" aria-label="Kéo thả ảnh hoặc tệp đồ thị vào đây">
                <input type="file" id="filePickerInput" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx" style="display:none;" />
                <div class="dropzone-icon">📁</div>
                <p class="dropzone-prompt"><strong>Kéo thả ảnh hoặc tài liệu đồ thị vào đây</strong></p>
                <p class="dropzone-sub">hoặc <button type="button" class="btn-browse" id="btnBrowseFile">Chọn tệp từ máy tính</button></p>
                <div class="dropzone-formats">Hỗ trợ định dạng: PNG, JPG, JPEG, WEBP, PDF, DOCX (Tối đa 15MB)</div>
              </div>

              <!-- File Preview Card -->
              <div class="file-preview-card" id="filePreviewCard" style="display:none;">
                <div class="file-preview-thumb" id="filePreviewThumb"></div>
                <div class="file-preview-meta">
                  <div class="file-preview-name" id="filePreviewName">file_name.png</div>
                  <div class="file-preview-size" id="filePreviewSize">0 KB</div>
                </div>
                <div class="file-preview-actions">
                  <button type="button" class="btn-sm" id="btnChangeFile" title="Chọn lại tệp khác">🔄 Đổi tệp</button>
                  <button type="button" class="btn-primary btn-sm" id="btnAnalyzeFile">⚡ Phân tích đồ thị (AI)</button>
                </div>
              </div>

              <!-- AI Loading Spinner -->
              <div class="ai-loading-box" id="aiLoadingBox" style="display:none;">
                <div class="spinner"></div>
                <div class="ai-loading-text" id="aiLoadingText">Đang phân tích cấu trúc đồ thị từ hình ảnh/tệp...</div>
              </div>

              <!-- AI Result & Spec Preview Box -->
              <div class="ai-result-box" id="aiResultBox" style="display:none;">
                <div class="ai-result-header">
                  <span style="font-weight:700;color:var(--text);font-size:12.5px;">📊 Kết quả phân tích đồ thị:</span>
                  <span class="ai-confidence-badge" id="aiConfidenceBadge">Đã phân tích</span>
                </div>
                <div class="ai-result-summary" id="aiResultSummary"></div>
                <div class="spec-warning-box" id="aiWarningBox" style="display:none;"></div>
                <div class="ai-result-actions">
                  <button type="button" class="btn-sm" id="btnEditExtracted" title="Chuyển dữ liệu sang danh sách cạnh để chỉnh sửa">✏️ Chỉnh sửa chi tiết</button>
                  <button type="button" class="btn-primary" id="btnApplyExtracted">✓ Xác nhận & Nạp đồ thị vào Lab</button>
                </div>
              </div>
            </div>

            <!-- Preview Summary & Feedback -->
            <div id="modalPreviewSummary" style="display:none;" class="modal-summary-box"></div>
            <div id="modalError" style="display:none;" class="modal-error-box"></div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn-sm" id="btnModalCancel">Hủy</button>
            <button type="button" class="btn-primary" id="btnModalApply">✓ Nạp đồ thị vào Lab</button>
          </div>
        </div>
      </div>
    `;

    // DOM Elements
    this.modalEl = this.container.querySelector('#customModal');
    this.btnClose = this.container.querySelector('#btnModalClose');
    this.btnCancel = this.container.querySelector('#btnModalCancel');
    this.btnApply = this.container.querySelector('#btnModalApply');

    // Tabs
    this.tabBtnList = this.container.querySelector('#tabBtnList');
    this.tabBtnMatrix = this.container.querySelector('#tabBtnMatrix');
    this.tabBtnFile = this.container.querySelector('#tabBtnFile');

    this.listWrap = this.container.querySelector('#listInputWrap');
    this.matrixWrap = this.container.querySelector('#matrixInputWrap');
    this.fileWrap = this.container.querySelector('#fileInputWrap');

    // Common inputs
    this.graphNameInput = this.container.querySelector('#modalGraphName');
    this.directedSwitch = this.container.querySelector('#modalDirectedSwitch');
    this.preferredAlgo = this.container.querySelector('#modalPreferredAlgo');

    // List & Matrix inputs
    this.textList = this.container.querySelector('#modalTextList');
    this.textMatrix = this.container.querySelector('#modalTextMatrix');
    this.btnSample = this.container.querySelector('#btnFillSample');
    this.btnSampleMatrix = this.container.querySelector('#btnFillSampleMatrix');
    this.btnPreview = this.container.querySelector('#btnModalPreview');
    this.btnPreviewMatrix = this.container.querySelector('#btnModalPreviewMatrix');

    // File / AI inputs
    this.dropzone = this.container.querySelector('#fileDropzone');
    this.filePickerInput = this.container.querySelector('#filePickerInput');
    this.btnBrowse = this.container.querySelector('#btnBrowseFile');
    this.filePreviewCard = this.container.querySelector('#filePreviewCard');
    this.filePreviewThumb = this.container.querySelector('#filePreviewThumb');
    this.filePreviewName = this.container.querySelector('#filePreviewName');
    this.filePreviewSize = this.container.querySelector('#filePreviewSize');
    this.btnChangeFile = this.container.querySelector('#btnChangeFile');
    this.btnAnalyzeFile = this.container.querySelector('#btnAnalyzeFile');

    this.aiLoadingBox = this.container.querySelector('#aiLoadingBox');
    this.aiLoadingText = this.container.querySelector('#aiLoadingText');
    this.aiResultBox = this.container.querySelector('#aiResultBox');
    this.aiConfidenceBadge = this.container.querySelector('#aiConfidenceBadge');
    this.aiResultSummary = this.container.querySelector('#aiResultSummary');
    this.aiWarningBox = this.container.querySelector('#aiWarningBox');
    this.btnEditExtracted = this.container.querySelector('#btnEditExtracted');
    this.btnApplyExtracted = this.container.querySelector('#btnApplyExtracted');

    // AI Config bar elements
    this.aiStatusDot = this.container.querySelector('#aiStatusDot');
    this.aiStatusText = this.container.querySelector('#aiStatusText');
    this.aiConfigPanel = this.container.querySelector('#aiConfigPanel');
    this.btnToggleAiConfig = this.container.querySelector('#btnToggleAiConfig');
    this.inputGeminiApiKey = this.container.querySelector('#inputGeminiApiKey');
    this.btnSaveApiKey = this.container.querySelector('#btnSaveApiKey');
    this.btnClearApiKey = this.container.querySelector('#btnClearApiKey');
    this.aiKeyWarning = this.container.querySelector('#aiKeyWarning');

    if (this.inputGeminiApiKey) {
      this.inputGeminiApiKey.value = getStoredApiKey() || '';
    }

    // Feedback
    this.previewSummary = this.container.querySelector('#modalPreviewSummary');
    this.errorBox = this.container.querySelector('#modalError');

    // Random generator controls
    this.btnToggleRandom = this.container.querySelector('#btnToggleRandomControls');
    this.randomControlsWrap = this.container.querySelector('#randomControlsWrap');
    this.randomNodeCount = this.container.querySelector('#randomNodeCount');
    this.randomDensity = this.container.querySelector('#randomDensity');
    this.randomMinWeight = this.container.querySelector('#randomMinWeight');
    this.randomMaxWeight = this.container.querySelector('#randomMaxWeight');
    this.btnGenerateRandom = this.container.querySelector('#btnGenerateRandom');

    this._bindEvents();
  }

  _bindEvents() {
    // Close / Cancel
    this.btnClose.addEventListener('click', () => this.close());
    this.btnCancel.addEventListener('click', () => this.close());

    // API Key config panel toggle and actions
    if (this.btnToggleAiConfig && this.aiConfigPanel) {
      this.btnToggleAiConfig.addEventListener('click', () => {
        const isHidden = this.aiConfigPanel.style.display === 'none';
        this.aiConfigPanel.style.display = isHidden ? 'block' : 'none';
      });
    }

    if (this.btnSaveApiKey && this.inputGeminiApiKey) {
      this.btnSaveApiKey.addEventListener('click', () => {
        const val = this.inputGeminiApiKey.value;
        const trimmed = val.trim();
        if (trimmed && !/^(AIzaSy|AQ\.)[A-Za-z0-9_\-]{20,}$/.test(trimmed)) {
          if (this.aiKeyWarning) {
            this.aiKeyWarning.style.display = 'block';
            this.aiKeyWarning.innerHTML = '⚠️ Key không đúng định dạng Google Gemini API Key (thường bắt đầu bằng "AIzaSy..." hoặc "AQ."). Vui lòng kiểm tra lại tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#f59e0b;text-decoration:underline;font-weight:600;">Google AI Studio</a>.';
          }
        } else {
          if (this.aiKeyWarning) {
            this.aiKeyWarning.style.display = 'none';
          }
        }
        setStoredApiKey(trimmed);
        if (this.aiStatusText) {
          this.aiStatusText.textContent = 'Hệ thống AI đã Sẵn sàng (Đã lưu API Key)';
        }
      });
    }

    if (this.btnClearApiKey && this.inputGeminiApiKey) {
      this.btnClearApiKey.addEventListener('click', () => {
        clearStoredApiKey();
        this.inputGeminiApiKey.value = '';
        if (this.aiKeyWarning) {
          this.aiKeyWarning.style.display = 'none';
        }
        if (this.aiStatusText) {
          this.aiStatusText.textContent = 'Hệ thống AI trên máy chủ đã sẵn sàng';
        }
      });
    }

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // Keyboard ESC to dismiss
    document.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });

    // Tab buttons
    this.tabBtnList.addEventListener('click', () => this.setTab('list'));
    this.tabBtnMatrix.addEventListener('click', () => this.setTab('matrix'));
    this.tabBtnFile.addEventListener('click', () => this.setTab('file'));

    // Directed switch
    this.directedSwitch.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.directedSwitch.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.isDirected = btn.getAttribute('data-directed') === 'true';
        if (this.mode !== 'file') {
          this.updatePreview();
        }
      });
    });

    // Auto-sync directed switch when preferred algorithm changes to prim or kruskal
    this.preferredAlgo.addEventListener('change', () => {
      const algo = this.preferredAlgo.value;
      if (algo === 'prim' || algo === 'kruskal') {
        this.isDirected = false;
        this.directedSwitch.querySelectorAll('button').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-directed') === 'false');
        });
        if (this.mode !== 'file') {
          this.updatePreview();
        }
      }
    });

    // Toggle random controls accordion
    if (this.btnToggleRandom && this.randomControlsWrap) {
      this.btnToggleRandom.addEventListener('click', () => {
        const isHidden = this.randomControlsWrap.style.display === 'none';
        this.randomControlsWrap.style.display = isHidden ? 'block' : 'none';
        this.btnToggleRandom.textContent = isHidden ? '▲ Thu gọn' : '▼ Mở công cụ';
      });
    }

    // Generate random graph button
    if (this.btnGenerateRandom) {
      this.btnGenerateRandom.addEventListener('click', () => {
        this.handleGenerateRandom();
      });
    }

    // Fill sample list
    this.btnSample.addEventListener('click', () => {
      if (this.isDirected) {
        this.textList.value = 'A -> B: 4\nA -> C: 2\nB -> C: 1\nB -> D: 5\nC -> D: 8';
      } else {
        this.textList.value = 'A - B: 4\nA - C: 2\nB - C: 1\nB - D: 5\nC - D: 8';
      }
      this.updatePreview();
    });

    // Fill sample matrix
    if (this.btnSampleMatrix) {
      this.btnSampleMatrix.addEventListener('click', () => {
        if (this.isDirected) {
          this.textMatrix.value = 'A B C D\n0 4 2 0\n0 0 1 5\n0 0 0 8\n0 0 0 0';
        } else {
          this.textMatrix.value = 'A B C D\n0 4 2 0\n4 0 1 5\n2 1 0 8\n0 5 8 0';
        }
        this.updatePreview();
      });
    }

    // Preview buttons
    this.btnPreview.addEventListener('click', () => this.updatePreview());
    if (this.btnPreviewMatrix) {
      this.btnPreviewMatrix.addEventListener('click', () => this.updatePreview());
    }

    // Dropzone click & keyboard
    this.dropzone.addEventListener('click', () => {
      this.filePickerInput.click();
    });
    this.btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      this.filePickerInput.click();
    });
    this.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.filePickerInput.click();
      }
    });

    // File input change
    this.filePickerInput.addEventListener('change', () => {
      const files = this.filePickerInput.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // Dropzone Drag and Drop
    ['dragenter', 'dragover'].forEach(evt => {
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'dragend'].forEach(evt => {
      this.dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.remove('drag-active');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropzone.classList.remove('drag-active');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // Change file button
    this.btnChangeFile.addEventListener('click', () => {
      this.resetFile();
      this.filePickerInput.click();
    });

    // Analyze File (AI)
    this.btnAnalyzeFile.addEventListener('click', () => {
      this.analyzeCurrentFile();
    });

    // Edit extracted graph (bridge to Edge List)
    this.btnEditExtracted.addEventListener('click', () => {
      this.editExtractedGraph();
    });

    // Apply extracted graph
    this.btnApplyExtracted.addEventListener('click', () => {
      this.applyExtractedGraph();
    });

    // Footer Apply button
    this.btnApply.addEventListener('click', () => {
      if (this.mode === 'file') {
        if (this.extractedGraph) {
          this.applyExtractedGraph();
        } else {
          this._showError('Vui lòng phân tích tệp hoặc nạp đồ thị trước khi áp dụng!');
        }
      } else {
        this._handleApply();
      }
    });
  }

  /**
   * Sets active tab.
   * @param {'list'|'matrix'|'file'} tab
   */
  setTab(tab) {
    this.mode = tab;

    // Reset tab buttons
    [this.tabBtnList, this.tabBtnMatrix, this.tabBtnFile].forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });

    // Reset panes
    this.listWrap.style.display = 'none';
    this.matrixWrap.style.display = 'none';
    this.fileWrap.style.display = 'none';

    if (tab === 'matrix') {
      this.tabBtnMatrix.classList.add('active');
      this.tabBtnMatrix.setAttribute('aria-selected', 'true');
      this.matrixWrap.style.display = 'block';
      this.updatePreview();
    } else if (tab === 'file') {
      this.tabBtnFile.classList.add('active');
      this.tabBtnFile.setAttribute('aria-selected', 'true');
      this.fileWrap.style.display = 'block';
      this.previewSummary.style.display = 'none';
    } else {
      this.tabBtnList.classList.add('active');
      this.tabBtnList.setAttribute('aria-selected', 'true');
      this.listWrap.style.display = 'block';
      this.updatePreview();
    }
  }

  /**
   * Handles user-selected file from drop or file picker.
   * @param {File|Object} file
   * @returns {boolean}
   */
  handleFile(file) {
    this._hideError();

    const check = validateFileSupport(file);
    if (!check.valid) {
      this._showError(check.error);
      this.filePickerInput.value = '';
      return false;
    }

    this.currentFile = file;
    this.extractedDocxImage = null;
    this.extractedSpec = null;
    this.extractedGraph = null;

    // Format file size
    const size = typeof file.size === 'number' ? file.size : 0;
    const formattedSize = size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${parseFloat((size / (1024 * 1024)).toFixed(2))} MB`;

    this.filePreviewName.textContent = file.name || 'Tài liệu đồ thị';
    this.filePreviewSize.textContent = formattedSize;

    // Default graph name from filename
    const baseName = (file.name || 'Đồ thị tùy chỉnh').replace(/\.[^/.]+$/, '').trim();
    if (!this.graphNameInput.value.trim() || this.graphNameInput.value === 'Đồ thị tùy chỉnh') {
      this.graphNameInput.value = baseName;
    }
    this.defaultExtractedName = baseName;

    // Thumbnail preview
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    const fileNameLower = (file.name || '').toLowerCase();
    const isImage = file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileNameLower);
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    const isDocx = fileNameLower.endsWith('.docx');

    if (isImage && typeof window !== 'undefined' && window.URL?.createObjectURL && file instanceof Blob) {
      this.previewUrl = URL.createObjectURL(file);
      this.filePreviewThumb.innerHTML = `<img src="${this.previewUrl}" alt="Xem trước tệp" style="max-width:100%;max-height:100%;border-radius:4px;object-fit:cover;" />`;
    } else if (isPdf) {
      this.filePreviewThumb.innerHTML = '<span style="font-size:26px;">📑</span>';
    } else if (isDocx) {
      this.filePreviewThumb.innerHTML = '<span style="font-size:26px;">📄</span>';
      // Attempt docx extraction to find embedded graph image
      try {
        extractDocx(file).then(docxResult => {
          if (docxResult && docxResult.primaryImage) {
            this.extractedDocxImage = docxResult.primaryImage.blob;
            if (docxResult.primaryImage.blob && typeof window !== 'undefined' && window.URL?.createObjectURL) {
              this.previewUrl = URL.createObjectURL(docxResult.primaryImage.blob);
              this.filePreviewThumb.innerHTML = `<img src="${this.previewUrl}" alt="Ảnh đồ thị trong Word" style="max-width:100%;max-height:100%;border-radius:4px;object-fit:cover;" />`;
              this.filePreviewName.innerHTML = `${file.name} <span style="font-size:11px;color:#10b981;font-weight:600;">(Đã tìm thấy hình ảnh đồ thị trong Word)</span>`;
            }
          } else if (docxResult && docxResult.text) {
            this.filePreviewName.innerHTML = `${file.name} <span style="font-size:11px;color:var(--primary);">(Đã trích xuất văn bản bài tập)</span>`;
          }
        }).catch(() => {});
      } catch {
        // Fallback to basic file icon
      }
    } else {
      this.filePreviewThumb.innerHTML = '<span style="font-size:26px;">📄</span>';
    }

    // Toggle views
    this.dropzone.style.display = 'none';
    this.filePreviewCard.style.display = 'flex';
    this.aiLoadingBox.style.display = 'none';
    this.aiResultBox.style.display = 'none';

    return true;
  }

  /**
   * Resets the active file selection and returns to the dropzone.
   */
  resetFile() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.currentFile = null;
    this.extractedDocxImage = null;
    this.extractedSpec = null;
    this.extractedGraph = null;
    this.filePickerInput.value = '';

    this.filePreviewCard.style.display = 'none';
    this.dropzone.style.display = 'flex';
    this.aiLoadingBox.style.display = 'none';
    this.aiResultBox.style.display = 'none';
    this._hideError();
  }

  // Removed toggleAiConfigPanel, saveApiKey, clearApiKey, testApiKeyAndDetectModels methods as they are no longer needed.

  /**
   * Updates AI connection status indicator dot & label.
   */
  async updateAiStatus() {
    if (!this.aiStatusDot || !this.aiStatusText) return;

    // 0. Check client-side configured or default Gemini API key
    const apiKey = getStoredApiKey();
    if (apiKey) {
      this.aiStatusDot.style.background = '#10b981';
      this.aiStatusText.textContent = 'Hệ thống AI đã Sẵn sàng (Gemini 3.8 Flash)';
      if (this.inputGeminiApiKey) {
        this.inputGeminiApiKey.value = apiKey;
      }
      return;
    }

    // 1. Probe backend server first (public server or local server)
    const probeEndpoints = ['/api/health'];
    if (typeof window !== 'undefined' && window.location && window.location.port !== '3000') {
      probeEndpoints.push('http://localhost:3000/api/health');
      probeEndpoints.push('http://127.0.0.1:3000/api/health');
    }

    for (const ep of probeEndpoints) {
      try {
        const res = await fetch(ep).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.aiConfigured) {
            this.aiStatusDot.style.background = '#10b981';
            this.aiStatusText.textContent = 'Hệ thống: Sẵn sàng (Máy chủ đã kích hoạt AI)';
            if (this.aiConfigPanel) {
              this.aiConfigPanel.style.display = 'none';
            }
            return;
          }
        }
      } catch {}
    }

    // 2. If probing fails or returns false
    this.aiStatusDot.style.background = '#f59e0b';
    this.aiStatusText.textContent = 'Chưa cấu hình API Key (Bấm "Cấu hình API Key" để kích hoạt)';
  }

  /**
   * Triggers AI Analysis on currently selected file.
   * @param {Object} [options={}] - Options for analyzeGraphFile (e.g. { mockSpec, analyzer })
   */
  async analyzeCurrentFile(options = {}) {
    if (!this.currentFile) {
      this._showError('Vui lòng chọn hoặc kéo thả tệp đồ thị trước khi phân tích.');
      return;
    }

    this._hideError();
    this.aiLoadingBox.style.display = 'flex';
    this.aiResultBox.style.display = 'none';
    this.btnAnalyzeFile.disabled = true;
    const originalAnalyzeText = this.btnAnalyzeFile.textContent;
    this.btnAnalyzeFile.textContent = 'Đang phân tích...';

    try {
      this.aiLoadingText.textContent = 'Đang phân tích...';
      const fileToAnalyze = this.extractedDocxImage || this.currentFile;
      const spec = await analyzeGraphFile(fileToAnalyze, options);

      // Create Core Graph instance
      const graph = createGraphFromSpecification(spec);

      this.extractedSpec = spec;
      this.extractedGraph = graph;

      // Update UI with extraction result
      const nodeCount = graph.nodeCount || graph.getNodes().length;
      const edgeCount = graph.edgeCount || graph.getEdges().length;
      const isDir = Boolean(spec.directed);
      const isWeighted = Boolean(spec.weighted);

      // Sync directed switch
      this.isDirected = isDir;
      this.directedSwitch.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', (btn.getAttribute('data-directed') === 'true') === isDir);
      });

      // Update AI Result Summary
      this.aiResultSummary.innerHTML = `
        <div style="font-family:monospace;font-size:12px;color:var(--text);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">
          <span>✓ Đỉnh: <strong>${nodeCount}</strong></span>
          <span>✓ Cạnh: <strong>${edgeCount}</strong></span>
          <span>✓ <strong>${isDir ? 'Có hướng' : 'Vô hướng'}</strong></span>
          <span>✓ Trọng số: <strong>${isWeighted ? 'Có' : 'Không'}</strong></span>
        </div>
      `;

      // Update confidence badge
      if (typeof spec.confidence === 'number') {
        const pct = Math.round(spec.confidence * 100);
        this.aiConfidenceBadge.textContent = `Đã nhận diện đồ thị (${pct}%)`;
        this.aiConfidenceBadge.className = pct >= 80 ? 'ai-confidence-badge high' : 'ai-confidence-badge med';
      } else {
        this.aiConfidenceBadge.textContent = 'Đã nhận diện đồ thị';
      }

      // Semantic warnings
      if (spec.warnings && spec.warnings.length > 0) {
        this.aiWarningBox.style.display = 'block';
        this.aiWarningBox.innerHTML = `
          <div style="font-weight:600;margin-bottom:4px;">⚠️ Một số dữ liệu cần kiểm tra:</div>
          <ul style="margin:0;padding-left:18px;">
            ${spec.warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        `;
      } else {
        this.aiWarningBox.style.display = 'none';
        this.aiWarningBox.innerHTML = '';
      }

      this.aiResultBox.style.display = 'block';
    } catch (err) {
      this._showError(err.message || 'Không thể phân tích file.');
    } finally {
      this.aiLoadingBox.style.display = 'none';
      this.btnAnalyzeFile.textContent = originalAnalyzeText;
      this.btnAnalyzeFile.disabled = false;
    }
  }

  /**
   * Switches to Edge List tab with AI-extracted graph representation.
   */
  editExtractedGraph() {
    if (!this.extractedGraph) return;

    const edgeListText = graphToEdgeList(this.extractedGraph);
    this.textList.value = edgeListText;

    // Switch to list tab
    this.setTab('list');
    this.updatePreview();
  }

  /**
   * Applies AI-extracted graph directly to Algorithm Lab.
   */
  applyExtractedGraph() {
    if (!this.extractedGraph) {
      this._showError('Chưa có dữ liệu đồ thị nào được trích xuất!');
      return;
    }

    const name = this.graphNameInput.value.trim() || this.defaultExtractedName || 'Đồ thị trích xuất (AI)';
    const preferredAlgo = this.preferredAlgo.value;

    this.close();
    this.onGraphCreated(this.extractedGraph, name, preferredAlgo);
  }

  /**
   * Generates a random graph tailored for currently selected preferred algorithm.
   */
  handleGenerateRandom() {
    this._hideError();
    const algo = this.preferredAlgo ? this.preferredAlgo.value : 'dijkstra';
    const nodeCount = parseInt(this.randomNodeCount ? this.randomNodeCount.value : 6, 10) || 6;
    const density = this.randomDensity ? this.randomDensity.value : 'medium';
    const minWeight = parseInt(this.randomMinWeight ? this.randomMinWeight.value : 1, 10) || 1;
    const maxWeight = parseInt(this.randomMaxWeight ? this.randomMaxWeight.value : 15, 10) || 15;

    const generated = generateRandomGraph({
      algo,
      nodeCount,
      density,
      minWeight,
      maxWeight,
      isDirected: this.isDirected,
    });

    // Sync directed switch
    this.isDirected = generated.isDirected;
    this.directedSwitch.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', (btn.getAttribute('data-directed') === 'true') === this.isDirected);
    });

    // Populate graph name
    this.graphNameInput.value = generated.graphName;

    // Populate both edge list text and adjacency matrix text
    this.textList.value = generated.edgeListText;
    if (this.textMatrix) {
      this.textMatrix.value = generated.matrixText;
    }

    // Preserve active tab if user is currently on matrix tab
    if (this.mode === 'matrix') {
      this.setTab('matrix');
    } else {
      this.setTab('list');
    }
    this.updatePreview();
  }

  /**
   * Validates and displays parsed preview summary for List/Matrix modes.
   */
  updatePreview() {
    this._hideError();

    const text = (this.mode === 'matrix' ? this.textMatrix.value : this.textList.value).trim();
    if (!text) {
      this.previewSummary.style.display = 'none';
      return null;
    }

    try {
      if (this.mode === 'list') {
        const lines = text.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#') || line.startsWith('//')) continue;
          const match1 = line.match(/^([A-Za-z0-9_À-ỹ]+)\s*(?:->|-->|→|=>|<->|↔|[-–—,])\s*([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([0-9.]+))?$/i);
          const match2 = line.match(/^([A-Za-z0-9_À-ỹ]+)\s+([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]?\s*([0-9.]+))?$/i);
          if (!match1 && !match2) {
            throw new Error(`Cú pháp dòng không hợp lệ: "${line}"`);
          }
        }
      }

      const parsed = this.mode === 'matrix'
        ? parseAdjacencyMatrix(text, this.isDirected)
        : parseEdgeList(text, this.isDirected);

      const n = parsed.nodes ? parsed.nodes.length : 0;
      const m = parsed.edges ? parsed.edges.length : 0;
      const isDir = parsed.isDirected !== undefined ? parsed.isDirected : this.isDirected;

      this.previewSummary.style.display = 'inline-block';
      this.previewSummary.textContent = `✓ Đỉnh: ${n} | Cạnh: ${m} | ${isDir ? 'Có hướng' : 'Vô hướng'} | Trọng số: Có`;
      return parsed;
    } catch (err) {
      this.previewSummary.style.display = 'none';
      this._showError(err.message || 'Lỗi cú pháp đồ thị');
      return null;
    }
  }

  _handleApply() {
    this._hideError();

    const name = this.graphNameInput.value.trim() || 'Đồ thị tùy chỉnh';
    const preferredAlgo = this.preferredAlgo.value;

    try {
      let parsed;
      if (this.mode === 'matrix') {
        const text = this.textMatrix.value.trim();
        if (!text) throw new Error('Vui lòng nhập dữ liệu ma trận kề!');
        parsed = parseAdjacencyMatrix(text, this.isDirected);
      } else {
        const text = this.textList.value.trim();
        if (!text) throw new Error('Vui lòng nhập dữ liệu danh sách cạnh!');
        parsed = parseEdgeList(text, this.isDirected);
      }

      if (!parsed.nodes || parsed.nodes.length === 0) {
        throw new Error('Đồ thị không có đỉnh nào hợp lệ!');
      }

      const graph = createGraphFromParser(parsed, {
        directed: parsed.isDirected !== undefined ? parsed.isDirected : this.isDirected,
        weighted: true,
      });

      this.close();
      this.onGraphCreated(graph, name, preferredAlgo);
    } catch (err) {
      this._showError(err.message || 'Lỗi phân tích đồ thị');
    }
  }

  _showError(msg) {
    if (!this.errorBox) return;
    this.errorBox.style.display = 'block';
    this.errorBox.textContent = msg;
  }

  _hideError() {
    if (!this.errorBox) return;
    this.errorBox.style.display = 'none';
    this.errorBox.innerHTML = '';
  }

  /**
   * Opens modal, optionally activating a specific tab.
   * @param {'list'|'matrix'|'file'} [tab]
   */
  open(tab = null) {
    this.isOpen = true;
    if (tab) {
      this.setTab(tab);
    }
    this.modalEl.style.display = 'flex';
    this.updateAiStatus();
  }

  /**
   * Opens modal directly into the 'file' tab with a preloaded file.
   * @param {File|Object} file
   */
  openWithFile(file) {
    this.open('file');
    this.handleFile(file);
  }

  close() {
    this.isOpen = false;
    this.modalEl.style.display = 'none';
    this._hideError();
  }
}
