/**
 * @file RelationLabView.js
 * Chapter 4: Binary Relations Interactive Laboratory (Toán Rời Rạc - Chương 4: Quan Hệ)
 * 
 * Tab 1: Studio Ma trận Boolean & Đồ thị Quan hệ (3 trong 1 đồng bộ thời gian thực)
 * Tab 2: Thanh tra 4 Tính chất Quan hệ (Coming next)
 * Tab 3: Thuật toán Warshall & Bao đóng (Coming next)
 * Tab 4: Lớp Tương đương & Biểu đồ Hasse (Coming next)
 */

import {
  createEmptyMatrix,
  cloneMatrix,
  matrixToPairs,
  pairsToMatrix,
  computeDegrees,
  computeCircleLayout,
  computeEdgePath,
  RELATION_PRESETS,
  checkReflexive,
  checkSymmetric,
  checkAntisymmetric,
  checkTransitive,
  checkComparable,
  classifyRelation,
  makeReflexive,
  makeIrreflexive,
  makeSymmetric,
  makeAntisymmetric,
  computeTransitiveClosure,
  computeReflexiveClosure,
  computeSymmetricClosure,
  runWarshallAlgorithm,
  computeEquivalenceClasses,
  computeCoveringRelation,
  computePosetExtremes,
  computeHasseLayout,
  makeEquivalenceClosure,
  makePosetClosure,
} from '../../core/relation/RelationEngine.js';

export class RelationLabView {
  constructor({ container = null } = {}) {
    this.container = container;
    this.activeTab = 'matrix'; // 'matrix' | 'properties' | 'warshall' | 'hasse'

    // Default elements and preset (Divisibility on {1, 2, 3, 4, 6})
    const defaultPreset = RELATION_PRESETS[0];
    this.presetId = defaultPreset.id;
    this.elements = [...defaultPreset.elements];
    this.matrix = defaultPreset.buildMatrix();

    // Graph interaction state
    this.selectedSource = null;
    this.hoveredEdge = null; // { i, j }

    // Tab 2: Quiz challenge state
    this.quizMode = false;
    this.quizUserAnswers = {
      reflexive: false,
      symmetric: false,
      antisymmetric: false,
      transitive: false,
    };
    this.quizSubmitted = false;

    // Tab 3: Warshall Stepper & Closures state
    this.warshallStep = 0;
    this.warshallIsPlaying = false;
    this.warshallPlaySpeed = 1200; // ms
    this.warshallTimer = null;
    this.activeWarshallSubtab = 'warshall'; // 'warshall' | 'closures'

    // Tab 4: Equivalence & Hasse state
    this.activeTab4Subtab = 'hasse'; // 'hasse' | 'equivalence'
    this.hasseHoveredNode = null;

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
      <div class="relation-lab-container" style="max-width:1300px;margin:0 auto;padding:16px 24px 60px;">

        <!-- Main Tab Navigation Bar for Chapter 4 -->
        <div class="relation-tabs-bar" style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
          <button type="button" class="btn-tab ${this.activeTab === 'matrix' ? 'active' : ''}" data-tab="matrix" id="tabBtnMatrix" style="padding:8px 16px;border-radius:6px;font-size:13.5px;font-weight:700;cursor:pointer;">
            🔗 Ma trận Boolean & Đồ thị Quan hệ
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'properties' ? 'active' : ''}" data-tab="properties" id="tabBtnProperties" style="padding:8px 16px;border-radius:6px;font-size:13.5px;font-weight:600;cursor:pointer;opacity:${this.activeTab === 'properties' ? '1' : '0.7'};">
            🔍 Thanh tra 4 Tính chất Quan hệ
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'warshall' ? 'active' : ''}" data-tab="warshall" id="tabBtnWarshall" style="padding:8px 16px;border-radius:6px;font-size:13.5px;font-weight:600;cursor:pointer;opacity:${this.activeTab === 'warshall' ? '1' : '0.7'};">
            ⚡ Thuật toán Warshall & Bao đóng
          </button>
          <button type="button" class="btn-tab ${this.activeTab === 'hasse' ? 'active' : ''}" data-tab="hasse" id="tabBtnHasse" style="padding:8px 16px;border-radius:6px;font-size:13.5px;font-weight:600;cursor:pointer;opacity:${this.activeTab === 'hasse' ? '1' : '0.7'};">
            👑 Lớp Tương đương & Biểu đồ Hasse
          </button>
        </div>

        <!-- Tab 1: Boolean Matrix & Graph Representation Studio -->
        <div id="paneMatrix" style="display:${this.activeTab === 'matrix' ? 'block' : 'none'};">
          ${this.activeTab === 'matrix' ? this._renderMatrixStudio() : ''}
        </div>

        <!-- Tab 2: Properties Inspector & Classification Studio -->
        <div id="paneProperties" style="display:${this.activeTab === 'properties' ? 'block' : 'none'};">
          ${this.activeTab === 'properties' ? this._renderPropertiesInspector() : ''}
        </div>

        <!-- Tab 3: Warshall Algorithm & Closures Studio -->
        <div id="paneWarshall" style="display:${this.activeTab === 'warshall' ? 'block' : 'none'};">
          ${this.activeTab === 'warshall' ? this._renderWarshallStudio() : ''}
        </div>

        <!-- Tab 4: Equivalence & Hasse Studio -->
        <div id="paneHasse" style="display:${this.activeTab === 'hasse' ? 'block' : 'none'};">
          ${this.activeTab === 'hasse' ? this._renderHasseStudio() : ''}
        </div>

      </div>
    `;

    this._bindEvents();
  }

  // =========================================================================
  // TAB 1: BOOLEAN MATRIX & GRAPH STUDIO
  // =========================================================================

  _renderMatrixStudio() {
    const n = this.elements.length;
    const pairs = matrixToPairs(this.matrix, this.elements);
    const degrees = computeDegrees(this.matrix, this.elements);
    const preset = RELATION_PRESETS.find(p => p.id === this.presetId);

    return `
      <!-- Preset & Control Ribbon -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          
          <!-- Presets -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.3px;">Mẫu quan hệ:</span>
            <select id="selRelationPreset" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px 12px;font-size:13px;cursor:pointer;max-width:380px;">
              <option value="custom">✏️ Tuỳ chỉnh tự do</option>
              ${RELATION_PRESETS.map(p => `
                <option value="${p.id}" ${this.presetId === p.id ? 'selected' : ''}>${p.title}</option>
              `).join('')}
            </select>
          </div>

          <!-- Elements Control -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="font-size:13px;font-weight:700;color:var(--text);background:var(--card-bg);padding:5px 12px;border-radius:6px;border:1px solid var(--line);">
              Tập A = {${this.elements.join(', ')}} (|A| = ${n})
            </div>
            <button type="button" class="btn-sm" id="btnAddElement" style="padding:4px 10px;font-size:12.5px;font-weight:600;" ${n >= 6 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Thêm phần tử vào tập A (Tối đa 6)">+ Phần tử</button>
            <button type="button" class="btn-sm" id="btnRemoveElement" style="padding:4px 10px;font-size:12.5px;font-weight:600;" ${n <= 2 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Bớt phần tử khỏi tập A (Tối thiểu 2)">- Phần tử</button>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-sm" id="btnClearMatrix" title="Đặt toàn bộ ô về 0">🧹 Xoá rỗng (M=0)</button>
            <button type="button" class="btn-sm" id="btnFillMatrix" title="Đặt toàn bộ ô về 1">⚡ Phủ kín (M=1)</button>
            <button type="button" class="btn-sm" id="btnDiagonalToggle" title="Bật/Tắt toàn bộ đường chéo chính">🔄 Bật đường chéo</button>
            <button type="button" class="btn-sm" id="btnRandomMatrix" title="Sinh ngẫu nhiên ma trận 0-1">🎲 Ngẫu nhiên</button>
          </div>

        </div>

        ${preset ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--dim);line-height:1.5;">
            💡 <b>Giải thích mẫu:</b> ${preset.description}
          </div>
        ` : ''}
      </div>

      <!-- Main 2-Column Split Workspace -->
      <div class="relation-workspace-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        
        <!-- Left: Interactive Boolean Matrix Panel -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 2px 0;">Ma trận Boolean M_R (${n} × ${n})</h3>
              <span style="font-size:12px;color:var(--dim);">Bấm trực tiếp vào từng ô để bật/tắt giá trị 0 ⟷ 1</span>
            </div>
            <div style="font-size:12.5px;font-weight:700;color:var(--blue-light);background:var(--card-bg);padding:4px 10px;border-radius:12px;border:1px solid var(--line);">
              Tổng số cặp: <b>${pairs.length}</b> / ${n * n}
            </div>
          </div>

          <!-- Matrix Grid Table -->
          <div style="display:flex;justify-content:center;padding:10px 0;overflow-x:auto;">
            <table class="relation-matrix-table" style="border-collapse:separate;border-spacing:5px;">
              <thead>
                <tr>
                  <th style="background:none;border:none;width:38px;height:38px;text-align:center;font-size:12px;color:var(--dim);font-family:monospace;">M_R</th>
                  ${this.elements.map((el, j) => `
                    <th style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;width:42px;height:42px;text-align:center;font-size:13.5px;font-weight:800;color:var(--blue-light);">
                      ${el}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${this.elements.map((rowEl, i) => `
                  <tr>
                    <th style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;width:42px;height:42px;text-align:center;font-size:13.5px;font-weight:800;color:var(--blue-light);">
                      ${rowEl}
                    </th>
                    ${this.elements.map((colEl, j) => {
                      const val = (this.matrix[i] && this.matrix[i][j]) || 0;
                      const isDiagonal = i === j;
                      const isHovered = this.hoveredEdge && this.hoveredEdge.i === i && this.hoveredEdge.j === j;

                      return `
                        <td>
                          <button type="button" 
                                  class="relation-matrix-cell ${val === 1 ? 'active' : ''} ${isDiagonal ? 'diagonal' : ''} ${isHovered ? 'hovered' : ''}" 
                                  data-i="${i}" 
                                  data-j="${j}"
                                  title="Cặp (${rowEl}, ${colEl}): Nhấp để đổi thành ${val === 1 ? '0' : '1'}">
                            ${val}
                          </button>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Relation Pairs Chips -->
          <div>
            <div style="font-size:12.5px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.3px;">
              Tập hợp các cặp quan hệ R = { (a, b) ∈ A² | a R b }:
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:100px;overflow-y:auto;background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--line);min-height:44px;align-content:flex-start;">
              ${pairs.length === 0 ? '<span style="font-size:12.5px;color:var(--dim);font-style:italic;margin:auto;">Quan hệ rỗng ∅. Chưa có cặp nào. Hãy bấm vào các ô trên ma trận!</span>' : ''}
              ${pairs.map(p => `
                <span class="relation-pair-chip" data-i="${p.i}" data-j="${p.j}" style="display:inline-flex;align-items:center;gap:6px;background:var(--panel-alt);border:1px solid var(--line);padding:3px 8px;border-radius:6px;font-family:monospace;font-size:12px;font-weight:600;">
                  <span>(${p.from}, ${p.to})</span>
                  <button type="button" class="btn-remove-pair" data-i="${p.i}" data-j="${p.j}" style="background:none;border:none;color:var(--dim);cursor:pointer;font-weight:bold;padding:0 2px;line-height:1;" title="Xoá cặp này">×</button>
                </span>
              `).join('')}
            </div>
          </div>

        </div>

        <!-- Right: Interactive Directed Graph Canvas -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:16px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 2px 0;">Đồ thị có hướng G_R = (V, E)</h3>
              <span style="font-size:12px;color:var(--dim);">
                ${this.selectedSource ? `Đang chọn nguồn <b style="color:var(--blue-light);">${this.selectedSource}</b>. Nhấp vào đỉnh đích để tạo/xoá cạnh!` : 'Nhấp vào đỉnh nguồn rồi nhấp đỉnh đích để nối cạnh!'}
              </span>
            </div>
            ${this.selectedSource ? `
              <button type="button" class="btn-sm" id="btnCancelGraphSelection" style="padding:2px 8px;font-size:11.5px;">Hủy chọn</button>
            ` : ''}
          </div>

          <!-- SVG Graph Display -->
          <div class="relation-svg-wrapper" style="width:100%;height:380px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;position:relative;overflow:hidden;">
            ${this._generateSvgGraph(n, pairs)}
          </div>

          <!-- Node Degrees Summary Table -->
          <div>
            <div style="font-size:12.5px;font-weight:700;color:var(--dim);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.3px;">
              Bảng Bậc đỉnh (In-degree d⁻ & Out-degree d⁺):
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${degrees.map(d => `
                <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:12.5px;display:flex;gap:8px;align-items:center;">
                  <span style="font-weight:800;color:var(--blue-light);">Đỉnh ${d.element}:</span>
                  <span style="color:var(--text);">d⁺ = <b>${d.outDegree}</b></span>
                  <span style="color:var(--dim);">|</span>
                  <span style="color:var(--text);">d⁻ = <b>${d.inDegree}</b></span>
                  ${d.hasSelfLoop ? '<span title="Có khuyên tự lặp" style="font-size:11px;">🔄</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  /**
   * Generates SVG Graph representation for Tab 1
   */
  _generateSvgGraph(n, pairs) {
    const width = 500;
    const height = 380;
    const cx = width / 2;
    const cy = height / 2;
    const radius = n <= 4 ? 120 : 135;
    const positions = computeCircleLayout(this.elements, width, height, radius);
    const nodeRadius = 22;

    // Check bidirectional pairs
    const pairSet = new Set(pairs.map(p => `${p.i}_${p.j}`));

    // Arrow markers
    const svgDefs = `
      <defs>
        <marker id="rel-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <polygon points="0 1, 8 4, 0 7" fill="#38bdf8" />
        </marker>
        <marker id="rel-arrowhead-hover" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <polygon points="0 1, 8 4, 0 7" fill="#f59e0b" />
        </marker>
      </defs>
    `;

    // Render edges
    const edgesHtml = pairs.map(p => {
      const srcPos = positions[p.from];
      const tgtPos = positions[p.to];
      if (!srcPos || !tgtPos) return '';

      const isSelfLoop = p.i === p.j;
      const isBidirectional = !isSelfLoop && pairSet.has(`${p.j}_${p.i}`);
      const isHovered = this.hoveredEdge && this.hoveredEdge.i === p.i && this.hoveredEdge.j === p.j;

      const pathData = computeEdgePath(srcPos, tgtPos, isSelfLoop, isBidirectional, nodeRadius, cx, cy);
      const strokeColor = isHovered ? 'var(--accent)' : '#38bdf8';
      const markerId = isHovered ? 'url(#rel-arrowhead-hover)' : 'url(#rel-arrowhead)';

      return `
        <g class="relation-edge-group" data-i="${p.i}" data-j="${p.j}" style="cursor:pointer;">
          <path d="${pathData}" fill="none" stroke="transparent" stroke-width="14" />
          <path class="relation-visible-edge" d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${isHovered ? '2.8' : '2'}" marker-end="${markerId}" style="transition:stroke 0.2s ease, stroke-width 0.2s ease;" />
        </g>
      `;
    }).join('');

    // Render nodes
    const nodesHtml = this.elements.map((el, idx) => {
      const pos = positions[el];
      const isSelected = this.selectedSource === el;

      return `
        <g class="relation-node-group" data-element="${el}" data-index="${idx}" style="cursor:pointer;" transform="translate(${pos.x}, ${pos.y})">
          ${isSelected ? `
            <circle r="${nodeRadius + 6}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="3 3">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite"/>
            </circle>
          ` : ''}
          <circle r="${nodeRadius}" fill="${isSelected ? '#0284c7' : 'var(--panel-alt)'}" stroke="${isSelected ? '#38bdf8' : 'var(--line)'}" stroke-width="2.2" />
          <text text-anchor="middle" dy="5.5" font-size="13.5" font-weight="800" fill="${isSelected ? '#ffffff' : 'var(--text)'}">${el}</text>
        </g>
      `;
    }).join('');

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="display:block;">
        ${svgDefs}
        ${edgesHtml}
        ${nodesHtml}
      </svg>
    `;
  }

  /**
   * Programmatically switches the active tab in RelationLabView.
   * @param {'matrix'|'properties'|'warshall'|'hasse'} tabId
   * @param {'hasse'|'equivalence'|null} [subtab]
   */
  setTab(tabId, subtab = null) {
    if (tabId && ['matrix', 'properties', 'warshall', 'hasse'].includes(tabId)) {
      if (this.activeTab === 'warshall') {
        this._stopWarshallPlay();
      }
      this.activeTab = tabId;
      if (subtab && ['hasse', 'equivalence'].includes(subtab)) {
        this.activeTab4Subtab = subtab;
      }
      this.render();
    }
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================

  _bindEvents() {
    if (!this.container) return;

    // 1. Tab Bar Navigation
    const tabButtons = this.container.querySelectorAll('.relation-tabs-bar .btn-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this.activeTab) {
          if (this.activeTab === 'warshall') {
            this._stopWarshallPlay();
          }
          this.activeTab = tab;
          this.render();
        }
      });
    });

    if (this.activeTab === 'matrix') {
      this._bindMatrixEvents();
    } else if (this.activeTab === 'properties') {
      this._bindPropertiesEvents();
    } else if (this.activeTab === 'warshall') {
      this._bindWarshallEvents();
    } else if (this.activeTab === 'hasse') {
      this._bindHasseEvents();
    }
  }

  _bindMatrixEvents() {
    // 1. Preset Selector
    const selPreset = this.container.querySelector('#selRelationPreset');
    if (selPreset) {
      selPreset.addEventListener('change', (e) => {
        const id = e.target.value;
        this.presetId = id;
        if (id === 'custom') return;

        const preset = RELATION_PRESETS.find(p => p.id === id);
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.selectedSource = null;
          this.render();
        }
      });
    }

    // 2. Add Element (+ Phần tử)
    const btnAdd = this.container.querySelector('#btnAddElement');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        if (this.elements.length >= 6) return;
        const newEl = String(this.elements.length + 1);
        this.elements.push(newEl);
        
        // Expand matrix with new row and column of 0s
        const n = this.elements.length;
        const newMatrix = createEmptyMatrix(n);
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j < n - 1; j++) {
            newMatrix[i][j] = this.matrix[i][j];
          }
        }
        this.matrix = newMatrix;
        this.presetId = 'custom';
        this.render();
      });
    }

    // 3. Remove Element (- Phần tử)
    const btnRemove = this.container.querySelector('#btnRemoveElement');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        if (this.elements.length <= 2) return;
        this.elements.pop();
        const n = this.elements.length;
        const newMatrix = createEmptyMatrix(n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            newMatrix[i][j] = this.matrix[i][j];
          }
        }
        this.matrix = newMatrix;
        this.presetId = 'custom';
        this.render();
      });
    }

    // 4. Quick Actions
    const btnClear = this.container.querySelector('#btnClearMatrix');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.matrix = createEmptyMatrix(this.elements.length);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnFill = this.container.querySelector('#btnFillMatrix');
    if (btnFill) {
      btnFill.addEventListener('click', () => {
        const n = this.elements.length;
        const m = createEmptyMatrix(n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            m[i][j] = 1;
          }
        }
        this.matrix = m;
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnDiagonal = this.container.querySelector('#btnDiagonalToggle');
    if (btnDiagonal) {
      btnDiagonal.addEventListener('click', () => {
        const n = this.elements.length;
        // Check if all diagonal are 1
        const allOne = this.elements.every((_, i) => this.matrix[i][i] === 1);
        const targetVal = allOne ? 0 : 1;
        for (let i = 0; i < n; i++) {
          this.matrix[i][i] = targetVal;
        }
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnRandom = this.container.querySelector('#btnRandomMatrix');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => {
        const n = this.elements.length;
        const m = createEmptyMatrix(n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            m[i][j] = Math.random() > 0.6 ? 1 : 0;
          }
        }
        this.matrix = m;
        this.presetId = 'custom';
        this.render();
      });
    }

    // 5. Matrix Cell Click (Toggle 0 <-> 1)
    const cells = this.container.querySelectorAll('.relation-matrix-cell');
    cells.forEach(c => {
      c.addEventListener('click', () => {
        const i = parseInt(c.getAttribute('data-i'), 10);
        const j = parseInt(c.getAttribute('data-j'), 10);
        if (!isNaN(i) && !isNaN(j) && this.matrix[i]) {
          this.matrix[i][j] = this.matrix[i][j] === 1 ? 0 : 1;
          this.presetId = 'custom';
          this.render();
        }
      });
    });

    // 6. Delete Pair Chip Button
    const deleteBtns = this.container.querySelectorAll('.btn-remove-pair');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(btn.getAttribute('data-i'), 10);
        const j = parseInt(btn.getAttribute('data-j'), 10);
        if (!isNaN(i) && !isNaN(j) && this.matrix[i]) {
          this.matrix[i][j] = 0;
          this.presetId = 'custom';
          this.render();
        }
      });
    });

    // 7. Interactive Graph Node Selection (Source -> Target)
    const nodes = this.container.querySelectorAll('.relation-node-group');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        const el = node.getAttribute('data-element');
        const idx = parseInt(node.getAttribute('data-index'), 10);

        if (!this.selectedSource) {
          // Select source
          this.selectedSource = el;
          this.render();
        } else {
          // Toggle edge from selectedSource to this el
          const srcIdx = this.elements.indexOf(this.selectedSource);
          const tgtIdx = idx;
          if (srcIdx !== -1 && tgtIdx !== -1 && this.matrix[srcIdx]) {
            this.matrix[srcIdx][tgtIdx] = this.matrix[srcIdx][tgtIdx] === 1 ? 0 : 1;
            this.selectedSource = null;
            this.presetId = 'custom';
            this.render();
          }
        }
      });
    });

    // 8. Cancel Selection Button
    const btnCancel = this.container.querySelector('#btnCancelGraphSelection');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.selectedSource = null;
        this.render();
      });
    }

    // 9. Edge Click to Remove
    const edges = this.container.querySelectorAll('.relation-edge-group');
    edges.forEach(edge => {
      edge.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(edge.getAttribute('data-i'), 10);
        const j = parseInt(edge.getAttribute('data-j'), 10);
        if (!isNaN(i) && !isNaN(j) && this.matrix[i]) {
          this.matrix[i][j] = 0;
          this.presetId = 'custom';
          this.render();
        }
      });
    });
  }

  // =========================================================================
  // TAB 2: PROPERTY INSPECTOR & CLASSIFICATION
  // =========================================================================

  _renderPropertiesInspector() {
    const analysis = classifyRelation(this.matrix, this.elements);
    const n = this.elements.length;
    const pairs = matrixToPairs(this.matrix, this.elements);
    const preset = RELATION_PRESETS.find(p => p.id === this.presetId);

    // If Quiz mode is active, render Quiz View
    if (this.quizMode) {
      return this._renderQuizChallenge(analysis, n, pairs);
    }

    const { reflexive, symmetric, antisymmetric, transitive } = analysis;

    return `
      <!-- Ribbon Bar: Preset, Set Info & Mode Switcher -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          
          <!-- Presets -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.3px;">Mẫu quan hệ:</span>
            <select id="selPropertiesPreset" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px 12px;font-size:13px;cursor:pointer;max-width:380px;">
              <option value="custom">✏️ Tuỳ chỉnh từ Tab 1</option>
              ${RELATION_PRESETS.map(p => `
                <option value="${p.id}" ${this.presetId === p.id ? 'selected' : ''}>${p.title}</option>
              `).join('')}
            </select>
          </div>

          <!-- Set Info Badge & Quiz Button -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="font-size:13px;font-weight:700;color:var(--text);background:var(--card-bg);padding:5px 12px;border-radius:6px;border:1px solid var(--line);">
              Tập A = {${this.elements.join(', ')}} (|A| = ${n}, |R| = ${pairs.length})
            </div>
            <button type="button" class="btn-primary" id="btnStartQuiz" style="padding:6px 14px;font-size:12.5px;font-weight:700;background:#a855f7;border-color:#9333ea;color:#fff;cursor:pointer;">
              🎯 Thử thách phán đoán tính chất
            </button>
          </div>

        </div>

        ${preset ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--dim);line-height:1.5;">
            💡 <b>Giải thích mẫu:</b> ${preset.description}
          </div>
        ` : ''}
      </div>

      <!-- Hero Verdict & Classification Banner -->
      <div class="relation-verdict-banner" style="background:var(--panel);border:1px solid ${analysis.badgeColor}66;border-left:5px solid ${analysis.badgeColor};border-radius:10px;padding:18px 22px;margin-bottom:20px;box-shadow:0 4px 14px rgba(0,0,0,0.15);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px;">
          <div style="flex:1;min-width:280px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:26px;">${analysis.icon}</span>
              <h2 style="font-size:18px;font-weight:800;color:var(--text);margin:0;" id="relationClassificationTitle">
                ${analysis.title}
              </h2>
            </div>
            <p style="font-size:13.5px;color:var(--text);margin:0 0 12px 0;line-height:1.55;opacity:0.9;">
              ${analysis.description}
            </p>
            
            <!-- Quick Summary Badges of 4 properties -->
            <div style="display:flex;flex-wrap:wrap;gap:8px;" id="relationPropertiesBadges">
              <span class="prop-badge prop-reflexive" style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${reflexive.isReflexive ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'};color:${reflexive.isReflexive ? '#10b981' : '#ef4444'};border:1px solid ${reflexive.isReflexive ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'};">
                ${reflexive.isReflexive ? '✓ Phản xạ' : '✗ Không phản xạ'}
              </span>
              <span class="prop-badge prop-symmetric" style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${symmetric.isSymmetric ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'};color:${symmetric.isSymmetric ? '#10b981' : '#ef4444'};border:1px solid ${symmetric.isSymmetric ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'};">
                ${symmetric.isSymmetric ? '✓ Đối xứng' : '✗ Không đối xứng'}
              </span>
              <span class="prop-badge prop-antisymmetric" style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${antisymmetric.isAntisymmetric ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'};color:${antisymmetric.isAntisymmetric ? '#10b981' : '#ef4444'};border:1px solid ${antisymmetric.isAntisymmetric ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'};">
                ${antisymmetric.isAntisymmetric ? '✓ Phản xứng' : '✗ Không phản xứng'}
              </span>
              <span class="prop-badge prop-transitive" style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${transitive.isTransitive ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'};color:${transitive.isTransitive ? '#10b981' : '#ef4444'};border:1px solid ${transitive.isTransitive ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'};">
                ${transitive.isTransitive ? '✓ Bắc cầu' : '✗ Không bắc cầu'}
              </span>
            </div>

          </div>
        </div>
      </div>

      <!-- 4 Property Inspector Cards (2x2 Grid) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px;" class="relation-cards-grid">
        
        <!-- CARD 1: REFLEXIVE -->
        <div class="property-inspector-card" id="cardReflexive" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">1. Tính Phản xạ (Reflexive)</h3>
              <span class="card-status-badge" style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;background:${reflexive.isReflexive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${reflexive.isReflexive ? '#10b981' : '#ef4444'};">
                ${reflexive.isReflexive ? 'Đạt ✅' : (reflexive.isIrreflexive ? 'Phi phản xạ ⚠️' : 'Không đạt ❌')}
              </span>
            </div>
            <div style="font-size:12px;color:var(--dim);margin-bottom:10px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
              Điều kiện: ∀x ∈ A, (x, x) ∈ R ⟺ Đường chéo M[i][i] = 1
            </div>
            
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px;">
                <span>Khuyên tự lặp: <b>${reflexive.selfLoopCount} / ${reflexive.totalElements}</b></span>
                <span style="font-weight:700;">${Math.round(reflexive.ratio * 100)}%</span>
              </div>
              <div style="width:100%;height:6px;background:var(--panel-alt);border-radius:3px;overflow:hidden;">
                <div style="width:${Math.round(reflexive.ratio * 100)}%;height:100%;background:${reflexive.isReflexive ? '#10b981' : 'var(--blue)'};transition:width 0.3s ease;"></div>
              </div>
            </div>

            ${!reflexive.isReflexive ? `
              <div style="font-size:12.5px;color:#ef4444;background:rgba(239,68,68,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(239,68,68,0.2);">
                <b>Phản ví dụ:</b> Đỉnh thiếu khuyên: <b>${reflexive.missingLoops.map(m => `(${m.element}, ${m.element}) ∉ R`).join(', ')}</b>
              </div>
            ` : `
              <div style="font-size:12.5px;color:#10b981;background:rgba(16,185,129,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(16,185,129,0.2);">
                ✓ Mọi đỉnh đều có khuyên tự lặp chính nó: ∀x ∈ A, x R x.
              </div>
            `}
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px;">
            <button type="button" class="btn-sm" id="btnMakeReflexive" style="font-size:11.5px;padding:4px 8px;cursor:pointer;" title="Đặt toàn bộ đường chéo chính thành 1">
              🔧 Sửa nhanh: Bật khuyên (Phản xạ)
            </button>
            <button type="button" class="btn-sm" id="btnMakeIrreflexive" style="font-size:11.5px;padding:4px 8px;cursor:pointer;" title="Đặt toàn bộ đường chéo chính thành 0">
              🧹 Xóa khuyên (Phi phản xạ)
            </button>
          </div>
        </div>

        <!-- CARD 2: SYMMETRIC -->
        <div class="property-inspector-card" id="cardSymmetric" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">2. Tính Đối xứng (Symmetric)</h3>
              <span class="card-status-badge" style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;background:${symmetric.isSymmetric ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${symmetric.isSymmetric ? '#10b981' : '#ef4444'};">
                ${symmetric.isSymmetric ? 'Đạt ✅' : 'Không đạt ❌'}
              </span>
            </div>
            <div style="font-size:12px;color:var(--dim);margin-bottom:10px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
              Điều kiện: (x, y) ∈ R ⟹ (y, x) ∈ R ⟺ Ma trận M = Mᵀ
            </div>

            ${!symmetric.isSymmetric ? `
              <div style="font-size:12.5px;color:#ef4444;background:rgba(239,68,68,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(239,68,68,0.2);max-height:85px;overflow-y:auto;">
                <b>Phản ví dụ (${symmetric.violations.length} cặp):</b><br>
                ${symmetric.violations.slice(0, 4).map(v => `• Có (${v.from}, ${v.to}) nhưng thiếu (${v.to}, ${v.from})`).join('<br>')}
                ${symmetric.violations.length > 4 ? `<br><i>...và còn ${symmetric.violations.length - 4} cặp khác</i>` : ''}
              </div>
            ` : `
              <div style="font-size:12.5px;color:#10b981;background:rgba(16,185,129,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(16,185,129,0.2);">
                ✓ Ma trận hoàn toàn đối xứng qua đường chéo chính (M = Mᵀ). Có đường đi xuôi luôn có đường đi ngược.
              </div>
            `}
          </div>

          <div style="border-top:1px solid var(--line);padding-top:10px;">
            <button type="button" class="btn-sm" id="btnMakeSymmetric" style="font-size:11.5px;padding:4px 8px;cursor:pointer;" title="Thêm tất cả các cặp nghịch đảo để đối xứng hóa (M ∨ Mᵀ)">
              🔧 Sửa nhanh: Đối xứng hoá (M ∨ Mᵀ)
            </button>
          </div>
        </div>

        <!-- CARD 3: ANTISYMMETRIC -->
        <div class="property-inspector-card" id="cardAntisymmetric" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">3. Tính Phản xứng (Antisymmetric)</h3>
              <span class="card-status-badge" style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;background:${antisymmetric.isAntisymmetric ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${antisymmetric.isAntisymmetric ? '#10b981' : '#ef4444'};">
                ${antisymmetric.isAntisymmetric ? 'Đạt ✅' : 'Không đạt ❌'}
              </span>
            </div>
            <div style="font-size:12px;color:var(--dim);margin-bottom:10px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
              Điều kiện: ((x, y) ∈ R ∧ (y, x) ∈ R) ⟹ x = y (Không có 2 chiều x ≠ y)
            </div>

            ${!antisymmetric.isAntisymmetric ? `
              <div style="font-size:12.5px;color:#ef4444;background:rgba(239,68,68,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(239,68,68,0.2);max-height:85px;overflow-y:auto;">
                <b>Phản ví dụ (${antisymmetric.violations.length} cặp hai chiều):</b><br>
                ${antisymmetric.violations.slice(0, 4).map(v => `• Tồn tại cả (${v.a}, ${v.b}) và (${v.b}, ${v.a}) với ${v.a} ≠ ${v.b}`).join('<br>')}
              </div>
            ` : `
              <div style="font-size:12.5px;color:#10b981;background:rgba(16,185,129,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(16,185,129,0.2);">
                ✓ Không có cặp đỉnh phân biệt nào tồn tại cả 2 cung ngược chiều.
              </div>
            `}
          </div>

          <div style="border-top:1px solid var(--line);padding-top:10px;">
            <button type="button" class="btn-sm" id="btnMakeAntisymmetric" style="font-size:11.5px;padding:4px 8px;cursor:pointer;" title="Triệt tiêu các cạnh hai chiều giữa các đỉnh khác nhau">
              🔧 Sửa nhanh: Triệt tiêu cạnh 2 chiều
            </button>
          </div>
        </div>

        <!-- CARD 4: TRANSITIVE -->
        <div class="property-inspector-card" id="cardTransitive" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">4. Tính Bắc cầu (Transitive)</h3>
              <span class="card-status-badge" style="font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;background:${transitive.isTransitive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${transitive.isTransitive ? '#10b981' : '#ef4444'};">
                ${transitive.isTransitive ? 'Đạt ✅' : 'Không đạt ❌'}
              </span>
            </div>
            <div style="font-size:12px;color:var(--dim);margin-bottom:10px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
              Điều kiện: ((x, y) ∈ R ∧ (y, z) ∈ R) ⟹ (x, z) ∈ R ⟺ M ⊙ M ≤ M
            </div>

            ${!transitive.isTransitive ? `
              <div style="font-size:12.5px;color:#ef4444;background:rgba(239,68,68,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(239,68,68,0.2);max-height:85px;overflow-y:auto;">
                <b>Phản ví dụ (${transitive.violations.length} bước nhảy hở):</b><br>
                ${transitive.violations.slice(0, 3).map(v => `• Có (${v.x}, ${v.y}) và (${v.y}, ${v.z}) nhưng THIẾU (${v.x}, ${v.z})`).join('<br>')}
                ${transitive.violations.length > 3 ? `<br><i>...và còn ${transitive.violations.length - 3} bộ ba khác</i>` : ''}
              </div>
            ` : `
              <div style="font-size:12.5px;color:#10b981;background:rgba(16,185,129,0.08);padding:8px 10px;border-radius:6px;margin-bottom:12px;border:1px solid rgba(16,185,129,0.2);">
                ✓ Mọi đường đi độ dài 2 qua đỉnh trung gian đều có cạnh tắt trực tiếp (M ⊙ M ≤ M).
              </div>
            `}
          </div>

          <div style="border-top:1px solid var(--line);padding-top:10px;">
            <button type="button" class="btn-sm" id="btnMakeTransitive" style="font-size:11.5px;padding:4px 8px;cursor:pointer;" title="Áp dụng thuật toán Roy-Warshall để tìm bao đóng bắc cầu">
              ⚡ Sửa nhanh: Bao đóng bắc cầu (Warshall)
            </button>
          </div>
        </div>

      </div>

      <!-- Quick Matrix & Pairs Synchronized Preview Strip -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <h4 style="font-size:13.5px;font-weight:700;color:var(--text);margin:0;">
            🔗 Ma trận M_R hiện thời (${n} × ${n}) & Tập cặp R:
          </h4>
          <span style="font-size:12px;color:var(--dim);">
            Nhấn các nút "Sửa nhanh" phía trên để quan sát ma trận tự động biến đổi
          </span>
        </div>

        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
          
          <!-- Mini Matrix Table -->
          <div style="overflow-x:auto;">
            <table class="relation-matrix-table" style="border-collapse:separate;border-spacing:3px;">
              <thead>
                <tr>
                  <th style="width:28px;height:28px;font-size:11px;color:var(--dim);font-family:monospace;">M</th>
                  ${this.elements.map(el => `
                    <th style="width:30px;height:30px;font-size:11.5px;font-weight:700;color:var(--blue-light);background:var(--card-bg);border:1px solid var(--line);border-radius:4px;text-align:center;">
                      ${el}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${this.elements.map((rowEl, i) => `
                  <tr>
                    <th style="width:30px;height:30px;font-size:11.5px;font-weight:700;color:var(--blue-light);background:var(--card-bg);border:1px solid var(--line);border-radius:4px;text-align:center;">
                      ${rowEl}
                    </th>
                    ${this.elements.map((colEl, j) => {
                      const val = (this.matrix[i] && this.matrix[i][j]) || 0;
                      const isDiag = i === j;
                      return `
                        <td style="width:30px;height:30px;text-align:center;font-family:monospace;font-size:12.5px;font-weight:800;border-radius:4px;background:${val === 1 ? 'var(--blue)' : 'var(--panel-alt)'};color:${val === 1 ? '#fff' : 'var(--dim)'};border:1px solid ${isDiag ? '#f59e0b' : 'var(--line)'};">
                          ${val}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mini Pairs List -->
          <div style="flex:1;min-width:240px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:160px;overflow-y:auto;">
            <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:6px;">
              TẬP CÁC CẶP (${pairs.length}):
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${pairs.length === 0 ? '<span style="font-size:12px;color:var(--dim);font-style:italic;">Quan hệ rỗng</span>' : ''}
              ${pairs.map(p => `
                <span style="font-family:monospace;font-size:11.5px;padding:2px 6px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
                  (${p.from}, ${p.to})
                </span>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  _renderQuizChallenge(analysis, n, pairs) {
    const { reflexive, symmetric, antisymmetric, transitive } = analysis;
    const ans = this.quizUserAnswers;

    let score = 0;
    if (this.quizSubmitted) {
      if (ans.reflexive === reflexive.isReflexive) score++;
      if (ans.symmetric === symmetric.isSymmetric) score++;
      if (ans.antisymmetric === antisymmetric.isAntisymmetric) score++;
      if (ans.transitive === transitive.isTransitive) score++;
    }

    return `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:22px;margin-bottom:20px;">
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:22px;">🎯</span>
              <h2 style="font-size:17px;font-weight:800;color:var(--text);margin:0;">
                Thử Thách: Tự Phán Đoán 4 Tính Chất Quan Hệ
              </h2>
            </div>
            <p style="font-size:12.5px;color:var(--dim);margin:4px 0 0 0;">
              Quan sát ma trận và các cặp quan hệ dưới đây, hãy phán đoán xem quan hệ này có những tính chất nào!
            </p>
          </div>
          <button type="button" class="btn-sm" id="btnExitQuiz" style="cursor:pointer;padding:6px 12px;font-size:12px;">
            ← Quay lại Thanh tra
          </button>
        </div>

        <!-- Matrix & Set Display for Challenge -->
        <div style="display:flex;gap:20px;align-items:center;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:18px;flex-wrap:wrap;">
          
          <!-- Mini Matrix -->
          <div style="overflow-x:auto;">
            <table class="relation-matrix-table" style="border-collapse:separate;border-spacing:3px;">
              <thead>
                <tr>
                  <th style="width:26px;height:26px;font-size:11px;color:var(--dim);font-family:monospace;">M</th>
                  ${this.elements.map(el => `
                    <th style="width:28px;height:28px;font-size:11.5px;font-weight:700;color:var(--blue-light);background:var(--panel);border:1px solid var(--line);border-radius:4px;text-align:center;">
                      ${el}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${this.elements.map((rowEl, i) => `
                  <tr>
                    <th style="width:28px;height:28px;font-size:11.5px;font-weight:700;color:var(--blue-light);background:var(--panel);border:1px solid var(--line);border-radius:4px;text-align:center;">
                      ${rowEl}
                    </th>
                    ${this.elements.map((colEl, j) => {
                      const val = (this.matrix[i] && this.matrix[i][j]) || 0;
                      return `
                        <td style="width:28px;height:28px;text-align:center;font-family:monospace;font-size:12px;font-weight:800;border-radius:4px;background:${val === 1 ? 'var(--blue)' : 'var(--panel-alt)'};color:${val === 1 ? '#fff' : 'var(--dim)'};border:1px solid var(--line);">
                          ${val}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Description and Elements -->
          <div style="flex:1;min-width:240px;">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;">
              Tập A = {${this.elements.join(', ')}} (|A| = ${n})
            </div>
            <div style="font-size:12px;color:var(--dim);margin-bottom:8px;">
              Tập các cặp R = { ${pairs.map(p => `(${p.from},${p.to})`).join(', ') || '∅'} }
            </div>
            <button type="button" class="btn-sm" id="btnQuizNewRandom" style="cursor:pointer;padding:4px 10px;font-size:11.5px;">
              🎲 Sinh quan hệ ngẫu nhiên khác
            </button>
          </div>

        </div>

        <!-- 4 Property Checkboxes -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;" class="quiz-options-grid">
          
          <!-- Opt 1: Reflexive -->
          <label class="quiz-option-card" style="display:flex;align-items:center;gap:10px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:12px;cursor:pointer;">
            <input type="checkbox" id="chkQuizReflexive" ${ans.reflexive ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text);">Tính Phản xạ (Reflexive)</div>
              <div style="font-size:11.5px;color:var(--dim);">Mọi phần tử đều tự quan hệ với chính nó: (x, x) ∈ R</div>
            </div>
          </label>

          <!-- Opt 2: Symmetric -->
          <label class="quiz-option-card" style="display:flex;align-items:center;gap:10px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:12px;cursor:pointer;">
            <input type="checkbox" id="chkQuizSymmetric" ${ans.symmetric ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text);">Tính Đối xứng (Symmetric)</div>
              <div style="font-size:11.5px;color:var(--dim);">Có chiều đi xuôi là phải có chiều đi ngược: (x, y) ∈ R ⇒ (y, x) ∈ R</div>
            </div>
          </label>

          <!-- Opt 3: Antisymmetric -->
          <label class="quiz-option-card" style="display:flex;align-items:center;gap:10px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:12px;cursor:pointer;">
            <input type="checkbox" id="chkQuizAntisymmetric" ${ans.antisymmetric ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text);">Tính Phản xứng (Antisymmetric)</div>
              <div style="font-size:11.5px;color:var(--dim);">Không có 2 chiều giữa 2 đỉnh khác nhau: (x, y) ∈ R và (y, x) ∈ R ⇒ x = y</div>
            </div>
          </label>

          <!-- Opt 4: Transitive -->
          <label class="quiz-option-card" style="display:flex;align-items:center;gap:10px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:12px;cursor:pointer;">
            <input type="checkbox" id="chkQuizTransitive" ${ans.transitive ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:var(--text);">Tính Bắc cầu (Transitive)</div>
              <div style="font-size:11.5px;color:var(--dim);">Đường đi qua trạm trung gian: (x, y) ∈ R và (y, z) ∈ R ⇒ (x, z) ∈ R</div>
            </div>
          </label>

        </div>

        <!-- Submit & Results -->
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn-primary" id="btnSubmitQuiz" style="padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;">
            ${this.quizSubmitted ? 'Chấm điểm lại' : 'Nộp bài & Kiểm tra đáp án'}
          </button>
        </div>

        ${this.quizSubmitted ? `
          <div class="quiz-results-box" style="margin-top:20px;padding:16px;border-radius:8px;border:1px solid var(--line);background:var(--card-bg);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin:0;" id="quizScoreText">
                Kết quả: ${score} / 4 câu đúng ${score === 4 ? '🎉 Tuyệt vời!' : (score >= 2 ? '👍 Rất khá!' : '💪 Hãy cố lên!')}
              </h3>
              <span style="font-size:12px;padding:3px 10px;border-radius:12px;background:${score === 4 ? '#10b981' : '#f59e0b'};color:#fff;font-weight:700;">
                Quan hệ này là: ${analysis.title}
              </span>
            </div>

            <!-- Detailed breakdown for each property -->
            <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
              <div style="padding:8px;border-radius:6px;background:${ans.reflexive === reflexive.isReflexive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border-left:4px solid ${ans.reflexive === reflexive.isReflexive ? '#10b981' : '#ef4444'};">
                <b>1. Phản xạ:</b> Đáp án đúng là <b>${reflexive.isReflexive ? 'CÓ' : 'KHÔNG'}</b>. Bạn chọn: <b>${ans.reflexive ? 'CÓ' : 'KHÔNG'}</b>.
                ${ans.reflexive === reflexive.isReflexive ? ' ✓ Chính xác!' : ` ✗ ${!reflexive.isReflexive ? `Đỉnh thiếu khuyên: ${reflexive.missingLoops.map(m => m.element).join(', ')}` : ''}`}
              </div>

              <div style="padding:8px;border-radius:6px;background:${ans.symmetric === symmetric.isSymmetric ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border-left:4px solid ${ans.symmetric === symmetric.isSymmetric ? '#10b981' : '#ef4444'};">
                <b>2. Đối xứng:</b> Đáp án đúng là <b>${symmetric.isSymmetric ? 'CÓ' : 'KHÔNG'}</b>. Bạn chọn: <b>${ans.symmetric ? 'CÓ' : 'KHÔNG'}</b>.
                ${ans.symmetric === symmetric.isSymmetric ? ' ✓ Chính xác!' : ` ✗ ${!symmetric.isSymmetric ? `Vi phạm: có (${symmetric.violations[0].from}, ${symmetric.violations[0].to}) nhưng thiếu (${symmetric.violations[0].to}, ${symmetric.violations[0].from})` : ''}`}
              </div>

              <div style="padding:8px;border-radius:6px;background:${ans.antisymmetric === antisymmetric.isAntisymmetric ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border-left:4px solid ${ans.antisymmetric === antisymmetric.isAntisymmetric ? '#10b981' : '#ef4444'};">
                <b>3. Phản xứng:</b> Đáp án đúng là <b>${antisymmetric.isAntisymmetric ? 'CÓ' : 'KHÔNG'}</b>. Bạn chọn: <b>${ans.antisymmetric ? 'CÓ' : 'KHÔNG'}</b>.
                ${ans.antisymmetric === antisymmetric.isAntisymmetric ? ' ✓ Chính xác!' : ` ✗ ${!antisymmetric.isAntisymmetric ? `Vi phạm: có cả (${antisymmetric.violations[0].a}, ${antisymmetric.violations[0].b}) và (${antisymmetric.violations[0].b}, ${antisymmetric.violations[0].a})` : ''}`}
              </div>

              <div style="padding:8px;border-radius:6px;background:${ans.transitive === transitive.isTransitive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border-left:4px solid ${ans.transitive === transitive.isTransitive ? '#10b981' : '#ef4444'};">
                <b>4. Bắc cầu:</b> Đáp án đúng là <b>${transitive.isTransitive ? 'CÓ' : 'KHÔNG'}</b>. Bạn chọn: <b>${ans.transitive ? 'CÓ' : 'KHÔNG'}</b>.
                ${ans.transitive === transitive.isTransitive ? ' ✓ Chính xác!' : ` ✗ ${!transitive.isTransitive ? `Vi phạm: có (${transitive.violations[0].x}, ${transitive.violations[0].y}) và (${transitive.violations[0].y}, ${transitive.violations[0].z}) nhưng thiếu (${transitive.violations[0].x}, ${transitive.violations[0].z})` : ''}`}
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  _bindPropertiesEvents() {
    // 1. Preset Selector in Tab 2
    const selPreset = this.container.querySelector('#selPropertiesPreset');
    if (selPreset) {
      selPreset.addEventListener('change', (e) => {
        const id = e.target.value;
        this.presetId = id;
        if (id === 'custom') return;

        const preset = RELATION_PRESETS.find(p => p.id === id);
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.selectedSource = null;
          this.quizSubmitted = false;
          this.render();
        }
      });
    }

    // 2. Start / Exit Quiz Challenge Mode
    const btnStartQuiz = this.container.querySelector('#btnStartQuiz');
    if (btnStartQuiz) {
      btnStartQuiz.addEventListener('click', () => {
        this.quizMode = true;
        this.quizSubmitted = false;
        this.quizUserAnswers = {
          reflexive: false,
          symmetric: false,
          antisymmetric: false,
          transitive: false,
        };
        this.render();
      });
    }

    const btnExitQuiz = this.container.querySelector('#btnExitQuiz');
    if (btnExitQuiz) {
      btnExitQuiz.addEventListener('click', () => {
        this.quizMode = false;
        this.render();
      });
    }

    // 3. Quick Repair buttons in Inspector
    const btnMakeReflexive = this.container.querySelector('#btnMakeReflexive');
    if (btnMakeReflexive) {
      btnMakeReflexive.addEventListener('click', () => {
        this.matrix = makeReflexive(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnMakeIrreflexive = this.container.querySelector('#btnMakeIrreflexive');
    if (btnMakeIrreflexive) {
      btnMakeIrreflexive.addEventListener('click', () => {
        this.matrix = makeIrreflexive(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnMakeSymmetric = this.container.querySelector('#btnMakeSymmetric');
    if (btnMakeSymmetric) {
      btnMakeSymmetric.addEventListener('click', () => {
        this.matrix = makeSymmetric(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnMakeAntisymmetric = this.container.querySelector('#btnMakeAntisymmetric');
    if (btnMakeAntisymmetric) {
      btnMakeAntisymmetric.addEventListener('click', () => {
        this.matrix = makeAntisymmetric(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnMakeTransitive = this.container.querySelector('#btnMakeTransitive');
    if (btnMakeTransitive) {
      btnMakeTransitive.addEventListener('click', () => {
        this.matrix = computeTransitiveClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    // 4. Quiz Mode Handlers
    const chkRef = this.container.querySelector('#chkQuizReflexive');
    if (chkRef) {
      chkRef.addEventListener('change', (e) => {
        this.quizUserAnswers.reflexive = e.target.checked;
      });
    }

    const chkSym = this.container.querySelector('#chkQuizSymmetric');
    if (chkSym) {
      chkSym.addEventListener('change', (e) => {
        this.quizUserAnswers.symmetric = e.target.checked;
      });
    }

    const chkAnti = this.container.querySelector('#chkQuizAntisymmetric');
    if (chkAnti) {
      chkAnti.addEventListener('change', (e) => {
        this.quizUserAnswers.antisymmetric = e.target.checked;
      });
    }

    const chkTrans = this.container.querySelector('#chkQuizTransitive');
    if (chkTrans) {
      chkTrans.addEventListener('change', (e) => {
        this.quizUserAnswers.transitive = e.target.checked;
      });
    }

    const btnSubmitQuiz = this.container.querySelector('#btnSubmitQuiz');
    if (btnSubmitQuiz) {
      btnSubmitQuiz.addEventListener('click', () => {
        if (chkRef) this.quizUserAnswers.reflexive = chkRef.checked;
        if (chkSym) this.quizUserAnswers.symmetric = chkSym.checked;
        if (chkAnti) this.quizUserAnswers.antisymmetric = chkAnti.checked;
        if (chkTrans) this.quizUserAnswers.transitive = chkTrans.checked;
        this.quizSubmitted = true;
        this.render();
      });
    }

    const btnQuizRandom = this.container.querySelector('#btnQuizNewRandom');
    if (btnQuizRandom) {
      btnQuizRandom.addEventListener('click', () => {
        this.elements = ['1', '2', '3'];
        const n = 3;
        const m = createEmptyMatrix(n);
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            m[i][j] = Math.random() > 0.6 ? 1 : 0;
          }
        }
        this.matrix = m;
        this.presetId = 'custom';
        this.quizSubmitted = false;
        this.quizUserAnswers = {
          reflexive: false,
          symmetric: false,
          antisymmetric: false,
          transitive: false,
        };
        this.render();
      });
    }
  }

  // =========================================================================
  // TAB 3: ROY-WARSHALL ALGORITHM & CLOSURES STUDIO
  // =========================================================================

  _renderWarshallStudio() {
    const n = this.elements.length;
    const preset = RELATION_PRESETS.find(p => p.id === this.presetId);

    return `
      <!-- Ribbon Bar: Preset, Elements Info & Subtabs -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
          
          <!-- Preset selector -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.3px;">Mẫu quan hệ:</span>
            <select id="selWarshallPreset" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px 12px;font-size:13px;cursor:pointer;max-width:380px;">
              <option value="custom">✏️ Tuỳ chỉnh từ Tab 1</option>
              ${RELATION_PRESETS.map(p => `
                <option value="${p.id}" ${this.presetId === p.id ? 'selected' : ''}>${p.title}</option>
              `).join('')}
            </select>
          </div>

          <!-- Subtab Toggle Buttons -->
          <div style="display:flex;align-items:center;gap:8px;background:var(--card-bg);padding:4px;border-radius:8px;border:1px solid var(--line);">
            <button type="button" class="btn-sm ${this.activeWarshallSubtab === 'warshall' ? 'btn-primary' : ''}" id="btnSubtabWarshall" style="font-size:12.5px;padding:5px 12px;cursor:pointer;">
              ⚡ Thuật toán Roy-Warshall từng bước
            </button>
            <button type="button" class="btn-sm ${this.activeWarshallSubtab === 'closures' ? 'btn-primary' : ''}" id="btnSubtabClosures" style="font-size:12.5px;padding:5px 12px;cursor:pointer;">
              🔄 So sánh 3 Loại Bao đóng
            </button>
          </div>

        </div>

        ${preset ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--dim);line-height:1.5;">
            💡 <b>Gợi ý:</b> Mẫu <i>"Vòng lặp định hướng (1 ➔ 2 ➔ 3 ➔ 4 ➔ 1)"</i> là bài tập kinh điển nhất để quan sát thuật toán Warshall từng bước bổ sung các cung gián tiếp cho đến khi phủ kín đồ thị!
          </div>
        ` : ''}
      </div>

      <!-- Main Content according to active subtab -->
      ${this.activeWarshallSubtab === 'warshall' ? this._renderWarshallStepper(n) : this._renderClosuresComparison(n)}
    `;
  }

  _renderWarshallStepper(n) {
    const warshallData = runWarshallAlgorithm(this.matrix, this.elements);
    const maxStep = warshallData.steps.length - 1;
    if (this.warshallStep > maxStep) this.warshallStep = maxStep;

    const currentStep = warshallData.steps[this.warshallStep];
    const isAtStart = this.warshallStep === 0;
    const isAtEnd = this.warshallStep === maxStep;
    const newEdgesCountAtStep = currentStep.newEdges.length;
    const cumulativeNewEdges = warshallData.steps.slice(1, this.warshallStep + 1).reduce((acc, s) => acc + s.newEdges.length, 0);

    return `
      <!-- Stepper Player Controller Bar -->
      <div class="warshall-controls-bar" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        
        <!-- Navigation Buttons -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn-sm" id="btnWarshallFirst" ${isAtStart ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Về ma trận ban đầu W0">
            ⏮ Về W₀
          </button>
          <button type="button" class="btn-sm" id="btnWarshallPrev" ${isAtStart ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Lùi 1 bước">
            ◀ Lùi
          </button>
          <button type="button" class="btn-primary" id="btnWarshallPlay" style="padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;background:${this.warshallIsPlaying ? '#f59e0b' : 'var(--blue)'};border-color:${this.warshallIsPlaying ? '#d97706' : 'var(--blue-light)'};">
            ${this.warshallIsPlaying ? '⏸ Tạm dừng' : '▶ Tự động chạy'}
          </button>
          <button type="button" class="btn-sm" id="btnWarshallNext" ${isAtEnd ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Tiến 1 bước">
            Tiếp ▶
          </button>
          <button type="button" class="btn-sm" id="btnWarshallLast" ${isAtEnd ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : 'style="cursor:pointer;"'} title="Tới ma trận bao đóng cuối cùng Wn">
            W_n ⏭
          </button>
        </div>

        <!-- Speed and Step Indicator -->
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dim);">
            <span>Tốc độ:</span>
            <select id="selWarshallSpeed" style="background:var(--panel-alt);color:var(--text);border:1px solid var(--line);border-radius:4px;padding:3px 6px;font-size:12px;cursor:pointer;">
              <option value="2000" ${this.warshallPlaySpeed === 2000 ? 'selected' : ''}>0.5x (Chậm)</option>
              <option value="1200" ${this.warshallPlaySpeed === 1200 ? 'selected' : ''}>1x (Vừa)</option>
              <option value="600" ${this.warshallPlaySpeed === 600 ? 'selected' : ''}>2x (Nhanh)</option>
            </select>
          </div>

          <div id="warshallStepIndicator" style="font-size:13px;font-weight:800;background:var(--card-bg);border:1px solid var(--line);padding:5px 12px;border-radius:6px;color:var(--blue-light);">
            ${isAtStart ? `Bước 0 / ${maxStep}: W₀ (Gốc)` : `Bước ${this.warshallStep} / ${maxStep}: Đỉnh '${currentStep.pivotElement}'`}
          </div>
        </div>

      </div>

      <!-- 2-Column Split Stepper Workspace -->
      <div class="relation-workspace-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        
        <!-- Left: Matrix W_k Table -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:14px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0;" id="warshallMatrixTitle">
                Ma trận W_${this.warshallStep} (${n} × ${n})
              </h3>
              <span style="font-size:12px;color:var(--dim);">
                ${isAtStart ? 'Ma trận quan hệ ban đầu M_R' : `Xét giao giữa Cột '${currentStep.pivotElement}' và Hàng '${currentStep.pivotElement}'`}
              </span>
            </div>
            <div style="font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:4px 8px;border-radius:6px;border:1px solid rgba(16,185,129,0.25);">
              +${newEdgesCountAtStep} cung mới (Tổng: +${cumulativeNewEdges})
            </div>
          </div>

          <!-- Color-coded Matrix Grid -->
          <div style="display:flex;justify-content:center;padding:10px 0;overflow-x:auto;">
            <table class="relation-matrix-table" id="warshallMatrixTable" style="border-collapse:separate;border-spacing:5px;">
              <thead>
                <tr>
                  <th style="background:none;border:none;width:38px;height:38px;text-align:center;font-size:12px;color:var(--dim);font-family:monospace;">
                    W_${this.warshallStep}
                  </th>
                  ${this.elements.map((el, j) => {
                    const isPivotCol = currentStep.pivotIndex === j;
                    return `
                      <th style="background:${isPivotCol ? 'rgba(56, 189, 248, 0.25)' : 'var(--card-bg)'};border:1px solid ${isPivotCol ? 'var(--blue-light)' : 'var(--line)'};border-radius:6px;width:42px;height:42px;text-align:center;font-size:13.5px;font-weight:800;color:${isPivotCol ? '#38bdf8' : 'var(--text)'};">
                        ${el}
                      </th>
                    `;
                  }).join('')}
                </tr>
              </thead>
              <tbody>
                ${this.elements.map((rowEl, i) => {
                  const isPivotRow = currentStep.pivotIndex === i;
                  return `
                    <tr>
                      <th style="background:${isPivotRow ? 'rgba(245, 158, 11, 0.25)' : 'var(--card-bg)'};border:1px solid ${isPivotRow ? '#f59e0b' : 'var(--line)'};border-radius:6px;width:42px;height:42px;text-align:center;font-size:13.5px;font-weight:800;color:${isPivotRow ? '#f59e0b' : 'var(--text)'};">
                        ${rowEl}
                      </th>
                      ${this.elements.map((colEl, j) => {
                        const val = currentStep.matrix[i][j];
                        const isPivotCol = currentStep.pivotIndex === j;
                        const isNew = currentStep.newEdges.some(e => e.i === i && e.j === j);
                        const isIntersection = isPivotRow && isPivotCol;

                        let bg = 'var(--panel-alt)';
                        let color = 'var(--dim)';
                        let border = '1px solid var(--line)';
                        let boxShadow = 'none';

                        if (isNew) {
                          bg = '#10b981';
                          color = '#ffffff';
                          border = '2px solid #34d399';
                          boxShadow = '0 0 10px rgba(16, 185, 129, 0.6)';
                        } else if (val === 1) {
                          bg = 'var(--blue)';
                          color = '#ffffff';
                          border = '1px solid var(--blue-light)';
                        } else if (isPivotRow && isPivotCol) {
                          bg = 'rgba(245, 158, 11, 0.2)';
                          border = '2px solid #f59e0b';
                        } else if (isPivotCol) {
                          bg = 'rgba(56, 189, 248, 0.1)';
                          border = '1px dashed rgba(56, 189, 248, 0.4)';
                        } else if (isPivotRow) {
                          bg = 'rgba(245, 158, 11, 0.1)';
                          border = '1px dashed rgba(245, 158, 11, 0.4)';
                        }

                        return `
                          <td>
                            <div class="relation-matrix-cell ${isNew ? 'warshall-cell-new' : ''}" 
                                 style="background:${bg} !important;color:${color} !important;border:${border} !important;box-shadow:${boxShadow} !important;cursor:default;"
                                 title="Cặp (${rowEl}, ${colEl}): ${val}${isNew ? ' (Vừa được thêm tại bước này!)' : ''}">
                              ${val}
                            </div>
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Color Legend Guide -->
          <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:10px 14px;font-size:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;background:rgba(56, 189, 248, 0.35);border:1px solid #38bdf8;border-radius:2px;"></span>
              <span>Cột ${currentStep.pivotElement || 'k'} (Đỉnh đi tới)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;background:rgba(245, 158, 11, 0.35);border:1px solid #f59e0b;border-radius:2px;"></span>
              <span>Hàng ${currentStep.pivotElement || 'k'} (Đỉnh đi ra)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;background:#10b981;border:1px solid #34d399;border-radius:2px;"></span>
              <span style="font-weight:700;color:#10b981;">Cung mới sinh ra (0 ➔ 1)</span>
            </div>
          </div>

        </div>

        <!-- Right: Graph & Step Explanation Panel -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:14px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0;">
              Đồ thị G_(W_${this.warshallStep})
            </h3>
            <span style="font-size:12px;color:var(--dim);">
              ${currentStep.pivotElement ? `Đang xét qua đỉnh trung gian <b style="color:#f59e0b;">${currentStep.pivotElement}</b>` : 'Trạng thái ban đầu'}
            </span>
          </div>

          <!-- Mini SVG Graph with New Edges highlighted -->
          <div class="warshall-svg-wrapper" style="width:100%;height:270px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;position:relative;overflow:hidden;">
            ${this._renderWarshallSvgGraph(n, currentStep)}
          </div>

          <!-- Mathematical Explanation Box -->
          <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:8px;padding:14px;font-size:12.5px;line-height:1.55;">
            <div style="font-weight:800;color:var(--blue-light);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>💡 Phân tích bước ${this.warshallStep}:</span>
            </div>
            <div style="color:var(--text);white-space:pre-line;">
              ${currentStep.explanation}
            </div>
          </div>

          <!-- Bottom Action: Apply Closure to Lab -->
          <div style="margin-top:auto;">
            <button type="button" class="btn-primary" id="btnApplyWarshallToLab" style="width:100%;padding:9px 0;font-size:13px;font-weight:700;background:#10b981;border-color:#059669;color:#fff;cursor:pointer;">
              ✅ Đặt ma trận bao đóng W_${maxStep} này làm quan hệ chính của Lab
            </button>
          </div>

        </div>

      </div>
    `;
  }

  _renderWarshallSvgGraph(n, currentStep) {
    const width = 450;
    const height = 270;
    const cx = width / 2;
    const cy = height / 2;
    const radius = n <= 4 ? 90 : 100;
    const positions = computeCircleLayout(this.elements, width, height, radius);
    const nodeRadius = 18;
    const pairs = matrixToPairs(currentStep.matrix, this.elements);
    const pairSet = new Set(pairs.map(p => `${p.i}_${p.j}`));

    const svgDefs = `
      <defs>
        <marker id="warshall-arrow-normal" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 1, 7 3.5, 0 6" fill="#38bdf8" />
        </marker>
        <marker id="warshall-arrow-new" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <polygon points="0 1, 8 4, 0 7" fill="#10b981" />
        </marker>
      </defs>
    `;

    const edgesHtml = pairs.map(p => {
      const srcPos = positions[p.from];
      const tgtPos = positions[p.to];
      if (!srcPos || !tgtPos) return '';

      const isSelfLoop = p.i === p.j;
      const isBidirectional = !isSelfLoop && pairSet.has(`${p.j}_${p.i}`);
      const isNew = currentStep.newEdges.some(e => e.i === p.i && e.j === p.j);

      const pathData = computeEdgePath(srcPos, tgtPos, isSelfLoop, isBidirectional, nodeRadius, cx, cy);
      const strokeColor = isNew ? '#10b981' : '#38bdf8';
      const strokeWidth = isNew ? '3' : '1.8';
      const markerId = isNew ? 'url(#warshall-arrow-new)' : 'url(#warshall-arrow-normal)';

      return `
        <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="${markerId}" style="transition:all 0.25s ease;" />
      `;
    }).join('');

    const nodesHtml = this.elements.map((el, idx) => {
      const pos = positions[el];
      const isPivot = currentStep.pivotIndex === idx;

      return `
        <g class="warshall-node-group" transform="translate(${pos.x}, ${pos.y})">
          ${isPivot ? `
            <circle r="${nodeRadius + 6}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3 3">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/>
            </circle>
          ` : ''}
          <circle r="${nodeRadius}" fill="${isPivot ? '#d97706' : 'var(--panel-alt)'}" stroke="${isPivot ? '#f59e0b' : 'var(--line)'}" stroke-width="2" />
          <text text-anchor="middle" dy="4.5" font-size="12" font-weight="800" fill="${isPivot ? '#ffffff' : 'var(--text)'}">${el}</text>
        </g>
      `;
    }).join('');

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="display:block;">
        ${svgDefs}
        ${edgesHtml}
        ${nodesHtml}
      </svg>
    `;
  }

  _renderClosuresComparison(n) {
    const rawPairs = matrixToPairs(this.matrix, this.elements);
    const refClosure = computeReflexiveClosure(this.matrix);
    const refPairs = matrixToPairs(refClosure, this.elements);
    const symClosure = computeSymmetricClosure(this.matrix);
    const symPairs = matrixToPairs(symClosure, this.elements);
    const transClosure = computeTransitiveClosure(this.matrix);
    const transPairs = matrixToPairs(transClosure, this.elements);

    return `
      <div style="margin-bottom:20px;">
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:18px;">
          <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 6px 0;">
            Bộ Ba Bao Đóng Cơ Bản của Quan Hệ Nhị Phân R trên tập A
          </h3>
          <p style="font-size:13px;color:var(--dim);margin:0;line-height:1.5;">
            Bao đóng của quan hệ R theo một tính chất P là quan hệ nhỏ nhất chứa R và thỏa mãn tính chất P. Dưới đây là 3 dạng bao đóng kinh điển:
          </p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;" class="relation-cards-grid">
          
          <!-- CARD 1: REFLEXIVE CLOSURE -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">1. Bao đóng Phản xạ r(R)</h4>
                <span style="font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:6px;">
                  +${refPairs.length - rawPairs.length} khuyên
                </span>
              </div>
              <div style="font-size:12px;color:var(--dim);margin-bottom:12px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
                Công thức: r(R) = R ∪ Δ_A ⟺ M_{r(R)} = M_R ∨ I_n
              </div>
              <p style="font-size:12.5px;color:var(--text);margin:0 0 12px 0;line-height:1.45;">
                Bổ sung tất cả các khuyên tự lặp $(x, x)$ còn thiếu trên đường chéo chính.
              </p>
            </div>
            <button type="button" class="btn-sm" id="btnApplyReflexiveClosure" style="width:100%;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;">
              Áp dụng r(R) làm quan hệ chính
            </button>
          </div>

          <!-- CARD 2: SYMMETRIC CLOSURE -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">2. Bao đóng Đối xứng s(R)</h4>
                <span style="font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:6px;">
                  +${symPairs.length - rawPairs.length} cung đảo
                </span>
              </div>
              <div style="font-size:12px;color:var(--dim);margin-bottom:12px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
                Công thức: s(R) = R ∪ R⁻¹ ⟺ M_{s(R)} = M_R ∨ M_Rᵀ
              </div>
              <p style="font-size:12.5px;color:var(--text);margin:0 0 12px 0;line-height:1.45;">
                Với mọi cung $(a, b) \in R$, nếu chưa có cung ngược chiều $(b, a)$ thì bổ sung thêm $(b, a)$.
              </p>
            </div>
            <button type="button" class="btn-sm" id="btnApplySymmetricClosure" style="width:100%;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;">
              Áp dụng s(R) làm quan hệ chính
            </button>
          </div>

          <!-- CARD 3: TRANSITIVE CLOSURE -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;grid-column:span 2;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="font-size:15px;font-weight:800;color:var(--text);margin:0;">3. Bao đóng Bắc cầu t(R) (Roy-Warshall Closure)</h4>
                <span style="font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 8px;border-radius:6px;">
                  +${transPairs.length - rawPairs.length} đường tắt
                </span>
              </div>
              <div style="font-size:12px;color:var(--dim);margin-bottom:12px;font-family:monospace;background:var(--card-bg);padding:4px 8px;border-radius:4px;border:1px solid var(--line);">
                Công thức: t(R) = R ∪ R² ∪ ... ∪ Rⁿ ⟺ M_{t(R)} = W_n
              </div>
              <p style="font-size:12.5px;color:var(--text);margin:0 0 12px 0;line-height:1.45;">
                Nối tắt tất cả các cặp đỉnh có đường đi gián tiếp qua bất kỳ dãy đỉnh trung gian nào trong đồ thị.
              </p>
            </div>
            <button type="button" class="btn-primary" id="btnApplyTransitiveClosure" style="width:100%;padding:8px 0;font-size:12.5px;font-weight:700;cursor:pointer;background:#10b981;border-color:#059669;color:#fff;">
              Áp dụng t(R) làm quan hệ chính
            </button>
          </div>

        </div>
      </div>
    `;
  }

  _bindWarshallEvents() {
    // 1. Preset Selector
    const selPreset = this.container.querySelector('#selWarshallPreset');
    if (selPreset) {
      selPreset.addEventListener('change', (e) => {
        const id = e.target.value;
        this.presetId = id;
        if (id === 'custom') return;

        const preset = RELATION_PRESETS.find(p => p.id === id);
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.warshallStep = 0;
          this._stopWarshallPlay();
        }
      });
    }

    // 2. Subtab toggles
    const btnWarshall = this.container.querySelector('#btnSubtabWarshall');
    if (btnWarshall) {
      btnWarshall.addEventListener('click', () => {
        this.activeWarshallSubtab = 'warshall';
        this._stopWarshallPlay();
      });
    }

    const btnClosures = this.container.querySelector('#btnSubtabClosures');
    if (btnClosures) {
      btnClosures.addEventListener('click', () => {
        this.activeWarshallSubtab = 'closures';
        this._stopWarshallPlay();
      });
    }

    // 3. Stepper player buttons
    const warshallData = runWarshallAlgorithm(this.matrix, this.elements);
    const maxStep = warshallData.steps.length - 1;

    const btnFirst = this.container.querySelector('#btnWarshallFirst');
    if (btnFirst) {
      btnFirst.addEventListener('click', () => {
        this._stopWarshallPlay();
        this.warshallStep = 0;
        this.render();
      });
    }

    const btnPrev = this.container.querySelector('#btnWarshallPrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this._stopWarshallPlay();
        if (this.warshallStep > 0) {
          this.warshallStep--;
          this.render();
        }
      });
    }

    const btnPlay = this.container.querySelector('#btnWarshallPlay');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        if (this.warshallIsPlaying) {
          this._stopWarshallPlay();
        } else {
          this._startWarshallPlay();
        }
      });
    }

    const btnNext = this.container.querySelector('#btnWarshallNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this._stopWarshallPlay();
        if (this.warshallStep < maxStep) {
          this.warshallStep++;
          this.render();
        }
      });
    }

    const btnLast = this.container.querySelector('#btnWarshallLast');
    if (btnLast) {
      btnLast.addEventListener('click', () => {
        this._stopWarshallPlay();
        this.warshallStep = maxStep;
        this.render();
      });
    }

    const selSpeed = this.container.querySelector('#selWarshallSpeed');
    if (selSpeed) {
      selSpeed.addEventListener('change', (e) => {
        this.warshallPlaySpeed = parseInt(e.target.value, 10) || 1200;
        if (this.warshallIsPlaying) {
          this._startWarshallPlay();
        }
      });
    }

    // 4. Apply buttons
    const btnApplyWarshall = this.container.querySelector('#btnApplyWarshallToLab');
    if (btnApplyWarshall) {
      btnApplyWarshall.addEventListener('click', () => {
        this._stopWarshallPlay();
        this.matrix = warshallData.finalMatrix;
        this.presetId = 'custom';
        this.activeTab = 'matrix';
        this.render();
      });
    }

    const btnApplyRef = this.container.querySelector('#btnApplyReflexiveClosure');
    if (btnApplyRef) {
      btnApplyRef.addEventListener('click', () => {
        this.matrix = computeReflexiveClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnApplySym = this.container.querySelector('#btnApplySymmetricClosure');
    if (btnApplySym) {
      btnApplySym.addEventListener('click', () => {
        this.matrix = computeSymmetricClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnApplyTrans = this.container.querySelector('#btnApplyTransitiveClosure');
    if (btnApplyTrans) {
      btnApplyTrans.addEventListener('click', () => {
        this.matrix = computeTransitiveClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }
  }

  _startWarshallPlay() {
    this.warshallIsPlaying = true;
    if (this.warshallTimer) clearInterval(this.warshallTimer);

    const warshallData = runWarshallAlgorithm(this.matrix, this.elements);
    const maxStep = warshallData.steps.length - 1;

    // If already at end, restart from 0
    if (this.warshallStep >= maxStep) {
      this.warshallStep = 0;
    }

    this.warshallTimer = setInterval(() => {
      if (this.warshallStep < maxStep) {
        this.warshallStep++;
        this.render();
      } else {
        this._stopWarshallPlay();
      }
    }, this.warshallPlaySpeed);

    this.render();
  }

  _stopWarshallPlay() {
    this.warshallIsPlaying = false;
    if (this.warshallTimer) {
      clearInterval(this.warshallTimer);
      this.warshallTimer = null;
    }
    this.render();
  }

  // =========================================================================
  // TAB 4: EQUIVALENCE CLASSES & HASSE DIAGRAM (POSET) STUDIO
  // =========================================================================

  _renderHasseStudio() {
    const n = this.elements.length;
    const analysis = classifyRelation(this.matrix, this.elements);

    return `
      <!-- Tab 4 Sub-navigation Ribbon -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          
          <!-- Subtab toggles -->
          <div style="display:flex;gap:8px;align-items:center;">
            <button type="button" class="btn-sm ${this.activeTab4Subtab === 'hasse' ? 'active' : ''}" id="btnSubtabHasse" 
                    style="padding:8px 16px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;background:${this.activeTab4Subtab === 'hasse' ? 'var(--blue-light)' : 'var(--card-bg)'};color:${this.activeTab4Subtab === 'hasse' ? '#fff' : 'var(--text)'};border:1px solid var(--line);">
              👑 Biểu đồ Hasse & Thứ tự Một phần (POSET)
            </button>
            <button type="button" class="btn-sm ${this.activeTab4Subtab === 'equivalence' ? 'active' : ''}" id="btnSubtabEquivalence" 
                    style="padding:8px 16px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;background:${this.activeTab4Subtab === 'equivalence' ? 'var(--blue-light)' : 'var(--card-bg)'};color:${this.activeTab4Subtab === 'equivalence' ? '#fff' : 'var(--text)'};border:1px solid var(--line);">
              🫧 Lớp Tương Đương & Phân Hoạch Tập Thương A/R
            </button>
          </div>

          <!-- Quick Preset Selectors for Tab 4 -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;color:var(--dim);">Nạp mẫu nhanh:</span>
            <button type="button" class="btn-sm" id="btnHassePresetDivisibility" title="Nạp quan hệ chia hết trên {1, 2, 3, 4, 6}" style="font-size:12px;padding:4px 9px;">➗ Chia hết (POSET)</button>
            <button type="button" class="btn-sm" id="btnHassePresetChain" title="Nạp quan hệ nhỏ hơn hoặc bằng trên {1, 2, 3, 4}" style="font-size:12px;padding:4px 9px;">📉 Nhỏ hơn hoặc bằng (Xích)</button>
            <button type="button" class="btn-sm" id="btnEquivPresetMod3" title="Nạp quan hệ đồng dư modulo 3" style="font-size:12px;padding:4px 9px;">🔱 Đồng dư mod 3</button>
            <button type="button" class="btn-sm" id="btnEquivPresetBlocks" title="Nạp quan hệ 2 lớp tương đương {1, 2} và {3, 4}" style="font-size:12px;padding:4px 9px;">👑 2 Cụm mẫu</button>
          </div>

        </div>
      </div>

      <!-- Main Content Based on Active Subtab -->
      ${this.activeTab4Subtab === 'hasse' 
        ? this._renderHasseDiagram(n, analysis) 
        : this._renderEquivalenceClasses(n, analysis)
      }
    `;
  }

  _renderHasseDiagram(n, analysis) {
    const isPoset = analysis.isPartialOrder;
    const hasse = computeHasseLayout(this.matrix, this.elements, 560, 360);
    const extremes = hasse.extremes;
    const pairs = matrixToPairs(this.matrix, this.elements);

    return `
      <!-- POSET Status Alert Banner -->
      ${!isPoset ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:14.5px;font-weight:800;color:var(--rose, #ef4444);margin-bottom:4px;">
              ⚠️ Quan hệ hiện tại CHƯA PHẢI là Thứ tự Một phần (POSET)
            </div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5;">
              Biểu đồ Hasse chỉ có ý nghĩa chuẩn xác trên tập sắp thứ tự bộ phận (POSET: Phản xạ + Phản xứng + Bắc cầu).<br/>
              • Phản xạ: <b>${analysis.reflexive.isReflexive ? '✅ Đạt' : '❌ Vi phạm (' + (analysis.reflexive.missingLoops || []).length + ' phần tử thiếu khuyên)'}</b> &nbsp;|&nbsp;
              • Phản xứng: <b>${analysis.antisymmetric.isAntisymmetric ? '✅ Đạt' : '❌ Vi phạm (' + (analysis.antisymmetric.violations || []).length + ' cặp đối xứng hai chiều)'}</b> &nbsp;|&nbsp;
              • Bắc cầu: <b>${analysis.transitive.isTransitive ? '✅ Đạt' : '❌ Vi phạm (' + (analysis.transitive.violations || []).length + ' bộ ba thiếu cạnh bắc cầu)'}</b>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-sm btn-primary" id="btnAutoMakePoset" style="font-size:13px;padding:8px 14px;font-weight:700;">
              ⚡ Tự động tạo Bao đóng POSET
            </button>
          </div>
        </div>
      ` : `
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:14.5px;font-weight:800;color:var(--emerald, #10b981);margin-bottom:4px;">
              🎉 Quan hệ Thứ tự Một phần (POSET) Hợp lệ!
            </div>
            <div style="font-size:12.5px;color:var(--text);">
              ${analysis.isTotalOrder 
                ? '🌟 <b>Thứ tự Toàn phần (Linear Order / Xích - Chain):</b> Mọi cặp phần tử đều so sánh được với nhau!' 
                : '🌿 <b>Thứ tự Bán phần (Partial Order):</b> Tồn tại ít nhất một cặp phần tử không so sánh được.'}
            </div>
          </div>
          <div style="font-size:12.5px;font-weight:700;color:var(--blue-light);background:var(--card-bg);padding:5px 12px;border-radius:8px;border:1px solid var(--line);">
            Số cạnh phủ Hasse: <b>${hasse.coveringEdges.length}</b> / ${pairs.length} cặp ban đầu
          </div>
        </div>
      `}

      <!-- 2-Column Grid: Left Hasse SVG, Right Extremes Analysis -->
      <div class="relation-workspace-grid" style="display:grid;grid-template-columns:1.15fr 0.85fr;gap:20px;margin-bottom:20px;">
        
        <!-- Left: Interactive Hasse Diagram Canvas -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:14px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="font-size:16px;font-weight:800;color:var(--text);margin:0 0 2px 0;">Biểu đồ Hasse (Hasse Diagram Canvas)</h3>
              <span style="font-size:12px;color:var(--dim);">
                Quy ước: Cạnh đi từ dưới lên trên ($x ≺ y$). Bỏ toàn bộ khuyên phản xạ và cạnh bắc cầu.
              </span>
            </div>
          </div>

          <!-- SVG Container -->
          <div class="hasse-svg-wrapper" style="width:100%;height:380px;background:var(--card-bg);border:1px solid var(--line);border-radius:8px;position:relative;overflow:hidden;">
            ${this._renderHasseSvg(hasse, 560, 380)}
          </div>

          <!-- Legend -->
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--dim);border-top:1px solid var(--line);padding-top:10px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#10b981;"></span>
              <span>Tối tiểu (Minimal)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;"></span>
              <span>Tối đại (Maximal)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f59e0b;"></span>
              <span>Bé nhất (Least - 🌟)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#8b5cf6;"></span>
              <span>Lớn nhất (Greatest - 👑)</span>
            </div>
          </div>

        </div>

        <!-- Right: Extremes & Covering Analysis Column -->
        <div style="display:flex;flex-direction:column;gap:14px;">

          <!-- Card 1: Phân tích 4 Cực trị POSET -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
            <h4 style="font-size:14.5px;font-weight:800;color:var(--text);margin:0 0 12px 0;display:flex;align-items:center;gap:8px;">
              <span>🎯</span> Phân tích 4 Phần tử Cực trị POSET
            </h4>

            <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
              
              <!-- Minimal elements -->
              <div style="background:var(--card-bg);padding:8px 12px;border-radius:6px;border-left:4px solid #10b981;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                  <b style="color:var(--text);">Phần tử tối tiểu (Minimal):</b>
                  <span id="posetMinimalElements" style="font-family:monospace;font-weight:800;color:#10b981;font-size:14px;">
                    { ${extremes.minimal.join(', ') || '∅'} }
                  </span>
                </div>
                <div style="font-size:11.5px;color:var(--dim);">
                  Không có phần tử nào nhỏ hơn nó (¬∃x ∈ A: x &lt; a).
                </div>
              </div>

              <!-- Maximal elements -->
              <div style="background:var(--card-bg);padding:8px 12px;border-radius:6px;border-left:4px solid #ef4444;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                  <b style="color:var(--text);">Phần tử tối đại (Maximal):</b>
                  <span id="posetMaximalElements" style="font-family:monospace;font-weight:800;color:#ef4444;font-size:14px;">
                    { ${extremes.maximal.join(', ') || '∅'} }
                  </span>
                </div>
                <div style="font-size:11.5px;color:var(--dim);">
                  Không có phần tử nào lớn hơn nó (¬∃x ∈ A: a &lt; x).
                </div>
              </div>

              <!-- Least element -->
              <div style="background:var(--card-bg);padding:8px 12px;border-radius:6px;border-left:4px solid #f59e0b;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                  <b style="color:var(--text);">Phần tử bé nhất (Least):</b>
                  <span id="posetLeastElement" style="font-family:monospace;font-weight:800;color:#f59e0b;font-size:14px;">
                    ${extremes.least ? `🌟 '${extremes.least}'` : '❌ Không tồn tại'}
                  </span>
                </div>
                <div style="font-size:11.5px;color:var(--dim);">
                  ${extremes.least 
                    ? `Nhỏ hơn hoặc bằng TẤT CẢ các phần tử trong tập A (duy nhất).` 
                    : (extremes.minimal.length > 1 ? 'Vì có nhiều hơn 1 phần tử tối tiểu nên không có phần tử bé nhất.' : 'Không so sánh được với mọi phần tử.')}
                </div>
              </div>

              <!-- Greatest element -->
              <div style="background:var(--card-bg);padding:8px 12px;border-radius:6px;border-left:4px solid #8b5cf6;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                  <b style="color:var(--text);">Phần tử lớn nhất (Greatest):</b>
                  <span id="posetGreatestElement" style="font-family:monospace;font-weight:800;color:#8b5cf6;font-size:14px;">
                    ${extremes.greatest ? `👑 '${extremes.greatest}'` : '❌ Không tồn tại'}
                  </span>
                </div>
                <div style="font-size:11.5px;color:var(--dim);">
                  ${extremes.greatest 
                    ? `Lớn hơn hoặc bằng TẤT CẢ các phần tử trong tập A (duy nhất).` 
                    : (extremes.maximal.length > 1 ? 'Vì có nhiều hơn 1 phần tử tối đại nên không có phần tử lớn nhất.' : 'Không so sánh được với mọi phần tử.')}
                </div>
              </div>

            </div>
          </div>

          <!-- Card 2: Quan hệ Phủ Trực tiếp (Covering Relations) -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
            <h4 style="font-size:14.5px;font-weight:800;color:var(--text);margin:0 0 10px 0;display:flex;align-items:center;gap:8px;">
              <span>🪜</span> Quan hệ Phủ Trực tiếp (x ≺ y)
            </h4>
            <div style="font-size:12.5px;color:var(--dim);margin-bottom:8px;line-height:1.4;">
              x ≺ y khi và chỉ khi x &lt; y và không tồn tại phần tử z nào nằm giữa (x &lt; z &lt; y).
            </div>
            
            <div id="hasseCoveringChips" style="display:flex;flex-wrap:wrap;gap:6px;max-height:110px;overflow-y:auto;background:var(--card-bg);padding:8px 10px;border-radius:6px;border:1px solid var(--line);">
              ${hasse.coveringEdges.length === 0 ? '<span style="font-size:12px;color:var(--dim);font-style:italic;">Không có cặp phủ nào (hoặc quan hệ rời rạc).</span>' : ''}
              ${hasse.coveringEdges.map(e => `
                <span class="hasse-covering-chip" style="background:var(--panel-alt);border:1px solid var(--line);padding:3px 8px;border-radius:5px;font-family:monospace;font-size:12px;font-weight:700;color:var(--blue-light);">
                  ${e.from} ≺ ${e.to}
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Card 3: Tính chất Thứ tự Toàn phần / Xích -->
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
            <h4 style="font-size:14.5px;font-weight:800;color:var(--text);margin:0 0 8px 0;display:flex;align-items:center;gap:8px;">
              <span>⛓️</span> Khảo sát Tính Toàn phần (Linear Order)
            </h4>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5;">
              ${analysis.isTotalOrder ? `
                <div style="color:var(--emerald, #10b981);font-weight:700;">✅ Là Thứ tự Toàn phần (Tập sắp thứ tự tuyến tính / Xích - Chain):</div>
                <div style="color:var(--dim);font-size:12px;">Mọi cặp phần tử bất kỳ x ≠ y đều so sánh được với nhau (x ≤ y hoặc y ≤ x).</div>
              ` : `
                <div style="color:var(--amber, #f59e0b);font-weight:700;">⚠️ Là Thứ tự Bán phần (POSET thuần túy):</div>
                <div style="color:var(--dim);font-size:12px;margin-top:2px;">
                  Tồn tại cặp phần tử không so sánh được:
                  <span style="font-family:monospace;color:var(--text);font-weight:600;">
                    ${analysis.comparable.incomparablePairs.slice(0, 5).map(p => `(${p.a}, ${p.b})`).join(', ')}${analysis.comparable.incomparablePairs.length > 5 ? '...' : ''}
                  </span>
                </div>
              `}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  _renderHasseSvg(hasse, width, height) {
    const { positions, coveringEdges, extremes, maxLevel } = hasse;

    // 1. Level Guides Background Lines
    let levelGuidesHtml = '';
    const ySpan = height - 100;
    for (let l = 0; l <= maxLevel; l++) {
      const y = maxLevel === 0 ? height / 2 : (height - 50) - (l / maxLevel) * ySpan;
      levelGuidesHtml += `
        <line x1="40" y1="${Math.round(y)}" x2="${width - 40}" y2="${Math.round(y)}" stroke="var(--line)" stroke-dasharray="4 4" stroke-opacity="0.4" />
        <text x="14" y="${Math.round(y) + 4}" fill="var(--dim)" font-size="11" font-family="monospace">L_${l}</text>
      `;
    }

    // 2. Covering Edges (Drawn as straight lines with upward orientation)
    let edgesHtml = '';
    coveringEdges.forEach(e => {
      const p1 = positions[e.from];
      const p2 = positions[e.to];
      if (!p1 || !p2) return;

      const isHovered = this.hasseHoveredNode === e.from || this.hasseHoveredNode === e.to;
      const strokeColor = 'var(--blue-light)';
      const strokeWidth = isHovered ? '3.5' : '2.2';
      const strokeOpacity = this.hasseHoveredNode && !isHovered ? '0.2' : '0.85';

      edgesHtml += `
        <line class="hasse-edge" 
              x1="${p1.x}" y1="${p1.y}" 
              x2="${p2.x}" y2="${p2.y}" 
              stroke="${strokeColor}" 
              stroke-width="${strokeWidth}" 
              stroke-opacity="${strokeOpacity}" 
              data-from="${e.from}" 
              data-to="${e.to}" />
      `;
    });

    // 3. Nodes
    let nodesHtml = '';
    this.elements.forEach(el => {
      const p = positions[el];
      if (!p) return;

      const isLeast = extremes.least === el;
      const isGreatest = extremes.greatest === el;
      const isMinimal = extremes.minimal.includes(el);
      const isMaximal = extremes.maximal.includes(el);

      let stroke = 'var(--blue-light)';
      let badgeText = '';
      let badgeFill = '#10b981';

      if (isLeast) {
        stroke = '#f59e0b';
        badgeText = '🌟';
        badgeFill = '#f59e0b';
      } else if (isMinimal) {
        stroke = '#10b981';
        badgeText = 'Min';
        badgeFill = '#10b981';
      }

      if (isGreatest) {
        stroke = '#8b5cf6';
        badgeText = '👑';
        badgeFill = '#8b5cf6';
      } else if (isMaximal && !isLeast) {
        stroke = '#ef4444';
        badgeText = 'Max';
        badgeFill = '#ef4444';
      }

      const isHovered = this.hasseHoveredNode === el;

      nodesHtml += `
        <g class="hasse-node-group" data-element="${el}" style="cursor:pointer;">
          <!-- Node circle -->
          <circle cx="${p.x}" cy="${p.y}" r="${isHovered ? 24 : 20}" 
                  fill="var(--card-bg)" 
                  stroke="${stroke}" 
                  stroke-width="${isHovered ? 3.5 : 2.5}" />
          
          <!-- Element label -->
          <text x="${p.x}" y="${p.y + 5}" 
                text-anchor="middle" 
                fill="var(--text)" 
                font-size="14" 
                font-weight="800" 
                font-family="system-ui, -apple-system, sans-serif">
            ${el}
          </text>

          <!-- Extremes Badge if applicable -->
          ${badgeText ? `
            <g transform="translate(${p.x + 14}, ${p.y - 14})">
              <circle cx="0" cy="0" r="9" fill="${badgeFill}" />
              <text x="0" y="3" text-anchor="middle" fill="#fff" font-size="8.5" font-weight="800">${badgeText}</text>
            </g>
          ` : ''}
        </g>
      `;
    });

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="display:block;">
        ${levelGuidesHtml}
        ${edgesHtml}
        ${nodesHtml}
      </svg>
    `;
  }

  _renderEquivalenceClasses(n, analysis) {
    const isEquiv = analysis.isEquivalence;
    const eqData = computeEquivalenceClasses(this.matrix, this.elements);

    // Color palettes for partition bubbles
    const bubblePalettes = [
      { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', text: '#60a5fa' },
      { border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399' },
      { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', text: '#a78bfa' },
      { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24' },
      { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', text: '#f472b6' },
      { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', text: '#22d3ee' },
    ];

    return `
      <!-- Equivalence Status Alert Banner -->
      ${!isEquiv ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:14.5px;font-weight:800;color:var(--rose, #ef4444);margin-bottom:4px;">
              ⚠️ Quan hệ hiện tại CHƯA PHẢI là Quan hệ Tương đương
            </div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5;">
              Quan hệ tương đương bắt buộc phải thoả mãn đồng thời 3 tính chất: Phản xạ, Đối xứng và Bắc cầu.<br/>
              • Phản xạ: <b>${analysis.reflexive.isReflexive ? '✅ Đạt' : '❌ Vi phạm'}</b> &nbsp;|&nbsp;
              • Đối xứng: <b>${analysis.symmetric.isSymmetric ? '✅ Đạt' : '❌ Vi phạm'}</b> &nbsp;|&nbsp;
              • Bắc cầu: <b>${analysis.transitive.isTransitive ? '✅ Đạt' : '❌ Vi phạm'}</b>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn-sm btn-primary" id="btnAutoMakeEquivalence" style="font-size:13px;padding:8px 14px;font-weight:700;">
              ✨ Tự động tạo Bao đóng Tương đương
            </button>
          </div>
        </div>
      ` : `
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:14.5px;font-weight:800;color:var(--emerald, #10b981);margin-bottom:4px;">
              🎉 Quan hệ Tương đương Hợp lệ!
            </div>
            <div style="font-size:12.5px;color:var(--text);">
              Theo <b>Định lý cơ bản về Quan hệ tương đương</b>, quan hệ này phân hoạch tập A thành đúng <b>${eqData.count}</b> lớp tương đương đôi một rời nhau.
            </div>
          </div>
        </div>
      `}

      <!-- Quotient Set Banner Card -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px;">
          <div>
            <span style="font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:0.4px;">Tập thương (Quotient Set):</span>
            <div id="quotientSetFormula" style="font-family:monospace;font-size:18px;font-weight:800;color:var(--blue-light);margin-top:2px;">
              A / R = ${eqData.quotientSetString}
            </div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--text);background:var(--card-bg);padding:6px 14px;border-radius:20px;border:1px solid var(--line);">
            Số lớp tương đương: <b id="quotientClassCount" style="color:var(--blue-light);">${eqData.count}</b>
          </div>
        </div>

        <!-- Equivalence Partition Cards Grid -->
        <div class="equivalence-partition-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;">
          ${eqData.representatives.map((rep, idx) => {
            const pal = bubblePalettes[idx % bubblePalettes.length];
            return `
              <div class="equivalence-class-card" style="background:${pal.bg};border:1.5px solid ${pal.border};border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:15px;font-weight:800;color:${pal.text};">
                    Lớp [${rep.representative}]
                  </span>
                  <span style="font-size:11.5px;font-weight:700;color:var(--text);background:var(--card-bg);padding:2px 8px;border-radius:12px;border:1px solid var(--line);">
                    | [${rep.representative}] | = ${rep.members.length}
                  </span>
                </div>

                <div style="font-size:12px;color:var(--dim);">
                  Phần tử đại diện: <b style="color:var(--text);">${rep.representative}</b>
                </div>

                <!-- Members chips -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                  ${rep.members.map(m => `
                    <span style="background:var(--card-bg);border:1px solid ${pal.border};padding:4px 10px;border-radius:6px;font-family:monospace;font-size:13px;font-weight:700;color:var(--text);">
                      ${m === rep.representative ? `👑 ${m}` : m}
                    </span>
                  `).join('')}
                </div>

                <div style="font-size:11.5px;color:var(--dim);margin-top:auto;font-family:monospace;">
                  [${rep.representative}] = { x ∈ A | x R ${rep.representative} }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Fundamental Theorem Verification Checklist -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;">
        <h4 style="font-size:14.5px;font-weight:800;color:var(--text);margin:0 0 12px 0;">
          📜 3 Tiên đề Phân hoạch của Quan hệ Tương đương (Fundamental Partition Theorem)
        </h4>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;font-size:12.5px;">
          
          <div style="background:var(--card-bg);padding:12px;border-radius:8px;border:1px solid var(--line);">
            <div style="font-weight:700;color:var(--emerald, #10b981);margin-bottom:4px;">
              ✅ 1. Phủ kín tập gốc A
            </div>
            <div style="color:var(--dim);line-height:1.4;">
              Hợp của tất cả các lớp tương đương bằng chính tập A:<br/>
              <code>⋃ [a] = A = {${this.elements.join(', ')}}</code>
            </div>
          </div>

          <div style="background:var(--card-bg);padding:12px;border-radius:8px;border:1px solid var(--line);">
            <div style="font-weight:700;color:var(--emerald, #10b981);margin-bottom:4px;">
              ✅ 2. Đôi một rời nhau
            </div>
            <div style="color:var(--dim);line-height:1.4;">
              Hai lớp tương đương bất kỳ hoặc hoàn toàn trùng nhau hoặc không giao nhau:<br/>
              <code>[a] ≠ [b] ⟹ [a] ∩ [b] = ∅</code>
            </div>
          </div>

          <div style="background:var(--card-bg);padding:12px;border-radius:8px;border:1px solid var(--line);">
            <div style="font-weight:700;color:var(--emerald, #10b981);margin-bottom:4px;">
              ✅ 3. Đồng nhất qua quan hệ
            </div>
            <div style="color:var(--dim);line-height:1.4;">
              Hai phần tử thuộc cùng một lớp khi và chỉ khi chúng có quan hệ tương đương với nhau:<br/>
              <code>[a] = [b] ⟺ (a, b) ∈ R</code>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  _bindHasseEvents() {
    // 1. Subtab Toggles
    const btnHasse = this.container.querySelector('#btnSubtabHasse');
    if (btnHasse) {
      btnHasse.addEventListener('click', () => {
        this.activeTab4Subtab = 'hasse';
        this.render();
      });
    }

    const btnEquiv = this.container.querySelector('#btnSubtabEquivalence');
    if (btnEquiv) {
      btnEquiv.addEventListener('click', () => {
        this.activeTab4Subtab = 'equivalence';
        this.render();
      });
    }

    // 2. Preset Quick Buttons
    const btnDiv = this.container.querySelector('#btnHassePresetDivisibility');
    if (btnDiv) {
      btnDiv.addEventListener('click', () => {
        const preset = RELATION_PRESETS.find(p => p.id === 'divisibility');
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.presetId = 'divisibility';
          this.render();
        }
      });
    }

    const btnChain = this.container.querySelector('#btnHassePresetChain');
    if (btnChain) {
      btnChain.addEventListener('click', () => {
        const preset = RELATION_PRESETS.find(p => p.id === 'less_equal');
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.presetId = 'less_equal';
          this.render();
        }
      });
    }

    const btnMod3 = this.container.querySelector('#btnEquivPresetMod3');
    if (btnMod3) {
      btnMod3.addEventListener('click', () => {
        const preset = RELATION_PRESETS.find(p => p.id === 'congruence_mod3');
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.presetId = 'congruence_mod3';
          this.render();
        }
      });
    }

    const btnBlocks = this.container.querySelector('#btnEquivPresetBlocks');
    if (btnBlocks) {
      btnBlocks.addEventListener('click', () => {
        const preset = RELATION_PRESETS.find(p => p.id === 'equivalence_sample');
        if (preset) {
          this.elements = [...preset.elements];
          this.matrix = preset.buildMatrix();
          this.presetId = 'equivalence_sample';
          this.render();
        }
      });
    }

    // 3. Auto-fix closures
    const btnAutoPoset = this.container.querySelector('#btnAutoMakePoset');
    if (btnAutoPoset) {
      btnAutoPoset.addEventListener('click', () => {
        this.matrix = makePosetClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    const btnAutoEquiv = this.container.querySelector('#btnAutoMakeEquivalence');
    if (btnAutoEquiv) {
      btnAutoEquiv.addEventListener('click', () => {
        this.matrix = makeEquivalenceClosure(this.matrix);
        this.presetId = 'custom';
        this.render();
      });
    }

    // 4. Hasse Node Hover Direct DOM Highlight
    const hasseNodes = this.container.querySelectorAll('.hasse-node-group');
    hasseNodes.forEach(node => {
      node.addEventListener('mouseenter', () => {
        const el = node.getAttribute('data-element');
        this.hasseHoveredNode = el;
        const edges = this.container.querySelectorAll('.hasse-edge');
        edges.forEach(edge => {
          const from = edge.getAttribute('data-from');
          const to = edge.getAttribute('data-to');
          if (from === el || to === el) {
            edge.setAttribute('stroke-width', '3.5');
            edge.setAttribute('stroke-opacity', '1');
          } else {
            edge.setAttribute('stroke-opacity', '0.2');
          }
        });
      });

      node.addEventListener('mouseleave', () => {
        this.hasseHoveredNode = null;
        const edges = this.container.querySelectorAll('.hasse-edge');
        edges.forEach(edge => {
          edge.setAttribute('stroke-width', '2.2');
          edge.setAttribute('stroke-opacity', '0.85');
        });
      });
    });
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }
}


