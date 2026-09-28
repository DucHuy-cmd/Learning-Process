/**
 * @file KMapEngine.js
 * Headless Karnaugh Map (K-Map) Solver and Simplifier.
 * 
 * Supports:
 * - 2 variables (2x2 grid)
 * - 3 variables (2x4 grid, Gray code)
 * - 4 variables (4x4 grid, Gray code)
 * - Toroidal wrap-around grouping (edges and 4 corners)
 * - Prime Implicant extraction & Minimal SOP generation
 */

const GRAY_2 = [
  { bits: [0], text: '0', val: 0 },
  { bits: [1], text: '1', val: 1 },
];

const GRAY_4 = [
  { bits: [0, 0], text: '00', val: 0 },
  { bits: [0, 1], text: '01', val: 1 },
  { bits: [1, 1], text: '11', val: 3 },
  { bits: [1, 0], text: '10', val: 2 },
];

/**
 * Builds a Karnaugh Map model from Truth Table result.
 * 
 * @param {Object} truthTableResult
 * @returns {Object} K-Map model
 */
export function buildKMap(truthTableResult) {
  const { variables, rows } = truthTableResult;
  const numVars = variables.length;

  if (numVars < 2 || numVars > 4) {
    throw new Error(`Bìa Karnaugh chỉ hỗ trợ biểu thức có từ 2 đến 4 biến (hiện có ${numVars} biến).`);
  }

  // Create quick lookup from assignment bit string to final truth value
  const assignmentMap = new Map();
  for (const row of rows) {
    const key = variables.map(v => (row.assignment[v] ? '1' : '0')).join('');
    assignmentMap.set(key, Boolean(row.finalValue));
  }

  let rowVars = [];
  let colVars = [];
  let rowGray = [];
  let colGray = [];

  if (numVars === 2) {
    rowVars = [variables[0]]; // p
    colVars = [variables[1]]; // q
    rowGray = GRAY_2;
    colGray = GRAY_2;
  } else if (numVars === 3) {
    rowVars = [variables[0]]; // p
    colVars = [variables[1], variables[2]]; // q, r
    rowGray = GRAY_2;
    colGray = GRAY_4;
  } else if (numVars === 4) {
    rowVars = [variables[0], variables[1]]; // p, q
    colVars = [variables[2], variables[3]]; // r, s
    rowGray = GRAY_4;
    colGray = GRAY_4;
  }

  const numRows = rowGray.length;
  const numCols = colGray.length;

  // Build grid
  const grid = [];
  const mintermCells = []; // Cells with value 1

  for (let r = 0; r < numRows; r++) {
    const gridRow = [];
    for (let c = 0; c < numCols; c++) {
      const rowBits = rowGray[r].bits;
      const colBits = colGray[c].bits;
      const allBits = [...rowBits, ...colBits];
      const bitStr = allBits.join('');

      const assignment = {};
      variables.forEach((v, idx) => {
        assignment[v] = allBits[idx] === 1;
      });

      const value = assignmentMap.get(bitStr) ?? false;
      const cellId = `c_${r}_${c}`;

      const cell = {
        id: cellId,
        row: r,
        col: c,
        bitStr,
        assignment,
        value,
      };

      gridRow.push(cell);
      if (value) {
        mintermCells.push(cell);
      }
    }
    grid.push(gridRow);
  }

  // Find groups (subcubes of size 1, 2, 4, 8, 16)
  const groups = findMinimalGroups(grid, numRows, numCols, variables, mintermCells);

  // Compute minimal SOP expression string
  let minimalSop = '0';
  const groupTerms = [];

  if (mintermCells.length === numRows * numCols) {
    minimalSop = '1 (Hằng đúng)';
  } else if (mintermCells.length === 0) {
    minimalSop = '0 (Hằng sai)';
  } else {
    groups.forEach(g => {
      if (g.term) groupTerms.push(g.term);
    });
    minimalSop = groupTerms.length > 0 ? groupTerms.join(' ∨ ') : '0';
  }

  return {
    numVars,
    variables,
    rowVars,
    colVars,
    rowHeaders: rowGray.map(g => g.text),
    colHeaders: colGray.map(g => g.text),
    grid,
    groups,
    minimalSop,
    groupTerms,
    mintermCount: mintermCells.length,
    totalCells: numRows * numCols,
  };
}

/**
 * Finds prime implicant groups covering all minterm cells.
 */
function findMinimalGroups(grid, numRows, numCols, variables, mintermCells) {
  if (mintermCells.length === 0) return [];
  if (mintermCells.length === numRows * numCols) {
    return [
      {
        id: 'group_all',
        cells: mintermCells.map(c => c.id),
        color: '#10b981',
        term: '1',
        description: 'Tất cả các ô đều là 1 (Hằng đúng)',
      },
    ];
  }

  const possibleSizes = [];
  // Sizes must be powers of 2 dividing dimensions with wrap-around
  const validHeights = [1, 2, 4].filter(h => h <= numRows);
  const validWidths = [1, 2, 4].filter(w => w <= numCols);

  for (const h of validHeights) {
    for (const w of validWidths) {
      possibleSizes.push({ h, w, area: h * w });
    }
  }
  // Sort sizes descending by area (larger groups simplify more variables)
  possibleSizes.sort((a, b) => b.area - a.area);

  const primeImplicants = [];

  for (const { h, w } of possibleSizes) {
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        // Check if group of size h x w starting at (r, c) with wrap is all 1s
        const cells = [];
        let allOnes = true;

        for (let dr = 0; dr < h; dr++) {
          for (let dc = 0; dc < w; dc++) {
            const rr = (r + dr) % numRows;
            const cc = (c + dc) % numCols;
            const cell = grid[rr][cc];
            if (!cell.value) {
              allOnes = false;
              break;
            }
            cells.push(cell);
          }
          if (!allOnes) break;
        }

        if (allOnes) {
          const cellIds = cells.map(c => c.id).sort().join(',');
          // Check if duplicate cell set already in primeImplicants
          if (!primeImplicants.some(p => p.cellIdKey === cellIds)) {
            // Check if sub-group of an already existing larger group
            const isSubset = primeImplicants.some(p =>
              cells.every(c => p.cells.includes(c.id))
            );
            if (!isSubset) {
              const term = extractGroupTerm(cells, variables);
              primeImplicants.push({
                cellIdKey: cellIds,
                cells: cells.map(c => c.id),
                cellObjects: cells,
                h,
                w,
                r,
                c,
                term,
              });
            }
          }
        }
      }
    }
  }

  // Select minimal subset covering all minterm cells (Greedy Set Cover / Essential PIs)
  const uncovered = new Set(mintermCells.map(c => c.id));
  const selectedGroups = [];
  const palette = [
    '#f59e0b', // Amber
    '#38bdf8', // Sky Blue
    '#a855f7', // Purple
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#f97316', // Orange
    '#6366f1', // Indigo
  ];

  // Find Essential Prime Implicants
  for (const mintermId of uncovered) {
    const coveringGroups = primeImplicants.filter(g => g.cells.includes(mintermId));
    if (coveringGroups.length === 1) {
      const essential = coveringGroups[0];
      if (!selectedGroups.includes(essential)) {
        selectedGroups.push(essential);
        essential.cells.forEach(id => uncovered.delete(id));
      }
    }
  }

  // Cover remaining minterms by largest overlap
  while (uncovered.size > 0) {
    let bestGroup = null;
    let maxCover = -1;

    for (const g of primeImplicants) {
      if (selectedGroups.includes(g)) continue;
      const coverCount = g.cells.filter(id => uncovered.has(id)).length;
      if (coverCount > maxCover) {
        maxCover = coverCount;
        bestGroup = g;
      }
    }

    if (!bestGroup || maxCover <= 0) break;
    selectedGroups.push(bestGroup);
    bestGroup.cells.forEach(id => uncovered.delete(id));
  }

  return selectedGroups.map((g, idx) => ({
    id: `group_${idx + 1}`,
    cells: g.cells,
    term: g.term,
    color: palette[idx % palette.length],
    h: g.h,
    w: g.w,
    r: g.r,
    c: g.c,
  }));
}

/**
 * Extracts constant variable literals in a subcube group.
 */
function extractGroupTerm(cells, variables) {
  const parts = [];

  for (const v of variables) {
    const firstVal = cells[0].assignment[v];
    const isConstant = cells.every(c => c.assignment[v] === firstVal);

    if (isConstant) {
      parts.push(firstVal ? v : `¬${v}`);
    }
  }

  if (parts.length === 0) return '1';
  return parts.length > 1 ? `(${parts.join(' ∧ ')})` : parts[0];
}
