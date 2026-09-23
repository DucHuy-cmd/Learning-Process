# Headless Core Engine Architecture

**Document Version:** 1.0.0  
**Phase:** 2A (Headless Core Engine Foundation)  
**Status:** Completed  
**Applicability:** Core Library (`src/core/`)

---

## 1. Architectural Vision & Decoupling Principle

The primary goal of Phase 2 is the complete decoupling of graph data models and algorithm computation from the DOM, SVG rendering, and browser window objects.

### The Legacy Problem (Before Phase 2)
In the legacy codebase (`legacy/index.html`):
- Graph topology was tightly coupled with canvas/SVG rendering (`nodes` array carried `x`, `y`, `r`, `color`, `vx`, `vy`).
- Algorithms directly read from UI dropdowns and wrote formatted HTML strings into global DOM elements (`document.getElementById(...)`).
- Algorithms mixed mathematical graph exploration with animation frame scheduling and DOM manipulation.
- Testing an algorithm required emulating DOM nodes, SVG elements, and browser events.

### The Decoupled Architecture (Phase 2+)

```
+-------------------------------------------------------------+
|                      1. Data Model Layer                    |
|  - Graph.js (Nodes, Edges, Adjacency, Weights, Directed)    |
|  - No DOM, No Coordinates, No Colors, No Algorithm State    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   2. Algorithm Engine Layer                 |
|  - Pure functions / classes (Dijkstra, Kruskal, Prim, etc.) |
|  - MinHeap, DisjointSet data structures                     |
|  - Output: AlgorithmResult containing AlgorithmStep[]       |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                  3. Step Playback / State Layer             |
|  - Step controller (Play, Pause, Step Forward, Backward)    |
|  - State history & inspection                               |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 4. Visualizer / View Layer (DOM)            |
|  - SVG Renderer / Canvas Renderer                           |
|  - Step explanation UI, Code highlighter, Data tables       |
|  - Only reacts to AlgorithmStep highlights and state        |
+-------------------------------------------------------------+
```

---

## 2. Core Components

### 2.1 Graph Model (`src/core/models/Graph.js`)
- **Role:** Pure mathematical graph structure.
- **Characteristics:**
  - Configurable: `directed` (boolean), `weighted` (boolean).
  - Encapsulated node store (`Map<string, Node>`) and edge store (`Map<string, Edge>`).
  - Incident index (`Map<string, Set<string>>`) providing fast neighbor lookups.
  - Immutability / cloning via `graph.clone()`.
  - Invariant validation: Throws explicit errors for duplicate nodes, missing endpoints, non-numeric weights in weighted graphs, or duplicate edge IDs.
  - **Zero Algorithm State:** Never attaches `dist`, `prev`, `visited`, or `rank` to graph objects.

### 2.2 Data Types & Constants (`src/core/models/Types.js`)
- **Role:** Standardized communication contract between algorithms, playback controllers, and UI visualizers.
- **`AlgorithmStatus`**:
  - `SUCCESS`: Algorithm completed objective (e.g., target reached, MST built).
  - `FAILURE`: Algorithm terminated without completing goal.
  - `UNSUPPORTED`: Graph does not meet prerequisites (e.g., negative weights in Dijkstra).
  - `INVALID_INPUT`: Start/target nodes missing or invalid parameters.
  - `UNREACHABLE`: Target unreachable from start node.
  - `PARTIAL`: Disconnected components or partial result.
- **`AlgorithmAction`**:
  - Fine-grained step actions: `INITIALIZE`, `SELECT_NODE`, `INSPECT_EDGE`, `RELAX_EDGE`, `ACCEPT_EDGE`, `REJECT_EDGE`, `VISIT_NODE`, `BACKTRACK`, `FINISH`, `ERROR`.
- **`AlgorithmStep`**:
  - `stepNumber`: 1-based sequential counter.
  - `action`: One of `AlgorithmAction`.
  - `description`: Plain human-readable explanation of current decision.
  - `state`: Immutable snapshot of algorithm variables (`dist`, `prev`, `visited`, `mstEdges`).
  - `highlights`: Node and edge IDs highlighted in this step.
- **`AlgorithmResult`**:
  - `status`: Execution status.
  - `totalWeight`: Total path cost or MST weight (if applicable).
  - `path`: Ordered array of node IDs for shortest path or circuit.
  - `steps`: Array of `AlgorithmStep` objects for replay.
  - `metadata`: Metrics such as runtime duration, visited node count, operations count.

### 2.3 Priority Queue / Min-Heap (`src/core/data-structures/MinHeap.js`)
- **Role:** Efficient greedy candidate extraction for Dijkstra and Prim.
- **Characteristics:**
  - 0-indexed binary heap with $O(\log n)$ `push()`, $O(\log n)$ `pop()`, and $O(1)$ `peek()`.
  - Built-in comparator supporting numbers and objects (`{ distance }`, `{ weight }`, `{ priority }`, `{ key }`).
  - Customizable via user-supplied `compareFn`.

### 2.4 Disjoint Set Union (`src/core/data-structures/DisjointSet.js`)
- **Role:** Component tracking and cycle detection for Kruskal's algorithm.
- **Characteristics:**
  - Generic item support (string, number, object keys).
  - Two-pass path compression on `find()`.
  - Union by rank on `union()` to maintain shallow tree depths.
  - Time complexity: $O(\alpha(n))$ nearly constant amortized time.

---

## 3. Data Flow Specification

1. **Graph Construction:**
   The user or parser constructs a `Graph` instance:
   ```javascript
   const graph = new Graph({ directed: false, weighted: true });
   graph.addNode('A');
   graph.addNode('B');
   graph.addEdge('A', 'B', 10);
   ```

2. **Algorithm Execution:**
   An engine receives the `Graph` and parameters (e.g. `startNode`), without touching any DOM:
   ```javascript
   // Future Phase 2B engine
   const result = dijkstra(graph, 'A', 'B');
   // returns AlgorithmResult
   ```

3. **Step Playback / UI Rendering:**
   The UI receives `result.steps` and renders each step sequentially:
   - Sets visual colors based on `step.highlights.nodes` and `step.highlights.edges`.
   - Displays explanation from `step.description`.
   - Updates variable table from `step.state`.

---

## 4. Safety and Migration Strategy
- `legacy/index.html` and `index.html` remain untouched during Phase 2A.
- Existing regression tests (`tests/regression/`) run continuously alongside new unit tests (`tests/core/`).
- Engine migration (Phase 2B) will implement algorithm functions that use `src/core/` and verify outputs against the Golden Master.
