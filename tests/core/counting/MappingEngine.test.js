import { describe, it, expect } from 'vitest';
import {
  factorial,
  permutation,
  combination,
  countSurjective,
  MAPPING_PRESETS,
  evaluateMapping,
  generateRandomMapping,
} from '../../../src/core/counting/MappingEngine.js';

describe('MappingEngine - Combinatorics Formulas', () => {
  it('computes factorials correctly', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
    expect(factorial(4)).toBe(24);
    expect(factorial(5)).toBe(120);
    expect(factorial(-1)).toBe(0);
  });

  it('computes permutations correctly', () => {
    expect(permutation(5, 0)).toBe(1);
    expect(permutation(5, 2)).toBe(20);
    expect(permutation(4, 4)).toBe(24);
    expect(permutation(3, 5)).toBe(0);
  });

  it('computes combinations correctly', () => {
    expect(combination(5, 0)).toBe(1);
    expect(combination(5, 2)).toBe(10);
    expect(combination(5, 3)).toBe(10);
    expect(combination(5, 5)).toBe(1);
    expect(combination(4, 6)).toBe(0);
  });

  it('computes surjective count using Stirling / Inclusion-Exclusion', () => {
    // When |X| = |Y| = 3, surjective = 3! = 6
    expect(countSurjective(3, 3)).toBe(6);
    // When |X| = 4, |Y| = 2: 2^4 - 2 = 14
    expect(countSurjective(4, 2)).toBe(14);
    // When |X| = 3, |Y| = 2: 2^3 - 2 = 6
    expect(countSurjective(3, 2)).toBe(6);
    // When |X| < |Y|: 0
    expect(countSurjective(2, 3)).toBe(0);
  });
});

describe('MappingEngine - Presets & Evaluation', () => {
  it('evaluates bijective preset correctly', () => {
    const preset = MAPPING_PRESETS.find(p => p.id === 'bijective_33');
    expect(preset).toBeDefined();

    const result = evaluateMapping({
      domain: preset.domain,
      codomain: preset.codomain,
      edges: preset.edges,
    });

    expect(result.isFunction).toBe(true);
    expect(result.isInjective).toBe(true);
    expect(result.isSurjective).toBe(true);
    expect(result.isBijective).toBe(true);
    expect(result.inverseEdges).toHaveLength(3);
    expect(result.imageSet).toEqual(expect.arrayContaining(['y₁', 'y₂', 'y₃']));
    expect(result.combinatorics.totalFunctions).toBe(27);
    expect(result.combinatorics.totalBijective).toBe(6);
  });

  it('evaluates injective not surjective preset correctly', () => {
    const preset = MAPPING_PRESETS.find(p => p.id === 'injective_not_surjective');
    const result = evaluateMapping({
      domain: preset.domain,
      codomain: preset.codomain,
      edges: preset.edges,
    });

    expect(result.isFunction).toBe(true);
    expect(result.isInjective).toBe(true);
    expect(result.isSurjective).toBe(false);
    expect(result.isBijective).toBe(false);
    expect(result.inverseEdges).toBeNull();
    expect(result.unhitTargets).toContain('y₃');
  });

  it('evaluates surjective not injective preset correctly', () => {
    const preset = MAPPING_PRESETS.find(p => p.id === 'surjective_not_injective');
    const result = evaluateMapping({
      domain: preset.domain,
      codomain: preset.codomain,
      edges: preset.edges,
    });

    expect(result.isFunction).toBe(true);
    expect(result.isInjective).toBe(false);
    expect(result.isSurjective).toBe(true);
    expect(result.isBijective).toBe(false);
    expect(result.duplicatedTargets.length).toBeGreaterThan(0);
  });

  it('detects violation: 1 element maps to 2 targets (not a function)', () => {
    const preset = MAPPING_PRESETS.find(p => p.id === 'not_a_function_multi');
    const result = evaluateMapping({
      domain: preset.domain,
      codomain: preset.codomain,
      edges: preset.edges,
    });

    expect(result.isFunction).toBe(false);
    expect(result.multiMappedElements).toContain('x₁');
    expect(result.functionViolations.length).toBeGreaterThan(0);
    // When not a function, isInjective / isSurjective should be false
    expect(result.isInjective).toBe(false);
    expect(result.isSurjective).toBe(false);
  });

  it('detects violation: unmapped element in domain (not a function)', () => {
    const preset = MAPPING_PRESETS.find(p => p.id === 'not_a_function_missing');
    const result = evaluateMapping({
      domain: preset.domain,
      codomain: preset.codomain,
      edges: preset.edges,
    });

    expect(result.isFunction).toBe(false);
    expect(result.unmappedElements).toContain('x₃');
  });

  it('generates Dirichlet principle note when |X| > |Y|', () => {
    const result = evaluateMapping({
      domain: ['x₁', 'x₂', 'x₃', 'x₄'],
      codomain: ['y₁', 'y₂'],
      edges: [
        { from: 'x₁', to: 'y₁' },
        { from: 'x₂', to: 'y₁' },
        { from: 'x₃', to: 'y₂' },
        { from: 'x₄', to: 'y₂' },
      ],
    });

    expect(result.combinatorics.dirichletNote).toContain('Nguyên lý Dirichlet');
    expect(result.combinatorics.totalInjective).toBe(0);
  });
});

describe('MappingEngine - Random Generators', () => {
  it('generates valid random bijective mapping when |X| = |Y|', () => {
    const domain = ['x₁', 'x₂', 'x₃', 'x₄'];
    const codomain = ['y₁', 'y₂', 'y₃', 'y₄'];
    const edges = generateRandomMapping(domain, codomain, 'bijective');

    const result = evaluateMapping({ domain, codomain, edges });
    expect(result.isFunction).toBe(true);
    expect(result.isBijective).toBe(true);
  });

  it('generates valid random injective mapping when |X| <= |Y|', () => {
    const domain = ['x₁', 'x₂', 'x₃'];
    const codomain = ['y₁', 'y₂', 'y₃', 'y₄', 'y₅'];
    const edges = generateRandomMapping(domain, codomain, 'injective');

    const result = evaluateMapping({ domain, codomain, edges });
    expect(result.isFunction).toBe(true);
    expect(result.isInjective).toBe(true);
  });

  it('generates valid random surjective mapping when |X| >= |Y|', () => {
    const domain = ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'];
    const codomain = ['y₁', 'y₂', 'y₃'];
    const edges = generateRandomMapping(domain, codomain, 'surjective');

    const result = evaluateMapping({ domain, codomain, edges });
    expect(result.isFunction).toBe(true);
    expect(result.isSurjective).toBe(true);
  });
});
