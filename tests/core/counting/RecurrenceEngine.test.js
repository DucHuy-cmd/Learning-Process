import { describe, it, expect } from 'vitest';
import {
  solveOrder1Linear,
  solveOrder2Homogeneous,
  RECURRENCE_PRESETS,
  generateHanoiMoves,
  getHanoiStateAtStep,
} from '../../../src/core/counting/RecurrenceEngine.js';

describe('RecurrenceEngine - Linear Recurrences', () => {
  it('solves Order 1 linear recurrence correctly', () => {
    // a_n = 3 * a_{n-1}, a_0 = 2 => a_n = 2 * 3^n
    const res = solveOrder1Linear(3, 2, 5);
    expect(res.order).toBe(1);
    expect(res.root).toBe(3);
    expect(res.closedForm).toContain('2 × (3)ⁿ');
    expect(res.terms[0].val).toBe(2);
    expect(res.terms[1].val).toBe(6);
    expect(res.terms[2].val).toBe(18);
    expect(res.terms[3].val).toBe(54);
  });

  it('solves Order 2 with distinct real roots correctly', () => {
    // a_n = 5*a_{n-1} - 6*a_{n-2}, a0 = 1, a1 = 4
    // r^2 - 5r + 6 = 0 => r1 = 3, r2 = 2
    // a_n = 2 * 3^n - 2^n
    const res = solveOrder2Homogeneous(5, -6, 1, 4, 5);
    expect(res.order).toBe(2);
    expect(res.rootType).toBe('distinct_real');
    expect(res.r1).toBe(3);
    expect(res.r2).toBe(2);
    expect(res.alpha1).toBe(2);
    expect(res.alpha2).toBe(-1);
    expect(res.terms[0].val).toBe(1);
    expect(res.terms[1].val).toBe(4);
    expect(res.terms[2].val).toBe(14); // 5*4 - 6*1 = 14
    expect(res.terms[3].val).toBe(46); // 5*14 - 6*4 = 46
  });

  it('solves Order 2 with double real root correctly', () => {
    // a_n = 4*a_{n-1} - 4*a_{n-2}, a0 = 1, a1 = 4
    // r^2 - 4r + 4 = 0 => r0 = 2
    // a_n = (1 + n) * 2^n
    const res = solveOrder2Homogeneous(4, -4, 1, 4, 4);
    expect(res.rootType).toBe('double_real');
    expect(res.r1).toBe(2);
    expect(res.alpha1).toBe(1);
    expect(res.alpha2).toBe(1);
    expect(res.terms[0].val).toBe(1);
    expect(res.terms[1].val).toBe(4);
    expect(res.terms[2].val).toBe(12); // (1+2)*4 = 12
    expect(res.terms[3].val).toBe(32); // (1+3)*8 = 32
  });

  it('solves classic Fibonacci recurrence correctly', () => {
    // F_n = F_{n-1} + F_{n-2}, F0 = 0, F1 = 1
    const res = solveOrder2Homogeneous(1, 1, 0, 1, 7);
    expect(res.rootType).toBe('distinct_real');
    expect(res.terms.map(t => t.val)).toEqual([0, 1, 1, 2, 3, 5, 8, 13]);
  });

  it('includes standard recurrence presets', () => {
    expect(RECURRENCE_PRESETS.length).toBeGreaterThanOrEqual(4);
    const fib = RECURRENCE_PRESETS.find(p => p.id === 'fibonacci');
    expect(fib).toBeDefined();
    expect(fib.c1).toBe(1);
    expect(fib.c2).toBe(1);
  });
});

describe('RecurrenceEngine - Tower of Hanoi', () => {
  it('generates Hanoi moves with exact count 2^n - 1', () => {
    // n = 1 => 1 move
    const moves1 = generateHanoiMoves(1);
    expect(moves1.length).toBe(1);
    expect(moves1[0]).toEqual({ step: 1, disk: 1, from: 'A', to: 'C' });

    // n = 3 => 2^3 - 1 = 7 moves
    const moves3 = generateHanoiMoves(3);
    expect(moves3.length).toBe(7);

    // n = 4 => 2^4 - 1 = 15 moves
    const moves4 = generateHanoiMoves(4);
    expect(moves4.length).toBe(15);
  });

  it('correctly tracks peg states at arbitrary steps', () => {
    const n = 3;
    const moves = generateHanoiMoves(n);

    // Step 0: All 3 disks on peg A
    const state0 = getHanoiStateAtStep(n, 0, moves);
    expect(state0.A).toEqual([3, 2, 1]);
    expect(state0.B).toEqual([]);
    expect(state0.C).toEqual([]);

    // Final step 7: All 3 disks on peg C
    const state7 = getHanoiStateAtStep(n, 7, moves);
    expect(state7.A).toEqual([]);
    expect(state7.B).toEqual([]);
    expect(state7.C).toEqual([3, 2, 1]);
  });
});
