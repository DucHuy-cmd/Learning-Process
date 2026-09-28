/**
 * @file AlgorithmRegistry.test.js
 * Comprehensive unit tests for Phase 3A: AlgorithmRegistry
 *
 * Verifies:
 * - 5 algorithms execution
 * - Canonical dispatch
 * - Case normalization [NEW-APPLICATION-CONTRACT]
 * - Whitespace normalization [NEW-APPLICATION-CONTRACT]
 * - Canonical vs alias precedence (startNodeId > start, endNodeId > end > target, wantCycle > mode)
 * - Invalid/non-string key error boundary (TypeError)
 * - Unknown key error boundary (Error)
 * - Invalid graph/node/options delegated to core engines without throwing
 * - Native AlgorithmResult preserved intact (no wrapper, no cloning)
 * - Unexpected engine exceptions propagate
 * - Input immutability (graph and frozen options)
 * - Headless, zero DOM dependency
 * - Full metadata contracts and registry API methods
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AlgorithmRegistry,
  run,
  getMetadata,
  getAllMetadata,
  getSupportedKeys,
  has,
  normalizeKey,
} from '../../src/app/algorithms/AlgorithmRegistry.js';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus } from '../../src/core/models/Types.js';

/**
 * Helper to build a standard connected undirected weighted graph:
 *   A --(1)-- B --(2)-- C --(3)-- D
 *    \        /
 *    (4)    (5)
 *      \    /
 *        E
 */
function createStandardUndirectedGraph() {
  const g = new Graph({ directed: false, weighted: true });
  g.addNode('A');
  g.addNode('B');
  g.addNode('C');
  g.addNode('D');
  g.addNode('E');

  g.addEdge('A', 'B', 1);
  g.addEdge('B', 'C', 2);
  g.addEdge('C', 'D', 3);
  g.addEdge('A', 'E', 4);
  g.addEdge('B', 'E', 5);
  return g;
}

/**
 * Helper to build a standard directed graph:
 *   A ->(2)-> B ->(3)-> C
 *   ^         |
 *   |-(1)-----v
 *        D <-(4)
 */
function createStandardDirectedGraph() {
  const g = new Graph({ directed: true, weighted: true });
  g.addNode('A');
  g.addNode('B');
  g.addNode('C');
  g.addNode('D');

  g.addEdge('A', 'B', 2);
  g.addEdge('B', 'C', 3);
  g.addEdge('B', 'D', 4);
  g.addEdge('D', 'A', 1);
  return g;
}

describe('Phase 3A: AlgorithmRegistry', () => {
  // =========================================================================
  // SUITE 1: KEY NORMALIZATION & VALIDATION
  // =========================================================================
  describe('Suite 1: Key Normalization & Validation', () => {
    it('getSupportedKeys returns the exact 5 canonical keys', () => {
      const keys = getSupportedKeys();
      expect(keys).toEqual(['dijkstra', 'kruskal', 'prim', 'euler', 'hamilton']);
      expect(AlgorithmRegistry.getSupportedKeys()).toEqual(keys);
    });

    it('normalizeKey trims whitespace and converts to lowercase', () => {
      expect(normalizeKey('  dijkstra  ')).toBe('dijkstra');
      expect(normalizeKey('PRIM')).toBe('prim');
      expect(normalizeKey('\tKruskal\n')).toBe('kruskal');
      expect(normalizeKey('Euler')).toBe('euler');
      expect(normalizeKey('   HAMILTON   ')).toBe('hamilton');
    });

    it('normalizeKey throws TypeError on non-string inputs', () => {
      expect(() => normalizeKey(null)).toThrow(TypeError);
      expect(() => normalizeKey(undefined)).toThrow(TypeError);
      expect(() => normalizeKey(123)).toThrow(TypeError);
      expect(() => normalizeKey({})).toThrow(TypeError);
      expect(() => normalizeKey(['dijkstra'])).toThrow(TypeError);
      expect(() => normalizeKey(true)).toThrow(TypeError);
      expect(() => normalizeKey(Symbol('dijkstra'))).toThrow(TypeError);
    });

    it('has() returns true for supported keys including mixed-case and whitespace', () => {
      expect(has('dijkstra')).toBe(true);
      expect(has('DIJKSTRA')).toBe(true);
      expect(has('  kruskal  ')).toBe(true);
      expect(has('Prim')).toBe(true);
      expect(has('EULER')).toBe(true);
      expect(has('Hamilton')).toBe(true);
    });

    it('has() returns false for unsupported keys or non-strings', () => {
      expect(has('bfs')).toBe(false);
      expect(has('dfs')).toBe(false);
      expect(has('bellman-ford')).toBe(false);
      expect(has('floyd-warshall')).toBe(false);
      expect(has('')).toBe(false);
      expect(has(null)).toBe(false);
      expect(has(undefined)).toBe(false);
      expect(has(123)).toBe(false);
      expect(has({})).toBe(false);
    });

    it('run() throws TypeError on non-string algoKey', () => {
      const g = createStandardUndirectedGraph();
      expect(() => run(null, g)).toThrow(TypeError);
      expect(() => run(undefined, g)).toThrow(TypeError);
      expect(() => run(42, g)).toThrow(TypeError);
      expect(() => run({}, g)).toThrow(TypeError);
      expect(() => run([], g)).toThrow(TypeError);
      expect(() => run(false, g)).toThrow(TypeError);
    });

    it('run() throws Error on unknown algorithm key', () => {
      const g = createStandardUndirectedGraph();
      expect(() => run('unknown_algo', g)).toThrow(Error);
      expect(() => run('bfs', g)).toThrow(/Unknown algorithm/);
      expect(() => run('bellman-ford', g)).toThrow(/Supported algorithms/);
    });
  });

  // =========================================================================
  // SUITE 2: METADATA ACCESS
  // =========================================================================
  describe('Suite 2: Metadata Access', () => {
    it('getMetadata returns accurate metadata for each algorithm', () => {
      const dijkstraMeta = getMetadata('dijkstra');
      expect(dijkstraMeta).toBeDefined();
      expect(dijkstraMeta.key).toBe('dijkstra');
      expect(dijkstraMeta.requiresStartNode).toBe(true);
      expect(dijkstraMeta.supportsTargetNode).toBe(true);
      expect(dijkstraMeta.requiresUndirected).toBe(false);

      const kruskalMeta = getMetadata('kruskal');
      expect(kruskalMeta.key).toBe('kruskal');
      expect(kruskalMeta.requiresStartNode).toBe(false);
      expect(kruskalMeta.supportsTargetNode).toBe(false);
      expect(kruskalMeta.requiresUndirected).toBe(true);

      const primMeta = getMetadata('prim');
      expect(primMeta.key).toBe('prim');
      expect(primMeta.requiresStartNode).toBe(false);
      expect(primMeta.supportsTargetNode).toBe(false);
      expect(primMeta.requiresUndirected).toBe(true);

      const eulerMeta = getMetadata('euler');
      expect(eulerMeta.key).toBe('euler');
      expect(eulerMeta.requiresStartNode).toBe(false);
      expect(eulerMeta.requiresUndirected).toBe(false);

      const hamiltonMeta = getMetadata('hamilton');
      expect(hamiltonMeta.key).toBe('hamilton');
      expect(hamiltonMeta.requiresStartNode).toBe(false);
      expect(hamiltonMeta.requiresUndirected).toBe(false);
    });

    it('getMetadata accepts case-insensitive and whitespace-padded keys', () => {
      expect(getMetadata('  DIJKSTRA  ').key).toBe('dijkstra');
      expect(getMetadata('Kruskal').key).toBe('kruskal');
      expect(getMetadata('pRiM').key).toBe('prim');
    });

    it('getMetadata returns null for unknown keys or non-strings', () => {
      expect(getMetadata('nonexistent')).toBeNull();
      expect(getMetadata(null)).toBeNull();
      expect(getMetadata(123)).toBeNull();
    });

    it('getAllMetadata returns all 5 algorithm metadata objects', () => {
      const all = getAllMetadata();
      expect(all).toHaveLength(5);
      const keys = all.map((m) => m.key);
      expect(keys).toEqual(['dijkstra', 'kruskal', 'prim', 'euler', 'hamilton']);
    });
  });

  // =========================================================================
  // SUITE 3: CANONICAL DISPATCH FOR ALL 5 ALGORITHMS
  // =========================================================================
  describe('Suite 3: Canonical Dispatch for All 5 Algorithms', () => {
    it('dispatches Dijkstra and finds shortest path with canonical startNodeId and endNodeId', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, { startNodeId: 'A', endNodeId: 'D' });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.algorithm).toBe('dijkstra');
      expect(result.path).toEqual(['A', 'B', 'C', 'D']);
      expect(result.totalWeight).toBe(6);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('dispatches Kruskal and computes MST', () => {
      const g = createStandardUndirectedGraph();
      const result = run('kruskal', g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.algorithm).toBe('kruskal');
      expect(result.edges).toHaveLength(4);
      expect(result.totalWeight).toBe(10); // A-B(1) + B-C(2) + C-D(3) + A-E(4) = 10
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('dispatches Prim and computes MST with canonical startNodeId', () => {
      const g = createStandardUndirectedGraph();
      const result = run('prim', g, { startNodeId: 'A' });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.algorithm).toBe('prim');
      expect(result.edges).toHaveLength(4);
      expect(result.totalWeight).toBe(10);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('dispatches Euler and computes circuit or trail with canonical startNodeId', () => {
      // Create a simple Eulerian circuit graph (triangle A-B-C-A)
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 1);
      g.addEdge('B', 'C', 1);
      g.addEdge('C', 'A', 1);

      const result = run('euler', g, { startNodeId: 'A' });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.hasCircuit).toBe(true);
      expect(result.circuit).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('dispatches Hamilton with canonical startNodeId and wantCycle', () => {
      // Create a 4-cycle graph: A-B-C-D-A
      const g = new Graph({ directed: false, weighted: false });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addNode('D');
      g.addEdge('A', 'B');
      g.addEdge('B', 'C');
      g.addEdge('C', 'D');
      g.addEdge('D', 'A');

      const result = run('hamilton', g, { startNodeId: 'A', wantCycle: true });

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.found).toBe(true);
      expect(result.closesCycle).toBe(true);
      expect(result.resultPath).toHaveLength(4);
      expect(result.resultPath[0]).toBe('A');
      expect(new Set(result.resultPath).size).toBe(4);
    });
  });

  // =========================================================================
  // SUITE 4: OPTION PRECEDENCE & ALIAS RESOLUTION
  // =========================================================================
  describe('Suite 4: Option Precedence & Alias Resolution', () => {
    it('Dijkstra: canonical startNodeId strictly overrides alias start', () => {
      const g = createStandardUndirectedGraph();
      // startNodeId: 'A' should override start: 'D'
      const result = run('dijkstra', g, {
        startNodeId: 'A',
        start: 'D',
        endNodeId: 'B',
      });

      expect(result.path[0]).toBe('A');
      expect(result.path[result.path.length - 1]).toBe('B');
      expect(result.totalWeight).toBe(1);
    });

    it('Dijkstra: alias start is utilized when canonical startNodeId is omitted', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, { start: 'D', endNodeId: 'C' });

      expect(result.path[0]).toBe('D');
      expect(result.path[result.path.length - 1]).toBe('C');
      expect(result.totalWeight).toBe(3);
    });

    it('Dijkstra: canonical endNodeId strictly overrides aliases end and target', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, {
        startNodeId: 'A',
        endNodeId: 'C',
        end: 'D',
        target: 'E',
      });

      expect(result.path[result.path.length - 1]).toBe('C');
    });

    it('Dijkstra: alias end strictly overrides alias target when endNodeId is omitted', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, {
        startNodeId: 'A',
        end: 'C',
        target: 'E',
      });

      expect(result.path[result.path.length - 1]).toBe('C');
    });

    it('Dijkstra: alias target is utilized when endNodeId and end are omitted', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, {
        startNodeId: 'A',
        target: 'E',
      });

      expect(result.path[result.path.length - 1]).toBe('E');
      expect(result.totalWeight).toBe(4);
    });

    it('Prim: canonical startNodeId overrides alias start', () => {
      const g = createStandardUndirectedGraph();
      const resultCanonical = run('prim', g, { startNodeId: 'E', start: 'A' });
      expect(resultCanonical.steps[0].highlights.nodes).toContain('E');
      expect(resultCanonical.steps[0].highlights.nodes).not.toContain('A');
    });

    it('Euler: canonical startNodeId overrides alias start', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 1);
      g.addEdge('B', 'C', 1);
      g.addEdge('C', 'A', 1);

      const result = run('euler', g, { startNodeId: 'B', start: 'A' });
      expect(result.circuit[0]).toBe('B');
    });

    it('Hamilton: canonical wantCycle boolean strictly overrides alias mode', () => {
      // Line graph: A - B - C - D (has Hamiltonian path, but NO cycle)
      const g = new Graph({ directed: false, weighted: false });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addNode('D');
      g.addEdge('A', 'B');
      g.addEdge('B', 'C');
      g.addEdge('C', 'D');

      // wantCycle: false overrides mode: 'cycle'
      const resultPath = run('hamilton', g, {
        startNodeId: 'A',
        wantCycle: false,
        mode: 'cycle',
      });
      expect(resultPath.found).toBe(true);
      expect(resultPath.closesCycle).toBe(false);
      expect(resultPath.resultPath).toEqual(['A', 'B', 'C', 'D']);

      // wantCycle: true overrides mode: 'path'
      const resultCycle = run('hamilton', g, {
        startNodeId: 'A',
        wantCycle: true,
        mode: 'path',
      });
      // There is no Hamiltonian cycle in a simple line graph
      expect(resultCycle.found).toBe(false);
    });

    it('Hamilton: mode === "path" resolves wantCycle to false when wantCycle is omitted', () => {
      const g = new Graph({ directed: false, weighted: false });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B');
      g.addEdge('B', 'C');

      const result = run('hamilton', g, { startNodeId: 'A', mode: 'path' });
      expect(result.found).toBe(true);
      expect(result.closesCycle).toBe(false);
      expect(result.resultPath).toEqual(['A', 'B', 'C']);
    });

    it('Hamilton: mode === "cycle" resolves wantCycle to true when wantCycle is omitted', () => {
      const g = new Graph({ directed: false, weighted: false });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B');
      g.addEdge('B', 'C');

      const result = run('hamilton', g, { startNodeId: 'A', mode: 'cycle' });
      // Line graph cannot form a cycle
      expect(result.found).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 5: DUCK TYPING & DELEGATED ERROR HANDLING
  // =========================================================================
  describe('Suite 5: Duck Typing & Delegated Error Handling', () => {
    it('executes successfully on duck-typed graph model without requiring instanceof Graph', () => {
      // Minimal duck-typed graph for Dijkstra: hasNode and getNeighbors
      const duckGraph = {
        hasNode: (id) => ['X', 'Y'].includes(id),
        getNeighbors: (id) => {
          if (id === 'X') {
            return [{ nodeId: 'Y', weight: 7, edgeId: 'X-Y' }];
          }
          return [];
        },
      };

      const result = run('dijkstra', duckGraph, { startNodeId: 'X', endNodeId: 'Y' });
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['X', 'Y']);
      expect(result.totalWeight).toBe(7);
    });

    it('delegates invalid graph (null) to engine and returns INVALID_INPUT without throwing', () => {
      const resultDijkstra = run('dijkstra', null, { startNodeId: 'A' });
      expect(resultDijkstra.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const resultKruskal = run('kruskal', null);
      expect(resultKruskal.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const resultPrim = run('prim', null);
      expect(resultPrim.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const resultEuler = run('euler', null);
      expect(resultEuler.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const resultHamilton = run('hamilton', null);
      expect(resultHamilton.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });

    it('delegates invalid/missing start node to engine and returns INVALID_INPUT without throwing', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, { startNodeId: 'NON_EXISTENT_NODE' });
      expect(result.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });

    it('delegates directed graph to Kruskal and returns UNSUPPORTED without throwing', () => {
      const directedGraph = createStandardDirectedGraph();
      const result = run('kruskal', directedGraph);
      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.error || result.message).toMatch(/undirected/i);
    });

    it('delegates directed graph to Prim and returns UNSUPPORTED without throwing', () => {
      const directedGraph = createStandardDirectedGraph();
      const result = run('prim', directedGraph, { startNodeId: 'A' });
      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.error || result.message).toMatch(/undirected/i);
    });
  });

  // =========================================================================
  // SUITE 6: NATIVE RESULT PRESERVATION & ERROR PROPAGATION
  // =========================================================================
  describe('Suite 6: Native Result Preservation & Error Propagation', () => {
    it('returns the exact unmutated, unwrapped native AlgorithmResult from the core engine', () => {
      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, { startNodeId: 'A', endNodeId: 'B' });

      // Verifies engine structure is completely intact
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('algorithm', 'dijkstra');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('distances');
      expect(result).toHaveProperty('statistics');
      // No extra outer wrapping like { data: result }
      expect(result.data).toBeUndefined();
    });

    it('propagates unexpected engine runtime exceptions without swallowing', () => {
      // A buggy duck-typed graph whose method throws an unexpected Error
      const explodingGraph = {
        hasNode: () => true,
        getNeighbors: () => {
          throw new Error('Unexpected internal engine failure');
        },
      };

      expect(() => {
        run('dijkstra', explodingGraph, { startNodeId: 'A' });
      }).toThrow('Unexpected internal engine failure');
    });
  });

  // =========================================================================
  // SUITE 7: INPUT IMMUTABILITY & HEADLESS PURITY
  // =========================================================================
  describe('Suite 7: Input Immutability & Headless Purity', () => {
    it('does not mutate input options object, even if frozen', () => {
      const g = createStandardUndirectedGraph();
      const frozenOptions = Object.freeze({
        startNodeId: 'A',
        endNodeId: 'D',
        start: 'B',
        mode: 'path',
      });

      expect(() => {
        const result = run('dijkstra', g, frozenOptions);
        expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      }).not.toThrow();
    });

    it('does not mutate the input graph instance', () => {
      const g = createStandardUndirectedGraph();
      const nodeCountBefore = g.nodeCount;
      const edgeCountBefore = g.edgeCount;

      run('dijkstra', g, { startNodeId: 'A', endNodeId: 'B' });
      run('kruskal', g);
      run('prim', g, { startNodeId: 'A' });

      expect(g.nodeCount).toBe(nodeCountBefore);
      expect(g.edgeCount).toBe(edgeCountBefore);
    });

    it('operates in a strictly headless environment with zero DOM dependencies', () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');

      const g = createStandardUndirectedGraph();
      const result = run('dijkstra', g, { startNodeId: 'A' });
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    });
  });

  // =========================================================================
  // SUITE 8: STATIC CLASS API COMPATIBILITY
  // =========================================================================
  describe('Suite 8: Static Class API Compatibility', () => {
    it('supports AlgorithmRegistry static class methods identically to named exports', () => {
      const g = createStandardUndirectedGraph();
      expect(AlgorithmRegistry.has('dijkstra')).toBe(true);
      expect(AlgorithmRegistry.normalizeKey('  PRIM  ')).toBe('prim');
      expect(AlgorithmRegistry.getSupportedKeys()).toEqual(getSupportedKeys());
      expect(AlgorithmRegistry.getMetadata('kruskal')).toEqual(getMetadata('kruskal'));
      expect(AlgorithmRegistry.getAllMetadata()).toEqual(getAllMetadata());

      const res = AlgorithmRegistry.run('dijkstra', g, { startNodeId: 'A', endNodeId: 'B' });
      expect(res.status).toBe(AlgorithmStatus.SUCCESS);
    });
  });
});
