import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PRESET_KEYS,
  getPresetRaw,
  getPresetGraph,
  listPresets,
} from '../../src/app/presets/presets.js';
import { Graph } from '../../src/core/models/Graph.js';

describe('Phase 3D: Preset Repository', () => {
  // =========================================================================
  // SUITE 1 — Canonical Keys
  // =========================================================================
  describe('Suite 1: Canonical Keys', () => {
    it('exports CANONICAL_PRESET_KEYS with exact 7 keys in legacy-preserved order', () => {
      expect(CANONICAL_PRESET_KEYS).toEqual([
        'building',
        'textbook',
        'prim_slide',
        'euler_circuit',
        'euler_path',
        'euler_none',
        'euler_disconnected',
      ]);
    });

    it('freezes CANONICAL_PRESET_KEYS array against mutations', () => {
      expect(Object.isFrozen(CANONICAL_PRESET_KEYS)).toBe(true);
    });

    it('contains no extra, duplicate, or missing keys', () => {
      expect(CANONICAL_PRESET_KEYS.length).toBe(7);
      const uniqueKeys = new Set(CANONICAL_PRESET_KEYS);
      expect(uniqueKeys.size).toBe(7);
    });
  });

  // =========================================================================
  // SUITE 2 — Raw Schema
  // =========================================================================
  describe('Suite 2: Raw Schema', () => {
    it('preserves exact schema and flags for building', () => {
      const raw = getPresetRaw('building');
      expect(raw.name).toBe('Sơ đồ Tòa nhà (Dự án)');
      expect(raw.isBuilding).toBe(true);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBeUndefined();
      expect(raw.nodes.length).toBe(10);
      expect(raw.edges.length).toBe(10);
    });

    it('preserves exact schema and flags for textbook', () => {
      const raw = getPresetRaw('textbook');
      expect(raw.name).toBe('Bài tập Giáo trình (Slide)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBeUndefined();
      expect(raw.nodes.length).toBe(8);
      expect(raw.edges.length).toBe(12);
    });

    it('preserves exact schema and flags for prim_slide', () => {
      const raw = getPresetRaw('prim_slide');
      expect(raw.name).toBe('Bài tập Prim (Slide X1-X8)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBe('prim');
      expect(raw.nodes.length).toBe(8);
      expect(raw.edges.length).toBe(17);
    });

    it('preserves exact schema and flags for euler_circuit', () => {
      const raw = getPresetRaw('euler_circuit');
      expect(raw.name).toBe('Bài tập Euler (Có Chu trình)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBe('euler');
      expect(raw.nodes.length).toBe(5);
      expect(raw.edges.length).toBe(6);
    });

    it('preserves exact schema and flags for euler_path', () => {
      const raw = getPresetRaw('euler_path');
      expect(raw.name).toBe('Bài tập Euler (Có Đường đi, Không có Chu trình)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBe('euler');
      expect(raw.nodes.length).toBe(5);
      expect(raw.edges.length).toBe(8);
    });

    it('preserves exact schema and flags for euler_none', () => {
      const raw = getPresetRaw('euler_none');
      expect(raw.name).toBe('Bài tập Euler (Không có Euler — 4 Đỉnh Lẻ)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBe('euler');
      expect(raw.nodes.length).toBe(4);
      expect(raw.edges.length).toBe(6);
    });

    it('preserves exact schema and flags for euler_disconnected', () => {
      const raw = getPresetRaw('euler_disconnected');
      expect(raw.name).toBe('Bài tập Euler (Không có Euler — Không Liên Thông)');
      expect(raw.isBuilding).toBe(false);
      expect(raw.directed).toBe(false);
      expect(raw.algo).toBe('euler');
      expect(raw.nodes.length).toBe(6);
      expect(raw.edges.length).toBe(6);
    });
  });

  // =========================================================================
  // SUITE 3 — Exact Graph Data
  // =========================================================================
  describe('Suite 3: Exact Graph Data', () => {
    it('preserves exact building nodes and edges in order', () => {
      const raw = getPresetRaw('building');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual([
        'sanh_chinh',
        'hanhlang_1a',
        'phong_101',
        'cauthang_a',
        'phong_102',
        'phong_103',
        'hanhlang_2a',
        'phong_201',
        'phong_202',
        'phong_203',
      ]);

      // Verify node attributes and floor preservation
      expect(raw.nodes[0]).toEqual({
        id: 'sanh_chinh',
        name: 'Sảnh chính',
        short: 'Sảnh',
        kind: 'sanh',
        floor: 1,
        x: 85,
        y: 245,
      });
      expect(raw.nodes[6].floor).toBe(2);

      // Verify exact edges with weights
      expect(raw.edges).toEqual([
        ['sanh_chinh', 'hanhlang_1a', 5.0],
        ['hanhlang_1a', 'phong_101', 4.0],
        ['hanhlang_1a', 'cauthang_a', 3.0],
        ['phong_101', 'phong_102', 6.0],
        ['cauthang_a', 'phong_102', 7.0],
        ['phong_102', 'phong_103', 3.0],
        ['cauthang_a', 'hanhlang_2a', 10.0],
        ['hanhlang_2a', 'phong_201', 4.0],
        ['hanhlang_2a', 'phong_202', 5.0],
        ['phong_202', 'phong_203', 3.0],
      ]);
    });

    it('preserves exact textbook nodes and edges in order', () => {
      const raw = getPresetRaw('textbook');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['u', 'r', 's', 't', 'x', 'y', 'z', 'w']);

      expect(raw.edges).toEqual([
        ['u', 'r', 4.0],
        ['u', 'y', 1.0],
        ['r', 'y', 2.0],
        ['r', 't', 3.0],
        ['r', 's', 7.0],
        ['y', 'z', 3.0],
        ['t', 's', 3.0],
        ['t', 'z', 4.0],
        ['t', 'x', 1.0],
        ['s', 'x', 1.0],
        ['x', 'w', 3.0],
        ['z', 'w', 5.0],
      ]);
    });

    it('preserves exact prim_slide nodes and edges in order', () => {
      const raw = getPresetRaw('prim_slide');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']);

      expect(raw.edges.length).toBe(17);
      expect(raw.edges[0]).toEqual(['x1', 'x2', 16.0]);
      expect(raw.edges[16]).toEqual(['x6', 'x7', 17.0]);
    });

    it('preserves exact euler_circuit nodes and edges in order', () => {
      const raw = getPresetRaw('euler_circuit');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['A', 'B', 'C', 'D', 'E']);

      expect(raw.edges).toEqual([
        ['A', 'B', 1.0],
        ['B', 'C', 1.0],
        ['C', 'A', 1.0],
        ['C', 'D', 1.0],
        ['D', 'E', 1.0],
        ['E', 'C', 1.0],
      ]);
    });

    it('preserves exact euler_path nodes and edges in order', () => {
      const raw = getPresetRaw('euler_path');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['A', 'B', 'C', 'D', 'E']);

      expect(raw.edges).toEqual([
        ['A', 'B', 1.0],
        ['B', 'C', 1.0],
        ['C', 'D', 1.0],
        ['D', 'A', 1.0],
        ['A', 'C', 1.0],
        ['B', 'D', 1.0],
        ['A', 'E', 1.0],
        ['E', 'B', 1.0],
      ]);
    });

    it('preserves exact euler_none nodes and edges in order', () => {
      const raw = getPresetRaw('euler_none');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['A', 'B', 'C', 'D']);

      expect(raw.edges).toEqual([
        ['A', 'B', 1.0],
        ['B', 'C', 1.0],
        ['C', 'D', 1.0],
        ['D', 'A', 1.0],
        ['A', 'C', 1.0],
        ['B', 'D', 1.0],
      ]);
    });

    it('preserves exact euler_disconnected nodes and edges in order', () => {
      const raw = getPresetRaw('euler_disconnected');
      const nodeIds = raw.nodes.map(n => n.id);
      expect(nodeIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

      expect(raw.edges).toEqual([
        ['A', 'B', 1.0],
        ['B', 'C', 1.0],
        ['C', 'A', 1.0],
        ['D', 'E', 1.0],
        ['E', 'F', 1.0],
        ['F', 'D', 1.0],
      ]);
    });
  });

  // =========================================================================
  // SUITE 4 — Raw Immutability
  // =========================================================================
  describe('Suite 4: Raw Immutability', () => {
    it('returns fresh distinct objects across consecutive getPresetRaw calls', () => {
      const a = getPresetRaw('building');
      const b = getPresetRaw('building');

      expect(a).not.toBe(b);
      expect(a.nodes).not.toBe(b.nodes);
      expect(a.edges).not.toBe(b.edges);
      expect(a.nodes[0]).not.toBe(b.nodes[0]);
      expect(a.edges[0]).not.toBe(b.edges[0]);
    });

    it('isolates caller mutations on raw nodes and edges from repository and future calls', () => {
      const a = getPresetRaw('textbook');
      a.name = 'MUTATED_NAME';
      a.nodes[0].name = 'MUTATED_NODE';
      a.edges[0][2] = 9999.0;
      a.nodes.push({ id: 'NEW_NODE' });
      a.edges.push(['u', 'NEW_NODE', 10.0]);

      const b = getPresetRaw('textbook');
      expect(b.name).toBe('Bài tập Giáo trình (Slide)');
      expect(b.nodes[0].name).toBe('u');
      expect(b.edges[0][2]).toBe(4.0);
      expect(b.nodes.length).toBe(8);
      expect(b.edges.length).toBe(12);
    });
  });

  // =========================================================================
  // SUITE 5 — GraphAdapter Integration
  // =========================================================================
  describe('Suite 5: GraphAdapter Integration', () => {
    it('instantiates valid Graph model instance via GraphAdapter for building', () => {
      const graph = getPresetGraph('building');
      expect(graph).toBeInstanceOf(Graph);
      expect(graph.nodeCount).toBe(10);
      expect(graph.edgeCount).toBe(10);
      expect(graph.isDirected).toBe(false);
      expect(graph.isWeighted).toBe(true);

      // Verify node order and metadata
      const nodes = graph.getNodes();
      expect(nodes.map(n => n.id)).toEqual([
        'sanh_chinh',
        'hanhlang_1a',
        'phong_101',
        'cauthang_a',
        'phong_102',
        'phong_103',
        'hanhlang_2a',
        'phong_201',
        'phong_202',
        'phong_203',
      ]);
      expect(graph.getNode('sanh_chinh').label).toBe('Sảnh chính');
      expect(graph.getNode('sanh_chinh').floor).toBe(1);
    });

    it('instantiates valid Graph model instance for textbook with weights', () => {
      const graph = getPresetGraph('textbook');
      expect(graph).toBeInstanceOf(Graph);
      expect(graph.nodeCount).toBe(8);
      expect(graph.edgeCount).toBe(12);
      expect(graph.isDirected).toBe(false);
      expect(graph.isWeighted).toBe(true);

      const neighborsU = graph.getNeighbors('u');
      expect(neighborsU.length).toBe(2);
      const edgeUR = neighborsU.find(n => n.nodeId === 'r');
      expect(edgeUR).toBeDefined();
      expect(edgeUR.weight).toBe(4.0);
    });

    it('respects explicit directed and weighted option overrides', () => {
      const directedGraph = getPresetGraph('textbook', { directed: true });
      expect(directedGraph.isDirected).toBe(true);

      const unweightedGraph = getPresetGraph('textbook', { weighted: false });
      expect(unweightedGraph.isWeighted).toBe(false);

      const bothOverrides = getPresetGraph('textbook', { directed: true, weighted: false });
      expect(bothOverrides.isDirected).toBe(true);
      expect(bothOverrides.isWeighted).toBe(false);
    });

    it('preserves canonical defaults when options are empty or undefined', () => {
      const graph = getPresetGraph('prim_slide');
      expect(graph.isDirected).toBe(false);
      expect(graph.isWeighted).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 6 — Graph Independence
  // =========================================================================
  describe('Suite 6: Graph Independence', () => {
    it('produces independent Graph instances on consecutive calls', () => {
      const g1 = getPresetGraph('euler_circuit');
      const g2 = getPresetGraph('euler_circuit');

      expect(g1).not.toBe(g2);
      expect(g1.getNodes()).not.toBe(g2.getNodes());
      expect(g1.getEdges()).not.toBe(g2.getEdges());
    });

    it('isolates mutations on one Graph instance from affecting another', () => {
      const g1 = getPresetGraph('euler_circuit');
      const g2 = getPresetGraph('euler_circuit');

      // Mutate g1
      g1.addNode({ id: 'Z', label: 'Node Z' });
      g1.addEdge('A', 'Z', 99.0);

      expect(g1.nodeCount).toBe(6);
      expect(g1.edgeCount).toBe(7);

      // g2 must remain completely intact
      expect(g2.nodeCount).toBe(5);
      expect(g2.edgeCount).toBe(6);
      expect(g2.hasNode('Z')).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 7 — Unknown Keys
  // =========================================================================
  describe('Suite 7: Unknown Keys', () => {
    it('throws descriptive Error for unknown string keys in getPresetRaw', () => {
      expect(() => getPresetRaw('unknown_key')).toThrowError(
        'Unknown preset "unknown_key". Supported presets: building, textbook, prim_slide, euler_circuit, euler_path, euler_none, euler_disconnected'
      );
    });

    it('throws descriptive Error for unknown string keys in getPresetGraph', () => {
      expect(() => getPresetGraph('custom_graph')).toThrowError(
        'Unknown preset "custom_graph". Supported presets: building, textbook, prim_slide, euler_circuit, euler_path, euler_none, euler_disconnected'
      );
    });

    it('throws descriptive Error for uppercase or trimmed variations (strict exact match)', () => {
      expect(() => getPresetRaw('BUILDING')).toThrowError(/Unknown preset "BUILDING"/);
      expect(() => getPresetRaw(' building ')).toThrowError(/Unknown preset " building "/);
      expect(() => getPresetGraph('TEXTBOOK')).toThrowError(/Unknown preset "TEXTBOOK"/);
    });

    it('throws TypeError for non-string or empty string keys', () => {
      expect(() => getPresetRaw('')).toThrow(TypeError);
      expect(() => getPresetRaw('')).toThrowError('Preset key must be a non-empty string');

      expect(() => getPresetRaw(null)).toThrow(TypeError);
      expect(() => getPresetRaw(undefined)).toThrow(TypeError);
      expect(() => getPresetRaw(123)).toThrow(TypeError);
      expect(() => getPresetRaw({})).toThrow(TypeError);
      expect(() => getPresetRaw([])).toThrow(TypeError);

      expect(() => getPresetGraph('')).toThrow(TypeError);
      expect(() => getPresetGraph(null)).toThrow(TypeError);
      expect(() => getPresetGraph(undefined)).toThrow(TypeError);
      expect(() => getPresetGraph(true)).toThrow(TypeError);
    });
  });

  // =========================================================================
  // SUITE 8 — listPresets
  // =========================================================================
  describe('Suite 8: listPresets', () => {
    it('returns 7 items in canonical order', () => {
      const list = listPresets();
      expect(list.length).toBe(7);
      expect(list.map(p => p.key)).toEqual([
        'building',
        'textbook',
        'prim_slide',
        'euler_circuit',
        'euler_path',
        'euler_none',
        'euler_disconnected',
      ]);
    });

    it('returns correct summary descriptors for all presets', () => {
      const list = listPresets();

      expect(list[0]).toEqual({
        key: 'building',
        name: 'Sơ đồ Tòa nhà (Dự án)',
        nodeCount: 10,
        edgeCount: 10,
        directed: false,
        algo: 'dijkstra',
        isBuilding: true,
      });

      expect(list[1]).toEqual({
        key: 'textbook',
        name: 'Bài tập Giáo trình (Slide)',
        nodeCount: 8,
        edgeCount: 12,
        directed: false,
        algo: 'dijkstra',
        isBuilding: false,
      });

      expect(list[2]).toEqual({
        key: 'prim_slide',
        name: 'Bài tập Prim (Slide X1-X8)',
        nodeCount: 8,
        edgeCount: 17,
        directed: false,
        algo: 'prim',
        isBuilding: false,
      });

      expect(list[3].algo).toBe('euler');
      expect(list[4].algo).toBe('euler');
      expect(list[5].algo).toBe('euler');
      expect(list[6].algo).toBe('euler');
    });

    it('returns a fresh array on each call without exposing internal data', () => {
      const list1 = listPresets();
      const list2 = listPresets();
      expect(list1).not.toBe(list2);

      // Verify no raw nodes/edges arrays are exposed in summary
      for (const item of list1) {
        expect(item.nodes).toBeUndefined();
        expect(item.edges).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // SUITE 9 — Headless Purity
  // =========================================================================
  describe('Suite 9: Headless Purity', () => {
    it('executes purely without window, document, or DOM APIs', () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');
    });
  });

  // =========================================================================
  // SUITE 10 — No Accidental Mutation
  // =========================================================================
  describe('Suite 10: No Accidental Mutation of Caller Options', () => {
    it('accepts frozen options object without attempting to mutate it', () => {
      const frozenOptions = Object.freeze({
        directed: true,
        weighted: false,
      });

      const graph = getPresetGraph('textbook', frozenOptions);
      expect(graph.isDirected).toBe(true);
      expect(graph.isWeighted).toBe(false);
    });
  });
});
