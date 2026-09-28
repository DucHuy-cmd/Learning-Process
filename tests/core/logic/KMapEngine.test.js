import { describe, it, expect } from 'vitest';
import { buildKMap } from '../../../src/core/logic/KMapEngine.js';
import { generateTruthTable } from '../../../src/core/logic/TruthTableEngine.js';

describe('KMapEngine Unit Tests', () => {
  it('builds 2-variable K-Map (2x2 grid) and simplifies p OR (p AND q) to p', () => {
    // Law of absorption: p ∨ (p ∧ q) ≡ p
    const tt = generateTruthTable('p ∨ (p ∧ q)');
    const kmap = buildKMap(tt);

    expect(kmap.numVars).toBe(2);
    expect(kmap.grid.length).toBe(2);
    expect(kmap.grid[0].length).toBe(2);
    expect(kmap.groups.length).toBe(1);
    expect(kmap.minimalSop).toBe('p');
  });

  it('builds 3-variable K-Map (2x4 grid, Gray code) and groups adjacent cells', () => {
    // p ∧ (q ∨ ¬q) -> p
    const tt = generateTruthTable('(p ∧ q ∧ r) ∨ (p ∧ q ∧ ¬r)');
    const kmap = buildKMap(tt);

    expect(kmap.numVars).toBe(3);
    expect(kmap.rowHeaders).toEqual(['0', '1']);
    expect(kmap.colHeaders).toEqual(['00', '01', '11', '10']); // Gray code
    expect(kmap.minimalSop).toContain('p');
    expect(kmap.minimalSop).toContain('q');
    // r is eliminated because r=1 and r=0 both true
    expect(kmap.minimalSop).not.toContain('r');
  });

  it('builds 4-variable K-Map (4x4 grid) with 4-corner wrap-around', () => {
    // 4 variables p, q, r, s: true at all 4 corners where q=0 and s=0
    const tt = generateTruthTable('(¬q ∧ ¬s) ∧ (p ∨ ¬p) ∧ (r ∨ ¬r)');
    const kmap = buildKMap(tt);

    expect(kmap.numVars).toBe(4);
    expect(kmap.grid.length).toBe(4);
    expect(kmap.grid[0].length).toBe(4);
    expect(kmap.groups.length).toBe(1);
    expect(kmap.minimalSop).toContain('¬q');
    expect(kmap.minimalSop).toContain('¬s');
  });

  it('correctly handles constant 1 and constant 0', () => {
    // 1 variable throws validation error
    expect(() => buildKMap(generateTruthTable('p ∨ ¬p'))).toThrow('từ 2 đến 4 biến');

    // 2 variables tautology
    const ttTautology2 = generateTruthTable('(p ∨ ¬p) ∧ (q ∨ ¬q)');
    const kmap2 = buildKMap(ttTautology2);
    expect(kmap2.minimalSop).toContain('1');

    // 2 variables contradiction
    const ttContradiction2 = generateTruthTable('(p ∧ ¬p) ∧ q');
    const kmapContra = buildKMap(ttContradiction2);
    expect(kmapContra.minimalSop).toBe('0 (Hằng sai)');
  });
});
