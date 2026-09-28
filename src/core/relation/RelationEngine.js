/**
 * @file RelationEngine.js
 * Core Mathematical Engine for Binary Relations (Toán Rời Rạc - Chương 4: Quan Hệ)
 * 
 * Provides algorithms, data models, and matrix-graph representations for:
 * - Elements set A = {e_1, e_2, ..., e_n} (n in [2, 6])
 * - Boolean relation matrix M_R of size n x n
 * - Bi-directional conversion between Matrix, Pair set R, and Directed Graph
 * - Presets for classic discrete math relations (Divisibility, Order, Congruence, Partitions)
 * - Boolean matrix operations (Transpose, Boolean Product, Union, Intersection)
 * - Smooth geometric calculations for SVG Graph rendering (Self-loops, Curved bidirectional arrows)
 * - In-degree and Out-degree metrics for vertices
 */

/**
 * Creates an empty n x n Boolean matrix (all 0s).
 * @param {number} n
 * @returns {number[][]}
 */
export function createEmptyMatrix(n) {
  const m = [];
  for (let i = 0; i < n; i++) {
    m.push(new Array(n).fill(0));
  }
  return m;
}

/**
 * Deep clones a 2D matrix.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

/**
 * Converts a Boolean matrix to an array of relation pairs.
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {Array<{ from: string, to: string, i: number, j: number }>}
 */
export function matrixToPairs(matrix, elements) {
  const pairs = [];
  const n = elements.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i] && matrix[i][j] === 1) {
        pairs.push({
          from: elements[i],
          to: elements[j],
          i,
          j,
        });
      }
    }
  }
  return pairs;
}

/**
 * Converts an array of pairs to an n x n Boolean matrix.
 * @param {Array<{ from: string, to: string }>} pairs
 * @param {string[]} elements
 * @returns {number[][]}
 */
export function pairsToMatrix(pairs, elements) {
  const n = elements.length;
  const matrix = createEmptyMatrix(n);
  const elMap = new Map();
  elements.forEach((el, idx) => elMap.set(String(el), idx));

  pairs.forEach(p => {
    const i = elMap.get(String(p.from));
    const j = elMap.get(String(p.to));
    if (i !== undefined && j !== undefined) {
      matrix[i][j] = 1;
    }
  });

  return matrix;
}

/**
 * Computes transpose matrix M^T (corresponds to inverse relation R^-1).
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function transposeMatrix(matrix) {
  const n = matrix.length;
  const res = createEmptyMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      res[j][i] = matrix[i][j];
    }
  }
  return res;
}

/**
 * Computes Boolean matrix product: P = M1 ⊙ M2.
 * P[i][j] = OR_k (M1[i][k] AND M2[k][j])
 * @param {number[][]} m1
 * @param {number[][]} m2
 * @returns {number[][]}
 */
export function booleanMatrixProduct(m1, m2) {
  const n = m1.length;
  const res = createEmptyMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let val = 0;
      for (let k = 0; k < n; k++) {
        if (m1[i][k] === 1 && m2[k][j] === 1) {
          val = 1;
          break;
        }
      }
      res[i][j] = val;
    }
  }
  return res;
}

/**
 * Computes Boolean matrix union (M1 OR M2).
 * @param {number[][]} m1
 * @param {number[][]} m2
 * @returns {number[][]}
 */
export function booleanMatrixUnion(m1, m2) {
  const n = m1.length;
  const res = createEmptyMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      res[i][j] = (m1[i][j] === 1 || m2[i][j] === 1) ? 1 : 0;
    }
  }
  return res;
}

/**
 * Computes Boolean matrix intersection (M1 AND M2).
 * @param {number[][]} m1
 * @param {number[][]} m2
 * @returns {number[][]}
 */
export function booleanMatrixIntersection(m1, m2) {
  const n = m1.length;
  const res = createEmptyMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      res[i][j] = (m1[i][j] === 1 && m2[i][j] === 1) ? 1 : 0;
    }
  }
  return res;
}

/**
 * Computes in-degree and out-degree for each element.
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {Array<{ element: string, inDegree: number, outDegree: number, hasSelfLoop: boolean }>}
 */
export function computeDegrees(matrix, elements) {
  const n = elements.length;
  return elements.map((el, i) => {
    let outDegree = 0;
    let inDegree = 0;
    for (let j = 0; j < n; j++) {
      if (matrix[i] && matrix[i][j] === 1) outDegree++;
      if (matrix[j] && matrix[j][i] === 1) inDegree++;
    }
    return {
      element: el,
      inDegree,
      outDegree,
      hasSelfLoop: matrix[i] && matrix[i][i] === 1,
    };
  });
}

/**
 * Computes circular positions for nodes in SVG canvas.
 * @param {string[]} elements
 * @param {number} [width=500]
 * @param {number} [height=380]
 * @param {number} [radius=130]
 * @returns {Record<string, { x: number, y: number, index: number, angle: number }>}
 */
export function computeCircleLayout(elements, width = 500, height = 380, radius = 130) {
  const n = elements.length;
  const cx = width / 2;
  const cy = height / 2;
  const positions = {};

  elements.forEach((el, i) => {
    // Start at top (12 o'clock: -PI/2) and progress clockwise
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const x = Math.round(cx + radius * Math.cos(angle));
    const y = Math.round(cy + radius * Math.sin(angle));
    positions[el] = { x, y, index: i, angle };
  });

  return positions;
}

/**
 * Computes geometric SVG path for an edge.
 * - Handles Self-loop (curved arc/loop pointing radially outwards)
 * - Handles Straight line (when unidirectional)
 * - Handles Curved Bézier (when bidirectional to avoid collision)
 * 
 * @param {{ x: number, y: number, angle?: number }} src
 * @param {{ x: number, y: number, angle?: number }} tgt
 * @param {boolean} isSelfLoop
 * @param {boolean} isBidirectional
 * @param {number} [nodeRadius=22]
 * @param {number} [cx=250]
 * @param {number} [cy=190]
 * @returns {string} SVG path d attribute
 */
export function computeEdgePath(src, tgt, isSelfLoop, isBidirectional, nodeRadius = 22, cx = 250, cy = 190) {
  if (isSelfLoop) {
    // Outward radial direction from center
    const dx = src.x - cx;
    const dy = src.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    
    // Perpendicular vector
    const px = -uy;
    const py = ux;

    // Loop base points on node border
    const p1x = src.x + ux * (nodeRadius * 0.7) - px * (nodeRadius * 0.7);
    const p1y = src.y + uy * (nodeRadius * 0.7) - py * (nodeRadius * 0.7);

    const p2x = src.x + ux * (nodeRadius * 0.7) + px * (nodeRadius * 0.7);
    const p2y = src.y + uy * (nodeRadius * 0.7) + py * (nodeRadius * 0.7);

    // Control points extending outwards
    const loopDistance = 56;
    const spread = 30;
    const c1x = p1x + ux * loopDistance - px * spread;
    const c1y = p1y + uy * loopDistance - py * spread;
    const c2x = p2x + ux * loopDistance + px * spread;
    const c2y = p2y + uy * loopDistance + py * spread;

    return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
  }

  // Edge between distinct nodes
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const startX = src.x + ux * nodeRadius;
  const startY = src.y + uy * nodeRadius;
  const endX = tgt.x - ux * (nodeRadius + 4);
  const endY = tgt.y - uy * (nodeRadius + 4);

  if (isBidirectional) {
    // Curve rightward from perspective of direction
    const nx = -uy;
    const ny = ux;
    const curvature = 24;
    const midX = (startX + endX) / 2 + nx * curvature;
    const midY = (startY + endY) / 2 + ny * curvature;

    return `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  }

  // Straight line
  return `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`;
}

/**
 * Standard Presets for Classic Relations in Discrete Mathematics
 */
export const RELATION_PRESETS = [
  {
    id: 'divisibility',
    title: '➗ Quan hệ chia hết (a | b) trên {1, 2, 3, 4, 6}',
    description: 'a R b khi và chỉ khi b chia hết cho a (b % a == 0). Đây là ví dụ kinh điển của Quan hệ Thứ tự bộ phận (POSET).',
    elements: ['1', '2', '3', '4', '6'],
    buildMatrix: () => {
      const els = [1, 2, 3, 4, 6];
      const m = createEmptyMatrix(5);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (els[j] % els[i] === 0) m[i][j] = 1;
        }
      }
      return m;
    }
  },
  {
    id: 'less_equal',
    title: '📉 Quan hệ nhỏ hơn hoặc bằng (a ≤ b) trên {1, 2, 3, 4}',
    description: 'Mọi phần tử đều tự nhỏ hơn hoặc bằng chính nó (phản xạ), bắc cầu, và phản xứng.',
    elements: ['1', '2', '3', '4'],
    buildMatrix: () => {
      const els = [1, 2, 3, 4];
      const m = createEmptyMatrix(4);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          if (els[i] <= els[j]) m[i][j] = 1;
        }
      }
      return m;
    }
  },
  {
    id: 'congruence_mod3',
    title: '🔱 Quan hệ đồng dư modulo 3 (a ≡ b mod 3) trên {1, 2, 3, 4, 5, 6}',
    description: 'a R b khi (a - b) chia hết cho 3. Phân hoạch tập A thành 3 lớp tương đương: {1, 4}, {2, 5}, {3, 6}.',
    elements: ['1', '2', '3', '4', '5', '6'],
    buildMatrix: () => {
      const els = [1, 2, 3, 4, 5, 6];
      const m = createEmptyMatrix(6);
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          if (Math.abs(els[i] - els[j]) % 3 === 0) m[i][j] = 1;
        }
      }
      return m;
    }
  },
  {
    id: 'equivalence_sample',
    title: '👑 Quan hệ tương đương mẫu (2 Lớp tương đương) trên {1, 2, 3, 4}',
    description: 'Phân hoạch thành 2 cụm độc lập {1, 2} và {3, 4}. Ma trận gồm 2 khối vuông 1 trên đường chéo.',
    elements: ['1', '2', '3', '4'],
    buildMatrix: () => {
      return [
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
        [0, 0, 1, 1]
      ];
    }
  },
  {
    id: 'strictly_less',
    title: '⚡ Quan hệ nhỏ hơn nghiêm ngặt (a < b) trên {1, 2, 3, 4}',
    description: 'Không phản xạ (đường chéo bằng 0), phản xứng, và bắc cầu.',
    elements: ['1', '2', '3', '4'],
    buildMatrix: () => {
      const els = [1, 2, 3, 4];
      const m = createEmptyMatrix(4);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          if (els[i] < els[j]) m[i][j] = 1;
        }
      }
      return m;
    }
  },
  {
    id: 'directed_cycle',
    title: '🔄 Vòng lặp định hướng (1 ➔ 2 ➔ 3 ➔ 4 ➔ 1)',
    description: 'Chu trình có hướng đơn giản: 1➔2, 2➔3, 3➔4, 4➔1. Rất thích hợp để thử nghiệm thuật toán Warshall!',
    elements: ['1', '2', '3', '4'],
    buildMatrix: () => {
      return [
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
        [1, 0, 0, 0]
      ];
    }
  }
];

// =========================================================================
// PROPERTY CHECKING & CLASSIFICATION (CHAPTER 4 - TAB 2)
// =========================================================================

/**
 * Checks Reflexivity (Tính phản xạ).
 * Formula: ∀x ∈ A, (x, x) ∈ R <=> ∀i, M[i][i] = 1
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   isReflexive: boolean,
 *   isIrreflexive: boolean,
 *   selfLoopCount: number,
 *   totalElements: number,
 *   missingLoops: Array<{ element: string, index: number }>,
 *   ratio: number
 * }}
 */
export function checkReflexive(matrix, elements) {
  const n = elements.length;
  let selfLoopCount = 0;
  const missingLoops = [];

  for (let i = 0; i < n; i++) {
    if (matrix[i] && matrix[i][i] === 1) {
      selfLoopCount++;
    } else {
      missingLoops.push({ element: elements[i], index: i });
    }
  }

  return {
    isReflexive: selfLoopCount === n,
    isIrreflexive: selfLoopCount === 0,
    selfLoopCount,
    totalElements: n,
    missingLoops,
    ratio: n > 0 ? selfLoopCount / n : 0,
  };
}

/**
 * Checks Symmetry (Tính đối xứng).
 * Formula: ∀x, y ∈ A, (x, y) ∈ R => (y, x) ∈ R <=> M = M^T
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   isSymmetric: boolean,
 *   violations: Array<{ from: string, to: string, i: number, j: number }>,
 *   missingPairs: Array<{ from: string, to: string, i: number, j: number }>
 * }}
 */
export function checkSymmetric(matrix, elements) {
  const n = elements.length;
  const violations = [];
  const missingPairs = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const mij = matrix[i] ? matrix[i][j] : 0;
      const mji = matrix[j] ? matrix[j][i] : 0;
      if (mij === 1 && mji !== 1) {
        violations.push({ from: elements[i], to: elements[j], i, j });
        missingPairs.push({ from: elements[j], to: elements[i], i: j, j: i });
      }
    }
  }

  return {
    isSymmetric: violations.length === 0,
    violations,
    missingPairs,
  };
}

/**
 * Checks Antisymmetry (Tính phản xứng).
 * Formula: ∀x, y ∈ A, ((x, y) ∈ R ∧ (y, x) ∈ R) => x = y
 * <=> ∀i ≠ j, ¬(M[i][j] = 1 ∧ M[j][i] = 1)
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   isAntisymmetric: boolean,
 *   violations: Array<{ a: string, b: string, i: number, j: number }>
 * }}
 */
export function checkAntisymmetric(matrix, elements) {
  const n = elements.length;
  const violations = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const mij = matrix[i] ? matrix[i][j] : 0;
      const mji = matrix[j] ? matrix[j][i] : 0;
      if (mij === 1 && mji === 1) {
        violations.push({ a: elements[i], b: elements[j], i, j });
      }
    }
  }

  return {
    isAntisymmetric: violations.length === 0,
    violations,
  };
}

/**
 * Checks Transitivity (Tính bắc cầu).
 * Formula: ∀x, y, z ∈ A, ((x, y) ∈ R ∧ (y, z) ∈ R) => (x, z) ∈ R
 * <=> M ⊙ M ≤ M
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   isTransitive: boolean,
 *   violations: Array<{ x: string, y: string, z: string, i: number, j: number, k: number, missingPair: { from: string, to: string, i: number, k: number } }>
 * }}
 */
export function checkTransitive(matrix, elements) {
  const n = elements.length;
  const violations = [];
  const missingPairsMap = new Map();

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i] && matrix[i][j] === 1) {
        for (let k = 0; k < n; k++) {
          const mjk = matrix[j] ? matrix[j][k] : 0;
          const mik = matrix[i] ? matrix[i][k] : 0;
          if (mjk === 1 && mik !== 1) {
            const pairKey = `${i}_${k}`;
            if (!missingPairsMap.has(pairKey)) {
              missingPairsMap.set(pairKey, { from: elements[i], to: elements[k], i, k });
            }
            violations.push({
              x: elements[i],
              y: elements[j],
              z: elements[k],
              i,
              j,
              k,
              missingPair: { from: elements[i], to: elements[k], i, k }
            });
          }
        }
      }
    }
  }

  return {
    isTransitive: violations.length === 0,
    violations,
    uniqueMissingPairs: Array.from(missingPairsMap.values()),
  };
}

/**
 * Checks Comparability for Total Order (Tính so sánh được).
 * ∀x ≠ y, (x, y) ∈ R ∨ (y, x) ∈ R
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{ isComparable: boolean, incomparablePairs: Array<{ a: string, b: string }> }}
 */
export function checkComparable(matrix, elements) {
  const n = elements.length;
  const incomparablePairs = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j] !== 1 && matrix[j][i] !== 1) {
        incomparablePairs.push({ a: elements[i], b: elements[j] });
      }
    }
  }

  return {
    isComparable: incomparablePairs.length === 0,
    incomparablePairs,
  };
}

/**
 * Comprehensive Relation Classification.
 * Evaluates Equivalence, Partial Order (POSET), Total Order, Strict Order, Tolerance, etc.
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   reflexive: ReturnType<typeof checkReflexive>,
 *   symmetric: ReturnType<typeof checkSymmetric>,
 *   antisymmetric: ReturnType<typeof checkAntisymmetric>,
 *   transitive: ReturnType<typeof checkTransitive>,
 *   comparable: ReturnType<typeof checkComparable>,
 *   isEquivalence: boolean,
 *   isPartialOrder: boolean,
 *   isTotalOrder: boolean,
 *   isStrictOrder: boolean,
 *   isTolerance: boolean,
 *   title: string,
 *   typeKey: string,
 *   badgeColor: string,
 *   icon: string,
 *   description: string
 * }}
 */
export function classifyRelation(matrix, elements) {
  const reflexive = checkReflexive(matrix, elements);
  const symmetric = checkSymmetric(matrix, elements);
  const antisymmetric = checkAntisymmetric(matrix, elements);
  const transitive = checkTransitive(matrix, elements);
  const comparable = checkComparable(matrix, elements);

  const isEquivalence = reflexive.isReflexive && symmetric.isSymmetric && transitive.isTransitive;
  const isPartialOrder = reflexive.isReflexive && antisymmetric.isAntisymmetric && transitive.isTransitive;
  const isTotalOrder = isPartialOrder && comparable.isComparable;
  const isStrictOrder = reflexive.isIrreflexive && antisymmetric.isAntisymmetric && transitive.isTransitive;
  const isTolerance = reflexive.isReflexive && symmetric.isSymmetric && !transitive.isTransitive;

  let title = 'Quan hệ Tiêu chuẩn (General Binary Relation)';
  let typeKey = 'general';
  let badgeColor = '#64748b';
  let icon = '🔗';
  let description = 'Quan hệ không thỏa mãn các bộ tính chất đặc biệt như Tương đương hay Thứ tự.';

  if (isEquivalence) {
    title = 'Quan hệ Tương đương (Equivalence Relation)';
    typeKey = 'equivalence';
    badgeColor = '#10b981';
    icon = '👑';
    description = 'Thỏa mãn đồng thời 3 tính chất: Phản xạ, Đối xứng và Bắc cầu. Quan hệ này phân hoạch tập hợp A thành các lớp tương đương rời nhau.';
  } else if (isTotalOrder) {
    title = 'Quan hệ Thứ tự Toàn phần (Total / Linear Order)';
    typeKey = 'total_order';
    badgeColor = '#0284c7';
    icon = '📏';
    description = 'Là Thứ tự bộ phận (Phản xạ, Phản xứng, Bắc cầu) và mọi cặp phần tử đều so sánh được với nhau (x R y hoặc y R x). Biểu đồ Hasse là một chuỗi đường thẳng duy nhất.';
  } else if (isPartialOrder) {
    title = 'Quan hệ Thứ tự Bộ phận (Partial Order / POSET)';
    typeKey = 'partial_order';
    badgeColor = '#3b82f6';
    icon = '📐';
    description = 'Thỏa mãn 3 tính chất: Phản xạ, Phản xứng và Bắc cầu. Cho phép dựng Biểu đồ Hasse trực quan.';
  } else if (isStrictOrder) {
    title = 'Quan hệ Thứ tự Nghiêm ngặt (Strict Partial Order)';
    typeKey = 'strict_order';
    badgeColor = '#a855f7';
    icon = '⚡';
    description = 'Không phản xạ (mọi khuyên = 0), Phản xứng và Bắc cầu (ví dụ: quan hệ nhỏ hơn <).';
  } else if (isTolerance) {
    title = 'Quan hệ Tương thích / Dung sai (Tolerance Relation)';
    typeKey = 'tolerance';
    badgeColor = '#f59e0b';
    icon = '🤝';
    description = 'Thỏa mãn Phản xạ và Đối xứng nhưng KHÔNG có tính bắc cầu.';
  }

  return {
    reflexive,
    symmetric,
    antisymmetric,
    transitive,
    comparable,
    isEquivalence,
    isPartialOrder,
    isTotalOrder,
    isStrictOrder,
    isTolerance,
    title,
    typeKey,
    badgeColor,
    icon,
    description,
  };
}

// =========================================================================
// QUICK REPAIR TRANSFORMATIONS
// =========================================================================

/**
 * Computes Transitive Closure using Roy-Warshall algorithm.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function computeTransitiveClosure(matrix) {
  const n = matrix.length;
  const res = cloneMatrix(matrix);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        res[i][j] = res[i][j] || (res[i][k] && res[k][j]) ? 1 : 0;
      }
    }
  }
  return res;
}

/**
 * Makes matrix reflexive by setting all diagonal cells to 1.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makeReflexive(matrix) {
  const n = matrix.length;
  const res = cloneMatrix(matrix);
  for (let i = 0; i < n; i++) {
    res[i][i] = 1;
  }
  return res;
}

/**
 * Makes matrix irreflexive by clearing all diagonal cells to 0.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makeIrreflexive(matrix) {
  const n = matrix.length;
  const res = cloneMatrix(matrix);
  for (let i = 0; i < n; i++) {
    res[i][i] = 0;
  }
  return res;
}

/**
 * Makes matrix symmetric by computing M ∨ M^T.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makeSymmetric(matrix) {
  const n = matrix.length;
  const res = cloneMatrix(matrix);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i][j] === 1) {
        res[j][i] = 1;
      }
    }
  }
  return res;
}

/**
 * Makes matrix antisymmetric by eliminating reverse edges between distinct vertices.
 * If both (i, j) and (j, i) are 1 with i ≠ j, keeps (min(i,j), max(i,j)) and clears reverse.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makeAntisymmetric(matrix) {
  const n = matrix.length;
  const res = cloneMatrix(matrix);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (res[i][j] === 1 && res[j][i] === 1) {
        res[j][i] = 0; // eliminate one direction
      }
    }
  }
  return res;
}

/**
 * Computes Reflexive Closure r(R) = R ∪ Δ (M ∨ I_n).
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function computeReflexiveClosure(matrix) {
  return makeReflexive(matrix);
}

/**
 * Computes Symmetric Closure s(R) = R ∪ R^-1 (M ∨ M^T).
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function computeSymmetricClosure(matrix) {
  return makeSymmetric(matrix);
}

/**
 * Executes Roy-Warshall algorithm step-by-step and records comprehensive step metadata.
 * 
 * At step k (1-indexed, pivot node v_{k-1}):
 * W_k[i][j] = W_{k-1}[i][j] ∨ (W_{k-1}[i][k-1] ∧ W_{k-1}[k-1][j])
 * 
 * @param {number[][]} matrix - Initial matrix M_R
 * @param {string[]} elements - Node labels
 * @returns {{
 *   initialMatrix: number[][],
 *   steps: Array<{
 *     stepIndex: number,
 *     pivotElement: string | null,
 *     pivotIndex: number,
 *     matrix: number[][],
 *     newEdges: Array<{ from: string, to: string, i: number, j: number }>,
 *     inNodes: Array<{ element: string, index: number }>,
 *     outNodes: Array<{ element: string, index: number }>,
 *     explanation: string
 *   }>,
 *   finalMatrix: number[][],
 *   totalNewEdges: number
 * }}
 */
export function runWarshallAlgorithm(matrix, elements) {
  const n = elements.length;
  let currentW = cloneMatrix(matrix);
  const steps = [];
  let totalNewEdges = 0;

  // Step 0: Initial state W0 = M_R
  steps.push({
    stepIndex: 0,
    pivotElement: null,
    pivotIndex: -1,
    matrix: cloneMatrix(currentW),
    newEdges: [],
    inNodes: [],
    outNodes: [],
    explanation: 'Khởi tạo ma trận ban đầu W₀ = M_R. Chưa xét đỉnh trung gian nào.',
  });

  // Steps 1 to n
  for (let k = 0; k < n; k++) {
    const pivot = elements[k];
    const nextW = cloneMatrix(currentW);
    const newEdges = [];

    // In-nodes to pivot: indices i where currentW[i][k] === 1
    const inNodes = [];
    for (let i = 0; i < n; i++) {
      if (currentW[i][k] === 1) {
        inNodes.push({ element: elements[i], index: i });
      }
    }

    // Out-nodes from pivot: indices j where currentW[k][j] === 1
    const outNodes = [];
    for (let j = 0; j < n; j++) {
      if (currentW[k][j] === 1) {
        outNodes.push({ element: elements[j], index: j });
      }
    }

    // Pair up inNodes and outNodes
    for (const inNode of inNodes) {
      for (const outNode of outNodes) {
        const i = inNode.index;
        const j = outNode.index;
        if (currentW[i][j] === 0) {
          nextW[i][j] = 1;
          newEdges.push({
            from: inNode.element,
            to: outNode.element,
            i,
            j,
          });
        }
      }
    }

    totalNewEdges += newEdges.length;

    let explanation = `Bước k = ${k + 1}: Xét đỉnh trung gian v_${k + 1} = '${pivot}'.\n`;
    if (inNodes.length === 0) {
      explanation += `• Cột '${pivot}' không có ô số 1 nào (không có đỉnh nào đi tới '${pivot}').\n• Không có cạnh mới được sinh ra ở bước này.`;
    } else if (outNodes.length === 0) {
      explanation += `• Hàng '${pivot}' không có ô số 1 nào ('${pivot}' không đi tới đỉnh nào).\n• Không có cạnh mới được sinh ra ở bước này.`;
    } else {
      explanation += `• Các đỉnh đi tới '${pivot}' (Cột ${pivot}): {${inNodes.map(x => x.element).join(', ')}}.\n`;
      explanation += `• Các đỉnh '${pivot}' đi tới (Hàng ${pivot}): {${outNodes.map(x => x.element).join(', ')}}.\n`;
      if (newEdges.length > 0) {
        explanation += `• Bổ sung ${newEdges.length} cung mới qua đỉnh trung gian '${pivot}': ${newEdges.map(e => `(${e.from}, ${e.to})`).join(', ')}.`;
      } else {
        explanation += `• Tất cả các đường đi gián tiếp qua '${pivot}' đã tồn tại sẵn trong W_${k}. Không có cung mới.`;
      }
    }

    steps.push({
      stepIndex: k + 1,
      pivotElement: pivot,
      pivotIndex: k,
      matrix: cloneMatrix(nextW),
      newEdges,
      inNodes,
      outNodes,
      explanation,
    });

    currentW = nextW;
  }

  return {
    initialMatrix: cloneMatrix(matrix),
    steps,
    finalMatrix: currentW,
    totalNewEdges,
  };
}

// =========================================================================
// EQUIVALENCE CLASSES & HASSE DIAGRAM (CHAPTER 4 - TAB 4)
// =========================================================================

/**
 * Computes Equivalence Classes and Quotient Set A/R.
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   isEquivalence: boolean,
 *   classes: string[][],
 *   quotientSetString: string,
 *   representatives: Array<{ representative: string, members: string[] }>,
 *   count: number
 * }}
 */
export function computeEquivalenceClasses(matrix, elements) {
  const n = elements.length;
  const reflexive = checkReflexive(matrix, elements);
  const symmetric = checkSymmetric(matrix, elements);
  const transitive = checkTransitive(matrix, elements);
  const isEquivalence = reflexive.isReflexive && symmetric.isSymmetric && transitive.isTransitive;

  const visited = new Array(n).fill(false);
  const classes = [];
  const representatives = [];

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const cluster = [];
      const queue = [i];
      visited[i] = true;

      while (queue.length > 0) {
        const curr = queue.shift();
        cluster.push(elements[curr]);

        for (let j = 0; j < n; j++) {
          const edgeExists = (matrix[curr] && matrix[curr][j] === 1) || (matrix[j] && matrix[j][curr] === 1);
          if (edgeExists && !visited[j]) {
            visited[j] = true;
            queue.push(j);
          }
        }
      }

      cluster.sort();
      classes.push(cluster);
      representatives.push({
        representative: cluster[0],
        members: cluster,
      });
    }
  }

  const quotientSetString = `{ ${classes.map(c => `{${c.join(', ')}}`).join(', ')} }`;

  return {
    isEquivalence,
    classes,
    quotientSetString,
    representatives,
    count: classes.length,
  };
}

/**
 * Computes Covering Relation for POSET (Quan hệ phủ trực tiếp x ≺ y).
 * x ≺ y <=> x < y ∧ ¬∃z: (x < z < y)
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {Array<{ from: string, to: string, fromIdx: number, toIdx: number }>}
 */
export function computeCoveringRelation(matrix, elements) {
  const n = elements.length;
  const coveringEdges = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[i] && matrix[i][j] === 1) {
        let isCovering = true;
        for (let k = 0; k < n; k++) {
          if (k !== i && k !== j && matrix[i] && matrix[i][k] === 1 && matrix[k] && matrix[k][j] === 1) {
            isCovering = false;
            break;
          }
        }
        if (isCovering) {
          coveringEdges.push({
            from: elements[i],
            to: elements[j],
            fromIdx: i,
            toIdx: j,
          });
        }
      }
    }
  }

  return coveringEdges;
}

/**
 * Computes Extreme Elements in POSET:
 * - Minimal elements (Phần tử tối tiểu)
 * - Maximal elements (Phần tử tối đại)
 * - Least element (Phần tử bé nhất)
 * - Greatest element (Phần tử lớn nhất)
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @returns {{
 *   minimal: string[],
 *   maximal: string[],
 *   least: string | null,
 *   greatest: string | null
 * }}
 */
export function computePosetExtremes(matrix, elements) {
  const n = elements.length;
  const minimal = [];
  const maximal = [];

  for (let i = 0; i < n; i++) {
    let hasPredecessor = false;
    for (let j = 0; j < n; j++) {
      if (j !== i && matrix[j] && matrix[j][i] === 1) {
        hasPredecessor = true;
        break;
      }
    }
    if (!hasPredecessor) minimal.push(elements[i]);

    let hasSuccessor = false;
    for (let j = 0; j < n; j++) {
      if (j !== i && matrix[i] && matrix[i][j] === 1) {
        hasSuccessor = true;
        break;
      }
    }
    if (!hasSuccessor) maximal.push(elements[i]);
  }

  let least = null;
  if (minimal.length === 1) {
    const minIdx = elements.indexOf(minimal[0]);
    const precedesAll = elements.every((_, j) => matrix[minIdx] && matrix[minIdx][j] === 1);
    if (precedesAll) least = minimal[0];
  }

  let greatest = null;
  if (maximal.length === 1) {
    const maxIdx = elements.indexOf(maximal[0]);
    const succeededByAll = elements.every((_, j) => matrix[j] && matrix[j][maxIdx] === 1);
    if (succeededByAll) greatest = maximal[0];
  }

  return {
    minimal,
    maximal,
    least,
    greatest,
  };
}

/**
 * Computes Layout for Hasse Diagram with Topological Level Assignment.
 * 
 * @param {number[][]} matrix
 * @param {string[]} elements
 * @param {number} [width=500]
 * @param {number} [height=360]
 * @returns {{
 *   positions: Record<string, { x: number, y: number, level: number, index: number }>,
 *   coveringEdges: ReturnType<typeof computeCoveringRelation>,
 *   extremes: ReturnType<typeof computePosetExtremes>,
 *   maxLevel: number
 * }}
 */
export function computeHasseLayout(matrix, elements, width = 500, height = 360) {
  const n = elements.length;
  const coveringEdges = computeCoveringRelation(matrix, elements);
  const extremes = computePosetExtremes(matrix, elements);

  const levels = new Array(n).fill(0);
  for (let pass = 0; pass < n; pass++) {
    for (const edge of coveringEdges) {
      if (levels[edge.toIdx] < levels[edge.fromIdx] + 1) {
        levels[edge.toIdx] = levels[edge.fromIdx] + 1;
      }
    }
  }

  const maxLevel = Math.max(...levels, 0);
  const levelBuckets = {};
  for (let l = 0; l <= maxLevel; l++) levelBuckets[l] = [];
  elements.forEach((el, i) => {
    levelBuckets[levels[i]].push({ el, idx: i });
  });

  const ySpan = height - 100;
  const positions = {};
  for (let l = 0; l <= maxLevel; l++) {
    const bucket = levelBuckets[l];
    const y = maxLevel === 0 ? height / 2 : (height - 50) - (l / maxLevel) * ySpan;
    const count = bucket.length;
    bucket.forEach((item, k) => {
      const x = (width * (k + 1)) / (count + 1);
      positions[item.el] = {
        x: Math.round(x),
        y: Math.round(y),
        level: l,
        index: item.idx,
      };
    });
  }

  return {
    positions,
    coveringEdges,
    extremes,
    maxLevel,
  };
}

/**
 * Creates an Equivalence Closure: t(s(r(M))).
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makeEquivalenceClosure(matrix) {
  return computeTransitiveClosure(makeSymmetric(makeReflexive(matrix)));
}

/**
 * Creates a POSET Closure: ensures reflexivity, eliminates 2-cycles, and closes transitively.
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
export function makePosetClosure(matrix) {
  let res = makeReflexive(matrix);
  res = computeTransitiveClosure(res);
  res = makeAntisymmetric(res);
  res = computeTransitiveClosure(res);
  return res;
}



