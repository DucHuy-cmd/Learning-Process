/**
 * @file StepFormatter.test.js
 * Comprehensive unit test suite for Phase 3C: StepFormatter
 *
 * Verifies:
 * - Pure transformation from AlgorithmStep to PresentationStep
 * - Dijkstra, Kruskal, Prim, Euler, Hamilton table and state formatting
 * - Canonical Action -> Phase mappings in Vietnamese and English
 * - Unknown action handling without throwing
 * - Null / empty step safety
 * - Missing state / missing highlights / missing graph safe degradation
 * - Formula derivation rules (Dijkstra relaxation derived, SELECT_NODE null, Kruskal null)
 * - CRITICAL: Path vs Highlights distinction (highlights.nodes !== algorithmic path)
 * - CRITICAL: Dijkstra PQ is strictly null (no fake heap reconstruction)
 * - CRITICAL: Active lines defensive copy from context.codeMapping
 * - Graph duck typing and node encounter ordering
 * - Input immutability (step, state, highlights, graph, context)
 * - Headless purity (zero DOM / window / document)
 */

import { describe, it, expect } from 'vitest';
import {
  StepFormatter,
  formatStep,
  resolvePhase,
  formatTable,
} from '../../src/app/presentation/StepFormatter.js';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmAction } from '../../src/core/models/Types.js';

/**
 * Creates a duck-typed test graph:
 *   A --(2)-- B --(3)-- C
 */
function createDuckGraph() {
  const nodes = [
    { id: 'A', short: 'A', name: 'Node A' },
    { id: 'B', short: 'B', name: 'Node B' },
    { id: 'C', short: 'C', name: 'Node C' },
  ];
  const edges = [
    { id: 'A-B', from: 'A', to: 'B', weight: 2 },
    { id: 'B-C', from: 'B', to: 'C', weight: 3 },
  ];

  return {
    getNodes: () => [...nodes],
    getNode: (id) => nodes.find((n) => n.id === id) || null,
    getEdge: (id) => edges.find((e) => e.id === id) || null,
    getNeighbors: (id) => {
      if (id === 'A') return [{ node: 'B', weight: 2, edgeId: 'A-B' }];
      if (id === 'B')
        return [
          { node: 'A', weight: 2, edgeId: 'A-B' },
          { node: 'C', weight: 3, edgeId: 'B-C' },
        ];
      if (id === 'C') return [{ node: 'B', weight: 3, edgeId: 'B-C' }];
      return [];
    },
    isDirected: false,
  };
}

describe('Phase 3C: StepFormatter', () => {
  // =========================================================================
  // SUITE 1: CANONICAL ACTION-TO-PHASE RESOLUTION
  // =========================================================================
  describe('Suite 1: Action-to-Phase Resolution', () => {
    it('maps all canonical AlgorithmAction values to Vietnamese labels by default', () => {
      expect(resolvePhase(AlgorithmAction.INITIALIZE)).toBe('Khởi tạo');
      expect(resolvePhase(AlgorithmAction.SELECT_NODE)).toBe('Chốt đỉnh');
      expect(resolvePhase(AlgorithmAction.INSPECT_EDGE)).toBe('Xét cạnh');
      expect(resolvePhase(AlgorithmAction.RELAX_EDGE)).toBe('Nới lỏng');
      expect(resolvePhase(AlgorithmAction.REJECT_EDGE)).toBe('Từ chối cạnh');
      expect(resolvePhase(AlgorithmAction.ACCEPT_EDGE)).toBe('Nhận cạnh');
      expect(resolvePhase(AlgorithmAction.BACKTRACK)).toBe('Quay lui');
      expect(resolvePhase(AlgorithmAction.FINISH)).toBe('Hoàn tất');
      expect(resolvePhase(AlgorithmAction.ERROR)).toBe('Lỗi');
      expect(resolvePhase(AlgorithmAction.VISIT_NODE)).toBe('Thăm đỉnh');
    });

    it('maps canonical AlgorithmAction values to English labels when requested', () => {
      expect(resolvePhase(AlgorithmAction.INITIALIZE, 'dijkstra', 'en')).toBe('Initialize');
      expect(resolvePhase(AlgorithmAction.SELECT_NODE, 'dijkstra', 'en')).toBe('Select node');
      expect(resolvePhase(AlgorithmAction.INSPECT_EDGE, 'dijkstra', 'en')).toBe('Inspect edge');
      expect(resolvePhase(AlgorithmAction.RELAX_EDGE, 'dijkstra', 'en')).toBe('Relax edge');
      expect(resolvePhase(AlgorithmAction.REJECT_EDGE, 'dijkstra', 'en')).toBe('Reject edge');
      expect(resolvePhase(AlgorithmAction.ACCEPT_EDGE, 'dijkstra', 'en')).toBe('Accept edge');
      expect(resolvePhase(AlgorithmAction.BACKTRACK, 'dijkstra', 'en')).toBe('Backtrack');
      expect(resolvePhase(AlgorithmAction.FINISH, 'dijkstra', 'en')).toBe('Finish');
      expect(resolvePhase(AlgorithmAction.ERROR, 'dijkstra', 'en')).toBe('Error');
      expect(resolvePhase(AlgorithmAction.VISIT_NODE, 'dijkstra', 'en')).toBe('Visit node');
    });

    it('handles unknown action strings deterministically without throwing', () => {
      expect(resolvePhase('CUSTOM_ACTION', 'dijkstra', 'vi')).toBe('Bước thực thi');
      expect(resolvePhase('CUSTOM_ACTION', 'dijkstra', 'en')).toBe('Step');
      expect(resolvePhase(null, 'dijkstra', 'vi')).toBe('Bước thực thi');
    });
  });

  // =========================================================================
  // SUITE 2: DIJKSTRA STEP FORMATTING
  // =========================================================================
  describe('Suite 2: Dijkstra Step Formatting', () => {
    it('formats Dijkstra INITIALIZE step with distance vector, infinity symbol and formula', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 1,
        action: AlgorithmAction.INITIALIZE,
        description: 'Khởi tạo: dist[A] = 0, các đỉnh khác vô cùng (∞)',
        state: {
          dist: { A: 0, B: Infinity, C: Infinity },
          prev: { A: null, B: null, C: null },
          visited: [],
        },
        highlights: { nodes: ['A'], edges: [] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'dijkstra' });

      expect(pres.stepNumber).toBe(1);
      expect(pres.action).toBe(AlgorithmAction.INITIALIZE);
      expect(pres.phase).toBe('Khởi tạo');
      expect(pres.description).toBe(rawStep.description);
      expect(pres.formula).toBe('dist[A] = 0, dist[v] = ∞');
      expect(pres.highlights.nodes).toEqual(['A']);

      // Table verification
      expect(pres.table).toBeDefined();
      expect(pres.table.type).toBe('dijkstra');
      expect(pres.table.headers).toEqual(['Bước', 'A', 'B', 'C']);
      const rowCells = pres.table.rows[0].cells;
      expect(rowCells[0]).toEqual({ nodeId: 'A', val: '(0, -)', type: 'normal' });
      expect(rowCells[1]).toEqual({ nodeId: 'B', val: '(∞, -)', type: 'init' });
      expect(rowCells[2]).toEqual({ nodeId: 'C', val: '(∞, -)', type: 'init' });

      // PQ is strictly null
      expect(pres.pqPills).toBeNull();
    });

    it('formats Dijkstra RELAX_EDGE step with updated distance and derived formula', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 3,
        action: AlgorithmAction.RELAX_EDGE,
        description: 'Nới lỏng thành công (A → B): dist[B] giảm xuống 2.',
        state: {
          dist: { A: 0, B: 2, C: Infinity },
          prev: { A: null, B: 'A', C: null },
          visited: ['A'],
        },
        highlights: { nodes: ['B'], edges: ['A-B'] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'dijkstra' });

      expect(pres.phase).toBe('Nới lỏng');
      expect(pres.formula).toBe('dist[B] = dist[A] + 2 = 2');
      expect(pres.table.rows[0].cells[1]).toEqual({
        nodeId: 'B',
        val: '(2, A)',
        type: 'updated',
      });
      expect(pres.pqPills).toBeNull();
    });

    it('Dijkstra SELECT_NODE sets settled cell and guarantees formula remains null', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 2,
        action: AlgorithmAction.SELECT_NODE,
        description: 'Chọn đỉnh A với khoảng cách 0.',
        state: {
          dist: { A: 0, B: Infinity, C: Infinity },
          prev: { A: null, B: null, C: null },
          visited: ['A'],
        },
        highlights: { nodes: ['A'], edges: [] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'dijkstra' });

      expect(pres.phase).toBe('Chốt đỉnh');
      expect(pres.formula).toBeNull(); // Must remain null because true heap top is absent
      expect(pres.table.rows[0].cells[0]).toEqual({
        nodeId: 'A',
        val: '(0, -)*',
        type: 'settled',
      });
      expect(pres.pqPills).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 3: KRUSKAL STEP FORMATTING
  // =========================================================================
  describe('Suite 3: Kruskal Step Formatting', () => {
    it('formats Kruskal ACCEPT_EDGE step with MST edge pills and total weight', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 2,
        action: AlgorithmAction.ACCEPT_EDGE,
        description: 'Nhận cạnh (A - B, w=2) vào cây khung.',
        state: {
          acceptedEdges: [{ from: 'A', to: 'B', weight: 2, id: 'A-B' }],
          rejectedEdges: [],
          totalWeight: 2,
          componentCount: 2,
        },
        highlights: { nodes: ['A', 'B'], edges: ['A-B'] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'kruskal' });

      expect(pres.phase).toBe('Nhận cạnh');
      expect(pres.formula).toBeNull();
      expect(pres.table.type).toBe('kruskal');
      expect(pres.table.headers).toContain('Cạnh xét');
      expect(pres.table.headers).toContain('Tổng trọng số');

      const cells = pres.table.rows[0].cells;
      expect(cells[0].val).toBe('A-B');
      expect(cells[1].val).toBe('Nhận cạnh');
      expect(cells[2].val).toBe('A-B');
      expect(cells[3].val).toBe('2');

      // MST edge pills
      expect(pres.pqPills).toBeDefined();
      expect(pres.pqPills).toHaveLength(1);
      expect(pres.pqPills[0].label).toBe('A-B (2)');
      expect(pres.pqPills[0].type).toBe('mst-edge');
    });

    it('Kruskal operates with zero SELECT_NODE dependency', () => {
      const rawStep = {
        stepNumber: 3,
        action: AlgorithmAction.REJECT_EDGE,
        description: 'Từ chối cạnh tạo chu trình.',
        state: {
          acceptedEdges: [{ from: 'A', to: 'B', weight: 2, id: 'A-B' }],
          rejectedEdges: [{ from: 'A', to: 'C', weight: 4, id: 'A-C' }],
          totalWeight: 2,
          componentCount: 2,
        },
        highlights: { nodes: ['A', 'C'], edges: ['A-C'] },
      };

      const pres = formatStep(rawStep, null, { algorithmKey: 'kruskal' });
      expect(pres.phase).toBe('Từ chối cạnh');
      expect(pres.table.rows[0].cells[1].val).toBe('Từ chối cạnh');
    });
  });

  // =========================================================================
  // SUITE 4: PRIM STEP FORMATTING
  // =========================================================================
  describe('Suite 4: Prim Step Formatting', () => {
    it('formats Prim ACCEPT_EDGE with key, parent, Tv, Te and MST pills', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 3,
        action: AlgorithmAction.ACCEPT_EDGE,
        description: 'Kết nạp đỉnh B và cạnh (A - B, w=2) vào cây khung.',
        state: {
          key: { A: 0, B: 2, C: 3 },
          parent: { A: null, B: 'A', C: 'B' },
          inMST: ['A', 'B'],
          acceptedEdges: [{ from: 'A', to: 'B', weight: 2, id: 'A-B' }],
          totalWeight: 2,
        },
        highlights: { nodes: ['A', 'B'], edges: ['A-B'] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'prim' });

      expect(pres.phase).toBe('Nhận cạnh');
      expect(pres.table.type).toBe('prim');
      expect(pres.table.headers).toEqual(['Bước', 'A', 'B', 'C', 'Tv', 'Te', 'Tổng trọng số']);

      const cells = pres.table.rows[0].cells;
      expect(cells[0]).toEqual({ nodeId: 'A', val: '-', type: 'visited' }); // inMST
      expect(cells[1]).toEqual({ nodeId: 'B', val: '-', type: 'visited' }); // inMST
      expect(cells[2]).toEqual({ nodeId: 'C', val: '(3, B)', type: 'normal' });
      expect(cells[3]).toEqual({ val: '{ A, B }', type: 'tv' });
      expect(cells[4]).toEqual({ val: '{ A-B }', type: 'te' });
      expect(cells[5]).toEqual({ val: '2', type: 'weight' });

      // MST edge pills
      expect(pres.pqPills).toHaveLength(1);
      expect(pres.pqPills[0].label).toBe('A-B (2)');
      expect(pres.pqPills[0].type).toBe('mst-edge');
    });
  });

  // =========================================================================
  // SUITE 5: EULER STEP FORMATTING
  // =========================================================================
  describe('Suite 5: Euler Step Formatting', () => {
    it('formats Euler BACKTRACK step with stack, circuit, and traversal pills', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 4,
        action: AlgorithmAction.BACKTRACK,
        description: 'Đỉnh C không còn cạnh kề chưa dùng -> Lấy ra khỏi ngăn xếp.',
        state: {
          stack: ['A', 'B'],
          circuit: ['C'],
          type: 'circuit',
          connected: true,
        },
        highlights: { nodes: ['C'], edges: [] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'euler' });

      expect(pres.phase).toBe('Quay lui');
      expect(pres.table.type).toBe('euler');
      const cells = pres.table.rows[0].cells;
      expect(cells[1].val).toBe('A → B'); // Stack
      expect(cells[2].val).toBe('C'); // Circuit
      expect(cells[3].val).toBe('circuit');

      // Traversal pills reflect stack
      expect(pres.pqPills).toHaveLength(2);
      expect(pres.pqPills[0].label).toBe('1. A');
      expect(pres.pqPills[1].label).toBe('2. B');
    });
  });

  // =========================================================================
  // SUITE 6: HAMILTON STEP FORMATTING
  // =========================================================================
  describe('Suite 6: Hamilton Step Formatting', () => {
    it('formats Hamilton SELECT_NODE step with backtracking path pills and table row', () => {
      const graph = createDuckGraph();
      const rawStep = {
        stepNumber: 2,
        action: AlgorithmAction.SELECT_NODE,
        description: 'Thử thêm đỉnh B vào đường đi hiện tại.',
        state: {
          path: ['A', 'B'],
          visited: ['A', 'B'],
          currentNodeId: 'B',
          closesCycle: false,
          found: false,
        },
        highlights: { nodes: ['A', 'B'], edges: [] },
      };

      const pres = formatStep(rawStep, graph, { algorithmKey: 'hamilton' });

      expect(pres.phase).toBe('Chốt đỉnh');
      expect(pres.table.type).toBe('hamilton');
      const cells = pres.table.rows[0].cells;
      expect(cells[1].val).toBe('A → B'); // Path
      expect(cells[2].val).toBe('{ A, B }'); // Visited
      expect(cells[3].val).toBe('Không'); // Closes cycle

      // Path pills
      expect(pres.pqPills).toHaveLength(2);
      expect(pres.pqPills[0].label).toBe('1. A');
      expect(pres.pqPills[1].label).toBe('2. B');
    });
  });

  // =========================================================================
  // SUITE 7: MANDATORY CONTRACT TESTS (CRITICAL AUDIT CHECKS)
  // =========================================================================
  describe('Suite 7: Mandatory Contract Tests', () => {
    // SECTION 19: PATH VS HIGHLIGHTS REGRESSION TEST
    it('CRITICAL: preserves highlights.nodes without converting it into path', () => {
      const rawStep = {
        stepNumber: 5,
        action: AlgorithmAction.INSPECT_EDGE,
        description: 'Kiểm tra cạnh giữa B và C.',
        state: {
          path: ['A', 'B'], // Authoritative path prefix
        },
        highlights: { nodes: ['B', 'C'], edges: ['B-C'] }, // Visual attention focus
      };

      const pres = formatStep(rawStep, null, { algorithmKey: 'hamilton' });

      // Highlights must strictly contain ['B', 'C']
      expect(pres.highlights.nodes).toEqual(['B', 'C']);
      // Table and pills must strictly reflect authoritative state.path ['A', 'B']
      expect(pres.table.rows[0].cells[1].val).toBe('A → B');
      expect(pres.pqPills.map((p) => p.nodeId)).toEqual(['A', 'B']);
    });

    // SECTION 20: DIJKSTRA PQ MUST BE NULL
    it('CRITICAL: Dijkstra step.state without heap data results in pqPills === null', () => {
      const rawStep = {
        stepNumber: 2,
        action: AlgorithmAction.SELECT_NODE,
        description: 'Chốt đỉnh A.',
        state: {
          dist: { A: 0, B: 5 },
          prev: { A: null, B: 'A' },
          visited: ['A'],
        },
        highlights: { nodes: ['A'], edges: [] },
      };

      const pres = formatStep(rawStep, null, { algorithmKey: 'dijkstra' });
      // Must be null! No fabricated heap items!
      expect(pres.pqPills).toBeNull();
    });

    // SECTION 21: ACTIVE LINES DEFENSIVE COPY
    it('CRITICAL: activeLines defaults to [] and returns defensive copy with context.codeMapping', () => {
      const rawStep = {
        stepNumber: 1,
        action: AlgorithmAction.RELAX_EDGE,
        description: 'Nới lỏng.',
        state: {},
      };

      // 1. Without context
      const presNoContext = formatStep(rawStep);
      expect(presNoContext.activeLines).toEqual([]);

      // 2. With context
      const sourceMapping = {
        [AlgorithmAction.RELAX_EDGE]: [13, 14, 15],
      };
      const presWithContext = formatStep(rawStep, null, {
        codeMapping: sourceMapping,
      });

      expect(presWithContext.activeLines).toEqual([13, 14, 15]);

      // 3. Mutating returned array does NOT mutate context
      presWithContext.activeLines.push(999);
      expect(sourceMapping[AlgorithmAction.RELAX_EDGE]).toEqual([13, 14, 15]);
    });
  });

  // =========================================================================
  // SUITE 8: IMMUTABILITY, DEFENSIVE COPYING & SAFE DEGRADATION
  // =========================================================================
  describe('Suite 8: Immutability, Defensive Copying & Safe Degradation', () => {
    it('formatStep(null) returns null safely without throwing', () => {
      expect(formatStep(null)).toBeNull();
      expect(formatStep(undefined)).toBeNull();
    });

    it('handles missing state, missing highlights, and missing graph gracefully', () => {
      const rawStep = {
        stepNumber: 1,
        action: AlgorithmAction.INITIALIZE,
      };

      const pres = formatStep(rawStep);
      expect(pres).toBeDefined();
      expect(pres.stepNumber).toBe(1);
      expect(pres.description).toBe('');
      expect(pres.formula).toBeNull();
      expect(pres.highlights).toEqual({ nodes: [], edges: [] });
      expect(pres.activeLines).toEqual([]);
      expect(pres.table).toBeNull();
      expect(pres.pqPills).toBeNull();
    });

    it('does not mutate input step, state, highlights, or context objects', () => {
      const rawStep = Object.freeze({
        stepNumber: 1,
        action: AlgorithmAction.SELECT_NODE,
        description: 'Test step',
        state: Object.freeze({ dist: Object.freeze({ A: 0 }) }),
        highlights: Object.freeze({
          nodes: Object.freeze(['A']),
          edges: Object.freeze([]),
        }),
      });

      const context = Object.freeze({
        algorithmKey: 'dijkstra',
        language: 'vi',
      });

      expect(() => {
        const pres = formatStep(rawStep, null, context);
        expect(pres.stepNumber).toBe(1);
      }).not.toThrow();
    });

    it('defensively copies highlights so caller modifications do not affect returned model', () => {
      const nodes = ['A'];
      const rawStep = {
        stepNumber: 1,
        action: AlgorithmAction.SELECT_NODE,
        highlights: { nodes, edges: [] },
      };

      const pres = formatStep(rawStep);
      pres.highlights.nodes.push('B');

      expect(nodes).toEqual(['A']);
    });

    it('operates in a strictly headless environment without window or document', () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');

      const pres = formatStep({
        stepNumber: 1,
        action: AlgorithmAction.INITIALIZE,
      });
      expect(pres).toBeDefined();
    });
  });
});
