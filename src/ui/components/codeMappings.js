/**
 * @file codeMappings.js
 * Algorithm Code Examples and Action-to-Line Mappings
 * 
 * Powered by real, executable source code from the code-examples repository.
 */

import { getCodeExample } from '../../app/code-examples/index.js';

export const ALGORITHM_CODE = {
  dijkstra: getCodeExample('dijkstra', 'cpp'),
  kruskal: getCodeExample('kruskal', 'cpp'),
  prim: getCodeExample('prim', 'cpp'),
  euler: getCodeExample('euler', 'cpp'),
  hamilton: getCodeExample('hamilton', 'cpp'),
};
