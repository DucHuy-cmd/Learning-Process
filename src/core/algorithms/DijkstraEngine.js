/**
 * @file DijkstraEngine.js
 * Headless Core Engine - Dijkstra Shortest Path Algorithm
 * 
 * Fully DOM-independent, pure ES Module.
 * Consumes Graph model and MinHeap priority queue.
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';
import { MinHeap } from '../data-structures/MinHeap.js';

/**
 * Executes Dijkstra shortest path algorithm on a Graph.
 * 
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @param {string} startNodeId - Source node ID
 * @param {string|null} [targetNodeId=null] - Destination node ID (optional)
 * @returns {Object} Standardized AlgorithmResult
 */
export function dijkstra(graph, startNodeId, targetNodeId = null) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getNeighbors !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'dijkstra',
      message: 'Invalid graph instance provided',
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        visitedCount: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        heapPushes: 0,
        heapPops: 0,
        stalePops: 0,
      },
      warnings: ['Graph is missing or invalid'],
    };
  }

  if (!startNodeId || !graph.hasNode(startNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'dijkstra',
      message: `Start node "${startNodeId}" does not exist in graph`,
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        visitedCount: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        heapPushes: 0,
        heapPops: 0,
        stalePops: 0,
      },
      warnings: [`Start node "${startNodeId}" not found in graph`],
    };
  }

  if (targetNodeId !== null && targetNodeId !== undefined && !graph.hasNode(targetNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'dijkstra',
      message: `Target node "${targetNodeId}" does not exist in graph`,
      path: [],
      edges: [],
      totalWeight: null,
      steps: [],
      statistics: {
        visitedCount: 0,
        edgeInspections: 0,
        relaxationCount: 0,
        heapPushes: 0,
        heapPops: 0,
        stalePops: 0,
      },
      warnings: [`Target node "${targetNodeId}" not found in graph`],
    };
  }

  // Validate negative edge weights (Dijkstra does not support negative weights)
  for (const edge of graph.getEdges()) {
    if (edge.weight < 0) {
      return {
        status: AlgorithmStatus.UNSUPPORTED,
        type: 'dijkstra',
        message: `Dijkstra algorithm does not support negative edge weights (edge "${edge.id}" has weight ${edge.weight})`,
        path: [],
        edges: [],
        totalWeight: null,
        steps: [],
        statistics: {
          visitedCount: 0,
          edgeInspections: 0,
          relaxationCount: 0,
          heapPushes: 0,
          heapPops: 0,
          stalePops: 0,
        },
        warnings: ['Graph contains negative edge weights'],
      };
    }
  }

  // 2. STATE INITIALIZATION
  const dist = {};
  const prev = {};
  const allNodes = graph.getNodes();

  for (const node of allNodes) {
    dist[node.id] = Infinity;
    prev[node.id] = null;
  }
  dist[startNodeId] = 0;

  const visited = new Set();
  const heap = new MinHeap();
  heap.push({ distance: 0, node: startNodeId });

  const statistics = {
    visitedCount: 0,
    edgeInspections: 0,
    relaxationCount: 0,
    heapPushes: 1,
    heapPops: 0,
    stalePops: 0,
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
        visited: Array.from(visited),
        ...extraState,
      },
      highlights,
    }));
  }

  // Initial step
  recordStep(
    AlgorithmAction.INITIALIZE,
    `Khởi tạo: dist[${startNodeId}] = 0, tất cả các đỉnh khác có khoảng cách vô cùng (∞).`,
    { nodes: [startNodeId], edges: [] }
  );

  // 3. START == TARGET CASE
  if (targetNodeId !== null && targetNodeId !== undefined && startNodeId === targetNodeId) {
    visited.add(startNodeId);
    statistics.visitedCount = 1;

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
      type: 'dijkstra',
      message: `Đã tìm thấy đường đi từ ${startNodeId} đến ${targetNodeId}`,
      path: [startNodeId],
      edges: [],
      totalWeight: 0,
      steps,
      statistics,
      warnings: [],
    };
  }

  // 4. MAIN ALGORITHM LOOP
  let targetFound = false;

  while (!heap.isEmpty) {
    const top = heap.pop();
    statistics.heapPops++;
    const { distance: d, node: u } = top;

    // Stale heap entry (Lazy Deletion)
    if (visited.has(u) || d > dist[u]) {
      statistics.stalePops++;
      continue;
    }

    // Finalize node u
    visited.add(u);
    statistics.visitedCount++;

    recordStep(
      AlgorithmAction.SELECT_NODE,
      `Chọn đỉnh ${u} với khoảng cách tối ưu hiện tại nhỏ nhất: ${d}.`,
      { nodes: [u], edges: [] }
    );

    // Early termination if target reached
    if (targetNodeId !== null && targetNodeId !== undefined && u === targetNodeId) {
      targetFound = true;
      break;
    }

    // Inspect outgoing / incident neighbors
    const neighbors = graph.getNeighbors(u);
    const relaxed = [];
    const rejectedList = [];
    const allTouchedEdgeIds = [];

    for (const neighbor of neighbors) {
      const v = neighbor.node;
      const edgeId = neighbor.edgeId;
      const weight = neighbor.weight;

      if (visited.has(v)) {
        continue;
      }

      statistics.edgeInspections++;
      if (edgeId && !allTouchedEdgeIds.includes(edgeId)) {
        allTouchedEdgeIds.push(edgeId);
      }
      const candidateDist = dist[u] + weight;

      if (candidateDist < dist[v]) {
        const oldDist = dist[v];
        dist[v] = candidateDist;
        prev[v] = u;
        heap.push({ distance: candidateDist, node: v });
        statistics.heapPushes++;
        statistics.relaxationCount++;
        relaxed.push({ node: v, oldDist, newDist: candidateDist });
      } else {
        rejectedList.push({ node: v, candidateDist, currentDist: dist[v] });
      }
    }

    // Xây mô tả tổng hợp, liệt kê từng đỉnh kề đã xét (1 hàng duy nhất cho đỉnh u)
    const parts = [];
    for (const r of relaxed) {
      parts.push(`${r.node}: ${r.oldDist === Infinity ? '∞' : r.oldDist} → ${r.newDist} (qua ${u})`);
    }
    for (const rj of rejectedList) {
      parts.push(`${rj.node}: giữ nguyên ${rj.currentDist} (không tốt hơn)`);
    }

    const desc = parts.length > 0
      ? `Xét các đỉnh kề của ${u}: ${parts.join('; ')}.`
      : `Xét các đỉnh kề của ${u}: không có cạnh kề nào để xét.`;

    recordStep(
      AlgorithmAction.RELAX_EDGE,
      desc,
      { nodes: [u, ...relaxed.map(r => r.node), ...rejectedList.map(r => r.node)], edges: allTouchedEdgeIds },
      { updatedNodes: relaxed.map(r => r.node) }
    );
  }

  // 5. PATH RECONSTRUCTION & RESULT GENERATION
  if (targetNodeId !== null && targetNodeId !== undefined) {
    const reachable = targetFound || (dist[targetNodeId] !== Infinity && visited.has(targetNodeId));

    if (reachable) {
      const path = [];
      let curr = targetNodeId;
      while (curr !== null && curr !== undefined) {
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
          type: 'dijkstra',
          message: `Lỗi truy vết đường đi từ ${startNodeId} đến ${targetNodeId}`,
          path: [],
          edges: [],
          totalWeight: null,
          steps,
          statistics,
          warnings: ['Path reconstruction failed to reach start node'],
        };
      }

      // Collect edge IDs along the path
      const pathEdges = [];
      for (let i = 0; i < path.length - 1; i++) {
        const uNode = path[i];
        const vNode = path[i + 1];
        const neighbors = graph.getNeighbors(uNode);
        const match = neighbors.find(n => n.node === vNode);
        if (match) {
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
        type: 'dijkstra',
        message: `Đã tìm thấy đường đi ngắn nhất: ${path.join(' → ')} (chi phí: ${totalDistance})`,
        path,
        edges: pathEdges,
        totalWeight: totalDistance,
        steps,
        statistics,
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
        type: 'dijkstra',
        message: `Không tồn tại đường đi từ ${startNodeId} đến ${targetNodeId}`,
        path: [],
        edges: [],
        totalWeight: null,
        steps,
        statistics,
        warnings: [`Target node "${targetNodeId}" is unreachable from "${startNodeId}"`],
      };
    }
  }

  // If no targetNodeId specified: single-source all-destinations exploration
  recordStep(
    AlgorithmAction.FINISH,
    `Hoàn tất tìm đường đi ngắn nhất từ ${startNodeId} đến tất cả các đỉnh liên thông.`,
    { nodes: Array.from(visited), edges: [] }
  );

  return {
    status: AlgorithmStatus.SUCCESS,
    type: 'dijkstra',
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

export const DijkstraEngine = {
  run: dijkstra,
};
