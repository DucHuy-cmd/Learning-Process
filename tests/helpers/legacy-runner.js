import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEGACY_HTML_PATH = path.resolve(__dirname, '../../legacy/index.html');
const FALLBACK_HTML_PATH = path.resolve(__dirname, '../../index.html');

/**
 * Creates an isolated JSDOM instance executing the Golden Master legacy/index.html.
 * @param {Object} options
 * @param {Object} options.localStorage Initial localStorage entries
 * @returns {LegacyContext}
 */
export function createLegacyContext(options = {}) {
  const targetPath = fs.existsSync(LEGACY_HTML_PATH) ? LEGACY_HTML_PATH : FALLBACK_HTML_PATH;
  let html = fs.readFileSync(targetPath, 'utf-8');

  // Prevent setTimeout inside legacy script from popping modal during unit tests
  // by intercepting openCustomModal if needed, or letting it run safely.
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
    pretendToBeVisual: true
  });

  const { window } = dom;

  // Initialize any localStorage entries passed via options
  if (options.localStorage) {
    for (const [key, value] of Object.entries(options.localStorage)) {
      window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  const evalInContext = (code) => window.eval(code);

  return {
    window,
    document: window.document,
    localStorage: window.localStorage,
    eval: evalInContext,

    // Preset graphs access
    getPreset: (presetName) => evalInContext(presetName),

    // Graph setup & state
    setupGraph: (graph) => {
      window.setupGraphData(graph);
      return evalInContext('curGraph');
    },
    getCurGraph: () => evalInContext('curGraph'),
    getAdj: () => evalInContext('adj'),
    getEdgeList: () => evalInContext('edgeList'),

    // Algorithm execution
    runDijkstra: (startIndex, endIndex) => window.buildTraceAndMatrix(startIndex, endIndex),
    runKruskal: () => window.buildTraceKruskal(),
    runPrim: (startIndex) => window.buildTracePrim(startIndex),
    runEuler: (startIndex) => window.buildTraceEuler(startIndex),
    runHamilton: (startIndex, wantCycle) => window.buildTraceHamilton(startIndex, wantCycle),

    // Parsers
    parseMatrix: (text, isDirected = false) => window.parseAdjacencyMatrix(text, isDirected),
    parseEdgeList: (text, defaultDirected = false) => window.parseEdgeList(text, defaultDirected),

    // Stepping & Controls (mapped to legacy goto(i) function)
    stepForward: () => evalInContext('goto(stepIdx + 1)'),
    stepBackward: () => evalInContext('goto(stepIdx - 1)'),
    jumpToStep: (idx) => evalInContext(`goto(${idx})`),
    getStepIdx: () => evalInContext('stepIdx'),
    getTrace: () => evalInContext('trace'),
    setStepIdx: (idx) => evalInContext(`stepIdx = ${idx}`),
    setTrace: (tr) => {
      window.__testTrace = tr;
      evalInContext('trace = window.__testTrace');
    },

    // UI state
    getCurrentAlgo: () => evalInContext('currentAlgo'),
    setCurrentAlgo: (algo) => {
      evalInContext(`currentAlgo = ${JSON.stringify(algo)}`);
      window.updateAlgoUI();
    },
    applyTheme: (theme) => window.applyTheme(theme),

    // Tabs
    getTabs: () => evalInContext('openGraphTabs'),
    getActiveTabId: () => evalInContext('activeGraphId'),
    saveUserTabs: () => window.saveUserTabs(),
    loadUserTabs: () => window.loadUserTabs(),
    renderTabs: () => window.renderTabs(),
    closeGraphTab: (id) => window.closeGraphTab(id),
    selectGraphTab: (id) => window.selectGraphTab(id)
  };
}
