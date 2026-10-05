/**
 * @file JohnsonEngine.js
 * Headless Core Engine - Johnson All-Pairs Shortest Paths
 *
 * Fully DOM-independent, pure ES Module.
 * Computes shortest paths between EVERY pair of vertices on a weighted graph that may
 * contain negative edge weights (but no negative cycles), in four teaching phases:
 *
 *   Phase 1  Add pseudo vertex q (arcs q -> v of weight 0) and run Bellman-Ford from q
 *            to obtain the potentials h(v) = d(q, v). Negative cycle => stop with error.
 *   Phase 2  Reweight every arc:  w'(u,v) = w(u,v) + h(u) - h(v)  >= 0.
 *   Phase 3  Run Dijkstra once per source vertex on the reweighted graph.
 *            Only the final result table of each source is recorded (no relaxation trace).
 *   Phase 4  Convert back:  d(u,v) = d'(u,v) - h(u) + h(v).
 *
 * The engine reuses the existing Bellman-Ford and Dijkstra engines unchanged.
 *
 * STEP AGGREGATION: only macro-steps are recorded (n + 3 steps for n vertices):
 *   1 step   Bellman-Ford result table h(v)                     (stage 'bf-result')
 *   1 step   reweighted arc list w -> w'                        (stage 'reweight-table')
 *   n steps  one Dijkstra result table per source vertex        (stage 'dijkstra-result')
 *   1 step   final all-pairs matrix d(u, v)                     (stage 'final-matrix')
 * (a negative cycle yields a single ERROR step instead).
 * Every recorded step carries `state.johnsonPhase` (1..4) and `state.stage` so that
 * StepFormatter can render the correct table without touching the graph.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';
import { Graph } from '../models/Graph.js';
import { bellmanFord } from './BellmanFordEngine.js';
import { dijkstra } from './DijkstraEngine.js';

/** Exact message required by the specification when a negative cycle is found. */
export const JOHNSON_NEGATIVE_CYCLE_MESSAGE =
  'Đồ thị chứa chu trình trọng số âm. Không thể tiếp tục thuật toán Johnson.';

/** Error thrown by {@link johnsonStrict} when the graph has a negative weight cycle. */
export class NegativeCycleError extends Error {
  constructor(message = JOHNSON_NEGATIVE_CYCLE_MESSAGE, cycle = []) {
    super(message);
    this.name = 'NegativeCycleError';
    this.cycle = cycle;
  }
}

/** Formats a number for descriptions: ∞ for Infinity, no "-0", no float noise. */
function fmt(x) {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (typeof x !== 'number' || Number.isNaN(x)) return String(x);
  const r = Number.isInteger(x) ? x : Number(x.toFixed(6));
  return String(Object.is(r, -0) ? 0 : r);
}

/** Normalizes -0 and tiny float noise. */
function clean(x) {
  if (x === Infinity || x === -Infinity) return x;
  const r = Math.abs(x) < 1e-9 ? 0 : Number(x.toFixed(9));
  return Object.is(r, -0) ? 0 : r;
}

function invalid(message, warning) {
  return {
    status: AlgorithmStatus.INVALID_INPUT,
    type: 'johnson',
    message,
    path: [],
    edges: [],
    totalWeight: null,
    steps: [],
    statistics: {
      nodeCount: 0,
      arcCount: 0,
      bellmanFordIterations: 0,
      dijkstraRuns: 0,
      negativeCycleDetected: false,
    },
    warnings: [warning || message],
  };
}

/** Picks a pseudo vertex id that does not collide with an existing node id. */
function pickPseudoId(existing) {
  let id = 'q';
  while (existing.has(id)) id += '*';
  return id;
}

/**
 * Executes Johnson's all-pairs shortest path algorithm.
 *
 * @param {import('../models/Graph.js').Graph} graph - Graph (directed recommended; undirected edges
 *   are treated as two opposite arcs, so a negative undirected edge is a negative cycle).
 * @returns {Object} Standardized AlgorithmResult with extra fields:
 *   `potentials` {id->h}, `reweightedEdges`, `reweightedDistances` (d'), `distances` (d, matrix
 *   object-of-objects), `distanceMatrix` (array rows), `nodeIds`, `pseudoNodeId`.
 */
export function johnson(graph) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.getNodes !== 'function' || typeof graph.hasNode !== 'function') {
    return invalid('Invalid graph instance provided', 'Graph is missing or invalid');
  }
  const allNodes = graph.getNodes();
  if (!Array.isArray(allNodes) || allNodes.length === 0) {
    return invalid('Đồ thị rỗng: không có đỉnh nào để chạy thuật toán Johnson.', 'Graph has no nodes');
  }

  const nodeIds = allNodes.map((n) => n.id);
  const nodeSet = new Set(nodeIds);
  const labelOf = (id) => {
    const node = allNodes.find((n) => n.id === id);
    return (node && (node.label || node.short || node.name)) || id;
  };
  const isDirected = Boolean(graph.isDirected);

  // 2. EXPAND EDGES INTO DIRECTED ARCS (undirected edge => two arcs)
  const arcs = [];
  const rawEdges = typeof graph.getEdges === 'function' ? graph.getEdges() : [];
  for (const e of rawEdges) {
    const w = typeof e.weight === 'number' ? e.weight : 1;
    arcs.push({ id: e.id, edgeId: e.id, from: e.from, to: e.to, weight: w });
    if (!isDirected && e.from !== e.to) {
      arcs.push({ id: `${e.id}~rev`, edgeId: e.id, from: e.to, to: e.from, weight: w });
    }
  }

  const q = pickPseudoId(nodeSet);
  const steps = [];
  let stepCounter = 0;
  const statistics = {
    nodeCount: nodeIds.length,
    arcCount: arcs.length,
    bellmanFordIterations: 0,
    dijkstraRuns: 0,
    negativeCycleDetected: false,
  };

  const baseState = { nodeIds: [...nodeIds], pseudoNodeId: q };
  function record(action, description, highlights, state) {
    stepCounter++;
    steps.push(createStep({
      stepNumber: stepCounter,
      action,
      description,
      state: { ...baseState, ...state },
      highlights,
    }));
  }

  // ---------------------------------------------------------------------------
  // PHASE 1: pseudo vertex q + Bellman-Ford
  // ---------------------------------------------------------------------------
  const aug = new Graph({ directed: true, weighted: true });
  aug.addNode({ id: q, label: q });
  for (const n of allNodes) aug.addNode({ id: n.id, label: n.label || n.id });
  for (const id of nodeIds) aug.addEdge({ from: q, to: id, weight: 0, id: `${q}->${id}` });
  for (const a of arcs) aug.addEdge({ from: a.from, to: a.to, weight: a.weight, id: a.id });

  const bf = bellmanFord(aug, q);
  statistics.bellmanFordIterations = bf.statistics ? bf.statistics.iterations : 0;

  if (bf.hasNegativeCycle) {
    statistics.negativeCycleDetected = true;
    const cycle = Array.isArray(bf.negativeCycle) ? bf.negativeCycle.filter((id) => nodeSet.has(id)) : [];
    const cycleStr = cycle.length > 0
      ? ` Chu trình âm: ${cycle.map(labelOf).join(' → ')} → ${labelOf(cycle[0])}.`
      : '';
    record(
      AlgorithmAction.ERROR,
      JOHNSON_NEGATIVE_CYCLE_MESSAGE,
      { nodes: cycle, edges: [] },
      {
        johnsonPhase: 1,
        stage: 'negative-cycle',
        hasNegativeCycle: true,
        cycleNodes: cycle,
        cycleDetail: cycleStr.trim(),
        dist: { ...bf.distances },
        prev: { ...bf.predecessors },
      }
    );
    return {
      status: AlgorithmStatus.FAILURE,
      type: 'johnson',
      message: JOHNSON_NEGATIVE_CYCLE_MESSAGE,
      hasNegativeCycle: true,
      negativeCycle: cycle,
      pseudoNodeId: q,
      nodeIds: [...nodeIds],
      path: [],
      edges: [],
      totalWeight: null,
      steps,
      statistics,
      warnings: ['Graph contains a negative weight cycle'],
    };
  }

  const h = {};
  for (const id of nodeIds) h[id] = clean(bf.distances[id]);

  // Distances after each Bellman-Ford pass, kept in the state only (no extra steps).
  const bfPasses = bf.steps
    .filter((s) => s.state && s.state.passEnd)
    .map((s) => ({ pass: s.state.iteration, dist: { ...s.state.dist } }));

  // STEP 1 (single step): pseudo vertex q + Bellman-Ford result h(v) = d(q, v)
  record(
    AlgorithmAction.INITIALIZE,
    `Bước 1: Thêm đỉnh giả ${q} nối đến tất cả ${nodeIds.length} đỉnh bằng cung có hướng trọng số 0, ` +
      `chạy Bellman-Ford từ ${q} (${statistics.bellmanFordIterations} vòng lặp, không có chu trình âm). ` +
      `Thế năng h(v) = d(${q}, v): ` +
      nodeIds.map((id) => `h(${labelOf(id)}) = ${fmt(h[id])}`).join(', ') + '.',
    { nodes: [], edges: [] },
    {
      johnsonPhase: 1,
      stage: 'bf-result',
      h: { ...h },
      dist: { ...bf.distances },
      prev: { ...bf.predecessors },
      bfPasses,
      iteration: statistics.bellmanFordIterations,
    }
  );

  // ---------------------------------------------------------------------------
  // PHASE 2: reweighting  w'(u,v) = w(u,v) + h(u) - h(v)  (single step, full list)
  // ---------------------------------------------------------------------------
  const reweighted = [];
  for (const a of arcs) {
    const wNew = clean(a.weight + h[a.from] - h[a.to]);
    reweighted.push({
      id: a.id,
      edgeId: a.edgeId,
      from: a.from,
      to: a.to,
      weight: a.weight,
      reweighted: wNew,
    });
  }
  const allNonNegative = reweighted.every((r) => r.reweighted >= 0);

  record(
    AlgorithmAction.RELAX_EDGE,
    "Bước 2: Tái trọng số mọi cung theo w'(u, v) = w(u, v) + h(u) − h(v): " +
      reweighted
        .map((r) => `(${labelOf(r.from)}, ${labelOf(r.to)}): ${fmt(r.weight)} → ${fmt(r.reweighted)}`)
        .join('; ') +
      (allNonNegative
        ? `. Toàn bộ ${reweighted.length} cung đều có w' ≥ 0.`
        : ". Cảnh báo: có cung w' < 0 sau khi tái trọng số."),
    {
      nodes: [...nodeIds],
      edges: [...new Set(reweighted.map((r) => r.edgeId).filter(Boolean))],
    },
    {
      johnsonPhase: 2,
      stage: 'reweight-table',
      h: { ...h },
      allNonNegative,
      arcs: reweighted.map((r) => ({
        from: r.from,
        to: r.to,
        weight: r.weight,
        hFrom: h[r.from],
        hTo: h[r.to],
        reweighted: r.reweighted,
      })),
    }
  );

  // ---------------------------------------------------------------------------
  // PHASE 3: Dijkstra from every vertex on the reweighted graph (one table per source)
  // ---------------------------------------------------------------------------
  const rg = new Graph({ directed: true, weighted: true });
  for (const n of allNodes) rg.addNode({ id: n.id, label: n.label || n.id });
  for (const r of reweighted) {
    rg.addEdge({ from: r.from, to: r.to, weight: Math.max(0, r.reweighted), id: r.id });
  }

  const dPrime = {};
  const predecessors = {};
  for (const u of nodeIds) {
    const res = dijkstra(rg, u);
    statistics.dijkstraRuns++;
    const row = {};
    const prevRow = {};
    for (const v of nodeIds) {
      const d = res.distances ? res.distances[v] : Infinity;
      row[v] = d === undefined ? Infinity : clean(d);
      prevRow[v] = res.predecessors && res.predecessors[v] ? res.predecessors[v] : null;
    }
    dPrime[u] = row;
    predecessors[u] = prevRow;

    record(
      AlgorithmAction.SELECT_NODE,
      `Bước 3: Bảng kết quả Dijkstra xuất phát từ đỉnh: ${labelOf(u)} — ` +
        nodeIds.map((v) => `d'(${labelOf(u)}, ${labelOf(v)}) = ${fmt(row[v])}`).join(', ') + '.',
      { nodes: [u], edges: [] },
      {
        johnsonPhase: 3,
        stage: 'dijkstra-result',
        source: u,
        dPrimeRow: { ...row },
        prevRow: { ...prevRow },
      }
    );
  }

  // ---------------------------------------------------------------------------
  // PHASE 4: convert back  d(u,v) = d'(u,v) - h(u) + h(v)  (single final step)
  // ---------------------------------------------------------------------------
  const dist = {};
  for (const u of nodeIds) {
    dist[u] = {};
    for (const v of nodeIds) {
      const dp = dPrime[u][v];
      dist[u][v] = dp === Infinity ? Infinity : clean(dp - h[u] + h[v]);
    }
  }

  record(
    AlgorithmAction.FINISH,
    "Bước 4: Quy đổi d(u, v) = d'(u, v) − h(u) + h(v). Hoàn tất! Ma trận đường đi ngắn nhất mọi cặp đỉnh d(u, v) đã được tính xong.",
    { nodes: [...nodeIds], edges: [] },
    {
      johnsonPhase: 4,
      stage: 'final-matrix',
      h: { ...h },
      dPrime: cloneMatrix(dPrime),
      dist: cloneMatrix(dist),
    }
  );

  const distanceMatrix = nodeIds.map((u) => nodeIds.map((v) => dist[u][v]));

  return {
    status: AlgorithmStatus.SUCCESS,
    type: 'johnson',
    message: `Đã tính xong đường đi ngắn nhất giữa mọi cặp trong ${nodeIds.length} đỉnh (Johnson)`,
    hasNegativeCycle: false,
    pseudoNodeId: q,
    nodeIds: [...nodeIds],
    path: [],
    edges: [],
    totalWeight: null,
    steps,
    statistics,
    potentials: { ...h },
    reweightedEdges: reweighted.map((r) => ({ ...r })),
    reweightedDistances: cloneMatrix(dPrime),
    distances: dist,
    distanceMatrix,
    predecessors,
    warnings: [],
  };
}

function cloneMatrix(m) {
  const out = {};
  for (const k of Object.keys(m)) out[k] = { ...m[k] };
  return out;
}

/**
 * Strict variant: throws {@link NegativeCycleError} when a negative weight cycle exists,
 * otherwise returns the same AlgorithmResult as {@link johnson}.
 *
 * @param {import('../models/Graph.js').Graph} graph
 * @returns {Object}
 * @throws {NegativeCycleError}
 */
export function johnsonStrict(graph) {
  const result = johnson(graph);
  if (result.hasNegativeCycle) {
    throw new NegativeCycleError(JOHNSON_NEGATIVE_CYCLE_MESSAGE, result.negativeCycle || []);
  }
  return result;
}

export const JohnsonEngine = {
  run: johnson,
  runStrict: johnsonStrict,
};

export default JohnsonEngine;