/**
 * @file c.js
 * Executable C implementation for Bellman-Ford algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cBellmanFord = {
  algorithm: 'bellman_ford',
  language: 'c',
  filename: 'bellman_ford.c',
  title: 'Bellman-Ford (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [25, 26, 27, 28, 29],
    [AlgorithmAction.SELECT_NODE]: [32, 33],
    [AlgorithmAction.INSPECT_EDGE]: [35, 36],
    [AlgorithmAction.RELAX_EDGE]: [37, 38, 39, 40, 41],
    [AlgorithmAction.ERROR]: [48, 49, 50, 51, 52],
    [AlgorithmAction.FINISH]: [56],
  },
  generateSource(graph, options = {}) {
    let nodeCount = 4;
    let sourceIdx = 0;
    let targetIdx = 3;
    let edgeInits = '';

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeCount = Math.min(32, Math.max(1, nodes.length));
      const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
      if (options.startNodeId && idToIndex.has(options.startNodeId)) {
        sourceIdx = idToIndex.get(options.startNodeId);
      }
      if (options.endNodeId && idToIndex.has(options.endNodeId)) {
        targetIdx = idToIndex.get(options.endNodeId);
      }
      const edges = graph.getEdges ? graph.getEdges() : [];
      const lines = edges.map((e, idx) => {
        const u = idToIndex.get(e.from);
        const v = idToIndex.get(e.to);
        if (u !== undefined && v !== undefined) {
          return `    edges[${idx}] = (Edge){ ${u}, ${v}, ${e.weight} };`;
        }
        return '';
      }).filter(Boolean);
      edgeInits = lines.join('\n');
    } else {
      edgeInits = `    edges[0] = (Edge){ 0, 1, 4 };
    edges[1] = (Edge){ 0, 2, 2 };
    edges[2] = (Edge){ 1, 2, -1 };
    edges[3] = (Edge){ 1, 3, 2 };
    edges[4] = (Edge){ 2, 3, 5 };`;
    }

    const edgeCount = (graph && graph.getEdges) ? graph.getEdges().length : 5;

    return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define INF 1000000000

typedef struct {
    int from;
    int to;
    int weight;
} Edge;

typedef struct {
    int dist[64];
    int prev[64];
    bool hasNegativeCycle;
} BellmanFordResult;

BellmanFordResult bellmanFord(Edge edges[], int edgeCount, int nodeCount, int source) {
    BellmanFordResult res;
    for (int i = 0; i < nodeCount; i++) {
        res.dist[i] = INF;
        res.prev[i] = -1;
    }
    res.dist[source] = 0;
    res.hasNegativeCycle = false;

    for (int k = 1; k < nodeCount; k++) {
        bool changed = false;
        for (int i = 0; i < edgeCount; i++) {
            int u = edges[i].from;
            int v = edges[i].to;
            int w = edges[i].weight;
            if (res.dist[u] != INF && res.dist[u] + w < res.dist[v]) {
                res.dist[v] = res.dist[u] + w;
                res.prev[v] = u;
                changed = true;
            }
        }
        if (!changed) break;
    }

    // Check for negative weight cycle
    for (int i = 0; i < edgeCount; i++) {
        int u = edges[i].from;
        int v = edges[i].to;
        int w = edges[i].weight;
        if (res.dist[u] != INF && res.dist[u] + w < res.dist[v]) {
            res.hasNegativeCycle = true;
            break;
        }
    }

    return res;
}

int main() {
    int nodeCount = ${nodeCount};
    int edgeCount = ${edgeCount};
    Edge edges[${Math.max(1, edgeCount)}];
${edgeInits}

    int source = ${sourceIdx};
    int target = ${targetIdx};

    BellmanFordResult res = bellmanFord(edges, edgeCount, nodeCount, source);

    if (res.hasNegativeCycle) {
        printf("Phat hien chu trinh am!\\n");
    } else {
        printf("Khoang cach tu %d den %d: %d\\n", source, target, res.dist[target]);
    }
    return 0;
}
`;
  },
};

cBellmanFord.source = cBellmanFord.generateSource(null);
export default cBellmanFord;
