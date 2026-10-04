import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';
import { bellmanFord } from '../../src/core/algorithms/BellmanFordEngine.js';
import sampleNegativeFixture from '../fixtures/bellman-ford/sample-negative-weights.json';
import negativeCycleFixture from '../fixtures/bellman-ford/negative-cycle.json';

/**
 * Helper to convert fixture JSON into a Graph instance
 */
function fixtureToGraph(fixture) {
  const g = new Graph({ directed: Boolean(fixture.directed), weighted: true });
  for (const node of fixture.nodes) {
    g.addNode({ id: node.id || node.name, label: node.name || node.id });
  }
  for (const edge of fixture.edges) {
    if (Array.isArray(edge)) {
      g.addEdge(edge[0], edge[1], edge[2]);
    } else {
      const from = edge.from || edge.a || edge.u;
      const to = edge.to || edge.b || edge.v;
      const weight = edge.weight !== undefined ? edge.weight : (edge.w !== undefined ? edge.w : 1);
      g.addEdge(from, to, weight, edge.id);
    }
  }
  return g;
}

describe('BellmanFordEngine Headless Core', () => {
  describe('Basic Graph Routing & Topology', () => {
    it('1. computes shortest path on positive weighted graph', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 4);
      g.addEdge('A', 'C', 2);
      g.addEdge('C', 'B', 1);

      const result = bellmanFord(g, 'A', 'B');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A', 'C', 'B']);
      expect(result.totalWeight).toBe(3);
    });

    it('2. successfully handles negative edge weights without negative cycles', () => {
      const g = fixtureToGraph(sampleNegativeFixture);
      // S -> B (8) -> A (1, total 9) -> C (2, total 11) -> D (-2, total 9) -> T (3, total 12)
      // or S -> B (8) -> A (9) -> C (11) -> T (-1, total 10)
      const result = bellmanFord(g, 'S', 'T');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['S', 'B', 'A', 'C', 'T']);
      expect(result.totalWeight).toBe(10);
    });

    it('3. detects negative weight cycles and reports failure', () => {
      const g = fixtureToGraph(negativeCycleFixture);
      const result = bellmanFord(g, 'S', 'C');
      expect(result.status).toBe(AlgorithmStatus.FAILURE);
      expect(result.hasNegativeCycle).toBe(true);
      expect(result.negativeCycle.length).toBeGreaterThan(0);
      expect(result.steps.some(s => s.action === AlgorithmAction.ERROR)).toBe(true);
    });

    it('4. reports UNREACHABLE when destination cannot be reached', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 5);
      // C is isolated

      const result = bellmanFord(g, 'A', 'C');
      expect(result.status).toBe(AlgorithmStatus.UNREACHABLE);
      expect(result.path).toEqual([]);
      expect(result.totalWeight).toBeNull();
    });

    it('5. handles undirected graphs', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('X');
      g.addNode('Y');
      g.addNode('Z');
      g.addEdge('X', 'Y', 6);
      g.addEdge('Y', 'Z', 3);
      g.addEdge('X', 'Z', 12);

      const result = bellmanFord(g, 'X', 'Z');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['X', 'Y', 'Z']);
      expect(result.totalWeight).toBe(9);
    });

    it('6. handles start == target node', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = bellmanFord(g, 'A', 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A']);
      expect(result.totalWeight).toBe(0);
    });

    it('7. computes all-destinations distances when target is null', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 4);
      g.addEdge('A', 'C', 7);
      g.addEdge('B', 'C', 1);

      const result = bellmanFord(g, 'A', null);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.distances['A']).toBe(0);
      expect(result.distances['B']).toBe(4);
      expect(result.distances['C']).toBe(5);
    });
  });

  describe('Validation & Error Boundaries', () => {
    it('8. rejects invalid or null graph', () => {
      const res = bellmanFord(null, 'A');
      expect(res.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });

    it('9. rejects non-existent start node', () => {
      const g = new Graph();
      g.addNode('A');
      const res = bellmanFord(g, 'Z');
      expect(res.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });

    it('10. rejects non-existent target node', () => {
      const g = new Graph();
      g.addNode('A');
      const res = bellmanFord(g, 'A', 'Z');
      expect(res.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });
  });
});
