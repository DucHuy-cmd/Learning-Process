/**
 * @file EulerEngine.js
 * Headless Core Engine - Euler Circuit and Path Algorithm (Hierholzer's Algorithm)
 *
 * Fully DOM-independent, pure ES Module.
 * Supports both Undirected and Directed graphs.
 * Preserves 100% observable legacy Hierholzer semantics, weak connectivity
 * verification, start/end node selection rules, and insertion-order edge traversal.
 *
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';

/**
 * Executes Euler algorithm on a Graph instance.
 *
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @param {string|null} [startNodeId=null] - Optional starting vertex ID
 * @returns {Object} Standardized AlgorithmResult with Euler-specific fields
 */
export function euler(graph, startNodeId = null) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getEdges !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'invalid',
      subType: 'invalid',
      message: 'Invalid graph instance provided',
      circuit: [],
      path: [],
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: 0,
        edgeCount: 0,
        circuitVertexCount: 0,
        circuitEdgeCount: 0,
        oddDegreeCount: 0,
        startCandidatesCount: 0,
        endCandidatesCount: 0,
        unbalancedCount: 0,
        isDirected: false,
        connected: false,
      },
      warnings: ['Graph is missing or invalid'],
      connected: false,
      components: [],
      chosenStart: null,
      chosenEnd: null,
      odd: [],
      startCandidates: [],
      endCandidates: [],
    };
  }

  // Validate startNodeId if explicitly specified
  if (startNodeId !== null && startNodeId !== undefined && !graph.hasNode(startNodeId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'invalid',
      subType: 'invalid',
      message: `Start node "${startNodeId}" does not exist in graph`,
      circuit: [],
      path: [],
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: graph.nodeCount || 0,
        edgeCount: graph.edgeCount || 0,
        circuitVertexCount: 0,
        circuitEdgeCount: 0,
        oddDegreeCount: 0,
        startCandidatesCount: 0,
        endCandidatesCount: 0,
        unbalancedCount: 0,
        isDirected: Boolean(graph.isDirected),
        connected: false,
      },
      warnings: [`Start node "${startNodeId}" not found in graph`],
      connected: false,
      components: [],
      chosenStart: null,
      chosenEnd: null,
      odd: [],
      startCandidates: [],
      endCandidates: [],
    };
  }

  const allNodes = graph.getNodes();
  const n = allNodes.length;
  const isDirected = Boolean(graph.isDirected);

  // Map node IDs to 0-based insertion indices matching legacy node order
  const nodeIndexMap = new Map();
  allNodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

  let providedStartIndex = -1;
  if (startNodeId !== null && startNodeId !== undefined) {
    providedStartIndex = nodeIndexMap.get(startNodeId);
  }

  // Edges in exact insertion order
  const rawEdges = graph.getEdges();
  const edgeCount = rawEdges.length;

  const steps = [];
  let stepCount = 1;

  // ---------------------------------------------------------------------------
  // 2. GRAPH DEGREE & CONNECTIVITY ANALYSIS
  // ---------------------------------------------------------------------------
  let type = null;
  let typeTitle = "";
  let reason = "";
  let isConnected = false;
  let components = [];
  let chosenStart = null;
  let chosenEnd = null;

  // Data structures for Hierholzer
  const adjLocal = Array.from({ length: n }, () => []);
  const inDegree = new Array(n).fill(0);
  const outDegree = new Array(n).fill(0);
  const degree = new Array(n).fill(0);
  const odd = [];
  const startCandidates = [];
  const endCandidates = [];
  let unbalancedCount = 0;

  if (isDirected) {
    // DIRECTED GRAPH
    rawEdges.forEach((e, idx) => {
      const u = nodeIndexMap.get(e.from);
      const v = nodeIndexMap.get(e.to);
      outDegree[u]++;
      inDegree[v]++;
      adjLocal[u].push({ to: v, id: idx, edge: e });
    });

    const activeNodes = [];
    for (let i = 0; i < n; i++) {
      if (inDegree[i] > 0 || outDegree[i] > 0) activeNodes.push(i);
    }

    // Weak connectivity check via BFS on undirected projection of edges
    const adjUndir = Array.from({ length: n }, () => []);
    rawEdges.forEach(e => {
      const u = nodeIndexMap.get(e.from);
      const v = nodeIndexMap.get(e.to);
      adjUndir[u].push(v);
      adjUndir[v].push(u);
    });

    const visitedBFS = new Set();
    for (const u of activeNodes) {
      if (!visitedBFS.has(u)) {
        const comp = [];
        const q = [u];
        visitedBFS.add(u);
        while (q.length > 0) {
          const curr = q.shift();
          comp.push(curr);
          for (const neighbor of adjUndir[curr]) {
            if (!visitedBFS.has(neighbor)) {
              visitedBFS.add(neighbor);
              q.push(neighbor);
            }
          }
        }
        components.push(comp);
      }
    }
    isConnected = (components.length <= 1);

    for (let i = 0; i < n; i++) {
      if (inDegree[i] === outDegree[i]) {
        // balanced
      } else if (outDegree[i] === inDegree[i] + 1) {
        startCandidates.push(i);
      } else if (inDegree[i] === outDegree[i] + 1) {
        endCandidates.push(i);
      } else {
        unbalancedCount++;
      }
    }

    if (edgeCount === 0) {
      type = "empty";
      typeTitle = "Đồ thị rỗng (0 cạnh)";
      reason = "Đồ thị không có cạnh nào để xét chu trình hay đường đi Euler.";
    } else if (!isConnected) {
      type = "disconnected";
      typeTitle = "Đồ thị không liên thông";
      reason = `Đồ thị KHÔNG liên thông yếu (các cạnh phân bố trên ${components.length} thành phần tách biệt). Không thể duyệt hết các cạnh trong 1 hành trình liên tục.`;
    } else if (startCandidates.length === 0 && endCandidates.length === 0 && unbalancedCount === 0) {
      type = "circuit";
      typeTitle = "Tồn tại Chu trình Euler có hướng";
      reason = "Đồ thị liên thông và TẤT CẢ các đỉnh đều có bán bậc vào = bán bậc ra (in-degree == out-degree). Theo định lý Euler có hướng, tồn tại CHU TRÌNH Euler khép kín.";
    } else if (startCandidates.length === 1 && endCandidates.length === 1 && unbalancedCount === 0) {
      type = "path";
      typeTitle = "Không có Chu trình nhưng CÓ ĐƯỜNG ĐI Euler có hướng";
      const sNode = allNodes[startCandidates[0]];
      const eNode = allNodes[endCandidates[0]];
      reason = `Đồ thị liên thông, có đúng 1 đỉnh xuất phát có out-degree = in-degree + 1 (${sNode.label || sNode.id}: ra ${outDegree[startCandidates[0]]}, vào ${inDegree[startCandidates[0]]}) và đúng 1 đỉnh kết thúc có in-degree = out-degree + 1 (${eNode.label || eNode.id}: vào ${inDegree[endCandidates[0]]}, ra ${outDegree[endCandidates[0]]}). Các đỉnh còn lại đều có in = out. Do đó tồn tại ĐƯỜNG ĐI Euler có hướng.`;
    } else {
      type = "none_degree";
      typeTitle = "Không tồn tại Chu trình hay Đường đi Euler có hướng";
      reason = "Bán bậc vào/ra của các đỉnh không thỏa mãn điều kiện Euler có hướng: cần in == out cho mọi đỉnh (chu trình) hoặc đúng 1 đỉnh out = in + 1 và 1 đỉnh in = out + 1 (đường đi).";
    }

    if (type === "circuit") {
      if (providedStartIndex >= 0 && providedStartIndex < n && outDegree[providedStartIndex] > 0) {
        chosenStart = providedStartIndex;
      } else {
        chosenStart = activeNodes.length > 0 ? activeNodes[0] : 0;
      }
      chosenEnd = chosenStart;
    } else if (type === "path") {
      // Directed path strictly starts at startCandidates[0] and ends at endCandidates[0] (legacy contract)
      chosenStart = startCandidates[0];
      chosenEnd = endCandidates[0];
    }
  } else {
    // UNDIRECTED GRAPH
    rawEdges.forEach((e, idx) => {
      const u = nodeIndexMap.get(e.from);
      const v = nodeIndexMap.get(e.to);
      degree[u]++;
      degree[v]++;
      adjLocal[u].push({ to: v, id: idx, edge: e });
      adjLocal[v].push({ to: u, id: idx, edge: e });
    });

    const activeNodes = [];
    for (let i = 0; i < n; i++) {
      if (degree[i] > 0) activeNodes.push(i);
    }

    const visitedBFS = new Set();
    for (const u of activeNodes) {
      if (!visitedBFS.has(u)) {
        const comp = [];
        const q = [u];
        visitedBFS.add(u);
        while (q.length > 0) {
          const curr = q.shift();
          comp.push(curr);
          for (const e of adjLocal[curr]) {
            if (!visitedBFS.has(e.to)) {
              visitedBFS.add(e.to);
              q.push(e.to);
            }
          }
        }
        components.push(comp);
      }
    }
    isConnected = (components.length <= 1);

    for (let i = 0; i < n; i++) {
      if (degree[i] % 2 === 1) odd.push(i);
    }

    if (edgeCount === 0) {
      type = "empty";
      typeTitle = "Đồ thị rỗng (0 cạnh)";
      reason = "Đồ thị không có cạnh nào để xét chu trình hay đường đi Euler.";
    } else if (!isConnected) {
      type = "disconnected";
      typeTitle = "Đồ thị không liên thông";
      reason = `Đồ thị KHÔNG liên thông (các cạnh phân bố trên ${components.length} thành phần tách biệt). Theo định lý Euler, không thể duyệt hết các cạnh trong 1 hành trình liên tục.`;
    } else if (odd.length === 0) {
      type = "circuit";
      typeTitle = "Tồn tại Chu trình Euler (Đồ thị Euler)";
      reason = `Đồ thị liên thông và TẤT CẢ ${activeNodes.length} đỉnh có cạnh đều có BẬC CHẴN (0 đỉnh bậc lẻ). Theo định lý Euler-Hierholzer, đồ thị có CHU TRÌNH Euler khép kín.`;
    } else if (odd.length === 2) {
      type = "path";
      typeTitle = "Không có Chu trình nhưng CÓ ĐƯỜNG ĐI Euler (Đồ thị Nửa-Euler)";
      const o1 = allNodes[odd[0]];
      const o2 = allNodes[odd[1]];
      reason = `Đồ thị liên thông và có ĐÚNG 2 đỉnh bậc lẻ (${o1.label || o1.id} bậc ${degree[odd[0]]}, ${o2.label || o2.id} bậc ${degree[odd[1]]}). Theo định lý Euler, đồ thị KHÔNG có chu trình Euler, nhưng CÓ ĐƯỜNG ĐI Euler xuất phát từ một đỉnh lẻ và kết thúc ở đỉnh lẻ còn lại.`;
    } else {
      type = "none_odd";
      typeTitle = `Không có Euler (Có ${odd.length} đỉnh bậc lẻ > 2)`;
      reason = `Đồ thị có ${odd.length} đỉnh bậc lẻ. Theo định lý Euler, đồ thị chỉ có chu trình khi có 0 đỉnh lẻ, và có đường đi khi có đúng 2 đỉnh lẻ. Do đó KHÔNG TỒN TẠI cả chu trình lẫn đường đi Euler.`;
    }

    if (type === "circuit") {
      if (providedStartIndex >= 0 && providedStartIndex < n && degree[providedStartIndex] > 0) {
        chosenStart = providedStartIndex;
      } else {
        chosenStart = activeNodes.length > 0 ? activeNodes[0] : 0;
      }
      chosenEnd = chosenStart;
    } else if (type === "path") {
      if (providedStartIndex === odd[0] || providedStartIndex === odd[1]) {
        chosenStart = providedStartIndex;
      } else {
        chosenStart = odd[0];
      }
      chosenEnd = (chosenStart === odd[0] ? odd[1] : odd[0]);
    }
  }

  // Record Step 1: Initial Condition Check
  steps.push(createStep({
    stepNumber: stepCount++,
    action: AlgorithmAction.INITIALIZE,
    description: reason,
    state: {
      type,
      connected: isConnected,
      isDirected,
      componentCount: components.length,
      oddCount: odd.length,
      startCandidatesCount: startCandidates.length,
      endCandidatesCount: endCandidates.length,
      chosenStart: chosenStart !== null ? allNodes[chosenStart].id : null,
      chosenEnd: chosenEnd !== null ? allNodes[chosenEnd].id : null,
    },
    highlights: {
      nodes: chosenStart !== null ? [allNodes[chosenStart].id] : [],
      edges: [],
    },
  }));

  // ---------------------------------------------------------------------------
  // 3. HIERHOLZER TRAVERSAL (If Circuit or Path)
  // ---------------------------------------------------------------------------
  const fullCircuitNodeIds = [];
  const fullEdges = [];

  if (type === "circuit" || type === "path") {
    const used = new Array(edgeCount).fill(false);
    const ptr = new Array(n).fill(0);
    // Stack contains { node: number, edge: Object|null }
    const stack = [{ node: chosenStart, edge: null }];
    const circ = [];
    const circEdges = [];

    const startNode = allNodes[chosenStart];
    const endNode = allNodes[chosenEnd];
    const startDesc = (type === "circuit")
      ? `Bắt đầu duyệt Chu trình Euler${isDirected ? ' có hướng' : ''} từ đỉnh ${startNode.label || startNode.id}. Đẩy ${startNode.label || startNode.id} vào ngăn xếp.`
      : `Bắt đầu duyệt Đường đi Euler${isDirected ? ' có hướng' : ''} từ đỉnh xuất phát ${startNode.label || startNode.id} (đích đến là ${endNode.label || endNode.id}). Đẩy ${startNode.label || startNode.id} vào ngăn xếp.`;

    steps.push(createStep({
      stepNumber: stepCount++,
      action: AlgorithmAction.SELECT_NODE,
      description: startDesc,
      state: {
        type,
        connected: isConnected,
        isDirected,
        stack: [startNode.id],
        circuit: [],
      },
      highlights: {
        nodes: [startNode.id],
        edges: [],
      },
    }));

    while (stack.length > 0) {
      const topItem = stack[stack.length - 1];
      const v = topItem.node;
      let advanced = false;

      while (ptr[v] < adjLocal[v].length) {
        const edgeCandidate = adjLocal[v][ptr[v]];
        ptr[v]++;
        if (!used[edgeCandidate.id]) {
          used[edgeCandidate.id] = true;
          stack.push({ node: edgeCandidate.to, edge: edgeCandidate.edge });
          advanced = true;

          const fromNode = allNodes[v];
          const toNode = allNodes[edgeCandidate.to];
          steps.push(createStep({
            stepNumber: stepCount++,
            action: AlgorithmAction.ACCEPT_EDGE,
            description: `Đi qua cạnh ${isDirected ? 'có hướng ' : ''}chưa dùng (${fromNode.label || fromNode.id} ${isDirected ? '→' : '-'} ${toNode.label || toNode.id}). Đẩy đỉnh ${toNode.label || toNode.id} vào ngăn xếp.`,
            state: {
              type,
              stack: stack.map(s => allNodes[s.node].id),
              circuit: circ.map(c => allNodes[c].id),
              currentEdgeId: edgeCandidate.edge.id,
            },
            highlights: {
              nodes: [fromNode.id, toNode.id],
              edges: [edgeCandidate.edge.id],
            },
          }));
          break;
        }
      }

      if (!advanced) {
        const popped = stack.pop();
        circ.push(popped.node);
        if (popped.edge) {
          circEdges.push(popped.edge);
        }

        const poppedNode = allNodes[popped.node];
        steps.push(createStep({
          stepNumber: stepCount++,
          action: AlgorithmAction.BACKTRACK,
          description: `Đỉnh ${poppedNode.label || poppedNode.id} không còn cạnh ${isDirected ? 'ra ' : 'kề '}chưa dùng → Lấy ra khỏi ngăn xếp và đưa vào chuỗi lộ trình.`,
          state: {
            type,
            stack: stack.map(s => allNodes[s.node].id),
            circuit: circ.map(c => allNodes[c].id),
            poppedNodeId: poppedNode.id,
          },
          highlights: {
            nodes: [poppedNode.id],
            edges: [],
          },
        }));
      }
    }

    const fullCircuitIndices = circ.slice().reverse();
    fullCircuitIndices.forEach(idx => fullCircuitNodeIds.push(allNodes[idx].id));

    const reversedEdges = circEdges.slice().reverse();
    reversedEdges.forEach(e => fullEdges.push({ ...e }));
  }

  // ---------------------------------------------------------------------------
  // 4. CONCLUSION & FINAL STEP
  // ---------------------------------------------------------------------------
  const routeString = fullCircuitNodeIds.join(" → ");
  let finalConclusion = "";

  if (type === "circuit") {
    const sNode = allNodes[chosenStart];
    finalConclusion = `HOÀN TẤT! Tồn tại Chu trình Euler${isDirected ? ' có hướng' : ''} gồm ${fullCircuitNodeIds.length - 1} cạnh: ${routeString}. (Khép kín từ ${sNode.label || sNode.id} về ${sNode.label || sNode.id})`;
  } else if (type === "path") {
    const sNode = allNodes[chosenStart];
    const eNode = allNodes[chosenEnd];
    finalConclusion = `HOÀN TẤT! KHÔNG có Chu trình nhưng CÓ ĐƯỜNG ĐI Euler${isDirected ? ' có hướng' : ''} gồm ${fullCircuitNodeIds.length - 1} cạnh: ${routeString}. (Xuất phát tại ${sNode.label || sNode.id}, kết thúc tại ${eNode.label || eNode.id})`;
  } else {
    finalConclusion = reason;
  }

  steps.push(createStep({
    stepNumber: stepCount++,
    action: AlgorithmAction.FINISH,
    description: finalConclusion,
    state: {
      type,
      connected: isConnected,
      isDirected,
      circuit: [...fullCircuitNodeIds],
      edgeCount: fullEdges.length,
    },
    highlights: {
      nodes: [...fullCircuitNodeIds],
      edges: fullEdges.map(e => e.id),
    },
  }));

  const isSuccess = (type === "circuit" || type === "path");
  const totalWeight = fullEdges.reduce((sum, e) => sum + (typeof e.weight === 'number' ? e.weight : 0), 0);

  return {
    status: isSuccess ? AlgorithmStatus.SUCCESS : AlgorithmStatus.FAILURE,
    type,
    subType: type,
    message: finalConclusion,
    circuit: fullCircuitNodeIds,
    path: fullCircuitNodeIds,
    edges: fullEdges,
    edgeIds: fullEdges.map(e => e.id),
    totalWeight,
    steps,
    statistics: {
      vertexCount: n,
      edgeCount,
      circuitVertexCount: fullCircuitNodeIds.length,
      circuitEdgeCount: fullEdges.length,
      oddDegreeCount: isDirected ? 0 : odd.length,
      startCandidatesCount: isDirected ? startCandidates.length : 0,
      endCandidatesCount: isDirected ? endCandidates.length : 0,
      unbalancedCount: isDirected ? unbalancedCount : 0,
      isDirected,
      connected: isConnected,
    },
    warnings: isSuccess ? [] : [reason],
    connected: isConnected,
    components: components.map(comp => comp.map(idx => allNodes[idx].id)),
    chosenStart: chosenStart !== null ? allNodes[chosenStart].id : null,
    chosenEnd: chosenEnd !== null ? allNodes[chosenEnd].id : null,
    odd: isDirected ? [] : odd.map(idx => allNodes[idx].id),
    startCandidates: isDirected ? startCandidates.map(idx => allNodes[idx].id) : [],
    endCandidates: isDirected ? endCandidates.map(idx => allNodes[idx].id) : [],
  };
}

export class EulerEngine {
  /**
   * @param {import('../models/Graph.js').Graph} graph
   * @param {string|null} [startNodeId=null]
   */
  constructor(graph, startNodeId = null) {
    this.graph = graph;
    this.startNodeId = startNodeId;
  }

  /**
   * Runs Euler algorithm
   * @returns {Object} AlgorithmResult
   */
  run() {
    return euler(this.graph, this.startNodeId);
  }
}
