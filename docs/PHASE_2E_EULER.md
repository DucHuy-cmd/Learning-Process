# Phase 2E Report: Euler Headless Engine

**Phase:** 2E - Euler Headless Engine Extraction
**Date:** September 24, 2026
**Status:** Completed
**Source Baseline:** Golden Master (`legacy/index.html`, `v1.0.0-golden-master`)
**Target Module:** `src/core/algorithms/EulerEngine.js`

---

## 1. Legacy Behavior Characterization (Phase 2E Inspection)

Before authoring `EulerEngine.js`, the Golden Master implementation `buildTraceEuler(startIndex)` (lines 1801-2391 of `legacy/index.html`) was inspected. The characterization findings are documented below:

| Aspect | Legacy Undirected Behavior | Legacy Directed Behavior | Headless Engine (`EulerEngine.js`) |
|---|---|---|---|
| **1. Degree Calculation** | `degree[u]++`, `degree[v]++` for each edge. | `outDegree[u]++`, `inDegree[v]++` for each edge. | Calculates node degrees via iteration over graph edges in exact insertion order. |
| **2. Edge Adjacency Representation** | `adjLocal[u].push({to: v, id: idx})`, `adjLocal[v].push({to: u, id: idx})` sharing same edge index `idx`. | `adjLocal[u].push({to: v, id: idx})` only for source node. | Uses `graph.getEdges()` index `idx` mapping to each edge ID. Undirected pushes to both endpoints with identical edge ID. |
| **3. Active Nodes** | Vertices with `degree[i] > 0`. | Vertices with `inDegree[i] > 0 \|\| outDegree[i] > 0`. | Active nodes collected in vertex insertion order. Isolated nodes (`degree === 0`) are ignored. |
| **4. Connectivity Check** | BFS over `adjLocal` across active nodes. | Weak connectivity: converts directed edges to undirected, then BFS across active nodes. | Exactly matches legacy: BFS traversal on active nodes (undirected projection for directed graphs). Single component $\rightarrow$ connected. |
| **5. Classification Types** | `empty` (0 edges), `disconnected` (components > 1), `circuit` (0 odd), `path` (2 odd), `none_odd` (> 2 odd). | `empty` (0 edges), `disconnected` (components > 1), `circuit` (all active in == out), `path` (1 start candidate, 1 end candidate, others balanced), `none_degree` (otherwise). | Preserves exact legacy classification strings: `circuit`, `path`, `disconnected`, `none_odd`, `none_degree`, `empty`. |
| **6. Start Node Selection (Circuit)** | If `startIndex` valid & `degree > 0`, use it; else fallback to `activeNodes[0] \|\| 0`. | If `startIndex` valid & `outDegree > 0`, use it; else fallback to `activeNodes[0] \|\| 0`. | Supports `startNodeId`. If valid with degree > 0, selected. Otherwise falls back to first active node. |
| **7. Start Node Selection (Path)** | If `startIndex === odd[0] \|\| startIndex === odd[1]`, use it; else default to `odd[0]`. `chosenEnd` is the other odd node. | **Ignores** `startIndex`! Strictly sets `chosenStart = startCandidates[0]` and `chosenEnd = endCandidates[0]`. | Undirected accepts odd starting node; directed strictly starts at `startCandidates[0]` (preserving legacy contract). |
| **8. Traversal Order** | Hierholzer using linear pointer `ptr[v]` over `adjLocal[v]`. | Hierholzer using linear pointer `ptr[v]` over `adjLocal[v]`. | Strictly preserves edge insertion order: no sorting by weight, ID, or vertex label. |
| **9. Self-loops** | Handled correctly: increments degree by 2, traversed when unvisited. | Handled correctly: `outDegree++`, `inDegree++`, traversed when unvisited. | Verified: self-loops do not create infinite loops or crash. |
| **10. Replay Steps** | DOM-coupled `frames` and `tableRows`. | DOM-coupled `frames` and `tableRows`. | Standardized `AlgorithmStep` snapshots using `Types.js` (`INITIALIZE`, `SELECT_NODE`, `INSPECT_EDGE`, `ACCEPT_EDGE`, `BACKTRACK`, `FINISH`). |

---

## 2. Euler Engine API

```javascript
import { euler, EulerEngine } from './src/core/algorithms/EulerEngine.js';

// Functional call:
const result = euler(graph, startNodeId = null);

// Object-oriented call:
const engine = new EulerEngine(graph, startNodeId = null);
const result = engine.run();
```

### Return Shape (`AlgorithmResult`):
```javascript
{
  status: 'SUCCESS' | 'FAILURE' | 'INVALID_INPUT',
  type: 'euler',
  subType: 'circuit' | 'path' | 'disconnected' | 'none_odd' | 'none_degree' | 'empty',
  message: string,
  circuit: string[],          // Array of node IDs in traversal order, e.g. ['A', 'B', 'C', 'A']
  path: string[],             // Standard alias to circuit
  edges: Edge[],              // Traversed edge objects in order
  edgeIds: string[],          // IDs of traversed edges in order
  totalWeight: number,        // Sum of edge weights traversed
  steps: AlgorithmStep[],     // Replayable trace snapshots
  statistics: {
    vertexCount: number,      // Total nodes in graph
    edgeCount: number,        // Total edges in graph
    circuitVertexCount: number, // Node count in circuit/path
    circuitEdgeCount: number,   // Edges traversed
    oddDegreeCount: number,   // Number of odd degree nodes (undirected)
    startCandidatesCount: number, // out = in + 1 nodes (directed)
    endCandidatesCount: number,   // in = out + 1 nodes (directed)
    unbalancedCount: number,  // Count of other unbalanced nodes
    isDirected: boolean,
    connected: boolean,
  },
  warnings: string[],
  connected: boolean,         // Whether active nodes are connected
  components: string[][],     // Connected components
  chosenStart: string|null,   // Starting node ID
  chosenEnd: string|null,     // Ending node ID
  odd: string[],              // Odd-degree node IDs (undirected)
  startCandidates: string[],  // Out = In + 1 node IDs (directed)
  endCandidates: string[],    // In = Out + 1 node IDs (directed)
}
```

---

## 3. DOM Independence & Immutability Verification

- **Zero Browser Globals:** `EulerEngine.js` contains no references to `window`, `document`, `SVG`, `localStorage`, `HTMLElement`, or `requestAnimationFrame`.
- **Graph Immutability:** `graph` is strictly read-only. No runtime properties (`used`, `degree`, `ptr`, etc.) are attached to `graph` or node objects.
- **Snapshot Isolation:** Every `AlgorithmStep` clones `stack`, `circuit`, and `usedEdges` at creation:
  ```javascript
  state: {
    stack: stack.map(idx => allNodes[idx].id),
    circuit: circ.map(idx => allNodes[idx].id),
    usedEdgesCount: usedCount,
    isDirected
  }
  ```

---

## 4. Test Suite Summary & Inventory

### 4.1 New Tests in `tests/core/EulerEngine.test.js` (20 tests)
1. **Undirected Euler circuit**: All even degree nodes form complete closed circuit.
2. **Undirected Euler path**: Exactly 2 odd degree nodes form open path.
3. **Undirected graph with >2 odd nodes**: Correctly classifies as `none_odd`.
4. **Undirected disconnected graph**: Correctly detects disconnected components (`disconnected`).
5. **Undirected empty graph**: Gracefully handles 0 edges (`empty`).
6. **Undirected single node graph**: 0 edges, handles gracefully (`empty`).
7. **Undirected circuit custom start node**: Starts traversal at specified node when degree > 0.
8. **Undirected path start node selection**: Respects odd node if provided, falls back to `odd[0]` otherwise.
9. **Directed Euler circuit**: Balanced active nodes form closed directed circuit.
10. **Directed Euler path**: Exactly 1 start candidate, 1 end candidate, others balanced.
11. **Directed path strictly ignores start node**: Enforces legacy rule that directed path always starts at `startCandidates[0]`.
12. **Directed disconnected graph**: Weakly disconnected graph classified as `disconnected`.
13. **Directed unbalanced degree graph**: Non-Euler directed graph classified as `none_degree`.
14. **Directed empty graph**: Gracefully handles 0 edges (`empty`).
15. **Undirected self-loops**: Traversing self-loop correctly increments degree by 2 and completes traversal.
16. **Directed self-loops**: Directed self-loop handled correctly.
17. **Strict insertion-order traversal**: Proves Hierholzer traverses incident edges in exact insertion order.
18. **Step snapshots & immutability**: Verified step snapshots remain isolated from subsequent mutations.
19. **Input validation**: Missing graph or invalid start node handled safely.
20. **Functional & Class equivalence**: Confirmed `euler(g)` and `new EulerEngine(g).run()` produce identical results.

---

## 5. Golden Master Comparison Results

The comparison below distinguishes preserved Legacy behavior from normalized Core result fields. `status` is a Core-level result field and is not part of the Legacy `buildTraceEuler()` output.

| Fixture | Legacy Expected | Headless Core Engine Result | Legacy Behavioral Contract |
|---|---|---|---|
| `circuit-undirected.json` | Type: `circuit`, Connected: `true`, 0 odd, 7 vertices in circuit | Type: `circuit`, Connected: `true`, 0 odd, 7 vertices in circuit, Status: `SUCCESS` | **PRESERVED** |
| `path-undirected.json` | Type: `path`, Connected: `true`, 2 odd (C, D), 9 vertices in path | Type: `path`, Connected: `true`, 2 odd (C, D), 9 vertices in path, Status: `SUCCESS` | **PRESERVED** |
| `circuit-directed.json` | Type: `circuit`, Connected: `true`, isDirected: `true`, 4 vertices in circuit | Type: `circuit`, Connected: `true`, isDirected: `true`, 4 vertices in circuit, Status: `SUCCESS` | **PRESERVED** |
| `disconnected-undirected.json` | Type: `disconnected`, Connected: `false`, circuit length: 0 | Type: `disconnected`, Connected: `false`, circuit length: 0, Status: `FAILURE` | **PRESERVED; status is Core normalization** |

**Interpretation:** The characterized Legacy fields (`type`, `connected`, circuit/path structure, and directedness where applicable) are preserved. The additional `status` field belongs to the normalized Headless Core result contract and should not be treated as a Legacy field.

## 6. Safety & Boundary Checklist

- [x] `index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] `legacy/index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] `Graph.js`: Untouched.
- [x] `Types.js`: Untouched.
- [x] `MinHeap.js`: Untouched.
- [x] `DisjointSet.js`: Untouched.
- [x] `DijkstraEngine.js`: Untouched.
- [x] `KruskalEngine.js`: Untouched.
- [x] Baseline verified before Phase 2E: 110/112 tests pass.
- [x] Full suite after Phase 2E: 130/132 tests pass.
- [x] No new test failures introduced by Phase 2E.
- [x] 2 pre-existing failures remain unchanged:
  - Kruskal invalid non-numeric weight validation.
  - Prim invalid-weight fixture construction.
- [x] 20/20 Euler tests passing.
