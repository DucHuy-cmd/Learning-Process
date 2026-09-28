/**
 * @file LogicLabView.js
 * Propositional Logic Laboratory View Component
 * 
 * Features:
 * - Interactive truth table generator with animated row-by-row playback
 * - Karnaugh Map (K-Map) with automatic grouping & Minimal SOP calculation (2-4 variables)
 * - Interactive Digital Logic Circuit (ANSI/IEEE SVG gates) with live input toggles
 * - Playback controls: Play/Pause, Step Next/Prev, Jump First/Last, Reset
 * - Adjustable playback speed (0.25x to 3.0x) and interactive scrubber slider
 * - Semantic classification (Tautology / Contradiction / Contingency)
 * - Normal forms computation (DNF / CNF) with dedicated random generator
 * - Logical equivalence verification (A ≡ B) with counterexample detection
 * - Virtual keypad for fast logic symbols insertion
 * - Random proposition generator with configurable variable count & target types
 * - Curated preset gallery for classic Discrete Math laws
 * - Export to Markdown & LaTeX
 */

import { generateTruthTable, checkEquivalence, formatTruthValue } from '../../core/logic/TruthTableEngine.js';
import { LOGIC_PRESETS } from '../../core/logic/LogicPresets.js';
import { generateRandomProposition, generateEquivalencePracticePair } from '../../core/logic/RandomLogicGenerator.js';
import { buildKMap } from '../../core/logic/KMapEngine.js';
import { buildCircuitModel, extractSopTermsFromExpression } from '../../core/logic/CircuitEngine.js';

export class LogicLabView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   */
  constructor({ container = null } = {}) {
    this.container = container;
    this.activeTab = 'single'; // 'single' | 'equiv' | 'normal'
    this.activeSubTab = 'table'; // 'table' | 'kmap' | 'circuit'
    this.valueStyle = 'binary'; // 'binary' | 'boolean' | 'vietnamese'
    this.showSteps = true;
    this.descendingOrder = true;

    // Playback state for Truth Table
    this.currentStep = 0;
    this.totalSteps = 0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.speed = 1.0; // 0.25x to 3.0x
    this.isConfigCollapsed = false;
    this.isStatsCollapsed = false;

    // Cache of current results
    this.currentTableResult = null;
    this.currentEquivResult = null;
    this.currentKMap = null;
    this.currentCircuit = null;
    this.circuitAssignment = {};
    this.lastActiveInput = null;

    if (this.container) {
      this.render();
    }
  }

  /**
   * Mounts and renders content into container.
   * @param {HTMLElement} [targetContainer]
   */
  render(targetContainer = null) {
    if (targetContainer) {
      this.container = targetContainer;
    }
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="logic-lab-container" style="max-width:1300px;margin:0 auto;padding:16px 24px 60px;">

        <!-- Mode Tabs -->
        <div class="logic-tabs-bar" style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px;">
          <button type="button" class="btn-tab active" data-logictab="single" id="tabBtnSingle" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            📊 Bảng chân trị, Bìa K & Mạch Logic
          </button>
          <button type="button" class="btn-tab" data-logictab="equiv" id="tabBtnEquiv" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            ⚖️ So sánh tương đương (A ≡ B)
          </button>
          <button type="button" class="btn-tab" data-logictab="normal" id="tabBtnNormal" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            🧩 Dạng chuẩn tắc (DNF / CNF)
          </button>
        </div>

        <!-- Compact Virtual Keypad & Format Toolbar -->
        <div class="logic-toolbar-panel" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 14px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <!-- Virtual Keypad -->
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span style="font-size:11px;color:var(--dim);font-weight:700;text-transform:uppercase;margin-right:2px;">Chèn ký hiệu:</span>
              <button type="button" class="btn-key" data-insert="¬" title="Phủ định (NOT: ~ hoặc !)">¬</button>
              <button type="button" class="btn-key" data-insert=" ∧ " title="Hội (AND: ^ hoặc &)">∧</button>
              <button type="button" class="btn-key" data-insert=" ∨ " title="Tuyển (OR: v hoặc |)">∨</button>
              <button type="button" class="btn-key" data-insert=" → " title="Kéo theo (IMPLIES: ->)">→</button>
              <button type="button" class="btn-key" data-insert=" ↔ " title="Tương đương (IFF: <->)">↔</button>
              <button type="button" class="btn-key" data-insert=" ⊕ " title="Tuyển loại trừ (XOR)">⊕</button>
              <button type="button" class="btn-key" data-insert="(">(</button>
              <button type="button" class="btn-key" data-insert=")">)</button>
              <div style="height:16px;width:1px;background:var(--line);margin:0 2px;"></div>
              <button type="button" class="btn-key var-key" data-insert="p">p</button>
              <button type="button" class="btn-key var-key" data-insert="q">q</button>
              <button type="button" class="btn-key var-key" data-insert="r">r</button>
              <button type="button" class="btn-key var-key" data-insert="s">s</button>
            </div>

            <!-- Value Format Toggle -->
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
              <span style="color:var(--dim);font-size:11.5px;">Hiển thị:</span>
              <div class="logic-style-switch" style="display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;">
                <button type="button" class="btn-style-opt active" data-style="binary">1 / 0</button>
                <button type="button" class="btn-style-opt" data-style="boolean">T / F</button>
                <button type="button" class="btn-style-opt" data-style="vietnamese">Đ / S</button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 1: Single Expression & Truth Table / K-Map / Circuit -->
        <div id="paneSingle" class="logic-pane">
          
          <!-- RESIZABLE & COLLAPSIBLE CONFIGURATION PANE -->
          <div id="logicConfigArea" class="logic-config-area" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:10px;transition:all 0.2s ease;">
            
            <!-- Row 1: Unified Presets Library & Random Generator -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;background:var(--panel-alt);padding:8px 12px;border-radius:8px;border:1px solid var(--line);">
              <!-- Presets Library (Grouped Dropdown + Quick Chips) -->
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:12px;color:var(--dim);font-weight:600;">📚 Kho mẫu:</span>
                <select id="logicPresetSelect" class="form-input" style="padding:5px 10px;font-size:12px;border-radius:6px;background:var(--panel);color:var(--text);border:1px solid var(--line);max-width:260px;">
                  <option value="">-- Chọn bài mẫu / Luật logic --</option>
                  <optgroup label="📖 Mạch Giáo Trình & Bìa K">
                    <option value="case_sgk">📖 Mạch Giáo Trình: (x₁ ∧ x₂) ∨ x₁</option>
                    <option value="case_and">1. Cổng AND 3 ngõ vào (p ∧ q ∧ r)</option>
                    <option value="case_or">2. Cổng OR 3 ngõ vào (p ∨ q ∨ r)</option>
                    <option value="case_xor">3. Cổng XOR (p ⊕ q)</option>
                    <option value="case_mux">4. Bộ chọn kênh MUX ((¬s ∧ p) ∨ (s ∧ q))</option>
                    <option value="case_corners">5. Bìa K 4 Góc biên</option>
                  </optgroup>
                  <optgroup label="⚖️ Tương Đương Logic Kinh Điển">
                    <option value="demorgan_1">Luật De Morgan (Hội sang Tuyển)</option>
                    <option value="demorgan_2">Luật De Morgan (Tuyển sang Hội)</option>
                    <option value="implication_law">Luật Kéo theo (¬p ∨ q)</option>
                    <option value="contrapositive">Luật Phản đảo (¬q → ¬p)</option>
                    <option value="distributive_and">Luật Phân phối (Hội đối với Tuyển)</option>
                    <option value="distributive_or">Luật Phân phối (Tuyển đối với Hội)</option>
                    <option value="absorption">Luật Hấp thụ (Absorption)</option>
                  </optgroup>
                  <optgroup label="🧠 Quy Tắc Suy Diễn (Hằng Đúng)">
                    <option value="modus_ponens">Khẳng định tiền đề (Modus Ponens)</option>
                    <option value="modus_tollens">Phủ định hậu đề (Modus Tollens)</option>
                    <option value="hypothetical_syllogism">Bắc cầu kéo theo</option>
                    <option value="disjunctive_syllogism">Tam đoạn luận tuyển</option>
                  </optgroup>
                  <optgroup label="🧩 Hằng Sai & SAT">
                    <option value="contradiction_simple">Mâu thuẫn cơ bản (p ∧ ¬p)</option>
                    <option value="sat_chain_4">Chuỗi SAT 4 biến</option>
                  </optgroup>
                </select>

                <!-- Quick Preset Chips -->
                <div class="circuit-presets-bar" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_sgk" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--accent);color:var(--accent);font-weight:600;">📖 SGK</button>
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_and" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--line);">AND</button>
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_or" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--line);">OR</button>
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_xor" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--line);">XOR</button>
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_mux" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--line);">MUX</button>
                  <button type="button" class="btn-sm btn-circuit-preset" data-preset="case_corners" style="padding:3px 8px;font-size:11px;border-radius:10px;background:var(--panel);border:1px solid var(--line);">4 Góc</button>
                </div>
              </div>

              <!-- Random Generator Controls -->
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:11.5px;color:var(--dim);font-weight:600;">🎲 Tự sinh:</span>
                <select id="selRandomVars" class="form-input" style="padding:3px 6px;font-size:11.5px;border-radius:4px;background:var(--panel);border:1px solid var(--line);color:var(--text);">
                  <option value="2">2 biến</option>
                  <option value="3" selected>3 biến</option>
                  <option value="4">4 biến</option>
                </select>
                <select id="selRandomType" class="form-input" style="padding:3px 6px;font-size:11.5px;border-radius:4px;background:var(--panel);border:1px solid var(--line);color:var(--text);max-width:145px;">
                  <option value="circuit" selected>Mạch logic đẹp</option>
                  <option value="random">Bất kỳ</option>
                  <option value="contingency">Thỏa được</option>
                  <option value="tautology">Hằng đúng</option>
                  <option value="contradiction">Hằng sai</option>
                </select>
                <button type="button" class="btn-sm" id="btnGenRandomSingle" style="padding:4px 10px;font-size:11.5px;">
                  🎲 Tạo ngẫu nhiên
                </button>
              </div>
            </div>

            <!-- Row 2: Input Field & Execution Action -->
            <div>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <div style="flex:1;min-width:280px;">
                  <input type="text" id="inputLogicSingle" class="form-input" style="width:100%;font-family:monospace;font-size:15px;padding:9px 14px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" value="((p → q) ∧ (q → r)) → (p → r)" placeholder="Ví dụ: (p -> q) ^ (q -> r) -> (p -> r)" />
                </div>
                <button type="button" class="btn-primary" id="btnSolveSingle" style="padding:9px 20px;font-size:13.5px;font-weight:600;white-space:nowrap;">
                  ⚡ Tạo bảng chân trị
                </button>
              </div>

              <!-- Options Checkboxes -->
              <div style="display:flex;align-items:center;gap:16px;font-size:12px;color:var(--dim);margin-top:8px;">
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                  <input type="checkbox" id="chkShowSteps" checked /> Hiện các cột bước đệm trung gian
                </label>
                <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                  <input type="checkbox" id="chkDescendingOrder" checked /> Thứ tự dòng chuẩn (1→0)
              </div>
            </div>

          </div>

          <!-- Error Alert -->
          <div id="logicErrorBox" style="display:none;background:rgba(239,68,68,0.12);border:1px solid #ef4444;border-radius:6px;padding:12px 16px;color:#fca5a5;font-size:13px;margin-bottom:20px;"></div>

          <!-- Results Section -->
          <div id="singleResultSection" style="display:none;">
            
            <!-- Upper Dashboard Area: Playback Toolbar + Summary Cards -->
            <div id="logicUpperStatsArea" style="transition:max-height 0.2s ease, opacity 0.2s ease;">
              <!-- Playback Control Toolbar -->
              <div class="logic-playback-bar" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <!-- Playback Buttons -->
                <div style="display:flex;align-items:center;gap:6px;">
                  <button type="button" class="btn-sm" id="btnLogicFirst" title="Về dòng đầu tiên (|◀)" style="padding:6px 10px;">|◀</button>
                  <button type="button" class="btn-sm" id="btnLogicPrev" title="Dòng trước (◀)" style="padding:6px 10px;">◀</button>
                  <button type="button" class="btn-primary" id="btnLogicPlay" style="padding:6px 18px;font-size:13px;font-weight:600;min-width:96px;">▶ Chạy</button>
                  <button type="button" class="btn-sm" id="btnLogicNext" title="Dòng tiếp theo (▶)" style="padding:6px 10px;">▶</button>
                  <button type="button" class="btn-sm" id="btnLogicLast" title="Đến dòng cuối cùng (▶|)" style="padding:6px 10px;">▶|</button>
                  <button type="button" class="btn-sm" id="btnLogicReset" title="Đặt lại về đầu (⟲)" style="padding:6px 10px;">⟲</button>
                </div>

                <!-- Scrubber Slider & Row Counter -->
                <div style="display:flex;align-items:center;gap:10px;flex:1;max-width:380px;min-width:180px;">
                  <span style="font-size:12px;color:var(--dim);white-space:nowrap;">Dòng:</span>
                  <input type="range" id="logicStepSlider" min="0" max="8" value="0" style="flex:1;cursor:pointer;" title="Kéo để tua đến dòng bất kỳ" />
                  <span id="logicStepCounter" style="font-family:monospace;font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;min-width:55px;text-align:right;">0 / 8</span>
                </div>

                <!-- Speed Control -->
                <div style="display:flex;align-items:center;gap:8px;">
                  <label for="logicSpeedSlider" style="font-size:12px;color:var(--dim);">Tốc độ:</label>
                  <input type="range" id="logicSpeedSlider" min="0.25" max="3" step="0.25" value="1" style="width:85px;cursor:pointer;" title="Điều chỉnh tốc độ chạy tự động" />
                  <span id="logicSpeedText" style="font-family:monospace;font-size:12.5px;font-weight:700;color:var(--accent);min-width:42px;">1.00x</span>
                </div>
              </div>

              <!-- Summary Badges & Classification -->
              <div id="logicStatCardsGrid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:12px;transition:all 0.2s ease;">
                <div class="logic-stat-card" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                  <div style="font-size:11.5px;color:var(--dim);margin-bottom:4px;">BẢN CHẤT MỆNH ĐỀ</div>
                  <div id="resClassificationBadge" style="font-size:15px;font-weight:700;color:var(--text);">Chưa xác định (Ẩn)</div>
                  <div id="resClassificationDetail" style="font-size:11.5px;color:var(--dim);margin-top:4px;">Bấm "▶ Chạy" để khám phá...</div>
                </div>
                <div class="logic-stat-card" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                  <div style="font-size:11.5px;color:var(--dim);margin-bottom:4px;">QUY MÔ BẢNG</div>
                  <div id="resScaleBadge" style="font-size:15px;font-weight:700;color:var(--text);">3 biến • 8 dòng (2³)</div>
                  <div style="font-size:11.5px;color:var(--dim);margin-top:4px;">Không gian chân trị toàn phần</div>
                </div>
                <div class="logic-stat-card" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                  <div style="font-size:11.5px;color:var(--dim);margin-bottom:4px;">TỶ LỆ CHÂN TRỊ</div>
                  <div id="resRatioBadge" style="font-size:15px;font-weight:700;color:var(--text);">0 / 8 dòng đã duyệt</div>
                  <div id="resRatioDetail" style="font-size:11.5px;color:var(--dim);margin-top:4px;">Bấm "▶ Chạy" để bắt đầu</div>
                </div>
              </div>
            </div>

            <!-- Resizable Horizontal Splitter (Exact same style as LabView) -->
            <div class="lab-splitter-h" id="logicSplitterH" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Điều chỉnh độ cao hoặc thu gọn vùng thống kê" title="Kéo lên/xuống để chỉnh độ cao hoặc nháy đúp để thu gọn/mở rộng">
              <div class="splitter-handle-h"></div>
            </div>

            <!-- Sub-Tabs Switcher for Result Panel -->
            <div class="result-subtabs-bar" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px;">
              <button type="button" class="btn-subtab active" id="subTabTable" data-subtab="table" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
                📊 1. Bảng chân trị
              </button>
              <button type="button" class="btn-subtab" id="subTabKMap" data-subtab="kmap" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
                🗺️ 2. Bìa Karnaugh (K-Map)
              </button>
              <button type="button" class="btn-subtab" id="subTabCircuit" data-subtab="circuit" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
                🔌 3. Sơ đồ mạch Logic
              </button>
            </div>

            <!-- SUB-PANE 1: Truth Table -->
            <div id="subPaneTable" class="sub-pane">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0;">
                      Bảng chân trị chi tiết (Truth Table)
                    </h3>
                    <span id="logicRunningStatusBadge" style="font-size:11.5px;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,0.15);color:var(--accent);">Sẵn sàng chạy (0%)</span>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button type="button" class="btn-sm" id="btnCopyMarkdown">📋 Chép Markdown</button>
                    <button type="button" class="btn-sm" id="btnCopyLatex">📋 Chép LaTeX</button>
                  </div>
                </div>

                <!-- Table Overflow Container -->
                <div class="table-responsive" id="tableTruthTableWrap" style="overflow-x:auto;max-height:550px;border:1px solid var(--line);border-radius:6px;">
                  <table class="logic-truth-table" id="tableTruthTable" style="width:100%;border-collapse:collapse;text-align:center;font-size:13px;">
                    <!-- Filled dynamically -->
                  </table>
                </div>
              </div>
            </div>

            <!-- SUB-PANE 2: Karnaugh Map (K-Map) -->
            <div id="subPaneKMap" class="sub-pane" style="display:none;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                  <div>
                    <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0;">
                      Bìa Karnaugh (K-Map) & Rút gọn tối tiểu
                    </h3>
                    <p style="font-size:12px;color:var(--dim);margin:3px 0 0;">
                      Sắp xếp theo mã Gray (Gray code). Các nhóm ô số 1 được khoanh vùng tối tiểu theo màu riêng biệt.
                    </p>
                  </div>
                  <span id="kmapScaleBadge" style="font-size:11.5px;padding:3px 10px;border-radius:12px;background:rgba(56,189,248,0.15);color:#38bdf8;font-weight:600;">Lưới K-Map</span>
                </div>

                <!-- Minimal SOP Formula Box -->
                <div style="padding:12px 16px;background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                  <div>
                    <div style="font-size:11.5px;color:var(--dim);margin-bottom:3px;font-weight:600;">CÔNG THỨC RÚT GỌN TỐI TIỂU (MINIMAL SOP):</div>
                    <div id="kmapMinimalSopText" style="font-family:monospace;font-size:16px;font-weight:700;color:#38bdf8;">1</div>
                  </div>
                  <button type="button" class="btn-sm" id="btnCopyMinimalSop">📋 Chép công thức tối tiểu</button>
                </div>

                <!-- K-Map Grid Display -->
                <div style="display:flex;justify-content:center;margin:18px 0;overflow-x:auto;">
                  <div id="kmapGridContainer" style="display:inline-block;"></div>
                </div>

                <!-- Group Legend List -->
                <div id="kmapLegendContainer" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;gap:10px;flex-wrap:wrap;"></div>
              </div>
            </div>

            <!-- SUB-PANE 3: Digital Logic Circuit -->
            <div id="subPaneCircuit" class="sub-pane" style="display:none;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
                  <div>
                    <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0;">
                      Sơ đồ Mạch Logic Tối Tiểu (Digital Logic Circuit)
                    </h3>
                    <p style="font-size:12px;color:var(--dim);margin:3px 0 0;">
                      Mỗi biến tín hiệu được tô màu trực quan riêng biệt (q màu đỏ, s màu vàng, p màu xanh...). 💡 <em>Click trực tiếp vào biến ngõ vào để gạt đổi giá trị 0 ↔ 1.</em>
                    </p>
                  </div>
                </div>

                <!-- SVG Circuit Viewport -->
                <div id="circuitSvgContainer" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel-alt);padding:10px;"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- TAB 2: Equivalence Checker (A ≡ B) -->
        <div id="paneEquiv" class="logic-pane" style="display:none;">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
              <div>
                <label for="inputEquiv1" style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;">
                  Biểu thức 1 (E₁):
                </label>
                <input type="text" id="inputEquiv1" class="form-input" style="width:100%;font-family:monospace;font-size:14px;padding:9px 12px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" value="p → q" placeholder="Ví dụ: p -> q" />
              </div>
              <div>
                <label for="inputEquiv2" style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;">
                  Biểu thức 2 (E₂):
                </label>
                <input type="text" id="inputEquiv2" class="form-input" style="width:100%;font-family:monospace;font-size:14px;padding:9px 12px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" value="¬p ∨ q" placeholder="Ví dụ: ~p v q" />
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <button type="button" class="btn-primary" id="btnSolveEquiv" style="padding:9px 20px;font-size:13.5px;font-weight:600;">
                ⚖️ Kiểm tra tương đương logic (E₁ ≡ E₂)
              </button>
              <button type="button" class="btn-sm" id="btnGenEquivPractice" style="padding:6px 14px;font-size:12.5px;">
                🎲 Luyện tập cặp biểu thức ngẫu nhiên
              </button>
            </div>
          </div>

          <!-- Equivalence Result Box -->
          <div id="equivResultSection" style="display:none;">
            <div id="equivBanner" style="padding:16px 20px;border-radius:8px;margin-bottom:20px;font-size:14px;display:flex;align-items:center;gap:12px;"></div>
            
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;">
              <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 12px;">
                Bảng so sánh chân trị từng trường hợp
              </h3>
              <div class="table-responsive" style="overflow-x:auto;border:1px solid var(--line);border-radius:6px;">
                <table class="logic-truth-table" id="tableEquivComparison" style="width:100%;border-collapse:collapse;text-align:center;font-size:13px;">
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: Normal Forms (DNF / CNF) with Random Generator -->
        <div id="paneNormal" class="logic-pane" style="display:none;">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px;">
            <label for="inputLogicNormal" style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">
              Nhập biểu thức cần tìm dạng chuẩn tắc:
            </label>
            <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
              <input type="text" id="inputLogicNormal" class="form-input" style="flex:1;min-width:260px;font-family:monospace;font-size:14px;padding:9px 12px;border-radius:6px;background:var(--panel-alt);color:var(--text);border:1px solid var(--line);" value="p ⊕ q" />
              <button type="button" class="btn-primary" id="btnSolveNormal" style="padding:9px 18px;font-size:13.5px;font-weight:600;">
                🧩 Tính DNF & CNF
              </button>
            </div>

            <!-- Normal Form Random Generator Controls -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-size:12px;color:var(--dim);">🎲 Sinh ngẫu nhiên biểu thức:</span>
                <select id="selNormalVars" class="form-input" style="padding:4px 8px;font-size:12px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
                  <option value="2">2 biến (p, q)</option>
                  <option value="3" selected>3 biến (p, q, r)</option>
                  <option value="4">4 biến (p, q, r, s)</option>
                </select>
                <select id="selNormalComplexity" class="form-input" style="padding:4px 8px;font-size:12px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
                  <option value="simple">Đơn giản</option>
                  <option value="medium" selected>Trung bình</option>
                  <option value="complex">Phức tạp</option>
                </select>
                <button type="button" class="btn-sm" id="btnGenRandomNormal" style="padding:5px 14px;font-size:12px;font-weight:600;">
                  🎲 Sinh biểu thức
                </button>
              </div>
            </div>
          </div>

          <!-- Normal Form Results -->
          <div id="normalResultSection" style="display:none;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;margin-bottom:20px;">
              <!-- DNF Card -->
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="background:rgba(16,185,129,0.15);color:var(--green);font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px;">
                      DNF
                    </span>
                    <span style="font-weight:700;color:var(--text);font-size:14px;">Dạng chuẩn tắc tuyển</span>
                  </div>
                  <button type="button" class="btn-sm" id="btnCopyDnf" style="padding:3px 8px;font-size:11px;">📋 Chép</button>
                </div>
                <p style="font-size:12px;color:var(--dim);margin:0 0 10px;">
                  Tuyển các hội cơ bản (Tổng các Minterm mà hàm nhận giá trị Đúng / 1):
                </p>
                <div id="dnfFormulaBox" style="padding:10px 14px;background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;font-family:monospace;font-size:14px;color:#38bdf8;word-break:break-all;"></div>
              </div>

              <!-- CNF Card -->
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="background:rgba(56,189,248,0.15);color:#38bdf8;font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px;">
                      CNF
                    </span>
                    <span style="font-weight:700;color:var(--text);font-size:14px;">Dạng chuẩn tắc hội</span>
                  </div>
                  <button type="button" class="btn-sm" id="btnCopyCnf" style="padding:3px 8px;font-size:11px;">📋 Chép</button>
                </div>
                <p style="font-size:12px;color:var(--dim);margin:0 0 10px;">
                  Hội các tuyển cơ bản (Tích các Maxterm mà hàm nhận giá trị Sai / 0):
                </p>
                <div id="cnfFormulaBox" style="padding:10px 14px;background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;font-family:monospace;font-size:14px;color:#f59e0b;word-break:break-all;"></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    this._bindElements();
    this._bindEvents();

    // Auto-solve default expression
    this.solveSingle();
  }

  _bindElements() {
    this.tabBtnSingle = this.container.querySelector('#tabBtnSingle');
    this.tabBtnEquiv = this.container.querySelector('#tabBtnEquiv');
    this.tabBtnNormal = this.container.querySelector('#tabBtnNormal');

    this.paneSingle = this.container.querySelector('#paneSingle');
    this.paneEquiv = this.container.querySelector('#paneEquiv');
    this.paneNormal = this.container.querySelector('#paneNormal');

    // Sub-Tabs
    this.subTabTable = this.container.querySelector('#subTabTable');
    this.subTabKMap = this.container.querySelector('#subTabKMap');
    this.subTabCircuit = this.container.querySelector('#subTabCircuit');
    this.subPaneTable = this.container.querySelector('#subPaneTable');
    this.subPaneKMap = this.container.querySelector('#subPaneKMap');
    this.subPaneCircuit = this.container.querySelector('#subPaneCircuit');

    // Horizontal Splitter and Dashboard containers
    this.splitterH = this.container.querySelector('#logicSplitterH');
    this.upperStatsArea = this.container.querySelector('#logicUpperStatsArea');
    this.statCardsGrid = this.container.querySelector('#logicStatCardsGrid');

    this.presetSelect = this.container.querySelector('#logicPresetSelect');
    this.inputSingle = this.container.querySelector('#inputLogicSingle');
    this.btnSolveSingle = this.container.querySelector('#btnSolveSingle');
    this.chkShowSteps = this.container.querySelector('#chkShowSteps');
    this.chkDescendingOrder = this.container.querySelector('#chkDescendingOrder');

    this.selRandomVars = this.container.querySelector('#selRandomVars');
    this.selRandomType = this.container.querySelector('#selRandomType');
    this.btnGenRandomSingle = this.container.querySelector('#btnGenRandomSingle');

    this.errorBox = this.container.querySelector('#logicErrorBox');
    this.singleResultSection = this.container.querySelector('#singleResultSection');
    this.tableTruthTable = this.container.querySelector('#tableTruthTable');
    this.tableTruthTableWrap = this.container.querySelector('#tableTruthTableWrap');

    this.resClassificationBadge = this.container.querySelector('#resClassificationBadge');
    this.resClassificationDetail = this.container.querySelector('#resClassificationDetail');
    this.resScaleBadge = this.container.querySelector('#resScaleBadge');
    this.resRatioBadge = this.container.querySelector('#resRatioBadge');
    this.resRatioDetail = this.container.querySelector('#resRatioDetail');
    this.runningStatusBadge = this.container.querySelector('#logicRunningStatusBadge');

    // Playback bar elements
    this.btnLogicFirst = this.container.querySelector('#btnLogicFirst');
    this.btnLogicPrev = this.container.querySelector('#btnLogicPrev');
    this.btnLogicPlay = this.container.querySelector('#btnLogicPlay');
    this.btnLogicNext = this.container.querySelector('#btnLogicNext');
    this.btnLogicLast = this.container.querySelector('#btnLogicLast');
    this.btnLogicReset = this.container.querySelector('#btnLogicReset');
    this.logicStepSlider = this.container.querySelector('#logicStepSlider');
    this.logicStepCounter = this.container.querySelector('#logicStepCounter');
    this.logicSpeedSlider = this.container.querySelector('#logicSpeedSlider');
    this.logicSpeedText = this.container.querySelector('#logicSpeedText');

    this.btnCopyMarkdown = this.container.querySelector('#btnCopyMarkdown');
    this.btnCopyLatex = this.container.querySelector('#btnCopyLatex');

    // K-Map elements
    this.kmapScaleBadge = this.container.querySelector('#kmapScaleBadge');
    this.kmapMinimalSopText = this.container.querySelector('#kmapMinimalSopText');
    this.kmapGridContainer = this.container.querySelector('#kmapGridContainer');
    this.kmapLegendContainer = this.container.querySelector('#kmapLegendContainer');
    this.btnCopyMinimalSop = this.container.querySelector('#btnCopyMinimalSop');

    // Circuit elements
    this.circuitSvgContainer = this.container.querySelector('#circuitSvgContainer');

    // Equivalence elements
    this.inputEquiv1 = this.container.querySelector('#inputEquiv1');
    this.inputEquiv2 = this.container.querySelector('#inputEquiv2');
    this.btnSolveEquiv = this.container.querySelector('#btnSolveEquiv');
    this.btnGenEquivPractice = this.container.querySelector('#btnGenEquivPractice');
    this.equivResultSection = this.container.querySelector('#equivResultSection');
    this.equivBanner = this.container.querySelector('#equivBanner');
    this.tableEquivComparison = this.container.querySelector('#tableEquivComparison');

    // Normal forms elements
    this.inputNormal = this.container.querySelector('#inputLogicNormal');
    this.btnSolveNormal = this.container.querySelector('#btnSolveNormal');
    this.selNormalVars = this.container.querySelector('#selNormalVars');
    this.selNormalComplexity = this.container.querySelector('#selNormalComplexity');
    this.btnGenRandomNormal = this.container.querySelector('#btnGenRandomNormal');
    this.normalResultSection = this.container.querySelector('#normalResultSection');
    this.dnfFormulaBox = this.container.querySelector('#dnfFormulaBox');
    this.cnfFormulaBox = this.container.querySelector('#cnfFormulaBox');
    this.btnCopyDnf = this.container.querySelector('#btnCopyDnf');
    this.btnCopyCnf = this.container.querySelector('#btnCopyCnf');

    this.lastActiveInput = this.inputSingle;
  }

  _bindEvents() {
    // Mode tab switching
    this.tabBtnSingle.addEventListener('click', () => this.switchTab('single'));
    this.tabBtnEquiv.addEventListener('click', () => this.switchTab('equiv'));
    this.tabBtnNormal.addEventListener('click', () => this.switchTab('normal'));

    // Sub-tab switching
    this.subTabTable.addEventListener('click', () => this.switchSubTab('table'));
    this.subTabKMap.addEventListener('click', () => this.switchSubTab('kmap'));
    this.subTabCircuit.addEventListener('click', () => this.switchSubTab('circuit'));

    // Input focus tracking for virtual keyboard
    [this.inputSingle, this.inputEquiv1, this.inputEquiv2, this.inputNormal].forEach(input => {
      if (input) {
        input.addEventListener('focus', () => {
          this.lastActiveInput = input;
        });
      }
    });

    // Virtual keyboard button insertion
    this.container.querySelectorAll('.btn-key[data-insert]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const symbol = btn.getAttribute('data-insert');
        this.insertSymbol(symbol);
      });
    });

    // Value style switch (1/0, T/F, Đ/S)
    this.container.querySelectorAll('.btn-style-opt[data-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.btn-style-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.valueStyle = btn.getAttribute('data-style');
        if (this.activeTab === 'single') {
          this.solveSingle();
        } else if (this.activeTab === 'equiv') {
          this.solveEquiv();
        }
      });
    });

    // Presets dropdown
    this.presetSelect.addEventListener('change', () => {
      const presetId = this.presetSelect.value;
      if (!presetId) return;
      const preset = LOGIC_PRESETS.find(p => p.id === presetId);
      if (preset) {
        this.inputSingle.value = preset.expression;
        this.switchTab('single');
        this.solveSingle();
      }
    });

    // Curated Circuit & K-Map Preset quick buttons
    this.container.querySelectorAll('.btn-circuit-preset[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-preset');
        const preset = LOGIC_PRESETS.find(p => p.id === presetId);
        if (preset) {
          this.pause();
          this.inputSingle.value = preset.expression;
          this.presetSelect.value = presetId;
          this.container.querySelectorAll('.btn-circuit-preset').forEach(b => {
            b.style.borderColor = 'var(--line)';
            b.style.color = 'var(--text)';
            b.style.fontWeight = 'normal';
          });
          btn.style.borderColor = 'var(--accent)';
          btn.style.color = 'var(--accent)';
          btn.style.fontWeight = 'bold';
          this.solveSingle();
        }
      });
    });

    // Solve Single Table
    this.btnSolveSingle.addEventListener('click', () => {
      this.pause();
      this.solveSingle();
    });
    this.inputSingle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.pause();
        this.solveSingle();
      }
    });

    this.chkShowSteps.addEventListener('change', () => {
      this.showSteps = this.chkShowSteps.checked;
      this.solveSingle();
    });

    this.chkDescendingOrder.addEventListener('change', () => {
      this.descendingOrder = this.chkDescendingOrder.checked;
      this.solveSingle();
    });

    // Random generator in Single tab
    this.btnGenRandomSingle.addEventListener('click', () => {
      this.pause();
      const variableCount = parseInt(this.selRandomVars.value, 10) || 3;
      const type = this.selRandomType.value || 'random';
      const generated = generateRandomProposition({ variableCount, type });
      this.inputSingle.value = generated.expression;
      this.solveSingle();
    });

    // Playback Controls (Play, Pause, Step Next/Prev, Jump First/Last, Reset)
    this.btnLogicPlay.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        if (this.currentStep >= this.totalSteps) {
          this.setStep(0);
        }
        this.play();
      }
    });

    this.btnLogicFirst.addEventListener('click', () => {
      this.pause();
      this.setStep(0);
    });

    this.btnLogicPrev.addEventListener('click', () => {
      this.pause();
      if (this.currentStep > 0) {
        this.setStep(this.currentStep - 1);
      }
    });

    this.btnLogicNext.addEventListener('click', () => {
      this.pause();
      if (this.currentStep < this.totalSteps) {
        this.setStep(this.currentStep + 1);
      }
    });

    this.btnLogicLast.addEventListener('click', () => {
      this.pause();
      this.setStep(this.totalSteps);
    });

    this.btnLogicReset.addEventListener('click', () => {
      this.pause();
      this.setStep(0);
    });

    // Step Slider
    this.logicStepSlider.addEventListener('input', () => {
      this.pause();
      const step = parseInt(this.logicStepSlider.value, 10) || 0;
      this.setStep(step);
    });

    // Speed Slider
    this.logicSpeedSlider.addEventListener('input', () => {
      this.speed = parseFloat(this.logicSpeedSlider.value) || 1.0;
      this.logicSpeedText.textContent = `${this.speed.toFixed(2)}x`;
      if (this.isPlaying) {
        this._startTimer(); // Restart timer with new speed
      }
    });

    // Copy Minimal SOP
    if (this.btnCopyMinimalSop) {
      this.btnCopyMinimalSop.addEventListener('click', () => {
        navigator.clipboard.writeText(this.kmapMinimalSopText.textContent.trim()).then(() => {
          this._showToast('Đã sao chép công thức rút gọn tối tiểu (Minimal SOP)!');
        });
      });
    }

    // Equivalence tab
    this.btnSolveEquiv.addEventListener('click', () => this.solveEquiv());
    this.btnGenEquivPractice.addEventListener('click', () => {
      const pair = generateEquivalencePracticePair(2);
      this.inputEquiv1.value = pair.expr1;
      this.inputEquiv2.value = pair.expr2;
      this.solveEquiv();
    });

    // Normal forms tab
    this.btnSolveNormal.addEventListener('click', () => this.solveNormal());
    this.inputNormal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.solveNormal();
    });

    // Normal forms Random Generator
    this.btnGenRandomNormal.addEventListener('click', () => {
      const variableCount = parseInt(this.selNormalVars.value, 10) || 3;
      const complexity = this.selNormalComplexity.value || 'medium';
      const generated = generateRandomProposition({ variableCount, complexity });
      this.inputNormal.value = generated.expression;
      this.solveNormal();
    });

    // Copy DNF / CNF buttons
    if (this.btnCopyDnf) {
      this.btnCopyDnf.addEventListener('click', () => {
        navigator.clipboard.writeText(this.dnfFormulaBox.textContent.trim()).then(() => {
          this._showToast('Đã sao chép công thức DNF vào bộ nhớ đệm!');
        });
      });
    }
    if (this.btnCopyCnf) {
      this.btnCopyCnf.addEventListener('click', () => {
        navigator.clipboard.writeText(this.cnfFormulaBox.textContent.trim()).then(() => {
          this._showToast('Đã sao chép công thức CNF vào bộ nhớ đệm!');
        });
      });
    }

    // Copy Markdown & LaTeX
    this.btnCopyMarkdown.addEventListener('click', () => this.copyMarkdownTable());
    this.btnCopyLatex.addEventListener('click', () => this.copyLatexTable());

    // Horizontal Splitter & Collapse
    this._initSplitter();
  }

  insertSymbol(symbol) {
    const input = this.lastActiveInput || this.inputSingle;
    if (!input) return;

    input.focus();
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;

    input.value = val.substring(0, start) + symbol + val.substring(end);
    const newPos = start + symbol.length;
    input.setSelectionRange(newPos, newPos);
  }

  switchTab(tab) {
    this.pause();
    this.activeTab = tab;
    [this.tabBtnSingle, this.tabBtnEquiv, this.tabBtnNormal].forEach(btn => btn.classList.remove('active'));
    [this.paneSingle, this.paneEquiv, this.paneNormal].forEach(pane => pane.style.display = 'none');

    if (tab === 'equiv') {
      this.tabBtnEquiv.classList.add('active');
      this.paneEquiv.style.display = 'block';
      this.lastActiveInput = this.inputEquiv1;
      this.solveEquiv();
    } else if (tab === 'normal') {
      this.tabBtnNormal.classList.add('active');
      this.paneNormal.style.display = 'block';
      this.lastActiveInput = this.inputNormal;
      this.solveNormal();
    } else {
      this.tabBtnSingle.classList.add('active');
      this.paneSingle.style.display = 'block';
      this.lastActiveInput = this.inputSingle;
    }
  }

  switchSubTab(subtab) {
    this.activeSubTab = subtab;
    [this.subTabTable, this.subTabKMap, this.subTabCircuit].forEach(btn => btn.classList.remove('active'));
    [this.subPaneTable, this.subPaneKMap, this.subPaneCircuit].forEach(pane => pane.style.display = 'none');

    if (subtab === 'kmap') {
      this.subTabKMap.classList.add('active');
      this.subPaneKMap.style.display = 'block';
    } else if (subtab === 'circuit') {
      this.subTabCircuit.classList.add('active');
      this.subPaneCircuit.style.display = 'block';
    } else {
      this.subTabTable.classList.add('active');
      this.subPaneTable.style.display = 'block';
    }
  }

  setExpression(expr) {
    if (this.inputSingle && expr) {
      this.inputSingle.value = expr;
    }
    this.switchTab('single');
    this.solveSingle();
  }

  toggleCollapse(forceState = null) {
    if (forceState !== null) {
      this.isStatsCollapsed = Boolean(forceState);
    } else {
      this.isStatsCollapsed = !this.isStatsCollapsed;
    }

    if (!this.statCardsGrid) return;

    if (this.isStatsCollapsed) {
      this.statCardsGrid.style.display = 'none';
      if (this.splitterH) {
        this.splitterH.setAttribute('aria-expanded', 'false');
        this.splitterH.title = 'Kéo xuống hoặc nháy đúp để mở rộng thẻ thống kê';
      }
      if (this.tableTruthTableWrap) {
        this.tableTruthTableWrap.style.maxHeight = '720px';
      }
    } else {
      this.statCardsGrid.style.display = 'grid';
      if (this.upperStatsArea) {
        this.upperStatsArea.style.maxHeight = '';
      }
      if (this.splitterH) {
        this.splitterH.setAttribute('aria-expanded', 'true');
        this.splitterH.title = 'Kéo lên/xuống để chỉnh độ cao hoặc nháy đúp để thu gọn/mở rộng';
      }
      if (this.tableTruthTableWrap) {
        this.tableTruthTableWrap.style.maxHeight = '550px';
      }
    }
  }

  toggleConfigPanel(forceState = null) {
    this.toggleCollapse(forceState);
  }

  _initSplitter() {
    if (!this.splitterH || !this.upperStatsArea) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const deltaY = clientY - startY;

      if (this.isStatsCollapsed) {
        if (deltaY > 20) {
          this.toggleCollapse(false);
          startY = clientY;
          startHeight = this.upperStatsArea.offsetHeight || 160;
        }
        return;
      }

      const newHeight = startHeight + deltaY;
      if (newHeight < 80) {
        this.toggleCollapse(true);
        isDragging = false;
        this.splitterH.classList.remove('dragging');
        cleanupListeners();
        return;
      }

      const clampedHeight = Math.max(80, Math.min(500, newHeight));
      this.upperStatsArea.style.maxHeight = `${clampedHeight}px`;
      this.upperStatsArea.style.overflow = 'hidden';
    };

    const cleanupListeners = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
      if (document.body) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        this.splitterH.classList.remove('dragging');
        cleanupListeners();
      }
    };

    const startDrag = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isDragging = true;
      startY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startHeight = this.upperStatsArea.offsetHeight || 160;
      this.splitterH.classList.add('dragging');

      if (document.body) {
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove, { passive: true });
      document.addEventListener('touchend', onPointerUp);
    };

    this.splitterH.addEventListener('pointerdown', startDrag);
    this.splitterH.addEventListener('mousedown', startDrag);
    this.splitterH.addEventListener('touchstart', startDrag, { passive: true });

    // Double click on splitter bar to toggle collapse / expand
    this.splitterH.addEventListener('dblclick', () => {
      this.toggleCollapse();
    });

    // Keyboard navigation
    this.splitterH.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleCollapse();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.toggleCollapse(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.toggleCollapse(false);
      }
    });
  }

  _showError(msg) {
    if (this.errorBox) {
      this.errorBox.style.display = 'block';
      this.errorBox.textContent = `⚠️ Lỗi: ${msg}`;
    }
    if (this.singleResultSection) {
      this.singleResultSection.style.display = 'none';
    }
  }

  _hideError() {
    if (this.errorBox) {
      this.errorBox.style.display = 'none';
    }
  }

  solveSingle() {
    this._hideError();
    this.pause();

    const text = this.inputSingle.value.trim();
    if (!text) {
      this._showError('Vui lòng nhập biểu thức logic!');
      return;
    }

    try {
      const result = generateTruthTable(text, {
        descendingOrder: this.descendingOrder,
        valueStyle: this.valueStyle,
      });
      this.currentTableResult = result;
      this.totalSteps = result.rows.length;
      if (this.collapsedExprText) {
        this.collapsedExprText.textContent = text;
      }
      
      // Initialize table structure and start at step 0 (chưa chạy dòng nào)
      this._renderSingleResults(result);
      this.setStep(0);

      // Solve K-Map and Logic Circuit if variable count is between 2 and 4
      this._solveKMapAndCircuit(result);
    } catch (err) {
      this._showError(err.message || 'Cú pháp biểu thức không hợp lệ!');
    }
  }

  _solveKMapAndCircuit(result) {
    const numVars = result.variables.length;
    if (numVars < 2 || numVars > 4) {
      this.subTabKMap.style.display = 'none';
      this.subTabCircuit.style.display = 'none';
      return;
    }

    this.subTabKMap.style.display = 'inline-block';
    this.subTabCircuit.style.display = 'inline-block';

    try {
      const kmap = buildKMap(result);
      this.currentKMap = kmap;
      this._renderKMap(kmap);

      // Initialize default circuit inputs matching current assignment
      this.circuitAssignment = {};
      result.variables.forEach((v, idx) => {
        this.circuitAssignment[v] = idx === 0; // First variable true, others false
      });

      this._renderCircuit(result.variables, kmap.groupTerms);
    } catch {
      // Ignore K-Map errors if edge case
    }
  }

  _renderKMap(kmap) {
    this.kmapScaleBadge.textContent = `Lưới ${kmap.grid.length} × ${kmap.grid[0].length} (${kmap.numVars} biến)`;
    this.kmapMinimalSopText.textContent = kmap.minimalSop;

    const rowVarsText = kmap.rowVars.join('');
    const colVarsText = kmap.colVars.join('');

    // Build K-Map HTML table
    let tableHtml = `<table class="kmap-table" style="border-collapse:collapse;font-family:monospace;background:var(--panel-alt);border:2px solid var(--line);border-radius:6px;overflow:hidden;">`;

    // Header row
    tableHtml += `<thead><tr>`;
    tableHtml += `<th style="padding:10px 14px;background:var(--line);color:var(--accent);font-weight:700;border:1px solid var(--line);">${rowVarsText} \\ ${colVarsText}</th>`;
    kmap.colHeaders.forEach(colH => {
      tableHtml += `<th style="padding:10px 18px;background:var(--panel-alt);color:#38bdf8;font-weight:700;border:1px solid var(--line);">${colH}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    // Data rows
    kmap.grid.forEach((row, r) => {
      tableHtml += `<tr>`;
      tableHtml += `<th style="padding:10px 14px;background:var(--panel-alt);color:#f59e0b;font-weight:700;border:1px solid var(--line);">${kmap.rowHeaders[r]}</th>`;

      row.forEach(cell => {
        // Find which group covers this cell
        const coveringGroup = kmap.groups.find(g => g.cells.includes(cell.id));
        const hasGroup = Boolean(coveringGroup);
        const groupColor = coveringGroup ? coveringGroup.color : 'transparent';
        const cellVal = cell.value ? '1' : '0';

        const bg = cell.value
          ? (hasGroup ? `background:rgba(245,158,11,0.12);box-shadow:inset 0 0 0 2px ${groupColor};` : 'background:rgba(16,185,129,0.1);')
          : 'background:transparent;';

        tableHtml += `
          <td class="kmap-cell" style="${bg};position:relative;" title="${Object.entries(cell.assignment).map(([k, v]) => `${k}=${v ? 1 : 0}`).join(' ')}">
            <span style="font-size:16px;font-weight:700;color:${cell.value ? (hasGroup ? groupColor : '#34d399') : 'var(--dim)'};">${cellVal}</span>
            <span style="position:absolute;bottom:2px;right:4px;font-size:9px;color:var(--dim);">${cell.bitStr}</span>
          </td>
        `;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`;

    this.kmapGridContainer.innerHTML = tableHtml;

    // Build Legend
    if (kmap.groups.length === 0) {
      this.kmapLegendContainer.innerHTML = `<span style="font-size:12px;color:var(--dim);">Không có nhóm ô số 1 nào (Hàm nhận giá trị hằng 0).</span>`;
    } else {
      let legendHtml = `<span style="font-size:12px;color:var(--dim);font-weight:600;margin-right:8px;">Các nhóm đã khoanh:</span>`;
      kmap.groups.forEach((g, idx) => {
        legendHtml += `
          <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid ${g.color};font-size:12px;font-family:monospace;">
            <span style="width:10px;height:10px;border-radius:2px;background:${g.color};"></span>
            <strong>Nhóm ${idx + 1} (${g.cells.length} ô):</strong> ${g.term}
          </span>
        `;
      });
      this.kmapLegendContainer.innerHTML = legendHtml;
    }
  }

  _renderCircuit(variables, groupTerms) {
    const isTaut = Boolean(this.currentTableResult?.stats?.isTautology || groupTerms.includes('1') || groupTerms.includes('1 (Hằng đúng)'));
    const isContra = Boolean(this.currentTableResult?.stats?.isContradiction || groupTerms.length === 0 || groupTerms.includes('0') || groupTerms.includes('0 (Mâu thuẫn)'));

    const circuit = buildCircuitModel({
      variables,
      terms: groupTerms,
      expression: this.inputSingle ? this.inputSingle.value.trim() : '',
      assignment: this.circuitAssignment,
      outputLabel: 'y',
      isTautology: isTaut,
      isContradiction: isContra,
    });
    this.currentCircuit = circuit;

    this.circuitSvgContainer.innerHTML = circuit.svg;

    // Bind input toggle clicks inside the SVG
    this.circuitSvgContainer.querySelectorAll('.circuit-input-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const v = el.getAttribute('data-var');
        if (v) {
          this.circuitAssignment[v] = !this.circuitAssignment[v];
          this._renderCircuit(variables, groupTerms);
        }
      });
    });
  }

  _renderSingleResults(result) {
    const { variables, subexpressions, rows, stats } = result;

    // 1. Classification badge
    this.resClassificationBadge.textContent = stats.classification;
    this.resClassificationDetail.textContent = stats.classificationDetail;
    if (stats.isTautology) {
      this.resClassificationBadge.style.color = 'var(--green)';
    } else if (stats.isContradiction) {
      this.resClassificationBadge.style.color = 'var(--red)';
    } else {
      this.resClassificationBadge.style.color = 'var(--accent)';
    }

    // 2. Scale badge
    this.resScaleBadge.textContent = `${stats.totalVariables} biến • ${stats.totalRows} dòng (2^${stats.totalVariables})`;

    // 3. Ratio badge
    const percent = Math.round((stats.trueCount / stats.totalRows) * 100);
    this.resRatioBadge.textContent = `${stats.trueCount} Đúng / ${stats.falseCount} Sai`;
    this.resRatioDetail.textContent = `Tỷ lệ thỏa: ${percent}%`;

    // 4. Update slider maximum
    this.logicStepSlider.max = stats.totalRows;

    // 5. Build Table Structure
    const displaySubexprs = this.showSteps ? subexpressions : [];

    let theadHtml = '<thead><tr style="background:var(--panel-alt);border-bottom:2px solid var(--line);">';
    theadHtml += '<th style="padding:10px 8px;width:50px;color:var(--dim);">STT</th>';

    // Variable columns
    variables.forEach(v => {
      theadHtml += `<th style="padding:10px 12px;color:var(--accent);font-weight:700;font-family:monospace;border-right:1px solid var(--line);">${v}</th>`;
    });

    // Step columns
    displaySubexprs.forEach((sub, idx) => {
      const isFinal = idx === displaySubexprs.length - 1;
      if (!isFinal) {
        theadHtml += `<th style="padding:10px 12px;color:#94a3b8;font-family:monospace;border-right:1px solid var(--line);font-size:12px;">${sub}</th>`;
      }
    });

    // Final result column
    theadHtml += `<th style="padding:10px 16px;background:rgba(245,158,11,0.15);color:var(--accent);font-weight:700;font-family:monospace;border-left:2px solid var(--accent);">${result.canonicalText}</th>`;
    theadHtml += '</tr></thead>';

    let tbodyHtml = '<tbody>';
    rows.forEach(row => {
      tbodyHtml += `<tr data-row-idx="${row.rowIndex}" style="border-bottom:1px solid var(--line);transition:background 0.15s ease;">`;
      tbodyHtml += `<td style="padding:8px 6px;color:var(--dim);font-size:11px;">${row.rowIndex}</td>`;

      // Variables
      variables.forEach(v => {
        const val = row.assignment[v];
        tbodyHtml += `<td class="cell-val" data-type="var" data-raw="${val}" style="padding:8px 10px;border-right:1px solid var(--line);">${this._formatBadge(val)}</td>`;
      });

      // Steps
      if (this.showSteps) {
        row.stepValues.slice(0, row.stepValues.length - 1).forEach(stepVal => {
          tbodyHtml += `<td class="cell-val" data-type="step" data-raw="${stepVal}" style="padding:8px 10px;border-right:1px solid var(--line);">${this._formatBadge(stepVal)}</td>`;
        });
      }

      // Final cell
      tbodyHtml += `<td class="cell-val" data-type="final" data-raw="${row.finalValue}" style="padding:8px 14px;border-left:2px solid var(--accent);background:rgba(245,158,11,0.07);">${this._formatBadge(row.finalValue, true)}</td>`;
      tbodyHtml += '</tr>';
    });
    tbodyHtml += '</tbody>';

    this.tableTruthTable.innerHTML = theadHtml + tbodyHtml;
    this.singleResultSection.style.display = 'block';
  }

  setStep(step) {
    this.currentStep = Math.max(0, Math.min(this.totalSteps, step));

    // Update Slider & Counter
    this.logicStepSlider.value = this.currentStep;
    this.logicStepCounter.textContent = `${this.currentStep} / ${this.totalSteps}`;

    // Update button states
    this.btnLogicFirst.disabled = this.currentStep === 0;
    this.btnLogicPrev.disabled = this.currentStep === 0;
    this.btnLogicNext.disabled = this.currentStep === this.totalSteps;
    this.btnLogicLast.disabled = this.currentStep === this.totalSteps;

    // Update Table rows visibility and active highlight
    const trList = this.tableTruthTable.querySelectorAll('tbody tr');
    trList.forEach((tr, idx) => {
      const rowIdx = idx + 1;
      const isRevealed = rowIdx <= this.currentStep;
      const isActive = rowIdx === this.currentStep;

      tr.classList.toggle('logic-active-row', isActive);

      const cells = tr.querySelectorAll('.cell-val');
      cells.forEach(cell => {
        const rawBool = cell.getAttribute('data-raw') === 'true';
        const isFinal = cell.getAttribute('data-type') === 'final';

        if (isRevealed) {
          cell.innerHTML = this._formatBadge(rawBool, isFinal);
        } else {
          cell.innerHTML = '<span style="color:var(--dim);opacity:0.25;font-family:monospace;">·</span>';
        }
      });
    });

    // Auto-scroll active row into view
    if (this.currentStep > 0 && trList[this.currentStep - 1] && this.tableTruthTableWrap) {
      const activeTr = trList[this.currentStep - 1];
      const wrapRect = this.tableTruthTableWrap.getBoundingClientRect();
      const trRect = activeTr.getBoundingClientRect();
      if (trRect.bottom > wrapRect.bottom || trRect.top < wrapRect.top) {
        activeTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Update Running Status Badge & Progressive Stats
    if (!this.currentTableResult) return;
    const { rows, stats } = this.currentTableResult;

    if (this.currentStep === 0) {
      if (this.runningStatusBadge) {
        this.runningStatusBadge.textContent = 'Sẵn sàng chạy (0%)';
        this.runningStatusBadge.style.color = 'var(--dim)';
      }
      this.resClassificationBadge.textContent = 'Chưa xác định (Ẩn)';
      this.resClassificationBadge.style.color = 'var(--dim)';
      this.resClassificationDetail.textContent = 'Bấm "▶ Chạy" để khám phá bản chất mệnh đề...';
      this.resRatioBadge.textContent = `0 / ${this.totalSteps} dòng đã duyệt`;
      this.resRatioDetail.textContent = 'Bấm "▶ Chạy" để bắt đầu';
    } else if (this.currentStep < this.totalSteps) {
      const evaluatedRows = rows.slice(0, this.currentStep);
      const evalTrue = evaluatedRows.filter(r => r.finalValue).length;
      const evalFalse = this.currentStep - evalTrue;
      const pct = Math.round((this.currentStep / this.totalSteps) * 100);

      if (this.runningStatusBadge) {
        this.runningStatusBadge.textContent = `Đang đánh giá dòng ${this.currentStep}/${this.totalSteps} (${pct}%)`;
        this.runningStatusBadge.style.color = 'var(--accent)';
      }
      this.resClassificationBadge.textContent = `Đang giải mã... (${pct}%)`;
      this.resClassificationBadge.style.color = 'var(--accent)';
      this.resClassificationDetail.textContent = `Dòng ${this.currentStep}: ${Object.entries(rows[this.currentStep - 1].assignment).map(([k,v]) => `${k}=${formatTruthValue(v, this.valueStyle)}`).join(', ')} → Kết quả: ${formatTruthValue(rows[this.currentStep - 1].finalValue, this.valueStyle)}`;
      this.resRatioBadge.textContent = `${evalTrue} Đúng / ${evalFalse} Sai`;
      this.resRatioDetail.textContent = `Tiến độ: ${pct}% (${this.currentStep}/${this.totalSteps} dòng)`;
    } else {
      if (this.runningStatusBadge) {
        this.runningStatusBadge.textContent = '✓ Hoàn tất 100%';
        this.runningStatusBadge.style.color = 'var(--green)';
      }
      this.resClassificationBadge.textContent = stats.classification;
      if (stats.isTautology) {
        this.resClassificationBadge.style.color = 'var(--green)';
      } else if (stats.isContradiction) {
        this.resClassificationBadge.style.color = 'var(--red)';
      } else {
        this.resClassificationBadge.style.color = 'var(--accent)';
      }
      this.resClassificationDetail.textContent = stats.classificationDetail;
      this.resRatioBadge.textContent = `${stats.trueCount} Đúng / ${stats.falseCount} Sai`;
      this.resRatioDetail.textContent = `Tỷ lệ thỏa: ${Math.round((stats.trueCount / stats.totalRows) * 100)}%`;
    }
  }

  play() {
    this.isPlaying = true;
    this.btnLogicPlay.textContent = '⏸ Dừng';
    this.btnLogicPlay.classList.add('btn-active-playing');
    this._startTimer();
  }

  pause() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.btnLogicPlay) {
      this.btnLogicPlay.textContent = '▶ Chạy';
      this.btnLogicPlay.classList.remove('btn-active-playing');
    }
  }

  _startTimer() {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
    // Calculate interval based on speed: 1.0x = 600ms, 2.0x = 300ms, 0.25x = 2400ms
    const interval = Math.max(80, Math.round(600 / this.speed));
    this.playbackTimer = setInterval(() => {
      if (this.currentStep < this.totalSteps) {
        this.setStep(this.currentStep + 1);
      } else {
        this.pause();
      }
    }, interval);
  }

  _formatBadge(boolVal, isFinal = false) {
    const text = formatTruthValue(boolVal, this.valueStyle);
    if (boolVal) {
      return `<span class="badge-true" style="display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(16,185,129,0.2);color:#34d399;font-weight:${isFinal ? '700' : '600'};font-family:monospace;font-size:${isFinal ? '13px' : '12px'};">${text}</span>`;
    }
    return `<span class="badge-false" style="display:inline-block;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.2);color:#f87171;font-weight:${isFinal ? '700' : '600'};font-family:monospace;font-size:${isFinal ? '13px' : '12px'};">${text}</span>`;
  }

  solveEquiv() {
    const e1 = this.inputEquiv1.value.trim();
    const e2 = this.inputEquiv2.value.trim();
    if (!e1 || !e2) return;

    try {
      const res = checkEquivalence(e1, e2);
      this.currentEquivResult = res;

      if (res.isEquivalent) {
        this.equivBanner.style.background = 'rgba(16,185,129,0.15)';
        this.equivBanner.style.border = '1px solid #10b981';
        this.equivBanner.style.color = '#34d399';
        this.equivBanner.innerHTML = `
          <div style="font-size:24px;">✅</div>
          <div>
            <strong>HAI BIỂU THỨC TƯƠNG ĐƯƠNG LOGIC (E₁ ≡ E₂)</strong>
            <div style="font-size:12.5px;color:var(--text);margin-top:2px;">Chân trị của E₁ và E₂ hoàn toàn trùng khớp ở tất cả các trường hợp (${res.totalRows} dòng).</div>
          </div>
        `;
      } else {
        const ce = res.counterexample;
        const ceVars = Object.entries(ce.assignment).map(([k, v]) => `${k} = ${formatTruthValue(v, this.valueStyle)}`).join(', ');
        this.equivBanner.style.background = 'rgba(239,68,68,0.15)';
        this.equivBanner.style.border = '1px solid #ef4444';
        this.equivBanner.style.color = '#fca5a5';
        this.equivBanner.innerHTML = `
          <div style="font-size:24px;">❌</div>
          <div>
            <strong>HAI BIỂU THỨC KHÔNG TƯƠNG ĐƯƠNG (E₁ ≢ E₂)</strong>
            <div style="font-size:12.5px;color:var(--text);margin-top:2px;">
              Phát hiện phản ví dụ tại dòng <strong>${ce.rowIndex}</strong>: Khi <code>${ceVars}</code> thì E₁ = <strong>${formatTruthValue(ce.val1, this.valueStyle)}</strong> nhưng E₂ = <strong>${formatTruthValue(ce.val2, this.valueStyle)}</strong>.
            </div>
          </div>
        `;
      }

      // Comparison table
      let thead = '<thead><tr style="background:var(--panel-alt);border-bottom:2px solid var(--line);">';
      thead += '<th style="padding:10px 8px;width:50px;">STT</th>';
      res.variables.forEach(v => {
        thead += `<th style="padding:10px 12px;color:var(--accent);font-family:monospace;">${v}</th>`;
      });
      thead += `<th style="padding:10px 14px;color:#38bdf8;font-family:monospace;">E₁: ${res.expr1}</th>`;
      thead += `<th style="padding:10px 14px;color:#f59e0b;font-family:monospace;">E₂: ${res.expr2}</th>`;
      thead += '<th style="padding:10px 12px;color:var(--dim);">Đối chiếu</th>';
      thead += '</tr></thead>';

      let tbody = '<tbody>';
      res.rows.forEach(r => {
        const rowBg = r.matches ? '' : 'background:rgba(239,68,68,0.12);';
        tbody += `<tr style="border-bottom:1px solid var(--line);${rowBg}">`;
        tbody += `<td style="padding:8px 6px;color:var(--dim);">${r.rowIndex}</td>`;
        res.variables.forEach(v => {
          tbody += `<td style="padding:8px 10px;">${this._formatBadge(r.assignment[v])}</td>`;
        });
        tbody += `<td style="padding:8px 12px;">${this._formatBadge(r.val1)}</td>`;
        tbody += `<td style="padding:8px 12px;">${this._formatBadge(r.val2)}</td>`;
        tbody += `<td style="padding:8px 10px;">${r.matches ? '✓ Khớp' : '⚠️ Sai lệch'}</td>`;
        tbody += '</tr>';
      });
      tbody += '</tbody>';

      this.tableEquivComparison.innerHTML = thead + tbody;
      this.equivResultSection.style.display = 'block';
    } catch (err) {
      alert(`Lỗi cú pháp: ${err.message}`);
    }
  }

  solveNormal() {
    const text = this.inputNormal.value.trim();
    if (!text) return;

    try {
      const res = generateTruthTable(text);
      this.dnfFormulaBox.textContent = res.normalForms.dnf;
      this.cnfFormulaBox.textContent = res.normalForms.cnf;
      this.normalResultSection.style.display = 'block';
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    }
  }

  copyMarkdownTable() {
    if (!this.currentTableResult) return;
    const { variables, subexpressions, rows, canonicalText } = this.currentTableResult;
    const displaySub = this.showSteps ? subexpressions : [];

    const headers = ['STT', ...variables, ...displaySub.slice(0, -1), canonicalText];
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    rows.forEach(r => {
      const lineVals = [
        r.rowIndex,
        ...variables.map(v => formatTruthValue(r.assignment[v], this.valueStyle)),
      ];
      if (this.showSteps) {
        lineVals.push(...r.stepValues.slice(0, -1).map(v => formatTruthValue(v, this.valueStyle)));
      }
      lineVals.push(formatTruthValue(r.finalValue, this.valueStyle));
      md += '| ' + lineVals.join(' | ') + ' |\n';
    });

    navigator.clipboard.writeText(md).then(() => {
      this._showToast('Đã sao chép bảng chân trị dạng Markdown vào bộ nhớ đệm!');
    });
  }

  copyLatexTable() {
    if (!this.currentTableResult) return;
    const { variables, subexpressions, rows, canonicalText } = this.currentTableResult;
    const displaySub = this.showSteps ? subexpressions : [];

    const cols = ['c', ...variables.map(() => 'c')];
    if (this.showSteps) {
      displaySub.slice(0, -1).forEach(() => cols.push('c'));
    }
    cols.push('c');

    let latex = `\\begin{array}{${cols.join('|')}}\n`;
    const headers = ['STT', ...variables, ...displaySub.slice(0, -1), canonicalText];
    latex += headers.join(' & ') + ' \\\\\n\\hline\n';

    rows.forEach(r => {
      const lineVals = [
        r.rowIndex,
        ...variables.map(v => formatTruthValue(r.assignment[v], this.valueStyle)),
      ];
      if (this.showSteps) {
        lineVals.push(...r.stepValues.slice(0, -1).map(v => formatTruthValue(v, this.valueStyle)));
      }
      lineVals.push(formatTruthValue(r.finalValue, this.valueStyle));
      latex += lineVals.join(' & ') + ' \\\\\n';
    });

    latex += '\\end{array}';

    navigator.clipboard.writeText(latex).then(() => {
      this._showToast('Đã sao chép mã LaTeX vào bộ nhớ đệm!');
    });
  }

  _showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #fff;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 99999;
      animation: fadeIn 0.2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  destroy() {
    this.pause();
  }

  mount(container) {
    this.render(container);
  }
}
