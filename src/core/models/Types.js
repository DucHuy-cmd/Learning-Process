/**
 * @file Types.js
 * Headless Core Engine - Data Model Types and Constants
 * 
 * Defines standard algorithm status, actions, and step/result factories.
 * Completely DOM-independent and UI-agnostic.
 */

/**
 * Standard execution statuses for graph algorithms.
 * @readonly
 * @enum {string}
 */
export const AlgorithmStatus = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  UNSUPPORTED: 'UNSUPPORTED',
  INVALID_INPUT: 'INVALID_INPUT',
  UNREACHABLE: 'UNREACHABLE',
  PARTIAL: 'PARTIAL',
});

/**
 * Standard granular step actions for algorithm tracing and visualization.
 * @readonly
 * @enum {string}
 */
export const AlgorithmAction = Object.freeze({
  INITIALIZE: 'INITIALIZE',
  SELECT_NODE: 'SELECT_NODE',
  INSPECT_EDGE: 'INSPECT_EDGE',
  RELAX_EDGE: 'RELAX_EDGE',
  ACCEPT_EDGE: 'ACCEPT_EDGE',
  REJECT_EDGE: 'REJECT_EDGE',
  VISIT_NODE: 'VISIT_NODE',
  BACKTRACK: 'BACKTRACK',
  FINISH: 'FINISH',
  ERROR: 'ERROR',
});

/**
 * @typedef {Object} AlgorithmStepHighlights
 * @property {string[]} [nodes] - IDs of nodes to highlight
 * @property {string[]} [edges] - IDs of edges to highlight
 */

/**
 * @typedef {Object} AlgorithmStep
 * @property {number} stepNumber - 1-based sequential step index
 * @property {string} action - Action identifier from AlgorithmAction
 * @property {string} description - Human-readable explanation of this step
 * @property {Object} state - Snapshot of algorithm internal state at this step
 * @property {AlgorithmStepHighlights} highlights - Nodes and edges to highlight in UI
 */

/**
 * Creates an immutable-like AlgorithmStep record.
 * @param {Object} options
 * @param {number} options.stepNumber
 * @param {string} options.action
 * @param {string} options.description
 * @param {Object} [options.state]
 * @param {AlgorithmStepHighlights} [options.highlights]
 * @returns {AlgorithmStep}
 */
export function createStep({
  stepNumber,
  action,
  description = '',
  state = {},
  highlights = {},
}) {
  return {
    stepNumber,
    action,
    description,
    state: { ...state },
    highlights: {
      nodes: highlights.nodes ? [...highlights.nodes] : [],
      edges: highlights.edges ? [...highlights.edges] : [],
    },
  };
}

/**
 * @typedef {Object} AlgorithmResult
 * @property {string} status - Execution status from AlgorithmStatus
 * @property {number|null} [totalWeight] - Total path cost, MST weight, etc.
 * @property {string[]} [path] - Ordered node IDs representing final path/circuit
 * @property {AlgorithmStep[]} steps - Chronological array of trace steps
 * @property {Object} [metadata] - Additional metrics (nodeCount, edgeCount, durationMs, etc.)
 */

/**
 * Creates an AlgorithmResult record.
 * @param {Object} options
 * @param {string} options.status
 * @param {number|null} [options.totalWeight]
 * @param {string[]} [options.path]
 * @param {AlgorithmStep[]} [options.steps]
 * @param {Object} [options.metadata]
 * @returns {AlgorithmResult}
 */
export function createResult({
  status,
  totalWeight = null,
  path = [],
  steps = [],
  metadata = {},
}) {
  return {
    status,
    totalWeight,
    path: [...path],
    steps: [...steps],
    metadata: { ...metadata },
  };
}
