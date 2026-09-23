/**
 * @file MinHeap.js
 * Headless Core Engine - High-Performance Binary Min-Heap
 * 
 * Standard binary min-heap data structure used for Dijkstra, Prim, and other greedy algorithms.
 * Zero external dependencies, pure ES Module.
 */

export class MinHeap {
  /**
   * @param {Function} [compareFn] - Custom comparator function. Returns < 0 if a < b.
   */
  constructor(compareFn) {
    /** @private @type {Array<any>} */
    this._heap = [];

    /** @private @type {Function} */
    this._compare = compareFn || MinHeap.defaultCompare;
  }

  /**
   * Default comparator supporting numbers or common object property formats:
   * { distance }, { weight }, { priority }, { key }.
   * @param {any} a
   * @param {any} b
   * @returns {number}
   */
  static defaultCompare(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      if ('distance' in a && 'distance' in b) {
        return a.distance - b.distance;
      }
      if ('weight' in a && 'weight' in b) {
        return a.weight - b.weight;
      }
      if ('priority' in a && 'priority' in b) {
        return a.priority - b.priority;
      }
      if ('key' in a && 'key' in b) {
        return a.key - b.key;
      }
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /**
   * Number of elements in heap.
   * @returns {number}
   */
  get size() {
    return this._heap.length;
  }

  /**
   * Whether heap is empty.
   * @returns {boolean}
   */
  get isEmpty() {
    return this._heap.length === 0;
  }

  /**
   * Returns minimum element without removing it.
   * Time complexity: O(1).
   * @returns {any|undefined}
   */
  peek() {
    return this.isEmpty ? undefined : this._heap[0];
  }

  /**
   * Inserts element into heap.
   * Time complexity: O(log n).
   * @param {any} item
   * @returns {number} New size of heap
   */
  push(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
    return this.size;
  }

  /**
   * Removes and returns the minimum element.
   * Time complexity: O(log n).
   * @returns {any|undefined}
   */
  pop() {
    if (this.isEmpty) {
      return undefined;
    }
    if (this._heap.length === 1) {
      return this._heap.pop();
    }

    const top = this._heap[0];
    this._heap[0] = this._heap.pop();
    this._sinkDown(0);
    return top;
  }

  /**
   * Clears all elements from heap.
   */
  clear() {
    this._heap = [];
  }

  /**
   * Returns shallow clone of underlying array (for inspection / tests).
   * @returns {Array<any>}
   */
  toArray() {
    return [...this._heap];
  }

  /**
   * Swaps two positions in the heap.
   * @private
   */
  _swap(i, j) {
    const temp = this._heap[i];
    this._heap[i] = this._heap[j];
    this._heap[j] = temp;
  }

  /**
   * Restores min-heap property upward.
   * @private
   * @param {number} index
   */
  _bubbleUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this._compare(this._heap[current], this._heap[parent]) < 0) {
        this._swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Restores min-heap property downward.
   * @private
   * @param {number} index
   */
  _sinkDown(index) {
    let current = index;
    const length = this._heap.length;

    while (true) {
      const left = 2 * current + 1;
      const right = 2 * current + 2;
      let smallest = current;

      if (left < length && this._compare(this._heap[left], this._heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this._compare(this._heap[right], this._heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        this._swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }
}
