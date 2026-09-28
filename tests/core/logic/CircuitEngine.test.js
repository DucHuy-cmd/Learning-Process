import { describe, it, expect } from 'vitest';
import { buildCircuitModel, parseTermLiterals } from '../../../src/core/logic/CircuitEngine.js';

describe('CircuitEngine Unit Tests', () => {
  it('parses product term literals correctly', () => {
    expect(parseTermLiterals('(p ∧ ¬q ∧ r)')).toEqual(['p', '¬q', 'r']);
    expect(parseTermLiterals('p')).toEqual(['p']);
    expect(parseTermLiterals('1')).toEqual([]);
  });

  it('builds circuit model and evaluates signals on assignment', () => {
    // F = (p ∧ q) ∨ ¬r
    const circuit = buildCircuitModel({
      variables: ['p', 'q', 'r'],
      terms: ['(p ∧ q)', '¬r'],
      assignment: { p: true, q: true, r: false },
    });

    expect(circuit.outputSignal).toBe(true);
    expect(circuit.svg).toContain('<svg');
    expect(circuit.svg).toContain('AND');
    expect(circuit.svg).toContain('OR');
    expect(circuit.svg).toContain('NOT');
  });

  it('correctly updates output signal when assignment changes', () => {
    // F = p ∧ q
    const c1 = buildCircuitModel({
      variables: ['p', 'q'],
      terms: ['(p ∧ q)'],
      assignment: { p: true, q: false },
    });
    expect(c1.outputSignal).toBe(false);

    const c2 = buildCircuitModel({
      variables: ['p', 'q'],
      terms: ['(p ∧ q)'],
      assignment: { p: true, q: true },
    });
    expect(c2.outputSignal).toBe(true);
  });
});
