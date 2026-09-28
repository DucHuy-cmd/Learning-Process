import { describe, it, expect } from 'vitest';
import {
  calculateDirichletBounds,
  distributeEvenly,
  distributeRandomly,
  evaluateDirichlet,
  solveDirichletScenario,
} from '../../../src/core/counting/DirichletEngine.js';

describe('DirichletEngine - Bounds & Core Logic', () => {
  it('calculates Dirichlet bounds accurately', () => {
    // 10 items into 3 boxes: ceil(10/3) = 4, floor(10/3) = 3
    const bounds1 = calculateDirichletBounds(10, 3);
    expect(bounds1.ceilBound).toBe(4);
    expect(bounds1.floorBound).toBe(3);
    expect(bounds1.isBasicApplicable).toBe(true);
    expect(bounds1.basicNote).toContain('chứa từ 2 vật trở lên');
    expect(bounds1.proofByContradiction).toContain('Giả sử phản chứng');

    // 3 items into 5 boxes: ceil(3/5) = 1, floor(3/5) = 0
    const bounds2 = calculateDirichletBounds(3, 5);
    expect(bounds2.ceilBound).toBe(1);
    expect(bounds2.floorBound).toBe(0);
    expect(bounds2.isBasicApplicable).toBe(false);

    // 4 items into 4 boxes
    const bounds3 = calculateDirichletBounds(4, 4);
    expect(bounds3.ceilBound).toBe(1);
    expect(bounds3.floorBound).toBe(1);
    expect(bounds3.isBasicApplicable).toBe(false);

    // Throws on k <= 0
    expect(() => calculateDirichletBounds(5, 0)).toThrow();
  });

  it('distributes items as evenly as possible (anti-collision strategy)', () => {
    // 10 into 3 => [4, 3, 3]
    const even1 = distributeEvenly(10, 3);
    expect(even1).toEqual([4, 3, 3]);
    expect(even1.reduce((a, b) => a + b, 0)).toBe(10);

    // 14 into 4 => [4, 4, 3, 3]
    const even2 = distributeEvenly(14, 4);
    expect(even2).toEqual([4, 4, 3, 3]);
    expect(even2.reduce((a, b) => a + b, 0)).toBe(14);

    // 6 into 2 => [3, 3]
    const even3 = distributeEvenly(6, 2);
    expect(even3).toEqual([3, 3]);
    expect(even3.reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('distributes items randomly with correct total count', () => {
    const rand = distributeRandomly(25, 5);
    expect(rand.length).toBe(5);
    const sum = rand.reduce((a, b) => a + b, 0);
    expect(sum).toBe(25);
  });

  it('evaluates any allocation and guarantees Dirichlet theorem holds', () => {
    const alloc = [2, 5, 1, 2]; // total = 10, k = 4, ceil(10/4) = 3
    const result = evaluateDirichlet(alloc);

    expect(result.isValid).toBe(true);
    expect(result.totalItems).toBe(10);
    expect(result.k).toBe(4);
    expect(result.ceilBound).toBe(3);
    expect(result.floorBound).toBe(2);
    expect(result.maxBox).toBe(5);
    expect(result.minBox).toBe(1);
    expect(result.maxBoxIndices).toEqual([1]);
    expect(result.isDirichletSatisfied).toBe(true);
  });
});

describe('DirichletEngine - Classic Applied Problem Solvers', () => {
  it('solves Birthday problem', () => {
    // 12 months, target 3 people with same birth month => 12 * 2 + 1 = 25
    const resMonth = solveDirichletScenario('birthday', { period: 'month', targetSame: 3 });
    expect(resMonth.period).toBe(12);
    expect(resMonth.minPeopleNeeded).toBe(25);
    expect(resMonth.guaranteedSame).toBe(3);

    // 7 weekdays, target 4 people => 7 * 3 + 1 = 22
    const resDay = solveDirichletScenario('birthday', { period: 'weekday', targetSame: 4 });
    expect(resDay.period).toBe(7);
    expect(resDay.minPeopleNeeded).toBe(22);
  });

  it('solves Socks in dark problem', () => {
    // 3 colors, need 1 pair (target 2) => 3 * 1 + 1 = 4
    const res1 = solveDirichletScenario('socks', { colors: 3, targetMatch: 2 });
    expect(res1.minSocksNeeded).toBe(4);

    // 5 colors, need 3 socks same color => 5 * 2 + 1 = 11
    const res2 = solveDirichletScenario('socks', { colors: 5, targetMatch: 3 });
    expect(res2.minSocksNeeded).toBe(11);
  });

  it('solves Exam Scores problem', () => {
    // 0 to 10 integer grades => 11 levels. Need 4 students with same score => 11 * 3 + 1 = 34
    const res = solveDirichletScenario('exam_scores', { minScore: 0, maxScore: 10, targetSame: 4 });
    expect(res.kLevels).toBe(11);
    expect(res.minStudentsNeeded).toBe(34);
  });

  it('solves Sum of Pairs problem', () => {
    // n = 5 => 2n = 10 numbers, targetSum = 11, chosenCount = 6
    const res = solveDirichletScenario('sum_pairs', { n: 5 });
    expect(res.totalNumbers).toBe(10);
    expect(res.targetSum).toBe(11);
    expect(res.chosenCount).toBe(6);
    expect(res.pairs).toHaveLength(5);
    expect(res.pairs[0]).toEqual([1, 10]);
    expect(res.pairs[4]).toEqual([5, 6]);
  });

  it('solves Erdős–Szekeres theorem scenario', () => {
    // n = 3 => n^2 + 1 = 10, target subsequence length = 4
    const res = solveDirichletScenario('erdos_szekeres', { n: 3 });
    expect(res.totalLen).toBe(10);
    expect(res.targetSubsequenceLen).toBe(4);
  });
});
