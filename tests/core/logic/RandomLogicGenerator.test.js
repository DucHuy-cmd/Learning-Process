import { describe, it, expect } from 'vitest';
import { generateRandomProposition, generateEquivalencePracticePair } from '../../../src/core/logic/RandomLogicGenerator.js';
import { generateTruthTable } from '../../../src/core/logic/TruthTableEngine.js';

describe('RandomLogicGenerator Unit Tests', () => {
  it('generates a valid parseable proposition with requested variable count', () => {
    const res = generateRandomProposition({ variableCount: 3, complexity: 'medium' });
    expect(res.expression).toBeDefined();
    const table = generateTruthTable(res.expression);
    expect(table.rows.length).toBeGreaterThanOrEqual(4);
  });

  it('guarantees tautology when requested', () => {
    for (let i = 0; i < 5; i++) {
      const res = generateRandomProposition({ type: 'tautology' });
      const table = generateTruthTable(res.expression);
      expect(table.stats.isTautology).toBe(true);
    }
  });

  it('guarantees contradiction when requested', () => {
    for (let i = 0; i < 5; i++) {
      const res = generateRandomProposition({ type: 'contradiction' });
      const table = generateTruthTable(res.expression);
      expect(table.stats.isContradiction).toBe(true);
    }
  });

  it('generates valid equivalence practice pairs', () => {
    const pair = generateEquivalencePracticePair(2);
    expect(pair.expr1).toBeDefined();
    expect(pair.expr2).toBeDefined();
    expect(typeof pair.isEquivalent).toBe('boolean');
    expect(pair.explanation).toBeDefined();
  });
});
