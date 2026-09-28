import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { listPresets, getPresetGraph, getPresetRaw } from '../../src/app/presets/presets.js';
import { AlgorithmRegistry } from '../../src/app/algorithms/AlgorithmRegistry.js';
import { PlaybackController } from '../../src/app/playback/PlaybackController.js';
import { StepFormatter } from '../../src/app/presentation/StepFormatter.js';
import { parseEdgeList } from '../../src/core/parsers/EdgeListParser.js';
import { parseAdjacencyMatrix } from '../../src/core/parsers/MatrixParser.js';
import fs from 'fs';
import path from 'path';
import { createGraphFromParser } from '../../src/core/models/GraphAdapter.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';

import { GraphCanvas } from '../../src/ui/components/GraphCanvas.js';
import { CodePanel, highlightSyntax } from '../../src/ui/components/CodePanel.js';
import { PlaybackControls } from '../../src/ui/components/PlaybackControls.js';
import { StateTable } from '../../src/ui/components/StateTable.js';
import { ALGORITHM_CODE } from '../../src/ui/components/codeMappings.js';
import { GraphSourceModal } from '../../src/ui/components/GraphSourceModal.js';
import {
  analyzeGraphFile,
  validateFileSupport,
  validateGraphSpecification,
  createGraphFromSpecification,
  graphToSpecification,
  graphToEdgeList,
  graphToAdjacencyMatrix,
  setAnalyzerProvider,
  getAnalyzerProvider,
  SUPPORTED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../../src/app/ai/GraphVisionAdapter.js';
import { App, initApp } from '../../src/ui/app.js';
import { HomeView } from '../../src/ui/views/HomeView.js';
import { TheoryView } from '../../src/ui/views/TheoryView.js';
import { LabView } from '../../src/ui/views/LabView.js';
import { AiAssistantView } from '../../src/ui/views/AiAssistantView.js';

describe('Phase 4: New UI & Application Integration Suite (Day 1, Day 2, Day 2.5 & Day 2.75)', () => {
  // =========================================================================
  // 1. END-TO-END APPLICATION FLOW (Preset -> Registry -> Playback -> Formatter)
  // =========================================================================
  describe('Application Flow: Preset -> Graph -> Registry -> Playback -> Formatter', () => {
    it('executes Dijkstra end-to-end on building preset', () => {
      // 1. Preset to Graph
      const graph = getPresetGraph('building');
      expect(graph.nodeCount).toBe(10);
      expect(graph.edgeCount).toBe(10);

      // 2. Algorithm Registry
      const result = AlgorithmRegistry.run('dijkstra', graph, {
        startNodeId: 'sanh_chinh',
        endNodeId: 'phong_103',
      });
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.steps.length).toBeGreaterThan(0);

      // 3. Playback Controller
      const playback = new PlaybackController({ steps: result.steps });
      expect(playback.totalSteps).toBe(result.steps.length);
      expect(playback.currentIndex).toBe(0);

      // 4. Step Formatter
      const step0 = StepFormatter.formatStep(playback.currentStep, graph, {
        algorithmKey: 'dijkstra',
        codeMapping: ALGORITHM_CODE.dijkstra.mapping,
      });
      expect(step0).not.toBeNull();
      expect(step0.stepNumber).toBe(1);
      expect(step0.phase).toBe('Khởi tạo');
      expect(step0.table).toBeDefined();
      expect(step0.activeLines).toEqual(ALGORITHM_CODE.dijkstra.mapping[AlgorithmAction.INITIALIZE]);

      // 5. Navigation & Step Formatting
      playback.next();
      expect(playback.currentIndex).toBe(1);
      const step1 = StepFormatter.formatStep(playback.currentStep, graph, {
        algorithmKey: 'dijkstra',
        codeMapping: ALGORITHM_CODE.dijkstra.mapping,
      });
      expect(step1.stepNumber).toBe(2);

      // Jump to last step
      playback.last();
      expect(playback.isAtEnd).toBe(true);
      const lastStep = StepFormatter.formatStep(playback.currentStep, graph, {
        algorithmKey: 'dijkstra',
        codeMapping: ALGORITHM_CODE.dijkstra.mapping,
      });
      expect(lastStep.phase).toBe('Hoàn tất');
      expect(lastStep.activeLines).toEqual(ALGORITHM_CODE.dijkstra.mapping[AlgorithmAction.FINISH]);
    });

    it('executes Prim end-to-end on prim_slide preset', () => {
      const graph = getPresetGraph('prim_slide');
      const result = AlgorithmRegistry.run('prim', graph, { startNodeId: 'x1' });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.steps.length).toBeGreaterThan(0);

      const playback = new PlaybackController({ steps: result.steps });
      const firstStep = StepFormatter.formatStep(playback.currentStep, graph, {
        algorithmKey: 'prim',
        codeMapping: ALGORITHM_CODE.prim.mapping,
      });
      expect(firstStep.table.headers).toContain('Tv');
      expect(firstStep.table.headers).toContain('Te');
      expect(firstStep.activeLines).toEqual(ALGORITHM_CODE.prim.mapping[AlgorithmAction.INITIALIZE]);
    });

    it('executes Euler end-to-end on euler_circuit preset', () => {
      const graph = getPresetGraph('euler_circuit');
      const result = AlgorithmRegistry.run('euler', graph, { startNodeId: 'A' });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.type).toBe('circuit');

      const playback = new PlaybackController({ steps: result.steps });
      playback.last();
      const finalStep = StepFormatter.formatStep(playback.currentStep, graph, {
        algorithmKey: 'euler',
        codeMapping: ALGORITHM_CODE.euler.mapping,
      });
      expect(finalStep.phase).toBe('Hoàn tất');
      expect(finalStep.activeLines).toEqual(ALGORITHM_CODE.euler.mapping[AlgorithmAction.FINISH]);
    });
  });

  // =========================================================================
  // 2. USER INPUT INTEGRATION (EdgeList & Matrix -> Parser -> Adapter -> Graph)
  // =========================================================================
  describe('User Input Integration: Custom Input -> Parsers -> GraphAdapter -> Registry', () => {
    it('creates and runs graph from custom edge list input', () => {
      const edgeListText = `
        A - B: 5
        B - C: 3
        A - C: 10
      `;
      const parsed = parseEdgeList(edgeListText, false);
      const graph = createGraphFromParser(parsed);

      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(3);

      const result = AlgorithmRegistry.run('dijkstra', graph, {
        startNodeId: 'A',
        endNodeId: 'C',
      });
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(8); // A -> B (5) -> C (3) = 8 < 10
    });

    it('creates and runs graph from custom adjacency matrix input', () => {
      const matrixText = `
        A B C
        0 4 2
        4 0 1
        2 1 0
      `;
      const parsed = parseAdjacencyMatrix(matrixText, false);
      const graph = createGraphFromParser(parsed);

      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(3);

      const result = AlgorithmRegistry.run('kruskal', graph);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(3); // 1 + 2 = 3
    });
  });

  // =========================================================================
  // 3. UI SMOKE TESTS WITH JSDOM
  // =========================================================================
  describe('UI Smoke & Navigation with JSDOM', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <header class="app-header">
            <a href="#home" id="brandLogo">Logo</a>
            <button class="nav-btn active" data-view="home">Home</button>
            <button class="nav-btn" data-view="theory">Theory</button>
            <button class="nav-btn" data-view="lab">Lab</button>
            <button class="nav-btn" data-view="ai">AI</button>
            <button id="btnThemeToggle">Theme</button>
          </header>
          <main>
            <div id="homeView" class="app-view active"></div>
            <div id="theoryView" class="app-view"></div>
            <div id="labView" class="app-view"></div>
            <div id="aiView" class="app-view"></div>
          </main>
        </body>
        </html>
      `, {
        url: 'http://localhost/#home',
      });

      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.localStorage = window.localStorage;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
      delete global.localStorage;
    });

    it('renders all 4 primary navigation views in the DOM', () => {
      expect(document.getElementById('homeView')).not.toBeNull();
      expect(document.getElementById('theoryView')).not.toBeNull();
      expect(document.getElementById('labView')).not.toBeNull();
      expect(document.getElementById('aiView')).not.toBeNull();
    });

    it('can dynamically switch active views via data-view attributes', () => {
      const views = ['home', 'theory', 'lab', 'ai'];

      views.forEach(v => {
        // Simulate view activation
        views.forEach(other => {
          document.getElementById(`${other}View`).classList.toggle('active', other === v);
        });

        expect(document.getElementById(`${v}View`).classList.contains('active')).toBe(true);
      });
    });

    it('contains all 7 canonical presets in listPresets()', () => {
      const presets = listPresets();
      expect(presets.length).toBe(7);
      expect(presets.map(p => p.key)).toEqual([
        'building',
        'textbook',
        'prim_slide',
        'euler_circuit',
        'euler_path',
        'euler_none',
        'euler_disconnected',
      ]);
    });
  });

  // =========================================================================
  // 4. DAY 2: INTERACTIVE VERTEX DRAGGING & INCIDENT EDGE UPDATES
  // =========================================================================
  describe('Day 2: GraphCanvas Interactive Vertex Dragging & Updates', () => {
    let dom;
    let document;
    let window;
    let svg;
    let zoomLayer;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <svg id="svgCanvas" viewBox="0 0 940 450">
            <g id="zoomLayer"></g>
          </svg>
        </body>
        </html>
      `);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;

      svg = document.getElementById('svgCanvas');
      zoomLayer = document.getElementById('zoomLayer');
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('renders graph and allows interactive vertex dragging updating coordinates and connected edges', () => {
      const onNodeClick = vi.fn();
      const canvas = new GraphCanvas({
        svgElement: svg,
        zoomLayer: zoomLayer,
        onNodeClick,
      });

      const parsed = parseEdgeList("1 - 2: 5\n2 - 3: 4\n3 - 1: 3");
      const graph = createGraphFromParser(parsed);
      canvas.setGraph(graph);

      const node1Before = canvas.nodesMap.get('1');
      expect(node1Before).toBeDefined();
      const initialX = node1Before.x;
      const initialY = node1Before.y;

      const nodeGroup1 = zoomLayer.querySelector('#node_group_1');
      expect(nodeGroup1).not.toBeNull();

      // 1. Simulate mouse down on node 1
      nodeGroup1.dispatchEvent(new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }));
      expect(canvas.isDraggingNode).toBe(true);

      // 2. Simulate mouse move on window exceeding threshold (e.g. +50px X, +30px Y)
      window.dispatchEvent(new window.MouseEvent('mousemove', {
        clientX: 150,
        clientY: 130,
        bubbles: true,
      }));
      expect(canvas.hasMovedDistance).toBe(true);

      const node1After = canvas.nodesMap.get('1');
      expect(node1After.x).toBe(initialX + 50);
      expect(node1After.y).toBe(initialY + 30);

      // Verify incident edges updated in DOM
      const edgeLine = zoomLayer.querySelector('#edge_1_2') || zoomLayer.querySelector('#edge_2_1');
      expect(edgeLine).not.toBeNull();
      // x1 or x2 should match new node1 X
      const x1 = parseFloat(edgeLine.getAttribute('x1'));
      const x2 = parseFloat(edgeLine.getAttribute('x2'));
      expect([x1, x2]).toContain(node1After.x);

      // 3. Mouse up to end drag
      window.dispatchEvent(new window.MouseEvent('mouseup', {
        clientX: 150,
        clientY: 130,
        bubbles: true,
      }));
      expect(canvas.isDraggingNode).toBe(false);

      // Dragging must NOT trigger node click
      expect(onNodeClick).not.toHaveBeenCalled();
    });

    it('triggers onNodeClick when mouseup occurs without exceeding drag threshold', () => {
      const onNodeClick = vi.fn();
      const canvas = new GraphCanvas({
        svgElement: svg,
        zoomLayer: zoomLayer,
        onNodeClick,
      });

      const parsed = parseEdgeList("1 - 2: 5\n2 - 3: 4\n3 - 1: 3");
      const graph = createGraphFromParser(parsed);
      canvas.setGraph(graph);

      const nodeGroup2 = zoomLayer.querySelector('#node_group_2');

      // Click: mousedown and immediate mouseup at same spot
      nodeGroup2.dispatchEvent(new window.MouseEvent('mousedown', {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }));
      window.dispatchEvent(new window.MouseEvent('mouseup', {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }));

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith('2');
    });
  });

  // =========================================================================
  // 5. DAY 2: NODE SELECTION UX & ROLES
  // =========================================================================
  describe('Day 2: Node Selection UX & Roles', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <svg id="svgCanvas"><g id="zoomLayer"></g></svg>
        </body>
        </html>
      `);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('applies and persists .node-start and .node-target classes on canvas', () => {
      const canvas = new GraphCanvas({
        svgElement: document.getElementById('svgCanvas'),
        zoomLayer: document.getElementById('zoomLayer'),
      });

      const graph = getPresetGraph('building');
      canvas.setGraph(graph);

      // Set roles
      canvas.setSelectionRoles({
        startNodeId: 'sanh_chinh',
        targetNodeId: 'phong_103',
      });

      const startRect = document.querySelector('#node_sanh_chinh');
      const targetRect = document.querySelector('#node_phong_103');
      expect(startRect.classList.contains('node-start')).toBe(true);
      expect(targetRect.classList.contains('node-target')).toBe(true);

      // Apply step highlight: roles must be preserved
      canvas.applyStepHighlights({
        stepNumber: 1,
        action: 'INITIALIZE',
        highlights: { nodes: ['sanh_chinh'], edges: [] },
      });

      expect(startRect.classList.contains('node-start')).toBe(true);
      expect(targetRect.classList.contains('node-target')).toBe(true);
    });

    it('applies .settled class to settled vertices on SELECT_NODE and ACCEPT_EDGE', () => {
      const canvas = new GraphCanvas({
        svgElement: document.getElementById('svgCanvas'),
        zoomLayer: document.getElementById('zoomLayer'),
      });

      const graph = getPresetGraph('building');
      canvas.setGraph(graph);

      // SELECT_NODE (e.g. root node settlement)
      canvas.applyStepHighlights({
        stepNumber: 2,
        action: 'SELECT_NODE',
        highlights: { nodes: ['sanh_chinh'], edges: [] },
      });

      const rootRect = document.querySelector('#node_sanh_chinh');
      expect(rootRect.classList.contains('settled')).toBe(true);

      // ACCEPT_EDGE (Prim admits node into MST: [p, u])
      canvas.applyStepHighlights({
        stepNumber: 3,
        action: 'ACCEPT_EDGE',
        highlights: { nodes: ['sanh_chinh', 'phong_101'], edges: ['sanh_chinh-phong_101'] },
      });

      const pRect = document.querySelector('#node_sanh_chinh');
      const uRect = document.querySelector('#node_phong_101');
      expect(pRect.classList.contains('active-u')).toBe(true);
      expect(uRect.classList.contains('settled')).toBe(true);
    });
  });

  // =========================================================================
  // 6. DAY 2: CODEPANEL & PSEUDOCODE SYNCHRONIZATION
  // =========================================================================
  describe('Day 2: CodePanel & Pseudocode Synchronization', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body><div id="codeWrap"></div></body></html>`);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('defines complete pseudocode and mappings for all 5 algorithms', () => {
      const algos = ['dijkstra', 'kruskal', 'prim', 'euler', 'hamilton'];
      algos.forEach(algo => {
        const def = ALGORITHM_CODE[algo];
        expect(def).toBeDefined();
        expect(Array.isArray(def.lines)).toBe(true);
        expect(def.lines.length).toBeGreaterThan(0);
        expect(typeof def.mapping).toBe('object');
      });
    });

    it('renders CodePanel and updates active line classes synchronously', () => {
      const container = document.getElementById('codeWrap');
      const panel = new CodePanel({ container, algorithmKey: 'dijkstra' });

      const lines = container.querySelectorAll('.code-line');
      expect(lines.length).toBe(ALGORITHM_CODE.dijkstra.lines.length);

      // Simulate highlighting line 3 and 4 (SELECT_NODE)
      panel.update([3, 4]);

      const line3 = container.querySelector('.code-line[data-line="3"]');
      const line4 = container.querySelector('.code-line[data-line="4"]');
      const line1 = container.querySelector('.code-line[data-line="1"]');

      expect(line3.classList.contains('active-line')).toBe(true);
      expect(line4.classList.contains('active-line')).toBe(true);
      expect(line1.classList.contains('active-line')).toBe(false);

      // Switch to Kruskal
      panel.setAlgorithm('kruskal');
      const kruskalLines = container.querySelectorAll('.code-line');
      expect(kruskalLines.length).toBe(ALGORITHM_CODE.kruskal.lines.length);
    });
  });

  // =========================================================================
  // 7. DAY 2: COMPLETE EXECUTION FLOW FOR ALL 5 ALGORITHMS
  // =========================================================================
  describe('Day 2: Complete Algorithm Flow & Edge Cases', () => {
    it('executes Kruskal without start node, accepts acyclic and rejects cyclic edges', () => {
      const graph = getPresetGraph('textbook');
      const result = AlgorithmRegistry.run('kruskal', graph);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges.length).toBe(graph.nodeCount - 1);

      // Verify presence of ACCEPT_EDGE and REJECT_EDGE actions in steps
      const actions = result.steps.map(s => s.action);
      expect(actions).toContain('INITIALIZE');
      expect(actions).toContain('ACCEPT_EDGE');
      expect(actions).toContain('FINISH');
    });

    it('executes Euler across all 4 canonical cases', () => {
      // 1. Circuit
      const gCircuit = getPresetGraph('euler_circuit');
      const resCircuit = AlgorithmRegistry.run('euler', gCircuit, { startNodeId: 'A' });
      expect(resCircuit.status).toBe(AlgorithmStatus.SUCCESS);
      expect(resCircuit.type).toBe('circuit');

      // 2. Path
      const gPath = getPresetGraph('euler_path');
      const resPath = AlgorithmRegistry.run('euler', gPath);
      expect(resPath.status).toBe(AlgorithmStatus.SUCCESS);
      expect(resPath.type).toBe('path');

      // 3. None (degree condition violated)
      const gNone = getPresetGraph('euler_none');
      const resNone = AlgorithmRegistry.run('euler', gNone);
      expect(resNone.type).not.toBe('circuit');
      expect(resNone.type).not.toBe('path');

      // 4. Disconnected graph
      const gDisc = getPresetGraph('euler_disconnected');
      const resDisc = AlgorithmRegistry.run('euler', gDisc);
      expect(resDisc.connected).toBe(false);
      expect(resDisc.type).toBe('disconnected');
    });

    it('executes Hamilton with cycle mode vs path mode', () => {
      const graph = getPresetGraph('euler_circuit'); // Complete graph K5 has Hamilton cycles

      // Mode: Chu trình (Cycle)
      const resCycle = AlgorithmRegistry.run('hamilton', graph, {
        startNodeId: 'A',
        wantCycle: true,
      });
      expect(resCycle.subType).toBe('cycle');
      expect(resCycle.steps.length).toBeGreaterThan(0);

      // Mode: Đường đi (Path)
      const resPath = AlgorithmRegistry.run('hamilton', graph, {
        startNodeId: 'A',
        wantCycle: false,
      });
      expect(resPath.subType).toBe('path');
      expect(resPath.steps.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 8. DAY 2: CUSTOM GRAPH INPUT PREVIEW SUMMARY
  // =========================================================================
  describe('Day 2: GraphSourceModal Live Preview Summary', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body><div id="modalWrap"></div></body></html>`);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('generates accurate metadata preview summary before applying', () => {
      const modal = new GraphSourceModal({
        container: document.getElementById('modalWrap'),
      });

      // Edge list input
      modal.textList.value = "A - B: 3\nB - C: 4\nC - D: 2\nD - A: 5";
      const parsed = modal.updatePreview();

      expect(parsed).not.toBeNull();
      expect(parsed.nodes.length).toBe(4);
      expect(parsed.edges.length).toBe(4);

      const summaryText = modal.previewSummary.textContent;
      expect(summaryText).toContain('Đỉnh: 4');
      expect(summaryText).toContain('Cạnh: 4');
      expect(summaryText).toContain('Vô hướng');
      expect(summaryText).toContain('Trọng số: Có');
    });

    it('displays error and suppresses preview on malformed input', () => {
      const modal = new GraphSourceModal({
        container: document.getElementById('modalWrap'),
      });

      modal.textList.value = "invalid edge syntax without separator";
      const parsed = modal.updatePreview();

      expect(parsed).toBeNull();
      expect(modal.previewSummary.style.display).toBe('none');
      expect(modal.errorBox.style.display).toBe('block');
    });
  });

  // =========================================================================
  // 9. DAY 2.5: VIEW CONTENT RENDERING & APP MOUNTING SUITE
  // =========================================================================
  describe('Day 2.5: View Content Rendering & Application Mounting', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <header class="app-header">
            <a href="#home" id="brandLogo">Logo</a>
            <button class="nav-btn active" data-view="home">Home</button>
            <button class="nav-btn" data-view="theory">Theory</button>
            <button class="nav-btn" data-view="lab">Lab</button>
            <button class="nav-btn" data-view="ai">AI</button>
            <button id="btnThemeToggle">Theme</button>
          </header>
          <main id="app" class="app-main">
            <div id="homeView" class="app-view active"></div>
            <div id="theoryView" class="app-view"></div>
            <div id="labView" class="app-view"></div>
            <div id="aiView" class="app-view"></div>
          </main>
        </body>
        </html>
      `, {
        url: 'http://localhost/#home',
      });

      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.localStorage = window.localStorage;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
      delete global.localStorage;
    });

    it('HomeView renders comprehensive Discrete Mathematics platform with 4 pillars and academic suite', () => {
      const container = document.getElementById('homeView');
      const home = new HomeView({ container });

      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('h1').textContent).toContain('Toán Rời Rạc Platform');

      // Check all 4 core pillars in correct order: Logic (Ch 1+2), Counting (Ch 3), Relation (Ch 4), Graph (Ch 5)
      const pillars = container.querySelectorAll('.pillar-card');
      expect(pillars.length).toBe(4);
      expect(container.querySelector('#pillarLogic')).not.toBeNull();
      expect(container.querySelector('#pillarCounting')).not.toBeNull();
      expect(container.querySelector('#pillarRelation')).not.toBeNull();
      expect(container.querySelector('#pillarGraph')).not.toBeNull();

      // Check pillar action buttons
      expect(container.querySelector('#btnPillarLogic')).not.toBeNull();
      expect(container.querySelector('#btnPillarCounting')).not.toBeNull();
      expect(container.querySelector('#btnPillarRelation')).not.toBeNull();
      expect(container.querySelector('#btnPillarGraph')).not.toBeNull();

      // Check academic suite
      expect(container.querySelector('.academic-suite')).not.toBeNull();
      expect(container.querySelector('#btnHomeQuizArena')).not.toBeNull();

      // Check footer and author pills
      const footer = container.querySelector('#homeFooter');
      expect(footer).not.toBeNull();
      expect(footer.textContent).toContain('Đức Huy');
      expect(footer.textContent).toContain('Nhất Vũ');
      expect(footer.textContent).toContain('Trường Vũ');
      expect(footer.textContent).toContain('Ngọc Hưng');
      expect(footer.textContent).toContain('Khóa 66');
      expect(footer.textContent).toContain('© 2026 Toán Rời Rạc Platform');
    });

    it('clicking Studio and Arena buttons on HomeView triggers onNavigate with quiz and specific subtab', () => {
      const container = document.getElementById('homeView');
      const onNavigate = vi.fn();
      new HomeView({ container, onNavigate });

      const btnStudio = container.querySelector('#btnHomeQuizStudio');
      expect(btnStudio).not.toBeNull();
      btnStudio.click();
      expect(onNavigate).toHaveBeenCalledWith('quiz', 'studio');

      const btnArena = container.querySelector('#btnHomeQuizArena');
      expect(btnArena).not.toBeNull();
      btnArena.click();
      expect(onNavigate).toHaveBeenCalledWith('quiz', 'practice');

      const btnTheoryBar = container.querySelector('#btnHomeTheoryBar');
      expect(btnTheoryBar).not.toBeNull();
      btnTheoryBar.click();
      expect(onNavigate).toHaveBeenCalledWith('theory');
    });

    it('TheoryView renders educational content across all chapters with filters, analysis modal, and action buttons', () => {
      const container = document.getElementById('theoryView');
      const onOpenLab = vi.fn();
      const theory = new TheoryView({ container, onOpenLabWithAlgo: onOpenLab });

      expect(container.innerHTML).not.toBe('');
      const cards = container.querySelectorAll('.theory-card');
      expect(cards.length).toBe(19);

      // Verify Chapter 5 filter narrows down to 5 graph topics
      const ch5Btn = container.querySelector('button[data-chapter="ch5"]');
      expect(ch5Btn).not.toBeNull();
      ch5Btn.click();
      expect(container.querySelectorAll('.theory-card').length).toBe(5);

      // Verify clicking an action button invokes callback with algoKey
      const dijkstraBtn = container.querySelector('button[data-algo="dijkstra"]');
      expect(dijkstraBtn).not.toBeNull();
      dijkstraBtn.click();
      expect(onOpenLab).toHaveBeenCalledWith('dijkstra');

      // Verify opening detailed analysis modal for Dijkstra
      const dijkstraDetailBtn = container.querySelector('button[data-action="detail"][data-topic-id="graph_dijkstra"]');
      expect(dijkstraDetailBtn).not.toBeNull();
      dijkstraDetailBtn.click();

      const modal = container.querySelector('#theoryDetailModal');
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('Thuật toán Dijkstra');
      expect(modal.textContent).toContain('Giãn cạnh');
      expect(modal.textContent).toContain('Mã giả');

      // Verify modal launch button triggers action
      const modalLaunchBtn = modal.querySelector('#btnLaunchLabFromModal');
      expect(modalLaunchBtn).not.toBeNull();
      modalLaunchBtn.click();
      expect(onOpenLab).toHaveBeenCalledWith('dijkstra');
    });

    it('LabView mounts and renders full workspace with canvas, code panel, controls, and table', () => {
      const container = document.getElementById('labView');
      const lab = new LabView({ container });

      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('#svgCanvas')).not.toBeNull();
      expect(container.querySelector('#algoSwitch')).not.toBeNull();
      expect(container.querySelector('#presetSelect')).not.toBeNull();
      expect(container.querySelector('.code-panel')).not.toBeNull();
      expect(container.querySelector('.state-table')).not.toBeNull();
      expect(container.querySelector('.playback-bar')).not.toBeNull();
    });

    it('AiAssistantView renders placeholder content with bullet points and CTA', () => {
      const container = document.getElementById('aiView');
      const onNavigate = vi.fn();
      const ai = new AiAssistantView({ container, onNavigate });

      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('.ai-title').textContent).toContain('AI Assistant');
      expect(container.innerHTML).toContain('image/document');

      const btnToLab = container.querySelector('#btnAiToLab');
      expect(btnToLab).not.toBeNull();
      btnToLab.click();
      expect(onNavigate).toHaveBeenCalledWith('lab');
    });

    it('App coordinates view rendering, routing, and theme toggling end-to-end', () => {
      const app = new App();

      // All 4 views should have content mounted
      expect(document.getElementById('homeView').innerHTML.trim()).not.toBe('');
      expect(document.getElementById('theoryView').innerHTML.trim()).not.toBe('');
      expect(document.getElementById('labView').innerHTML.trim()).not.toBe('');
      expect(document.getElementById('aiView').innerHTML.trim()).not.toBe('');

      // Initially home is active
      expect(document.getElementById('homeView').classList.contains('active')).toBe(true);
      expect(document.getElementById('theoryView').classList.contains('active')).toBe(false);

      // Navigate to Theory
      app.navigate('theory');
      expect(document.getElementById('homeView').classList.contains('active')).toBe(false);
      expect(document.getElementById('theoryView').classList.contains('active')).toBe(true);

      // Navigate to Lab
      app.navigate('lab');
      expect(document.getElementById('labView').classList.contains('active')).toBe(true);

      // Theme toggle
      expect(document.body.classList.contains('theme-light')).toBe(false);
      app.toggleTheme();
      expect(document.body.classList.contains('theme-light')).toBe(true);
      app.toggleTheme();
      expect(document.body.classList.contains('theme-light')).toBe(false);
    });

    it('initApp safely boots application regardless of document readyState', () => {
      const appInstance = initApp();
      expect(appInstance).toBeDefined();
      expect(window.__app).toBe(appInstance);
    });

    it('Lab dropdown toggles, navigates to lab views, updates label, and closes properly', () => {
      // Setup DOM with dropdown
      document.body.innerHTML = `
        <header class="app-header">
          <div class="nav-dropdown" id="labDropdown">
            <button type="button" class="nav-btn nav-dropdown-toggle" id="btnLabDropdown">
              <span id="labDropdownText">Phòng Lab</span>
            </button>
            <div class="nav-dropdown-menu" id="labDropdownMenu">
              <button class="dropdown-item" data-view="logic">Logic Lab</button>
              <button class="dropdown-item" data-view="counting">Counting Lab</button>
              <button class="dropdown-item" data-view="relation">Relation Lab</button>
              <button class="dropdown-item" data-view="lab">Graph Lab</button>
            </div>
          </div>
        </header>
        <main id="app">
          <div id="homeView" class="app-view active"></div>
          <div id="logicView" class="app-view"></div>
          <div id="countingView" class="app-view"></div>
          <div id="relationView" class="app-view"></div>
          <div id="labView" class="app-view"></div>
        </main>
      `;

      const app = new App();
      const dropdown = document.getElementById('labDropdown');
      const toggle = document.getElementById('btnLabDropdown');
      const label = document.getElementById('labDropdownText');

      // Click toggle opens dropdown
      toggle.click();
      expect(dropdown.classList.contains('open')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      // Clicking dropdown item navigates and closes dropdown
      const relItem = document.querySelector('.dropdown-item[data-view="relation"]');
      relItem.click();
      expect(dropdown.classList.contains('open')).toBe(false);
      expect(toggle.classList.contains('active')).toBe(true);
      expect(label.textContent).toBe('Phòng Lab: Relation Lab');
      expect(document.getElementById('relationView').classList.contains('active')).toBe(true);

      // Re-open and close with ESC
      toggle.click();
      expect(dropdown.classList.contains('open')).toBe(true);
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(dropdown.classList.contains('open')).toBe(false);

      // Mouseenter on dropdown opens it immediately on hover
      dropdown.dispatchEvent(new window.Event('mouseenter'));
      expect(dropdown.classList.contains('open')).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });
  });

  // =========================================================================
  // 10. DAY 2.75: ALGORITHM LAB UX STABILIZATION, SPLITTER & STATE TABLE SUITE
  // =========================================================================
  describe('Day 2.75: Algorithm Lab UX Stabilization, Splitter & Multi-Mode State Table', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <main id="app">
            <div id="labView"></div>
          </main>
        </body>
        </html>
      `);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('verifies absence of legacy button in modern navbar (index.html)', () => {
      const htmlPath = path.resolve(__dirname, '../../index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const parsedDom = new JSDOM(htmlContent);
      const parsedDoc = parsedDom.window.document;

      const headerActions = parsedDoc.querySelector('.header-actions');
      expect(headerActions).not.toBeNull();
      expect(headerActions.querySelector('#btnThemeToggle')).not.toBeNull();

      // Legacy button/link must not exist
      const legacyLink = parsedDoc.querySelector('a[href*="legacy"]');
      expect(legacyLink).toBeNull();
      expect(headerActions.textContent).not.toContain('Legacy');
      expect(headerActions.textContent).not.toContain('Bản cũ');
    });

    it('renders draggable resizable splitter and updates column widths via keyboard and setSplit', () => {
      const container = document.getElementById('labView');
      const lab = new LabView({ container });

      const splitter = container.querySelector('#labSplitter');
      expect(splitter).not.toBeNull();
      expect(splitter.getAttribute('role')).toBe('separator');
      expect(splitter.getAttribute('tabindex')).toBe('0');

      const graphCol = container.querySelector('#graphColumn');
      const stepCol = container.querySelector('#stepColumn');

      // Initial default split is 42% / 58%
      expect(graphCol.style.width).toBe('42%');
      expect(stepCol.style.width).toBe('58%');

      // Keyboard left: -2%
      splitter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(graphCol.style.width).toBe('40%');
      expect(stepCol.style.width).toBe('60%');

      // Keyboard right: +2%
      splitter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(graphCol.style.width).toBe('42%');
      expect(stepCol.style.width).toBe('58%');

      // Keyboard Home: clamp to min (30%)
      splitter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home' }));
      expect(graphCol.style.width).toBe('30%');
      expect(stepCol.style.width).toBe('70%');

      // Keyboard End: clamp to max (68%)
      splitter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End' }));
      expect(graphCol.style.width).toBe('68%');
      expect(stepCol.style.width).toBe('32%');

      // Keyboard Enter: reset to 42%
      splitter.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
      expect(graphCol.style.width).toBe('42%');
      expect(stepCol.style.width).toBe('58%');

      // Direct clamping
      lab._setSplit(15);
      expect(graphCol.style.width).toBe('30%');
      lab._setSplit(85);
      expect(graphCol.style.width).toBe('68%');
    });

    it('StateTable supports 3 view modes: current, progressive, and full', () => {
      const container = document.createElement('div');
      const table = new StateTable({ container });

      // Mode switch buttons exist
      const btnCurrent = container.querySelector('.table-mode-btn[data-mode="current"]');
      const btnProgressive = container.querySelector('.table-mode-btn[data-mode="progressive"]');
      const btnFull = container.querySelector('.table-mode-btn[data-mode="full"]');
      expect(btnCurrent).not.toBeNull();
      expect(btnProgressive).not.toBeNull();
      expect(btnFull).not.toBeNull();
      expect(table.mode).toBe('progressive');

      // Run Dijkstra on textbook preset to obtain steps
      const graph = getPresetGraph('textbook');
      const result = AlgorithmRegistry.run('dijkstra', graph, { startNodeId: 'u' });
      expect(result.steps.length).toBeGreaterThanOrEqual(5);

      // Supply rich step data at step index 2
      table.update({
        steps: result.steps,
        currentIndex: 2,
        graph,
        context: { algorithmKey: 'dijkstra' },
      });

      // Mode B (Progressive): 3 rows (indices 0, 1, 2)
      let rows = container.querySelectorAll('#tableBody tr');
      expect(rows.length).toBe(3);
      expect(rows[2].classList.contains('active-row')).toBe(true);
      expect(rows[0].classList.contains('active-row')).toBe(false);

      // Switch to Mode A (Current): only 1 row (index 2)
      btnCurrent.click();
      expect(table.mode).toBe('current');
      rows = container.querySelectorAll('#tableBody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].classList.contains('active-row')).toBe(true);
      expect(rows[0].getAttribute('data-step-index')).toBe('2');

      // Switch to Mode C (Full): all steps
      btnFull.click();
      expect(table.mode).toBe('full');
      rows = container.querySelectorAll('#tableBody tr');
      expect(rows.length).toBe(result.steps.length);
      expect(rows[2].classList.contains('active-row')).toBe(true);
    });

    it('StateTable filters redundant intermediate rows for Prim and marks min candidate as settled in red', () => {
      const container = document.createElement('div');
      const table = new StateTable({ container });

      const graph = getPresetGraph('prim_slide');
      const result = AlgorithmRegistry.run('prim', graph, { startNodeId: 'x1' });
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);

      table.update({
        steps: result.steps,
        currentIndex: result.steps.length - 1,
        graph,
        context: { algorithmKey: 'prim' },
      });

      // Filtered rows in progressive mode: clean count without redundant ACCEPT_EDGE rows
      const rows = container.querySelectorAll('#tableBody tr');
      expect(rows.length).toBeLessThan(result.steps.length);

      // Verify that RELAX_EDGE step formatTable has a cell with type 'settled' and '*'
      const relaxStep = result.steps.find(s => s.action === AlgorithmAction.RELAX_EDGE);
      expect(relaxStep).toBeDefined();
      const pres = StepFormatter.formatStep(relaxStep, graph, { algorithmKey: 'prim' });
      const settledCell = pres.table.rows[0].cells.find(c => c.type === 'settled');
      expect(settledCell).toBeDefined();
      expect(settledCell.val).toMatch(/\*$/);
    });

    it('StateTable row click triggers onStepSelect and jumps playback step', () => {
      const onStepSelect = vi.fn();
      const container = document.createElement('div');
      const table = new StateTable({ container, onStepSelect });

      const graph = getPresetGraph('building');
      const result = AlgorithmRegistry.run('dijkstra', graph, { startNodeId: 'sanh_chinh', endNodeId: 'phong_103' });

      table.update({
        steps: result.steps,
        currentIndex: 0,
        graph,
        context: { algorithmKey: 'dijkstra' },
      });

      // Switch to full mode to have all rows clickable
      table.setMode('full');
      const row3 = container.querySelector('#tableBody tr[data-step-index="3"]');
      expect(row3).not.toBeNull();

      row3.click();
      expect(onStepSelect).toHaveBeenCalledWith(3);
    });

    it('StateTable expands fullscreen and collapses on Escape key or button click', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const table = new StateTable({ container });

      const btnExpand = container.querySelector('#btnExpandTable');
      expect(btnExpand).not.toBeNull();
      expect(container.classList.contains('table-expanded')).toBe(false);

      // Click to expand
      btnExpand.click();
      expect(container.classList.contains('table-expanded')).toBe(true);
      expect(btnExpand.textContent).toContain('Thu nhỏ');

      // Escape key to close
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(container.classList.contains('table-expanded')).toBe(false);
      expect(btnExpand.textContent).toContain('Mở rộng');

      document.body.removeChild(container);
    });

    it('PlaybackControls scrubber slider enables on run and allows jumping to step', () => {
      const container = document.createElement('div');
      const playbackUI = new PlaybackControls({ container });

      const slider = container.querySelector('#stepSlider');
      expect(slider).not.toBeNull();
      expect(slider.disabled).toBe(true);

      // Create controller with 10 dummy steps
      const steps = Array.from({ length: 10 }, (_, i) => ({ stepNumber: i + 1, action: 'STEP' }));
      const controller = new PlaybackController({ steps });
      playbackUI.setController(controller);

      expect(slider.disabled).toBe(false);
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('9');
      expect(slider.value).toBe('0');

      // Scrub slider to index 6
      slider.value = '6';
      slider.dispatchEvent(new window.Event('input'));

      expect(controller.currentIndex).toBe(6);
      expect(container.querySelector('#stepCounterText').textContent).toBe('7 / 10');
      expect(slider.value).toBe('6');
    });

    it('LabView invalidates and cleanly resets state when graph configuration changes', () => {
      const container = document.getElementById('labView');
      const lab = new LabView({ container });

      // Run algorithm via PlaybackControls run button (btnPlay)
      const btnPlay = container.querySelector('#btnPlay');
      btnPlay.click();

      expect(lab.playbackController).not.toBeNull();
      expect(container.querySelector('#graphStatusTag').textContent).toContain('Đã tạo');

      // Change startNodeSelect
      const startSelect = container.querySelector('#startNodeSelect');
      const options = startSelect.querySelectorAll('option');
      if (options.length > 1) {
        startSelect.value = options[1].value;
      }
      startSelect.dispatchEvent(new window.Event('change'));

      // Verified: playback is reset, button returns to ready state
      expect(lab.playbackController).toBeNull();
      expect(btnPlay.textContent).toBe('▶ Chạy');
      expect(container.querySelector('#graphStatusTag').textContent).toBe('Sẵn sàng');
      expect(container.querySelector('#stepCounterText').textContent).toBe('0 / 0');
    });
  });

  // =========================================================================
  // 11. PHASE 4 CODE PANEL FIX: REAL EXECUTABLE SOURCE CODE & MULTI-LANGUAGE
  // =========================================================================
  describe('Phase 4 Code Panel: Real Executable Source Code, Languages & Copy/Download', () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
          <div id="codePanelContainer"></div>
        </body>
        </html>
      `);
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('CodePanel displays "SOURCE CODE" and includes language selector with C++, Python, C, Java', () => {
      const container = document.getElementById('codePanelContainer');
      const panel = new CodePanel({ container, algorithmKey: 'dijkstra' });

      // Title must be SOURCE CODE, not pseudocode
      expect(container.querySelector('.code-panel-title').textContent).toBe('SOURCE CODE');
      expect(container.textContent).not.toContain('MÃ GIẢ');

      const select = container.querySelector('#codeLangSelect');
      expect(select).not.toBeNull();
      const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
      expect(options).toEqual(['cpp', 'python', 'c', 'java']);
    });

    it('switching language dynamically re-renders authentic source code and filename', () => {
      const container = document.getElementById('codePanelContainer');
      const panel = new CodePanel({ container, algorithmKey: 'dijkstra', languageKey: 'cpp' });

      expect(panel.getCurrentFilename()).toBe('dijkstra.cpp');
      expect(panel.getCurrentSource()).toContain('#include <iostream>');
      expect(panel.getCurrentSource()).toContain('#include <queue>');

      // Switch to Python
      panel.setLanguage('python');
      expect(panel.getCurrentFilename()).toBe('dijkstra.py');
      expect(panel.getCurrentSource()).toContain('import heapq');
      expect(panel.getCurrentSource()).toContain('def dijkstra(');

      // Switch to Java
      panel.setLanguage('java');
      expect(panel.getCurrentFilename()).toBe('Dijkstra.java');
      expect(panel.getCurrentSource()).toContain('public class Dijkstra');

      // Switch to C
      panel.setLanguage('c');
      expect(panel.getCurrentFilename()).toBe('dijkstra.c');
      expect(panel.getCurrentSource()).toContain('#include <stdio.h>');
      expect(panel.getCurrentSource()).toContain('DijkstraResult dijkstra(');
    });

    it('copyCode extracts raw source code without line numbers, labels, or HTML spans', async () => {
      const container = document.getElementById('codePanelContainer');
      const panel = new CodePanel({ container, algorithmKey: 'kruskal', languageKey: 'python' });

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      window.navigator.clipboard = { writeText: writeTextMock };

      await panel.copyCode();

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedText = writeTextMock.mock.calls[0][0];

      // Verifications on copied text
      expect(copiedText).toBe(panel.getCurrentSource());
      expect(copiedText).not.toContain('<span');
      expect(copiedText).not.toContain('data-line=');
      expect(copiedText).not.toContain('code-line-num');
      expect(copiedText).toContain('class DisjointSet:');
      expect(copiedText).toContain('def kruskal(');
    });

    it('downloadCode triggers download of file with correct name and extension', () => {
      const container = document.getElementById('codePanelContainer');
      const panel = new CodePanel({ container, algorithmKey: 'prim', languageKey: 'cpp' });

      const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/dummy');
      const revokeObjectUrlMock = vi.fn();
      global.URL.createObjectURL = createObjectUrlMock;
      global.URL.revokeObjectURL = revokeObjectUrlMock;

      panel.downloadCode();

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    });

    it('synchronizes graph nodes and edges into executable main() section', () => {
      const container = document.getElementById('codePanelContainer');
      const panel = new CodePanel({ container, algorithmKey: 'dijkstra', languageKey: 'python' });

      const graph = getPresetGraph('textbook');
      panel.setGraph(graph, { startNodeId: '1', endNodeId: '5' });

      const source = panel.getCurrentSource();
      expect(source).toContain('"1"');
      expect(source).toContain('"5"');
      expect(source).toContain('source_node = "1"');
      expect(source).toContain('target_node = "5"');
    });
  });

  // =========================================================================
  // 12. SECTION 12: 2-TIER WORKSPACE, DUAL SPLITTERS, COMPACT STEP STRIP & JUMP
  // =========================================================================
  describe('Section 12: Re-architected 2-Tier Layout & Workspace Controls', () => {
    let dom;
    let window;
    let document;
    let container;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost/' });
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.localStorage = window.localStorage;

      container = document.createElement('div');
      container.id = 'labView';
      document.body.appendChild(container);
    });

    afterEach(() => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      delete global.window;
      delete global.document;
      delete global.localStorage;
    });

    it('renders Horizontal Splitter 2 (#labSplitterH) and resizes top vs bottom workspaces', () => {
      const lab = new LabView({ container });

      const splitterH = container.querySelector('#labSplitterH');
      expect(splitterH).not.toBeNull();
      expect(splitterH.getAttribute('role')).toBe('separator');
      expect(splitterH.getAttribute('tabindex')).toBe('0');
      expect(splitterH.getAttribute('aria-orientation')).toBe('horizontal');

      const topWorkspace = container.querySelector('#labUpperRow');
      const tableContainer = container.querySelector('#stateTableContainer');

      // Default split is 62% top / 38% bottom
      expect(topWorkspace.style.height).toBe('62%');
      expect(tableContainer.style.height).toBe('38%');

      // Keyboard ArrowUp: -2%
      splitterH.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(topWorkspace.style.height).toBe('60%');
      expect(tableContainer.style.height).toBe('40%');

      // Keyboard ArrowDown: +2%
      splitterH.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(topWorkspace.style.height).toBe('62%');
      expect(tableContainer.style.height).toBe('38%');

      // Keyboard Home: clamp to min (40%)
      splitterH.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home' }));
      expect(topWorkspace.style.height).toBe('40%');
      expect(tableContainer.style.height).toBe('60%');

      // Keyboard End: clamp to max (75%)
      splitterH.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End' }));
      expect(topWorkspace.style.height).toBe('75%');
      expect(tableContainer.style.height).toBe('25%');

      // Keyboard Enter: reset to 62%
      splitterH.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
      expect(topWorkspace.style.height).toBe('62%');
      expect(tableContainer.style.height).toBe('38%');

      // Clamping bounds
      lab._setSplitH(20);
      expect(topWorkspace.style.height).toBe('40%');
      lab._setSplitH(90);
      expect(topWorkspace.style.height).toBe('78%');
    });

    it('compact step details is positioned under graph header and hidden before execution', () => {
      const lab = new LabView({ container });

      const graphCol = container.querySelector('#graphColumn');
      const stepDetailsContainer = graphCol.querySelector('#stepDetailsContainer');
      expect(stepDetailsContainer).not.toBeNull();

      // Before execution, strip is hidden (no oversized idle cards)
      const strip = stepDetailsContainer.querySelector('#stepCompactStrip');
      expect(strip.style.display).toBe('none');

      // After running algorithm via btnPlay, strip becomes visible with step details
      const btnPlay = container.querySelector('#btnPlay');
      btnPlay.click();

      expect(strip.style.display).toBe('flex');
      expect(stepDetailsContainer.querySelector('#stepTitle').textContent).toContain('Bước 1');
      expect(stepDetailsContainer.querySelector('#stepPhaseBadge').textContent).toBe('Khởi tạo');
    });

    it('PlaybackControls direct step jump input navigates to target step on enter', () => {
      const lab = new LabView({ container });

      const btnPlay = container.querySelector('#btnPlay');
      btnPlay.click();

      const stepJumpInput = container.querySelector('#stepJumpInput');
      expect(stepJumpInput).not.toBeNull();
      expect(stepJumpInput.disabled).toBe(false);

      // Jump to step 4 (index 3)
      stepJumpInput.value = '4';
      stepJumpInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));

      expect(lab.playbackController.currentIndex).toBe(3);
      expect(container.querySelector('#stepCounterText').textContent).toContain('4 /');
    });

    it('simultaneously mounts Graph, Code, Playback, and StateTable in 2-tier layout', () => {
      const lab = new LabView({ container });

      // 1. Top workspace components
      expect(container.querySelector('.lab-top-workspace')).not.toBeNull();
      expect(container.querySelector('#graphColumn')).not.toBeNull();
      expect(container.querySelector('#svgCanvas')).not.toBeNull();
      expect(container.querySelector('#stepColumn')).not.toBeNull();
      expect(container.querySelector('#codePanelContainer')).not.toBeNull();
      expect(container.querySelector('#codeLangSelect')).not.toBeNull();
      expect(container.querySelector('#playbackControlsContainer')).not.toBeNull();

      // 2. Both Splitters
      expect(container.querySelector('#labSplitter')).not.toBeNull();
      expect(container.querySelector('#labSplitterH')).not.toBeNull();

      // 3. Bottom workspace
      expect(container.querySelector('#stateTableContainer')).not.toBeNull();
      expect(container.querySelector('#stateTable')).not.toBeNull();
    });
  });

  // =========================================================================
  // 13. FINAL UI: FIXED-SLOT TOOLBAR, SYNTAX TOKENIZER & 4 FOCUS MODES
  // =========================================================================
  describe('Final UI: Fixed-Slot Toolbar, Syntax Tokenizer & 4 Focus Modes', () => {
    let dom;
    let document;
    let window;
    let container;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body><div id="testApp"></div></body></html>`, {
        url: 'http://localhost/',
        pretendToBeVisual: true,
      });
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.HTMLElement = window.HTMLElement;
      global.Element = window.Element;
      global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

      container = document.getElementById('testApp');
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
      delete global.HTMLElement;
      delete global.Element;
      delete global.requestAnimationFrame;
    });

    describe('Fixed-Slot Toolbar Stability', () => {
      it('mounts all fixed toolbar slots and keeps Run button in slot-action across all 5 algorithms', () => {
        const lab = new LabView({ container });

        const toolbar = container.querySelector('.lab-toolbar');
        expect(toolbar).not.toBeNull();
        expect(container.querySelector('.toolbar-left-cluster')).not.toBeNull();
        expect(container.querySelector('.toolbar-right-cluster')).not.toBeNull();

        const slotPreset = container.querySelector('.slot-preset');
        const slotAlgo = container.querySelector('.slot-algo');
        const slotStart = container.querySelector('.slot-start-node');
        const slotSecond = container.querySelector('.slot-second-param');
        const slotFs = container.querySelector('.slot-fullscreen');

        expect(slotPreset).not.toBeNull();
        expect(slotAlgo).not.toBeNull();
        expect(slotStart).not.toBeNull();
        expect(slotSecond).not.toBeNull();
        expect(slotFs).not.toBeNull();

        const btnFs = container.querySelector('#btnLabFullscreen');
        expect(slotFs.contains(btnFs)).toBe(true);
        const btnPlay = container.querySelector('#btnPlay');
        expect(btnPlay).not.toBeNull();

        const startWrap = container.querySelector('#startNodeWrap');
        const endWrap = container.querySelector('#endNodeWrap');
        const hamWrap = container.querySelector('#hamModeWrap');

        // 1. Dijkstra: startWrap visible, endWrap visible, hamWrap hidden
        lab.setAlgorithm('dijkstra');
        expect(startWrap.style.visibility).toBe('visible');
        expect(endWrap.style.display).toBe('flex');
        expect(endWrap.style.visibility).toBe('visible');
        expect(hamWrap.style.display).toBe('none');
        expect(slotFs.contains(btnFs)).toBe(true);

        // 2. Kruskal: startWrap hidden (occupies space), endWrap hidden, hamWrap hidden
        lab.setAlgorithm('kruskal');
        expect(startWrap.style.visibility).toBe('hidden');
        expect(endWrap.style.display).toBe('none');
        expect(hamWrap.style.display).toBe('none');
        expect(slotFs.contains(btnFs)).toBe(true);

        // 3. Prim: startWrap visible, endWrap hidden, hamWrap hidden
        lab.setAlgorithm('prim');
        expect(startWrap.style.visibility).toBe('visible');
        expect(endWrap.style.display).toBe('none');
        expect(hamWrap.style.display).toBe('none');
        expect(slotFs.contains(btnFs)).toBe(true);

        // 4. Euler: startWrap visible, endWrap hidden, hamWrap hidden
        lab.setAlgorithm('euler');
        expect(startWrap.style.visibility).toBe('visible');
        expect(endWrap.style.display).toBe('none');
        expect(hamWrap.style.display).toBe('none');
        expect(slotFs.contains(btnFs)).toBe(true);

        // 5. Hamilton: startWrap visible, endWrap hidden, hamWrap flex & visible
        lab.setAlgorithm('hamilton');
        expect(startWrap.style.visibility).toBe('visible');
        expect(endWrap.style.display).toBe('none');
        expect(hamWrap.style.display).toBe('flex');
        expect(hamWrap.style.visibility).toBe('visible');
        expect(slotFs.contains(btnFs)).toBe(true);
      });
    });

    describe('Syntax Tokenizer & Code Markup Integrity', () => {
      it('never produces leaked class="tok-..." text inside rendered code lines', () => {
        const testLines = [
          'class DijkstraResult:',
          '    def __init__(self):',
          '        self.distances = {}',
          'for v, weight in graph[u]:',
          '    if distance < min_dist:',
          '        return result',
          '# This is a comment about class and string',
          'vector<int> dist(n, 1000000);',
        ];

        for (const line of testLines) {
          const highlightedPy = highlightSyntax(line, 'python');
          const highlightedCpp = highlightSyntax(line, 'cpp');

          const divPy = document.createElement('div');
          divPy.innerHTML = highlightedPy;
          expect(divPy.textContent).not.toContain('class="tok-');
          expect(divPy.textContent).not.toContain('tok-kw');
          expect(divPy.textContent).not.toContain('tok-str');

          const divCpp = document.createElement('div');
          divCpp.innerHTML = highlightedCpp;
          expect(divCpp.textContent).not.toContain('class="tok-');
          expect(divCpp.textContent).not.toContain('tok-kw');
          expect(divCpp.textContent).not.toContain('tok-str');
        }
      });

      it('renders line numbers with data-line attributes and proper syntax tags', () => {
        new CodePanel({
          container,
          algorithmKey: 'dijkstra',
          languageKey: 'python',
        });

        const lines = container.querySelectorAll('.code-line');
        expect(lines.length).toBeGreaterThan(10);

        const firstLine = lines[0];
        expect(firstLine.getAttribute('data-line')).toBe('1');
        expect(firstLine.querySelector('.code-line-num').textContent).toBe('1');
        expect(firstLine.querySelector('.code-line-content')).not.toBeNull();

        // Check text content has no tag leakage
        expect(firstLine.textContent).not.toContain('class="tok-');
      });
    });

    describe('4 Focus Modes Activation & Toggle', () => {
      it('toggles Full Lab Focus Mode (focus-lab)', () => {
        const lab = new LabView({ container });
        const labLayout = container.querySelector('.lab-layout');
        const btnLabFs = container.querySelector('#btnLabFullscreen');

        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-lab')).toBe(false);
        expect(btnLabFs.textContent).toContain('Toàn màn hình');

        // Enter Lab Fullscreen
        btnLabFs.click();
        expect(lab.focusMode).toBe('lab');
        expect(labLayout.classList.contains('focus-lab')).toBe(true);
        expect(btnLabFs.textContent).toContain('Thu nhỏ');
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(true);

        // Exit Lab Fullscreen
        btnLabFs.click();
        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-lab')).toBe(false);
        expect(btnLabFs.textContent).toContain('Toàn màn hình');
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(false);
      });

      it('toggles Graph Fullscreen Focus Mode (focus-graph)', () => {
        const lab = new LabView({ container });
        const labLayout = container.querySelector('.lab-layout');
        const btnGraphFs = container.querySelector('#btnGraphFullscreen');

        expect(btnGraphFs).not.toBeNull();

        // Enter Graph Focus
        btnGraphFs.click();
        expect(lab.focusMode).toBe('graph');
        expect(labLayout.classList.contains('focus-graph')).toBe(true);
        expect(btnGraphFs.textContent).toBe('✕');

        // Exit Graph Focus
        btnGraphFs.click();
        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-graph')).toBe(false);
        expect(btnGraphFs.textContent).toBe('⛶');
      });

      it('toggles Code Fullscreen Focus Mode (focus-code)', () => {
        const lab = new LabView({ container });
        const labLayout = container.querySelector('.lab-layout');
        const btnCodeFs = container.querySelector('#btnCodeFullscreen');

        expect(btnCodeFs).not.toBeNull();

        // Enter Code Focus
        btnCodeFs.click();
        expect(lab.focusMode).toBe('code');
        expect(labLayout.classList.contains('focus-code')).toBe(true);
        expect(btnCodeFs.textContent).toBe('✕');

        // Exit Code Focus
        btnCodeFs.click();
        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-code')).toBe(false);
        expect(btnCodeFs.textContent).toBe('⛶');
      });

      it('toggles Table Fullscreen Focus Mode (focus-table)', () => {
        const lab = new LabView({ container });
        const labLayout = container.querySelector('.lab-layout');
        const btnTableFs = container.querySelector('#btnExpandTable');

        expect(btnTableFs).not.toBeNull();

        // Enter Table Focus
        btnTableFs.click();
        expect(lab.focusMode).toBe('table');
        expect(labLayout.classList.contains('focus-table')).toBe(true);
        expect(lab.stateTable.isExpanded).toBe(true);
        expect(btnTableFs.textContent).toContain('Thu nhỏ');

        // Exit Table Focus
        btnTableFs.click();
        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-table')).toBe(false);
        expect(lab.stateTable.isExpanded).toBe(false);
        expect(btnTableFs.textContent).toContain('Mở rộng');
      });

      it('exits any active focus mode on Escape key press', () => {
        const lab = new LabView({ container });
        const labLayout = container.querySelector('.lab-layout');

        // Activate Graph Focus
        lab.setFocusMode('graph');
        expect(lab.focusMode).toBe('graph');
        expect(labLayout.classList.contains('focus-graph')).toBe(true);

        // Press Escape
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(lab.focusMode).toBeNull();
        expect(labLayout.classList.contains('focus-graph')).toBe(false);

        // Activate Code Focus
        lab.setFocusMode('code');
        expect(lab.focusMode).toBe('code');
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(lab.focusMode).toBeNull();
      });

      it('preserves algorithm state and split percentages when cycling focus modes', () => {
        const lab = new LabView({ container });

        // Set custom splits
        lab._setSplit(55);
        lab._setSplitH(68);

        // Run algorithm via btnPlay
        const btnPlay = container.querySelector('#btnPlay');
        btnPlay.click();

        expect(lab.playbackController).not.toBeNull();
        const initialSteps = lab.algorithmResult.steps.length;
        expect(initialSteps).toBeGreaterThan(0);

        // Step forward
        lab.playbackController.next();
        expect(lab.playbackController.currentIndex).toBe(1);

        // Enter and exit Lab focus
        lab.setFocusMode('lab');
        expect(lab.playbackController.currentIndex).toBe(1);
        expect(lab.algorithmResult.steps.length).toBe(initialSteps);
        lab.setFocusMode(null);

        // Enter and exit Graph focus
        lab.setFocusMode('graph');
        expect(lab.playbackController.currentIndex).toBe(1);
        lab.setFocusMode(null);

        // Enter and exit Code focus
        lab.setFocusMode('code');
        expect(lab.playbackController.currentIndex).toBe(1);
        lab.setFocusMode(null);

        // Enter and exit Table focus
        lab.setFocusMode('table');
        expect(lab.playbackController.currentIndex).toBe(1);
        lab.setFocusMode(null);

        // Verify split percentages and step state are completely preserved
        expect(lab.currentSplitPct).toBe(55);
        expect(lab.currentSplitYPct).toBe(68);
        expect(lab.playbackController.currentIndex).toBe(1);
      });
    });

    describe('Anti-Glare Light Theme Palette', () => {
      it('uses non-glaring background and panel colors in main.css for light theme', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        // Verify body.theme-light does not use pure white for --bg or --panel
        expect(cssContent).toMatch(/body\.theme-light\s*\{[^}]*--bg:\s*#e8edf4/);
        expect(cssContent).toMatch(/body\.theme-light\s*\{[^}]*--panel:\s*#f4f7fb/);
        expect(cssContent).toMatch(/body\.theme-light\s*\{[^}]*--card-bg:\s*#f4f7fb/);
        expect(cssContent).toMatch(/body\.theme-light \.graph-pane[^}]*background:\s*#eaeff5/);
        expect(cssContent).toMatch(/body\.theme-light \.code-panel\s*\{[^}]*background:\s*#eff3f8/);
      });
    });
  });

  // =========================================================================
  // 14. PHASE 5: GRAPH INPUT PIPELINE IN ALGORITHM LAB
  // (IMAGE / FILE -> AI ANALYSIS -> GRAPH PREVIEW -> CONFIRM -> REAL GRAPH)
  // =========================================================================
  describe('14. Phase 5: Graph Input Pipeline in Algorithm Lab', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost/' });
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.Event = window.Event;
      global.MouseEvent = window.MouseEvent;
      global.localStorage = window.localStorage;
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
      delete global.Event;
      delete global.MouseEvent;
      delete global.localStorage;
    });

    describe('File Format & Size Validation', () => {
      it('accepts all supported file formats under 15MB', () => {
        const supported = ['graph.png', 'photo.jpg', 'scan.jpeg', 'chart.webp', 'paper.pdf', 'exercise.docx'];
        supported.forEach(name => {
          const file = { name, size: 2 * 1024 * 1024 };
          const res = validateFileSupport(file);
          expect(res.valid).toBe(true);
        });
      });

      it('rejects unsupported file formats', () => {
        const unsupported = ['graph.exe', 'data.txt', 'archive.zip', 'video.mp4', 'table.csv'];
        unsupported.forEach(name => {
          const file = { name, size: 1024 };
          const res = validateFileSupport(file);
          expect(res.valid).toBe(false);
          expect(res.error).toMatch(/không được hỗ trợ/);
        });
      });

      it('rejects files exceeding 15MB limit', () => {
        const oversized = { name: 'huge_diagram.png', size: 16 * 1024 * 1024 };
        const res = validateFileSupport(oversized);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/quá lớn/);
      });

      it('rejects null or undefined file', () => {
        expect(validateFileSupport(null).valid).toBe(false);
        expect(validateFileSupport(undefined).valid).toBe(false);
      });
    });

    describe('GraphSpecification Schema & Semantic Validation', () => {
      it('validates a compliant GraphSpecification', () => {
        const spec = {
          directed: false,
          weighted: true,
          nodes: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }],
          edges: [
            { from: 'A', to: 'B', weight: 4 },
            { from: 'B', to: 'C', weight: 3 },
          ],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
        expect(res.normalizedSpec.nodes).toHaveLength(3);
        expect(res.normalizedSpec.edges).toHaveLength(2);
      });

      it('rejects spec without nodes or empty nodes array', () => {
        expect(validateGraphSpecification({}).valid).toBe(false);
        expect(validateGraphSpecification({ nodes: [] }).valid).toBe(false);
      });

      it('rejects duplicate node IDs', () => {
        const spec = {
          nodes: [{ id: 'A' }, { id: 'A' }],
          edges: [],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('trùng lặp'))).toBe(true);
      });

      it('rejects edges referencing non-existent nodes', () => {
        const spec = {
          nodes: [{ id: 'A' }, { id: 'B' }],
          edges: [{ from: 'A', to: 'Z', weight: 1 }],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('không tồn tại'))).toBe(true);
      });

      it('rejects edges with invalid non-numeric weights', () => {
        const spec = {
          nodes: [{ id: 'A' }, { id: 'B' }],
          edges: [{ from: 'A', to: 'B', weight: 'invalid_weight' }],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('không phải là số hợp lệ'))).toBe(true);
      });

      it('detects self-loops and produces semantic warning', () => {
        const spec = {
          nodes: [{ id: 'A' }],
          edges: [{ from: 'A', to: 'A', weight: 1 }],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(true);
        expect(res.warnings.some(w => w.includes('khuyên'))).toBe(true);
      });

      it('detects multi-edges and produces semantic warning', () => {
        const spec = {
          directed: false,
          nodes: [{ id: 'A' }, { id: 'B' }],
          edges: [
            { from: 'A', to: 'B', weight: 2 },
            { from: 'B', to: 'A', weight: 5 },
          ],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(true);
        expect(res.warnings.some(w => w.includes('cạnh lặp/song song'))).toBe(true);
      });

      it('detects negative weights and produces warning for shortest path algorithms', () => {
        const spec = {
          nodes: [{ id: 'A' }, { id: 'B' }],
          edges: [{ from: 'A', to: 'B', weight: -3 }],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(true);
        expect(res.warnings.some(w => w.includes('trọng số âm'))).toBe(true);
      });

      it('detects isolated nodes and produces warning', () => {
        const spec = {
          nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
          edges: [{ from: 'A', to: 'B', weight: 1 }],
        };
        const res = validateGraphSpecification(spec);
        expect(res.valid).toBe(true);
        expect(res.warnings.some(w => w.includes('cô lập'))).toBe(true);
      });
    });

    describe('Core Graph Model & Bidirectional Conversions', () => {
      const sampleSpec = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'X', name: 'X' }, { id: 'Y', name: 'Y' }, { id: 'Z', name: 'Z' }],
        edges: [
          { from: 'X', to: 'Y', weight: 5 },
          { from: 'Y', to: 'Z', weight: 7 },
        ],
      };

      it('creates valid Core Graph instance from GraphSpecification', () => {
        const graph = createGraphFromSpecification(sampleSpec);
        expect(graph).toBeDefined();
        expect(graph.nodeCount).toBe(3);
        expect(graph.edgeCount).toBe(2);
        expect(graph.isDirected).toBe(false);
      });

      it('converts Core Graph back to GraphSpecification', () => {
        const graph = createGraphFromSpecification(sampleSpec);
        const spec = graphToSpecification(graph);
        expect(spec.nodes).toHaveLength(3);
        expect(spec.edges).toHaveLength(2);
        expect(spec.directed).toBe(false);
      });

      it('converts Core Graph to Edge List format', () => {
        const graph = createGraphFromSpecification(sampleSpec);
        const edgeListText = graphToEdgeList(graph);
        expect(edgeListText).toContain('X - Y: 5');
        expect(edgeListText).toContain('Y - Z: 7');
      });

      it('converts Core Graph to Adjacency Matrix format', () => {
        const graph = createGraphFromSpecification(sampleSpec);
        const matrixText = graphToAdjacencyMatrix(graph);
        const lines = matrixText.split('\n');
        expect(lines[0]).toBe('X Y Z');
        expect(lines).toHaveLength(4);
      });
    });

    describe('AI Vision Analysis Execution Contract', () => {
      beforeEach(() => {
        setAnalyzerProvider(null);
      });

      afterEach(() => {
        setAnalyzerProvider(null);
      });

      it('rejects unsupported file before analyzing', async () => {
        const badFile = { name: 'notes.txt', size: 100 };
        await expect(analyzeGraphFile(badFile)).rejects.toThrow(/không được hỗ trợ/);
      });

      it('returns clear unconfigured error message when no provider or mock is present', async () => {
        const validFile = { name: 'diagram.png', size: 2048, type: 'image/png' };
        await expect(analyzeGraphFile(validFile)).rejects.toThrow(/chưa được cấu hình/);
      });

      it('resolves normalized specification when given mockSpec', async () => {
        const validFile = { name: 'diagram.png', size: 2048, type: 'image/png' };
        const mockSpec = {
          nodes: [{ id: '1' }, { id: '2' }],
          edges: [{ from: '1', to: '2', weight: 10 }],
        };
        const res = await analyzeGraphFile(validFile, { mockSpec });
        expect(res.nodes).toHaveLength(2);
        expect(res.edges).toHaveLength(1);
      });

      it('delegates to registered analyzer provider and validates result', async () => {
        const validFile = { name: 'diagram.png', size: 2048, type: 'image/png' };
        const provider = vi.fn().mockResolvedValue({
          directed: true,
          nodes: [{ id: 'S' }, { id: 'T' }],
          edges: [{ from: 'S', to: 'T', weight: 1 }],
        });

        setAnalyzerProvider(provider);
        expect(getAnalyzerProvider()).toBe(provider);

        const res = await analyzeGraphFile(validFile);
        expect(provider).toHaveBeenCalledWith(validFile, {});
        expect(res.directed).toBe(true);
        expect(res.nodes).toHaveLength(2);
      });
    });

    describe('GraphSourceModal Component Integration', () => {
      let modalContainer;
      let modal;
      let onCreatedSpy;

      beforeEach(() => {
        modalContainer = document.createElement('div');
        document.body.appendChild(modalContainer);
        onCreatedSpy = vi.fn();
        modal = new GraphSourceModal({
          container: modalContainer,
          onGraphCreated: onCreatedSpy,
        });
      });

      afterEach(() => {
        modalContainer.remove();
      });

      it('renders 3 tabs (list, matrix, file) and switches between them', () => {
        expect(modal.tabBtnList).not.toBeNull();
        expect(modal.tabBtnMatrix).not.toBeNull();
        expect(modal.tabBtnFile).not.toBeNull();

        // Switch to matrix
        modal.tabBtnMatrix.click();
        expect(modal.mode).toBe('matrix');
        expect(modal.matrixWrap.style.display).toBe('block');
        expect(modal.listWrap.style.display).toBe('none');

        // Switch to file
        modal.tabBtnFile.click();
        expect(modal.mode).toBe('file');
        expect(modal.fileWrap.style.display).toBe('block');
        expect(modal.matrixWrap.style.display).toBe('none');
      });

      it('handles supported file, shows preview card and formats file size', () => {
        modal.setTab('file');
        const file = { name: 'my_network.png', size: 1.5 * 1024 * 1024, type: 'image/png' };
        const ok = modal.handleFile(file);

        expect(ok).toBe(true);
        expect(modal.filePreviewCard.style.display).toBe('flex');
        expect(modal.dropzone.style.display).toBe('none');
        expect(modal.filePreviewName.textContent).toBe('my_network.png');
        expect(modal.filePreviewSize.textContent).toBe('1.5 MB');
        expect(modal.graphNameInput.value).toBe('my_network');
      });

      it('handles unsupported file, displays error and keeps dropzone visible', () => {
        modal.setTab('file');
        const file = { name: 'data.zip', size: 1024 };
        const ok = modal.handleFile(file);

        expect(ok).toBe(false);
        expect(modal.errorBox.style.display).toBe('block');
        expect(modal.errorBox.textContent).toMatch(/không được hỗ trợ/);
        expect(modal.dropzone.style.display).not.toBe('none');
      });

      it('resets file state when changing file', () => {
        modal.setTab('file');
        const file = { name: 'network.png', size: 2048, type: 'image/png' };
        modal.handleFile(file);
        expect(modal.filePreviewCard.style.display).toBe('flex');

        modal.resetFile();
        expect(modal.currentFile).toBeNull();
        expect(modal.filePreviewCard.style.display).toBe('none');
        expect(modal.dropzone.style.display).toBe('flex');
      });

      it('analyzes file with mock spec, displays summary, warnings and updates directedness', async () => {
        modal.setTab('file');
        const file = { name: 'circuit.png', size: 4096, type: 'image/png' };
        modal.handleFile(file);

        const mockSpec = {
          directed: true,
          confidence: 0.95,
          nodes: [{ id: 'N1' }, { id: 'N2' }, { id: 'N3' }],
          edges: [
            { from: 'N1', to: 'N2', weight: 6 },
            { from: 'N2', to: 'N2', weight: 1 }, // self loop warning
          ],
        };

        await modal.analyzeCurrentFile({ mockSpec });

        expect(modal.aiResultBox.style.display).toBe('block');
        expect(modal.aiResultSummary.textContent).toContain('3');
        expect(modal.aiResultSummary.textContent).toContain('2');
        expect(modal.aiResultSummary.textContent).toContain('Có hướng');
        expect(modal.aiConfidenceBadge.textContent).toContain('95%');
        expect(modal.aiWarningBox.style.display).toBe('block');
        expect(modal.aiWarningBox.textContent).toContain('khuyên');
        expect(modal.isDirected).toBe(true);
      });

      it('bridges extracted graph to Edge List editor via "Chỉnh sửa chi tiết"', async () => {
        modal.setTab('file');
        const file = { name: 'circuit.png', size: 4096, type: 'image/png' };
        modal.handleFile(file);

        const mockSpec = {
          directed: false,
          nodes: [{ id: 'A' }, { id: 'B' }],
          edges: [{ from: 'A', to: 'B', weight: 8 }],
        };
        await modal.analyzeCurrentFile({ mockSpec });

        // Click edit
        modal.btnEditExtracted.click();

        expect(modal.mode).toBe('list');
        expect(modal.listWrap.style.display).toBe('block');
        expect(modal.textList.value).toContain('A - B: 8');
        expect(modal.previewSummary.textContent).toContain('Đỉnh: 2');
      });

      it('applies extracted graph directly to onGraphCreated callback', async () => {
        modal.setTab('file');
        const file = { name: 'network.png', size: 2048, type: 'image/png' };
        modal.handleFile(file);

        const mockSpec = {
          directed: false,
          nodes: [{ id: 'U' }, { id: 'V' }],
          edges: [{ from: 'U', to: 'V', weight: 4 }],
        };
        await modal.analyzeCurrentFile({ mockSpec });

        modal.graphNameInput.value = 'Đồ thị AI Đã Duyệt';
        modal.preferredAlgo.value = 'kruskal';

        modal.btnApplyExtracted.click();

        expect(onCreatedSpy).toHaveBeenCalledTimes(1);
        const [appliedGraph, name, algo] = onCreatedSpy.mock.calls[0];
        expect(appliedGraph.nodeCount).toBe(2);
        expect(appliedGraph.edgeCount).toBe(1);
        expect(name).toBe('Đồ thị AI Đã Duyệt');
        expect(algo).toBe('kruskal');
        expect(modal.isOpen).toBe(false);
      });

      it('preserves existing state and does not call callback on cancel', () => {
        modal.open('file');
        expect(modal.isOpen).toBe(true);

        modal.btnCancel.click();
        expect(modal.isOpen).toBe(false);
        expect(onCreatedSpy).not.toHaveBeenCalled();
      });
    });

    describe('Algorithm Lab Integration & Execution with AI-Imported Graphs', () => {
      let labContainer;
      let lab;

      beforeEach(() => {
        labContainer = document.createElement('div');
        document.body.appendChild(labContainer);
        lab = new LabView({ container: labContainer });
      });

      afterEach(() => {
        labContainer.remove();
      });

      it('opens AI modal tab when btnOpenAiImportModal is clicked', () => {
        const btnAi = labContainer.querySelector('#btnOpenAiImportModal');
        expect(btnAi).not.toBeNull();

        btnAi.click();
        expect(lab.sourceModal.isOpen).toBe(true);
        expect(lab.sourceModal.mode).toBe('file');
      });

      it('opens modal with file when file is dropped on canvas area', () => {
        const canvasWrap = labContainer.querySelector('#graphCanvasWrap');
        expect(canvasWrap).not.toBeNull();

        const dropFile = { name: 'drop_graph.png', size: 3000, type: 'image/png' };
        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { files: [dropFile] };

        canvasWrap.dispatchEvent(dropEvent);

        expect(lab.sourceModal.isOpen).toBe(true);
        expect(lab.sourceModal.mode).toBe('file');
        expect(lab.sourceModal.currentFile).toBe(dropFile);
      });

      it('runs Dijkstra, Kruskal, and Prim algorithms smoothly on AI-imported graph', () => {
        const aiSpec = {
          directed: false,
          weighted: true,
          nodes: [
            { id: '1', name: 'Đỉnh 1' },
            { id: '2', name: 'Đỉnh 2' },
            { id: '3', name: 'Đỉnh 3' },
            { id: '4', name: 'Đỉnh 4' },
          ],
          edges: [
            { from: '1', to: '2', weight: 3 },
            { from: '2', to: '3', weight: 4 },
            { from: '1', to: '3', weight: 8 },
            { from: '3', to: '4', weight: 2 },
          ],
        };

        const importedGraph = createGraphFromSpecification(aiSpec);
        lab.setCustomGraph(importedGraph, 'Đồ thị AI 4 Đỉnh', 'dijkstra');

        // Verify graph metadata badge and title
        const metaBadge = labContainer.querySelector('#graphMetaBadge');
        expect(metaBadge.textContent).toContain('4 đỉnh');
        expect(metaBadge.textContent).toContain('4 cạnh');

        const titleEl = labContainer.querySelector('#graphTitleText');
        expect(titleEl.textContent).toBe('Đồ thị AI 4 Đỉnh');

        // Verify node select options populated
        const startSelect = labContainer.querySelector('#startNodeSelect');
        const endSelect = labContainer.querySelector('#endNodeSelect');
        expect(startSelect.children.length).toBe(4);
        expect(endSelect.children.length).toBe(4);

        // 1. Run Dijkstra via PlaybackControls btnPlay
        const btnPlay = labContainer.querySelector('#btnPlay');
        btnPlay.click();

        expect(lab.algorithmResult).not.toBeNull();
        expect(lab.algorithmResult.status).toBe(AlgorithmStatus.SUCCESS);
        expect(lab.algorithmResult.steps.length).toBeGreaterThan(0);
        expect(lab.playbackController).not.toBeNull();

        // Step forward in Dijkstra
        lab.playbackController.next();
        expect(lab.playbackController.currentIndex).toBe(1);

        // 2. Switch to Kruskal & Run
        lab.setAlgorithm('kruskal');
        btnPlay.click();
        expect(lab.algorithmResult.status).toBe(AlgorithmStatus.SUCCESS);
        expect(lab.algorithmResult.steps.length).toBeGreaterThan(0);

        // 3. Switch to Prim & Run
        lab.setAlgorithm('prim');
        btnPlay.click();
        expect(lab.algorithmResult.status).toBe(AlgorithmStatus.SUCCESS);
        expect(lab.algorithmResult.steps.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 15. ALGORITHM LAB — UI MICRO POLISH SUITE
  // (SCROLLBARS, OVERFLOW, STABLE TOOLBAR, NO TEXT LOSS, FULLSCREEN)
  // =========================================================================
  describe('15. Algorithm Lab: UI Micro Polish & Layout Stability', () => {
    let dom;
    let window;
    let document;
    let labContainer;
    let lab;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost/' });
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.localStorage = window.localStorage;

      labContainer = document.createElement('div');
      document.body.appendChild(labContainer);
      lab = new LabView({ container: labContainer });
    });

    afterEach(() => {
      if (labContainer && labContainer.parentNode) {
        labContainer.parentNode.removeChild(labContainer);
      }
      delete global.window;
      delete global.document;
      delete global.localStorage;
    });

    describe('Elimination of Page-Level Horizontal Scrollbar', () => {
      it('organizes toolbar into 2 stable rows without page-level overflow-x scrollbar', () => {
        const toolbar = labContainer.querySelector('.lab-toolbar');
        expect(toolbar).not.toBeNull();

        const rowMain = labContainer.querySelector('.toolbar-row-main');
        const rowParams = labContainer.querySelector('.toolbar-row-params');
        expect(rowMain).not.toBeNull();
        expect(rowParams).not.toBeNull();

        // Check CSS file directly to verify .lab-toolbar does NOT have overflow-x: auto
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        // .lab-toolbar must use overflow: visible (not overflow-x: auto)
        expect(cssContent).toMatch(/\.lab-toolbar\s*\{[^}]*overflow:\s*visible/);
        expect(cssContent).not.toMatch(/\.lab-toolbar\s*\{[^}]*overflow-x:\s*auto/);
      });

      it('ensures flex children have min-width: 0 to prevent flex blowout', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        expect(cssContent).toMatch(/\.graph-pane[^{]*\{[^}]*min-width:\s*0/);
        expect(cssContent).toMatch(/\.code-pane[^{]*\{[^}]*min-width:\s*0/);
        expect(cssContent).toMatch(/\.lab-main-stage\s*\{[^}]*min-width:\s*0/);
        expect(cssContent).toMatch(/#app\s*\{[^}]*min-width:\s*0/);
      });
    });

    describe('Stable Button Positions Across All 5 Algorithms', () => {
      it('keeps Fullscreen button and Playback run button completely stationary across all algorithms', () => {
        const btnFs = labContainer.querySelector('#btnLabFullscreen');
        const btnPlay = labContainer.querySelector('#btnPlay');
        const rightCluster = labContainer.querySelector('.toolbar-right-cluster');
        const playbackBar = labContainer.querySelector('.playback-bar');

        expect(rightCluster.contains(btnFs)).toBe(true);
        expect(playbackBar.contains(btnPlay)).toBe(true);

        const algos = ['dijkstra', 'kruskal', 'prim', 'euler', 'hamilton'];
        algos.forEach(algo => {
          lab.setAlgorithm(algo);

          // Fullscreen remains in right cluster in row 1
          expect(rightCluster.contains(btnFs)).toBe(true);
          expect(btnFs.textContent).toContain('Toàn màn hình');

          // Playback run button remains below code panel
          expect(playbackBar.contains(btnPlay)).toBe(true);
          expect(btnPlay.textContent).toContain('Chạy');

          // Preset and import buttons remain in left cluster
          const leftCluster = labContainer.querySelector('.toolbar-left-cluster');
          expect(leftCluster.querySelector('#presetSelect')).not.toBeNull();
          expect(leftCluster.querySelector('#btnOpenCustomModal')).not.toBeNull();
          expect(leftCluster.querySelector('#btnOpenAiImportModal')).not.toBeNull();
        });
      });
    });

    describe('No Text Loss & Button Wrap Enforcement', () => {
      it('enforces white-space: nowrap on all buttons to prevent text wrapping or truncation', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        expect(cssContent).toMatch(/white-space:\s*nowrap\s*!important/);

        // Verify key buttons have full text and no clipped words
        const btnPlay = labContainer.querySelector('#btnPlay');
        expect(btnPlay.textContent.trim()).toBe('▶ Chạy');

        const btnFs = labContainer.querySelector('#btnLabFullscreen');
        expect(btnFs.textContent.trim()).toBe('⛶ Toàn màn hình');

        const btnCustom = labContainer.querySelector('#btnOpenCustomModal');
        expect(btnCustom.textContent.trim()).toBe('✏️ Tự tạo');

        const btnImport = labContainer.querySelector('#btnOpenAiImportModal');
        expect(btnImport.textContent.trim()).toBe('📷 Nhập ảnh/tệp');
      });
    });

    describe('Subtle Hierarchical Scrollbars', () => {
      it('defines slim 7px subtle scrollbars in CSS for code, table, and modal', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        // Global webkit scrollbar
        expect(cssContent).toMatch(/::-webkit-scrollbar\s*\{[^}]*width:\s*7px/);
        expect(cssContent).toMatch(/scrollbar-width:\s*thin/);

        // Code viewport subtle scrollbar
        expect(cssContent).toMatch(/\.code-panel-body::-webkit-scrollbar/);

        // Table viewport subtle scrollbar
        expect(cssContent).toMatch(/\.table-wrap::-webkit-scrollbar/);

        // Graph viewport has no scrollbar
        expect(cssContent).toMatch(/\.graph-viewport\s*\{[^}]*overflow:\s*hidden\s*!important/);
        expect(cssContent).toMatch(/\.graph-viewport::-webkit-scrollbar\s*\{[^}]*display:\s*none\s*!important/);
      });
    });

    describe('Code Header & Table Fullscreen Polish', () => {
      it('ensures code header has nowrap layout preventing control crowding', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        expect(cssContent).toMatch(/\.code-panel-header\s*\{[^}]*flex-wrap:\s*nowrap/);
      });

      it('covers full viewport without background gaps when table focus mode is active', () => {
        lab.setFocusMode('table');
        expect(lab.focusMode).toBe('table');
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(true);

        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        expect(cssContent).toMatch(/\.lab-layout\.focus-table[^}]*width:\s*100vw\s*!important/);
        expect(cssContent).toMatch(/\.lab-layout\.focus-table[^}]*height:\s*100vh\s*!important/);

        // Clean exit
        lab.setFocusMode(null);
        expect(lab.focusMode).toBeNull();
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(false);
      });
    });

    describe('Single Play/Run Button & Comprehensive Fullscreen Mode (Phase 5B)', () => {
      it('completely removes top #btnRunAlgo and uses #btnPlay as the unified single run button', () => {
        expect(labContainer.querySelector('#btnRunAlgo')).toBeNull();

        const btnPlay = labContainer.querySelector('#btnPlay');
        expect(btnPlay).not.toBeNull();
        expect(btnPlay.textContent.trim()).toBe('▶ Chạy');

        // Initially no algorithm result
        expect(lab.algorithmResult).toBeNull();
        expect(lab.playbackController).toBeNull();

        // Clicking btnPlay executes the algorithm and automatically starts playing
        btnPlay.click();

        expect(lab.algorithmResult).not.toBeNull();
        expect(lab.algorithmResult.steps.length).toBeGreaterThan(0);
        expect(lab.playbackController).not.toBeNull();
        expect(lab.playbackController.isPlaying).toBe(true);
        console.log('DEBUG BTN PLAY:', JSON.stringify(btnPlay.textContent), 'CONTROLS BTN:', JSON.stringify(lab.playbackControls.btnPlay.textContent), 'EQUAL?', btnPlay === lab.playbackControls.btnPlay);
        expect(btnPlay.textContent.trim()).toBe('⏸ Dừng');

        // Clicking again pauses
        btnPlay.click();
        expect(lab.playbackController.isPlaying).toBe(false);
        expect(btnPlay.textContent.trim()).toBe('▶ Chạy');
      });

      it('hides top web navigation header completely in fullscreen and focus modes', () => {
        const btnFs = labContainer.querySelector('#btnLabFullscreen');
        expect(btnFs).not.toBeNull();

        // Activate fullscreen
        btnFs.click();
        expect(lab.focusMode).toBe('lab');
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(true);
        expect(document.body.classList.contains('is-fullscreen-mode')).toBe(true);
        expect(btnFs.textContent.trim()).toBe('✕ Thu nhỏ');

        // Verify CSS rule hides header with display: none !important
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        expect(cssContent).toMatch(/body\.has-lab-focus-mode\s+\.app-header[^}]*display:\s*none\s*!important/);
        expect(cssContent).toMatch(/body\.is-fullscreen-mode\s+\.app-header[^}]*display:\s*none\s*!important/);
        expect(cssContent).toMatch(/:fullscreen\s+\.app-header[^}]*display:\s*none\s*!important/);

        // Deactivate fullscreen
        btnFs.click();
        expect(lab.focusMode).toBeNull();
        expect(document.body.classList.contains('has-lab-focus-mode')).toBe(false);
        expect(document.body.classList.contains('is-fullscreen-mode')).toBe(false);
        expect(btnFs.textContent.trim()).toBe('⛶ Toàn màn hình');
      });

      it('displays helpful prompt referring to btnPlay in empty StateTable placeholder', () => {
        const tableContainer = labContainer.querySelector('#stateTableContainer');
        expect(tableContainer.textContent).toContain('Bấm nút "▶ Chạy" bên dưới khung code để bắt đầu');
      });

      it('enables and wires up btnFirst, btnPrev, btnNext, and btnLast at all times with auto execution', () => {
        const btnFirst = labContainer.querySelector('#btnFirst');
        const btnPrev = labContainer.querySelector('#btnPrev');
        const btnPlay = labContainer.querySelector('#btnPlay');
        const btnNext = labContainer.querySelector('#btnNext');
        const btnLast = labContainer.querySelector('#btnLast');

        // All 5 buttons are enabled initially (never disabled)
        expect(btnFirst.disabled).toBe(false);
        expect(btnPrev.disabled).toBe(false);
        expect(btnPlay.disabled).toBe(false);
        expect(btnNext.disabled).toBe(false);
        expect(btnLast.disabled).toBe(false);

        // Clicking btnLast before run: automatically runs algorithm and jumps to last step
        btnLast.click();
        expect(lab.playbackController).not.toBeNull();
        expect(lab.playbackController.currentIndex).toBe(lab.playbackController.totalSteps - 1);
        expect(lab.playbackController.isPlaying).toBe(false);

        // Clicking btnFirst: pauses and jumps back to first step (index 0)
        btnFirst.click();
        expect(lab.playbackController.currentIndex).toBe(0);
        expect(lab.playbackController.isPlaying).toBe(false);

        // Clicking btnNext: advances to index 1
        btnNext.click();
        expect(lab.playbackController.currentIndex).toBe(1);

        // Clicking btnPrev: moves back to index 0
        btnPrev.click();
        expect(lab.playbackController.currentIndex).toBe(0);
      });

      it('hides the scrubber slider bar per user request to clean up clutter', () => {
        const cssPath = path.resolve(__dirname, '../../src/ui/styles/main.css');
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        expect(cssContent).toMatch(/\.playback-scrubber\s*\{[^}]*display:\s*none\s*!important/);
      });
    });
  });

  // =========================================================================
  // 16. PHASE 5 & 5A: IMAGE/FILE AI INPUT PIPELINE & MODAL WORKFLOW
  // =========================================================================
  describe('16. Phase 5 & 5A: Image / File AI Input Pipeline & Safe Confirmation', () => {
    let dom;
    let window;
    let document;
    let labViewInstance;
    let labWrap;

    beforeEach(() => {
      dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost/' });
      window = dom.window;
      document = window.document;
      global.window = window;
      global.document = document;
      global.localStorage = window.localStorage;

      labWrap = document.createElement('div');
      document.body.appendChild(labWrap);
      labViewInstance = new LabView({ container: labWrap });
      labViewInstance.render();
    });

    afterEach(() => {
      if (labViewInstance?.sourceModal?.isOpen) {
        labViewInstance.sourceModal.close();
      }
      if (labWrap?.parentNode) {
        labWrap.parentNode.removeChild(labWrap);
      }
      setAnalyzerProvider(null);
      delete global.window;
      delete global.document;
      delete global.localStorage;
    });

    it('opens GraphSourceModal on file tab when "Nhập ảnh/tệp" is clicked', () => {
      const btnAi = labWrap.querySelector('#btnOpenAiImportModal');
      expect(btnAi).not.toBeNull();

      btnAi.click();

      expect(labViewInstance.sourceModal.isOpen).toBe(true);
      expect(labViewInstance.sourceModal.mode).toBe('file');

      const modalEl = labWrap.querySelector('#customModal');
      expect(modalEl.style.display).not.toBe('none');

      const fileWrap = labWrap.querySelector('#fileInputWrap');
      expect(fileWrap.style.display).toBe('block');
    });

    it('shows preview card when valid file is selected and resets on "Đổi tệp"', async () => {
      labViewInstance.sourceModal.open('file');

      const fakeFile = {
        name: 'network_map.png',
        type: 'image/png',
        size: 1024 * 150, // 150 KB
      };

      const accepted = await labViewInstance.sourceModal.handleFile(fakeFile);
      expect(accepted).toBe(true);

      const dropzone = labWrap.querySelector('#fileDropzone');
      const previewCard = labWrap.querySelector('#filePreviewCard');
      const previewName = labWrap.querySelector('#filePreviewName');
      const previewSize = labWrap.querySelector('#filePreviewSize');

      expect(dropzone.style.display).toBe('none');
      expect(previewCard.style.display).toBe('flex');
      expect(previewName.textContent).toBe('network_map.png');
      expect(previewSize.textContent).toBe('150.0 KB');

      // Click "Đổi tệp"
      const btnChange = labWrap.querySelector('#btnChangeFile');
      btnChange.click();

      expect(dropzone.style.display).toBe('flex');
      expect(previewCard.style.display).toBe('none');
      expect(labViewInstance.sourceModal.currentFile).toBeNull();
    });

    it('toggles AI API Key config panel and saves/clears key to localStorage', () => {
      labViewInstance.sourceModal.open('file');

      const configPanel = labWrap.querySelector('#aiConfigPanel');
      const btnToggle = labWrap.querySelector('#btnToggleAiConfig');
      const inputKey = labWrap.querySelector('#inputGeminiApiKey');
      const btnSave = labWrap.querySelector('#btnSaveApiKey');
      const btnClear = labWrap.querySelector('#btnClearApiKey');

      expect(configPanel.style.display).toBe('none');

      btnToggle.click();
      expect(configPanel.style.display).toBe('block');

      // Save key
      inputKey.value = 'AIzaSyTestApiKey12345';
      btnSave.click();

      expect(labViewInstance.sourceModal.aiStatusText.textContent).toContain('Sẵn sàng');

      // Clear key
      btnClear.click();
      expect(inputKey.value).toBe('');
    });

    it('handles AI analysis loading state and renders result preview with badge and warnings', async () => {
      labViewInstance.sourceModal.open('file');

      const fakeFile = {
        name: 'ai_graph.png',
        type: 'image/png',
        size: 2048,
      };
      await labViewInstance.sourceModal.handleFile(fakeFile);

      const mockAiSpec = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: 8 }],
        confidence: 0.95,
        warnings: ['Trọng số cạnh A-B có thể là 8 hoặc 3.'],
      };

      // Set mock analyzer provider for frontend
      setAnalyzerProvider(async () => mockAiSpec);

      const btnAnalyze = labWrap.querySelector('#btnAnalyzeFile');
      const aiResultBox = labWrap.querySelector('#aiResultBox');
      const aiBadge = labWrap.querySelector('#aiConfidenceBadge');
      const warningBox = labWrap.querySelector('#aiWarningBox');

      await labViewInstance.sourceModal.analyzeCurrentFile();

      expect(aiResultBox.style.display).toBe('block');
      expect(aiBadge.textContent).toContain('Đã nhận diện đồ thị');
      expect(warningBox.style.display).toBe('block');
      expect(warningBox.textContent).toContain('⚠️ Một số dữ liệu cần kiểm tra:');
      expect(warningBox.textContent).toContain('Trọng số cạnh A-B có thể là 8 hoặc 3.');
      expect(labViewInstance.sourceModal.extractedGraph).not.toBeNull();
    });

    it('ensures safe confirmation: does NOT replace active graph until user confirms', async () => {
      // 1. Initial graph is whatever preset was loaded (e.g. basic 4 nodes)
      const initialGraph = labViewInstance.graph;
      const initialNodeCount = initialGraph.nodeCount || initialGraph.getNodes().length;

      // 2. Open modal and extract a new 3-node graph
      labViewInstance.sourceModal.open('file');
      const fakeFile = { name: 'triangle.png', type: 'image/png', size: 1024 };
      await labViewInstance.sourceModal.handleFile(fakeFile);

      setAnalyzerProvider(async () => ({
        directed: false,
        weighted: true,
        nodes: [{ id: 'X' }, { id: 'Y' }, { id: 'Z' }],
        edges: [
          { from: 'X', to: 'Y', weight: 2 },
          { from: 'Y', to: 'Z', weight: 3 },
        ],
        confidence: 0.99,
        warnings: [],
      }));

      await labViewInstance.sourceModal.analyzeCurrentFile();

      // At this point, active graph in Lab MUST NOT have changed!
      expect(labViewInstance.graph).toBe(initialGraph);
      expect(labViewInstance.graph.nodeCount || labViewInstance.graph.getNodes().length).toBe(initialNodeCount);

      // 3. User cancels / dismisses modal
      labViewInstance.sourceModal.close();
      expect(labViewInstance.sourceModal.isOpen).toBe(false);
      // Active graph is STILL untouched
      expect(labViewInstance.graph).toBe(initialGraph);

      // 4. Re-open and confirm
      labViewInstance.sourceModal.open('file');
      await labViewInstance.sourceModal.handleFile(fakeFile);
      await labViewInstance.sourceModal.analyzeCurrentFile();

      const btnApplyExtracted = labWrap.querySelector('#btnApplyExtracted');
      btnApplyExtracted.click();

      // Modal closed and new graph applied
      expect(labViewInstance.sourceModal.isOpen).toBe(false);
      expect(labViewInstance.graph).not.toBe(initialGraph);
      expect(labViewInstance.graph.nodeCount).toBe(3);
      expect(labViewInstance.graph.hasNode('X')).toBe(true);
      expect(labViewInstance.graph.hasNode('Y')).toBe(true);
      expect(labViewInstance.graph.hasNode('Z')).toBe(true);

      // Can immediately run algorithm on newly loaded graph
      labViewInstance.setAlgorithm('dijkstra');
      labViewInstance.startNode = 'X';
      labViewInstance.targetNode = 'Z';
      const runSuccess = labViewInstance.runAlgorithm();
      expect(runSuccess).toBe(true);
      expect(labViewInstance.controller.stepCount).toBeGreaterThan(0);
    });

    it('allows editing extracted graph in Edge List before applying', async () => {
      labViewInstance.sourceModal.open('file');
      await labViewInstance.sourceModal.handleFile({ name: 'editable.png', type: 'image/png', size: 1024 });

      setAnalyzerProvider(async () => ({
        directed: false,
        weighted: true,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: 15 }],
        warnings: [],
      }));

      await labViewInstance.sourceModal.analyzeCurrentFile();

      // Click "✏️ Chỉnh sửa chi tiết"
      const btnEdit = labWrap.querySelector('#btnEditExtracted');
      btnEdit.click();

      // Mode switches to 'list'
      expect(labViewInstance.sourceModal.mode).toBe('list');
      const textList = labWrap.querySelector('#modalTextList');
      expect(textList.value).toContain('A - B: 15');

      // User modifies weight to 20
      textList.value = 'A - B: 20';
      labViewInstance.sourceModal.updatePreview();

      // User applies modified graph
      const btnModalApply = labWrap.querySelector('#btnModalApply');
      btnModalApply.click();

      expect(labViewInstance.sourceModal.isOpen).toBe(false);
      expect(labViewInstance.graph.getWeight('A', 'B')).toBe(20);
    });
  });
});




