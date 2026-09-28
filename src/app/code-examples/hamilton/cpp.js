/**
 * @file cpp.js
 * Executable C++ implementation for Hamiltonian Cycle / Path algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppHamilton = {
  algorithm: 'hamilton',
  language: 'cpp',
  filename: 'hamilton.cpp',
  title: 'Hamilton (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [43, 44, 46],
    [AlgorithmAction.SELECT_NODE]: [26, 27, 28, 29],
    [AlgorithmAction.BACKTRACK]: [35, 36],
    [AlgorithmAction.FINISH]: [11, 12, 13, 15, 16, 17, 47],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const wantCycle = options.wantCycle !== false;

    let nodeInits = '{"A", "B", "C", "D", "E"}';
    let edgeInits = `    adj["A"] = {"B", "C", "D", "E"};
    adj["B"] = {"A", "C", "D", "E"};
    adj["C"] = {"A", "B", "D", "E"};
    adj["D"] = {"A", "B", "C", "E"};
    adj["E"] = {"A", "B", "C", "D"};`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `{${nodes.map(n => `"${n.id}"`).join(', ')}}`;
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
#include <unordered_set>
#include <algorithm>

using namespace std;

bool backtrack(const vector<string>& nodes, const unordered_map<string, vector<string>>& adj, const string& startNode, bool wantCycle, vector<string>& path, unordered_set<string>& visited) {
    if (path.size() == nodes.size()) {
        if (!wantCycle) return true;
        const string& last = path.back();
        auto it = adj.find(last);
        if (it != adj.end() && find(it->second.begin(), it->second.end(), startNode) != it->second.end()) {
            path.push_back(startNode);
            return true;
        }
        return false;
    }

    const string& u = path.back();
    auto it = adj.find(u);
    if (it == adj.end()) return false;

    for (const string& v : it->second) {
        if (!visited.count(v)) {
            visited.insert(v);
            path.push_back(v);

            if (backtrack(nodes, adj, startNode, wantCycle, path, visited)) {
                return true;
            }

            path.pop_back();
            visited.erase(v);
        }
    }
    return false;
}

vector<string> findHamiltonian(const vector<string>& nodes, const unordered_map<string, vector<string>>& adj, const string& startNode, bool wantCycle = true) {
    vector<string> path = {startNode};
    unordered_set<string> visited = {startNode};

    if (backtrack(nodes, adj, startNode, wantCycle, path, visited)) {
        return path;
    }
    return {};
}

int main() {
    vector<string> nodes = ${nodeInits};
    unordered_map<string, vector<string>> adj;
${edgeInits}

    string start = "${startNode}";
    bool wantCycle = ${wantCycle ? 'true' : 'false'};

    vector<string> path = findHamiltonian(nodes, adj, start, wantCycle);

    if (!path.empty()) {
        cout << (wantCycle ? "Hamiltonian cycle found: " : "Hamiltonian path found: ");
        for (size_t i = 0; i < path.size(); i++) {
            cout << path[i] << (i + 1 < path.size() ? " -> " : "");
        }
        cout << endl;
    } else {
        cout << "No Hamiltonian solution found." << endl;
    }
    return 0;
}
`;
  },
};

cppHamilton.source = cppHamilton.generateSource(null);
