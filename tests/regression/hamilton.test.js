import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import undirectedCycle from '../fixtures/hamilton/undirected-cycle.json';
import directedCycle from '../fixtures/hamilton/directed-cycle.json';

describe('Hamilton Algorithm Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-11: Hamilton cycle and path backtracking on undirected 4-cycle graph', () => {
    ctx.setupGraph(undirectedCycle);

    // Test Cycle: wantCycle = true
    const resultCycle = ctx.runHamilton(0, true);
    expect(resultCycle.found).toBe(true);
    expect(resultCycle.truncated).toBe(false);
    expect(resultCycle.resultPath.length).toBe(4);
    // All 4 distinct vertices [0, 1, 2, 3] must be present in the path
    expect(new Set(resultCycle.resultPath).size).toBe(4);

    const lastFrameCycle = resultCycle.frames[resultCycle.frames.length - 1];
    expect(lastFrameCycle.phase).toBe('Hoàn tất');
    expect(lastFrameCycle.found).toBe(true);
    expect(lastFrameCycle.closesCycle).toBe(true);

    // Test Path: wantCycle = false
    const resultPath = ctx.runHamilton(0, false);
    expect(resultPath.found).toBe(true);
    expect(resultPath.resultPath.length).toBe(4);
  });

  it('REG-12: Hamilton cycle backtracking on directed triangle graph', () => {
    ctx.setupGraph(directedCycle);

    const result = ctx.runHamilton(0, true);
    expect(result.found).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.resultPath.length).toBe(3);
    expect(new Set(result.resultPath).size).toBe(3);

    const lastFrame = result.frames[result.frames.length - 1];
    expect(lastFrame.phase).toBe('Hoàn tất');
    expect(lastFrame.desc).toContain('CHU TRÌNH Hamilton có hướng');
  });
});
