/**
 * @file GraphAdapter.js
 * Headless Core Engine - Graph Representation Adapter
 * 
 * Bridges Phase 2G parser outputs (MatrixParser, EdgeListParser) into
 * validated, immutable-ready Graph model instances.
 * 
 * Preserves 100% of node encounter order, edge encounter order, directedness,
 * weights, node metadata, and Graph model invariants.
 */

import { Graph } from './Graph.js';

/**
 * Converts a parsed graph representation (from MatrixParser or EdgeListParser)
 * into a typed, validated Graph model instance.
 * 
 * @param {Object} parsedResult - Output from parseAdjacencyMatrix or parseEdgeList
 * @param {Array<{id: string, name?: string, short?: string, kind?: string, [key: string]: any}>} parsedResult.nodes
 * @param {Array<[string, string, number?]>} parsedResult.edges
 * @param {boolean} [parsedResult.isDirected]
 * @param {Object} [options={}]
 * @param {boolean} [options.directed] - Explicit directed override
 * @param {boolean} [options.weighted=false] - Weighted graph configuration passed to Graph
 * @returns {Graph} Newly constructed Graph instance
 * @throws {TypeError} If parsedResult is not a non-null object or missing nodes/edges arrays
 * @throws {Error} If node ID is invalid/duplicate or edge references an unknown node (delegated to Graph)
 */
export function createGraphFromParser(parsedResult, options = {}) {
  // 1. Structural validation
  if (!parsedResult || typeof parsedResult !== 'object') {
    throw new TypeError('Parsed result must be a non-null object');
  }

  if (!Array.isArray(parsedResult.nodes)) {
    throw new TypeError('Parsed result must contain a "nodes" array');
  }

  if (!Array.isArray(parsedResult.edges)) {
    throw new TypeError('Parsed result must contain an "edges" array');
  }

  // 2. Resolve configuration options
  const directed = typeof options.directed === 'boolean'
    ? options.directed
    : (typeof parsedResult.isDirected === 'boolean' ? parsedResult.isDirected : false);

  const weighted = typeof options.weighted === 'boolean'
    ? options.weighted
    : false;

  // 3. Instantiate pure Graph model
  const graph = new Graph({ directed, weighted });

  // 4. Process nodes strictly in encounter order
  for (const node of parsedResult.nodes) {
    if (!node || typeof node !== 'object') {
      throw new Error('Node must be an object with an "id" property');
    }

    const { id, name, label, ...extra } = node;
    const resolvedLabel = name !== undefined
      ? String(name)
      : (label !== undefined ? String(label) : (id !== undefined ? String(id) : undefined));

    graph.addNode({
      id,
      label: resolvedLabel,
      ...(name !== undefined ? { name } : {}),
      ...extra,
    });
  }

  // 5. Process edges strictly in encounter order
  for (const edge of parsedResult.edges) {
    if (!Array.isArray(edge) || edge.length < 2) {
      throw new Error('Edge must be an array of at least 2 elements [u, v]');
    }

    const [u, v, w] = edge;
    graph.addEdge(u, v, w);
  }

  return graph;
}

export default createGraphFromParser;
