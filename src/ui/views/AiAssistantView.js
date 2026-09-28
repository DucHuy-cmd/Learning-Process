/**
 * @file AiAssistantView.js
 * AI Assistant & Interactive Lab Bridge Workspace View Component.
 * 
 * Features:
 * 1. 🤖 Smart Academic AI Tutor powered by AiKnowledgeEngine & Gemini API.
 * 2. 🧪 Deep "Lab Bridge" action cards: 1-click teleportation with generated data directly into:
 *    - Logic Lab (Truth Table, K-Map, Circuit)
 *    - Counting Lab (Mapping, Dirichlet, Pascal, Recurrence)
 *    - Relation Lab (Boolean Matrix, Properties, Warshall, Hasse)
 *    - Graph Lab (Dijkstra, Prim, Kruskal, Euler, Hamilton)
 * 3. 💬 Rich markdown and mathematical formula formatting.
 * 4. 🔑 Optional Google Gemini API key configuration (stored in localStorage) with Smart Mock fallback.
 * 5. ⚡ Quick prompt chips and academic study modes.
 */

import { AiKnowledgeEngine } from '../../core/ai/AiKnowledgeEngine.js';
import {
  createGraphFromSpecification,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from '../../app/ai/GraphVisionAdapter.js';
import { authManager } from '../../core/auth/AuthManager.js';
import { aiHistoryManager } from '../../core/ai/AiHistoryManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';

export const STUDY_MODE_PROMPTS = {
  bridge: {
    heading: '🧪 Bài toán thực nghiệm (Nạp thẳng vào Lab):',
    groups: [
      {
        name: '⚡ Logic Lab',
        color: '#f59e0b',
        prompts: [
          {
            label: 'Nạp K-Map 4 biến vào Lab',
            prompt: 'Hướng dẫn rút gọn hàm Boole 4 biến bằng bìa Karnaugh K-Map',
          },
          {
            label: 'Mạch cộng Half-Adder',
            prompt: 'Mô phỏng thiết kế mạch cộng bán phần Half-Adder gồm cổng XOR và AND',
          },
          {
            label: 'Kiểm chứng hằng đúng Tam đoạn luận',
            prompt: 'Lập bảng chân trị và phân tích hằng đúng cho biểu thức: (p -> q) & (q -> r) -> (p -> r)',
          },
        ],
      },
      {
        name: '🧮 Counting Lab',
        color: '#10b981',
        prompts: [
          {
            label: 'Mô phỏng Dirichlet & chia kẹo',
            prompt: 'Giải thích nguyên lý chuồng bồ câu Dirichlet và bài toán chia kẹo',
          },
          {
            label: 'Hệ thức truy hồi Fibonacci',
            prompt: 'Cách giải hệ thức truy hồi bậc 2 qua phương trình đặc trưng và dãy số Fibonacci',
          },
          {
            label: 'Tam giác Pascal & C(8, 3)',
            prompt: 'Tính tổ hợp C(8, 3) và giải thích hệ thức tam giác Pascal',
          },
        ],
      },
      {
        name: '🔄 Relation Lab',
        color: '#a855f7',
        prompts: [
          {
            label: 'Quan hệ chia hết (Poset & Hasse)',
            prompt: 'Xét quan hệ chia hết trên tập {1, 2, 3, 4, 6, 12}, chứng minh Poset và vẽ biểu đồ Hasse',
          },
          {
            label: 'Bao đóng bắc cầu Warshall',
            prompt: 'Thuật toán Warshall tìm bao đóng bắc cầu trên ma trận 0-1 hoạt động như thế nào?',
          },
        ],
      },
      {
        name: '🌐 Graph Lab',
        color: '#38bdf8',
        prompts: [
          {
            label: 'Tạo đồ thị Euler 6 đỉnh',
            prompt: 'Tạo cho tôi một đồ thị 6 đỉnh có chu trình Euler và giải thích điều kiện đỉnh bậc chẵn',
          },
          {
            label: 'Thuật toán Dijkstra ngắn nhất',
            prompt: 'Giải thích từng bước thuật toán Dijkstra tìm đường đi ngắn nhất',
          },
          {
            label: 'Cây khung nhỏ nhất Prim vs Kruskal',
            prompt: 'So sánh thuật toán tìm cây khung nhỏ nhất Prim vs Kruskal',
          },
        ],
      },
    ],
    suggestions: [
      { label: '🌐 Dijkstra', prompt: 'Tìm đường đi ngắn nhất Dijkstra' },
      { label: '⚡ K-Map', prompt: 'Tối giản K-Map 4 biến' },
      { label: '🧮 Dirichlet', prompt: 'Nguyên lý Dirichlet chia kẹo' },
      { label: '🔄 Hasse', prompt: 'Quan hệ chia hết biểu đồ Hasse' },
    ],
  },
  theory: {
    heading: '📚 Câu hỏi Lý thuyết & Chứng minh học thuật:',
    groups: [
      {
        name: '⚡ Đại số Boole & Logic',
        color: '#f59e0b',
        prompts: [
          {
            label: 'Dạng chuẩn tắc DNF vs CNF',
            prompt: 'Phân tích bản chất, định lý và phương pháp chuyển đổi giữa dạng chuẩn tắc tuyển (DNF) và hội (CNF)',
          },
          {
            label: 'Tính đầy đủ hàm (Functional Completeness)',
            prompt: 'Chứng minh tập các liên từ {¬, ∧} và cổng NAND là đầy đủ chức năng trong logic mệnh đề',
          },
          {
            label: 'Quy tắc suy diễn & Hằng đúng',
            prompt: 'Trình bày các quy tắc suy diễn kinh điển (Modus Ponens, Modus Tollens, Tam đoạn luận) và ứng dụng chứng minh',
          },
        ],
      },
      {
        name: '🧮 Tổ hợp & Đại số Tuyến tính',
        color: '#10b981',
        prompts: [
          {
            label: 'Định lý Dirichlet tổng quát',
            prompt: 'Phát biểu và chứng minh nguyên lý chuồng bồ câu Dirichlet dạng mở rộng với k vật và n lồng',
          },
          {
            label: 'Nghiệm phương trình đặc trưng',
            prompt: 'Cơ sở lý thuyết giải hệ thức truy hồi tuyến tính thuần nhất hệ số hằng số qua nghiệm phương trình đặc trưng',
          },
          {
            label: 'Nguyên lý bù trừ (PIE)',
            prompt: 'Trình bày định lý nguyên lý bù trừ (Principle of Inclusion-Exclusion) và ứng dụng đếm số song ánh',
          },
        ],
      },
      {
        name: '🔄 Cấu trúc Quan hệ & Poset',
        color: '#a855f7',
        prompts: [
          {
            label: '5 tính chất của quan hệ 2 ngôi',
            prompt: 'Định nghĩa toán học và điều kiện ma trận của 5 tính chất: phản xạ, đối xứng, phản xứng, bắc cầu, đối xứng hoàn toàn',
          },
          {
            label: 'Poset & Cấu trúc Lưới (Lattice)',
            prompt: 'Định nghĩa tập sắp thứ tự bộ phận (Poset), phần tử tối đại/tối tiểu, và điều kiện để một Poset là Lưới (Lattice)',
          },
          {
            label: 'Định lý tính đúng đắn Warshall',
            prompt: 'Chứng minh tính đúng đắn của thuật toán Warshall và tại sao độ phức tạp luôn là O(n^3)',
          },
        ],
      },
      {
        name: '🌐 Lý thuyết Đồ thị Nâng cao',
        color: '#38bdf8',
        prompts: [
          {
            label: 'Định lý Euler (Euler 1736)',
            prompt: 'Chứng minh điều kiện cần và đủ để một đồ thị liên thông có chu trình Euler (mọi đỉnh đều có bậc chẵn)',
          },
          {
            label: 'Định lý Dirac & Ore (Hamilton)',
            prompt: 'Phát biểu và so sánh định lý Dirac và định lý Ore về điều kiện đủ để đồ thị có chu trình Hamilton',
          },
          {
            label: 'Định lý Vết cắt MST (Cut Property)',
            prompt: 'Chứng minh tính đúng đắn của thuật toán Kruskal và Prim dựa trên tính chất vết cắt (Cut Property) của đồ thị',
          },
        ],
      },
    ],
    suggestions: [
      { label: '⚡ DNF vs CNF', prompt: 'Phân tích bản chất, định lý và phương pháp chuyển đổi giữa dạng chuẩn tắc tuyển (DNF) và hội (CNF)' },
      { label: '🧮 Dirichlet mở rộng', prompt: 'Phát biểu và chứng minh nguyên lý chuồng bồ câu Dirichlet dạng mở rộng với k vật và n lồng' },
      { label: '🔄 Định nghĩa Poset & Lưới', prompt: 'Định nghĩa tập sắp thứ tự bộ phận (Poset), phần tử tối đại/tối tiểu, và điều kiện để một Poset là Lưới (Lattice)' },
      { label: '🌐 Định lý Euler & Hamilton', prompt: 'Chứng minh điều kiện cần và đủ để một đồ thị liên thông có chu trình Euler (mọi đỉnh đều có bậc chẵn)' },
    ],
  },
  hint: {
    heading: '💡 Gợi ý giải & Mẹo tư duy bài tập:',
    groups: [
      {
        name: '⚡ Mẹo làm bài Logic',
        color: '#f59e0b',
        prompts: [
          {
            label: 'Mẹo khoanh nhóm K-Map tối ưu',
            prompt: 'Gợi ý cách khoanh nhóm ô 1 trên bìa K-Map 4 biến để không bị sót tế bào và không bị nhóm dư thừa?',
          },
          {
            label: 'Kiểm tra hằng đúng không cần vẽ bảng',
            prompt: 'Có cách nào suy luận nhanh một mệnh đề là hằng đúng (tautology) mà không cần lập hết 16 dòng bảng chân trị?',
          },
          {
            label: 'Phân tích biểu thức mạch logic',
            prompt: 'Làm thế nào để chuyển đổi nhanh giữa cổng NAND/NOR và các cổng AND/OR cơ bản khi thiết kế mạch?',
          },
        ],
      },
      {
        name: '🧮 Gợi ý bài toán Đếm',
        color: '#10b981',
        prompts: [
          {
            label: 'Cách chọn Thỏ & Lồng Dirichlet',
            prompt: 'Làm thế nào để xác định chính xác đâu là "thỏ" (đối tượng) và đâu là "lồng" (ngăn chứa) trong các bài toán Dirichlet khó?',
          },
          {
            label: 'Phân biệt Tổ hợp vs Chỉnh hợp',
            prompt: 'Dấu hiệu nhận biết bài toán nào dùng tổ hợp C(n,k), bài toán nào dùng chỉnh hợp A(n,k) hoặc hoán vị?',
          },
          {
            label: 'Bẫy nghiệm phương trình đặc trưng',
            prompt: 'Gợi ý cách xử lý khi giải hệ thức truy hồi mà phương trình đặc trưng có nghiệm kép hoặc nghiệm phức?',
          },
        ],
      },
      {
        name: '🔄 Gợi ý bài tập Quan hệ',
        color: '#a855f7',
        prompts: [
          {
            label: 'Kiểm tra 5 tính chất trên ma trận',
            prompt: 'Gợi ý mẹo nhìn nhanh ma trận quan hệ M_R để biết ngay có phản xạ, đối xứng, phản xứng hay không?',
          },
          {
            label: 'Tìm supremum/infimum trên Hasse',
            prompt: 'Cách xác định nhanh chặn trên nhỏ nhất (sup) và chặn dưới lớn nhất (inf) của 2 phần tử trên biểu đồ Hasse?',
          },
          {
            label: 'Mẹo phân hoạch lớp tương đương',
            prompt: 'Làm thế nào để kiểm tra một họ các tập con có tạo thành một phân hoạch hợp lệ của tập hợp hay không?',
          },
        ],
      },
      {
        name: '🌐 Gợi ý giải Đồ thị',
        color: '#38bdf8',
        prompts: [
          {
            label: 'Phát hiện đồ thị KHÔNG Hamilton',
            prompt: 'Gợi ý phương pháp phát hiện nhanh một đồ thị KHÔNG có chu trình Hamilton trong đề thi trắc nghiệm?',
          },
          {
            label: 'Khi nào nên chọn Prim vs Kruskal',
            prompt: 'Khi làm bài thi, dấu hiệu nào cho thấy nên dùng thuật toán Prim hay Kruskal để tìm cây khung nhanh hơn?',
          },
          {
            label: 'Bẫy trọng số âm Dijkstra',
            prompt: 'Tại sao thuật toán Dijkstra lại thất bại khi đồ thị có cạnh trọng số âm? Cho ví dụ minh họa trực quan?',
          },
        ],
      },
    ],
    suggestions: [
      { label: '⚡ Mẹo khoanh K-Map', prompt: 'Gợi ý cách khoanh nhóm ô 1 trên bìa K-Map 4 biến để không bị sót tế bào và không bị nhóm dư thừa?' },
      { label: '🧮 Chọn Thỏ & Lồng', prompt: 'Làm thế nào để xác định chính xác đâu là "thỏ" (đối tượng) và đâu là "lồng" (ngăn chứa) trong các bài toán Dirichlet khó?' },
      { label: '🔄 Soi 5 tính chất ma trận', prompt: 'Gợi ý mẹo nhìn nhanh ma trận quan hệ M_R để biết ngay có phản xạ, đối xứng, phản xứng hay không?' },
      { label: '🌐 Bẫy trọng số âm Dijkstra', prompt: 'Tại sao thuật toán Dijkstra lại thất bại khi đồ thị có cạnh trọng số âm? Cho ví dụ minh họa trực quan?' },
    ],
  },
};

export class AiAssistantView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onNavigate] - Callback (viewName, subtab)
   * @param {Function} [options.onOpenLabWithAlgo] - Callback (algoKey)
   * @param {Function} [options.onOpenLabWithGraph] - Callback (graph, name, algo)
   * @param {Function} [options.onOpenLogic] - Callback (subtab, expr)
   * @param {Function} [options.onOpenCounting] - Callback (subtab)
   * @param {Function} [options.onOpenRelation] - Callback (subtab)
   * @param {Function} [options.onOpenQuiz] - Callback (subtab, topic)
   */
  constructor(options = {}) {
    this.container = options.container || null;
    this.onNavigate = options.onNavigate || (() => {});
    this.onOpenLabWithAlgo = options.onOpenLabWithAlgo || (() => {});
    this.onOpenLabWithGraph = options.onOpenLabWithGraph || (() => {});
    this.onOpenLogic = options.onOpenLogic || (() => {});
    this.onOpenCounting = options.onOpenCounting || (() => {});
    this.onOpenRelation = options.onOpenRelation || (() => {});
    this.onOpenQuiz = options.onOpenQuiz || (() => {});

    this.engine = new AiKnowledgeEngine();
    this.mode = 'bridge'; // 'bridge' | 'theory' | 'hint'
    this.isLoading = false;
    this.currentSessionId = null;
    this.sidebarTab = 'prompts'; // 'prompts' | 'history'
    this.historySearchQuery = '';

    // Shared API key with Graph Lab Vision from localStorage
    this.apiKey = getStoredApiKey();
    this.serverAiConfigured = cloudSyncManager.getStatus().serverAiConfigured || false;
    this.unsubscribeSync = cloudSyncManager.subscribe((status) => {
      this.serverAiConfigured = Boolean(status.serverAiConfigured);
      this._updateStatusBadge();
    });

    // Message History
    this.messages = [
      {
        role: 'assistant',
        text: `### 🤖 Chào mừng bạn đến với Trợ Lý Thực Nghiệm Toán Rời Rạc!

Tôi là gia sư AI học thuật được tích hợp trực tiếp vào hệ thống. Bạn có thể hỏi tôi bất kỳ lý thuyết nào, hoặc yêu cầu tôi tạo bài tập mô phỏng để **nạp thẳng vào 4 phòng Lab thực nghiệm**:

- **⚡ Logic Lab:** Phân tích bảng chân trị, tối giản bìa Karnaugh (K-Map), mô phỏng mạch logic số.
- **🧮 Counting Lab:** Đại số tổ hợp, bài toán chia kẹo Dirichlet, giải hệ thức truy hồi Fibonacci.
- **🔄 Relation Lab:** Ma trận 0-1, 5 tính chất quan hệ, bao đóng Warshall, quan hệ thứ tự Poset & Hasse.
- **🌐 Graph Lab:** Tìm đường đi ngắn nhất Dijkstra, cây khung nhỏ nhất Prim & Kruskal, chu trình Euler & Hamilton.

*Hãy chọn một gợi ý ở cột bên trái hoặc gõ câu hỏi của bạn vào khung bên dưới nhé!*`,
        labAction: {
          type: 'graph',
          title: 'Đồ thị mẫu Dijkstra (6 đỉnh có trọng số)',
          algo: 'dijkstra',
        },
        source: 'local',
        isFromApi: false,
      },
    ];

    if (this.container) {
      this.render();
    }
  }

  /**
   * Mounts and renders content into container.
   * @param {HTMLElement} [targetContainer]
   */
  render(targetContainer = null) {
    if (targetContainer) {
      this.container = targetContainer;
    }
    if (!this.container) return;

    const currentUser = authManager.getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : 'guest';
    const userSessions = aiHistoryManager.getUserSessions(currentUserId);

    this.container.innerHTML = `
      <div class="ai-assistant-layout">
        <!-- 1. LEFT SIDEBAR: Controls & Prompts -->
        <aside class="ai-sidebar">
          <div class="ai-sidebar-head">
            <span class="ai-sidebar-icon">🤖</span>
            <div>
              <h3 class="ai-sidebar-title">Trợ Lý AI Toán Rời Rạc</h3>
              <span class="ai-sidebar-sub">Công nghệ AI Bridge 4 Phòng Lab</span>
            </div>
          </div>

          <!-- Account Status Badge in AI Workspace -->
          <div class="ai-user-profile-badge ${currentUser ? '' : 'guest'}" id="aiUserProfileBadge">
            <span class="user-avatar-tiny">${currentUser ? (currentUser.avatar || '🎓') : '👤'}</span>
            <div class="user-meta-tiny">
              <span class="user-name-tiny">${currentUser ? currentUser.fullName : 'Chế độ Khách'}</span>
              <span class="user-status-tiny">${currentUser ? (currentUser.className || 'Sinh viên') : 'Đăng nhập để đồng bộ lịch sử'}</span>
            </div>
            ${currentUser 
              ? '<button type="button" class="btn-user-switch-tiny" id="btnAiSwitchAccount" title="Quản lý tài khoản">⚙️</button>' 
              : '<button type="button" class="btn-user-login-tiny" id="btnAiLoginAccount" title="Đăng nhập tài khoản">Đăng nhập</button>'
            }
          </div>

          <!-- New Chat Button -->
          <button type="button" class="btn-ai-new-chat" id="btnAiNewChat" title="Bắt đầu phiên hỏi đáp bài toán mới">
            <span>＋</span>
            <span>Cuộc trò chuyện mới</span>
          </button>

          <!-- Sidebar Tabs: Prompts vs History -->
          <div class="ai-sidebar-tab-row">
            <button type="button" class="ai-sidebar-nav-tab ${this.sidebarTab === 'prompts' ? 'active' : ''}" data-sidebar-tab="prompts" id="tabBtnPrompts">
              📚 Gợi ý
            </button>
            <button type="button" class="ai-sidebar-nav-tab ${this.sidebarTab === 'history' ? 'active' : ''}" data-sidebar-tab="history" id="tabBtnHistory">
              💬 Lịch sử (${userSessions.length})
            </button>
          </div>

          <!-- History Panel Container -->
          <div class="ai-history-panel" id="aiHistoryPanel" style="${this.sidebarTab === 'history' ? 'display:block;' : 'display:none;'}">
            ${this._renderHistoryList(userSessions)}
          </div>

          <!-- Prompts Panel Container -->
          <div class="ai-prompts-panel" id="aiPromptsPanel" style="${this.sidebarTab === 'prompts' ? 'display:block;' : 'display:none;'}">
            <!-- API Key Status Bar -->
            <div class="ai-api-status-card" id="aiApiStatusCard">
              <div class="status-top">
                <span class="status-indicator ${this.apiKey || this.serverAiConfigured ? 'status-online' : 'status-local'}"></span>
                <span class="status-label">${this.apiKey ? 'Gemini Flash (Key Cá Nhân Online)' : (this.serverAiConfigured ? 'Gemini Cloud (Server Vercel Online)' : 'Smart Knowledge Engine (Offline)')}</span>
              </div>
              <button type="button" class="btn-api-config" id="btnToggleApiConfig">
                ${this.apiKey || this.serverAiConfigured ? '⚙️ Quản lý API Key' : '🔑 Cài đặt Gemini API Key'}
              </button>
              <div class="api-key-input-box" id="apiKeyInputBox" style="display:none;">
                <input type="password" id="inputGeminiApiKey" class="input-api-key" placeholder="Dán Gemini Key (bắt đầu bằng AQ. hoặc AIzaSy...)" value="${this.apiKey}">
                <div class="api-key-btn-row">
                  <button type="button" class="btn-sm btn-save-key" id="btnSaveApiKey">Lưu Key</button>
                  <button type="button" class="btn-sm btn-clear-key" id="btnClearApiKey">Xóa Key</button>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="btn-sm btn-get-key" style="text-decoration:none; display:inline-flex; align-items:center; color:var(--blue-light);">🔗 Lấy Key Google AI Studio</a>
                </div>
                <span class="api-key-hint">${this.serverAiConfigured 
                  ? '✅ Máy chủ Vercel đã kết nối sẵn Gemini AI vĩnh viễn! Bạn không cần dán key nữa, nhưng vẫn có thể dán key riêng nếu muốn ghi đè.' 
                  : '💡 Hệ thống hỗ trợ đầy đủ cả chuẩn khóa mới "AQ...." và chuẩn "AIzaSy..." từ Google AI Studio.'}</span>
              </div>
            </div>

            <!-- Study Mode Tabs -->
            <div class="ai-mode-selector">
              <span class="mode-label">Chế độ học tập:</span>
              <div class="mode-buttons">
                <button type="button" class="mode-btn ${this.mode === 'bridge' ? 'active' : ''}" data-mode="bridge" title="Gia sư thực nghiệm kèm dữ liệu nạp thẳng vào Lab">
                  🧪 Lab Bridge
                </button>
                <button type="button" class="mode-btn ${this.mode === 'theory' ? 'active' : ''}" data-mode="theory" title="Giải thích lý thuyết toán học chuyên sâu">
                  📚 Lý thuyết
                </button>
                <button type="button" class="mode-btn ${this.mode === 'hint' ? 'active' : ''}" data-mode="hint" title="Gợi ý giải bài tập từng bước">
                  💡 Gợi ý
                </button>
              </div>
            </div>

            <!-- Quick Prompts Library (Dynamic per Study Mode) -->
            <div class="ai-prompts-library" id="aiPromptsLibrary">
              ${this._renderPromptsLibrary()}
            </div>
          </div>

          <!-- Bottom Actions in Sidebar -->
          <div class="ai-sidebar-foot">
            <button type="button" class="btn-clear-chat" id="btnClearChatHistory">
              🗑️ Xoá hội thoại
            </button>
            <!-- Backward-compatibility button for integration tests -->
            <button type="button" class="btn-primary" id="btnAiToLab" style="width:100%;margin-top:6px;padding:8px 12px;font-size:12.5px;">
              🔬 Khám phá Algorithm Lab ngay
            </button>
          </div>
        </aside>

        <!-- 2. RIGHT CHAT CANVAS -->
        <main class="ai-chat-canvas">
          <!-- Chat Canvas Header -->
          <div class="ai-canvas-header">
            <div class="canvas-title-wrap">
              <div class="ai-avatar-badge">🤖</div>
              <div>
                <h2 class="ai-title">AI Assistant</h2>
                <div class="ai-sub-info">
                  <span class="ai-sub-text">Trợ lý Thực nghiệm Toán Rời Rạc &amp; Phân tích graph từ image/document</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Messages Stream -->
          <div class="ai-messages-scroll" id="aiMessagesStream">
            ${this._renderMessages()}
          </div>

          <!-- Bottom Input Bar -->
          <div class="ai-input-wrapper">
            <div class="ai-quick-suggestions" id="aiQuickSuggestions">
              ${this._renderSuggestions()}
            </div>

            <form class="ai-input-form" id="aiChatForm">
              <textarea 
                id="aiPromptInput" 
                class="ai-textarea" 
                rows="1" 
                placeholder="Nhập câu hỏi lý thuyết, bài tập hoặc yêu cầu AI tạo dữ liệu mô phỏng cho phòng Lab (Enter để gửi, Shift+Enter xuống dòng)..."
              ></textarea>
              <button type="submit" class="btn-ai-send" id="btnSendAiPrompt" title="Gửi câu hỏi (Enter)">
                <span class="send-text">Gửi</span>
                <span class="send-icon">➔</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    `;

    this._bindEvents();
    this._scrollToBottom();
  }

  onUserChanged(user) {
    this.currentSessionId = null;
    if (user && user.id) {
      try {
        cloudSyncManager.syncAiHistory(user.id, aiHistoryManager).then(() => {
          if (this.container) {
            this.render();
          }
        }).catch(() => {});
      } catch {}
    }
    if (this.container) {
      this.render();
    }
  }

  startNewChat() {
    this.currentSessionId = null;
    this.messages = [
      {
        role: 'assistant',
        text: `### 🤖 Chào mừng bạn đến với Trợ Lý Thực Nghiệm Toán Rời Rạc!

Tôi là gia sư AI học thuật được tích hợp trực tiếp vào hệ thống. Bạn có thể hỏi tôi bất kỳ lý thuyết nào, hoặc yêu cầu tôi tạo bài tập mô phỏng để **nạp thẳng vào 4 phòng Lab thực nghiệm**:

- **⚡ Logic Lab:** Phân tích bảng chân trị, tối giản bìa Karnaugh (K-Map), mô phỏng mạch logic số.
- **🧮 Counting Lab:** Đại số tổ hợp, bài toán chia kẹo Dirichlet, giải hệ thức truy hồi Fibonacci.
- **🔄 Relation Lab:** Ma trận 0-1, 5 tính chất quan hệ, bao đóng Warshall, quan hệ thứ tự Poset & Hasse.
- **🌐 Graph Lab:** Tìm đường đi ngắn nhất Dijkstra, cây khung nhỏ nhất Prim & Kruskal, chu trình Euler & Hamilton.

*Hãy chọn một gợi ý ở cột bên trái hoặc gõ câu hỏi của bạn vào khung bên dưới nhé!*`,
        labAction: {
          type: 'graph',
          title: 'Đồ thị mẫu Dijkstra (6 đỉnh có trọng số)',
          algo: 'dijkstra',
        },
        source: 'local',
        isFromApi: false,
      },
    ];
    this.render();
  }

  loadSession(sessionId) {
    const session = aiHistoryManager.getSession(sessionId);
    if (!session) return;
    this.currentSessionId = session.id;
    this.mode = session.mode || 'bridge';
    this.messages = session.messages ? [...session.messages] : [];
    this.render();
  }

  _renderHistoryList(userSessions = null) {
    const currentUser = authManager.getCurrentUser();
    const sessions = userSessions || aiHistoryManager.getUserSessions(currentUser ? currentUser.id : 'guest');

    if (!sessions || sessions.length === 0) {
      return `
        <div class="ai-history-empty">
          <span style="font-size:24px;display:block;margin-bottom:6px;">🕒</span>
          <span style="font-weight:700;color:var(--text);">Chưa có phiên trò chuyện nào</span>
          <p style="margin:6px 0 0;font-size:12px;color:var(--dim);">
            ${currentUser ? 'Gửi câu hỏi đầu tiên để tự động lưu vào tài khoản!' : 'Đăng nhập tài khoản để tự động đồng bộ lịch sử bài tập!'}
          </p>
        </div>
      `;
    }

    const searchBarHtml = `
      <div class="ai-history-search-box">
        <span class="history-search-icon">🔍</span>
        <input 
          type="text" 
          id="inputSearchHistory" 
          class="input-search-history" 
          placeholder="Tìm kiếm phiên trò chuyện..." 
          value="${this._escapeHtml(this.historySearchQuery)}"
        />
        ${this.historySearchQuery ? `<button type="button" id="btnClearHistorySearch" class="btn-clear-search" title="Xóa từ khóa">✕</button>` : ''}
      </div>
    `;

    let displaySessions = sessions;
    const q = (this.historySearchQuery || '').trim().toLowerCase();
    if (q) {
      displaySessions = sessions.filter(s => {
        const titleMatch = (s.title || '').toLowerCase().includes(q);
        const modeMatch = (s.mode || '').toLowerCase().includes(q);
        const msgMatch = Array.isArray(s.messages) && s.messages.some(m => (m.text || '').toLowerCase().includes(q));
        return titleMatch || modeMatch || msgMatch;
      });
    }

    if (displaySessions.length === 0) {
      return `
        ${searchBarHtml}
        <div class="ai-history-empty" style="padding:24px 12px;">
          <span style="font-size:24px;display:block;margin-bottom:6px;">🔎</span>
          <span style="font-weight:700;color:var(--text);">Không tìm thấy phiên nào</span>
          <p style="margin:6px 0 0;font-size:12px;color:var(--dim);">
            Không có lịch sử nào khớp với từ khóa "<strong>${this._escapeHtml(this.historySearchQuery)}</strong>"
          </p>
        </div>
      `;
    }

    return `
      ${searchBarHtml}
      <div class="ai-history-list">
        ${displaySessions.map(s => {
          const isActive = s.id === this.currentSessionId;
          const modeIcon = s.mode === 'theory' ? '📚' : (s.mode === 'hint' ? '💡' : '🧪');
          const timeStr = this._formatRelativeTime(s.updatedAt);
          return `
            <div class="ai-history-item ${isActive ? 'active' : ''}" data-session-id="${s.id}">
              <span class="ai-history-icon">${modeIcon}</span>
              <div class="ai-history-info">
                <span class="ai-history-title" title="${this._escapeHtml(s.title)}">${this._escapeHtml(s.title)}</span>
                <span class="ai-history-time">${timeStr} • ${s.messages ? s.messages.length : 0} tin nhắn</span>
              </div>
              <button type="button" class="ai-history-del-btn" data-del-session-id="${s.id}" title="Xóa phiên này">✕</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _formatRelativeTime(isoStr) {
    if (!isoStr) return 'Vừa xong';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
      if (diffSec < 60) return 'Vừa xong';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
      return `${Math.floor(diffSec / 86400)} ngày trước`;
    } catch {
      return 'Gần đây';
    }
  }

  _renderMessages() {
    return this.messages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      return `
        <div class="chat-message-row ${isUser ? 'user-row' : 'assistant-row'}">
          <div class="message-avatar">
            ${isUser ? '👤' : '🤖'}
          </div>
          <div class="message-bubble">
            <div class="message-author-row">
              <span class="message-author">${isUser ? 'Bạn' : 'Trợ lý AI Toán Rời Rạc'}</span>
              ${!isUser && msg.source ? `
                <span class="ai-source-badge ${msg.isFromApi ? 'badge-api' : 'badge-local'}">
                  ${msg.isFromApi ? '⚡ Gemini Cloud (Online)' : '🧠 Tri thức Cục bộ (Offline)'}
                </span>
              ` : ''}
            </div>
            ${!isUser && msg.apiErrorReason ? `
              <div class="ai-api-notice">
                <span>⚠️ ${msg.apiErrorReason}</span>
              </div>
            ` : ''}
            <div class="message-body">
              ${this._formatMarkdown(msg.text)}
            </div>
            ${msg.labAction ? this._renderLabActionCard(msg.labAction, idx) : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  _renderLabActionCard(action, msgIdx) {
    if (!action || !action.type) return '';

    let icon = '🧪';
    let labName = 'Phòng Thực Nghiệm';
    let btnText = 'Mở phòng Lab ngay ➔';
    let accentColor = '#3b82f6';

    switch (action.type) {
      case 'logic':
        icon = '⚡';
        labName = 'Logic Lab (Chương 1 & 2)';
        btnText = '⚡ Nạp vào Logic Lab ngay ➔';
        accentColor = '#f59e0b';
        break;
      case 'counting':
        icon = '🧮';
        labName = 'Counting Lab (Chương 3)';
        btnText = '🧮 Mở trong Counting Lab ➔';
        accentColor = '#10b981';
        break;
      case 'relation':
        icon = '🔄';
        labName = 'Relation Lab (Chương 4)';
        btnText = '🔄 Nạp vào Relation Lab ➔';
        accentColor = '#a855f7';
        break;
      case 'graph':
      default:
        icon = '🌐';
        labName = 'Graph Lab (Chương 5)';
        btnText = `🌐 Mở trong Graph Lab & Chạy ${action.algo ? action.algo.toUpperCase() : 'thuật toán'} ➔`;
        accentColor = '#38bdf8';
        break;
    }

    return `
      <div class="ai-lab-bridge-card" style="border-left-color: ${accentColor};">
        <div class="bridge-card-top">
          <span class="bridge-card-badge" style="background:${accentColor}22;color:${accentColor};border-color:${accentColor}44;">
            ${icon} Cầu Nối Lab Bridge
          </span>
          <span class="bridge-card-lab">${labName}</span>
        </div>
        <h4 class="bridge-card-title">${action.title || 'Dữ liệu mô phỏng từ AI'}</h4>
        <div class="bridge-card-meta">
          ${action.expr ? `<span>Biểu thức: <code>${action.expr}</code></span>` : ''}
          ${action.algo ? `<span>Thuật toán: <strong>${action.algo.toUpperCase()}</strong></span>` : ''}
          ${action.subtab ? `<span>Phân hệ: <strong>${action.subtab}</strong></span>` : ''}
        </div>
        <button type="button" class="btn-bridge-execute" data-action-idx="${msgIdx}" style="background:${accentColor};">
          ${btnText}
        </button>
      </div>
    `;
  }

  _formatMarkdown(text) {
    if (!text) return '';

    // 0. Protect escaped dollar signs \$
    let processed = text.replace(/\\\$/g, '&#36;');

    // 1. Code blocks ```lang ... ```
    const codeBlocks = [];
    processed = processed.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="ai-code-block" data-lang="${lang || ''}"><code>${this._escapeHtml(code.trim())}</code></pre>`);
      return `\n%%CODE_BLOCK_${idx}%%\n`;
    });

    // 2. Display math blocks: $$ ... $$ or \[ ... \]
    const mathBlocks = [];
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
      const idx = mathBlocks.length;
      mathBlocks.push(this._renderMath(latex.trim(), true));
      return `\n%%MATH_BLOCK_${idx}%%\n`;
    });
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
      const idx = mathBlocks.length;
      mathBlocks.push(this._renderMath(latex.trim(), true));
      return `\n%%MATH_BLOCK_${idx}%%\n`;
    });

    // 3. Inline math: $ ... $ or \( ... \)
    const inlineMath = [];
    processed = processed.replace(/\$([^\$\n\r]+?)\$/g, (match, latex) => {
      const idx = inlineMath.length;
      inlineMath.push(this._renderMath(latex.trim(), false));
      return `%%INLINE_MATH_${idx}%%`;
    });
    processed = processed.replace(/\\\((.+?)\\\)/g, (match, latex) => {
      const idx = inlineMath.length;
      inlineMath.push(this._renderMath(latex.trim(), false));
      return `%%INLINE_MATH_${idx}%%`;
    });

    // 4. Headers (Level 1 to 6)
    processed = processed
      .replace(/^######\s*(.*$)/gim, '<h6 class="ai-msg-h6">$1</h6>')
      .replace(/^#####\s*(.*$)/gim, '<h5 class="ai-msg-h5">$1</h5>')
      .replace(/^####\s*(.*$)/gim, '<h5 class="ai-msg-h5">$1</h5>')
      .replace(/^###\s*(.*$)/gim, '<h4 class="ai-msg-h4">$1</h4>')
      .replace(/^##\s*(.*$)/gim, '<h3 class="ai-msg-h3">$1</h3>')
      .replace(/^#\s*(.*$)/gim, '<h2 class="ai-msg-h2">$1</h2>');

    // 5. Horizontal rules
    processed = processed.replace(/^(?:---|___|\*\*\*)\s*$/gim, '<hr class="ai-msg-hr">');

    // 6. Bold, Italic & Strikethrough
    processed = processed
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^\*\n]+)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>');

    // 7. Inline code
    processed = processed.replace(/`([^`\n]+)`/g, (m, code) => `<code>${this._escapeHtml(code)}</code>`);

    // 8. Markdown Tables
    processed = this._formatMarkdownTables(processed);

    // 9. Lists
    processed = processed
      .replace(/^\s*[-*•]\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li value="$1">$2</li>');
    processed = processed.replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/gim, '<ul class="ai-msg-list">$1</ul>');

    // 10. Paragraph breaks & Line breaks
    processed = processed
      .replace(/\n\n+/g, '<br><br>')
      .replace(/([^\n>])\n([^\n<])/g, '$1<br>$2');

    // 11. Restore Placeholders
    processed = processed.replace(/%%INLINE_MATH_(\d+)%%/g, (m, idx) => inlineMath[idx] || '');
    processed = processed.replace(/%%MATH_BLOCK_(\d+)%%/g, (m, idx) => mathBlocks[idx] || '');
    processed = processed.replace(/%%CODE_BLOCK_(\d+)%%/g, (m, idx) => codeBlocks[idx] || '');

    return processed;
  }

  _renderMath(latex, isBlock = false) {
    if (!latex) return '';

    // 1. Try KaTeX if available
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
      try {
        return window.katex.renderToString(latex, {
          displayMode: isBlock,
          throwOnError: false,
        });
      } catch (err) {
        // Fallback to custom math formatter
      }
    }

    // 2. High-quality Unicode Math Fallback
    return this._formatMathFallback(latex, isBlock);
  }

  _formatMathFallback(latex, isBlock = false) {
    if (!latex) return '';

    let s = latex;

    // Big Operators
    s = s.replace(/\\bigcup(?![a-zA-Z])/g, '⋃');
    s = s.replace(/\\bigcap(?![a-zA-Z])/g, '⋂');
    s = s.replace(/\\sum(?![a-zA-Z])/g, '∑');
    s = s.replace(/\\prod(?![a-zA-Z])/g, '∏');

    // Set & Logic Operators
    s = s.replace(/\\cup(?![a-zA-Z])/g, '∪');
    s = s.replace(/\\cap(?![a-zA-Z])/g, '∩');
    s = s.replace(/\\setminus(?![a-zA-Z])/g, ' \\ ');
    s = s.replace(/\\emptyset(?![a-zA-Z])/g, '∅');
    s = s.replace(/\\in(?![a-zA-Z])/g, '∈');
    s = s.replace(/\\notin(?![a-zA-Z])/g, '∉');
    s = s.replace(/\\subseteq(?![a-zA-Z])/g, '⊆');
    s = s.replace(/\\subset(?![a-zA-Z])/g, '⊂');
    s = s.replace(/\\supseteq(?![a-zA-Z])/g, '⊇');
    s = s.replace(/\\supset(?![a-zA-Z])/g, '⊃');
    s = s.replace(/\\neg(?![a-zA-Z])|\\sim(?![a-zA-Z])/g, '¬');
    s = s.replace(/\\land(?![a-zA-Z])|\\wedge(?![a-zA-Z])/g, '∧');
    s = s.replace(/\\lor(?![a-zA-Z])|\\vee(?![a-zA-Z])/g, '∨');
    s = s.replace(/\\oplus(?![a-zA-Z])/g, '⊕');
    s = s.replace(/\\implies(?![a-zA-Z])/g, '⟹');
    s = s.replace(/\\iff(?![a-zA-Z])/g, '⟺');
    s = s.replace(/\\to(?![a-zA-Z])|\\rightarrow(?![a-zA-Z])/g, '→');
    s = s.replace(/\\leftarrow(?![a-zA-Z])/g, '←');
    s = s.replace(/\\leftrightarrow(?![a-zA-Z])/g, '↔');
    s = s.replace(/\\forall(?![a-zA-Z])/g, '∀');
    s = s.replace(/\\exists(?![a-zA-Z])/g, '∃');

    // Relations & Arithmetic
    s = s.replace(/\\le(?![a-zA-Z])|\\leq(?![a-zA-Z])/g, '≤');
    s = s.replace(/\\ge(?![a-zA-Z])|\\geq(?![a-zA-Z])/g, '≥');
    s = s.replace(/\\ne(?![a-zA-Z])|\\neq(?![a-zA-Z])/g, '≠');
    s = s.replace(/\\equiv(?![a-zA-Z])/g, '≡');
    s = s.replace(/\\approx(?![a-zA-Z])/g, '≈');
    s = s.replace(/\\cdot(?![a-zA-Z])/g, '·');
    s = s.replace(/\\times(?![a-zA-Z])/g, '×');
    s = s.replace(/\\circ(?![a-zA-Z])/g, '∘');
    s = s.replace(/\\pm(?![a-zA-Z])/g, '±');
    s = s.replace(/\\mp(?![a-zA-Z])/g, '∓');
    s = s.replace(/\\dots(?![a-zA-Z])|\\cdots(?![a-zA-Z])|\\ldots(?![a-zA-Z])/g, '…');
    s = s.replace(/\\infty(?![a-zA-Z])/g, '∞');

    // Ceil & Floor
    s = s.replace(/\\lceil(?![a-zA-Z])/g, '⌈');
    s = s.replace(/\\rceil(?![a-zA-Z])/g, '⌉');
    s = s.replace(/\\lfloor(?![a-zA-Z])/g, '⌊');
    s = s.replace(/\\rfloor(?![a-zA-Z])/g, '⌋');

    // Common Structures
    s = s.replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, 'C($1, $2)');
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
    s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');

    // Text wrappers
    s = s.replace(/\\text\{([^}]+)\}/g, '$1');
    s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');
    s = s.replace(/\\mathbf\{([^}]+)\}/g, '<strong>$1</strong>');

    // Number sets
    s = s.replace(/\\mathbb\{R\}/g, 'ℝ');
    s = s.replace(/\\mathbb\{Z\}/g, 'ℤ');
    s = s.replace(/\\mathbb\{N\}/g, 'ℕ');
    s = s.replace(/\\mathbb\{Q\}/g, 'ℚ');
    s = s.replace(/\\mathcal\{P\}/g, '𝒫');

    // Greek letters
    s = s.replace(/\\alpha(?![a-zA-Z])/g, 'α');
    s = s.replace(/\\beta(?![a-zA-Z])/g, 'β');
    s = s.replace(/\\gamma(?![a-zA-Z])/g, 'γ');
    s = s.replace(/\\delta(?![a-zA-Z])/g, 'δ');
    s = s.replace(/\\Delta(?![a-zA-Z])/g, 'Δ');
    s = s.replace(/\\epsilon(?![a-zA-Z])/g, 'ε');
    s = s.replace(/\\theta(?![a-zA-Z])/g, 'θ');
    s = s.replace(/\\lambda(?![a-zA-Z])/g, 'λ');
    s = s.replace(/\\mu(?![a-zA-Z])/g, 'μ');
    s = s.replace(/\\pi(?![a-zA-Z])/g, 'π');
    s = s.replace(/\\rho(?![a-zA-Z])/g, 'ρ');
    s = s.replace(/\\sigma(?![a-zA-Z])/g, 'σ');
    s = s.replace(/\\tau(?![a-zA-Z])/g, 'τ');
    s = s.replace(/\\phi(?![a-zA-Z])/g, 'φ');
    s = s.replace(/\\omega(?![a-zA-Z])/g, 'ω');
    s = s.replace(/\\Omega(?![a-zA-Z])/g, 'Ω');

    // Subscripts & Superscripts with curly braces
    s = s.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
    s = s.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');

    // Single-character Subscripts & Superscripts
    s = s.replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
    s = s.replace(/\^([a-zA-Z0-9])/g, '<sup>$1</sup>');

    // Clean up remaining backslashes
    s = s.replace(/\\([a-zA-Z]+)/g, '$1');

    if (isBlock) {
      return `<div class="ai-math-block">${s}</div>`;
    }
    return `<span class="ai-math-inline">${s}</span>`;
  }

  _formatMarkdownTables(text) {
    const lines = text.split('\n');
    const output = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
        tableRows.push(line);
      } else {
        if (inTable) {
          output.push(this._buildHtmlTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        output.push(lines[i]);
      }
    }
    if (inTable && tableRows.length > 0) {
      output.push(this._buildHtmlTable(tableRows));
    }
    return output.join('\n');
  }

  _buildHtmlTable(rows) {
    if (!rows || rows.length === 0) return '';
    const cleanCells = (row) => row.split('|').slice(1, -1).map(c => c.trim());

    const headerCells = cleanCells(rows[0]);
    let bodyRows = rows.slice(1);
    if (bodyRows.length > 0 && bodyRows[0].includes('---')) {
      bodyRows = bodyRows.slice(1);
    }

    const thHtml = headerCells.map(c => `<th>${c}</th>`).join('');
    const trHtml = bodyRows.map(r => {
      const cells = cleanCells(r);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto;margin:8px 0;">
        <table class="ai-msg-table">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </div>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _renderPromptsLibrary() {
    const config = STUDY_MODE_PROMPTS[this.mode] || STUDY_MODE_PROMPTS.bridge;
    return `
      <span class="prompts-heading">${config.heading}</span>
      ${config.groups.map(group => `
        <div class="prompt-group">
          <span class="group-title" style="color:${group.color};">${group.name}:</span>
          ${group.prompts.map(p => `
            <button type="button" class="prompt-chip" data-prompt="${p.prompt}">
              ${p.label}
            </button>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  _renderSuggestions() {
    const config = STUDY_MODE_PROMPTS[this.mode] || STUDY_MODE_PROMPTS.bridge;
    return `
      <span class="sugg-hint">Gợi ý nhanh:</span>
      ${config.suggestions.map(s => `
        <button type="button" class="sugg-chip" data-prompt="${s.prompt}">${s.label}</button>
      `).join('')}
    `;
  }

  _updateModeContent() {
    if (!this.container) return;
    const libEl = this.container.querySelector('#aiPromptsLibrary');
    if (libEl) {
      libEl.innerHTML = this._renderPromptsLibrary();
    }
    const suggEl = this.container.querySelector('#aiQuickSuggestions');
    if (suggEl) {
      suggEl.innerHTML = this._renderSuggestions();
    }
    this._bindPromptChips();
  }

  _bindPromptChips() {
    if (!this.container) return;
    this.container.querySelectorAll('[data-prompt]').forEach(btn => {
      btn.onclick = () => {
        const prompt = btn.getAttribute('data-prompt');
        this._handleUserPrompt(prompt);
      };
    });
  }

  _safeScrollToTop() {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        if (!navigator.userAgent?.includes('jsdom')) {
          window.scrollTo(0, 0);
        }
      } catch {}
    }
    if (typeof document !== 'undefined') {
      try {
        if (document.body) document.body.scrollTop = 0;
        if (document.documentElement) document.documentElement.scrollTop = 0;
      } catch {}
    }
  }

  _bindEvents() {
    if (!this.container) return;

    // 1. API Key Toggle
    const btnToggleConfig = this.container.querySelector('#btnToggleApiConfig');
    const boxConfig = this.container.querySelector('#apiKeyInputBox');
    if (btnToggleConfig && boxConfig) {
      btnToggleConfig.addEventListener('click', () => {
        const isOpen = boxConfig.style.display !== 'none';
        boxConfig.style.display = isOpen ? 'none' : 'flex';
      });
    }

    // Save API Key
    const btnSaveKey = this.container.querySelector('#btnSaveApiKey');
    const inputKey = this.container.querySelector('#inputGeminiApiKey');
    if (btnSaveKey && inputKey) {
      btnSaveKey.addEventListener('click', () => {
        const val = inputKey.value.trim();
        this.apiKey = val;
        setStoredApiKey(val);
        this.render();
      });
    }

    // Clear API Key
    const btnClearKey = this.container.querySelector('#btnClearApiKey');
    if (btnClearKey) {
      btnClearKey.addEventListener('click', () => {
        this.apiKey = '';
        clearStoredApiKey();
        this.render();
      });
    }

    // 2. Mode Buttons (Lab Bridge, Lý thuyết, Gợi ý)
    this.container.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-mode');
        if (this.mode === targetMode) return;
        this.mode = targetMode;
        this.container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._updateModeContent();
      });
    });

    // 3. Prompt Chips in Sidebar & Input Bar
    this._bindPromptChips();

    // 4. Form Submit & Auto-expanding Textarea
    const form = this.container.querySelector('#aiChatForm');
    const textarea = this.container.querySelector('#aiPromptInput');

    if (textarea) {
      textarea.addEventListener('focus', () => {
        this._safeScrollToTop();
      });

      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = textarea.value.trim();
          if (text) {
            this._safeScrollToTop();
            this._handleUserPrompt(text);
            textarea.value = '';
            textarea.style.height = 'auto';
          }
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (textarea) {
          const text = textarea.value.trim();
          if (text) {
            this._safeScrollToTop();
            this._handleUserPrompt(text);
            textarea.value = '';
            textarea.style.height = 'auto';
          }
        }
      });
    }

    // 5. Clear Chat History
    const btnClearHistory = this.container.querySelector('#btnClearChatHistory');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        this.messages = [];
        this._updateMessagesStream();
      });
    }

    // 6. Backward Compatibility Button #btnAiToLab
    const btnAiToLab = this.container.querySelector('#btnAiToLab');
    if (btnAiToLab) {
      btnAiToLab.addEventListener('click', () => {
        this.onNavigate('lab');
      });
    }

    // 7. Lab Bridge Action Buttons Delegation
    const stream = this.container.querySelector('#aiMessagesStream');
    if (stream) {
      stream.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-bridge-execute');
        if (!btn) return;
        const idx = parseInt(btn.getAttribute('data-action-idx'), 10);
        const msg = this.messages[idx];
        if (msg && msg.labAction) {
          this._executeLabAction(msg.labAction);
        }
      });
    }

    // 8. New Chat Button
    const btnNewChat = this.container.querySelector('#btnAiNewChat');
    if (btnNewChat) {
      btnNewChat.addEventListener('click', () => this.startNewChat());
    }

    // 9. Sidebar Tab Navigator (Prompts vs History)
    const tabPrompts = this.container.querySelector('#tabBtnPrompts');
    const tabHistory = this.container.querySelector('#tabBtnHistory');
    const panelPrompts = this.container.querySelector('#aiPromptsPanel');
    const panelHistory = this.container.querySelector('#aiHistoryPanel');

    if (tabPrompts && tabHistory && panelPrompts && panelHistory) {
      tabPrompts.addEventListener('click', () => {
        this.sidebarTab = 'prompts';
        tabPrompts.classList.add('active');
        tabHistory.classList.remove('active');
        panelPrompts.style.display = 'block';
        panelHistory.style.display = 'none';
      });

      tabHistory.addEventListener('click', () => {
        this.sidebarTab = 'history';
        tabHistory.classList.add('active');
        tabPrompts.classList.remove('active');
        panelPrompts.style.display = 'none';
        panelHistory.style.display = 'block';
        panelHistory.innerHTML = this._renderHistoryList();
        this._bindHistoryEvents();
      });
    }

    // 10. Account Switcher / Login Buttons
    const btnSwitchAcc = this.container.querySelector('#btnAiSwitchAccount');
    const btnLoginAcc = this.container.querySelector('#btnAiLoginAccount');
    const globalAuthBtn = document.getElementById('btnUserAuth');

    if (btnSwitchAcc && globalAuthBtn) {
      btnSwitchAcc.addEventListener('click', () => globalAuthBtn.click());
    }
    if (btnLoginAcc && globalAuthBtn) {
      btnLoginAcc.addEventListener('click', () => globalAuthBtn.click());
    }

    // 11. Bind History Item Clicks
    this._bindHistoryEvents();
  }

  _updateStatusBadge() {
    if (!this.container) return;
    const isAiOnline = Boolean(this.apiKey || this.serverAiConfigured);
    const indicator = this.container.querySelector('.status-indicator');
    const label = this.container.querySelector('.status-label');
    const btnToggle = this.container.querySelector('#btnToggleApiConfig');
    const hint = this.container.querySelector('.api-key-hint');

    if (indicator) {
      indicator.className = `status-indicator ${isAiOnline ? 'status-online' : 'status-local'}`;
    }
    if (label) {
      label.textContent = this.apiKey
        ? 'Gemini 3.8 Flash (Online)'
        : (this.serverAiConfigured ? 'Gemini Cloud (Online)' : 'Smart Knowledge Engine (Offline)');
    }
    if (btnToggle) {
      btnToggle.textContent = isAiOnline ? '⚙️ Quản lý API Key' : '🔑 Cài đặt Gemini API Key';
    }
    if (hint) {
      hint.textContent = this.serverAiConfigured 
        ? '✅ Máy chủ Vercel đã kết nối sẵn Gemini AI vĩnh viễn! Bạn không cần dán key nữa, nhưng vẫn có thể dán key riêng nếu muốn ghi đè.' 
        : 'API Key được lưu an toàn trong trình duyệt (LocalStorage). Không bắt buộc có key vì hệ thống luôn có sẵn bộ não suy luận Offline!';
    }
  }

  _bindHistoryEvents() {
    const historyPanel = this.container ? this.container.querySelector('#aiHistoryPanel') : null;
    if (!historyPanel) return;

    // Search Input Real-time Filtering
    const inputSearch = historyPanel.querySelector('#inputSearchHistory');
    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        this.historySearchQuery = e.target.value;
        const currentCursor = e.target.selectionStart;
        historyPanel.innerHTML = this._renderHistoryList();
        this._bindHistoryEvents();
        const newInput = historyPanel.querySelector('#inputSearchHistory');
        if (newInput) {
          newInput.focus();
          try {
            newInput.setSelectionRange(currentCursor, currentCursor);
          } catch {}
        }
      });
    }

    const btnClearSearch = historyPanel.querySelector('#btnClearHistorySearch');
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.historySearchQuery = '';
        historyPanel.innerHTML = this._renderHistoryList();
        this._bindHistoryEvents();
        const newInput = historyPanel.querySelector('#inputSearchHistory');
        if (newInput) {
          newInput.focus();
        }
      });
    }

    historyPanel.querySelectorAll('.ai-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.ai-history-del-btn')) return;
        const sessionId = item.getAttribute('data-session-id');
        if (sessionId) {
          this.loadSession(sessionId);
        }
      });
    });

    historyPanel.querySelectorAll('.ai-history-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = btn.getAttribute('data-del-session-id');
        if (sessionId) {
          aiHistoryManager.deleteSession(sessionId);
          try {
            cloudSyncManager.pushDeleteAiSession(sessionId);
          } catch {}
          if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
          }
          this.render();
        }
      });
    });
  }

  async _handleUserPrompt(promptText) {
    if (!promptText || this.isLoading) return;

    // 1. Add User message
    this.messages.push({
      role: 'user',
      text: promptText,
    });

    // 2. Add temporary Thinking indicator
    this.isLoading = true;
    this.messages.push({
      role: 'assistant',
      text: '⏳ *Trợ lý AI đang phân tích bài toán và tạo mô phỏng thực nghiệm...*',
      isThinking: true,
    });
    this._updateMessagesStream();
    this._scrollToBottom();

    try {
      // 3. Process via Engine
      const result = await this.engine.ask(promptText, {
        mode: this.mode,
        apiKey: this.apiKey,
      });

      // Remove thinking placeholder
      this.messages.pop();

      // Push final assistant response
      this.messages.push({
        role: 'assistant',
        text: result.text,
        labAction: result.labAction,
        isFromApi: Boolean(result.isFromApi),
        source: result.source || (result.isFromApi ? 'gemini_cloud' : 'local'),
        apiErrorReason: result.apiErrorReason || null,
      });

      // 4. Automatically save/update session in AiHistoryManager
      try {
        const currentUser = authManager.getCurrentUser();
        const userId = currentUser ? currentUser.id : 'guest';
        if (!this.currentSessionId) {
          const session = aiHistoryManager.createSession(userId, {
            title: promptText.replace(/^[#\s]+/, '').slice(0, 36) + '...',
            mode: this.mode,
            messages: [...this.messages],
            labSnapshot: result.labAction || null,
          });
          this.currentSessionId = session.id;
          try {
            cloudSyncManager.pushAiSession(session);
          } catch {}
        } else {
          const updated = aiHistoryManager.updateSession(this.currentSessionId, {
            mode: this.mode,
            messages: [...this.messages],
            labSnapshot: result.labAction || null,
          });
          try {
            if (updated) cloudSyncManager.pushAiSession(updated);
          } catch {}
        }
        // Update history badge count if present
        const tabBtnHistory = this.container ? this.container.querySelector('#tabBtnHistory') : null;
        if (tabBtnHistory) {
          const totalSessions = aiHistoryManager.getUserSessions(userId).length;
          tabBtnHistory.textContent = `💬 Lịch sử (${totalSessions})`;
        }
      } catch {
        // history save error ignored
      }
    } catch (err) {
      this.messages.pop();
      this.messages.push({
        role: 'assistant',
        text: `⚠️ **Không thể kết nối với AI:** ${err.message}. Hệ thống sẽ sử dụng bộ suy luận cục bộ Offline cho các câu hỏi tiếp theo.`,
      });
    } finally {
      this.isLoading = false;
      this._updateMessagesStream();
      this._scrollToBottom();
    }
  }

  _updateMessagesStream() {
    const stream = this.container ? this.container.querySelector('#aiMessagesStream') : null;
    if (stream) {
      stream.innerHTML = this._renderMessages();
    }
  }

  _scrollToBottom() {
    const stream = this.container ? this.container.querySelector('#aiMessagesStream') : null;
    if (stream) {
      setTimeout(() => {
        stream.scrollTop = stream.scrollHeight;
        this._safeScrollToTop();
      }, 50);
    }
  }

  /**
   * Executes a Lab Bridge action and teleports the user into the respective Lab!
   * @param {Object} action
   */
  _executeLabAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'logic':
        this.onOpenLogic(action.subtab || 'table', action.expr || null);
        break;

      case 'counting':
        this.onOpenCounting(action.subtab || 'mapping');
        break;

      case 'relation':
        this.onOpenRelation(action.subtab || 'matrix');
        break;

      case 'graph':
        if (action.graphSpec) {
          try {
            const graph = createGraphFromSpecification(action.graphSpec);
            this.onOpenLabWithGraph(graph, action.title || 'Đồ thị từ AI', action.algo || 'dijkstra');
            return;
          } catch (err) {
            console.warn('Failed to parse graphSpec from AI, opening algorithm lab directly:', err);
          }
        }
        this.onOpenLabWithAlgo(action.algo || 'dijkstra');
        break;

      default:
        this.onNavigate(action.type);
        break;
    }
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }
}
