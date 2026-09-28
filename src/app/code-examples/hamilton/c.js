/**
 * @file c.js
 * Executable C implementation for Hamiltonian Cycle / Path algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cHamilton = {
  algorithm: 'hamilton',
  language: 'c',
  filename: 'hamilton.c',
  title: 'Hamilton (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [43, 44, 45, 47, 48, 50],
    [AlgorithmAction.SELECT_NODE]: [24, 25, 26, 27],
    [AlgorithmAction.BACKTRACK]: [33],
    [AlgorithmAction.FINISH]: [13, 14, 15, 16, 17, 18, 51, 52, 53, 54, 55],
  },
  generateSource(graph, options = {}) {
    let nodeCount = 5;
    let startIdx = 0;
    const wantCycle = options.wantCycle !== false;

    let matrixInit = `    for (int i = 0; i < 5; i++) {
        for (int j = 0; j < 5; j++) {
            adj[i][j] = (i != j) ? 1 : 0;
        }
    }`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeCount = Math.min(32, Math.max(1, nodes.length));
      const idToIndex = new Map(nodes.map((n, i) => [n.id, i]));
      if (options.startNodeId && idToIndex.has(options.startNodeId)) {
        startIdx = idToIndex.get(options.startNodeId);
      }
      const edges = graph.getEdges ? graph.getEdges() : [];
      const edgeLines = edges.map(e => {
        const u = idToIndex.get(e.from);
        const v = idToIndex.get(e.to);
        if (u !== undefined && v !== undefined) {
          return `    adj[${u}][${v}] = 1; adj[${v}][${u}] = 1;`;
        }
        return '';
      }).filter(Boolean);
      matrixInit = `    for (int i = 0; i < ${nodeCount}; i++) {
        for (int j = 0; j < ${nodeCount}; j++) adj[i][j] = 0;
    }\n${edgeLines.join('\n')}`;
    }

    return `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_NODES 32

typedef struct {
    int path[MAX_NODES + 1];
    int length;
} HamiltonResult;

bool hamilton_backtrack(int adj[MAX_NODES][MAX_NODES], int nodeCount, int startNode, bool wantCycle, int path[], int pathLen, bool visited[]) {
    if (pathLen == nodeCount) {
        if (!wantCycle) return true;
        int last = path[pathLen - 1];
        if (adj[last][startNode] > 0) {
            path[pathLen] = startNode;
            return true;
        }
        return false;
    }

    int u = path[pathLen - 1];
    for (int v = 0; v < nodeCount; v++) {
        if (adj[u][v] > 0 && !visited[v]) {
            visited[v] = true;
            path[pathLen] = v;

            if (hamilton_backtrack(adj, nodeCount, startNode, wantCycle, path, pathLen + 1, visited)) {
                return true;
            }

            visited[v] = false;
        }
    }
    return false;
}

HamiltonResult find_hamiltonian(int adj[MAX_NODES][MAX_NODES], int nodeCount, int startNode, bool wantCycle) {
    HamiltonResult res;
    res.length = 0;

    int path[MAX_NODES + 1];
    bool visited[MAX_NODES];
    for (int i = 0; i < nodeCount; i++) visited[i] = false;

    path[0] = startNode;
    visited[startNode] = true;

    if (hamilton_backtrack(adj, nodeCount, startNode, wantCycle, path, 1, visited)) {
        int totalLen = wantCycle ? (nodeCount + 1) : nodeCount;
        for (int i = 0; i < totalLen; i++) {
            res.path[i] = path[i];
        }
        res.length = totalLen;
    }
    return res;
}

int main(void) {
    int adj[MAX_NODES][MAX_NODES];
    int nodeCount = ${nodeCount};
${matrixInit}

    int startNode = ${startIdx};
    bool wantCycle = ${wantCycle ? 'true' : 'false'};

    HamiltonResult res = find_hamiltonian(adj, nodeCount, startNode, wantCycle);

    if (res.length > 0) {
        printf("Hamiltonian %s found:\\n", wantCycle ? "cycle" : "path");
        for (int i = 0; i < res.length; i++) {
            printf("%d%s", res.path[i], (i + 1 < res.length ? " -> " : "\\n"));
        }
    } else {
        printf("No Hamiltonian solution found.\\n");
    }
    return 0;
}
`;
  },
};

cHamilton.source = cHamilton.generateSource(null);
