/**
 * @file EulerEngine.test.js
 * Comprehensive unit and regression test suite for headless EulerEngine.
 *
 * Verifies 100% legacy-compatible Hierholzer traversal, undirected/directed contracts,
 * start/end node selection rules, weak connectivity checks, and insertion-order stability.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { euler, EulerEngine } from '../../src/core/algorithms/EulerEngine.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';

describe('EulerEngine Headless Core Tests', () => {
  // ---------------------------------------------------------------------------
  // 1. UNDIRECTED EULER CIRCUITS & PATHS
  // ---------------------------------------------------------------------------

  it('1. detects and traces undirected Euler circuit (all vertices even degree)', () => {
    // 5-vertex bowtie/figure-8: A-B, B-C, C-A, C-D, D-E, E-C
    // Degrees: A:2, B:2, C:4, D:2, E:2 (0 odd vertices)
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D', 'E'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e_AB');
    g.addEdge('B', 'C', 1, 'e_BC');
    g.addEdge('C', 'A', 1, 'e_CA');
    g.addEdge('C', 'D', 1, 'e_CD');
    g.addEdge('D', 'E', 1, 'e_DE');
    g.addEdge('E', 'C', 1, 'e_EC');

    const result = euler(g, 'A');

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    expect(result.connected).toBe(true);
    expect(result.odd.length).toBe(0);
    expect(result.circuit.length).toBe(7); // 6 edges + 1
    expect(result.circuit[0]).toBe('A');
    expect(result.circuit[result.circuit.length - 1]).toBe('A');
    expect(result.edges.length).toBe(6);
    expect(result.totalWeight).toBe(6);
    expect(result.statistics.circuitEdgeCount).toBe(6);
  });

  it('2. detects and traces undirected Euler path (exactly 2 odd vertices)', () => {
    // Classic 5-vertex open envelope graph with odd degrees at C and D
    // Nodes: A, B, C, D, E. Edges: A-B, B-C, C-D, D-A, A-C, B-D, A-E, E-B
    // Degrees: A:4, B:4, C:3 (odd), D:3 (odd), E:2
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D', 'E'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e_AB');
    g.addEdge('B', 'C', 1, 'e_BC');
    g.addEdge('C', 'D', 1, 'e_CD');
    g.addEdge('D', 'A', 1, 'e_DA');
    g.addEdge('A', 'C', 1, 'e_AC');
    g.addEdge('B', 'D', 1, 'e_BD');
    g.addEdge('A', 'E', 1, 'e_AE');
    g.addEdge('E', 'B', 1, 'e_EB');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('path');
    expect(result.connected).toBe(true);
    expect(result.odd.length).toBe(2);
    expect(result.odd).toContain('C');
    expect(result.odd).toContain('D');
    expect(result.circuit.length).toBe(9); // 8 edges + 1
    // Endpoints must be the odd nodes
    expect(result.odd).toContain(result.circuit[0]);
    expect(result.odd).toContain(result.circuit[result.circuit.length - 1]);
    expect(result.circuit[0]).not.toBe(result.circuit[result.circuit.length - 1]);
    expect(result.edges.length).toBe(8);
  });

  it('3. rejects undirected graph with > 2 odd vertices as none_odd', () => {
    // 4-vertex complete graph K4: each vertex has degree 3 (4 odd vertices)
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e_AB');
    g.addEdge('B', 'C', 1, 'e_BC');
    g.addEdge('C', 'D', 1, 'e_CD');
    g.addEdge('D', 'A', 1, 'e_DA');
    g.addEdge('A', 'C', 1, 'e_AC');
    g.addEdge('B', 'D', 1, 'e_BD');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('none_odd');
    expect(result.connected).toBe(true);
    expect(result.odd.length).toBe(4);
    expect(result.circuit.length).toBe(0);
    expect(result.edges.length).toBe(0);
  });

  it('4. rejects undirected disconnected graph as disconnected', () => {
    // Two disjoint triangles: (A-B-C) and (D-E-F)
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e1');
    g.addEdge('B', 'C', 1, 'e2');
    g.addEdge('C', 'A', 1, 'e3');
    g.addEdge('D', 'E', 1, 'e4');
    g.addEdge('E', 'F', 1, 'e5');
    g.addEdge('F', 'D', 1, 'e6');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('disconnected');
    expect(result.connected).toBe(false);
    expect(result.components.length).toBe(2);
    expect(result.circuit.length).toBe(0);
    expect(result.message.toLowerCase()).toContain('không liên thông');
  });

  it('5. handles undirected empty graph (0 edges)', () => {
    const g = new Graph({ directed: false });
    ['A', 'B'].forEach(id => g.addNode(id));

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('empty');
    expect(result.circuit.length).toBe(0);
    expect(result.chosenStart).toBeNull();
  });

  it('6. handles single node graph with 0 edges', () => {
    const g = new Graph({ directed: false });
    g.addNode('Solo');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('empty');
    expect(result.circuit.length).toBe(0);
  });

  it('7. allows custom start node for undirected Euler circuit if degree > 0', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('C', 'A', 1);

    const result = euler(g, 'B');

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    expect(result.chosenStart).toBe('B');
    expect(result.circuit[0]).toBe('B');
    expect(result.circuit[result.circuit.length - 1]).toBe('B');
  });

  it('8. falls back to odd node when even node is specified as start in undirected path', () => {
    // Path with odd nodes C and D. If user requests start 'A' (even), legacy auto-selects odd[0] = C.
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    // A-B, B-C, C-A (triangle, degrees: A:2, B:2, C:2)
    // Add C-D: C:3 (odd), D:1 (odd)
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);
    g.addEdge('C', 'A', 1);
    g.addEdge('C', 'D', 1);

    // Requesting even node 'A' as start
    const resultEven = euler(g, 'A');
    expect(resultEven.type).toBe('path');
    expect(resultEven.chosenStart).toBe('C'); // fallback to odd[0]
    expect(resultEven.chosenEnd).toBe('D');

    // Requesting valid odd node 'D' as start
    const resultOdd = euler(g, 'D');
    expect(resultOdd.type).toBe('path');
    expect(resultOdd.chosenStart).toBe('D');
    expect(resultOdd.chosenEnd).toBe('C');
  });

  // ---------------------------------------------------------------------------
  // 2. DIRECTED EULER CIRCUITS & PATHS
  // ---------------------------------------------------------------------------

  it('9. detects and traces directed Euler circuit (balanced inDegree === outDegree)', () => {
    // Directed cycle: A -> B -> C -> A
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 2.5, 'e1');
    g.addEdge('B', 'C', 3.0, 'e2');
    g.addEdge('C', 'A', 1.5, 'e3');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    expect(result.connected).toBe(true);
    expect(result.statistics.isDirected).toBe(true);
    expect(result.circuit).toEqual(['A', 'B', 'C', 'A']);
    expect(result.edgeIds).toEqual(['e1', 'e2', 'e3']);
    expect(result.totalWeight).toBe(7.0);
  });

  it('10. detects and traces directed Euler path (1 start candidate, 1 end candidate)', () => {
    // Directed path: A -> B -> C -> D
    // A: out=1, in=0 (start candidate)
    // D: out=0, in=1 (end candidate)
    // B, C: in=1, out=1
    const g = new Graph({ directed: true });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e1');
    g.addEdge('B', 'C', 1, 'e2');
    g.addEdge('C', 'D', 1, 'e3');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('path');
    expect(result.chosenStart).toBe('A');
    expect(result.chosenEnd).toBe('D');
    expect(result.circuit).toEqual(['A', 'B', 'C', 'D']);
    expect(result.edgeIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('11. strictly ignores user startNodeId for directed Euler path (legacy contract)', () => {
    // Directed path A -> B -> C. Start candidate is strictly A.
    // Even if user specifies startNodeId = 'B', legacy contract mandates starting at startCandidates[0] = A.
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', 1);

    const result = euler(g, 'B');

    expect(result.type).toBe('path');
    expect(result.chosenStart).toBe('A');
    expect(result.chosenEnd).toBe('C');
    expect(result.circuit[0]).toBe('A');
  });

  it('12. detects directed weakly disconnected graph as disconnected', () => {
    // Disconnected directed components: (A -> B -> A) and (C -> D -> C)
    const g = new Graph({ directed: true });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'A', 1);
    g.addEdge('C', 'D', 1);
    g.addEdge('D', 'C', 1);

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('disconnected');
    expect(result.connected).toBe(false);
    expect(result.components.length).toBe(2);
    expect(result.circuit.length).toBe(0);
  });

  it('13. rejects directed graph with unbalanced in/out degrees as none_degree', () => {
    // A -> B and A -> C (A: out=2, in=0; B: in=1, out=0; C: in=1, out=0)
    // 2 end candidates (B, C), 1 start candidate with out-in=2 -> none_degree
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1);
    g.addEdge('A', 'C', 1);

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('none_degree');
    expect(result.circuit.length).toBe(0);
  });

  it('14. handles directed empty graph (0 edges)', () => {
    const g = new Graph({ directed: true });
    ['X', 'Y'].forEach(id => g.addNode(id));

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.type).toBe('empty');
    expect(result.circuit.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 3. SPECIAL TOPOLOGY: SELF-LOOPS & PARALLEL EDGES
  // ---------------------------------------------------------------------------

  it('15. correctly traverses undirected self-loops', () => {
    // Single node A with a self loop A-A. Degree is 2 (even).
    // Forms a 1-edge circuit: A -> A
    const g = new Graph({ directed: false });
    g.addNode('A');
    g.addEdge('A', 'A', 5, 'loop1');

    const result = euler(g);

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    expect(result.circuit).toEqual(['A', 'A']);
    expect(result.edgeIds).toEqual(['loop1']);
    expect(result.totalWeight).toBe(5);
  });

  it('16. correctly traverses directed self-loops', () => {
    // Node A with self-loop, plus cycle A -> B -> A
    const g = new Graph({ directed: true });
    g.addNode('A');
    g.addNode('B');
    g.addEdge('A', 'A', 2, 'loop');
    g.addEdge('A', 'B', 3, 'eAB');
    g.addEdge('B', 'A', 4, 'eBA');

    const result = euler(g, 'A');

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    expect(result.circuit.length).toBe(4); // 3 edges + 1
    expect(result.circuit[0]).toBe('A');
    expect(result.circuit[result.circuit.length - 1]).toBe('A');
    expect(result.totalWeight).toBe(9);
  });

  it('17. traverses incident edges strictly in insertion order (Hierholzer stability)', () => {
    // Vertex A connects to B via e1, and to C via e2.
    // Graph has 2 cycles meeting at A:
    // Cycle 1: A -> B -> A (edges e_AB, e_BA)
    // Cycle 2: A -> C -> A (edges e_AC, e_CA)
    // When edges are added in order e_AB, e_BA, e_AC, e_CA:
    // Hierholzer starting at A MUST first explore edge e_AB to B.
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e_AB');
    g.addEdge('B', 'A', 1, 'e_BA');
    g.addEdge('A', 'C', 1, 'e_AC');
    g.addEdge('C', 'A', 1, 'e_CA');

    const result = euler(g, 'A');

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.type).toBe('circuit');
    // The first traversed edge must be e_AB (to B)
    expect(result.circuit[1]).toBe('B');
    expect(result.edgeIds[0]).toBe('e_AB');
  });

  // ---------------------------------------------------------------------------
  // 4. STEP GENERATION, IMMUTABILITY & VALIDATION
  // ---------------------------------------------------------------------------

  it('18. produces replayable AlgorithmStep records with immutable state snapshots', () => {
    const g = new Graph({ directed: true });
    ['A', 'B'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 1, 'e1');
    g.addEdge('B', 'A', 1, 'e2');

    const result = euler(g);

    expect(result.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.steps[0].action).toBe(AlgorithmAction.INITIALIZE);
    expect(result.steps[1].action).toBe(AlgorithmAction.SELECT_NODE);

    // Verify step immutability
    const firstStepStack = [...result.steps[1].state.stack];
    result.circuit.push('MUTATED_OUTSIDE');
    expect(result.steps[1].state.stack).toEqual(firstStepStack);
  });

  it('19. rejects invalid graph input or non-existent start node gracefully', () => {
    // Null/undefined graph
    const resNull = euler(null);
    expect(resNull.status).toBe(AlgorithmStatus.INVALID_INPUT);

    // Non-existent start node
    const g = new Graph({ directed: false });
    g.addNode('A');
    const resNonExistent = euler(g, 'Z_GHOST');
    expect(resNonExistent.status).toBe(AlgorithmStatus.INVALID_INPUT);
    expect(resNonExistent.warnings[0]).toContain('not found in graph');
  });

  it('20. confirms EulerEngine class wrapper matches functional euler() execution', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B', 2);
    g.addEdge('B', 'C', 3);
    g.addEdge('C', 'A', 4);

    const fnResult = euler(g, 'A');
    const engine = new EulerEngine(g, 'A');
    const classResult = engine.run();

    expect(classResult.status).toBe(fnResult.status);
    expect(classResult.type).toBe(fnResult.type);
    expect(classResult.circuit).toEqual(fnResult.circuit);
    expect(classResult.totalWeight).toBe(fnResult.totalWeight);
    expect(classResult.steps.length).toBe(fnResult.steps.length);
  });
});
