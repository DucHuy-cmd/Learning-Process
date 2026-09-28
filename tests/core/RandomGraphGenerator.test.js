import { describe, it, expect } from 'vitest';
import { generateRandomGraph } from '../../src/core/generators/RandomGraphGenerator.js';
import { euler } from '../../src/core/algorithms/EulerEngine.js';
import { hamilton } from '../../src/core/algorithms/HamiltonEngine.js';
import { dijkstra } from '../../src/core/algorithms/DijkstraEngine.js';
import { prim } from '../../src/core/algorithms/PrimEngine.js';
import { kruskal } from '../../src/core/algorithms/KruskalEngine.js';
import { createGraphFromParser } from '../../src/core/models/GraphAdapter.js';
import { parseEdgeList } from '../../src/core/parsers/EdgeListParser.js';
import { parseAdjacencyMatrix } from '../../src/core/parsers/MatrixParser.js';

describe('RandomGraphGenerator Unit Tests', () => {
  it('generates valid Dijkstra undirected and directed graphs', () => {
    // Undirected
    const undirRes = generateRandomGraph({
      algo: 'dijkstra',
      nodeCount: 5,
      density: 'medium',
      minWeight: 2,
      maxWeight: 10,
      isDirected: false,
    });
    expect(undirRes.nodes.length).toBe(5);
    expect(undirRes.isDirected).toBe(false);
    expect(undirRes.graphName).toContain('Dijkstra');
    expect(undirRes.edges.length).toBeGreaterThanOrEqual(4);

    const parsedUndir = parseEdgeList(undirRes.edgeListText, false);
    const gUndir = createGraphFromParser(parsedUndir, { directed: false, weighted: true });
    const runDijkstraUndir = dijkstra(gUndir, 'A', 'E');
    expect(runDijkstraUndir.status).toBe('SUCCESS');
    expect(runDijkstraUndir.totalWeight).toBeGreaterThan(0);

    // Directed
    const dirRes = generateRandomGraph({
      algo: 'dijkstra',
      nodeCount: 5,
      density: 'dense',
      minWeight: 1,
      maxWeight: 15,
      isDirected: true,
    });
    expect(dirRes.isDirected).toBe(true);
    expect(dirRes.edgeListText).toContain('->');
  });

  it('forces undirected graph for Prim and Kruskal MST algorithms', () => {
    // Passed isDirected = true, but must be forced to false
    const primRes = generateRandomGraph({
      algo: 'prim',
      nodeCount: 6,
      isDirected: true,
    });
    expect(primRes.isDirected).toBe(false);
    expect(primRes.graphName).toContain('Prim');
    expect(primRes.edgeListText).not.toContain('->');

    const parsedPrim = parseEdgeList(primRes.edgeListText, false);
    const gPrim = createGraphFromParser(parsedPrim, { directed: false, weighted: true });
    const runPrim = prim(gPrim, 'A');
    expect(runPrim.status).toBe('SUCCESS');
    expect(runPrim.edges.length).toBe(5); // n - 1

    const kruskalRes = generateRandomGraph({
      algo: 'kruskal',
      nodeCount: 5,
      isDirected: true,
    });
    expect(kruskalRes.isDirected).toBe(false);
    const parsedKruskal = parseEdgeList(kruskalRes.edgeListText, false);
    const gKruskal = createGraphFromParser(parsedKruskal, { directed: false, weighted: true });
    const runKruskal = kruskal(gKruskal);
    expect(runKruskal.status).toBe('SUCCESS');
    expect(runKruskal.edges.length).toBe(4); // 5 - 1
  });

  it('generates solvable Euler graphs (undirected even degrees & directed balanced in/out)', () => {
    for (let iter = 0; iter < 10; iter++) {
      // Undirected Euler
      const eulerUndir = generateRandomGraph({
        algo: 'euler',
        nodeCount: 5,
        density: iter % 2 === 0 ? 'medium' : 'dense',
        isDirected: false,
      });
      const parsedEulerUndir = parseEdgeList(eulerUndir.edgeListText, false);
      const gEulerUndir = createGraphFromParser(parsedEulerUndir, { directed: false, weighted: true });
      const runEulerUndir = euler(gEulerUndir, 'A');
      expect(runEulerUndir.status).toBe('SUCCESS');
      expect(runEulerUndir.type).toBe('circuit');

      // Directed Euler
      const eulerDir = generateRandomGraph({
        algo: 'euler',
        nodeCount: 4,
        density: iter % 2 === 0 ? 'sparse' : 'medium',
        isDirected: true,
      });
      const parsedEulerDir = parseEdgeList(eulerDir.edgeListText, true);
      const gEulerDir = createGraphFromParser(parsedEulerDir, { directed: true, weighted: true });
      const runEulerDir = euler(gEulerDir, 'A');
      expect(runEulerDir.status).toBe('SUCCESS');
      expect(runEulerDir.type).toBe('circuit');
    }
  });

  it('generates solvable Hamilton graphs with a guaranteed cycle', () => {
    const hamRes = generateRandomGraph({
      algo: 'hamilton',
      nodeCount: 5,
      density: 'sparse',
      isDirected: false,
    });
    expect(hamRes.graphName).toContain('Hamilton');

    const parsedHam = parseEdgeList(hamRes.edgeListText, false);
    const gHam = createGraphFromParser(parsedHam, { directed: false, weighted: true });
    const runHam = hamilton(gHam, 'A', true);
    expect(runHam.status).toBe('SUCCESS');
    expect(runHam.found).toBe(true);
    expect(runHam.closesCycle).toBe(true);
  });

  it('safely clamps node count between 3 and 12', () => {
    const minClamped = generateRandomGraph({ nodeCount: 1 });
    expect(minClamped.nodes.length).toBe(3);

    const maxClamped = generateRandomGraph({ nodeCount: 99 });
    expect(maxClamped.nodes.length).toBe(12);
  });

  it('generates valid matrixText that matches edgeListText for both undirected and directed graphs', () => {
    // Undirected test
    const undirRes = generateRandomGraph({
      algo: 'dijkstra',
      nodeCount: 6,
      isDirected: false,
    });
    expect(undirRes.matrixText).toBeDefined();
    expect(typeof undirRes.matrixText).toBe('string');

    const parsedMatrixUndir = parseAdjacencyMatrix(undirRes.matrixText, false);
    const parsedListUndir = parseEdgeList(undirRes.edgeListText, false);

    expect(parsedMatrixUndir.nodes.length).toBe(6);
    expect(parsedMatrixUndir.nodes.map(n => n.name)).toEqual(parsedListUndir.nodes.map(n => n.name));
    expect(parsedMatrixUndir.edges.length).toBe(parsedListUndir.edges.length);

    // Directed test
    const dirRes = generateRandomGraph({
      algo: 'dijkstra',
      nodeCount: 5,
      isDirected: true,
    });
    expect(dirRes.matrixText).toBeDefined();

    const parsedMatrixDir = parseAdjacencyMatrix(dirRes.matrixText, true);
    const parsedListDir = parseEdgeList(dirRes.edgeListText, true);

    expect(parsedMatrixDir.nodes.length).toBe(5);
    expect(parsedMatrixDir.nodes.map(n => n.name)).toEqual(parsedListDir.nodes.map(n => n.name));
    expect(parsedMatrixDir.edges.length).toBe(parsedListDir.edges.length);
  });
});
