/**
 * @file cpp.js
 * Executable Johnson implementation (C++17) of Johnson's all-pairs shortest paths.
 * Line numbers in `mapping` refer to the generated source and are verified by the test-suite.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

const TEMPLATE = `#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <queue>
#include <limits>
#include <algorithm>
using namespace std;

struct Edge {
    string from;
    string to;
    long long w;
};

const long long INF = numeric_limits<long long>::max() / 4;

// Returns false when a negative weight cycle exists; otherwise fills dist with d(u, v).
bool johnson(const vector<string>& nodes, const vector<Edge>& edges,
             map<string, map<string, long long>>& dist) {
    // Step 1: add pseudo vertex q (edges q -> v with weight 0), run Bellman-Ford from q
    const string q = "q";
    vector<Edge> aug = edges;
    for (const string& v : nodes) aug.push_back({q, v, 0});
    map<string, long long> h;
    for (const string& v : nodes) h[v] = INF;
    h[q] = 0;
    for (size_t i = 0; i < nodes.size(); i++) {
        bool changed = false;
        for (const Edge& e : aug) {
            if (h[e.from] != INF && h[e.from] + e.w < h[e.to]) {
                h[e.to] = h[e.from] + e.w;
                changed = true;
            }
        }
        if (!changed) break;
    }
    for (const Edge& e : aug) {
        if (h[e.from] != INF && h[e.from] + e.w < h[e.to]) {
            return false;  // negative weight cycle detected
        }
    }

    // Step 2: reweight every edge so that w'(u, v) = w(u, v) + h(u) - h(v) >= 0
    map<string, vector<pair<string, long long>>> adj;
    for (const Edge& e : edges) {
        adj[e.from].push_back({e.to, e.w + h[e.from] - h[e.to]});
    }

    // Step 3: run Dijkstra from every vertex on the reweighted graph
    map<string, map<string, long long>> dPrime;
    for (const string& s : nodes) {
        map<string, long long> d;
        for (const string& v : nodes) d[v] = INF;
        d[s] = 0;
        priority_queue<pair<long long, string>, vector<pair<long long, string>>, greater<>> pq;
        pq.push({0, s});
        while (!pq.empty()) {
            auto [du, u] = pq.top();
            pq.pop();
            if (du > d[u]) continue;
            for (const auto& [v, w] : adj[u]) {
                if (d[u] + w < d[v]) {
                    d[v] = d[u] + w;
                    pq.push({d[v], v});
                }
            }
        }
        dPrime[s] = d;
    }

    // Step 4: convert back, d(u, v) = d'(u, v) - h(u) + h(v)
    for (const string& u : nodes) {
        for (const string& v : nodes) {
            dist[u][v] = (dPrime[u][v] == INF) ? INF : dPrime[u][v] - h[u] + h[v];
        }
    }
    return true;
}

int main() {
@@NODES@@
    vector<Edge> edges;
@@EDGES@@

    map<string, map<string, long long>> dist;
    if (!johnson(nodes, edges, dist)) {
        cout << "Graph contains a negative weight cycle. Johnson cannot continue." << endl;
        return 0;
    }

    cout << "All-pairs shortest distances d(u, v):" << endl;
    for (const string& u : nodes) {
        for (const string& v : nodes) {
            if (dist[u][v] == INF) cout << "INF\\t";
            else cout << dist[u][v] << "\\t";
        }
        cout << endl;
    }
    return 0;
}
`;

export const cppJohnson = {
  algorithm: 'johnson',
  language: 'cpp',
  filename: 'johnson.cpp',
  title: 'Johnson (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [22, 23, 24, 27],
    [AlgorithmAction.SELECT_NODE]: [28, 52, 53],
    [AlgorithmAction.INSPECT_EDGE]: [30, 31],
    [AlgorithmAction.RELAX_EDGE]: [32, 47],
    [AlgorithmAction.ERROR]: [38, 39, 40],
    [AlgorithmAction.FINISH]: [75, 78],
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
        .replace('@@EDGES@@', () => "    edges.push_back({\"A\", \"B\", 2});\n    edges.push_back({\"A\", \"C\", 4});\n    edges.push_back({\"B\", \"C\", 1});\n    edges.push_back({\"B\", \"D\", 7});\n    edges.push_back({\"C\", \"E\", 3});\n    edges.push_back({\"D\", \"F\", 1});\n    edges.push_back({\"E\", \"D\", 2});\n    edges.push_back({\"B\", \"F\", -3});\n    edges.push_back({\"F\", \"E\", -2});")
        .replace('@@NODES@@', () => "    vector<string> nodes = {\"A\", \"B\", \"C\", \"D\", \"E\", \"F\"};");
    }

    const edgesStr = edges
      .map((e) => `    edges.push_back({"${e.from}", "${e.to}", ${e.weight}});`)
      .join('\n');
    const nodesStr = `    vector<string> nodes = {${nodes.map((n) => `"${n.id}"`).join(', ')}};`;
    return TEMPLATE.replace('@@EDGES@@', () => edgesStr).replace('@@NODES@@', () => nodesStr);
  },
};

cppJohnson.source = cppJohnson.generateSource(null);
export default cppJohnson;