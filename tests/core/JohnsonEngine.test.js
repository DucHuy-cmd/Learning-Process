/**
 * @file JohnsonEngine.test.js
 * Unit tests for Johnson's all-pairs shortest path engine, its presentation tables,
 * registry integration and code examples.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';
import { AlgorithmStatus, AlgorithmAction } from '../../src/core/models/Types.js';
import {
  johnson,
  johnsonStrict,
  NegativeCycleError,
  JOHNSON_NEGATIVE_CYCLE_MESSAGE,
} from '../../src/core/algorithms/JohnsonEngine.js';
import { run as registryRun, has, getMetadata } from '../../src/app/algorithms/AlgorithmRegistry.js';
import { formatStep, formatTable } from '../../src/app/presentation/StepFormatter.js';
import { getCodeExample } from '../../src/app/code-examples/index.js';
import { getPresetGraph } from '../../src/app/presets/presets.js';

/** Directed weighted graph helper. */
function makeGraph(ids, edges, directed = true) {
  const g = new Graph({ directed, weighted: true });
  for (const id of ids) g.addNode(id);
  for (const [from, to, w] of edges) g.addEdge(from, to, w);
  return g;
}

// Textbook-style exercise: vertices A-F, B->F = -3, F->E = -2.
const SAMPLE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SAMPLE_EDGES = [
  ['A', 'B', 2],
  ['A', 'C', 4],
  ['B', 'C', 1],
  ['B', 'D', 7],
  ['C', 'E', 3],
  ['D', 'F', 1],
  ['E', 'D', 2],
  ['B', 'F', -3],
  ['F', 'E', -2],
];

/** Reference all-pairs distances (Floyd-Warshall) used to cross-check the engine. */
function floydWarshall(ids, edges) {
  const d = {};
  for (const u of ids) {
    d[u] = {};
    for (const v of ids) d[u][v] = u === v ? 0 : Infinity;
  }
  for (const [a, b, w] of edges) d[a][b] = Math.min(d[a][b], w);
  for (const k of ids) {
    for (const i of ids) {
      for (const j of ids) {
        if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
      }
    }
  }
  return d;
}

describe('JohnsonEngine', () => {
  // ===========================================================================
  // (a) Standard directed graph with negative weights
  // ===========================================================================
  describe('directed graph with negative weights (A-F, B->F = -3, F->E = -2)', () => {
    const graph = makeGraph(SAMPLE_IDS, SAMPLE_EDGES);
    const result = johnson(graph);

    it('succeeds and reports the johnson type', () => {
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.type).toBe('johnson');
      expect(result.hasNegativeCycle).toBe(false);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('Step 1: potentials h(v) = d(q, v) from Bellman-Ford', () => {
      expect(result.pseudoNodeId).toBe('q');
      expect(result.potentials).toEqual({ A: 0, B: 0, C: 0, D: -3, E: -5, F: -3 });
    });

    it('Step 1: a single step adds q, runs Bellman-Ford and reports h(v) = d(q, v)', () => {
      const first = result.steps[0];
      expect(first.action).toBe(AlgorithmAction.INITIALIZE);
      expect(first.state.johnsonPhase).toBe(1);
      expect(first.state.stage).toBe('bf-result');
      expect(first.state.dist.q).toBe(0);
      expect(first.state.h).toEqual({ A: 0, B: 0, C: 0, D: -3, E: -5, F: -3 });
      expect(first.description).toContain('q');
      expect(first.description).toContain('h(D) = -3');
    });

    it('aggregates steps: n + 3 macro-steps (Bellman-Ford, reweight, n Dijkstra tables, final matrix)', () => {
      expect(result.steps).toHaveLength(SAMPLE_IDS.length + 3);
      expect(result.steps.map((s) => s.state.stage)).toEqual([
        'bf-result',
        'reweight-table',
        ...SAMPLE_IDS.map(() => 'dijkstra-result'),
        'final-matrix',
      ]);
      expect(result.steps.map((s) => s.stepNumber)).toEqual(result.steps.map((_, i) => i + 1));
    });

    it('Step 2: every reweighted edge is non-negative and follows w + h(u) - h(v)', () => {
      expect(result.reweightedEdges).toHaveLength(SAMPLE_EDGES.length);
      for (const e of result.reweightedEdges) {
        expect(e.reweighted).toBeGreaterThanOrEqual(0);
        expect(e.reweighted).toBe(e.weight + result.potentials[e.from] - result.potentials[e.to]);
      }
      const bf = result.reweightedEdges.find((e) => e.from === 'B' && e.to === 'F');
      expect(bf.weight).toBe(-3);
      expect(bf.reweighted).toBe(0);
      const fe = result.reweightedEdges.find((e) => e.from === 'F' && e.to === 'E');
      expect(fe.weight).toBe(-2);
      expect(fe.reweighted).toBe(0);
    });

    it('Step 3: intermediate matrix d\'(u,v) is non-negative', () => {
      for (const u of SAMPLE_IDS) {
        expect(result.reweightedDistances[u][u]).toBe(0);
        for (const v of SAMPLE_IDS) {
          expect(result.reweightedDistances[u][v]).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('Step 4: final matrix d(u,v) = d\'(u,v) - h(u) + h(v) and matches the expected values', () => {
      const expected = {
        A: { A: 0, B: 2, C: 3, D: -1, E: -3, F: -1 },
        B: { A: Infinity, B: 0, C: 1, D: -3, E: -5, F: -3 },
        C: { A: Infinity, B: Infinity, C: 0, D: 5, E: 3, F: 6 },
        D: { A: Infinity, B: Infinity, C: Infinity, D: 0, E: -1, F: 1 },
        E: { A: Infinity, B: Infinity, C: Infinity, D: 2, E: 0, F: 3 },
        F: { A: Infinity, B: Infinity, C: Infinity, D: 0, E: -2, F: 0 },
      };
      expect(result.distances).toEqual(expected);

      for (const u of SAMPLE_IDS) {
        for (const v of SAMPLE_IDS) {
          const dp = result.reweightedDistances[u][v];
          if (dp !== Infinity) {
            expect(result.distances[u][v]).toBe(dp - result.potentials[u] + result.potentials[v]);
          }
        }
      }
    });

    it('agrees with Floyd-Warshall on every pair', () => {
      const fw = floydWarshall(SAMPLE_IDS, SAMPLE_EDGES);
      for (const u of SAMPLE_IDS) {
        for (const v of SAMPLE_IDS) expect(result.distances[u][v]).toBe(fw[u][v]);
      }
    });

    it('exposes distanceMatrix rows in node order', () => {
      expect(result.distanceMatrix).toHaveLength(6);
      expect(result.distanceMatrix[0]).toEqual([0, 2, 3, -1, -3, -1]);
    });

    it('records the four phases in order', () => {
      const phases = result.steps.map((s) => s.state.johnsonPhase);
      expect(phases[0]).toBe(1);
      expect(phases[phases.length - 1]).toBe(4);
      for (let i = 1; i < phases.length; i++) expect(phases[i]).toBeGreaterThanOrEqual(phases[i - 1]);
      expect(new Set(phases)).toEqual(new Set([1, 2, 3, 4]));
      expect(result.steps[result.steps.length - 1].action).toBe(AlgorithmAction.FINISH);
    });

    it('Step 3 shows ONLY one result table per source vertex (no relaxation trace)', () => {
      const phase3 = result.steps.filter((s) => s.state.johnsonPhase === 3);
      const perSource = phase3.filter((s) => s.state.stage === 'dijkstra-result');
      expect(perSource.map((s) => s.state.source)).toEqual(SAMPLE_IDS);
      for (const s of phase3) {
        expect(s.action).not.toBe(AlgorithmAction.RELAX_EDGE);
        expect(s.action).not.toBe(AlgorithmAction.INSPECT_EDGE);
      }
      expect(result.statistics.dijkstraRuns).toBe(6);
      expect(perSource[0].description).toContain('Bảng kết quả Dijkstra xuất phát từ đỉnh: A');
      expect(perSource[5].description).toContain('Bảng kết quả Dijkstra xuất phát từ đỉnh: F');
    });

    it('does not mutate the input graph', () => {
      expect(graph.nodeCount).toBe(6);
      expect(graph.edgeCount).toBe(SAMPLE_EDGES.length);
      expect(graph.hasNode('q')).toBe(false);
      expect(graph.getEdge('B->F').weight).toBe(-3);
    });
  });

  // ===========================================================================
  // (b) Negative cycle
  // ===========================================================================
  describe('graph with a negative weight cycle', () => {
    const cyc = () => makeGraph(['A', 'B', 'C'], [['A', 'B', 1], ['B', 'C', -3], ['C', 'A', 1]]);

    it('is detected: FAILURE with the required message and a final ERROR step', () => {
      const result = johnson(cyc());
      expect(result.status).toBe(AlgorithmStatus.FAILURE);
      expect(result.hasNegativeCycle).toBe(true);
      expect(result.message).toBe('Đồ thị chứa chu trình trọng số âm. Không thể tiếp tục thuật toán Johnson.');
      expect(result.message).toBe(JOHNSON_NEGATIVE_CYCLE_MESSAGE);
      expect(new Set(result.negativeCycle)).toEqual(new Set(['A', 'B', 'C']));

      const last = result.steps[result.steps.length - 1];
      expect(last.action).toBe(AlgorithmAction.ERROR);
      expect(last.description).toBe(JOHNSON_NEGATIVE_CYCLE_MESSAGE);
      // The algorithm stops: nothing from phases 2-4 is recorded.
      expect(result.steps.every((s) => s.state.johnsonPhase === 1)).toBe(true);
      expect(result.distances).toBeUndefined();
    });

    it('johnsonStrict throws NegativeCycleError with the required message', () => {
      expect(() => johnsonStrict(cyc())).toThrow(NegativeCycleError);
      expect(() => johnsonStrict(cyc())).toThrow(JOHNSON_NEGATIVE_CYCLE_MESSAGE);
      try {
        johnsonStrict(cyc());
      } catch (err) {
        expect(err.name).toBe('NegativeCycleError');
        expect(err.cycle.length).toBe(3);
      }
    });

    it('detects a negative cycle that is unreachable from the first vertex', () => {
      const g = makeGraph(
        ['S', 'X', 'Y', 'Z'],
        [['S', 'X', 1], ['Y', 'Z', -2], ['Z', 'Y', 1]]
      );
      expect(johnson(g).hasNegativeCycle).toBe(true);
    });

    it('treats a negative self-loop as a negative cycle', () => {
      const g = makeGraph(['A', 'B'], [['A', 'B', 1], ['B', 'B', -1]]);
      expect(johnson(g).hasNegativeCycle).toBe(true);
    });

    it('does not throw for a graph without negative cycles', () => {
      expect(() => johnsonStrict(makeGraph(SAMPLE_IDS, SAMPLE_EDGES))).not.toThrow();
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================
  describe('edge cases', () => {
    it('rejects an invalid graph and an empty graph', () => {
      expect(johnson(null).status).toBe(AlgorithmStatus.INVALID_INPUT);
      expect(johnson({}).status).toBe(AlgorithmStatus.INVALID_INPUT);
      expect(johnson(new Graph({ directed: true, weighted: true })).status).toBe(AlgorithmStatus.INVALID_INPUT);
    });

    it('works on a single vertex', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      const r = johnson(g);
      expect(r.status).toBe(AlgorithmStatus.SUCCESS);
      expect(r.distances).toEqual({ A: { A: 0 } });
    });

    it('keeps unreachable pairs at Infinity', () => {
      const r = johnson(makeGraph(['A', 'B', 'C'], [['A', 'B', -2]]));
      expect(r.distances.A.B).toBe(-2);
      expect(r.distances.B.A).toBe(Infinity);
      expect(r.distances.A.C).toBe(Infinity);
      expect(r.distances.C.C).toBe(0);
    });

    it('chooses a pseudo vertex id that does not collide with an existing vertex', () => {
      const g = makeGraph(['q', 'a'], [['q', 'a', -1]]);
      const r = johnson(g);
      expect(r.pseudoNodeId).toBe('q*');
      expect(r.distances.q.a).toBe(-1);
    });

    it('handles parallel edges (keeps the cheapest path)', () => {
      const g = makeGraph(['A', 'B'], [['A', 'B', 5], ['A', 'B', -2]]);
      expect(johnson(g).distances.A.B).toBe(-2);
    });

    it('treats an undirected graph with non-negative weights like a symmetric graph', () => {
      const g = makeGraph(['A', 'B', 'C'], [['A', 'B', 2], ['B', 'C', 3]], false);
      const r = johnson(g);
      expect(r.status).toBe(AlgorithmStatus.SUCCESS);
      expect(r.distances.A.C).toBe(5);
      expect(r.distances.C.A).toBe(5);
    });

    it('an undirected graph with a negative edge is a negative cycle', () => {
      const g = makeGraph(['A', 'B'], [['A', 'B', -1]], false);
      expect(johnson(g).hasNegativeCycle).toBe(true);
    });

    it('matches Floyd-Warshall on a batch of random graphs without negative cycles', () => {
      // Deterministic LCG so the test is reproducible.
      let seed = 12345;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      for (let trial = 0; trial < 25; trial++) {
        const n = 3 + Math.floor(rnd() * 5);
        const ids = Array.from({ length: n }, (_, i) => `N${i}`);
        // Random potentials guarantee no negative cycle: w = nonNeg + p(v) - p(u).
        const p = ids.map(() => Math.floor(rnd() * 11) - 5);
        const edges = [];
        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            if (u !== v && rnd() < 0.4) {
              edges.push([ids[u], ids[v], Math.floor(rnd() * 6) + p[v] - p[u]]);
            }
          }
        }
        const r = johnson(makeGraph(ids, edges));
        expect(r.status).toBe(AlgorithmStatus.SUCCESS);
        const fw = floydWarshall(ids, edges);
        for (const u of ids) for (const v of ids) expect(r.distances[u][v]).toBe(fw[u][v]);
      }
    });
  });

  // ===========================================================================
  // Registry & presets integration
  // ===========================================================================
  describe('integration', () => {
    it('is registered in AlgorithmRegistry and dispatches to the engine', () => {
      expect(has('johnson')).toBe(true);
      expect(has('  JOHNSON ')).toBe(true);
      expect(getMetadata('johnson').requiresStartNode).toBe(false);
      const r = registryRun('johnson', makeGraph(SAMPLE_IDS, SAMPLE_EDGES));
      expect(r.algorithm).toBe('johnson');
      expect(r.distances.A.F).toBe(-1);
    });

    it('preset johnson_sample reproduces the exercise graph', () => {
      const g = getPresetGraph('johnson_sample');
      expect(g.nodeCount).toBe(6);
      const r = registryRun('johnson', g);
      expect(r.status).toBe(AlgorithmStatus.SUCCESS);
      expect(r.potentials).toEqual({ A: 0, B: 0, C: 0, D: -3, E: -5, F: -3 });
    });

    it('preset johnson_neg_cycle triggers the negative cycle error', () => {
      const r = registryRun('johnson', getPresetGraph('johnson_neg_cycle'));
      expect(r.status).toBe(AlgorithmStatus.FAILURE);
      expect(r.message).toBe(JOHNSON_NEGATIVE_CYCLE_MESSAGE);
    });
  });

  // ===========================================================================
  // Presentation (StepFormatter) tables
  // ===========================================================================
  describe('StepFormatter tables', () => {
    const graph = makeGraph(SAMPLE_IDS, SAMPLE_EDGES);
    const result = johnson(graph);
    const ctx = { algorithmKey: 'johnson' };
    const colCount = SAMPLE_IDS.length + 3;
    const rowWidth = (row) => row.cells.reduce((sum, c) => sum + (c.colSpan || 1), 0);

    it('uses one constant header: (x,y) | w | q | A..F', () => {
      for (const step of result.steps) {
        const table = formatTable(step, graph, ctx);
        expect(table.type).toBe('johnson');
        expect(table.headers).toEqual(['(x,y)', 'w', 'q', ...SAMPLE_IDS]);
      }
    });

    it('every table row fills exactly the header width', () => {
      for (const step of result.steps) {
        const table = formatTable(step, graph, ctx);
        for (const row of table.rows) {
          if (row.isPassBand) continue; // Bellman-Ford "Lần k:" band is rendered by StateTable
          expect(rowWidth(row)).toBe(colCount);
        }
      }
    });

    it('Step 1 renders one Bellman-Ford result table from q (band mentions q, then h(v) row)', () => {
      const table = formatTable(result.steps[0], graph, ctx);
      expect(table.rows[0].summaryText).toContain('q');
      expect(table.rows.some((r) => r.cells[0] && r.cells[0].val === 'h(v)')).toBe(true);
    });

    it('Step 1 result row prints h(A)..h(F)', () => {
      const step = result.steps.find((s) => s.state.stage === 'bf-result');
      const table = formatTable(step, graph, ctx);
      const hRow = table.rows.find((r) => r.cells[0] && r.cells[0].val === 'h(v)');
      expect(hRow.cells.slice(1).map((c) => c.val)).toEqual(['0', '0', '0', '-3', '-5', '-3']);
    });

    it("Step 2 is ONE table listing original weight next to the new non-negative weight", () => {
      const steps2 = result.steps.filter((s) => s.state.stage === 'reweight-table');
      expect(steps2).toHaveLength(1);
      expect(steps2[0].state.arcs).toHaveLength(SAMPLE_EDGES.length);
      const rows = formatTable(steps2[0], graph, ctx).rows;
      const row = rows.find((r) => r.cells[0] && r.cells[0].val === '(B,F)');
      expect(row.cells[1].val).toBe('-3');
      expect(row.cells[row.cells.length - 1].val).toBe('0');
      const arcRows = rows.filter((r) => r.cells[0] && r.cells[0].type === 'bf-edge');
      expect(arcRows).toHaveLength(SAMPLE_EDGES.length);
      for (const r of arcRows) expect(Number(r.cells[r.cells.length - 1].val)).toBeGreaterThanOrEqual(0);
    });

    it('Step 3 labels each Dijkstra result table with its start vertex', () => {
      const steps = result.steps.filter((s) => s.state.stage === 'dijkstra-result');
      steps.forEach((step, idx) => {
        const table = formatTable(step, graph, ctx);
        expect(table.rows[0].summaryText).toBe(`Bảng kết quả Dijkstra xuất phát từ đỉnh: ${SAMPLE_IDS[idx]}`);
      });
    });

    it('Step 4 final table is the n x n matrix d(u,v) with ∞ for unreachable pairs', () => {
      const last = result.steps[result.steps.length - 1];
      const table = formatTable(last, graph, ctx);
      const matrixRows = table.rows.filter((r) => r.cells[0] && r.cells[0].type === 'jh-label');
      expect(matrixRows).toHaveLength(6);
      expect(matrixRows[0].cells.slice(1).map((c) => c.val)).toEqual(['0', '2', '3', '-1', '-3', '-1']);
      expect(matrixRows[1].cells[1].val).toBe('∞');
    });

    it('shows the required error message on the negative-cycle step', () => {
      const bad = johnson(makeGraph(['A', 'B', 'C'], [['A', 'B', 1], ['B', 'C', -3], ['C', 'A', 1]]));
      const g = makeGraph(['A', 'B', 'C'], []);
      const last = bad.steps[bad.steps.length - 1];
      const table = formatTable(last, g, ctx);
      expect(table.rows[0].summaryText).toContain(JOHNSON_NEGATIVE_CYCLE_MESSAGE);
    });

    it('formatStep adds phase badges and formulas', () => {
      const first = formatStep(result.steps[0], graph, ctx);
      expect(first.phase).toContain('Bước 1/4');
      expect(first.formula).toBe('h(v) = d(q, v)');

      const edgeStep = result.steps.find((s) => s.state.stage === 'reweight-table');
      const fmtd = formatStep(edgeStep, graph, ctx);
      expect(fmtd.phase).toContain('Bước 2/4');
      expect(fmtd.formula).toContain("w'(");

      const lastFmt = formatStep(result.steps[result.steps.length - 1], graph, ctx);
      expect(lastFmt.phase).toContain('Bước 4/4');
      expect(lastFmt.formula).toBe("d(u, v) = d'(u, v) − h(u) + h(v)");
    });
  });

  // ===========================================================================
  // Code examples
  // ===========================================================================
  describe('code examples', () => {
    ['cpp', 'python', 'c', 'java'].forEach((lang) => {
      it(`[${lang}] source embeds the graph and the mapping points to non-empty lines`, () => {
        const graph = makeGraph(['X', 'Y', 'Z'], [['X', 'Y', 4], ['Y', 'Z', -1]]);
        const ex = getCodeExample('johnson', lang, graph);
        expect(ex.algorithm).toBe('johnson');
        expect(ex.source).toContain('"X"');
        expect(ex.source).toContain('-1');
        expect(ex.source).not.toContain('@@');

        const lines = ex.source.split('\n');
        const defaultLines = getCodeExample('johnson', lang).source.split('\n');
        for (const [action, mapped] of Object.entries(ex.mapping)) {
          expect(mapped.length).toBeGreaterThan(0);
          for (const n of mapped) {
            // Mapped lines must be stable regardless of the embedded graph size.
            expect(lines[n - 1]).toBe(defaultLines[n - 1]);
            expect(lines[n - 1].trim().length).toBeGreaterThan(0);
          }
          expect(typeof action).toBe('string');
        }
      });
    });
  });
});