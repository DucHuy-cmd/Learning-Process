/**
 * @file LogicParser.js
 * Headless Core Recursive Descent Parser for Propositional Logic.
 * 
 * Precedence (Lowest to Highest):
 * 1. ↔ (Biconditional, Left-associative)
 * 2. → (Implication, Right-associative)
 * 3. ∨, ⊕ (Disjunction, XOR, Left-associative)
 * 4. ∧ (Conjunction, Left-associative)
 * 5. ¬ (Negation, Right-associative prefix)
 * 6. Primary: Variable, Constant, (Expression)
 */

import { TokenType, tokenizeLogic } from './LogicTokenizer.js';

export class ASTNode {
  /**
   * @param {Object} props
   * @param {string} props.type
   * @param {string} [props.value]
   * @param {ASTNode} [props.left]
   * @param {ASTNode} [props.right]
   * @param {string} [props.text]
   */
  constructor({ type, value = '', left = null, right = null, text = '' }) {
    this.type = type;
    this.value = value;
    this.left = left;
    this.right = right;
    this.text = text || this._generateText();
  }

  _generateText() {
    switch (this.type) {
      case TokenType.CONST:
        return this.value;
      case TokenType.VAR:
        return this.value;
      case TokenType.NOT:
        return `¬${this.left ? this._wrapUnary(this.left) : ''}`;
      case TokenType.AND:
        return `${this._wrapBinary(this.left)} ∧ ${this._wrapBinary(this.right)}`;
      case TokenType.OR:
        return `${this._wrapBinary(this.left)} ∨ ${this._wrapBinary(this.right)}`;
      case TokenType.XOR:
        return `${this._wrapBinary(this.left)} ⊕ ${this._wrapBinary(this.right)}`;
      case TokenType.IMP:
        return `${this._wrapBinary(this.left)} → ${this._wrapBinary(this.right)}`;
      case TokenType.IFF:
        return `${this._wrapBinary(this.left)} ↔ ${this._wrapBinary(this.right)}`;
      default:
        return this.value;
    }
  }

  _wrapUnary(node) {
    if (!node) return '';
    if (node.type === TokenType.VAR || node.type === TokenType.CONST || node.type === TokenType.NOT) {
      return node.text;
    }
    return `(${node.text})`;
  }

  _wrapBinary(node) {
    if (!node) return '';
    if (node.type === TokenType.VAR || node.type === TokenType.CONST) {
      return node.text;
    }
    // For readability in subexpressions, wrap complex operations
    return `(${node.text})`;
  }

  /**
   * Evaluates the node given variable truth values { p: true, q: false, ... }.
   * @param {Object<string, boolean|number>} env
   * @returns {boolean}
   */
  evaluate(env) {
    switch (this.type) {
      case TokenType.CONST:
        return this.value === '1' || this.value.toLowerCase() === 'true';
      case TokenType.VAR:
        return Boolean(env[this.value]);
      case TokenType.NOT:
        return !this.left.evaluate(env);
      case TokenType.AND:
        return this.left.evaluate(env) && this.right.evaluate(env);
      case TokenType.OR:
        return this.left.evaluate(env) || this.right.evaluate(env);
      case TokenType.XOR: {
        const l = this.left.evaluate(env);
        const r = this.right.evaluate(env);
        return (l || r) && !(l && r);
      }
      case TokenType.IMP: {
        const p = this.left.evaluate(env);
        const q = this.right.evaluate(env);
        return !p || q; // p -> q is equivalent to ¬p ∨ q
      }
      case TokenType.IFF: {
        const p = this.left.evaluate(env);
        const q = this.right.evaluate(env);
        return p === q; // p ↔ q is true when both have same truth value
      }
      default:
        throw new Error(`Toán tử không hợp lệ trong AST: ${this.type}`);
    }
  }
}

export class LogicParser {
  /**
   * @param {string} input
   */
  constructor(input) {
    this.tokens = tokenizeLogic(input);
    this.current = 0;
  }

  peek() {
    return this.tokens[this.current] || null;
  }

  previous() {
    return this.tokens[this.current - 1] || null;
  }

  isAtEnd() {
    return this.current >= this.tokens.length;
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  consume(type, errorMessage) {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    const loc = token ? `tại vị trí ${token.pos + 1}` : 'ở cuối biểu thức';
    throw new Error(`${errorMessage} (${loc})`);
  }

  parse() {
    if (this.tokens.length === 0) {
      throw new Error('Biểu thức logic không được để trống!');
    }
    const ast = this.expression();
    if (!this.isAtEnd()) {
      const leftover = this.peek();
      throw new Error(`Cú pháp không hợp lệ gần "${leftover.text}" tại vị trí ${leftover.pos + 1}`);
    }
    return ast;
  }

  expression() {
    return this.equivalence();
  }

  // Equivalence: ↔ (Left-associative)
  equivalence() {
    let expr = this.implication();
    while (this.match(TokenType.IFF)) {
      const right = this.implication();
      expr = new ASTNode({
        type: TokenType.IFF,
        value: '↔',
        left: expr,
        right,
      });
    }
    return expr;
  }

  // Implication: → (Right-associative: p -> q -> r == p -> (q -> r))
  implication() {
    const expr = this.disjunction();
    if (this.match(TokenType.IMP)) {
      const right = this.implication(); // Right recursion
      return new ASTNode({
        type: TokenType.IMP,
        value: '→',
        left: expr,
        right,
      });
    }
    return expr;
  }

  // Disjunction & XOR: ∨, ⊕ (Left-associative)
  disjunction() {
    let expr = this.conjunction();
    while (this.match(TokenType.OR, TokenType.XOR)) {
      const token = this.previous();
      const right = this.conjunction();
      expr = new ASTNode({
        type: token.type,
        value: token.value,
        left: expr,
        right,
      });
    }
    return expr;
  }

  // Conjunction: ∧ (Left-associative)
  conjunction() {
    let expr = this.negation();
    while (this.match(TokenType.AND)) {
      const right = this.negation();
      expr = new ASTNode({
        type: TokenType.AND,
        value: '∧',
        left: expr,
        right,
      });
    }
    return expr;
  }

  // Negation: ¬ (Prefix, right-associative: ¬¬p == ¬(¬p))
  negation() {
    if (this.match(TokenType.NOT)) {
      const right = this.negation();
      return new ASTNode({
        type: TokenType.NOT,
        value: '¬',
        left: right, // Unary child stored in left
      });
    }
    return this.primary();
  }

  // Primary: VAR, CONST, '(' Expression ')'
  primary() {
    if (this.match(TokenType.CONST)) {
      return new ASTNode({
        type: TokenType.CONST,
        value: this.previous().value,
      });
    }

    if (this.match(TokenType.VAR)) {
      return new ASTNode({
        type: TokenType.VAR,
        value: this.previous().value,
      });
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, 'Thiếu dấu đóng ngoặc ")"');
      return expr;
    }

    const token = this.peek();
    if (!token) {
      throw new Error('Biểu thức kết thúc đột ngột, thiếu toán hạng hoặc biến.');
    }
    throw new Error(`Toán hạng không hợp lệ: "${token.text}" tại vị trí ${token.pos + 1}`);
  }
}

/**
 * Extracts sorted unique variable names from AST.
 * @param {ASTNode} root
 * @returns {string[]}
 */
export function extractVariables(root) {
  const vars = new Set();
  function traverse(node) {
    if (!node) return;
    if (node.type === TokenType.VAR) {
      vars.add(node.value);
    }
    traverse(node.left);
    traverse(node.right);
  }
  traverse(root);
  return Array.from(vars).sort((a, b) => a.localeCompare(b));
}

/**
 * Collects subexpressions in post-order (bottom-up execution order)
 * excluding single variables/constants.
 * @param {ASTNode} root
 * @returns {Array<ASTNode>}
 */
export function collectSubexpressions(root) {
  const seenTexts = new Set();
  const subexpressions = [];

  function traverse(node) {
    if (!node) return;
    if (node.type === TokenType.VAR || node.type === TokenType.CONST) return;

    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);

    if (!seenTexts.has(node.text)) {
      seenTexts.add(node.text);
      subexpressions.push(node);
    }
  }

  traverse(root);
  return subexpressions;
}

/**
 * Convenience helper to parse expression string directly.
 * @param {string} text
 * @returns {ASTNode}
 */
export function parseLogicExpression(text) {
  const parser = new LogicParser(text);
  return parser.parse();
}
