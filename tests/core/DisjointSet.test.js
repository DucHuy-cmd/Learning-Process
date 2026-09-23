import { describe, it, expect } from 'vitest';
import { DisjointSet } from '../../src/core/data-structures/DisjointSet.js';

describe('DisjointSet (Union-Find) Data Structure', () => {
  describe('Set Initialization & Membership', () => {
    it('initializes empty or with an iterable of items', () => {
      const dsu1 = new DisjointSet();
      expect(dsu1.size).toBe(0);
      expect(dsu1.setCount).toBe(0);

      const dsu2 = new DisjointSet(['A', 'B', 'C']);
      expect(dsu2.size).toBe(3);
      expect(dsu2.setCount).toBe(3);
      expect(dsu2.find('A')).toBe('A');
      expect(dsu2.find('B')).toBe('B');
      expect(dsu2.find('C')).toBe('C');
    });

    it('creates new sets with makeSet', () => {
      const dsu = new DisjointSet();
      expect(dsu.makeSet('X')).toBe(true);
      expect(dsu.makeSet('Y')).toBe(true);
      expect(dsu.makeSet('X')).toBe(false); // Duplicate is no-op
      expect(dsu.size).toBe(2);
      expect(dsu.setCount).toBe(2);
    });

    it('returns undefined when querying unknown elements', () => {
      const dsu = new DisjointSet(['A']);
      expect(dsu.find('UNKNOWN')).toBeUndefined();
      expect(dsu.connected('A', 'UNKNOWN')).toBe(false);
      expect(dsu.union('A', 'UNKNOWN')).toBe(false);
    });
  });

  describe('Union and Connectivity', () => {
    it('merges sets and reports connectivity', () => {
      const dsu = new DisjointSet(['A', 'B', 'C', 'D']);
      expect(dsu.connected('A', 'B')).toBe(false);

      expect(dsu.union('A', 'B')).toBe(true);
      expect(dsu.setCount).toBe(3);
      expect(dsu.connected('A', 'B')).toBe(true);
      expect(dsu.connected('A', 'C')).toBe(false);

      expect(dsu.union('C', 'D')).toBe(true);
      expect(dsu.setCount).toBe(2);
      expect(dsu.connected('C', 'D')).toBe(true);

      // Merge both components
      expect(dsu.union('B', 'C')).toBe(true);
      expect(dsu.setCount).toBe(1);
      expect(dsu.connected('A', 'D')).toBe(true);
    });

    it('returns false for redundant union (cycle detection)', () => {
      const dsu = new DisjointSet(['A', 'B', 'C']);
      expect(dsu.union('A', 'B')).toBe(true);
      expect(dsu.union('B', 'C')).toBe(true);

      // A and C are already connected
      expect(dsu.union('A', 'C')).toBe(false);
      expect(dsu.setCount).toBe(1);
    });
  });

  describe('Path Compression and Flattening', () => {
    it('compresses paths so subsequent lookups are O(1)', () => {
      const items = ['1', '2', '3', '4', '5'];
      const dsu = new DisjointSet(items);

      dsu.union('1', '2');
      dsu.union('2', '3');
      dsu.union('3', '4');
      dsu.union('4', '5');

      const root = dsu.find('1');
      expect(dsu.find('5')).toBe(root);
      expect(dsu.find('3')).toBe(root);

      // Verify that after find, internal parent of 1 is root
      expect(dsu.connected('1', '5')).toBe(true);
    });

    it('clears all sets and state', () => {
      const dsu = new DisjointSet(['A', 'B']);
      dsu.union('A', 'B');
      expect(dsu.size).toBe(2);

      dsu.clear();
      expect(dsu.size).toBe(0);
      expect(dsu.setCount).toBe(0);
      expect(dsu.find('A')).toBeUndefined();
    });
  });
});
