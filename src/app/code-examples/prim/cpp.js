/**
 * @file cpp.js
 * Executable C++ implementation for Prim's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppPrim = {
  algorithm: 'prim',
  language: 'cpp',
  filename: 'prim.cpp',
  title: 'Prim (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35],
    [AlgorithmAction.SELECT_NODE]: [38, 39, 40, 41, 42, 43, 44, 45],
    [AlgorithmAction.INSPECT_EDGE]: [49],
    [AlgorithmAction.RELAX_EDGE]: [52, 53, 54, 55],
    [AlgorithmAction.FINISH]: [59],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'x1';
    let nodeInits = '{"x1", "x2", "x3", "x4", "x5"}';
    let edgeInits = `    adj["x1"].push_back({"x2", 2});
    adj["x1"].push_back({"x3", 3});
    adj["x2"].push_back({"x1", 2});
    adj["x2"].push_back({"x3", 1});
    adj["x2"].push_back({"x4", 1});
    adj["x2"].push_back({"x5", 4});
    adj["x3"].push_back({"x1", 3});
    adj["x3"].push_back({"x2", 1});
    adj["x3"].push_back({"x4", 5});
    adj["x4"].push_back({"x2", 1});
    adj["x4"].push_back({"x3", 5});
    adj["x4"].push_back({"x5", 1});
    adj["x5"].push_back({"x2", 4});
    adj["x5"].push_back({"x4", 1});`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `{${nodes.map(n => `"${n.id}"`).join(', ')}}`;
      const edges = graph.getEdges ? graph.getEdges() : [];
      edgeInits = edges.map(e => `    adj["${e.from}"].push_back({"${e.to}", ${e.weight}});`).join('\n');
    }

    return `#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <unordered_map>
#include <unordered_set>

using namespace std;

const long long INF = 1e18;

struct Edge {
    string to;
    int weight;
};

struct PrimResult {
    vector<pair<pair<string, string>, int>> mstEdges;
    long long totalWeight;
};

PrimResult prim(const vector<string>& nodes, const unordered_map<string, vector<Edge>>& adj, const string& startNode) {
    unordered_map<string, long long> key;
    unordered_map<string, string> parent;
    unordered_set<string> inMST;
    PrimResult res;
    res.totalWeight = 0;

    for (const auto& u : nodes) {
        key[u] = INF;
        parent[u] = "";
    }
    key[startNode] = 0;
    priority_queue<pair<long long, string>, vector<pair<long long, string>>, greater<pair<long long, string>>> pq;
    pq.push({0, startNode});

    while (!pq.empty() && inMST.size() < nodes.size()) {
        auto [k, u] = pq.top();
        pq.pop();
        if (inMST.count(u)) continue;
        inMST.insert(u);
        if (!parent[u].empty()) {
            res.mstEdges.push_back({{parent[u], u}, (int)k});
            res.totalWeight += k;
        }

        auto it = adj.find(u);
        if (it == adj.end()) continue;
        for (const auto& edge : it->second) {
            const string& v = edge.to;
            int weight = edge.weight;
            if (!inMST.count(v) && weight < key[v]) {
                key[v] = weight;
                parent[v] = u;
                pq.push({key[v], v});
            }
        }
    }
    return res;
}

int main() {
    vector<string> nodes = ${nodeInits};
    unordered_map<string, vector<Edge>> adj;
${edgeInits}

    string startNode = "${startNode}";
    PrimResult res = prim(nodes, adj, startNode);

    cout << "Prim MST total weight: " << res.totalWeight << endl;
    for (const auto& item : res.mstEdges) {
        cout << "  " << item.first.first << " - " << item.first.second << " (" << item.second << ")" << endl;
    }
    return 0;
}
`;
  },
};

cppPrim.source = cppPrim.generateSource(null);
