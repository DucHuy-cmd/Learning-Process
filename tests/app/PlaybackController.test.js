/**
 * @file PlaybackController.test.js
 * Comprehensive unit test suite for Phase 3B: PlaybackController
 *
 * Verifies:
 * - Empty state (-1 index, null currentStep, boundary flags)
 * - Single step & multi-step navigation
 * - goto clamping, first, last, next, prev boundaries (no wrap-around)
 * - Autoplay from start, middle, and auto-restart from last step
 * - Multiple play() calls (idempotence)
 * - Timer-driven advancement via Timer DI
 * - Automatic pause at end of sequence
 * - Manual navigation while playing does NOT break autoplay
 * - pause() and togglePlay()
 * - setSpeed() validation and dynamic restart while playing
 * - destroy() and timer/subscriber cleanup
 * - subscribe() notifications and unsubscribe()
 * - skipTo(), skipToAction() (single and multiple actions), fromIndex
 * - skipToNextSettled() for Dijkstra, Kruskal, Prim, Euler, Hamilton
 * - no-match behavior (clampToEnd=true vs clampToEnd=false)
 * - Empty sequence skip safety
 * - Headless purity (no DOM, no window/document)
 * - Input immutability
 */

import { describe, it, expect, vi } from 'vitest';
import { PlaybackController } from '../../src/app/playback/PlaybackController.js';
import { AlgorithmAction } from '../../src/core/models/Types.js';

/**
 * Creates a controllable mock timer for deterministic tick-based testing.
 */
function createMockTimer() {
  let timerCounter = 0;
  const intervals = new Map();

  return {
    setInterval(fn, ms) {
      const id = ++timerCounter;
      intervals.set(id, { fn, ms });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    tick(id) {
      if (id !== undefined) {
        const item = intervals.get(id);
        if (item) item.fn();
      } else {
        // Run all registered intervals once
        for (const item of Array.from(intervals.values())) {
          item.fn();
        }
      }
    },
    get activeCount() {
      return intervals.size;
    },
    has(id) {
      return intervals.has(id);
    },
    getSpeed(id) {
      const item = intervals.get(id);
      return item ? item.ms : null;
    },
  };
}

/**
 * Helper to generate synthetic AlgorithmStep objects.
 */
function createDummyStep(stepNumber, action, description = '') {
  return {
    stepNumber,
    action,
    description: description || `Step ${stepNumber} [${action}]`,
    state: { index: stepNumber },
    highlights: { nodes: [`N${stepNumber}`], edges: [] },
  };
}

/**
 * Generates an array of n dummy steps.
 */
function createDummySteps(n) {
  return Array.from({ length: n }, (_, i) =>
    createDummyStep(i + 1, AlgorithmAction.SELECT_NODE, `Dummy step ${i + 1}`)
  );
}

describe('Phase 3B: PlaybackController', () => {
  // =========================================================================
  // SUITE 1: EMPTY STATE & INITIALIZATION
  // =========================================================================
  describe('Suite 1: Empty State & Step Loading', () => {
    it('initializes to empty state with index -1 and null currentStep', () => {
      const controller = new PlaybackController();

      expect(controller.steps).toEqual([]);
      expect(controller.currentIndex).toBe(-1);
      expect(controller.currentStep).toBeNull();
      expect(controller.totalSteps).toBe(0);
      expect(controller.isPlaying).toBe(false);
      expect(controller.isAtStart).toBe(true);
      expect(controller.isAtEnd).toBe(true);
      expect(controller.playSpeed).toBe(1000);
    });

    it('initializes with steps provided in constructor', () => {
      const steps = createDummySteps(3);
      const controller = new PlaybackController({ steps, initialIndex: 1 });

      expect(controller.totalSteps).toBe(3);
      expect(controller.currentIndex).toBe(1);
      expect(controller.currentStep).toBe(steps[1]);
      expect(controller.isAtStart).toBe(false);
      expect(controller.isAtEnd).toBe(false);
    });

    it('handles single step gracefully', () => {
      const steps = [createDummyStep(1, AlgorithmAction.INITIALIZE)];
      const controller = new PlaybackController({ steps });

      expect(controller.totalSteps).toBe(1);
      expect(controller.currentIndex).toBe(0);
      expect(controller.currentStep).toBe(steps[0]);
      expect(controller.isAtStart).toBe(true);
      expect(controller.isAtEnd).toBe(true);
    });

    it('loadSteps resets index and pauses active playback', () => {
      const mockTimer = createMockTimer();
      const controller = new PlaybackController({
        steps: createDummySteps(3),
        timer: mockTimer,
      });

      controller.play();
      expect(controller.isPlaying).toBe(true);

      const newSteps = createDummySteps(5);
      controller.loadSteps(newSteps, 2);

      expect(controller.isPlaying).toBe(false);
      expect(mockTimer.activeCount).toBe(0);
      expect(controller.totalSteps).toBe(5);
      expect(controller.currentIndex).toBe(2);
      expect(controller.currentStep).toBe(newSteps[2]);
    });

    it('clear() transitions controller back to empty state', () => {
      const controller = new PlaybackController({ steps: createDummySteps(4) });
      expect(controller.totalSteps).toBe(4);

      controller.clear();
      expect(controller.steps).toEqual([]);
      expect(controller.currentIndex).toBe(-1);
      expect(controller.currentStep).toBeNull();
      expect(controller.isAtStart).toBe(true);
      expect(controller.isAtEnd).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 2: NAVIGATION & BOUNDARY CLAMPING
  // =========================================================================
  describe('Suite 2: Navigation & Boundary Clamping', () => {
    it('navigates next, prev, first, and last correctly', () => {
      const steps = createDummySteps(4);
      const controller = new PlaybackController({ steps });

      expect(controller.currentIndex).toBe(0);

      // next()
      const step1 = controller.next();
      expect(controller.currentIndex).toBe(1);
      expect(step1).toBe(steps[1]);

      // prev()
      const step0 = controller.prev();
      expect(controller.currentIndex).toBe(0);
      expect(step0).toBe(steps[0]);

      // last()
      const stepLast = controller.last();
      expect(controller.currentIndex).toBe(3);
      expect(stepLast).toBe(steps[3]);
      expect(controller.isAtEnd).toBe(true);

      // first()
      const stepFirst = controller.first();
      expect(controller.currentIndex).toBe(0);
      expect(stepFirst).toBe(steps[0]);
      expect(controller.isAtStart).toBe(true);
    });

    it('clamps next() at last step without wrapping around', () => {
      const steps = createDummySteps(3);
      const controller = new PlaybackController({ steps, initialIndex: 2 });

      expect(controller.currentIndex).toBe(2);
      expect(controller.isAtEnd).toBe(true);

      const result = controller.next();
      expect(controller.currentIndex).toBe(2);
      expect(result).toBe(steps[2]);
    });

    it('clamps prev() at first step without wrapping around', () => {
      const steps = createDummySteps(3);
      const controller = new PlaybackController({ steps, initialIndex: 0 });

      expect(controller.currentIndex).toBe(0);
      expect(controller.isAtStart).toBe(true);

      const result = controller.prev();
      expect(controller.currentIndex).toBe(0);
      expect(result).toBe(steps[0]);
    });

    it('goto() clamps index to [0, steps.length - 1]', () => {
      const steps = createDummySteps(5);
      const controller = new PlaybackController({ steps });

      controller.goto(999);
      expect(controller.currentIndex).toBe(4);

      controller.goto(-50);
      expect(controller.currentIndex).toBe(0);

      controller.goto(2);
      expect(controller.currentIndex).toBe(2);
    });

    it('navigation on empty sequence returns null and preserves index -1', () => {
      const controller = new PlaybackController();

      expect(controller.goto(2)).toBeNull();
      expect(controller.currentIndex).toBe(-1);

      expect(controller.next()).toBeNull();
      expect(controller.currentIndex).toBe(-1);

      expect(controller.prev()).toBeNull();
      expect(controller.currentIndex).toBe(-1);

      expect(controller.first()).toBeNull();
      expect(controller.currentIndex).toBe(-1);

      expect(controller.last()).toBeNull();
      expect(controller.currentIndex).toBe(-1);
    });
  });

  // =========================================================================
  // SUITE 3: PLAYBACK & TIMER-DRIVEN ADVANCEMENT
  // =========================================================================
  describe('Suite 3: Playback & Timer-Driven Advancement (Mock Timer)', () => {
    it('play() starts timer and advances step on each tick', () => {
      const mockTimer = createMockTimer();
      const steps = createDummySteps(4);
      const controller = new PlaybackController({ steps, timer: mockTimer });

      expect(controller.isPlaying).toBe(false);
      const started = controller.play();
      expect(started).toBe(true);
      expect(controller.isPlaying).toBe(true);
      expect(mockTimer.activeCount).toBe(1);

      // Tick 1
      mockTimer.tick();
      expect(controller.currentIndex).toBe(1);

      // Tick 2
      mockTimer.tick();
      expect(controller.currentIndex).toBe(2);

      // Tick 3: reaches last step
      mockTimer.tick();
      expect(controller.currentIndex).toBe(3);
      expect(controller.isPlaying).toBe(true);

      // Tick 4: reaches end -> automatically pauses
      mockTimer.tick();
      expect(controller.currentIndex).toBe(3);
      expect(controller.isPlaying).toBe(false);
      expect(mockTimer.activeCount).toBe(0);
    });

    it('play() from last step automatically restarts from index 0 (legacy behavior)', () => {
      const mockTimer = createMockTimer();
      const steps = createDummySteps(3);
      const controller = new PlaybackController({
        steps,
        initialIndex: 2,
        timer: mockTimer,
      });

      expect(controller.currentIndex).toBe(2);
      expect(controller.isAtEnd).toBe(true);

      controller.play();
      expect(controller.currentIndex).toBe(0);
      expect(controller.isPlaying).toBe(true);

      mockTimer.tick();
      expect(controller.currentIndex).toBe(1);
    });

    it('play() is idempotent when called multiple times', () => {
      const mockTimer = createMockTimer();
      const controller = new PlaybackController({
        steps: createDummySteps(3),
        timer: mockTimer,
      });

      controller.play();
      expect(mockTimer.activeCount).toBe(1);

      controller.play();
      controller.play();
      expect(mockTimer.activeCount).toBe(1);
    });

    it('play() on empty sequence returns false and does not start timer', () => {
      const mockTimer = createMockTimer();
      const controller = new PlaybackController({ timer: mockTimer });

      const result = controller.play();
      expect(result).toBe(false);
      expect(controller.isPlaying).toBe(false);
      expect(mockTimer.activeCount).toBe(0);
    });

    it('pause() clears active timer and is idempotent', () => {
      const mockTimer = createMockTimer();
      const controller = new PlaybackController({
        steps: createDummySteps(3),
        timer: mockTimer,
      });

      controller.play();
      expect(controller.isPlaying).toBe(true);

      const paused = controller.pause();
      expect(paused).toBe(true);
      expect(controller.isPlaying).toBe(false);
      expect(mockTimer.activeCount).toBe(0);

      // Calling pause when already paused returns false
      expect(controller.pause()).toBe(false);
    });

    it('togglePlay() toggles between playing and paused', () => {
      const mockTimer = createMockTimer();
      const controller = new PlaybackController({
        steps: createDummySteps(3),
        timer: mockTimer,
      });

      expect(controller.togglePlay()).toBe(true);
      expect(controller.isPlaying).toBe(true);

      expect(controller.togglePlay()).toBe(false);
      expect(controller.isPlaying).toBe(false);
    });

    it('CRITICAL: manual navigation while playing does NOT break autoplay timer', () => {
      const mockTimer = createMockTimer();
      const steps = createDummySteps(6);
      const controller = new PlaybackController({ steps, timer: mockTimer });

      controller.play();
      expect(controller.isPlaying).toBe(true);

      // Tick to index 1
      mockTimer.tick();
      expect(controller.currentIndex).toBe(1);

      // Manual navigation
      controller.next();
      expect(controller.currentIndex).toBe(2);
      expect(controller.isPlaying).toBe(true); // Must remain playing!

      controller.goto(4);
      expect(controller.currentIndex).toBe(4);
      expect(controller.isPlaying).toBe(true);

      // Next tick from timer continues from index 4 -> 5
      mockTimer.tick();
      expect(controller.currentIndex).toBe(5);
      expect(controller.isPlaying).toBe(true);

      // Final tick stops at end
      mockTimer.tick();
      expect(controller.currentIndex).toBe(5);
      expect(controller.isPlaying).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: SPEED CONFIGURATION & DYNAMIC RESTART
  // =========================================================================
  describe('Suite 4: Speed Configuration & Dynamic Restart', () => {
    it('setSpeed() updates playSpeed and throws on invalid values', () => {
      const controller = new PlaybackController();
      controller.setSpeed(500);
      expect(controller.playSpeed).toBe(500);

      expect(() => controller.setSpeed(0)).toThrow(RangeError);
      expect(() => controller.setSpeed(-100)).toThrow(RangeError);
      expect(() => controller.setSpeed('fast')).toThrow(RangeError);
      expect(() => controller.setSpeed(NaN)).toThrow(RangeError);
    });

    it('setSpeed() while playing restarts timer with new interval without resetting index', () => {
      const mockTimer = createMockTimer();
      const steps = createDummySteps(5);
      const controller = new PlaybackController({
        steps,
        speed: 1000,
        timer: mockTimer,
      });

      controller.play();
      mockTimer.tick(); // advance to index 1
      expect(controller.currentIndex).toBe(1);

      // Update speed while playing
      controller.setSpeed(250);
      expect(controller.playSpeed).toBe(250);
      expect(controller.isPlaying).toBe(true);
      expect(controller.currentIndex).toBe(1); // Unchanged!

      // Verify timer is running with new speed
      expect(mockTimer.activeCount).toBe(1);
    });
  });

  // =========================================================================
  // SUITE 5: SEARCH & SKIPPING
  // =========================================================================
  describe('Suite 5: Search & Skipping (skipTo, skipToAction, skipToNextSettled)', () => {
    it('skipTo() jumps to first step matching custom predicate starting from currentIndex + 1', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(3, AlgorithmAction.SELECT_NODE),
        createDummyStep(4, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(5, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps });

      expect(controller.currentIndex).toBe(0);

      // Skip to first SELECT_NODE
      const result = controller.skipTo((s) => s.action === AlgorithmAction.SELECT_NODE);
      expect(controller.currentIndex).toBe(2);
      expect(result).toBe(steps[2]);

      // Skip to FINISH
      const resultFinish = controller.skipTo((s) => s.action === AlgorithmAction.FINISH);
      expect(controller.currentIndex).toBe(4);
      expect(resultFinish).toBe(steps[4]);
    });

    it('skipTo() respects fromIndex override', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.SELECT_NODE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(3, AlgorithmAction.SELECT_NODE),
      ];
      const controller = new PlaybackController({ steps });

      // Start search from 0 even though currentIndex is 0
      const result = controller.skipTo((s) => s.action === AlgorithmAction.SELECT_NODE, {
        fromIndex: 0,
      });
      expect(controller.currentIndex).toBe(0);
      expect(result).toBe(steps[0]);
    });

    it('skipToAction() supports single action string and array of actions', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(3, AlgorithmAction.ACCEPT_EDGE),
        createDummyStep(4, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps });

      // Single action
      controller.skipToAction(AlgorithmAction.ACCEPT_EDGE);
      expect(controller.currentIndex).toBe(2);

      // Array of actions
      controller.first();
      controller.skipToAction([AlgorithmAction.ACCEPT_EDGE, AlgorithmAction.FINISH]);
      expect(controller.currentIndex).toBe(2);
    });

    it('skipToNextSettled() matches default milestone actions', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(3, AlgorithmAction.RELAX_EDGE),
        createDummyStep(4, AlgorithmAction.SELECT_NODE),
        createDummyStep(5, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(3);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(4);
    });

    it('no-match with clampToEnd=true (default) jumps to last step (legacy behavior)', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
      ];
      const controller = new PlaybackController({ steps });

      const result = controller.skipToAction(AlgorithmAction.FINISH);
      expect(controller.currentIndex).toBe(1);
      expect(result).toBe(steps[1]);
    });

    it('no-match with clampToEnd=false keeps current index and returns null', () => {
      const steps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
      ];
      const controller = new PlaybackController({ steps });

      const result = controller.skipToAction(AlgorithmAction.FINISH, {
        clampToEnd: false,
      });
      expect(controller.currentIndex).toBe(0);
      expect(result).toBeNull();
    });

    it('skip on empty sequence returns null without throwing', () => {
      const controller = new PlaybackController();
      expect(controller.skipTo(() => true)).toBeNull();
      expect(controller.skipToAction(AlgorithmAction.FINISH)).toBeNull();
      expect(controller.skipToNextSettled()).toBeNull();
      expect(controller.currentIndex).toBe(-1);
    });
  });

  // =========================================================================
  // SUITE 6: ALGORITHM ACTION MILESTONES COMPATIBILITY
  // =========================================================================
  describe('Suite 6: Algorithm Action Milestones Compatibility', () => {
    it('Dijkstra: skips to SELECT_NODE and FINISH milestones', () => {
      const dijkstraSteps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.SELECT_NODE), // Milestone 1
        createDummyStep(3, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(4, AlgorithmAction.RELAX_EDGE),
        createDummyStep(5, AlgorithmAction.SELECT_NODE), // Milestone 2
        createDummyStep(6, AlgorithmAction.FINISH), // Milestone 3
      ];
      const controller = new PlaybackController({ steps: dijkstraSteps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(1);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(4);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(5);
    });

    it('Kruskal: skips to ACCEPT_EDGE and FINISH milestones (no SELECT_NODE)', () => {
      const kruskalSteps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(3, AlgorithmAction.ACCEPT_EDGE), // Milestone 1
        createDummyStep(4, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(5, AlgorithmAction.REJECT_EDGE),
        createDummyStep(6, AlgorithmAction.ACCEPT_EDGE), // Milestone 2
        createDummyStep(7, AlgorithmAction.FINISH), // Milestone 3
      ];
      const controller = new PlaybackController({ steps: kruskalSteps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(2);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(5);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(6);
    });

    it('Prim: skips across SELECT_NODE (root) and ACCEPT_EDGE milestones', () => {
      const primSteps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.SELECT_NODE), // Root milestone
        createDummyStep(3, AlgorithmAction.INSPECT_EDGE),
        createDummyStep(4, AlgorithmAction.ACCEPT_EDGE), // MST edge milestone
        createDummyStep(5, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps: primSteps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(1);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(3);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(4);
    });

    it('Euler: skips across SELECT_NODE and ACCEPT_EDGE milestones', () => {
      const eulerSteps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.SELECT_NODE), // Start node
        createDummyStep(3, AlgorithmAction.ACCEPT_EDGE), // Edge traversal
        createDummyStep(4, AlgorithmAction.BACKTRACK),
        createDummyStep(5, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps: eulerSteps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(1);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(2);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(4);
    });

    it('Hamilton: skips across candidate SELECT_NODE and FINISH milestones', () => {
      const hamiltonSteps = [
        createDummyStep(1, AlgorithmAction.INITIALIZE),
        createDummyStep(2, AlgorithmAction.SELECT_NODE), // Candidate 1
        createDummyStep(3, AlgorithmAction.BACKTRACK),
        createDummyStep(4, AlgorithmAction.SELECT_NODE), // Candidate 2
        createDummyStep(5, AlgorithmAction.FINISH),
      ];
      const controller = new PlaybackController({ steps: hamiltonSteps });

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(1);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(3);

      controller.skipToNextSettled();
      expect(controller.currentIndex).toBe(4);
    });
  });

  // =========================================================================
  // SUITE 7: SUBSCRIPTIONS & LIFECYCLE CLEANUP
  // =========================================================================
  describe('Suite 7: Subscriptions & Lifecycle Cleanup', () => {
    it('subscribe() notifies listener on state and index changes', () => {
      const steps = createDummySteps(3);
      const controller = new PlaybackController({ steps });
      const listener = vi.fn();

      const unsubscribe = controller.subscribe(listener);

      controller.next();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(
        steps[1],
        expect.objectContaining({ currentIndex: 1, isPlaying: false })
      );

      // Redundant goto does not trigger spurious notifications
      controller.goto(1);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe stops notifications
      unsubscribe();
      controller.next();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('destroy() pauses playback, clears timers, and unregisters all subscribers', () => {
      const mockTimer = createMockTimer();
      const steps = createDummySteps(4);
      const controller = new PlaybackController({ steps, timer: mockTimer });
      const listener = vi.fn();
      controller.subscribe(listener);

      controller.play();
      expect(controller.isPlaying).toBe(true);
      expect(mockTimer.activeCount).toBe(1);

      controller.destroy();
      expect(controller.isPlaying).toBe(false);
      expect(mockTimer.activeCount).toBe(0);
      expect(controller.steps).toEqual([]);
      expect(controller.currentIndex).toBe(-1);

      // Subsequent actions are no-ops and don't notify
      listener.mockClear();
      controller.play();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 8: INPUT IMMUTABILITY & HEADLESS PURITY
  // =========================================================================
  describe('Suite 8: Input Immutability & Headless Purity', () => {
    it('does not mutate caller-owned steps array or step objects', () => {
      const rawSteps = [
        Object.freeze(createDummyStep(1, AlgorithmAction.INITIALIZE)),
        Object.freeze(createDummyStep(2, AlgorithmAction.FINISH)),
      ];
      const frozenContainer = Object.freeze([...rawSteps]);

      const controller = new PlaybackController({ steps: frozenContainer });

      controller.next();
      controller.prev();
      controller.first();
      controller.last();

      expect(frozenContainer.length).toBe(2);
      expect(frozenContainer[0].stepNumber).toBe(1);
      expect(frozenContainer[1].stepNumber).toBe(2);
    });

    it('steps getter returns a defensive copy', () => {
      const controller = new PlaybackController({ steps: createDummySteps(2) });
      const copiedSteps = controller.steps;
      copiedSteps.push(createDummyStep(3, AlgorithmAction.ERROR));

      expect(controller.totalSteps).toBe(2);
    });

    it('operates in a strictly headless environment without DOM or window/document', () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');

      const controller = new PlaybackController({ steps: createDummySteps(3) });
      expect(controller.next()).toBeDefined();
    });
  });
});
