/**
 * @file cpp.js
 * Executable C++ implementation for Bellman-Ford algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppBellmanFord = {
  algorithm: 'bellman_ford',
  language: 'cpp',
  filename: 'bellman_ford.cpp',
  title: 'Bellman-Ford (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [25, 26, 27, 28, 29, 30],
    [AlgorithmAction.SELECT_NODE]: [32, 33, 34],
    [AlgorithmAction.INSPECT_EDGE]: [35, 36],
    [AlgorithmAction.RELAX_EDGE]: [37, 38, 39, 40],
    [AlgorithmAction.ERROR]: [47, 48, 49, 50, 51],
    [AlgorithmAction.FINISH]: [53],
  },
  generateSource(graph, options = {}) {
    const startNode = options.startNodeId || 'A';
    const endNode = options.endNodeId || 'D';

    let addEdgesStr = '';
    if (graph && typeof graph.getNodes === 'function') {
      const edges = graph.getEdges ? graph.getEdges() : [];
      const lines = edges.map(e => `    edges.push_back({"${e.from}", "${e.to}", ${e.weight}});`);
      addEdgesStr = lines.join('\n');
    } else {
      addEdgesStr = `    edges.push_back({"A", "B", 4});
    edges.push_back({"A", "C", 2});
    edges.push_back({"B", "C", -1});
    edges.push_back({"B", "D", 2});
    edges.push_back({"C", "D", 5});`;
    }

    return `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>

using namespace std;

const long long INF = 1e18;

struct Edge {
    string from;
    string to;
    int weight;
};

struct BellmanFordResult {
    unordered_map<string, long long> dist;
    unordered_map<string, string> prev;
    bool hasNegativeCycle = false;
};

BellmanFordResult bellmanFord(const vector<Edge>& edges, const unordered_set<string>& nodes, const string& source) {
    BellmanFordResult res;
    for (const string& node : nodes) {
        res.dist[node] = INF;
        res.prev[node] = "";
    }
    res.dist[source] = 0;

    int n = nodes.size();
    for (int k = 1; k < n; ++k) {
        bool changed = false;
        for (const auto& edge : edges) {
            if (res.dist[edge.from] != INF && res.dist[edge.from] + edge.weight < res.dist[edge.to]) {
                res.dist[edge.to] = res.dist[edge.from] + edge.weight;
                res.prev[edge.to] = edge.from;
                changed = true;
            }
        }
        if (!changed) break; // Early stop
    }

    // Check for negative cycles
    for (const auto& edge : edges) {
        if (res.dist[edge.from] != INF && res.dist[edge.from] + edge.weight < res.dist[edge.to]) {
            res.hasNegativeCycle = true;
            break;
        }
    }

    return res;
}

int main() {
    vector<Edge> edges;
${addEdgesStr}

    unordered_set<string> nodes;
    for (const auto& e : edges) {
        nodes.insert(e.from);
        nodes.insert(e.to);
    }

    string source = "${startNode}";
    string target = "${endNode}";

    BellmanFordResult res = bellmanFord(edges, nodes, source);

    if (res.hasNegativeCycle) {
        cout << "Graph contains a negative weight cycle!" << endl;
    } else {
        cout << "Shortest distance from " << source << " to " << target << ": ";
        if (res.dist[target] == INF) cout << "Unreachable" << endl;
        else cout << res.dist[target] << endl;
    }
    return 0;
}
`;
  },
};

cppBellmanFord.source = cppBellmanFord.generateSource(null);
export default cppBellmanFord;
