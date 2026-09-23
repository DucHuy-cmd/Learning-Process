/**
 * @file DisjointSet.js
 * Headless Core Engine - Disjoint Set Union (DSU / Union-Find)
 * 
 * Optimized Union-Find data structure implementing:
 * - Path compression on find()
 * - Union by rank on union()
 * 
 * Used for Kruskal's algorithm, cycle detection, and connectivity testing.
 * Zero external dependencies, pure ES Module.
 */

export class DisjointSet {
  /**
   * @param {Iterable<any>} [items=[]] - Initial items to populate sets for
   */
  constructor(items = []) {
    /** @private @type {Map<any, any>} */
    this._parent = new Map();

    /** @private @type {Map<any, number>} */
    this._rank = new Map();

    /** @private @type {number} */
    this._numSets = 0;

    if (items && typeof items[Symbol.iterator] === 'function') {
      for (const item of items) {
        this.makeSet(item);
      }
    }
  }

  /**
   * Total number of elements tracked across all sets.
   * @returns {number}
   */
  get size() {
    return this._parent.size;
  }

  /**
   * Number of disjoint sets (connected components).
   * @returns {number}
   */
  get setCount() {
    return this._numSets;
  }

  /**
   * Creates a new single-element set containing item.
   * If the item already exists, this is a no-op.
   * @param {any} item
   * @returns {boolean} True if new set was created, false if item already exists
   */
  makeSet(item) {
    if (this._parent.has(item)) {
      return false;
    }
    this._parent.set(item, item);
    this._rank.set(item, 0);
    this._numSets++;
    return true;
  }

  /**
   * Finds the representative root of the set containing item.
   * Applies iterative two-pass path compression.
   * Time complexity: Nearly O(1) amortized (inverse Ackermann α(n)).
   * 
   * @param {any} item
   * @returns {any|undefined} Root representative, or undefined if item not in DSU
   */
  find(item) {
    if (!this._parent.has(item)) {
      return undefined;
    }

    // Step 1: Find root
    let root = item;
    while (root !== this._parent.get(root)) {
      root = this._parent.get(root);
    }

    // Step 2: Path compression - point all nodes along the path directly to root
    let curr = item;
    while (curr !== root) {
      const next = this._parent.get(curr);
      this._parent.set(curr, root);
      curr = next;
    }

    return root;
  }

  /**
   * Merges the sets containing item a and item b.
   * Applies union by rank to keep trees balanced.
   * 
   * @param {any} a
   * @param {any} b
   * @returns {boolean} True if two different sets were merged; false if already in same set or unknown
   */
  union(a, b) {
    if (!this._parent.has(a) || !this._parent.has(b)) {
      return false;
    }

    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === undefined || rootB === undefined || rootA === rootB) {
      return false;
    }

    const rankA = this._rank.get(rootA);
    const rankB = this._rank.get(rootB);

    if (rankA < rankB) {
      this._parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this._parent.set(rootB, rootA);
    } else {
      this._parent.set(rootB, rootA);
      this._rank.set(rootA, rankA + 1);
    }

    this._numSets--;
    return true;
  }

  /**
   * Checks if item a and item b belong to the same set.
   * @param {any} a
   * @param {any} b
   * @returns {boolean}
   */
  connected(a, b) {
    if (!this._parent.has(a) || !this._parent.has(b)) {
      return false;
    }
    const rootA = this.find(a);
    const rootB = this.find(b);
    return rootA !== undefined && rootA === rootB;
  }

  /**
   * Clears all sets.
   */
  clear() {
    this._parent.clear();
    this._rank.clear();
    this._numSets = 0;
  }
}
