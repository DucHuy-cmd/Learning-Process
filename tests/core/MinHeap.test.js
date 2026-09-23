import { describe, it, expect } from 'vitest';
import { MinHeap } from '../../src/core/data-structures/MinHeap.js';

describe('MinHeap Data Structure', () => {
  describe('Basic Operations & State', () => {
    it('initializes empty', () => {
      const heap = new MinHeap();
      expect(heap.isEmpty).toBe(true);
      expect(heap.size).toBe(0);
      expect(heap.peek()).toBeUndefined();
      expect(heap.pop()).toBeUndefined();
    });

    it('correctly tracks size and peek on insertion', () => {
      const heap = new MinHeap();
      heap.push(10);
      expect(heap.isEmpty).toBe(false);
      expect(heap.size).toBe(1);
      expect(heap.peek()).toBe(10);

      heap.push(5);
      expect(heap.size).toBe(2);
      expect(heap.peek()).toBe(5);

      heap.push(20);
      expect(heap.size).toBe(3);
      expect(heap.peek()).toBe(5);
    });

    it('clears all elements', () => {
      const heap = new MinHeap();
      heap.push(1);
      heap.push(2);
      heap.push(3);
      expect(heap.size).toBe(3);

      heap.clear();
      expect(heap.isEmpty).toBe(true);
      expect(heap.size).toBe(0);
      expect(heap.peek()).toBeUndefined();
    });
  });

  describe('Sorting and Extraction Order', () => {
    it('pops elements in strictly ascending order', () => {
      const heap = new MinHeap();
      const input = [15, 3, 2, 8, 12, 1, 9];
      for (const val of input) {
        heap.push(val);
      }

      const extracted = [];
      while (!heap.isEmpty) {
        extracted.push(heap.pop());
      }

      expect(extracted).toEqual([1, 2, 3, 8, 9, 12, 15]);
      expect(heap.isEmpty).toBe(true);
    });

    it('handles negative numbers and zero correctly', () => {
      const heap = new MinHeap();
      const input = [0, -5, 10, -12, 3, -1];
      for (const val of input) {
        heap.push(val);
      }

      const extracted = [];
      while (!heap.isEmpty) {
        extracted.push(heap.pop());
      }

      expect(extracted).toEqual([-12, -5, -1, 0, 3, 10]);
    });

    it('handles duplicate values correctly', () => {
      const heap = new MinHeap();
      const input = [5, 2, 5, 1, 2, 1];
      for (const val of input) {
        heap.push(val);
      }

      const extracted = [];
      while (!heap.isEmpty) {
        extracted.push(heap.pop());
      }

      expect(extracted).toEqual([1, 1, 2, 2, 5, 5]);
    });
  });

  describe('Object Comparators & Priority Formats', () => {
    it('supports default object comparison with distance property', () => {
      const heap = new MinHeap();
      heap.push({ node: 'A', distance: 10 });
      heap.push({ node: 'B', distance: 2 });
      heap.push({ node: 'C', distance: 7 });

      expect(heap.peek()).toEqual({ node: 'B', distance: 2 });
      expect(heap.pop()).toEqual({ node: 'B', distance: 2 });
      expect(heap.pop()).toEqual({ node: 'C', distance: 7 });
      expect(heap.pop()).toEqual({ node: 'A', distance: 10 });
    });

    it('supports default object comparison with weight property', () => {
      const heap = new MinHeap();
      heap.push({ u: 'X', v: 'Y', weight: 100 });
      heap.push({ u: 'Y', v: 'Z', weight: 45 });
      heap.push({ u: 'Z', v: 'W', weight: 70 });

      expect(heap.pop()).toEqual({ u: 'Y', v: 'Z', weight: 45 });
      expect(heap.pop()).toEqual({ u: 'Z', v: 'W', weight: 70 });
      expect(heap.pop()).toEqual({ u: 'X', v: 'Y', weight: 100 });
    });

    it('supports custom comparator function', () => {
      // MaxHeap using inverted comparator
      const maxHeap = new MinHeap((a, b) => b - a);
      maxHeap.push(10);
      maxHeap.push(50);
      maxHeap.push(20);

      expect(maxHeap.peek()).toBe(50);
      expect(maxHeap.pop()).toBe(50);
      expect(maxHeap.pop()).toBe(20);
      expect(maxHeap.pop()).toBe(10);
    });
  });
});
