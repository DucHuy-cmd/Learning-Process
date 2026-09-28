/**
 * @file AiAssistantView.test.js
 * Unit test suite for AiAssistantView and AiKnowledgeEngine with Lab Bridge.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { AiAssistantView } from '../../src/ui/views/AiAssistantView.js';
import { AiKnowledgeEngine } from '../../src/core/ai/AiKnowledgeEngine.js';
import { aiHistoryManager } from '../../src/core/ai/AiHistoryManager.js';

describe('AiKnowledgeEngine (Academic Discrete Math Engine)', () => {
  let engine;

  beforeEach(() => {
    engine = new AiKnowledgeEngine();
  });

  it('handles empty query gracefully with introductory response', async () => {
    const res = await engine.ask('');
    expect(res.text).toContain('Toán Rời Rạc');
    expect(res.isFromApi).toBe(false);
  });

  it('generates Dijkstra shortest path reasoning with graph Lab Bridge action', async () => {
    const res = await engine.ask('Giải thích thuật toán Dijkstra và cho đồ thị mẫu');
    expect(res.text).toContain('Dijkstra');
    expect(res.text).toContain('giãn cạnh');
    expect(res.labAction).toBeDefined();
    expect(res.labAction.type).toBe('graph');
    expect(res.labAction.algo).toBe('dijkstra');
    expect(res.labAction.graphSpec.nodes.length).toBeGreaterThan(0);
    expect(res.labAction.graphSpec.edges.length).toBeGreaterThan(0);
  });

  it('generates Minimum Spanning Tree reasoning with Prim/Kruskal action', async () => {
    const res = await engine.ask('So sánh Prim và Kruskal tìm cây khung nhỏ nhất');
    expect(res.text).toContain('Kruskal');
    expect(res.text).toContain('Prim');
    expect(res.labAction).toBeDefined();
    expect(res.labAction.type).toBe('graph');
    expect(['prim', 'kruskal']).toContain(res.labAction.algo);
  });

  it('generates Euler/Hamilton graph reasoning with Euler action', async () => {
    const res = await engine.ask('Đồ thị có chu trình Euler khi nào?');
    expect(res.text).toContain('Euler');
    expect(res.text).toContain('bậc chẵn');
    expect(res.labAction.type).toBe('graph');
    expect(res.labAction.algo).toBe('euler');
  });

  it('generates Truth Table analysis with logic action', async () => {
    const res = await engine.ask('Lập bảng chân trị phân tích hằng đúng');
    expect(res.text).toContain('Bảng chân trị');
    expect(res.text).toContain('Hằng đúng');
    expect(res.labAction.type).toBe('logic');
    expect(res.labAction.subtab).toBe('table');
    expect(res.labAction.expr).toBeDefined();
  });

  it('generates Karnaugh Map reasoning with kmap subtab action', async () => {
    const res = await engine.ask('Hướng dẫn rút gọn hàm Boole bằng K-Map 4 biến');
    expect(res.text).toContain('Karnaugh');
    expect(res.text).toContain('Gray');
    expect(res.labAction.type).toBe('logic');
    expect(res.labAction.subtab).toBe('kmap');
  });

  it('generates 2-variable Karnaugh Map when requested', async () => {
    const res = await engine.ask('tạo 2 biến bìa K');
    expect(res.text).toContain('2 Biến');
    expect(res.labAction.type).toBe('logic');
    expect(res.labAction.subtab).toBe('kmap');
    expect(res.labAction.title).toContain('2 biến');
    expect(res.labAction.expr).toBe('(~a & b) | (a & ~b)');
  });

  it('generates 3-variable Karnaugh Map when requested', async () => {
    const res = await engine.ask('tạo 3 biến bìa K');
    expect(res.text).toContain('3 Biến');
    expect(res.labAction.type).toBe('logic');
    expect(res.labAction.subtab).toBe('kmap');
    expect(res.labAction.title).toContain('3 biến');
    expect(res.labAction.expr).toBe('(a & ~c) | (~a & c)');
  });

  it('generates 4-variable Karnaugh Map when requested', async () => {
    const res = await engine.ask('tạo 4 biến bìa K');
    expect(res.text).toContain('4 Biến');
    expect(res.labAction.type).toBe('logic');
    expect(res.labAction.subtab).toBe('kmap');
    expect(res.labAction.title).toContain('4 biến');
    expect(res.labAction.expr).toBe('(~b & ~d) | (b & d)');
  });

  it('generates Dijkstra with 4 nodes when specified', async () => {
    const res = await engine.ask('dijkstra đồ thị 4 đỉnh');
    expect(res.labAction.type).toBe('graph');
    expect(res.labAction.algo).toBe('dijkstra');
    expect(res.labAction.graphSpec.nodes.length).toBe(4);
  });

  it('handles invalid API keys gracefully and falls back to local engine', async () => {
    const res = await engine.ask('tối giản bìa K 2 biến', { apiKey: 'AQ.fakekey12345' });
    expect(res.isFromApi).toBe(false);
    expect(res.source).toBe('local');
    expect(res.apiErrorReason).toBeDefined();
    expect(res.labAction.expr).toBe('(~a & b) | (a & ~b)');
  });

  it('generates Dirichlet pigeonhole principle reasoning with counting action', async () => {
    const res = await engine.ask('Bài toán chia kẹo và nguyên lý chuồng bồ câu Dirichlet');
    expect(res.text).toContain('Dirichlet');
    expect(res.text.toLowerCase()).toContain('chuồng bồ câu');
    expect(res.labAction.type).toBe('counting');
    expect(res.labAction.subtab).toBe('dirichlet');
  });

  it('generates Linear Recurrence reasoning with recurrence action', async () => {
    const res = await engine.ask('Cách giải hệ thức truy hồi Fibonacci bậc 2');
    expect(res.text).toContain('truy hồi');
    expect(res.text.toLowerCase()).toContain('phương trình đặc trưng');
    expect(res.labAction.type).toBe('counting');
    expect(res.labAction.subtab).toBe('recurrence');
  });

  it('generates Binary Relation & Poset reasoning with relation action', async () => {
    const res = await engine.ask('Xét quan hệ chia hết chứng minh Poset và vẽ biểu đồ Hasse');
    expect(res.text).toContain('Quan Hệ Nhị Phân');
    expect(res.text).toContain('Phản xạ');
    expect(res.text).toContain('Warshall');
    expect(res.labAction.type).toBe('relation');
  });
});

describe('AiAssistantView (UI Workspace & Lab Bridge)', () => {
  let dom;
  let container;
  let aiView;
  let onNavigateMock;
  let onOpenLogicMock;
  let onOpenCountingMock;
  let onOpenRelationMock;
  let onOpenLabWithAlgoMock;
  let onOpenLabWithGraphMock;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="aiView"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
    };

    container = document.getElementById('aiView');
    onNavigateMock = vi.fn();
    onOpenLogicMock = vi.fn();
    onOpenCountingMock = vi.fn();
    onOpenRelationMock = vi.fn();
    onOpenLabWithAlgoMock = vi.fn();
    onOpenLabWithGraphMock = vi.fn();

    aiView = new AiAssistantView({
      container,
      onNavigate: onNavigateMock,
      onOpenLogic: onOpenLogicMock,
      onOpenCounting: onOpenCountingMock,
      onOpenRelation: onOpenRelationMock,
      onOpenLabWithAlgo: onOpenLabWithAlgoMock,
      onOpenLabWithGraph: onOpenLabWithGraphMock,
    });
  });

  it('renders required integration test elements (.ai-title, image/document, #btnAiToLab)', () => {
    expect(container.querySelector('.ai-title').textContent).toContain('AI Assistant');
    expect(container.innerHTML).toContain('image/document');

    const btnToLab = container.querySelector('#btnAiToLab');
    expect(btnToLab).not.toBeNull();
    btnToLab.click();
    expect(onNavigateMock).toHaveBeenCalledWith('lab');
  });

  it('renders initial welcome message and default Lab Bridge action card', () => {
    const stream = container.querySelector('#aiMessagesStream');
    expect(stream).not.toBeNull();
    expect(stream.textContent).toContain('Chào mừng bạn đến với Trợ Lý Thực Nghiệm');

    const bridgeCard = stream.querySelector('.ai-lab-bridge-card');
    expect(bridgeCard).not.toBeNull();
    expect(bridgeCard.textContent).toContain('Cầu Nối Lab Bridge');
  });

  it('submits a user prompt, receives AI response, and updates message stream', async () => {
    const textarea = container.querySelector('#aiPromptInput');
    const form = container.querySelector('#aiChatForm');

    textarea.value = 'Giải thích thuật toán Dijkstra';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async processing
    await new Promise(r => setTimeout(r, 100));

    const stream = container.querySelector('#aiMessagesStream');
    const messages = stream.querySelectorAll('.chat-message-row');
    expect(messages.length).toBeGreaterThanOrEqual(2);

    expect(stream.textContent).toContain('Dijkstra');
    expect(stream.querySelector('.ai-lab-bridge-card')).not.toBeNull();
  });

  it('executes Lab Bridge teleportation when clicking the action card button', () => {
    // Inject a specific action into messages and render
    aiView.messages.push({
      role: 'assistant',
      text: 'Logic test',
      labAction: {
        type: 'logic',
        subtab: 'kmap',
        expr: 'p & q',
      },
    });
    aiView._updateMessagesStream();

    const btnExecute = container.querySelector('.btn-bridge-execute[data-action-idx="1"]');
    expect(btnExecute).not.toBeNull();
    btnExecute.click();

    expect(onOpenLogicMock).toHaveBeenCalledWith('kmap', 'p & q');
  });

  it('switches study modes when clicking mode selector buttons and updates prompts library', () => {
    // 1. Initial Bridge mode
    expect(aiView.mode).toBe('bridge');
    expect(container.querySelector('#aiPromptsLibrary').textContent).toContain('Bài toán thực nghiệm');
    expect(container.querySelector('#aiQuickSuggestions').textContent).toContain('Dijkstra');

    // 2. Switch to Theory mode
    const theoryBtn = container.querySelector('.mode-btn[data-mode="theory"]');
    expect(theoryBtn).not.toBeNull();
    theoryBtn.click();

    expect(aiView.mode).toBe('theory');
    expect(theoryBtn.classList.contains('active')).toBe(true);
    // Dynamic prompts and suggestions should now show academic theory content
    expect(container.querySelector('#aiPromptsLibrary').textContent).toContain('Câu hỏi Lý thuyết & Chứng minh học thuật');
    expect(container.querySelector('#aiPromptsLibrary').textContent).toContain('DNF vs CNF');
    expect(container.querySelector('#aiQuickSuggestions').textContent).toContain('DNF vs CNF');

    // 3. Switch to Hint mode
    const hintBtn = container.querySelector('.mode-btn[data-mode="hint"]');
    hintBtn.click();
    expect(aiView.mode).toBe('hint');
    expect(hintBtn.classList.contains('active')).toBe(true);
    // Dynamic prompts and suggestions should now show Socratic hint content
    expect(container.querySelector('#aiPromptsLibrary').textContent).toContain('Gợi ý giải & Mẹo tư duy');
    expect(container.querySelector('#aiPromptsLibrary').textContent).toContain('Mẹo khoanh nhóm K-Map');
    expect(container.querySelector('#aiQuickSuggestions').textContent).toContain('Bẫy trọng số âm');

    // 4. Verify version badge is completely removed as requested
    expect(container.querySelector('.ai-version-badge')).toBeNull();
  });

  it('manages API key config panel and saves/clears key in localStorage', () => {
    const btnToggle = container.querySelector('#btnToggleApiConfig');
    const configBox = container.querySelector('#apiKeyInputBox');
    expect(configBox.style.display).toBe('none');

    btnToggle.click();
    expect(configBox.style.display).toBe('flex');

    const inputKey = container.querySelector('#inputGeminiApiKey');
    inputKey.value = 'test-gemini-key-12345';

    const btnSave = container.querySelector('#btnSaveApiKey');
    btnSave.click();

    expect(aiView.apiKey).toBe('test-gemini-key-12345');
    expect(localStorage.getItem('graph_tracer_gemini_api_key')).toBe('test-gemini-key-12345');

    // Clear key
    const btnClear = container.querySelector('#btnClearApiKey');
    btnClear.click();
    expect(aiView.apiKey).toBe('');
    expect(localStorage.getItem('graph_tracer_gemini_api_key')).toBeNull();
  });

  it('clears chat history when clicking clear button', () => {
    const btnClear = container.querySelector('#btnClearChatHistory');
    btnClear.click();

    expect(aiView.messages.length).toBe(0);
    const stream = container.querySelector('#aiMessagesStream');
    expect(stream.querySelectorAll('.chat-message-row').length).toBe(0);
  });

  it('formats markdown headers including level 4 and 5 (#### and #####)', () => {
    const raw = '#### 1.1. Dạng hợp của các tập hợp\n##### Tiểu mục chi tiết';
    const html = aiView._formatMarkdown(raw);
    expect(html).toContain('<h5 class="ai-msg-h5">1.1. Dạng hợp của các tập hợp</h5>');
    expect(html).toContain('<h5 class="ai-msg-h5">Tiểu mục chi tiết</h5>');
    expect(html).not.toContain('####');
  });

  it('renders LaTeX math formulas into styled math blocks and inline spans', () => {
    const raw = `Cho $A_1, A_2, \\dots, A_n$ là các tập hợp hữu hạn.
$$A_1 \\cup A_2 \\cup \\dots \\cup A_n= \\sum_{i=1}^{n}A_i- \\sum_{1 \\le i < j \\le n}A_i \\cap A_j$$`;
    const html = aiView._formatMarkdown(raw);

    // Should NOT contain raw unrendered LaTeX markers
    expect(html).not.toContain('$$');
    expect(html).not.toContain('\\cup');
    expect(html).not.toContain('\\cap');
    expect(html).not.toContain('\\sum');
    expect(html).not.toContain('\\le');
    expect(html).not.toContain('\\dots');

    // Should contain rendered Unicode symbols and classes
    expect(html).toContain('ai-math-inline');
    expect(html).toContain('ai-math-block');
    expect(html).toContain('∪');
    expect(html).toContain('∩');
    expect(html).toContain('∑');
    expect(html).toContain('≤');
    expect(html).toContain('…');
    expect(html).toContain('A<sub>1</sub>');
  });

  it('formats code blocks and markdown tables cleanly', () => {
    const raw = `\`\`\`javascript
const x = 1;
\`\`\`
| Cột 1 | Cột 2 |
|---|---|
| A | B |`;
    const html = aiView._formatMarkdown(raw);
    expect(html).toContain('<pre class="ai-code-block"');
    expect(html).toContain('<table class="ai-msg-table">');
    expect(html).toContain('<th>Cột 1</th>');
    expect(html).toContain('<td>A</td>');
  });

  it('filters history sessions in real-time using search input', () => {
    // Seed two sessions for guest
    aiHistoryManager.createSession('guest', {
      title: 'Thuật toán Dijkstra tìm đường đi ngắn nhất',
      mode: 'bridge',
      messages: [{ role: 'user', text: 'Hỏi về Dijkstra' }],
    });
    aiHistoryManager.createSession('guest', {
      title: 'Đại số Boole và bảng chân trị',
      mode: 'theory',
      messages: [{ role: 'user', text: 'Hỏi về Boole' }],
    });

    // Switch to history tab
    const tabHistory = container.querySelector('#tabBtnHistory');
    tabHistory.click();

    const historyPanel = container.querySelector('#aiHistoryPanel');
    expect(historyPanel.style.display).toBe('block');

    const searchInput = historyPanel.querySelector('#inputSearchHistory');
    expect(searchInput).not.toBeNull();

    // Both sessions rendered initially
    let items = historyPanel.querySelectorAll('.ai-history-item');
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Search for "Dijkstra"
    searchInput.value = 'Dijkstra';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    const updatedPanel = container.querySelector('#aiHistoryPanel');
    items = updatedPanel.querySelectorAll('.ai-history-item');
    expect(items.length).toBe(1);
    expect(updatedPanel.textContent).toContain('Dijkstra');
    expect(updatedPanel.textContent).not.toContain('bảng chân trị');

    // Clear search
    const btnClear = updatedPanel.querySelector('#btnClearHistorySearch');
    expect(btnClear).not.toBeNull();
    btnClear.click();

    const clearedPanel = container.querySelector('#aiHistoryPanel');
    items = clearedPanel.querySelectorAll('.ai-history-item');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
