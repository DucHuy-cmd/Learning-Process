import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import textbookGraph from '../fixtures/dijkstra/textbook-undirected.json';

describe('Visualization, Frame Snapshots & SVG Geometry Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-15: SVG graph rendering creates correct node boxes, labels, and edge elements', () => {
    ctx.setupGraph(textbookGraph);
    ctx.eval('renderGraphBase()');

    const zoomLayer = ctx.document.getElementById('zoomLayer');
    expect(zoomLayer).not.toBeNull();

    // Verify all nodes and labels exist in DOM
    // Note: In legacy/index.html line 2799, the SVG text element has class="nodelabel" (without hyphen)
    const nodeLabels = ctx.document.querySelectorAll('.nodelabel, .node-label');
    expect(nodeLabels.length).toBe(textbookGraph.nodes.length);

    textbookGraph.nodes.forEach((nd, i) => {
      const nodeBox = ctx.document.getElementById(`NB${i}`);
      expect(nodeBox).not.toBeNull();
      expect(nodeLabels[i].textContent).toBe(nd.short);
    });

    // Verify edge elements exist in DOM with IDs
    const edges = ctx.getEdgeList();
    expect(edges.length).toBe(textbookGraph.edges.length);
    edges.forEach(e => {
      const edgeEl = ctx.document.getElementById(`E${e.a}_${e.b}`);
      expect(edgeEl).not.toBeNull();
      expect(edgeEl.classList.contains('edge')).toBe(true);
    });

    // Verify zoom and pan transform
    ctx.eval('resetZoom()');
    expect(zoomLayer.getAttribute('transform')).toBe('translate(0, 0) scale(1)');

    ctx.document.getElementById('btnZoomIn').click();
    expect(zoomLayer.getAttribute('transform')).toBe('translate(0, 0) scale(1.2)');

    ctx.eval('resetZoom()');
    expect(zoomLayer.getAttribute('transform')).toBe('translate(0, 0) scale(1)');
  });

  it('REG-15: Frame painting correctly updates description, formula, and step counters', () => {
    ctx.setupGraph(textbookGraph);
    const trace = ctx.runDijkstra(0, 7);
    ctx.setTrace(trace);

    // Paint first frame
    ctx.eval('paintFrame(trace.frames[0])');
    const noteText = ctx.document.getElementById('stepNoteText');
    const formulaText = ctx.document.getElementById('stepFormula');

    expect(noteText.textContent).toBe(trace.frames[0].desc);
    expect(formulaText.textContent).toBe(trace.frames[0].formula);

    // Paint last frame
    const lastFrame = trace.frames[trace.frames.length - 1];
    ctx.eval(`paintFrame(trace.frames[${trace.frames.length - 1}])`);

    expect(noteText.textContent).toBe(lastFrame.desc);
    expect(formulaText.textContent).toBe(lastFrame.formula);
    expect(lastFrame.pathFinal).toEqual([0, 5, 6, 7]);
  });
});
