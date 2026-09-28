/**
 * @file CombinatoricsEngine.js
 * Core Mathematical Engine for Pascal's Triangle & Lexicographical Combinatorial Generation
 * 
 * Provides algorithms and calculations for:
 * - Pascal's Triangle computation and properties (Pascal identity, Sierpinski mod p coloring, row sums)
 * - Lexicographical permutation generator (Narayana Pandita's algorithm)
 * - Lexicographical combination generator (C(n, k))
 * - Lexicographical k-permutation / arrangement generator (A(n, k))
 * - Combinations with repetition (Stars and Bars / Euler candy distribution)
 * - Permutations with repetition (n^k)
 */

import { factorial, permutation, combination } from './MappingEngine.js';

/**
 * Builds Pascal's Triangle up to maxRow rows (0-indexed: row 0 to maxRow).
 * @param {number} maxRow - Maximum row index (e.g. 10)
 * @returns {number[][]} 2D array where triangle[n][k] = C(n, k)
 */
export function buildPascalTriangle(maxRow = 10) {
  const safeMax = Math.max(0, Math.min(16, Math.round(maxRow)));
  const triangle = [];

  for (let n = 0; n <= safeMax; n++) {
    const row = new Array(n + 1);
    row[0] = 1;
    row[n] = 1;
    for (let k = 1; k < n; k++) {
      row[k] = triangle[n - 1][k - 1] + triangle[n - 1][k];
    }
    triangle.push(row);
  }

  return triangle;
}

/**
 * Gets detailed analytical info for a cell C(n, k) in Pascal's triangle.
 * @param {number} n - Row index
 * @param {number} k - Column index
 * @returns {Object}
 */
export function getPascalCellInfo(n, k) {
  if (k < 0 || k > n || n < 0) {
    return null;
  }

  const val = combination(n, k);
  const rowSum = Math.pow(2, n);
  const isSymmetricWith = n - k;

  let parentLeft = null;
  let parentRight = null;
  if (n > 0) {
    if (k > 0) parentLeft = { n: n - 1, k: k - 1, val: combination(n - 1, k - 1) };
    if (k < n) parentRight = { n: n - 1, k: k, val: combination(n - 1, k) };
  }

  return {
    n,
    k,
    val,
    rowSum,
    isSymmetricWith,
    parentLeft,
    parentRight,
    formula: `C(${n}, ${k}) = ${n}! / (${k}! × ${n - k}!) = ${val}`,
    pascalFormula: parentLeft && parentRight 
      ? `C(${n}, ${k}) = C(${n - 1}, ${k - 1}) + C(${n - 1}, ${k}) = ${parentLeft.val} + ${parentRight.val} = ${val}`
      : `C(${n}, ${k}) = 1 (phần tử biên)`,
  };
}

/**
 * Calculates combinatorial summary counts for given n and k.
 * @param {number} n
 * @param {number} k
 * @returns {Object}
 */
export function calculateCombinatoricsCounts(n, k) {
  const safeN = Math.max(0, Math.round(n));
  const safeK = Math.max(0, Math.round(k));

  const p_n = factorial(safeN); // P(n) = n!
  const a_nk = permutation(safeN, safeK); // A(n, k)
  const c_nk = combination(safeN, safeK); // C(n, k)
  const rep_a = Math.pow(safeN, safeK); // A_bar(n, k) = n^k
  // Combinations with repetition: C_bar(n, k) = C(n + k - 1, k)
  const rep_c = (safeN === 0 && safeK === 0) ? 1 : (safeN === 0 ? 0 : combination(safeN + safeK - 1, safeK));

  return {
    n: safeN,
    k: safeK,
    permutation: p_n,
    arrangement: a_nk,
    combination: c_nk,
    arrangementWithRepetition: rep_a,
    combinationWithRepetition: rep_c,
  };
}

/**
 * Generates the next lexicographical permutation of an array in-place.
 * Algorithm: Narayana Pandita (14th century).
 * @param {any[]} arr
 * @returns {boolean} true if next permutation was formed, false if was the last permutation
 */
export function generateNextPermutation(arr) {
  const n = arr.length;
  if (n <= 1) return false;

  // 1. Find largest index i such that arr[i] < arr[i + 1]
  let i = n - 2;
  while (i >= 0 && arr[i] >= arr[i + 1]) {
    i--;
  }

  // If no such index exists, this is the last permutation
  if (i < 0) {
    arr.reverse();
    return false;
  }

  // 2. Find largest index j such that arr[i] < arr[j]
  let j = n - 1;
  while (arr[j] <= arr[i]) {
    j--;
  }

  // 3. Swap arr[i] and arr[j]
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;

  // 4. Reverse the sequence from i + 1 up to end
  let left = i + 1;
  let right = n - 1;
  while (left < right) {
    const swapTemp = arr[left];
    arr[left] = arr[right];
    arr[right] = swapTemp;
    left++;
    right--;
  }

  return true;
}

/**
 * Generates all permutations of an items array (up to maxCount to avoid freeze).
 * @param {any[]} items
 * @param {number} [maxCount=720]
 * @returns {any[][]}
 */
export function generateAllPermutations(items, maxCount = 720) {
  const current = [...items].sort((a, b) => String(a).localeCompare(String(b)));
  const results = [[...current]];

  while (results.length < maxCount && generateNextPermutation(current)) {
    results.push([...current]);
  }

  return results;
}

/**
 * Generates next combination of k elements from 1-indexed n elements (1..n)
 * represented as array of indices e.g. [1, 2, 4].
 * @param {number[]} comb - Current 1-indexed combination array of size k
 * @param {number} n - Total elements count
 * @param {number} k - Combination size
 * @returns {boolean} true if next combination was formed, false if last
 */
export function generateNextCombination(comb, n, k) {
  let i = k - 1;
  // Maximum value for element at index i is n - k + (i + 1)
  while (i >= 0 && comb[i] === n - k + (i + 1)) {
    i--;
  }

  if (i < 0) {
    // Reset to initial combination [1, 2, ..., k]
    for (let j = 0; j < k; j++) comb[j] = j + 1;
    return false;
  }

  comb[i]++;
  for (let j = i + 1; j < k; j++) {
    comb[j] = comb[j - 1] + 1;
  }
  return true;
}

/**
 * Generates all combinations of size k from items array.
 * @param {any[]} items
 * @param {number} k
 * @param {number} [maxCount=1000]
 * @returns {any[][]}
 */
export function generateAllCombinations(items, k, maxCount = 1000) {
  const n = items.length;
  if (k <= 0 || k > n) return [];

  const indices = [];
  for (let i = 1; i <= k; i++) indices.push(i);

  const results = [];
  const mapIndices = (idxs) => idxs.map(idx => items[idx - 1]);

  results.push(mapIndices(indices));
  while (results.length < maxCount && generateNextCombination(indices, n, k)) {
    results.push(mapIndices(indices));
  }

  return results;
}

/**
 * Generates next arrangement (k-permutation) of n elements.
 * Generates all combinations, and for each combination generates all permutations.
 * @param {any[]} items
 * @param {number} k
 * @param {number} [maxCount=1000]
 * @returns {any[][]}
 */
export function generateAllArrangements(items, k, maxCount = 1000) {
  const n = items.length;
  if (k <= 0 || k > n) return [];

  const results = [];
  function backtrack(current, used) {
    if (results.length >= maxCount) return;
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (!used[i]) {
        used[i] = true;
        current.push(items[i]);
        backtrack(current, used);
        current.pop();
        used[i] = false;
      }
    }
  }

  backtrack([], new Array(n).fill(false));
  return results;
}

/**
 * Generates all arrangements with repetition of size k from n items (n^k).
 * @param {any[]} items
 * @param {number} k
 * @param {number} [maxCount=1000]
 * @returns {any[][]}
 */
export function generateAllArrangementsWithRepetition(items, k, maxCount = 1000) {
  const n = items.length;
  if (n === 0 || k <= 0) return [];

  const results = [];
  function backtrack(current) {
    if (results.length >= maxCount) return;
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < n; i++) {
      current.push(items[i]);
      backtrack(current);
      current.pop();
    }
  }

  backtrack([]);
  return results;
}

/**
 * Generates all combinations with repetition of size k from n items (Stars and Bars / Euler Candy).
 * @param {any[]} items
 * @param {number} k
 * @param {number} [maxCount=1000]
 * @returns {any[][]}
 */
export function generateAllCombinationsWithRepetition(items, k, maxCount = 1000) {
  const n = items.length;
  if (n === 0 || k <= 0) return [];

  const results = [];
  function backtrack(current, startIdx) {
    if (results.length >= maxCount) return;
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = startIdx; i < n; i++) {
      current.push(items[i]);
      backtrack(current, i); // Can choose same item again
      current.pop();
    }
  }

  backtrack([], 0);
  return results;
}
