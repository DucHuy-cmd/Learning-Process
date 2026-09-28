/**
 * @file java.js
 * Executable Java implementation for Prim's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaPrim = {
  algorithm: 'prim',
  language: 'java',
  filename: 'Prim.java',
  title: 'Prim (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [20, 21, 22, 23, 25, 26, 27, 28, 29, 31, 32],
    [AlgorithmAction.SELECT_NODE]: [35, 36, 37, 38, 39, 40, 41, 42, 43],
    [AlgorithmAction.INSPECT_EDGE]: [45],
    [AlgorithmAction.RELAX_EDGE]: [46, 47, 48, 49, 50, 51],
    [AlgorithmAction.FINISH]: [54],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'x1';
    let nodeInits = 'Arrays.asList("x1", "x2", "x3", "x4", "x5")';
    let graphInits = `        for (String u : nodes) adj.put(u, new ArrayList<>());
        adj.get("x1").add(new Edge("x2", 2)); adj.get("x2").add(new Edge("x1", 2));
        adj.get("x1").add(new Edge("x3", 3)); adj.get("x3").add(new Edge("x1", 3));
        adj.get("x2").add(new Edge("x3", 1)); adj.get("x3").add(new Edge("x2", 1));
        adj.get("x2").add(new Edge("x4", 1)); adj.get("x4").add(new Edge("x2", 1));
        adj.get("x2").add(new Edge("x5", 4)); adj.get("x5").add(new Edge("x2", 4));
        adj.get("x3").add(new Edge("x4", 5)); adj.get("x4").add(new Edge("x3", 5));
        adj.get("x4").add(new Edge("x5", 1)); adj.get("x5").add(new Edge("x4", 1));`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `Arrays.asList(${nodes.map(n => `"${n.id}"`).join(', ')})`;
      const edges = graph.getEdges ? graph.getEdges() : [];
      const edgeLines = edges.map(e => `        adj.get("${e.from}").add(new Edge("${e.to}", ${e.weight}));`);
      graphInits = `        for (String u : nodes) adj.put(u, new ArrayList<>());\n${edgeLines.join('\n')}`;
    }

    return `import java.util.*;

public class Prim {
    public static class Edge {
        String to;
        int weight;

        public Edge(String to, int weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    public static class Result {
        public List<String> mstEdges = new ArrayList<>();
        public int totalWeight = 0;
    }

    public static Result prim(List<String> nodes, Map<String, List<Edge>> adj, String startNode) {
        Map<String, Integer> key = new HashMap<>();
        Map<String, String> parent = new HashMap<>();
        Set<String> inMST = new HashSet<>();
        Result res = new Result();

        for (String u : nodes) {
            key.put(u, Integer.MAX_VALUE);
            parent.put(u, null);
        }
        key.put(startNode, 0);

        PriorityQueue<Map.Entry<String, Integer>> pq = new PriorityQueue<>(Map.Entry.comparingByValue());
        pq.add(new AbstractMap.SimpleEntry<>(startNode, 0));

        while (!pq.isEmpty() && inMST.size() < nodes.size()) {
            Map.Entry<String, Integer> top = pq.poll();
            String u = top.getKey();
            int k = top.getValue();
            if (inMST.contains(u)) continue;
            inMST.add(u);
            if (parent.get(u) != null) {
                res.mstEdges.add(parent.get(u) + " - " + u);
                res.totalWeight += k;
            }

            for (Edge e : adj.getOrDefault(u, Collections.emptyList())) {
                String v = e.to;
                if (!inMST.contains(v) && e.weight < key.get(v)) {
                    key.put(v, e.weight);
                    parent.put(v, u);
                    pq.add(new AbstractMap.SimpleEntry<>(v, e.weight));
                }
            }
        }
        return res;
    }

    public static void main(String[] args) {
        List<String> nodes = ${nodeInits};
        Map<String, List<Edge>> adj = new HashMap<>();
${graphInits}

        String start = "${startNode}";
        Result res = prim(nodes, adj, start);

        System.out.println("Prim MST total weight: " + res.totalWeight);
        for (String edge : res.mstEdges) {
            System.out.println("  " + edge);
        }
    }
}
`;
  },
};

javaPrim.source = javaPrim.generateSource(null);
