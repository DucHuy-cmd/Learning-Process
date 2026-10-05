/**
 * @file c.js
 * Executable Johnson implementation (C11) of Johnson's all-pairs shortest paths.
 * Line numbers in `mapping` refer to the generated source and are verified by the test-suite.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

const TEMPLATE = `#include <stdio.h>
#include <string.h>
#include <limits.h>

#define MAX_N 64
#define MAX_M 512
#define INF (LLONG_MAX / 4)

typedef struct {
    const char *from;
    const char *to;
    long long w;
} Edge;

static const char *node_names[MAX_N];
static int node_count = 0;

static int index_of(const char *name) {
    for (int i = 0; i < node_count; i++) {
        if (strcmp(node_names[i], name) == 0) return i;
    }
    return -1;
}

/* Returns 0 on success, 1 when a negative weight cycle exists. Fills dist with d(u, v). */
int johnson(const Edge *edges, int m, long long dist[MAX_N][MAX_N]) {
    int n = node_count;
    int eu[MAX_M + MAX_N], ev[MAX_M + MAX_N];
    long long ew[MAX_M + MAX_N];
    long long h[MAX_N + 1];
    long long wp[MAX_N][MAX_N];
    long long dprime[MAX_N][MAX_N];

    /* Step 1: add pseudo vertex q = n (edges q -> v with weight 0), run Bellman-Ford from q */
    int q = n;
    int total = 0;
    for (int i = 0; i < m; i++) {
        eu[total] = index_of(edges[i].from);
        ev[total] = index_of(edges[i].to);
        ew[total] = edges[i].w;
        total++;
    }
    for (int v = 0; v < n; v++) {
        eu[total] = q;
        ev[total] = v;
        ew[total] = 0;
        total++;
    }
    for (int v = 0; v < n; v++) h[v] = INF;
    h[q] = 0;
    for (int pass = 0; pass < n; pass++) {
        int changed = 0;
        for (int i = 0; i < total; i++) {
            if (h[eu[i]] != INF && h[eu[i]] + ew[i] < h[ev[i]]) {
                h[ev[i]] = h[eu[i]] + ew[i];
                changed = 1;
            }
        }
        if (!changed) break;
    }
    for (int i = 0; i < total; i++) {
        if (h[eu[i]] != INF && h[eu[i]] + ew[i] < h[ev[i]]) {
            return 1; /* negative weight cycle detected */
        }
    }

    /* Step 2: reweight every edge so that w'(u, v) = w(u, v) + h(u) - h(v) >= 0 */
    for (int u = 0; u < n; u++)
        for (int v = 0; v < n; v++) wp[u][v] = INF;
    for (int i = 0; i < m; i++) {
        long long w2 = ew[i] + h[eu[i]] - h[ev[i]];
        if (w2 < wp[eu[i]][ev[i]]) wp[eu[i]][ev[i]] = w2;
    }

    /* Step 3: run Dijkstra (array version) from every vertex on the reweighted graph */
    for (int s = 0; s < n; s++) {
        int done[MAX_N] = {0};
        for (int v = 0; v < n; v++) dprime[s][v] = INF;
        dprime[s][s] = 0;
        for (int iter = 0; iter < n; iter++) {
            int u = -1;
            for (int v = 0; v < n; v++) {
                if (!done[v] && dprime[s][v] != INF && (u == -1 || dprime[s][v] < dprime[s][u])) u = v;
            }
            if (u == -1) break;
            done[u] = 1;
            for (int v = 0; v < n; v++) {
                if (wp[u][v] != INF && dprime[s][u] + wp[u][v] < dprime[s][v]) {
                    dprime[s][v] = dprime[s][u] + wp[u][v];
                }
            }
        }
    }

    /* Step 4: convert back, d(u, v) = d'(u, v) - h(u) + h(v) */
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            dist[u][v] = (dprime[u][v] == INF) ? INF : dprime[u][v] - h[u] + h[v];
        }
    }
    return 0;
}

int main(void) {
@@NODES@@
@@EDGES@@

    static long long dist[MAX_N][MAX_N];
    if (johnson(edges, edge_count, dist)) {
        printf("Graph contains a negative weight cycle. Johnson cannot continue.\\n");
        return 0;
    }

    printf("All-pairs shortest distances d(u, v):\\n");
    for (int u = 0; u < node_count; u++) {
        for (int v = 0; v < node_count; v++) {
            if (dist[u][v] == INF) printf("%6s", "INF");
            else printf("%6lld", dist[u][v]);
        }
        printf("\\n");
    }
    return 0;
}
`;

export const cJohnson = {
  algorithm: 'johnson',
  language: 'c',
  filename: 'johnson.c',
  title: 'Johnson (C11)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [35, 44, 49, 50],
    [AlgorithmAction.SELECT_NODE]: [51, 76, 78],
    [AlgorithmAction.INSPECT_EDGE]: [53, 54],
    [AlgorithmAction.RELAX_EDGE]: [55, 71],
    [AlgorithmAction.ERROR]: [61, 62, 63],
    [AlgorithmAction.FINISH]: [98, 101],
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
        .replace('@@EDGES@@', () => "    Edge edges[] = {\n        {\"A\", \"B\", 2},\n        {\"A\", \"C\", 4},\n        {\"B\", \"C\", 1},\n        {\"B\", \"D\", 7},\n        {\"C\", \"E\", 3},\n        {\"D\", \"F\", 1},\n        {\"E\", \"D\", 2},\n        {\"B\", \"F\", -3},\n        {\"F\", \"E\", -2},\n    };\n    int edge_count = (int)(sizeof(edges) / sizeof(edges[0]));")
        .replace('@@NODES@@', () => "    const char *names[] = {\"A\", \"B\", \"C\", \"D\", \"E\", \"F\"};\n    node_count = (int)(sizeof(names) / sizeof(names[0]));\n    for (int i = 0; i < node_count; i++) node_names[i] = names[i];");
    }

    const edgeLines = edges.map((e) => `        {"${e.from}", "${e.to}", ${e.weight}},`);
    const edgesStr = `    Edge edges[] = {\n${edgeLines.join('\n')}\n    };\n    int edge_count = (int)(sizeof(edges) / sizeof(edges[0]));`;
    const nodesStr = `    const char *names[] = {${nodes.map((n) => `"${n.id}"`).join(', ')}};\n    node_count = (int)(sizeof(names) / sizeof(names[0]));\n    for (int i = 0; i < node_count; i++) node_names[i] = names[i];`;
    return TEMPLATE.replace('@@EDGES@@', () => edgesStr).replace('@@NODES@@', () => nodesStr);
  },
};

cJohnson.source = cJohnson.generateSource(null);
export default cJohnson;