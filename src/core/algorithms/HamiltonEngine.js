/**
 * @file HamiltonEngine.js
 * Headless Core Engine - Hamilton Cycle and Path Algorithm (Backtracking)
 * 
 * Fully DOM-independent, pure ES Module.
 * Supports both Undirected and Directed graphs.
 * Preserves 100% legacy backtracking semantics, candidate order (0..n-1),
 * start node resolution, cycle/path contracts, and safety cap truncation.
 * 
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';

/**
 * Executes Hamilton backtracking algorithm on a Graph instance.
 * 
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @param {string|Object|null} [startOrOptions=null] - Start node ID or options object
 * @param {boolean} [maybeWantCycle=true] - Whether to search for cycle (true) or path (false)
 * @returns {Object} Standardized AlgorithmResult with Hamilton-specific fields
 */
export function hamilton(graph, startOrOptions = null, maybeWantCycle = true) {
  // Parse options
  let startNodeId = null;
  let wantCycle = true;

  if (typeof startOrOptions === 'object' && startOrOptions !== null) {
    startNodeId = startOrOptions.startNodeId ?? startOrOptions.start ?? null;
    if (typeof startOrOptions.wantCycle === 'boolean') {
      wantCycle = startOrOptions.wantCycle;
    } else if (startOrOptions.mode === 'path') {
      wantCycle = false;
    } else if (startOrOptions.mode === 'cycle') {
      wantCycle = true;
    }
  } else {
    startNodeId = startOrOptions;
    wantCycle = typeof maybeWantCycle === 'boolean' ? maybeWantCycle : Boolean(maybeWantCycle);
  }

  // 1. INPUT VALIDATION: Graph instance
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getNodes !== 'function' || typeof graph.getEdges !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'hamilton',
      subType: wantCycle ? 'cycle' : 'path',
      found: false,
      resultPath: null,
      path: [],
      closesCycle: false,
      truncated: false,
      chosenStart: null,
      steps: [],
      statistics: {
        vertexCount: 0,
        edgeCount: 0,
        stepCount: 0,
        cap: 200000,
        truncated: false,
        isDirected: false,
        startNodeId: null,
        found: false,
        closesCycle: false,
      },
      warnings: ['Graph is missing or invalid'],
      message: 'Invalid graph instance provided',
    };
  }

  const allNodes = graph.getNodes();
  const n = allNodes.length;
  const isDirected = Boolean(graph.isDirected);
  const rawEdges = graph.getEdges();
  const edgeCount = rawEdges.length;
  const cap = n > 12 ? 30000 : 200000;

  // 2. INPUT VALIDATION: startNodeId
  if (startNodeId !== null && startNodeId !== undefined && !graph.hasNode(startNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'hamilton',
      subType: wantCycle ? 'cycle' : 'path',
      found: false,
      resultPath: null,
      path: [],
      closesCycle: false,
      truncated: false,
      chosenStart: null,
      steps: [],
      statistics: {
        vertexCount: n,
        edgeCount,
        stepCount: 0,
        cap,
        truncated: false,
        isDirected,
        startNodeId,
        found: false,
        closesCycle: false,
      },
      warnings: [`Start node "${startNodeId}" does not exist in graph`],
      message: `Start node "${startNodeId}" does not exist in graph`,
    };
  }

  // 3. ZERO-VERTEX GRAPH
  if (n === 0) {
    return {
      status: AlgorithmStatus.FAILURE,
      type: 'hamilton',
      subType: wantCycle ? 'cycle' : 'path',
      found: false,
      resultPath: null,
      path: [],
      closesCycle: false,
      truncated: false,
      chosenStart: null,
      steps: [],
      statistics: {
        vertexCount: 0,
        edgeCount: 0,
        stepCount: 0,
        cap,
        truncated: false,
        isDirected,
        startNodeId: null,
        found: false,
        closesCycle: false,
      },
      warnings: ['Graph has zero vertices'],
      message: 'Graph has no vertices to search for Hamilton path or cycle',
    };
  }

  // Map node IDs to 0-based insertion indices matching legacy node order
  const nodeIndexMap = new Map();
  allNodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

  // Resolve start node index (default to index 0 if not provided)
  let startIndex = 0;
  if (startNodeId !== null && startNodeId !== undefined) {
    startIndex = nodeIndexMap.get(startNodeId);
  }
  const chosenStartId = allNodes[startIndex].id;

  // 4. BUILD ADJACENCY MATRIX (adjBool)
  const adjBool = Array.from({ length: n }, () => new Array(n).fill(false));
  rawEdges.forEach(e => {
    const u = nodeIndexMap.get(e.from);
    const v = nodeIndexMap.get(e.to);
    if (u !== undefined && v !== undefined) {
      adjBool[u][v] = true;
      if (!isDirected) {
        adjBool[v][u] = true;
      }
    }
  });

  // 5. BACKTRACKING STATE
  const visited = new Array(n).fill(false);
  const path = [startIndex];
  visited[startIndex] = true;

  const steps = [];
  let stepNumberCounter = 1;
  let found = false;
  let resultPath = null;
  let stepCount = 0;
  let truncated = false;

  // Step 1: Initialize
  steps.push(createStep({
    stepNumber: stepNumberCounter++,
    action: AlgorithmAction.INITIALIZE,
    description: `Bắt đầu quay lui từ đỉnh ${allNodes[startIndex].label || allNodes[startIndex].id}. Mục tiêu: ${wantCycle ? 'chu trình' : 'đường đi'} Hamilton${isDirected ? ' (có hướng)' : ''}.`,
    state: {
      path: [allNodes[startIndex].id],
      visited: [allNodes[startIndex].id],
      currentNodeId: allNodes[startIndex].id,
      wantCycle,
      isDirected,
    },
    highlights: {
      nodes: [allNodes[startIndex].id],
      edges: [],
    },
  }));

  // Backtracking function
  function backtrack() {
    if (truncated || found) return;
    stepCount++;
    if (stepCount > cap) {
      truncated = true;
      return;
    }

    if (path.length === n) {
      if (wantCycle) {
        if (adjBool[path[n - 1]][path[0]]) {
          found = true;
          resultPath = path.slice();
          steps.push(createStep({
            stepNumber: stepNumberCounter++,
            action: AlgorithmAction.FINISH,
            description: `Đã đi qua đủ ${n} đỉnh và có cạnh nối về đỉnh đầu ${allNodes[startIndex].label || allNodes[startIndex].id} → Tìm thấy CHU TRÌNH Hamilton!`,
            state: {
              path: resultPath.map(i => allNodes[i].id),
              closesCycle: true,
              found: true,
            },
            highlights: {
              nodes: resultPath.map(i => allNodes[i].id),
              edges: [],
            },
          }));
        } else {
          steps.push(createStep({
            stepNumber: stepNumberCounter++,
            action: AlgorithmAction.BACKTRACK,
            description: `Đủ ${n} đỉnh nhưng không có cạnh từ ${allNodes[path[n - 1]].label || allNodes[path[n - 1]].id} về ${allNodes[startIndex].label || allNodes[startIndex].id} để khép chu trình → Quay lui.`,
            state: {
              path: path.map(i => allNodes[i].id),
              closesCycle: false,
              deadend: true,
            },
            highlights: {
              nodes: path.map(i => allNodes[i].id),
              edges: [],
            },
          }));
        }
      } else {
        found = true;
        resultPath = path.slice();
        steps.push(createStep({
          stepNumber: stepNumberCounter++,
          action: AlgorithmAction.FINISH,
          description: `Đã đi qua tất cả ${n} đỉnh đúng một lần → Tìm thấy ĐƯỜNG ĐI Hamilton!`,
          state: {
            path: resultPath.map(i => allNodes[i].id),
            closesCycle: false,
            found: true,
          },
          highlights: {
            nodes: resultPath.map(i => allNodes[i].id),
            edges: [],
          },
        }));
      }
      return;
    }

    // Try candidates strictly in insertion index order 0 .. n-1
    for (let v = 0; v < n; v++) {
      if (found || truncated) return;
      if (!visited[v] && adjBool[path[path.length - 1]][v]) {
        visited[v] = true;
        path.push(v);

        steps.push(createStep({
          stepNumber: stepNumberCounter++,
          action: AlgorithmAction.SELECT_NODE,
          description: `Thử thêm đỉnh ${allNodes[v].label || allNodes[v].id} vào đường đi hiện tại.`,
          state: {
            path: path.map(i => allNodes[i].id),
            visited: allNodes.filter((_, idx) => visited[idx]).map(nd => nd.id),
            currentNodeId: allNodes[v].id,
          },
          highlights: {
            nodes: path.map(i => allNodes[i].id),
            edges: [],
          },
        }));

        backtrack();

        if (!found && !truncated) {
          const popped = path.pop();
          visited[popped] = false;

          steps.push(createStep({
            stepNumber: stepNumberCounter++,
            action: AlgorithmAction.BACKTRACK,
            description: `Không thể mở rộng thêm nhánh từ ${allNodes[popped].label || allNodes[popped].id} → Quay lui, bỏ đỉnh này khỏi đường đi.`,
            state: {
              path: path.map(i => allNodes[i].id),
              visited: allNodes.filter((_, idx) => visited[idx]).map(nd => nd.id),
              backtrackedFrom: allNodes[popped].id,
            },
            highlights: {
              nodes: path.map(i => allNodes[i].id),
              edges: [],
            },
          }));
        }
      }
    }
  }

  backtrack();

  const resultPathIds = found ? resultPath.map(idx => allNodes[idx].id) : null;
  const startLabel = allNodes[startIndex].label || allNodes[startIndex].id;

  const finalDesc = found
    ? (wantCycle
        ? `Tìm thấy CHU TRÌNH Hamilton${isDirected ? ' có hướng' : ''}: ${resultPathIds.join(' → ')} → ${resultPathIds[0]}.`
        : `Tìm thấy ĐƯỜNG ĐI Hamilton${isDirected ? ' có hướng' : ''}: ${resultPathIds.join(' → ')}.`)
    : truncated
      ? `Đồ thị có ${n} đỉnh với không gian trạng thái quá lớn — hệ thống dừng sau ${cap} bước quay lui để bảo vệ trình duyệt.`
      : `KHÔNG TỒN TẠI ${wantCycle ? 'chu trình' : 'đường đi'} Hamilton${isDirected ? ' có hướng' : ''} xuất phát từ ${startLabel} (đã thử hết các nhánh quay lui).`;

  steps.push(createStep({
    stepNumber: stepNumberCounter++,
    action: AlgorithmAction.FINISH,
    description: finalDesc,
    state: {
      path: found ? [...resultPathIds] : [],
      found,
      truncated,
      closesCycle: found && wantCycle,
    },
    highlights: {
      nodes: found ? [...resultPathIds] : [],
      edges: [],
    },
  }));

  const warnings = [];
  if (truncated) {
    warnings.push(`Hamilton backtracking exceeded step limit (${cap}) and was truncated`);
  } else if (!found) {
    warnings.push(`No Hamilton ${wantCycle ? 'cycle' : 'path'} found starting from "${chosenStartId}"`);
  }

  return {
    status: found ? AlgorithmStatus.SUCCESS : AlgorithmStatus.FAILURE,
    type: 'hamilton',
    subType: wantCycle ? 'cycle' : 'path',
    found,
    resultPath: resultPathIds,
    path: resultPathIds || [],
    closesCycle: found && wantCycle,
    truncated,
    chosenStart: chosenStartId,
    steps,
    statistics: {
      vertexCount: n,
      edgeCount,
      stepCount,
      cap,
      truncated,
      isDirected,
      startNodeId: chosenStartId,
      found,
      closesCycle: found && wantCycle,
    },
    warnings,
    message: finalDesc,
  };
}

export class HamiltonEngine {
  /**
   * @param {import('../models/Graph.js').Graph} graph
   * @param {string|Object|null} [startOrOptions=null]
   * @param {boolean} [wantCycle=true]
   */
  constructor(graph, startOrOptions = null, wantCycle = true) {
    this.graph = graph;
    if (typeof startOrOptions === 'object' && startOrOptions !== null) {
      this.startNodeId = startOrOptions.startNodeId ?? startOrOptions.start ?? null;
      this.wantCycle = startOrOptions.wantCycle ?? (startOrOptions.mode === 'path' ? false : true);
    } else {
      this.startNodeId = startOrOptions;
      this.wantCycle = wantCycle;
    }
  }

  /**
   * Runs Hamilton backtracking algorithm
   * @returns {Object} AlgorithmResult
   */
  run() {
    return hamilton(this.graph, this.startNodeId, this.wantCycle);
  }
}
