/**
 * @file java.js
 * Executable Java implementation for Euler's algorithm (Hierholzer).
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaEuler = {
  algorithm: 'euler',
  language: 'java',
  filename: 'Euler.java',
  title: 'Euler / Hierholzer (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [5, 6, 7, 10, 11, 12, 13, 14, 20, 21, 22, 25, 26, 27],
    [AlgorithmAction.SELECT_NODE]: [30],
    [AlgorithmAction.ACCEPT_EDGE]: [32, 33, 34, 35],
    [AlgorithmAction.BACKTRACK]: [36, 37, 38],
    [AlgorithmAction.FINISH]: [40, 41],
    [AlgorithmAction.ERROR]: [17],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    let graphInits = `        adj.put("A", new ArrayList<>(List.of("B", "C", "D", "E")));
        adj.put("B", new ArrayList<>(List.of("A", "C", "D", "E")));
        adj.put("C", new ArrayList<>(List.of("A", "B", "D", "E")));
        adj.put("D", new ArrayList<>(List.of("A", "B", "C", "E")));
        adj.put("E", new ArrayList<>(List.of("A", "B", "C", "D")));`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      const lines = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : []).map(e => `"${e.to}"`);
        return `        adj.put("${u}", new ArrayList<>(List.of(${neighbors.join(', ')})));`;
      });
      graphInits = lines.join('\n');
    }

    return `import java.util.*;

public class Euler {
    public static List<String> findEulerCircuitOrPath(Map<String, List<String>> originalAdj, String startNode) {
        Map<String, List<String>> adj = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : originalAdj.entrySet()) {
            adj.put(entry.getKey(), new ArrayList<>(entry.getValue()));
        }

        List<String> oddVertices = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : adj.entrySet()) {
            if (entry.getValue().size() % 2 != 0) {
                oddVertices.add(entry.getKey());
            }
        }
        if (oddVertices.size() != 0 && oddVertices.size() != 2) {
            return Collections.emptyList();
        }

        String curr = startNode;
        if (curr == null || (oddVertices.size() == 2 && !oddVertices.contains(curr))) {
            curr = oddVertices.isEmpty() ? adj.keySet().iterator().next() : oddVertices.get(0);
        }

        Deque<String> stack = new ArrayDeque<>();
        stack.push(curr);
        List<String> circuit = new ArrayList<>();

        while (!stack.isEmpty()) {
            String v = stack.peek();
            List<String> neighbors = adj.getOrDefault(v, Collections.emptyList());
            if (!neighbors.isEmpty()) {
                String w = neighbors.remove(neighbors.size() - 1);
                adj.getOrDefault(w, Collections.emptyList()).remove(v);
                stack.push(w);
            } else {
                circuit.add(stack.pop());
            }
        }
        Collections.reverse(circuit);
        return circuit;
    }

    public static void main(String[] args) {
        Map<String, List<String>> adj = new HashMap<>();
${graphInits}

        String start = "${startNode}";
        List<String> trail = findEulerCircuitOrPath(adj, start);

        if (!trail.isEmpty()) {
            System.out.println("Euler trail: " + String.join(" -> ", trail));
        } else {
            System.out.println("No Eulerian circuit or path found.");
        }
    }
}
`;
  },
};

javaEuler.source = javaEuler.generateSource(null);
