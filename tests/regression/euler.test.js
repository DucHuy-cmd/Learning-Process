import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import circuitUndirected from '../fixtures/euler/circuit-undirected.json';
import pathUndirected from '../fixtures/euler/path-undirected.json';
import circuitDirected from '../fixtures/euler/circuit-directed.json';
import disconnectedUndirected from '../fixtures/euler/disconnected-undirected.json';
import expectedCircuit from '../fixtures/expected/euler-circuit.json';
import expectedPath from '../fixtures/expected/euler-path.json';

describe('Euler Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-07: Euler circuit detection and Hierholzer traversal on undirected graph (0 odd vertices)', () => {
    ctx.setupGraph(circuitUndirected);

    const result = ctx.runEuler(0);

    expect(result.type).toBe(expectedCircuit.type);
    expect(result.connected).toBe(expectedCircuit.connected);
    expect(result.odd.length).toBe(expectedCircuit.oddCount);

    // Full circuit must traverse all 6 edges (length = 7 nodes)
    expect(result.circuit.length).toBe(expectedCircuit.circuitVertexCount);
    // Closed circuit must start and end at the same vertex
    expect(result.circuit[0]).toBe(result.circuit[result.circuit.length - 1]);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.done).toBe(true);
    expect(lastFrame.finalCircuit.length).toBe(expectedCircuit.circuitVertexCount);
  });

  it('REG-08: Euler path detection on undirected graph with exactly 2 odd-degree vertices', () => {
    ctx.setupGraph(pathUndirected);

    const result = ctx.runEuler(0);

    expect(result.type).toBe(expectedPath.type);
    expect(result.connected).toBe(expectedPath.connected);
    expect(result.odd.length).toBe(expectedPath.oddCount);

    // Full path must traverse all 8 edges (length = 9 nodes)
    expect(result.circuit.length).toBe(expectedPath.pathVertexCount);
    // Path endpoints must correspond to the odd-degree nodes
    expect(result.odd).toContain(result.circuit[0]);
    expect(result.odd).toContain(result.circuit[result.circuit.length - 1]);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.done).toBe(true);
  });

  it('REG-09: Euler circuit detection on directed balanced graph (in-degree == out-degree)', () => {
    ctx.setupGraph(circuitDirected);

    const result = ctx.runEuler(0);

    expect(result.type).toBe('circuit');
    expect(result.connected).toBe(true);
    expect(result.circuit.length).toBe(circuitDirected.edges.length + 1);
    expect(result.circuit[0]).toBe(result.circuit[result.circuit.length - 1]);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.isDirected).toBe(true);
  });

  it('REG-10: Euler correctly identifies disconnected graph and halts with informative reason', () => {
    ctx.setupGraph(disconnectedUndirected);

    const result = ctx.runEuler(0);

    // Semantic distinction in legacy/index.html:
    // When a graph is disconnected, legacy code explicitly sets type = "disconnected".
    // It only uses type = "none" when the graph is connected but has > 2 odd-degree vertices.
    expect(result.type).toBe('disconnected');
    expect(result.connected).toBe(false);
    expect(result.circuit.length).toBe(0);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Không tồn tại Euler');
    expect(lastFrame.desc.toLowerCase()).toContain('không liên thông');
  });
});
