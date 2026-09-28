/**
 * @file codeExamples.test.js
 * Comprehensive Test Suite for Real Executable Source Code Examples
 * 
 * Verifies all 20 algorithm x language combinations:
 * - 5 algorithms: Dijkstra, Kruskal, Prim, Euler, Hamilton
 * - 4 languages: C++, Python, C, Java
 */

import { describe, it, expect } from 'vitest';
import {
  CODE_EXAMPLES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_ALGORITHMS,
  getCodeExample,
} from '../../src/app/code-examples/index.js';
import { getPresetGraph } from '../../src/app/presets/presets.js';

describe('Real Source Code Examples & Action Mappings Suite', () => {
  const algorithms = SUPPORTED_ALGORITHMS;
  const languages = ['cpp', 'python', 'c', 'java'];

  // =========================================================================
  // 1. REGISTRY & METADATA INTEGRITY (20/20 COMBINATIONS)
  // =========================================================================
  describe('Metadata, File Extensions & Entry Points across all 20 combinations', () => {
    algorithms.forEach(algo => {
      languages.forEach(lang => {
        it(`[${algo} x ${lang}] source exists, has valid extension, entry point and zero pseudocode/Vietnamese`, () => {
          const example = getCodeExample(algo, lang);

          expect(example).toBeDefined();
          expect(example.algorithm).toBe(algo);
          expect(example.language).toBe(lang);
          expect(typeof example.filename).toBe('string');
          expect(typeof example.source).toBe('string');
          expect(example.source.trim().length).toBeGreaterThan(100);

          // 1. Correct file extension
          const expectedExt = {
            cpp: '.cpp',
            python: '.py',
            c: '.c',
            java: '.java',
          }[lang];
          expect(example.filename.endsWith(expectedExt)).toBe(true);

          // 2. Zero pseudocode and zero Vietnamese inside source code
          const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
          expect(vietnameseRegex.test(example.source)).toBe(false);

          const pseudocodeTerms = [
            'mã giả',
            'mô tả',
            'tập đỉnh',
            'chưa chốt',
            'sắp xếp tất cả',
            'loại bỏ',
            'quay lui',
            'reconstructPath(source, target)', // old fake call
          ];
          pseudocodeTerms.forEach(term => {
            expect(example.source.toLowerCase()).not.toContain(term.toLowerCase());
          });

          // 3. Entry point verification
          if (lang === 'cpp' || lang === 'c') {
            expect(example.source).toContain('main(');
          } else if (lang === 'java') {
            expect(example.source).toContain('public static void main(String[]');
          } else if (lang === 'python') {
            expect(example.source).toContain('if __name__ == "__main__":');
          }

          // 4. Line mappings verification
          expect(example.mapping).toBeDefined();
          expect(typeof example.mapping).toBe('object');
          const lines = example.source.split('\n');
          const totalLines = lines.length;

          Object.entries(example.mapping).forEach(([action, mappedLines]) => {
            expect(Array.isArray(mappedLines)).toBe(true);
            expect(mappedLines.length).toBeGreaterThan(0);
            mappedLines.forEach(lineNum => {
              expect(lineNum).toBeGreaterThanOrEqual(1);
              expect(lineNum).toBeLessThanOrEqual(totalLines);
              // Line must not be an empty line
              const lineContent = lines[lineNum - 1];
              expect(lineContent.trim().length).toBeGreaterThan(0);
            });
          });
        });
      });
    });
  });

  // =========================================================================
  // 2. ALGORITHMIC CONFORMANCE VERIFICATION
  // =========================================================================
  describe('Algorithmic Specifics & Data Structures', () => {
    it('Dijkstra implementations contain real Priority Queue / Min-Heap and distance relaxation', () => {
      // Python
      const py = getCodeExample('dijkstra', 'python');
      expect(py.source).toContain('import heapq');
      expect(py.source).toContain('heapq.heappush(');
      expect(py.source).toContain('heapq.heappop(');

      // C++
      const cpp = getCodeExample('dijkstra', 'cpp');
      expect(cpp.source).toContain('priority_queue');
      expect(cpp.source).toContain('pq.pop()');

      // Java
      const java = getCodeExample('dijkstra', 'java');
      expect(java.source).toContain('PriorityQueue');
      expect(java.source).toContain('pq.poll()');

      // C
      const c = getCodeExample('dijkstra', 'c');
      expect(c.source).toContain('DijkstraResult');
      expect(c.source).toContain('res.dist[u] + w < res.dist[v]');
    });

    it('Kruskal implementations contain real Disjoint Set Union with Find and Union', () => {
      const py = getCodeExample('kruskal', 'python');
      expect(py.source).toContain('class DisjointSet');
      expect(py.source).toContain('def find(');
      expect(py.source).toContain('def union(');

      const cpp = getCodeExample('kruskal', 'cpp');
      expect(cpp.source).toContain('struct DSU');
      expect(cpp.source).toContain('unite(');

      const java = getCodeExample('kruskal', 'java');
      expect(java.source).toContain('class DSU');
      expect(java.source).toContain('union(');

      const c = getCodeExample('kruskal', 'c');
      expect(c.source).toContain('dsu_find(');
      expect(c.source).toContain('dsu_union(');
    });

    it('Prim implementations maintain MST edge selection and parent tracking', () => {
      const py = getCodeExample('prim', 'python');
      expect(py.source).toContain('in_mst');
      expect(py.source).toContain('mst_edges');

      const cpp = getCodeExample('prim', 'cpp');
      expect(cpp.source).toContain('inMST');
      expect(cpp.source).toContain('mstEdges');

      const java = getCodeExample('prim', 'java');
      expect(java.source).toContain('inMST');
      expect(java.source).toContain('mstEdges');

      const c = getCodeExample('prim', 'c');
      expect(c.source).toContain('inMST');
      expect(c.source).toContain('res.parent');
    });

    it('Euler implementations follow Hierholzer with stack and circuit traversal', () => {
      ['python', 'cpp', 'java', 'c'].forEach(lang => {
        const ex = getCodeExample('euler', lang);
        expect(ex.source.toLowerCase()).toContain('circuit');
        expect(ex.source.toLowerCase()).toContain('stack');
      });
    });

    it('Hamilton implementations employ backtracking DFS with visited state', () => {
      ['python', 'cpp', 'java', 'c'].forEach(lang => {
        const ex = getCodeExample('hamilton', lang);
        expect(ex.source.toLowerCase()).toContain('backtrack');
        expect(ex.source.toLowerCase()).toContain('visited');
      });
    });
  });

  // =========================================================================
  // 3. DYNAMIC GRAPH SYNCHRONIZATION
  // =========================================================================
  describe('Dynamic Graph Embedding into Source Code', () => {
    it('embeds building preset nodes and edges into generated Python and C++ source', () => {
      const graph = getPresetGraph('building');
      const py = getCodeExample('dijkstra', 'python', graph, {
        startNodeId: 'sanh_chinh',
        endNodeId: 'phong_103',
      });

      expect(py.source).toContain('"sanh_chinh"');
      expect(py.source).toContain('"phong_103"');
      expect(py.source).toContain('source_node = "sanh_chinh"');
      expect(py.source).toContain('target_node = "phong_103"');

      // C++ embedding
      const cpp = getCodeExample('dijkstra', 'cpp', graph, {
        startNodeId: 'sanh_chinh',
        endNodeId: 'phong_103',
      });
      expect(cpp.source).toContain('string source = "sanh_chinh";');
      expect(cpp.source).toContain('string target = "phong_103";');
    });
  });
});
