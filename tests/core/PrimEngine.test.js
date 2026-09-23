import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';
import { prim, PrimEngine } from '../../src/core/algorithms/PrimEngine.js';
import slideGraph from '../fixtures/prim/slide-x1-x8.json';
import sampleDirected from '../fixtures/prim/sample-directed.json';
import expectedPrim from '../fixtures/expected/prim-x1-x8.json';

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

describe('PrimEngine Headless Core', () => {
  describe('Standard MST & Edge Selection', () => {
    it('1. - 4. computes correct MST on basic connected graph with exact weight, edges, and edgeIds', () => {
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

      const result = prim(g, 'A');

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(true);
      expect(result.totalWeight).toBe(6);
      expect(result.edges.length).toBe(3);
      expect(result.edgeIds).toEqual(['e_ab', 'e_bc', 'e_bd']);
    });

    it('5. & 6. respects different starting vertices and produces valid MST', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 10, 'e1');
      g.addEdge('B', 'C', 20, 'e2');
      g.addEdge('A', 'C', 30, 'e3');

      // Start at A: accepts A-B, then B-C
      const resA = prim(g, 'A');
      expect(resA.totalWeight).toBe(30);
      expect(resA.edges.length).toBe(2);

      // Start at C: accepts C-B, then B-A
      const resC = prim(g, 'C');
      expect(resC.totalWeight).toBe(30);
      expect(resC.edges.length).toBe(2);
    });

    it('7. handles single vertex graph gracefully (0 edges, total weight = 0)', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('SOLO');

      const result = prim(g, 'SOLO');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
      expect(result.connected).toBe(true);
      expect(result.components).toEqual([['SOLO']]);
    });

    it('8. handles empty graph gracefully', () => {
      const g = new Graph({ directed: false, weighted: true });
      const result = prim(g);

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
      expect(result.connected).toBe(true);
      expect(result.components).toEqual([]);
    });
  });

  describe('Connectivity & Graph Variations', () => {
    it('9. handles disconnected graph by spanning only the reachable component of start node', () => {
      // Component 1: A-B (w=2)
      // Component 2: C-D (w=3)
      // Isolated node: E
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C', 'D', 'E'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 2, 'e_ab');
      g.addEdge('C', 'D', 3, 'e_cd');

      const result = prim(g, 'A');

      expect(result.status).toBe(AlgorithmStatus.PARTIAL);
      expect(result.connected).toBe(false);
      expect(result.totalWeight).toBe(2);
      expect(result.edges.length).toBe(1);
      expect(result.edgeIds).toEqual(['e_ab']);
      expect(result.components.length).toBe(3); // Component {A, B}, {C, D}, {E}
      expect(result.statistics.verticesVisited).toBe(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('10. rejects directed graphs with UNSUPPORTED status', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const result = prim(g, 'A');
      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.message).toContain('undirected');
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
      expect(result.connected).toBe(false);
    });

    it('11. handles zero-weight edges correctly', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 0, 'e0');
      g.addEdge('B', 'C', 4, 'e4');

      const result = prim(g, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(4);
      expect(result.edgeIds).toEqual(['e0', 'e4']);
    });

    it('12. handles negative-weight edges mathematically (valid in MST)', () => {
      const g = new Graph({ directed: false, weighted: false });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', -5, 'e_neg');
      g.addEdge('B', 'C', 2, 'e_pos');
      g.addEdge('A', 'C', 10, 'e_large');

      const result = prim(g, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(-3);
      expect(result.edgeIds).toEqual(['e_neg', 'e_pos']);
    });

    it('13. ignores self-loops and never includes them in MST', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B'].forEach(id => g.addNode(id));
      g.addEdge('A', 'A', 1, 'loop_a');
      g.addEdge('A', 'B', 3, 'edge_ab');

      const result = prim(g, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(3);
      expect(result.edgeIds).toEqual(['edge_ab']);
    });

    it('14. handles parallel edges by selecting the lower weight edge', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 10, 'e_heavy');
      g.addEdge('A', 'B', 2, 'e_light');

      const result = prim(g, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(2);
      expect(result.edgeIds).toEqual(['e_light']);
    });

    it('validates missing or invalid graph and start node arguments', () => {
      const badGraph = prim(null);
      expect(badGraph.status).toBe(AlgorithmStatus.INVALID_INPUT);

      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      const badStart = prim(g, 'NON_EXISTENT');
      expect(badStart.status).toBe(AlgorithmStatus.INVALID_INPUT);

      g.addNode('B');
      g.addEdge('A', 'B', NaN);
      const badWeight = prim(g, 'A');
      expect(badWeight.status).toBe(AlgorithmStatus.INVALID_INPUT);
    });
  });

  describe('Step Generation & Replay Snapshots', () => {
    it('15. - 20. generates standard INITIALIZE, SELECT_NODE, INSPECT_EDGE, ACCEPT_EDGE, and FINISH steps', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B', 'C'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 1, 'e1');
      g.addEdge('B', 'C', 2, 'e2');
      g.addEdge('A', 'C', 5, 'e3');

      const result = prim(g, 'A');
      const actions = result.steps.map(s => s.action);

      expect(actions[0]).toBe(AlgorithmAction.INITIALIZE);
      expect(actions).toContain(AlgorithmAction.SELECT_NODE);
      expect(actions).toContain(AlgorithmAction.INSPECT_EDGE);
      expect(actions).toContain(AlgorithmAction.ACCEPT_EDGE);
      expect(actions[actions.length - 1]).toBe(AlgorithmAction.FINISH);

      // Verify Step 0 / INITIALIZE state
      const initStep = result.steps[0];
      expect(initStep.state.key['A']).toBe(0);
      expect(initStep.state.key['B']).toBe(Infinity);
      expect(initStep.state.acceptedEdges).toEqual([]);
    });

    it('21. state snapshots are fully independent and immutable to subsequent execution', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['A', 'B'].forEach(id => g.addNode(id));
      g.addEdge('A', 'B', 10);

      const result = prim(g, 'A');
      const initStep = result.steps[0];
      const finishStep = result.steps[result.steps.length - 1];

      // Mutating result does not corrupt historic snapshots
      expect(initStep.state.key['B']).toBe(Infinity);
      expect(finishStep.state.key['B']).toBe(10);
      result.edges.push({ id: 'MUTATED' });
      expect(finishStep.state.acceptedEdges.length).toBe(1);
    });

    it('22. Graph is not mutated (no runtime properties attached to graph or nodes)', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 5);

      const nodesBefore = JSON.stringify(g.getNodes());
      const edgesBefore = JSON.stringify(g.getEdges());

      prim(g, 'A');

      expect(JSON.stringify(g.getNodes())).toBe(nodesBefore);
      expect(JSON.stringify(g.getEdges())).toBe(edgesBefore);
      expect(g.key).toBeUndefined();
      expect(g.inMST).toBeUndefined();
      expect(g.parent).toBeUndefined();
      expect(g.getNode('A').key).toBeUndefined();
    });

    it('23. deterministic execution across functional calls and class instances', () => {
      const g = new Graph({ directed: false, weighted: true });
      ['1', '2', '3', '4'].forEach(id => g.addNode(id));
      g.addEdge('1', '2', 4);
      g.addEdge('2', '3', 1);
      g.addEdge('3', '4', 2);
      g.addEdge('1', '4', 3);

      const resFunc = prim(g, '1');
      const resClass = new PrimEngine(g, '1').run();

      expect(resFunc.edgeIds).toEqual(resClass.edgeIds);
      expect(resFunc.totalWeight).toBe(resClass.totalWeight);
      expect(resFunc.statistics).toEqual(resClass.statistics);
      expect(resFunc.steps.length).toBe(resClass.steps.length);
    });

    it('24. processes equal-key nodes in insertion-order without arbitrary lexical inversion', () => {
      // Root R connected to two nodes B and A with identical weights of 5.
      // Node B is declared before A.
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('R');
      g.addNode('B');
      g.addNode('A');
      g.addEdge('R', 'B', 5, 'e_RB');
      g.addEdge('R', 'A', 5, 'e_RA');

      const result = prim(g, 'R');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(10);
      // Because B was declared before A, B is selected first
      expect(result.edgeIds[0]).toBe('e_RB');
      expect(result.edgeIds[1]).toBe('e_RA');
    });
  });

  describe('Part 25: Golden Master Characterization Fixtures', () => {
    it('characterizes slide graph X1-X8 fixture (start X1, total = 101.0, 7 edges, connected: true)', () => {
      const g = fixtureToGraph(slideGraph);
      const result = prim(g, 'x1');

      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(expectedPrim.connected);
      expect(result.totalWeight).toBe(expectedPrim.expectedTotal);
      expect(result.edges.length).toBe(expectedPrim.expectedMstEdgeCount);
      expect(result.statistics.verticesVisited).toBe(expectedPrim.reached);
    });

    it('characterizes sample directed graph fixture (unsupported directed graph)', () => {
      const g = fixtureToGraph(sampleDirected);
      const result = prim(g, 'A');

      expect(result.status).toBe(AlgorithmStatus.UNSUPPORTED);
      expect(result.connected).toBe(false);
      expect(result.edges).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });
  });
});
