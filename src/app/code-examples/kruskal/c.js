/**
 * @file c.js
 * Executable C implementation for Kruskal's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cKruskal = {
  algorithm: 'kruskal',
  language: 'c',
  filename: 'kruskal.c',
  title: 'Kruskal (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [53, 55, 56, 57, 58, 59],
    [AlgorithmAction.INSPECT_EDGE]: [61, 62],
    [AlgorithmAction.ACCEPT_EDGE]: [63, 64, 65, 66, 67],
    [AlgorithmAction.REJECT_EDGE]: [68, 69],
    [AlgorithmAction.FINISH]: [72],
  },
  generateSource(graph) {
    let nodeCount = 6;
    let edgeCount = 7;
    let edgeInits = `    edges[0] = (Edge){0, 1, 1};
    edges[1] = (Edge){0, 2, 2};
    edges[2] = (Edge){1, 3, 4};
    edges[3] = (Edge){2, 3, 3};
    edges[4] = (Edge){2, 4, 5};
    edges[5] = (Edge){3, 5, 7};
    edges[6] = (Edge){4, 5, 6};`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeCount = Math.min(32, Math.max(1, nodes.length));
      const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
      const edges = graph.getEdges ? graph.getEdges() : [];
      edgeCount = Math.min(128, edges.length);
      const lines = edges.slice(0, 128).map((e, idx) => {
        const u = idToIndex.get(e.from) ?? 0;
        const v = idToIndex.get(e.to) ?? 0;
        return `    edges[${idx}] = (Edge){${u}, ${v}, ${e.weight}};`;
      });
      edgeInits = lines.join('\n');
    }

    return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_EDGES 128
#define MAX_NODES 32

typedef struct {
    int u, v;
    int weight;
} Edge;

typedef struct {
    int parent[MAX_NODES];
    int rank[MAX_NODES];
} DSU;

void dsu_init(DSU* dsu, int n) {
    for (int i = 0; i < n; i++) {
        dsu->parent[i] = i;
        dsu->rank[i] = 0;
    }
}

int dsu_find(DSU* dsu, int x) {
    if (dsu->parent[x] != x) {
        dsu->parent[x] = dsu_find(dsu, dsu->parent[x]);
    }
    return dsu->parent[x];
}

bool dsu_union(DSU* dsu, int x, int y) {
    int rx = dsu_find(dsu, x);
    int ry = dsu_find(dsu, y);
    if (rx == ry) return false;
    if (dsu->rank[rx] < dsu->rank[ry]) dsu->parent[rx] = ry;
    else if (dsu->rank[rx] > dsu->rank[ry]) dsu->parent[ry] = rx;
    else { dsu->parent[ry] = rx; dsu->rank[rx]++; }
    return true;
}

int edge_compare(const void* a, const void* b) {
    return ((const Edge*)a)->weight - ((const Edge*)b)->weight;
}

typedef struct {
    Edge mstEdges[MAX_EDGES];
    int mstCount;
    int totalWeight;
} KruskalResult;

KruskalResult kruskal(int nodeCount, Edge edges[], int edgeCount) {
    qsort(edges, edgeCount, sizeof(Edge), edge_compare);

    DSU dsu;
    dsu_init(&dsu, nodeCount);
    KruskalResult res;
    res.mstCount = 0;
    res.totalWeight = 0;

    for (int i = 0; i < edgeCount; i++) {
        Edge e = edges[i];
        if (dsu_find(&dsu, e.u) != dsu_find(&dsu, e.v)) {
            dsu_union(&dsu, e.u, e.v);
            res.mstEdges[res.mstCount++] = e;
            res.totalWeight += e.weight;
            if (res.mstCount == nodeCount - 1) break;
        } else {
            continue;
        }
    }
    return res;
}

int main(void) {
    int nodeCount = ${nodeCount};
    int edgeCount = ${edgeCount};
    Edge edges[MAX_EDGES];
${edgeInits}

    KruskalResult res = kruskal(nodeCount, edges, edgeCount);

    printf("MST Edges count: %d\\n", res.mstCount);
    printf("Total MST weight: %d\\n", res.totalWeight);
    return 0;
}
`;
  },
};

cKruskal.source = cKruskal.generateSource(null);
