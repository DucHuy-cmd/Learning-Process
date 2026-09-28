/**
 * @file python.js
 * Executable Python implementation for Euler's algorithm (Hierholzer).
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonEuler = {
  algorithm: 'euler',
  language: 'python',
  filename: 'euler.py',
  title: 'Euler / Hierholzer (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [4, 5, 6, 9, 10, 11, 16, 17],
    [AlgorithmAction.SELECT_NODE]: [20],
    [AlgorithmAction.ACCEPT_EDGE]: [21, 22, 23, 24, 25],
    [AlgorithmAction.BACKTRACK]: [26, 27],
    [AlgorithmAction.FINISH]: [29],
    [AlgorithmAction.ERROR]: [7],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    let adjDictStr = `adj = {
    "A": ["B", "C", "D", "E"],
    "B": ["A", "C", "D", "E"],
    "C": ["A", "B", "D", "E"],
    "D": ["A", "B", "C", "E"],
    "E": ["A", "B", "C", "D"]
}`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      const entries = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : []).map(e => `"${e.to}"`);
        return `    "${u}": [${neighbors.join(', ')}]`;
      });
      adjDictStr = `adj = {\n${entries.join(',\n')}\n}`;
    }

    return `from typing import Dict, List, Optional

def find_euler_circuit_or_path(adj: Dict[str, List[str]], start_node: Optional[str] = None) -> List[str]:
    graph = {u: list(neighbors) for u, neighbors in adj.items()}
    odd_vertices = [u for u, neighbors in graph.items() if len(neighbors) % 2 != 0]
    if len(odd_vertices) not in (0, 2):
        return []

    curr_start = start_node
    if curr_start is None or (len(odd_vertices) == 2 and curr_start not in odd_vertices):
        curr_start = odd_vertices[0] if odd_vertices else next(iter(graph), None)

    if curr_start is None:
        return []

    stack = [curr_start]
    circuit = []

    while stack:
        v = stack[-1]
        if graph.get(v):
            w = graph[v].pop()
            if v in graph.get(w, []):
                graph[w].remove(v)
            stack.append(w)
        else:
            circuit.append(stack.pop())

    return circuit[::-1]

if __name__ == "__main__":
${adjDictStr}

    start = "${startNode}"
    result = find_euler_circuit_or_path(adj, start)

    if result:
        print("Euler trail found:")
        print(" -> ".join(result))
    else:
        print("No Eulerian circuit or path exists.")
`;
  },
};

pythonEuler.source = pythonEuler.generateSource(null);
