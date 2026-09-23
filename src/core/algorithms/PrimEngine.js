/**
 * @file PrimEngine.js
 * Headless Core Engine - Prim's Minimum Spanning Tree (MST) Algorithm
 * 
 * Fully DOM-independent, pure ES Module.
 * Consumes Graph model and MinHeap priority queue.
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';
import { MinHeap } from '../data-structures/MinHeap.js';

/**
 * Executes Prim's algorithm on an undirected Graph starting from startNodeId.
 * 
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @param {string|null} [startNodeId=null] - Starting root vertex ID
 * @returns {Object} Standardized AlgorithmResult
 */
export function prim(graph, startNodeId = null) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getNeighbors !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'prim',
      message: 'Invalid graph instance provided',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: 0,
        edgeCount: 0,
        verticesVisited: 0,
        edgeInspections: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        heapPushes: 0,
        heapPops: 0,
        totalWeight: 0,
        components: 0,
      },
      warnings: ['Graph is missing or invalid'],
      connected: false,
      components: [],
    };
  }

  // Prim is strictly for undirected graphs
  if (graph.isDirected) {
    return {
      status: AlgorithmStatus.UNSUPPORTED,
      type: 'prim',
      message: 'Prim algorithm only supports undirected graphs',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: graph.nodeCount || 0,
        edgeCount: graph.edgeCount || 0,
        verticesVisited: 0,
        edgeInspections: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        heapPushes: 0,
        heapPops: 0,
        totalWeight: 0,
        components: 0,
      },
      warnings: ['Directed graphs are not supported by Prim MST'],
      connected: false,
      components: [],
    };
  }

  // Validate edge weights
  const rawEdges = graph.getEdges();
  for (const e of rawEdges) {
    if (e.weight === undefined || e.weight === null || typeof e.weight !== 'number' || Number.isNaN(e.weight)) {
      return {
        status: AlgorithmStatus.INVALID_INPUT,
        type: 'prim',
        message: `Invalid edge weight found for edge "${e.id}"`,
        edges: [],
        edgeIds: [],
        totalWeight: 0,
        steps: [],
        statistics: {
          vertexCount: graph.nodeCount || 0,
          edgeCount: rawEdges.length,
          verticesVisited: 0,
          edgeInspections: 0,
          edgesAccepted: 0,
          edgesRejected: 0,
          heapPushes: 0,
          heapPops: 0,
          totalWeight: 0,
          components: 0,
        },
        warnings: [`Edge "${e.id}" has invalid non-numeric weight: ${e.weight}`],
        connected: false,
        components: [],
      };
    }
  }

  const allNodes = graph.getNodes();
  const n = allNodes.length;

  // Empty graph
  if (n === 0) {
    return {
      status: AlgorithmStatus.SUCCESS,
      type: 'prim',
      message: 'Graph has no vertices',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: 0,
        edgeCount: 0,
        verticesVisited: 0,
        edgeInspections: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        heapPushes: 0,
        heapPops: 0,
        totalWeight: 0,
        components: 0,
      },
      warnings: [],
      connected: true,
      components: [],
    };
  }

  // Determine starting node
  let startId = startNodeId;
  if (startId === null || startId === undefined) {
    startId = allNodes[0].id;
  } else if (!graph.hasNode(startId)) {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'prim',
      message: `Start node "${startId}" does not exist in graph`,
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        vertexCount: n,
        edgeCount: rawEdges.length,
        verticesVisited: 0,
        edgeInspections: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        heapPushes: 0,
        heapPops: 0,
        totalWeight: 0,
        components: 0,
      },
      warnings: [`Start node "${startId}" not found in graph`],
      connected: false,
      components: [],
    };
  }

  // 2. STATE INITIALIZATION
  const key = {};
  const parent = {};
  for (const nd of allNodes) {
    key[nd.id] = Infinity;
    parent[nd.id] = null;
  }

  const inMST = new Set();
  const acceptedEdges = [];
  let totalWeight = 0;

  // Node index lookup to preserve legacy-compatible stable tie-breaking for equal keys
  const nodeIndex = new Map(allNodes.map((nd, idx) => [nd.id, idx]));
  const heap = new MinHeap((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return (nodeIndex.get(a.node) ?? 0) - (nodeIndex.get(b.node) ?? 0);
  });

  const statistics = {
    vertexCount: n,
    edgeCount: rawEdges.length,
    verticesVisited: 0,
    edgeInspections: 0,
    edgesAccepted: 0,
    edgesRejected: 0,
    heapPushes: 0,
    heapPops: 0,
    totalWeight: 0,
    components: 0,
  };

  const steps = [];
  let stepCounter = 0;

  function recordStep(action, description, highlights = {}) {
    stepCounter++;
    steps.push(createStep({
      stepNumber: stepCounter,
      action,
      description,
      state: {
        key: { ...key },
        parent: { ...parent },
        inMST: Array.from(inMST),
        acceptedEdges: acceptedEdges.map(e => ({ ...e })),
        totalWeight,
      },
      highlights,
    }));
  }

  // 3. STEP 0: INITIALIZATION
  key[startId] = 0.0;
  heap.push({
    distance: 0.0,
    node: startId,
    parent: null,
    edge: null,
  });
  statistics.heapPushes++;

  recordStep(
    AlgorithmAction.INITIALIZE,
    `Khởi tạo thuật toán Prim từ đỉnh gốc ${startId}. Đặt key[${startId}] = 0, các đỉnh khác có key = ∞.`,
    { nodes: [startId], edges: [] }
  );

  // Single-node graph handling
  if (n === 1) {
    inMST.add(startId);
    statistics.verticesVisited = 1;
    statistics.components = 1;

    recordStep(
      AlgorithmAction.FINISH,
      `Đồ thị chỉ gồm 1 đỉnh duy nhất ${startId}. Cây khung rỗng có tổng trọng số = 0.`,
      { nodes: [startId], edges: [] }
    );

    return {
      status: AlgorithmStatus.SUCCESS,
      type: 'prim',
      message: 'Cây khung gồm 0 cạnh cho đồ thị 1 đỉnh',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps,
      statistics,
      warnings: [],
      connected: true,
      components: [[startId]],
    };
  }

  // 4. MAIN PRIM LOOP
  while (!heap.isEmpty && inMST.size < n) {
    const top = heap.pop();
    statistics.heapPops++;
    const { distance: d, node: u, parent: p, edge } = top;

    // Stale heap candidate (Lazy Deletion)
    if (inMST.has(u)) {
      continue;
    }

    // Connect node u into MST
    inMST.add(u);
    statistics.verticesVisited++;

    if (edge && p !== null) {
      acceptedEdges.push({ ...edge });
      totalWeight += d;
      statistics.edgesAccepted++;

      recordStep(
        AlgorithmAction.ACCEPT_EDGE,
        `Kết nạp đỉnh ${u} và cạnh (${p} - ${u}, w=${d}) vào cây khung. Tổng trọng số hiện tại = ${totalWeight}.`,
        { nodes: [p, u], edges: [edge.id] }
      );
    } else {
      recordStep(
        AlgorithmAction.SELECT_NODE,
        `Bắt đầu kết nạp đỉnh gốc ${u} vào cây khung (key = 0).`,
        { nodes: [u], edges: [] }
      );
    }

    // Inspect neighbors of u
    const neighbors = graph.getNeighbors(u);
    for (const neighbor of neighbors) {
      const v = neighbor.node;
      const w = neighbor.weight;
      const edgeObj = neighbor.edge;

      // Skip vertices already inside MST (prevents cycles and self-loops)
      if (inMST.has(v)) {
        continue;
      }

      statistics.edgeInspections++;

      recordStep(
        AlgorithmAction.INSPECT_EDGE,
        `Kiểm tra cạnh (${u} - ${v}, w=${w}). Key hiện tại của ${v} là ${key[v] === Infinity ? '∞' : key[v]}.`,
        { nodes: [u, v], edges: [edgeObj.id] }
      );

      if (w < key[v]) {
        const oldKey = key[v];
        key[v] = w;
        parent[v] = u;

        heap.push({
          distance: w,
          node: v,
          parent: u,
          edge: edgeObj,
        });
        statistics.heapPushes++;

        recordStep(
          AlgorithmAction.RELAX_EDGE,
          `Cập nhật key của đỉnh ${v}: giảm từ ${oldKey === Infinity ? '∞' : oldKey} xuống ${w} (nối từ ${u}).`,
          { nodes: [v], edges: [edgeObj.id] }
        );
      } else {
        statistics.edgesRejected++;

        recordStep(
          AlgorithmAction.REJECT_EDGE,
          `Bỏ qua cạnh (${u} - ${v}): trọng số ${w} không nhỏ hơn key hiện tại của ${v} (${key[v]}).`,
          { nodes: [v], edges: [edgeObj.id] }
        );
      }
    }
  }

  // 5. CONNECTIVITY & COMPONENT PARTITION
  const connected = (acceptedEdges.length === n - 1);

  // Group all graph nodes into connected components
  const visitedComp = new Set();
  const components = [];

  // Component 1 is the component containing startId
  const startComp = [];
  const q = [startId];
  visitedComp.add(startId);
  while (q.length > 0) {
    const curr = q.shift();
    startComp.push(curr);
    for (const nb of graph.getNeighbors(curr)) {
      if (!visitedComp.has(nb.node)) {
        visitedComp.add(nb.node);
        q.push(nb.node);
      }
    }
  }
  components.push(startComp);

  // Remaining components if disconnected
  for (const nd of allNodes) {
    if (!visitedComp.has(nd.id)) {
      const comp = [];
      const queue = [nd.id];
      visitedComp.add(nd.id);
      while (queue.length > 0) {
        const curr = queue.shift();
        comp.push(curr);
        for (const nb of graph.getNeighbors(curr)) {
          if (!visitedComp.has(nb.node)) {
            visitedComp.add(nb.node);
            queue.push(nb.node);
          }
        }
      }
      components.push(comp);
    }
  }

  statistics.components = components.length;
  statistics.totalWeight = totalWeight;

  // 6. FINISH STEP
  if (connected) {
    recordStep(
      AlgorithmAction.FINISH,
      `Hoàn tất Prim! Đã dựng xong cây khung nhỏ nhất (MST) gồm ${acceptedEdges.length} cạnh, tổng trọng số = ${totalWeight}.`,
      {
        nodes: allNodes.map(nd => nd.id),
        edges: acceptedEdges.map(e => e.id),
      }
    );
  } else {
    recordStep(
      AlgorithmAction.FINISH,
      `Đồ thị không liên thông! Prim chỉ kết nạp được ${inMST.size}/${n} đỉnh từ đỉnh gốc ${startId}. Tổng trọng số nhánh đã dựng = ${totalWeight}.`,
      {
        nodes: Array.from(inMST),
        edges: acceptedEdges.map(e => e.id),
      }
    );
  }

  return {
    status: connected ? AlgorithmStatus.SUCCESS : AlgorithmStatus.PARTIAL,
    type: 'prim',
    message: connected
      ? `Đã dựng xong cây khung nhỏ nhất (MST) gồm ${acceptedEdges.length} cạnh, tổng trọng số: ${totalWeight}`
      : `Đồ thị không liên thông! Prim chỉ kết nạp được ${inMST.size}/${n} đỉnh từ đỉnh gốc ${startId}. Tổng trọng số nhánh đã dựng: ${totalWeight}`,
    edges: acceptedEdges,
    edgeIds: acceptedEdges.map(e => e.id),
    totalWeight,
    steps,
    statistics,
    warnings: connected ? [] : [`Graph is disconnected: Prim only reached ${inMST.size}/${n} vertices from start node "${startId}"`],
    connected,
    components,
  };
}

export class PrimEngine {
  /**
   * @param {import('../models/Graph.js').Graph} graph
   * @param {string|null} [startNodeId=null]
   */
  constructor(graph, startNodeId = null) {
    this.graph = graph;
    this.startNodeId = startNodeId;
  }

  /**
   * Runs Prim algorithm
   * @returns {Object} AlgorithmResult
   */
  run() {
    return prim(this.graph, this.startNodeId);
  }
}
