/**
 * @file Graph.js
 * Headless Core Engine - Pure Graph Data Model
 * 
 * Clean, DOM-independent, fully encapsulated graph representation supporting
 * directed/undirected and weighted/unweighted graphs.
 * 
 * NEVER stores algorithm-specific runtime state (dist, prev, visited, etc.).
 */

export class Graph {
  /**
   * @param {Object} [options={}]
   * @param {boolean} [options.directed=false] - Whether the graph is directed
   * @param {boolean} [options.weighted=false] - Whether the graph requires explicit edge weights
   */
  constructor({ directed = false, weighted = false } = {}) {
    /** @private @type {boolean} */
    this._directed = Boolean(directed);

    /** @private @type {boolean} */
    this._weighted = Boolean(weighted);

    /** @private @type {Map<string, { id: string, label: string, [key: string]: any }>} */
    this._nodes = new Map();

    /** @private @type {Map<string, { id: string, from: string, to: string, weight: number, [key: string]: any }>} */
    this._edges = new Map();

    /** @private @type {Map<string, Set<string>>} - nodeId -> Set of incident edge IDs */
    this._incidentEdges = new Map();
  }

  /**
   * @returns {boolean} True if directed graph
   */
  get isDirected() {
    return this._directed;
  }

  /**
   * @returns {boolean} True if weighted graph
   */
  get isWeighted() {
    return this._weighted;
  }

  /**
   * @returns {number} Total number of nodes
   */
  get nodeCount() {
    return this._nodes.size;
  }

  /**
   * @returns {number} Total number of edges
   */
  get edgeCount() {
    return this._edges.size;
  }

  /**
   * Adds a node to the graph.
   * @param {string|{ id: string, label?: string, [key: string]: any }} nodeOrId
   * @param {string} [label]
   * @returns {{ id: string, label: string }}
   * @throws {Error} If ID is missing or already exists
   */
  addNode(nodeOrId, label) {
    let nodeObj;
    if (typeof nodeOrId === 'string') {
      nodeObj = { id: nodeOrId, label: label !== undefined ? String(label) : nodeOrId };
    } else if (nodeOrId && typeof nodeOrId === 'object') {
      const { id, label: objLabel, ...extra } = nodeOrId;
      nodeObj = {
        id,
        label: objLabel !== undefined ? String(objLabel) : String(id),
        ...extra,
      };
    } else {
      throw new Error('Node must be a non-empty string ID or an object containing an "id" property');
    }

    if (!nodeObj.id || typeof nodeObj.id !== 'string' || nodeObj.id.trim() === '') {
      throw new Error('Node ID must be a non-empty string');
    }

    if (this._nodes.has(nodeObj.id)) {
      throw new Error(`Node with ID "${nodeObj.id}" already exists`);
    }

    this._nodes.set(nodeObj.id, nodeObj);
    this._incidentEdges.set(nodeObj.id, new Set());

    return { ...nodeObj };
  }

  /**
   * Retrieves a node by ID.
   * @param {string} id
   * @returns {{ id: string, label: string }|undefined}
   */
  getNode(id) {
    const node = this._nodes.get(id);
    return node ? { ...node } : undefined;
  }

  /**
   * Checks if a node exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasNode(id) {
    return this._nodes.has(id);
  }

  /**
   * Returns a list of all nodes.
   * @returns {Array<{ id: string, label: string }>}
   */
  getNodes() {
    return Array.from(this._nodes.values()).map(n => ({ ...n }));
  }

  /**
   * Adds an edge to the graph.
   * Can be called as addEdge({ from, to, weight, id }) or addEdge(from, to, weight, id).
   * 
   * @param {string|{ from: string, to: string, weight?: number, id?: string, [key: string]: any }} edgeOrFrom
   * @param {string} [to]
   * @param {number} [weight]
   * @param {string} [id]
   * @returns {{ id: string, from: string, to: string, weight: number }}
   * @throws {Error} If nodes do not exist, edge ID exists, or weight is invalid
   */
  addEdge(edgeOrFrom, to, weight, id) {
    let edgeObj;
    if (typeof edgeOrFrom === 'object' && edgeOrFrom !== null) {
      edgeObj = { ...edgeOrFrom };
    } else {
      edgeObj = { from: edgeOrFrom, to, weight, id };
    }

    const { from, to: targetTo, weight: rawWeight, id: explicitId, ...extra } = edgeObj;

    if (!from || typeof from !== 'string' || !this.hasNode(from)) {
      throw new Error(`Source node "${from}" does not exist in graph`);
    }

    if (!targetTo || typeof targetTo !== 'string' || !this.hasNode(targetTo)) {
      throw new Error(`Target node "${targetTo}" does not exist in graph`);
    }

    // Weight validation
    let finalWeight;
    if (this._weighted) {
      if (rawWeight === undefined || rawWeight === null || typeof rawWeight !== 'number' || Number.isNaN(rawWeight)) {
        throw new Error(`Weight must be a valid number for weighted graph; received ${rawWeight}`);
      }
      finalWeight = rawWeight;
    } else {
      finalWeight = (typeof rawWeight === 'number' && !Number.isNaN(rawWeight)) ? rawWeight : 1;
    }

    // Edge ID resolution
    let finalId = explicitId;
    if (!finalId) {
      const basePrefix = this._directed ? `${from}->${targetTo}` : (from <= targetTo ? `${from}--${targetTo}` : `${targetTo}--${from}`);
      if (!this._edges.has(basePrefix)) {
        finalId = basePrefix;
      } else {
        let counter = 1;
        while (this._edges.has(`${basePrefix}#${counter}`)) {
          counter++;
        }
        finalId = `${basePrefix}#${counter}`;
      }
    } else {
      if (typeof finalId !== 'string' || finalId.trim() === '') {
        throw new Error('Edge ID must be a non-empty string');
      }
      if (this._edges.has(finalId)) {
        throw new Error(`Edge with ID "${finalId}" already exists`);
      }
    }

    const createdEdge = {
      id: finalId,
      from,
      to: targetTo,
      weight: finalWeight,
      ...extra,
    };

    this._edges.set(finalId, createdEdge);
    this._incidentEdges.get(from).add(finalId);
    if (!this._directed && from !== targetTo) {
      this._incidentEdges.get(targetTo).add(finalId);
    }

    return { ...createdEdge };
  }

  /**
   * Retrieves an edge by ID.
   * @param {string} id
   * @returns {{ id: string, from: string, to: string, weight: number }|undefined}
   */
  getEdge(id) {
    const edge = this._edges.get(id);
    return edge ? { ...edge } : undefined;
  }

  /**
   * Checks if an edge exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasEdge(id) {
    return this._edges.has(id);
  }

  /**
   * Returns a list of all edges.
   * @returns {Array<{ id: string, from: string, to: string, weight: number }>}
   */
  getEdges() {
    return Array.from(this._edges.values()).map(e => ({ ...e }));
  }

  /**
   * Retrieves the weight of the edge between u and v.
   * @param {string} u
   * @param {string} v
   * @returns {number|null}
   */
  getWeight(u, v) {
    if (!this._incidentEdges.has(u)) return null;
    for (const edgeId of this._incidentEdges.get(u)) {
      const edge = this._edges.get(edgeId);
      if (!edge) continue;
      if (this._directed) {
        if (edge.from === u && edge.to === v) return edge.weight;
      } else {
        if ((edge.from === u && edge.to === v) || (edge.from === v && edge.to === u)) {
          return edge.weight;
        }
      }
    }
    return null;
  }


  /**
   * Retrieves outgoing/incident neighbors for a given node.
   * 
   * In a directed graph: returns edges where from === nodeId, neighbor is edge.to.
   * In an undirected graph: returns all incident edges; neighbor is the opposite endpoint.
   * 
   * @param {string} nodeId
   * @returns {Array<{ node: string, nodeId: string, edgeId: string, weight: number, edge: Object }>}
   * @throws {Error} If node does not exist
   */
  getNeighbors(nodeId) {
    if (!this.hasNode(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist in graph`);
    }

    const edgeIds = this._incidentEdges.get(nodeId);
    const neighbors = [];

    for (const edgeId of edgeIds) {
      const edge = this._edges.get(edgeId);
      if (!edge) continue;

      if (this._directed) {
        if (edge.from === nodeId) {
          neighbors.push({
            node: edge.to,
            nodeId: edge.to,
            edgeId: edge.id,
            weight: edge.weight,
            edge: { ...edge },
          });
        }
      } else {
        const neighborId = edge.from === nodeId ? edge.to : edge.from;
        neighbors.push({
          node: neighborId,
          nodeId: neighborId,
          edgeId: edge.id,
          weight: edge.weight,
          edge: { ...edge },
        });
      }
    }

    return neighbors;
  }

  /**
   * Returns all edges incident to nodeId.
   * In directed graphs, returns all outgoing edges.
   * @param {string} nodeId
   * @returns {Array<{ id: string, from: string, to: string, weight: number }>}
   */
  getIncidentEdges(nodeId) {
    if (!this.hasNode(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist in graph`);
    }
    const edgeIds = this._incidentEdges.get(nodeId);
    const result = [];
    for (const edgeId of edgeIds) {
      const edge = this._edges.get(edgeId);
      if (edge) {
        if (!this._directed || edge.from === nodeId) {
          result.push({ ...edge });
        }
      }
    }
    return result;
  }

  /**
   * Degree calculation:
   * - Undirected graph: total incident edges (self-loops count as 2 in standard graph theory, or 1 edge).
   * - Directed graph: out-degree + in-degree.
   * @param {string} nodeId
   * @returns {number}
   */
  degree(nodeId) {
    if (!this.hasNode(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist in graph`);
    }
    if (!this._directed) {
      let deg = 0;
      for (const edgeId of this._incidentEdges.get(nodeId)) {
        const edge = this._edges.get(edgeId);
        if (edge) {
          deg += (edge.from === edge.to) ? 2 : 1;
        }
      }
      return deg;
    }
    return this.inDegree(nodeId) + this.outDegree(nodeId);
  }

  /**
   * Out-degree of node.
   * @param {string} nodeId
   * @returns {number}
   */
  outDegree(nodeId) {
    if (!this.hasNode(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist in graph`);
    }
    let count = 0;
    for (const edge of this._edges.values()) {
      if (edge.from === nodeId) count++;
    }
    return count;
  }

  /**
   * In-degree of node.
   * @param {string} nodeId
   * @returns {number}
   */
  inDegree(nodeId) {
    if (!this.hasNode(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist in graph`);
    }
    let count = 0;
    for (const edge of this._edges.values()) {
      if (edge.to === nodeId) count++;
    }
    return count;
  }

  /**
   * Creates an independent deep clone of this Graph.
   * @returns {Graph}
   */
  clone() {
    const cloned = new Graph({
      directed: this._directed,
      weighted: this._weighted,
    });

    for (const node of this.getNodes()) {
      cloned.addNode({ ...node });
    }

    for (const edge of this.getEdges()) {
      cloned.addEdge({ ...edge });
    }

    return cloned;
  }
}
