/**
 * @file python.js
 * Executable Python implementation for Bellman-Ford algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonBellmanFord = {
  algorithm: 'bellman_ford',
  language: 'python',
  filename: 'bellman_ford.py',
  title: 'Bellman-Ford (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [4, 5, 6],
    [AlgorithmAction.SELECT_NODE]: [8, 9],
    [AlgorithmAction.INSPECT_EDGE]: [11, 12],
    [AlgorithmAction.RELAX_EDGE]: [13, 14, 15],
    [AlgorithmAction.ERROR]: [20, 21, 22],
    [AlgorithmAction.FINISH]: [24],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let edgesListStr = '';
    if (graph && typeof graph.getNodes === 'function') {
      const edges = graph.getEdges ? graph.getEdges() : [];
      const lines = edges.map(e => `    ("${e.from}", "${e.to}", ${e.weight}),`);
      edgesListStr = `edges = [\n${lines.join('\n')}\n]`;
    } else {
      edgesListStr = `edges = [
    ("A", "B", 4),
    ("A", "C", 2),
    ("B", "C", -1),
    ("B", "D", 2),
    ("C", "D", 5),
]`;
    }

    return `from typing import List, Tuple, Dict, Optional, Set

def bellman_ford(edges: List[Tuple[str, str, int]], nodes: Set[str], source: str):
    distances: Dict[str, float] = {node: float('inf') for node in nodes}
    previous: Dict[str, Optional[str]] = {node: None for node in nodes}
    distances[source] = 0

    n = len(nodes)
    for k in range(1, n):
        changed = False
        for u, v, weight in edges:
            if distances[u] != float('inf') and distances[u] + weight < distances[v]:
                distances[v] = distances[u] + weight
                previous[v] = u
                changed = True
        if not changed:
            break

    # Check for negative weight cycles
    for u, v, weight in edges:
        if distances[u] != float('inf') and distances[u] + weight < distances[v]:
            return None, None, True # Negative cycle detected

    return distances, previous, False

def reconstruct_path(previous: Dict[str, Optional[str]], source: str, target: str) -> List[str]:
    path = []
    curr = target
    while curr is not None:
        path.append(curr)
        if curr == source:
            break
        curr = previous.get(curr)
    return path[::-1] if (path and path[-1] == source) else []

if __name__ == "__main__":
${edgesListStr}

    nodes = set()
    for u, v, _ in edges:
        nodes.add(u)
        nodes.add(v)

    source_node = "${startNode}"
    target_node = "${endNode}"

    distances, previous, has_neg_cycle = bellman_ford(edges, nodes, source_node)

    if has_neg_cycle:
        print("Graph contains a negative weight cycle!")
    else:
        path = reconstruct_path(previous, source_node, target_node)
        print(f"Shortest distance from {source_node} to {target_node}: {distances.get(target_node)}")
        print(f"Path: {' -> '.join(path)}")
`;
  },
};

pythonBellmanFord.source = pythonBellmanFord.generateSource(null);
export default pythonBellmanFord;
