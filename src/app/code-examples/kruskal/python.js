/**
 * @file python.js
 * Executable Python implementation for Kruskal's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const pythonKruskal = {
  algorithm: 'kruskal',
  language: 'python',
  filename: 'kruskal.py',
  title: 'Kruskal (Python 3)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [27, 28, 29, 30],
    [AlgorithmAction.INSPECT_EDGE]: [32],
    [AlgorithmAction.ACCEPT_EDGE]: [33, 34, 35, 36, 37, 38],
    [AlgorithmAction.REJECT_EDGE]: [39, 40],
    [AlgorithmAction.FINISH]: [42],
  },
  generateSource(graph) {
    let nodesListStr = '["1", "2", "3", "4", "5", "6"]';
    let edgesListStr = `[
        ("1", "2", 1), ("1", "3", 2), ("2", "4", 4),
        ("3", "4", 3), ("3", "5", 5), ("4", "6", 7), ("5", "6", 6)
    ]`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodesListStr = JSON.stringify(nodes.map(n => n.id));
      const edges = graph.getEdges ? graph.getEdges() : [];
      const edgeTuples = edges.map(e => `("${e.from}", "${e.to}", ${e.weight})`);
      edgesListStr = `[\n        ${edgeTuples.join(',\n        ')}\n    ]`;
    }

    return `from typing import List, Tuple, Dict

class DisjointSet:
    def __init__(self, elements):
        self.parent = {x: x for x in elements}
        self.rank = {x: 0 for x in elements}

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            self.parent[rx] = ry
        elif self.rank[rx] > self.rank[ry]:
            self.parent[ry] = rx
        else:
            self.parent[ry] = rx
            self.rank[rx] += 1
        return True

def kruskal(nodes: List[str], edges: List[Tuple[str, str, int]]) -> Tuple[List[Tuple[str, str, int]], int]:
    sorted_edges = sorted(edges, key=lambda e: e[2])
    dsu = DisjointSet(nodes)
    mst = []
    total_weight = 0

    for u, v, weight in sorted_edges:
        if dsu.find(u) != dsu.find(v):
            dsu.union(u, v)
            mst.append((u, v, weight))
            total_weight += weight
            if len(mst) == len(nodes) - 1:
                break
        else:
            continue

    return mst, total_weight

if __name__ == "__main__":
    nodes = ${nodesListStr}
    edges = ${edgesListStr}

    mst, total_weight = kruskal(nodes, edges)

    print("Minimum Spanning Tree edges:")
    for u, v, w in mst:
        print(f"  {u} - {v} (weight {w})")
    print(f"Total MST weight: {total_weight}")
`;
  },
};

pythonKruskal.source = pythonKruskal.generateSource(null);
