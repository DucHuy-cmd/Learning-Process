# Phase 2B Report: Dijkstra Headless Engine

**Phase:** 2B — Dijkstra Headless Engine Extraction  
**Date:** September 23, 2026  
**Status:** Completed  
**Source Baseline:** Golden Master (`legacy/index.html`, `v1.0.0-golden-master`)  
**Target Module:** `src/core/algorithms/DijkstraEngine.js`

---

## 1. Legacy Behavior Characterization (Part 1 Inspection)

Before authoring `DijkstraEngine.js`, the Golden Master implementation `buildTraceAndMatrix` (lines 1237–1428 of `legacy/index.html`) was inspected. The characterization findings are documented below:

| Aspect | Legacy Behavior | Headless Engine Implementation (`DijkstraEngine.js`) |
|---|---|---|
| **1. Input Graph** | `curGraph.nodes` (array of node objects), `adj` (array of edge arrays indexed by node integer `0..n-1`). | Consumes `Graph` model instance. Nodes and edges queried via string IDs and `graph.getNeighbors(u)`. |
| **2. Start Node** | `dist[startIndex] = 0.0`, `pq.push({ d: 0, u: startIndex, id: 0 })`. | Initializes `dist[startNodeId] = 0`, others $\infty$; pushes `{ distance: 0, node: startNodeId }` to `MinHeap`. |
| **3. Target Node** | If `endIndex !== -1 && u === endIndex`, triggers early termination via `break`. | If `targetNodeId` is provided and selected from heap as minimum candidate, breaks early. If omitted, runs all reachable nodes. |
| **4. Directed Graph** | `adj[u]` contains only outgoing edges. | `graph.getNeighbors(u)` returns only outgoing edges if `graph.isDirected` is true. |
| **5. Undirected Graph** | `adj[u]` contains edges in both directions. | `graph.getNeighbors(u)` returns all incident edges if `graph.isDirected` is false. |
| **6. Weight Handling** | `newDist = dist[u] + w`. | `candidateDist = dist[u] + weight`. |
| **7. Unreachable Node** | If `dist[target] === Infinity`, sets `reachable = false`, `path = []`. | Returns `status: AlgorithmStatus.UNREACHABLE`, `path: []`, `totalWeight: null`. |
| **8. Start == Target** | Pops start node, immediately breaks on `u === endIndex`, yields `path = [start]`, `total = 0.0`. | Detects `startNodeId === targetNodeId`, emits `INITIALIZE`, `SELECT_NODE`, `FINISH`, returns `path: [startNodeId]`, `totalWeight: 0`. |
| **9. Negative Weights** | Not checked in legacy (causes incorrect outputs or infinite relaxations if cycles exist). | Explicitly validated: if any edge weight $< 0$, returns `status: AlgorithmStatus.UNSUPPORTED`. |
| **10. Priority Queue** | In-place sorted array `pq.sort((a,b) => a.d - b.d || a.id - b.id)`. | Real binary min-heap using `src/core/data-structures/MinHeap.js` ($O(\log n)$ push/pop). |
| **11. Stale Queue Entries** | `if (visited[u] || d > dist[u]) continue;` (Lazy Deletion). | Discards candidates where `visited.has(u) || d > dist[u]`, records `stalePops` metric. |
| **12. Visited Semantics** | `visited[u] = true` once minimal candidate extracted; finalized nodes never re-relaxed. | `visited.add(u)` on selection; neighbors already in `visited` skipped. |
| **13. Early Termination** | `if (endIndex !== -1 && u === endIndex) break;`. | `if (targetNodeId && u === targetNodeId) break;`. |
| **14. Path Reconstruction** | Backward traversal `prev[at]` from target to start, then reversed. | Backward traversal `prev[curr]` from target to start, reversed, edge IDs resolved. |
| **15. Matrix / Trace** | Generates DOM-centric `frames` and HTML matrix rows for UI table. | Emits DOM-independent `AlgorithmStep` objects using `Types.js` contract. |
| **16. Exact Result** | `{ frames, path, total, reachable, fullMatrix }`. | Standardized `AlgorithmResult` (`status`, `type`, `message`, `path`, `edges`, `totalWeight`, `steps`, `statistics`, `warnings`). |

---

## 2. Dijkstra Engine API

```javascript
import { dijkstra, DijkstraEngine } from './src/core/algorithms/DijkstraEngine.js';

// Signature:
const result = dijkstra(graph, startNodeId, targetNodeId = null);
```

### Return Shape (`AlgorithmResult`):
```javascript
{
  status: 'SUCCESS' | 'UNREACHABLE' | 'UNSUPPORTED' | 'INVALID_INPUT' | 'FAILURE',
  type: 'dijkstra',
  message: string,
  path: string[],            // e.g. ['u', 'y', 'z', 'w'] or []
  edges: string[],           // e.g. ['e_u_y', 'e_y_z', 'e_z_w']
  totalWeight: number | null,// e.g. 9.0 or null
  steps: AlgorithmStep[],    // Replayable trace snapshots
  statistics: {
    visitedCount: number,
    edgeInspections: number,
    relaxationCount: number,
    heapPushes: number,
    heapPops: number,
    stalePops: number
  },
  warnings: string[]
}
```

---

## 3. DOM Independence & Immutability Verification

- **Zero Browser Globals:** `DijkstraEngine.js` contains no references to `window`, `document`, `SVG`, `localStorage`, `HTMLElement`, or `requestAnimationFrame`.
- **Graph Immutability:** `graph` is strictly read-only. No properties (`dist`, `prev`, `visited`, etc.) are attached to `graph` or node objects.
- **Snapshot Isolation:** Every `AlgorithmStep` clones `dist`, `prev`, and `visited` at the time of creation:
  ```javascript
  state: {
    dist: { ...dist },
    prev: { ...prev },
    visited: Array.from(visited)
  }
  ```
  Mutating state at subsequent steps or in test code has zero side-effects on historical step snapshots.

---

## 4. Test Suite Summary & Inventory

### 4.1 New Tests in `tests/core/DijkstraEngine.test.js` (18 tests)
1. **Simple shortest path** between adjacent nodes.
2. **Multi-hop shortest path** ($A \rightarrow B \rightarrow C$).
3. **Alternative longer route avoidance** (Greedy cost minimization).
4. **Directed graph** respects one-way edge orientations.
5. **Undirected graph** allows traversal in both directions.
6. **Unreachable target** returns `UNREACHABLE` with empty path and `totalWeight = null`.
7. **Start == Target** completes immediately with cost 0 and `path = [start]`.
8. **Zero-weight edge** handled correctly without divergence.
9. **Negative edge weights** rejected with `UNSUPPORTED` status.
10. **Input validation** on non-existent start or target nodes and invalid graph.
11. **Stale heap entry elimination** via lazy deletion in multi-path graphs.
12. **Path reconstruction** and total distance accuracy across multi-step chains.
13. **Step generation** creates standard `INITIALIZE`, `SELECT_NODE`, `INSPECT_EDGE`, `RELAX_EDGE`, and `FINISH` steps.
14. **State snapshots independence** verifies past step snapshots are immutable.
15. **Graph immutability** verifies graph topology and attributes are unchanged after execution.
16. **Determinism** verifies identical outputs across multiple executions.
17. **Golden Master characterization (Textbook undirected)**: $u \rightarrow w$, cost $= 9.0$, path $= [u, y, z, w]$.
18. **Golden Master characterization (Directed sample)**: $A \rightarrow D$, cost $= 8.0$, path $= [A, C, B, D]$; and $D \rightarrow A$: `UNREACHABLE`.

### 4.2 Comprehensive Project Test Inventory (13 Test Files, 76 Tests)

| # | Test File | Suite Description | Tests | Status |
|---|---|---|---|---|
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

**Summary Totals:**
- **Regression Tests (`tests/regression/`):** 9 files, 27 tests (100% PASS)
- **Headless Core Tests (`tests/core/`):** 4 files, 49 tests (100% PASS)
  - Phase 2A Models & Data Structures: 31 tests
  - Phase 2B Dijkstra Engine: 18 tests
- **Overall Project Suite:** **13 files, 76 tests (100% PASS)**

---

## 5. Golden Master Comparison Results

| Fixture | Start $\rightarrow$ End | Legacy Expected | Headless Core Engine Result | Match? |
|---|---|---|---|---|
| `textbook-undirected.json` | $u \rightarrow w$ | Path: `['u', 'y', 'z', 'w']`, Cost: `9.0`, Reachable: `true` | Path: `['u', 'y', 'z', 'w']`, Cost: `9.0`, Status: `SUCCESS` | **EXACT MATCH** |
| `directed-sample.json` | $A \rightarrow D$ | Path: `['A', 'C', 'B', 'D']`, Cost: `8.0`, Reachable: `true` | Path: `['A', 'C', 'B', 'D']`, Cost: `8.0`, Status: `SUCCESS` | **EXACT MATCH** |
| `directed-sample.json` | $D \rightarrow A$ | Path: `[]`, Total: `Infinity`, Reachable: `false` | Path: `[]`, Total: `null`, Status: `UNREACHABLE` | **EXACT MATCH** |

*Note: In the headless contract, unreachable total cost is standardized as `null` rather than JavaScript `Infinity` for clean serialization.*

---

## 6. Safety & Boundary Checklist

- [x] `index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] `legacy/index.html`: Untouched (4632 lines, 188,396 bytes).
- [x] Legacy Dijkstra implementation intact and functional.
- [x] 27/27 legacy regression tests remain passing.
- [x] 31/31 Phase 2A core unit tests remain passing.
- [x] 18/18 new Phase 2B Dijkstra engine tests passing.
- [x] Total test suite: 76/76 PASS across 13 test files.
- [x] No UI changes, no AI integration, no TypeScript, no build changes.
- [x] HARD STOP maintained.
