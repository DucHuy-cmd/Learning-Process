/**
 * @file c.js
 * Executable C implementation for Prim's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cPrim = {
  algorithm: 'prim',
  language: 'c',
  filename: 'prim.c',
  title: 'Prim (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [29, 30, 31, 32, 33, 34],
    [AlgorithmAction.SELECT_NODE]: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
    [AlgorithmAction.INSPECT_EDGE]: [49, 50, 51],
    [AlgorithmAction.RELAX_EDGE]: [52, 53, 54, 55],
    [AlgorithmAction.FINISH]: [58],
  },
  generateSource(graph, options = {}) {
    let nodeCount = 5;
    let startIdx = 0;
    let edgeInits = '';

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeCount = Math.min(32, Math.max(1, nodes.length));
      const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
      if (options.startNodeId && idToIndex.has(options.startNodeId)) {
        startIdx = idToIndex.get(options.startNodeId);
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
      edgeInits = `    addEdge(adj, 0, 1, 2); addEdge(adj, 1, 0, 2);
    addEdge(adj, 0, 2, 3); addEdge(adj, 2, 0, 3);
    addEdge(adj, 1, 2, 1); addEdge(adj, 2, 1, 1);
    addEdge(adj, 1, 3, 1); addEdge(adj, 3, 1, 1);
    addEdge(adj, 1, 4, 4); addEdge(adj, 4, 1, 4);
    addEdge(adj, 2, 3, 5); addEdge(adj, 3, 2, 5);
    addEdge(adj, 3, 4, 1); addEdge(adj, 4, 3, 1);`;
    }

    return `#include <stdio.h>
#include <stdlib.h>
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
    int parent[MAX_NODES];
    int key[MAX_NODES];
    int totalWeight;
} PrimResult;

PrimResult prim(NodeAdj adj[], int nodeCount, int startNode) {
    PrimResult res;
    bool inMST[MAX_NODES];
    res.totalWeight = 0;

    for (int i = 0; i < nodeCount; i++) {
        res.key[i] = INF;
        res.parent[i] = -1;
        inMST[i] = false;
    }
    res.key[startNode] = 0;

    for (int count = 0; count < nodeCount; count++) {
        int u = -1;
        int minKey = INF;
        for (int i = 0; i < nodeCount; i++) {
            if (!inMST[i] && res.key[i] < minKey) {
                minKey = res.key[i];
                u = i;
            }
        }
        if (u == -1 || res.key[u] == INF) break;
        inMST[u] = true;
        res.totalWeight += res.key[u];

        for (int i = 0; i < adj[u].count; i++) {
            int v = adj[u].edges[i].to;
            int w = adj[u].edges[i].weight;
            if (!inMST[v] && w < res.key[v]) {
                res.key[v] = w;
                res.parent[v] = u;
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

    int startNode = ${startIdx};
    PrimResult res = prim(adj, nodeCount, startNode);

    printf("Prim MST total weight: %d\\n", res.totalWeight);
    return 0;
}
`;
  },
};

cPrim.source = cPrim.generateSource(null);
