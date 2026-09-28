/**
 * @file RandomGraphGenerator.js
 * Headless Core Generator - Algorithmic Random Graph Generator
 *
 * Fully DOM-independent, pure ES Module.
 * Generates semantically valid, solvable graphs customized for each algorithm:
 * - Dijkstra: connected graph with non-negative weights, respects directed flag
 * - Prim / Kruskal: strictly undirected, connected, weighted MST graph
 * - Euler: connected graph with all even degrees (undirected) or balanced in/out degrees (directed)
 * - Hamilton: contains a guaranteed Hamiltonian cycle backbone + random chords
 */

/**
 * Helper to get a random integer in [min, max] inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffles an array in place (Fisher-Yates).
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates an educational random graph tailored for a specific algorithm.
 *
 * @param {Object} options
 * @param {'dijkstra'|'prim'|'kruskal'|'euler'|'hamilton'} [options.algo='dijkstra']
 * @param {number} [options.nodeCount=6] - Number of vertices (3 to 12)
 * @param {'sparse'|'medium'|'dense'} [options.density='medium']
 * @param {number} [options.minWeight=1]
 * @param {number} [options.maxWeight=20]
 * @param {boolean} [options.isDirected=false]
 * @returns {{ nodes: Array<{id: string, name: string, short: string, kind: string}>, edges: Array<[string, string, number]>, isDirected: boolean, graphName: string, edgeListText: string }}
 */
export function generateRandomGraph({
  algo = 'dijkstra',
  nodeCount = 6,
  density = 'medium',
  minWeight = 1,
  maxWeight = 20,
  isDirected = false,
} = {}) {
  const algoKey = String(algo || 'dijkstra').toLowerCase();

  // Clamp parameters
  const n = Math.max(3, Math.min(12, parseInt(nodeCount, 10) || 6));
  const minW = Math.max(1, parseInt(minWeight, 10) || 1);
  const maxW = Math.max(minW, parseInt(maxWeight, 10) || 20);

  // Prim & Kruskal strictly require undirected graphs
  let directed = Boolean(isDirected);
  if (algoKey === 'prim' || algoKey === 'kruskal') {
    directed = false;
  }

  // Node labels: A, B, C...
  const nodeNames = Array.from({ length: n }, (_, i) => {
    if (n <= 26) return String.fromCharCode(65 + i);
    return `V${i + 1}`;
  });

  const nodes = nodeNames.map(name => ({
    id: name,
    name,
    short: name,
    kind: 'phong',
  }));

  // Density edge extra multiplier
  const extraEdgesCount = density === 'sparse'
    ? Math.max(1, Math.round(n * 0.4))
    : density === 'dense'
      ? Math.max(3, Math.round(n * 1.5))
      : Math.max(2, Math.round(n * 0.9));

  const edgeMap = new Map(); // key: "u->v" or "u--v" -> weight

  function addEdge(u, v, weight) {
    if (u === v) return false;
    const w = weight ?? randInt(minW, maxW);
    if (directed) {
      const key = `${u}->${v}`;
      if (edgeMap.has(key)) return false;
      edgeMap.set(key, { from: u, to: v, weight: w });
      return true;
    } else {
      const key = u <= v ? `${u}--${v}` : `${v}--${u}`;
      if (edgeMap.has(key)) return false;
      edgeMap.set(key, { from: u, to: v, weight: w });
      return true;
    }
  }

  function hasEdge(u, v) {
    if (u === v) return true;
    if (directed) {
      return edgeMap.has(`${u}->${v}`);
    } else {
      const key = u <= v ? `${u}--${v}` : `${v}--${u}`;
      return edgeMap.has(key);
    }
  }

  // Algorithm-specific edge generation
  if (algoKey === 'prim' || algoKey === 'kruskal') {
    // 1. Spanning Tree backbone to guarantee connectivity
    const inTree = [nodeNames[0]];
    const candidates = nodeNames.slice(1);
    while (candidates.length > 0) {
      const u = inTree[randInt(0, inTree.length - 1)];
      const vIdx = randInt(0, candidates.length - 1);
      const v = candidates.splice(vIdx, 1)[0];
      addEdge(u, v, randInt(minW, maxW));
      inTree.push(v);
    }

    // 2. Add extra random chords
    let attempts = 0;
    let added = 0;
    while (added < extraEdgesCount && attempts < 100) {
      attempts++;
      const u = nodeNames[randInt(0, n - 1)];
      const v = nodeNames[randInt(0, n - 1)];
      if (addEdge(u, v, randInt(minW, maxW))) {
        added++;
      }
    }
  } else if (algoKey === 'dijkstra') {
    if (directed) {
      // Directed backbone from node 0 (A) to guarantee reachability
      for (let i = 1; i < n; i++) {
        const u = nodeNames[randInt(0, i - 1)];
        const v = nodeNames[i];
        addEdge(u, v, randInt(minW, maxW));
      }

      // Add extra random directed edges
      let attempts = 0;
      let added = 0;
      while (added < extraEdgesCount && attempts < 100) {
        attempts++;
        const u = nodeNames[randInt(0, n - 1)];
        const v = nodeNames[randInt(0, n - 1)];
        if (addEdge(u, v, randInt(minW, maxW))) {
          added++;
        }
      }
    } else {
      // Undirected connected graph
      for (let i = 1; i < n; i++) {
        const u = nodeNames[randInt(0, i - 1)];
        const v = nodeNames[i];
        addEdge(u, v, randInt(minW, maxW));
      }

      let attempts = 0;
      let added = 0;
      while (added < extraEdgesCount && attempts < 100) {
        attempts++;
        const u = nodeNames[randInt(0, n - 1)];
        const v = nodeNames[randInt(0, n - 1)];
        if (addEdge(u, v, randInt(minW, maxW))) {
          added++;
        }
      }
    }
  } else if (algoKey === 'euler') {
    // Euler Graph Construction:
    // To guarantee an Euler circuit, we construct cycle covers:
    // Every added simple cycle maintains the degree condition (all degrees even if undirected, in=out if directed)
    if (directed) {
      // 1. Base directed cycle through all nodes
      const perm = shuffle(nodeNames);
      for (let i = 0; i < n; i++) {
        const u = perm[i];
        const v = perm[(i + 1) % n];
        addEdge(u, v, randInt(minW, maxW));
      }

      // 2. Add sub-cycles to increase density while preserving inDegree === outDegree
      const subCyclesCount = density === 'sparse' ? 1 : density === 'dense' ? 3 : 2;
      for (let c = 0; c < subCyclesCount; c++) {
        const cycleLen = randInt(2, Math.min(4, n));
        const subNodes = shuffle(nodeNames).slice(0, cycleLen);
        let canAdd = true;
        for (let i = 0; i < cycleLen; i++) {
          if (hasEdge(subNodes[i], subNodes[(i + 1) % cycleLen])) {
            canAdd = false;
            break;
          }
        }
        if (canAdd) {
          for (let i = 0; i < cycleLen; i++) {
            addEdge(subNodes[i], subNodes[(i + 1) % cycleLen], randInt(minW, maxW));
          }
        }
      }
    } else {
      // 1. Base undirected cycle through all nodes (degree of each node is initially 2 -> all even)
      const perm = shuffle(nodeNames);
      for (let i = 0; i < n; i++) {
        const u = perm[i];
        const v = perm[(i + 1) % n];
        addEdge(u, v, randInt(minW, maxW));
      }

      // 2. Add extra simple 3-cycles or 4-cycles (each node in the cycle gains +2 degree, keeping it even!)
      const subCyclesCount = density === 'sparse' ? 1 : density === 'dense' ? 3 : 2;
      for (let c = 0; c < subCyclesCount; c++) {
        const cycleLen = Math.min(3, n);
        const subNodes = shuffle(nodeNames).slice(0, cycleLen);
        let canAdd = true;
        for (let i = 0; i < cycleLen; i++) {
          if (hasEdge(subNodes[i], subNodes[(i + 1) % cycleLen])) {
            canAdd = false;
            break;
          }
        }
        if (canAdd) {
          for (let i = 0; i < cycleLen; i++) {
            addEdge(subNodes[i], subNodes[(i + 1) % cycleLen], randInt(minW, maxW));
          }
        }
      }
    }
  } else if (algoKey === 'hamilton') {
    // Hamilton Graph Construction:
    // Guarantee at least 1 Hamiltonian cycle backbone by connecting all vertices according to a random permutation
    const perm = shuffle(nodeNames);
    for (let i = 0; i < n; i++) {
      const u = perm[i];
      const v = perm[(i + 1) % n];
      addEdge(u, v, randInt(minW, maxW));
    }

    // Add random chords to increase backtracking exploration complexity
    let attempts = 0;
    let added = 0;
    while (added < extraEdgesCount && attempts < 100) {
      attempts++;
      const u = nodeNames[randInt(0, n - 1)];
      const v = nodeNames[randInt(0, n - 1)];
      if (addEdge(u, v, randInt(minW, maxW))) {
        added++;
      }
    }
  }

  // Format edges into [u, v, weight] tuples
  const edges = Array.from(edgeMap.values()).map(e => [e.from, e.to, e.weight]);

  // Generate edge list text
  const edgeListLines = edges.map(([u, v, w]) => {
    return directed ? `${u} -> ${v}: ${w}` : `${u} - ${v}: ${w}`;
  });
  const edgeListText = edgeListLines.join('\n');

  // Generate adjacency matrix text
  const matrixHeader = nodeNames.join(' ');
  const nodeIndexMap = new Map();
  nodeNames.forEach((name, idx) => nodeIndexMap.set(name, idx));

  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [u, v, w] of edges) {
    const i = nodeIndexMap.get(u);
    const j = nodeIndexMap.get(v);
    if (i !== undefined && j !== undefined) {
      matrix[i][j] = w;
      if (!directed) {
        matrix[j][i] = w;
      }
    }
  }

  const matrixLines = [matrixHeader];
  for (let i = 0; i < n; i++) {
    matrixLines.push(matrix[i].join(' '));
  }
  const matrixText = matrixLines.join('\n');

  // Friendly algorithm name
  const algoTitleMap = {
    dijkstra: 'Dijkstra',
    prim: 'Prim',
    kruskal: 'Kruskal',
    euler: 'Euler',
    hamilton: 'Hamilton',
  };
  const algoDisplay = algoTitleMap[algoKey] || 'Đồ thị';
  const graphName = `Đồ thị ngẫu nhiên (${algoDisplay}, ${n} đỉnh)`;

  return {
    nodes,
    edges,
    isDirected: directed,
    graphName,
    edgeListText,
    matrixText,
  };
}
