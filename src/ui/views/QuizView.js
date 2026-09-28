/**
 * @file QuizView.js
 * Interactive Quiz & Practice Arena & Teacher's Exam Studio View Component
 * 
 * Features:
 * 1. Interactive Practice Arena:
 *    - Question card with topic badge, difficulty indicator, and progress counter
 *    - Interactive 4-choice options (A, B, C, D) with instant feedback & chime colors
 *    - Score counter, accuracy rate, and continuous winning streak tracker (🔥)
 *    - Step-by-step mathematical reasoning & explanation breakdown
 *    - Action links to jump directly into Logic Lab or Algorithm Lab for visual experiments
 * 2. Teacher's Exam & Worksheet Studio (Dành cho Giảng viên / "Cô"):
 *    - Configurable exam generation (5, 10, 15, 20 questions)
 *    - Filter by Topic (Logic, Graph Theory, All) and Difficulty
 *    - 1-click randomized Exam Code generator (e.g. Mã đề: 308)
 *    - Printable A4 layout with official University Exam Header and Bubble Answer Sheet
 *    - Dedicated Teacher's Answer Key with Fast Grid & detailed solutions
 *    - Direct A4 Print / PDF Export (`window.print()`)
 *    - Full LaTeX (.tex) Source Exporter for Overleaf / TeXmaker
 */

import {
  STATIC_QUESTION_BANK,
  generateExamPaper,
  exportExamToLatex,
  QUIZ_TOPICS,
  QUIZ_DIFFICULTIES,
} from '../../core/quiz/QuizBank.js';
import { authManager } from '../../core/auth/AuthManager.js';
import { quizHistoryManager } from '../../core/quiz/QuizHistoryManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';

export class QuizView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onOpenLabWithAlgo] - Callback(algoKey)
   * @param {Function} [options.onOpenLogicWithExpr] - Callback(expression)
   * @param {Function} [options.onOpenCounting] - Callback(tab)
   * @param {Function} [options.onOpenRelation] - Callback(tab, subtab)
   */
  constructor({
    container = null,
    onOpenLabWithAlgo = null,
    onOpenLogicWithExpr = null,
    onOpenCounting = null,
    onOpenRelation = null,
  } = {}) {
    this.container = container;
    this.onOpenLabWithAlgo = onOpenLabWithAlgo || (() => {});
    this.onOpenLogicWithExpr = onOpenLogicWithExpr || (() => {});
    this.onOpenCounting = onOpenCounting || (() => {});
    this.onOpenRelation = onOpenRelation || (() => {});

    // Active primary tab: 'practice' | 'studio'
    this.activeTab = 'practice';

    // Interactive Practice Mode State
    this.practiceFilter = {
      topic: 'all',
      difficulty: 'all',
    };
    this.practiceQuestions = [];
    this.currentIndex = 0;
    this.userAnswers = {}; // { [questionId]: selectedOptionId }
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.answeredCount = 0;

    // Teacher's Exam Studio State
    this.studioConfig = {
      count: 10,
      topic: 'all',
      difficulty: 'all',
    };
    this.currentExam = null;
    this.showTeacherSolutions = true;

    this._initPracticeQuestions();
    this._generateNewExam();

    if (authManager && typeof authManager.subscribe === 'function') {
      authManager.subscribe(() => {
        if (this.activeTab === 'leaderboard' && this.container) {
          this.render();
        }
      });
    }

    if (cloudSyncManager && typeof cloudSyncManager.subscribe === 'function') {
      cloudSyncManager.subscribe(() => {
        if (this.activeTab === 'leaderboard' && this.container) {
          const badge = this.container.querySelector('#heroCloudBadge');
          if (badge) {
            badge.textContent = cloudSyncManager.isConnected ? '🟢 Đã kết nối Máy chủ (Live)' : '💾 Lưu trữ Trình duyệt (Offline)';
            badge.style.background = cloudSyncManager.isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
            badge.style.color = cloudSyncManager.isConnected ? '#10b981' : '#f59e0b';
            badge.style.borderColor = cloudSyncManager.isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)';
          }
        }
      });
    }

    if (this.container) {
      this.render();
    }
  }

  /**
   * Sets active subtab: 'practice' | 'studio' | 'leaderboard'
   * @param {'practice' | 'studio' | 'leaderboard'} tabName
   */
  setTab(tabName) {
    if (tabName === 'studio' && !authManager.isAdmin()) {
      tabName = 'practice';
    }
    if (tabName === 'practice' || tabName === 'studio' || tabName === 'leaderboard') {
      this.activeTab = tabName;
      if (this.container) {
        this.render();
      }
      if (tabName === 'leaderboard') {
        try {
          cloudSyncManager.syncQuizLeaderboard(quizHistoryManager).then(() => {
            if (this.activeTab === 'leaderboard' && this.container) {
              this.render();
            }
          }).catch(() => {});
        } catch {}
      }
    }
  }

  /**
   * Sets active topic filter programmatically.
   * @param {'all'|'logic'|'counting'|'relation'|'graph'} topic
   */
  setTopic(topic) {
    if (topic) {
      let normalizedTopic = topic;
      if (['dijkstra', 'mst', 'euler_hamilton'].includes(topic)) {
        normalizedTopic = 'graph';
      }
      this.practiceFilter.topic = normalizedTopic;
      this.studioConfig.topic = normalizedTopic;
      this._initPracticeQuestions();
      this._generateNewExam();
      if (this.container) {
        this.render();
      }
    }
  }

  _initPracticeQuestions() {
    let pool = [...STATIC_QUESTION_BANK];
    if (this.practiceFilter.topic !== 'all') {
      pool = pool.filter(q => q.topic === this.practiceFilter.topic);
    }
    if (this.practiceFilter.difficulty !== 'all') {
      pool = pool.filter(q => q.difficulty === this.practiceFilter.difficulty);
    }
    // Shuffle pool
    this.practiceQuestions = pool.sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.userAnswers = {};
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.answeredCount = 0;
  }

  _generateNewExam() {
    this.currentExam = generateExamPaper({
      count: this.studioConfig.count,
      topic: this.studioConfig.topic,
      difficulty: this.studioConfig.difficulty,
    });
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

    if (this.activeTab === 'studio' && !authManager.isAdmin()) {
      this.activeTab = 'practice';
    }

    this.container.innerHTML = `
      <div class="quiz-view-container" style="max-width:1300px;margin:0 auto;padding:20px 24px 60px;">
        
        <!-- Header -->
        <div class="quiz-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:2px 10px;border-radius:12px;font-size:11.5px;font-weight:600;">
                🎯 EdTech & Trắc Nghiệm Thông Minh
              </span>
              <span style="font-size:12px;color:var(--dim);">Toán Rời Rạc & Cấu Trúc Dữ Liệu</span>
            </div>
            <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0;">Luyện Tập & Soạn Đề Thi Trắc Nghiệm</h1>
            <p style="font-size:13.5px;color:var(--dim);margin:4px 0 0;">
              Đấu trường luyện tập phản xạ cho sinh viên và Studio soạn đề thi, xuất bản A4/PDF & LaTeX dành cho Giảng viên.
            </p>
          </div>

          <!-- Main Nav Tabs -->
          <div class="quiz-main-tabs" style="display:flex;gap:8px;align-items:center;background:var(--panel);padding:4px;border-radius:8px;border:1px solid var(--line);">
            <button type="button" class="btn-tab ${this.activeTab === 'practice' ? 'active' : ''}" id="tabBtnPractice" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              🎮 Đấu Trường Luyện Tập
            </button>
            <button type="button" class="btn-tab ${this.activeTab === 'studio' ? 'active' : ''}" id="tabBtnStudio" style="${authManager.isAdmin() ? '' : 'display:none;'}padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              👩‍🏫 Studio Soạn Đề &amp; In Ấn
            </button>
            <button type="button" class="btn-tab ${this.activeTab === 'leaderboard' ? 'active' : ''}" id="tabBtnLeaderboard" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              🏆 Bảng Xếp Hạng
            </button>
          </div>
        </div>

        <!-- TAB 1: PRACTICE ARENA -->
        <div id="panePractice" style="display:${this.activeTab === 'practice' ? 'block' : 'none'};">
          ${this._renderPracticeView()}
        </div>

        <!-- TAB 2: TEACHER'S EXAM STUDIO -->
        <div id="paneStudio" style="display:${this.activeTab === 'studio' ? 'block' : 'none'};">
          ${this._renderStudioView()}
        </div>

        <!-- TAB 3: LEADERBOARD & USER STATS -->
        <div id="paneLeaderboard" style="display:${this.activeTab === 'leaderboard' ? 'block' : 'none'};">
          ${this._renderLeaderboardView()}
        </div>

      </div>
    `;

    this._bindEvents();
  }

  // =========================================================================
  // SUB-VIEW 1: INTERACTIVE PRACTICE ARENA
  // =========================================================================

  _renderPracticeView() {
    const q = this.practiceQuestions[this.currentIndex];
    const total = this.practiceQuestions.length;
    const answered = Boolean(q && this.userAnswers[q.id]);
    const selectedOptId = q ? this.userAnswers[q.id] : null;

    return `
      <!-- Practice Controls & Scoreboard -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
        
        <!-- Filter Controls Card -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
          <div style="font-size:12px;color:var(--dim);font-weight:600;text-transform:uppercase;margin-bottom:10px;">Lọc Chuyên Đề & Độ Khó</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <select id="selPracticeTopic" class="form-input" style="flex:1;min-width:140px;padding:6px 10px;font-size:12.5px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="all" ${this.practiceFilter.topic === 'all' ? 'selected' : ''}>🌟 Tất cả các chương (56 câu)</option>
              <option value="logic" ${this.practiceFilter.topic === 'logic' ? 'selected' : ''}>⚡ Chương 1 & 2: Cơ sở Logic & Mệnh đề</option>
              <option value="counting" ${this.practiceFilter.topic === 'counting' ? 'selected' : ''}>🎲 Chương 3: Đại số Tổ hợp & Đếm</option>
              <option value="relation" ${this.practiceFilter.topic === 'relation' ? 'selected' : ''}>🔗 Chương 4: Quan hệ 2 ngôi & Đại số Bool</option>
              <option value="graph" ${this.practiceFilter.topic === 'graph' ? 'selected' : ''}>🌐 Chương 5: Lý thuyết Đồ thị & Thuật toán</option>
            </select>
            <select id="selPracticeDiff" class="form-input" style="flex:1;min-width:130px;padding:6px 10px;font-size:12.5px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="all" ${this.practiceFilter.difficulty === 'all' ? 'selected' : ''}>Tất cả độ khó</option>
              <option value="easy" ${this.practiceFilter.difficulty === 'easy' ? 'selected' : ''}>Dễ (Cơ bản)</option>
              <option value="medium" ${this.practiceFilter.difficulty === 'medium' ? 'selected' : ''}>Trung bình</option>
              <option value="hard" ${this.practiceFilter.difficulty === 'hard' ? 'selected' : ''}>Nâng cao</option>
            </select>
            <button type="button" class="btn-sm" id="btnResetPractice" style="padding:6px 12px;font-size:12px;" title="Xáo trộn lại câu hỏi">
              🔄 Làm mới
            </button>
          </div>
        </div>

        <!-- Realtime Scoreboard Card -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;align-items:center;justify-content:space-around;">
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;text-transform:uppercase;">Điểm Số</div>
            <div style="font-size:24px;font-weight:800;color:var(--accent);">${this.score} <span style="font-size:13px;font-weight:normal;color:var(--dim);">/ ${this.answeredCount * 10 || 0}</span></div>
          </div>
          <div style="height:36px;width:1px;background:var(--line);"></div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;text-transform:uppercase;">Tỷ Lệ Đúng</div>
            <div style="font-size:24px;font-weight:800;color:#10b981;">
              ${this.answeredCount > 0 ? Math.round((this.score / (this.answeredCount * 10)) * 100) : 0}%
            </div>
          </div>
          <div style="height:36px;width:1px;background:var(--line);"></div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;text-transform:uppercase;">Chuỗi Thắng</div>
            <div style="font-size:24px;font-weight:800;color:#f43f5e;">
              🔥 ${this.streak} <span style="font-size:11.5px;color:var(--dim);font-weight:normal;">(Kỷ lục: ${this.maxStreak})</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Question Card -->
      ${total === 0 ? `
        <div style="text-align:center;padding:60px 20px;background:var(--panel);border:1px dashed var(--line);border-radius:10px;">
          <div style="font-size:36px;margin-bottom:12px;">🔍</div>
          <h3 style="color:var(--text);margin:0 0 8px;">Không tìm thấy câu hỏi phù hợp bộ lọc</h3>
          <p style="color:var(--dim);font-size:13px;margin:0 0 16px;">Vui lòng chọn bộ lọc khác để tiếp tục luyện tập.</p>
          <button type="button" class="btn-primary" id="btnResetFilters">Xóa bộ lọc</button>
        </div>
      ` : `
        <div class="practice-question-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,0.15);margin-bottom:20px;">
          
          <!-- Question Meta Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:12.5px;font-weight:700;background:var(--panel-alt);border:1px solid var(--line);padding:3px 10px;border-radius:6px;color:var(--text);">
                Câu ${this.currentIndex + 1} / ${total}
              </span>
              <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">
                ${q.topicName || q.topic}
              </span>
              <span class="pill-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">
                ${q.difficulty === 'easy' ? 'Độ khó: Dễ' : q.difficulty === 'medium' ? 'Độ khó: Trung bình' : 'Độ khó: Nâng cao'}
              </span>
            </div>

            <!-- Jump Navigation -->
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" class="btn-sm" id="btnPracticePrev" ${this.currentIndex === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                ❮ Câu trước
              </button>
              <button type="button" class="btn-sm" id="btnPracticeNext" ${this.currentIndex === total - 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                Câu tiếp ❯
              </button>
            </div>
          </div>

          <!-- Question Content -->
          <div style="font-size:16px;font-weight:600;color:var(--text);line-height:1.6;margin-bottom:24px;padding:12px 16px;background:var(--panel-alt);border-radius:8px;border-left:4px solid var(--accent);">
            ${q.question}
          </div>

          <!-- Options List (Hàng dọc A B C D) -->
          <div class="quiz-options-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;width:100%;">
            ${q.options.map((opt) => {
              let btnStyle = `display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:8px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:14px;text-align:left;cursor:pointer;transition:all 0.15s ease;width:100%;white-space:normal !important;word-break:normal !important;line-height:1.5;`;
              let badgeColor = `background:var(--line);color:var(--text);`;

              if (answered) {
                if (opt.id === q.correctId) {
                  btnStyle = `display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:8px;background:rgba(16,185,129,0.15);border:2px solid #10b981;color:var(--text);font-size:14px;text-align:left;width:100%;white-space:normal !important;word-break:normal !important;line-height:1.5;`;
                  badgeColor = `background:#10b981;color:#ffffff;font-weight:bold;`;
                } else if (opt.id === selectedOptId) {
                  btnStyle = `display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:8px;background:rgba(244,63,94,0.15);border:2px solid #f43f5e;color:var(--text);font-size:14px;text-align:left;width:100%;white-space:normal !important;word-break:normal !important;line-height:1.5;`;
                  badgeColor = `background:#f43f5e;color:#ffffff;font-weight:bold;`;
                } else {
                  btnStyle += `opacity:0.6;cursor:default;`;
                }
              }

              return `
                <button type="button" class="btn-quiz-option" data-opt-id="${opt.id}" ${answered ? 'disabled' : ''} style="${btnStyle}">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:13px;font-weight:700;flex-shrink:0;${badgeColor}">
                    ${opt.id}
                  </span>
                  <span style="flex:1;font-weight:500;">${opt.text}</span>
                  ${answered && opt.id === q.correctId ? '<span style="color:#10b981;font-weight:bold;padding-left:10px;white-space:nowrap;">✓ Đúng</span>' : ''}
                  ${answered && opt.id === selectedOptId && opt.id !== q.correctId ? '<span style="color:#f43f5e;font-weight:bold;padding-left:10px;white-space:nowrap;">✗ Sai</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <!-- Explanation & Action Link Box (revealed upon answering) -->
          ${answered ? `
            <div class="quiz-explanation-box" style="margin-top:20px;padding:16px;border-radius:8px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.25);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:16px;">💡</span>
                <span style="font-size:13px;font-weight:700;color:#38bdf8;text-transform:uppercase;">
                  Hướng Dẫn Lời Giải & Bản Chất Toán Học:
                </span>
              </div>
              <p style="font-size:13.5px;color:var(--text);line-height:1.6;margin:0 0 12px;">
                ${q.explanation}
              </p>

              <!-- Action Link to open in Lab -->
              ${q.actionLink ? `
                <div style="display:flex;align-items:center;justify-content:flex-end;padding-top:10px;border-top:1px dashed rgba(56,189,248,0.2);">
                  <button type="button" class="btn-sm btn-open-lab" data-action-view="${q.actionLink.view}" data-action-val="${q.actionLink.tab || q.actionLink.expression || q.actionLink.algoKey || ''}" style="background:rgba(245,158,11,0.15);color:var(--accent);border:1px solid rgba(245,158,11,0.3);padding:6px 14px;border-radius:6px;font-weight:600;font-size:12.5px;">
                    ${q.actionLink.view === 'logic' ? '⚖️ Mở thử nghiệm biểu thức trong Logic Lab ❯' :
                      q.actionLink.view === 'counting' ? '🎲 Mở thực nghiệm trong Counting Lab ❯' :
                      q.actionLink.view === 'relation' ? '🔗 Mở thực nghiệm trong Relation Lab ❯' :
                      '🔬 Mở trực quan hóa trong Algorithm Lab ❯'}
                  </button>
                </div>
              ` : ''}
            </div>
          ` : ''}

        </div>
      `}
    `;
  }

  // =========================================================================
  // SUB-VIEW 2: TEACHER'S EXAM STUDIO (DÀNH CHO GIẢNG VIÊN / "CÔ")
  // =========================================================================

  _renderStudioView() {
    const exam = this.currentExam;
    if (!exam) return `<div>Đang tải đề thi...</div>`;

    return `
      <!-- Teacher's Studio Controls Bar (No Print) -->
      <div class="exam-studio-controls no-print" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
              <span>👩‍🏫 Studio Soạn Đề Thi Trắc Nghiệm</span>
              <span class="pill-badge" style="background:rgba(245,158,11,0.15);color:var(--accent);font-size:11px;padding:2px 8px;border-radius:10px;">
                Mã đề: ${exam.examCode}
              </span>
            </div>
            <p style="font-size:12px;color:var(--dim);margin:3px 0 0;">
              Tạo đề thi chuẩn mẫu Bộ GD&ĐT & Đại học, in trực tiếp ra giấy A4 hoặc chép mã nguồn LaTeX cho Overleaf.
            </p>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="btnPrintExam" style="padding:8px 16px;font-size:13px;font-weight:600;">
              🖨️ In Đề / Xuất PDF (A4)
            </button>
            <button type="button" class="btn-secondary" id="btnCopyLatex" style="padding:8px 16px;font-size:13px;font-weight:600;border:1px solid var(--line);">
              📋 Sao Chép Mã LaTeX (.tex)
            </button>
            <button type="button" class="btn-sm" id="btnGenNewExam" style="padding:8px 14px;font-size:13px;background:var(--panel-alt);border:1px solid var(--accent);color:var(--accent);font-weight:600;">
              🎲 Đổi Mã Đề Khác
            </button>
          </div>
        </div>

        <!-- Configuration Bar -->
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--dim);">Số lượng câu:</span>
            <select id="selStudioCount" class="form-input" style="padding:4px 8px;font-size:12px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="5" ${this.studioConfig.count === 5 ? 'selected' : ''}>5 câu (Kiểm tra 15 phút)</option>
              <option value="10" ${this.studioConfig.count === 10 ? 'selected' : ''}>10 câu (Kiểm tra 45 phút)</option>
              <option value="15" ${this.studioConfig.count === 15 ? 'selected' : ''}>15 câu (Đề thi giữa kỳ)</option>
              <option value="20" ${this.studioConfig.count === 20 ? 'selected' : ''}>20 câu (Đề thi kết thúc học phần)</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--dim);">Chuyên đề:</span>
            <select id="selStudioTopic" class="form-input" style="padding:4px 8px;font-size:12px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="all" ${this.studioConfig.topic === 'all' ? 'selected' : ''}>🌟 Toàn diện cả 4 chương</option>
              <option value="logic" ${this.studioConfig.topic === 'logic' ? 'selected' : ''}>⚡ Chương 1 & 2: Cơ sở Logic & Mệnh đề</option>
              <option value="counting" ${this.studioConfig.topic === 'counting' ? 'selected' : ''}>🎲 Chương 3: Đại số Tổ hợp & Đếm</option>
              <option value="relation" ${this.studioConfig.topic === 'relation' ? 'selected' : ''}>🔗 Chương 4: Quan hệ 2 ngôi & Đại số Bool</option>
              <option value="graph" ${this.studioConfig.topic === 'graph' ? 'selected' : ''}>🌐 Chương 5: Lý thuyết Đồ thị & Thuật toán</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--dim);">Độ khó:</span>
            <select id="selStudioDiff" class="form-input" style="padding:4px 8px;font-size:12px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="all" ${this.studioConfig.difficulty === 'all' ? 'selected' : ''}>Tổng hợp (Cân đối)</option>
              <option value="easy" ${this.studioConfig.difficulty === 'easy' ? 'selected' : ''}>Cơ bản (Dễ)</option>
              <option value="medium" ${this.studioConfig.difficulty === 'medium' ? 'selected' : ''}>Trung bình</option>
              <option value="hard" ${this.studioConfig.difficulty === 'hard' ? 'selected' : ''}>Nâng cao</option>
            </select>
          </div>

          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto;color:var(--text);">
            <input type="checkbox" id="chkShowSolutions" ${this.showTeacherSolutions ? 'checked' : ''} />
            Hiện hướng dẫn giải chi tiết cho Giảng viên
          </label>
        </div>
      </div>

      <!-- A4 PAPER CONTAINER FOR PREVIEW AND PRINTING -->
      <div class="exam-paper-wrapper" style="background:#f1f5f9;padding:24px;border-radius:8px;">
        
        <!-- =================== TRANG 1: ĐỀ THI SINH VIÊN =================== -->
        <div class="exam-paper" style="background:#ffffff;color:#1e293b;max-width:860px;margin:0 auto;padding:40px 48px;box-shadow:0 4px 16px rgba(0,0,0,0.1);border-radius:4px;font-family:'Times New Roman', Times, serif;line-height:1.45;">
          
          <!-- University Header Box -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1.5px solid #000;padding-bottom:12px;">
            <div style="width:48%;">
              <div style="font-size:13px;font-weight:bold;text-transform:uppercase;">TRƯỜNG ĐẠI HỌC ...........................</div>
              <div style="font-size:13px;font-weight:bold;text-transform:uppercase;">KHOA CÔNG NGHỆ THÔNG TIN</div>
              <div style="font-size:12.5px;font-style:italic;margin-top:6px;">Họ tên SV: ......................................................</div>
              <div style="font-size:12.5px;font-style:italic;margin-top:4px;">Mã số sinh viên (MSSV): ............................ Lớp: ..........</div>
            </div>
            <div style="width:48%;text-align:right;">
              <div style="font-size:14px;font-weight:bold;text-transform:uppercase;">ĐỀ THI MÔN: TOÁN RỜI RẠC</div>
              <div style="font-size:12px;font-weight:normal;margin-top:2px;">Thời gian làm bài: 45 phút (Không sử dụng tài liệu)</div>
              <div style="display:inline-block;margin-top:6px;padding:3px 12px;border:1.5px solid #000;font-size:13px;font-weight:bold;">
                MÃ ĐỀ THI: ${exam.examCode}
              </div>
            </div>
          </div>

          <!-- Section Title -->
          <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:16px;text-transform:uppercase;">
            NỘI DUNG ĐỀ THI TRẮC NGHIỆM (${exam.totalQuestions} CÂU)
          </div>

          <!-- Questions List -->
          <div class="exam-questions-list">
            ${exam.questions.map((q, idx) => {
              const maxLen = Math.max(...q.options.map(o => o.text.length));
              const gridCols = maxLen > 45 ? '1fr' : '1fr 1fr';
              return `
              <div class="exam-question-item" style="margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">
                <div style="font-size:13.5px;margin-bottom:5px;line-height:1.45;">
                  <strong style="font-family:'Times New Roman', serif;">Câu ${idx + 1}:</strong> ${q.question}
                </div>
                <div style="display:grid;grid-template-columns:${gridCols};gap:4px 16px;padding-left:14px;font-size:13px;line-height:1.4;">
                  ${q.options.map(opt => `
                    <div><strong>${opt.id}.</strong> ${opt.text}</div>
                  `).join('')}
                </div>
              </div>
            `;
            }).join('')}
          </div>

          <!-- Student Answer Bubble Sheet on Exam Paper -->
          <div class="exam-bubble-sheet" style="margin-top:24px;border-top:1px dashed #64748b;padding-top:16px;page-break-inside:avoid;break-inside:avoid;">
            <div style="font-size:12px;font-weight:bold;text-transform:uppercase;margin-bottom:8px;text-align:center;">
              PHIẾU TRẢ LỜI TRẮC NGHIỆM (Thí sinh dùng bút chì tô kín vào ô tròn)
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:4px;">
              ${exam.questions.map((_, i) => `
                <div style="display:flex;align-items:center;gap:4px;font-size:12px;min-width:105px;">
                  <span style="font-weight:bold;width:22px;text-align:right;">${i + 1}.</span>
                  <span style="display:inline-block;width:15px;height:15px;border:1px solid #475569;border-radius:50%;text-align:center;line-height:13px;font-size:9px;">A</span>
                  <span style="display:inline-block;width:15px;height:15px;border:1px solid #475569;border-radius:50%;text-align:center;line-height:13px;font-size:9px;">B</span>
                  <span style="display:inline-block;width:15px;height:15px;border:1px solid #475569;border-radius:50%;text-align:center;line-height:13px;font-size:9px;">C</span>
                  <span style="display:inline-block;width:15px;height:15px;border:1px solid #475569;border-radius:50%;text-align:center;line-height:13px;font-size:9px;">D</span>
                </div>
              `).join('')}
            </div>
            <div style="text-align:center;font-size:11.5px;font-style:italic;margin-top:12px;color:#475569;">
              --- HẾT --- (Cán bộ coi thi không giải thích gì thêm)
            </div>
          </div>

        </div>

        <!-- =================== TRANG 2: BẢNG ĐÁP ÁN & HƯỚNG DẪN CHẤM (CHO GIẢNG VIÊN) =================== -->
        <div class="exam-paper teacher-key-page" style="display:${this.showTeacherSolutions ? 'block' : 'none'};background:#ffffff;color:#1e293b;max-width:860px;margin:32px auto 0;padding:40px 48px;box-shadow:0 4px 16px rgba(0,0,0,0.1);border-radius:4px;font-family:'Times New Roman', Times, serif;line-height:1.45;page-break-before:always;">
          
          <div style="text-align:center;border-bottom:1.5px solid #000;padding-bottom:10px;margin-bottom:16px;">
            <div style="font-size:15px;font-weight:bold;text-transform:uppercase;">
              ĐÁP ÁN & HƯỚNG DẪN CHẤM CHI TIẾT
            </div>
            <div style="font-size:13px;font-weight:bold;color:#047857;margin-top:3px;">
              DÀNH CHO GIẢNG VIÊN / CÔ CHẤM THI — MÃ ĐỀ: ${exam.examCode}
            </div>
          </div>

          <!-- Fast Answer Table -->
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:bold;margin-bottom:6px;text-transform:uppercase;">
              1. Bảng Đáp Án Nhanh:
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;text-align:center;font-size:12.5px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #94a3b8;padding:6px;">Câu</th>
                    ${exam.questions.map((_, i) => `<th style="border:1px solid #94a3b8;padding:6px;">${i + 1}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border:1px solid #94a3b8;padding:6px;font-weight:bold;background:#f8fafc;">Đáp án</td>
                    ${exam.questions.map(q => `<td style="border:1px solid #94a3b8;padding:6px;font-weight:bold;color:#047857;">${q.correctId}</td>`).join('')}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Step-by-step Detailed Solutions -->
          <div>
            <div style="font-size:13px;font-weight:bold;margin-bottom:8px;text-transform:uppercase;">
              2. Lời Giải Chi Tiết Từng Câu:
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${exam.questions.map((q, idx) => `
                <div style="padding:10px 14px;background:#f8fafc;border-left:3px solid #059669;border-radius:4px;font-size:12.5px;">
                  <div style="font-weight:bold;margin-bottom:4px;">
                    Câu ${idx + 1} — Đáp án đúng: <span style="color:#047857;">[ ${q.correctId} ]</span>
                  </div>
                  <div style="color:#334155;line-height:1.5;">
                    ${q.explanation}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>
    `;
  }

  // =========================================================================
  // SUB-VIEW 3: LEADERBOARD & USER STATS
  // =========================================================================

  _renderLeaderboardView() {
    const leaderboard = quizHistoryManager.getLeaderboard();
    const currentUser = authManager.getCurrentUser();
    const isAdmin = authManager.isAdmin();
    const userStats = currentUser ? quizHistoryManager.getUserStats(currentUser.id) : null;

    const rank1 = leaderboard[0] || null;
    const rank2 = leaderboard[1] || null;
    const rank3 = leaderboard[2] || null;

    return `
      <div class="quiz-leaderboard-container">
        
        <!-- Leaderboard Header Banner -->
        <div class="leaderboard-hero-card">
          <div class="hero-content">
            <div class="hero-tag">
              <span>🏆 BẢNG VÀNG THÀNH TÍCH</span>
              <span class="dot-sep">•</span>
              <span>Sinh viên Toán Rời Rạc</span>
              <span class="dot-sep">•</span>
              <span class="hero-cloud-badge" id="heroCloudBadge" title="Trạng thái máy chủ. Dữ liệu của bạn luôn được lưu an toàn 100% trong trình duyệt (Offline-First) và tự động đồng bộ khi có kết nối backend." style="font-size:11px;padding:2px 8px;border-radius:10px;background:${cloudSyncManager.isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${cloudSyncManager.isConnected ? '#10b981' : '#f59e0b'};border:1px solid ${cloudSyncManager.isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'};cursor:help;">
                ${cloudSyncManager.isConnected ? '🟢 Đã kết nối Máy chủ (Live)' : '💾 Lưu trữ Trình duyệt (Offline)'}
              </span>
            </div>
            <h2 class="hero-title">Đấu Trường Trắc Nghiệm Toán Rời Rạc</h2>
            <p class="hero-desc">
              Vinh danh các sinh viên xuất sắc nhất có phản xạ nhanh, tỷ lệ trả lời chính xác cao nhất và chuỗi thắng dài nhất qua 4 phân môn Toán Rời Rạc.
            </p>
          </div>
          <div class="hero-actions" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn-primary" id="btnGoToPracticeFromLb" style="padding:10px 20px;font-size:13.5px;font-weight:700;">
              🎮 Vào Luyện Tập Để Leo Rank Ngay ➔
            </button>
            ${isAdmin ? `
              <button type="button" class="btn-danger-outline" id="btnAdminResetLeaderboard" title="Chỉ Quản trị viên (admin): Xóa toàn bộ dữ liệu bảng xếp hạng và làm sạch về 0" style="padding:10px 18px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;border:1px solid #ef4444;color:#ef4444;background:rgba(239,68,68,0.08);border-radius:6px;cursor:pointer;">
                🗑️ Reset Bảng Xếp Hạng
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Top 3 Podium (Bục Vinh Quang) -->
        <div class="leaderboard-podium-row">
          
          <!-- PODIUM RANK 2 (Á Khoa) -->
          <div class="podium-card podium-rank-2">
            <div class="podium-medal">🥈</div>
            <div class="podium-avatar">${rank2 ? rank2.avatar : '👨‍💻'}</div>
            <h3 class="podium-name">${rank2 ? this._escapeHtml(rank2.fullName) : 'Chưa có'}</h3>
            <span class="podium-class">${rank2 ? this._escapeHtml(rank2.className) : 'Sinh viên'}</span>
            <div class="podium-badge">${rank2 ? (rank2.badge || '🥈 Á Khoa') : 'Đang đua top'}</div>
            <div class="podium-stat-pill">
              <span class="stat-score">${rank2 ? rank2.score.toLocaleString() : 0} điểm</span>
              <span class="stat-acc">Đúng: ${rank2 ? rank2.accuracy : 0}%</span>
            </div>
            <div class="podium-streak">🔥 Chuỗi kỷ lục: <strong>${rank2 ? rank2.maxStreak : 0}</strong></div>
            <div class="podium-stand stand-2">
              <span class="stand-number">2</span>
            </div>
          </div>

          <!-- PODIUM RANK 1 (Thủ Khoa) -->
          <div class="podium-card podium-rank-1">
            <div class="podium-crown">👑</div>
            <div class="podium-medal">🥇</div>
            <div class="podium-avatar">${rank1 ? rank1.avatar : '👨‍🎓'}</div>
            <h3 class="podium-name">${rank1 ? this._escapeHtml(rank1.fullName) : 'Chưa có'}</h3>
            <span class="podium-class">${rank1 ? this._escapeHtml(rank1.className) : 'Sinh viên'}</span>
            <div class="podium-badge">${rank1 ? (rank1.badge || '🏆 Thủ Khoa') : 'Đang dẫn đầu'}</div>
            <div class="podium-stat-pill gold">
              <span class="stat-score">${rank1 ? rank1.score.toLocaleString() : 0} điểm</span>
              <span class="stat-acc">Đúng: ${rank1 ? rank1.accuracy : 0}%</span>
            </div>
            <div class="podium-streak">🔥 Chuỗi kỷ lục: <strong>${rank1 ? rank1.maxStreak : 0}</strong></div>
            <div class="podium-stand stand-1">
              <span class="stand-number">1</span>
            </div>
          </div>

          <!-- PODIUM RANK 3 (Hạng Ba) -->
          <div class="podium-card podium-rank-3">
            <div class="podium-medal">🥉</div>
            <div class="podium-avatar">${rank3 ? rank3.avatar : '👨‍🔬'}</div>
            <h3 class="podium-name">${rank3 ? this._escapeHtml(rank3.fullName) : 'Chưa có'}</h3>
            <span class="podium-class">${rank3 ? this._escapeHtml(rank3.className) : 'Sinh viên'}</span>
            <div class="podium-badge">${rank3 ? (rank3.badge || '🥉 Hạng Ba') : 'Đang đua top'}</div>
            <div class="podium-stat-pill">
              <span class="stat-score">${rank3 ? rank3.score.toLocaleString() : 0} điểm</span>
              <span class="stat-acc">Đúng: ${rank3 ? rank3.accuracy : 0}%</span>
            </div>
            <div class="podium-streak">🔥 Chuỗi kỷ lục: <strong>${rank3 ? rank3.maxStreak : 0}</strong></div>
            <div class="podium-stand stand-3">
              <span class="stand-number">3</span>
            </div>
          </div>

        </div>

        <!-- Personal Stats Card -->
        <div class="leaderboard-my-card">
          ${currentUser ? `
            <div class="my-card-header">
              <div class="my-card-user">
                <span class="my-card-avatar">${currentUser.avatar || '👤'}</span>
                <div>
                  <h4 class="my-card-name">${this._escapeHtml(currentUser.fullName)}</h4>
                  <span class="my-card-subtitle">${this._escapeHtml(currentUser.className || 'Sinh viên')} • @${this._escapeHtml(currentUser.username)}</span>
                </div>
              </div>
              <div class="my-card-rank-badge">
                ${(() => {
                  const myRankIdx = leaderboard.findIndex(u => u.userId === currentUser.id);
                  if (myRankIdx !== -1) {
                    return `<span>Hạng toàn lớp: <strong>#${myRankIdx + 1}</strong></span>`;
                  }
                  return `<span>Chưa có xếp hạng</span>`;
                })()}
              </div>
            </div>
            <div class="my-card-stats-grid">
              <div class="stat-box">
                <span class="box-label">Điểm tích lũy</span>
                <span class="box-val highlight">${userStats ? (userStats.score || 0).toLocaleString() : 0}</span>
              </div>
              <div class="stat-box">
                <span class="box-label">Câu đã trả lời</span>
                <span class="box-val">${userStats ? (userStats.totalAnswered || 0) : 0}</span>
              </div>
              <div class="stat-box">
                <span class="box-label">Số câu đúng</span>
                <span class="box-val text-green">${userStats ? (userStats.correctCount || 0) : 0}</span>
              </div>
              <div class="stat-box">
                <span class="box-label">Tỷ lệ chính xác</span>
                <span class="box-val">${userStats ? (userStats.accuracy || 0) : 0}%</span>
              </div>
              <div class="stat-box">
                <span class="box-label">Chuỗi thắng cao nhất</span>
                <span class="box-val text-orange">🔥 ${userStats ? (userStats.maxStreak || 0) : 0}</span>
              </div>
            </div>
            ${userStats && userStats.history && userStats.history.length > 0 ? `
              <div class="my-card-recent-exams">
                <span class="recent-title">📜 Lịch sử các bài kiểm tra gần nhất:</span>
                <div class="recent-list">
                  ${userStats.history.slice(0, 4).map(h => `
                    <div class="recent-item">
                      <span class="exam-name">${this._escapeHtml(h.examTitle)}</span>
                      <span class="exam-score">Điểm: <strong>${h.score}/${h.maxScore}</strong> (${h.accuracy}%)</span>
                      <span class="exam-date">${new Date(h.date).toLocaleDateString('vi-VN')}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          ` : `
            <div class="my-card-guest">
              <div class="guest-info">
                <span style="font-size:32px;">👤</span>
                <div>
                  <h4 style="margin:0 0 4px;font-size:16px;color:var(--text);font-weight:700;">Bạn đang làm bài dưới tư cách Khách</h4>
                  <p style="margin:0;font-size:13px;color:var(--dim);">
                    Đăng nhập hoặc đăng ký tài khoản để hệ thống tự động ghi nhận điểm và đưa bạn lên Bảng Vàng!
                  </p>
                </div>
              </div>
              <button type="button" class="btn-primary" id="btnLeaderboardLogin" style="padding:10px 18px;font-size:13px;font-weight:600;white-space:nowrap;">
                🔑 Đăng Nhập / Đăng Ký Ngay
              </button>
            </div>
          `}
        </div>

        <!-- Full Class Ranking Table -->
        <div class="leaderboard-table-card">
          <div class="table-card-header">
            <h3 class="table-card-title">📋 Bảng Xếp Hạng Luyện Tập &amp; Thi Thử</h3>
            <span class="table-card-count">${leaderboard.length} thành viên đã tham gia</span>
          </div>

          <div style="overflow-x:auto;">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th style="width:70px;text-align:center;">Hạng</th>
                  <th>Sinh viên</th>
                  <th style="text-align:right;">Điểm số</th>
                  <th style="text-align:center;">Đúng/Tổng</th>
                  <th style="text-align:center;">Tỷ lệ</th>
                  <th style="text-align:center;">Chuỗi 🔥</th>
                  <th>Danh hiệu</th>
                  ${isAdmin ? '<th style="text-align:center;width:90px;">Hành động</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${leaderboard.length === 0 ? `
                  <tr>
                    <td colspan="${isAdmin ? 8 : 7}" style="text-align:center;padding:36px;color:var(--dim);font-style:italic;font-size:14px;">
                      🌟 Bảng xếp hạng hiện đang trống. Hãy là người đầu tiên hoàn thành bài thi để dẫn đầu Bảng Vàng!
                    </td>
                  </tr>
                ` : leaderboard.map(item => {
                  const isCurrent = currentUser && item.userId === currentUser.id;
                  return `
                    <tr class="${isCurrent ? 'row-current-user' : ''}">
                      <td style="text-align:center;font-size:16px;font-weight:700;">
                        ${item.rankBadge}
                      </td>
                      <td>
                        <div class="table-user-cell">
                          <span class="cell-avatar">${item.avatar || '👤'}</span>
                          <div>
                            <span class="cell-name">${this._escapeHtml(item.fullName)} ${isCurrent ? '<span class="tag-you">(Bạn)</span>' : ''}</span>
                            <span class="cell-class">${this._escapeHtml(item.className || 'Sinh viên')}</span>
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;font-weight:700;color:var(--brand);">
                        ${item.score.toLocaleString()}
                      </td>
                      <td style="text-align:center;font-size:13px;color:var(--dim);">
                        ${item.correctCount}/${item.totalAnswered}
                      </td>
                      <td style="text-align:center;">
                        <span class="table-acc-pill ${item.accuracy >= 90 ? 'acc-high' : (item.accuracy >= 70 ? 'acc-mid' : 'acc-low')}">
                          ${item.accuracy}%
                        </span>
                      </td>
                      <td style="text-align:center;font-weight:700;color:#f97316;">
                        🔥 ${item.maxStreak}
                      </td>
                      <td>
                        <span class="table-badge-chip">${item.badge || '⭐ Sinh viên'}</span>
                      </td>
                      ${isAdmin ? `
                        <td style="text-align:center;">
                          <button type="button" class="btn-delete-lb-row" data-user-id="${item.userId}" data-user-name="${this._escapeHtml(item.fullName)}" title="Xóa kết quả của sinh viên này khỏi bảng xếp hạng" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11.5px;font-weight:600;">
                            🗑️ Xóa
                          </button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================

  _bindEvents() {
    // 1. Tab Switching
    const tabPractice = this.container.querySelector('#tabBtnPractice');
    const tabStudio = this.container.querySelector('#tabBtnStudio');
    const tabLeaderboard = this.container.querySelector('#tabBtnLeaderboard');

    if (tabPractice) {
      tabPractice.addEventListener('click', () => {
        this.activeTab = 'practice';
        this.render();
      });
    }

    if (tabStudio) {
      tabStudio.addEventListener('click', () => {
        this.activeTab = 'studio';
        this.render();
      });
    }

    if (tabLeaderboard) {
      tabLeaderboard.addEventListener('click', () => {
        this.activeTab = 'leaderboard';
        this.render();
        try {
          cloudSyncManager.syncQuizLeaderboard(quizHistoryManager).then(() => {
            if (this.activeTab === 'leaderboard') this.render();
          }).catch(() => {});
        } catch {}
      });
    }

    // Leaderboard Specific CTA Events
    const btnGoPractice = this.container.querySelector('#btnGoToPracticeFromLb');
    if (btnGoPractice) {
      btnGoPractice.addEventListener('click', () => {
        this.activeTab = 'practice';
        this.render();
      });
    }

    const btnLbLogin = this.container.querySelector('#btnLeaderboardLogin');
    if (btnLbLogin) {
      btnLbLogin.addEventListener('click', () => {
        const globalAuthBtn = document.getElementById('btnUserAuth');
        if (globalAuthBtn) {
          globalAuthBtn.click();
        }
      });
    }

    // Admin Leaderboard Management Events
    const btnResetLb = this.container.querySelector('#btnAdminResetLeaderboard');
    if (btnResetLb) {
      btnResetLb.addEventListener('click', async () => {
        if (!authManager.isAdmin()) {
          if (typeof window !== 'undefined' && window.alert) {
            window.alert('Chỉ Quản trị viên (admin) mới có quyền xóa bảng xếp hạng.');
          }
          return;
        }
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('⚠️ BẠN CÓ CHẮC MUỐN XÓA TOÀN BỘ BẢNG XẾP HẠNG?\n\nTất cả điểm số và thành tích của sinh viên sẽ được làm sạch về 0.')) {
          return;
        }
        quizHistoryManager.clearLeaderboard();
        try {
          await cloudSyncManager.resetQuizLeaderboard();
        } catch {}
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-delete-lb-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!authManager.isAdmin()) return;
        const targetId = btn.getAttribute('data-user-id');
        const targetName = btn.getAttribute('data-user-name') || targetId;
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Xóa điểm của sinh viên "${targetName}" khỏi bảng xếp hạng?`)) {
          return;
        }
        quizHistoryManager.removeUserStats(targetId);
        try {
          await cloudSyncManager.deleteQuizLeaderboardUser(targetId);
        } catch {}
        this.render();
      });
    });

    // 2. Practice Arena Events
    const selTopic = this.container.querySelector('#selPracticeTopic');
    if (selTopic) {
      selTopic.addEventListener('change', (e) => {
        this.practiceFilter.topic = e.target.value;
        this._initPracticeQuestions();
        this.render();
      });
    }

    const selDiff = this.container.querySelector('#selPracticeDiff');
    if (selDiff) {
      selDiff.addEventListener('change', (e) => {
        this.practiceFilter.difficulty = e.target.value;
        this._initPracticeQuestions();
        this.render();
      });
    }

    const btnResetPractice = this.container.querySelector('#btnResetPractice');
    if (btnResetPractice) {
      btnResetPractice.addEventListener('click', () => {
        this._initPracticeQuestions();
        this.render();
      });
    }

    const btnResetFilters = this.container.querySelector('#btnResetFilters');
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', () => {
        this.practiceFilter.topic = 'all';
        this.practiceFilter.difficulty = 'all';
        this._initPracticeQuestions();
        this.render();
      });
    }

    const btnPrev = this.container.querySelector('#btnPracticePrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.currentIndex > 0) {
          this.currentIndex--;
          this.render();
        }
      });
    }

    const btnNext = this.container.querySelector('#btnPracticeNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (this.currentIndex < this.practiceQuestions.length - 1) {
          this.currentIndex++;
          this.render();
        }
      });
    }

    // Option Buttons Click
    this.container.querySelectorAll('.btn-quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = this.practiceQuestions[this.currentIndex];
        if (!q || this.userAnswers[q.id]) return;

        const optId = btn.getAttribute('data-opt-id');
        this.userAnswers[q.id] = optId;
        this.answeredCount++;

        const isCorrect = optId === q.correctId;
        if (isCorrect) {
          this.score += 10;
          this.streak++;
          if (this.streak > this.maxStreak) {
            this.maxStreak = this.streak;
          }
        } else {
          this.streak = 0;
        }

        // Record stats to QuizHistoryManager
        try {
          const currentUser = authManager.getCurrentUser();
          const userId = currentUser ? currentUser.id : 'guest';
          quizHistoryManager.recordAnswer(userId, isCorrect, currentUser || {});
          cloudSyncManager.pushQuizAnswer(userId, isCorrect, currentUser || {});
        } catch (err) {
          console.error('[QuizView] Failed to record answer:', err);
        }

        this.render();
      });
    });

    // Action links to open in Labs
    this.container.querySelectorAll('.btn-open-lab').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-action-view');
        const val = btn.getAttribute('data-action-val');
        if (view === 'logic') {
          this.onOpenLogicWithExpr(val);
        } else if (view === 'lab') {
          this.onOpenLabWithAlgo(val);
        } else if (view === 'counting') {
          this.onOpenCounting(val);
        } else if (view === 'relation') {
          this.onOpenRelation(val);
        }
      });
    });

    // 3. Teacher's Studio Events
    const selCount = this.container.querySelector('#selStudioCount');
    if (selCount) {
      selCount.addEventListener('change', (e) => {
        this.studioConfig.count = parseInt(e.target.value, 10);
        this._generateNewExam();
        this.render();
      });
    }

    const selSTopic = this.container.querySelector('#selStudioTopic');
    if (selSTopic) {
      selSTopic.addEventListener('change', (e) => {
        this.studioConfig.topic = e.target.value;
        this._generateNewExam();
        this.render();
      });
    }

    const selSDiff = this.container.querySelector('#selStudioDiff');
    if (selSDiff) {
      selSDiff.addEventListener('change', (e) => {
        this.studioConfig.difficulty = e.target.value;
        this._generateNewExam();
        this.render();
      });
    }

    const btnGenNewExam = this.container.querySelector('#btnGenNewExam');
    if (btnGenNewExam) {
      btnGenNewExam.addEventListener('click', () => {
        this._generateNewExam();
        this.render();
      });
    }

    const chkShowSolutions = this.container.querySelector('#chkShowSolutions');
    if (chkShowSolutions) {
      chkShowSolutions.addEventListener('change', (e) => {
        this.showTeacherSolutions = e.target.checked;
        const teacherKeyPage = this.container.querySelector('.teacher-key-page');
        if (teacherKeyPage) {
          teacherKeyPage.style.display = this.showTeacherSolutions ? 'block' : 'none';
        }
      });
    }

    const btnPrintExam = this.container.querySelector('#btnPrintExam');
    if (btnPrintExam) {
      btnPrintExam.addEventListener('click', () => {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          if (typeof document !== 'undefined' && document.body) {
            document.body.classList.add('is-printing-exam');
            const cleanUp = () => {
              document.body.classList.remove('is-printing-exam');
              window.removeEventListener('afterprint', cleanUp);
            };
            window.addEventListener('afterprint', cleanUp);
          }
          setTimeout(() => {
            window.print();
          }, 80);
        }
      });
    }

    const btnCopyLatex = this.container.querySelector('#btnCopyLatex');
    if (btnCopyLatex) {
      btnCopyLatex.addEventListener('click', () => {
        const latex = exportExamToLatex(this.currentExam);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(latex).then(() => {
            btnCopyLatex.textContent = '✓ Đã chép LaTeX!';
            btnCopyLatex.style.background = 'rgba(16,185,129,0.2)';
            btnCopyLatex.style.borderColor = '#10b981';
            setTimeout(() => {
              btnCopyLatex.textContent = '📋 Sao Chép Mã LaTeX (.tex)';
              btnCopyLatex.style.background = '';
              btnCopyLatex.style.borderColor = '';
            }, 2500);
          }).catch(() => {
            prompt('Sao chép mã LaTeX dưới đây:', latex);
          });
        } else {
          prompt('Sao chép mã LaTeX dưới đây:', latex);
        }
      });
    }
  }
}
