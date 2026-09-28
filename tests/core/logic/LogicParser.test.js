import { describe, it, expect } from 'vitest';
import { parseLogicExpression, extractVariables, collectSubexpressions } from '../../../src/core/logic/LogicParser.js';

describe('LogicParser Unit Tests', () => {
  it('parses variables and extracts sorted unique variable list', () => {
    const ast = parseLogicExpression('(r ∧ p) ∨ (q ∧ p)');
    const vars = extractVariables(ast);
    expect(vars).toEqual(['p', 'q', 'r']);
  });

  it('respects precedence: NOT > AND > OR > IMP > IFF', () => {
    // p ∧ ¬q ∨ r → s ↔ t
    // ( ((p ∧ (¬q)) ∨ r) → s ) ↔ t
    const ast = parseLogicExpression('p ∧ ¬q ∨ r → s ↔ t');
    expect(ast.type).toBe('IFF');
    expect(ast.left.type).toBe('IMP');
    expect(ast.left.left.type).toBe('OR');
    expect(ast.left.left.left.type).toBe('AND');
    expect(ast.left.left.left.right.type).toBe('NOT');
  });

  it('correctly handles right-associativity of implication: p -> q -> r == p -> (q -> r)', () => {
    const ast = parseLogicExpression('p → q → r');
    expect(ast.type).toBe('IMP');
    expect(ast.left.value).toBe('p');
    expect(ast.right.type).toBe('IMP');
    expect(ast.right.left.value).toBe('q');
    expect(ast.right.right.value).toBe('r');
  });

  it('evaluates boolean logic properly', () => {
    const ast = parseLogicExpression('(p → q) ∧ p');
    expect(ast.evaluate({ p: true, q: true })).toBe(true);
    expect(ast.evaluate({ p: true, q: false })).toBe(false);
    expect(ast.evaluate({ p: false, q: false })).toBe(false);
  });

  it('collects subexpressions in bottom-up order', () => {
    const ast = parseLogicExpression('(p → q) ∧ (q → r)');
    const subexprs = collectSubexpressions(ast);
    const subTexts = subexprs.map(s => s.text);
    expect(subTexts).toContain('p → q');
    expect(subTexts).toContain('q → r');
    expect(subTexts[subTexts.length - 1]).toBe('(p → q) ∧ (q → r)');
  });

  it('throws friendly syntax errors for unmatched parentheses and empty input', () => {
    expect(() => parseLogicExpression('')).toThrow('Biểu thức logic không được để trống');
    expect(() => parseLogicExpression('(p ∧ q')).toThrow('Thiếu dấu đóng ngoặc ")"');
    expect(() => parseLogicExpression('p ∧')).toThrow('kết thúc đột ngột');
  });
});
