/**
 * @file python.js
 * Executable Python implementation for Prim's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonPrim = {
  algorithm: 'prim',
  language: 'python',
  filename: 'prim.py',
  title: 'Prim (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [5, 6, 7, 8, 9, 11, 12],
    [AlgorithmAction.SELECT_NODE]: [15, 16, 17, 18, 19, 20, 21],
    [AlgorithmAction.INSPECT_EDGE]: [23],
    [AlgorithmAction.RELAX_EDGE]: [24, 25, 26, 27],
    [AlgorithmAction.FINISH]: [29],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'x1';
    let nodesListStr = '["x1", "x2", "x3", "x4", "x5"]';
    let adjDictStr = `adj = {
    "x1": [("x2", 2), ("x3", 3)],
    "x2": [("x1", 2), ("x3", 1), ("x4", 1), ("x5", 4)],
    "x3": [("x1", 3), ("x2", 1), ("x4", 5)],
    "x4": [("x2", 1), ("x3", 5), ("x5", 1)],
    "x5": [("x2", 4), ("x4", 1)]
}`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodesListStr = JSON.stringify(nodes.map(n => n.id));
      const entries = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : [])
          .map(e => `("${e.to}", ${e.weight})`);
        return `    "${u}": [${neighbors.join(', ')}]`;
      });
      adjDictStr = `adj = {\n${entries.join(',\n')}\n}`;
    }

    return `import heapq
from typing import Dict, List, Tuple, Set, Optional

def prim(nodes: List[str], adj: Dict[str, List[Tuple[str, int]]], start_node: str):
    key = {u: float('inf') for u in nodes}
    parent = {u: None for u in nodes}
    in_mst: Set[str] = set()
    mst_edges: List[Tuple[str, str, int]] = []
    total_weight = 0

    key[start_node] = 0
    pq = [(0, start_node)]

    while pq and len(in_mst) < len(nodes):
        k, u = heapq.heappop(pq)
        if u in in_mst:
            continue
        in_mst.add(u)
        if parent[u] is not None:
            mst_edges.append((parent[u], u, k))
            total_weight += k

        for v, weight in adj.get(u, []):
            if v not in in_mst and weight < key[v]:
                key[v] = weight
                parent[v] = u
                heapq.heappush(pq, (weight, v))

    return mst_edges, total_weight

if __name__ == "__main__":
    nodes = ${nodesListStr}
${adjDictStr}

    start_node = "${startNode}"
    mst, total_weight = prim(nodes, adj, start_node)

    print(f"MST started from {start_node}:")
    for u, v, w in mst:
        print(f"  {u} - {v} (weight {w})")
    print(f"Total MST weight: {total_weight}")
`;
  },
};

pythonPrim.source = pythonPrim.generateSource(null);
