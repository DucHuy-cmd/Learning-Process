/**
 * @file StepFormatter.js
 * Headless presentation step formatter for algorithm execution traces.
 *
 * Fully DOM-independent, pure ES Module.
 * Transforms Core AlgorithmStep + Graph + FormattingContext into a clean PresentationStep model.
 *
 * Enforces:
 * - Deterministic action-to-phase mapping across languages ('vi' | 'en')
 * - Defensive copying and input immutability
 * - Clean separation between visual highlights and mathematical result paths
 * - Zero fabricated data (no fake priority queues, no fake formulas)
 * - Safe degradation when graph or state is missing
 */

import { AlgorithmAction } from '../../core/models/Types.js';

/**
 * Standard Action-to-Phase mapping table for Vietnamese and English locales.
 * @type {Readonly<Record<'vi'|'en', Readonly<Record<string, string>>>>}
 */
const ACTION_PHASE_MAP = Object.freeze({
  vi: Object.freeze({
    [AlgorithmAction.INITIALIZE]: 'Khởi tạo',
    [AlgorithmAction.SELECT_NODE]: 'Chốt đỉnh',
    [AlgorithmAction.INSPECT_EDGE]: 'Xét cạnh',
    [AlgorithmAction.RELAX_EDGE]: 'Nới lỏng',
    [AlgorithmAction.REJECT_EDGE]: 'Từ chối cạnh',
    [AlgorithmAction.ACCEPT_EDGE]: 'Nhận cạnh',
    [AlgorithmAction.BACKTRACK]: 'Quay lui',
    [AlgorithmAction.FINISH]: 'Hoàn tất',
    [AlgorithmAction.ERROR]: 'Lỗi',
    [AlgorithmAction.VISIT_NODE]: 'Thăm đỉnh',
  }),
  en: Object.freeze({
    [AlgorithmAction.INITIALIZE]: 'Initialize',
    [AlgorithmAction.SELECT_NODE]: 'Select node',
    [AlgorithmAction.INSPECT_EDGE]: 'Inspect edge',
    [AlgorithmAction.RELAX_EDGE]: 'Relax edge',
    [AlgorithmAction.REJECT_EDGE]: 'Reject edge',
    [AlgorithmAction.ACCEPT_EDGE]: 'Accept edge',
    [AlgorithmAction.BACKTRACK]: 'Backtrack',
    [AlgorithmAction.FINISH]: 'Finish',
    [AlgorithmAction.ERROR]: 'Error',
    [AlgorithmAction.VISIT_NODE]: 'Visit node',
  }),
});

/**
 * Resolves display label for a node, honoring context overrides and duck-typed graph properties.
 *
 * @param {string|number} nodeId
 * @param {Object} [graph]
 * @param {Object} [context={}]
 * @returns {string}
 */
function getNodeLabel(nodeId, graph, context = {}) {
  if (nodeId === null || nodeId === undefined) return '';

  if (context.nodeLabels && typeof context.nodeLabels[nodeId] === 'string') {
    return context.nodeLabels[nodeId];
  }

  if (graph && typeof graph.getNode === 'function') {
    try {
      const node = graph.getNode(nodeId);
      if (node) {
        return node.short || node.name || node.label || node.id || String(nodeId);
      }
    } catch {
      // Fallback
    }
  }

  if (graph && typeof graph.getNodes === 'function') {
    try {
      const nodes = graph.getNodes();
      if (Array.isArray(nodes)) {
        const node = nodes.find((n) => n && (n.id === nodeId || n.name === nodeId));
        if (node) {
          return node.short || node.name || node.label || node.id || String(nodeId);
        }
      }
    } catch {
      // Fallback
    }
  }

  return String(nodeId);
}

/**
 * Resolves human-readable phase badge label from AlgorithmAction.
 *
 * @param {string} action - AlgorithmAction string
 * @param {string} [algorithmKey='dijkstra'] - Current algorithm key
 * @param {string} [language='vi'] - 'vi' | 'en'
 * @returns {string}
 */
export function resolvePhase(action, algorithmKey = 'dijkstra', language = 'vi') {
  const lang = language === 'en' ? 'en' : 'vi';
  const map = ACTION_PHASE_MAP[lang];

  if (action && Object.prototype.hasOwnProperty.call(map, action)) {
    return map[action];
  }

  return lang === 'en' ? 'Step' : 'Bước thực thi';
}

/**
 * Derives mathematical relation formula string when supported by actual state.
 * Returns null if not mathematically grounded or unsupported.
 *
 * @param {Object} step
 * @param {Object} [graph]
 * @param {Object} [context={}]
 * @param {string} [algoKey='dijkstra']
 * @returns {string|null}
 */
function deriveFormula(step, graph, context = {}, algoKey = 'dijkstra') {
  if (!step || !step.action) return null;
  const inf = context.infinitySymbol || '∞';

  if (algoKey === 'dijkstra') {
    if (step.action === AlgorithmAction.INITIALIZE) {
      const state = step.state || {};
      const dist = state.dist || {};
      const startNode = Object.keys(dist).find((k) => dist[k] === 0);
      if (startNode) {
        const startLabel = getNodeLabel(startNode, graph, context);
        return `dist[${startLabel}] = 0, dist[v] = ${inf}`;
      }
      return null;
    }

    if (step.action === AlgorithmAction.RELAX_EDGE) {
      const state = step.state || {};
      const highlights = step.highlights || {};
      const dist = state.dist || {};
      const prev = state.prev || {};

      let updatedList = [];
      if (Array.isArray(state.updatedNodes) && state.updatedNodes.length > 0) {
        updatedList = state.updatedNodes;
      } else if (highlights.nodes && highlights.nodes.length > 0) {
        const candidates = highlights.nodes.filter((n) => prev[n] && dist[n] !== undefined);
        updatedList = candidates.length > 0 ? candidates : [highlights.nodes[0]];
      }

      if (updatedList.length > 0) {
        const formulas = [];
        for (const v of updatedList) {
          const u = prev[v] || (highlights.nodes && highlights.nodes.length > 1 ? highlights.nodes[1] : null);
          if (v && u && dist[v] !== undefined && dist[u] !== undefined) {
            let weight = null;
            if (graph && typeof graph.getEdge === 'function') {
              const edgeId = highlights.edges && highlights.edges.find((e) => {
                const edgeObj = graph.getEdge(e);
                return edgeObj && ((edgeObj.from === u && edgeObj.to === v) || (edgeObj.from === v && edgeObj.to === u));
              });
              const edge = edgeId ? graph.getEdge(edgeId) : (highlights.edges && graph.getEdge(highlights.edges[0]));
              if (edge && typeof edge.weight === 'number') {
                weight = edge.weight;
              }
            }

            if (weight === null && graph && typeof graph.getNeighbors === 'function') {
              try {
                const neighbors = graph.getNeighbors(u) || [];
                const nb = neighbors.find((n) => n.node === v || n.nodeId === v);
                if (nb && typeof nb.weight === 'number') {
                  weight = nb.weight;
                }
              } catch {
                // Ignore
              }
            }

            if (weight !== null) {
              const uLabel = getNodeLabel(u, graph, context);
              const vLabel = getNodeLabel(v, graph, context);
              const newDist = dist[v];
              formulas.push(`dist[${vLabel}] = dist[${uLabel}] + ${weight} = ${newDist}`);
            }
          }
        }
        if (formulas.length > 0) {
          return formulas.join('; ');
        }
      }

      return null;
    }

    // For SELECT_NODE and other Dijkstra actions: MUST remain null!
    return null;
  }

  if (algoKey === 'prim') {
    if (step.action === AlgorithmAction.INITIALIZE) {
      const state = step.state || {};
      const key = state.key || {};
      const startNode = Object.keys(key).find((k) => key[k] === 0);
      if (startNode) {
        const startLabel = getNodeLabel(startNode, graph, context);
        return `key[${startLabel}] = 0, key[v] = ${inf}`;
      }
      return null;
    }

    if (step.action === AlgorithmAction.RELAX_EDGE) {
      const state = step.state || {};
      const highlights = step.highlights || {};
      const key = state.key || {};

      let updatedList = [];
      if (Array.isArray(state.updatedNodes) && state.updatedNodes.length > 0) {
        updatedList = state.updatedNodes;
      } else if (highlights.nodes && highlights.nodes.length > 0) {
        updatedList = [highlights.nodes[0]];
      }

      if (updatedList.length > 0) {
        const formulas = updatedList
          .filter((v) => key[v] !== undefined)
          .map((v) => {
            const vLabel = getNodeLabel(v, graph, context);
            return `key[${vLabel}] = ${key[v]}`;
          });
        if (formulas.length > 0) {
          return formulas.join('; ');
        }
      }

      return null;
    }

    return null;
  }

  // Kruskal, Euler, Hamilton: no formula
  return null;
}

/**
 * Builds structured progress table model for the current step.
 *
 * @param {Object} step
 * @param {Object} [graph]
 * @param {Object} [context={}]
 * @returns {Object|null}
 */
export function formatTable(step, graph, context = {}) {
  if (!step) return null;

  const algoKey = (context.algorithmKey || 'dijkstra').toLowerCase();
  const lang = context.language === 'en' ? 'en' : 'vi';
  const inf = context.infinitySymbol || '∞';
  const state = step.state || {};
  const highlights = step.highlights || {};
  const stepLabel = `B${typeof step.stepNumber === 'number' ? step.stepNumber : 1}`;

  // Extract nodes via duck typing
  let nodes = [];
  if (graph && typeof graph.getNodes === 'function') {
    try {
      nodes = graph.getNodes() || [];
    } catch {
      nodes = [];
    }
  }

  if (algoKey === 'dijkstra') {
    if (nodes.length === 0) return null;

    const dist = state.dist || {};
    const prev = state.prev || {};
    const visited = Array.isArray(state.visited) ? state.visited : [];

    const headers = [
      lang === 'en' ? 'Step' : 'Bước',
      ...nodes.map((n) => getNodeLabel(n.id || n.name, graph, context)),
    ];

    const cells = nodes.map((n) => {
      const nodeId = n.id || n.name;
      const d = dist[nodeId];
      const p = prev[nodeId];
      const pLabel = p ? getNodeLabel(p, graph, context) : '-';
      const isSettled =
        highlights.nodes &&
        highlights.nodes.includes(nodeId) &&
        step.action === AlgorithmAction.SELECT_NODE;
      const isVisited = visited.includes(nodeId);
      const isUpdated =
        step.action === AlgorithmAction.RELAX_EDGE &&
        (Array.isArray(state.updatedNodes)
          ? state.updatedNodes.includes(nodeId)
          : highlights.nodes && highlights.nodes.includes(nodeId));

      if (isSettled) {
        return {
          nodeId,
          val: d !== undefined && d !== Infinity ? `(${d}, ${pLabel})*` : `(${inf}, -)*`,
          type: 'settled',
        };
      }
      if (isVisited && !isSettled) {
        return {
          nodeId,
          val: '-',
          type: 'visited',
        };
      }
      if (d === undefined || d === Infinity) {
        return {
          nodeId,
          val: `(${inf}, -)`,
          type: 'init',
        };
      }
      return {
        nodeId,
        val: `(${d}, ${pLabel})`,
        type: isUpdated ? 'updated' : 'normal',
      };
    });

    const rows = [
      {
        stepLabel,
        cells,
      },
    ];

    const hasFinishWeight = (step.action === AlgorithmAction.FINISH && typeof state.totalWeight === 'number');
    if (hasFinishWeight) {
      const summaryMsg = lang === 'en'
        ? `Total shortest path weight: ${state.totalWeight}`
        : `Tổng trọng số đường đi ngắn nhất: ${state.totalWeight}`;
      rows.push({
        stepLabel: '★',
        isSummary: true,
        summaryText: summaryMsg,
        cells: [
          {
            val: summaryMsg,
            type: 'summary',
            colSpan: headers.length - 1,
          },
        ],
      });
    }

    return {
      type: 'dijkstra',
      headers,
      rows,
      summary: hasFinishWeight
        ? (lang === 'en' ? `Total shortest path weight: ${state.totalWeight}` : `Tổng trọng số đường đi ngắn nhất: ${state.totalWeight}`)
        : null,
    };
  }

  if (algoKey === 'prim') {
    if (nodes.length === 0) return null;

    const key = state.key || {};
    const parent = state.parent || {};
    const inMST = Array.isArray(state.inMST) ? state.inMST : [];
    const acceptedEdges = Array.isArray(state.acceptedEdges) ? state.acceptedEdges : [];
    const totalWeight = typeof state.totalWeight === 'number' ? state.totalWeight : 0;

    const headers = [
      lang === 'en' ? 'Step' : 'Bước',
      ...nodes.map((n) => getNodeLabel(n.id || n.name, graph, context)),
      'Tv',
      'Te',
      lang === 'en' ? 'Total Weight' : 'Tổng trọng số',
    ];

    // For Prim: Find the unvisited candidate with the minimum key in RELAX_EDGE
    let minCandidateId = null;
    let minCandidateKey = Infinity;
    if (step.action === AlgorithmAction.RELAX_EDGE) {
      for (const n of nodes) {
        const id = n.id || n.name;
        if (!inMST.includes(id) && key[id] !== undefined && key[id] < minCandidateKey) {
          minCandidateKey = key[id];
          minCandidateId = id;
        }
      }
    }

    const nodeCells = nodes.map((n) => {
      const nodeId = n.id || n.name;
      const k = key[nodeId];
      const p = parent[nodeId];
      const pLabel = p ? getNodeLabel(p, graph, context) : '-';
      const isSettled =
        (highlights.nodes &&
          highlights.nodes.includes(nodeId) &&
          step.action === AlgorithmAction.SELECT_NODE) ||
        (step.action === AlgorithmAction.RELAX_EDGE && nodeId === minCandidateId);
      const isVisited = inMST.includes(nodeId);
      const isUpdated =
        step.action === AlgorithmAction.RELAX_EDGE &&
        (Array.isArray(state.updatedNodes)
          ? state.updatedNodes.includes(nodeId)
          : highlights.nodes && highlights.nodes.includes(nodeId));

      if (isSettled) {
        return {
          nodeId,
          val: k !== undefined && k !== Infinity ? `(${k}, ${pLabel})*` : `(0, -)*`,
          type: 'settled',
        };
      }
      if (isVisited && !isSettled) {
        return {
          nodeId,
          val: '-',
          type: 'visited',
        };
      }
      if (k === undefined || k === Infinity) {
        return {
          nodeId,
          val: `(${inf}, -)`,
          type: 'init',
        };
      }
      return {
        nodeId,
        val: `(${k}, ${pLabel})`,
        type: isUpdated ? 'updated' : 'normal',
      };
    });

    const tvStr =
      inMST.length > 0
        ? `{ ${inMST.map((id) => getNodeLabel(id, graph, context)).join(', ')} }`
        : '∅';

    const teStr =
      acceptedEdges.length > 0
        ? `{ ${acceptedEdges
            .map(
              (e) =>
                `${getNodeLabel(e.from, graph, context)}-${getNodeLabel(e.to, graph, context)}`
            )
            .join(', ')} }`
        : '∅';

    const cells = [
      ...nodeCells,
      { val: tvStr, type: 'tv' },
      { val: teStr, type: 'te' },
      { val: String(totalWeight), type: 'weight' },
    ];

    return {
      type: 'prim',
      headers,
      rows: [
        {
          stepLabel,
          cells,
        },
      ],
    };
  }

  if (algoKey === 'kruskal') {
    const accepted = Array.isArray(state.acceptedEdges) ? state.acceptedEdges : [];
    const totalWeight = typeof state.totalWeight === 'number' ? state.totalWeight : 0;
    const componentCount =
      typeof state.componentCount === 'number' ? state.componentCount : nodes.length;

    const headers =
      lang === 'en'
        ? ['Step', 'Inspected Edge', 'Status', 'MST Edges', 'Total Weight', 'Components']
        : ['Bước', 'Cạnh xét', 'Trạng thái', 'Cạnh MST', 'Tổng trọng số', 'Thành phần'];

    const status = resolvePhase(step.action, 'kruskal', lang);
    let edgeStr = '-';
    if (highlights.edges && highlights.edges[0]) {
      edgeStr = highlights.edges[0];
    } else if (highlights.nodes && highlights.nodes.length >= 2) {
      edgeStr = `${getNodeLabel(highlights.nodes[0], graph, context)}-${getNodeLabel(
        highlights.nodes[1],
        graph,
        context
      )}`;
    }

    const mstStr =
      accepted.length > 0
        ? accepted
            .map(
              (e) =>
                `${getNodeLabel(e.from, graph, context)}-${getNodeLabel(e.to, graph, context)}`
            )
            .join(', ')
        : '∅';

    const cells = [
      { val: edgeStr, type: 'edge' },
      {
        val: status,
        type: step.action === AlgorithmAction.ACCEPT_EDGE ? 'settled' : 'normal',
      },
      { val: mstStr, type: 'mst' },
      { val: String(totalWeight), type: 'weight' },
      { val: String(componentCount), type: 'components' },
    ];

    return {
      type: 'kruskal',
      headers,
      rows: [
        {
          stepLabel,
          cells,
        },
      ],
    };
  }

  if (algoKey === 'euler') {
    const stack = Array.isArray(state.stack) ? state.stack : [];
    const circuit = Array.isArray(state.circuit) ? state.circuit : [];
    const type = state.type || '-';

    const headers =
      lang === 'en'
        ? ['Step', 'Action', 'Stack', 'Circuit', 'Type', 'Total Weight']
        : ['Bước', 'Hành động', 'Ngăn xếp (Stack)', 'Lộ trình (Circuit)', 'Loại', 'Tổng trọng số'];

    const stackStr =
      stack.length > 0
        ? stack.map((id) => getNodeLabel(id, graph, context)).join(' → ')
        : '∅';

    const circuitStr =
      circuit.length > 0
        ? circuit.map((id) => getNodeLabel(id, graph, context)).join(' → ')
        : '∅';

    const weightVal = typeof state.totalWeight === 'number' ? String(state.totalWeight) : '-';

    const cells = [
      { val: resolvePhase(step.action, 'euler', lang), type: 'action' },
      { val: stackStr, type: 'stack' },
      { val: circuitStr, type: 'circuit' },
      { val: String(type), type: 'type' },
      { val: weightVal, type: 'weight' },
    ];

    return {
      type: 'euler',
      headers,
      rows: [
        {
          stepLabel,
          cells,
        },
      ],
    };
  }

  if (algoKey === 'hamilton') {
    const path = Array.isArray(state.path) ? state.path : [];
    const visited = Array.isArray(state.visited) ? state.visited : [];
    const closesCycle = Boolean(state.closesCycle);

    const headers =
      lang === 'en'
        ? ['Step', 'Action', 'Current Path', 'Visited', 'Closes Cycle']
        : ['Bước', 'Hành động', 'Đường đi hiện tại', 'Đã thăm', 'Khép chu trình'];

    const pathStr =
      path.length > 0
        ? path.map((id) => getNodeLabel(id, graph, context)).join(' → ')
        : '∅';

    const visitedStr =
      visited.length > 0
        ? `{ ${visited.map((id) => getNodeLabel(id, graph, context)).join(', ')} }`
        : '∅';

    const cells = [
      { val: resolvePhase(step.action, 'hamilton', lang), type: 'action' },
      { val: pathStr, type: 'path' },
      { val: visitedStr, type: 'visited' },
      {
        val: closesCycle
          ? lang === 'en'
            ? 'Yes'
            : 'Có'
          : lang === 'en'
            ? 'No'
            : 'Không',
        type: 'cycle',
      },
    ];

    return {
      type: 'hamilton',
      headers,
      rows: [
        {
          stepLabel,
          cells,
        },
      ],
    };
  }

  return null;
}

/**
 * Formats auxiliary status pills for step inspection.
 * Note: Dijkstra returns null unless context.pq is explicitly supplied,
 * because Core AlgorithmStep does not capture internal MinHeap items.
 *
 * @param {Object} step
 * @param {Object} [graph]
 * @param {Object} [context={}]
 * @param {string} [algoKey='dijkstra']
 * @returns {Array<Object>|null}
 */
function formatPqPills(step, graph, context = {}, algoKey = 'dijkstra') {
  if (!step || !step.state) return null;
  const state = step.state;

  if (algoKey === 'dijkstra') {
    // Dijkstra live heap is unavailable in Core AlgorithmStep.state.
    // Strictly null unless explicit PQ data is supplied in context.
    if (Array.isArray(context.pq)) {
      return context.pq.map((item) => ({ ...item }));
    }
    return null;
  }

  if (algoKey === 'prim' || algoKey === 'kruskal') {
    if (Array.isArray(state.acceptedEdges)) {
      return state.acceptedEdges.map((e) => ({
        label: `${getNodeLabel(e.from, graph, context)}-${getNodeLabel(
          e.to,
          graph,
          context
        )} (${e.weight !== undefined ? e.weight : ''})`,
        type: 'mst-edge',
        from: e.from,
        to: e.to,
        weight: e.weight,
      }));
    }
    return null;
  }

  if (algoKey === 'euler') {
    if (Array.isArray(state.stack)) {
      return state.stack.map((id, idx) => ({
        label: `${idx + 1}. ${getNodeLabel(id, graph, context)}`,
        type: 'stack-node',
        nodeId: id,
      }));
    }
    return null;
  }

  if (algoKey === 'hamilton') {
    if (Array.isArray(state.path)) {
      return state.path.map((id, idx) => ({
        label: `${idx + 1}. ${getNodeLabel(id, graph, context)}`,
        type: 'path-node',
        nodeId: id,
      }));
    }
    return null;
  }

  return null;
}

/**
 * Formats a raw Core AlgorithmStep into a clean PresentationStep model.
 * Pure transformation function.
 *
 * @param {Object} step - Raw AlgorithmStep object
 * @param {Object} [graph] - Graph instance or duck-typed graph model
 * @param {Object} [context={}] - Optional formatting context
 * @returns {Object|null} Formatted PresentationStep model, or null if step is null/undefined
 */
export function formatStep(step, graph, context = {}) {
  if (!step || typeof step !== 'object') {
    return null;
  }

  const ctx = context && typeof context === 'object' ? context : {};
  const algoKey = (ctx.algorithmKey || 'dijkstra').toLowerCase();
  const lang = ctx.language === 'en' ? 'en' : 'vi';

  // 1. stepNumber (safe fallback)
  const stepNumber = typeof step.stepNumber === 'number' ? step.stepNumber : 1;

  // 2. action
  const action = step.action || 'UNKNOWN';

  // 3. phase
  const phase = resolvePhase(action, algoKey, lang);

  // 4. description
  const description = typeof step.description === 'string' ? step.description : '';

  // 5. formula
  const formula = deriveFormula(step, graph, ctx, algoKey);

  // 6. activeLines (strictly from ctx.codeMapping, defensively copied)
  let activeLines = [];
  if (ctx.codeMapping && typeof ctx.codeMapping === 'object') {
    const mapped = ctx.codeMapping[action];
    if (Array.isArray(mapped)) {
      activeLines = [...mapped];
    }
  }

  // 7. highlights (defensively copied)
  const rawHl = step.highlights || {};
  const highlights = {
    nodes: Array.isArray(rawHl.nodes) ? [...rawHl.nodes] : [],
    edges: Array.isArray(rawHl.edges) ? [...rawHl.edges] : [],
  };

  // 8. table
  const table = formatTable(step, graph, ctx);

  // 9. pqPills
  const pqPills = formatPqPills(step, graph, ctx, algoKey);

  return {
    stepNumber,
    action,
    phase,
    description,
    formula,
    activeLines,
    highlights,
    table,
    pqPills,
  };
}

/**
 * Static class container for StepFormatter API.
 */
export class StepFormatter {
  static formatStep = formatStep;
  static resolvePhase = resolvePhase;
  static formatTable = formatTable;
}

export default StepFormatter;
