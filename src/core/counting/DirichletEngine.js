/**
 * @file DirichletEngine.js
 * Core Mathematical Engine for Dirichlet's Pigeonhole Principle (Nguyên lý Chuồng bồ câu)
 * 
 * Provides rigorous verification, bounds computation, distribution algorithms,
 * and solvers for classic Discrete Mathematics pigeonhole problems:
 * - Basic Pigeonhole Principle (N > k => ∃ box >= 2)
 * - Generalized Pigeonhole Principle (max >= ceil(N/k), min <= floor(N/k))
 * - Even distribution (worst-case anti-collision strategy)
 * - Random Monte-Carlo distribution
 * - Classic discrete math problem solvers (Birthdays, Socks, Exam grades, Erdős–Szekeres, Pair sums)
 */

/**
 * Calculates theoretical Dirichlet bounds for N items into k pigeonholes.
 * @param {number} N - Number of items / pigeons (N >= 0)
 * @param {number} k - Number of boxes / pigeonholes (k >= 1)
 * @returns {Object} Bounds and mathematical proof explanation
 */
export function calculateDirichletBounds(N, k) {
  if (k <= 0) {
    throw new Error('Số chuồng (k) phải lớn hơn hoặc bằng 1.');
  }
  const safeN = Math.max(0, Math.round(N));
  const safek = Math.max(1, Math.round(k));

  const ceilBound = Math.ceil(safeN / safek);
  const floorBound = Math.floor(safeN / safek);
  const isBasicApplicable = safeN > safek;

  let basicNote = '';
  if (isBasicApplicable) {
    basicNote = `Vì số vật N = ${safeN} > số hộp k = ${safek}, theo Nguyên lý Dirichlet cơ bản, chắc chắn tồn tại ít nhất một hộp chứa từ 2 vật trở lên.`;
  } else if (safeN === safek) {
    basicNote = `Số vật N = ${safeN} bằng đúng số hộp k = ${safek}. Có thể xếp mỗi hộp đúng 1 vật (không có hộp nào từ 2 vật nếu xếp đều).`;
  } else {
    basicNote = `Số vật N = ${safeN} ít hơn số hộp k = ${safek}. Chắc chắn có ít nhất ${safek - safeN} hộp bị bỏ trống (0 vật).`;
  }

  const proofByContradiction = `Giả sử phản chứng: Mọi hộp đều chứa nhiều nhất (${ceilBound} - 1) vật.
Khi đó tổng số vật trong tất cả ${safek} hộp sẽ là:
Tổng ≤ ${safek} × (${ceilBound} - 1) = ${safek * (ceilBound - 1)} vật.
Vì ${ceilBound} = ⌈${safeN}/${safek}⌉, nên ${ceilBound} - 1 < ${safeN}/${safek}.
Suy ra: Tổng < ${safek} × (${safeN}/${safek}) = ${safeN}, mâu thuẫn với giả thiết có tất cả ${safeN} vật!
Vậy phải luôn tồn tại ít nhất một hộp chứa ít nhất ${ceilBound} vật (ĐPCM).`;

  return {
    N: safeN,
    k: safek,
    ceilBound,
    floorBound,
    isBasicApplicable,
    basicNote,
    proofByContradiction,
  };
}

/**
 * Distributes N items into k boxes as evenly as possible (Worst-case collision avoidance).
 * First (N % k) boxes get ceil(N / k), remainder get floor(N / k).
 * @param {number} N
 * @param {number} k
 * @returns {number[]} Array of counts for each box of length k
 */
export function distributeEvenly(N, k) {
  const safeN = Math.max(0, Math.round(N));
  const safek = Math.max(1, Math.round(k));

  const quotient = Math.floor(safeN / safek);
  const remainder = safeN % safek;

  const allocations = new Array(safek).fill(quotient);
  for (let i = 0; i < remainder; i++) {
    allocations[i] += 1;
  }
  return allocations;
}

/**
 * Distributes N items into k boxes randomly (Monte-Carlo simulation).
 * @param {number} N
 * @param {number} k
 * @returns {number[]} Array of counts for each box of length k
 */
export function distributeRandomly(N, k) {
  const safeN = Math.max(0, Math.round(N));
  const safek = Math.max(1, Math.round(k));

  const allocations = new Array(safek).fill(0);
  for (let i = 0; i < safeN; i++) {
    const randomBox = Math.floor(Math.random() * safek);
    allocations[randomBox]++;
  }
  return allocations;
}

/**
 * Analyzes any given allocation of items across k boxes against Dirichlet bounds.
 * @param {number[]} allocations - Item count per box
 * @param {number} [expectedN] - Optional total N to verify
 * @returns {Object} Analysis results
 */
export function evaluateDirichlet(allocations = [], expectedN = null) {
  const k = allocations.length;
  if (k === 0) {
    return {
      isValid: false,
      totalItems: 0,
      k: 0,
      ceilBound: 0,
      floorBound: 0,
      maxBox: 0,
      minBox: 0,
      maxBoxIndices: [],
      minBoxIndices: [],
      isDirichletSatisfied: false,
      summary: 'Chưa có chuồng nào được khởi tạo.',
    };
  }

  const totalItems = allocations.reduce((acc, count) => acc + (Math.max(0, count) || 0), 0);
  const safeExpectedN = expectedN !== null ? expectedN : totalItems;

  const ceilBound = Math.ceil(totalItems / k);
  const floorBound = Math.floor(totalItems / k);

  let maxBox = -Infinity;
  let minBox = Infinity;
  allocations.forEach(count => {
    if (count > maxBox) maxBox = count;
    if (count < minBox) minBox = count;
  });

  const maxBoxIndices = [];
  const minBoxIndices = [];
  allocations.forEach((count, idx) => {
    if (count === maxBox) maxBoxIndices.push(idx);
    if (count === minBox) minBoxIndices.push(idx);
  });

  // By Dirichlet's theorem, maxBox >= ceil(totalItems / k) is ALWAYS mathematically guaranteed
  const isDirichletSatisfied = maxBox >= ceilBound;

  const summary = `Có tổng cộng ${totalItems} vật phân bố vào ${k} hộp.
• Hộp chứa nhiều nhất có ${maxBox} vật (ở các hộp: #${maxBoxIndices.map(i => i + 1).join(', #')}).
• Giới hạn Dirichlet lý thuyết: ⌈${totalItems}/${k}⌉ = ${ceilBound}.
${isDirichletSatisfied 
    ? `=> Thỏa mãn định lý: Hộp nhiều nhất (${maxBox}) ≥ ⌈N/k⌉ (${ceilBound}).` 
    : '=> Bất thường trong phân bổ số liệu.'}`;

  return {
    isValid: true,
    totalItems,
    expectedN: safeExpectedN,
    k,
    allocations: [...allocations],
    ceilBound,
    floorBound,
    maxBox,
    minBox,
    maxBoxIndices,
    minBoxIndices,
    isDirichletSatisfied,
    summary,
  };
}

/**
 * Solves classic applied Dirichlet Pigeonhole problems.
 * @param {string} scenarioType - 'birthday' | 'socks' | 'exam_scores' | 'sum_pairs' | 'erdos_szekeres'
 * @param {Object} params
 */
export function solveDirichletScenario(scenarioType, params = {}) {
  switch (scenarioType) {
    case 'birthday': {
      // k = 12 months (or 7 days)
      const period = params.period === 'weekday' ? 7 : 12;
      const periodName = period === 7 ? 'thứ trong tuần' : 'tháng trong năm';
      const m = Math.max(1, params.targetSame || 2); // need at least m people with same birth month/day
      const minPeopleNeeded = period * (m - 1) + 1;

      // Given N people, guaranteed count:
      const givenN = params.givenPeople || minPeopleNeeded;
      const guaranteedSame = Math.ceil(givenN / period);

      return {
        title: `Bài toán Sinh nhật (${periodName})`,
        period,
        periodName,
        targetSame: m,
        minPeopleNeeded,
        givenN,
        guaranteedSame,
        formula: `N = ${period} × (${m} - 1) + 1 = ${minPeopleNeeded}`,
        explanation: `• Số chuồng (k): ${period} ${periodName}.
• Để chắc chắn có ít nhất ${m} người cùng ${periodName}, trường hợp xấu nhất là mỗi ${periodName} đã có đúng (${m} - 1) người sinh ra:
  Tổng người tối đa khi chưa đạt = ${period} × (${m} - 1) = ${period * (m - 1)} người.
• Chỉ cần thêm đúng 1 người nữa (${period * (m - 1) + 1} người), theo nguyên lý Dirichlet, người này chắc chắn phải rơi vào một ${periodName} đã có (${m} - 1) người, nâng tổng số người cùng ${periodName} lên ít nhất ${m} người!`,
      };
    }

    case 'socks': {
      // k colors of socks in dark drawer
      const kColors = Math.max(2, params.colors || 3);
      const mMatch = Math.max(2, params.targetMatch || 2); // e.g. 2 for 1 pair
      const minSocksNeeded = kColors * (mMatch - 1) + 1;

      return {
        title: 'Bài toán Rút tất trong bóng tối',
        kColors,
        mMatch,
        minSocksNeeded,
        formula: `N = ${kColors} × (${mMatch} - 1) + 1 = ${minSocksNeeded}`,
        explanation: `• Số chuồng (k): ${kColors} màu tất khác nhau trong tủ.
• Bạn muốn chắc chắn lấy được ít nhất ${mMatch} chiếc cùng màu.
• Trường hợp "xui xẻo" nhất (tránh đụng hàng tối đa): Bạn rút mỗi màu đúng (${mMatch} - 1) chiếc => tổng là ${kColors * (mMatch - 1)} chiếc.
• Chỉ cần rút thêm đúng 1 chiếc nữa (chiếc thứ ${minSocksNeeded}), theo Dirichlet, chiếc này chắc chắn phải trùng màu với một trong các nhóm trước => đảm bảo đủ ${mMatch} chiếc cùng màu!`,
      };
    }

    case 'exam_scores': {
      // Grade levels: 0 to 10 integer grades => k = 11 levels
      const minScore = params.minScore ?? 0;
      const maxScore = params.maxScore ?? 10;
      const kLevels = maxScore - minScore + 1;
      const mStudents = Math.max(2, params.targetSame || 3);
      const minStudentsNeeded = kLevels * (mStudents - 1) + 1;

      const classSize = params.classSize || minStudentsNeeded;
      const guaranteedSameScore = Math.ceil(classSize / kLevels);

      return {
        title: 'Bài toán Điểm thi Môn Toán rời rạc',
        kLevels,
        minScore,
        maxScore,
        mStudents,
        minStudentsNeeded,
        classSize,
        guaranteedSameScore,
        formula: `N = ${kLevels} × (${mStudents} - 1) + 1 = ${minStudentsNeeded}`,
        explanation: `• Thang điểm từ ${minScore} đến ${maxScore} tạo thành ${kLevels} mức điểm khác nhau (k = ${kLevels} chuồng).
• Để chắc chắn có ít nhất ${mStudents} sinh viên có cùng điểm thi:
  Cần tối thiểu: N = ${kLevels} × (${mStudents} - 1) + 1 = ${minStudentsNeeded} sinh viên.
• Nếu lớp học có ${classSize} sinh viên, theo Dirichlet chắc chắn luôn có ít nhất ⌈${classSize} / ${kLevels}⌉ = ${guaranteedSameScore} bạn đạt điểm số giống hệt nhau!`,
      };
    }

    case 'sum_pairs': {
      // Choose n + 1 numbers from set {1, 2, ..., 2n}
      const n = Math.max(2, params.n || 5);
      const targetSum = 2 * n + 1;
      const chosenCount = n + 1;

      const pairs = [];
      for (let i = 1; i <= n; i++) {
        pairs.push([i, targetSum - i]);
      }

      return {
        title: 'Bài toán Cặp số có tổng bằng 2n + 1',
        n,
        totalNumbers: 2 * n,
        targetSum,
        chosenCount,
        pairs,
        formula: `Chọn ${chosenCount} số từ ${2 * n} số phân vào ${n} cặp`,
        explanation: `• Tập số S = {1, 2, 3, ..., ${2 * n}} có ${2 * n} phần tử.
• Ta phân chia ${2 * n} số này thành đúng ${n} cặp (k = ${n} chuồng) sao cho mỗi cặp có tổng bằng ${targetSum}:
  ${pairs.map(p => `{${p[0]}, ${p[1]}}`).join(', ')}.
• Khi ta chọn bất kỳ ${chosenCount} số (N = ${n} + 1 vật) từ tập S:
  Vì N = ${chosenCount} > k = ${n}, theo Nguyên lý Dirichlet chắc chắn luôn tồn tại ít nhất 1 cặp chứa 2 số được chọn.
• Hai số cùng thuộc một cặp này hiển nhiên có tổng bằng đúng ${targetSum} (ĐPCM)!`,
      };
    }

    case 'erdos_szekeres': {
      // A sequence of n^2 + 1 distinct real numbers contains a monotonic subsequence of length n + 1
      const n = Math.max(2, params.n || 3);
      const totalLen = n * n + 1;
      const targetSubsequenceLen = n + 1;

      return {
        title: 'Định lý Erdős–Szekeres (Dãy con đơn điệu)',
        n,
        totalLen,
        targetSubsequenceLen,
        formula: `Dãy độ dài n² + 1 = ${totalLen} luôn chứa dãy tăng hoặc giảm độ dài n + 1 = ${targetSubsequenceLen}`,
        explanation: `• Định lý Erdős–Szekeres (1935): Mọi dãy gồm n² + 1 = ${totalLen} số thực phân biệt luôn chứa ít nhất một dãy con tăng độ dài ${targetSubsequenceLen} HOẶC một dãy con giảm độ dài ${targetSubsequenceLen}.
• Chứng minh bằng Dirichlet: Với mỗi phần tử a_i, gán nhãn (t_i, g_i) trong đó t_i là độ dài dãy con tăng dài nhất kết thúc tại a_i, g_i là độ dài dãy con giảm dài nhất kết thúc tại a_i.
• Nếu không có dãy tăng độ dài ${targetSubsequenceLen} và không có dãy giảm độ dài ${targetSubsequenceLen}, thì 1 ≤ t_i ≤ ${n} và 1 ≤ g_i ≤ ${n}.
• Chỉ có tối đa ${n} × ${n} = ${n * n} cặp nhãn khác nhau. Vì dãy có ${totalLen} phần tử (${totalLen} > ${n * n}), theo Dirichlet phải có 2 phần tử có cùng cặp nhãn (t, g), điều này mâu thuẫn vì các phần tử phân biệt!`,
      };
    }

    default:
      return null;
  }
}
