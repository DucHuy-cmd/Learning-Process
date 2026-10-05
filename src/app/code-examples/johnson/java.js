/**
 * @file java.js
 * Executable Johnson implementation (Java 17) of Johnson's all-pairs shortest paths.
 * Line numbers in `mapping` refer to the generated source and are verified by the test-suite.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

const TEMPLATE = `import java.util.*;

public class Johnson {
    static final long INF = Long.MAX_VALUE / 4;

    static class Edge {
        final int from;
        final int to;
        final long w;

        Edge(int from, int to, long w) {
            this.from = from;
            this.to = to;
            this.w = w;
        }
    }

    // Returns null when a negative weight cycle exists; otherwise the matrix d(u, v).
    static long[][] johnson(int n, List<Edge> edges) {
        // Step 1: add pseudo vertex q = n (edges q -> v with weight 0), run Bellman-Ford from q
        int q = n;
        List<Edge> aug = new ArrayList<>(edges);
        for (int v = 0; v < n; v++) aug.add(new Edge(q, v, 0));
        long[] h = new long[n + 1];
        Arrays.fill(h, INF);
        h[q] = 0;
        for (int i = 0; i < n; i++) {
            boolean changed = false;
            for (Edge e : aug) {
                if (h[e.from] != INF && h[e.from] + e.w < h[e.to]) {
                    h[e.to] = h[e.from] + e.w;
                    changed = true;
                }
            }
            if (!changed) break;
        }
        for (Edge e : aug) {
            if (h[e.from] != INF && h[e.from] + e.w < h[e.to]) {
                return null;  // negative weight cycle detected
            }
        }

        // Step 2: reweight every edge so that w'(u, v) = w(u, v) + h(u) - h(v) >= 0
        List<List<long[]>> adj = new ArrayList<>();
        for (int v = 0; v < n; v++) adj.add(new ArrayList<>());
        for (Edge e : edges) {
            adj.get(e.from).add(new long[] {e.to, e.w + h[e.from] - h[e.to]});
        }

        // Step 3: run Dijkstra from every vertex on the reweighted graph
        long[][] dPrime = new long[n][n];
        for (int s = 0; s < n; s++) {
            long[] d = new long[n];
            Arrays.fill(d, INF);
            d[s] = 0;
            PriorityQueue<long[]> pq = new PriorityQueue<>(Comparator.comparingLong(a -> a[0]));
            pq.add(new long[] {0, s});
            while (!pq.isEmpty()) {
                long[] top = pq.poll();
                int u = (int) top[1];
                if (top[0] > d[u]) continue;
                for (long[] arc : adj.get(u)) {
                    int v = (int) arc[0];
                    if (d[u] + arc[1] < d[v]) {
                        d[v] = d[u] + arc[1];
                        pq.add(new long[] {d[v], v});
                    }
                }
            }
            dPrime[s] = d;
        }

        // Step 4: convert back, d(u, v) = d'(u, v) - h(u) + h(v)
        long[][] dist = new long[n][n];
        for (int u = 0; u < n; u++) {
            for (int v = 0; v < n; v++) {
                dist[u][v] = (dPrime[u][v] == INF) ? INF : dPrime[u][v] - h[u] + h[v];
            }
        }
        return dist;
    }

    public static void main(String[] args) {
@@NODES@@
        Map<String, Integer> id = new HashMap<>();
        for (int i = 0; i < names.length; i++) id.put(names[i], i);
        List<Edge> edges = new ArrayList<>();
@@EDGES@@

        long[][] dist = johnson(names.length, edges);
        if (dist == null) {
            System.out.println("Graph contains a negative weight cycle. Johnson cannot continue.");
            return;
        }
        System.out.println("All-pairs shortest distances d(u, v):");
        for (int u = 0; u < names.length; u++) {
            StringBuilder row = new StringBuilder(names[u] + ":");
            for (int v = 0; v < names.length; v++) {
                row.append(' ').append(dist[u][v] == INF ? "INF" : String.valueOf(dist[u][v]));
            }
            System.out.println(row);
        }
    }
}
`;

export const javaJohnson = {
  algorithm: 'johnson',
  language: 'java',
  filename: 'Johnson.java',
  title: 'Johnson (Java 17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [21, 22, 23, 26],
    [AlgorithmAction.SELECT_NODE]: [27, 52, 53],
    [AlgorithmAction.INSPECT_EDGE]: [29, 30],
    [AlgorithmAction.RELAX_EDGE]: [31, 47],
    [AlgorithmAction.ERROR]: [37, 38, 39],
    [AlgorithmAction.FINISH]: [77, 80],
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
        .replace('@@EDGES@@', () => "        edges.add(new Edge(id.get(\"A\"), id.get(\"B\"), 2));\n        edges.add(new Edge(id.get(\"A\"), id.get(\"C\"), 4));\n        edges.add(new Edge(id.get(\"B\"), id.get(\"C\"), 1));\n        edges.add(new Edge(id.get(\"B\"), id.get(\"D\"), 7));\n        edges.add(new Edge(id.get(\"C\"), id.get(\"E\"), 3));\n        edges.add(new Edge(id.get(\"D\"), id.get(\"F\"), 1));\n        edges.add(new Edge(id.get(\"E\"), id.get(\"D\"), 2));\n        edges.add(new Edge(id.get(\"B\"), id.get(\"F\"), -3));\n        edges.add(new Edge(id.get(\"F\"), id.get(\"E\"), -2));")
        .replace('@@NODES@@', () => "        String[] names = {\"A\", \"B\", \"C\", \"D\", \"E\", \"F\"};");
    }

    const edgesStr = edges
      .map((e) => `        edges.add(new Edge(id.get("${e.from}"), id.get("${e.to}"), ${e.weight}));`)
      .join('\n');
    const nodesStr = `        String[] names = {${nodes.map((n) => `"${n.id}"`).join(', ')}};`;
    return TEMPLATE.replace('@@EDGES@@', () => edgesStr).replace('@@NODES@@', () => nodesStr);
  },
};

javaJohnson.source = javaJohnson.generateSource(null);
export default javaJohnson;