/**
 * @file EdgeListParser.js
 * Headless Core Parser - Edge List Parser
 * 
 * Fully DOM-independent, pure ES Module.
 * Extracted from legacy/index.html (lines 4247–4279).
 * Supports both directed and undirected graphs.
 * 
 * Preserves 100% legacy behavior:
 * - Line filtering (skips empty lines and lines starting with '#' or '//')
 * - Syntax 1: /^([A-Za-z0-9_À-ỹ]+)\s*(?:->|-->|→|=>|<->|↔|[-–—,])\s*([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([-+]?[0-9.]+))?/i
 * - Syntax 2: /^([A-Za-z0-9_À-ỹ]+)\s+([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([-+]?[0-9.]+))?/i
 * - Directed latching: /->|-->|→|=>/.test(line) latches isDirected to true
 * - Preserves BUG-PARSER-001 defect in Syntax 2: missing [:=,] leaves weight undefined, falling back to default 1.0
 * - Weight accepts an optional sign (negative weights, e.g. "B -> C: -4")
 * - Default weight: 1.0 if unspecified or NaN
 * - Node creation: first appearance order in Map
 * - Edge ordering: line encounter order
 * - Unmatched lines: silently skipped
 * - Exact legacy return shape: { nodes, edges, isDirected }
 */

/**
 * Parses an edge list text representation into nodes, edges, and directed flag.
 * 
 * @param {string} text - Raw input text of edge list
 * @param {boolean} [defaultDirected=false] - Initial directed flag before arrow detection
 * @returns {{ nodes: Array<{id: string, name: string, short: string, kind: string}>, edges: Array<[string, string, number]>, isDirected: boolean }}
 */
export function parseEdgeList(text, defaultDirected = false) {
  const lines = text.split("\n");
  const nodeMap = new Map();
  const edges = [];
  let isDirected = !!defaultDirected;

  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) return;
    
    // Cú pháp 1: A -> B: 1 hoặc A - B: 1 hoặc A -> B = 1 hoặc A → B : 1
    let match = line.match(/^([A-Za-z0-9_À-ỹ]+)\s*(?:->|-->|→|=>|<->|↔|[-–—,])\s*([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([-+]?[0-9.]+))?/i);
    
    // Cú pháp 2: A B: 1 hoặc A B 1 (không có dấu -)
    if (!match) {
      match = line.match(/^([A-Za-z0-9_À-ỹ]+)\s+([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([-+]?[0-9.]+))?/i);
    }

    if (match) {
      const u = match[1].trim(), v = match[2].trim();
      const w = (match[3] !== undefined && match[3] !== "") ? parseFloat(match[3]) : 1.0;
      if (!nodeMap.has(u)) nodeMap.set(u, { id: u, name: u, short: u, kind: "phong" });
      if (!nodeMap.has(v)) nodeMap.set(v, { id: v, name: v, short: v, kind: "phong" });
      edges.push([u, v, isNaN(w) ? 1.0 : w]);

      if (/(?<!<)(?:->|-->)|→|=>/.test(line)) {
        isDirected = true;
      }
    }
  });

  return { nodes: Array.from(nodeMap.values()), edges, isDirected };
}

export default parseEdgeList;
