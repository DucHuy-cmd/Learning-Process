/**
 * @file python.js
 * Executable Python implementation for Dijkstra's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonDijkstra = {
  algorithm: 'dijkstra',
  language: 'python',
  filename: 'dijkstra.py',
  title: 'Dijkstra (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [5, 6, 7, 8],
    [AlgorithmAction.SELECT_NODE]: [11, 12, 13],
    [AlgorithmAction.INSPECT_EDGE]: [17],
    [AlgorithmAction.RELAX_EDGE]: [18, 19, 20, 21, 22],
    [AlgorithmAction.FINISH]: [24],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let graphDictStr = '';
    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      const entries = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : [])
          .map(e => `("${e.to}", ${e.weight})`);
        return `    "${u}": [${neighbors.join(', ')}]`;
      });
      graphDictStr = `graph = {\n${entries.join(',\n')}\n}`;
    } else {
      graphDictStr = `graph = {
    "A": [("B", 4), ("C", 2)],
    "B": [("A", 4), ("C", 1), ("D", 5)],
    "C": [("A", 2), ("B", 1), ("D", 8)],
    "D": [("B", 5), ("C", 8)]
}`;
    }

    return `import heapq
from typing import Dict, List, Tuple, Optional

def dijkstra(graph: Dict[str, List[Tuple[str, int]]], source: str, target: Optional[str] = None):
    distances = {node: float('inf') for node in graph}
    previous = {node: None for node in graph}
    distances[source] = 0
    priority_queue = [(0, source)]

    while priority_queue:
        current_dist, current = heapq.heappop(priority_queue)
        if current_dist > distances[current]:
            continue
        if target is not None and current == target:
            break

        for neighbor, weight in graph.get(current, []):
            new_dist = current_dist + weight
            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                previous[neighbor] = current
                heapq.heappush(priority_queue, (new_dist, neighbor))

    return distances, previous

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
${graphDictStr}

    source_node = "${startNode}"
    target_node = "${endNode}"

    distances, previous = dijkstra(graph, source_node, target_node)
    path = reconstruct_path(previous, source_node, target_node)

    print(f"Shortest distance from {source_node} to {target_node}: {distances.get(target_node)}")
    print(f"Path: {' -> '.join(path)}")
`;
  },
};

pythonDijkstra.source = pythonDijkstra.generateSource(null);
