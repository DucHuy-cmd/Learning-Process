/**
 * @file RandomLogicGenerator.js
 * Headless Generator for Random Propositional Logic Expressions.
 * 
 * Supports generating:
 * - Arbitrary random formulas with controllable variable count and depth
 * - Tautologies (Hằng đúng)
 * - Contradictions (Hằng sai)
 * - Contingencies (Tiếp liên / Thỏa được)
 * - Equivalence pairs (Cặp bài tập kiểm tra tương đương)
 */

import { parseLogicExpression } from './LogicParser.js';
import { generateTruthTable, checkEquivalence } from './TruthTableEngine.js';

const OPERATORS_BINARY = ['∧', '∨', '→', '↔', '⊕'];
const VAR_POOL = ['p', 'q', 'r', 's', 't'];

/**
 * Picks a random item from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds a random syntax tree string.
 * @param {string[]} vars
 * @param {number} depth
 * @returns {string}
 */
function buildRandomTree(vars, depth) {
  if (depth <= 1 || (depth === 2 && Math.random() < 0.3)) {
    const v = pick(vars);
    return Math.random() < 0.35 ? `¬${v}` : v;
  }

  const op = pick(OPERATORS_BINARY);
  const left = buildRandomTree(vars, depth - 1);
  const right = buildRandomTree(vars, depth - 1);

  const unary = Math.random() < 0.25;
  const expr = `(${left} ${op} ${right})`;
  return unary ? `¬${expr}` : expr;
}

/**
 * Generates a random propositional logic expression tailored by constraints.
 * 
 * @param {Object} [options]
 * @param {number} [options.variableCount=3] - Between 2 and 4
 * @param {'random'|'tautology'|'contradiction'|'contingency'} [options.type='random']
 * @param {'simple'|'medium'|'complex'} [options.complexity='medium']
 * @returns {{ expression: string, type: string, variables: string[], info: string }}
 */
export function generateRandomProposition(options = {}) {
  const {
    variableCount = 3,
    type = 'random',
    complexity = 'medium',
  } = options;

  const n = Math.max(2, Math.min(4, variableCount));
  const activeVars = VAR_POOL.slice(0, n);

  let targetDepth = 2;
  if (complexity === 'medium') targetDepth = 3;
  if (complexity === 'complex') targetDepth = 4;

  // Curated templates for guaranteed tautologies and contradictions
  const tautologyTemplates = [
    // Modus Ponens variant
    (vars) => `((${vars[0]} → ${vars[1]}) ∧ ${vars[0]}) → ${vars[1]}`,
    // Hypothetical Syllogism
    (vars) => vars.length >= 3
      ? `((${vars[0]} → ${vars[1]}) ∧ (${vars[1]} → ${vars[2]})) → (${vars[0]} → ${vars[2]})`
      : `((${vars[0]} → ${vars[1]}) ∧ ${vars[0]}) → ${vars[1]}`,
    // De Morgan equivalence
    (vars) => `¬(${vars[0]} ∧ ${vars[1]}) ↔ (¬${vars[0]} ∨ ¬${vars[1]})`,
    // Law of excluded middle
    (vars) => `${vars[0]} ∨ ¬${vars[0]}`,
    // Implication definition equivalence
    (vars) => `(${vars[0]} → ${vars[1]}) ↔ (¬${vars[0]} ∨ ${vars[1]})`,
    // Contrapositive equivalence
    (vars) => `(${vars[0]} → ${vars[1]}) ↔ (¬${vars[1]} → ¬${vars[0]})`,
    // Double negation
    (vars) => `¬¬${vars[0]} ↔ ${vars[0]}`,
  ];

  const contradictionTemplates = [
    (vars) => `${vars[0]} ∧ ¬${vars[0]}`,
    (vars) => `(${vars[0]} ↔ ${vars[1]}) ∧ (${vars[0]} ⊕ ${vars[1]})`,
    (vars) => `(${vars[0]} → ${vars[1]}) ∧ ${vars[0]} ∧ ¬${vars[1]}`,
    (vars) => vars.length >= 3
      ? `((${vars[0]} ∨ ${vars[1]}) → ${vars[2]}) ∧ ${vars[0]} ∧ ¬${vars[2]}`
      : `(${vars[0]} ∨ ${vars[1]}) ∧ ¬${vars[0]} ∧ ¬${vars[1]}`,
  ];

  const circuitTemplates2 = [
    (v) => `${v[0]} ⊕ ${v[1]}`,
    (v) => `(${v[0]} ∧ ¬${v[1]}) ∨ (¬${v[0]} ∧ ${v[1]})`,
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (¬${v[0]} ∧ ¬${v[1]})`,
    (v) => `${v[0]} ∧ ¬${v[1]}`,
    (v) => `¬${v[0]} ∨ ¬${v[1]}`,
    (v) => `(${v[0]} ∨ ${v[1]}) ∧ ¬(${v[0]} ∧ ${v[1]})`,
  ];

  const circuitTemplates3 = [
    // Majority voter (Hàm biểu quyết số đông)
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (${v[1]} ∧ ${v[2]}) ∨ (${v[0]} ∧ ${v[2]})`,
    // Multiplexer 2-to-1 MUX
    (v) => `(¬${v[2]} ∧ ${v[0]}) ∨ (${v[2]} ∧ ${v[1]})`,
    // Chained SOP
    (v) => `(${v[0]} ∧ ¬${v[1]}) ∨ (${v[1]} ∧ ${v[2]})`,
    (v) => `(${v[0]} ∧ ${v[1]} ∧ ¬${v[2]}) ∨ (¬${v[0]} ∧ ${v[2]})`,
    (v) => `(${v[0]} ⊕ ${v[1]}) ∧ ${v[2]}`,
    (v) => `(${v[0]} ∧ ¬${v[1]} ∧ ${v[2]}) ∨ (¬${v[0]} ∧ ${v[1]} ∧ ¬${v[2]})`,
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (¬${v[0]} ∧ ¬${v[1]} ∧ ${v[2]})`,
    (v) => `(${v[0]} ∨ ${v[1]}) ∧ (¬${v[1]} ∨ ${v[2]})`,
    (v) => `(${v[0]} ∧ ¬${v[1]}) ∨ (${v[1]} ∧ ¬${v[2]}) ∨ (¬${v[0]} ∧ ${v[2]})`,
    (v) => `(¬${v[0]} ∧ ${v[1]}) ∨ (${v[0]} ∧ ${v[2]})`,
  ];

  const circuitTemplates4 = [
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (${v[2]} ∧ ${v[3]})`,
    (v) => `(${v[0]} ∧ ¬${v[1]}) ∨ (${v[2]} ∧ ¬${v[3]})`,
    (v) => `(${v[0]} ∧ ${v[1]} ∧ ${v[2]}) ∨ (¬${v[2]} ∧ ${v[3]})`,
    (v) => `(¬${v[0]} ∧ ¬${v[1]} ∧ ¬${v[2]} ∧ ¬${v[3]}) ∨ (${v[0]} ∧ ¬${v[1]} ∧ ¬${v[2]} ∧ ¬${v[3]}) ∨ (¬${v[0]} ∧ ¬${v[1]} ∧ ${v[2]} ∧ ¬${v[3]}) ∨ (${v[0]} ∧ ¬${v[1]} ∧ ${v[2]} ∧ ¬${v[3]})`,
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (${v[1]} ∧ ${v[2]}) ∨ (${v[2]} ∧ ${v[3]})`,
    (v) => `(¬${v[0]} ∧ ${v[1]} ∧ ${v[2]}) ∨ (${v[0]} ∧ ¬${v[1]} ∧ ${v[3]}) ∨ (${v[2]} ∧ ${v[3]})`,
    (v) => `(${v[0]} ∧ ¬${v[1]} ∧ ${v[2]}) ∨ (${v[1]} ∧ ¬${v[3]}) ∨ (¬${v[0]} ∧ ${v[3]})`,
    (v) => `(${v[0]} ∧ ${v[1]}) ∨ (¬${v[1]} ∧ ${v[2]}) ∨ (${v[2]} ∧ ¬${v[3]})`,
  ];

  if (type === 'circuit') {
    let pool = circuitTemplates3;
    if (n === 2) pool = circuitTemplates2;
    else if (n === 4) pool = circuitTemplates4;
    const tmpl = pick(pool);
    const expression = tmpl(activeVars);
    return {
      expression,
      type: 'circuit',
      variables: activeVars,
      info: 'Mạch logic tổ hợp tối ưu (AND-OR-XOR-MUX)',
    };
  }

  if (type === 'tautology') {
    const tmpl = pick(tautologyTemplates);
    const expression = tmpl(activeVars);
    return {
      expression,
      type: 'tautology',
      variables: activeVars,
      info: 'Biểu thức hằng đúng (Tautology) ngẫu nhiên',
    };
  }

  if (type === 'contradiction') {
    const tmpl = pick(contradictionTemplates);
    const expression = tmpl(activeVars);
    return {
      expression,
      type: 'contradiction',
      variables: activeVars,
      info: 'Biểu thức hằng sai (Contradiction) ngẫu nhiên',
    };
  }

  // Generate and filter for contingency or general random
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = buildRandomTree(activeVars, targetDepth);
    try {
      const table = generateTruthTable(candidate);
      if (type === 'contingency') {
        if (table.stats.isContingency) {
          return {
            expression: candidate,
            type: 'contingency',
            variables: table.variables,
            info: `Biểu thức thỏa được (${table.stats.trueCount} Đúng, ${table.stats.falseCount} Sai)`,
          };
        }
      } else {
        if (table.variables.length >= Math.min(2, n) || attempt >= 20) {
          return {
            expression: candidate,
            type: table.stats.isTautology ? 'tautology' : (table.stats.isContradiction ? 'contradiction' : 'contingency'),
            variables: table.variables,
            info: 'Biểu thức logic ngẫu nhiên',
          };
        }
      }
    } catch {
      // Retry if syntax build edge issue
    }
  }

  // Fallback if loop didn't match specific contingency
  const fallback = `(${activeVars[0]} ∧ ${activeVars[1]}) → ${activeVars[0]}`;
  return {
    expression: fallback,
    type: 'random',
    variables: activeVars,
    info: 'Biểu thức logic ngẫu nhiên',
  };
}

/**
 * Generates an equivalence pair of expressions for practice.
 * @param {number} [variableCount=2]
 * @returns {{ expr1: string, expr2: string, isEquivalent: boolean, explanation: string }}
 */
export function generateEquivalencePracticePair(variableCount = 2) {
  const vars = VAR_POOL.slice(0, Math.max(2, Math.min(3, variableCount)));
  const pairs = [
    {
      expr1: `¬(${vars[0]} ∧ ${vars[1]})`,
      expr2: `¬${vars[0]} ∨ ¬${vars[1]}`,
      isEquivalent: true,
      explanation: 'Luật De Morgan: Phủ định của hội bằng tuyển các phủ định.',
    },
    {
      expr1: `${vars[0]} → ${vars[1]}`,
      expr2: `¬${vars[0]} ∨ ${vars[1]}`,
      isEquivalent: true,
      explanation: 'Quy tắc kéo theo biểu diễn qua phép tuyển.',
    },
    {
      expr1: `${vars[0]} → ${vars[1]}`,
      expr2: `¬${vars[1]} → ¬${vars[0]}`,
      isEquivalent: true,
      explanation: 'Luật phản đảo: p → q ≡ ¬q → ¬p.',
    },
    {
      expr1: `${vars[0]} ↔ ${vars[1]}`,
      expr2: `(${vars[0]} → ${vars[1]}) ∧ (${vars[1]} → ${vars[0]})`,
      isEquivalent: true,
      explanation: 'Định nghĩa phép tương đương qua hai phép kéo theo.',
    },
    {
      expr1: `${vars[0]} ⊕ ${vars[1]}`,
      expr2: `(${vars[0]} ∨ ${vars[1]}) ∧ ¬(${vars[0]} ∧ ${vars[1]})`,
      isEquivalent: true,
      explanation: 'Định nghĩa phép XOR: hoặc p hoặc q đúng nhưng không đồng thời cả hai.',
    },
    // Non-equivalent distraction pairs for practice
    {
      expr1: `${vars[0]} → ${vars[1]}`,
      expr2: `${vars[1]} → ${vars[0]}`,
      isEquivalent: false,
      explanation: 'Mệnh đề thuận và mệnh đề đảo không tương đương nhau (p → q ≢ q → p).',
    },
    {
      expr1: `¬(${vars[0]} ∧ ${vars[1]})`,
      expr2: `¬${vars[0]} ∧ ¬${vars[1]}`,
      isEquivalent: false,
      explanation: 'Lỗi thường gặp: áp dụng sai luật De Morgan (phải đổi dấu ∧ thành ∨).',
    },
    {
      expr1: `${vars[0]} ∨ (${vars[0]} ∧ ${vars[1]})`,
      expr2: `${vars[1]}`,
      isEquivalent: false,
      explanation: 'Luật hấp thụ p ∨ (p ∧ q) ≡ p chứ không phải q.',
    },
  ];

  return pick(pairs);
}
