import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';

describe('Graph Parsers Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  describe('REG-13: Adjacency Matrix Parser (parseAdjacencyMatrix)', () => {
    it('parses directed matrix with explicit header row and edge weights', () => {
      const input = `
        A B C
        0 5 0
        0 0 3
        2 0 0
      `;
      const result = ctx.parseMatrix(input, true);

      expect(result.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
      expect(result.edges.length).toBe(3);
      expect(result.edges).toEqual([
        ['A', 'B', 5],
        ['B', 'C', 3],
        ['C', 'A', 2]
      ]);
    });

    it('parses undirected matrix without header and collapses symmetric pairs', () => {
      const input = `
        0 4 2
        4 0 1
        2 1 0
      `;
      const result = ctx.parseMatrix(input, false);

      expect(result.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
      // In undirected mode, symmetric entries (i,j) and (j,i) are collapsed into 1 edge
      expect(result.edges.length).toBe(3);
      expect(result.edges).toEqual([
        ['A', 'B', 4],
        ['A', 'C', 2],
        ['B', 'C', 1]
      ]);
    });

    it('treats inf, infinity, -, and 0 as no edge', () => {
      const input = `
        A B
        0 inf
        - 0
      `;
      const result = ctx.parseMatrix(input, true);
      expect(result.edges.length).toBe(0);
    });

    it('throws descriptive error on dimension mismatch or empty content', () => {
      expect(() => ctx.parseMatrix('', false)).toThrow('Vui lòng nhập nội dung ma trận kề!');
      // When n = 2 rows, row 2 has only 1 element (less than n = 2), triggering the parser throw
      const invalidRows = `
        1 2
        4
      `;
      expect(() => ctx.parseMatrix(invalidRows, false)).toThrow();
    });
  });

  describe('REG-14: Edge List Parser (parseEdgeList)', () => {
    it('parses directed arrows (->, -->, →) and automatically sets isDirected flag', () => {
      const input = `
        A -> B: 4.5
        B --> C: 2
        C → D: 1.0
      `;
      const result = ctx.parseEdgeList(input, false);

      expect(result.isDirected).toBe(true);
      expect(result.nodes.map(n => n.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(result.edges).toEqual([
        ['A', 'B', 4.5],
        ['B', 'C', 2.0],
        ['C', 'D', 1.0]
      ]);
    });

    it('parses undirected delimiters (- or space-separated) and assigns default weight 1.0', () => {
      const input = `
        A - B: 6
        B - C
        C D 10
      `;
      const result = ctx.parseEdgeList(input, false);

      expect(result.isDirected).toBe(false);
      // KNOWN LEGACY DEFECT (BUG-PARSER-001):
      // In legacy/index.html line 4260-4262, the comment claims syntax 2 supports "A B 1 (không có dấu -)",
      // but regex requires `(?:\s*[:=,]\s*([0-9.]+))?` (with : = , delimiter).
      // Without delimiter, "C D 10" matches u="C", v="D", while weight is undefined and falls back to default 1.0.
      expect(result.edges).toEqual([
        ['A', 'B', 6.0],
        ['B', 'C', 1.0],
        ['C', 'D', 1.0]
      ]);
    });

    it('ignores comments and empty lines gracefully', () => {
      const input = `
        # This is a comment
        // Another comment
        A -> B: 3
        
        # Blank line above
        B -> C: 7
      `;
      const result = ctx.parseEdgeList(input, true);
      expect(result.edges.length).toBe(2);
      expect(result.edges).toEqual([
        ['A', 'B', 3.0],
        ['B', 'C', 7.0]
      ]);
    });
  });
});
