/**
 * @file python.js
 * Executable Johnson implementation (Python 3) of Johnson's all-pairs shortest paths.
 * Line numbers in `mapping` refer to the generated source and are verified by the test-suite.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

const TEMPLATE = `import heapq
from typing import Dict, List, Optional, Tuple

INF = float("inf")


def johnson(nodes: List[str], edges: List[Tuple[str, str, int]]) -> Optional[Dict[str, Dict[str, float]]]:
    # Step 1: add pseudo vertex q (edges q -> v with weight 0), run Bellman-Ford from q
    q = "q"
    aug_edges = [(q, v, 0) for v in nodes] + list(edges)
    h: Dict[str, float] = {v: INF for v in nodes}
    h[q] = 0
    for _ in range(len(nodes)):
        changed = False
        for u, v, w in aug_edges:
            if h[u] != INF and h[u] + w < h[v]:
                h[v] = h[u] + w
                changed = True
        if not changed:
            break
    for u, v, w in aug_edges:
        if h[u] != INF and h[u] + w < h[v]:
            return None  # negative weight cycle detected

    # Step 2: reweight every edge so that w'(u, v) = w(u, v) + h(u) - h(v) >= 0
    new_edges = [(u, v, w + h[u] - h[v]) for u, v, w in edges]
    adj: Dict[str, List[Tuple[str, float]]] = {v: [] for v in nodes}
    for u, v, w in new_edges:
        adj[u].append((v, w))

    # Step 3: run Dijkstra from every vertex on the reweighted graph
    d_prime: Dict[str, Dict[str, float]] = {}
    for s in nodes:
        dist = {v: INF for v in nodes}
        dist[s] = 0
        pq = [(0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist[u]:
                continue
            for v, w in adj[u]:
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w
                    heapq.heappush(pq, (dist[v], v))
        d_prime[s] = dist

    # Step 4: convert back, d(u, v) = d'(u, v) - h(u) + h(v)
    result: Dict[str, Dict[str, float]] = {}
    for u in nodes:
        result[u] = {}
        for v in nodes:
            result[u][v] = INF if d_prime[u][v] == INF else d_prime[u][v] - h[u] + h[v]
    return result


if __name__ == "__main__":
@@EDGES@@
@@NODES@@

    result = johnson(nodes, edges)
    if result is None:
        print("Graph contains a negative weight cycle. Johnson cannot continue.")
    else:
        print("All-pairs shortest distances d(u, v):")
        print("     " + " ".join(f"{v:>5}" for v in nodes))
        for u in nodes:
            row = " ".join(f"{'INF' if result[u][v] == INF else int(result[u][v]):>5}" for v in nodes)
            print(f"{u:>4} {row}")
`;

export const pythonJohnson = {
  algorithm: 'johnson',
  language: 'python',
  filename: 'johnson.py',
  title: 'Johnson (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [9, 10, 11, 12],
    [AlgorithmAction.SELECT_NODE]: [13, 33, 34],
    [AlgorithmAction.INSPECT_EDGE]: [15, 16],
    [AlgorithmAction.RELAX_EDGE]: [17, 26],
    [AlgorithmAction.ERROR]: [21, 22, 23],
    [AlgorithmAction.FINISH]: [49, 52, 53],
  },
  generateSource(graph, options = {}) {
    void options;
    let nodes = [];
    let edges = [];
    if (graph && typeof graph.getNodes === 'function') {
      nodes = graph.getNodes();
      edges = typeof graph.getEdges === 'function' ? graph.getEdges() : [];
    }

    if (nodes.length === 0) {
      return TEMPLATE
        .replace('@@EDGES@@', () => "    edges = [\n        (\"A\", \"B\", 2),\n        (\"A\", \"C\", 4),\n        (\"B\", \"C\", 1),\n        (\"B\", \"D\", 7),\n        (\"C\", \"E\", 3),\n        (\"D\", \"F\", 1),\n        (\"E\", \"D\", 2),\n        (\"B\", \"F\", -3),\n        (\"F\", \"E\", -2),\n    ]")
        .replace('@@NODES@@', () => "    nodes = [\"A\", \"B\", \"C\", \"D\", \"E\", \"F\"]");
    }

    const edgeLines = edges.map((e) => `        ("${e.from}", "${e.to}", ${e.weight}),`);
    const edgesStr = `    edges = [\n${edgeLines.join('\n')}\n    ]`;
    const nodesStr = `    nodes = [${nodes.map((n) => `"${n.id}"`).join(', ')}]`;
    return TEMPLATE.replace('@@EDGES@@', () => edgesStr).replace('@@NODES@@', () => nodesStr);
  },
};

pythonJohnson.source = pythonJohnson.generateSource(null);
export default pythonJohnson;