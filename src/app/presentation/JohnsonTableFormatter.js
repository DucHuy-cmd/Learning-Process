/**
 * @file JohnsonTableFormatter.js
 * Presentation helpers for Johnson's algorithm (4 teaching phases).
 *
 * Pure, DOM-independent. Builds the table model consumed by StateTable from a Johnson
 * AlgorithmStep. Everything is derived from `step.state` only (never from the graph's node
 * list) because phase 1 contains the pseudo vertex q, which is not part of the graph.
 *
 * Column layout (constant for every Johnson step, so one <thead> serves all rows):
 *   [ (x,y) | w | q | v1 | v2 | ... | vn ]      => colCount = n + 3
 *
 *   Phase 1 : Bellman-Ford textbook table (delegated to the Bellman-Ford formatter).
 *   Phase 2 : "(u,v) | w | calculation (span n) | w' (span 1)" rows.
 *   Phase 3 : per-source Dijkstra result table + d' matrix.
 *   Phase 4 : conversion formula + final d(u,v) matrix.
 */

import { AlgorithmAction } from '../../core/models/Types.js';

const PHASE_TITLES = Object.freeze({
  vi: {
    1: 'Bước 1/4 · Đỉnh giả q & Bellman-Ford',
    2: "Bước 2/4 · Tái trọng số w'",
    3: 'Bước 3/4 · Dijkstra từng đỉnh',
    4: 'Bước 4/4 · Khôi phục d(u, v)',
  },
  en: {
    1: 'Step 1/4 · Pseudo vertex q & Bellman-Ford',
    2: "Step 2/4 · Reweighting w'",
    3: 'Step 3/4 · Dijkstra per source',
    4: 'Step 4/4 · Recover d(u, v)',
  },
});

/**
 * Phase badge for a Johnson step ("Bước 2/4 · Tái trọng số w'").
 * @param {Object} step
 * @param {string} [language='vi']
 * @returns {string|null} null when the step carries no Johnson phase
 */
export function resolveJohnsonPhase(step, language = 'vi') {
  const phase = step && step.state && step.state.johnsonPhase;
  if (!phase) return null;
  const lang = language === 'en' ? 'en' : 'vi';
  if (step.action === AlgorithmAction.ERROR) {
    return lang === 'en' ? 'Error · negative cycle' : 'Lỗi · chu trình âm';
  }
  return PHASE_TITLES[lang][phase] || null;
}

function fmt(x, inf = '∞') {
  if (x === Infinity || x === undefined || x === null) return inf;
  if (typeof x !== 'number' || Number.isNaN(x)) return String(x);
  const r = Number.isInteger(x) ? x : Number(x.toFixed(6));
  return String(Object.is(r, -0) ? 0 : r);
}

/** Wraps negative numbers in parentheses for readable arithmetic: 7 + 0 − (−3). */
function par(x) {
  return typeof x === 'number' && x < 0 ? `(${fmt(x)})` : fmt(x);
}

/**
 * Formula string for the "formula" slot of a presentation step.
 * @returns {string|null}
 */
export function deriveJohnsonFormula(step, helpers, context = {}) {
  if (!step || !step.state) return null;
  const { getNodeLabel, graph } = helpers;
  const state = step.state;
  const inf = context.infinitySymbol || '∞';
  const q = state.pseudoNodeId || 'q';

  switch (state.stage) {
    case 'bf-init':
      return `dist[${q}] = 0, dist[v] = ${inf}`;
    case 'bf-result':
      return `h(v) = d(${q}, v)`;
    case 'reweight-intro':
    case 'reweight-table':
      return "w'(u, v) = w(u, v) + h(u) − h(v)";
    case 'reweight-edge': {
      const a = state.arc || {};
      const u = getNodeLabel(a.from, graph, context);
      const v = getNodeLabel(a.to, graph, context);
      return `w'(${u}, ${v}) = ${fmt(a.weight)} + ${par(a.hFrom)} − ${par(a.hTo)} = ${fmt(a.reweighted)}`;
    }
    case 'dijkstra-result': {
      const s = getNodeLabel(state.source, graph, context);
      return `d'(${s}, v) = Dijkstra(G', ${s})`;
    }
    case 'convert-intro':
    case 'final-matrix':
      return "d(u, v) = d'(u, v) − h(u) + h(v)";
    default:
      return null;
  }
}

/**
 * Builds the Johnson table model for one step.
 *
 * @param {Object} step - Johnson AlgorithmStep
 * @param {Object} graph - real Graph (only used for node labels)
 * @param {Object} context - formatting context
 * @param {Object} helpers
 * @param {Function} helpers.getNodeLabel - (id, graph, ctx) => label
 * @param {Function} helpers.formatBellmanFord - (step, pseudoGraph, ctx) => bellman-ford table model
 * @returns {Object|null}
 */
export function formatJohnsonTable(step, graph, context, helpers) {
  if (!step || !step.state) return null;
  const state = step.state;
  const nodeIds = Array.isArray(state.nodeIds) ? state.nodeIds : [];
  if (nodeIds.length === 0) return null;

  const { getNodeLabel, formatBellmanFord } = helpers;
  const lang = context.language === 'en' ? 'en' : 'vi';
  const inf = context.infinitySymbol || '∞';
  const q = state.pseudoNodeId || 'q';
  const n = nodeIds.length;
  const colCount = n + 3;

  const label = (id) => (id === q ? q : getNodeLabel(id, graph, context));
  const headers = ['(x,y)', 'w', label(q), ...nodeIds.map(label)];
  const stepLabel = `B${typeof step.stepNumber === 'number' ? step.stepNumber : 1}`;

  const band = (text, extra = {}) => ({
    stepLabel: '',
    fullWidth: true,
    noStepCell: true,
    summaryText: text,
    cells: [{ val: text, type: 'summary', colSpan: colCount }],
    ...extra,
  });

  // A header-like row: first cell spans 3 columns (x,y | w | q), then one cell per node.
  const head = (firstText, texts) => ({
    noStepCell: true,
    isJohnsonHead: true,
    cells: [
      { val: firstText, type: 'jh-head', colSpan: 3 },
      ...texts.map((t) => ({ val: t, type: 'jh-head' })),
    ],
  });

  const valCell = (x, type) => ({
    val: fmt(x, inf),
    type: type || (x === Infinity || x === undefined ? 'jh-inf' : 'jh-val'),
  });

  const matrixRows = (matrix, rowType) =>
    nodeIds.map((u) => ({
      noStepCell: true,
      cells: [
        { val: label(u), type: 'jh-label', colSpan: 3 },
        ...nodeIds.map((v) => {
          const x = matrix && matrix[u] ? matrix[u][v] : Infinity;
          return valCell(x, x === Infinity ? 'jh-inf' : rowType);
        }),
      ],
    }));

  const hRow = (h) => ({
    noStepCell: true,
    cells: [
      { val: 'h(v)', type: 'jh-label', colSpan: 3 },
      ...nodeIds.map((v) => valCell(h ? h[v] : undefined, 'jh-val')),
    ],
  });

  const wrap = (type, rows, summary = null) => ({ type, headers, rows, summary });

  switch (state.stage) {
    // ---------------------------------------------------------------- Phase 1
    case 'bf-init':
    case 'bf-trace': {
      const pseudoGraph = {
        isDirected: true,
        getNodes: () => [q, ...nodeIds].map((id) => ({ id, label: label(id) })),
        getNode: (id) => ({ id, label: label(id) }),
      };
      const table = formatBellmanFord(step, pseudoGraph, { ...context, algorithmKey: 'bellman_ford' });
      if (!table) return null;
      return { ...table, type: 'johnson', headers };
    }

    case 'bf-result': {
      const rows = [
        band(step.description || ''),
        head(`${lang === 'en' ? 'Vertex' : 'Đỉnh'}`, nodeIds.map(label)),
        hRow(state.h),
      ];
      return wrap('johnson', rows);
    }

    case 'negative-cycle': {
      const msg = [step.description, state.cycleDetail].filter(Boolean).join(' ');
      return wrap('johnson', [band(msg, { stepLabel: '⚠️' })], 'Chu trình âm');
    }

    // ---------------------------------------------------------------- Phase 2
    case 'reweight-intro': {
      const rows = [
        band(step.description || ''),
        hRow(state.h),
        {
          noStepCell: true,
          isJohnsonHead: true,
          cells: [
            { val: '(u,v)', type: 'jh-head' },
            { val: 'w', type: 'jh-head' },
            { val: "w' = w + h(u) − h(v)", type: 'jh-head', colSpan: n },
            { val: "w' ≥ 0", type: 'jh-head' },
          ],
        },
      ];
      return wrap('johnson', rows);
    }

    case 'reweight-edge': {
      const a = state.arc || {};
      const calc = `${fmt(a.weight)} + ${par(a.hFrom)} − ${par(a.hTo)}`;
      return wrap('johnson', [
        {
          noStepCell: true,
          cells: [
            { val: `(${label(a.from)},${label(a.to)})`, type: 'bf-edge' },
            { val: fmt(a.weight), type: a.weight < 0 ? 'jh-neg' : 'bf-weight' },
            { val: calc, type: 'jh-calc', colSpan: n },
            { val: fmt(a.reweighted), type: 'jh-new' },
          ],
        },
      ]);
    }

    // Aggregated Step 2: one table listing every arc (w -> w').
    case 'reweight-table': {
      const arcs = Array.isArray(state.arcs) ? state.arcs : [];
      const rows = [
        band(
          lang === 'en'
            ? "Reweighting: w'(u, v) = w(u, v) + h(u) − h(v)"
            : "Tái trọng số: w'(u, v) = w(u, v) + h(u) − h(v)"
        ),
        hRow(state.h),
        {
          noStepCell: true,
          isJohnsonHead: true,
          cells: [
            { val: '(u,v)', type: 'jh-head' },
            { val: 'w', type: 'jh-head' },
            { val: "w' = w + h(u) − h(v)", type: 'jh-head', colSpan: n },
            { val: "w' ≥ 0", type: 'jh-head' },
          ],
        },
        ...arcs.map((a) => ({
          noStepCell: true,
          cells: [
            { val: `(${label(a.from)},${label(a.to)})`, type: 'bf-edge' },
            { val: fmt(a.weight), type: a.weight < 0 ? 'jh-neg' : 'bf-weight' },
            { val: `${fmt(a.weight)} + ${par(a.hFrom)} − ${par(a.hTo)}`, type: 'jh-calc', colSpan: n },
            { val: fmt(a.reweighted), type: 'jh-new' },
          ],
        })),
      ];
      return wrap('johnson', rows);
    }

    case 'reweight-done':
      return wrap('johnson', [band(step.description || '', { stepLabel: '★' })]);

    // ---------------------------------------------------------------- Phase 3
    case 'dijkstra-intro':
      return wrap('johnson', [band(step.description || '')]);

    case 'dijkstra-result': {
      const s = label(state.source);
      const row = state.dPrimeRow || {};
      const prev = state.prevRow || {};
      const rows = [
        band(
          lang === 'en'
            ? `Dijkstra result table from vertex: ${s}`
            : `Bảng kết quả Dijkstra xuất phát từ đỉnh: ${s}`
        ),
        head(lang === 'en' ? 'Vertex' : 'Đỉnh', nodeIds.map(label)),
        {
          noStepCell: true,
          cells: [
            { val: `d'(${s}, v)`, type: 'jh-label', colSpan: 3 },
            ...nodeIds.map((v) => valCell(row[v], row[v] === Infinity ? 'jh-inf' : 'jh-val')),
          ],
        },
        {
          noStepCell: true,
          cells: [
            { val: lang === 'en' ? 'Predecessor' : 'Đỉnh trước', type: 'jh-label', colSpan: 3 },
            ...nodeIds.map((v) => ({ val: prev[v] ? label(prev[v]) : '-', type: 'jh-val' })),
          ],
        },
      ];
      return wrap('johnson', rows);
    }

    case 'dprime-matrix': {
      const rows = [
        band(step.description || ''),
        head("d'(u, v)", nodeIds.map(label)),
        ...matrixRows(state.dPrime, 'jh-val'),
      ];
      return wrap('johnson', rows);
    }

    // ---------------------------------------------------------------- Phase 4
    case 'convert-intro': {
      const rows = [
        band(step.description || ''),
        head(lang === 'en' ? 'Vertex' : 'Đỉnh', nodeIds.map(label)),
        hRow(state.h),
      ];
      return wrap('johnson', rows);
    }

    case 'final-matrix': {
      // Optional Source -> Destination result (exactly two lines: route, then weight).
      const query = state.query;
      const queryRows = [];
      if (query) {
        if (query.reachable) {
          queryRows.push(
            band(query.path.map(label).join(' -> '), { stepLabel: '★' }),
            band(`${lang === 'en' ? 'Weight' : 'Trọng số'}: ${fmt(query.weight, inf)}`, { stepLabel: '★' })
          );
        } else {
          queryRows.push(
            band(
              lang === 'en'
                ? `No path from ${label(query.sourceId)} to ${label(query.targetId)}`
                : `Không có đường đi từ ${label(query.sourceId)} đến ${label(query.targetId)}`,
              { stepLabel: '★' }
            )
          );
        }
      }
      const rows = [
        band(
          lang === 'en'
            ? 'All-pairs shortest path matrix d(u, v)'
            : 'Ma trận đường đi ngắn nhất mọi cặp đỉnh d(u, v)'
        ),
        head('d(u, v)', nodeIds.map(label)),
        ...matrixRows(state.dist, 'jh-final'),
        ...queryRows,
        band(
          lang === 'en'
            ? 'A cell showing ∞ means there is no path from u to v.'
            : 'Ô hiển thị ∞ nghĩa là không có đường đi từ u đến v.',
          { stepLabel: '★' }
        ),
      ];
      return wrap('johnson', rows);
    }

    default:
      return wrap('johnson', [band(step.description || '', { stepLabel })]);
  }
}
