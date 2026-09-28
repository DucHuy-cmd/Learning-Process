/**
 * @file cpp.js
 * Executable C++ implementation for Euler's algorithm (Hierholzer).
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppEuler = {
  algorithm: 'euler',
  language: 'cpp',
  filename: 'euler.cpp',
  title: 'Euler / Hierholzer (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [10, 11, 12, 13, 14, 15, 20, 21, 22, 23, 25, 26],
    [AlgorithmAction.SELECT_NODE]: [29],
    [AlgorithmAction.ACCEPT_EDGE]: [30, 31, 32, 33, 34, 35],
    [AlgorithmAction.BACKTRACK]: [36, 37, 38, 39],
    [AlgorithmAction.FINISH]: [41, 42],
    [AlgorithmAction.ERROR]: [17],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    let edgeInits = `    adj["A"] = {"B", "C", "D", "E"};
    adj["B"] = {"A", "C", "D", "E"};
    adj["C"] = {"A", "B", "D", "E"};
    adj["D"] = {"A", "B", "C", "E"};
    adj["E"] = {"A", "B", "C", "D"};`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      const lines = nodes.map(n => {
        const u = n.id;
        const neighbors = (graph.getOutEdges ? graph.getOutEdges(u) : []).map(e => `"${e.to}"`);
        return `    adj["${u}"] = {${neighbors.join(', ')}};`;
      });
      edgeInits = lines.join('\n');
    }

    return `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

vector<string> findEulerCircuitOrPath(unordered_map<string, vector<string>> adj, const string& startNode = "") {
    vector<string> oddVertices;
    for (const auto& pair : adj) {
        if (pair.second.size() % 2 != 0) {
            oddVertices.push_back(pair.first);
        }
    }
    if (oddVertices.size() != 0 && oddVertices.size() != 2) {
        return {};
    }

    string currStart = startNode;
    if (currStart.empty() || (oddVertices.size() == 2 && find(oddVertices.begin(), oddVertices.end(), currStart) == oddVertices.end())) {
        currStart = oddVertices.empty() ? adj.begin()->first : oddVertices[0];
    }

    vector<string> stack = {currStart};
    vector<string> circuit;

    while (!stack.empty()) {
        string v = stack.back();
        if (!adj[v].empty()) {
            string w = adj[v].back();
            adj[v].pop_back();
            auto it = find(adj[w].begin(), adj[w].end(), v);
            if (it != adj[w].end()) adj[w].erase(it);
            stack.push_back(w);
        } else {
            circuit.push_back(stack.back());
            stack.pop_back();
        }
    }
    reverse(circuit.begin(), circuit.end());
    return circuit;
}

int main() {
    unordered_map<string, vector<string>> adj;
${edgeInits}

    string start = "${startNode}";
    vector<string> circuit = findEulerCircuitOrPath(adj, start);

    if (!circuit.empty()) {
        cout << "Euler trail: ";
        for (size_t i = 0; i < circuit.size(); i++) {
            cout << circuit[i] << (i + 1 < circuit.size() ? " -> " : "");
        }
        cout << endl;
    } else {
        cout << "No Eulerian circuit or path found." << endl;
    }
    return 0;
}
`;
  },
};

cppEuler.source = cppEuler.generateSource(null);
