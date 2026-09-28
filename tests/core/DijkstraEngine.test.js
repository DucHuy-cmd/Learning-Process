import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';
import { dijkstra } from '../../src/core/algorithms/DijkstraEngine.js';
import textbookFixture from '../fixtures/dijkstra/textbook-undirected.json';
import directedFixture from '../fixtures/dijkstra/directed-sample.json';

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

describe('DijkstraEngine Headless Core', () => {
  describe('Basic Graph Routing & Topology', () => {
    it('1. simple shortest path between adjacent nodes', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = dijkstra(g, 'A', 'B');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A', 'B']);
      expect(result.totalWeight).toBe(5);
    });

    it('2. multi-hop shortest path (A -> B -> C)', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 3);
      g.addEdge('B', 'C', 4);

      const result = dijkstra(g, 'A', 'C');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A', 'B', 'C']);
      expect(result.totalWeight).toBe(7);
      expect(result.edges.length).toBe(2);
    });

    it('3. alternative longer route is avoided (Greedy selection)', () => {
      // Direct edge is expensive (10), 2-hop route is cheaper (1 + 2 = 3)
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 1);
      g.addEdge('B', 'C', 2);
      g.addEdge('A', 'C', 10);

      const result = dijkstra(g, 'A', 'C');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A', 'B', 'C']);
      expect(result.totalWeight).toBe(3);
    });

    it('4. directed graph respects one-way edge orientations', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('X');
      g.addNode('Y');
      g.addEdge('X', 'Y', 5);

      const forward = dijkstra(g, 'X', 'Y');
      expect(forward.status).toBe(AlgorithmStatus.SUCCESS);
      expect(forward.path).toEqual(['X', 'Y']);
      expect(forward.totalWeight).toBe(5);

      const backward = dijkstra(g, 'Y', 'X');
      expect(backward.status).toBe(AlgorithmStatus.UNREACHABLE);
      expect(backward.path).toEqual([]);
      expect(backward.totalWeight).toBeNull();
    });

    it('5. undirected graph allows traversal in both directions', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('M');
      g.addNode('N');
      g.addEdge('M', 'N', 7.5);

      const mToN = dijkstra(g, 'M', 'N');
      expect(mToN.status).toBe(AlgorithmStatus.SUCCESS);
      expect(mToN.path).toEqual(['M', 'N']);
      expect(mToN.totalWeight).toBe(7.5);

      const nToM = dijkstra(g, 'N', 'M');
      expect(nToM.status).toBe(AlgorithmStatus.SUCCESS);
      expect(nToM.path).toEqual(['N', 'M']);
      expect(nToM.totalWeight).toBe(7.5);
    });
  });

  describe('Edge Cases and Input Validation', () => {
    it('6. unreachable target returns UNREACHABLE with empty path', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('ISOLATED');
      g.addEdge('A', 'B', 2);

      const result = dijkstra(g, 'A', 'ISOLATED');
      expect(result.status).toBe(AlgorithmStatus.UNREACHABLE);
      expect(result.path).toEqual([]);
      expect(result.totalWeight).toBeNull();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('7. start == target completes immediately with cost 0 and path [start]', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 10);

      const result = dijkstra(g, 'A', 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A']);
      expect(result.totalWeight).toBe(0);
      expect(result.edges).toEqual([]);
      expect(result.statistics.visitedCount).toBe(1);
    });

    it('8. zero-weight edge is handled correctly', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');
      g.addEdge('A', 'B', 0);
      g.addEdge('B', 'C', 4);

      const result = dijkstra(g, 'A', 'C');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['A', 'B', 'C']);
      expect(result.totalWeight).toBe(4);
    });

    it('9. negative edge weights are rejected with UNSUPPORTED status', () => {
      const g = new Graph({ directed: false, weighted: false });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', -3);

      const result = dijkstra(g, 'A', 'B');
      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.message).toContain('negative edge weights');
      expect(result.path).toEqual([]);
      expect(result.totalWeight).toBeNull();
    });

    it('validates non-existent start or target node', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');

      const noStart = dijkstra(g, 'UNKNOWN', 'A');
      expect(noStart.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const noTarget = dijkstra(g, 'A', 'UNKNOWN');
      expect(noTarget.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const badGraph = dijkstra(null, 'A', 'B');
      expect(badGraph.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });
  });

  describe('MinHeap Stale Entries and Path Reconstruction', () => {
    it('10. handles duplicate / stale heap candidates correctly via lazy deletion', () => {
      // In this diamond graph, node D is reached multiple times with different distances
      // S -> A (10) -> D (10 + 1 = 11)
      // S -> B (2) -> D (2 + 1 = 3)
      // The entry for D with distance 11 becomes stale when distance 3 is relaxed.
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('S');
      g.addNode('A');
      g.addNode('B');
      g.addNode('D');

      g.addEdge('S', 'A', 10);
      g.addEdge('A', 'D', 1);
      g.addEdge('S', 'B', 2);
      g.addEdge('B', 'D', 1);

      const result = dijkstra(g, 'S', 'D');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.path).toEqual(['S', 'B', 'D']);
      expect(result.totalWeight).toBe(3);
    });

    it('11. & 12. path reconstruction and total distance accuracy', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['P1', 'P2', 'P3', 'P4', 'P5'].forEach(n => g.addNode(n));
      g.addEdge('P1', 'P2', 2);
      g.addEdge('P2', 'P3', 3);
      g.addEdge('P3', 'P4', 4);
      g.addEdge('P4', 'P5', 5);

      const result = dijkstra(g, 'P1', 'P5');
      expect(result.path).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
      expect(result.totalWeight).toBe(14);
    });
  });

  describe('Step Generation & Snapshot Isolation', () => {
    it('13. - 17. generates standard INITIALIZE, SELECT_NODE, RELAX_EDGE steps', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = dijkstra(g, 'A', 'B');
      const actions = result.steps.map(s => s.action);

      expect(actions).toContain(AlgorithmAction.INITIALIZE);
      expect(actions).toContain(AlgorithmAction.SELECT_NODE);
      expect(actions).toContain(AlgorithmAction.RELAX_EDGE);
      expect(actions).toContain(AlgorithmAction.FINISH);

      // Verify Step 1 is INITIALIZE
      expect(result.steps[0].action).toBe(AlgorithmAction.INITIALIZE);
      expect(result.steps[0].state.dist['A']).toBe(0);
      expect(result.steps[0].state.dist['B']).toBe(Infinity);
    });

    it('18. state snapshots are fully independent and immutable to subsequent changes', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = dijkstra(g, 'A', 'B');
      const initStep = result.steps[0];
      const finishStep = result.steps[result.steps.length - 1];

      // Initial step dist for B should still be Infinity even after algorithm relaxed it
      expect(initStep.state.dist['B']).toBe(Infinity);
      expect(finishStep.state.dist['B']).toBe(5);

      // Mutating result object does not affect internal step snapshots
      result.path.push('MUTATED');
      expect(finishStep.state.dist['B']).toBe(5);
    });

    it('19. Graph instance is not mutated (no dist/prev/visited properties attached)', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 10);

      const nodesBefore = JSON.stringify(g.getNodes());
      const edgesBefore = JSON.stringify(g.getEdges());

      dijkstra(g, 'A', 'B');

      expect(JSON.stringify(g.getNodes())).toBe(nodesBefore);
      expect(JSON.stringify(g.getEdges())).toBe(edgesBefore);
      expect(g.dist).toBeUndefined();
      expect(g.prev).toBeUndefined();
      expect(g.visited).toBeUndefined();
      expect(g.getNode('A').dist).toBeUndefined();
    });

    it('20. execution is strictly deterministic across runs', () => {
      const g = new Graph({ directed: true, weighted: true });
      ['1', '2', '3', '4'].forEach(id => g.addNode(id));
      g.addEdge('1', '2', 2);
      g.addEdge('1', '3', 5);
      g.addEdge('2', '3', 1);
      g.addEdge('3', '4', 3);

      const run1 = dijkstra(g, '1', '4');
      const run2 = dijkstra(g, '1', '4');

      expect(run1.path).toEqual(run2.path);
      expect(run1.totalWeight).toBe(run2.totalWeight);
      expect(run1.steps.length).toBe(run2.steps.length);
      expect(run1.statistics).toEqual(run2.statistics);
    });
  });

  describe('Part 20: Golden Master Characterization Comparison', () => {
    it('characterizes textbook undirected graph fixture (u -> w, cost = 9.0, path = u -> y -> z -> w)', () => {
      const g = fixtureToGraph(textbookFixture);
      const result = dijkstra(g, 'u', 'w');

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(9.0);
      expect(result.path).toEqual(['u', 'y', 'z', 'w']);
      expect(result.edges.length).toBe(3);
    });

    it('characterizes directed sample fixture (A -> D: cost = 8.0, path = A -> C -> B -> D)', () => {
      const g = fixtureToGraph(directedFixture);

      // Reachable scenario: A -> D
      const resultReachable = dijkstra(g, 'A', 'D');
      expect(resultReachable.status).toBe(AlgorithmStatus.SUCCESS);
      expect(resultReachable.totalWeight).toBe(8.0);
      expect(resultReachable.path).toEqual(['A', 'C', 'B', 'D']);

      // Unreachable scenario: D -> A (reverse in DAG)
      const resultUnreachable = dijkstra(g, 'D', 'A');
      expect(resultUnreachable.status).toBe(AlgorithmStatus.UNREACHABLE);
      expect(resultUnreachable.totalWeight).toBeNull();
      expect(resultUnreachable.path).toEqual([]);
    });
  });
});
