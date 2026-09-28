import { describe, it, expect } from 'vitest';
import { tokenizeLogic, TokenType } from '../../../src/core/logic/LogicTokenizer.js';

describe('LogicTokenizer Unit Tests', () => {
  it('tokenizes simple variables and standard symbols', () => {
    const tokens = tokenizeLogic('p ∧ q ∨ ¬r');
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.VAR,
      TokenType.AND,
      TokenType.VAR,
      TokenType.OR,
      TokenType.NOT,
      TokenType.VAR,
    ]);
  });

  it('tokenizes ASCII aliases (~, !, ^, v, &, |, ->, <->)', () => {
    const tokens = tokenizeLogic('~p & (q | r) -> s <-> t');
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.NOT,
      TokenType.VAR,
      TokenType.AND,
      TokenType.LPAREN,
      TokenType.VAR,
      TokenType.OR,
      TokenType.VAR,
      TokenType.RPAREN,
      TokenType.IMP,
      TokenType.VAR,
      TokenType.IFF,
      TokenType.VAR,
    ]);
  });

  it('tokenizes word-based aliases (not, and, or, implies, iff, xor)', () => {
    const tokens = tokenizeLogic('p and not q or r implies s iff t xor u');
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.VAR,
      TokenType.AND,
      TokenType.NOT,
      TokenType.VAR,
      TokenType.OR,
      TokenType.VAR,
      TokenType.IMP,
      TokenType.VAR,
      TokenType.IFF,
      TokenType.VAR,
      TokenType.XOR,
      TokenType.VAR,
    ]);
  });

  it('tokenizes boolean constants (0, 1, T, F, True, False)', () => {
    const tokens = tokenizeLogic('p ∧ 1 ∨ 0 ∧ True ∨ False ∧ T ∨ F');
    const consts = tokens.filter(t => t.type === TokenType.CONST);
    expect(consts.length).toBe(6);
    expect(consts.map(c => c.value)).toEqual(['1', '0', '1', '0', '1', '0']);
  });

  it('throws helpful error on illegal characters', () => {
    expect(() => tokenizeLogic('p @ q')).toThrow('Ký tự không hợp lệ');
  });
});
