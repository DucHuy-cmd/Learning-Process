import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { RelationLabView } from '../../src/ui/views/RelationLabView.js';
import { App } from '../../src/ui/app.js';

describe('RelationLabView UI Tests (Tab 1: Studio Ma trận & Đồ thị Quan hệ)', () => {
  let dom;
  let container;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <header class="app-header">
            <nav class="nav-links">
              <button class="nav-btn active" data-view="home"></button>
              <button class="nav-btn" data-view="theory"></button>
              <button class="nav-btn" data-view="lab"></button>
              <button class="nav-btn" data-view="logic"></button>
              <button class="nav-btn" data-view="counting"></button>
              <button class="nav-btn" data-view="relation"></button>
              <button class="nav-btn" data-view="ai"></button>
              <button class="nav-btn" data-view="quiz"></button>
            </nav>
            <button class="btn-icon" id="btnThemeToggle"></button>
          </header>
          <main id="app">
            <div class="app-view active" id="homeView"></div>
            <div class="app-view" id="theoryView"></div>
            <div class="app-view" id="labView"></div>
            <div class="app-view" id="logicView"></div>
            <div class="app-view" id="countingView"></div>
            <div class="app-view" id="relationView"></div>
            <div class="app-view" id="aiView"></div>
            <div class="app-view" id="quizView"></div>
          </main>
          <div id="testContainer"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
    container = dom.window.document.getElementById('testContainer');
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  it('renders RelationLabView with all major tabs and default divisibility preset', () => {
    const view = new RelationLabView({ container });

    // 4 Chapter Tabs
    expect(container.querySelector('#tabBtnMatrix')).not.toBeNull();
    expect(container.querySelector('#tabBtnProperties')).not.toBeNull();
    expect(container.querySelector('#tabBtnWarshall')).not.toBeNull();
    expect(container.querySelector('#tabBtnHasse')).not.toBeNull();

    // Default Tab 1 is visible
    expect(container.querySelector('#paneMatrix').style.display).toBe('block');
    expect(container.querySelector('#paneProperties').style.display).toBe('none');

    // Controls
    expect(container.querySelector('#selRelationPreset')).not.toBeNull();
    expect(container.querySelector('#btnAddElement')).not.toBeNull();
    expect(container.querySelector('#btnRemoveElement')).not.toBeNull();
    expect(container.querySelector('#btnClearMatrix')).not.toBeNull();
    expect(container.querySelector('#btnFillMatrix')).not.toBeNull();
    expect(container.querySelector('#btnDiagonalToggle')).not.toBeNull();
    expect(container.querySelector('#btnRandomMatrix')).not.toBeNull();

    // Default Divisibility elements: {1, 2, 3, 4, 6} (length 5)
    expect(view.elements).toEqual(['1', '2', '3', '4', '6']);
    const cells = container.querySelectorAll('.relation-matrix-cell');
    expect(cells.length).toBe(25); // 5x5

    // SVG graph nodes
    const nodeGroups = container.querySelectorAll('.relation-node-group');
    expect(nodeGroups.length).toBe(5);

    // Degree items
    const degreeItems = container.querySelectorAll('.relation-workspace-grid:last-of-type span');
    expect(degreeItems.length).toBeGreaterThan(0);
  });

  it('allows switching relation presets and updates elements & matrix accordingly', () => {
    const view = new RelationLabView({ container });
    const selPreset = container.querySelector('#selRelationPreset');

    // Switch to less_equal (<= on {1, 2, 3, 4})
    selPreset.value = 'less_equal';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(view.elements).toEqual(['1', '2', '3', '4']);
    expect(container.querySelectorAll('.relation-matrix-cell').length).toBe(16);
    expect(container.querySelectorAll('.relation-node-group').length).toBe(4);

    // Switch to directed_cycle
    selPreset.value = 'directed_cycle';
    selPreset.dispatchEvent(new dom.window.Event('change'));
    expect(view.elements).toEqual(['1', '2', '3', '4']);

    // Check edges count in cycle: 4 edges (1->2, 2->3, 3->4, 4->1)
    const chips = container.querySelectorAll('.relation-pair-chip');
    expect(chips.length).toBe(4);
  });

  it('handles adding and removing elements within bounds [2, 6]', () => {
    const view = new RelationLabView({ container });
    const selPreset = container.querySelector('#selRelationPreset');
    selPreset.value = 'less_equal'; // starts at 4 elements
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(view.elements.length).toBe(4);

    // Add 1 element -> 5
    const btnAdd = container.querySelector('#btnAddElement');
    btnAdd.click();
    expect(view.elements.length).toBe(5);
    expect(container.querySelectorAll('.relation-matrix-cell').length).toBe(25);

    // Add another -> 6
    btnAdd.click();
    expect(view.elements.length).toBe(6);
    expect(container.querySelectorAll('.relation-matrix-cell').length).toBe(36);

    // Try to exceed 6 -> should be clamped / disabled
    btnAdd.click();
    expect(view.elements.length).toBe(6);

    // Remove elements down to 2
    const btnRemove = container.querySelector('#btnRemoveElement');
    btnRemove.click(); // 5
    btnRemove.click(); // 4
    btnRemove.click(); // 3
    btnRemove.click(); // 2
    expect(view.elements.length).toBe(2);
    expect(container.querySelectorAll('.relation-matrix-cell').length).toBe(4);

    // Try to remove below 2 -> should be clamped
    btnRemove.click();
    expect(view.elements.length).toBe(2);
  });

  it('supports quick matrix actions: Clear, Fill, Toggle diagonal, and Random', () => {
    const view = new RelationLabView({ container });

    // 1. Clear Matrix
    const btnClear = container.querySelector('#btnClearMatrix');
    btnClear.click();
    expect(view.matrix.flat().every(v => v === 0)).toBe(true);
    expect(container.querySelectorAll('.relation-pair-chip').length).toBe(0);

    // 2. Fill Matrix
    const btnFill = container.querySelector('#btnFillMatrix');
    btnFill.click();
    expect(view.matrix.flat().every(v => v === 1)).toBe(true);
    expect(container.querySelectorAll('.relation-pair-chip').length).toBe(25);

    // 3. Toggle Diagonal (currently all 1 -> becomes all 0)
    const btnDiagonal = container.querySelector('#btnDiagonalToggle');
    btnDiagonal.click();
    for (let i = 0; i < view.elements.length; i++) {
      expect(view.matrix[i][i]).toBe(0);
    }

    // Toggle Diagonal again (not all 1 -> becomes all 1)
    btnDiagonal.click();
    for (let i = 0; i < view.elements.length; i++) {
      expect(view.matrix[i][i]).toBe(1);
    }

    // 4. Random Matrix
    const btnRandom = container.querySelector('#btnRandomMatrix');
    btnRandom.click();
    expect(view.matrix.length).toBe(view.elements.length);
    expect(view.matrix[0].length).toBe(view.elements.length);
  });

  it('toggles matrix cell value on click and updates pair chips', () => {
    const view = new RelationLabView({ container });
    // Clear first to test clean toggle 0 -> 1 -> 0
    container.querySelector('#btnClearMatrix').click();
    expect(container.querySelectorAll('.relation-pair-chip').length).toBe(0);

    // Find cell (0, 1) and click
    const cell01 = container.querySelector('.relation-matrix-cell[data-i="0"][data-j="1"]');
    expect(cell01).not.toBeNull();
    cell01.click();

    expect(view.matrix[0][1]).toBe(1);
    let chips = container.querySelectorAll('.relation-pair-chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('(1, 2)');

    // Click again to toggle back to 0
    const updatedCell01 = container.querySelector('.relation-matrix-cell[data-i="0"][data-j="1"]');
    updatedCell01.click();
    expect(view.matrix[0][1]).toBe(0);
    chips = container.querySelectorAll('.relation-pair-chip');
    expect(chips.length).toBe(0);
  });

  it('removes relation pair when clicking the delete button on a chip', () => {
    const view = new RelationLabView({ container });
    const initialPairsCount = container.querySelectorAll('.relation-pair-chip').length;
    expect(initialPairsCount).toBeGreaterThan(0);

    const firstChipRemoveBtn = container.querySelector('.btn-remove-pair');
    const i = parseInt(firstChipRemoveBtn.getAttribute('data-i'), 10);
    const j = parseInt(firstChipRemoveBtn.getAttribute('data-j'), 10);

    expect(view.matrix[i][j]).toBe(1);
    firstChipRemoveBtn.click();

    expect(view.matrix[i][j]).toBe(0);
    const newPairsCount = container.querySelectorAll('.relation-pair-chip').length;
    expect(newPairsCount).toBe(initialPairsCount - 1);
  });

  it('supports interactive graph edge creation by clicking source node then target node', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#btnClearMatrix').click();

    // 1. Click Node 1 ('1' is index 0)
    const node1 = container.querySelector('.relation-node-group[data-element="1"]');
    node1.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    expect(view.selectedSource).toBe('1');
    expect(container.querySelector('#btnCancelGraphSelection')).not.toBeNull();

    // 2. Click Node 2 ('2' is index 1)
    const node2 = container.querySelector('.relation-node-group[data-element="2"]');
    node2.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    // Selection resets, matrix[0][1] should be 1
    expect(view.selectedSource).toBeNull();
    expect(view.matrix[0][1]).toBe(1);

    // 3. Selection cancellation
    const node3 = container.querySelector('.relation-node-group[data-element="3"]');
    node3.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(view.selectedSource).toBe('3');

    const btnCancel = container.querySelector('#btnCancelGraphSelection');
    btnCancel.click();
    expect(view.selectedSource).toBeNull();
  });

  it('deletes an edge when clicking on an SVG edge group', () => {
    const view = new RelationLabView({ container });
    const edgeGroup = container.querySelector('.relation-edge-group');
    expect(edgeGroup).not.toBeNull();

    const i = parseInt(edgeGroup.getAttribute('data-i'), 10);
    const j = parseInt(edgeGroup.getAttribute('data-j'), 10);
    expect(view.matrix[i][j]).toBe(1);

    edgeGroup.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(view.matrix[i][j]).toBe(0);
  });

  it('switches between Chapter 4 tabs seamlessly', () => {
    const view = new RelationLabView({ container });

    // Click Tab 2
    container.querySelector('#tabBtnProperties').click();
    expect(view.activeTab).toBe('properties');
    expect(container.querySelector('#paneProperties').style.display).toBe('block');
    expect(container.querySelector('#paneMatrix').style.display).toBe('none');

    // Click Tab 3
    container.querySelector('#tabBtnWarshall').click();
    expect(view.activeTab).toBe('warshall');
    expect(container.querySelector('#paneWarshall').style.display).toBe('block');

    // Click Tab 4
    container.querySelector('#tabBtnHasse').click();
    expect(view.activeTab).toBe('hasse');
    expect(container.querySelector('#paneHasse').style.display).toBe('block');

    // Return to Tab 1
    container.querySelector('#tabBtnMatrix').click();
    expect(view.activeTab).toBe('matrix');
    expect(container.querySelector('#paneMatrix').style.display).toBe('block');
  });

  it('integrates with main App router to navigate to relation view', () => {
    const app = new App();
    expect(app.views.relation).toBeInstanceOf(RelationLabView);

    app.navigate('relation');
    expect(app.currentView).toBe('relation');

    const relViewEl = dom.window.document.getElementById('relationView');
    expect(relViewEl.classList.contains('active')).toBe(true);
  });

  // =========================================================================
  // TAB 2: PROPERTY INSPECTOR & CLASSIFICATION TESTS
  // =========================================================================

  it('renders Tab 2 Property Inspector with 4 cards and correct classification banner', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnProperties').click();

    expect(view.activeTab).toBe('properties');
    expect(container.querySelector('#paneProperties').style.display).toBe('block');

    // Title should classify default Divisibility as Partial Order
    const title = container.querySelector('#relationClassificationTitle');
    expect(title).not.toBeNull();
    expect(title.textContent).toContain('Thứ tự Bộ phận');

    // 4 Property cards
    expect(container.querySelector('#cardReflexive')).not.toBeNull();
    expect(container.querySelector('#cardSymmetric')).not.toBeNull();
    expect(container.querySelector('#cardAntisymmetric')).not.toBeNull();
    expect(container.querySelector('#cardTransitive')).not.toBeNull();

    // Reflexive is achieved for Divisibility
    expect(container.querySelector('#cardReflexive .card-status-badge').textContent).toContain('Đạt');
    // Symmetric is NOT achieved for Divisibility
    expect(container.querySelector('#cardSymmetric .card-status-badge').textContent).toContain('Không đạt');
    // Antisymmetric is achieved
    expect(container.querySelector('#cardAntisymmetric .card-status-badge').textContent).toContain('Đạt');
    // Transitive is achieved
    expect(container.querySelector('#cardTransitive .card-status-badge').textContent).toContain('Đạt');
  });

  it('updates classification banner dynamically when changing preset in Tab 2', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnProperties').click();

    const selPreset = container.querySelector('#selPropertiesPreset');
    expect(selPreset).not.toBeNull();

    // Switch to equivalence_sample
    selPreset.value = 'equivalence_sample';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    const title = container.querySelector('#relationClassificationTitle');
    expect(title.textContent).toContain('Quan hệ Tương đương');

    // All 3 badges (Reflexive, Symmetric, Transitive) should be active
    const badges = container.querySelector('#relationPropertiesBadges');
    expect(badges.querySelector('.prop-reflexive').textContent).toContain('✓ Phản xạ');
    expect(badges.querySelector('.prop-symmetric').textContent).toContain('✓ Đối xứng');
    expect(badges.querySelector('.prop-transitive').textContent).toContain('✓ Bắc cầu');
  });

  it('executes quick repairs in Tab 2 and instantly reflects in properties', () => {
    const view = new RelationLabView({ container });
    // Switch to directed_cycle in Tab 1 then go to Tab 2
    container.querySelector('#btnClearMatrix').click(); // empty matrix
    container.querySelector('#tabBtnProperties').click();

    // Empty matrix is not reflexive
    expect(container.querySelector('#cardReflexive .card-status-badge').textContent).toContain('Phi phản xạ');

    // Click Make Reflexive
    const btnReflexive = container.querySelector('#btnMakeReflexive');
    btnReflexive.click();
    expect(container.querySelector('#cardReflexive .card-status-badge').textContent).toContain('Đạt ✅');

    // Now make it symmetric
    // Add an edge (0, 1) manually
    view.matrix[0][1] = 1;
    view.render();
    expect(container.querySelector('#cardSymmetric .card-status-badge').textContent).toContain('Không đạt ❌');

    const btnSymmetric = container.querySelector('#btnMakeSymmetric');
    btnSymmetric.click();
    expect(container.querySelector('#cardSymmetric .card-status-badge').textContent).toContain('Đạt ✅');

    // Now test transitive repair
    view.matrix[1][2] = 1; // 0->1, 1->2 exists, but 0->2 doesn't exist
    view.render();
    const btnTransitive = container.querySelector('#btnMakeTransitive');
    btnTransitive.click();
    expect(container.querySelector('#cardTransitive .card-status-badge').textContent).toContain('Đạt ✅');
    expect(view.matrix[0][2]).toBe(1);
  });

  it('supports interactive self-quiz mode and scoring', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnProperties').click();

    // Start Quiz
    const btnStart = container.querySelector('#btnStartQuiz');
    btnStart.click();

    expect(view.quizMode).toBe(true);
    expect(container.querySelector('#chkQuizReflexive')).not.toBeNull();
    expect(container.querySelector('#chkQuizSymmetric')).not.toBeNull();
    expect(container.querySelector('#chkQuizAntisymmetric')).not.toBeNull();
    expect(container.querySelector('#chkQuizTransitive')).not.toBeNull();

    // In default divisibility:
    // Reflexive: YES, Symmetric: NO, Antisymmetric: YES, Transitive: YES
    const chkRef = container.querySelector('#chkQuizReflexive');
    const chkAnti = container.querySelector('#chkQuizAntisymmetric');
    const chkTrans = container.querySelector('#chkQuizTransitive');

    chkRef.checked = true;
    chkAnti.checked = true;
    chkTrans.checked = true;

    // Submit quiz
    const btnSubmit = container.querySelector('#btnSubmitQuiz');
    btnSubmit.click();

    expect(view.quizSubmitted).toBe(true);
    const scoreText = container.querySelector('#quizScoreText');
    expect(scoreText).not.toBeNull();
    expect(scoreText.textContent).toContain('4 / 4');

    // Exit quiz
    const btnExit = container.querySelector('#btnExitQuiz');
    btnExit.click();
    expect(view.quizMode).toBe(false);
    expect(container.querySelector('#relationClassificationTitle')).not.toBeNull();
  });

  // =========================================================================
  // TAB 3: WARSHALL STEPPER & CLOSURES STUDIO TESTS
  // =========================================================================

  it('renders Tab 3 Warshall Studio with stepper controls and step 0 initial state', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnWarshall').click();

    expect(view.activeTab).toBe('warshall');
    expect(container.querySelector('#paneWarshall').style.display).toBe('block');

    // Controls
    expect(container.querySelector('#btnWarshallFirst')).not.toBeNull();
    expect(container.querySelector('#btnWarshallPrev')).not.toBeNull();
    expect(container.querySelector('#btnWarshallPlay')).not.toBeNull();
    expect(container.querySelector('#btnWarshallNext')).not.toBeNull();
    expect(container.querySelector('#btnWarshallLast')).not.toBeNull();

    // Step indicator & matrix title at step 0
    expect(container.querySelector('#warshallStepIndicator').textContent).toContain('Bước 0');
    expect(container.querySelector('#warshallMatrixTitle').textContent).toContain('W_0');
  });

  it('steps forward and backward through Warshall algorithm', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnWarshall').click();

    const btnNext = container.querySelector('#btnWarshallNext');
    btnNext.click();
    expect(view.warshallStep).toBe(1);
    expect(container.querySelector('#warshallStepIndicator').textContent).toContain('Bước 1');
    expect(container.querySelector('#warshallMatrixTitle').textContent).toContain('W_1');

    // Jump to last step
    const btnLast = container.querySelector('#btnWarshallLast');
    btnLast.click();
    expect(view.warshallStep).toBe(view.elements.length);
    expect(container.querySelector('#warshallStepIndicator').textContent).toContain(`Bước ${view.elements.length}`);

    // Jump back to first step
    const btnFirst = container.querySelector('#btnWarshallFirst');
    btnFirst.click();
    expect(view.warshallStep).toBe(0);
  });

  it('applies Warshall transitive closure to the active lab relation', () => {
    const view = new RelationLabView({ container });
    // Switch to directed_cycle
    const selPreset = container.querySelector('#selRelationPreset');
    selPreset.value = 'directed_cycle';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    container.querySelector('#tabBtnWarshall').click();

    // In directed cycle, W_n is complete clique (all 1s)
    const btnApply = container.querySelector('#btnApplyWarshallToLab');
    btnApply.click();

    // Should switch back to matrix tab and matrix is all 1s
    expect(view.activeTab).toBe('matrix');
    expect(view.matrix.flat().every(v => v === 1)).toBe(true);
  });

  it('switches to Closures comparison subtab and applies closures', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnWarshall').click();

    const btnClosuresSubtab = container.querySelector('#btnSubtabClosures');
    btnClosuresSubtab.click();
    expect(view.activeWarshallSubtab).toBe('closures');

    // Check 3 closure buttons
    expect(container.querySelector('#btnApplyReflexiveClosure')).not.toBeNull();
    expect(container.querySelector('#btnApplySymmetricClosure')).not.toBeNull();
    expect(container.querySelector('#btnApplyTransitiveClosure')).not.toBeNull();

    // Set 4 elements and 4x4 matrix to test reflexive closure
    view.elements = ['1', '2', '3', '4'];
    view.matrix = [
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    view.render();

    const btnApplyRef = container.querySelector('#btnApplyReflexiveClosure');
    btnApplyRef.click();
    // Diagonal should now be 1s
    for (let i = 0; i < view.elements.length; i++) {
      expect(view.matrix[i][i]).toBe(1);
    }
  });

  // =========================================================================
  // TAB 4: EQUIVALENCE CLASSES & HASSE DIAGRAM UI TESTS
  // =========================================================================

  it('renders Tab 4 Hasse studio with subtabs and POSET extremes analysis', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnHasse').click();

    expect(view.activeTab).toBe('hasse');
    expect(container.querySelector('#paneHasse').style.display).toBe('block');
    expect(container.querySelector('#btnSubtabHasse')).not.toBeNull();
    expect(container.querySelector('#btnSubtabEquivalence')).not.toBeNull();

    // Default is divisibility on {1, 2, 3, 4, 6} -> Valid POSET
    expect(container.querySelector('#posetMinimalElements').textContent).toContain('1');
    expect(container.querySelector('#posetMaximalElements').textContent).toContain('4');
    expect(container.querySelector('#posetMaximalElements').textContent).toContain('6');
    expect(container.querySelector('#posetLeastElement').textContent).toContain('1');
    expect(container.querySelector('#posetGreatestElement').textContent).toContain('Không tồn tại');

    // Covering chips (1 ≺ 2, 1 ≺ 3, 2 ≺ 4, 2 ≺ 6, 3 ≺ 6) -> 5 edges
    const coveringChips = container.querySelectorAll('.hasse-covering-chip');
    expect(coveringChips.length).toBe(5);

    // Hasse SVG nodes and edges
    const nodes = container.querySelectorAll('.hasse-node-group');
    expect(nodes.length).toBe(5);
    const edges = container.querySelectorAll('.hasse-edge');
    expect(edges.length).toBe(5);
  });

  it('switches to Chain (Total order) preset and verifies unique least and greatest elements', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnHasse').click();

    const btnChain = container.querySelector('#btnHassePresetChain');
    btnChain.click();

    expect(view.elements).toEqual(['1', '2', '3', '4']);
    expect(container.querySelector('#posetMinimalElements').textContent).toContain('1');
    expect(container.querySelector('#posetMaximalElements').textContent).toContain('4');
    expect(container.querySelector('#posetLeastElement').textContent).toContain('1');
    expect(container.querySelector('#posetGreatestElement').textContent).toContain('4');
  });

  it('detects non-POSET relations and repairs them with 1-click POSET closure', () => {
    const view = new RelationLabView({ container });
    // Switch to directed_cycle which is not a POSET
    const selPreset = container.querySelector('#selRelationPreset');
    selPreset.value = 'directed_cycle';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    const btn = container.querySelector('#tabBtnHasse');
    btn.click();

    // Banner alert should warn not POSET
    expect(container.textContent).toContain('CHƯA PHẢI là Thứ tự Một phần (POSET)');
    const btnAutoPoset = container.querySelector('#btnAutoMakePoset');
    expect(btnAutoPoset).not.toBeNull();

    // Click auto make poset
    btnAutoPoset.click();

    // Now it should be a valid POSET
    expect(container.textContent).toContain('Quan hệ Thứ tự Một phần (POSET) Hợp lệ!');
  });

  it('switches to Equivalence Classes subtab and verifies partition cards and quotient set', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnHasse').click();

    // Switch to equivalence subtab
    const btnEquiv = container.querySelector('#btnSubtabEquivalence');
    btnEquiv.click();
    expect(view.activeTab4Subtab).toBe('equivalence');

    // Click modulo 3 preset
    const btnMod3 = container.querySelector('#btnEquivPresetMod3');
    btnMod3.click();

    expect(view.elements.length).toBe(6);
    expect(container.querySelector('#quotientClassCount').textContent).toBe('3');

    const cards = container.querySelectorAll('.equivalence-class-card');
    expect(cards.length).toBe(3);

    // Verify quotient set formula displays
    const formula = container.querySelector('#quotientSetFormula');
    expect(formula.textContent).toContain('A / R =');
    expect(formula.textContent).toContain('{1, 4}');
    expect(formula.textContent).toContain('{2, 5}');
    expect(formula.textContent).toContain('{3, 6}');
  });

  it('detects non-equivalence relations and repairs them with 1-click Equivalence closure', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnHasse').click();
    container.querySelector('#btnSubtabEquivalence').click();

    // Load divisibility preset (not symmetric, so not equivalence)
    const btnDiv = container.querySelector('#btnHassePresetDivisibility');
    btnDiv.click();

    expect(container.textContent).toContain('CHƯA PHẢI là Quan hệ Tương đương');
    const btnAutoEquiv = container.querySelector('#btnAutoMakeEquivalence');
    expect(btnAutoEquiv).not.toBeNull();

    // Click auto make equivalence
    btnAutoEquiv.click();

    expect(container.textContent).toContain('Quan hệ Tương đương Hợp lệ!');
  });

  it('highlights covering edges on node mouseenter and restores on mouseleave', () => {
    const view = new RelationLabView({ container });
    container.querySelector('#tabBtnHasse').click();

    const node1 = container.querySelector('.hasse-node-group[data-element="1"]');
    expect(node1).not.toBeNull();

    // Trigger mouseenter
    node1.dispatchEvent(new dom.window.Event('mouseenter'));
    expect(view.hasseHoveredNode).toBe('1');

    // Edges connected to 1 should have stroke-opacity 1
    const edgeFrom1 = container.querySelector('.hasse-edge[data-from="1"]');
    expect(edgeFrom1.getAttribute('stroke-opacity')).toBe('1');

    // Trigger mouseleave
    node1.dispatchEvent(new dom.window.Event('mouseleave'));
    expect(view.hasseHoveredNode).toBeNull();
    expect(edgeFrom1.getAttribute('stroke-opacity')).toBe('0.85');
  });
});


