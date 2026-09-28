/**
 * @file TheoryView.js
 * Comprehensive Educational Theory View Component
 * 
 * Provides an in-depth, university-standard curriculum covering all 4 core pillars
 * of Discrete Mathematics (20 structured topics):
 * - Chapter 1 & 2: Propositional Logic, Truth Tables, K-Map, Digital Circuits
 * - Chapter 3: Combinatorics, Pigeonhole (Dirichlet), Recurrence, Mapping
 * - Chapter 4: Binary Relations, Properties, Warshall Closure, Poset & Hasse
 * - Chapter 5: Graph Theory & Core Optimization Algorithms (Dijkstra, Prim, Kruskal, Euler, Hamilton)
 * 
 * Features:
 * - Chapter Filter Tabs & Real-time Keyword Search
 * - Deep-dive Academic Analysis Modal (Problem Formulation, Core Idea, Pseudocode, Trace Table, Complexity, Exam Traps)
 * - 1-Click Interactive Lab Launchpad (Direct execution in Logic, Counting, Relation, or Algorithm Lab)
 * - Direct Quiz Practice Link for each topic
 */

import { THEORY_CHAPTERS, THEORY_TOPICS } from '../../core/theory/theoryData.js';

export class TheoryView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onOpenLabWithAlgo] - Callback(algoKey)
   * @param {Function} [options.onOpenFundamentals] - Callback()
   * @param {Function} [options.onOpenLogic] - Callback(subtab, expr)
   * @param {Function} [options.onOpenCounting] - Callback(tab)
   * @param {Function} [options.onOpenRelation] - Callback(tab, subtab)
   * @param {Function} [options.onOpenQuiz] - Callback(topic)
   * @param {Function} [options.onNavigate] - Callback(viewName, subtab)
   * @param {string} [options.initialChapter] - 'all' | 'ch1_2' | 'ch3' | 'ch4' | 'ch5'
   */
  constructor({
    container = null,
    onOpenLabWithAlgo = null,
    onOpenFundamentals = null,
    onOpenLogic = null,
    onOpenCounting = null,
    onOpenRelation = null,
    onOpenQuiz = null,
    onNavigate = null,
    initialChapter = 'all',
  } = {}) {
    this.container = container;
    this.onOpenLabWithAlgo = onOpenLabWithAlgo || (() => {});
    this.onOpenFundamentals = onOpenFundamentals || (() => {});
    this.onOpenLogic = onOpenLogic || (() => {});
    this.onOpenCounting = onOpenCounting || (() => {});
    this.onOpenRelation = onOpenRelation || (() => {});
    this.onOpenQuiz = onOpenQuiz || (() => {});
    this.onNavigate = onNavigate || (() => {});

    this.activeChapter = initialChapter;
    this.activeDetailTopicId = null;
    this.searchQuery = '';

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

    // Filter topics by chapter and search query
    let filteredTopics = THEORY_TOPICS;
    if (this.activeChapter !== 'all') {
      filteredTopics = filteredTopics.filter(t => t.chapter === this.activeChapter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filteredTopics = filteredTopics.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.badge.toLowerCase().includes(q) ||
        t.chapterName.toLowerCase().includes(q)
      );
    }

    const activeTopic = this.activeDetailTopicId
      ? THEORY_TOPICS.find(t => t.id === this.activeDetailTopicId)
      : null;

    this.container.innerHTML = `
      <div class="theory-container" style="max-width:1200px;margin:0 auto;padding:24px 20px 80px;">
        
        <!-- Header Banner -->
        <div style="margin-bottom:28px;text-align:center;">
          <div class="theory-pill-badge" style="display:inline-flex;align-items:center;gap:8px;padding:6px 18px;border-radius:30px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.28);margin-bottom:16px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px #3b82f6;"></span>
            <span style="font-size:12.5px;font-weight:700;color:var(--blue-light);letter-spacing:0.3px;">
              📚 Cẩm Nang 19 Chuyên Đề Trọng Tâm • Tích Hợp Mô Phỏng Lab
            </span>
          </div>
          <h2 style="font-size:28px;font-weight:800;color:var(--text);margin:0 0 10px;line-height:1.3;">
            Lý Thuyết Tổng Hợp &amp; Phân Tích Giải Thuật Chuyên Sâu
          </h2>
          <p style="font-size:14.5px;color:var(--dim);max-width:820px;margin:0 auto;line-height:1.6;">
            Hệ thống hóa toàn bộ định lý, công thức, mã giả và bảng mô phỏng từng bước của Toán Rời Rạc. 
            Mỗi chuyên đề đều tích hợp <strong>nút thử nghiệm trực tiếp trong phòng thí nghiệm tương tác</strong> để bạn đối chiếu lý thuyết với trực quan hóa thực tế.
          </p>
        </div>

        <!-- Chapter Filter Navigation Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:24px;padding:12px 16px;background:var(--panel);border:1px solid var(--line);border-radius:12px;">
          <div class="theory-filter-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${THEORY_CHAPTERS.map(ch => {
              const isActive = this.activeChapter === ch.id;
              const activeStyle = isActive 
                ? `background:${ch.color || 'var(--blue-light)'};color:#ffffff;border-color:transparent;box-shadow:0 4px 12px rgba(0,0,0,0.15);` 
                : 'background:var(--card-bg);color:var(--text);border:1px solid var(--line);';
              return `
                <button type="button" class="btn-tab ${isActive ? 'active' : ''}" data-chapter="${ch.id}" 
                        style="padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s ease;display:inline-flex;align-items:center;gap:6px;${activeStyle}">
                  <span>${ch.label}</span>
                  <span style="font-size:11px;padding:1px 6px;border-radius:10px;background:${isActive ? 'rgba(255,255,255,0.25)' : 'var(--panel-alt)'};color:${isActive ? '#fff' : 'var(--dim)'};">
                    ${ch.count}
                  </span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Quick Search Input -->
          <div style="display:flex;align-items:center;gap:8px;min-width:240px;flex:1;max-width:320px;">
            <input type="text" id="theorySearchInput" value="${this.searchQuery}" placeholder="🔍 Tìm kiếm bài học, thuật toán..." 
                   style="width:100%;padding:8px 14px;border-radius:8px;background:var(--card-bg);border:1px solid var(--line);color:var(--text);font-size:13px;outline:none;" />
            ${this.searchQuery ? `
              <button type="button" id="btnClearSearch" style="background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:14px;padding:4px 8px;">✕</button>
            ` : ''}
          </div>
        </div>

        <!-- Topics Grid -->
        ${filteredTopics.length === 0 ? `
          <div style="text-align:center;padding:60px 20px;background:var(--panel);border:1px dashed var(--line);border-radius:12px;">
            <span style="font-size:40px;display:block;margin-bottom:12px;">🔍</span>
            <h4 style="font-size:16px;color:var(--text);margin-bottom:6px;">Không tìm thấy bài học phù hợp</h4>
            <p style="font-size:13.5px;color:var(--dim);">Vui lòng thử từ khóa tìm kiếm khác hoặc chuyển sang chuyên đề khác.</p>
          </div>
        ` : `
          <div class="theory-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:20px;">
            ${filteredTopics.map(t => {
              const borderAccent = t.color || 'var(--accent)';
              return `
                <div class="theory-card" data-topic="${t.id}" style="display:flex;flex-direction:column;justify-content:space-between;padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:14px;transition:transform 0.15s ease, box-shadow 0.15s ease;border-top:3px solid ${borderAccent};">
                  <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
                      <span class="theory-badge" style="background:rgba(255,255,255,0.06);border:1px solid ${borderAccent};color:${borderAccent};font-weight:700;font-size:11px;padding:3px 9px;border-radius:6px;">
                        ${t.badge}
                      </span>
                      <span style="font-size:11px;color:var(--dim);font-weight:600;">
                        ${t.chapterName.split(':')[0]}
                      </span>
                    </div>

                    <h3 class="theory-title" style="font-size:17px;font-weight:700;color:var(--text);margin:0 0 10px;line-height:1.4;">
                      ${t.title}
                    </h3>
                    <p class="theory-summary" style="font-size:13px;color:var(--dim);line-height:1.6;margin:0 0 14px;min-height:58px;">
                      ${t.summary}
                    </p>

                    <div style="font-size:11.5px;color:var(--dim);margin-bottom:18px;font-family:monospace;background:var(--panel);padding:6px 10px;border-radius:6px;border:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
                      <span>Độ phức tạp:</span>
                      <strong style="color:${borderAccent};font-weight:700;">${t.complexity}</strong>
                    </div>
                  </div>

                  <!-- Actions Bar -->
                  <div class="theory-actions" style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid var(--line);">
                    ${t.algoKey ? `
                      <button class="btn-primary" data-algo="${t.algoKey}" style="flex:1;padding:9px 12px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;color:#fff;box-shadow:0 3px 10px rgba(59,130,246,0.3);">
                        🚀 Thử trong Lab
                      </button>
                    ` : t.labAction && t.labAction.type === 'fundamentals' ? `
                      <button class="btn-sm" data-action="fundamentals" style="flex:1;padding:9px 12px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;" title="Xem Đại cương Lý thuyết Đồ thị">
                        📖 Khái niệm chung
                      </button>
                    ` : `
                      <button class="btn-primary" data-action="run-lab" data-topic-id="${t.id}" style="flex:1;padding:9px 12px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:linear-gradient(135deg, ${borderAccent}, #334155);border:none;color:#fff;">
                        ${t.chapter === 'ch1_2' ? '🔬' : t.chapter === 'ch3' ? '🎲' : '🔗'} Thử trong Lab
                      </button>
                    `}

                    <button type="button" class="btn-sm" data-action="detail" data-topic-id="${t.id}" style="padding:9px 12px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);white-space:nowrap;" title="Xem phân tích thuật toán, mã giả và bảng trace">
                      📖 Phân tích
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

        <!-- Detailed Modal / Drawer Component -->
        ${activeTopic ? this._renderDetailModal(activeTopic) : ''}

      </div>
    `;

    this._bindEvents();
  }

  /**
   * Renders in-depth academic analysis modal for a selected topic.
   * @param {Object} topic 
   * @returns {string} HTML markup
   */
  _renderDetailModal(topic) {
    const details = topic.details || {};
    const themeColor = topic.color || '#3b82f6';

    return `
      <div id="theoryDetailModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(5px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.15s ease;">
        <div style="background:var(--card-bg);border:1px solid var(--line);border-radius:16px;max-width:880px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;">
          
          <!-- Modal Header -->
          <div style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;background:var(--panel);">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <span class="theory-badge" style="background:rgba(255,255,255,0.06);border:1px solid ${themeColor};color:${themeColor};font-weight:700;font-size:12px;padding:4px 10px;border-radius:8px;">
                ${topic.badge}
              </span>
              <span style="font-size:13px;color:var(--dim);font-weight:600;">
                ${topic.chapterName}
              </span>
            </div>
            <button type="button" id="btnCloseDetailModal" style="background:transparent;border:none;color:var(--dim);font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:color 0.15s ease;" title="Đóng cửa sổ">
              ✕
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div style="padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:22px;line-height:1.7;">
            
            <!-- Title & Overview -->
            <div>
              <h2 style="font-size:22px;font-weight:800;color:var(--text);margin:0 0 8px;">
                ${topic.title}
              </h2>
              <p style="font-size:14px;color:var(--text);margin:0;opacity:0.9;">
                ${topic.summary}
              </p>
            </div>

            <!-- 1. Formulation -->
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
              <h4 style="font-size:14px;font-weight:700;color:${themeColor};margin:0 0 8px;display:flex;align-items:center;gap:8px;">
                <span>🎯</span> 1. Bài toán &amp; Điều kiện áp dụng (Problem Formulation)
              </h4>
              <div style="font-size:13px;color:var(--text);">
                ${details.formulation || 'Đang cập nhật nội dung.'}
              </div>
            </div>

            <!-- 2. Core Idea -->
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
              <h4 style="font-size:14px;font-weight:700;color:${themeColor};margin:0 0 8px;display:flex;align-items:center;gap:8px;">
                <span>🧠</span> 2. Ý tưởng cốt lõi &amp; Nguyên lý toán học (Core Mechanism)
              </h4>
              <div style="font-size:13px;color:var(--text);">
                ${details.coreIdea || 'Đang cập nhật nội dung.'}
              </div>
            </div>

            <!-- 3. Pseudocode -->
            ${details.pseudocode ? `
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
                <h4 style="font-size:14px;font-weight:700;color:${themeColor};margin:0 0 8px;display:flex;align-items:center;gap:8px;">
                  <span>📝</span> 3. Mã giả thuật toán (Academic Pseudocode)
                </h4>
                <pre style="background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;font-size:12.5px;font-family:Consolas, Monaco, monospace;overflow-x:auto;margin:0;line-height:1.5;border:1px solid #1e293b;">${details.pseudocode}</pre>
              </div>
            ` : ''}

            <!-- 4. Trace Example -->
            ${details.stepTrace ? `
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
                <h4 style="font-size:14px;font-weight:700;color:${themeColor};margin:0 0 8px;display:flex;align-items:center;gap:8px;">
                  <span>📊</span> 4. Bảng mô phỏng từng bước (Step-by-Step Trace)
                </h4>
                <pre style="background:var(--panel-alt);color:var(--text);padding:14px 16px;border-radius:8px;font-size:12px;font-family:Consolas, Monaco, monospace;overflow-x:auto;margin:0;line-height:1.5;border:1px solid var(--line);">${details.stepTrace}</pre>
              </div>
            ` : ''}

            <!-- 5. Complexity & Traps Grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;">
                <h4 style="font-size:13.5px;font-weight:700;color:${themeColor};margin:0 0 6px;display:flex;align-items:center;gap:8px;">
                  <span>⚡</span> 5. Đánh giá độ phức tạp
                </h4>
                <div style="font-size:12.5px;color:var(--dim);line-height:1.6;">
                  ${details.complexityNotes || `Độ phức tạp danh định: ${topic.complexity}`}
                </div>
              </div>

              <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;">
                <h4 style="font-size:13.5px;font-weight:700;color:var(--red);margin:0 0 6px;display:flex;align-items:center;gap:8px;">
                  <span>💡</span> 6. Bẫy trắc nghiệm &amp; Lưu ý thi cử
                </h4>
                <div style="font-size:12.5px;color:var(--text);line-height:1.6;">
                  ${details.examTips || 'Luôn nắm vững điều kiện áp dụng trước khi triển khai thuật toán.'}
                </div>
              </div>
            </div>

            <!-- 7. Interactive Launchpad Banner -->
            <div style="background:linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15));border:1px solid rgba(59,130,246,0.35);border-radius:12px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
              <div>
                <h4 style="font-size:15px;font-weight:800;color:var(--text);margin:0 0 4px;display:flex;align-items:center;gap:8px;">
                  <span>🚀</span> Môi Trường Thực Hành Trực Tiếp (Interactive Launchpad)
                </h4>
                <p style="font-size:12.5px;color:var(--dim);margin:0;">
                  Chuyển ngay sang phòng thí nghiệm để mô phỏng từng bước với đồ thị / dữ liệu trực quan!
                </p>
              </div>

              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <button type="button" class="btn-primary" id="btnLaunchLabFromModal" 
                        style="padding:10px 20px;font-size:13.5px;font-weight:700;border-radius:8px;cursor:pointer;background:linear-gradient(135deg, ${themeColor}, #2563eb);border:none;color:#ffffff;box-shadow:0 4px 14px rgba(59,130,246,0.4);display:inline-flex;align-items:center;gap:8px;">
                  <span>${topic.chapter === 'ch1_2' ? '🔬' : topic.chapter === 'ch3' ? '🎲' : topic.chapter === 'ch4' ? '🔗' : '🚀'}</span>
                  <span>Chạy Thử Nghiệm Trong Lab →</span>
                </button>

                <button type="button" class="btn-sm" id="btnLaunchQuizFromModal" 
                        style="padding:10px 16px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" title="Luyện tập trắc nghiệm câu hỏi về chủ đề này">
                  🎯 Luyện trắc nghiệm
                </button>
              </div>
            </div>

          </div>

          <!-- Modal Footer -->
          <div style="padding:12px 24px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;background:var(--panel);">
            <button type="button" class="btn-sm" id="btnCloseDetailModalBottom" style="padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;border-radius:6px;">
              Đóng lại
            </button>
          </div>

        </div>
      </div>
    `;
  }

  /**
   * Executes appropriate laboratory routing based on topic configuration.
   * @param {Object} topic 
   */
  _executeTopicLabAction(topic) {
    if (!topic) return;

    // Close modal if open
    if (this.activeDetailTopicId) {
      this.activeDetailTopicId = null;
      this.render();
    }

    if (topic.algoKey) {
      this.onOpenLabWithAlgo(topic.algoKey);
      return;
    }

    const action = topic.labAction || {};
    if (action.type === 'algo') {
      this.onOpenLabWithAlgo(action.algoKey);
    } else if (action.type === 'fundamentals') {
      this.onOpenFundamentals();
    } else if (action.type === 'logic') {
      this.onOpenLogic(action.subtab || 'table', action.expr || null);
    } else if (action.type === 'counting') {
      this.onOpenCounting(action.tab || 'mapping');
    } else if (action.type === 'relation') {
      this.onOpenRelation(action.tab || 'matrix', action.subsubtab || null);
    } else {
      this.onNavigate('home');
    }
  }

  /**
   * Binds user interaction events.
   */
  _bindEvents() {
    if (!this.container) return;

    // 1. Chapter Filter Tabs
    this.container.querySelectorAll('button[data-chapter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = btn.getAttribute('data-chapter');
        if (ch && ch !== this.activeChapter) {
          this.activeChapter = ch;
          this.render();
        }
      });
    });

    // 2. Search Input
    const searchInput = this.container.querySelector('#theorySearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        // Restore focus to search input
        const reSearch = this.container.querySelector('#theorySearchInput');
        if (reSearch) {
          reSearch.focus();
          reSearch.selectionStart = reSearch.selectionEnd = reSearch.value.length;
        }
      });
    }

    const btnClearSearch = this.container.querySelector('#btnClearSearch');
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
      });
    }

    // 3. Algorithm Action Buttons (button[data-algo] for Dijkstra, Prim, Kruskal, Euler, Hamilton)
    this.container.querySelectorAll('button[data-algo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const algo = btn.getAttribute('data-algo');
        this.onOpenLabWithAlgo(algo);
      });
    });

    // 4. General Lab Run Buttons (button[data-action="run-lab"])
    this.container.querySelectorAll('button[data-action="run-lab"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicId = btn.getAttribute('data-topic-id');
        const topic = THEORY_TOPICS.find(t => t.id === topicId);
        this._executeTopicLabAction(topic);
      });
    });

    // 5. Fundamentals Button (button[data-action="fundamentals"])
    this.container.querySelectorAll('button[data-action="fundamentals"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.onOpenFundamentals();
      });
    });

    // 6. Deep-dive Detail Analysis Buttons (button[data-action="detail"])
    this.container.querySelectorAll('button[data-action="detail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicId = btn.getAttribute('data-topic-id');
        this.activeDetailTopicId = topicId;
        this.render();
      });
    });

    // 7. Modal Close & Actions
    const btnCloseModal = this.container.querySelector('#btnCloseDetailModal');
    const btnCloseModalBottom = this.container.querySelector('#btnCloseDetailModalBottom');
    const modalBackdrop = this.container.querySelector('#theoryDetailModal');

    const closeModal = () => {
      this.activeDetailTopicId = null;
      this.render();
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCloseModalBottom) btnCloseModalBottom.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    const btnLaunchLabFromModal = this.container.querySelector('#btnLaunchLabFromModal');
    if (btnLaunchLabFromModal && this.activeDetailTopicId) {
      btnLaunchLabFromModal.addEventListener('click', () => {
        const topic = THEORY_TOPICS.find(t => t.id === this.activeDetailTopicId);
        this._executeTopicLabAction(topic);
      });
    }

    const btnLaunchQuizFromModal = this.container.querySelector('#btnLaunchQuizFromModal');
    if (btnLaunchQuizFromModal && this.activeDetailTopicId) {
      btnLaunchQuizFromModal.addEventListener('click', () => {
        const topic = THEORY_TOPICS.find(t => t.id === this.activeDetailTopicId);
        this.activeDetailTopicId = null;
        this.render();
        this.onOpenQuiz(topic ? topic.quizFilter : null);
      });
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
