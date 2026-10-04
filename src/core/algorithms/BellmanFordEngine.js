/**
 * @file BellmanFordEngine.js
 * Headless Core Engine - Bellman-Ford Shortest Path Algorithm
 * 
 * Fully DOM-independent, pure ES Module.
 * Consumes Graph model and computes single-source shortest paths on directed/undirected graphs.
 * Supports negative edge weights and detects negative weight cycles.
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';

/**
 * Traces a negative weight cycle starting from a node that can still be relaxed.
 * 
 * @param {string} startV - A node whose distance can be relaxed in the V-th iteration
 * @param {Record<string, string|null>} prev - Predecessor map
 * @param {number} nodeCount - Total number of nodes in graph
 * @param {import('../models/Graph.js').Graph} graph - Graph instance
 * @returns {{ cycleNodes: string[], cycleEdges: string[] }}
 */
function traceNegativeCycle(startV, prev, nodeCount, graph) {
  // Step backward |V| times to guarantee entering the cycle
  let curr = startV;
  for (let i = 0; i < nodeCount; i++) {
    if (prev[curr]) {
      curr = prev[curr];
    }
  }

  // Now trace the cycle until we return to curr
  const cycle = [];
  let tracer = curr;
  const visitedSet = new Set();

  while (!visitedSet.has(tracer)) {
    visitedSet.add(tracer);
    cycle.push(tracer);
    tracer = prev[tracer] || tracer;
    if (tracer === curr) break;
  }
  cycle.reverse();

  // Find edge IDs along the cycle
  const cycleEdges = [];
  for (let i = 0; i < cycle.length; i++) {
    const u = cycle[i];
    const v = cycle[(i + 1) % cycle.length];
    const neighbors = graph.getNeighbors ? graph.getNeighbors(u) : [];
    const match = neighbors.find(n => (n.node || n.nodeId) === v);
    if (match && match.edgeId) {
      cycleEdges.push(match.edgeId);
    }
  }

  return {
    cycleNodes: cycle,
    cycleEdges,
  };
}

/**
 * Executes Bellman-Ford shortest path algorithm on a Graph.
 * 
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @param {string} startNodeId - Source node ID
 * @param {string|null} [targetNodeId=null] - Destination node ID (optional)
 * @returns {Object} Standardized AlgorithmResult
 */
export function bellmanFord(graph, startNodeId, targetNodeId = null) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getNodes !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'bellman_ford',
      message: 'Invalid graph instance provided',
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        iterations: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        negativeCycleDetected: false,
      },
      warnings: ['Graph is missing or invalid'],
    };
  }

  if (!startNodeId || !graph.hasNode(startNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'bellman_ford',
      message: `Start node "${startNodeId}" does not exist in graph`,
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        iterations: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        negativeCycleDetected: false,
      },
      warnings: [`Start node "${startNodeId}" not found in graph`],
    };
  }

  if (targetNodeId !== null && targetNodeId !== undefined && !graph.hasNode(targetNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'bellman_ford',
      message: `Target node "${targetNodeId}" does not exist in graph`,
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        iterations: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        negativeCycleDetected: false,
      },
      warnings: [`Target node "${targetNodeId}" not found in graph`],
    };
  }

  // 2. EXTRACT GRAPH TOPOLOGY & DIRECTED EDGES
  const allNodes = graph.getNodes();
  const numNodes = allNodes.length;
  const isDirected = Boolean(graph.isDirected);

  // Collect all edges for Bellman-Ford relaxation
  // For undirected graphs, each undirected edge (u, v) is treated as two directed arcs (u -> v) and (v -> u)
  const edgeList = [];
  const rawEdges = graph.getEdges ? graph.getEdges() : [];

  for (const edge of rawEdges) {
    const u = edge.from;
    const v = edge.to;
    const w = typeof edge.weight === 'number' ? edge.weight : 1;
    const edgeId = edge.id;

    edgeList.push({ from: u, to: v, weight: w, edgeId });
    if (!isDirected && u !== v) {
      edgeList.push({ from: v, to: u, weight: w, edgeId });
    }
  }

  // Sort arcs by (x, y) following node order so each pass scans edges exactly like the
  // textbook table: (1,2), (1,5), (2,3), (2,4), ...
  const nodeOrder = new Map(allNodes.map((n, idx) => [n.id, idx]));
  edgeList.sort((a, b) => {
    const fa = nodeOrder.get(a.from) ?? 0;
    const fb = nodeOrder.get(b.from) ?? 0;
    if (fa !== fb) return fa - fb;
    return (nodeOrder.get(a.to) ?? 0) - (nodeOrder.get(b.to) ?? 0);
  });

  // 3. STATE INITIALIZATION
  const dist = {};
  const prev = {};

  for (const node of allNodes) {
    dist[node.id] = Infinity;
    prev[node.id] = null;
  }
  dist[startNodeId] = 0;

  const statistics = {
    iterations: 0,
    edgeInspections: 0,
    relaxationCount: 0,
    negativeCycleDetected: false,
  };

  const steps = [];
  let stepCounter = 0;

  function recordStep(action, description, highlights = {}, extraState = {}) {
    stepCounter++;
    steps.push(createStep({
      stepNumber: stepCounter,
      action,
      description,
      state: {
        dist: { ...dist },
        prev: { ...prev },
        iteration: statistics.iterations,
        ...extraState,
      },
      highlights,
    }));
  }

  // Initial step
  recordStep(
    AlgorithmAction.INITIALIZE,
    `Khởi tạo Bellman-Ford: dist[${startNodeId}] = 0, tất cả các đỉnh khác có khoảng cách vô cùng (∞).`,
    { nodes: [startNodeId], edges: [] }
  );

  // 4. START == TARGET SPECIAL CASE
  if (targetNodeId !== null && targetNodeId !== undefined && startNodeId === targetNodeId) {
    // Check if graph has immediate negative self-loop or cycle
    let hasSelfNegativeLoop = false;
    for (const edge of edgeList) {
      if (edge.from === startNodeId && edge.to === startNodeId && edge.weight < 0) {
        hasSelfNegativeLoop = true;
        break;
      }
    }

    if (!hasSelfNegativeLoop) {
      recordStep(
        AlgorithmAction.SELECT_NODE,
        `Chọn đỉnh ${startNodeId} với khoảng cách 0. Đích trùng với nguồn.`,
        { nodes: [startNodeId], edges: [] }
      );

      recordStep(
        AlgorithmAction.FINISH,
        `Hoàn tất! Đỉnh đích ${targetNodeId} trùng với đỉnh bắt đầu ${startNodeId}. Tổng khoảng cách = 0.`,
        { nodes: [startNodeId], edges: [] },
        { totalWeight: 0 }
      );

      return {
        status: AlgorithmStatus.SUCCESS,
        type: 'bellman_ford',
        message: `Đã tìm thấy đường đi từ ${startNodeId} đến ${targetNodeId}`,
        path: [startNodeId],
        edges: [],
        totalWeight: 0,
        steps,
        statistics,
        distances: { ...dist },
        predecessors: { ...prev },
        warnings: [],
      };
    }
  }

  // 5. MAIN RELAXATION LOOPS (|V| - 1 iterations)
  const maxIterations = Math.max(1, numNodes - 1);
  let stoppedEarly = false;

  for (let k = 1; k <= maxIterations; k++) {
    statistics.iterations = k;
    let anyRelaxation = false;
    const relaxedInThisIteration = [];
    const relaxedEdgesInThisIteration = [];

    // Milestone step for starting round k
    recordStep(
      AlgorithmAction.SELECT_NODE,
      `Vòng lặp ${k}/${maxIterations}: Duyệt toàn bộ ${edgeList.length} cạnh để tìm các cạnh có thể giãn (Relax).`,
      { nodes: [startNodeId], edges: [] },
      { iteration: k, roundStart: true }
    );

    for (let e = 0; e < edgeList.length; e++) {
      const { from: u, to: v, weight: w, edgeId } = edgeList[e];
      statistics.edgeInspections++;
      const edgeInfo = { from: u, to: v, weight: w };

      if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
        const oldDist = dist[v];
        const newDist = dist[u] + w;
        dist[v] = newDist;
        prev[v] = u;
        anyRelaxation = true;
        statistics.relaxationCount++;

        relaxedInThisIteration.push({ u, v, oldDist, newDist, w, edgeId });
        if (edgeId && !relaxedEdgesInThisIteration.includes(edgeId)) {
          relaxedEdgesInThisIteration.push(edgeId);
        }

        recordStep(
          AlgorithmAction.RELAX_EDGE,
          `Lần ${k}: Giãn cạnh (${u},${v}) trọng số ${w}: dist[${v}] cập nhật từ ${oldDist === Infinity ? '∞' : oldDist} thành ${newDist} (qua ${u}).`,
          { nodes: [u, v], edges: [edgeId] },
          { updatedNodes: [v], relaxedEdge: edgeId, from: u, to: v, iteration: k, edge: edgeInfo, edgeIndex: e, relaxed: true }
        );
      } else {
        const reason = dist[u] === Infinity
          ? `dist[${u}] = ∞ nên chưa thể giãn.`
          : `dist[${u}] + ${w} = ${dist[u] + w} ≥ dist[${v}] = ${dist[v] === Infinity ? '∞' : dist[v]} nên không giãn.`;
        recordStep(
          AlgorithmAction.INSPECT_EDGE,
          `Lần ${k}: Xét cạnh (${u},${v}) trọng số ${w}: ${reason}`,
          { nodes: [u, v], edges: [edgeId] },
          { iteration: k, edge: edgeInfo, edgeIndex: e, relaxed: false }
        );
      }
    }

    // End of pass: KQ row (distances after this pass)
    const passEndMsg = anyRelaxation
      ? `Kết thúc lần ${k}/${maxIterations} (KQ): có ${relaxedInThisIteration.length} lần giãn cạnh, bảng khoảng cách sau lần ${k} đã được cập nhật.`
      : `Kết thúc lần ${k}/${maxIterations} (KQ): không có cạnh nào được giãn thêm. Bảng khoảng cách đã tối ưu, dừng thuật toán sớm.`;
    recordStep(
      AlgorithmAction.SELECT_NODE,
      passEndMsg,
      { nodes: [startNodeId], edges: [] },
      { iteration: k, passEnd: true, earlyStop: !anyRelaxation }
    );

    // Early termination: If no distance updated in this entire iteration, optimal distances reached
    if (!anyRelaxation) {
      stoppedEarly = true;
      break;
    }
  }

  // 6. NEGATIVE CYCLE CHECK (|V|-th iteration)
  let negativeCycleFound = false;
  let cycleInfo = null;

  for (const edge of edgeList) {
    const { from: u, to: v, weight: w, edgeId } = edge;
    if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
      negativeCycleFound = true;
      statistics.negativeCycleDetected = true;
      cycleInfo = traceNegativeCycle(v, prev, numNodes, graph);
      if (edgeId && !cycleInfo.cycleEdges.includes(edgeId)) {
        cycleInfo.cycleEdges.push(edgeId);
      }
      break;
    }
  }

  if (negativeCycleFound && cycleInfo) {
    const cycleStr = cycleInfo.cycleNodes.length > 0
      ? `${cycleInfo.cycleNodes.join(' → ')} → ${cycleInfo.cycleNodes[0]}`
      : 'Chu trình âm';

    recordStep(
      AlgorithmAction.ERROR,
      `Phát hiện chu trình âm (Negative Weight Cycle): ${cycleStr}! Đồ thị có chu trình âm làm khoảng cách có thể giảm vô hạn (−∞).`,
      { nodes: cycleInfo.cycleNodes, edges: cycleInfo.cycleEdges },
      { hasNegativeCycle: true, cycleNodes: cycleInfo.cycleNodes, cycleEdges: cycleInfo.cycleEdges }
    );

    return {
      status: AlgorithmStatus.FAILURE,
      type: 'bellman_ford',
      message: `Đồ thị chứa chu trình âm (Negative Cycle): ${cycleStr}`,
      hasNegativeCycle: true,
      negativeCycle: cycleInfo.cycleNodes,
      negativeCycleEdges: cycleInfo.cycleEdges,
      path: [],
      edges: cycleInfo.cycleEdges,
      totalWeight: null,
      steps,
      statistics,
      distances: { ...dist },
      predecessors: { ...prev },
      warnings: ['Graph contains negative weight cycle reachable from source'],
    };
  }

  // 7. PATH RECONSTRUCTION & RESULT GENERATION
  if (targetNodeId !== null && targetNodeId !== undefined) {
    const reachable = dist[targetNodeId] !== Infinity;

    if (reachable) {
      const path = [];
      let curr = targetNodeId;
      const visitedForLoop = new Set();

      while (curr !== null && curr !== undefined) {
        if (visitedForLoop.has(curr)) break;
        visitedForLoop.add(curr);
        path.push(curr);
        if (curr === startNodeId) break;
        curr = prev[curr];
      }
      path.reverse();

      if (path[0] !== startNodeId) {
        recordStep(
          AlgorithmAction.ERROR,
          `Lỗi: Không thể truy vết đường đi từ ${startNodeId} đến ${targetNodeId}.`,
          { nodes: [], edges: [] }
        );
        return {
          status: AlgorithmStatus.FAILURE,
          type: 'bellman_ford',
          message: `Lỗi truy vết đường đi từ ${startNodeId} đến ${targetNodeId}`,
          path: [],
          edges: [],
          totalWeight: null,
          steps,
          statistics,
          distances: { ...dist },
          predecessors: { ...prev },
          warnings: ['Path reconstruction failed to reach start node'],
        };
      }

      // Collect edge IDs along the path
      const pathEdges = [];
      for (let i = 0; i < path.length - 1; i++) {
        const uNode = path[i];
        const vNode = path[i + 1];
        const neighbors = graph.getNeighbors ? graph.getNeighbors(uNode) : [];
        const match = neighbors.find(n => (n.node || n.nodeId) === vNode);
        if (match && match.edgeId) {
          pathEdges.push(match.edgeId);
        }
      }

      const totalDistance = dist[targetNodeId];

      recordStep(
        AlgorithmAction.FINISH,
        `Hoàn tất! Đường đi ngắn nhất từ ${startNodeId} đến ${targetNodeId}: ${path.join(' → ')}. Tổng khoảng cách: ${totalDistance}.`,
        { nodes: [...path], edges: [...pathEdges] },
        { totalWeight: totalDistance }
      );

      return {
        status: AlgorithmStatus.SUCCESS,
        type: 'bellman_ford',
        message: `Đã tìm thấy đường đi ngắn nhất: ${path.join(' → ')} (chi phí: ${totalDistance})`,
        path,
        edges: pathEdges,
        totalWeight: totalDistance,
        steps,
        statistics,
        distances: { ...dist },
        predecessors: { ...prev },
        warnings: [],
      };
    } else {
      // Target is unreachable
      recordStep(
        AlgorithmAction.FINISH,
        `Không tồn tại đường đi từ ${startNodeId} đến ${targetNodeId}.`,
        { nodes: [targetNodeId], edges: [] }
      );

      return {
        status: AlgorithmStatus.UNREACHABLE,
        type: 'bellman_ford',
        message: `Không tồn tại đường đi từ ${startNodeId} đến ${targetNodeId}`,
        path: [],
        edges: [],
        totalWeight: null,
        steps,
        statistics,
        distances: { ...dist },
        predecessors: { ...prev },
        warnings: [`Target node "${targetNodeId}" is unreachable from "${startNodeId}"`],
      };
    }
  }

  // No specific target: Single-source all destinations exploration
  recordStep(
    AlgorithmAction.FINISH,
    `Hoàn tất! Đã tính toán xong khoảng cách từ ${startNodeId} đến tất cả các đỉnh liên thông.`,
    { nodes: allNodes.filter(n => dist[n.id] !== Infinity).map(n => n.id), edges: [] }
  );

  return {
    status: AlgorithmStatus.SUCCESS,
    type: 'bellman_ford',
    message: `Đã tính toán xong khoảng cách từ ${startNodeId} đến tất cả các đỉnh liên thông`,
    path: [],
    edges: [],
    totalWeight: null,
    steps,
    statistics,
    distances: { ...dist },
    predecessors: { ...prev },
    warnings: [],
  };
}

export const BellmanFordEngine = {
  run: bellmanFord,
};

export default BellmanFordEngine;
