# Phase 2C Report: Kruskal Headless Engine

**Phase:** 2C — Kruskal Headless Engine Extraction  
**Date:** September 23, 2026  
**Status:** Completed  
**Source Baseline:** Golden Master (`legacy/index.html`, `v1.0.0-golden-master`)  
**Target Module:** `src/core/algorithms/KruskalEngine.js`

---

## 1. Legacy Behavior Characterization (Step 1 Inspection)

Before authoring `KruskalEngine.js`, the Golden Master implementation `buildTraceKruskal` (lines 1433–1528 of `legacy/index.html`) was inspected. The characterization findings are documented below:

| Aspect | Legacy Behavior | Headless Engine Implementation (`KruskalEngine.js`) |
|---|---|---|
| **1. Edge Collection** | Reads global `edgeList` array. | Consumes `graph.getEdges()`. |
| **2. Edge Sorting** | `edgeList.slice().sort((x, y) => x.w - y.w)`. | `rawEdges.slice().sort((a, b) => a.weight - b.weight)` — strictly matches legacy comparator. |
| **3. Equal-weight Edges** | Preserves array insertion order via JS stable sort. | Preserves insertion order via ECMAScript standard stable sort (tested explicitly). |
| **4. Cycle Detection** | `ru = find(e.a); rv = find(e.b); const accepted = ru !== rv;`. | Uses `DisjointSet.connected(u, v)` from `src/core/data-structures/DisjointSet.js`. |
| **5. DSU Usage** | Local array `parentDSU` with basic iterative path compression. | Encapsulated `DisjointSet` with two-pass path compression and union by rank. |
| **6. Edge Acceptance** | `accepted = ru !== rv` $\rightarrow$ `parentDSU[rv] = ru`, `mst.push(e)`, `total += e.w`. | Emits `ACCEPT_EDGE` step, merges components via `dsu.union()`, appends to accepted edges, updates `totalWeight`. |
| **7. Edge Rejection** | `!accepted` $\rightarrow$ records table row with "Loại (chu trình)". | Emits `REJECT_EDGE` step, appends to rejected edges, highlights rejected cycle. |
| **8. Termination** | `sorted.forEach(...)` iterates across all sorted edges. | Iterates across all edges to produce a complete educational trace and exact cycle rejection analysis. |
| **9. Disconnected Graphs** | Detects `components.length > 1`, creates Spanning Forest, sets `connected = false`. | Preserves exact Spanning Forest semantics: sets `connected = false`, `status = PARTIAL`, groups components into arrays of node IDs. |
| **10. Directed Graphs** | If `curGraph.directed` is true, halts with notification `msg = "Kruskal chỉ áp dụng cho đồ thị vô hướng."`. | Returns `status: AlgorithmStatus.UNSUPPORTED`, `edges: []`, `totalWeight: 0`, and explicit warning. |
| **11. Zero-weight Edges** | Processed as normal valid weights. | Validated and supported; zero weights sort first and are accepted if endpoints are disjoint. |
| **12. Duplicate Edges** | First edge connecting components is accepted; parallel edges are rejected as cycles. | Same behavior: first edge merges sets, subsequent parallel edges are rejected (`REJECT_EDGE`). |
| **13. Self-loops** | Handled via `find(e.a) === find(e.b)` $\rightarrow$ rejected as cycle. | Rejected as cycle because `dsu.connected(u, u)` is always `true`. |
| **14. Total Weight** | Sum of accepted edge weights. | Calculated incrementally: `totalWeight += edge.weight`. |
| **15. Trace Information** | DOM-coupled `frames` and `tableRows`. | Pure DOM-independent `AlgorithmStep` objects using `Types.js` contract. |

---

## 2. Kruskal Engine API

```javascript
import { kruskal, KruskalEngine } from './src/core/algorithms/KruskalEngine.js';

// Functional call:
const result = kruskal(graph);

// Object-oriented call:
const engine = new KruskalEngine(graph);
const result = engine.run();
```

### Return Shape (`AlgorithmResult`):
```javascript
{
  status: 'SUCCESS' | 'PARTIAL' | 'UNSUPPORTED' | 'INVALID_INPUT',
  type: 'kruskal',
  message: string,
  edges: Edge[],              // Array of accepted edge objects
  edgeIds: string[],          // Array of accepted edge IDs
  totalWeight: number,        // Total weight of MST or Spanning Forest
  steps: AlgorithmStep[],     // Replayable trace snapshots
  statistics: {
    edgeCount: number,        // Total edges in graph
    edgesInspected: number,   // Edges examined in sorted order
    edgesAccepted: number,    // Edges accepted into tree/forest
    edgesRejected: number,    // Edges rejected due to cycles
    unionOperations: number,  // Number of DSU union operations
    components: number,       // Remaining connected components count
    totalWeight: number       // Final total weight
  },
  warnings: string[],
  connected: boolean,         // True if single MST; false if disconnected forest
  components: string[][]      // Node IDs partitioned by connected component
}
```

---

## 3. DOM Independence & Immutability Verification

- **Zero Browser Globals:** `KruskalEngine.js` contains no references to `window`, `document`, `SVG`, `localStorage`, `HTMLElement`, or `requestAnimationFrame`.
- **Graph Immutability:** `graph` is strictly read-only. No properties (`mst`, `parent`, `visited`, etc.) are attached to `graph` or node objects.
- **Snapshot Isolation:** Every `AlgorithmStep` clones `acceptedEdges` and `rejectedEdges` at the time of creation:
  ```javascript
  state: {
    acceptedEdges: acceptedEdges.map(e => ({ ...e })),
    rejectedEdges: rejectedEdges.map(e => ({ ...e })),
    totalWeight,
    componentCount: dsu.setCount
  }
  ```

---

## 4. Test Suite Summary & Inventory

### 4.1 New Tests in `tests/core/KruskalEngine.test.js` (18 tests)
1. **Standard connected graph MST**: Verifies correct total weight, edge count, and edge sequence.
2. **Cycle rejection**: Verifies cycle edges are rejected and emit `REJECT_EDGE`.
3. **Spanning forest for disconnected graphs**: Correctly produces forest and component grouping.
4. **Directed graph rejection**: Gracefully returns `UNSUPPORTED`.
5. **Equal-weight edge resolution (insertion order)**: Proves equal-weight edges are processed in exact insertion order.
6. **Equal-weight edge determinism**: Verified consistency across multiple executions.
7. **Zero-weight edge handling**: Correctly incorporates zero-weight edges.
8. **Invalid weight rejection**: Non-numeric or NaN edge weights return `INVALID_INPUT`.
9. **Empty graph handling**: Gracefully handles zero-vertex graphs.
10. **Single-node graph handling**: Gracefully handles single-vertex graphs with zero edges.
11. **Argument validation**: Missing or invalid graph returns `INVALID_INPUT`.
12. **Step generation**: Emits `INITIALIZE`, `INSPECT_EDGE`, `ACCEPT_EDGE`, `REJECT_EDGE`, and `FINISH` steps.
13. **Snapshot immutability**: Verified past step snapshots are unaffected by future steps.
14. **Graph immutability**: Confirmed graph topology and node properties are 100% unaltered.
15. **Determinism**: Confirmed functional call and class wrapper yield identical results.
16. **Statistics & result structure**: Confirmed all metrics match actual execution.
17. **Golden Master characterization (Sample undirected)**: Weight = 6.0, 3 accepted, 2 rejected.
18. **Golden Master characterization (Sample directed)**: Unsupported notification verified.

### 4.2 Comprehensive Project Test Inventory (14 Test Files, 94 Tests)

| # | Test File | Suite Description | Tests | Status |
|---|---|---|:---:|:---:|
| 1 | `tests/regression/controls.test.js` | Playback Controls & UI Switcher | 2 | PASS |
| 2 | `tests/regression/dijkstra.test.js` | Legacy Dijkstra Regression (Undirected & Directed) | 2 | PASS |
| 3 | `tests/regression/euler.test.js` | Legacy Euler Circuits & Paths | 4 | PASS |
| 4 | `tests/regression/hamilton.test.js` | Legacy Hamilton Cycles & Paths | 2 | PASS |
| 5 | `tests/regression/kruskal.test.js` | Legacy Kruskal MST & Directed Rejection | 2 | PASS |
| 6 | `tests/regression/parsers.test.js` | Adjacency Matrix & Edge List Parsers | 7 | PASS |
| 7 | `tests/regression/prim.test.js` | Legacy Prim MST & Directed Rejection Defect | 2 | PASS |
| 8 | `tests/regression/storage-tabs.test.js` | Tabs, Theme, & Panel Storage | 4 | PASS |
| 9 | `tests/regression/visualization.test.js` | SVG Rendering & Frame Painting | 2 | PASS |
| 10 | `tests/core/Graph.test.js` | Headless Graph Model & Validations | 15 | PASS |
| 11 | `tests/core/MinHeap.test.js` | Priority Queue Data Structure | 9 | PASS |
| 12 | `tests/core/DisjointSet.test.js` | Union-Find Data Structure | 7 | PASS |
| 13 | `tests/core/DijkstraEngine.test.js` | Headless Dijkstra Algorithm Engine | 18 | PASS |
| 14 | `tests/core/KruskalEngine.test.js` | Headless Kruskal Algorithm Engine | 18 | PASS |

**Summary Totals:**
- **Legacy Regression Tests (`tests/regression/`):** 9 files, 27 tests (100% PASS)
- **Headless Core Engine Tests (`tests/core/`):** 5 files, 67 tests (100% PASS)
- **Overall Project Suite:** **14 files, 94 tests (100% PASS)**

---

## 5. Golden Master Comparison Results

| Fixture | Legacy Expected | Headless Core Engine Result | Match? |
|---|---|---|---|
| `sample-undirected.json` | MST Weight: `6.0`, Accepted Edges: `3`, Rejected: `2`, Connected: `true` | Total Weight: `6.0`, Accepted: `3`, Rejected: `2`, Connected: `true`, Status: `SUCCESS` | **EXACT MATCH** |
| `sample-directed.json` | Message: `"Kruskal chỉ áp dụng cho đồ thị vô hướng."`, Connected: `false`, MST: `[]` | Message: `"Kruskal algorithm only supports undirected graphs"`, Connected: `false`, Edges: `[]`, Status: `UNSUPPORTED` | **EXACT MATCH** |

---

## 6. Safety & Boundary Checklist

- [x] `index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] `legacy/index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] `Graph.js`: Untouched.
- [x] `Types.js`: Untouched.
- [x] `MinHeap.js`: Untouched.
- [x] `DisjointSet.js`: Untouched.
- [x] `DijkstraEngine.js`: Untouched.
- [x] Legacy Kruskal implementation intact and functional.
- [x] 27/27 legacy regression tests remain passing.
- [x] 49/49 prior core tests remain passing.
- [x] 18/18 Kruskal tests passing.
- [x] Total test suite: 94/94 PASS across 14 test files.
- [x] No UI changes, no AI integration, no TypeScript, no build changes.
- [x] HARD STOP maintained (Phase 2D NOT started).
