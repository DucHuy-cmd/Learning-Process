/**
 * @file KruskalEngine.js
 * Headless Core Engine - Kruskal's Minimum Spanning Tree (MST) Algorithm
 * 
 * Fully DOM-independent, pure ES Module.
 * Consumes Graph model and DisjointSet data structure.
 * Supports connected Minimum Spanning Trees and disconnected Spanning Forests.
 * Returns standardized AlgorithmResult with immutable replayable AlgorithmSteps.
 */

import { AlgorithmStatus, AlgorithmAction, createStep } from '../models/Types.js';
import { DisjointSet } from '../data-structures/DisjointSet.js';

/**
 * Executes Kruskal's algorithm on an undirected Graph.
 * 
 * @param {import('../models/Graph.js').Graph} graph - Pure Graph model instance
 * @returns {Object} Standardized AlgorithmResult
 */
export function kruskal(graph) {
  // 1. INPUT VALIDATION
  if (!graph || typeof graph.hasNode !== 'function' || typeof graph.getEdges !== 'function') {
    return {
      status: AlgorithmStatus.INVALID_INPUT,
      type: 'kruskal',
      message: 'Invalid graph instance provided',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        edgeCount: 0,
        edgesInspected: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        unionOperations: 0,
        components: 0,
        totalWeight: 0,
      },
      warnings: ['Graph is missing or invalid'],
      connected: false,
      components: [],
    };
  }

  // Kruskal is strictly for undirected graphs
  if (graph.isDirected) {
    return {
      status: AlgorithmStatus.UNSUPPORTED,
      type: 'kruskal',
      message: 'Kruskal algorithm only supports undirected graphs',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        edgeCount: graph.edgeCount || 0,
        edgesInspected: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        unionOperations: 0,
        components: 0,
        totalWeight: 0,
      },
      warnings: ['Directed graphs are not supported by Kruskal MST'],
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
        type: 'kruskal',
        message: `Invalid edge weight found for edge "${e.id}"`,
        edges: [],
        edgeIds: [],
        totalWeight: 0,
        steps: [],
        statistics: {
          edgeCount: rawEdges.length,
          edgesInspected: 0,
          edgesAccepted: 0,
          edgesRejected: 0,
          unionOperations: 0,
          components: 0,
          totalWeight: 0,
        },
        warnings: [`Edge "${e.id}" has invalid non-numeric weight: ${e.weight}`],
        connected: false,
        components: [],
      };
    }
  }

  const allNodes = graph.getNodes();
  const n = allNodes.length;

  // 2. SPECIAL CASES: Empty or single-node graphs
  if (n === 0) {
    return {
      status: AlgorithmStatus.SUCCESS,
      type: 'kruskal',
      message: 'Graph has no vertices',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps: [],
      statistics: {
        edgeCount: 0,
        edgesInspected: 0,
        edgesAccepted: 0,
        edgesRejected: 0,
        unionOperations: 0,
        components: 0,
        totalWeight: 0,
      },
      warnings: [],
      connected: true,
      components: [],
    };
  }

  // 3. SORT EDGES BY WEIGHT ASCENDING (Preserves insertion-order stability for equal weights)
  const sortedEdges = rawEdges.slice().sort((a, b) => a.weight - b.weight);

  // 4. DISJOINT SET & STATE INITIALIZATION
  const dsu = new DisjointSet(allNodes.map(nd => nd.id));
  const acceptedEdges = [];
  const rejectedEdges = [];
  let totalWeight = 0;

  const statistics = {
    edgeCount: sortedEdges.length,
    edgesInspected: 0,
    edgesAccepted: 0,
    edgesRejected: 0,
    unionOperations: 0,
    components: n,
    totalWeight: 0,
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
        acceptedEdges: acceptedEdges.map(e => ({ ...e })),
        rejectedEdges: rejectedEdges.map(e => ({ ...e })),
        totalWeight,
        componentCount: dsu.setCount,
      },
      highlights,
    }));
  }

  // INITIALIZE step
  recordStep(
    AlgorithmAction.INITIALIZE,
    `Khởi tạo Kruskal: Sắp xếp ${sortedEdges.length} cạnh theo trọng số tăng dần. Mỗi đỉnh ban đầu là một tập rời rạc riêng (makeSet).`,
    { nodes: allNodes.map(nd => nd.id), edges: [] }
  );

  // Single-node graph handling
  if (n === 1) {
    recordStep(
      AlgorithmAction.FINISH,
      `Đồ thị chỉ gồm 1 đỉnh duy nhất. Cây khung rỗng có tổng trọng số = 0.`,
      { nodes: [allNodes[0].id], edges: [] }
    );
    return {
      status: AlgorithmStatus.SUCCESS,
      type: 'kruskal',
      message: 'Cây khung gồm 0 cạnh cho đồ thị 1 đỉnh',
      edges: [],
      edgeIds: [],
      totalWeight: 0,
      steps,
      statistics: {
        ...statistics,
        components: 1,
        totalWeight: 0,
      },
      warnings: [],
      connected: true,
      components: [[allNodes[0].id]],
    };
  }

  // 5. MAIN KRUSKAL LOOP
  for (const edge of sortedEdges) {
    statistics.edgesInspected++;

    recordStep(
      AlgorithmAction.INSPECT_EDGE,
      `Kiểm tra cạnh (${edge.from} - ${edge.to}, w=${edge.weight}).`,
      { nodes: [edge.from, edge.to], edges: [edge.id] }
    );

    const isConnected = dsu.connected(edge.from, edge.to);

    if (!isConnected) {
      // Endpoints belong to different sets -> Accept edge
      dsu.union(edge.from, edge.to);
      acceptedEdges.push({ ...edge });
      totalWeight += edge.weight;
      statistics.edgesAccepted++;
      statistics.unionOperations++;

      recordStep(
        AlgorithmAction.ACCEPT_EDGE,
        `Nhận cạnh (${edge.from} - ${edge.to}, w=${edge.weight}) vào cây khung (hai đỉnh thuộc hai tập khác nhau, không tạo chu trình).`,
        { nodes: [edge.from, edge.to], edges: [edge.id] }
      );
    } else {
      // Endpoints already in the same set -> Reject edge (cycle)
      rejectedEdges.push({ ...edge });
      statistics.edgesRejected++;

      recordStep(
        AlgorithmAction.REJECT_EDGE,
        `Loại cạnh (${edge.from} - ${edge.to}, w=${edge.weight}) vì hai đỉnh cùng thuộc một tập liên thông (sẽ tạo thành chu trình).`,
        { nodes: [edge.from, edge.to], edges: [edge.id] }
      );
    }
  }

  // 6. CONNECTIVITY & COMPONENTS EXTRACTION
  const compMap = new Map();
  for (const node of allNodes) {
    const root = dsu.find(node.id);
    if (!compMap.has(root)) {
      compMap.set(root, []);
    }
    compMap.get(root).push(node.id);
  }
  const components = Array.from(compMap.values());
  const isSingleComponent = components.length === 1;

  statistics.components = components.length;
  statistics.totalWeight = totalWeight;

  // 7. FINISH STEP
  if (isSingleComponent) {
    recordStep(
      AlgorithmAction.FINISH,
      `Hoàn tất Kruskal! Đã dựng cây khung nhỏ nhất (MST) gồm ${acceptedEdges.length} cạnh, tổng trọng số = ${totalWeight}.`,
      {
        nodes: allNodes.map(nd => nd.id),
        edges: acceptedEdges.map(e => e.id),
      }
    );
  } else {
    recordStep(
      AlgorithmAction.FINISH,
      `Đồ thị không liên thông! Kruskal tạo được rừng khung nhỏ nhất (Spanning Forest) gồm ${acceptedEdges.length} cạnh trên ${components.length} thành phần liên thông tách biệt. Tổng trọng số = ${totalWeight}.`,
      {
        nodes: allNodes.map(nd => nd.id),
        edges: acceptedEdges.map(e => e.id),
      }
    );
  }

  return {
    status: isSingleComponent ? AlgorithmStatus.SUCCESS : AlgorithmStatus.PARTIAL,
    type: 'kruskal',
    message: isSingleComponent
      ? `Đã dựng xong cây khung nhỏ nhất (MST) gồm ${acceptedEdges.length} cạnh, tổng trọng số: ${totalWeight}`
      : `Đồ thị không liên thông: Đã dựng rừng khung nhỏ nhất (Spanning Forest) gồm ${acceptedEdges.length} cạnh trên ${components.length} thành phần, tổng trọng số: ${totalWeight}`,
    edges: acceptedEdges,
    edgeIds: acceptedEdges.map(e => e.id),
    totalWeight,
    steps,
    statistics,
    warnings: isSingleComponent ? [] : [`Graph is disconnected: Spanning Forest constructed across ${components.length} components`],
    connected: isSingleComponent,
    components,
  };
}

export class KruskalEngine {
  /**
   * @param {import('../models/Graph.js').Graph} graph
   */
  constructor(graph) {
    this.graph = graph;
  }

  /**
   * Runs Kruskal algorithm
   * @returns {Object} AlgorithmResult
   */
  run() {
    return kruskal(this.graph);
  }
}
