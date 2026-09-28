import { describe, it, expect } from 'vitest';
import { generateTruthTable, checkEquivalence, formatTruthValue } from '../../../src/core/logic/TruthTableEngine.js';

describe('TruthTableEngine Unit Tests', () => {
  it('generates a 4-row truth table for 2 variables', () => {
    const res = generateTruthTable('p ∧ q');
    expect(res.variables).toEqual(['p', 'q']);
    expect(res.rows.length).toBe(4);
    // Row 1 (1, 1) -> 1
    expect(res.rows[0].finalValue).toBe(true);
    // Row 2 (1, 0) -> 0
    expect(res.rows[1].finalValue).toBe(false);
    // Row 3 (0, 1) -> 0
    expect(res.rows[2].finalValue).toBe(false);
    // Row 4 (0, 0) -> 0
    expect(res.rows[3].finalValue).toBe(false);

    expect(res.stats.isTautology).toBe(false);
    expect(res.stats.isContradiction).toBe(false);
    expect(res.stats.isContingency).toBe(true);
    expect(res.stats.trueCount).toBe(1);
    expect(res.stats.falseCount).toBe(3);
  });

  it('correctly identifies Modus Ponens as Tautology', () => {
    const res = generateTruthTable('((p → q) ∧ p) → q');
    expect(res.stats.isTautology).toBe(true);
    expect(res.stats.isContradiction).toBe(false);
    expect(res.stats.trueCount).toBe(4);
  });

  it('correctly identifies Contradiction', () => {
    const res = generateTruthTable('p ∧ ¬p');
    expect(res.stats.isContradiction).toBe(true);
    expect(res.stats.isTautology).toBe(false);
    expect(res.stats.falseCount).toBe(2);
  });

  it('computes correct DNF and CNF normal forms', () => {
    const res = generateTruthTable('p ⊕ q');
    // p XOR q is true when (1,0) or (0,1)
    expect(res.normalForms.dnf).toContain('p ∧ ¬q');
    expect(res.normalForms.dnf).toContain('¬p ∧ q');
  });

  it('correctly validates logical equivalence (A ≡ B)', () => {
    // De Morgan
    const equiv = checkEquivalence('¬(p ∧ q)', '¬p ∨ ¬q');
    expect(equiv.isEquivalent).toBe(true);
    expect(equiv.counterexample).toBeNull();

    // Contrapositive
    const contra = checkEquivalence('p → q', '¬q → ¬p');
    expect(contra.isEquivalent).toBe(true);

    // Non-equivalence
    const notEquiv = checkEquivalence('p → q', 'q → p');
    expect(notEquiv.isEquivalent).toBe(false);
    expect(notEquiv.counterexample).not.toBeNull();
  });

  it('formats truth values according to style options', () => {
    expect(formatTruthValue(true, 'binary')).toBe('1');
    expect(formatTruthValue(false, 'binary')).toBe('0');
    expect(formatTruthValue(true, 'boolean')).toBe('T');
    expect(formatTruthValue(false, 'boolean')).toBe('F');
    expect(formatTruthValue(true, 'vietnamese')).toBe('Đ');
    expect(formatTruthValue(false, 'vietnamese')).toBe('S');
  });
});
