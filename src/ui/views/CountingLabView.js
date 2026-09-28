/**
 * @file CountingLabView.js
 * Chapter 3: Combinatorics & Counting Methods Laboratory (Phòng thí nghiệm Phương pháp đếm)
 * 
 * Fully Implemented 4 Pillars of Chapter 3:
 * - Tab 1: Studio Ánh Xạ & Hàm Số (Mapping Studio)
 *   - Interactive 2-set visual diagram (Domain X & Codomain Y)
 *   - Directed arrows connect/disconnect on click & hover
 *   - Real-time mathematical verification (Function, Injective, Surjective, Bijective, Inverse f⁻¹)
 *   - Combinatorial counts (|Y|^|X|, A_n^m, Stirling/Inclusion-exclusion surjective count, n!)
 *   - Educational presets & random mapping generators
 * - Tab 2: Phòng thí nghiệm Nguyên lý Dirichlet (Dirichlet Studio)
 *   - Interactive Pigeonhole Arena with customizable N items and k boxes
 *   - Distribution strategies (Even anti-collision, Monte Carlo random, Manual)
 *   - Dynamic cage visualization with pigeon icons & max-box highlights
 *   - Real-time bounds (N > k, ceil(N/k), floor(N/k)) & proof by contradiction
 *   - Classic applied problem solvers (Birthdays, Socks in dark, Exam scores, Sum of pairs, Erdős–Szekeres)
 * - Tab 3: Tam giác Pascal & Đại số Tổ hợp (Pascal & Combinatorics Studio)
 *   - Interactive Pascal Triangle with dynamic row count (n = 3 to 12)
 *   - Cell Inspector: C(n, k), parent cells C(n-1, k-1) + C(n-1, k), symmetric pair C(n, n-k)
 *   - Row sum identity sum = 2^n
 *   - Modulo coloring: Sierpinski Fractal mod 2 (odd vs even), mod 3, mod 5
 *   - Lexicographical Combinatorial Generators (P_n, A_n^k, C_n^k, n^k, Stars & Bars)
 * - Tab 4: Bộ giải Hệ thức truy hồi & Tháp Hà Nội (Recurrence & Tower of Hanoi Studio)
 *   - Linear recurrence relations solver for Order 1 (a_n = c*a_{n-1}) and Order 2 (a_n = c_1*a_{n-1} + c_2*a_{n-2})
 *   - Characteristic equation, Delta, roots classification (distinct real, double, complex)
 *   - Closed-form formula derivation and table of sequence terms
 *   - Classic presets: Fibonacci, Lucas, Double-root, Distinct real roots
 *   - Interactive Tower of Hanoi puzzle simulator with animated playback, step controls, and recursive formula T_n = 2^n - 1
 */

import {
  evaluateMapping,
  generateRandomMapping,
  MAPPING_PRESETS,
} from '../../core/counting/MappingEngine.js';

import {
  calculateDirichletBounds,
  distributeEvenly,
  distributeRandomly,
  evaluateDirichlet,
  solveDirichletScenario,
} from '../../core/counting/DirichletEngine.js';

import {
  buildPascalTriangle,
  getPascalCellInfo,
  calculateCombinatoricsCounts,
  generateNextPermutation,
  generateAllPermutations,
  generateNextCombination,
  generateAllCombinations,
  generateAllArrangements,
  generateAllArrangementsWithRepetition,
  generateAllCombinationsWithRepetition,
} from '../../core/counting/CombinatoricsEngine.js';

import {
  solveOrder1Linear,
  solveOrder2Homogeneous,
  RECURRENCE_PRESETS,
  generateHanoiMoves,
  getHanoiStateAtStep,
} from '../../core/counting/RecurrenceEngine.js';

export class CountingLabView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   */
  constructor({ container = null } = {}) {
    this.container = container;
    this.activeTab = 'mapping'; // 'mapping' | 'dirichlet' | 'pascal' | 'recurrence'

    // Tab 1: Mapping Studio state
    this.domain = ['x₁', 'x₂', 'x₃'];
    this.codomain = ['y₁', 'y₂', 'y₃'];
    this.edges = [
      { from: 'x₁', to: 'y₂' },
      { from: 'x₂', to: 'y₁' },
      { from: 'x₃', to: 'y₃' },
    ];
    this.selectedSource = null;
    this.isInverseActive = false;
    this.hoveredEdge = null;
    this.activePresetId = 'bijective_33';

    // Tab 2: Dirichlet Studio state
    this.dirichletSubTab = 'arena'; // 'arena' | 'problems'
    this.dirichletN = 14;
    this.dirichletK = 4;
    this.boxAllocations = distributeEvenly(14, 4);
    this.showProof = false;
    this.selectedScenario = 'birthday';
    this.scenarioParams = {
      birthday: { period: 'month', targetSame: 3, givenPeople: 30 },
      socks: { colors: 3, targetMatch: 2 },
      exam_scores: { minScore: 0, maxScore: 10, targetSame: 4, classSize: 45 },
      sum_pairs: { n: 5 },
      erdos_szekeres: { n: 3 },
    };

    // Tab 3: Pascal & Combinatorics Studio state
    this.pascalSubTab = 'triangle'; // 'triangle' | 'generators'
    this.pascalRows = 7;
    this.pascalSelectedCell = { n: 4, k: 2 };
    this.pascalModColor = 'none';

    // Combinatorics Generator state
    this.generatorType = 'combination';
    this.generatorItemsStr = 'A, B, C, D';
    this.generatorK = 2;
    this.generatorResults = generateAllCombinations(['A', 'B', 'C', 'D'], 2);
    this.generatorCurrentStep = 0;

    // Tab 4: Recurrence & Hanoi Studio state
    this.recurrenceSubTab = 'solver'; // 'solver' | 'hanoi'
    this.recurrenceOrder = 2; // 1 | 2
    this.recurrenceC1 = 1;
    this.recurrenceC2 = 1;
    this.recurrenceA0 = 0;
    this.recurrenceA1 = 1;
    this.recurrencePresetId = 'fibonacci';
    this.recurrenceNumTerms = 12;

    // Hanoi Simulator state
    this.hanoiN = 3;
    this.hanoiStep = 0;
    this.hanoiIsPlaying = false;
    this.hanoiTimer = null;
    this.hanoiSpeed = 800; // ms per step

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
      <div class="counting-lab-container" style="max-width:1300px;margin:0 auto;padding:16px 24px 60px;">

        <!-- Main Tab Navigation -->
        <div class="counting-tabs-bar" style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
          <button type="button" class="btn-tab ${this.activeTab === 'mapping' ? 'active' : ''}" data-tab="mapping" id="tabBtnMapping" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            🎯 Studio Ánh Xạ & Hàm Số
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'dirichlet' ? 'active' : ''}" data-tab="dirichlet" id="tabBtnDirichlet" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            🕊️ Nguyên lý Dirichlet (Chuồng bồ câu)
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'pascal' ? 'active' : ''}" data-tab="pascal" id="tabBtnPascal" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            📐 Tam giác Pascal & Đại số Tổ hợp
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'recurrence' ? 'active' : ''}" data-tab="recurrence" id="tabBtnRecurrence" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
            ⏳ Hệ thức truy hồi & Tháp Hà Nội
          </button>
        </div>

        <!-- Tab 1: Mapping Studio -->
        <div id="paneMapping" style="display:${this.activeTab === 'mapping' ? 'block' : 'none'};">
          ${this._renderMappingStudio()}
        </div>

        <!-- Tab 2: Dirichlet Studio -->
        <div id="paneDirichlet" style="display:${this.activeTab === 'dirichlet' ? 'block' : 'none'};">
          ${this._renderDirichletStudio()}
        </div>

        <!-- Tab 3: Pascal & Combinatorics Studio -->
        <div id="panePascal" style="display:${this.activeTab === 'pascal' ? 'block' : 'none'};">
          ${this._renderPascalStudio()}
        </div>

        <!-- Tab 4: Recurrence & Tower of Hanoi Studio -->
        <div id="paneRecurrence" style="display:${this.activeTab === 'recurrence' ? 'block' : 'none'};">
          ${this._renderRecurrenceStudio()}
        </div>

      </div>
    `;

    this._bindEvents();
  }

  // =========================================================================
  // TAB 1: MAPPING STUDIO
  // =========================================================================

  _renderMappingStudio() {
    const evalResult = evaluateMapping({
      domain: this.domain,
      codomain: this.codomain,
      edges: this.edges,
    });

    const isBijective = evalResult.isBijective;
    if (!isBijective && this.isInverseActive) {
      this.isInverseActive = false;
    }

    return `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;">Mẫu giáo khoa:</span>
            <select id="selMappingPreset" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);padding:6px 12px;border-radius:6px;font-size:13px;cursor:pointer;">
              <option value="custom">✏️ Tuỳ chỉnh tự do</option>
              ${MAPPING_PRESETS.map(p => `
                <option value="${p.id}" ${this.activePresetId === p.id ? 'selected' : ''}>${p.title}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-sm" id="btnGenRandom" title="Sinh ánh xạ ngẫu nhiên hợp lệ">🎲 Sinh ngẫu nhiên</button>
            <button type="button" class="btn-sm" id="btnGenInjective" title="Sinh đơn ánh ngẫu nhiên" ${this.domain.length > this.codomain.length ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>🎯 Sinh Đơn ánh</button>
            <button type="button" class="btn-sm" id="btnGenSurjective" title="Sinh toàn ánh ngẫu nhiên" ${this.domain.length < this.codomain.length ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>🌐 Sinh Toàn ánh</button>
            <button type="button" class="btn-sm" id="btnGenBijective" title="Sinh song ánh ngẫu nhiên" ${this.domain.length !== this.codomain.length ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>👑 Sinh Song ánh</button>
            <button type="button" class="btn-sm" id="btnToggleInverse" style="background:${this.isInverseActive ? 'var(--accent2)' : 'var(--panel-alt)'};color:${this.isInverseActive ? '#fff' : 'var(--text)'};border:1px solid ${this.isInverseActive ? 'var(--accent2)' : 'var(--line)'};font-weight:600;" ${!isBijective ? 'disabled title="Chỉ khả dụng khi ánh xạ là SONG ÁNH!" style="opacity:0.4;cursor:not-allowed;"' : ''}>🔄 ${this.isInverseActive ? 'Đang bật f⁻¹' : 'Xem hàm ngược f⁻¹'}</button>
            <button type="button" class="btn-sm" id="btnClearEdges" title="Xóa tất cả các đường nối">🧹 Xóa mũi tên</button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;margin-bottom:16px;">
        <div class="card" style="background:var(--panel);border:1px solid ${evalResult.isFunction ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">1. Tính chất Ánh xạ (Hàm số)</span>
            <span style="font-size:11.5px;padding:3px 10px;border-radius:12px;font-weight:800;background:${evalResult.isFunction ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${evalResult.isFunction ? 'var(--accent2)' : 'var(--red)'};">${evalResult.isFunction ? '✅ HỢP LỆ' : '❌ VI PHẠM'}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${evalResult.isFunction ? 'Mọi x ∈ X đều được gán đúng 1 ảnh y ∈ Y duy nhất (∀x, ∃!y).' : evalResult.functionViolations[0] || 'Vi phạm định nghĩa ánh xạ.'}</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid ${evalResult.isInjective ? 'rgba(16,185,129,0.4)' : (evalResult.isFunction ? 'rgba(245,158,11,0.4)' : 'var(--line)')};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">2. Đơn ánh (Injective)</span>
            <span style="font-size:11.5px;padding:3px 10px;border-radius:12px;font-weight:800;background:${evalResult.isInjective ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${evalResult.isInjective ? 'var(--accent2)' : 'var(--accent)'};">${evalResult.isInjective ? '✅ ĐƠN ÁNH' : 'KHÔNG ĐƠN ÁNH'}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${evalResult.isInjective ? 'Không có 2 phần tử nguồn nào có cùng ảnh (x₁ ≠ x₂ ⇒ f(x₁) ≠ f(x₂)).' : (evalResult.injectiveViolations[0] || 'Tồn tại phần tử đích nhận nhiều hơn 1 tạo ảnh.')}</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid ${evalResult.isSurjective ? 'rgba(16,185,129,0.4)' : (evalResult.isFunction ? 'rgba(245,158,11,0.4)' : 'var(--line)')};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">3. Toàn ánh (Surjective)</span>
            <span style="font-size:11.5px;padding:3px 10px;border-radius:12px;font-weight:800;background:${evalResult.isSurjective ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${evalResult.isSurjective ? 'var(--accent2)' : 'var(--accent)'};">${evalResult.isSurjective ? '✅ TOÀN ÁNH' : 'KHÔNG TOÀN ÁNH'}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${evalResult.isSurjective ? 'Mọi phần tử đích y ∈ Y đều có ít nhất 1 tạo ảnh (Im(f) = Y).' : (evalResult.surjectiveViolations[0] || 'Còn phần tử ở tập đích chưa được phủ kín.')}</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid ${evalResult.isBijective ? 'rgba(168,85,247,0.5)' : 'var(--line)'};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">4. Song ánh (Bijective)</span>
            <span style="font-size:11.5px;padding:3px 10px;border-radius:12px;font-weight:800;background:${evalResult.isBijective ? 'rgba(168,85,247,0.2)' : 'var(--panel-alt)'};color:${evalResult.isBijective ? '#c084fc' : 'var(--dim)'};">${evalResult.isBijective ? '👑 SONG ÁNH' : 'KHÔNG SONG ÁNH'}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${evalResult.isBijective ? 'Vừa đơn ánh vừa toàn ánh. Tồn tại ánh xạ ngược f⁻¹ : Y → X.' : 'Yêu cầu hàm số phải vừa là Đơn ánh vừa là Toàn ánh.'}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 340px;gap:18px;margin-bottom:18px;">
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:0 8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:13.5px;color:var(--blue-light);">Tập nguồn X (|X| = ${this.domain.length})</span>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn-sm" id="btnAddDomain" style="padding:3px 8px;font-size:12px;" ${this.domain.length >= 6 ? 'disabled style="opacity:0.4;"' : ''}>+ x</button>
                <button type="button" class="btn-sm" id="btnRemoveDomain" style="padding:3px 8px;font-size:12px;" ${this.domain.length <= 1 ? 'disabled style="opacity:0.4;"' : ''}>- x</button>
              </div>
            </div>

            <div style="font-size:13px;font-weight:600;color:var(--dim);display:flex;align-items:center;gap:6px;">
              ${this.isInverseActive ? '<span style="color:var(--accent2);font-weight:700;">Ánh xạ ngược f⁻¹ : Y → X</span>' : '<span>Ánh xạ f : X → Y</span>'}
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:13.5px;color:#c084fc;">Tập đích Y (|Y| = ${this.codomain.length})</span>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn-sm" id="btnAddCodomain" style="padding:2px 7px;font-size:11px;" ${this.codomain.length >= 6 ? 'disabled style="opacity:0.4;"' : ''}>+ y</button>
                <button type="button" class="btn-sm" id="btnRemoveCodomain" style="padding:2px 7px;font-size:11px;" ${this.codomain.length <= 1 ? 'disabled style="opacity:0.4;"' : ''}>- y</button>
              </div>
            </div>
          </div>

          <div style="background:var(--panel-alt);border:1px dashed var(--line);border-radius:6px;padding:6px 12px;margin-bottom:12px;font-size:12px;color:var(--dim);display:flex;align-items:center;justify-content:space-between;">
            <div>💡 <b>Hướng dẫn tương tác:</b> ${this.selectedSource ? `<span style="color:var(--blue-light);font-weight:700;">Đang chọn "${this.selectedSource}"</span>. Hãy nhấp vào một phần tử ở tập Y để tạo mũi tên nối!` : 'Nhấp chọn một phần tử ở tập X, sau đó nhấp vào phần tử ở tập Y để nối mũi tên. Nhấp vào mũi tên để xoá.'}</div>
            ${this.selectedSource ? `<button type="button" class="btn-sm" id="btnCancelSelection" style="padding:2px 8px;font-size:11px;">Hủy chọn</button>` : ''}
          </div>

          <div class="mapping-svg-wrapper" style="width:100%;height:380px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;position:relative;overflow:hidden;">
            ${this._generateSvgDiagram(evalResult)}
          </div>

          <div style="margin-top:14px;">
            <div style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:6px;">Danh sách cặp quan hệ ánh xạ G_f:</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:80px;overflow-y:auto;">
              ${this.edges.length === 0 ? '<span style="font-size:12px;color:var(--dim);font-style:italic;">Chưa có mũi tên nào. Nhấp các nút trên sơ đồ để tạo nối.</span>' : ''}
              ${this.edges.map((e, idx) => `
                <span class="edge-chip" data-edge-idx="${idx}" style="display:inline-flex;align-items:center;gap:6px;background:var(--panel-alt);border:1px solid var(--line);padding:3px 8px;border-radius:6px;font-size:12px;font-family:monospace;">
                  <span>${e.from} → ${e.to}</span>
                  <button type="button" class="btn-remove-edge" data-edge-idx="${idx}" style="background:none;border:none;color:var(--dim);cursor:pointer;font-weight:bold;padding:0 2px;line-height:1;" title="Xóa liên kết này">×</button>
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--text);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>🧮</span> Công thức Đếm Lý thuyết
            </h4>
            <div style="font-size:12.5px;color:var(--dim);display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px dashed var(--line);">
                <span>Tổng số hàm số (|Y|<sup>|X|</sup> = ${this.codomain.length}<sup>${this.domain.length}</sup>):</span>
                <b style="color:var(--text);">${evalResult.combinatorics.totalFunctions.toLocaleString()}</b>
              </div>
              <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px dashed var(--line);">
                <span>Số đơn ánh (A<sub>|Y|</sub><sup>|X|</sup>):</span>
                <b style="color:${evalResult.combinatorics.totalInjective > 0 ? 'var(--blue-light)' : 'var(--dim)'};">${evalResult.combinatorics.totalInjective.toLocaleString()}</b>
              </div>
              <div style="display:flex;justify-content:space-between;padding-bottom:4px;border-bottom:1px dashed var(--line);">
                <span>Số toàn ánh (Công thức bù trừ):</span>
                <b style="color:${evalResult.combinatorics.totalSurjective > 0 ? 'var(--accent)' : 'var(--dim)'};">${evalResult.combinatorics.totalSurjective.toLocaleString()}</b>
              </div>
              <div style="display:flex;justify-content:space-between;padding-bottom:4px;">
                <span>Số song ánh (|X|! nếu |X|=|Y|):</span>
                <b style="color:${evalResult.combinatorics.totalBijective > 0 ? '#c084fc' : 'var(--dim)'};">${evalResult.combinatorics.totalBijective.toLocaleString()}</b>
              </div>
            </div>
          </div>

          <div style="background:var(--panel);border:1px solid ${this.domain.length > this.codomain.length ? 'rgba(245,158,11,0.5)' : 'var(--line)'};border-radius:10px;padding:14px;">
            <h4 style="font-size:13.5px;font-weight:700;color:${this.domain.length > this.codomain.length ? 'var(--accent)' : 'var(--text)'};margin:0 0 8px 0;display:flex;align-items:center;gap:6px;">
              <span>🕊️</span> Nhận định Dirichlet
            </h4>
            <p style="font-size:12px;color:var(--dim);line-height:1.5;margin:0;">${evalResult.combinatorics.dirichletNote}</p>
          </div>

          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;flex-grow:1;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--text);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>📝</span> Ký hiệu Toán học Hình thức
            </h4>
            <div style="font-size:12px;line-height:1.6;color:var(--dim);display:flex;flex-direction:column;gap:6px;">
              <div>• <b>Tập nguồn:</b> X = { ${this.domain.join(', ')} }</div>
              <div>• <b>Tập đích:</b> Y = { ${this.codomain.join(', ')} }</div>
              <div>• <b>Tập ảnh:</b> Im(f) = { ${evalResult.imageSet.length > 0 ? evalResult.imageSet.join(', ') : '∅'} }</div>
              <div>• <b>Đồ thị hàm:</b> G<sub>f</sub> = { ${this.edges.map(e => `(${e.from}, ${e.to})`).join(', ') || '∅'} }</div>
              ${evalResult.isBijective ? `
                <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--line);color:var(--accent2);">
                  • <b>Hàm ngược f⁻¹:</b> Y → X<br>
                  f⁻¹ = { ${this.edges.map(e => `(${e.to}, ${e.from})`).join(', ')} }
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _generateSvgDiagram(evalResult) {
    const width = 760;
    const height = 380;
    const domainCenterX = 170;
    const codomainCenterX = 590;
    const capsuleWidth = 140;
    const capsuleHeight = 310;
    const capsuleY = 40;

    const m = this.domain.length;
    const n = this.codomain.length;

    const domainSpacing = capsuleHeight / (m + 1);
    const domainPositions = {};
    this.domain.forEach((x, i) => {
      domainPositions[x] = { cx: domainCenterX, cy: capsuleY + domainSpacing * (i + 1) };
    });

    const codomainSpacing = capsuleHeight / (n + 1);
    const codomainPositions = {};
    this.codomain.forEach((y, i) => {
      codomainPositions[y] = { cx: codomainCenterX, cy: capsuleY + codomainSpacing * (i + 1) };
    });

    const svgDefs = `
      <defs>
        <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <polygon points="0 1, 9 4.5, 0 8" fill="#38bdf8" />
        </marker>
        <marker id="arrowhead-inverse" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <polygon points="0 1, 9 4.5, 0 8" fill="#10b981" />
        </marker>
        <marker id="arrowhead-hover" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <polygon points="0 1, 9 4.5, 0 8" fill="#f59e0b" />
        </marker>
      </defs>
    `;

    const setCapsules = `
      <rect x="${domainCenterX - capsuleWidth / 2}" y="${capsuleY}" width="${capsuleWidth}" height="${capsuleHeight}" rx="70" ry="70" 
            fill="rgba(56, 189, 248, 0.04)" stroke="rgba(56, 189, 248, 0.25)" stroke-width="2" stroke-dasharray="4 4" />
      <text x="${domainCenterX}" y="${capsuleY - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#38bdf8">Tập nguồn X (|X| = ${m})</text>

      <rect x="${codomainCenterX - capsuleWidth / 2}" y="${capsuleY}" width="${capsuleWidth}" height="${capsuleHeight}" rx="70" ry="70" 
            fill="rgba(192, 132, 252, 0.04)" stroke="rgba(192, 132, 252, 0.25)" stroke-width="2" stroke-dasharray="4 4" />
      <text x="${codomainCenterX}" y="${capsuleY - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#c084fc">Tập đích Y (|Y| = ${n})</text>
    `;

    const arrowPaths = this.edges.map((edge, idx) => {
      const srcPos = domainPositions[edge.from];
      const tgtPos = codomainPositions[edge.to];
      if (!srcPos || !tgtPos) return '';

      let startX, startY, endX, endY, marker, strokeColor;
      if (this.isInverseActive) {
        startX = tgtPos.cx - 24; startY = tgtPos.cy;
        endX = srcPos.cx + 24; endY = srcPos.cy;
        marker = 'url(#arrowhead-inverse)'; strokeColor = '#10b981';
      } else {
        startX = srcPos.cx + 24; startY = srcPos.cy;
        endX = tgtPos.cx - 24; endY = tgtPos.cy;
        marker = 'url(#arrowhead)'; strokeColor = '#38bdf8';
      }

      const dx = Math.abs(endX - startX) * 0.45;
      const c1x = startX + (this.isInverseActive ? -dx : dx);
      const c1y = startY;
      const c2x = endX + (this.isInverseActive ? dx : -dx);
      const c2y = endY;

      return `
        <g class="arrow-group" data-edge-idx="${idx}" style="cursor:pointer;">
          <path d="M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}" fill="none" stroke="transparent" stroke-width="16" />
          <path class="visible-arrow" d="M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}" fill="none" stroke="${strokeColor}" stroke-width="2.2" marker-end="${marker}" style="transition:stroke 0.2s ease, stroke-width 0.2s ease;" />
        </g>
      `;
    }).join('');

    const domainNodes = this.domain.map(x => {
      const pos = domainPositions[x];
      const isSelected = this.selectedSource === x;
      const targetCount = (evalResult.targets[x] || []).length;

      let badgeColor = '#38bdf8';
      let badgeText = '';
      if (targetCount === 0) {
        badgeColor = 'var(--accent)'; badgeText = '0';
      } else if (targetCount > 1) {
        badgeColor = 'var(--red)'; badgeText = `×${targetCount}`;
      }

      return `
        <g class="node-domain" data-node-x="${x}" style="cursor:pointer;" transform="translate(${pos.cx}, ${pos.cy})">
          ${isSelected ? `
            <circle r="26" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="3 3">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite"/>
            </circle>
          ` : ''}
          <circle r="20" fill="${isSelected ? '#0284c7' : 'var(--panel-alt)'}" stroke="${isSelected ? '#38bdf8' : (targetCount === 0 ? 'var(--accent)' : (targetCount > 1 ? 'var(--red)' : '#38bdf8'))}" stroke-width="2.2" />
          <text text-anchor="middle" dy="5" font-size="12.5" font-weight="700" fill="${isSelected ? '#ffffff' : 'var(--text)'}">${x}</text>
          ${badgeText ? `
            <g transform="translate(14, -14)">
              <circle r="8.5" fill="${badgeColor}" />
              <text text-anchor="middle" dy="3.5" font-size="9" font-weight="800" fill="#ffffff">${badgeText}</text>
            </g>
          ` : ''}
        </g>
      `;
    }).join('');

    const codomainNodes = this.codomain.map(y => {
      const pos = codomainPositions[y];
      const preimageCount = (evalResult.preimages[y] || []).length;

      let badgeColor = '#c084fc';
      let badgeText = preimageCount.toString();
      if (preimageCount === 0) badgeColor = 'var(--dim)';
      else if (preimageCount > 1) badgeColor = 'var(--red)';
      else badgeColor = 'var(--accent2)';

      return `
        <g class="node-codomain" data-node-y="${y}" style="cursor:pointer;" transform="translate(${pos.cx}, ${pos.cy})">
          <circle r="20" fill="var(--panel-alt)" stroke="${preimageCount === 0 ? 'var(--dim)' : (preimageCount > 1 ? 'var(--red)' : '#c084fc')}" stroke-width="2.2" />
          <text text-anchor="middle" dy="5" font-size="12.5" font-weight="700" fill="var(--text)">${y}</text>
          <g transform="translate(14, -14)">
            <circle r="8.5" fill="${badgeColor}" />
            <text text-anchor="middle" dy="3.5" font-size="9" font-weight="800" fill="#ffffff">${badgeText}</text>
          </g>
        </g>
      `;
    }).join('');

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="user-select:none;display:block;">
        ${svgDefs}
        ${setCapsules}
        ${arrowPaths}
        ${domainNodes}
        ${codomainNodes}
      </svg>
    `;
  }

  // =========================================================================
  // TAB 2: DIRICHLET PIGEONHOLE STUDIO
  // =========================================================================

  _renderDirichletStudio() {
    return `
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
        <button type="button" class="btn-tab ${this.dirichletSubTab === 'arena' ? 'active' : ''}" data-dirichlet-tab="arena" id="btnDirichletSubArena" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          🕊️ Đấu trường Chuồng bồ câu (Interactive Arena)
        </button>
        <button type="button" class="btn-tab ${this.dirichletSubTab === 'problems' ? 'active' : ''}" data-dirichlet-tab="problems" id="btnDirichletSubProblems" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          💡 Các bài toán ứng dụng kinh điển (Classic Solvers)
        </button>
      </div>

      ${this.dirichletSubTab === 'arena' ? this._renderDirichletArena() : this._renderDirichletProblems()}
    `;
  }

  _renderDirichletArena() {
    if (this.boxAllocations.length !== this.dirichletK) {
      this.boxAllocations = distributeEvenly(this.dirichletN, this.dirichletK);
    }

    const bounds = calculateDirichletBounds(this.dirichletN, this.dirichletK);
    const evaluation = evaluateDirichlet(this.boxAllocations, this.dirichletN);

    return `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:700;color:var(--blue-light);">Số chim/vật (N):</span>
              <button type="button" class="btn-sm" id="btnDecN" style="padding:2px 7px;font-size:12px;">-</button>
              <input type="number" id="numDirichletN" min="1" max="60" value="${this.dirichletN}" style="width:50px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:4px;text-align:center;font-weight:bold;">
              <button type="button" class="btn-sm" id="btnIncN" style="padding:2px 7px;font-size:12px;">+</button>
              <input type="range" id="rngDirichletN" min="1" max="60" value="${this.dirichletN}" style="width:100px;cursor:pointer;">
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:700;color:#c084fc;">Số chuồng/hộp (k):</span>
              <button type="button" class="btn-sm" id="btnDecK" style="padding:2px 7px;font-size:12px;">-</button>
              <input type="number" id="numDirichletK" min="2" max="10" value="${this.dirichletK}" style="width:50px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:4px;text-align:center;font-weight:bold;">
              <button type="button" class="btn-sm" id="btnIncK" style="padding:2px 7px;font-size:12px;">+</button>
              <input type="range" id="rngDirichletK" min="2" max="10" value="${this.dirichletK}" style="width:90px;cursor:pointer;">
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-sm" id="btnDirichletEven" title="Dàn đều nhất có thể">⚖️ Dàn đều (Xấu nhất)</button>
            <button type="button" class="btn-sm" id="btnDirichletRandom" title="Phân phối ngẫu nhiên N vật">🎲 Thả ngẫu nhiên</button>
            <button type="button" class="btn-sm" id="btnDirichletClear" title="Làm rỗng các chuồng">🧹 Làm rỗng</button>
            <button type="button" class="btn-sm" id="btnToggleProof" style="background:${this.showProof ? 'var(--accent)' : 'var(--panel-alt)'};color:${this.showProof ? '#000' : 'var(--text)'};border:1px solid ${this.showProof ? 'var(--accent)' : 'var(--line)'};font-weight:600;">📖 ${this.showProof ? 'Đóng chứng minh' : 'Xem chứng minh phản chứng'}</button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;margin-bottom:16px;">
        <div class="card" style="background:var(--panel);border:1px solid ${bounds.isBasicApplicable ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">1. Nguyên lý Cơ bản (N > k)</span>
            <span style="font-size:11.5px;padding:3px 10px;border-radius:12px;font-weight:800;background:${bounds.isBasicApplicable ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${bounds.isBasicApplicable ? 'var(--accent2)' : 'var(--accent)'};">${bounds.isBasicApplicable ? '✅ ÁP DỤNG ĐƯỢC' : 'CHƯA ĐẠT (N ≤ k)'}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${bounds.basicNote}</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">2. Chặn trên: ⌈N/k⌉</span>
            <span style="font-size:14px;font-weight:800;color:var(--blue-light);">⌈${this.dirichletN}/${this.dirichletK}⌉ = ${bounds.ceilBound}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">Chắc chắn luôn tồn tại ít nhất 1 chuồng chứa từ <b>${bounds.ceilBound}</b> vật trở lên.</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">3. Chặn dưới: ⌊N/k⌋</span>
            <span style="font-size:14px;font-weight:800;color:#c084fc;">⌊${this.dirichletN}/${this.dirichletK}⌋ = ${bounds.floorBound}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">Chắc chắn luôn tồn tại ít nhất 1 chuồng chứa từ <b>${bounds.floorBound}</b> vật trở xuống.</p>
        </div>

        <div class="card" style="background:var(--panel);border:1px solid ${evaluation.isDirichletSatisfied ? 'rgba(245,158,11,0.5)' : 'var(--line)'};border-radius:8px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">4. Chuồng đông nhất hiện tại</span>
            <span style="font-size:12px;padding:3px 10px;border-radius:12px;font-weight:800;background:rgba(245,158,11,0.15);color:var(--accent);">max = ${evaluation.maxBox}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text);margin:0;line-height:1.5;">${evaluation.maxBox >= bounds.ceilBound ? `✅ Đạt định lý: max (${evaluation.maxBox}) ≥ ⌈N/k⌉ (${bounds.ceilBound}) ở Chuồng #${evaluation.maxBoxIndices.map(i => i + 1).join(', #')}.` : `Chưa đạt.`}</p>
        </div>
      </div>

      ${this.showProof ? `
        <div style="background:var(--panel);border:1px solid var(--accent);border-radius:10px;padding:16px 20px;margin-bottom:16px;animation:fadeIn 0.2s ease;">
          <h4 style="font-size:14px;font-weight:700;color:var(--accent);margin:0 0 8px 0;display:flex;align-items:center;gap:6px;">
            <span>📜</span> Chứng minh Phản chứng Định lý Dirichlet Tổng quát:
          </h4>
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;color:var(--text);line-height:1.6;margin:0;background:var(--card-bg);padding:12px 16px;border-radius:6px;border:1px solid var(--line);">${bounds.proofByContradiction}</pre>
        </div>
      ` : ''}

      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div>
            <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 4px 0;">Đấu trường Chuồng bồ câu</h4>
            <span style="font-size:12px;color:var(--dim);">Tổng số vật: <b>${evaluation.totalItems}</b> / Mục tiêu N: <b>${this.dirichletN}</b>. Bạn có thể bấm [+] hoặc [-] trên từng chuồng để thử dời chim!</span>
          </div>
          <div style="font-size:12px;color:var(--accent);font-weight:600;">👑 Chuồng có viền vàng là chuồng đạt giá trị cực đại (≥ ⌈N/k⌉)</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(210px, 1fr));gap:14px;">
          ${this.boxAllocations.map((count, idx) => {
            const isMax = evaluation.maxBoxIndices.includes(idx) && count > 0;
            const isEmpty = count === 0;

            const maxIconsToRender = 20;
            const renderCount = Math.min(count, maxIconsToRender);
            const remainder = count - renderCount;
            let iconsHtml = '';
            for (let i = 0; i < renderCount; i++) {
              iconsHtml += '<span class="pigeon-icon" title="Chim bồ câu">🕊️</span>';
            }

            return `
              <div class="pigeon-box ${isMax ? 'max-box' : ''} ${isEmpty ? 'empty-box' : ''}" data-box-idx="${idx}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="font-weight:700;font-size:13px;color:var(--text);">Chuồng #${idx + 1}</span>
                  <span style="font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:10px;background:${isMax ? 'rgba(245,158,11,0.2)' : 'var(--panel-alt)'};color:${isMax ? 'var(--accent)' : 'var(--dim)'};">
                    ${count} vật ${isMax ? '👑' : ''}
                  </span>
                </div>

                <div class="pigeon-cage-arena" title="Chuồng #${idx + 1}: ${count} vật">
                  ${isEmpty ? '<span style="font-size:12px;color:var(--dim);font-style:italic;margin:auto;">Chuồng rỗng (0)</span>' : ''}
                  ${iconsHtml}
                  ${remainder > 0 ? `<span style="font-size:11px;font-weight:800;color:var(--accent);align-self:center;">+${remainder} chim</span>` : ''}
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:6px;border-top:1px dashed var(--line);">
                  <button type="button" class="btn-sm btn-remove-pigeon" data-box-idx="${idx}" style="padding:2px 8px;font-size:12px;" ${count <= 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>- Bớt</button>
                  <span style="font-size:11px;color:var(--dim);">Tùy biến</span>
                  <button type="button" class="btn-sm btn-add-pigeon" data-box-idx="${idx}" style="padding:2px 8px;font-size:12px;">+ Thêm</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  _renderDirichletProblems() {
    const currentParams = this.scenarioParams[this.selectedScenario] || {};
    const solution = solveDirichletScenario(this.selectedScenario, currentParams);

    return `
      <div style="display:grid;grid-template-columns:320px 1fr;gap:18px;">
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;display:block;margin-bottom:6px;">Chọn bài toán kinh điển:</label>
            <select id="selDirichletScenario" style="width:100%;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer;">
              <option value="birthday" ${this.selectedScenario === 'birthday' ? 'selected' : ''}>🎂 Bài toán Sinh nhật</option>
              <option value="socks" ${this.selectedScenario === 'socks' ? 'selected' : ''}>🧦 Bài toán Rút tất trong bóng tối</option>
              <option value="exam_scores" ${this.selectedScenario === 'exam_scores' ? 'selected' : ''}>📝 Bài toán Điểm thi Toán rời rạc</option>
              <option value="sum_pairs" ${this.selectedScenario === 'sum_pairs' ? 'selected' : ''}>🔢 Bài toán Cặp số có tổng 2n + 1</option>
              <option value="erdos_szekeres" ${this.selectedScenario === 'erdos_szekeres' ? 'selected' : ''}>📈 Định lý Erdős–Szekeres (Dãy con)</option>
            </select>
          </div>

          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:12px;">
            <div style="font-size:12px;font-weight:700;color:var(--blue-light);text-transform:uppercase;">Tham số bài toán:</div>

            ${this.selectedScenario === 'birthday' ? `
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Chu kỳ phân loại:</label>
                <select id="inputBirthdayPeriod" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
                  <option value="month" ${currentParams.period === 'month' ? 'selected' : ''}>12 Tháng trong năm (k = 12)</option>
                  <option value="weekday" ${currentParams.period === 'weekday' ? 'selected' : ''}>7 Thứ trong tuần (k = 7)</option>
                </select>
              </div>
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Cần chắc chắn cùng sinh (m người):</label>
                <input type="number" id="inputBirthdayTarget" min="2" max="20" value="${currentParams.targetSame || 3}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Số người có trong phòng hiện tại:</label>
                <input type="number" id="inputBirthdayGiven" min="1" max="500" value="${currentParams.givenPeople || 30}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
            ` : ''}

            ${this.selectedScenario === 'socks' ? `
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Số màu tất khác nhau trong tủ (k):</label>
                <input type="number" id="inputSocksColors" min="2" max="10" value="${currentParams.colors || 3}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Cần chắc chắn cùng màu (m chiếc):</label>
                <input type="number" id="inputSocksTarget" min="2" max="10" value="${currentParams.targetMatch || 2}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
            ` : ''}

            ${this.selectedScenario === 'exam_scores' ? `
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Thang điểm (từ 0 đến 10 = 11 mức):</label>
                <input type="text" value="0 đến 10 (k = 11)" disabled style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--dim);border-radius:4px;padding:5px;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Cần cùng điểm thi (m bạn):</label>
                <input type="number" id="inputExamTarget" min="2" max="20" value="${currentParams.targetSame || 4}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Sĩ số sinh viên của lớp:</label>
                <input type="number" id="inputExamClassSize" min="1" max="200" value="${currentParams.classSize || 45}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
            ` : ''}

            ${this.selectedScenario === 'sum_pairs' ? `
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Giá trị n (chọn n+1 số từ 2n số):</label>
                <input type="number" id="inputSumPairsN" min="2" max="15" value="${currentParams.n || 5}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
            ` : ''}

            ${this.selectedScenario === 'erdos_szekeres' ? `
              <div>
                <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Giá trị n (dãy gồm n² + 1 số):</label>
                <input type="number" id="inputErdosN" min="2" max="6" value="${currentParams.n || 3}" style="width:100%;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:5px;">
              </div>
            ` : ''}
          </div>
        </div>

        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:16px;">
          ${solution ? `
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px;">
              <div>
                <h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0 0 4px 0;">${solution.title}</h3>
                <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:var(--blue-light);border:1px solid rgba(56,189,248,0.3);padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;">${solution.formula}</span>
              </div>
            </div>

            <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:16px;">
              <h4 style="font-size:13px;font-weight:700;color:var(--accent);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;"><span>💡</span> Lời giải & Lập luận Toán học chặt chẽ:</h4>
              <div style="font-size:13px;line-height:1.65;color:var(--text);white-space:pre-wrap;">${solution.explanation}</div>
            </div>

            ${solution.pairs ? `
              <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px;">
                <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:8px;text-transform:uppercase;">Danh sách ${solution.n} cặp chuồng (Mỗi cặp có tổng = ${solution.targetSum}):</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  ${solution.pairs.map((p, idx) => `
                    <span style="background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 10px;font-family:monospace;font-size:12px;">Chuồng #${idx + 1}: <b>{${p[0]}, ${p[1]}}</b></span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;">
              <span style="font-size:24px;">🎯</span>
              <div style="font-size:13px;color:var(--accent2);line-height:1.4;">
                ${this.selectedScenario === 'birthday' 
                  ? `Để chắc chắn có ít nhất <b>${currentParams.targetSame || 3}</b> người cùng ${solution.periodName}, cần tối thiểu <b>${solution.minPeopleNeeded}</b> người. Với <b>${solution.givenN}</b> người hiện tại, chắc chắn có ít nhất <b>${solution.guaranteedSame}</b> người cùng ${solution.periodName}!`
                  : (this.selectedScenario === 'socks'
                    ? `Cần rút tối thiểu <b>${solution.minSocksNeeded} chiếc tất</b> trong bóng tối để chắc chắn có ít nhất <b>${solution.mMatch} chiếc cùng màu</b>!`
                    : (this.selectedScenario === 'exam_scores'
                      ? `Lớp cần tối thiểu <b>${solution.minStudentsNeeded} bạn</b> để có ít nhất ${solution.mStudents} bạn cùng điểm. Với <b>${solution.classSize} bạn</b> hiện tại, chắc chắn có ít nhất <b>${solution.guaranteedSameScore} bạn</b> đạt cùng điểm!`
                      : `Áp dụng hoàn hảo định lý Dirichlet cho bài toán!`))}
              </div>
            </div>
          ` : '<div style="color:var(--dim);">Không thể giải bài toán với tham số đã chọn.</div>'}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // TAB 3: PASCAL TRIANGLE & COMBINATORICS STUDIO
  // =========================================================================

  _renderPascalStudio() {
    return `
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
        <button type="button" class="btn-tab ${this.pascalSubTab === 'triangle' ? 'active' : ''}" data-pascal-tab="triangle" id="btnPascalSubTriangle" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          📐 Tam giác Pascal & Đẳng thức Tổ hợp
        </button>
        <button type="button" class="btn-tab ${this.pascalSubTab === 'generators' ? 'active' : ''}" data-pascal-tab="generators" id="btnPascalSubGenerators" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          ⚡ Máy sinh Cấu hình Tổ hợp (Lexicographical)
        </button>
      </div>

      ${this.pascalSubTab === 'triangle' ? this._renderPascalTriangleView() : this._renderCombinatorialGeneratorsView()}
    `;
  }

  _renderPascalTriangleView() {
    const triangle = buildPascalTriangle(this.pascalRows);
    const selectedInfo = this.pascalSelectedCell 
      ? getPascalCellInfo(this.pascalSelectedCell.n, this.pascalSelectedCell.k) 
      : null;

    return `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--text);">Số hàng (n = 0..${this.pascalRows}):</span>
            <input type="range" id="rngPascalRows" min="3" max="12" value="${this.pascalRows}" style="width:110px;cursor:pointer;">
            <span style="font-size:12px;font-weight:800;color:var(--blue-light);">${this.pascalRows + 1} hàng</span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;">Tô màu đồng dư:</span>
            <select id="selPascalMod" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:5px 10px;font-size:12.5px;cursor:pointer;">
              <option value="none" ${this.pascalModColor === 'none' ? 'selected' : ''}>Bình thường (Mặc định)</option>
              <option value="mod2" ${this.pascalModColor === 'mod2' ? 'selected' : ''}>mod 2 (Số lẻ vs Chẵn — Fractal Sierpinski)</option>
              <option value="mod3" ${this.pascalModColor === 'mod3' ? 'selected' : ''}>mod 3 (Chia hết cho 3)</option>
              <option value="mod5" ${this.pascalModColor === 'mod5' ? 'selected' : ''}>mod 5 (Chia hết cho 5)</option>
            </select>
            <button type="button" class="btn-sm" id="btnPascalResetSelect" style="padding:4px 10px;font-size:12px;">Bỏ chọn ô</button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 340px;gap:18px;margin-bottom:18px;">
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 12px;display:flex;flex-direction:column;position:relative;">
          <div style="font-size:13px;color:var(--text);margin-bottom:14px;text-align:center;line-height:1.5;background:var(--panel-alt);padding:8px 14px;border-radius:8px;border:1px solid var(--line);">
            💡 <b>Hướng dẫn:</b> Nhấp chuột vào bất kỳ ô nào để xem 2 ô cha sinh ra nó theo công thức Pascal <b>C(n, k) = C(n-1, k-1) + C(n-1, k)</b> và ô đối xứng <b>C(n, n-k)</b>.
          </div>

          <div class="pascal-container">
            ${triangle.map((row, n) => {
              const rowSum = Math.pow(2, n);
              return `
                <div class="pascal-row-wrap">
                  <div class="pascal-row-label" title="Tổng các phần tử trên hàng n=${n} bằng 2^${n} = ${rowSum}">n=${n} (Σ=2<sup>${n}</sup>)</div>
                  <div class="pascal-cells-row">
                    ${row.map((val, k) => {
                      let cellClass = '';
                      if (this.pascalSelectedCell) {
                        const selN = this.pascalSelectedCell.n;
                        const selK = this.pascalSelectedCell.k;

                        if (n === selN && k === selK) {
                          cellClass = 'selected';
                        } else if (n === selN - 1 && (k === selK - 1 || k === selK)) {
                          cellClass = 'parent-cell';
                        } else if (n === selN && k === selN - selK) {
                          cellClass = 'symmetric-cell';
                        }
                      }

                      if (this.pascalModColor === 'mod2') {
                        cellClass += (val % 2 !== 0) ? ' mod-active' : ' mod-inactive';
                      } else if (this.pascalModColor === 'mod3') {
                        cellClass += (val % 3 !== 0) ? ' mod-active' : ' mod-inactive';
                      } else if (this.pascalModColor === 'mod5') {
                        cellClass += (val % 5 !== 0) ? ' mod-active' : ' mod-inactive';
                      }

                      return `
                        <div class="pascal-cell ${cellClass}" data-n="${n}" data-k="${k}" title="C(${n}, ${k}) = ${val}">
                          ${val > 999 ? (val > 99999 ? '99k+' : val) : val}
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
            <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 12px 0;display:flex;align-items:center;gap:6px;">
              <span>🔍</span> Thanh Thanh Tra Ô Hệ Số Nhị Thức
            </h4>

            ${selectedInfo ? `
              <div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;">
                <div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--line);padding-bottom:6px;">
                  <span style="color:var(--dim);font-weight:600;">Tọa độ hệ số:</span>
                  <b style="color:var(--blue-light);font-size:14px;">C(${selectedInfo.n}, ${selectedInfo.k}) = ${selectedInfo.val.toLocaleString()}</b>
                </div>

                <div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--line);padding-bottom:6px;">
                  <span style="color:var(--dim);font-weight:600;">Công thức giai thừa:</span>
                  <span style="font-family:monospace;font-size:12.5px;color:var(--text);">${selectedInfo.n}! / (${selectedInfo.k}! × ${selectedInfo.n - selectedInfo.k}!)</span>
                </div>

                <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;padding:10px 12px;">
                  <div style="font-size:12px;font-weight:700;color:var(--accent2);text-transform:uppercase;margin-bottom:4px;">Công thức cộng Pascal (Ô màu xanh lá):</div>
                  <div style="font-size:13px;font-family:monospace;font-weight:600;">${selectedInfo.pascalFormula}</div>
                </div>

                <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;padding:10px 12px;">
                  <div style="font-size:12px;font-weight:700;color:#c084fc;text-transform:uppercase;margin-bottom:4px;">Tính chất đối xứng (Ô màu tím):</div>
                  <div style="font-size:13px;font-family:monospace;font-weight:600;">C(${selectedInfo.n}, ${selectedInfo.k}) = C(${selectedInfo.n}, ${selectedInfo.isSymmetricWith}) = ${selectedInfo.val}</div>
                </div>

                <div style="display:flex;justify-content:space-between;padding-top:2px;">
                  <span style="color:var(--dim);font-weight:600;">Tổng cả hàng n = ${selectedInfo.n}:</span>
                  <b style="color:var(--accent);font-size:14px;">Σ = 2<sup>${selectedInfo.n}</sup> = ${selectedInfo.rowSum.toLocaleString()}</b>
                </div>
              </div>
            ` : `
              <div style="font-size:12.5px;color:var(--dim);font-style:italic;">Nhấp vào một ô trên tam giác để thanh tra chi tiết.</div>
            `}
          </div>

          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;flex-grow:1;">
            <h4 style="font-size:13.5px;font-weight:700;color:var(--accent);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>📚</span> Đẳng Thức Tổ Hợp Kinh Điển
            </h4>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text);line-height:1.45;">
              <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;padding:6px 10px;">
                <b>1. Công thức Pascal:</b><br>
                <code style="color:var(--blue-light);">C(n, k) = C(n-1, k-1) + C(n-1, k)</code>
              </div>
              <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;padding:6px 10px;">
                <b>2. Tính đối xứng:</b><br>
                <code style="#c084fc;">C(n, k) = C(n, n - k)</code>
              </div>
              <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;padding:6px 10px;">
                <b>3. Nhị thức Newton tổng hàng:</b><br>
                <code style="color:var(--accent2);">Σ_{k=0}^n C(n, k) = 2ⁿ</code>
              </div>
              <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;padding:6px 10px;">
                <b>4. Đẳng thức Gậy khúc côn cầu:</b><br>
                <code style="color:var(--accent);">Σ_{i=r}^n C(i, r) = C(n+1, r+1)</code>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  _renderCombinatorialGeneratorsView() {
    const items = this.generatorItemsStr.split(',').map(s => s.trim()).filter(Boolean);
    const n = items.length;
    const k = Math.min(n, Math.max(1, this.generatorK));
    const counts = calculateCombinatoricsCounts(n, k);

    let currentConfigTitle = '';
    let currentConfigFormula = '';
    if (this.generatorType === 'permutation') {
      currentConfigTitle = `Hoán vị không lặp P(${n})`;
      currentConfigFormula = `P(${n}) = ${n}! = ${counts.permutation}`;
    } else if (this.generatorType === 'arrangement') {
      currentConfigTitle = `Chỉnh hợp không lặp A(${n}, ${k})`;
      currentConfigFormula = `A(${n}, ${k}) = ${n}! / (${n} - ${k})! = ${counts.arrangement}`;
    } else if (this.generatorType === 'combination') {
      currentConfigTitle = `Tổ hợp không lặp C(${n}, ${k})`;
      currentConfigFormula = `C(${n}, ${k}) = ${n}! / (${k}! × ${n - k}!) = ${counts.combination}`;
    } else if (this.generatorType === 'rep_arrangement') {
      currentConfigTitle = `Chỉnh hợp lặp Ā(${n}, ${k})`;
      currentConfigFormula = `Ā(${n}, ${k}) = ${n}^${k} = ${counts.arrangementWithRepetition}`;
    } else if (this.generatorType === 'rep_combination') {
      currentConfigTitle = `Tổ hợp lặp C̄(${n}, ${k}) (Chia kẹo Euler)`;
      currentConfigFormula = `C̄(${n}, ${k}) = C(${n}+${k}-1, ${k}) = ${counts.combinationWithRepetition}`;
    }

    return `
      <div style="display:grid;grid-template-columns:340px 1fr;gap:18px;">
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;display:block;margin-bottom:6px;">Cấu hình cần sinh:</label>
            <select id="selGeneratorType" style="width:100%;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12.5px;cursor:pointer;">
              <option value="combination" ${this.generatorType === 'combination' ? 'selected' : ''}>1. Tổ hợp không lặp C(n, k)</option>
              <option value="permutation" ${this.generatorType === 'permutation' ? 'selected' : ''}>2. Hoán vị không lặp P(n) = n!</option>
              <option value="arrangement" ${this.generatorType === 'arrangement' ? 'selected' : ''}>3. Chỉnh hợp không lặp A(n, k)</option>
              <option value="rep_arrangement" ${this.generatorType === 'rep_arrangement' ? 'selected' : ''}>4. Chỉnh hợp lặp n^k</option>
              <option value="rep_combination" ${this.generatorType === 'rep_combination' ? 'selected' : ''}>5. Tổ hợp lặp (Chia kẹo Euler) C̄(n, k)</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Danh sách phần tử (cách nhau bằng dấu phẩy):</label>
            <input type="text" id="inputGeneratorItems" value="${this.generatorItemsStr}" style="width:100%;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:7px 10px;font-size:13px;font-family:monospace;">
            <span style="font-size:11px;color:var(--dim);margin-top:2px;display:block;">Tổng số phần tử n = ${n}</span>
          </div>

          ${this.generatorType !== 'permutation' ? `
            <div>
              <label style="font-size:12px;color:var(--dim);display:block;margin-bottom:4px;">Kích thước cấu hình chập (k):</label>
              <input type="number" id="inputGeneratorK" min="1" max="${this.generatorType.startsWith('rep') ? 6 : n}" value="${k}" style="width:100%;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:7px 10px;font-size:13px;font-weight:bold;">
            </div>
          ` : ''}

          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:12px;">
            <div style="font-size:11.5px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:8px;">Bảng đếm lý thuyết (n=${n}, k=${k}):</div>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text);">
              <div style="display:flex;justify-content:space-between;"><span>• Hoán vị P(${n}):</span> <b>${counts.permutation.toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>• Chỉnh hợp A(${n}, ${k}):</span> <b>${counts.arrangement.toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>• Tổ hợp C(${n}, ${k}):</span> <b>${counts.combination.toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>• Chỉnh hợp lặp ${n}^${k}:</span> <b>${counts.arrangementWithRepetition.toLocaleString()}</b></div>
              <div style="display:flex;justify-content:space-between;"><span>• Tổ hợp lặp C̄(${n}, ${k}):</span> <b>${counts.combinationWithRepetition.toLocaleString()}</b></div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <button type="button" class="btn-primary" id="btnGenAll" style="width:100%;padding:9px 0;font-size:13px;font-weight:600;">
              ⚡ Sinh toàn bộ danh sách
            </button>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <button type="button" class="btn-sm" id="btnGenPrev" style="padding:6px 0;">◀️ Lùi 1 bước</button>
              <button type="button" class="btn-sm" id="btnGenNext" style="padding:6px 0;">▶️ Kế tiếp</button>
            </div>
          </div>
        </div>

        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;min-height:480px;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0 0 4px 0;">${currentConfigTitle}</h3>
              <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:var(--blue-light);border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">
                ${currentConfigFormula}
              </span>
            </div>
            <div style="font-size:13px;color:var(--dim);">
              Đang duyệt: <b style="color:var(--accent);">${this.generatorResults.length > 0 ? this.generatorCurrentStep + 1 : 0}</b> / <b>${this.generatorResults.length}</b> cấu hình
            </div>
          </div>

          <div style="flex-grow:1;overflow-y:auto;max-height:400px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:14px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;">
            ${this.generatorResults.length === 0 ? '<div style="color:var(--dim);font-style:italic;margin:auto;">Chưa có cấu hình nào. Bấm "Sinh toàn bộ danh sách" để bắt đầu.</div>' : ''}
            ${this.generatorResults.map((cfg, idx) => {
              const isActive = idx === this.generatorCurrentStep;
              return `
                <div class="combinatorics-config-badge ${isActive ? 'active-config' : ''}" data-config-idx="${idx}" title="Cấu hình thứ ${idx + 1}">
                  <span style="font-size:11px;color:var(--dim);">#${idx + 1}:</span>
                  <span>(${cfg.join(', ')})</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // TAB 4: RECURRENCE RELATIONS & TOWER OF HANOI STUDIO
  // =========================================================================

  _renderRecurrenceStudio() {
    return `
      <!-- Sub Navigation Bar within Tab 4 -->
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
        <button type="button" class="btn-tab ${this.recurrenceSubTab === 'solver' ? 'active' : ''}" data-recurrence-tab="solver" id="btnRecurrenceSubSolver" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          ⏳ Bộ giải Hệ thức truy hồi tuyến tính
        </button>
        <button type="button" class="btn-tab ${this.recurrenceSubTab === 'hanoi' ? 'active' : ''}" data-recurrence-tab="hanoi" id="btnRecurrenceSubHanoi" style="padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
          🗼 Mô phỏng Tháp Hà Nội & Đệ quy
        </button>
      </div>

      ${this.recurrenceSubTab === 'solver' ? this._renderRecurrenceSolverView() : this._renderHanoiTowerView()}
    `;
  }

  /**
   * Renders Linear Recurrence Solver View
   */
  _renderRecurrenceSolverView() {
    let solution = null;
    if (this.recurrenceOrder === 1) {
      solution = solveOrder1Linear(this.recurrenceC1, this.recurrenceA0, this.recurrenceNumTerms);
    } else {
      solution = solveOrder2Homogeneous(this.recurrenceC1, this.recurrenceC2, this.recurrenceA0, this.recurrenceA1, this.recurrenceNumTerms);
    }

    return `
      <div class="recurrence-solver-grid" style="display:grid;grid-template-columns:minmax(320px, 360px) minmax(0, 1fr);gap:20px;">
        <!-- Left: Recurrence Config Panel -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          <!-- Presets -->
          <div>
            <label style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;display:block;margin-bottom:6px;letter-spacing:0.3px;">Mẫu hệ thức kinh điển:</label>
            <select id="selRecurrencePreset" style="width:100%;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:8px 12px;font-size:13.5px;cursor:pointer;height:40px;">
              <option value="custom">✏️ Tuỳ chỉnh tự do</option>
              ${RECURRENCE_PRESETS.map(p => `
                <option value="${p.id}" ${this.recurrencePresetId === p.id ? 'selected' : ''}>${p.title}</option>
              `).join('')}
            </select>
          </div>

          <!-- Order Selector -->
          <div>
            <label style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;display:block;margin-bottom:8px;letter-spacing:0.3px;">Bậc của hệ thức:</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button type="button" class="btn-order-toggle ${this.recurrenceOrder === 2 ? 'active' : ''}" id="btnOrder2">
                <span style="font-weight:700;font-size:13px;display:block;">Bậc 2 (c₁, c₂)</span>
                <span style="font-size:11px;opacity:0.85;font-family:monospace;display:block;margin-top:2px;">aₙ = c₁aₙ₋₁ + c₂aₙ₋₂</span>
              </button>
              <button type="button" class="btn-order-toggle ${this.recurrenceOrder === 1 ? 'active' : ''}" id="btnOrder1">
                <span style="font-weight:700;font-size:13px;display:block;">Bậc 1 (c)</span>
                <span style="font-size:11px;opacity:0.85;font-family:monospace;display:block;margin-top:2px;">aₙ = c·aₙ₋₁</span>
              </button>
            </div>
          </div>

          <!-- Coefficients & Initial Conditions -->
          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px;">
            <div style="font-size:13px;font-weight:700;color:var(--blue-light);text-transform:uppercase;letter-spacing:0.3px;">Hệ số & Điều kiện đầu:</div>

            ${this.recurrenceOrder === 2 ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Hệ số c₁ (aₙ₋₁):</label>
                  <input type="number" id="inputRecC1" value="${this.recurrenceC1}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Hệ số c₂ (aₙ₋₂):</label>
                  <input type="number" id="inputRecC2" value="${this.recurrenceC2}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Giá trị ban đầu a₀:</label>
                  <input type="number" id="inputRecA0" value="${this.recurrenceA0}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Giá trị ban đầu a₁:</label>
                  <input type="number" id="inputRecA1" value="${this.recurrenceA1}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
              </div>
            ` : `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Hệ số c (aₙ₋₁):</label>
                  <input type="number" id="inputRecC1" value="${this.recurrenceC1}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
                <div>
                  <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Giá trị ban đầu a₀:</label>
                  <input type="number" id="inputRecA0" value="${this.recurrenceA0}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
                </div>
              </div>
            `}

            <div>
              <label style="font-size:12.5px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px;">Số lượng số hạng sinh (n = 0..${this.recurrenceNumTerms}):</label>
              <input type="number" id="inputRecTerms" min="4" max="25" value="${this.recurrenceNumTerms}" style="width:100%;height:38px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;font-weight:600;">
            </div>
          </div>

          <button type="button" class="btn-primary" id="btnSolveRecurrence" style="width:100%;padding:11px 0;font-size:14px;font-weight:700;">
            ⚡ Giải hệ thức & Xuất nghiệm đóng
          </button>
        </div>

        <!-- Right: Mathematical Derivation & Output Table -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:18px;">
          <!-- Header Formula -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:14px;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 style="font-size:18px;font-weight:800;color:var(--text);margin:0 0 6px 0;letter-spacing:0.2px;">
                ${this.recurrenceOrder === 2 
                  ? `aₙ = (${this.recurrenceC1})aₙ₋₁ + (${this.recurrenceC2})aₙ₋₂` 
                  : `aₙ = (${this.recurrenceC1})aₙ₋₁`}
              </h3>
              <div style="background:#0284c7;color:#ffffff;padding:5px 14px;border-radius:8px;font-size:14px;font-weight:800;font-family:monospace;display:inline-block;box-shadow:0 2px 6px rgba(2,132,199,0.35);">
                ${solution.closedForm}
              </div>
            </div>
          </div>

          <!-- Step-by-step Derivation -->
          <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:16px;">
            <h4 style="font-size:14px;font-weight:700;color:var(--accent);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>📝</span> Các bước Giải Phương trình Đặc trưng & Hệ số:
            </h4>
            <pre style="white-space:pre-wrap;font-family:'Cascadia Code', Consolas, Monaco, monospace;font-size:13.5px;color:var(--text);line-height:1.7;margin:0;background:var(--panel);padding:14px;border-radius:6px;border:1px solid var(--line);">${solution.explanation}</pre>
          </div>

          <!-- Sequence Table of Values -->
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:10px;letter-spacing:0.3px;">Bảng giá trị các số hạng đầu tiên của dãy số:</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:180px;overflow-y:auto;background:var(--card-bg);padding:12px;border-radius:8px;border:1px solid var(--line);">
              ${solution.terms.map(t => `
                <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-family:monospace;font-size:13px;display:flex;gap:8px;align-items:center;">
                  <span style="color:var(--dim);font-weight:600;">a<sub>${t.n}</sub> =</span>
                  <b style="color:var(--blue-light);font-size:13.5px;">${typeof t.val === 'number' ? (Math.abs(t.val - Math.round(t.val)) < 1e-4 ? Math.round(t.val).toLocaleString() : t.val.toFixed(2)) : t.val}</b>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders Tower of Hanoi Visual Simulator View
   */
  _renderHanoiTowerView() {
    const moves = generateHanoiMoves(this.hanoiN);
    const totalMoves = moves.length;
    const currentStep = Math.max(0, Math.min(totalMoves, this.hanoiStep));
    const pegsState = getHanoiStateAtStep(this.hanoiN, currentStep, moves);

    const currentMove = currentStep > 0 && currentStep <= totalMoves ? moves[currentStep - 1] : null;

    // Disks color palette
    const diskColors = [
      '#38bdf8', // disk 1
      '#10b981', // disk 2
      '#f59e0b', // disk 3
      '#ec4899', // disk 4
      '#8b5cf6', // disk 5
      '#ef4444', // disk 6
    ];

    return `
      <!-- Educational Formula Banner -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">Hệ thức truy hồi Tháp Hà Nội:</span>
            <code style="color:var(--blue-light);font-size:13.5px;font-weight:700;margin-left:8px;">T(n) = 2·T(n-1) + 1, T(1) = 1 ⟹ T(n) = 2ⁿ - 1</code>
          </div>
          <div style="font-size:13px;color:var(--accent);font-weight:700;">
            Với n = ${this.hanoiN} đĩa: Cần đúng 2<sup>${this.hanoiN}</sup> - 1 = ${totalMoves} bước di chuyển!
          </div>
        </div>
      </div>

      <!-- Main Visual Arena & Controls -->
      <div class="hanoi-layout-grid" style="display:grid;grid-template-columns:minmax(0, 1fr) 340px;gap:20px;margin-bottom:18px;">
        
        <!-- Left: 3 Pegs Arena & Playback Bar -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          
          <!-- Playback Toolbar -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:var(--card-bg);padding:10px 14px;border-radius:8px;border:1px solid var(--line);">
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" class="btn-sm" id="btnHanoiReset" title="Về trạng thái đầu" style="padding:5px 10px;font-size:13px;">⏮️</button>
              <button type="button" class="btn-sm" id="btnHanoiPrev" title="Lùi 1 bước" style="padding:5px 10px;font-size:13px;">◀️</button>
              <button type="button" class="btn-primary" id="btnHanoiPlay" style="padding:5px 16px;font-weight:700;font-size:13px;">
                ${this.hanoiIsPlaying ? '⏸️ Tạm dừng' : '▶️ Tự động giải'}
              </button>
              <button type="button" class="btn-sm" id="btnHanoiNext" title="Bước tiếp theo" style="padding:5px 10px;font-size:13px;">▶️</button>
              <button type="button" class="btn-sm" id="btnHanoiEnd" title="Về bước cuối" style="padding:5px 10px;font-size:13px;">⏭️</button>
            </div>

            <!-- Scrubber Slider -->
            <div style="display:flex;align-items:center;gap:10px;flex-grow:1;max-width:260px;">
              <input type="range" id="rngHanoiStep" min="0" max="${totalMoves}" value="${currentStep}" style="width:100%;cursor:pointer;">
              <span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;">${currentStep}/${totalMoves}</span>
            </div>

            <!-- Disks Count & Speed -->
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:13px;font-weight:600;color:var(--dim);">Số đĩa:</span>
                <input type="number" id="numHanoiN" min="1" max="6" value="${this.hanoiN}" style="width:48px;height:32px;background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:4px;padding:3px;text-align:center;font-weight:bold;font-size:13.5px;">
              </div>
              <select id="selHanoiSpeed" style="background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:12.5px;height:32px;">
                <option value="1200" ${this.hanoiSpeed === 1200 ? 'selected' : ''}>0.5x Chậm</option>
                <option value="800" ${this.hanoiSpeed === 800 ? 'selected' : ''}>1.0x Chuẩn</option>
                <option value="400" ${this.hanoiSpeed === 400 ? 'selected' : ''}>2.0x Nhanh</option>
              </select>
            </div>
          </div>

          <!-- 3-Peg Graphical Stage -->
          <div class="hanoi-arena">
            ${['A', 'B', 'C'].map(pegName => {
              const disksOnPeg = pegsState[pegName] || [];
              const pegTitle = pegName === 'A' ? 'Cọc A (Nguồn)' : (pegName === 'B' ? 'Cọc B (Trung gian)' : 'Cọc C (Đích)');

              return `
                <div class="hanoi-peg-column">
                  <div class="hanoi-peg-stage">
                    <div class="hanoi-peg-stem"></div>
                    
                    <div class="hanoi-disks-stack">
                      ${disksOnPeg.map(d => {
                        const color = diskColors[d - 1] || '#38bdf8';
                        const widthPercent = 34 + d * 10;
                        return `
                          <div class="hanoi-disk" style="width:${widthPercent}%;background:${color};" title="Đĩa số ${d}">
                            ${d}
                          </div>
                        `;
                      }).join('')}
                    </div>

                    <div class="hanoi-peg-base"></div>
                  </div>

                  <div class="hanoi-peg-label">
                    ${pegTitle}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Step Description Alert -->
          <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:13.5px;color:var(--text);line-height:1.5;">
              ${currentStep === 0 ? `
                <b>Trạng thái ban đầu:</b> Toàn bộ ${this.hanoiN} đĩa xếp chồng tại Cọc A theo thứ tự nhỏ trên lớn dưới.
              ` : (currentStep === totalMoves ? `
                <span style="color:var(--accent2);font-weight:700;">🎉 Hoàn thành xuất sắc!</span> Toàn bộ ${this.hanoiN} đĩa đã được chuyển sang Cọc C sau đúng <b>${totalMoves} bước</b>!
              ` : `
                <b>Bước ${currentStep} / ${totalMoves}:</b> Chuyển đĩa <b>[${currentMove.disk}]</b> từ Cọc <b>${currentMove.from}</b> ➔ Cọc <b>${currentMove.to}</b>.
              `)}
            </div>
          </div>
        </div>

        <!-- Right: Mathematical Proof & Algorithm Walkthrough -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Recursive Steps Card -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
            <h4 style="font-size:14px;font-weight:700;color:var(--accent);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>🗼</span> Thuật Toán Đệ Quy 3 Bước:
            </h4>
            <div style="font-size:13px;color:var(--text);line-height:1.65;display:flex;flex-direction:column;gap:8px;">
              <div style="background:var(--card-bg);padding:10px 12px;border-radius:6px;border:1px solid var(--line);">
                <b>Bước 1:</b> Chuyển n-1 đĩa từ Cọc A sang Cọc B (mất <code style="color:var(--blue-light);font-weight:700;">T(n-1)</code> bước).
              </div>
              <div style="background:var(--card-bg);padding:10px 12px;border-radius:6px;border:1px solid var(--line);">
                <b>Bước 2:</b> Chuyển 1 đĩa lớn nhất n từ Cọc A sang Cọc C (mất <code style="color:var(--accent2);font-weight:700;">1</code> bước).
              </div>
              <div style="background:var(--card-bg);padding:10px 12px;border-radius:6px;border:1px solid var(--line);">
                <b>Bước 3:</b> Chuyển n-1 đĩa từ Cọc B sang Cọc C (mất <code style="color:var(--blue-light);font-weight:700;">T(n-1)</code> bước).
              </div>
            </div>
          </div>

          <!-- Inductive Proof Card -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;flex-grow:1;">
            <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 10px 0;display:flex;align-items:center;gap:6px;">
              <span>📜</span> Chứng minh Công thức Nghiệm Đóng:
            </h4>
            <div style="font-size:13px;color:var(--text);line-height:1.65;background:var(--card-bg);padding:12px 14px;border-radius:6px;border:1px solid var(--line);">
              Ta có hệ thức: <b>T(n) = 2·T(n-1) + 1</b><br>
              Cộng 1 vào 2 vế:<br>
              T(n) + 1 = 2·(T(n-1) + 1)<br>
              Đặt U(n) = T(n) + 1 ⟹ U(n) là một cấp số nhân với công bội q = 2 và U(1) = T(1) + 1 = 2.<br>
              Do đó: U(n) = U(1) · 2ⁿ⁻¹ = 2 · 2ⁿ⁻¹ = 2ⁿ.<br>
              Suy ra: <b style="color:var(--accent2);">T(n) = 2ⁿ - 1 (ĐPCM)</b>.
            </div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Programmatically switches the active tab in CountingLabView.
   * @param {'mapping'|'dirichlet'|'pascal'|'recurrence'} tabId
   */
  setTab(tabId) {
    if (tabId && ['mapping', 'dirichlet', 'pascal', 'recurrence'].includes(tabId)) {
      this._stopHanoiPlayback();
      this.activeTab = tabId;
      this.render();
    }
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================

  _bindEvents() {
    if (!this.container) return;

    // 1. Tab Bar Navigation
    const tabButtons = this.container.querySelectorAll('.counting-tabs-bar .btn-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this.activeTab) {
          this._stopHanoiPlayback();
          this.activeTab = tab;
          this.render();
        }
      });
    });

    if (this.activeTab === 'mapping') {
      this._bindMappingEvents();
    } else if (this.activeTab === 'dirichlet') {
      this._bindDirichletEvents();
    } else if (this.activeTab === 'pascal') {
      this._bindPascalEvents();
    } else if (this.activeTab === 'recurrence') {
      this._bindRecurrenceEvents();
    }
  }

  _bindMappingEvents() {
    const selPreset = this.container.querySelector('#selMappingPreset');
    if (selPreset) {
      selPreset.addEventListener('change', (e) => {
        const presetId = e.target.value;
        this.activePresetId = presetId;
        if (presetId === 'custom') return;

        const preset = MAPPING_PRESETS.find(p => p.id === presetId);
        if (preset) {
          this.domain = [...preset.domain];
          this.codomain = [...preset.codomain];
          this.edges = preset.edges.map(edge => ({ ...edge }));
          this.selectedSource = null;
          this.isInverseActive = false;
          this.render();
        }
      });
    }

    const btnAddDomain = this.container.querySelector('#btnAddDomain');
    if (btnAddDomain) {
      btnAddDomain.addEventListener('click', () => {
        if (this.domain.length < 6) {
          const nextIdx = this.domain.length + 1;
          const subscriptMap = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
          const sub = subscriptMap[nextIdx] || `${nextIdx}`;
          this.domain.push(`x${sub}`);
          this.activePresetId = 'custom';
          this.render();
        }
      });
    }

    const btnRemoveDomain = this.container.querySelector('#btnRemoveDomain');
    if (btnRemoveDomain) {
      btnRemoveDomain.addEventListener('click', () => {
        if (this.domain.length > 1) {
          const removed = this.domain.pop();
          this.edges = this.edges.filter(e => e.from !== removed);
          if (this.selectedSource === removed) this.selectedSource = null;
          this.activePresetId = 'custom';
          this.render();
        }
      });
    }

    const btnAddCodomain = this.container.querySelector('#btnAddCodomain');
    if (btnAddCodomain) {
      btnAddCodomain.addEventListener('click', () => {
        if (this.codomain.length < 6) {
          const nextIdx = this.codomain.length + 1;
          const subscriptMap = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
          const sub = subscriptMap[nextIdx] || `${nextIdx}`;
          this.codomain.push(`y${sub}`);
          this.activePresetId = 'custom';
          this.render();
        }
      });
    }

    const btnRemoveCodomain = this.container.querySelector('#btnRemoveCodomain');
    if (btnRemoveCodomain) {
      btnRemoveCodomain.addEventListener('click', () => {
        if (this.codomain.length > 1) {
          const removed = this.codomain.pop();
          this.edges = this.edges.filter(e => e.to !== removed);
          this.activePresetId = 'custom';
          this.render();
        }
      });
    }

    const domainNodeElements = this.container.querySelectorAll('.node-domain');
    domainNodeElements.forEach(el => {
      el.addEventListener('click', () => {
        const x = el.getAttribute('data-node-x');
        if (this.selectedSource === x) {
          this.selectedSource = null;
        } else {
          this.selectedSource = x;
        }
        this.render();
      });
    });

    const codomainNodeElements = this.container.querySelectorAll('.node-codomain');
    codomainNodeElements.forEach(el => {
      el.addEventListener('click', () => {
        const y = el.getAttribute('data-node-y');
        if (this.selectedSource) {
          const existingIdx = this.edges.findIndex(e => e.from === this.selectedSource && e.to === y);
          if (existingIdx !== -1) {
            this.edges.splice(existingIdx, 1);
          } else {
            this.edges.push({ from: this.selectedSource, to: y });
          }
          this.selectedSource = null;
          this.activePresetId = 'custom';
          this.render();
        }
      });
    });

    const btnCancelSelection = this.container.querySelector('#btnCancelSelection');
    if (btnCancelSelection) {
      btnCancelSelection.addEventListener('click', () => {
        this.selectedSource = null;
        this.render();
      });
    }

    const arrowGroups = this.container.querySelectorAll('.arrow-group');
    arrowGroups.forEach(g => {
      g.addEventListener('click', () => {
        const idx = parseInt(g.getAttribute('data-edge-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.edges.length) {
          this.edges.splice(idx, 1);
          this.activePresetId = 'custom';
          this.render();
        }
      });
    });

    const btnRemoveEdges = this.container.querySelectorAll('.btn-remove-edge');
    btnRemoveEdges.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-edge-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.edges.length) {
          this.edges.splice(idx, 1);
          this.activePresetId = 'custom';
          this.render();
        }
      });
    });

    const btnClearEdges = this.container.querySelector('#btnClearEdges');
    if (btnClearEdges) {
      btnClearEdges.addEventListener('click', () => {
        this.edges = [];
        this.selectedSource = null;
        this.activePresetId = 'custom';
        this.render();
      });
    }

    const btnToggleInverse = this.container.querySelector('#btnToggleInverse');
    if (btnToggleInverse) {
      btnToggleInverse.addEventListener('click', () => {
        this.isInverseActive = !this.isInverseActive;
        this.render();
      });
    }

    const btnGenRandom = this.container.querySelector('#btnGenRandom');
    if (btnGenRandom) {
      btnGenRandom.addEventListener('click', () => {
        this.edges = generateRandomMapping(this.domain, this.codomain, 'random');
        this.activePresetId = 'custom';
        this.selectedSource = null;
        this.render();
      });
    }

    const btnGenInjective = this.container.querySelector('#btnGenInjective');
    if (btnGenInjective) {
      btnGenInjective.addEventListener('click', () => {
        if (this.domain.length <= this.codomain.length) {
          this.edges = generateRandomMapping(this.domain, this.codomain, 'injective');
          this.activePresetId = 'custom';
          this.selectedSource = null;
          this.render();
        }
      });
    }

    const btnGenSurjective = this.container.querySelector('#btnGenSurjective');
    if (btnGenSurjective) {
      btnGenSurjective.addEventListener('click', () => {
        if (this.domain.length >= this.codomain.length) {
          this.edges = generateRandomMapping(this.domain, this.codomain, 'surjective');
          this.activePresetId = 'custom';
          this.selectedSource = null;
          this.render();
        }
      });
    }

    const btnGenBijective = this.container.querySelector('#btnGenBijective');
    if (btnGenBijective) {
      btnGenBijective.addEventListener('click', () => {
        if (this.domain.length === this.codomain.length) {
          this.edges = generateRandomMapping(this.domain, this.codomain, 'bijective');
          this.activePresetId = 'custom';
          this.selectedSource = null;
          this.render();
        }
      });
    }
  }

  _bindDirichletEvents() {
    const subTabButtons = this.container.querySelectorAll('[data-dirichlet-tab]');
    subTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-dirichlet-tab');
        if (targetTab && targetTab !== this.dirichletSubTab) {
          this.dirichletSubTab = targetTab;
          this.render();
        }
      });
    });

    if (this.dirichletSubTab === 'arena') {
      this._bindDirichletArenaEvents();
    } else if (this.dirichletSubTab === 'problems') {
      this._bindDirichletProblemsEvents();
    }
  }

  _bindDirichletArenaEvents() {
    const rngN = this.container.querySelector('#rngDirichletN');
    const numN = this.container.querySelector('#numDirichletN');
    const updateN = (val) => {
      const parsed = Math.max(1, Math.min(60, parseInt(val, 10) || 1));
      this.dirichletN = parsed;
      this.boxAllocations = distributeEvenly(this.dirichletN, this.dirichletK);
      this.render();
    };

    if (rngN) rngN.addEventListener('input', (e) => updateN(e.target.value));
    if (numN) numN.addEventListener('change', (e) => updateN(e.target.value));

    const btnDecN = this.container.querySelector('#btnDecN');
    if (btnDecN) btnDecN.addEventListener('click', () => updateN(this.dirichletN - 1));

    const btnIncN = this.container.querySelector('#btnIncN');
    if (btnIncN) btnIncN.addEventListener('click', () => updateN(this.dirichletN + 1));

    const rngK = this.container.querySelector('#rngDirichletK');
    const numK = this.container.querySelector('#numDirichletK');
    const updateK = (val) => {
      const parsed = Math.max(2, Math.min(10, parseInt(val, 10) || 2));
      this.dirichletK = parsed;
      this.boxAllocations = distributeEvenly(this.dirichletN, this.dirichletK);
      this.render();
    };

    if (rngK) rngK.addEventListener('input', (e) => updateK(e.target.value));
    if (numK) numK.addEventListener('change', (e) => updateK(e.target.value));

    const btnDecK = this.container.querySelector('#btnDecK');
    if (btnDecK) btnDecK.addEventListener('click', () => updateK(this.dirichletK - 1));

    const btnIncK = this.container.querySelector('#btnIncK');
    if (btnIncK) btnIncK.addEventListener('click', () => updateK(this.dirichletK + 1));

    const btnEven = this.container.querySelector('#btnDirichletEven');
    if (btnEven) {
      btnEven.addEventListener('click', () => {
        this.boxAllocations = distributeEvenly(this.dirichletN, this.dirichletK);
        this.render();
      });
    }

    const btnRandom = this.container.querySelector('#btnDirichletRandom');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => {
        this.boxAllocations = distributeRandomly(this.dirichletN, this.dirichletK);
        this.render();
      });
    }

    const btnClear = this.container.querySelector('#btnDirichletClear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.boxAllocations = new Array(this.dirichletK).fill(0);
        this.dirichletN = 0;
        this.render();
      });
    }

    const btnToggleProof = this.container.querySelector('#btnToggleProof');
    if (btnToggleProof) {
      btnToggleProof.addEventListener('click', () => {
        this.showProof = !this.showProof;
        this.render();
      });
    }

    const btnAddPigeons = this.container.querySelectorAll('.btn-add-pigeon');
    btnAddPigeons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-box-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.boxAllocations.length) {
          this.boxAllocations[idx]++;
          this.dirichletN = this.boxAllocations.reduce((a, b) => a + b, 0);
          this.render();
        }
      });
    });

    const btnRemovePigeons = this.container.querySelectorAll('.btn-remove-pigeon');
    btnRemovePigeons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-box-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.boxAllocations.length && this.boxAllocations[idx] > 0) {
          this.boxAllocations[idx]--;
          this.dirichletN = this.boxAllocations.reduce((a, b) => a + b, 0);
          this.render();
        }
      });
    });
  }

  _bindDirichletProblemsEvents() {
    const selScenario = this.container.querySelector('#selDirichletScenario');
    if (selScenario) {
      selScenario.addEventListener('change', (e) => {
        this.selectedScenario = e.target.value;
        this.render();
      });
    }

    const inputBirthdayPeriod = this.container.querySelector('#inputBirthdayPeriod');
    if (inputBirthdayPeriod) {
      inputBirthdayPeriod.addEventListener('change', (e) => {
        this.scenarioParams.birthday.period = e.target.value;
        this.render();
      });
    }

    const inputBirthdayTarget = this.container.querySelector('#inputBirthdayTarget');
    if (inputBirthdayTarget) {
      inputBirthdayTarget.addEventListener('input', (e) => {
        this.scenarioParams.birthday.targetSame = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }

    const inputBirthdayGiven = this.container.querySelector('#inputBirthdayGiven');
    if (inputBirthdayGiven) {
      inputBirthdayGiven.addEventListener('input', (e) => {
        this.scenarioParams.birthday.givenPeople = parseInt(e.target.value, 10) || 1;
        this.render();
      });
    }

    const inputSocksColors = this.container.querySelector('#inputSocksColors');
    if (inputSocksColors) {
      inputSocksColors.addEventListener('input', (e) => {
        this.scenarioParams.socks.colors = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }

    const inputSocksTarget = this.container.querySelector('#inputSocksTarget');
    if (inputSocksTarget) {
      inputSocksTarget.addEventListener('input', (e) => {
        this.scenarioParams.socks.targetMatch = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }

    const inputExamTarget = this.container.querySelector('#inputExamTarget');
    if (inputExamTarget) {
      inputExamTarget.addEventListener('input', (e) => {
        this.scenarioParams.exam_scores.targetSame = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }

    const inputExamClassSize = this.container.querySelector('#inputExamClassSize');
    if (inputExamClassSize) {
      inputExamClassSize.addEventListener('input', (e) => {
        this.scenarioParams.exam_scores.classSize = parseInt(e.target.value, 10) || 1;
        this.render();
      });
    }

    const inputSumPairsN = this.container.querySelector('#inputSumPairsN');
    if (inputSumPairsN) {
      inputSumPairsN.addEventListener('input', (e) => {
        this.scenarioParams.sum_pairs.n = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }

    const inputErdosN = this.container.querySelector('#inputErdosN');
    if (inputErdosN) {
      inputErdosN.addEventListener('input', (e) => {
        this.scenarioParams.erdos_szekeres.n = parseInt(e.target.value, 10) || 2;
        this.render();
      });
    }
  }

  _bindPascalEvents() {
    const subTabButtons = this.container.querySelectorAll('[data-pascal-tab]');
    subTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-pascal-tab');
        if (targetTab && targetTab !== this.pascalSubTab) {
          this.pascalSubTab = targetTab;
          this.render();
        }
      });
    });

    if (this.pascalSubTab === 'triangle') {
      this._bindPascalTriangleEvents();
    } else if (this.pascalSubTab === 'generators') {
      this._bindCombinatorialGeneratorEvents();
    }
  }

  _bindPascalTriangleEvents() {
    const rngRows = this.container.querySelector('#rngPascalRows');
    if (rngRows) {
      rngRows.addEventListener('input', (e) => {
        this.pascalRows = Math.max(3, Math.min(12, parseInt(e.target.value, 10) || 7));
        this.render();
      });
    }

    const selMod = this.container.querySelector('#selPascalMod');
    if (selMod) {
      selMod.addEventListener('change', (e) => {
        this.pascalModColor = e.target.value;
        this.render();
      });
    }

    const btnResetSelect = this.container.querySelector('#btnPascalResetSelect');
    if (btnResetSelect) {
      btnResetSelect.addEventListener('click', () => {
        this.pascalSelectedCell = null;
        this.render();
      });
    }

    const cells = this.container.querySelectorAll('.pascal-cell');
    cells.forEach(cell => {
      cell.addEventListener('click', () => {
        const n = parseInt(cell.getAttribute('data-n'), 10);
        const k = parseInt(cell.getAttribute('data-k'), 10);
        if (!isNaN(n) && !isNaN(k)) {
          this.pascalSelectedCell = { n, k };
          this.render();
        }
      });
    });
  }

  _bindCombinatorialGeneratorEvents() {
    const selType = this.container.querySelector('#selGeneratorType');
    if (selType) {
      selType.addEventListener('change', (e) => {
        this.generatorType = e.target.value;
        this._regenerateCombinatorialResults();
        this.render();
      });
    }

    const inputItems = this.container.querySelector('#inputGeneratorItems');
    if (inputItems) {
      inputItems.addEventListener('change', (e) => {
        this.generatorItemsStr = e.target.value || 'A, B, C';
        this._regenerateCombinatorialResults();
        this.render();
      });
    }

    const inputK = this.container.querySelector('#inputGeneratorK');
    if (inputK) {
      inputK.addEventListener('change', (e) => {
        this.generatorK = parseInt(e.target.value, 10) || 2;
        this._regenerateCombinatorialResults();
        this.render();
      });
    }

    const btnAll = this.container.querySelector('#btnGenAll');
    if (btnAll) {
      btnAll.addEventListener('click', () => {
        this._regenerateCombinatorialResults();
        this.render();
      });
    }

    const btnNext = this.container.querySelector('#btnGenNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (this.generatorResults.length > 0) {
          this.generatorCurrentStep = Math.min(this.generatorResults.length - 1, this.generatorCurrentStep + 1);
          this.render();
        }
      });
    }

    const btnPrev = this.container.querySelector('#btnGenPrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.generatorResults.length > 0) {
          this.generatorCurrentStep = Math.max(0, this.generatorCurrentStep - 1);
          this.render();
        }
      });
    }

    const badges = this.container.querySelectorAll('.combinatorics-config-badge');
    badges.forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.getAttribute('data-config-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.generatorResults.length) {
          this.generatorCurrentStep = idx;
          this.render();
        }
      });
    });
  }

  _regenerateCombinatorialResults() {
    const items = this.generatorItemsStr.split(',').map(s => s.trim()).filter(Boolean);
    const n = items.length;
    const k = Math.min(n, Math.max(1, this.generatorK));

    if (this.generatorType === 'permutation') {
      this.generatorResults = generateAllPermutations(items);
    } else if (this.generatorType === 'arrangement') {
      this.generatorResults = generateAllArrangements(items, k);
    } else if (this.generatorType === 'combination') {
      this.generatorResults = generateAllCombinations(items, k);
    } else if (this.generatorType === 'rep_arrangement') {
      this.generatorResults = generateAllArrangementsWithRepetition(items, k);
    } else if (this.generatorType === 'rep_combination') {
      this.generatorResults = generateAllCombinationsWithRepetition(items, k);
    }
    this.generatorCurrentStep = 0;
  }

  /**
   * Binds events for Tab 4 (Recurrence & Tower of Hanoi)
   */
  _bindRecurrenceEvents() {
    const subTabButtons = this.container.querySelectorAll('[data-recurrence-tab]');
    subTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-recurrence-tab');
        if (targetTab && targetTab !== this.recurrenceSubTab) {
          this._stopHanoiPlayback();
          this.recurrenceSubTab = targetTab;
          this.render();
        }
      });
    });

    if (this.recurrenceSubTab === 'solver') {
      this._bindRecurrenceSolverEvents();
    } else if (this.recurrenceSubTab === 'hanoi') {
      this._bindHanoiEvents();
    }
  }

  _bindRecurrenceSolverEvents() {
    const selPreset = this.container.querySelector('#selRecurrencePreset');
    if (selPreset) {
      selPreset.addEventListener('change', (e) => {
        const presetId = e.target.value;
        this.recurrencePresetId = presetId;
        if (presetId === 'custom') return;

        const preset = RECURRENCE_PRESETS.find(p => p.id === presetId);
        if (preset) {
          this.recurrenceOrder = 2;
          this.recurrenceC1 = preset.c1;
          this.recurrenceC2 = preset.c2;
          this.recurrenceA0 = preset.a0;
          this.recurrenceA1 = preset.a1;
          this.render();
        }
      });
    }

    const btnOrder1 = this.container.querySelector('#btnOrder1');
    if (btnOrder1) {
      btnOrder1.addEventListener('click', () => {
        this.recurrenceOrder = 1;
        this.recurrencePresetId = 'custom';
        this.render();
      });
    }

    const btnOrder2 = this.container.querySelector('#btnOrder2');
    if (btnOrder2) {
      btnOrder2.addEventListener('click', () => {
        this.recurrenceOrder = 2;
        this.recurrencePresetId = 'custom';
        this.render();
      });
    }

    const btnSolve = this.container.querySelector('#btnSolveRecurrence');
    if (btnSolve) {
      btnSolve.addEventListener('click', () => {
        const inputC1 = this.container.querySelector('#inputRecC1');
        const inputC2 = this.container.querySelector('#inputRecC2');
        const inputA0 = this.container.querySelector('#inputRecA0');
        const inputA1 = this.container.querySelector('#inputRecA1');
        const inputTerms = this.container.querySelector('#inputRecTerms');

        if (inputC1) this.recurrenceC1 = parseFloat(inputC1.value) || 1;
        if (inputC2) this.recurrenceC2 = parseFloat(inputC2.value) || 0;
        if (inputA0) this.recurrenceA0 = parseFloat(inputA0.value) || 0;
        if (inputA1) this.recurrenceA1 = parseFloat(inputA1.value) || 1;
        if (inputTerms) this.recurrenceNumTerms = parseInt(inputTerms.value, 10) || 12;

        this.recurrencePresetId = 'custom';
        this.render();
      });
    }
  }

  _bindHanoiEvents() {
    const totalMoves = Math.pow(2, this.hanoiN) - 1;

    // Disks count
    const numN = this.container.querySelector('#numHanoiN');
    if (numN) {
      numN.addEventListener('change', (e) => {
        this._stopHanoiPlayback();
        this.hanoiN = Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 3));
        this.hanoiStep = 0;
        this.render();
      });
    }

    // Step Scrubber
    const rngStep = this.container.querySelector('#rngHanoiStep');
    if (rngStep) {
      rngStep.addEventListener('input', (e) => {
        this._stopHanoiPlayback();
        this.hanoiStep = parseInt(e.target.value, 10) || 0;
        this.render();
      });
    }

    // Speed selector
    const selSpeed = this.container.querySelector('#selHanoiSpeed');
    if (selSpeed) {
      selSpeed.addEventListener('change', (e) => {
        this.hanoiSpeed = parseInt(e.target.value, 10) || 800;
        if (this.hanoiIsPlaying) {
          this._stopHanoiPlayback();
          this._startHanoiPlayback();
        }
      });
    }

    // Play / Pause
    const btnPlay = this.container.querySelector('#btnHanoiPlay');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        if (this.hanoiIsPlaying) {
          this._stopHanoiPlayback();
          this.render();
        } else {
          if (this.hanoiStep >= totalMoves) {
            this.hanoiStep = 0;
          }
          this._startHanoiPlayback();
          this.render();
        }
      });
    }

    // Step buttons
    const btnNext = this.container.querySelector('#btnHanoiNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this._stopHanoiPlayback();
        if (this.hanoiStep < totalMoves) {
          this.hanoiStep++;
          this.render();
        }
      });
    }

    const btnPrev = this.container.querySelector('#btnHanoiPrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this._stopHanoiPlayback();
        if (this.hanoiStep > 0) {
          this.hanoiStep--;
          this.render();
        }
      });
    }

    const btnReset = this.container.querySelector('#btnHanoiReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this._stopHanoiPlayback();
        this.hanoiStep = 0;
        this.render();
      });
    }

    const btnEnd = this.container.querySelector('#btnHanoiEnd');
    if (btnEnd) {
      btnEnd.addEventListener('click', () => {
        this._stopHanoiPlayback();
        this.hanoiStep = totalMoves;
        this.render();
      });
    }
  }

  _startHanoiPlayback() {
    this._stopHanoiPlayback();
    this.hanoiIsPlaying = true;
    const totalMoves = Math.pow(2, this.hanoiN) - 1;

    this.hanoiTimer = setInterval(() => {
      if (this.hanoiStep < totalMoves) {
        this.hanoiStep++;
        this.render();
      } else {
        this._stopHanoiPlayback();
        this.render();
      }
    }, this.hanoiSpeed);
  }

  _stopHanoiPlayback() {
    if (this.hanoiTimer) {
      clearInterval(this.hanoiTimer);
      this.hanoiTimer = null;
    }
    this.hanoiIsPlaying = false;
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }
}
