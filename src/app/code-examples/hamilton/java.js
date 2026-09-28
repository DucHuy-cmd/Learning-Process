/**
 * @file java.js
 * Executable Java implementation for Hamiltonian Cycle / Path algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const javaHamilton = {
  algorithm: 'hamilton',
  language: 'java',
  filename: 'Hamilton.java',
  title: 'Hamilton (Java 11+)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [33, 34, 36, 37, 39],
    [AlgorithmAction.SELECT_NODE]: [16, 17, 18, 19],
    [AlgorithmAction.BACKTRACK]: [25, 26],
    [AlgorithmAction.FINISH]: [5, 6, 7, 8, 9, 10, 40],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const wantCycle = options.wantCycle !== false;

    let nodeInits = 'Arrays.asList("A", "B", "C", "D", "E")';
    let graphInits = `        for (String u : nodes) adj.put(u, new ArrayList<>());
        for (String u : nodes) {
            for (String v : nodes) {
                if (!u.equals(v)) adj.get(u).add(v);
            }
        }`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `Arrays.asList(${nodes.map(n => `"${n.id}"`).join(', ')})`;
      const edges = graph.getEdges ? graph.getEdges() : [];
      const edgeLines = edges.map(e => `        adj.get("${e.from}").add("${e.to}");`);
      graphInits = `        for (String u : nodes) adj.put(u, new ArrayList<>());\n${edgeLines.join('\n')}`;
    }

    return `import java.util.*;

public class Hamilton {
    public static boolean backtrack(List<String> nodes, Map<String, List<String>> adj, String startNode, boolean wantCycle, List<String> path, Set<String> visited) {
        if (path.size() == nodes.size()) {
            if (!wantCycle) return true;
            String last = path.get(path.size() - 1);
            if (adj.getOrDefault(last, Collections.emptyList()).contains(startNode)) {
                path.add(startNode);
                return true;
            }
            return false;
        }

        String u = path.get(path.size() - 1);
        for (String v : adj.getOrDefault(u, Collections.emptyList())) {
            if (!visited.contains(v)) {
                visited.add(v);
                path.add(v);

                if (backtrack(nodes, adj, startNode, wantCycle, path, visited)) {
                    return true;
                }

                path.remove(path.size() - 1);
                visited.remove(v);
            }
        }
        return false;
    }

    public static List<String> findHamiltonian(List<String> nodes, Map<String, List<String>> adj, String startNode, boolean wantCycle) {
        List<String> path = new ArrayList<>();
        Set<String> visited = new HashSet<>();

        path.add(startNode);
        visited.add(startNode);

        if (backtrack(nodes, adj, startNode, wantCycle, path, visited)) {
            return path;
        }
        return Collections.emptyList();
    }

    public static void main(String[] args) {
        List<String> nodes = ${nodeInits};
        Map<String, List<String>> adj = new HashMap<>();
${graphInits}

        String start = "${startNode}";
        boolean wantCycle = ${wantCycle ? 'true' : 'false'};

        List<String> result = findHamiltonian(nodes, adj, start, wantCycle);

        if (!result.isEmpty()) {
            System.out.println("Hamiltonian " + (wantCycle ? "cycle" : "path") + " found:");
            System.out.println(String.join(" -> ", result));
        } else {
            System.out.println("No Hamiltonian solution found.");
        }
    }
}
`;
  },
};

javaHamilton.source = javaHamilton.generateSource(null);
