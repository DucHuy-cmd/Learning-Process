/**
 * @file cpp.js
 * Executable C++ implementation for Dijkstra's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppDijkstra = {
  algorithm: 'dijkstra',
  language: 'cpp',
  filename: 'dijkstra.cpp',
  title: 'Dijkstra (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [24, 25, 26, 27, 28, 29, 30],
    [AlgorithmAction.SELECT_NODE]: [33, 34, 35],
    [AlgorithmAction.INSPECT_EDGE]: [40],
    [AlgorithmAction.RELAX_EDGE]: [43, 44, 45, 46],
    [AlgorithmAction.FINISH]: [50],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let addEdgesStr = '';
    if (graph && typeof graph.getNodes === 'function') {
      const edges = graph.getEdges ? graph.getEdges() : [];
      const lines = edges.map(e => `    adj["${e.from}"].push_back({"${e.to}", ${e.weight}});`);
      addEdgesStr = lines.join('\n');
    } else {
      addEdgesStr = `    adj["A"].push_back({"B", 4});
    adj["A"].push_back({"C", 2});
    adj["B"].push_back({"A", 4});
    adj["B"].push_back({"C", 1});
    adj["B"].push_back({"D", 5});
    adj["C"].push_back({"A", 2});
    adj["C"].push_back({"B", 1});
    adj["C"].push_back({"D", 8});
    adj["D"].push_back({"B", 5});
    adj["D"].push_back({"C", 8});`;
    }

    return `#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

const long long INF = 1e18;

struct Edge {
    string to;
    int weight;
};

struct DijkstraResult {
    unordered_map<string, long long> dist;
    unordered_map<string, string> prev;
};

DijkstraResult dijkstra(const unordered_map<string, vector<Edge>>& adj, const string& source, const string& target = "") {
    DijkstraResult res;
    for (const auto& pair : adj) {
        res.dist[pair.first] = INF;
        res.prev[pair.first] = "";
    }
    res.dist[source] = 0;
    priority_queue<pair<long long, string>, vector<pair<long long, string>>, greater<pair<long long, string>>> pq;
    pq.push({0, source});

    while (!pq.empty()) {
        auto [current_dist, u] = pq.top();
        pq.pop();
        if (current_dist > res.dist[u]) continue;
        if (!target.empty() && u == target) break;

        auto it = adj.find(u);
        if (it == adj.end()) continue;
        for (const auto& edge : it->second) {
            const string& v = edge.to;
            int weight = edge.weight;
            if (res.dist[u] + weight < res.dist[v]) {
                res.dist[v] = res.dist[u] + weight;
                res.prev[v] = u;
                pq.push({res.dist[v], v});
            }
        }
    }
    return res;
}

int main() {
    unordered_map<string, vector<Edge>> adj;
${addEdgesStr}

    string source = "${startNode}";
    string target = "${endNode}";

    DijkstraResult res = dijkstra(adj, source, target);

    cout << "Shortest distance from " << source << " to " << target << ": " << res.dist[target] << endl;
    return 0;
}
`;
  },
};

cppDijkstra.source = cppDijkstra.generateSource(null);
