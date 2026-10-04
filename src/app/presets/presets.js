/**
 * @file presets.js
 * Preset Graph Repository
 * 
 * Application Layer module that encapsulates canonical preset graph definitions
 * extracted from legacy/index.html (lines 851–1043).
 * 
 * Provides:
 * - CANONICAL_PRESET_KEYS: frozen array of canonical keys in legacy order
 * - getPresetRaw(key): returns a fresh deep clone of canonical preset data
 * - getPresetGraph(key, options): instantiates a pure Graph via GraphAdapter
 * - listPresets(): returns summary metadata for all canonical presets
 */

import { createGraphFromParser } from '../../core/models/GraphAdapter.js';

/**
 * 7 Canonical Preset Keys strictly preserved in legacy encounter order.
 */
export const CANONICAL_PRESET_KEYS = Object.freeze([
  'building',
  'textbook',
  'prim_slide',
  'euler_circuit',
  'euler_path',
  'euler_none',
  'euler_disconnected',
  'bellman_sample',
  'bellman_neg_cycle',
]);

/**
 * Canonical Presets Storage (Immutable source of truth).
 * Preserves exact node order, edge order, IDs, weights, and metadata from legacy/index.html.
 */
const CANONICAL_PRESETS = {
  building: {
    name: "Sơ đồ Tòa nhà (Dự án)",
    isBuilding: true,
    directed: false,
    nodes: [
      { id: "sanh_chinh",  name: "Sảnh chính",   short: "Sảnh",    kind: "sanh",     floor: 1, x: 85,  y: 245 },
      { id: "hanhlang_1a", name: "Hành lang 1A", short: "HL 1A",   kind: "hl",       floor: 1, x: 240, y: 245 },
      { id: "phong_101",   name: "Phòng 101",    short: "P101",    kind: "phong",    floor: 1, x: 240, y: 375 },
      { id: "cauthang_a",  name: "Cầu thang A",  short: "C.Thang", kind: "cauthang", floor: 1, x: 400, y: 245 },
      { id: "phong_102",   name: "Phòng 102",    short: "P102",    kind: "phong",    floor: 1, x: 400, y: 375 },
      { id: "phong_103",   name: "Phòng 103",    short: "P103",    kind: "phong",    floor: 1, x: 560, y: 375 },
      { id: "hanhlang_2a", name: "Hành lang 2A", short: "HL 2A",   kind: "hl",       floor: 2, x: 400, y: 90 },
      { id: "phong_201",   name: "Phòng 201",    short: "P201",    kind: "phong",    floor: 2, x: 240, y: 90 },
      { id: "phong_202",   name: "Phòng 202",    short: "P202",    kind: "phong",    floor: 2, x: 560, y: 90 },
      { id: "phong_203",   name: "Phòng 203",    short: "P203",    kind: "phong",    floor: 2, x: 720, y: 90 },
    ],
    edges: [
      ["sanh_chinh",  "hanhlang_1a", 5.0],
      ["hanhlang_1a", "phong_101",   4.0],
      ["hanhlang_1a", "cauthang_a",  3.0],
      ["phong_101",   "phong_102",   6.0],
      ["cauthang_a",  "phong_102",   7.0],
      ["phong_102",   "phong_103",   3.0],
      ["cauthang_a",  "hanhlang_2a", 10.0],
      ["hanhlang_2a", "phong_201",   4.0],
      ["hanhlang_2a", "phong_202",   5.0],
      ["phong_202",   "phong_203",   3.0],
    ],
  },

  textbook: {
    name: "Bài tập Giáo trình (Slide)",
    isBuilding: false,
    directed: false,
    nodes: [
      { id: "u", name: "u", short: "u", kind: "phong", x: 120, y: 230 },
      { id: "r", name: "r", short: "r", kind: "phong", x: 280, y: 80 },
      { id: "s", name: "s", short: "s", kind: "phong", x: 680, y: 50 },
      { id: "t", name: "t", short: "t", kind: "phong", x: 480, y: 220 },
      { id: "x", name: "x", short: "x", kind: "phong", x: 800, y: 150 },
      { id: "y", name: "y", short: "y", kind: "phong", x: 220, y: 370 },
      { id: "z", name: "z", short: "z", kind: "phong", x: 530, y: 370 },
      { id: "w", name: "w", short: "w", kind: "phong", x: 860, y: 370 },
    ],
    edges: [
      ["u", "r", 4.0],
      ["u", "y", 1.0],
      ["r", "y", 2.0],
      ["r", "t", 3.0],
      ["r", "s", 7.0],
      ["y", "z", 3.0],
      ["t", "s", 3.0],
      ["t", "z", 4.0],
      ["t", "x", 1.0],
      ["s", "x", 1.0],
      ["x", "w", 3.0],
      ["z", "w", 5.0],
    ],
  },

  prim_slide: {
    name: "Bài tập Prim (Slide X1-X8)",
    isBuilding: false,
    directed: false,
    algo: "prim",
    nodes: [
      { id: "x1", name: "X1", short: "X1", kind: "phong", x: 110, y: 220 },
      { id: "x2", name: "X2", short: "X2", kind: "phong", x: 260, y: 80 },
      { id: "x3", name: "X3", short: "X3", kind: "phong", x: 260, y: 360 },
      { id: "x4", name: "X4", short: "X4", kind: "phong", x: 460, y: 80 },
      { id: "x5", name: "X5", short: "X5", kind: "phong", x: 110, y: 380 },
      { id: "x6", name: "X6", short: "X6", kind: "phong", x: 660, y: 80 },
      { id: "x7", name: "X7", short: "X7", kind: "phong", x: 800, y: 220 },
      { id: "x8", name: "X8", short: "X8", kind: "phong", x: 460, y: 260 },
    ],
    edges: [
      ["x1", "x2", 16.0],
      ["x1", "x3", 15.0],
      ["x1", "x4", 23.0],
      ["x1", "x5", 19.0],
      ["x1", "x6", 18.0],
      ["x1", "x7", 32.0],
      ["x1", "x8", 20.0],
      ["x3", "x2", 13.0],
      ["x3", "x4", 13.0],
      ["x3", "x7", 20.0],
      ["x3", "x8", 19.0],
      ["x2", "x7", 19.0],
      ["x2", "x8", 11.0],
      ["x8", "x4", 12.0],
      ["x8", "x6", 14.0],
      ["x8", "x7", 18.0],
      ["x6", "x7", 17.0],
    ],
  },

  euler_circuit: {
    name: "Bài tập Euler (Có Chu trình)",
    isBuilding: false,
    directed: false,
    algo: "euler",
    nodes: [
      { id: "A", name: "A", short: "A", kind: "phong", x: 180, y: 120 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 180, y: 340 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 470, y: 230 },
      { id: "D", name: "D", short: "D", kind: "phong", x: 760, y: 120 },
      { id: "E", name: "E", short: "E", kind: "phong", x: 760, y: 340 },
    ],
    edges: [
      ["A", "B", 1.0],
      ["B", "C", 1.0],
      ["C", "A", 1.0],
      ["C", "D", 1.0],
      ["D", "E", 1.0],
      ["E", "C", 1.0],
    ],
  },

  euler_path: {
    name: "Bài tập Euler (Có Đường đi, Không có Chu trình)",
    isBuilding: false,
    directed: false,
    algo: "euler",
    nodes: [
      { id: "A", name: "A", short: "A", kind: "phong", x: 260, y: 180 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 640, y: 180 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 640, y: 380 },
      { id: "D", name: "D", short: "D", kind: "phong", x: 260, y: 380 },
      { id: "E", name: "E", short: "E", kind: "phong", x: 450, y: 60 },
    ],
    edges: [
      ["A", "B", 1.0],
      ["B", "C", 1.0],
      ["C", "D", 1.0],
      ["D", "A", 1.0],
      ["A", "C", 1.0],
      ["B", "D", 1.0],
      ["A", "E", 1.0],
      ["E", "B", 1.0],
    ],
  },

  euler_none: {
    name: "Bài tập Euler (Không có Euler — 4 Đỉnh Lẻ)",
    isBuilding: false,
    directed: false,
    algo: "euler",
    nodes: [
      { id: "A", name: "A", short: "A", kind: "phong", x: 280, y: 140 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 620, y: 140 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 620, y: 360 },
      { id: "D", name: "D", short: "D", kind: "phong", x: 280, y: 360 },
    ],
    edges: [
      ["A", "B", 1.0],
      ["B", "C", 1.0],
      ["C", "D", 1.0],
      ["D", "A", 1.0],
      ["A", "C", 1.0],
      ["B", "D", 1.0],
    ],
  },

  euler_disconnected: {
    name: "Bài tập Euler (Không có Euler — Không Liên Thông)",
    isBuilding: false,
    directed: false,
    algo: "euler",
    nodes: [
      { id: "A", name: "A", short: "A", kind: "phong", x: 200, y: 160 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 360, y: 340 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 200, y: 340 },
      { id: "D", name: "D", short: "D", kind: "phong", x: 620, y: 160 },
      { id: "E", name: "E", short: "E", kind: "phong", x: 780, y: 160 },
      { id: "F", name: "F", short: "F", kind: "phong", x: 700, y: 340 },
    ],
    edges: [
      ["A", "B", 1.0],
      ["B", "C", 1.0],
      ["C", "A", 1.0],
      ["D", "E", 1.0],
      ["E", "F", 1.0],
      ["F", "D", 1.0],
    ],
  },

  bellman_sample: {
    name: "Bài tập Bellman-Ford (Trọng số âm)",
    isBuilding: false,
    directed: true,
    algo: "bellman_ford",
    nodes: [
      { id: "S", name: "S", short: "S", kind: "phong", x: 120, y: 220 },
      { id: "A", name: "A", short: "A", kind: "phong", x: 320, y: 100 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 320, y: 340 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 580, y: 100 },
      { id: "D", name: "D", short: "D", kind: "phong", x: 580, y: 340 },
      { id: "T", name: "T", short: "T", kind: "phong", x: 780, y: 220 },
    ],
    edges: [
      ["S", "A", 10.0],
      ["S", "B", 8.0],
      ["B", "A", 1.0],
      ["A", "C", 2.0],
      ["B", "D", 1.0],
      ["C", "D", -2.0],
      ["C", "T", -1.0],
      ["D", "T", 3.0],
    ],
  },

  bellman_neg_cycle: {
    name: "Bài tập Bellman-Ford (Chu trình âm)",
    isBuilding: false,
    directed: true,
    algo: "bellman_ford",
    nodes: [
      { id: "S", name: "S", short: "S", kind: "phong", x: 150, y: 220 },
      { id: "A", name: "A", short: "A", kind: "phong", x: 380, y: 120 },
      { id: "B", name: "B", short: "B", kind: "phong", x: 620, y: 120 },
      { id: "C", name: "C", short: "C", kind: "phong", x: 500, y: 340 },
    ],
    edges: [
      ["S", "A", 4.0],
      ["A", "B", 1.0],
      ["B", "C", -3.0],
      ["C", "A", 1.0],
    ],
  },
};

/**
 * Validates that key is a valid non-empty string and corresponds to a known preset.
 * 
 * @param {string} key
 * @returns {Object} Canonical preset object
 * @throws {TypeError} If key is not a non-empty string
 * @throws {Error} If key is unknown
 */
function resolvePreset(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('Preset key must be a non-empty string');
  }

  const preset = CANONICAL_PRESETS[key];
  if (!preset) {
    throw new Error(
      `Unknown preset "${key}". Supported presets: ${CANONICAL_PRESET_KEYS.join(', ')}`
    );
  }

  return preset;
}

/**
 * Returns a fresh deep clone of canonical preset data.
 * 
 * @param {string} key - Canonical preset key
 * @returns {Object} Deep clone of the raw preset configuration
 * @throws {TypeError} If key is not a non-empty string
 * @throws {Error} If key is unknown
 */
export function getPresetRaw(key) {
  const preset = resolvePreset(key);
  return typeof structuredClone === 'function'
    ? structuredClone(preset)
    : JSON.parse(JSON.stringify(preset));
}

/**
 * Converts a canonical preset into a newly instantiated Graph model instance via GraphAdapter.
 * 
 * @param {string} key - Canonical preset key
 * @param {Object} [options={}] - Optional overrides for directed and weighted
 * @param {boolean} [options.directed] - Explicit directed override
 * @param {boolean} [options.weighted] - Explicit weighted override
 * @returns {import('../../core/models/Graph.js').Graph} New Graph instance
 * @throws {TypeError} If key is not a non-empty string
 * @throws {Error} If key is unknown
 */
export function getPresetGraph(key, options = {}) {
  const preset = resolvePreset(key);

  const directed = typeof options?.directed === 'boolean'
    ? options.directed
    : preset.directed;

  const weighted = typeof options?.weighted === 'boolean'
    ? options.weighted
    : true; // All 7 canonical presets are weighted by default

  const adapterInput = {
    nodes: preset.nodes,
    edges: preset.edges,
    isDirected: directed,
  };

  return createGraphFromParser(adapterInput, { directed, weighted });
}

/**
 * Returns summary metadata descriptors for all canonical presets in preserved order.
 * Does not expose mutable graph structures or raw node/edge arrays.
 * 
 * @returns {Array<{ key: string, name: string, nodeCount: number, edgeCount: number, directed: boolean, algo: string, isBuilding: boolean }>}
 */
export function listPresets() {
  return CANONICAL_PRESET_KEYS.map(key => {
    const preset = CANONICAL_PRESETS[key];
    const algo = preset.algo || 'dijkstra';
    return {
      key,
      name: preset.name,
      nodeCount: preset.nodes.length,
      edgeCount: preset.edges.length,
      directed: preset.directed,
      algo,
      isBuilding: preset.isBuilding,
    };
  });
}

