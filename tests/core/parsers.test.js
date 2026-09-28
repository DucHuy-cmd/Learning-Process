import { describe, it, expect, beforeEach } from 'vitest';
import { parseAdjacencyMatrix } from '../../src/core/parsers/MatrixParser.js';
import { parseEdgeList } from '../../src/core/parsers/EdgeListParser.js';
import { createLegacyContext } from '../helpers/legacy-runner.js';

describe('Phase 2G: Headless Core Parsers', () => {
  let legacyCtx;

  beforeEach(() => {
    legacyCtx = createLegacyContext();
  });

  // =========================================================================
  // 1. MatrixParser (parseAdjacencyMatrix)
  // =========================================================================
  describe('MatrixParser: parseAdjacencyMatrix', () => {
    it('1. parses valid directed matrix with header row and float edge weights', () => {
      const input = `
        A B C
        0 2.5 0
        0 0 7.1
        1.2 0 0
      `;
      const res = parseAdjacencyMatrix(input, true);
      expect(res.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
      expect(res.edges).toEqual([
        ['A', 'B', 2.5],
        ['B', 'C', 7.1],
        ['C', 'A', 1.2],
      ]);
    });

    it('2. auto-names vertices A..Z when header is omitted (n <= 26)', () => {
      const input = `
        0 4 0
        0 0 6
        1 0 0
      `;
      const res = parseAdjacencyMatrix(input, true);
      expect(res.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
      expect(res.edges).toEqual([
        ['A', 'B', 4],
        ['B', 'C', 6],
        ['C', 'A', 1],
      ]);
    });

    it('3. auto-names vertices V1..Vn when header is omitted and n > 26', () => {
      // 27 x 27 matrix of zeros except one edge
      const rows = [];
      for (let i = 0; i < 27; i++) {
        const row = new Array(27).fill('0');
        if (i === 0) row[1] = '5';
        rows.push(row.join(' '));
      }
      const input = rows.join('\n');
      const res = parseAdjacencyMatrix(input, true);

      expect(res.nodes.length).toBe(27);
      expect(res.nodes[0].id).toBe('V1');
      expect(res.nodes[26].id).toBe('V27');
      expect(res.edges).toEqual([['V1', 'V2', 5]]);
    });

    it('4. collapses symmetric pairs into single edge for undirected matrix with header', () => {
      const input = `
        X Y Z
        0 5 8
        5 0 2
        8 2 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.nodes.map(n => n.id)).toEqual(['X', 'Y', 'Z']);
      expect(res.edges.length).toBe(3);
      expect(res.edges).toEqual([
        ['X', 'Y', 5],
        ['X', 'Z', 8],
        ['Y', 'Z', 2],
      ]);
    });

    it('5. collapses symmetric pairs for undirected matrix without header', () => {
      const input = `
        0 3 0
        3 0 9
        0 9 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.nodes.map(n => n.id)).toEqual(['A', 'B', 'C']);
      expect(res.edges).toEqual([
        ['A', 'B', 3],
        ['B', 'C', 9],
      ]);
    });

    it('6. preserves row-major discovery order for undirected edges', () => {
      const input = `
        0 10 20 30
        10 0 40 50
        20 40 0 60
        30 50 60 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.edges).toEqual([
        ['A', 'B', 10],
        ['A', 'C', 20],
        ['A', 'D', 30],
        ['B', 'C', 40],
        ['B', 'D', 50],
        ['C', 'D', 60],
      ]);
    });

    it('7. in asymmetric undirected matrix, takes the first encountered non-zero cell', () => {
      // Row 0, col 1 is 5; Row 1, col 0 is 10.
      // Since (0, 1) is encountered first, weight 5 is added and (1, 0) is skipped
      const input = `
        0 5
        10 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.edges).toEqual([['A', 'B', 5]]);
    });

    it('8. strictly ignores diagonal entries (i === j), no self-loops', () => {
      const input = `
        100 5
        5 200
      `;
      const resDirected = parseAdjacencyMatrix(input, true);
      expect(resDirected.edges).toEqual([
        ['A', 'B', 5],
        ['B', 'A', 5],
      ]);

      const resUndirected = parseAdjacencyMatrix(input, false);
      expect(resUndirected.edges).toEqual([['A', 'B', 5]]);
    });

    it('9. treats "0", "-", "inf", "infinity", "∞" (case-insensitive) as no-edge', () => {
      const input = `
        A B C D E F
        0 - inf INFINITY ∞ 10
        - 0 0 0 0 0
        Inf 0 0 0 0 0
        Infinity 0 0 0 0 0
        ∞ 0 0 0 0 0
        10 0 0 0 0 0
      `;
      const res = parseAdjacencyMatrix(input, true);
      expect(res.edges).toEqual([
        ['A', 'F', 10],
        ['F', 'A', 10],
      ]);
    });

    it('10. treats negative numbers and NaN as no-edge', () => {
      const input = `
        0 -5 12
        NaN 0 abc
        12 0 0
      `;
      // Note: "abc" in row 2 is NaN so treated as no-edge
      const res = parseAdjacencyMatrix(input, false);
      expect(res.edges).toEqual([['A', 'C', 12]]);
    });

    it('11. supports commas, semicolons, tabs, and spaces as delimiters', () => {
      const input = `
        Node1,Node2;Node3\tNode4
        0, 3; 0\t5
        3, 0; 2\t0
        0; 2, 0\t1
        5\t0; 1, 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.nodes.map(n => n.id)).toEqual(['Node1', 'Node2', 'Node3', 'Node4']);
      expect(res.edges).toEqual([
        ['Node1', 'Node2', 3],
        ['Node1', 'Node4', 5],
        ['Node2', 'Node3', 2],
        ['Node3', 'Node4', 1],
      ]);
    });

    it('12. strips full-line comments starting with # and //', () => {
      const input = `
        # Adjacency matrix for graph G
        // Header row
        A B
        // Row 1
        0 4
        # Row 2
        4 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.nodes.map(n => n.id)).toEqual(['A', 'B']);
      expect(res.edges).toEqual([['A', 'B', 4]]);
    });

    it('13. ignores blank and whitespace-only lines', () => {
      const input = `

        A B

        0 7

        7 0

      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.edges).toEqual([['A', 'B', 7]]);
    });

    it('14. auto-pads header row if fewer names than matrix rows (k < n)', () => {
      const input = `
        Alpha Beta
        0 1 2
        1 0 3
        2 3 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      // Padded with 'C'
      expect(res.nodes.map(n => n.id)).toEqual(['Alpha', 'Beta', 'C']);
      expect(res.edges).toEqual([
        ['Alpha', 'Beta', 1],
        ['Alpha', 'C', 2],
        ['Beta', 'C', 3],
      ]);
    });

    it('15. truncates header row if more names than matrix rows (k > n)', () => {
      const input = `
        Alpha Beta Gamma Delta Epsilon
        0 1
        1 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(res.nodes.map(n => n.id)).toEqual(['Alpha', 'Beta']);
      expect(res.edges).toEqual([['Alpha', 'Beta', 1]]);
    });

    it('16. throws exact error when text is empty or blank', () => {
      expect(() => parseAdjacencyMatrix('', false)).toThrow('Vui lòng nhập nội dung ma trận kề!');
      expect(() => parseAdjacencyMatrix('   \n\t\n  ', false)).toThrow('Vui lòng nhập nội dung ma trận kề!');
    });

    it('17. throws exact error when text contains only comments', () => {
      const input = `
        # Only comments here
        // And another comment
      `;
      expect(() => parseAdjacencyMatrix(input, false)).toThrow('Vui lòng nhập nội dung ma trận kề!');
    });

    it('18. throws exact error when only header row is provided (no data rows)', () => {
      const input = `
        NodeA NodeB NodeC
      `;
      expect(() => parseAdjacencyMatrix(input, false)).toThrow('Không tìm thấy các dòng dữ liệu của ma trận kề!');
    });

    it('19. throws exact error when a row has fewer elements than n', () => {
      const input = `
        0 1 2
        1 0
        2 3 0
      `;
      expect(() => parseAdjacencyMatrix(input, false)).toThrow(
        'Dòng 2 của ma trận chỉ có 2 phần tử (cần đủ 3 phần tử cho ma trận 3×3)!'
      );
    });

    it('20. verifies exact return shape and node property structure', () => {
      const input = `
        0 1
        1 0
      `;
      const res = parseAdjacencyMatrix(input, false);
      expect(Object.keys(res).sort()).toEqual(['edges', 'nodes']);
      expect(res.isDirected).toBeUndefined();
      expect(res.nodes[0]).toEqual({
        id: 'A',
        name: 'A',
        short: 'A',
        kind: 'phong',
      });
    });
  });

  // =========================================================================
  // 2. EdgeListParser (parseEdgeList)
  // =========================================================================
  describe('EdgeListParser: parseEdgeList', () => {
    it('21. latches isDirected to true when arrows (->, -->, →, =>) are present', () => {
      const arrows = ['A -> B', 'B --> C: 2', 'C → D = 3', 'D => E, 4'];
      for (const arrowLine of arrows) {
        const res = parseEdgeList(arrowLine, false);
        expect(res.isDirected).toBe(true);
      }
    });

    it('22. preserves defaultDirected when undirected delimiters (-, –, —, ,) are used', () => {
      const input = `
        A - B: 2
        B – C: 3
        C — D: 4
        D, E: 5
      `;
      const resFalse = parseEdgeList(input, false);
      expect(resFalse.isDirected).toBe(false);

      const resTrue = parseEdgeList(input, true);
      expect(resTrue.isDirected).toBe(true);
    });

    it('23. does not match directed arrow for bidirectional symbols (<->, ↔)', () => {
      const input = `
        A <-> B: 5
        B ↔ C: 6
      `;
      const res = parseEdgeList(input, false);
      // Syntax 1 matches <-> and ↔ as delimiters, but directed latch regex /->|-->|→|=>/ does NOT match
      expect(res.isDirected).toBe(false);
      expect(res.edges).toEqual([
        ['A', 'B', 5],
        ['B', 'C', 6],
      ]);
    });

    it('24. supports weight delimiters :, =, and , in Syntax 1', () => {
      const input = `
        A -> B: 10.5
        B -> C = 20
        C -> D, 30.25
      `;
      const res = parseEdgeList(input);
      expect(res.edges).toEqual([
        ['A', 'B', 10.5],
        ['B', 'C', 20.0],
        ['C', 'D', 30.25],
      ]);
    });

    it('25. defaults weight to 1.0 when omitted in Syntax 1', () => {
      const input = `
        A -> B
        B - C
      `;
      const res = parseEdgeList(input);
      expect(res.edges).toEqual([
        ['A', 'B', 1.0],
        ['B', 'C', 1.0],
      ]);
    });

    it('26. parses space-separated vertices with weight delimiters (Syntax 2)', () => {
      const input = `
        A B: 15
        B C = 25.5
        C D, 35
      `;
      const res = parseEdgeList(input);
      expect(res.edges).toEqual([
        ['A', 'B', 15.0],
        ['B', 'C', 25.5],
        ['C', 'D', 35.0],
      ]);
    });

    it('27. PRESERVES BUG-PARSER-001: space separated weight without delimiter defaults to 1.0', () => {
      // In "A B 10", Syntax 2 regex requires [:=,] for match[3].
      // Since delimiter is absent, match[1]="A", match[2]="B", match[3]=undefined -> weight 1.0.
      const input = 'A B 10';
      const res = parseEdgeList(input);
      expect(res.edges).toEqual([['A', 'B', 1.0]]);
    });

    it('28. ignores comment lines (# and //) and empty lines', () => {
      const input = `
        # Header comment
        // Second comment
        
        A -> B: 5
        
        # Mid comment
        B -> C: 10
      `;
      const res = parseEdgeList(input);
      expect(res.edges.length).toBe(2);
      expect(res.edges).toEqual([
        ['A', 'B', 5.0],
        ['B', 'C', 10.0],
      ]);
    });

    it('29. silently skips unparseable or isolated lines', () => {
      const input = `
        SingleNodeWithoutTarget
        ??? Not An Edge ???
        A -> B: 5
        AnotherSingleNode
      `;
      const res = parseEdgeList(input);
      expect(res.nodes.map(n => n.id)).toEqual(['A', 'B']);
      expect(res.edges).toEqual([['A', 'B', 5.0]]);
    });

    it('30. supports Unicode / Vietnamese node labels', () => {
      const input = `
        Hà_Nội -> Đà_Nẵng: 760
        Đà_Nẵng -> Sài_Gòn: 960
        Sài_Gòn -> Cần_Thơ: 169
      `;
      const res = parseEdgeList(input);
      expect(res.nodes.map(n => n.id)).toEqual(['Hà_Nội', 'Đà_Nẵng', 'Sài_Gòn', 'Cần_Thơ']);
      expect(res.edges).toEqual([
        ['Hà_Nội', 'Đà_Nẵng', 760],
        ['Đà_Nẵng', 'Sài_Gòn', 960],
        ['Sài_Gòn', 'Cần_Thơ', 169],
      ]);
    });

    it('31. preserves first-appearance node insertion order', () => {
      const input = `
        Z -> Y: 1
        X -> W: 2
        Y -> X: 3
      `;
      const res = parseEdgeList(input);
      expect(res.nodes.map(n => n.id)).toEqual(['Z', 'Y', 'X', 'W']);
    });

    it('32. preserves line encounter order for edges', () => {
      const input = `
        D -> C: 4
        A -> B: 1
        C -> A: 3
        B -> D: 2
      `;
      const res = parseEdgeList(input);
      expect(res.edges).toEqual([
        ['D', 'C', 4],
        ['A', 'B', 1],
        ['C', 'A', 3],
        ['B', 'D', 2],
      ]);
    });

    it('33. verifies exact return shape and node property structure', () => {
      const input = 'A -> B: 5';
      const res = parseEdgeList(input);
      expect(Object.keys(res).sort()).toEqual(['edges', 'isDirected', 'nodes']);
      expect(res.isDirected).toBe(true);
      expect(res.nodes[0]).toEqual({
        id: 'A',
        name: 'A',
        short: 'A',
        kind: 'phong',
      });
    });

    it('34. respects defaultDirected parameter when no directed arrows present', () => {
      const input = 'A - B: 5';
      const resDefault = parseEdgeList(input);
      expect(resDefault.isDirected).toBe(false);

      const resDirected = parseEdgeList(input, true);
      expect(resDirected.isDirected).toBe(true);
    });
  });

  // =========================================================================
  // 3. Golden Master Equivalence (Cross-Verification)
  // =========================================================================
  describe('Golden Master Legacy Equivalence', () => {
    it('produces identical output for directed matrix inputs', () => {
      const matrixInput = `
        U V W
        0 12.5 0
        0 0 9.8
        4.3 0 0
      `;
      const headless = parseAdjacencyMatrix(matrixInput, true);
      const legacy = legacyCtx.parseMatrix(matrixInput, true);
      expect(headless).toEqual(legacy);
    });

    it('produces identical output for undirected matrix inputs with symmetric deduplication', () => {
      const matrixInput = `
        0 4 2
        4 0 1
        2 1 0
      `;
      const headless = parseAdjacencyMatrix(matrixInput, false);
      const legacy = legacyCtx.parseMatrix(matrixInput, false);
      expect(headless).toEqual(legacy);
    });

    it('produces identical output for complex edge list inputs', () => {
      const edgeInput = `
        # Complex edge list
        Hà_Nội -> Huế: 650
        Huế -> Đà_Nẵng: 100
        Đà_Nẵng - Quy_Nhơn = 300
        Quy_Nhơn Nha_Trang: 220
        Nha_Trang Sài_Gòn 400
        InvalidLineWithoutEdge
      `;
      const headless = parseEdgeList(edgeInput, false);
      const legacy = legacyCtx.parseEdgeList(edgeInput, false);
      expect(headless).toEqual(legacy);
    });

    it('throws identical error messages as legacy parser', () => {
      expect(() => parseAdjacencyMatrix('', false)).toThrowError(
        (() => {
          try {
            legacyCtx.parseMatrix('', false);
          } catch (e) {
            return e.message;
          }
        })()
      );

      const badMatrix = `
        0 1
        2
      `;
      expect(() => parseAdjacencyMatrix(badMatrix, false)).toThrowError(
        (() => {
          try {
            legacyCtx.parseMatrix(badMatrix, false);
          } catch (e) {
            return e.message;
          }
        })()
      );
    });
  });
});
