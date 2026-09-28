import { describe, it, expect } from 'vitest';
import { createGraphFromParser } from '../../src/core/models/GraphAdapter.js';
import { parseAdjacencyMatrix } from '../../src/core/parsers/MatrixParser.js';
import { parseEdgeList } from '../../src/core/parsers/EdgeListParser.js';
import { dijkstra } from '../../src/core/algorithms/DijkstraEngine.js';
import { kruskal } from '../../src/core/algorithms/KruskalEngine.js';
import { prim } from '../../src/core/algorithms/PrimEngine.js';
import { euler } from '../../src/core/algorithms/EulerEngine.js';
import { hamilton } from '../../src/core/algorithms/HamiltonEngine.js';
import { AlgorithmStatus } from '../../src/core/models/Types.js';

describe('Phase 2H: GraphAdapter (createGraphFromParser)', () => {
  // =========================================================================
  // GROUP 1 — Parser Ingestion
  // =========================================================================
  describe('Group 1: Parser Ingestion', () => {
    it('converts undirected MatrixParser output into an undirected Graph', () => {
      const input = `
        0 4 2
        4 0 1
        2 1 0
      `;
      const parsed = parseAdjacencyMatrix(input, false);
      const graph = createGraphFromParser(parsed);

      expect(graph.isDirected).toBe(false);
      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(3);
      expect(graph.hasNode('A')).toBe(true);
      expect(graph.hasNode('B')).toBe(true);
      expect(graph.hasNode('C')).toBe(true);

      const neighborsA = graph.getNeighbors('A').map(n => n.nodeId).sort();
      expect(neighborsA).toEqual(['B', 'C']);
    });

    it('converts directed MatrixParser output into a directed Graph with options.directed=true', () => {
      const input = `
        A B C
        0 5 0
        0 0 3
        2 0 0
      `;
      const parsed = parseAdjacencyMatrix(input, true);
      const graph = createGraphFromParser(parsed, { directed: true });

      expect(graph.isDirected).toBe(true);
      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(3);

      const neighborsA = graph.getNeighbors('A').map(n => n.nodeId);
      expect(neighborsA).toEqual(['B']);

      const neighborsB = graph.getNeighbors('B').map(n => n.nodeId);
      expect(neighborsB).toEqual(['C']);

      const neighborsC = graph.getNeighbors('C').map(n => n.nodeId);
      expect(neighborsC).toEqual(['A']);
    });

    it('converts undirected EdgeListParser output into an undirected Graph', () => {
      const input = `
        A - B: 4
        B - C: 7
      `;
      const parsed = parseEdgeList(input, false);
      const graph = createGraphFromParser(parsed);

      expect(graph.isDirected).toBe(false);
      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(2);
      expect(graph.getNeighbors('B').map(n => n.nodeId).sort()).toEqual(['A', 'C']);
    });

    it('converts directed EdgeListParser output into a directed Graph', () => {
      const input = `
        X -> Y: 10
        Y -> Z: 20
      `;
      const parsed = parseEdgeList(input, false);
      expect(parsed.isDirected).toBe(true);

      const graph = createGraphFromParser(parsed);
      expect(graph.isDirected).toBe(true);
      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(2);
      expect(graph.getNeighbors('X').map(n => n.nodeId)).toEqual(['Y']);
      expect(graph.getNeighbors('Z').map(n => n.nodeId)).toEqual([]);
    });
  });

  // =========================================================================
  // GROUP 2 — Directedness Precedence
  // =========================================================================
  describe('Group 2: Directedness Precedence', () => {
    it('honors options.directed = true override when parsed isDirected is false', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 1]],
        isDirected: false,
      };
      const graph = createGraphFromParser(parsed, { directed: true });
      expect(graph.isDirected).toBe(true);
    });

    it('honors options.directed = false override when parsed isDirected is true', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 1]],
        isDirected: true,
      };
      const graph = createGraphFromParser(parsed, { directed: false });
      expect(graph.isDirected).toBe(false);
    });

    it('uses parsed.isDirected when options.directed is absent', () => {
      const parsedTrue = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 1]],
        isDirected: true,
      };
      expect(createGraphFromParser(parsedTrue).isDirected).toBe(true);

      const parsedFalse = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 1]],
        isDirected: false,
      };
      expect(createGraphFromParser(parsedFalse).isDirected).toBe(false);
    });

    it('defaults directed to false when both options.directed and parsed.isDirected are absent', () => {
      const parsedWithoutFlag = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 1]],
      };
      const graph = createGraphFromParser(parsedWithoutFlag);
      expect(graph.isDirected).toBe(false);
    });
  });

  // =========================================================================
  // GROUP 3 — Weighted Configuration
  // =========================================================================
  describe('Group 3: Weighted Configuration', () => {
    it('defaults weighted to false following Graph.js default', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 5]],
      };
      const graph = createGraphFromParser(parsed);
      expect(graph.isWeighted).toBe(false);
      // Valid numeric weights are still preserved when weighted is false
      expect(graph.getEdges()[0].weight).toBe(5);
    });

    it('sets isWeighted to true when options.weighted = true is provided', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 8.5]],
      };
      const graph = createGraphFromParser(parsed, { weighted: true });
      expect(graph.isWeighted).toBe(true);
      expect(graph.getEdges()[0].weight).toBe(8.5);
    });

    it('sets isWeighted to false when options.weighted = false is explicitly provided', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'B', 3]],
      };
      const graph = createGraphFromParser(parsed, { weighted: false });
      expect(graph.isWeighted).toBe(false);
      expect(graph.getEdges()[0].weight).toBe(3);
    });

    it('preserves valid floating-point parser weights faithfully', () => {
      const parsed = {
        nodes: [{ id: 'N1' }, { id: 'N2' }, { id: 'N3' }],
        edges: [
          ['N1', 'N2', 0.125],
          ['N2', 'N3', 99.99],
        ],
      };
      const graph = createGraphFromParser(parsed);
      const edges = graph.getEdges();
      expect(edges[0].weight).toBe(0.125);
      expect(edges[1].weight).toBe(99.99);
    });
  });

  // =========================================================================
  // GROUP 4 — Order Preservation
  // =========================================================================
  describe('Group 4: Order Preservation', () => {
    it('preserves exact node declaration order in graph.getNodes()', () => {
      const parsed = {
        nodes: [
          { id: 'Z', name: 'Z' },
          { id: 'A', name: 'A' },
          { id: 'M', name: 'M' },
          { id: 'B', name: 'B' },
        ],
        edges: [],
      };
      const graph = createGraphFromParser(parsed);
      const nodeIds = graph.getNodes().map(n => n.id);
      expect(nodeIds).toEqual(['Z', 'A', 'M', 'B']);
    });

    it('preserves exact edge declaration order in graph.getEdges()', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
        edges: [
          ['C', 'D', 1],
          ['A', 'B', 1],
          ['B', 'C', 1],
          ['D', 'A', 1],
        ],
      };
      const graph = createGraphFromParser(parsed);
      const edgePairs = graph.getEdges().map(e => [e.from, e.to]);
      expect(edgePairs).toEqual([
        ['C', 'D'],
        ['A', 'B'],
        ['B', 'C'],
        ['D', 'A'],
      ]);
    });
  });

  // =========================================================================
  // GROUP 5 — Node Metadata
  // =========================================================================
  describe('Group 5: Node Metadata', () => {
    it('preserves node id, name, short, and kind attributes', () => {
      const parsed = {
        nodes: [
          { id: 'p101', name: 'Phòng 101', short: 'P101', kind: 'phong' },
          { id: 'sanh', name: 'Sảnh chính', short: 'Sảnh', kind: 'sanh' },
        ],
        edges: [['p101', 'sanh', 5]],
      };
      const graph = createGraphFromParser(parsed);
      const nodeP = graph.getNode('p101');
      expect(nodeP).toBeDefined();
      expect(nodeP.id).toBe('p101');
      expect(nodeP.name).toBe('Phòng 101');
      expect(nodeP.short).toBe('P101');
      expect(nodeP.kind).toBe('phong');
      expect(nodeP.label).toBe('Phòng 101');

      const nodeS = graph.getNode('sanh');
      expect(nodeS.label).toBe('Sảnh chính');
    });

    it('does not discard additional custom metadata present on nodes', () => {
      const parsed = {
        nodes: [
          { id: 'N1', name: 'Node 1', floor: 2, x: 100, y: 200, customProp: 'hello' },
        ],
        edges: [],
      };
      const graph = createGraphFromParser(parsed);
      const node = graph.getNode('N1');
      expect(node.floor).toBe(2);
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.customProp).toBe('hello');
    });

    it('falls back label to node.label or node.id if name is undefined', () => {
      const parsed = {
        nodes: [
          { id: 'N1', label: 'Explicit Label' },
          { id: 'N2' },
        ],
        edges: [],
      };
      const graph = createGraphFromParser(parsed);
      expect(graph.getNode('N1').label).toBe('Explicit Label');
      expect(graph.getNode('N2').label).toBe('N2');
    });
  });

  // =========================================================================
  // GROUP 6 — Validation & Error Propagation
  // =========================================================================
  describe('Group 6: Validation & Error Handling', () => {
    it('throws TypeError if parsedResult is null or undefined', () => {
      expect(() => createGraphFromParser(null)).toThrow(TypeError);
      expect(() => createGraphFromParser(null)).toThrow('Parsed result must be a non-null object');
      expect(() => createGraphFromParser(undefined)).toThrow(TypeError);
    });

    it('throws TypeError if parsedResult is not an object', () => {
      expect(() => createGraphFromParser('string')).toThrow(TypeError);
      expect(() => createGraphFromParser(123)).toThrow(TypeError);
    });

    it('throws TypeError if nodes array is missing or not an array', () => {
      expect(() => createGraphFromParser({ edges: [] })).toThrow(TypeError);
      expect(() => createGraphFromParser({ edges: [] })).toThrow('Parsed result must contain a "nodes" array');
      expect(() => createGraphFromParser({ nodes: 'not-array', edges: [] })).toThrow(TypeError);
    });

    it('throws TypeError if edges array is missing or not an array', () => {
      expect(() => createGraphFromParser({ nodes: [] })).toThrow(TypeError);
      expect(() => createGraphFromParser({ nodes: [] })).toThrow('Parsed result must contain an "edges" array');
      expect(() => createGraphFromParser({ nodes: [], edges: null })).toThrow(TypeError);
    });

    it('throws Error if a node is not an object or lacks a valid string id', () => {
      expect(() => createGraphFromParser({
        nodes: [null],
        edges: [],
      })).toThrow(Error);

      expect(() => createGraphFromParser({
        nodes: [{ id: '' }],
        edges: [],
      })).toThrow('Node ID must be a non-empty string');

      expect(() => createGraphFromParser({
        nodes: [{ id: 123 }],
        edges: [],
      })).toThrow('Node ID must be a non-empty string');
    });

    it('throws Error if duplicate node IDs are present (delegated to Graph.addNode)', () => {
      expect(() => createGraphFromParser({
        nodes: [{ id: 'A' }, { id: 'A' }],
        edges: [],
      })).toThrow('Node with ID "A" already exists');
    });

    it('throws Error if an edge is malformed (not array or less than 2 elements)', () => {
      expect(() => createGraphFromParser({
        nodes: [{ id: 'A' }],
        edges: ['not-an-array'],
      })).toThrow('Edge must be an array of at least 2 elements [u, v]');

      expect(() => createGraphFromParser({
        nodes: [{ id: 'A' }],
        edges: [['A']],
      })).toThrow('Edge must be an array of at least 2 elements [u, v]');
    });

    it('propagates Graph.addEdge Error when edge references an unknown node', () => {
      expect(() => createGraphFromParser({
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['A', 'UNKNOWN_NODE', 1]],
      })).toThrow('Target node "UNKNOWN_NODE" does not exist in graph');

      expect(() => createGraphFromParser({
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [['UNKNOWN_SRC', 'B', 1]],
      })).toThrow('Source node "UNKNOWN_SRC" does not exist in graph');
    });
  });

  // =========================================================================
  // GROUP 7 — Graph Behavior & Immutability
  // =========================================================================
  describe('Group 7: Graph Behavior & Immutability', () => {
    it('supports duplicate multigraph edges between the same vertex pair', () => {
      const parsed = {
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [
          ['A', 'B', 5],
          ['A', 'B', 10],
        ],
      };
      const graph = createGraphFromParser(parsed);
      expect(graph.edgeCount).toBe(2);
      const edges = graph.getEdges();
      expect(edges[0].id).toBe('A--B');
      expect(edges[0].weight).toBe(5);
      expect(edges[1].id).toBe('A--B#1');
      expect(edges[1].weight).toBe(10);
    });

    it('supports self-loops (u === v)', () => {
      const parsed = {
        nodes: [{ id: 'A' }],
        edges: [['A', 'A', 7]],
      };
      const graph = createGraphFromParser(parsed);
      expect(graph.edgeCount).toBe(1);
      const edge = graph.getEdges()[0];
      expect(edge.from).toBe('A');
      expect(edge.to).toBe('A');
      expect(edge.weight).toBe(7);
      // In undirected graph, self-loop contributes 2 to vertex degree
      expect(graph.degree('A')).toBe(2);
    });

    it('creates an empty graph correctly when nodes and edges are empty', () => {
      const parsed = { nodes: [], edges: [] };
      const graph = createGraphFromParser(parsed);
      expect(graph.nodeCount).toBe(0);
      expect(graph.edgeCount).toBe(0);
      expect(graph.getNodes()).toEqual([]);
      expect(graph.getEdges()).toEqual([]);
    });

    it('does not mutate the input parsedResult or its inner arrays and objects', () => {
      const nodeA = { id: 'A', name: 'Node A', short: 'A', kind: 'phong' };
      const nodeB = { id: 'B', name: 'Node B', short: 'B', kind: 'phong' };
      const edge = ['A', 'B', 3.5];
      const parsed = {
        nodes: [nodeA, nodeB],
        edges: [edge],
        isDirected: false,
      };

      const parsedClone = JSON.parse(JSON.stringify(parsed));
      const graph = createGraphFromParser(parsed);

      expect(parsed).toEqual(parsedClone);
      expect(parsed.nodes[0]).toEqual(nodeA);
      expect(parsed.edges[0]).toEqual(edge);
      expect(graph.nodeCount).toBe(2);
    });
  });

  // =========================================================================
  // GROUP 8 — End-to-End Pipeline Verification with Core Engines
  // =========================================================================
  describe('Group 8: Pipeline Verification with Core Algorithm Engines', () => {
    it('pipeline: MatrixParser → createGraphFromParser → DijkstraEngine', () => {
      const matrixText = `
        A B C
        0 4 2
        4 0 1
        2 1 0
      `;
      const parsed = parseAdjacencyMatrix(matrixText, false);
      const graph = createGraphFromParser(parsed, { weighted: true });

      const result = dijkstra(graph, 'A', 'B');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.totalWeight).toBe(3); // Path: A -> C -> B (weight 2 + 1 = 3 < 4)
      expect(result.path).toEqual(['A', 'C', 'B']);
    });

    it('pipeline: EdgeListParser → createGraphFromParser → KruskalEngine', () => {
      const edgeListText = `
        A - B: 4
        A - C: 2
        B - C: 1
        B - D: 5
        C - D: 8
      `;
      const parsed = parseEdgeList(edgeListText, false);
      const graph = createGraphFromParser(parsed, { weighted: true });

      const result = kruskal(graph);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(true);
      expect(result.totalWeight).toBe(8); // (B-C: 1) + (A-C: 2) + (B-D: 5) = 8
      expect(result.edges.length).toBe(3);
    });

    it('pipeline: EdgeListParser → createGraphFromParser → PrimEngine', () => {
      const edgeListText = `
        A - B: 4
        A - C: 2
        B - C: 1
        B - D: 5
        C - D: 8
      `;
      const parsed = parseEdgeList(edgeListText, false);
      const graph = createGraphFromParser(parsed, { weighted: true });

      const result = prim(graph, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.connected).toBe(true);
      expect(result.totalWeight).toBe(8);
      expect(result.edges.length).toBe(3);
    });

    it('pipeline: EdgeListParser → createGraphFromParser → EulerEngine', () => {
      // Complete triangle Eulerian circuit (all degrees = 2)
      const eulerText = `
        A - B: 1
        B - C: 1
        C - A: 1
      `;
      const parsed = parseEdgeList(eulerText, false);
      const graph = createGraphFromParser(parsed);

      const result = euler(graph, 'A');
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.type).toBe('circuit');
      expect(result.edges.length).toBe(3);
    });

    it('pipeline: EdgeListParser → createGraphFromParser → HamiltonEngine', () => {
      // 4-cycle Hamilton
      const hamiltonText = `
        A - B: 1
        B - C: 1
        C - D: 1
        D - A: 1
      `;
      const parsed = parseEdgeList(hamiltonText, false);
      const graph = createGraphFromParser(parsed);

      const result = hamilton(graph, 'A', true);
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.found).toBe(true);
      expect(result.closesCycle).toBe(true);
      expect(result.path.length).toBe(4);
    });
  });
});
