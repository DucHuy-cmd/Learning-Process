/**
 * @file StateTable.js
 * Algorithm State / Matrix Table Display Component
 * 
 * Supports 3 View Modes:
 * - Current (Bước hiện tại): single row for current step
 * - Progressive (Tích lũy): rows from step 0 up to current step (educational default)
 * - Full (Toàn bộ): all steps across the algorithm run
 * 
 * Features:
 * - Interactive row selection (click row -> goto step)
 * - Fullscreen / Expanded viewport overlay (⛶ Mở rộng / ✕ Thu nhỏ) with Escape key support
 * - Sticky headers on scrolling
 * - Semantic cell highlight styling
 */

import { StepFormatter } from '../../app/presentation/StepFormatter.js';

export class StateTable {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Function} [options.onStepSelect] - Callback invoked with (stepIndex) when a row is clicked
   * @param {Function} [options.onExpandToggle] - Callback invoked with (isExpanded) when fullscreen expand is toggled
   */
  constructor({ container, onStepSelect, onExpandToggle }) {
    this.container = container;
    this.onStepSelect = onStepSelect || (() => {});
    this.onExpandToggle = onExpandToggle || null;

    this.mode = 'progressive'; // 'current' | 'progressive' | 'full'
    this.isExpanded = false;

    this.steps = [];
    this.currentIndex = -1;
    this.graph = null;
    this.context = {};
    this.cachedRows = new Map();
    this.tableHeaders = [];

    this._escListener = (e) => {
      if (e.key === 'Escape' && this.isExpanded) {
        this.toggleExpand(false);
      }
    };

    this._render();
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="table-head-bar">
        <div class="table-head-left" style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:14px;">📊</span>
          <span id="tableTitle" style="font-weight:700;">BẢNG TIẾN TRÌNH THUẬT TOÁN</span>
          <span class="table-step-indicator" id="tableStepIndicator"></span>
        </div>

        <div class="table-head-controls" style="display:flex;align-items:center;gap:10px;">
          <div class="table-mode-group" role="group" aria-label="Chế độ hiển thị bảng">
            <button type="button" class="table-mode-btn" data-mode="current" title="Chỉ hiển thị dòng của bước hiện tại">Hiện tại</button>
            <button type="button" class="table-mode-btn active" data-mode="progressive" title="Hiển thị tích lũy các bước đến bước hiện tại (Mặc định học tập)">Tích lũy</button>
            <button type="button" class="table-mode-btn" data-mode="full" title="Hiển thị toàn bộ tất cả các bước của thuật toán">Toàn bộ</button>
          </div>

          <button type="button" class="table-expand-btn" id="btnExpandTable" title="Mở rộng / Thu nhỏ bảng toàn màn hình">
            ⛶ Mở rộng
          </button>
        </div>
      </div>
      <div class="table-wrap" id="tableWrap">
        <table class="state-table" id="stateTable">
          <thead id="tableHead"></thead>
          <tbody id="tableBody">
            <tr>
              <td colspan="12" style="padding:24px;text-align:center;color:var(--dim);">
                Chưa chạy thuật toán. Bấm nút "▶ Chạy" bên dưới khung code để bắt đầu.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    this.tableHead = this.container.querySelector('#tableHead');
    this.tableBody = this.container.querySelector('#tableBody');
    this.tableTitle = this.container.querySelector('#tableTitle');
    this.tableStepIndicator = this.container.querySelector('#tableStepIndicator');
    this.btnExpand = this.container.querySelector('#btnExpandTable');

    this._bindEvents();
  }

  _bindEvents() {
    // Mode switcher buttons
    const modeBtns = this.container.querySelectorAll('.table-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-mode');
        this.setMode(targetMode);
      });
    });

    // Expand toggle button
    if (this.btnExpand) {
      this.btnExpand.addEventListener('click', () => {
        this.toggleExpand();
      });
    }

    // Row click selection
    if (this.tableBody) {
      this.tableBody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-step-index]');
        if (tr) {
          const stepIdx = parseInt(tr.getAttribute('data-step-index'), 10);
          if (!isNaN(stepIdx)) {
            this.onStepSelect(stepIdx);
          }
        }
      });
    }
  }

  /**
   * Sets active table viewing mode ('current' | 'progressive' | 'full').
   * @param {string} newMode
   */
  setMode(newMode) {
    if (!['current', 'progressive', 'full'].includes(newMode)) return;
    this.mode = newMode;

    const modeBtns = this.container.querySelectorAll('.table-mode-btn');
    modeBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === newMode);
    });

    this._renderRows();
  }

  /**
   * Toggles fullscreen/expanded table mode.
   * @param {boolean} [forceState]
   */
  toggleExpand(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isExpanded;
    if (this.isExpanded === nextState) return;
    this.isExpanded = nextState;

    if (this.isExpanded) {
      this.container.classList.add('table-expanded');
      if (this.btnExpand) {
        this.btnExpand.textContent = '✕ Thu nhỏ';
        this.btnExpand.title = 'Thu nhỏ về kích thước ban đầu (Esc)';
      }
      window.addEventListener('keydown', this._escListener);
    } else {
      this.container.classList.remove('table-expanded');
      if (this.btnExpand) {
        this.btnExpand.textContent = '⛶ Mở rộng';
        this.btnExpand.title = 'Mở rộng / Thu nhỏ bảng toàn màn hình';
      }
      window.removeEventListener('keydown', this._escListener);
    }

    if (typeof this.onExpandToggle === 'function') {
      this.onExpandToggle(this.isExpanded);
    }
  }

  /**
   * Updates the table with step sequence data or legacy tableData.
   * 
   * @param {Object|null} data
   * @param {Array} [data.steps] - All algorithm steps
   * @param {number} [data.currentIndex] - Current step index
   * @param {Object} [data.graph] - Current graph instance
   * @param {Object} [data.context] - Presentation formatting context
   * @param {Object} [data.tableData] - Pre-formatted table data (optional)
   */
  update(data) {
    if (!data) {
      this.steps = [];
      this.currentIndex = -1;
      this.graph = null;
      this.cachedRows.clear();
      this.tableHeaders = [];
      this._renderEmpty('Chưa chạy thuật toán. Bấm nút "▶ Chạy" bên dưới khung code để bắt đầu.');
      return;
    }

    // Direct legacy / pre-formatted tableData support
    if (Array.isArray(data.headers)) {
      this._renderDirectTable(data);
      return;
    }

    // Rich multi-step update
    const prevSteps = this.steps;
    this.steps = Array.isArray(data.steps) ? data.steps : [];
    this.currentIndex = typeof data.currentIndex === 'number' ? data.currentIndex : -1;
    this.graph = data.graph || this.graph;
    this.context = data.context || this.context;

    // Invalidate cache if step sequence changed
    if (this.steps !== prevSteps) {
      this.cachedRows.clear();
      this.tableHeaders = [];
    }

    if (this.steps.length === 0) {
      this._renderEmpty('Chưa chạy thuật toán. Bấm nút "▶ Chạy" bên dưới khung code để bắt đầu.');
      return;
    }

    this._renderRows();
  }

  _renderEmpty(message) {
    if (this.tableHead) this.tableHead.innerHTML = '';
    if (this.tableBody) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="12" style="padding:24px;text-align:center;color:var(--dim);">
            ${escapeHtml(message)}
          </td>
        </tr>
      `;
    }
    if (this.tableStepIndicator) {
      this.tableStepIndicator.textContent = '';
    }
  }

  _renderDirectTable(tableData) {
    if (!Array.isArray(tableData.headers) || tableData.headers.length === 0) {
      this._renderEmpty('Không có bảng ma trận cho bước này.');
      return;
    }

    this.tableHead.innerHTML = `
      <tr>
        ${tableData.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
      </tr>
    `;

    if (!Array.isArray(tableData.rows) || tableData.rows.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="${tableData.headers.length}" style="padding:20px;text-align:center;color:var(--dim);">
            Đang khởi tạo...
          </td>
        </tr>
      `;
      return;
    }

    const rowsHtml = tableData.rows.map((row, rIdx) => {
      const isLastRow = rIdx === tableData.rows.length - 1;
      const rowClass = isLastRow ? 'active-row' : '';

      // Check if stepLabel needs to be rendered as first td
      let stepTd = '';
      if (row.stepLabel !== undefined) {
        stepTd = `<td class="cell-step-num" style="font-weight:700;color:var(--dim);">${escapeHtml(row.stepLabel)}</td>`;
      }

      const cellsHtml = (row.cells || []).map(cell => this._formatCell(cell)).join('');
      return `<tr class="${rowClass}">${stepTd}${cellsHtml}</tr>`;
    }).join('');

    this.tableBody.innerHTML = rowsHtml;
  }

  _renderRows() {
    if (!this.steps || this.steps.length === 0 || !this.graph) {
      this._renderEmpty('Chưa chạy thuật toán. Chọn "Chạy thuật toán" để bắt đầu.');
      return;
    }

    // Determine target step indices to display based on mode
    let targetIndices = [];
    if (this.mode === 'current') {
      if (this.currentIndex >= 0 && this.currentIndex < this.steps.length) {
        targetIndices = [this.currentIndex];
      }
    } else if (this.mode === 'progressive') {
      const maxIdx = this.currentIndex >= 0 ? Math.min(this.currentIndex, this.steps.length - 1) : 0;
      for (let i = 0; i <= maxIdx; i++) {
        targetIndices.push(i);
      }
    } else if (this.mode === 'full') {
      for (let i = 0; i < this.steps.length; i++) {
        targetIndices.push(i);
      }
    }

    const isPrim = this.context && this.context.algorithmKey === 'prim';

    // If Prim, filter out intermediate redundant ACCEPT_EDGE and trailing empty RELAX_EDGE steps in progressive/full modes
    if (isPrim && this.mode !== 'current') {
      const totalNodes = this.graph?.nodeCount || (this.graph?.getNodes ? this.graph.getNodes().length : 0);
      targetIndices = targetIndices.filter(stepIdx => {
        const step = this.steps[stepIdx];
        if (!step) return false;
        // In Prim, ACCEPT_EDGE is an intermediate canvas step whose row is superseded by RELAX_EDGE
        if (step.action === 'ACCEPT_EDGE') return false;
        // Trailing RELAX_EDGE where all nodes are already in MST has no new candidate or updates
        if (step.action === 'RELAX_EDGE') {
          const inMST = step.state?.inMST || [];
          if (totalNodes > 0 && inMST.length >= totalNodes) {
            return false;
          }
        }
        return true;
      });
    }

    if (targetIndices.length === 0) {
      this._renderEmpty('Đang khởi tạo bước...');
      return;
    }

    // Ensure we have table headers (from step 0 or current)
    if (this.tableHeaders.length === 0) {
      const sampleStep = this.steps[0];
      const sampleTable = StepFormatter.formatTable(sampleStep, this.graph, this.context);
      if (sampleTable && Array.isArray(sampleTable.headers)) {
        this.tableHeaders = sampleTable.headers;
      }
    }

    if (this.tableHeaders.length === 0) {
      this._renderEmpty('Không có cấu trúc bảng cho thuật toán này.');
      return;
    }

    // Render Headers
    this.tableHead.innerHTML = `
      <tr>
        ${this.tableHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
      </tr>
    `;

    // Determine active visible step index for highlighting
    let activeStepIdx = this.currentIndex;
    if (isPrim && this.mode !== 'current' && !targetIndices.includes(activeStepIdx)) {
      const nextVisible = targetIndices.find(idx => idx > activeStepIdx);
      activeStepIdx = nextVisible !== undefined ? nextVisible : (targetIndices[targetIndices.length - 1] ?? -1);
    }

    // Render Rows
    const rowsHtml = targetIndices.map((stepIdx, rowPos) => {
      const step = this.steps[stepIdx];
      let rowGroup = this.cachedRows.get(stepIdx);
      if (!rowGroup) {
        const tableData = StepFormatter.formatTable(step, this.graph, this.context);
        if (tableData && Array.isArray(tableData.rows) && tableData.rows.length > 0) {
          rowGroup = tableData.rows;
          this.cachedRows.set(stepIdx, rowGroup);
        }
      }

      if (!rowGroup || !Array.isArray(rowGroup) || rowGroup.length === 0) return '';

      const isActive = stepIdx === activeStepIdx;
      const rowClass = isActive ? 'active-row' : '';

      return rowGroup.map(formattedRow => {
        const colCount = this.tableHeaders.length;

        // Bellman-Ford: "Lần k:" band introducing a pass
        if (formattedRow.isPassBand) {
          return `
            <tr class="bf-pass-band ${rowClass}" data-step-index="${stepIdx}" style="cursor:pointer;" title="Nhấn để nhảy đến bước ${stepIdx + 1}">
              <td colspan="2"></td>
              <td colspan="${Math.max(1, colCount - 2)}" class="cell-bf-pass">${escapeHtml(formattedRow.passLabel || '')}</td>
            </tr>
          `;
        }

        // Bellman-Ford: full-width message row (no step column)
        if (formattedRow.fullWidth) {
          return `
            <tr class="summary-row ${rowClass}" data-step-index="${stepIdx}" style="cursor:pointer;background:rgba(245,158,11,0.08);font-weight:600;">
              <td colspan="${colCount}" style="padding:8px 12px;color:var(--accent);text-align:left;font-weight:700;">
                ${escapeHtml(formattedRow.stepLabel && formattedRow.stepLabel !== '★' ? formattedRow.stepLabel + ' ' : '')}${escapeHtml(formattedRow.summaryText || '')}
              </td>
            </tr>
          `;
        }

        // Bellman-Ford: edge row / KQ row / init row (cells already cover every column)
        if (formattedRow.noStepCell) {
          const isEdgeRow = typeof formattedRow.bfCol === 'number';
          const bfClass = isEdgeRow ? ' bf-edge-row' : (formattedRow.isKQ ? ' bf-kq-row' : '');
          const activeClass = isEdgeRow && isActive ? ' bf-active' : '';
          const dataAttrs = isEdgeRow ? ` data-bf-pass="${formattedRow.bfPass}" data-bf-col="${formattedRow.bfCol}"` : '';
          const cellsHtml = (formattedRow.cells || []).map(cell => this._formatCell(cell)).join('');
          return `
            <tr class="${rowClass}${bfClass}${activeClass}" data-step-index="${stepIdx}"${dataAttrs} style="cursor:pointer;" title="Nhấn để nhảy đến bước ${stepIdx + 1}">
              ${cellsHtml}
            </tr>
          `;
        }

        if (formattedRow.isSummary) {
          return `
            <tr class="summary-row ${rowClass}" style="background:rgba(245,158,11,0.08);font-weight:600;">
              <td class="cell-step-num" style="font-weight:700;color:var(--accent);text-align:center;">${escapeHtml(formattedRow.stepLabel || '★')}</td>
              <td colspan="${this.tableHeaders.length - 1}" style="padding:8px 12px;color:var(--accent);text-align:left;font-weight:700;">
                ${escapeHtml(formattedRow.summaryText || (formattedRow.cells && formattedRow.cells[0] && formattedRow.cells[0].val) || '')}
              </td>
            </tr>
          `;
        }

        const stepLabel = isPrim && this.mode !== 'current' ? `B${rowPos + 1}` : (formattedRow.stepLabel || `B${stepIdx + 1}`);
        const stepTd = `<td class="cell-step-num" style="font-weight:700;color:var(--dim);">${escapeHtml(stepLabel)}</td>`;
        const cellsHtml = (formattedRow.cells || []).map(cell => this._formatCell(cell)).join('');

        return `
          <tr class="${rowClass}" data-step-index="${stepIdx}" style="cursor:pointer;" title="Nhấn để nhảy đến bước ${stepIdx + 1}">
            ${stepTd}${cellsHtml}
          </tr>
        `;
      }).join('');
    }).join('');

    this.tableBody.innerHTML = rowsHtml;

    this._highlightBellmanFordCross();

    // Update Step Indicator in Header
    if (this.tableStepIndicator) {
      if (isPrim && this.mode !== 'current') {
        const activePos = targetIndices.indexOf(activeStepIdx);
        const curRow = activePos >= 0 ? activePos + 1 : (targetIndices.length > 0 ? 1 : 0);
        this.tableStepIndicator.textContent = `(Bước ${curRow} / ${targetIndices.length})`;
      } else {
        const curDisplay = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
        this.tableStepIndicator.textContent = `(Bước ${curDisplay} / ${this.steps.length})`;
      }
    }

    // Scroll active row into view
    const activeRowEl = this.tableBody.querySelector('tr.active-row');
    if (activeRowEl && typeof activeRowEl.scrollIntoView === 'function') {
      activeRowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Bellman-Ford textbook highlight: the active edge row is yellow, and the column of its
   * target node y is yellow from the header down to the active row (within the same pass).
   */
  _highlightBellmanFordCross() {
    if (!this.tableBody || !this.tableHead) return;
    this.tableHead.querySelectorAll('th.bf-col-hl').forEach(th => th.classList.remove('bf-col-hl'));

    const activeRow = this.tableBody.querySelector('tr.bf-active');
    if (!activeRow) return;

    const col = parseInt(activeRow.getAttribute('data-bf-col'), 10);
    if (isNaN(col) || col < 0) return;

    const headerCells = this.tableHead.querySelectorAll('th');
    if (headerCells[col]) headerCells[col].classList.add('bf-col-hl');

    let row = activeRow;
    while (row) {
      if (row.classList.contains('bf-edge-row')) {
        const td = row.children[col];
        if (td) td.classList.add('bf-col-hl');
      } else if (row.classList.contains('bf-pass-band')) {
        break;
      }
      row = row.previousElementSibling;
    }
  }

  _formatCell(cell) {
    const val = typeof cell === 'object' && cell !== null ? cell.val : String(cell);
    const type = typeof cell === 'object' && cell !== null ? cell.type : 'normal';
    const colSpan = (typeof cell === 'object' && cell !== null && cell.colSpan) ? ` colspan="${cell.colSpan}"` : '';

    let cellClass = '';
    if (type === 'settled') cellClass = 'cell-settled';
    else if (type === 'updated') cellClass = 'cell-updated';
    else if (type === 'visited') cellClass = 'cell-visited';
    else if (type === 'tv') cellClass = 'cell-tv';
    else if (type === 'te') cellClass = 'cell-te';
    else if (type === 'weight') cellClass = 'cell-weight';
    else if (type === 'summary') cellClass = 'cell-summary';
    else if (type === 'bf-edge') cellClass = 'cell-bf-edge';
    else if (type === 'bf-weight') cellClass = 'cell-bf-weight';
    else if (type === 'bf-update') cellClass = 'cell-bf-update';
    else if (type === 'bf-kq') cellClass = 'cell-bf-kq';
    else if (type === 'bf-kq-val') cellClass = 'cell-bf-kq-val';
    else if (type === 'bf-empty') cellClass = 'cell-bf-empty';

    return `<td class="${cellClass}"${colSpan}>${escapeHtml(val)}</td>`;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

