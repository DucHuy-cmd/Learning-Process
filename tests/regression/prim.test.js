import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import slideGraph from '../fixtures/prim/slide-x1-x8.json';
import sampleDirected from '../fixtures/prim/sample-directed.json';
import expectedPrim from '../fixtures/expected/prim-x1-x8.json';

describe('Prim Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-05: Prim MST on slide graph X1-X8 with Tv/Te progression and exact total weight', () => {
    ctx.setupGraph(slideGraph);
    const startIndex = expectedPrim.startIndex; // 0 (X1)

    const result = ctx.runPrim(startIndex);

    // Verify MST connectivity and numerical weight
    expect(result.connected).toBe(expectedPrim.connected);
    expect(result.reached).toBe(expectedPrim.reached);
    expect(result.total).toBe(expectedPrim.expectedTotal);
    expect(result.mst.length).toBe(expectedPrim.expectedMstEdgeCount);

    // KNOWN LEGACY DEFECT (BUG-PRIM-001):
    // In legacy/index.html line 1793: `headers: [...curGraph.nodes.map(nodeS), "Tv", "Te"]` passes node objects
    // to nodeS(i) which expects an integer index. Because (object >= 0) is false, it returns '-' for all node names.
    // The test explicitly records this known defect to ensure Golden Master characterization.
    expect(result.headers).toEqual(['-', '-', '-', '-', '-', '-', '-', '-', 'Tv', 'Te']);

    // Verify step progression: final row in fullMatrix must have full Tv
    expect(result.fullMatrix.length).toBe(slideGraph.nodes.length);
    const finalRow = result.fullMatrix[result.fullMatrix.length - 1];
    const tvCell = finalRow.cells[finalRow.cells.length - 2];
    expect(tvCell.type).toBe('tv');
    expect(tvCell.val.split(', ').length).toBe(slideGraph.nodes.length);

    // Verify frames: final frame must be completed
    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.done).toBe(true);
    expect(lastFrame.mstFinal.length).toBe(expectedPrim.expectedMstEdgeCount);
  });

  it('REG-06: Known legacy defect: directed Prim rejection path crashes with TypeError', () => {
    ctx.setupGraph(sampleDirected);

    // KNOWN LEGACY DEFECT (BUG-PRIM-002):
    // In legacy/index.html line 1577 inside `if (curGraph && curGraph.directed)`,
    // the code attempts `curGraph.nodes.map(nodeShort)`. Since nodeShort expects an index,
    // indexing curGraph.nodes[object] yields undefined, throwing TypeError when reading .short.
    expect(() => ctx.runPrim(0)).toThrowError(/Cannot read properties of undefined.*short/);
  });
});
