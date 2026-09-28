/**
 * @file java.js
 * Executable Java implementation for Dijkstra's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaDijkstra = {
  algorithm: 'dijkstra',
  language: 'java',
  filename: 'Dijkstra.java',
  title: 'Dijkstra (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [20, 21, 22, 23, 24, 26, 27],
    [AlgorithmAction.SELECT_NODE]: [30, 31, 32, 33, 34],
    [AlgorithmAction.INSPECT_EDGE]: [37, 38, 39],
    [AlgorithmAction.RELAX_EDGE]: [40, 41, 42, 43, 44],
    [AlgorithmAction.FINISH]: [47],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let graphInits = '';
    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      const nodeLines = nodes.map(n => `        adj.put("${n.id}", new ArrayList<>());`);
      const edges = graph.getEdges ? graph.getEdges() : [];
      const edgeLines = edges.map(e => `        adj.get("${e.from}").add(new Edge("${e.to}", ${e.weight}));`);
      graphInits = `${nodeLines.join('\n')}\n${edgeLines.join('\n')}`;
    } else {
      graphInits = `        adj.put("A", new ArrayList<>(List.of(new Edge("B", 4), new Edge("C", 2))));
        adj.put("B", new ArrayList<>(List.of(new Edge("A", 4), new Edge("C", 1), new Edge("D", 5))));
        adj.put("C", new ArrayList<>(List.of(new Edge("A", 2), new Edge("B", 1), new Edge("D", 8))));
        adj.put("D", new ArrayList<>(List.of(new Edge("B", 5), new Edge("C", 8))));`;
    }

    return `import java.util.*;

public class Dijkstra {
    public static class Edge {
        String to;
        int weight;
        public Edge(String to, int weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    public static class Result {
        public Map<String, Integer> dist = new HashMap<>();
        public Map<String, String> prev = new HashMap<>();
    }

    public static Result dijkstra(Map<String, List<Edge>> adj, String source, String target) {
        Result res = new Result();
        for (String node : adj.keySet()) {
            res.dist.put(node, Integer.MAX_VALUE);
            res.prev.put(node, null);
        }
        res.dist.put(source, 0);

        PriorityQueue<Map.Entry<String, Integer>> pq = new PriorityQueue<>(Map.Entry.comparingByValue());
        pq.add(new AbstractMap.SimpleEntry<>(source, 0));

        while (!pq.isEmpty()) {
            Map.Entry<String, Integer> top = pq.poll();
            String u = top.getKey();
            int currentDist = top.getValue();
            if (currentDist > res.dist.get(u)) continue;
            if (target != null && u.equals(target)) break;

            List<Edge> edges = adj.getOrDefault(u, Collections.emptyList());
            for (Edge e : edges) {
                String v = e.to;
                int weight = e.weight;
                if (res.dist.get(u) + weight < res.dist.getOrDefault(v, Integer.MAX_VALUE)) {
                    res.dist.put(v, res.dist.get(u) + weight);
                    res.prev.put(v, u);
                    pq.add(new AbstractMap.SimpleEntry<>(v, res.dist.get(v)));
                }
            }
        }
        return res;
    }

    public static void main(String[] args) {
        Map<String, List<Edge>> adj = new HashMap<>();
${graphInits}

        String source = "${startNode}";
        String target = "${endNode}";

        Result res = dijkstra(adj, source, target);

        System.out.println("Shortest distance from " + source + " to " + target + ": " + res.dist.get(target));
    }
}
`;
  },
};

javaDijkstra.source = javaDijkstra.generateSource(null);
