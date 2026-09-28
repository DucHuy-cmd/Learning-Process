/**
 * @file MappingEngine.js
 * Core Mathematical Engine for Set Mappings & Functions (Ánh Xạ & Hàm Số)
 * 
 * Provides rigorous verification and combinatorial counting for:
 * - Function validity (Định nghĩa hàm số / ánh xạ)
 * - Injective check (Đơn ánh: x1 ≠ x2 => f(x1) ≠ f(x2))
 * - Surjective check (Toàn ánh: Im(f) = Y)
 * - Bijective check (Song ánh: Đơn ánh + Toàn ánh)
 * - Inverse function calculation (Hàm ngược f⁻¹)
 * - Theoretical counting formulas (|Y|^|X|, A_n^m, n!, Stirling/Inclusion-Exclusion)
 */

export function factorial(n) {
  if (n < 0) return 0;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export function permutation(n, k) {
  if (k < 0 || k > n) return 0;
  let res = 1;
  for (let i = 0; i < k; i++) {
    res *= (n - i);
  }
  return res;
}

export function combination(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kMin = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= kMin; i++) {
    num *= (n - i + 1);
    den *= i;
  }
  return Math.round(num / den);
}

/**
 * Counts total surjective functions from domain of size m to codomain of size n.
 * Formula: Sum_{k=0}^{n} (-1)^k * C(n, k) * (n - k)^m
 * @param {number} m - Domain size (|X|)
 * @param {number} n - Codomain size (|Y|)
 * @returns {number}
 */
export function countSurjective(m, n) {
  if (m < n || n <= 0) return m === 0 && n === 0 ? 1 : 0;
  let sum = 0;
  for (let k = 0; k <= n; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const term = sign * combination(n, k) * Math.pow(n - k, m);
    sum += term;
  }
  return Math.max(0, Math.round(sum));
}

/**
 * Standard Educational Presets for Class Demonstrations
 */
export const MAPPING_PRESETS = [
  {
    id: 'bijective_33',
    title: '👑 Song ánh mẫu (|X| = |Y| = 3)',
    description: 'Mỗi phần tử nguồn nối đúng 1 ảnh đích, không trùng lặp và không bỏ sót.',
    domain: ['x₁', 'x₂', 'x₃'],
    codomain: ['y₁', 'y₂', 'y₃'],
    edges: [
      { from: 'x₁', to: 'y₂' },
      { from: 'x₂', to: 'y₁' },
      { from: 'x₃', to: 'y₃' },
    ],
  },
  {
    id: 'injective_not_surjective',
    title: '🎯 Đơn ánh nhưng KHÔNG toàn ánh (|X|=2, |Y|=3)',
    description: 'Không có 2 phần tử nào trùng ảnh, nhưng phần tử y₃ bị bỏ rơi.',
    domain: ['x₁', 'x₂'],
    codomain: ['y₁', 'y₂', 'y₃'],
    edges: [
      { from: 'x₁', to: 'y₁' },
      { from: 'x₂', to: 'y₂' },
    ],
  },
  {
    id: 'surjective_not_injective',
    title: '🌐 Toàn ánh nhưng KHÔNG đơn ánh (|X|=4, |Y|=2)',
    description: 'Phủ kín tập đích, nhưng có phần tử đích nhận nhiều mũi tên.',
    domain: ['x₁', 'x₂', 'x₃', 'x₄'],
    codomain: ['y₁', 'y₂'],
    edges: [
      { from: 'x₁', to: 'y₁' },
      { from: 'x₂', to: 'y₁' },
      { from: 'x₃', to: 'y₂' },
      { from: 'x₄', to: 'y₂' },
    ],
  },
  {
    id: 'constant_function',
    title: '📌 Hàm hằng (Tất cả ánh xạ về 1 điểm)',
    description: 'Mọi x đều gán cho y₁, không đơn ánh và không toàn ánh.',
    domain: ['x₁', 'x₂', 'x₃'],
    codomain: ['y₁', 'y₂', 'y₃'],
    edges: [
      { from: 'x₁', to: 'y₁' },
      { from: 'x₂', to: 'y₁' },
      { from: 'x₃', to: 'y₁' },
    ],
  },
  {
    id: 'not_a_function_multi',
    title: '❌ Vi phạm: 1 phần tử bắn ra 2 ảnh',
    description: 'Phần tử x₁ ánh xạ tới cả y₁ và y₂ => Không phải hàm số.',
    domain: ['x₁', 'x₂', 'x₃'],
    codomain: ['y₁', 'y₂', 'y₃'],
    edges: [
      { from: 'x₁', to: 'y₁' },
      { from: 'x₁', to: 'y₂' },
      { from: 'x₂', to: 'y₂' },
      { from: 'x₃', to: 'y₃' },
    ],
  },
  {
    id: 'not_a_function_missing',
    title: '❌ Vi phạm: Bỏ rơi phần tử nguồn',
    description: 'Phần tử x₃ không có ảnh nào trong tập đích => Không phải hàm số toàn phần.',
    domain: ['x₁', 'x₂', 'x₃'],
    codomain: ['y₁', 'y₂', 'y₃'],
    edges: [
      { from: 'x₁', to: 'y₁' },
      { from: 'x₂', to: 'y₂' },
    ],
  },
];

/**
 * Analyzes a mapping configuration between Domain X and Codomain Y.
 * @param {Object} options
 * @param {string[]} options.domain - List of element keys in X
 * @param {string[]} options.codomain - List of element keys in Y
 * @param {Array<{from: string, to: string}>} options.edges - List of directed assignments
 * @returns {Object} Full analysis result
 */
export function evaluateMapping({ domain = [], codomain = [], edges = [] } = {}) {
  const m = domain.length;
  const n = codomain.length;

  // Build lookup maps
  const targets = {};
  domain.forEach(x => {
    targets[x] = [];
  });

  const preimages = {};
  codomain.forEach(y => {
    preimages[y] = [];
  });

  // Track valid edges and filter out any orphaned edges
  const validEdges = [];
  edges.forEach(e => {
    if (targets[e.from] && preimages[e.to]) {
      targets[e.from].push(e.to);
      preimages[e.to].push(e.from);
      validEdges.push({ from: e.from, to: e.to });
    }
  });

  // 1. Check Function Validity
  const unmappedElements = domain.filter(x => targets[x].length === 0);
  const multiMappedElements = domain.filter(x => targets[x].length > 1);
  const isFunction = unmappedElements.length === 0 && multiMappedElements.length === 0;

  const functionViolations = [];
  if (unmappedElements.length > 0) {
    functionViolations.push(`Phần tử nguồn {${unmappedElements.join(', ')}} chưa được gán ảnh trong tập đích Y.`);
  }
  if (multiMappedElements.length > 0) {
    multiMappedElements.forEach(x => {
      functionViolations.push(`Phần tử nguồn "${x}" có ${targets[x].length} ảnh khác nhau: {${targets[x].join(', ')}} (vi phạm tính duy nhất của hàm số).`);
    });
  }

  // 2. Check Injective (Đơn ánh)
  // Condition: No target y has more than 1 preimage
  const duplicatedTargets = codomain.filter(y => preimages[y].length > 1);
  const isInjective = isFunction && duplicatedTargets.length === 0;

  const injectiveViolations = [];
  if (isFunction && !isInjective) {
    duplicatedTargets.forEach(y => {
      injectiveViolations.push(`Phần tử đích "${y}" nhận ${preimages[y].length} tạo ảnh: {${preimages[y].join(', ')}} (vi phạm f(x₁) ≠ f(x₂)).`);
    });
  }

  // 3. Check Surjective (Toàn ánh)
  // Condition: Every target y has at least 1 preimage
  const unhitTargets = codomain.filter(y => preimages[y].length === 0);
  const isSurjective = isFunction && unhitTargets.length === 0;

  const surjectiveViolations = [];
  if (isFunction && !isSurjective) {
    surjectiveViolations.push(`Các phần tử đích {${unhitTargets.join(', ')}} không có tạo ảnh nào (Im(f) ≠ Y).`);
  }

  // 4. Check Bijective (Song ánh)
  const isBijective = isFunction && isInjective && isSurjective;

  // 5. Inverse function (f⁻¹)
  let inverseEdges = null;
  if (isBijective) {
    inverseEdges = validEdges.map(e => ({ from: e.to, to: e.from }));
  }

  // 6. Range / Image Set
  const imageSet = codomain.filter(y => preimages[y].length > 0);

  // 7. Combinatorics Theoretical Counting
  const totalFunctions = Math.pow(n, m);
  const totalInjective = m <= n ? permutation(n, m) : 0;
  const totalBijective = m === n ? factorial(m) : 0;
  const totalSurjective = m >= n ? countSurjective(m, n) : 0;

  let dirichletNote = '';
  if (m > n) {
    dirichletNote = `Theo Nguyên lý Dirichlet: Vì |X| = ${m} > |Y| = ${n} (số chim > số chuồng), chắc chắn luôn tồn tại ít nhất 1 phần tử ở Y nhận ≥ 2 tạo ảnh => KHÔNG THỂ TỒN TẠI ĐƠN ÁNH!`;
  } else if (m < n) {
    dirichletNote = `Vì |X| = ${m} < |Y| = ${n}, số tạo ảnh không đủ để phủ kín tập đích => KHÔNG THỂ TỒN TẠI TOÀN ÁNH!`;
  } else {
    dirichletNote = `Vì |X| = |Y| = ${m}, hàm số là Đơn ánh khi và chỉ khi nó là Toàn ánh (tức là Song ánh)!`;
  }

  return {
    isFunction,
    functionViolations,
    isInjective,
    injectiveViolations,
    isSurjective,
    surjectiveViolations,
    isBijective,
    inverseEdges,
    imageSet,
    domainStats: {
      size: m,
      elements: domain,
    },
    codomainStats: {
      size: n,
      elements: codomain,
    },
    targets,
    preimages,
    duplicatedTargets,
    unhitTargets,
    unmappedElements,
    multiMappedElements,
    combinatorics: {
      totalFunctions,
      totalInjective,
      totalBijective,
      totalSurjective,
      dirichletNote,
    },
  };
}

/**
 * Generates random mapping according to requested type
 * @param {string[]} domain
 * @param {string[]} codomain
 * @param {'random' | 'injective' | 'surjective' | 'bijective'} type
 */
export function generateRandomMapping(domain, codomain, type = 'random') {
  const m = domain.length;
  const n = codomain.length;
  const edges = [];

  if (type === 'bijective' && m === n) {
    const shuffledCodomain = [...codomain].sort(() => Math.random() - 0.5);
    domain.forEach((x, i) => {
      edges.push({ from: x, to: shuffledCodomain[i] });
    });
    return edges;
  }

  if (type === 'injective' && m <= n) {
    const shuffledCodomain = [...codomain].sort(() => Math.random() - 0.5);
    domain.forEach((x, i) => {
      edges.push({ from: x, to: shuffledCodomain[i] });
    });
    return edges;
  }

  if (type === 'surjective' && m >= n) {
    // Ensure every y gets at least one x
    const shuffledDomain = [...domain].sort(() => Math.random() - 0.5);
    codomain.forEach((y, i) => {
      edges.push({ from: shuffledDomain[i], to: y });
    });
    // Assign the remaining domain elements randomly
    for (let i = n; i < m; i++) {
      const randomY = codomain[Math.floor(Math.random() * n)];
      edges.push({ from: shuffledDomain[i], to: randomY });
    }
    return edges;
  }

  // Default: Random valid function
  domain.forEach(x => {
    const randomY = codomain[Math.floor(Math.random() * n)];
    edges.push({ from: x, to: randomY });
  });

  return edges;
}
