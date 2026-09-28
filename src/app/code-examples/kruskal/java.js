/**
 * @file java.js
 * Executable Java implementation for Kruskal's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaKruskal = {
  algorithm: 'kruskal',
  language: 'java',
  filename: 'Kruskal.java',
  title: 'Kruskal (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [54, 55, 56],
    [AlgorithmAction.INSPECT_EDGE]: [58],
    [AlgorithmAction.ACCEPT_EDGE]: [59, 60, 61, 62, 63],
    [AlgorithmAction.REJECT_EDGE]: [64, 65],
    [AlgorithmAction.FINISH]: [68],
  },
  generateSource(graph) {
    let nodeInits = 'Arrays.asList("1", "2", "3", "4", "5", "6")';
    let edgeInits = `        edges.add(new Edge("1", "2", 1));
        edges.add(new Edge("1", "3", 2));
        edges.add(new Edge("2", "4", 4));
        edges.add(new Edge("3", "4", 3));
        edges.add(new Edge("3", "5", 5));
        edges.add(new Edge("4", "6", 7));
        edges.add(new Edge("5", "6", 6));`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `Arrays.asList(${nodes.map(n => `"${n.id}"`).join(', ')})`;
      const edges = graph.getEdges ? graph.getEdges() : [];
      edgeInits = edges.map(e => `        edges.add(new Edge("${e.from}", "${e.to}", ${e.weight}));`).join('\n');
    }

    return `import java.util.*;

public class Kruskal {
    public static class Edge implements Comparable<Edge> {
        String u, v;
        int weight;

        public Edge(String u, String v, int weight) {
            this.u = u;
            this.v = v;
            this.weight = weight;
        }

        @Override
        public int compareTo(Edge other) {
            return Integer.compare(this.weight, other.weight);
        }
    }

    public static class DSU {
        Map<String, String> parent = new HashMap<>();
        Map<String, Integer> rank = new HashMap<>();

        public DSU(List<String> nodes) {
            for (String node : nodes) {
                parent.put(node, node);
                rank.put(node, 0);
            }
        }

        public String find(String x) {
            if (!x.equals(parent.get(x))) {
                parent.put(x, find(parent.get(x)));
            }
            return parent.get(x);
        }

        public boolean union(String x, String y) {
            String rx = find(x), ry = find(y);
            if (rx.equals(ry)) return false;
            if (rank.get(rx) < rank.get(ry)) parent.put(rx, ry);
            else if (rank.get(rx) > rank.get(ry)) parent.put(ry, rx);
            else { parent.put(ry, rx); rank.put(rx, rank.get(rx) + 1); }
            return true;
        }
    }

    public static class Result {
        public List<Edge> mst = new ArrayList<>();
        public int totalWeight = 0;
    }

    public static Result kruskal(List<String> nodes, List<Edge> edges) {
        Collections.sort(edges);
        DSU dsu = new DSU(nodes);
        Result res = new Result();

        for (Edge e : edges) {
            if (!dsu.find(e.u).equals(dsu.find(e.v))) {
                dsu.union(e.u, e.v);
                res.mst.add(e);
                res.totalWeight += e.weight;
                if (res.mst.size() == nodes.size() - 1) break;
            } else {
                continue;
            }
        }
        return res;
    }

    public static void main(String[] args) {
        List<String> nodes = ${nodeInits};
        List<Edge> edges = new ArrayList<>();
${edgeInits}

        Result res = kruskal(nodes, edges);

        System.out.println("MST Edges count: " + res.mst.size());
        System.out.println("Total MST weight: " + res.totalWeight);
    }
}
`;
  },
};

javaKruskal.source = javaKruskal.generateSource(null);
