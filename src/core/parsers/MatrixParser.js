/**
 * @file MatrixParser.js
 * Headless Core Parser - Adjacency Matrix Parser
 * 
 * Fully DOM-independent, pure ES Module.
 * Extracted from legacy/index.html (lines 4153–4244).
 * Supports both directed and undirected graphs.
 * 
 * Preserves 100% legacy behavior:
 * - Header detection (non-numeric, non-inf, non-dash tokens)
 * - Auto-naming: 'A'..'Z' for n <= 26, 'V1'..'Vn' for n > 26
 * - Header length padding and truncation to n
 * - Tokenization by whitespace, commas, semicolons, tabs (/[\s,;\t]+/)
 * - Diagonal skipping (i === j continue, no self-loops)
 * - Undirected symmetric-pair deduplication (row-major order)
 * - No-edge filtering: "0", "-", "inf", "infinity", "∞", <= 0, NaN
 * - Exact legacy Vietnamese error messages
 * - Exact legacy return shape: { nodes, edges } (no isDirected property)
 */

/**
 * Parses an adjacency matrix text representation into nodes and edges.
 * 
 * @param {string} text - Raw input text of adjacency matrix
 * @param {boolean} [isDirected=false] - Whether to parse as directed graph
 * @returns {{ nodes: Array<{id: string, name: string, short: string, kind: string}>, edges: Array<[string, string, number]> }}
 * @throws {Error} If text is empty, no data rows found, or row dimension mismatch occurs
 */
export function parseAdjacencyMatrix(text, isDirected = false) {
  const rawLines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  if (rawLines.length === 0) {
    throw new Error("Vui lòng nhập nội dung ma trận kề!");
  }

  function tokenize(line) {
    return line.trim().split(/[\s,;\t]+/).filter(t => t.length > 0);
  }

  const firstTokens = tokenize(rawLines[0]);
  let nodeNames = [];
  let matrixStartIndex = 0;

  // Kiểm tra nếu dòng 1 là danh sách tên đỉnh
  const isHeaderRow = firstTokens.some(
    t => isNaN(parseFloat(t)) && t.toLowerCase() !== "inf" && t !== "∞" && t !== "-"
  );

  if (isHeaderRow) {
    nodeNames = firstTokens;
    matrixStartIndex = 1;
  } else {
    const numRows = rawLines.length;
    nodeNames = Array.from({ length: numRows }, (_, i) => {
      if (numRows <= 26) return String.fromCharCode(65 + i);
      return "V" + (i + 1);
    });
    matrixStartIndex = 0;
  }

  const matrixRows = [];
  for (let i = matrixStartIndex; i < rawLines.length; i++) {
    const rowTokens = tokenize(rawLines[i]);
    if (rowTokens.length === 0) continue;
    matrixRows.push(rowTokens);
  }

  const n = matrixRows.length;
  if (n === 0) {
    throw new Error("Không tìm thấy các dòng dữ liệu của ma trận kề!");
  }

  if (nodeNames.length < n) {
    for (let i = nodeNames.length; i < n; i++) {
      nodeNames.push(n <= 26 ? String.fromCharCode(65 + i) : "V" + (i + 1));
    }
  } else {
    nodeNames = nodeNames.slice(0, n);
  }

  for (let i = 0; i < n; i++) {
    if (matrixRows[i].length < n) {
      throw new Error(
        `Dòng ${i + 1} của ma trận chỉ có ${matrixRows[i].length} phần tử (cần đủ ${n} phần tử cho ma trận ${n}×${n})!`
      );
    }
  }

  function isNoEdge(valStr) {
    const s = valStr.toLowerCase();
    if (s === "0" || s === "-" || s === "inf" || s === "infinity" || s === "∞") return true;
    const num = parseFloat(s);
    return isNaN(num) || num <= 0;
  }

  const edges = [];
  const addedPair = new Set();

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const valStr = matrixRows[i][j];
      if (!isNoEdge(valStr)) {
        const w = parseFloat(valStr);
        const u = nodeNames[i];
        const v = nodeNames[j];
        if (isDirected) {
          // Với đồ thị có hướng: Mỗi ô matrix[i][j] là cạnh i -> j độc lập, KHÔNG gộp pairKey
          edges.push([u, v, w]);
        } else {
          // Với đồ thị vô hướng: Gộp cặp đối xứng i_j và j_i thành 1 cạnh vô hướng
          const pairKey = i < j ? `${i}_${j}` : `${j}_${i}`;
          if (!addedPair.has(pairKey)) {
            addedPair.add(pairKey);
            edges.push([u, v, w]);
          }
        }
      }
    }
  }

  const nodes = nodeNames.map((name) => ({
    id: name,
    name: name,
    short: name,
    kind: "phong"
  }));

  return { nodes, edges };
}

export default parseAdjacencyMatrix;
