/**
 * @file c.js
 * Executable C implementation for Euler's algorithm (Hierholzer).
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cEuler = {
  algorithm: 'euler',
  language: 'c',
  filename: 'euler.c',
  title: 'Euler / Hierholzer (C99)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 38, 39],
    [AlgorithmAction.SELECT_NODE]: [42],
    [AlgorithmAction.ACCEPT_EDGE]: [51, 52, 53, 54],
    [AlgorithmAction.BACKTRACK]: [55, 56, 57],
    [AlgorithmAction.FINISH]: [60, 61, 62, 63, 64],
    [AlgorithmAction.ERROR]: [30],
  },
  generateSource(graph, options = {}) {
    let nodeCount = 5;
    let startIdx = 0;
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
    int path[128];
    int length;
} EulerResult;

EulerResult find_euler_circuit(int adj[MAX_NODES][MAX_NODES], int nodeCount, int startNode) {
    EulerResult res;
    res.length = 0;

    int deg[MAX_NODES];
    int oddCount = 0;
    int firstOdd = -1;
    for (int i = 0; i < nodeCount; i++) {
        deg[i] = 0;
        for (int j = 0; j < nodeCount; j++) {
            deg[i] += adj[i][j];
        }
        if (deg[i] % 2 != 0) {
            oddCount++;
            if (firstOdd == -1) firstOdd = i;
        }
    }
    if (oddCount != 0 && oddCount != 2) {
        return res;
    }

    int curr = (oddCount == 2) ? firstOdd : startNode;
    int stack[128];
    int stackTop = 0;
    stack[stackTop++] = curr;

    int circuit[128];
    int circuitLen = 0;

    while (stackTop > 0) {
        int v = stack[stackTop - 1];
        int nextNode = -1;
        for (int w = 0; w < nodeCount; w++) {
            if (adj[v][w] > 0) {
                nextNode = w;
                break;
            }
        }

        if (nextNode != -1) {
            adj[v][nextNode]--;
            adj[nextNode][v]--;
            stack[stackTop++] = nextNode;
        } else {
            circuit[circuitLen++] = stack[--stackTop];
        }
    }

    for (int i = 0; i < circuitLen; i++) {
        res.path[i] = circuit[circuitLen - 1 - i];
    }
    res.length = circuitLen;
    return res;
}

int main(void) {
    int adj[MAX_NODES][MAX_NODES];
    int nodeCount = ${nodeCount};
${matrixInit}

    int startNode = ${startIdx};
    EulerResult res = find_euler_circuit(adj, nodeCount, startNode);

    if (res.length > 0) {
        printf("Euler trail length: %d\\n", res.length);
        for (int i = 0; i < res.length; i++) {
            printf("%d%s", res.path[i], (i + 1 < res.length ? " -> " : "\\n"));
        }
    } else {
        printf("No Eulerian circuit or path found.\\n");
    }
    return 0;
}
`;
  },
};

cEuler.source = cEuler.generateSource(null);
