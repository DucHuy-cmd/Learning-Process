import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { CountingLabView } from '../../src/ui/views/CountingLabView.js';
import { App } from '../../src/ui/app.js';

describe('CountingLabView UI Tests (Mapping Studio)', () => {
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
              <button class="nav-btn" data-view="counting"></button>
            </nav>
          </header>
          <main id="app">
            <div class="app-view active" id="homeView"></div>
            <div class="app-view" id="countingView"></div>
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

  it('renders CountingLabView with all major tabs and default bijective preset', () => {
    const view = new CountingLabView({ container });

    // Check tabs
    expect(container.querySelector('#tabBtnMapping')).not.toBeNull();
    expect(container.querySelector('#tabBtnDirichlet')).not.toBeNull();
    expect(container.querySelector('#tabBtnPascal')).not.toBeNull();
    expect(container.querySelector('#tabBtnRecurrence')).not.toBeNull();

    // Check Mapping controls
    expect(container.querySelector('#selMappingPreset')).not.toBeNull();
    expect(container.querySelector('#btnGenRandom')).not.toBeNull();
    expect(container.querySelector('#btnToggleInverse')).not.toBeNull();
    expect(container.querySelector('#btnClearEdges')).not.toBeNull();

    // Check SVG canvas
    const svg = container.querySelector('.mapping-svg-wrapper svg');
    expect(svg).not.toBeNull();

    // Default preset is bijective 3x3:
    // 3 domain nodes, 3 codomain nodes, 3 arrows
    expect(container.querySelectorAll('.node-domain').length).toBe(3);
    expect(container.querySelectorAll('.node-codomain').length).toBe(3);
    expect(container.querySelectorAll('.arrow-group').length).toBe(3);

    // Verify badges display BIJECTIVE
    expect(container.textContent).toContain('SONG ÁNH');
    expect(container.textContent).toContain('HỢP LỆ');
    expect(container.textContent).toContain('ĐƠN ÁNH');
    expect(container.textContent).toContain('TOÀN ÁNH');
  });

  it('switches educational presets and updates mathematical badges', () => {
    const view = new CountingLabView({ container });
    const selPreset = container.querySelector('#selMappingPreset');

    // Switch to injective not surjective
    selPreset.value = 'injective_not_surjective';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(view.domain.length).toBe(2);
    expect(view.codomain.length).toBe(3);
    expect(container.textContent).toContain('ĐƠN ÁNH');
    expect(container.textContent).toContain('KHÔNG TOÀN ÁNH');
    expect(container.textContent).toContain('KHÔNG SONG ÁNH');

    // Switch to surjective not injective
    selPreset.value = 'surjective_not_injective';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(view.domain.length).toBe(4);
    expect(view.codomain.length).toBe(2);
    expect(container.textContent).toContain('TOÀN ÁNH');
    expect(container.textContent).toContain('KHÔNG ĐƠN ÁNH');
    expect(container.textContent).toContain('Nguyên lý Dirichlet');

    // Switch to violation (not a function)
    selPreset.value = 'not_a_function_multi';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(container.textContent).toContain('VI PHẠM');
    expect(container.textContent).toContain('vi phạm tính duy nhất của hàm số');
  });

  it('allows adding and removing elements in domain and codomain', () => {
    const view = new CountingLabView({ container });

    const btnAddDomain = container.querySelector('#btnAddDomain');
    const btnRemoveDomain = container.querySelector('#btnRemoveDomain');
    const btnAddCodomain = container.querySelector('#btnAddCodomain');

    expect(view.domain.length).toBe(3);

    // Add element to X
    btnAddDomain.click();
    expect(view.domain.length).toBe(4);
    expect(view.domain).toContain('x₄');

    // Add element to Y
    btnAddCodomain.click();
    expect(view.codomain.length).toBe(4);
    expect(view.codomain).toContain('y₄');

    // Remove element from X
    btnRemoveDomain.click();
    expect(view.domain.length).toBe(3);
  });

  it('supports interactive edge creation by clicking domain node then codomain node', () => {
    const view = new CountingLabView({ container });
    const clickNode = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    // Clear all edges first
    const btnClear = container.querySelector('#btnClearEdges');
    btnClear.click();
    expect(view.edges.length).toBe(0);

    // Click first node in X (x₁)
    const firstDomainNode = container.querySelector('.node-domain[data-node-x="x₁"]');
    clickNode(firstDomainNode);
    expect(view.selectedSource).toBe('x₁');

    // Now click node in Y (y₂)
    const targetCodomainNode = container.querySelector('.node-codomain[data-node-y="y₂"]');
    clickNode(targetCodomainNode);

    expect(view.edges).toContainEqual({ from: 'x₁', to: 'y₂' });
    expect(view.edges.length).toBe(1);

    // Re-query updated DOM elements and toggle off
    const updatedDomainNode = container.querySelector('.node-domain[data-node-x="x₁"]');
    const updatedCodomainNode = container.querySelector('.node-codomain[data-node-y="y₂"]');
    clickNode(updatedDomainNode);
    clickNode(updatedCodomainNode);
    expect(view.edges.length).toBe(0);
  });

  it('allows removing edges via delete chips and clear button', () => {
    const view = new CountingLabView({ container });
    expect(view.edges.length).toBe(3);

    // Click remove on the first edge chip
    const removeBtn = container.querySelector('.btn-remove-edge[data-edge-idx="0"]');
    expect(removeBtn).not.toBeNull();
    removeBtn.click();

    expect(view.edges.length).toBe(2);

    // Clear all
    container.querySelector('#btnClearEdges').click();
    expect(view.edges.length).toBe(0);
  });

  it('toggles inverse mapping mode f⁻¹ when bijective', () => {
    const view = new CountingLabView({ container });
    const btnToggleInverse = container.querySelector('#btnToggleInverse');

    expect(view.isInverseActive).toBe(false);
    btnToggleInverse.click();

    expect(view.isInverseActive).toBe(true);
    expect(container.textContent).toContain('Ánh xạ ngược f⁻¹');

    btnToggleInverse.click();
    expect(view.isInverseActive).toBe(false);
  });

  it('generates random mappings correctly', () => {
    const view = new CountingLabView({ container });

    // Bijective random
    const btnBijective = container.querySelector('#btnGenBijective');
    btnBijective.click();
    expect(view.edges.length).toBe(view.domain.length);
    expect(container.textContent).toContain('SONG ÁNH');

    // General random
    const btnRandom = container.querySelector('#btnGenRandom');
    btnRandom.click();
    expect(view.edges.length).toBe(view.domain.length);
  });

  it('switches between top-level tabs and displays full Dirichlet Studio and previews', () => {
    const view = new CountingLabView({ container });

    const btnDirichlet = container.querySelector('#tabBtnDirichlet');
    btnDirichlet.click();
    expect(view.activeTab).toBe('dirichlet');
    expect(container.textContent).toContain('Đấu trường Chuồng bồ câu');

    const btnPascal = container.querySelector('#tabBtnPascal');
    btnPascal.click();
    expect(view.activeTab).toBe('pascal');
    expect(container.textContent).toContain('Tam giác Pascal & Đẳng thức Tổ hợp');

    const btnRecurrence = container.querySelector('#tabBtnRecurrence');
    btnRecurrence.click();
    expect(view.activeTab).toBe('recurrence');
    expect(container.textContent).toContain('Bộ giải Hệ thức truy hồi tuyến tính');

    // Back to mapping
    const btnMapping = container.querySelector('#tabBtnMapping');
    btnMapping.click();
    expect(view.activeTab).toBe('mapping');
  });

  it('renders Dirichlet Studio (Tab 2) with boxes, bounds, and strategy controls', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'dirichlet';
    view.render();

    // Verify sub-tabs
    expect(container.querySelector('#btnDirichletSubArena')).not.toBeNull();
    expect(container.querySelector('#btnDirichletSubProblems')).not.toBeNull();

    // Verify parameter controls
    expect(container.querySelector('#rngDirichletN')).not.toBeNull();
    expect(container.querySelector('#rngDirichletK')).not.toBeNull();

    // Default N=14, k=4
    expect(container.querySelectorAll('.pigeon-box').length).toBe(4);
    expect(container.textContent).toContain('⌈14/4⌉ = 4');
    expect(container.textContent).toContain('⌊14/4⌋ = 3');
    expect(container.textContent).toContain('Nguyên lý Cơ bản (N > k)');
    expect(container.textContent).toContain('ÁP DỤNG ĐƯỢC');
  });

  it('handles parameter adjustments and distribution strategies in Dirichlet Studio', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'dirichlet';
    view.render();

    // Increase N using btnIncN
    const btnIncN = container.querySelector('#btnIncN');
    btnIncN.click();
    expect(view.dirichletN).toBe(15);

    // Increase k using btnIncK
    const btnIncK = container.querySelector('#btnIncK');
    btnIncK.click();
    expect(view.dirichletK).toBe(5);
    expect(container.querySelectorAll('.pigeon-box').length).toBe(5);

    // Click random distribution
    const btnRandom = container.querySelector('#btnDirichletRandom');
    btnRandom.click();
    const sum = view.boxAllocations.reduce((a, b) => a + b, 0);
    expect(sum).toBe(15);

    // Click clear
    const btnClear = container.querySelector('#btnDirichletClear');
    btnClear.click();
    expect(view.dirichletN).toBe(0);
    expect(view.boxAllocations.every(c => c === 0)).toBe(true);

    // Click even
    view.dirichletN = 10;
    view.dirichletK = 3;
    const btnEven = container.querySelector('#btnDirichletEven');
    btnEven.click();
    expect(view.boxAllocations).toEqual([4, 3, 3]);
  });

  it('supports per-box pigeon increment and decrement', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'dirichlet';
    view.render();

    const initialTotal = view.dirichletN;

    // Click + on first box
    const addBtn = container.querySelector('.btn-add-pigeon[data-box-idx="0"]');
    addBtn.click();
    expect(view.boxAllocations[0]).toBeGreaterThan(0);
    expect(view.dirichletN).toBe(initialTotal + 1);

    // Click - on first box
    const removeBtn = container.querySelector('.btn-remove-pigeon[data-box-idx="0"]');
    removeBtn.click();
    expect(view.dirichletN).toBe(initialTotal);
  });

  it('toggles proof by contradiction in Dirichlet Studio', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'dirichlet';
    view.render();

    expect(view.showProof).toBe(false);
    const btnProof = container.querySelector('#btnToggleProof');
    btnProof.click();

    expect(view.showProof).toBe(true);
    expect(container.textContent).toContain('Chứng minh Phản chứng');

    btnProof.click();
    expect(view.showProof).toBe(false);
  });

  it('switches to classic Dirichlet problem solvers and computes solutions', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'dirichlet';
    view.render();

    // Switch to problems sub-tab
    const btnProblems = container.querySelector('#btnDirichletSubProblems');
    btnProblems.click();
    expect(view.dirichletSubTab).toBe('problems');

    // Default scenario is birthday
    expect(container.textContent).toContain('Bài toán Sinh nhật');

    // Switch to socks problem
    const sel = container.querySelector('#selDirichletScenario');
    sel.value = 'socks';
    sel.dispatchEvent(new dom.window.Event('change'));

    expect(view.selectedScenario).toBe('socks');
    expect(container.textContent).toContain('Bài toán Rút tất trong bóng tối');

    // Switch to exam scores
    sel.value = 'exam_scores';
    sel.dispatchEvent(new dom.window.Event('change'));
    expect(container.textContent).toContain('Bài toán Điểm thi Toán rời rạc');

    // Switch to sum of pairs
    sel.value = 'sum_pairs';
    sel.dispatchEvent(new dom.window.Event('change'));
    expect(container.textContent).toContain('Bài toán Cặp số có tổng 2n + 1');
    expect(container.textContent).toContain('Danh sách 5 cặp chuồng');
  });

  it('renders Pascal Studio (Tab 3) with pyramid cells, identities, and cell inspector', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'pascal';
    view.render();

    expect(container.querySelector('#btnPascalSubTriangle')).not.toBeNull();
    expect(container.querySelector('#btnPascalSubGenerators')).not.toBeNull();

    // Default cell (4, 2) is selected
    const selectedCell = container.querySelector('.pascal-cell.selected');
    expect(selectedCell).not.toBeNull();
    expect(selectedCell.getAttribute('data-n')).toBe('4');
    expect(selectedCell.getAttribute('data-k')).toBe('2');
    expect(selectedCell.textContent.trim()).toBe('6');

    // Inspector displays details
    expect(container.textContent).toContain('C(4, 2) = 6');

    // Parent cells are highlighted
    const parentCells = container.querySelectorAll('.pascal-cell.parent-cell');
    expect(parentCells.length).toBe(2);

    // Clicking another cell (e.g. n=3, k=1) updates selection
    const cell31 = container.querySelector('.pascal-cell[data-n="3"][data-k="1"]');
    cell31.click();
    expect(view.pascalSelectedCell).toEqual({ n: 3, k: 1 });
    expect(container.textContent).toContain('C(3, 1) = 3');
  });

  it('supports modulo coloring (Sierpinski Fractal) and row size changes', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'pascal';
    view.render();

    // Change modulo coloring to mod2
    const selMod = container.querySelector('#selPascalMod');
    selMod.value = 'mod2';
    selMod.dispatchEvent(new dom.window.Event('change'));

    expect(view.pascalModColor).toBe('mod2');
    expect(container.querySelectorAll('.pascal-cell.mod-active').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.pascal-cell.mod-inactive').length).toBeGreaterThan(0);

    // Change row size slider
    const rngRows = container.querySelector('#rngPascalRows');
    rngRows.value = '10';
    rngRows.dispatchEvent(new dom.window.Event('input'));

    expect(view.pascalRows).toBe(10);
    expect(container.querySelectorAll('.pascal-row-wrap').length).toBe(11);
  });

  it('switches to lexicographical combinatorial generator and generates configurations', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'pascal';
    view.render();

    // Switch to generators sub-tab
    const btnGen = container.querySelector('#btnPascalSubGenerators');
    btnGen.click();
    expect(view.pascalSubTab).toBe('generators');

    // Default is combination C(4, 2) => 6 configs
    expect(container.textContent).toContain('Tổ hợp không lặp C(4, 2)');
    expect(container.querySelectorAll('.combinatorics-config-badge').length).toBe(6);

    // Switch generator type to permutation
    const selType = container.querySelector('#selGeneratorType');
    selType.value = 'permutation';
    selType.dispatchEvent(new dom.window.Event('change'));

    expect(view.generatorType).toBe('permutation');
    expect(container.textContent).toContain('Hoán vị không lặp P(4)');
    expect(container.querySelectorAll('.combinatorics-config-badge').length).toBe(24);

    // Test stepping next
    expect(view.generatorCurrentStep).toBe(0);
    const btnNext = container.querySelector('#btnGenNext');
    btnNext.click();
    expect(view.generatorCurrentStep).toBe(1);

    // Test clicking a badge directly
    const badge5 = container.querySelector('.combinatorics-config-badge[data-config-idx="4"]');
    badge5.click();
    expect(view.generatorCurrentStep).toBe(4);
  });

  it('switches to recurrence tab and solves linear recurrences (presets, orders, solving)', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'recurrence';
    view.render();

    expect(view.recurrenceSubTab).toBe('solver');
    // Default preset is Fibonacci: aₙ = 1*aₙ₋₁ + 1*aₙ₋₂, a₀ = 0, a₁ = 1
    expect(container.textContent).toContain('aₙ = (1)aₙ₋₁ + (1)aₙ₋₂');
    expect(container.textContent).toContain('Fibonacci');

    // Check presence of sequence terms
    expect(container.textContent).toContain('a0 =');
    expect(container.textContent).toContain('a1 =');

    // Switch preset to Double Root
    const selPreset = container.querySelector('#selRecurrencePreset');
    selPreset.value = 'double_root';
    selPreset.dispatchEvent(new dom.window.Event('change'));

    expect(view.recurrencePresetId).toBe('double_root');
    expect(view.recurrenceC1).toBe(4);
    expect(view.recurrenceC2).toBe(-4);
    expect(container.textContent).toContain('Nghiệm kép');

    // Switch order to Order 1
    const btnOrder1 = container.querySelector('#btnOrder1');
    btnOrder1.click();

    expect(view.recurrenceOrder).toBe(1);
    expect(container.textContent).toContain('Bậc 1 (c)');

    // Custom solve order 1: c = 3, a0 = 2 => a_n = 2 * 3^n
    const inputC1 = container.querySelector('#inputRecC1');
    const inputA0 = container.querySelector('#inputRecA0');
    inputC1.value = '3';
    inputA0.value = '2';

    const btnSolve = container.querySelector('#btnSolveRecurrence');
    btnSolve.click();

    expect(view.recurrenceC1).toBe(3);
    expect(view.recurrenceA0).toBe(2);
    expect(container.textContent).toContain('2 × (3)ⁿ');
  });

  it('switches to Tower of Hanoi simulator and supports stepping, disk updates, and autoplay toggle', () => {
    const view = new CountingLabView({ container });
    view.activeTab = 'recurrence';
    view.render();

    // Switch to Hanoi sub-tab
    const btnHanoi = container.querySelector('#btnRecurrenceSubHanoi');
    btnHanoi.click();

    expect(view.recurrenceSubTab).toBe('hanoi');
    expect(container.textContent).toContain('T(n) = 2ⁿ - 1');
    expect(container.textContent).toContain('Với n = 3 đĩa: Cần đúng 23 - 1 = 7 bước di chuyển!');

    // Initially at step 0
    expect(view.hanoiStep).toBe(0);

    // Step next
    const btnNext = container.querySelector('#btnHanoiNext');
    btnNext.click();
    expect(view.hanoiStep).toBe(1);
    expect(container.textContent).toContain('Bước 1 / 7: Chuyển đĩa [1] từ Cọc A ➔ Cọc C');

    // Step end
    const btnEnd = container.querySelector('#btnHanoiEnd');
    btnEnd.click();
    expect(view.hanoiStep).toBe(7);
    expect(container.textContent).toContain('Hoàn thành xuất sắc!');

    // Step reset
    const btnReset = container.querySelector('#btnHanoiReset');
    btnReset.click();
    expect(view.hanoiStep).toBe(0);

    // Change disk count to 4
    const numN = container.querySelector('#numHanoiN');
    numN.value = '4';
    numN.dispatchEvent(new dom.window.Event('change'));

    expect(view.hanoiN).toBe(4);
    expect(view.hanoiStep).toBe(0);
    expect(container.textContent).toContain('15 bước');

    // Test play/pause toggle
    const btnPlay = container.querySelector('#btnHanoiPlay');
    btnPlay.click();
    expect(view.hanoiIsPlaying).toBe(true);

    // Pause it
    btnPlay.click();
    expect(view.hanoiIsPlaying).toBe(false);
  });

  it('integrates with main App routing to activate countingView', () => {
    const app = new App();
    expect(app.views.counting).toBeDefined();

    app.navigate('counting');
    expect(app.currentView).toBe('counting');
    const countingEl = dom.window.document.getElementById('countingView');
    expect(countingEl.classList.contains('active')).toBe(true);
  });
});

