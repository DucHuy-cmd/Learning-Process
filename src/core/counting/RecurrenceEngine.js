/**
 * @file RecurrenceEngine.js
 * Core Mathematical Engine for Linear Recurrence Relations & Tower of Hanoi
 * 
 * Provides algorithms and analytical solvers for:
 * - Order 1 Linear Recurrences: a_n = c * a_{n-1} => a_n = a_0 * c^n
 * - Order 2 Homogeneous Linear Recurrences: a_n = c_1 * a_{n-1} + c_2 * a_{n-2}
 *   * Characteristic equation: r^2 - c_1*r - c_2 = 0
 *   * Case 1: Delta > 0 (Distinct real roots r_1 != r_2)
 *   * Case 2: Delta = 0 (Double real root r_0)
 *   * Case 3: Delta < 0 (Complex conjugate roots)
 * - Closed-form formula derivation and initial condition solving (alpha_1, alpha_2)
 * - Sequence generation and table of values
 * - Recursive Tower of Hanoi move sequence generator (T_n = 2^n - 1)
 * - Curated discrete math presets (Fibonacci, Lucas, Double-root, Geometric)
 */

/**
 * Solves Order 1 linear homogeneous recurrence: a_n = c * a_{n-1}, a_0 given.
 * @param {number} c
 * @param {number} a0
 * @param {number} [numTerms=10]
 * @returns {Object}
 */
export function solveOrder1Linear(c, a0, numTerms = 10) {
  const terms = [];
  let current = a0;
  for (let n = 0; n <= numTerms; n++) {
    terms.push({ n, val: a0 * Math.pow(c, n) });
  }

  const closedForm = `a_n = ${a0} × (${c})ⁿ`;
  const explanation = `• Phương trình đặc trưng: r - ${c} = 0 ⟹ Nghiệm đặc trưng: r = ${c}.
• Dạng nghiệm tổng quát: a_n = α × (${c})ⁿ.
• Thay điều kiện ban đầu n = 0: a_0 = α × (${c})⁰ = α ⟹ α = ${a0}.
• Công thức nghiệm đóng: a_n = ${a0} × (${c})ⁿ.`;

  return {
    order: 1,
    c,
    a0,
    root: c,
    closedForm,
    explanation,
    terms,
  };
}

/**
 * Solves Order 2 linear homogeneous recurrence: a_n = c_1 * a_{n-1} + c_2 * a_{n-2}, with a_0, a_1 given.
 * Char eq: r^2 - c_1 * r - c_2 = 0.
 * @param {number} c1
 * @param {number} c2
 * @param {number} a0
 * @param {number} a1
 * @param {number} [numTerms=12]
 * @returns {Object}
 */
export function solveOrder2Homogeneous(c1, c2, a0, a1, numTerms = 12) {
  // Char equation: r^2 - c1 * r - c2 = 0
  const delta = c1 * c1 + 4 * c2;
  const terms = [];

  // Generate sequence directly by recurrence relation
  const rawTerms = [a0, a1];
  for (let i = 2; i <= numTerms; i++) {
    rawTerms.push(c1 * rawTerms[i - 1] + c2 * rawTerms[i - 2]);
  }
  for (let i = 0; i <= numTerms; i++) {
    terms.push({ n: i, val: rawTerms[i] });
  }

  const formatNum = (num) => {
    if (Math.abs(num - Math.round(num)) < 1e-6) return String(Math.round(num));
    return num.toFixed(3);
  };

  let rootType = '';
  let r1 = null;
  let r2 = null;
  let alpha1 = null;
  let alpha2 = null;
  let closedForm = '';
  let explanation = '';

  // Helper to format clean characteristic equation: r² - c1*r - c2 = 0
  const c1Term = c1 === 1 ? '- r' : (c1 === -1 ? '+ r' : (c1 > 0 ? `- ${formatNum(c1)}r` : (c1 < 0 ? `+ ${formatNum(-c1)}r` : '')));
  const c2Term = c2 > 0 ? `- ${formatNum(c2)}` : (c2 < 0 ? `+ ${formatNum(-c2)}` : '');
  const charEqStr = `r² ${c1Term} ${c2Term} = 0`.replace(/\s+/g, ' ');

  if (delta > 0) {
    rootType = 'distinct_real';
    r1 = (c1 + Math.sqrt(delta)) / 2;
    r2 = (c1 - Math.sqrt(delta)) / 2;

    // Solve system:
    // alpha1 + alpha2 = a0
    // alpha1 * r1 + alpha2 * r2 = a1
    alpha1 = (a1 - a0 * r2) / (r1 - r2);
    alpha2 = a0 - alpha1;

    const secondTermSign = alpha2 < 0 ? '-' : '+';
    const secondTermVal = formatNum(Math.abs(alpha2));
    closedForm = `a_n = ${formatNum(alpha1)} × (${formatNum(r1)})ⁿ ${secondTermSign} ${secondTermVal} × (${formatNum(r2)})ⁿ`;

    explanation = `1. Phương trình đặc trưng:
   ${charEqStr}
2. Biệt thức Δ = (${c1})² - 4 × 1 × (${-c2}) = ${formatNum(delta)} > 0.
   ⟹ Phương trình có 2 nghiệm thực phân biệt:
   r₁ = ${formatNum(r1)},  r₂ = ${formatNum(r2)}
3. Dạng nghiệm tổng quát:
   a_n = α₁ × (${formatNum(r1)})ⁿ + α₂ × (${formatNum(r2)})ⁿ
4. Xác định hệ số α₁, α₂ từ điều kiện ban đầu:
   • n = 0: α₁ + α₂ = ${a0}
   • n = 1: α₁ × (${formatNum(r1)}) + α₂ × (${formatNum(r2)}) = ${a1}
   ⟹ α₁ = ${formatNum(alpha1)},  α₂ = ${formatNum(alpha2)}
5. Nghiệm đóng của hệ thức:
   ${closedForm}`;
  } else if (Math.abs(delta) < 1e-9) {
    rootType = 'double_real';
    r1 = c1 / 2;
    r2 = r1;

    alpha1 = a0;
    if (Math.abs(r1) > 1e-9) {
      alpha2 = (a1 / r1) - a0;
    } else {
      alpha2 = 0;
    }

    const nSign = alpha2 < 0 ? '-' : '+';
    const nCoeff = formatNum(Math.abs(alpha2));
    const innerBracket = alpha2 === 0 ? formatNum(alpha1) : `${formatNum(alpha1)} ${nSign} ${nCoeff}n`;
    closedForm = `a_n = (${innerBracket}) × (${formatNum(r1)})ⁿ`;

    explanation = `1. Phương trình đặc trưng:
   ${charEqStr}
2. Biệt thức Δ = 0.
   ⟹ Phương trình có nghiệm kép: r₀ = ${formatNum(r1)}
3. Dạng nghiệm tổng quát:
   a_n = (α₁ + α₂n) × (${formatNum(r1)})ⁿ
4. Xác định hệ số α₁, α₂:
   • n = 0: α₁ = ${a0}
   • n = 1: (α₁ + α₂) × (${formatNum(r1)}) = ${a1} ⟹ α₂ = ${formatNum(alpha2)}
5. Nghiệm đóng của hệ thức:
   ${closedForm}`;
  } else {
    rootType = 'complex';
    // delta < 0
    const realPart = c1 / 2;
    const imagPart = Math.sqrt(-delta) / 2;
    const rho = Math.sqrt(realPart * realPart + imagPart * imagPart);
    const theta = Math.atan2(imagPart, realPart);

    alpha1 = a0;
    alpha2 = Math.sin(theta) !== 0 ? (a1 / rho - a0 * Math.cos(theta)) / Math.sin(theta) : 0;

    closedForm = `a_n = (${formatNum(rho)})ⁿ × [${formatNum(alpha1)} cos(${formatNum(theta)}n) + ${formatNum(alpha2)} sin(${formatNum(theta)}n)]`;

    explanation = `1. Phương trình đặc trưng:
   r² - (${c1})r - (${c2}) = 0
2. Biệt thức Δ = ${formatNum(delta)} < 0.
   ⟹ Hai nghiệm phức liên hợp: r = ${formatNum(realPart)} ± ${formatNum(imagPart)}i
   Dạng lượng giác: r = ρ(cos θ ± i sin θ) với ρ = ${formatNum(rho)}, θ ≈ ${formatNum(theta)} rad.
3. Nghiệm đóng tổng quát:
   ${closedForm}`;
  }

  return {
    order: 2,
    c1,
    c2,
    a0,
    a1,
    delta,
    rootType,
    r1,
    r2,
    alpha1,
    alpha2,
    closedForm,
    explanation,
    terms,
  };
}

/**
 * Standard Presets for Classic Discrete Math Recurrences
 */
export const RECURRENCE_PRESETS = [
  {
    id: 'fibonacci',
    title: '🌿 Dãy Fibonacci kinh điển (F_n = F_{n-1} + F_{n-2})',
    description: 'F_0 = 0, F_1 = 1. Nghiệm liên quan đến Tỷ lệ vàng φ ≈ 1.618 (Công thức Binet).',
    c1: 1,
    c2: 1,
    a0: 0,
    a1: 1,
  },
  {
    id: 'lucas',
    title: '🔱 Dãy Lucas (L_n = L_{n-1} + L_{n-2})',
    description: 'L_0 = 2, L_1 = 1. Cùng phương trình đặc trưng với Fibonacci nhưng điều kiện đầu khác.',
    c1: 1,
    c2: 1,
    a0: 2,
    a1: 1,
  },
  {
    id: 'distinct_roots',
    title: '🎯 Hai nghiệm thực phân biệt (a_n = 5a_{n-1} - 6a_{n-2})',
    description: 'r^2 - 5r + 6 = 0 có 2 nghiệm nguyên đẹp r_1 = 3, r_2 = 2.',
    c1: 5,
    c2: -6,
    a0: 1,
    a1: 4,
  },
  {
    id: 'double_root',
    title: '🔄 Nghiệm kép (a_n = 4a_{n-1} - 4a_{n-2})',
    description: 'r^2 - 4r + 4 = 0 có nghiệm kép r_0 = 2. Nghiệm có dạng (α_1 + α_2 n) * 2^n.',
    c1: 4,
    c2: -4,
    a0: 1,
    a1: 4,
  },
];

/**
 * Generates the full sequence of moves for Tower of Hanoi puzzle with n disks.
 * Recurrence: T_n = 2 * T_{n-1} + 1 => T_n = 2^n - 1.
 * @param {number} n - Number of disks (1 to 8)
 * @param {string} [source='A']
 * @param {string} [auxiliary='B']
 * @param {string} [destination='C']
 * @returns {Array<{disk: number, from: string, to: string, step: number}>}
 */
export function generateHanoiMoves(n, source = 'A', auxiliary = 'B', destination = 'C') {
  const safeN = Math.max(1, Math.min(8, Math.round(n)));
  const moves = [];
  let step = 1;

  function hanoi(disks, fromPeg, auxPeg, toPeg) {
    if (disks === 1) {
      moves.push({
        step: step++,
        disk: 1,
        from: fromPeg,
        to: toPeg,
      });
      return;
    }
    // Step 1: Move n-1 disks from source to auxiliary
    hanoi(disks - 1, fromPeg, toPeg, auxPeg);

    // Step 2: Move disk n from source to destination
    moves.push({
      step: step++,
      disk: disks,
      from: fromPeg,
      to: toPeg,
    });

    // Step 3: Move n-1 disks from auxiliary to destination
    hanoi(disks - 1, auxPeg, fromPeg, toPeg);
  }

  hanoi(safeN, source, auxiliary, destination);
  return moves;
}

/**
 * Reconstructs the state of the 3 pegs at a specific step in the Hanoi puzzle.
 * @param {number} n - Total disks
 * @param {number} targetStep - Target step index (0 = initial, up to 2^n - 1)
 * @param {Array<{disk: number, from: string, to: string, step: number}>} moves
 * @returns {Object} { A: number[], B: number[], C: number[] }
 */
export function getHanoiStateAtStep(n, targetStep, moves) {
  const safeN = Math.max(1, Math.min(8, Math.round(n)));
  // Initially, all disks on peg A in decreasing order from bottom [n, n-1, ..., 1]
  const pegs = {
    A: [],
    B: [],
    C: [],
  };
  for (let d = safeN; d >= 1; d--) {
    pegs.A.push(d);
  }

  const validStep = Math.max(0, Math.min(moves.length, targetStep));
  for (let i = 0; i < validStep; i++) {
    const m = moves[i];
    const disk = pegs[m.from].pop();
    pegs[m.to].push(disk);
  }

  return pegs;
}
