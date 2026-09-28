/**
 * @file index.js
 * Central Code Examples Registry
 * 
 * Provides real executable source code and action-to-line mappings for:
 * - Algorithms: Dijkstra, Kruskal, Prim, Euler, Hamilton
 * - Languages: C++, Python, C, Java
 */

import { cppDijkstra } from './dijkstra/cpp.js';
import { pythonDijkstra } from './dijkstra/python.js';
import { cDijkstra } from './dijkstra/c.js';
import { javaDijkstra } from './dijkstra/java.js';

import { cppKruskal } from './kruskal/cpp.js';
import { pythonKruskal } from './kruskal/python.js';
import { cKruskal } from './kruskal/c.js';
import { javaKruskal } from './kruskal/java.js';

import { cppPrim } from './prim/cpp.js';
import { pythonPrim } from './prim/python.js';
import { cPrim } from './prim/c.js';
import { javaPrim } from './prim/java.js';

import { cppEuler } from './euler/cpp.js';
import { pythonEuler } from './euler/python.js';
import { cEuler } from './euler/c.js';
import { javaEuler } from './euler/java.js';

import { cppHamilton } from './hamilton/cpp.js';
import { pythonHamilton } from './hamilton/python.js';
import { cHamilton } from './hamilton/c.js';
import { javaHamilton } from './hamilton/java.js';

export const CODE_EXAMPLES = {
  dijkstra: {
    cpp: cppDijkstra,
    python: pythonDijkstra,
    c: cDijkstra,
    java: javaDijkstra,
  },
  kruskal: {
    cpp: cppKruskal,
    python: pythonKruskal,
    c: cKruskal,
    java: javaKruskal,
  },
  prim: {
    cpp: cppPrim,
    python: pythonPrim,
    c: cPrim,
    java: javaPrim,
  },
  euler: {
    cpp: cppEuler,
    python: pythonEuler,
    c: cEuler,
    java: javaEuler,
  },
  hamilton: {
    cpp: cppHamilton,
    python: pythonHamilton,
    c: cHamilton,
    java: javaHamilton,
  },
};

export const SUPPORTED_LANGUAGES = [
  { key: 'cpp', name: 'C++', extension: '.cpp' },
  { key: 'python', name: 'Python', extension: '.py' },
  { key: 'c', name: 'C', extension: '.c' },
  { key: 'java', name: 'Java', extension: '.java' },
];

export const SUPPORTED_ALGORITHMS = [
  'dijkstra',
  'kruskal',
  'prim',
  'euler',
  'hamilton',
];

/**
 * Retrieves a complete executable code example with line mapping.
 * 
 * @param {string} [algorithm='dijkstra']
 * @param {string} [language='cpp']
 * @param {Object} [graph=null]
 * @param {Object} [options={}]
 * @returns {Object}
 */
export function getCodeExample(algorithm = 'dijkstra', language = 'cpp', graph = null, options = {}) {
  const algoKey = (algorithm || 'dijkstra').toLowerCase();
  const langKey = (language || 'cpp').toLowerCase();

  const algoGroup = CODE_EXAMPLES[algoKey] || CODE_EXAMPLES.dijkstra;
  const example = algoGroup[langKey] || algoGroup.cpp || algoGroup.python;

  const source = typeof example.generateSource === 'function'
    ? example.generateSource(graph, options)
    : example.source;

  return {
    algorithm: example.algorithm,
    language: example.language,
    filename: example.filename,
    title: example.title,
    mapping: example.mapping,
    source,
    lines: source.split('\n'),
  };
}
