import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { LogicLabView } from '../../src/ui/views/LogicLabView.js';

describe('LogicLabView Integration Tests', () => {
  let dom;
  let container;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="testContainer"></div></body></html>', {
      url: 'http://localhost',
    });
    global.window = dom.window;
    global.document = dom.window.document;
    container = dom.window.document.getElementById('testContainer');
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  it('renders LogicLabView with all major controls', () => {
    const view = new LogicLabView({ container });
    expect(container.querySelector('#tabBtnSingle')).not.toBeNull();
    expect(container.querySelector('#tabBtnEquiv')).not.toBeNull();
    expect(container.querySelector('#tabBtnNormal')).not.toBeNull();
    expect(container.querySelector('#inputLogicSingle')).not.toBeNull();
    expect(container.querySelector('#tableTruthTable')).not.toBeNull();
  });

  it('automatically computes default expression with initial step 0 and renders truth table rows', () => {
    const view = new LogicLabView({ container });
    const rows = container.querySelectorAll('#tableTruthTable tbody tr');
    // Default expression has 3 variables (p, q, r) -> 8 rows
    expect(rows.length).toBe(8);
    expect(view.currentStep).toBe(0);
    expect(container.querySelector('#logicStepCounter').textContent).toBe('0 / 8');
    expect(container.querySelector('#resClassificationBadge').textContent).toContain('Chưa xác định');

    // Jumping to last step reveals full classification
    view.btnLogicLast.click();
    expect(view.currentStep).toBe(8);
    expect(container.querySelector('#resClassificationBadge').textContent).toContain('Hằng đúng');
  });

  it('switches to Equivalence tab and performs equivalence check', () => {
    const view = new LogicLabView({ container });
    view.switchTab('equiv');
    expect(container.querySelector('#paneEquiv').style.display).toBe('block');
    expect(container.querySelector('#paneSingle').style.display).toBe('none');

    // Test equivalence solve
    view.inputEquiv1.value = 'p → q';
    view.inputEquiv2.value = '¬p ∨ q';
    view.solveEquiv();

    expect(container.querySelector('#equivBanner').textContent).toContain('HAI BIỂU THỨC TƯƠNG ĐƯƠNG');
  });

  it('generates random expressions upon clicking random button', () => {
    const view = new LogicLabView({ container });
    const initialExpr = view.inputSingle.value;
    view.btnGenRandomSingle.click();
    const newExpr = view.inputSingle.value;
    expect(newExpr).toBeDefined();
    // Valid table was re-rendered (at least 2 rows for 1+ variables)
    const rows = container.querySelectorAll('#tableTruthTable tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('inserts symbols into input when virtual keypad buttons are clicked', () => {
    const view = new LogicLabView({ container });
    view.inputSingle.value = '';
    const keyAnd = container.querySelector('.btn-key[data-insert=" ∧ "]');
    expect(keyAnd).not.toBeNull();
    keyAnd.click();
    expect(view.inputSingle.value).toContain('∧');
  });

  it('controls truth table playback via step and navigation buttons', () => {
    const view = new LogicLabView({ container });
    expect(view.totalSteps).toBe(8);

    // Jump to first step (0)
    view.btnLogicFirst.click();
    expect(view.currentStep).toBe(0);
    expect(view.logicStepCounter.textContent).toBe('0 / 8');

    // Step next
    view.btnLogicNext.click();
    expect(view.currentStep).toBe(1);
    expect(view.logicStepCounter.textContent).toBe('1 / 8');

    // Step prev
    view.btnLogicPrev.click();
    expect(view.currentStep).toBe(0);

    // Jump to last step
    view.btnLogicLast.click();
    expect(view.currentStep).toBe(8);
    expect(view.logicStepCounter.textContent).toBe('8 / 8');

    // Play button toggle
    view.setStep(0);
    view.btnLogicPlay.click();
    expect(view.isPlaying).toBe(true);
    expect(view.btnLogicPlay.textContent).toBe('⏸ Dừng');

    view.btnLogicPlay.click();
    expect(view.isPlaying).toBe(false);
    expect(view.btnLogicPlay.textContent).toBe('▶ Chạy');
  });

  it('generates random expressions for Normal Forms (DNF / CNF)', () => {
    const view = new LogicLabView({ container });
    view.switchTab('normal');
    expect(container.querySelector('#paneNormal').style.display).toBe('block');

    const initialNormalExpr = view.inputNormal.value;
    view.btnGenRandomNormal.click();
    const newNormalExpr = view.inputNormal.value;
    expect(newNormalExpr).toBeDefined();

    expect(view.dnfFormulaBox.textContent.length).toBeGreaterThan(0);
    expect(view.cnfFormulaBox.textContent.length).toBeGreaterThan(0);
  });

  it('renders and switches to K-Map sub-tab with grid and minimal SOP', () => {
    const view = new LogicLabView({ container });
    view.switchSubTab('kmap');
    expect(container.querySelector('#subPaneKMap').style.display).toBe('block');
    expect(container.querySelector('#subPaneTable').style.display).toBe('none');

    expect(view.kmapGridContainer.innerHTML).toContain('<table');
    expect(view.kmapMinimalSopText.textContent.length).toBeGreaterThan(0);
  });

  it('renders and switches to Logic Circuit sub-tab with SVG and interactive input toggles', () => {
    const view = new LogicLabView({ container });
    view.switchSubTab('circuit');
    expect(container.querySelector('#subPaneCircuit').style.display).toBe('block');
    expect(container.querySelector('#subPaneTable').style.display).toBe('none');

    expect(view.circuitSvgContainer.innerHTML).toContain('<svg');

    // Click interactive input toggle
    const toggleP = container.querySelector('.circuit-input-toggle[data-var="p"]');
    if (toggleP) {
      const prevPVal = view.circuitAssignment.p;
      toggleP.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      expect(view.circuitAssignment.p).toBe(!prevPVal);
    }
  });

  it('loads curated circuit presets and renders corresponding truth table, K-Map, and circuit', () => {
    const view = new LogicLabView({ container });

    // Check all 5 preset buttons exist
    const presets = ['case_and', 'case_or', 'case_xor', 'case_mux', 'case_corners'];
    presets.forEach(id => {
      const btn = container.querySelector(`.btn-circuit-preset[data-preset="${id}"]`);
      expect(btn).not.toBeNull();
    });

    // Test XOR preset
    const xorBtn = container.querySelector('.btn-circuit-preset[data-preset="case_xor"]');
    xorBtn.click();
    expect(view.inputSingle.value).toBe('p ⊕ q');
    expect(view.totalSteps).toBe(4);
    expect(view.currentKMap).toBeDefined();
    expect(view.circuitSvgContainer.innerHTML).toContain('<svg');

    // Test MUX preset
    const muxBtn = container.querySelector('.btn-circuit-preset[data-preset="case_mux"]');
    muxBtn.click();
    expect(view.inputSingle.value).toBe('(¬s ∧ p) ∨ (s ∧ q)');
    expect(view.totalSteps).toBe(8);

    // Test 4 Corners preset
    const cornersBtn = container.querySelector('.btn-circuit-preset[data-preset="case_corners"]');
    cornersBtn.click();
    expect(view.totalSteps).toBe(16);

    // Test Textbook Absorption SGK preset ((x1 ∧ x2) ∨ x1)
    const sgkBtn = container.querySelector('.btn-circuit-preset[data-preset="case_sgk"]');
    expect(sgkBtn).not.toBeNull();
    sgkBtn.click();
    expect(view.inputSingle.value).toBe('(x1 ∧ x2) ∨ x1');
    expect(view.totalSteps).toBe(4);
    expect(view.circuitSvgContainer.innerHTML).toContain('<svg');
    expect(view.circuitSvgContainer.innerHTML).toContain('AND');
    expect(view.circuitSvgContainer.innerHTML).toContain('OR');
  });

  it('renders horizontal splitter between stat cards and sub-tabs, and supports collapse/expand', () => {
    const view = new LogicLabView({ container });

    const splitterH = container.querySelector('#logicSplitterH');
    const upperStatsArea = container.querySelector('#logicUpperStatsArea');
    const statCardsGrid = container.querySelector('#logicStatCardsGrid');
    const subtabsBar = container.querySelector('.result-subtabs-bar');

    expect(splitterH).not.toBeNull();
    expect(splitterH.classList.contains('lab-splitter-h')).toBe(true);
    expect(splitterH.querySelector('.splitter-handle-h')).not.toBeNull();
    expect(upperStatsArea).not.toBeNull();
    expect(statCardsGrid).not.toBeNull();
    expect(subtabsBar).not.toBeNull();

    // Verify ordering: upperStatsArea -> splitterH -> subtabsBar
    expect(upperStatsArea.compareDocumentPosition(splitterH) & 4).toBeTruthy();
    expect(splitterH.compareDocumentPosition(subtabsBar) & 4).toBeTruthy();

    // Initially expanded
    expect(view.isStatsCollapsed).toBe(false);
    expect(statCardsGrid.style.display).not.toBe('none');

    // Double click on splitter collapses stat cards
    splitterH.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
    expect(view.isStatsCollapsed).toBe(true);
    expect(statCardsGrid.style.display).toBe('none');
    expect(splitterH.getAttribute('aria-expanded')).toBe('false');

    // Double click again expands stat cards
    splitterH.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
    expect(view.isStatsCollapsed).toBe(false);
    expect(statCardsGrid.style.display).toBe('grid');
    expect(splitterH.getAttribute('aria-expanded')).toBe('true');

    // Keyboard navigation (ArrowUp collapses, ArrowDown expands)
    splitterH.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(view.isStatsCollapsed).toBe(true);
    expect(statCardsGrid.style.display).toBe('none');

    splitterH.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(view.isStatsCollapsed).toBe(false);
    expect(statCardsGrid.style.display).toBe('grid');
  });
});



