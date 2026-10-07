/**
 * @file LogicTokenizer.js
 * Headless Core Tokenizer for Propositional Logic.
 * 
 * Supports:
 * - Variables: p, q, r, s, t, A, B, C, D, X, Y, Z, or subscripted p1, q2...
 * - Constants: 0, 1, T, F, True, False
 * - Negation (NOT): ¬, ~, !, not
 * - Conjunction (AND): ∧, ^, &, and, *
 * - Disjunction (OR): ∨, v, |, or, +
 * - Exclusive OR (XOR): ⊕, xor
 * - Implication (IMP): →, ->, =>, implies
 * - Biconditional (IFF): ↔, <->, <=>, iff, ==, ≡
 * - Grouping: (, )
 */

export const TokenType = {
  VAR: 'VAR',
  CONST: 'CONST',
  NOT: 'NOT',
  AND: 'AND',
  OR: 'OR',
  XOR: 'XOR',
  IMP: 'IMP',
  IFF: 'IFF',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
};

/**
 * Tokenizes a propositional logic expression string.
 * @param {string} input - Raw user expression
 * @returns {Array<{type: string, value: string, text: string, pos: number}>}
 * @throws {Error} If unrecognized character is encountered
 */
export function tokenizeLogic(input) {
  if (typeof input !== 'string') {
    throw new Error('Đầu vào phải là chuỗi biểu thức logic.');
  }

  const str = input.trim();
  if (!str) {
    return [];
  }

  const tokens = [];
  let i = 0;
  const n = str.length;

  while (i < n) {
    const ch = str[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: TokenType.LPAREN, value: '(', text: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: TokenType.RPAREN, value: ')', text: ')', pos: i });
      i++;
      continue;
    }

    // Biconditional: <-> or <=> or ↔ or ≡
    if (ch === '↔' || ch === '≡') {
      tokens.push({ type: TokenType.IFF, value: '↔', text: '↔', pos: i });
      i++;
      continue;
    }
    if (ch === '<' && (str.startsWith('<->', i) || str.startsWith('<=>', i))) {
      tokens.push({ type: TokenType.IFF, value: '↔', text: '↔', pos: i });
      i += 3;
      continue;
    }
    if (ch === '=' && str.startsWith('==', i)) {
      tokens.push({ type: TokenType.IFF, value: '↔', text: '↔', pos: i });
      i += 2;
      continue;
    }

    // Implication: -> or => or →
    if (ch === '→') {
      tokens.push({ type: TokenType.IMP, value: '→', text: '→', pos: i });
      i++;
      continue;
    }
    if ((ch === '-' && str.startsWith('->', i)) || (ch === '=' && str.startsWith('=>', i))) {
      tokens.push({ type: TokenType.IMP, value: '→', text: '→', pos: i });
      i += 2;
      continue;
    }

    // Negation: ¬ or ~ or !
    if (ch === '¬' || ch === '~' || ch === '!') {
      tokens.push({ type: TokenType.NOT, value: '¬', text: '¬', pos: i });
      i++;
      continue;
    }

    // Conjunction: * or · or ∧ or ^ or &
    if (ch === '*' || ch === '·' || ch === '∧' || ch === '&' || ch === '^') {
      tokens.push({ type: TokenType.AND, value: '*', text: '*', pos: i });
      i++;
      continue;
    }

    // Disjunction: + or ∨ or |
    if (ch === '+' || ch === '∨' || ch === '|') {
      tokens.push({ type: TokenType.OR, value: '+', text: '+', pos: i });
      i++;
      continue;
    }

    // XOR: ⊕
    if (ch === '⊕') {
      tokens.push({ type: TokenType.XOR, value: '⊕', text: '⊕', pos: i });
      i++;
      continue;
    }

    // Check words / identifiers
    if (/[A-Za-z0-9_]/.test(ch)) {
      let word = '';
      const startPos = i;
      while (i < n && /[A-Za-z0-9_]/.test(str[i])) {
        word += str[i];
        i++;
      }

      const lower = word.toLowerCase();

      // Word-based operators
      if (lower === 'not') {
        tokens.push({ type: TokenType.NOT, value: '¬', text: '¬', pos: startPos });
        continue;
      }
      if (lower === 'and') {
        tokens.push({ type: TokenType.AND, value: '*', text: '*', pos: startPos });
        continue;
      }
      if (lower === 'or' || lower === 'v') {
        tokens.push({ type: TokenType.OR, value: '+', text: '+', pos: startPos });
        continue;
      }
      if (lower === 'xor') {
        tokens.push({ type: TokenType.XOR, value: '⊕', text: '⊕', pos: startPos });
        continue;
      }
      if (lower === 'implies') {
        tokens.push({ type: TokenType.IMP, value: '→', text: '→', pos: startPos });
        continue;
      }
      if (lower === 'iff') {
        tokens.push({ type: TokenType.IFF, value: '↔', text: '↔', pos: startPos });
        continue;
      }

      // Boolean constants
      if (lower === 'true' || lower === '1' || (word === 'T' && word.length === 1)) {
        tokens.push({ type: TokenType.CONST, value: '1', text: '1', pos: startPos });
        continue;
      }
      if (lower === 'false' || lower === '0' || (word === 'F' && word.length === 1)) {
        tokens.push({ type: TokenType.CONST, value: '0', text: '0', pos: startPos });
        continue;
      }

      // Variable name (e.g. p, q, r, s, A, B, C, P1, Q2)
      tokens.push({ type: TokenType.VAR, value: word, text: word, pos: startPos });
      continue;
    }

    throw new Error(`Ký tự không hợp lệ tại vị trí ${i + 1}: "${ch}"`);
  }

  // Insert implicit conjunction (AND: *) between adjacent operands
  // Examples: p q -> p * q, p(q+r) -> p * (q+r), (p+q)(r+s) -> (p+q) * (r+s)
  const result = [];
  for (let k = 0; k < tokens.length; k++) {
    result.push(tokens[k]);
    if (k + 1 < tokens.length) {
      const curr = tokens[k];
      const next = tokens[k + 1];
      const currCanEnd = curr.type === TokenType.VAR || curr.type === TokenType.CONST || curr.type === TokenType.RPAREN;
      const nextCanStart = next.type === TokenType.VAR || next.type === TokenType.CONST || next.type === TokenType.LPAREN || next.type === TokenType.NOT;
      if (currCanEnd && nextCanStart) {
        result.push({
          type: TokenType.AND,
          value: '*',
          text: '*',
          pos: curr.pos,
        });
      }
    }
  }

  return result;
}
