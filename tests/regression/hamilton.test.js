import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import undirectedCycle from '../fixtures/hamilton/undirected-cycle.json';
import directedCycle from '../fixtures/hamilton/directed-cycle.json';
import { Graph } from '../../src/core/models/Graph.js';
import { hamilton, HamiltonEngine } from '../../src/core/algorithms/HamiltonEngine.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';

describe('Hamilton Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-11: Hamilton cycle and path backtracking on undirected 4-cycle graph', () => {
    ctx.setupGraph(undirectedCycle);

    // Test Cycle: wantCycle = true
    const resultCycle = ctx.runHamilton(0, true);
    expect(resultCycle.found).toBe(true);
    expect(resultCycle.truncated).toBe(false);
    expect(resultCycle.resultPath.length).toBe(4);
    // All 4 distinct vertices [0, 1, 2, 3] must be present in the path
    expect(new Set(resultCycle.resultPath).size).toBe(4);

    const lastFrameCycle = resultCycle.frames[resultCycle.frames.length - 1];
    expect(lastFrameCycle.phase).toBe('Hoàn tất');
    expect(lastFrameCycle.found).toBe(true);
    expect(lastFrameCycle.closesCycle).toBe(true);

    // Test Path: wantCycle = false
    const resultPath = ctx.runHamilton(0, false);
    expect(resultPath.found).toBe(true);
    expect(resultPath.resultPath.length).toBe(4);
  });

  it('REG-12: Hamilton cycle backtracking on directed triangle graph', () => {
    ctx.setupGraph(directedCycle);

    const result = ctx.runHamilton(0, true);
    expect(result.found).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.resultPath.length).toBe(3);
    expect(new Set(result.resultPath).size).toBe(3);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.desc).toContain('CHU TRÌNH Hamilton có hướng');
  });
});

describe('HamiltonEngine Headless Core Suite (Phase 2F)', () => {
  // A. Undirected Hamilton cycle exists
  it('A. finds Hamilton cycle on undirected graph when one exists', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    g.addEdge('D', 'A');

    const result = hamilton(g, 'A', true);

    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.found).toBe(true);
    expect(result.closesCycle).toBe(true);
    expect(result.resultPath.length).toBe(4);
    expect(result.resultPath[0]).toBe('A');
    expect(new Set(result.resultPath).size).toBe(4);
    expect(result.truncated).toBe(false);
  });

  // B. Undirected Hamilton path exists but cycle does not
  it('B. finds Hamilton path on line graph where no cycle exists', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');

    // Searching for path
    const resultPath = hamilton(g, 'A', false);
    expect(resultPath.status).toBe(AlgorithmStatus.SUCCESS);
    expect(resultPath.found).toBe(true);
    expect(resultPath.closesCycle).toBe(false);
    expect(resultPath.resultPath).toEqual(['A', 'B', 'C', 'D']);

    // Searching for cycle on the same line graph must fail
    const resultCycle = hamilton(g, 'A', true);
    expect(resultCycle.status).toBe(AlgorithmStatus.FAILURE);
    expect(resultCycle.found).toBe(false);
    expect(resultCycle.closesCycle).toBe(false);
    expect(resultCycle.resultPath).toBeNull();
    expect(resultCycle.path).toEqual([]);
  });

  // C. No Hamilton path exists
  it('C. reports failure when no Hamilton path exists (star graph K1,3)', () => {
    // Star graph: center A connected to leaves B, C, D
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('A', 'D');

    const result = hamilton(g, 'B', false);
    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.found).toBe(false);
    expect(result.resultPath).toBeNull();
  });

  // D. Directed Hamilton cycle
  it('D. finds Hamilton cycle on directed graph', () => {
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');

    const result = hamilton(g, 'A', true);
    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.found).toBe(true);
    expect(result.closesCycle).toBe(true);
    expect(result.resultPath).toEqual(['A', 'B', 'C']);
  });

  // E. Directed Hamilton path
  it('E. finds Hamilton path on directed graph', () => {
    const g = new Graph({ directed: true });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');

    const result = hamilton(g, 'A', false);
    expect(result.status).toBe(AlgorithmStatus.SUCCESS);
    expect(result.found).toBe(true);
    expect(result.closesCycle).toBe(false);
    expect(result.resultPath).toEqual(['A', 'B', 'C', 'D']);
  });

  // F. Start node changes result/search
  it('F. produces different reachability results depending on start node', () => {
    // Directed graph A -> B -> C
    const g = new Graph({ directed: true });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');

    // Starting at A reaches all 3 nodes
    const resA = hamilton(g, 'A', false);
    expect(resA.found).toBe(true);
    expect(resA.resultPath).toEqual(['A', 'B', 'C']);

    // Starting at B cannot reach A
    const resB = hamilton(g, 'B', false);
    expect(resB.found).toBe(false);
    expect(resB.resultPath).toBeNull();
  });

  // G. Invalid startNodeId and invalid input
  it('G. gracefully handles invalid startNodeId and invalid graph', () => {
    const g = new Graph({ directed: false });
    g.addNode('A');

    const resInvalidStart = hamilton(g, 'GHOST_NODE');
    expect(resInvalidStart.status).toBe(AlgorithmStatus.INVALID_INPUT);
    expect(resInvalidStart.found).toBe(false);
    expect(resInvalidStart.warnings[0]).toContain('does not exist in graph');

    const resNullGraph = hamilton(null);
    expect(resNullGraph.status).toBe(AlgorithmStatus.INVALID_INPUT);
    expect(resNullGraph.found).toBe(false);
  });

  // H. Empty graph and single-node graph behavior
  it('H. handles empty graph (0 nodes) and single-node graph correctly', () => {
    // 0 nodes
    const gEmpty = new Graph({ directed: false });
    const resEmpty = hamilton(gEmpty);
    expect(resEmpty.status).toBe(AlgorithmStatus.FAILURE);
    expect(resEmpty.found).toBe(false);

    // 1 node without self-loop
    const gSingle = new Graph({ directed: false });
    gSingle.addNode('Solo');

    // Path mode: trivial path of length 1
    const resPath = hamilton(gSingle, 'Solo', false);
    expect(resPath.status).toBe(AlgorithmStatus.SUCCESS);
    expect(resPath.found).toBe(true);
    expect(resPath.resultPath).toEqual(['Solo']);

    // Cycle mode without self-loop: cannot close cycle
    const resCycle = hamilton(gSingle, 'Solo', true);
    expect(resCycle.status).toBe(AlgorithmStatus.FAILURE);
    expect(resCycle.found).toBe(false);

    // 1 node with self-loop: closes cycle
    gSingle.addEdge('Solo', 'Solo');
    const resCycleWithLoop = hamilton(gSingle, 'Solo', true);
    expect(resCycleWithLoop.status).toBe(AlgorithmStatus.SUCCESS);
    expect(resCycleWithLoop.found).toBe(true);
    expect(resCycleWithLoop.closesCycle).toBe(true);
    expect(resCycleWithLoop.resultPath).toEqual(['Solo']);
  });

  // I. Candidate ordering matches legacy (0..n-1 order)
  it('I. explores candidate vertices strictly in node insertion order', () => {
    // Node A connects to B (index 1) and C (index 2).
    // B connects to D (index 3). C connects to D (index 3).
    // Graph has 2 Hamiltonian paths from A:
    // 1. A -> B -> D -> C
    // 2. A -> C -> D -> B
    // In legacy candidate order (0..n-1), from A, candidate B (index 1) is tried before C (index 2).
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');

    const result = hamilton(g, 'A', false);
    expect(result.found).toBe(true);
    expect(result.resultPath).toEqual(['A', 'B', 'D', 'C']);
  });

  // J. Safety cap truncation
  it('J. truncates search and sets truncated: true when cap is exceeded', () => {
    // Complete bipartite graph K_6,7 (13 nodes: n > 12 => cap = 30000).
    // A complete bipartite graph with unequal partition sizes has NO Hamilton cycle.
    // The search explores 30,000+ branches before halting to protect performance.
    const g = new Graph({ directed: false });
    const part1 = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'];
    const part2 = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'];
    [...part1, ...part2].forEach(id => g.addNode(id));

    part1.forEach(u => {
      part2.forEach(v => {
        g.addEdge(u, v);
      });
    });

    const result = hamilton(g, 'U1', true);
    expect(result.truncated).toBe(true);
    expect(result.found).toBe(false);
    expect(result.status).toBe(AlgorithmStatus.FAILURE);
    expect(result.statistics.cap).toBe(30000);
    expect(result.statistics.stepCount).toBeGreaterThan(30000);
    expect(result.warnings[0]).toContain('exceeded step limit');
  });

  // K. Result path contains node IDs, not array indices
  it('K. returns string node IDs in resultPath, not numeric indices', () => {
    const g = new Graph({ directed: false });
    ['alpha', 'beta', 'gamma'].forEach(id => g.addNode(id));
    g.addEdge('alpha', 'beta');
    g.addEdge('beta', 'gamma');
    g.addEdge('gamma', 'alpha');

    const result = hamilton(g, 'alpha', true);
    expect(result.found).toBe(true);
    result.resultPath.forEach(id => {
      expect(typeof id).toBe('string');
    });
    expect(result.resultPath).toEqual(['alpha', 'beta', 'gamma']);
  });

  // L. Graph input is not mutated
  it('L. does not mutate the input Graph or its internal structures', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');

    const nodesBefore = JSON.stringify(g.getNodes());
    const edgesBefore = JSON.stringify(g.getEdges());

    hamilton(g, 'A', true);

    expect(JSON.stringify(g.getNodes())).toBe(nodesBefore);
    expect(JSON.stringify(g.getEdges())).toBe(edgesBefore);
    expect(g.nodeCount).toBe(3);
    expect(g.edgeCount).toBe(3);
  });

  // M. Deterministic repeated execution
  it('M. produces strictly deterministic execution across repeated runs', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C', 'D'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'D');
    g.addEdge('D', 'A');

    const run1 = hamilton(g, 'A', true);
    const run2 = hamilton(g, 'A', true);

    expect(run1.resultPath).toEqual(run2.resultPath);
    expect(run1.steps.length).toBe(run2.steps.length);
    expect(run1.statistics.stepCount).toBe(run2.statistics.stepCount);
  });

  // N. Class wrapper equivalence
  it('N. confirms HamiltonEngine class wrapper matches functional hamilton call', () => {
    const g = new Graph({ directed: false });
    ['A', 'B', 'C'].forEach(id => g.addNode(id));
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');

    const fnRes = hamilton(g, 'A', false);
    const engine = new HamiltonEngine(g, 'A', false);
    const classRes = engine.run();

    expect(classRes.status).toBe(fnRes.status);
    expect(classRes.found).toBe(fnRes.found);
    expect(classRes.resultPath).toEqual(fnRes.resultPath);
    expect(classRes.steps.length).toBe(fnRes.steps.length);
  });
});
