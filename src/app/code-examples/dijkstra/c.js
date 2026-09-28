/**
 * @file c.js
 * Executable C implementation for Dijkstra's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cDijkstra = {
  algorithm: 'dijkstra',
  language: 'c',
  filename: 'dijkstra.c',
  title: 'Dijkstra (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [27, 28, 29, 30, 31, 32],
    [AlgorithmAction.SELECT_NODE]: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44],
    [AlgorithmAction.INSPECT_EDGE]: [47, 48, 49],
    [AlgorithmAction.RELAX_EDGE]: [50, 51, 52, 53],
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
      const lines = edges.map(e => {
        const u = idToIndex.get(e.from);
        const v = idToIndex.get(e.to);
        if (u !== undefined && v !== undefined) {
          return `    addEdge(adj, ${u}, ${v}, ${e.weight});`;
        }
        return '';
      }).filter(Boolean);
      edgeInits = lines.join('\n');
    } else {
      edgeInits = `    addEdge(adj, 0, 1, 4);
    addEdge(adj, 0, 2, 2);
    addEdge(adj, 1, 0, 4);
    addEdge(adj, 1, 2, 1);
    addEdge(adj, 1, 3, 5);
    addEdge(adj, 2, 0, 2);
    addEdge(adj, 2, 1, 1);
    addEdge(adj, 2, 3, 8);
    addEdge(adj, 3, 1, 5);
    addEdge(adj, 3, 2, 8);`;
    }

    return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_NODES 32
#define INF 1000000000

typedef struct {
    int to;
    int weight;
} Edge;

typedef struct {
    Edge edges[MAX_NODES];
    int count;
} NodeAdj;

typedef struct {
    int dist[MAX_NODES];
    int prev[MAX_NODES];
} DijkstraResult;

DijkstraResult dijkstra(NodeAdj adj[], int nodeCount, int source, int target) {
    DijkstraResult res;
    bool visited[MAX_NODES];
    for (int i = 0; i < nodeCount; i++) {
        res.dist[i] = INF;
        res.prev[i] = -1;
        visited[i] = false;
    }
    res.dist[source] = 0;

    for (int iter = 0; iter < nodeCount; iter++) {
        int u = -1;
        int minDist = INF;
        for (int i = 0; i < nodeCount; i++) {
            if (!visited[i] && res.dist[i] < minDist) {
                minDist = res.dist[i];
                u = i;
            }
        }
        if (u == -1 || res.dist[u] == INF) break;
        visited[u] = true;
        if (target >= 0 && u == target) break;

        for (int i = 0; i < adj[u].count; i++) {
            int v = adj[u].edges[i].to;
            int w = adj[u].edges[i].weight;
            if (res.dist[u] + w < res.dist[v]) {
                res.dist[v] = res.dist[u] + w;
                res.prev[v] = u;
            }
        }
    }
    return res;
}

static void addEdge(NodeAdj adj[], int from, int to, int weight) {
    if (adj[from].count < MAX_NODES) {
        adj[from].edges[adj[from].count].to = to;
        adj[from].edges[adj[from].count].weight = weight;
        adj[from].count++;
    }
}

int main(void) {
    NodeAdj adj[MAX_NODES];
    for (int i = 0; i < MAX_NODES; i++) adj[i].count = 0;

    int nodeCount = ${nodeCount};
${edgeInits}

    int source = ${sourceIdx};
    int target = ${targetIdx};

    DijkstraResult res = dijkstra(adj, nodeCount, source, target);

    printf("Shortest distance from %d to %d: %d\\n", source, target, res.dist[target]);
    return 0;
}
`;
  },
};

cDijkstra.source = cDijkstra.generateSource(null);
