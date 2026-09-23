import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import sampleUndirected from '../fixtures/kruskal/sample-undirected.json';
import sampleDirected from '../fixtures/kruskal/sample-directed.json';
import expectedMst from '../fixtures/expected/kruskal-mst.json';

describe('Kruskal Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-03: Kruskal MST total weight, edge count, and cycle rejection on undirected graph', () => {
    ctx.setupGraph(sampleUndirected);

    const result = ctx.runKruskal();

    // Verify MST total weight and structure
    expect(result.connected).toBe(expectedMst.connected);
    expect(result.total).toBe(expectedMst.expectedTotalWeight);
    expect(result.mst.length).toBe(expectedMst.expectedMstEdgeCount);

    // Verify accepted edges
    const simplifiedMst = result.mst.map(e => ({ a: e.a, b: e.b, w: e.w }));
    expect(simplifiedMst).toEqual(expectedMst.expectedAcceptedEdges);

    // Verify table headers and rows
    expect(result.headers).toEqual(["Cạnh", "Trọng số", "Kết quả", "Tổng MST"]);
    expect(result.fullMatrix.length).toBe(sampleUndirected.edges.length);

    // Check that cycles were rejected in the table rows
    const rejectedRows = result.fullMatrix.filter(row => row.cells[2].type === 'visited' || row.cells[2].val.includes('Loại'));
    expect(rejectedRows.length).toBe(sampleUndirected.edges.length - expectedMst.expectedMstEdgeCount);

    // Verify final frame
    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.done).toBe(true);
    expect(lastFrame.mstFinal.length).toBe(expectedMst.expectedMstEdgeCount);
  });

  it('REG-04: Kruskal gracefully rejects directed graphs with informative notification', () => {
    ctx.setupGraph(sampleDirected);

    const result = ctx.runKruskal();

    expect(result.frames.length).toBe(1);
    expect(result.frames[0].phase).toBe('Không áp dụng');
    expect(result.frames[0].desc).toBe('Kruskal chỉ áp dụng cho đồ thị vô hướng.');
    expect(result.fullMatrix[0].cells[2].val).toBe('Kruskal chỉ áp dụng cho đồ thị vô hướng.');
  });
});
