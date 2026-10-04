/**
 * @file java.js
 * Executable Java implementation for Bellman-Ford algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaBellmanFord = {
  algorithm: 'bellman_ford',
  language: 'java',
  filename: 'BellmanFord.java',
  title: 'Bellman-Ford (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [20, 21, 22, 23, 24, 25],
    [AlgorithmAction.SELECT_NODE]: [28, 29],
    [AlgorithmAction.INSPECT_EDGE]: [31, 32],
    [AlgorithmAction.RELAX_EDGE]: [33, 34, 35, 36, 37],
    [AlgorithmAction.ERROR]: [43, 44, 45, 46, 47],
    [AlgorithmAction.FINISH]: [51],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let edgeInits = '';
    if (graph && typeof graph.getNodes === 'function') {
      const edges = graph.getEdges ? graph.getEdges() : [];
      const lines = edges.map(e => `        edges.add(new Edge("${e.from}", "${e.to}", ${e.weight}));`);
      edgeInits = lines.join('\n');
    } else {
      edgeInits = `        edges.add(new Edge("A", "B", 4));
        edges.add(new Edge("A", "C", 2));
        edges.add(new Edge("B", "C", -1));
        edges.add(new Edge("B", "D", 2));
        edges.add(new Edge("C", "D", 5));`;
    }

    return `import java.util.*;

public class BellmanFord {
    public static class Edge {
        String from, to;
        int weight;
        public Edge(String from, String to, int weight) {
            this.from = from;
            this.to = to;
            this.weight = weight;
        }
    }

    public static class Result {
        public Map<String, Integer> dist = new HashMap<>();
        public Map<String, String> prev = new HashMap<>();
        public boolean hasNegativeCycle = false;
    }

    public static Result bellmanFord(List<Edge> edges, Set<String> nodes, String source) {
        Result res = new Result();
        for (String node : nodes) {
            res.dist.put(node, Integer.MAX_VALUE);
            res.prev.put(node, null);
        }
        res.dist.put(source, 0);

        int n = nodes.size();
        for (int k = 1; k < n; k++) {
            boolean changed = false;
            for (Edge edge : edges) {
                if (res.dist.get(edge.from) != Integer.MAX_VALUE) {
                    int cand = res.dist.get(edge.from) + edge.weight;
                    if (cand < res.dist.get(edge.to)) {
                        res.dist.put(edge.to, cand);
                        res.prev.put(edge.to, edge.from);
                        changed = true;
                    }
                }
            }
            if (!changed) break;
        }

        // Check for negative weight cycles
        for (Edge edge : edges) {
            if (res.dist.get(edge.from) != Integer.MAX_VALUE) {
                if (res.dist.get(edge.from) + edge.weight < res.dist.get(edge.to)) {
                    res.hasNegativeCycle = true;
                    break;
                }
            }
        }

        return res;
    }

    public static void main(String[] args) {
        List<Edge> edges = new ArrayList<>();
${edgeInits}

        Set<String> nodes = new HashSet<>();
        for (Edge e : edges) {
            nodes.add(e.from);
            nodes.add(e.to);
        }

        String source = "${startNode}";
        String target = "${endNode}";

        Result res = bellmanFord(edges, nodes, source);

        if (res.hasNegativeCycle) {
            System.out.println("Phat hien chu trinh am!");
        } else {
            System.out.println("Khoang cach ngan nhat den " + target + ": " + res.dist.get(target));
        }
    }
}
`;
  },
};

javaBellmanFord.source = javaBellmanFord.generateSource(null);
export default javaBellmanFord;
