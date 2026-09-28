/**
 * @file TruthTableEngine.js
 * Headless Truth Table Generation, Normal Forms (DNF/CNF),
 * Semantic Classification, and Logic Equivalence Checker.
 */

import { parseLogicExpression, extractVariables, collectSubexpressions } from './LogicParser.js';

/**
 * Formats a boolean or number truth value according to the chosen style.
 * @param {boolean|number} val
 * @param {'binary'|'boolean'|'vietnamese'} [style='binary']
 * @returns {string}
 */
export function formatTruthValue(val, style = 'binary') {
  const isTrue = Boolean(val);
  switch (style) {
    case 'boolean':
      return isTrue ? 'T' : 'F';
    case 'vietnamese':
      return isTrue ? 'Đ' : 'S';
    case 'binary':
    default:
      return isTrue ? '1' : '0';
  }
}

/**
 * Generates truth table for a given propositional logic expression.
 * 
 * @param {string} expressionText
 * @param {Object} [options]
 * @param {boolean} [options.descendingOrder=true] - When true, starts from 1..1 down to 0..0
 * @param {'binary'|'boolean'|'vietnamese'} [options.valueStyle='binary']
 * @returns {Object} Truth table result model
 */
export function generateTruthTable(expressionText, options = {}) {
  const { descendingOrder = true, valueStyle = 'binary' } = options;

  const ast = parseLogicExpression(expressionText);
  const variables = extractVariables(ast);

  if (variables.length > 8) {
    throw new Error(`Biểu thức chứa ${variables.length} biến. Hệ thống hỗ trợ tối đa 8 biến (256 dòng) để đảm bảo hiệu năng.`);
  }

  const subexpressions = collectSubexpressions(ast);
  const n = variables.length;
  const totalRows = Math.pow(2, n);

  // Generate assignments (from 0 to 2^n - 1, reversed if descending)
  const rowIndices = [];
  for (let i = 0; i < totalRows; i++) {
    rowIndices.push(i);
  }
  if (descendingOrder) {
    rowIndices.reverse(); // Standard math textbook order: 111... down to 000...
  }

  const rows = [];
  let trueCount = 0;
  let falseCount = 0;

  for (let r = 0; r < totalRows; r++) {
    const bitVal = rowIndices[r];
    const assignment = {};

    for (let v = 0; v < n; v++) {
      const varName = variables[v];
      // bit at position (n - 1 - v)
      const bit = (bitVal >> (n - 1 - v)) & 1;
      assignment[varName] = bit === 1;
    }

    // Evaluate subexpressions
    const stepValues = subexpressions.map(sub => sub.evaluate(assignment));

    // Evaluate final AST root
    const finalValue = ast.evaluate(assignment);

    if (finalValue) {
      trueCount++;
    } else {
      falseCount++;
    }

    rows.push({
      rowIndex: r + 1,
      assignment,
      stepValues,
      finalValue,
    });
  }

  // Determine Semantic Classification
  const isTautology = trueCount === totalRows;
  const isContradiction = falseCount === totalRows;
  const isContingency = !isTautology && !isContradiction;

  let classification = 'Thỏa được (Contingency / Tiếp liên)';
  let classificationDetail = 'Biểu thức có cả trường hợp Đúng và Sai tùy thuộc vào chân trị của các biến.';
  if (isTautology) {
    classification = 'Hằng đúng (Tautology / Hằng chân)';
    classificationDetail = 'Biểu thức luôn nhận giá trị Đúng (1) trong mọi trường hợp.';
  } else if (isContradiction) {
    classification = 'Hằng sai (Contradiction / Mâu thuẫn)';
    classificationDetail = 'Biểu thức luôn nhận giá trị Sai (0) trong mọi trường hợp.';
  }

  // Calculate Normal Forms (DNF & CNF)
  const dnfMinterms = [];
  const cnfMaxterms = [];

  for (const row of rows) {
    const { assignment, finalValue } = row;

    if (finalValue) {
      // DNF Minterm: variable if true, ¬variable if false
      const mintermParts = variables.map(v => (assignment[v] ? v : `¬${v}`));
      dnfMinterms.push(mintermParts.length > 1 ? `(${mintermParts.join(' ∧ ')})` : mintermParts[0]);
    } else {
      // CNF Maxterm: ¬variable if true, variable if false
      const maxtermParts = variables.map(v => (assignment[v] ? `¬${v}` : v));
      cnfMaxterms.push(maxtermParts.length > 1 ? `(${maxtermParts.join(' ∨ ')})` : maxtermParts[0]);
    }
  }

  const dnf = dnfMinterms.length > 0 ? dnfMinterms.join(' ∨ ') : '0 (Mâu thuẫn)';
  const cnf = cnfMaxterms.length > 0 ? cnfMaxterms.join(' ∧ ') : '1 (Hằng đúng)';

  return {
    expression: expressionText,
    canonicalText: ast.text,
    variables,
    subexpressions: subexpressions.map(s => s.text),
    rows,
    stats: {
      totalVariables: n,
      totalRows,
      trueCount,
      falseCount,
      isTautology,
      isContradiction,
      isContingency,
      classification,
      classificationDetail,
    },
    normalForms: {
      dnf,
      cnf,
      mintermIndices: rows.filter(r => r.finalValue).map(r => r.rowIndex),
      maxtermIndices: rows.filter(r => !r.finalValue).map(r => r.rowIndex),
    },
    valueStyle,
  };
}

/**
 * Checks whether two propositional logic expressions are logically equivalent (A ≡ B).
 * 
 * @param {string} expr1Text
 * @param {string} expr2Text
 * @returns {Object} Equivalence result
 */
export function checkEquivalence(expr1Text, expr2Text) {
  const ast1 = parseLogicExpression(expr1Text);
  const ast2 = parseLogicExpression(expr2Text);

  const vars1 = extractVariables(ast1);
  const vars2 = extractVariables(ast2);

  const allVars = Array.from(new Set([...vars1, ...vars2])).sort((a, b) => a.localeCompare(b));

  if (allVars.length > 8) {
    throw new Error(`Tổng số biến của 2 biểu thức là ${allVars.length} biến (vượt quá giới hạn 8 biến).`);
  }

  const n = allVars.length;
  const totalRows = Math.pow(2, n);
  const rows = [];
  let isEquivalent = true;
  let counterexample = null;

  for (let r = 0; r < totalRows; r++) {
    const bitVal = totalRows - 1 - r; // 111.. to 000..
    const assignment = {};

    for (let v = 0; v < n; v++) {
      const varName = allVars[v];
      const bit = (bitVal >> (n - 1 - v)) & 1;
      assignment[varName] = bit === 1;
    }

    const val1 = ast1.evaluate(assignment);
    const val2 = ast2.evaluate(assignment);

    const matches = val1 === val2;
    if (!matches && isEquivalent) {
      isEquivalent = false;
      counterexample = {
        rowIndex: r + 1,
        assignment,
        val1,
        val2,
      };
    }

    rows.push({
      rowIndex: r + 1,
      assignment,
      val1,
      val2,
      matches,
    });
  }

  return {
    expr1: expr1Text,
    expr2: expr2Text,
    variables: allVars,
    isEquivalent,
    counterexample,
    rows,
    totalRows,
  };
}
