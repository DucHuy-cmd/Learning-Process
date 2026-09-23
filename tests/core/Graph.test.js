import { describe, it, expect } from 'vitest';
import { Graph } from '../../src/core/models/Graph.js';

describe('Graph Core Model', () => {
  describe('Initialization and Configuration', () => {
    it('creates an undirected, unweighted graph by default', () => {
      const g = new Graph();
      expect(g.isDirected).toBe(false);
      expect(g.isWeighted).toBe(false);
      expect(g.nodeCount).toBe(0);
      expect(g.edgeCount).toBe(0);
    });

    it('creates a directed, weighted graph with explicit options', () => {
      const g = new Graph({ directed: true, weighted: true });
      expect(g.isDirected).toBe(true);
      expect(g.isWeighted).toBe(true);
    });
  });

  describe('Node Operations', () => {
    it('adds nodes using string ID or object with custom label', () => {
      const g = new Graph();
      g.addNode('A');
      g.addNode({ id: 'B', label: 'Node B' });

      expect(g.nodeCount).toBe(2);
      expect(g.hasNode('A')).toBe(true);
      expect(g.hasNode('B')).toBe(true);
      expect(g.hasNode('C')).toBe(false);

      expect(g.getNode('A')).toEqual({ id: 'A', label: 'A' });
      expect(g.getNode('B')).toEqual({ id: 'B', label: 'Node B' });
    });

    it('rejects empty or invalid node IDs', () => {
      const g = new Graph();
      expect(() => g.addNode('')).toThrow(/non-empty string/);
      expect(() => g.addNode('   ')).toThrow(/non-empty string/);
      expect(() => g.addNode(null)).toThrow();
    });

    it('rejects duplicate node IDs', () => {
      const g = new Graph();
      g.addNode('A');
      expect(() => g.addNode('A')).toThrow(/already exists/);
      expect(() => g.addNode({ id: 'A', label: 'Second A' })).toThrow(/already exists/);
    });

    it('returns an independent array of all nodes', () => {
      const g = new Graph();
      g.addNode('A');
      g.addNode('B');
      const nodes = g.getNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n.id)).toEqual(['A', 'B']);

      // Mutating returned array does not affect graph
      nodes.push({ id: 'Z', label: 'Z' });
      expect(g.nodeCount).toBe(2);
    });
  });

  describe('Edge Operations', () => {
    it('adds edges between existing nodes with weight', () => {
      const g = new Graph({ weighted: true });
      g.addNode('A');
      g.addNode('B');
      const edge = g.addEdge('A', 'B', 15.5);

      expect(g.edgeCount).toBe(1);
      expect(g.hasEdge(edge.id)).toBe(true);
      expect(edge.from).toBe('A');
      expect(edge.to).toBe('B');
      expect(edge.weight).toBe(15.5);
    });

    it('rejects edge creation if endpoints do not exist', () => {
      const g = new Graph();
      g.addNode('A');

      expect(() => g.addEdge('A', 'MISSING')).toThrow(/Target node "MISSING" does not exist/);
      expect(() => g.addEdge('MISSING', 'A')).toThrow(/Source node "MISSING" does not exist/);
    });

    it('rejects non-numeric weight when graph is configured as weighted', () => {
      const g = new Graph({ weighted: true });
      g.addNode('A');
      g.addNode('B');

      expect(() => g.addEdge('A', 'B', undefined)).toThrow(/valid number/);
      expect(() => g.addEdge('A', 'B', NaN)).toThrow(/valid number/);
      expect(() => g.addEdge('A', 'B', 'not-a-number')).toThrow(/valid number/);
    });

    it('defaults edge weight to 1 when unweighted graph', () => {
      const g = new Graph({ weighted: false });
      g.addNode('A');
      g.addNode('B');

      const edge = g.addEdge('A', 'B');
      expect(edge.weight).toBe(1);
    });

    it('rejects duplicate explicit edge ID', () => {
      const g = new Graph();
      g.addNode('A');
      g.addNode('B');

      g.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 5 });
      expect(() => g.addEdge({ id: 'e1', from: 'A', to: 'B', weight: 10 })).toThrow(/already exists/);
    });
  });

  describe('Neighbor and Degree Traversal', () => {
    it('returns outgoing neighbors only in directed graph', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');

      g.addEdge('A', 'B', 4);
      g.addEdge('B', 'C', 7);

      const neighborsA = g.getNeighbors('A');
      expect(neighborsA).toHaveLength(1);
      expect(neighborsA[0].node).toBe('B');
      expect(neighborsA[0].weight).toBe(4);

      const neighborsB = g.getNeighbors('B');
      expect(neighborsB).toHaveLength(1);
      expect(neighborsB[0].node).toBe('C');

      const neighborsC = g.getNeighbors('C');
      expect(neighborsC).toHaveLength(0);

      expect(g.outDegree('A')).toBe(1);
      expect(g.inDegree('A')).toBe(0);
      expect(g.inDegree('B')).toBe(1);
      expect(g.outDegree('B')).toBe(1);
    });

    it('returns both incident endpoints in undirected graph', () => {
      const g = new Graph({ directed: false, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addNode('C');

      g.addEdge('A', 'B', 10);
      g.addEdge('B', 'C', 20);

      const neighborsB = g.getNeighbors('B');
      expect(neighborsB).toHaveLength(2);
      const neighborNodes = neighborsB.map(n => n.node).sort();
      expect(neighborNodes).toEqual(['A', 'C']);

      expect(g.degree('B')).toBe(2);
      expect(g.degree('A')).toBe(1);
    });

    it('throws error when querying neighbors of non-existent node', () => {
      const g = new Graph();
      expect(() => g.getNeighbors('DOES_NOT_EXIST')).toThrow(/does not exist/);
    });
  });

  describe('Cloning Integrity', () => {
    it('creates an independent deep clone without shared reference mutation', () => {
      const g = new Graph({ directed: true, weighted: true });
      g.addNode('A');
      g.addNode('B');
      g.addEdge('A', 'B', 50, 'edge_ab');

      const clone = g.clone();
      expect(clone.isDirected).toBe(true);
      expect(clone.isWeighted).toBe(true);
      expect(clone.nodeCount).toBe(2);
      expect(clone.edgeCount).toBe(1);

      // Mutate clone
      clone.addNode('C');
      clone.addEdge('B', 'C', 10);

      expect(clone.nodeCount).toBe(3);
      expect(clone.edgeCount).toBe(2);
      expect(g.nodeCount).toBe(2);
      expect(g.edgeCount).toBe(1);
      expect(g.hasNode('C')).toBe(false);
    });
  });
});
