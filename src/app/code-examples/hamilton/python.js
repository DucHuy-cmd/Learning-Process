/**
 * @file python.js
 * Executable Python implementation for Hamiltonian Cycle / Path algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonHamilton = {
  algorithm: 'hamilton',
  language: 'python',
  filename: 'hamilton.py',
  title: 'Hamilton (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [4, 5, 6, 30],
    [AlgorithmAction.SELECT_NODE]: [17, 18, 19, 20],
    [AlgorithmAction.BACKTRACK]: [25, 26],
    [AlgorithmAction.FINISH]: [9, 10, 11, 12, 13, 14, 31],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const wantCycle = options.wantCycle !== false;

    let nodesListStr = '["A", "B", "C", "D", "E"]';
    let adjDictStr = `adj = {
    "A": ["B", "C", "D", "E"],
    "B": ["A", "C", "D", "E"],
    "C": ["A", "B", "D", "E"],
    "D": ["A", "B", "C", "E"],
    "E": ["A", "B", "C", "D"]
}`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodesListStr = JSON.stringify(nodes.map(n => n.id));
      const entries = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : []).map(e => `"${e.to}"`);
        return `    "${u}": [${neighbors.join(', ')}]`;
      });
      adjDictStr = `adj = {\n${entries.join(',\n')}\n}`;
    }

    return `from typing import Dict, List, Set, Optional

def find_hamiltonian(nodes: List[str], adj: Dict[str, List[str]], start_node: str, want_cycle: bool = True) -> Optional[List[str]]:
    n = len(nodes)
    path = [start_node]
    visited: Set[str] = {start_node}

    def backtrack(u: str) -> bool:
        if len(path) == n:
            if not want_cycle:
                return True
            if start_node in adj.get(u, []):
                path.append(start_node)
                return True
            return False

        for v in adj.get(u, []):
            if v not in visited:
                visited.add(v)
                path.append(v)

                if backtrack(v):
                    return True

                path.pop()
                visited.remove(v)

        return False

    if backtrack(start_node):
        return path
    return None

if __name__ == "__main__":
    nodes = ${nodesListStr}
${adjDictStr}

    start = "${startNode}"
    want_cycle = ${wantCycle ? 'True' : 'False'}

    result = find_hamiltonian(nodes, adj, start, want_cycle)

    if result:
        kind = "Hamiltonian cycle" if want_cycle else "Hamiltonian path"
        print(f"{kind} found:")
        print(" -> ".join(result))
    else:
        print("No Hamiltonian solution found.")
`;
  },
};

pythonHamilton.source = pythonHamilton.generateSource(null);
