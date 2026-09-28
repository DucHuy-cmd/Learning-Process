import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';
import { kruskal, KruskalEngine } from '../../src/core/algorithms/KruskalEngine.js';
import sampleUndirected from '../fixtures/kruskal/sample-undirected.json';
import sampleDirected from '../fixtures/kruskal/sample-directed.json';
import expectedMst from '../fixtures/expected/kruskal-mst.json';

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

describe('KruskalEngine Headless Core', () => {
  describe('Standard MST & Cycle Detection', () => {
    it('1. - 3. computes correct MST on standard connected graph with correct total weight and edges', () => {
      // 4 nodes: A, B, C, D
      // Edges:
      // A-B: 1
      // B-C: 2
      // B-D: 3
      // A-C: 4 (cycle)
      // C-D: 5 (cycle)
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1, 'e_ab');
      g.addEdge('B', 'C', 2, 'e_bc');
      g.addEdge('B', 'D', 3, 'e_bd');
      g.addEdge('A', 'C', 4, 'e_ac');
      g.addEdge('C', 'D', 5, 'e_cd');

      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(true);
      expect(result.totalWeight).toBe(6);
      expect(result.edges.length).toBe(3);
      expect(result.edgeIds).toEqual(['e_ab', 'e_bc', 'e_bd']);
    });

    it('4. correctly rejects edges that form cycles', () => {
      // Triangle graph A-B, B-C, C-A (weights: 1, 2, 3)
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1, 'e1');
      g.addEdge('B', 'C', 2, 'e2');
      g.addEdge('A', 'C', 3, 'e3');

      const result = kruskal(g);
      expect(result.edges.map(e => e.id)).toEqual(['e1', 'e2']);
      expect(result.statistics.edgesRejected).toBe(1);

      // Verify REJECT_EDGE step for e3
      const rejectSteps = result.steps.filter(s => s.action === AlgorithmAction.REJECT_EDGE);
      expect(rejectSteps.length).toBe(1);
      expect(rejectSteps[0].highlights.edges).toContain('e3');
    });
  });

  describe('Graph Topologies & Connectivity', () => {
    it('5. handles disconnected graph by producing a minimum spanning forest', () => {
      // Component 1: A-B (w=2)
      // Component 2: C-D (w=3)
      // Isolated node: E
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C', 'D', 'E'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 2);
      g.addEdge('C', 'D', 3);

      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.PARTIAL);
      expect(result.connected).toBe(false);
      expect(result.totalWeight).toBe(5);
      expect(result.edges.length).toBe(2);
      expect(result.components.length).toBe(3); // {A,B}, {C,D}, {E}
      expect(result.statistics.components).toBe(3);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('6. rejects directed graphs with UNSUPPORTED status', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = kruskal(g);
      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.message).toContain('undirected');
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });

    it('7. processes equal-weight edges strictly in insertion order (legacy-compatible stable sort)', () => {
      // Graph with 3 nodes X, Y, Z forming a triangle cycle with identical weights of 1.0.
      // Insertion order: Z-Y, then Y-X, then X-Z.
      // Under legacy-compatible stable insertion order:
      //   1. Z-Y is inspected and accepted into MST.
      //   2. Y-X is inspected and accepted into MST.
      //   3. X-Z is inspected and rejected as a cycle.
      // If a lexical tie-breaker (e.g., from/to localeCompare) were applied,
      // edges starting with X (X-Z, X-Y) would be processed first, and Z-Y would be rejected instead.
      const g = new Graph({ directed: false, weighted: true });
      ['X', 'Y', 'Z'].forEach(id => g.addNode(id));
      g.addEdge('Z', 'Y', 1, 'edge_ZY');
      g.addEdge('Y', 'X', 1, 'edge_YX');
      g.addEdge('X', 'Z', 1, 'edge_XZ');

      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(2);
      expect(result.edgeIds).toEqual(['edge_ZY', 'edge_YX']);
      expect(result.statistics.edgesAccepted).toBe(2);
      expect(result.statistics.edgesRejected).toBe(1);

      // Verify exact rejected edge is edge_XZ (not edge_ZY)
      const rejectSteps = result.steps.filter(s => s.action === AlgorithmAction.REJECT_EDGE);
      expect(rejectSteps).toHaveLength(1);
      expect(rejectSteps[0].highlights.edges).toContain('edge_XZ');

      // Verify accepted edge sequence matches insertion order
      const acceptSteps = result.steps.filter(s => s.action === AlgorithmAction.ACCEPT_EDGE);
      expect(acceptSteps).toHaveLength(2);
      expect(acceptSteps[0].highlights.edges).toContain('edge_ZY');
      expect(acceptSteps[1].highlights.edges).toContain('edge_YX');
    });

    it('7b. resolves equal-weight edges deterministically across runs', () => {
      // 4 nodes in a square with equal weights of 2
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 2, 'e1');
      g.addEdge('B', 'C', 2, 'e2');
      g.addEdge('C', 'D', 2, 'e3');
      g.addEdge('D', 'A', 2, 'e4');

      const result1 = kruskal(g);
      const result2 = kruskal(g);

      expect(result1.edgeIds).toEqual(result2.edgeIds);
      expect(result1.edges.length).toBe(3);
      expect(result1.totalWeight).toBe(6);
    });

    it('8. handles zero-weight edges properly', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 0, 'e0');
      g.addEdge('B', 'C', 5, 'e5');

      const result = kruskal(g);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(5);
      expect(result.edgeIds).toEqual(['e0', 'e5']);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('9. rejects invalid non-numeric weights', () => {
      const g = {
        isDirected: false,
        hasNode: () => true,
        getEdges: () => [{ id: 'e_bad', from: 'A', to: 'B', weight: NaN }],
      };

      const result = kruskal(g);
      expect(result.status).toBe(AlgorithmStatus.INVALID_INPUT);
      expect(result.message).toContain('Invalid edge weight');
    });

    it('10. handles empty graph gracefully', () => {
      const g = new Graph({ directed: false, weighted: true });
      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
      expect(result.connected).toBe(true);
    });

    it('11. handles single-node graph gracefully', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('SOLO');

      const result = kruskal(g);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
      expect(result.connected).toBe(true);
      expect(result.components).toEqual([['SOLO']]);
    });

    it('validates missing or invalid graph argument', () => {
      const result = kruskal(null);
      expect(result.status).toBe(AlgorithmStatus.INVALID_INPUT);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Step Generation & Replay Snapshots', () => {
    it('12. - 17. generates standard INITIALIZE, INSPECT_EDGE, ACCEPT_EDGE, REJECT_EDGE, and FINISH steps', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1, 'e1');
      g.addEdge('B', 'C', 2, 'e2');
      g.addEdge('A', 'C', 3, 'e3');

      const result = kruskal(g);
      const actions = result.steps.map(s => s.action);

      expect(actions[0]).toBe(AlgorithmAction.INITIALIZE);
      expect(actions).toContain(AlgorithmAction.INSPECT_EDGE);
      expect(actions).toContain(AlgorithmAction.ACCEPT_EDGE);
      expect(actions).toContain(AlgorithmAction.REJECT_EDGE);
      expect(actions[actions.length - 1]).toBe(AlgorithmAction.FINISH);
    });

    it('18. state snapshots are fully independent and immutable to future step executions', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1);
      g.addEdge('B', 'C', 2);

      const result = kruskal(g);
      const initStep = result.steps[0];
      const finishStep = result.steps[result.steps.length - 1];

      // Initial state should have 0 accepted edges even after algorithm finished
      expect(initStep.state.acceptedEdges).toEqual([]);
      expect(initStep.state.totalWeight).toBe(0);
      expect(finishStep.state.acceptedEdges.length).toBe(2);
      expect(finishStep.state.totalWeight).toBe(3);
    });

    it('19. Graph is not mutated (zero properties attached to graph or nodes)', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 10);

      const nodesBefore = JSON.stringify(g.getNodes());
      const edgesBefore = JSON.stringify(g.getEdges());

      kruskal(g);

      expect(JSON.stringify(g.getNodes())).toBe(nodesBefore);
      expect(JSON.stringify(g.getEdges())).toBe(edgesBefore);
      expect(g.mst).toBeUndefined();
      expect(g.parent).toBeUndefined();
      expect(g.getNode('A').parent).toBeUndefined();
    });

    it('20. output is strictly deterministic across multiple runs and classes', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['1', '2', '3', '4'].forEach(id => g.addNode(id));
      g.addEdge('1', '2', 4);
      g.addEdge('2', '3', 1);
      g.addEdge('3', '4', 2);
      g.addEdge('1', '4', 3);

      const resFunc = kruskal(g);
      const resClass = new KruskalEngine(g).run();

      expect(resFunc.edgeIds).toEqual(resClass.edgeIds);
      expect(resFunc.totalWeight).toBe(resClass.totalWeight);
      expect(resFunc.statistics).toEqual(resClass.statistics);
      expect(resFunc.steps.length).toBe(resClass.steps.length);
    });
  });

  describe('Statistics and Result Structure', () => {
    it('21. & 22. provides complete statistics and Types.js compatible result schema', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1);
      g.addEdge('B', 'C', 2);
      g.addEdge('A', 'C', 3);

      const result = kruskal(g);
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('type', 'kruskal');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('edgeIds');
      expect(result).toHaveProperty('totalWeight', 3);
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('warnings');

      const stats = result.statistics;
      expect(stats.edgeCount).toBe(3);
      expect(stats.edgesInspected).toBe(3);
      expect(stats.edgesAccepted).toBe(2);
      expect(stats.edgesRejected).toBe(1);
      expect(stats.unionOperations).toBe(2);
      expect(stats.components).toBe(1);
      expect(stats.totalWeight).toBe(3);
    });
  });

  describe('Part 23: Golden Master Characterization Fixtures', () => {
    it('characterizes sample undirected graph fixture (MST weight = 6.0, 3 accepted edges, 2 rejected cycles)', () => {
      const g = fixtureToGraph(sampleUndirected);
      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(expectedMst.connected);
      expect(result.totalWeight).toBe(expectedMst.expectedTotalWeight);
      expect(result.edges.length).toBe(expectedMst.expectedMstEdgeCount);

      // Verify accepted edge weights match expected [1.0, 2.0, 3.0]
      const acceptedWeights = result.edges.map(e => e.weight).sort((a, b) => a - b);
      expect(acceptedWeights).toEqual([1.0, 2.0, 3.0]);

      // 5 total edges - 3 accepted = 2 rejected
      expect(result.statistics.edgesRejected).toBe(2);
      expect(result.statistics.edgesAccepted).toBe(3);
    });

    it('characterizes sample directed graph fixture (gracefully unsupported)', () => {
      const g = fixtureToGraph(sampleDirected);
      const result = kruskal(g);

      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.connected).toBe(false);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });
  });
});
