import { describe, it, expect } from 'vitest';
import {
  buildPascalTriangle,
  getPascalCellInfo,
  calculateCombinatoricsCounts,
  generateNextPermutation,
  generateAllPermutations,
  generateNextCombination,
  generateAllCombinations,
  generateAllArrangements,
  generateAllArrangementsWithRepetition,
  generateAllCombinationsWithRepetition,
} from '../../../src/core/counting/CombinatoricsEngine.js';

describe('CombinatoricsEngine - Pascal Triangle', () => {
  it('builds Pascal triangle correctly', () => {
    const triangle = buildPascalTriangle(4);
    expect(triangle.length).toBe(5); // rows 0, 1, 2, 3, 4
    expect(triangle[0]).toEqual([1]);
    expect(triangle[1]).toEqual([1, 1]);
    expect(triangle[2]).toEqual([1, 2, 1]);
    expect(triangle[3]).toEqual([1, 3, 3, 1]);
    expect(triangle[4]).toEqual([1, 4, 6, 4, 1]);

    // Check row sum identity: sum of row n = 2^n
    const sumRow4 = triangle[4].reduce((a, b) => a + b, 0);
    expect(sumRow4).toBe(16);
  });

  it('retrieves detailed cell information for Pascal cell', () => {
    const cell = getPascalCellInfo(4, 2);
    expect(cell).not.toBeNull();
    expect(cell.val).toBe(6);
    expect(cell.rowSum).toBe(16);
    expect(cell.isSymmetricWith).toBe(2);
    expect(cell.parentLeft).toEqual({ n: 3, k: 1, val: 3 });
    expect(cell.parentRight).toEqual({ n: 3, k: 2, val: 3 });
    expect(cell.pascalFormula).toContain('3 + 3 = 6');
  });

  it('computes combinatorial formulas counts accurately', () => {
    const counts = calculateCombinatoricsCounts(5, 3);
    expect(counts.permutation).toBe(120); // 5! = 120
    expect(counts.arrangement).toBe(60); // A(5, 3) = 60
    expect(counts.combination).toBe(10); // C(5, 3) = 10
    expect(counts.arrangementWithRepetition).toBe(125); // 5^3 = 125
    expect(counts.combinationWithRepetition).toBe(35); // C(5+3-1, 3) = C(7, 3) = 35
  });
});

describe('CombinatoricsEngine - Lexicographical Generators', () => {
  it('generates next permutation using Narayana Pandita algorithm', () => {
    const arr = [1, 2, 3];
    expect(generateNextPermutation(arr)).toBe(true);
    expect(arr).toEqual([1, 3, 2]);

    expect(generateNextPermutation(arr)).toBe(true);
    expect(arr).toEqual([2, 1, 3]);

    expect(generateNextPermutation(arr)).toBe(true);
    expect(arr).toEqual([2, 3, 1]);

    expect(generateNextPermutation(arr)).toBe(true);
    expect(arr).toEqual([3, 1, 2]);

    expect(generateNextPermutation(arr)).toBe(true);
    expect(arr).toEqual([3, 2, 1]);

    // Last permutation -> returns false
    expect(generateNextPermutation(arr)).toBe(false);
  });

  it('generates all permutations of array', () => {
    const perms = generateAllPermutations(['A', 'B', 'C']);
    expect(perms.length).toBe(6);
    expect(perms[0]).toEqual(['A', 'B', 'C']);
    expect(perms[perms.length - 1]).toEqual(['C', 'B', 'A']);
  });

  it('generates next combination step-by-step', () => {
    const comb = [1, 2];
    const n = 4;
    const k = 2;

    expect(generateNextCombination(comb, n, k)).toBe(true);
    expect(comb).toEqual([1, 3]);

    expect(generateNextCombination(comb, n, k)).toBe(true);
    expect(comb).toEqual([1, 4]);

    expect(generateNextCombination(comb, n, k)).toBe(true);
    expect(comb).toEqual([2, 3]);

    expect(generateNextCombination(comb, n, k)).toBe(true);
    expect(comb).toEqual([2, 4]);

    expect(generateNextCombination(comb, n, k)).toBe(true);
    expect(comb).toEqual([3, 4]);

    expect(generateNextCombination(comb, n, k)).toBe(false);
  });

  it('generates all combinations C(n, k)', () => {
    const combs = generateAllCombinations(['A', 'B', 'C', 'D'], 2);
    expect(combs.length).toBe(6);
    expect(combs[0]).toEqual(['A', 'B']);
    expect(combs[combs.length - 1]).toEqual(['C', 'D']);
  });

  it('generates all arrangements A(n, k)', () => {
    const arrs = generateAllArrangements(['A', 'B', 'C', 'D'], 2);
    expect(arrs.length).toBe(12); // A(4, 2) = 12
    expect(arrs[0]).toEqual(['A', 'B']);
    expect(arrs[1]).toEqual(['A', 'C']);
  });

  it('generates all arrangements with repetition n^k', () => {
    const arrsRep = generateAllArrangementsWithRepetition(['A', 'B'], 3);
    expect(arrsRep.length).toBe(8); // 2^3 = 8
    expect(arrsRep[0]).toEqual(['A', 'A', 'A']);
    expect(arrsRep[7]).toEqual(['B', 'B', 'B']);
  });

  it('generates all combinations with repetition C_bar(n, k)', () => {
    // 3 items, choose 2 with repetition: C(3 + 2 - 1, 2) = C(4, 2) = 6
    const combsRep = generateAllCombinationsWithRepetition(['A', 'B', 'C'], 2);
    expect(combsRep.length).toBe(6);
    expect(combsRep).toEqual([
      ['A', 'A'],
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'B'],
      ['B', 'C'],
      ['C', 'C'],
    ]);
  });
});
