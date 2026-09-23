import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import textbookGraph from '../fixtures/dijkstra/textbook-undirected.json';

describe('Playback Controls & UI Switcher Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  describe('REG-17: Stepping Controls (Forward, Backward, Jump, Boundaries)', () => {
    it('manages step boundaries and updates current step index correctly', () => {
      ctx.setupGraph(textbookGraph);
      const trace = ctx.runDijkstra(0, 7);
      ctx.setTrace(trace);
      ctx.setStepIdx(0);

      // Boundary test: backward from 0 must remain 0
      ctx.stepBackward();
      expect(ctx.getStepIdx()).toBe(0);

      // Forward step test
      ctx.stepForward();
      expect(ctx.getStepIdx()).toBe(1);

      ctx.stepForward();
      expect(ctx.getStepIdx()).toBe(2);

      ctx.stepBackward();
      expect(ctx.getStepIdx()).toBe(1);

      // Jump to step
      const targetStep = 5;
      ctx.jumpToStep(targetStep);
      expect(ctx.getStepIdx()).toBe(targetStep);

      // Boundary test: forward past end must clamp to last index
      const lastIndex = trace.frames.length - 1;
      ctx.jumpToStep(lastIndex);
      expect(ctx.getStepIdx()).toBe(lastIndex);

      ctx.stepForward();
      expect(ctx.getStepIdx()).toBe(lastIndex);
    });
  });

  describe('REG-18: Algorithm Switcher & UI Coordination', () => {
    it('switches algorithm UI state, code titles, and control visibility correctly', () => {
      ctx.setupGraph(textbookGraph);

      // 1. Dijkstra mode
      ctx.setCurrentAlgo('dijkstra');
      expect(ctx.document.getElementById('codeTitleText').textContent).toBe('Mã nguồn Dijkstra.h');
      expect(ctx.document.getElementById('startLabel').textContent).toBe('Nguồn:');
      expect(ctx.document.getElementById('endGroupWrap').style.display).not.toBe('none');
      expect(ctx.document.getElementById('hamModeGroup').style.display).toBe('none');

      // 2. Kruskal mode
      ctx.setCurrentAlgo('kruskal');
      expect(ctx.document.getElementById('codeTitleText').textContent).toContain('Kruskal');
      expect(ctx.document.getElementById('startSel').style.display).toBe('none');
      expect(ctx.document.getElementById('endGroupWrap').style.display).toBe('none');

      // 3. Prim mode
      ctx.setCurrentAlgo('prim');
      expect(ctx.document.getElementById('codeTitleText').textContent).toContain('Prim');
      expect(ctx.document.getElementById('startLabel').textContent).toBe('Gốc MST:');
      expect(ctx.document.getElementById('endGroupWrap').style.display).toBe('none');

      // 4. Euler mode
      ctx.setCurrentAlgo('euler');
      expect(ctx.document.getElementById('codeTitleText').textContent).toContain('Euler');
      expect(ctx.document.getElementById('hamModeGroup').style.display).toBe('none');

      // 5. Hamilton mode
      ctx.setCurrentAlgo('hamilton');
      expect(ctx.document.getElementById('codeTitleText').textContent).toContain('Hamilton');
      expect(ctx.document.getElementById('hamModeGroup').style.display).toBe('inline-flex');
    });
  });
});
