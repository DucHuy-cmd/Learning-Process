import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import textbookGraph from '../fixtures/dijkstra/textbook-undirected.json';
import directedGraph from '../fixtures/dijkstra/directed-sample.json';
import expectedTextbook from '../fixtures/expected/dijkstra-textbook.json';

describe('Dijkstra Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-01: Dijkstra shortest path on textbook undirected graph (u -> w, cost = 9, path = u -> y -> z -> w)', () => {
    ctx.setupGraph(textbookGraph);
    const startIndex = expectedTextbook.startIndex; // 0 (u)
    const targetIndex = expectedTextbook.targetIndex; // 7 (w)

    const result = ctx.runDijkstra(startIndex, targetIndex);

    // Verify reachability and numerical total distance
    expect(result.reachable).toBe(true);
    expect(result.total).toBe(expectedTextbook.expectedTotal);

    // Verify exact path node sequence
    expect(result.path).toEqual(expectedTextbook.expectedPathIndices);
    const nodeNames = result.path.map(idx => textbookGraph.nodes[idx].name);
    expect(nodeNames).toEqual(expectedTextbook.expectedPathNames);

    // Verify frames generation and final frame properties
    expect(result.frames.length).toBeGreaterThan(0);
    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.pathFinal).toEqual(expectedTextbook.expectedPathIndices);

    // Verify matrix rows were recorded
    const initialRow = result.fullMatrix[0];
    expect(initialRow.step).toBe(0);
    // In legacy index.html step 0 (initialization), startIndex has prev = -1, so it is formatted as "0*"
    expect(initialRow.cells[startIndex].val).toBe('0*');
  });

  it('REG-02: Dijkstra shortest path on directed graph with reachability and unreachable detection', () => {
    ctx.setupGraph(directedGraph);

    // Test 1: Reachable path from A (0) to D (3)
    // Edges: A->B: 4, A->C: 2, C->B: 1, B->D: 5, C->D: 8
    // Optimal: A -> C (2) -> B (3) -> D (8)
    const resultReachable = ctx.runDijkstra(0, 3);
    expect(resultReachable.reachable).toBe(true);
    expect(resultReachable.total).toBe(8.0);
    expect(resultReachable.path).toEqual([0, 2, 1, 3]);

    const reachableLastFrame = resultReachable.frames[resultReachable.frames.length - 1];
    expect(reachableLastFrame.phase).toBe('Hoàn tất');
    expect(reachableLastFrame.pathFinal).toEqual([0, 2, 1, 3]);

    // Test 2: Unreachable reverse path from D (3) to A (0) in a DAG
    const resultUnreachable = ctx.runDijkstra(3, 0);
    expect(resultUnreachable.reachable).toBe(false);
    expect(resultUnreachable.total).toBe(Infinity);
    expect(resultUnreachable.path).toEqual([]);

    const unreachableLastFrame = resultUnreachable.frames[resultUnreachable.frames.length - 1];
    expect(unreachableLastFrame.phase).toBe('Không có đường đi');
    expect(unreachableLastFrame.noPath).toBe(true);
    expect(unreachableLastFrame.pathFinal).toEqual([]);
  });
});
