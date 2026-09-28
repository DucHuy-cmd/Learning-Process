/**
 * @file cpp.js
 * Executable C++ implementation for Kruskal's algorithm.
 */

import { AlgorithmAction } from '../../../core/models/Types.js';

export const cppKruskal = {
  algorithm: 'kruskal',
  language: 'cpp',
  filename: 'kruskal.cpp',
  title: 'Kruskal (C++17)',
  mapping: {
    [AlgorithmAction.INITIALIZE]: [46, 47, 48, 50, 51, 52],
    [AlgorithmAction.INSPECT_EDGE]: [54],
    [AlgorithmAction.ACCEPT_EDGE]: [55, 56, 57, 58, 59],
    [AlgorithmAction.REJECT_EDGE]: [60, 61],
    [AlgorithmAction.FINISH]: [64],
  },
  generateSource(graph) {
    let nodeInits = '{"1", "2", "3", "4", "5", "6"}';
    let edgeInits = `    edges.push_back({"1", "2", 1});
    edges.push_back({"1", "3", 2});
    edges.push_back({"2", "4", 4});
    edges.push_back({"3", "4", 3});
    edges.push_back({"3", "5", 5});
    edges.push_back({"4", "6", 7});
    edges.push_back({"5", "6", 6});`;

    if (graph && typeof graph.getNodes === 'function') {
      const nodes = graph.getNodes();
      nodeInits = `{${nodes.map(n => `"${n.id}"`).join(', ')}}`;
      const edges = graph.getEdges ? graph.getEdges() : [];
      edgeInits = edges.map(e => `    edges.push_back({"${e.from}", "${e.to}", ${e.weight}});`).join('\n');
    }

    return `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>

using namespace std;

struct Edge {
    string u, v;
    int weight;
};

struct DSU {
    unordered_map<string, string> parent;
    unordered_map<string, int> rank;

    DSU(const vector<string>& nodes) {
        for (const auto& node : nodes) {
            parent[node] = node;
            rank[node] = 0;
        }
    }

    string find(const string& x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    bool unite(const string& x, const string& y) {
        string rx = find(x), ry = find(y);
        if (rx == ry) return false;
        if (rank[rx] < rank[ry]) parent[rx] = ry;
        else if (rank[rx] > rank[ry]) parent[ry] = rx;
        else { parent[ry] = rx; rank[rx]++; }
        return true;
    }
};

struct KruskalResult {
    vector<Edge> mst;
    int totalWeight;
};

KruskalResult kruskal(const vector<string>& nodes, vector<Edge> edges) {
    sort(edges.begin(), edges.end(), [](const Edge& a, const Edge& b) {
        return a.weight < b.weight;
    });

    DSU dsu(nodes);
    vector<Edge> mst;
    int totalWeight = 0;

    for (const auto& e : edges) {
        if (dsu.find(e.u) != dsu.find(e.v)) {
            dsu.unite(e.u, e.v);
            mst.push_back(e);
            totalWeight += e.weight;
            if (mst.size() == nodes.size() - 1) break;
        } else {
            continue;
        }
    }
    return {mst, totalWeight};
}

int main() {
    vector<string> nodes = ${nodeInits};
    vector<Edge> edges;
${edgeInits}

    KruskalResult res = kruskal(nodes, edges);

    cout << "MST Edges count: " << res.mst.size() << endl;
    cout << "Total MST weight: " << res.totalWeight << endl;
    return 0;
}
`;
  },
};

cppKruskal.source = cppKruskal.generateSource(null);
