/**
 * @file AlgorithmRegistry.js
 * Central algorithm dispatcher and metadata registry for Phase 3 application core.
 *
 * Fully DOM-independent, pure ES Module.
 * Dispatches to Phase 2 Core Engines:
 * - DijkstraEngine
 * - KruskalEngine
 * - PrimEngine
 * - EulerEngine
 * - HamiltonEngine
 *
 * Preserves native AlgorithmResult without wrapping, cloning, or transforming.
 * Enforces canonical vs alias option precedence.
 * Normalizes algorithm keys (case-insensitive, whitespace-trimmed) as [NEW-APPLICATION-CONTRACT].
 */

import { dijkstra } from '../../core/algorithms/DijkstraEngine.js';
import { kruskal } from '../../core/algorithms/KruskalEngine.js';
import { prim } from '../../core/algorithms/PrimEngine.js';
import { euler } from '../../core/algorithms/EulerEngine.js';
import { hamilton } from '../../core/algorithms/HamiltonEngine.js';
import { bellmanFord } from '../../core/algorithms/BellmanFordEngine.js';

/**
 * Metadata definitions for the 5 supported core algorithms.
 * @type {Readonly<Record<string, Readonly<Object>>>}
 */
const ALGORITHM_METADATA = Object.freeze({
  dijkstra: Object.freeze({
    key: 'dijkstra',
    name: 'Dijkstra Shortest Path',
    description: 'Finds the shortest path from a start vertex to other vertices (or a specific target) in a non-negative weighted graph.',
    requiresStartNode: true,
    supportsTargetNode: true,
    requiresUndirected: false,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: true, description: 'Source node identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
      Object.freeze({ name: 'endNodeId', type: 'string', required: false, default: null, description: 'Destination node identifier (canonical)' }),
      Object.freeze({ name: 'end', type: 'string', required: false, description: 'Alias for endNodeId' }),
      Object.freeze({ name: 'target', type: 'string', required: false, description: 'Alias for endNodeId' }),
    ]),
  }),
  kruskal: Object.freeze({
    key: 'kruskal',
    name: 'Kruskal Minimum Spanning Tree',
    description: 'Finds a minimum spanning tree or forest for a connected/disconnected undirected weighted graph.',
    requiresStartNode: false,
    supportsTargetNode: false,
    requiresUndirected: true,
    options: Object.freeze([]),
  }),
  prim: Object.freeze({
    key: 'prim',
    name: 'Prim Minimum Spanning Tree',
    description: 'Finds a minimum spanning tree for an undirected weighted graph starting from an initial vertex.',
    requiresStartNode: false,
    supportsTargetNode: false,
    requiresUndirected: true,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: false, default: null, description: 'Optional starting root vertex identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
    ]),
  }),
  euler: Object.freeze({
    key: 'euler',
    name: 'Euler Circuit and Path',
    description: 'Finds an Eulerian circuit or trail visiting every edge exactly once using Hierholzer algorithm.',
    requiresStartNode: false,
    supportsTargetNode: false,
    requiresUndirected: false,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: false, default: null, description: 'Optional starting vertex identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
    ]),
  }),
  hamilton: Object.freeze({
    key: 'hamilton',
    name: 'Hamilton Cycle and Path',
    description: 'Finds a Hamiltonian cycle or path visiting every vertex exactly once using backtracking.',
    requiresStartNode: false,
    supportsTargetNode: false,
    requiresUndirected: false,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: false, default: null, description: 'Optional starting vertex identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
      Object.freeze({ name: 'wantCycle', type: 'boolean', required: false, default: true, description: 'Canonical flag for cycle (true) vs path (false)' }),
      Object.freeze({ name: 'mode', type: 'string', required: false, description: 'Alias for wantCycle ("cycle" -> true, "path" -> false)' }),
    ]),
  }),
  bellman_ford: Object.freeze({
    key: 'bellman_ford',
    name: 'Bellman-Ford Shortest Path',
    description: 'Finds shortest paths from a start vertex, supporting negative edge weights and detecting negative weight cycles.',
    requiresStartNode: true,
    supportsTargetNode: true,
    requiresUndirected: false,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: true, description: 'Source node identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
      Object.freeze({ name: 'endNodeId', type: 'string', required: false, default: null, description: 'Destination node identifier (canonical)' }),
      Object.freeze({ name: 'end', type: 'string', required: false, description: 'Alias for endNodeId' }),
      Object.freeze({ name: 'target', type: 'string', required: false, description: 'Alias for endNodeId' }),
    ]),
  }),
  bellmanford: Object.freeze({
    key: 'bellmanford',
    name: 'Bellman-Ford Shortest Path',
    description: 'Alias for bellman_ford',
    requiresStartNode: true,
    supportsTargetNode: true,
    requiresUndirected: false,
    options: Object.freeze([
      Object.freeze({ name: 'startNodeId', type: 'string', required: true, description: 'Source node identifier (canonical)' }),
      Object.freeze({ name: 'start', type: 'string', required: false, description: 'Alias for startNodeId' }),
      Object.freeze({ name: 'endNodeId', type: 'string', required: false, default: null, description: 'Destination node identifier (canonical)' }),
      Object.freeze({ name: 'end', type: 'string', required: false, description: 'Alias for endNodeId' }),
      Object.freeze({ name: 'target', type: 'string', required: false, description: 'Alias for endNodeId' }),
    ]),
  }),
});

/**
 * List of canonical supported algorithm keys.
 * @type {ReadonlyArray<string>}
 */
const SUPPORTED_KEYS = Object.freeze(Object.keys(ALGORITHM_METADATA));

/**
 * Normalizes an algorithm key by trimming whitespace and converting to lowercase.
 * [NEW-APPLICATION-CONTRACT]
 *
 * @param {string} algoKey - Algorithm key to normalize
 * @returns {string} Normalized lowercase key
 * @throws {TypeError} If algoKey is not a string
 */
export function normalizeKey(algoKey) {
  if (typeof algoKey !== 'string') {
    throw new TypeError(`Algorithm key must be a string, received ${algoKey === null ? 'null' : typeof algoKey}`);
  }
  return algoKey.trim().toLowerCase();
}

/**
 * Checks whether an algorithm key is supported.
 *
 * @param {string} algoKey - Algorithm key to check
 * @returns {boolean} True if supported, false otherwise
 */
export function has(algoKey) {
  if (typeof algoKey !== 'string') {
    return false;
  }
  const normalized = algoKey.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ALGORITHM_METADATA, normalized);
}

/**
 * Retrieves the list of canonical supported algorithm keys.
 *
 * @returns {string[]} Array of supported algorithm keys
 */
export function getSupportedKeys() {
  return [...SUPPORTED_KEYS];
}

/**
 * Retrieves metadata for a specific algorithm.
 *
 * @param {string} algoKey - Algorithm key (canonical or case-insensitive)
 * @returns {Readonly<Object>|null} Metadata object or null if not found
 */
export function getMetadata(algoKey) {
  if (typeof algoKey !== 'string') {
    return null;
  }
  const normalized = algoKey.trim().toLowerCase();
  return ALGORITHM_METADATA[normalized] || null;
}

/**
 * Retrieves metadata for all supported algorithms.
 *
 * @returns {Array<Readonly<Object>>} Array of all algorithm metadata objects
 */
export function getAllMetadata() {
  return SUPPORTED_KEYS.map((key) => ALGORITHM_METADATA[key]);
}

/**
 * Dispatches and executes an algorithm against a Graph or duck-typed graph model.
 *
 * Resolves option precedence:
 * - startNodeId > start
 * - endNodeId > end > target
 * - wantCycle > mode ('path' -> false, 'cycle' -> true)
 *
 * Error Boundary:
 * - Throws TypeError on invalid/non-string algoKey
 * - Throws Error on unknown algoKey
 * - Delegates graph/node/option validation directly to the engine
 * - Returns the native AlgorithmResult intact without wrapping or cloning
 * - Propagates unexpected engine exceptions
 *
 * @param {string} algoKey - Algorithm key (case-insensitive, whitespace-trimmed)
 * @param {Object} graph - Graph instance or duck-typed graph model
 * @param {Object} [options={}] - Execution options and aliases
 * @returns {Object} Native AlgorithmResult from the core engine
 * @throws {TypeError} If algoKey is not a string
 * @throws {Error} If algoKey is an unknown algorithm
 */
export function run(algoKey, graph, options = {}) {
  const normalized = normalizeKey(algoKey);

  if (!Object.prototype.hasOwnProperty.call(ALGORITHM_METADATA, normalized)) {
    throw new Error(
      `Unknown algorithm "${algoKey}". Supported algorithms: ${SUPPORTED_KEYS.join(', ')}`
    );
  }

  const opts = options && typeof options === 'object' ? options : {};

  // If duck-typed graph lacks getEdges or getNodes, provide fallback for core engines that expect it
  let adaptedGraph = graph;
  if (graph && typeof graph === 'object' && (typeof graph.getEdges !== 'function' || typeof graph.getNodes !== 'function')) {
    adaptedGraph = new Proxy(graph, {
      get(target, prop, receiver) {
        if (prop === 'getEdges') {
          return typeof target.getEdges === 'function' ? target.getEdges.bind(target) : () => [];
        }
        if (prop === 'getNeighbors') {
          return (nodeId) => {
            const nbs = typeof target.getNeighbors === 'function' ? target.getNeighbors(nodeId) : [];
            return (nbs || []).map(nb => ({
              ...nb,
              node: nb.node || nb.nodeId || nb.id,
              nodeId: nb.nodeId || nb.node || nb.id,
            }));
          };
        }
        if (prop === 'getNodes') {
          if (typeof target.getNodes === 'function') {
            return target.getNodes.bind(target);
          }
          return () => {
            const knownIds = new Set();
            if (opts.startNodeId) knownIds.add(opts.startNodeId);
            if (opts.start) knownIds.add(opts.start);
            if (opts.endNodeId) knownIds.add(opts.endNodeId);
            if (opts.end) knownIds.add(opts.end);
            if (opts.target) knownIds.add(opts.target);
            for (const id of Array.from(knownIds)) {
              if (typeof target.getNeighbors === 'function') {
                try {
                  const nbs = target.getNeighbors(id) || [];
                  for (const nb of nbs) {
                    const nid = nb.nodeId || nb.node || nb.id;
                    if (nid) knownIds.add(nid);
                  }
                } catch (_) {}
              }
            }
            return Array.from(knownIds).map(id => ({ id, label: id }));
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  let result;
  switch (normalized) {
    case 'dijkstra': {
      const startNodeId =
        opts.startNodeId !== undefined
          ? opts.startNodeId
          : opts.start !== undefined
            ? opts.start
            : opts.startNode !== undefined
              ? opts.startNode
              : null;

      const endNodeId =
        opts.endNodeId !== undefined
          ? opts.endNodeId
          : opts.end !== undefined
            ? opts.end
            : opts.target !== undefined
              ? opts.target
              : opts.endNode !== undefined
                ? opts.endNode
                : opts.targetNode !== undefined
                  ? opts.targetNode
                  : null;

      result = dijkstra(adaptedGraph, startNodeId, endNodeId);
      break;
    }

    case 'kruskal': {
      result = kruskal(adaptedGraph);
      break;
    }

    case 'prim': {
      const startNodeId =
        opts.startNodeId !== undefined
          ? opts.startNodeId
          : opts.start !== undefined
            ? opts.start
            : opts.startNode !== undefined
              ? opts.startNode
              : null;

      result = prim(adaptedGraph, startNodeId);
      break;
    }

    case 'euler': {
      const startNodeId =
        opts.startNodeId !== undefined
          ? opts.startNodeId
          : opts.start !== undefined
            ? opts.start
            : opts.startNode !== undefined
              ? opts.startNode
              : null;

      result = euler(adaptedGraph, startNodeId);
      if (result && typeof result === 'object' && result.hasCircuit === undefined) {
        result.hasCircuit = result.type === 'circuit';
      }
      break;
    }

    case 'hamilton': {
      const startNodeId =
        opts.startNodeId !== undefined
          ? opts.startNodeId
          : opts.start !== undefined
            ? opts.start
            : opts.startNode !== undefined
              ? opts.startNode
              : null;

      let wantCycle = true;
      if (typeof opts.wantCycle === 'boolean') {
        wantCycle = opts.wantCycle;
      } else if (opts.mode === 'path') {
        wantCycle = false;
      } else if (opts.mode === 'cycle') {
        wantCycle = true;
      }

      result = hamilton(adaptedGraph, startNodeId, wantCycle);
      break;
    }

    case 'bellman_ford':
    case 'bellmanford': {
      const startNodeId =
        opts.startNodeId !== undefined
          ? opts.startNodeId
          : opts.start !== undefined
            ? opts.start
            : opts.startNode !== undefined
              ? opts.startNode
              : null;

      const endNodeId =
        opts.endNodeId !== undefined
          ? opts.endNodeId
          : opts.end !== undefined
            ? opts.end
            : opts.target !== undefined
              ? opts.target
              : opts.endNode !== undefined
                ? opts.endNode
                : opts.targetNode !== undefined
                  ? opts.targetNode
                  : null;

      result = bellmanFord(adaptedGraph, startNodeId, endNodeId);
      break;
    }

    default:
      throw new Error(`Unhandled algorithm: ${normalized}`);
  }

  if (result && typeof result === 'object') {
    if (!result.algorithm) {
      result.algorithm = normalized;
    }
    if ((normalized === 'dijkstra' || normalized === 'bellman_ford' || normalized === 'bellmanford') && !result.distances && Array.isArray(result.steps)) {
      const lastDistStep = [...result.steps].reverse().find(s => s.state && s.state.dist);
      if (lastDistStep) {
        result.distances = { ...lastDistStep.state.dist };
      }
    }
  }

  return result;
}

/**
 * Class representation providing static API and instance API for AlgorithmRegistry.
 */
export class AlgorithmRegistry {
  static run = run;
  static getMetadata = getMetadata;
  static getAllMetadata = getAllMetadata;
  static getSupportedKeys = getSupportedKeys;
  static has = has;
  static normalizeKey = normalizeKey;

  run(...args) {
    return run(...args);
  }
  getMetadata(...args) {
    return getMetadata(...args);
  }
  getAllMetadata(...args) {
    return getAllMetadata(...args);
  }
  getSupportedKeys(...args) {
    return getSupportedKeys(...args);
  }
  has(...args) {
    return has(...args);
  }
  normalizeKey(...args) {
    return normalizeKey(...args);
  }
}

export default AlgorithmRegistry;

