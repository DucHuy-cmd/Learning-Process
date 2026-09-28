import { describe, it, expect } from 'vitest';
import {
  createEmptyMatrix,
  cloneMatrix,
  matrixToPairs,
  pairsToMatrix,
  transposeMatrix,
  booleanMatrixProduct,
  booleanMatrixUnion,
  booleanMatrixIntersection,
  computeDegrees,
  computeCircleLayout,
  computeEdgePath,
  RELATION_PRESETS,
  checkReflexive,
  checkSymmetric,
  checkAntisymmetric,
  checkTransitive,
  checkComparable,
  classifyRelation,
  makeReflexive,
  makeIrreflexive,
  makeSymmetric,
  makeAntisymmetric,
  computeTransitiveClosure,
  computeReflexiveClosure,
  computeSymmetricClosure,
  runWarshallAlgorithm,
  computeEquivalenceClasses,
  computeCoveringRelation,
  computePosetExtremes,
  computeHasseLayout,
  makeEquivalenceClosure,
  makePosetClosure,
} from '../../../src/core/relation/RelationEngine.js';

describe('RelationEngine - Matrix & Pair Operations', () => {
  it('creates empty n x n matrix initialized with 0', () => {
    const m = createEmptyMatrix(3);
    expect(m.length).toBe(3);
    expect(m[0]).toEqual([0, 0, 0]);
    expect(m[1]).toEqual([0, 0, 0]);
    expect(m[2]).toEqual([0, 0, 0]);
  });

  it('correctly converts between Boolean matrix and pair list', () => {
    const elements = ['1', '2', '3'];
    const matrix = [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ];

    const pairs = matrixToPairs(matrix, elements);
    expect(pairs.length).toBe(5);
    expect(pairs).toContainEqual({ from: '1', to: '1', i: 0, j: 0 });
    expect(pairs).toContainEqual({ from: '1', to: '2', i: 0, j: 1 });
    expect(pairs).toContainEqual({ from: '2', to: '2', i: 1, j: 1 });
    expect(pairs).toContainEqual({ from: '2', to: '3', i: 1, j: 2 });
    expect(pairs).toContainEqual({ from: '3', to: '3', i: 2, j: 2 });

    // Convert back to matrix
    const reconstructed = pairsToMatrix(pairs, elements);
    expect(reconstructed).toEqual(matrix);
  });

  it('clones matrix independently without shared references', () => {
    const orig = [[1, 0], [0, 1]];
    const clone = cloneMatrix(orig);
    clone[0][1] = 1;
    expect(orig[0][1]).toBe(0);
    expect(clone[0][1]).toBe(1);
  });

  it('computes matrix transpose M^T (inverse relation)', () => {
    const m = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];
    const trans = transposeMatrix(m);
    expect(trans).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0]
    ]);
  });

  it('computes Boolean matrix product M1 ⊙ M2', () => {
    // A -> B -> C: [[0, 1, 0], [0, 0, 1], [0, 0, 0]]
    const m = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];
    // Product m ⊙ m should give A -> C: [[0, 0, 1], [0, 0, 0], [0, 0, 0]]
    const prod = booleanMatrixProduct(m, m);
    expect(prod).toEqual([
      [0, 0, 1],
      [0, 0, 0],
      [0, 0, 0]
    ]);
  });

  it('computes Boolean matrix union and intersection', () => {
    const m1 = [
      [1, 0],
      [0, 1]
    ];
    const m2 = [
      [0, 1],
      [1, 0]
    ];
    const union = booleanMatrixUnion(m1, m2);
    expect(union).toEqual([
      [1, 1],
      [1, 1]
    ]);

    const inter = booleanMatrixIntersection(m1, m2);
    expect(inter).toEqual([
      [0, 0],
      [0, 0]
    ]);
  });

  it('computes in-degrees, out-degrees and self-loop detection', () => {
    const elements = ['A', 'B', 'C'];
    const matrix = [
      [1, 1, 0], // A: out 2, in 1 (self A)
      [0, 0, 1], // B: out 1, in 1 (from A)
      [1, 0, 1]  // C: out 2, in 2 (from B, self C)
    ];

    const degs = computeDegrees(matrix, elements);
    expect(degs[0]).toEqual({ element: 'A', inDegree: 2, outDegree: 2, hasSelfLoop: true });
    expect(degs[1]).toEqual({ element: 'B', inDegree: 1, outDegree: 1, hasSelfLoop: false });
    expect(degs[2]).toEqual({ element: 'C', inDegree: 2, outDegree: 2, hasSelfLoop: true });
  });
});

describe('RelationEngine - Graph Layout & Geometry', () => {
  it('computes circular positions for nodes with correct bounds', () => {
    const elements = ['1', '2', '3', '4'];
    const pos = computeCircleLayout(elements, 500, 400, 130);

    expect(Object.keys(pos).length).toBe(4);
    expect(pos['1']).toBeDefined();
    expect(pos['1'].x).toBeGreaterThan(0);
    expect(pos['1'].y).toBeGreaterThan(0);

    // Node 1 is at top (12 o'clock, x ≈ 250, y ≈ 400/2 - 130 = 70)
    expect(pos['1'].x).toBe(250);
    expect(pos['1'].y).toBe(70);
  });

  it('generates self-loop SVG cubic Bézier path', () => {
    const src = { x: 250, y: 70 };
    const path = computeEdgePath(src, src, true, false, 22, 250, 200);

    expect(path.startsWith('M ')).toBe(true);
    expect(path).toContain(' C ');
  });

  it('generates straight line path for unidirectional edges', () => {
    const src = { x: 100, y: 100 };
    const tgt = { x: 300, y: 100 };
    const path = computeEdgePath(src, tgt, false, false, 20);

    expect(path).toContain(' L ');
    expect(path).not.toContain(' Q ');
  });

  it('generates curved quadratic Bézier path for bidirectional edges', () => {
    const src = { x: 100, y: 100 };
    const tgt = { x: 300, y: 100 };
    const path = computeEdgePath(src, tgt, false, true, 20);

    expect(path).toContain(' Q ');
  });
});

describe('RelationEngine - Presets', () => {
  it('includes divisibility preset with correct reflexive and partial order properties', () => {
    const p = RELATION_PRESETS.find(x => x.id === 'divisibility');
    expect(p).toBeDefined();
    const m = p.buildMatrix();
    expect(m.length).toBe(5);
    // 1 divides all: row 0 must be all 1s
    expect(m[0]).toEqual([1, 1, 1, 1, 1]);
    // 2 divides 2, 4, 6: row 1
    expect(m[1]).toEqual([0, 1, 0, 1, 1]);
  });

  it('includes equivalence sample with 2 disjoint partitions', () => {
    const p = RELATION_PRESETS.find(x => x.id === 'equivalence_sample');
    expect(p).toBeDefined();
    const m = p.buildMatrix();
    expect(m).toEqual([
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 1, 1],
      [0, 0, 1, 1]
    ]);
  });
});

describe('RelationEngine - 4 Properties & Classification (Tab 2)', () => {
  const elements = ['1', '2', '3'];

  it('checks reflexivity correctly and detects missing self-loops', () => {
    const fullReflexive = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const r1 = checkReflexive(fullReflexive, elements);
    expect(r1.isReflexive).toBe(true);
    expect(r1.isIrreflexive).toBe(false);
    expect(r1.selfLoopCount).toBe(3);
    expect(r1.missingLoops.length).toBe(0);

    const partialReflexive = [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 1]
    ];
    const r2 = checkReflexive(partialReflexive, elements);
    expect(r2.isReflexive).toBe(false);
    expect(r2.missingLoops).toEqual([{ element: '2', index: 1 }]);

    const emptyMatrix = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];
    const r3 = checkReflexive(emptyMatrix, elements);
    expect(r3.isReflexive).toBe(false);
    expect(r3.isIrreflexive).toBe(true);
    expect(r3.missingLoops.length).toBe(3);
  });

  it('checks symmetry correctly and reports counterexample pairs', () => {
    const symmetric = [
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 1]
    ];
    const s1 = checkSymmetric(symmetric, elements);
    expect(s1.isSymmetric).toBe(true);
    expect(s1.violations.length).toBe(0);

    const nonSymmetric = [
      [1, 1, 0],
      [0, 0, 1],
      [0, 0, 1]
    ];
    const s2 = checkSymmetric(nonSymmetric, elements);
    expect(s2.isSymmetric).toBe(false);
    expect(s2.violations).toContainEqual({ from: '1', to: '2', i: 0, j: 1 });
    expect(s2.missingPairs).toContainEqual({ from: '2', to: '1', i: 1, j: 0 });
  });

  it('checks antisymmetry correctly and flags bidirectional cycles between distinct nodes', () => {
    const antisymmetric = [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ];
    const a1 = checkAntisymmetric(antisymmetric, elements);
    expect(a1.isAntisymmetric).toBe(true);
    expect(a1.violations.length).toBe(0);

    const nonAntisymmetric = [
      [1, 1, 0],
      [1, 1, 1],
      [0, 0, 1]
    ];
    const a2 = checkAntisymmetric(nonAntisymmetric, elements);
    expect(a2.isAntisymmetric).toBe(false);
    expect(a2.violations).toEqual([{ a: '1', b: '2', i: 0, j: 1 }]);
  });

  it('checks transitivity correctly and finds missing indirect paths', () => {
    // 1 -> 2 and 2 -> 3 without 1 -> 3
    const intransitive = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];
    const t1 = checkTransitive(intransitive, elements);
    expect(t1.isTransitive).toBe(false);
    expect(t1.violations.length).toBe(1);
    expect(t1.violations[0].x).toBe('1');
    expect(t1.violations[0].y).toBe('2');
    expect(t1.violations[0].z).toBe('3');
    expect(t1.uniqueMissingPairs).toEqual([{ from: '1', to: '3', i: 0, k: 2 }]);

    // Add 1 -> 3 to make it transitive
    const transitive = [
      [0, 1, 1],
      [0, 0, 1],
      [0, 0, 0]
    ];
    const t2 = checkTransitive(transitive, elements);
    expect(t2.isTransitive).toBe(true);
    expect(t2.violations.length).toBe(0);
  });

  it('classifies Equivalence, POSET, Total Order, and Strict Order properly', () => {
    // 1. Equivalence Relation
    const eqPreset = RELATION_PRESETS.find(p => p.id === 'equivalence_sample');
    const eqRes = classifyRelation(eqPreset.buildMatrix(), eqPreset.elements);
    expect(eqRes.isEquivalence).toBe(true);
    expect(eqRes.typeKey).toBe('equivalence');

    // 2. Partial Order (Divisibility on {1, 2, 3, 4, 6})
    const divPreset = RELATION_PRESETS.find(p => p.id === 'divisibility');
    const divRes = classifyRelation(divPreset.buildMatrix(), divPreset.elements);
    expect(divRes.isPartialOrder).toBe(true);
    // Not total order since 2 and 3 do not divide each other
    expect(divRes.isTotalOrder).toBe(false);
    expect(divRes.typeKey).toBe('partial_order');

    // 3. Total Order (Less than or equal <= on {1, 2, 3, 4})
    const lePreset = RELATION_PRESETS.find(p => p.id === 'less_equal');
    const leRes = classifyRelation(lePreset.buildMatrix(), lePreset.elements);
    expect(leRes.isPartialOrder).toBe(true);
    expect(leRes.isTotalOrder).toBe(true);
    expect(leRes.typeKey).toBe('total_order');

    // 4. Strict Partial Order (Strictly less < on {1, 2, 3, 4})
    const strictPreset = RELATION_PRESETS.find(p => p.id === 'strictly_less');
    const strictRes = classifyRelation(strictPreset.buildMatrix(), strictPreset.elements);
    expect(strictRes.isStrictOrder).toBe(true);
    expect(strictRes.typeKey).toBe('strict_order');
  });

  it('executes quick repairs: makeReflexive, makeIrreflexive, makeSymmetric, makeAntisymmetric, computeTransitiveClosure', () => {
    const raw = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];

    // Reflexive repair
    const ref = makeReflexive(raw);
    expect(checkReflexive(ref, elements).isReflexive).toBe(true);

    // Irreflexive repair
    const irref = makeIrreflexive(ref);
    expect(checkReflexive(irref, elements).isIrreflexive).toBe(true);

    // Symmetric repair
    const sym = makeSymmetric(raw);
    expect(checkSymmetric(sym, elements).isSymmetric).toBe(true);

    // Antisymmetric repair on cycle
    const cycle = [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 0]
    ];
    const anti = makeAntisymmetric(cycle);
    expect(checkAntisymmetric(anti, elements).isAntisymmetric).toBe(true);

    // Transitive closure (Roy-Warshall)
    const closure = computeTransitiveClosure(raw);
    expect(checkTransitive(closure, elements).isTransitive).toBe(true);
    expect(closure[0][2]).toBe(1); // 1 -> 3 added
  });
});

describe('RelationEngine - Warshall Algorithm & Closures (Tab 3)', () => {
  const elements = ['1', '2', '3', '4'];

  it('computes reflexive closure r(R) and symmetric closure s(R)', () => {
    const raw = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    const refClosure = computeReflexiveClosure(raw);
    expect(checkReflexive(refClosure, elements).isReflexive).toBe(true);
    expect(refClosure[0][0]).toBe(1);
    expect(refClosure[1][1]).toBe(1);
    expect(refClosure[2][2]).toBe(1);
    expect(refClosure[3][3]).toBe(1);

    const symClosure = computeSymmetricClosure(raw);
    expect(checkSymmetric(symClosure, elements).isSymmetric).toBe(true);
    expect(symClosure[1][0]).toBe(1); // reverse of (0, 1)
    expect(symClosure[2][1]).toBe(1); // reverse of (1, 2)
  });

  it('executes Roy-Warshall algorithm step-by-step on directed cycle 1->2->3->4->1', () => {
    // 1 -> 2 -> 3 -> 4 -> 1
    const cycle = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [1, 0, 0, 0]
    ];

    const warshallResult = runWarshallAlgorithm(cycle, elements);

    // Initial state W0 + 4 steps = 5 steps
    expect(warshallResult.steps.length).toBe(5);
    expect(warshallResult.steps[0].stepIndex).toBe(0);
    expect(warshallResult.steps[0].matrix).toEqual(cycle);

    // Step 1: pivot '1' (index 0). In: 4, Out: 2 -> new edge 4 -> 2
    const step1 = warshallResult.steps[1];
    expect(step1.pivotElement).toBe('1');
    expect(step1.newEdges).toContainEqual({ from: '4', to: '2', i: 3, j: 1 });
    expect(step1.matrix[3][1]).toBe(1);

    // In a directed cycle of 4 vertices, every vertex can reach every vertex (including itself)
    // Final matrix W4 should be all 1s (complete equivalence clique)
    expect(warshallResult.finalMatrix.flat().every(v => v === 1)).toBe(true);
    expect(warshallResult.totalNewEdges).toBe(12); // 16 total - 4 original = 12 added
  });

  it('handles linear chain 1->2->3->4 with Warshall algorithm', () => {
    const chain = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0]
    ];

    const res = runWarshallAlgorithm(chain, elements);
    expect(res.steps.length).toBe(5);

    // In linear chain: (1,2), (1,3), (1,4), (2,3), (2,4), (3,4) must be 1 in final W4
    const finalW = res.finalMatrix;
    expect(finalW[0][1]).toBe(1);
    expect(finalW[0][2]).toBe(1);
    expect(finalW[0][3]).toBe(1);
    expect(finalW[1][2]).toBe(1);
    expect(finalW[1][3]).toBe(1);
    expect(finalW[2][3]).toBe(1);

    // No backwards edges
    expect(finalW[3][0]).toBe(0);
    expect(finalW[2][0]).toBe(0);
  });
});

describe('RelationEngine - Equivalence Classes & Hasse Diagram (Tab 4)', () => {
  it('computes equivalence classes and quotient set correctly on equivalence preset', () => {
    const p = RELATION_PRESETS.find(x => x.id === 'equivalence_sample');
    const eqResult = computeEquivalenceClasses(p.buildMatrix(), p.elements);

    expect(eqResult.isEquivalence).toBe(true);
    expect(eqResult.count).toBe(2);
    expect(eqResult.classes).toEqual([['1', '2'], ['3', '4']]);
    expect(eqResult.quotientSetString).toBe('{ {1, 2}, {3, 4} }');
  });

  it('computes covering relation by eliminating transitive and reflexive edges', () => {
    // Divisibility on {1, 2, 3, 4, 6}:
    // Direct covers:
    // 1 -< 2, 1 -< 3
    // 2 -< 4, 2 -< 6
    // 3 -< 6
    // Note: 1 -> 4 is NOT a covering edge because 1 -> 2 -> 4.
    // 1 -> 6 is NOT a covering edge because 1 -> 2 -> 6.
    const p = RELATION_PRESETS.find(x => x.id === 'divisibility');
    const m = p.buildMatrix();
    const covers = computeCoveringRelation(m, p.elements);

    expect(covers.length).toBe(5);
    expect(covers).toContainEqual({ from: '1', to: '2', fromIdx: 0, toIdx: 1 });
    expect(covers).toContainEqual({ from: '1', to: '3', fromIdx: 0, toIdx: 2 });
    expect(covers).toContainEqual({ from: '2', to: '4', fromIdx: 1, toIdx: 3 });
    expect(covers).toContainEqual({ from: '2', to: '6', fromIdx: 1, toIdx: 4 });
    expect(covers).toContainEqual({ from: '3', to: '6', fromIdx: 2, toIdx: 4 });

    // Verify 1 -> 4 is not in covering relation
    expect(covers.some(c => c.from === '1' && c.to === '4')).toBe(false);
  });

  it('computes POSET extreme elements: minimal, maximal, least, and greatest', () => {
    const p = RELATION_PRESETS.find(x => x.id === 'divisibility');
    const extremes = computePosetExtremes(p.buildMatrix(), p.elements);

    // Divisibility on {1, 2, 3, 4, 6}:
    // 1 divides all: minimal is ['1'], least is '1'
    expect(extremes.minimal).toEqual(['1']);
    expect(extremes.least).toBe('1');

    // 4 and 6 have no multiples in the set: maximal are ['4', '6']
    expect(extremes.maximal).toEqual(['4', '6']);
    // Multiple maximal elements -> no single greatest element
    expect(extremes.greatest).toBeNull();
  });

  it('generates Hasse layout with proper vertical levels', () => {
    const p = RELATION_PRESETS.find(x => x.id === 'divisibility');
    const layout = computeHasseLayout(p.buildMatrix(), p.elements, 500, 360);

    // Level 0: '1'
    expect(layout.positions['1'].level).toBe(0);
    // Level 1: '2', '3'
    expect(layout.positions['2'].level).toBe(1);
    expect(layout.positions['3'].level).toBe(1);
    // Level 2: '4', '6'
    expect(layout.positions['4'].level).toBe(2);
    expect(layout.positions['6'].level).toBe(2);

    // Vertical Y order: Level 0 (bottom, largest Y) > Level 1 > Level 2 (top, smallest Y)
    expect(layout.positions['1'].y).toBeGreaterThan(layout.positions['2'].y);
    expect(layout.positions['2'].y).toBeGreaterThan(layout.positions['4'].y);
  });

  it('creates equivalence closure and poset closure', () => {
    const raw = [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0]
    ];
    const elements = ['1', '2', '3'];

    const eqCl = makeEquivalenceClosure(raw);
    expect(classifyRelation(eqCl, elements).isEquivalence).toBe(true);

    const posetCl = makePosetClosure(raw);
    expect(classifyRelation(posetCl, elements).isPartialOrder).toBe(true);
  });
});



