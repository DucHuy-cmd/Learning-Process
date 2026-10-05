/**
 * @file LabView.js
 * Algorithm Lab Workspace View Component
 * 
 * Re-architected 2-Tier Modern Layout:
 * - TOP WORKSPACE: Graph Pane + Vertical Splitter 1 + Code & Playback Pane
 * - HORIZONTAL SPLITTER 2: Resizes Top Workspace vs Bottom Table
 * - BOTTOM WORKSPACE: Algorithm State / Progress Table
 * 
 * Orchestrates Graph Source (Presets & Custom Input), Algorithm Selection,
 * Dispatch via AlgorithmRegistry, Stepping via PlaybackController,
 * Presentation Formatting via StepFormatter, Real Code Sync via CodePanel,
 * Resizable Dual-Splitter Workspace, and Interactive Visualization via GraphCanvas.
 */

import { listPresets, getPresetGraph, getPresetRaw } from '../../app/presets/presets.js';
import { AlgorithmRegistry } from '../../app/algorithms/AlgorithmRegistry.js';
import { PlaybackController } from '../../app/playback/PlaybackController.js';
import { StepFormatter } from '../../app/presentation/StepFormatter.js';
import { AlgorithmStatus } from '../../core/models/Types.js';

import { GraphCanvas } from '../components/GraphCanvas.js';
import { PlaybackControls } from '../components/PlaybackControls.js';
import { StepDetails } from '../components/StepDetails.js';
import { CodePanel } from '../components/CodePanel.js';
import { StateTable } from '../components/StateTable.js';
import { GraphSourceModal } from '../components/GraphSourceModal.js';
import { ALGORITHM_CODE } from '../components/codeMappings.js';

export class LabView {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.container]
   */
  constructor({ container = null } = {}) {
    this.container = container;

    this.currentGraph = null;
    this.currentPresetKey = 'building';
    this.currentPresetRaw = null;
    this.currentAlgo = 'dijkstra';
    this.playbackController = null;
    this.algorithmResult = null;
    this.currentSplitPct = 42; // Default 42% graph / 58% code
    this.currentSplitYPct = 62; // Default 62% top workspace / 38% table
    this.focusMode = null; // null | 'lab' | 'graph' | 'code' | 'table'
    this._isSettingFocus = false;
    this._escHandler = null;
    this._fullscreenChangeHandler = null;

    if (this.container) {
      this.render();
    }
  }

  get graph() {
    return this.currentGraph;
  }

  set graph(g) {
    this.currentGraph = g;
    if (this.container) {
      this.setAlgorithm(this.currentAlgo);
    }
  }

  get controller() {
    return this.playbackController;
  }

  get startNode() {
    const sel = this.container ? this.container.querySelector('#startNodeSelect') : null;
    return sel ? sel.value : null;
  }

  set startNode(val) {
    const sel = this.container ? this.container.querySelector('#startNodeSelect') : null;
    if (sel) sel.value = val;
  }

  get targetNode() {
    const sel = this.container ? this.container.querySelector('#endNodeSelect') : null;
    return sel ? sel.value : null;
  }

  set targetNode(val) {
    const sel = this.container ? this.container.querySelector('#endNodeSelect') : null;
    if (sel) sel.value = val;
  }

  get endNode() {
    return this.targetNode;
  }

  set endNode(val) {
    this.targetNode = val;
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

    this._render();
    this._initComponents();
    this._initSplitters();
    this._bindEvents();

    // Load initial preset
    this.loadPreset('building');
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }

  _render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="lab-layout">
        <!-- Top Toolbar with 2-Row Stable Layout -->
        <div class="lab-toolbar">
          <!-- ROW 1: Algorithm Tabs & Graph Controls -->
          <div class="toolbar-row toolbar-row-main">
            <div class="toolbar-left-cluster">
              <!-- Slot 2: Algorithm Switcher (Primary Position, Synchronized with other Labs) -->
              <div class="toolbar-slot slot-algo">
                <div class="algo-switch" id="algoSwitch">
                  <button type="button" class="algo-switch-btn btn-tab active" data-algo="dijkstra">🛣️ Dijkstra</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="kruskal">🌲 Kruskal</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="prim">🌿 Prim</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="euler">🔄 Euler</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="hamilton">🔁 Hamilton</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="bellman_ford">📉 Bellman-Ford</button>
                  <button type="button" class="algo-switch-btn btn-tab" data-algo="johnson">🧭 Johnson</button>
                </div>
              </div>

              <!-- Slot 1: Preset & Custom Graph & Import -->
              <div class="toolbar-slot slot-preset">
                <span class="toolbar-label">Đồ thị:</span>
                <select id="presetSelect" class="form-select" title="Chọn đồ thị mẫu có sẵn"></select>
                <button class="btn-sm" id="btnOpenCustomModal" title="Tự nhập danh sách cạnh hoặc ma trận kề">✏️ Tự tạo</button>
                <button class="btn-sm" id="btnOpenAiImportModal" title="Nhập đồ thị từ ảnh hoặc tệp (AI)">📷 Nhập ảnh/tệp</button>
              </div>
            </div>

            <!-- Right: Fullscreen -->
            <div class="toolbar-right-cluster">
              <!-- Slot: Full Lab Fullscreen Button -->
              <div class="toolbar-slot slot-fullscreen">
                <button type="button" class="btn-sm btn-fullscreen" id="btnLabFullscreen" title="Mở rộng toàn bộ phòng thí nghiệm toàn màn hình (Esc để thoát)">
                  ⛶ Toàn màn hình
                </button>
              </div>
            </div>
          </div>

          <!-- ROW 2: Parameters Strip (Source, Target, Modes) -->
          <div class="toolbar-row toolbar-row-params" id="toolbarParamsRow">
            <div class="toolbar-params-cluster">
              <!-- Slot 3: Parameter 1 (Start Node) -->
              <div class="toolbar-slot slot-start-node" id="startNodeSlot">
                <div id="startNodeWrap" class="slot-param-inner">
                  <span class="toolbar-label">Nguồn:</span>
                  <select id="startNodeSelect" class="form-select"></select>
                </div>
              </div>

              <!-- Slot 4: Parameter 2 (End Node OR Hamilton Mode) -->
              <div class="toolbar-slot slot-second-param" id="secondParamSlot">
                <div id="endNodeWrap" class="slot-param-inner">
                  <span class="toolbar-label">Đích:</span>
                  <select id="endNodeSelect" class="form-select"></select>
                </div>
                <div id="hamModeWrap" class="slot-param-inner ham-mode-inner" style="display:none;">
                  <span class="toolbar-label">Mục tiêu:</span>
                  <label><input type="radio" name="hamMode" value="cycle" checked> Chu trình</label>
                  <label><input type="radio" name="hamMode" value="path"> Đường đi</label>
                </div>
              </div>

              <div id="paramHelpText" class="param-help-text">💡 Tìm đường đi có tổng trọng số ngắn nhất từ đỉnh nguồn tới đích.</div>
            </div>
          </div>
        </div>

        <!-- Main Workspace Stage -->
        <div class="lab-main-stage" id="labMainStage">
          <!-- TOP WORKSPACE: Graph (Left) & Vertical Splitter & Code/Playback (Right) -->
          <div class="lab-workspace lab-top-workspace" id="labUpperRow">
            <!-- Left Graph Pane -->
            <div class="graph-pane graph-column" id="graphColumn">
              <div class="graph-head">
                <div class="graph-head-left">
                  <span class="graph-head-icon">🌐</span>
                  <span id="graphTitleText" class="graph-title-text">Sơ đồ Đồ thị</span>
                </div>
                <div class="graph-head-right">
                  <span id="graphMetaBadge" class="graph-meta-badge"></span>
                  <span id="graphStatusTag" class="graph-status-tag">Sẵn sàng</span>
                  <button type="button" class="btn-sm btn-fullscreen" id="btnGraphFullscreen" title="Phóng to sơ đồ đồ thị toàn màn hình (Esc để thoát)">⛶</button>
                </div>
              </div>

              <!-- Compact Step Details Status Strip under Graph Header -->
              <div id="stepDetailsContainer"></div>

              <div class="graph-viewport" id="graphCanvasWrap">
                <svg id="svgCanvas" viewBox="0 0 940 450" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <marker id="arrow-default" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
                    </marker>
                    <marker id="arrow-checking" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ffc107" />
                    </marker>
                    <marker id="arrow-relaxed" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00ff88" />
                    </marker>
                    <marker id="arrow-path" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ff4500" />
                    </marker>
                    <marker id="arrow-rejected" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                    </marker>
                  </defs>
                  <g id="zoomLayer"></g>
                </svg>

                <div class="zoom-controls">
                  <button class="zoom-btn" id="btnZoomIn" title="Phóng to (+)">+</button>
                  <button class="zoom-btn" id="btnZoomOut" title="Thu nhỏ (-)">−</button>
                  <button class="zoom-btn" id="btnZoomReset" title="Đặt lại 100% (⟲)">⟲</button>
                  <span class="zoom-text" id="zoomLevelText">100%</span>
                </div>
              </div>
            </div>

            <!-- Resizable Vertical Splitter 1 (Graph vs Code) -->
            <div class="lab-splitter lab-splitter-v" id="labSplitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Điều chỉnh độ rộng vùng đồ thị và mã nguồn" title="Kéo hoặc dùng phím mũi tên Trái/Phải để chỉnh độ rộng">
              <div class="splitter-handle splitter-handle-v"></div>
            </div>

            <!-- Right Source Code & Playback Pane -->
            <div class="code-pane step-column" id="stepColumn">
              <div id="codePanelContainer" class="code-panel-container"></div>
              <div id="playbackControlsContainer" class="playback-container"></div>
            </div>
          </div>

          <!-- Resizable Horizontal Splitter 2 (Top Workspace vs Bottom Table) -->
          <div class="lab-splitter-h" id="labSplitterH" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Điều chỉnh độ cao vùng làm việc trên và bảng tiến trình" title="Kéo hoặc dùng phím Mũi tên Lên/Xuống để chỉnh độ cao">
            <div class="splitter-handle-h"></div>
          </div>

          <!-- BOTTOM WORKSPACE: State / Progress Table -->
          <div class="table-pane lab-bottom-workspace" id="stateTableContainer"></div>
        </div>

        <!-- User Input Modal Container -->
        <div id="modalContainer"></div>
      </div>
    `;
  }

  _initComponents() {
    // 1. Populate Presets Dropdown
    this.presetSelect = this.container.querySelector('#presetSelect');
    const presets = listPresets();
    this.presetSelect.innerHTML = presets.map(p => `
      <option value="${p.key}">${p.name} (${p.nodeCount} đỉnh, ${p.directed ? 'có hướng' : 'vô hướng'})</option>
    `).join('');

    // 2. Initialize Graph Canvas
    const svgEl = this.container.querySelector('#svgCanvas');
    const zoomLayer = this.container.querySelector('#zoomLayer');
    this.graphCanvas = new GraphCanvas({
      svgElement: svgEl,
      zoomLayer: zoomLayer,
      onNodeClick: (nodeId) => this._handleNodeClick(nodeId),
    });

    // 3. Zoom Controls
    this.container.querySelector('#btnZoomIn').addEventListener('click', () => {
      this.graphCanvas.zoom(0.15);
      this._updateZoomText();
    });
    this.container.querySelector('#btnZoomOut').addEventListener('click', () => {
      this.graphCanvas.zoom(-0.15);
      this._updateZoomText();
    });
    this.container.querySelector('#btnZoomReset').addEventListener('click', () => {
      this.graphCanvas.resetZoom();
      this._updateZoomText();
    });

    // 4. Compact Step Details Strip
    this.stepDetails = new StepDetails({
      container: this.container.querySelector('#stepDetailsContainer'),
    });

    // 5. Code Panel (Real Source Code Viewer)
    this.codePanel = new CodePanel({
      container: this.container.querySelector('#codePanelContainer'),
      algorithmKey: this.currentAlgo,
      onLanguageChange: () => this._handleStepChange(),
      onFullscreenToggle: () => this.toggleFocusMode('code'),
    });

    // 6. Playback Controls with Direct Step Jump and Unified Execution
    this.playbackControls = new PlaybackControls({
      container: this.container.querySelector('#playbackControlsContainer'),
      onStepChange: () => this._handleStepChange(),
      onPlayRequest: () => {
        if (!this.playbackController || !this.algorithmResult) {
          this.runAlgorithm(true);
        } else {
          if (this.playbackController.isAtEnd) {
            this.playbackController.first();
            this.playbackController.play();
          } else {
            this.playbackController.togglePlay();
          }
        }
      },
      onFirstRequest: () => {
        if (!this.playbackController || !this.algorithmResult) {
          this.runAlgorithm(false);
        } else {
          this.playbackController.pause();
          this.playbackController.first();
        }
      },
      onPrevRequest: () => {
        if (!this.playbackController || !this.algorithmResult) {
          this.runAlgorithm(false);
        } else {
          this.playbackController.pause();
          this.playbackController.prev();
        }
      },
      onNextRequest: () => {
        if (!this.playbackController || !this.algorithmResult) {
          this.runAlgorithm(false);
          if (this.playbackController && this.playbackController.totalSteps > 1) {
            this.playbackController.next();
          }
        } else {
          this.playbackController.pause();
          if (this.playbackController.isAtEnd) {
            this.playbackController.first();
          } else {
            this.playbackController.next();
          }
        }
      },
      onLastRequest: () => {
        if (!this.playbackController || !this.algorithmResult) {
          this.runAlgorithm(false);
          if (this.playbackController && this.playbackController.totalSteps > 0) {
            this.playbackController.last();
          }
        } else {
          this.playbackController.pause();
          this.playbackController.last();
        }
      },
    });

    // 7. State Table with 3 Modes and Fullscreen Expand
    this.stateTable = new StateTable({
      container: this.container.querySelector('#stateTableContainer'),
      onStepSelect: (stepIndex) => {
        if (this.playbackController) {
          this.playbackController.goto(stepIndex);
        }
      },
      onExpandToggle: (isExpanded) => {
        this.setFocusMode(isExpanded ? 'table' : null);
      },
    });

    // 8. Graph Source Modal
    this.sourceModal = new GraphSourceModal({
      container: this.container.querySelector('#modalContainer'),
      onGraphCreated: (graph, name, preferredAlgo) => {
        this.setCustomGraph(graph, name, preferredAlgo);
      },
    });

    // 9. Fullscreen / Focus Mode Button Listeners
    const btnLabFs = this.container.querySelector('#btnLabFullscreen');
    if (btnLabFs) {
      btnLabFs.addEventListener('click', () => this.toggleFocusMode('lab'));
    }

    const btnGraphFs = this.container.querySelector('#btnGraphFullscreen');
    if (btnGraphFs) {
      btnGraphFs.addEventListener('click', () => this.toggleFocusMode('graph'));
    }
  }

  _initSplitters() {
    this._initSplitterV();
    this._initSplitterH();
  }

  _initSplitterV() {
    const splitter = this.container.querySelector('#labSplitter');
    const topWorkspace = this.container.querySelector('#labUpperRow');
    const graphColumn = this.container.querySelector('#graphColumn');
    const stepColumn = this.container.querySelector('#stepColumn');

    if (!splitter || !topWorkspace || !graphColumn || !stepColumn) return;

    let isDragging = false;

    const setSplit = (pct) => {
      // Clamp between 30% and 68%
      const clamped = Math.max(30, Math.min(68, pct));
      this.currentSplitPct = clamped;
      graphColumn.style.width = `${clamped}%`;
      graphColumn.style.flex = `0 0 ${clamped}%`;
      stepColumn.style.width = `${100 - clamped}%`;
      stepColumn.style.flex = `0 0 ${100 - clamped}%`;
      splitter.setAttribute('aria-valuenow', Math.round(clamped));
    };

    setSplit(this.currentSplitPct);
    this._setSplit = setSplit;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const rect = topWorkspace.getBoundingClientRect();
      if (rect.width <= 0) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const newPct = ((clientX - rect.left) / rect.width) * 100;
      setSplit(newPct);
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        splitter.classList.remove('dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        if (document.body) {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      }
    };

    const startDrag = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isDragging = true;
      splitter.classList.add('dragging');
      if (document.body) {
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      e.preventDefault();
    };

    splitter.addEventListener('pointerdown', startDrag);
    splitter.addEventListener('mousedown', startDrag);

    // Keyboard accessibility
    splitter.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        setSplit(this.currentSplitPct - 2);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setSplit(this.currentSplitPct + 2);
        e.preventDefault();
      } else if (e.key === 'Home') {
        setSplit(30);
        e.preventDefault();
      } else if (e.key === 'End') {
        setSplit(68);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        setSplit(42);
        e.preventDefault();
      }
    });
  }

  _initSplitterH() {
    const splitterH = this.container.querySelector('#labSplitterH');
    const mainStage = this.container.querySelector('#labMainStage');
    const topWorkspace = this.container.querySelector('#labUpperRow');
    const tableContainer = this.container.querySelector('#stateTableContainer');

    if (!splitterH || !mainStage || !topWorkspace || !tableContainer) return;

    let isDragging = false;

    const setSplitH = (pct) => {
      // Clamp between 40% (top min-height ~280px) and 78% (table min-height ~160px)
      const clamped = Math.max(40, Math.min(78, pct));
      this.currentSplitYPct = clamped;
      topWorkspace.style.height = `${clamped}%`;
      topWorkspace.style.flex = `0 0 ${clamped}%`;
      tableContainer.style.height = `${100 - clamped}%`;
      tableContainer.style.flex = `0 0 ${100 - clamped}%`;
      splitterH.setAttribute('aria-valuenow', Math.round(clamped));
    };

    setSplitH(this.currentSplitYPct);
    this._setSplitH = setSplitH;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const rect = mainStage.getBoundingClientRect();
      if (rect.height <= 0) return;
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const newPct = ((clientY - rect.top) / rect.height) * 100;
      setSplitH(newPct);
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        splitterH.classList.remove('dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('mousemove', onPointerMove);
        document.removeEventListener('mouseup', onPointerUp);
        if (document.body) {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      }
    };

    const startDrag = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isDragging = true;
      splitterH.classList.add('dragging');
      if (document.body) {
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('mousemove', onPointerMove);
      document.addEventListener('mouseup', onPointerUp);
      e.preventDefault();
    };

    splitterH.addEventListener('pointerdown', startDrag);
    splitterH.addEventListener('mousedown', startDrag);

    // Keyboard accessibility
    splitterH.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        setSplitH(this.currentSplitYPct - 2);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSplitH(this.currentSplitYPct + 2);
        e.preventDefault();
      } else if (e.key === 'Home') {
        setSplitH(40);
        e.preventDefault();
      } else if (e.key === 'End') {
        setSplitH(75);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        setSplitH(62);
        e.preventDefault();
      }
    });
  }

  _updateZoomText() {
    const textEl = this.container.querySelector('#zoomLevelText');
    if (textEl && this.graphCanvas) {
      textEl.textContent = `${Math.round(this.graphCanvas.scale * 100)}%`;
    }
  }

  _bindEvents() {
    // Preset change
    this.presetSelect.addEventListener('change', (e) => {
      this.loadPreset(e.target.value);
    });

    // Open custom modal
    this.container.querySelector('#btnOpenCustomModal').addEventListener('click', () => {
      this.sourceModal.open();
    });

    const btnAi = this.container.querySelector('#btnOpenAiImportModal');
    if (btnAi) {
      btnAi.addEventListener('click', () => {
        this.sourceModal.open('file');
      });
    }

    // Direct drag and drop of file onto Graph Canvas
    const canvasWrap = this.container.querySelector('#graphCanvasWrap') || this.container.querySelector('#graphColumn');
    if (canvasWrap) {
      ['dragenter', 'dragover'].forEach(evt => {
        canvasWrap.addEventListener(evt, (e) => {
          e.preventDefault();
          canvasWrap.classList.add('canvas-drag-active');
        });
      });
      ['dragleave', 'drop'].forEach(evt => {
        canvasWrap.addEventListener(evt, (e) => {
          e.preventDefault();
          canvasWrap.classList.remove('canvas-drag-active');
        });
      });
      canvasWrap.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasWrap.classList.remove('canvas-drag-active');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          this.sourceModal.openWithFile(files[0]);
        }
      });
    }

    // Algo switch buttons
    const algoSwitch = this.container.querySelector('#algoSwitch');
    algoSwitch.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        algoSwitch.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setAlgorithm(btn.getAttribute('data-algo'));
      });
    });

    // Node dropdown changes - clean reset on configuration update
    this.container.querySelector('#startNodeSelect').addEventListener('change', () => {
      this._resetPlayback();
      this._updateNodeSelectionRoles();
      this._updateCodePanelGraph();
    });
    this.container.querySelector('#endNodeSelect').addEventListener('change', () => {
      this._resetPlayback();
      this._updateNodeSelectionRoles();
      this._updateCodePanelGraph();
    });

    // Hamilton mode change - clean reset
    this.container.querySelectorAll('input[name="hamMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this._resetPlayback();
        this._updateCodePanelGraph();
      });
    });

    // Escape key listener for focus modes
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.focusMode) {
        this.setFocusMode(null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._escHandler);
    }

    // Native browser fullscreen change listener to sync mode on Esc or browser exit
    this._fullscreenChangeHandler = () => {
      if (typeof document === 'undefined') return;
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      if (!isFs && this.focusMode === 'lab') {
        this.setFocusMode(null);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this._fullscreenChangeHandler);
      document.addEventListener('webkitfullscreenchange', this._fullscreenChangeHandler);
    }
  }

  loadPreset(presetKey) {
    this.currentPresetKey = presetKey;
    try {
      this.currentGraph = getPresetGraph(presetKey);
      this.currentPresetRaw = getPresetRaw(presetKey);

      // Determine default algo from preset
      const presetInfo = listPresets().find(p => p.key === presetKey);
      const defaultAlgo = presetInfo ? presetInfo.algo : 'dijkstra';

      this._updateGraphDisplay(presetInfo ? presetInfo.name : presetKey);
      this.setAlgorithm(defaultAlgo);
    } catch (err) {
      alert(`Lỗi khi nạp đồ thị preset: ${err.message}`);
    }
  }

  setCustomGraph(graph, name, preferredAlgo = 'dijkstra') {
    this.currentGraph = graph;
    this.currentPresetKey = null;
    this.currentPresetRaw = null;

    this._updateGraphDisplay(name);
    this.setAlgorithm(preferredAlgo);
  }

  _updateGraphDisplay(title) {
    if (!this.currentGraph) return;

    // Render Canvas
    this.graphCanvas.setGraph(this.currentGraph, this.currentPresetRaw);

    // Update Meta Badge
    const nodes = this.currentGraph.getNodes();
    const edges = this.currentGraph.getEdges();
    const metaBadge = this.container.querySelector('#graphMetaBadge');
    if (metaBadge) {
      metaBadge.textContent = `${nodes.length} đỉnh, ${edges.length} cạnh (${this.currentGraph.isDirected ? 'Có hướng' : 'Vô hướng'})`;
    }

    const titleEl = this.container.querySelector('#graphTitleText');
    if (titleEl) {
      titleEl.textContent = title;
    }

    // Populate node dropdowns
    this._populateNodeSelects();
    this._updateNodeSelectionRoles();
    this._updateCodePanelGraph();
  }

  _populateNodeSelects() {
    if (!this.currentGraph) return;

    const nodes = this.currentGraph.getNodes();
    const startSelect = this.container.querySelector('#startNodeSelect');
    const endSelect = this.container.querySelector('#endNodeSelect');

    const optionsHtml = nodes.map(n => `<option value="${n.id}">${n.label || n.id}</option>`).join('');
    startSelect.innerHTML = optionsHtml;
    endSelect.innerHTML = optionsHtml;

    // Default target to last node if more than 1 node
    if (nodes.length > 1) {
      endSelect.value = nodes[nodes.length - 1].id;
    }
  }

  _updateNodeSelectionRoles() {
    if (!this.graphCanvas) return;
    const startSelect = this.container.querySelector('#startNodeSelect');
    const endSelect = this.container.querySelector('#endNodeSelect');

    const startNodeId = (this.currentAlgo !== 'kruskal' && startSelect) ? startSelect.value : null;
    const targetNodeId = ((this.currentAlgo === 'dijkstra' || this.currentAlgo === 'bellman_ford' || this.currentAlgo === 'bellmanford') && endSelect) ? endSelect.value : null;

    this.graphCanvas.setSelectionRoles({ startNodeId, targetNodeId });
  }

  _updateCodePanelGraph() {
    if (!this.codePanel || !this.container) return;
    const startSelect = this.container.querySelector('#startNodeSelect');
    const endSelect = this.container.querySelector('#endNodeSelect');
    const hamModeRadio = this.container.querySelector('input[name="hamMode"]:checked');

    this.codePanel.setGraph(this.currentGraph, {
      startNodeId: startSelect ? startSelect.value : null,
      endNodeId: endSelect ? endSelect.value : null,
      wantCycle: hamModeRadio ? (hamModeRadio.value === 'cycle') : true,
    });
  }

  setAlgorithm(algoKey) {
    this.currentAlgo = algoKey;

    // Update button states
    const algoSwitch = this.container.querySelector('#algoSwitch');
    algoSwitch.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-algo') === algoKey);
    });

    // Update options visibility without collapsing slots
    const startWrap = this.container.querySelector('#startNodeWrap');
    const endWrap = this.container.querySelector('#endNodeWrap');
    const hamWrap = this.container.querySelector('#hamModeWrap');

    if (startWrap) {
      if (algoKey === 'kruskal') {
        startWrap.style.visibility = 'hidden';
      } else {
        startWrap.style.display = 'flex';
        startWrap.style.visibility = 'visible';
      }
    }

    if (algoKey === 'dijkstra' || algoKey === 'bellman_ford' || algoKey === 'bellmanford') {
      if (endWrap) {
        endWrap.style.display = 'flex';
        endWrap.style.visibility = 'visible';
      }
      if (hamWrap) hamWrap.style.display = 'none';
    } else if (algoKey === 'hamilton') {
      if (endWrap) endWrap.style.display = 'none';
      if (hamWrap) {
        hamWrap.style.display = 'flex';
        hamWrap.style.visibility = 'visible';
      }
    } else {
      // kruskal, prim, euler
      if (endWrap) endWrap.style.display = 'none';
      if (hamWrap) hamWrap.style.display = 'none';
    }

    // Update parameter helper text
    const helpEl = this.container ? this.container.querySelector('#paramHelpText') : null;
    if (helpEl) {
      helpEl.style.color = '';
      if (algoKey === 'kruskal') {
        helpEl.textContent = '💡 Kruskal tự động tìm cây khung nhỏ nhất trên toàn bộ đồ thị (không cần chọn đỉnh).';
      } else if (algoKey === 'prim') {
        helpEl.textContent = '💡 Prim phát triển cây khung nhỏ nhất bắt đầu từ đỉnh nguồn.';
      } else if (algoKey === 'euler') {
        helpEl.textContent = '💡 Euler duyệt qua mỗi cạnh đúng một lần bắt đầu từ đỉnh nguồn.';
      } else if (algoKey === 'hamilton') {
        helpEl.textContent = '💡 Hamilton duyệt qua mỗi đỉnh đúng một lần bắt đầu từ đỉnh nguồn.';
      } else if (algoKey === 'bellman_ford' || algoKey === 'bellmanford') {
        helpEl.textContent = '💡 Bellman-Ford tìm đường đi ngắn nhất từ đỉnh nguồn, hỗ trợ trọng số âm và phát hiện chu trình âm.';
      } else {
        helpEl.textContent = '💡 Tìm đường đi có tổng trọng số ngắn nhất từ đỉnh nguồn tới đích.';
      }
    }

    // Check algorithm compatibility with graph directedness (LỖI 2)
    const meta = AlgorithmRegistry.getMetadata(algoKey);
    if (meta?.requiresUndirected && this.currentGraph?.isDirected) {
      if (helpEl) {
        helpEl.textContent = `⚠️ Thuật toán ${algoKey.toUpperCase()} chỉ hỗ trợ đồ thị vô hướng. Đồ thị hiện tại là có hướng.`;
        helpEl.style.color = 'var(--red)';
      }
      if (this.playbackControls && this.playbackControls.btnPlay) {
        this.playbackControls.btnPlay.disabled = true;
        this.playbackControls.btnPlay.title = `Thuật toán ${algoKey.toUpperCase()} chỉ hỗ trợ đồ thị vô hướng`;
      }
    } else {
      if (this.playbackControls && this.playbackControls.btnPlay) {
        this.playbackControls.btnPlay.disabled = false;
        this.playbackControls.btnPlay.title = 'Chạy thuật toán (Space)';
      }
    }

    // Update code panel algorithm
    if (this.codePanel) {
      this.codePanel.setAlgorithm(algoKey);
      this._updateCodePanelGraph();
    }

    // Reset playback for new algorithm
    this._resetPlayback();
    this._updateNodeSelectionRoles();
  }

  _handleNodeClick(nodeId) {
    const startSelect = this.container.querySelector('#startNodeSelect');
    const endSelect = this.container.querySelector('#endNodeSelect');

    if (this.currentAlgo === 'dijkstra' || this.currentAlgo === 'bellman_ford' || this.currentAlgo === 'bellmanford') {
      if (!startSelect.value || startSelect.value === nodeId) {
        startSelect.value = nodeId;
      } else if (!endSelect.value || endSelect.value !== nodeId) {
        endSelect.value = nodeId;
      } else {
        startSelect.value = nodeId;
      }
    } else {
      startSelect.value = nodeId;
    }

    this._resetPlayback();
    this._updateNodeSelectionRoles();
    this._updateCodePanelGraph();
  }

  runAlgorithm(autoPlay = false) {
    if (!this.currentGraph) return null;

    const startSelect = this.container ? this.container.querySelector('#startNodeSelect') : null;
    const endSelect = this.container ? this.container.querySelector('#endNodeSelect') : null;
    const hamModeRadio = this.container ? this.container.querySelector('input[name="hamMode"]:checked') : null;

    const options = {};
    if (startSelect && startSelect.value) options.startNodeId = startSelect.value;
    if ((this.currentAlgo === 'dijkstra' || this.currentAlgo === 'bellman_ford' || this.currentAlgo === 'bellmanford') && endSelect && endSelect.value) {
      options.endNodeId = endSelect.value;
    }
    if (this.currentAlgo === 'hamilton') {
      options.wantCycle = hamModeRadio ? (hamModeRadio.value === 'cycle') : true;
    }

    try {
      // Execute through AlgorithmRegistry
      this.algorithmResult = AlgorithmRegistry.run(this.currentAlgo, this.currentGraph, options);
      const res = this.algorithmResult;
      const statusTag = this.container ? this.container.querySelector('#graphStatusTag') : null;

      const isErrorStatus =
        res.status === AlgorithmStatus.UNSUPPORTED ||
        res.status === AlgorithmStatus.INVALID_INPUT ||
        (res.status === AlgorithmStatus.FAILURE && (!res.steps || res.steps.length === 0));

      if (isErrorStatus) {
        this.playbackController = null;
        if (this.playbackControls) {
          this.playbackControls.setController(null);
        }

        const errMsg = res.message || (res.warnings && res.warnings[0]) || 'Thuật toán không thể thực thi với dữ liệu hiện tại';
        if (statusTag) {
          statusTag.textContent = errMsg;
          statusTag.style.color = 'var(--red)';
        }

        alert(`Không thể thực thi thuật toán: ${errMsg}`);
        return false;
      }

      // Create PlaybackController
      this.playbackController = new PlaybackController({
        steps: res.steps || [],
      });

      // Hook up to PlaybackControls
      if (this.playbackControls) {
        this.playbackControls.setController(this.playbackController);
      }

      // Update status tag with appropriate color based on status
      if (statusTag) {
        const stepCount = res.steps ? res.steps.length : 0;
        if (res.status === AlgorithmStatus.PARTIAL || res.status === AlgorithmStatus.UNREACHABLE) {
          statusTag.textContent = res.message || `Đã tạo ${stepCount} bước (Chưa hoàn thành)`;
          statusTag.style.color = 'var(--accent)';
        } else if (res.status === AlgorithmStatus.SUCCESS) {
          statusTag.textContent = `Đã tạo ${stepCount} bước`;
          statusTag.style.color = 'var(--green)';
        } else {
          statusTag.textContent = res.message || `Đã tạo ${stepCount} bước`;
          statusTag.style.color = 'var(--accent)';
        }
      }

      // Trigger first step render
      this._handleStepChange();

      if (autoPlay && this.playbackController) {
        this.playbackController.play();
      }

      return true;
    } catch (err) {
      const statusTag = this.container ? this.container.querySelector('#graphStatusTag') : null;
      if (statusTag) {
        statusTag.textContent = `Lỗi: ${err.message}`;
        statusTag.style.color = 'var(--red)';
      }
      alert(`Không thể thực thi thuật toán: ${err.message}`);
      return false;
    }
  }

  _handleStepChange() {
    if (!this.playbackController || !this.currentGraph) return;

    const currentStep = this.playbackController.currentStep;
    const currentIndex = this.playbackController.currentIndex;
    const algoMapping = this.codePanel ? this.codePanel.getCurrentMapping() : (ALGORITHM_CODE[this.currentAlgo]?.mapping || {});

    // Pure transformation via StepFormatter
    const presentationStep = StepFormatter.formatStep(currentStep, this.currentGraph, {
      algorithmKey: this.currentAlgo,
      codeMapping: algoMapping,
    });

    // Update subcomponents
    this.stepDetails.update(presentationStep);
    this.codePanel.update(presentationStep ? presentationStep.activeLines : []);

    // Update StateTable with full step data for Progressive, Current, and Full views
    this.stateTable.update({
      steps: this.algorithmResult ? this.algorithmResult.steps : [],
      currentIndex: currentIndex,
      graph: this.currentGraph,
      context: {
        algorithmKey: this.currentAlgo,
        codeMapping: algoMapping,
      },
      tableData: presentationStep ? presentationStep.table : null,
    });

    this.graphCanvas.applyStepHighlights(presentationStep);
  }

  _resetPlayback() {
    if (this.playbackController) {
      this.playbackController.pause();
      this.playbackController = null;
    }
    this.algorithmResult = null;
    this.playbackControls.setController(null);
    this.stepDetails.update(null);
    this.codePanel.reset();
    this.stateTable.update(null);
    this.graphCanvas.applyStepHighlights(null);

    const statusTag = this.container.querySelector('#graphStatusTag');
    if (statusTag) {
      statusTag.textContent = 'Sẵn sàng';
      statusTag.style.color = 'var(--orange)';
    }
  }

  /**
   * Sets or clears active Focus Mode.
   * Preserves all algorithm state, current step, and split percentages.
   * @param {'lab'|'graph'|'code'|'table'|null} mode
   */
  setFocusMode(mode) {
    if (this._isSettingFocus) return;
    this._isSettingFocus = true;

    try {
      const prevMode = this.focusMode;
      const targetMode = mode;
      this.focusMode = targetMode;

      const labLayout = this.container ? this.container.querySelector('.lab-layout') : null;
      if (labLayout) {
        labLayout.classList.remove('focus-lab', 'focus-graph', 'focus-code', 'focus-table');
        if (targetMode) {
          labLayout.classList.add(`focus-${targetMode}`);
        }
      }

      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('has-lab-focus-mode', Boolean(targetMode));
        document.body.classList.toggle('is-fullscreen-mode', targetMode === 'lab');
      }

      // Native Browser Fullscreen API invocation for Full Lab mode
      if (typeof document !== 'undefined') {
        const isCurrentlyFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        if (targetMode === 'lab') {
          if (!isCurrentlyFullscreen) {
            const docEl = document.documentElement;
            const reqFs = docEl.requestFullscreen ||
                          docEl.webkitRequestFullscreen ||
                          document.body.requestFullscreen;
            if (typeof reqFs === 'function') {
              try {
                const p = reqFs.call(docEl);
                if (p && typeof p.catch === 'function') {
                  p.catch(() => {});
                }
              } catch (_) {}
            }
          }
        } else if (prevMode === 'lab' && targetMode !== 'lab' && isCurrentlyFullscreen) {
          const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
          if (typeof exitFs === 'function') {
            try {
              const p = exitFs.call(document);
              if (p && typeof p.catch === 'function') {
                p.catch(() => {});
              }
            } catch (_) {}
          }
        }
      }

      // Update button text and labels
      const btnLabFs = this.container ? this.container.querySelector('#btnLabFullscreen') : null;
      if (btnLabFs) {
        btnLabFs.textContent = targetMode === 'lab' ? '✕ Thu nhỏ' : '⛶ Toàn màn hình';
        btnLabFs.title = targetMode === 'lab' ? 'Thu nhỏ về giao diện thường (Esc)' : 'Mở rộng toàn bộ phòng thí nghiệm toàn màn hình';
      }

      const btnGraphFs = this.container ? this.container.querySelector('#btnGraphFullscreen') : null;
      if (btnGraphFs) {
        btnGraphFs.textContent = targetMode === 'graph' ? '✕' : '⛶';
        btnGraphFs.title = targetMode === 'graph' ? 'Thu nhỏ về giao diện thường (Esc)' : 'Phóng to sơ đồ đồ thị';
      }

      if (this.codePanel && this.codePanel.btnFullscreen) {
        this.codePanel.btnFullscreen.textContent = targetMode === 'code' ? '✕' : '⛶';
        this.codePanel.btnFullscreen.title = targetMode === 'code' ? 'Thu nhỏ về giao diện thường (Esc)' : 'Phóng to mã nguồn';
      }

      if (this.stateTable) {
        if (targetMode === 'table') {
          if (!this.stateTable.isExpanded) this.stateTable.toggleExpand(true);
        } else {
          if (this.stateTable.isExpanded) this.stateTable.toggleExpand(false);
        }
      }

      // Trigger canvas scale recalculation
      if (this.graphCanvas && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          if (this.graphCanvas && typeof this.graphCanvas.resize === 'function') {
            this.graphCanvas.resize();
          }
        });
      }
    } finally {
      this._isSettingFocus = false;
    }
  }

  /**
   * Toggles focus mode on or off.
   * @param {'lab'|'graph'|'code'|'table'} mode
   */
  toggleFocusMode(mode) {
    this.setFocusMode(this.focusMode === mode ? null : mode);
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    if (this._escHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._escHandler);
    }
    if (this._fullscreenChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler);
      document.removeEventListener('webkitfullscreenchange', this._fullscreenChangeHandler);
    }
    if (this.playbackControls && typeof this.playbackControls.destroy === 'function') {
      this.playbackControls.destroy();
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('has-lab-focus-mode', 'is-fullscreen-mode');
    }
  }
}

