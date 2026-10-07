/**
 * @file QuizView.js
 * Interactive Quiz & Practice Arena & Assigned Exam System & Teacher's Exam Studio
 * 
 * Features:
 * 1. Interactive Practice Arena (100 Questions Bank):
 *    - Question card with topic badge, difficulty indicator, and progress counter
 *    - Interactive 4-choice options (A, B, C, D) with instant feedback & chime colors
 *    - Score counter, accuracy rate, and continuous winning streak tracker (🔥)
 *    - Step-by-step mathematical reasoning & explanation breakdown
 *    - Action links to jump directly into Logic Lab or Algorithm Lab for visual experiments
 *    - Decoupled from official leaderboard (pure self-study mode)
 * 2. Assigned Timed Exam System (Đề Thi Của Tôi):
 *    - Official exams assigned to all students or specific student IDs
 *    - Strict "1 Attempt Only" enforcement
 *    - Real-time countdown clock (e.g. 15 minutes) with auto-submit on expiry
 *    - Question navigation grid jump bar
 *    - Scale 10 grading (Thang điểm 10, e.g. 8.5/10)
 *    - Detailed exam review mode
 * 3. Official GPA Exam Leaderboard (Bảng Xếp Hạng Đề Thi):
 *    - Ranked by Average GPA (Điểm Trung Bình Thang 10) across assigned exams
 *    - Top 3 Podium (🥇, 🥈, 🥉) & Class rankings table
 *    - Personal student card with exam GPA, completion stats, and history
 * 4. Teacher's Exam Studio & Assignment Management:
 *    - Exam Assignment System: create exams from 100 question bank and assign to all/selected students
 *    - Gradebook viewer: view student submission list, scores / 10, and completion times
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
import { examManager } from '../../core/quiz/ExamManager.js';

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export class QuizView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onOpenLabWithAlgo] - Callback(algoKey)
   * @param {Function} [options.onOpenLogicWithExpr] - Callback(expression)
   * @param {Function} [options.onOpenCounting] - Callback(tab)
   * @param {Function} [options.onOpenRelation] - Callback(tab, subtab)
   * @param {Function} [options.onOpenAuth] - Callback(tab)
   */
  constructor({
    container = null,
    onOpenLabWithAlgo = null,
    onOpenLogicWithExpr = null,
    onOpenCounting = null,
    onOpenRelation = null,
    onOpenAuth = null,
  } = {}) {
    this.container = container;
    this.onOpenLabWithAlgo = onOpenLabWithAlgo || (() => {});
    this.onOpenLogicWithExpr = onOpenLogicWithExpr || (() => {});
    this.onOpenCounting = onOpenCounting || (() => {});
    this.onOpenRelation = onOpenRelation || (() => {});
    this.onOpenAuth = onOpenAuth || null;

    // Active primary tab: 'practice' | 'myExams' | 'leaderboard' | 'studio'
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

    // Timed Exam Taking Session State
    this.activeExamSession = null; // { exam, questions, answers, currentQIndex, timeRemaining, timerId, startedAt }
    this.reviewSubmission = null; // Submission object being reviewed

    // Teacher's Exam Studio State
    this.studioSubTab = 'assign'; // 'assign' | 'print'
    this.gradebookExamId = null; // Exam ID for gradebook modal
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
        if (this.container) {
          this.render();
        }
      });
    }

    if (examManager && typeof examManager.subscribe === 'function') {
      examManager.subscribe(() => {
        if (this.container && !this.activeExamSession) {
          this.render();
        }
      });
    }

    if (cloudSyncManager && typeof cloudSyncManager.subscribe === 'function') {
      cloudSyncManager.subscribe(() => {
        if (this.container && (this.activeTab === 'leaderboard' || this.activeTab === 'myExams')) {
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

    // Trigger initial sync
    if (cloudSyncManager && cloudSyncManager.isConnected) {
      try {
        cloudSyncManager.syncExams(examManager).catch(() => {});
        cloudSyncManager.syncExamSubmissions(examManager).catch(() => {});
      } catch {}
    }

    this._initKeyboardNavigation();

    if (this.container) {
      this.render();
    }
  }

  /**
   * Sets active subtab: 'practice' | 'myExams' | 'studio'
   * @param {'practice' | 'myExams' | 'studio'} tabName
   */
  setTab(tabName) {
    if (tabName === 'leaderboard') {
      tabName = 'practice';
    }
    if (tabName === 'studio' && !authManager.isAdmin()) {
      tabName = 'practice';
    }
    const validTabs = ['practice', 'myExams', 'studio'];
    if (validTabs.includes(tabName)) {
      if (this.activeExamSession && tabName !== 'myExams') {
        const confirmLeave = typeof window !== 'undefined' && window.confirm 
          ? window.confirm('Bạn đang trong phòng thi! Rời khỏi tab này có thể làm gián đoạn thời gian làm bài. Bạn có chắc muốn chuyển tab?')
          : true;
        if (!confirmLeave) return;
        this._submitActiveExam();
      }
      this.activeTab = tabName;
      this.reviewSubmission = null;
      if (this.container) {
        this.render();
      }
      if (tabName === 'myExams') {
        try {
          if (cloudSyncManager && cloudSyncManager.isConnected) {
            cloudSyncManager.syncExams(examManager).catch(() => {});
            cloudSyncManager.syncExamSubmissions(examManager).catch(() => {});
          }
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
      if (['circuit', 'kmap', 'boolean'].includes(topic)) {
        normalizedTopic = 'boolean';
      } else if (['dijkstra', 'mst', 'euler_hamilton'].includes(topic)) {
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

    if (this.activeTab === 'leaderboard' || (this.activeTab === 'studio' && !authManager.isAdmin())) {
      this.activeTab = 'practice';
    }

    const isAdmin = authManager.isAdmin();
    const currentUser = authManager.getCurrentUser();

    // Check my exams count
    const myExams = currentUser ? examManager.getExamsForUser(currentUser.id) : [];
    const myPendingCount = currentUser 
      ? myExams.filter(e =>
        !examManager.getSubmission(e.id, currentUser.id) &&
        !examManager.getExamViolationRecord(e.id, currentUser.id).banned
      ).length
      : 0;

    this.container.innerHTML = `
      <div class="quiz-view-container" style="max-width:1300px;margin:0 auto;padding:20px 24px 60px;">
        
        <!-- Header -->
        <div class="quiz-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:2px 10px;border-radius:12px;font-size:11.5px;font-weight:600;">
                🎯 EdTech &amp; Khảo Thí Trực Tuyến
              </span>
              <span style="font-size:12px;color:var(--dim);">Toán Rời Rạc &amp; Cấu Trúc Dữ Liệu</span>
            </div>
            <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0;">Luyện Tập &amp; Thi Trắc Nghiệm Toán Rời Rạc</h1>
            <p style="font-size:13.5px;color:var(--dim);margin:4px 0 0;">
              Ngân hàng 150 câu hỏi tự luyện tập phản xạ, thi trực tuyến tính giờ Thang Điểm 10 và quản lý kết quả bài thi.
            </p>
          </div>

          <!-- Main Nav Tabs -->
          <div class="quiz-main-tabs" style="display:flex;gap:6px;align-items:center;background:var(--panel);padding:4px;border-radius:8px;border:1px solid var(--line);flex-wrap:wrap;">
            <button type="button" class="btn-tab ${this.activeTab === 'practice' ? 'active' : ''}" id="tabBtnPractice" style="padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              🎮 Đấu Trường Luyện Tập
            </button>
            <button type="button" class="btn-tab ${this.activeTab === 'myExams' ? 'active' : ''}" id="tabBtnMyExams" style="padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;position:relative;">
              📝 ${isAdmin ? 'Quản Lý Đề Thi' : 'Đề Thi Của Tôi'} ${myPendingCount > 0 ? `<span style="background:#ef4444;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;font-weight:700;">${myPendingCount}</span>` : ''}
            </button>
            <button type="button" class="btn-tab ${this.activeTab === 'studio' ? 'active' : ''}" id="tabBtnStudio" style="${isAdmin ? '' : 'display:none;'}padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              👩‍🏫 Quản Trị &amp; Soạn Đề
            </button>
          </div>
        </div>

        <!-- TAB 1: PRACTICE ARENA -->
        <div id="panePractice" style="display:${this.activeTab === 'practice' ? 'block' : 'none'};">
          ${this._renderPracticeView()}
        </div>

        <!-- TAB 2: MY EXAMS (TIMED ASSIGNED EXAMS) -->
        <div id="paneMyExams" style="display:${this.activeTab === 'myExams' ? 'block' : 'none'};">
          ${this._renderMyExamsView()}
        </div>

        <!-- TAB 3: TEACHER'S EXAM STUDIO -->
        <div id="paneStudio" style="display:${this.activeTab === 'studio' ? 'block' : 'none'};">
          ${this._renderStudioView()}
        </div>

        <!-- MODAL: GRADEBOOK (WHEN ADMIN VIEWS AN EXAM'S SUBMISSIONS) -->
        ${this.gradebookExamId ? this._renderGradebookModal() : ''}

      </div>
    `;

    this._bindEvents();
  }

  // =========================================================================
  // SUB-VIEW 1: INTERACTIVE PRACTICE ARENA (150 QUESTIONS, RISK-FREE)
  // =========================================================================

  _renderPracticeView() {
    const q = this.practiceQuestions[this.currentIndex];
    const total = this.practiceQuestions.length;
    const answered = Boolean(q && this.userAnswers[q.id]);
    const selectedOptId = q ? this.userAnswers[q.id] : null;

    return `
      <!-- Notice Banner for Practice Mode -->
      <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">💡</span>
        <div style="font-size:13px;color:var(--text);line-height:1.5;">
          <strong>Chế độ Tự Luyện Tập (150 Câu Hỏi):</strong> Bạn có thể thoải mái làm bài và thử sai để củng cố kiến thức theo 5 chuyên đề. Điểm tự luyện tập <em>không tính vào Bảng Xếp Hạng chính thức</em>. Để làm bài thi tính điểm xếp hạng theo Thang Điểm 10, hãy chuyển sang tab <strong>"📝 Đề Thi Của Tôi"</strong>.
        </div>
      </div>

      <!-- Practice Controls & Scoreboard -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
        
        <!-- Filter Controls Card -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;">
          <div style="font-size:12px;color:var(--dim);font-weight:600;text-transform:uppercase;margin-bottom:10px;">Lọc Chuyên Đề &amp; Độ Khó (Kho 150 Câu)</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <select id="selPracticeTopic" class="form-input" style="flex:1;min-width:140px;padding:6px 10px;font-size:12.5px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">
              <option value="all" ${this.practiceFilter.topic === 'all' ? 'selected' : ''}>🌟 Tất cả các chương (150 câu)</option>
              <option value="logic" ${this.practiceFilter.topic === 'logic' ? 'selected' : ''}>⚡ Chương 1: Cơ sở Logic &amp; Suy luận (30 câu)</option>
              <option value="boolean" ${this.practiceFilter.topic === 'boolean' ? 'selected' : ''}>🔌 Chương 2: Đại số Boole &amp; Mạch Logic (30 câu)</option>
              <option value="counting" ${this.practiceFilter.topic === 'counting' ? 'selected' : ''}>🎲 Chương 3: Đại số Tổ hợp &amp; Đếm (30 câu)</option>
              <option value="relation" ${this.practiceFilter.topic === 'relation' ? 'selected' : ''}>🔗 Chương 4: Quan hệ 2 ngôi &amp; Thứ tự (30 câu)</option>
              <option value="graph" ${this.practiceFilter.topic === 'graph' ? 'selected' : ''}>🌐 Chương 5: Lý thuyết Đồ thị &amp; Cây (30 câu)</option>
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

      <!-- Bảng câu hỏi chuyển nhanh (Question Palette Grid) -->
      ${total > 0 ? `
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:6px;">
              <span>📑</span> Bảng câu hỏi (Bấm số để chuyển nhanh):
            </div>
            <div style="display:flex;gap:12px;font-size:11.5px;color:var(--dim);">
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981;border:1px solid #10b981;"></span> Đã làm
              </span>
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--panel-alt);border:1px solid var(--line);"></span> Chưa làm
              </span>
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:3px;border:2px solid var(--accent);background:transparent;"></span> Đang xem
              </span>
            </div>
          </div>
          <div class="exam-q-jump-grid" style="margin-bottom:0;max-height:140px;overflow-y:auto;">
            ${this.practiceQuestions.map((pq, idx) => {
              const isAns = Boolean(this.userAnswers[pq.id]);
              const isCurr = idx === this.currentIndex;
              return `
                <button type="button" class="exam-q-jump-btn btn-practice-jump ${isAns ? 'answered' : ''} ${isCurr ? 'current' : ''}" data-jump-idx="${idx}" title="Câu ${idx + 1}: ${isAns ? 'Đã chọn đáp án' : 'Chưa chọn'}">
                  ${idx + 1}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

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
                  Hướng Dẫn Lời Giải &amp; Bản Chất Toán Học:
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
  // SUB-VIEW 2: MY EXAMS (TIMED ASSIGNED EXAMS - 1 ATTEMPT, SCALE 10)
  // =========================================================================

  _renderMyExamsView() {
    // 1. If currently in an active exam session
    if (this.activeExamSession) {
      return this._renderActiveExamRoom();
    }

    // 2. If reviewing a submitted exam
    if (this.reviewSubmission) {
      return this._renderReviewSubmissionView();
    }

    // 3. Exam List View
    const currentUser = authManager.getCurrentUser();
    const isAdmin = authManager.isAdmin();

    if (!currentUser) {
      return `
        <div style="text-align:center;padding:60px 24px;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:20px auto;max-width:700px;">
          <div style="font-size:48px;margin-bottom:16px;">🔐</div>
          <h2 style="font-size:20px;font-weight:700;color:var(--text);margin:0 0 10px;">Đăng Nhập Tài Khoản Sinh Viên Để Làm Đề Thi</h2>
          <p style="font-size:14px;color:var(--dim);margin:0 0 24px;line-height:1.6;">
            Các bài kiểm tra định kỳ và đề thi khảo sát được phân phối trực tiếp cho từng sinh viên. Kết quả thi được chấm theo Thang Điểm 10 và tính điểm trung bình (GPA) đưa lên Bảng Vàng danh dự.
          </p>
          <button type="button" class="btn-primary" id="btnMyExamsLogin" style="padding:12px 28px;font-size:14px;font-weight:700;">
            🔑 Đăng Nhập / Đăng Ký Ngay
          </button>
        </div>
      `;
    }

    // Get exams assigned to user (or all if admin)
    const assignedExams = isAdmin 
      ? examManager.getExams() 
      : examManager.getExamsForUser(currentUser.id);

    // Compute user's exam summary
    const mySubmissions = examManager.getSubmissions().filter(s => s.userId === currentUser.id);
    const completedCount = mySubmissions.length;
    const avgScore = completedCount > 0 
      ? Math.round((mySubmissions.reduce((acc, s) => acc + s.score, 0) / completedCount) * 10) / 10 
      : 0;

    return `
      <!-- Student Exam Dashboard Header -->
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:4px;">
            ${isAdmin ? '🛠️ Quản Lý Đề Thi &amp; Khảo Thí' : '🎓 Cổng Khảo Thí &amp; Kiểm Tra Định Kỳ'}
          </div>
          <h2 style="font-size:20px;font-weight:700;color:var(--text);margin:0;">
            ${isAdmin ? 'Quản Lý Danh Sách Đề Thi' : `Xin chào, ${this._escapeHtml(currentUser.fullName)}`} ${isAdmin ? '<span class="pill-badge" style="background:rgba(245,158,11,0.2);color:var(--accent);font-size:11px;padding:2px 8px;border-radius:8px;vertical-align:middle;">Quản Trị Viên</span>' : ''}
          </h2>
          <p style="font-size:13px;color:var(--dim);margin:4px 0 0;">
            ${isAdmin 
              ? 'Xem tất cả các đề thi được tạo trong hệ thống, theo dõi tiến độ thi của sinh viên hoặc làm bài thi thử.' 
              : 'Quy chế thi trực tuyến: Mỗi đề thi chỉ được làm <strong>1 lần duy nhất</strong>. Thang điểm 10. Điểm trung bình các đề thi sẽ quyết định thứ hạng trên Bảng Vàng.'}
          </p>
        </div>

        <!-- Student Summary Badges -->
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
          <div style="background:var(--panel-alt);border:1px solid var(--line);padding:8px 16px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;">ĐỀ ĐƯỢC GIAO</div>
            <div style="font-size:18px;font-weight:800;color:var(--text);">${assignedExams.length}</div>
          </div>
          <div style="background:var(--panel-alt);border:1px solid var(--line);padding:8px 16px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;">ĐÃ NỘP BÀI</div>
            <div style="font-size:18px;font-weight:800;color:#10b981;">${completedCount}</div>
          </div>
          <div style="background:var(--panel-alt);border:1px solid var(--line);padding:8px 16px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:var(--dim);font-weight:600;">ĐIỂM TB (THANG 10)</div>
            <div style="font-size:18px;font-weight:800;color:var(--accent);">${avgScore.toFixed(1)} / 10</div>
          </div>
        </div>
      </div>

      <!-- Assigned Exams Grid -->
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span>📋 Danh Sách Đề Thi Trắc Nghiệm:</span>
        <span style="font-size:12.5px;color:var(--dim);font-weight:normal;">(${assignedExams.length} đề thi sẵn sàng)</span>
      </div>

      ${assignedExams.length === 0 ? `
        <div style="text-align:center;padding:50px 20px;background:var(--panel);border:1px dashed var(--line);border-radius:12px;">
          <div style="font-size:36px;margin-bottom:10px;">📭</div>
          <h3 style="color:var(--text);margin:0 0 6px;">Hiện chưa có đề thi nào được phân công cho bạn</h3>
          <p style="color:var(--dim);font-size:13px;margin:0;">Khi giảng viên hoặc quản trị viên tạo đề thi mới và phân cho bạn, đề thi sẽ hiển thị tại đây.</p>
        </div>
      ` : `
        <div class="exam-cards-grid">
          ${assignedExams.map(exam => {
            const sub = examManager.getSubmission(exam.id, currentUser.id);
            const isCompleted = Boolean(sub);
            const violationRecord = examManager.getExamViolationRecord(exam.id, currentUser.id);
            const isBanned = Boolean(violationRecord.banned);

            return `
              <div class="exam-card">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                    <span class="exam-status-badge ${isBanned ? 'banned' : (isCompleted ? 'completed' : 'pending')}">
                      ${isBanned ? '🚫 BỊ CẤM THI LẠI ĐỀ NÀY (3/3)' : (isCompleted ? `✅ ĐÃ HOÀN THÀNH: ${sub.score} / 10` : '⏳ CHƯA LÀM (Chỉ 1 lượt)')}
                    </span>
                    <span style="font-size:11px;color:var(--dim);">
                      ${new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <h3 class="exam-card-title">${this._escapeHtml(exam.title)}</h3>
                  <p class="exam-card-desc">${this._escapeHtml(exam.description || 'Đề thi trắc nghiệm Toán Rời Rạc.')}</p>

                  <div class="exam-meta-row">
                    <span class="exam-meta-pill">⏱️ ${exam.durationMinutes} phút</span>
                    <span class="exam-meta-pill">🔢 ${exam.questionIds.length} câu trắc nghiệm</span>
                    <span class="exam-meta-pill">🎯 Thang 10 điểm</span>
                  </div>
                </div>

                <div style="border-top:1px solid var(--line);padding-top:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                  ${isCompleted ? `
                    <div style="font-size:12px;color:var(--dim);">
                      Đúng ${sub.correctCount}/${sub.totalQuestions} câu • ${Math.floor(sub.timeSpentSeconds / 60)}p ${sub.timeSpentSeconds % 60}s
                    </div>
                    <button type="button" class="btn-sm btn-review-exam" data-exam-id="${exam.id}" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;">
                      👁️ Xem lại bài thi
                    </button>
                  ` : isBanned ? `
                    <div class="exam-ban-notice">
                      Đã vi phạm quy chế ${violationRecord.count} lần. Bạn không thể thi lại đề này; các đề thi khác vẫn được phép làm.
                    </div>
                  ` : `
                    <div style="font-size:12px;color:#f59e0b;font-weight:600;">
                      ⚠️ Chỉ 1 lần làm bài • 3 vi phạm sẽ cấm thi lại đề này
                    </div>
                    <button type="button" class="btn-primary btn-start-exam" data-exam-id="${exam.id}" style="font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;">
                      ▶️ Bắt Đầu Làm Bài
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // =========================================================================
  // SUB-VIEW 2B: ACTIVE TIMED EXAM ROOM (PHÒNG THI TRỰC TUYẾN)
  // =========================================================================

  _renderActiveExamRoom() {
    const session = this.activeExamSession;
    if (!session) return '';

    const exam = session.exam;
    const questions = session.questions;
    const currentQ = questions[session.currentQIndex];
    const totalQ = questions.length;
    const qId = currentQ ? currentQ.id : null;
    const selectedOpt = session.answers[qId] || null;
    const answeredCount = Object.keys(session.answers).length;
    const optionIds = currentQ ? (session.optionOrder[currentQ.id] || currentQ.options.map(option => option.id)) : [];
    const displayedOptions = currentQ
      ? optionIds.map(optionId => currentQ.options.find(option => option.id === optionId)).filter(Boolean)
      : [];

    const m = Math.floor(Math.max(0, session.timeRemaining) / 60);
    const s = Math.max(0, session.timeRemaining) % 60;
    const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const isUrgent = session.timeRemaining <= 120;
    const lockdownCountdown = session.lockdownCountdown;
    const lockdownOverlay = session.lockdownPending ? `
      <div class="exam-lockdown-overlay" role="dialog" aria-modal="true" aria-labelledby="examLockdownTitle">
        <div class="exam-lockdown-dialog">
          <div class="exam-lockdown-icon">🔒</div>
          <h2 id="examLockdownTitle">Phòng thi đã bị thoát toàn màn hình</h2>
          <p>Vi phạm ${session.violationCount}/3. Đủ 3 lần sẽ bị cấm thi lại đề này; những đề khác không bị ảnh hưởng.</p>
          ${session.lockdownWarning ? `
            <p class="exam-lockdown-warning" role="alert">
              CẢNH BÁO: Bạn đã bị cộng thêm 1 vi phạm do không quay lại toàn màn hình trong thời gian quy định.
              Tổng số vi phạm: ${session.violationCount}/3.
            </p>
          ` : ''}
          ${lockdownCountdown !== null ? `
            <p class="exam-lockdown-countdown" role="status">
              Quay lại toàn màn hình trong <strong id="examLockdownCountdown">${lockdownCountdown}</strong> giây để tránh bị cộng thêm 1 vi phạm.
            </p>
          ` : ''}
          <button type="button" class="btn-primary" id="btnResumeExamLockdown">Quay lại phòng thi toàn màn hình</button>
        </div>
      </div>
    ` : '';

    return `
      <div class="active-exam-room">
        ${lockdownOverlay}
        
        <!-- Top bar: Title, Timer, Submitting -->
        <div class="active-exam-topbar">
          <div>
            <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;">
              Phòng Thi Trực Tuyến • Đang Chấm Giờ
            </div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text);margin:2px 0 0;">
              ${this._escapeHtml(exam.title)}
            </h2>
          </div>

          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <!-- Countdown Timer -->
            <div class="active-exam-timer-box ${isUrgent ? 'urgent' : ''}" id="activeExamTimer">
              ⏱️ ${timeFormatted}
            </div>

            <!-- Submit Button -->
            <button type="button" class="btn-primary" id="btnSubmitActiveExam" style="background:#10b981;border-color:#10b981;font-weight:700;font-size:14px;padding:10px 22px;">
              📤 Nộp Bài Thi (${answeredCount}/${totalQ})
            </button>
          </div>
        </div>

        <!-- Question Fast Jump Grid -->
        <div style="font-size:12px;font-weight:600;color:var(--dim);margin-bottom:8px;text-transform:uppercase;">
          Mục lục câu hỏi (Bấm số để chuyển nhanh):
        </div>
        <div class="exam-q-jump-grid">
          ${questions.map((qItem, idx) => {
            const isAns = Boolean(session.answers[qItem.id]);
            const isCurr = idx === session.currentQIndex;
            return `
              <button type="button" class="exam-q-jump-btn ${isAns ? 'answered' : ''} ${isCurr ? 'current' : ''}" data-jump-idx="${idx}">
                ${idx + 1}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Current Question Display -->
        <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:24px;margin-bottom:20px;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-size:13px;font-weight:700;background:var(--panel);border:1px solid var(--line);padding:3px 12px;border-radius:6px;color:var(--text);">
              Câu ${session.currentQIndex + 1} / ${totalQ}
            </span>
            <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">
              ${currentQ.topicName || currentQ.topic}
            </span>
          </div>

          <div style="font-size:16.5px;font-weight:600;color:var(--text);line-height:1.6;margin-bottom:24px;border-left:4px solid var(--accent);padding-left:14px;">
            ${currentQ.question}
          </div>

          <!-- Options -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${displayedOptions.map((opt, optionIndex) => {
              const isSelected = selectedOpt === opt.id;
              const displayLabel = String.fromCharCode(65 + optionIndex);
              let style = `display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:8px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-size:14px;text-align:left;cursor:pointer;transition:all 0.15s ease;width:100%;line-height:1.5;`;
              let badgeStyle = `background:var(--line);color:var(--text);`;

              if (isSelected) {
                style = `display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:8px;background:rgba(56,189,248,0.15);border:2px solid var(--accent);color:var(--text);font-size:14px;text-align:left;cursor:pointer;width:100%;line-height:1.5;`;
                badgeStyle = `background:var(--accent);color:#000;font-weight:bold;`;
              }

              return `
                <button type="button" class="btn-active-exam-opt" data-opt-id="${opt.id}" style="${style}">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:13px;font-weight:700;flex-shrink:0;${badgeStyle}">
                    ${displayLabel}
                  </span>
                  <span style="flex:1;font-weight:500;">${opt.text}</span>
                  ${isSelected ? '<span style="color:var(--accent);font-weight:bold;font-size:13px;">● Đã chọn</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

        </div>

        <!-- Question Navigation Bottom Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <button type="button" class="btn-secondary" id="btnExamPrevQ" ${session.currentQIndex === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            ❮ Câu trước
          </button>
          
          <div style="font-size:13px;color:var(--dim);">
            Đã làm: <strong>${answeredCount}</strong> / ${totalQ} câu
          </div>

          <button type="button" class="btn-secondary" id="btnExamNextQ" ${session.currentQIndex === totalQ - 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            Câu tiếp ❯
          </button>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // SUB-VIEW 2C: EXAM SUBMISSION REVIEW (XEM LẠI BÀI THI)
  // =========================================================================

  _renderReviewSubmissionView() {
    const sub = this.reviewSubmission;
    if (!sub) return '';

    const isAdmin = authManager.isAdmin();
    const exam = examManager.getExamById(sub.examId);
    const questions = exam ? exam.questionIds.map(id => STATIC_QUESTION_BANK.find(q => q.id === id)).filter(Boolean) : [];

    return `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:24px;margin-bottom:24px;">
        
        <!-- Review Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:20px;">
          <div>
            <button type="button" class="btn-sm" id="btnBackFromReview" style="margin-bottom:10px;">
              ❮ Quay lại danh sách đề thi
            </button>
            <h2 style="font-size:22px;font-weight:700;color:var(--text);margin:0 0 4px;">
              ${isAdmin ? `Chi Tiết Bài Làm: ${this._escapeHtml(sub.examTitle)}` : `Kết Quả Bài Thi: ${this._escapeHtml(sub.examTitle)}`}
            </h2>
            <div style="font-size:13px;color:var(--dim);">
              Thí sinh: <strong>${this._escapeHtml(sub.fullName)}</strong> (${this._escapeHtml(sub.className)}) • Nộp lúc: ${new Date(sub.submittedAt).toLocaleString('vi-VN')}
            </div>
          </div>

          <!-- Score Card -->
          <div style="background:rgba(16,185,129,0.12);border:2px solid #10b981;border-radius:12px;padding:12px 24px;text-align:center;">
            <div style="font-size:12px;color:#10b981;font-weight:700;text-transform:uppercase;">Kết Quả Chính Thức</div>
            <div style="font-size:28px;font-weight:900;color:#10b981;">${sub.score} <span style="font-size:16px;font-weight:normal;">/ 10 điểm</span></div>
            <div style="font-size:12.5px;color:var(--dim);margin-top:2px;">
              Đúng ${sub.correctCount}/${sub.totalQuestions} câu • ${Math.floor(sub.timeSpentSeconds / 60)}p ${sub.timeSpentSeconds % 60}s
            </div>
          </div>
        </div>

        ${!isAdmin ? `
          <!-- Student Result Notice: ONLY SCORE IS SHOWN, NO ANSWERS -->
          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:12px;padding:32px 24px;text-align:center;margin-top:20px;">
            <div style="font-size:42px;margin-bottom:12px;">🛡️</div>
            <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 8px;">
              Bài Thi Đã Được Nộp &amp; Chấm Điểm Thành Công!
            </h3>
            <p style="font-size:14px;color:var(--dim);max-width:540px;margin:0 auto 20px;line-height:1.6;">
              Theo quy chế khảo thí và bảo mật đề thi trực tuyến, hệ thống <strong>chỉ công bố điểm số chính thức và số câu đúng</strong>, không hiển thị lại bộ câu hỏi và đáp án chi tiết.
            </p>
            <button type="button" class="btn-primary" id="btnBackToExamsFromScore" style="padding:10px 24px;font-weight:700;font-size:13.5px;">
              📋 Quay Về Danh Sách Đề Thi
            </button>
          </div>
        ` : `
          <!-- Questions Review List (Admin only) -->
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px;">
            📝 Chi tiết từng câu hỏi &amp; đáp án (Chế độ Quản trị viên):
          </div>

          <div style="display:flex;flex-direction:column;gap:18px;">
            ${questions.map((q, idx) => {
              const userChoice = sub.answers ? sub.answers[q.id] : null;
              const isCorrect = userChoice === q.correctId;
              const optionIds = sub.optionOrder && sub.optionOrder[q.id]
                ? sub.optionOrder[q.id]
                : q.options.map(option => option.id);
              const displayedOptions = optionIds
                .map(optionId => q.options.find(option => option.id === optionId))
                .filter(Boolean);

              return `
                <div style="background:var(--panel-alt);border:1px solid ${isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};border-radius:10px;padding:18px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="font-weight:700;font-size:14px;color:var(--text);">
                      Câu ${idx + 1}:
                    </span>
                    <span class="exam-status-badge ${isCorrect ? 'completed' : 'pending'}" style="${isCorrect ? '' : 'background:rgba(239,68,68,0.15);color:#ef4444;border-color:rgba(239,68,68,0.3);'}">
                      ${isCorrect ? '✓ Trả lời Đúng (+1 điểm)' : `✗ Trả lời Sai (Bạn chọn ${userChoice || 'Bỏ trống'})`}
                    </span>
                  </div>

                  <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:14px;line-height:1.5;">
                    ${q.question}
                  </div>

                  <!-- 4 Options with Review Marks -->
                  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
                    ${displayedOptions.map((opt, optionIndex) => {
                      const displayLabel = String.fromCharCode(65 + optionIndex);
                      let borderCol = 'var(--line)';
                      let bgCol = 'var(--panel)';
                      let tag = '';

                      if (opt.id === q.correctId) {
                        borderCol = '#10b981';
                        bgCol = 'rgba(16,185,129,0.15)';
                        tag = '<span style="color:#10b981;font-weight:bold;margin-left:auto;">✓ Đáp án chuẩn</span>';
                      } else if (opt.id === userChoice) {
                        borderCol = '#ef4444';
                        bgCol = 'rgba(239,68,68,0.15)';
                        tag = '<span style="color:#ef4444;font-weight:bold;margin-left:auto;">✗ Lựa chọn của bạn</span>';
                      }

                      return `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:6px;background:${bgCol};border:1px solid ${borderCol};font-size:13.5px;">
                          <span style="font-weight:700;width:24px;text-align:center;">${displayLabel}.</span>
                          <span>${opt.text}</span>
                          ${tag}
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <!-- Explanation -->
                  <div style="background:rgba(56,189,248,0.06);border-left:3px solid #38bdf8;padding:10px 14px;border-radius:4px;font-size:13px;line-height:1.5;color:var(--text);">
                    <strong>💡 Lời giải chi tiết:</strong> ${q.explanation}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

      </div>
    `;
  }

  // =========================================================================
  // SUB-VIEW 3: TEACHER'S EXAM STUDIO & ASSIGNMENT MANAGEMENT
  // =========================================================================

  _renderStudioView() {
    const exam = this.currentExam;
    if (!exam) return `<div>Đang tải đề thi...</div>`;

    const allStudents = authManager.getUsers().filter(u => u.role !== 'admin');
    const assignedExamsList = examManager.getExams();

    return `
      <!-- Studio Subtab Navigation -->
      <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--line);padding-bottom:10px;">
        <button type="button" class="btn-tab ${this.studioSubTab === 'assign' ? 'active' : ''}" id="tabStudioAssign" style="padding:8px 18px;font-size:13.5px;font-weight:700;border-radius:6px;">
          📋 Phân Phối Đề Thi &amp; Sổ Điểm Sinh Viên
        </button>
        <button type="button" class="btn-tab ${this.studioSubTab === 'print' ? 'active' : ''}" id="tabStudioPrint" style="padding:8px 18px;font-size:13.5px;font-weight:700;border-radius:6px;">
          🖨️ Soạn Đề In Ấn Chuẩn A4 &amp; Xuất LaTeX
        </button>
      </div>

      <!-- SECTION A: ASSIGN EXAMS & GRADEBOOK -->
      <div id="studioAssignSection" style="display:${this.studioSubTab === 'assign' ? 'block' : 'none'};">
        
        <!-- Create & Assign Exam Card -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:8px;">
            <span>🚀 Tạo Đề Thi Mới &amp; Phân Phối Cho Sinh Viên</span>
            <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-size:11.5px;padding:2px 8px;border-radius:10px;">Thang Điểm 10 • 1 Lần Làm</span>
          </div>
          <p style="font-size:13px;color:var(--dim);margin:0 0 16px;">
            Hệ thống sẽ tự động bốc ngẫu nhiên câu hỏi từ Kho 150 Câu Hỏi Toán Rời Rạc và giao bài cho sinh viên được chọn.
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;margin-bottom:16px;">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Tiêu đề đề thi: *</label>
              <input type="text" id="txtAssignTitle" class="form-input" placeholder="Ví dụ: Kiểm tra 15 phút: Logic & Mệnh đề" value="Đề Kiểm Tra Định Kỳ: Toán Rời Rạc" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;" />
            </div>

            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Thời gian làm bài (phút): *</label>
              <input type="number" id="numAssignDuration" min="5" max="180" value="15" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;" />
            </div>

            <div>
              <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Cách chọn câu hỏi:</label>
              <select id="selAssignSelectionMode" class="form-input" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;">
                <option value="random" selected>Bốc câu ngẫu nhiên theo chuyên đề</option>
                <option value="manual">Giảng viên chọn thủ công</option>
              </select>
            </div>

            <div id="randomQuestionControls" style="display:contents;">
              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Số lượng câu hỏi: *</label>
                <select id="selAssignQCount" class="form-input" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;">
                  <option value="5">5 câu (Kiểm tra nhanh)</option>
                  <option value="10" selected>10 câu (Chuẩn 15 phút)</option>
                  <option value="15">15 câu (Đề kiểm tra giữa kỳ)</option>
                  <option value="20">20 câu (Khảo sát toàn diện)</option>
                </select>
              </div>

              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Chuyên đề lấy câu hỏi:</label>
                <select id="selAssignTopic" class="form-input" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;">
                  <option value="all">🌟 Tổng hợp cả 5 chuyên đề</option>
                  <option value="logic">⚡ Chương 1: Cơ sở Logic &amp; Suy luận</option>
                  <option value="boolean">🔌 Chương 2: Đại số Boole &amp; Mạch Logic</option>
                  <option value="counting">🎲 Chương 3: Đại số Tổ hợp &amp; Đếm</option>
                  <option value="relation">🔗 Chương 4: Quan hệ 2 ngôi &amp; Thứ tự</option>
                  <option value="graph">🌐 Chương 5: Lý thuyết Đồ thị &amp; Cây</option>
                </select>
              </div>
            </div>
          </div>

          <div id="manualQuestionList" style="display:none;background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:8px;">
                <label for="selManualChapterFilter" style="font-size:12.5px;font-weight:700;color:var(--text);">Lọc theo chương:</label>
                <select id="selManualChapterFilter" class="form-input" style="padding:6px 12px;font-size:12.5px;border-radius:6px;background:var(--panel);border:1px solid var(--line);color:var(--text);">
                  <option value="all">📚 Tất cả các chương (150 câu)</option>
                  <option value="logic">⚡ Chương 1: Cơ sở Logic &amp; Suy luận (30 câu)</option>
                  <option value="boolean">🔌 Chương 2: Đại số Boole &amp; Mạch Logic (30 câu)</option>
                  <option value="counting">🎲 Chương 3: Đại số Tổ hợp &amp; Đếm (30 câu)</option>
                  <option value="relation">🔗 Chương 4: Quan hệ 2 ngôi &amp; Thứ tự (30 câu)</option>
                  <option value="graph">🌐 Chương 5: Lý thuyết Đồ thị &amp; Cây (30 câu)</option>
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:8px;">
                <button type="button" class="btn-secondary" id="btnManualSelectVisible" style="font-size:11.5px;padding:5px 10px;">
                  Chọn tất cả chương này
                </button>
                <button type="button" class="btn-secondary" id="btnManualDeselectAll" style="font-size:11.5px;padding:5px 10px;">
                  Bỏ chọn tất cả
                </button>
                <span id="manualSelectedCounter" style="font-size:11.5px;font-weight:700;background:var(--accent);color:#000;padding:3px 9px;border-radius:12px;">
                  Đã chọn: 0 câu
                </span>
              </div>
            </div>

            <div id="manualQuestionsContainer" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px;">
              ${STATIC_QUESTION_BANK.map((question, index) => {
                const cleanQText = question.question.replace(/<br><svg[\s\S]*?<\/svg>/gi, ' [Sơ đồ mạch logic]').replace(/<[^>]+>/g, '');
                return `
                  <label class="manual-q-row" data-topic="${question.topic}" style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:var(--panel);border:1px solid var(--line);border-radius:6px;font-size:12px;cursor:pointer;transition:background 0.15s ease;">
                    <input type="checkbox" class="chk-assign-question" value="${question.id}" style="margin-top:2px;cursor:pointer;" />
                    <div style="flex:1;">
                      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
                        <span style="font-weight:700;color:var(--text);">Câu ${index + 1} [${question.id}]</span>
                        <span style="font-size:10.5px;padding:1px 6px;border-radius:4px;background:var(--panel-alt);border:1px solid var(--line);color:var(--accent);">${this._escapeHtml(question.topicName || question.topic)}</span>
                        <span style="font-size:10.5px;color:var(--dim);">${question.difficulty === 'easy' ? '🟢 Dễ' : question.difficulty === 'medium' ? '🟡 Trung bình' : '🔴 Nâng cao'}</span>
                      </div>
                      <div style="color:var(--text);line-height:1.4;">${this._escapeHtml(cleanQText)}</div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:18px;font-size:13px;color:var(--text);">
            <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="chkShuffleQuestions" checked /> Xáo trộn thứ tự câu hỏi</label>
            <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="chkShuffleOptions" checked /> Xáo trộn thứ tự đáp án</label>
          </div>

          <!-- Assignment Target Selection -->
          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:18px;">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;">
              🎯 Đối Tượng Sinh Viên Được Phân Đề:
            </div>
            <div style="display:flex;gap:20px;margin-bottom:10px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text);">
                <input type="radio" name="assignTarget" value="all" checked id="radAssignAll" />
                <strong>Giao cho toàn thể sinh viên</strong> (Tất cả sinh viên trong hệ thống)
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text);">
                <input type="radio" name="assignTarget" value="custom" id="radAssignCustom" />
                <strong>Chọn danh sách sinh viên cụ thể</strong>
              </label>
            </div>

            <!-- Custom Student Checklist (hidden by default) -->
            <div id="customStudentListWrap" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);max-height:180px;overflow-y:auto;">
              <div style="font-size:12px;color:var(--dim);margin-bottom:6px;">Tích chọn các sinh viên nhận đề:</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:8px;">
                ${allStudents.map(student => `
                  <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel);border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:12.5px;">
                    <input type="checkbox" class="chk-assign-student" value="${student.id}" />
                    <span>${student.avatar || '👤'}</span>
                    <div>
                      <div style="font-weight:600;color:var(--text);">${this._escapeHtml(student.fullName)}</div>
                      <div style="font-size:11px;color:var(--dim);">${this._escapeHtml(student.className || 'Sinh viên')} • @${this._escapeHtml(student.username)}</div>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button type="button" class="btn-primary" id="btnCreateAndAssignExam" style="padding:10px 24px;font-size:14px;font-weight:700;">
              🚀 Phân Đề &amp; Giao Bài Thi Ngay
            </button>
          </div>
        </div>

        <!-- Assigned Exams Table & Gradebook -->
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">
              📑 Danh Sách Các Đề Thi Đã Phân Phối (${assignedExamsList.length})
            </h3>
          </div>

          <div style="overflow-x:auto;">
            <table class="leaderboard-table" style="font-size:13px;">
              <thead>
                <tr>
                  <th>Tên đề thi</th>
                  <th style="text-align:center;">Thời gian</th>
                  <th style="text-align:center;">Số câu</th>
                  <th style="text-align:center;">Đối tượng</th>
                  <th style="text-align:center;">Đã nộp bài</th>
                  <th style="text-align:center;">Ngày tạo</th>
                  <th style="text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${assignedExamsList.map(item => {
                  const subs = examManager.getSubmissionsForExam(item.id);
                  const isAll = Array.isArray(item.assignedTo) && item.assignedTo.includes('all');
                  const targetLabel = isAll ? 'Toàn bộ sinh viên' : `${item.assignedTo.length} sinh viên`;

                  return `
                    <tr>
                      <td style="font-weight:700;color:var(--text);">
                        ${this._escapeHtml(item.title)}
                        <div style="font-size:11px;color:var(--dim);font-weight:normal;">Mã: ${item.id}</div>
                      </td>
                      <td style="text-align:center;">${item.durationMinutes} phút</td>
                      <td style="text-align:center;">${item.questionIds.length} câu</td>
                      <td style="text-align:center;">
                        <span class="pill-badge" style="background:rgba(56,189,248,0.12);color:#38bdf8;padding:2px 8px;border-radius:8px;font-size:11px;">
                          ${targetLabel}
                        </span>
                      </td>
                      <td style="text-align:center;font-weight:700;color:#10b981;">
                        ${subs.length} bài
                      </td>
                      <td style="text-align:center;color:var(--dim);font-size:12px;">
                        ${new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td style="text-align:right;white-space:nowrap;">
                        <button type="button" class="btn-sm btn-view-gradebook" data-exam-id="${item.id}" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);margin-right:6px;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;">
                          📊 Xem Sổ Điểm
                        </button>
                        <button type="button" class="btn-sm btn-export-exam-excel" data-exam-id="${item.id}" data-exam-title="${this._escapeHtml(item.title)}" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);margin-right:6px;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;">
                          📥 Xuất Excel
                        </button>
                        <button type="button" class="btn-sm btn-delete-assigned-exam" data-exam-id="${item.id}" data-exam-title="${this._escapeHtml(item.title)}" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;">
                          🗑️ Xóa
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- SECTION B: A4 PRINT & LATEX EXPORTER (PRESERVED) -->
      <div id="studioPrintSection" style="display:${this.studioSubTab === 'print' ? 'block' : 'none'};">
        
        <!-- Teacher's Studio Controls Bar (No Print) -->
        <div class="exam-studio-controls no-print" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                <span>👩‍🏫 Studio Soạn Đề Thi Trắc Nghiệm Chuẩn A4</span>
                <span class="pill-badge" style="background:rgba(245,158,11,0.15);color:var(--accent);font-size:11px;padding:2px 8px;border-radius:10px;">
                  Mã đề: ${exam.examCode}
                </span>
              </div>
              <p style="font-size:12px;color:var(--dim);margin:3px 0 0;">
                Tạo đề thi chuẩn mẫu Bộ GD&amp;ĐT &amp; Đại học, in trực tiếp ra giấy A4 hoặc chép mã nguồn LaTeX cho Overleaf.
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
                <option value="all" ${this.studioConfig.topic === 'all' ? 'selected' : ''}>🌟 Toàn diện cả 5 chương</option>
                <option value="logic" ${this.studioConfig.topic === 'logic' ? 'selected' : ''}>⚡ Chương 1: Cơ sở Logic &amp; Suy luận</option>
                <option value="boolean" ${this.studioConfig.topic === 'boolean' ? 'selected' : ''}>🔌 Chương 2: Đại số Boole &amp; Mạch Logic</option>
                <option value="counting" ${this.studioConfig.topic === 'counting' ? 'selected' : ''}>🎲 Chương 3: Đại số Tổ hợp &amp; Đếm</option>
                <option value="relation" ${this.studioConfig.topic === 'relation' ? 'selected' : ''}>🔗 Chương 4: Quan hệ 2 ngôi &amp; Thứ tự</option>
                <option value="graph" ${this.studioConfig.topic === 'graph' ? 'selected' : ''}>🌐 Chương 5: Lý thuyết Đồ thị &amp; Cây</option>
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
              Hiện hướng dẫn giải chi tiết cho Quản trị viên
            </label>
          </div>
        </div>

        <!-- A4 PAPER CONTAINER FOR PREVIEW AND PRINTING -->
        <div class="exam-paper-wrapper" style="background:#f1f5f9;padding:24px;border-radius:8px;">
          
          <!-- TRANG 1: ĐỀ THI SINH VIÊN -->
          <div class="exam-paper" style="background:#ffffff;color:#1e293b;max-width:860px;margin:0 auto;padding:40px 48px;box-shadow:0 4px 16px rgba(0,0,0,0.1);border-radius:4px;font-family:'Times New Roman', Times, serif;line-height:1.45;">
            
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

            <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:16px;text-transform:uppercase;">
              NỘI DUNG ĐỀ THI TRẮC NGHIỆM (${exam.totalQuestions} CÂU)
            </div>

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

          <!-- TRANG 2: BẢNG ĐÁP ÁN & HƯỚNG DẪN CHẤM (CHO GIẢNG VIÊN) -->
          <div class="exam-paper teacher-key-page" style="display:${this.showTeacherSolutions ? 'block' : 'none'};background:#ffffff;color:#1e293b;max-width:860px;margin:32px auto 0;padding:40px 48px;box-shadow:0 4px 16px rgba(0,0,0,0.1);border-radius:4px;font-family:'Times New Roman', Times, serif;line-height:1.45;page-break-before:always;">
            
            <div style="text-align:center;border-bottom:1.5px solid #000;padding-bottom:10px;margin-bottom:16px;">
              <div style="font-size:15px;font-weight:bold;text-transform:uppercase;">
                ĐÁP ÁN &amp; HƯỚNG DẪN CHẤM CHI TIẾT
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

            <!-- Detailed Solutions -->
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

      </div>
    `;
  }

  // =========================================================================
  // SUB-VIEW 4B: GRADEBOOK MODAL FOR TEACHER
  // =========================================================================

  _renderGradebookModal() {
    const exam = examManager.getExamById(this.gradebookExamId);
    if (!exam) return '';

    const submissions = examManager.getSubmissionsForExam(this.gradebookExamId);
    const avgScore = submissions.length > 0 
      ? Math.round((submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length) * 10) / 10 
      : 0;

    return `
      <div class="gradebook-modal-backdrop" id="gradebookModalBackdrop">
        <div class="gradebook-modal-card">
          <div style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;">
                📊 Sổ Điểm Điện Tử &amp; Danh Sách Nộp Bài
              </div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:2px 0 0;">
                ${this._escapeHtml(exam.title)}
              </h3>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <button type="button" class="btn-sm" id="btnExportGradebookExcel" style="background:#10b981;color:#fff;border:none;padding:6px 14px;font-size:13px;border-radius:6px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
                📥 Xuất File Excel (.csv)
              </button>
              <button type="button" class="btn-sm" id="btnCloseGradebook" style="padding:6px 12px;font-size:13px;border-radius:6px;">
                ✕ Đóng
              </button>
            </div>
          </div>

          <div style="padding:16px 24px;background:var(--panel-alt);border-bottom:1px solid var(--line);display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
            <div>
              <span style="font-size:12px;color:var(--dim);">Tổng số bài đã nộp:</span>
              <strong style="color:var(--text);margin-left:6px;font-size:15px;">${submissions.length}</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">Điểm trung bình lớp:</span>
              <strong style="color:var(--accent);margin-left:6px;font-size:15px;">${avgScore.toFixed(1)} / 10</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">Thời lượng đề:</span>
              <strong style="color:var(--text);margin-left:6px;font-size:15px;">${exam.durationMinutes} phút (${exam.questionIds.length} câu)</strong>
            </div>
          </div>

          <div style="padding:20px 24px;overflow-y:auto;flex:1;">
            ${submissions.length === 0 ? `
              <div style="text-align:center;padding:40px;color:var(--dim);font-style:italic;">
                Chưa có sinh viên nào nộp bài cho đề thi này.
              </div>
            ` : `
              <table class="leaderboard-table" style="font-size:13px;">
                <thead>
                  <tr>
                    <th>Sinh viên</th>
                    <th style="text-align:right;">Điểm (Thang 10)</th>
                    <th style="text-align:center;">Số câu đúng</th>
                    <th style="text-align:center;">Thời gian làm</th>
                    <th style="text-align:center;">Thời điểm nộp</th>
                  </tr>
                </thead>
                <tbody>
                  ${submissions.map(sub => `
                    <tr>
                      <td>
                        <div class="table-user-cell">
                          <span class="cell-avatar">${sub.avatar || '👤'}</span>
                          <div>
                            <span class="cell-name">${this._escapeHtml(sub.fullName)}</span>
                            <span class="cell-class">${this._escapeHtml(sub.className || 'Sinh viên')} • @${this._escapeHtml(sub.username)}</span>
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;font-weight:800;color:var(--brand);font-size:15px;">
                        ${sub.score} / 10
                      </td>
                      <td style="text-align:center;font-weight:600;">
                        ${sub.correctCount} / ${sub.totalQuestions}
                      </td>
                      <td style="text-align:center;color:var(--dim);">
                        ${Math.floor(sub.timeSpentSeconds / 60)}p ${sub.timeSpentSeconds % 60}s
                      </td>
                      <td style="text-align:center;color:var(--dim);font-size:12px;">
                        ${new Date(sub.submittedAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
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

  _showAlert(msg) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
    }
  }

  /**
   * Exports an exam's submissions to an Excel-friendly CSV with BOM.
   * @param {string} examId
   */
  _exportExamSubmissionsToCsv(examId) {
    const exam = examManager.getExamById(examId);
    if (!exam) return;
    const subs = examManager.getSubmissionsForExam(examId);
    if (subs.length === 0) {
      this._showAlert(`Đề thi "${exam.title}" chưa có sinh viên nào nộp bài để xuất điểm!`);
      return;
    }

    let csv = '\uFEFF"STT","Họ và Tên","Tài Khoản (Username)","Lớp / Đơn Vị","Điểm (Thang 10)","Số Câu Đúng","Tổng Số Câu","Thời Gian Làm","Thời Điểm Nộp","Xếp Loại"\r\n';

    subs.forEach((s, idx) => {
      const minutes = Math.floor(s.timeSpentSeconds / 60);
      const seconds = s.timeSpentSeconds % 60;
      const durationStr = `${minutes}p ${seconds}s`;
      const dateStr = new Date(s.submittedAt).toLocaleString('vi-VN');
      let rating = 'Yếu / Chưa đạt';
      if (s.score >= 9.0) rating = 'Xuất sắc';
      else if (s.score >= 8.0) rating = 'Giỏi';
      else if (s.score >= 6.5) rating = 'Khá';
      else if (s.score >= 5.0) rating = 'Trung bình';

      const row = [
        idx + 1,
        `"${(s.fullName || '').replace(/"/g, '""')}"`,
        `"${(s.username || '').replace(/"/g, '""')}"`,
        `"${(s.className || 'Sinh viên').replace(/"/g, '""')}"`,
        `"${s.score}"`,
        `"${s.correctCount}"`,
        `"${s.totalQuestions}"`,
        `"${durationStr}"`,
        `"${dateStr}"`,
        `"${rating}"`,
      ];
      csv += row.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (exam.title || 'Diem_Thi').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    a.download = `Bang_Diem_${safeTitle}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // ACTIONS: EXAM LIFECYCLE
  // =========================================================================

  _startExam(examId) {
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) {
      this._showAlert('Vui lòng đăng nhập tài khoản sinh viên để làm bài thi.');
      const btn = document.getElementById('btnUserAuth');
      if (btn) btn.click();
      return;
    }

    const exam = examManager.getExamById(examId);
    if (!exam) {
      this._showAlert('Không tìm thấy đề thi!');
      return;
    }

    // Check existing submission
    const existing = examManager.getSubmission(examId, currentUser.id);
    if (existing) {
      this._showAlert('Bạn đã nộp bài thi này rồi! Mỗi đề thi chỉ được làm 1 lần duy nhất.');
      this.reviewSubmission = existing;
      this.render();
      return;
    }

    const violationRecord = examManager.getExamViolationRecord(examId, currentUser.id);
    if (violationRecord.banned) {
      this._showAlert('Bạn đã bị cấm thi lại đề này do vi phạm quy chế 3 lần. Các đề thi khác vẫn được phép làm.');
      this.render();
      return;
    }

    const confirmStart = typeof window !== 'undefined' && window.confirm
      ? window.confirm(`Bắt đầu làm đề thi: "${exam.title}"?\n\nLưu ý quan trọng:\n- Thời gian làm bài: ${exam.durationMinutes} phút.\n- Mỗi thí sinh chỉ có DUY NHẤT 1 LƯỢT LÀM.\n- Màn hình sẽ tự khóa toàn màn hình khi vào thi; rời cửa sổ thi sẽ tính là vi phạm.\n- Đủ 3 vi phạm sẽ cấm thi lại đề này; các đề khác không bị ảnh hưởng.\n- Đồng hồ đếm ngược sẽ bắt đầu ngay bây giờ!\n\nBạn đã sẵn sàng chưa?`)
      : true;

    if (!confirmStart) return;

    // Resolve questions
    let questions = exam.questionIds.map(id => STATIC_QUESTION_BANK.find(q => q.id === id)).filter(Boolean);
    if (exam.shuffleQuestions) {
      questions = shuffle(questions);
    }

    const optionOrder = Object.fromEntries(questions.map(question => {
      const optionIds = question.options.map(option => option.id);
      return [question.id, exam.shuffleOptions ? shuffle(optionIds) : optionIds];
    }));

    this.activeExamSession = {
      exam,
      questions,
      optionOrder,
      answers: {},
      currentQIndex: 0,
      timeRemaining: exam.durationMinutes * 60,
      timerId: null,
      startedAt: Date.now(),
      violationCount: violationRecord.count || 0,
      lockdownPending: false,
      lockdownCountdown: null,
      lockdownTimerId: null,
      lockdownWarning: false,
      fullscreenActive: false,
    };

    this.render();
    this._attachExamLockdownListeners();
    this._requestExamFullscreen();
    this._startExamTimer();
  }

  _startExamTimer() {
    const session = this.activeExamSession;
    if (!session || session.timerId) return;
    session.timerId = setInterval(() => {
      if (this.activeExamSession !== session) return;
      session.timeRemaining--;

      const timerEl = this.container ? this.container.querySelector('#activeExamTimer') : null;
      if (timerEl) {
        const m = Math.floor(Math.max(0, session.timeRemaining) / 60);
        const s = Math.max(0, session.timeRemaining) % 60;
        timerEl.textContent = `⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (session.timeRemaining <= 120) timerEl.classList.add('urgent');
      }

      if (session.timeRemaining <= 0) {
        this._showAlert('⏰ Đã hết thời gian làm bài! Hệ thống tự động nộp bài thi của bạn.');
        this._submitActiveExam();
      }
    }, 1000);
  }

  _attachExamLockdownListeners() {
    if (typeof document === 'undefined' || this._examLockdownHandlers) return;
    this._examLockdownHandlers = {
      fullscreenchange: () => {
        const session = this.activeExamSession;
        if (!session) return;
        const isFullscreen = document.fullscreenElement === document.documentElement;
        if (isFullscreen) {
          session.fullscreenActive = true;
          if (session.lockdownPending) {
            this._cancelExamLockdownCountdown(session);
            session.lockdownPending = false;
            session.lockdownWarning = false;
            this.render();
          }
        } else if (session.fullscreenActive) {
          session.fullscreenActive = false;
          this._recordExamLockdownViolation();
        }
      },
      visibilitychange: () => {
        if (document.visibilityState === 'hidden') this._recordExamLockdownViolation();
      },
    };
    document.addEventListener('fullscreenchange', this._examLockdownHandlers.fullscreenchange);
    document.addEventListener('visibilitychange', this._examLockdownHandlers.visibilitychange);
  }

  _detachExamLockdownListeners() {
    if (typeof document !== 'undefined' && this._examLockdownHandlers) {
      document.removeEventListener('fullscreenchange', this._examLockdownHandlers.fullscreenchange);
      document.removeEventListener('visibilitychange', this._examLockdownHandlers.visibilitychange);
    }
    this._examLockdownHandlers = null;
  }

  _requestExamFullscreen({ preserveLockdownState = false } = {}) {
    if (typeof document === 'undefined' || typeof document.documentElement.requestFullscreen !== 'function') {
      return;
    }
    const session = this.activeExamSession;
    try {
      Promise.resolve(document.documentElement.requestFullscreen()).then(() => {
        if (this.activeExamSession !== session) return;
        this._cancelExamLockdownCountdown(session);
        session.fullscreenActive = true;
        session.lockdownPending = false;
        session.lockdownWarning = false;
        this.render();
      }).catch(() => {
        if (this.activeExamSession !== session || preserveLockdownState) return;
        session.lockdownPending = true;
        this.render();
      });
    } catch {
      if (this.activeExamSession === session && !preserveLockdownState) {
        session.lockdownPending = true;
        this.render();
      }
    }
  }

  _recordExamLockdownViolation() {
    const session = this.activeExamSession;
    if (!session || session.lockdownPending) return;
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) return;

    const result = examManager.recordExamViolation(session.exam.id, currentUser.id);
    if (!result.success) {
      this._showAlert(`Không thể lưu vi phạm thi: ${result.error}`);
      return;
    }
    session.violationCount = result.record.count;
    session.lockdownPending = true;
    session.lockdownWarning = false;

    if (session.violationCount >= 3) {
      this._finishExamForViolationBan();
      return;
    }
    this._startExamLockdownCountdown(session);
    this.render();
  }

  _startExamLockdownCountdown(session) {
    this._cancelExamLockdownCountdown(session);
    session.lockdownCountdown = 20;
    session.lockdownTimerId = setInterval(() => {
      if (this.activeExamSession !== session || !session.lockdownPending || session.timeRemaining <= 0) {
        this._cancelExamLockdownCountdown(session);
        return;
      }

      session.lockdownCountdown--;
      const countdownEl = this.container?.querySelector('#examLockdownCountdown');
      if (countdownEl) countdownEl.textContent = String(session.lockdownCountdown);

      if (session.lockdownCountdown <= 0) {
        this._cancelExamLockdownCountdown(session);
        this._recordExamLockdownTimeoutViolation(session);
      }
    }, 1000);
  }

  _cancelExamLockdownCountdown(session) {
    if (session.lockdownTimerId !== null) {
      clearInterval(session.lockdownTimerId);
      session.lockdownTimerId = null;
    }
    session.lockdownCountdown = null;
  }

  _recordExamLockdownTimeoutViolation(session) {
    if (this.activeExamSession !== session || !session.lockdownPending || session.timeRemaining <= 0) return;
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) return;

    const result = examManager.recordExamViolation(session.exam.id, currentUser.id);
    if (!result.success) {
      this._showAlert(`Không thể lưu vi phạm thi: ${result.error}`);
      return;
    }

    session.violationCount = result.record.count;
    if (session.violationCount >= 3) {
      this._finishExamForViolationBan();
      return;
    }

    session.lockdownWarning = true;
    this._startExamLockdownCountdown(session);
    this.render();
  }

  _finishExamForViolationBan() {
    this._submitActiveExam({ integrityBan: true });
  }

  _submitActiveExam({ integrityBan = false } = {}) {
    if (!this.activeExamSession) return;

    this._cancelExamLockdownCountdown(this.activeExamSession);
    if (this.activeExamSession.timerId) {
      clearInterval(this.activeExamSession.timerId);
      this.activeExamSession.timerId = null;
    }
    this._detachExamLockdownListeners();
    if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      Promise.resolve(document.exitFullscreen()).catch(() => {});
    }

    const currentUser = authManager.getCurrentUser();
    const timeSpentSeconds = Math.round((Date.now() - this.activeExamSession.startedAt) / 1000);

    const result = examManager.submitExam({
      examId: this.activeExamSession.exam.id,
      userId: currentUser ? currentUser.id : 'guest',
      userInfo: currentUser || {},
      answers: this.activeExamSession.answers,
      timeSpentSeconds,
      optionOrder: this.activeExamSession.optionOrder,
      integrityBan,
    });

    if (result.success && cloudSyncManager && cloudSyncManager.isConnected) {
      cloudSyncManager.serverSubmitExam(result.submission).catch(() => {});
    }

    this.activeExamSession = null;

    if (result.success) {
      this._showAlert(integrityBan
        ? `🚫 Bạn đã bị cấm thi lại đề này sau 3 lần vi phạm. Bài làm hiện tại đã được nộp.\n\nĐiểm số: ${result.submission.score} / 10 điểm`
        : `🎉 Bạn đã nộp bài thi thành công!\n\nĐiểm số: ${result.submission.score} / 10 điểm\nSố câu đúng: ${result.submission.correctCount} / ${result.submission.totalQuestions}\n\nKết quả đã được ghi nhận vào Bảng Xếp Hạng chính thức!`);
      this.reviewSubmission = result.submission;
    } else {
      this._showAlert(integrityBan
        ? `Bạn đã bị cấm thi lại đề này sau 3 lần vi phạm; các đề thi khác vẫn được phép làm. ${result.error || ''}`
        : (result.error || 'Có lỗi xảy ra khi nộp bài thi.'));
    }

    this.render();
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================

  _bindEvents() {
    // 1. Primary Nav Tab Switching
    const tabPractice = this.container.querySelector('#tabBtnPractice');
    const tabMyExams = this.container.querySelector('#tabBtnMyExams');
    const tabStudio = this.container.querySelector('#tabBtnStudio');

    if (tabPractice) {
      tabPractice.addEventListener('click', () => {
        this.setTab('practice');
      });
    }

    if (tabMyExams) {
      tabMyExams.addEventListener('click', () => {
        this.setTab('myExams');
      });
    }

    if (tabStudio) {
      tabStudio.addEventListener('click', () => {
        this.setTab('studio');
      });
    }

    const btnMyExamsLogin = this.container.querySelector('#btnMyExamsLogin');
    if (btnMyExamsLogin) {
      btnMyExamsLogin.addEventListener('click', () => {
        this._openAuthModal('login');
      });
    }

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

    // Jump to specific question in Practice Mode
    this.container.querySelectorAll('.btn-practice-jump').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetIdx = parseInt(e.currentTarget.getAttribute('data-jump-idx'), 10);
        if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx < this.practiceQuestions.length) {
          this.currentIndex = targetIdx;
          this.render();
        }
      });
    });

    // Practice Option Buttons Click
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

    // 3. My Exams & Timed Exam Events
    this.container.querySelectorAll('.btn-start-exam').forEach(btn => {
      btn.addEventListener('click', () => {
        const examId = btn.getAttribute('data-exam-id');
        this._startExam(examId);
      });
    });

    this.container.querySelectorAll('.btn-review-exam').forEach(btn => {
      btn.addEventListener('click', () => {
        const examId = btn.getAttribute('data-exam-id');
        const currentUser = authManager.getCurrentUser();
        const sub = examManager.getSubmission(examId, currentUser.id);
        if (sub) {
          this.reviewSubmission = sub;
          this.render();
        }
      });
    });

    const btnBackFromReview = this.container.querySelector('#btnBackFromReview');
    if (btnBackFromReview) {
      btnBackFromReview.addEventListener('click', () => {
        this.reviewSubmission = null;
        this.render();
      });
    }

    const btnBackFromScore = this.container.querySelector('#btnBackToExamsFromScore');
    if (btnBackFromScore) {
      btnBackFromScore.addEventListener('click', () => {
        this.reviewSubmission = null;
        this.render();
      });
    }

    // In Active Exam Room Events
    if (this.activeExamSession) {
      const btnResumeExamLockdown = this.container.querySelector('#btnResumeExamLockdown');
      if (btnResumeExamLockdown) {
        btnResumeExamLockdown.addEventListener('click', () => {
          const session = this.activeExamSession;
          if (!session) return;
          this._cancelExamLockdownCountdown(session);
          session.lockdownPending = false;
          session.lockdownWarning = false;
          this.render();
          this._requestExamFullscreen({ preserveLockdownState: true });
        });
      }

      // Jump to question
      this.container.querySelectorAll('.exam-q-jump-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-jump-idx'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < this.activeExamSession.questions.length) {
            this.activeExamSession.currentQIndex = idx;
            this.render();
          }
        });
      });

      // Prev / Next Question in Exam
      const btnExamPrevQ = this.container.querySelector('#btnExamPrevQ');
      if (btnExamPrevQ) {
        btnExamPrevQ.addEventListener('click', () => {
          if (this.activeExamSession.currentQIndex > 0) {
            this.activeExamSession.currentQIndex--;
            this.render();
          }
        });
      }

      const btnExamNextQ = this.container.querySelector('#btnExamNextQ');
      if (btnExamNextQ) {
        btnExamNextQ.addEventListener('click', () => {
          if (this.activeExamSession.currentQIndex < this.activeExamSession.questions.length - 1) {
            this.activeExamSession.currentQIndex++;
            this.render();
          }
        });
      }

      // Choose Option
      this.container.querySelectorAll('.btn-active-exam-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const optId = btn.getAttribute('data-opt-id');
          const currentQ = this.activeExamSession.questions[this.activeExamSession.currentQIndex];
          if (currentQ) {
            this.activeExamSession.answers[currentQ.id] = optId;
            this.render();
          }
        });
      });

      // Submit Active Exam
      const btnSubmitActiveExam = this.container.querySelector('#btnSubmitActiveExam');
      if (btnSubmitActiveExam) {
        btnSubmitActiveExam.addEventListener('click', () => {
          const answeredCount = Object.keys(this.activeExamSession.answers).length;
          const totalQ = this.activeExamSession.questions.length;
          const remaining = totalQ - answeredCount;

          let confirmMsg = 'Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?';
          if (remaining > 0) {
            confirmMsg = `Bạn vẫn còn ${remaining} câu chưa chọn đáp án!\n\nBạn có chắc chắn muốn nộp bài thi ngay bây giờ?`;
          }

          if (typeof window !== 'undefined' && window.confirm && !window.confirm(confirmMsg)) {
            return;
          }

          this._submitActiveExam();
        });
      }
    }

    // 4. Teacher's Studio Events
    const tabStudioAssign = this.container.querySelector('#tabStudioAssign');
    const tabStudioPrint = this.container.querySelector('#tabStudioPrint');

    if (tabStudioAssign) {
      tabStudioAssign.addEventListener('click', () => {
        this.studioSubTab = 'assign';
        this.render();
      });
    }

    if (tabStudioPrint) {
      tabStudioPrint.addEventListener('click', () => {
        this.studioSubTab = 'print';
        this.render();
      });
    }

    const selectionMode = this.container.querySelector('#selAssignSelectionMode');
    const randomQuestionControls = this.container.querySelector('#randomQuestionControls');
    const manualQuestionList = this.container.querySelector('#manualQuestionList');
    if (selectionMode && randomQuestionControls && manualQuestionList) {
      selectionMode.addEventListener('change', () => {
        const isManual = selectionMode.value === 'manual';
        randomQuestionControls.style.display = isManual ? 'none' : 'contents';
        manualQuestionList.style.display = isManual ? 'block' : 'none';
      });

      const selManualChapterFilter = this.container.querySelector('#selManualChapterFilter');
      const manualRows = Array.from(this.container.querySelectorAll('.manual-q-row'));
      const counterEl = this.container.querySelector('#manualSelectedCounter');

      const updateSelectedCounter = () => {
        if (!counterEl) return;
        const checkedCount = this.container.querySelectorAll('.chk-assign-question:checked').length;
        counterEl.textContent = `Đã chọn: ${checkedCount} câu`;
      };

      if (selManualChapterFilter) {
        selManualChapterFilter.addEventListener('change', () => {
          const filterVal = selManualChapterFilter.value;
          manualRows.forEach(row => {
            const topic = row.getAttribute('data-topic');
            if (filterVal === 'all' || topic === filterVal) {
              row.style.display = 'flex';
            } else {
              row.style.display = 'none';
            }
          });
        });
      }

      const btnManualSelectVisible = this.container.querySelector('#btnManualSelectVisible');
      if (btnManualSelectVisible) {
        btnManualSelectVisible.addEventListener('click', () => {
          manualRows.forEach(row => {
            if (row.style.display !== 'none') {
              const chk = row.querySelector('.chk-assign-question');
              if (chk) chk.checked = true;
            }
          });
          updateSelectedCounter();
        });
      }

      const btnManualDeselectAll = this.container.querySelector('#btnManualDeselectAll');
      if (btnManualDeselectAll) {
        btnManualDeselectAll.addEventListener('click', () => {
          this.container.querySelectorAll('.chk-assign-question').forEach(chk => {
            chk.checked = false;
          });
          updateSelectedCounter();
        });
      }

      this.container.querySelectorAll('.chk-assign-question').forEach(chk => {
        chk.addEventListener('change', updateSelectedCounter);
      });
      updateSelectedCounter();
    }

    // Radio assign target toggle
    const radAssignAll = this.container.querySelector('#radAssignAll');
    const radAssignCustom = this.container.querySelector('#radAssignCustom');
    const customStudentListWrap = this.container.querySelector('#customStudentListWrap');

    if (radAssignAll && customStudentListWrap) {
      radAssignAll.addEventListener('change', () => {
        if (radAssignAll.checked) {
          customStudentListWrap.style.display = 'none';
        }
      });
    }

    if (radAssignCustom && customStudentListWrap) {
      radAssignCustom.addEventListener('change', () => {
        if (radAssignCustom.checked) {
          customStudentListWrap.style.display = 'block';
        }
      });
    }

    // Create & Assign Exam Button
    const btnCreateAndAssign = this.container.querySelector('#btnCreateAndAssignExam');
    if (btnCreateAndAssign) {
      btnCreateAndAssign.addEventListener('click', () => {
        const titleInput = this.container.querySelector('#txtAssignTitle');
        const durationInput = this.container.querySelector('#numAssignDuration');
        const countSelect = this.container.querySelector('#selAssignQCount');
        const topicSelect = this.container.querySelector('#selAssignTopic');

        const title = titleInput ? titleInput.value.trim() : '';
        const durationMinutes = durationInput ? parseInt(durationInput.value, 10) : 15;
        const count = countSelect ? parseInt(countSelect.value, 10) : 10;
        const topic = topicSelect ? topicSelect.value : 'all';
        const selectionMode = this.container.querySelector('#selAssignSelectionMode')?.value || 'random';

        if (!title) {
          this._showAlert('Vui lòng nhập tiêu đề đề thi!');
          return;
        }

        // Determine assignedTo target
        let assignedTo = ['all'];
        if (radAssignCustom && radAssignCustom.checked) {
          const selectedStudents = [];
          this.container.querySelectorAll('.chk-assign-student:checked').forEach(chk => {
            selectedStudents.push(chk.value);
          });
          if (selectedStudents.length === 0) {
            this._showAlert('Vui lòng chọn ít nhất 1 sinh viên để phân đề!');
            return;
          }
          assignedTo = selectedStudents;
        }

        let questionIds;
        if (selectionMode === 'manual') {
          questionIds = Array.from(this.container.querySelectorAll('.chk-assign-question:checked'))
            .map(input => input.value);
          if (questionIds.length === 0) {
            this._showAlert('Vui lòng chọn ít nhất 1 câu hỏi cho đề thi!');
            return;
          }
        } else {
          let pool = [...STATIC_QUESTION_BANK];
          if (topic !== 'all') {
            pool = pool.filter(q => q.topic === topic);
          }
          // Allocate strictly 10% hard questions (e.g. 10 questions -> exactly 1 hard question)
          const targetHardCount = Math.max(0, Math.round(count * 0.1));
          const hardPool = pool.filter(q => q.difficulty === 'hard');
          const standardPool = pool.filter(q => q.difficulty !== 'hard');

          const shuffledHard = shuffle(hardPool);
          const shuffledStandard = shuffle(standardPool);

          const actualHardCount = Math.min(targetHardCount, shuffledHard.length);
          const standardCount = Math.min(count - actualHardCount, shuffledStandard.length);

          const selectedQuestions = shuffle([
            ...shuffledStandard.slice(0, standardCount),
            ...shuffledHard.slice(0, actualHardCount),
          ]);
          questionIds = selectedQuestions.map(q => q.id);
        }

        const result = examManager.createExam({
          title,
          description: `Đề thi ${durationMinutes} phút (${questionIds.length} câu) môn Toán Rời Rạc.`,
          durationMinutes,
          questionIds,
          assignedTo,
          createdBy: authManager.getCurrentUser() ? authManager.getCurrentUser().id : 'user_admin',
          shuffleQuestions: this.container.querySelector('#chkShuffleQuestions')?.checked ?? true,
          shuffleOptions: this.container.querySelector('#chkShuffleOptions')?.checked ?? true,
        });

        if (result.success) {
          if (cloudSyncManager && cloudSyncManager.isConnected) {
            cloudSyncManager.serverCreateExam(result.exam).catch(() => {});
          }
          this._showAlert(`🎉 Tạo và phân phối đề thi thành công!\n\nĐề thi: "${title}"\nThời lượng: ${durationMinutes} phút\nSố câu: ${questionIds.length} câu\nĐối tượng: ${assignedTo.includes('all') ? 'Toàn bộ sinh viên' : assignedTo.length + ' sinh viên'}`);
          this.render();
        } else {
          this._showAlert(result.error || 'Có lỗi xảy ra khi tạo đề thi.');
        }
      });
    }

    // View Gradebook for Exam
    this.container.querySelectorAll('.btn-view-gradebook').forEach(btn => {
      btn.addEventListener('click', () => {
        const examId = btn.getAttribute('data-exam-id');
        this.gradebookExamId = examId;
        this.render();
      });
    });

    const btnCloseGradebook = this.container.querySelector('#btnCloseGradebook');
    if (btnCloseGradebook) {
      btnCloseGradebook.addEventListener('click', () => {
        this.gradebookExamId = null;
        this.render();
      });
    }

    // Export Gradebook Excel in Modal
    const btnExportGradebook = this.container.querySelector('#btnExportGradebookExcel');
    if (btnExportGradebook && this.gradebookExamId) {
      btnExportGradebook.addEventListener('click', () => {
        this._exportExamSubmissionsToCsv(this.gradebookExamId);
      });
    }

    // Export Exam Excel from assigned exams table
    this.container.querySelectorAll('.btn-export-exam-excel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const examId = btn.getAttribute('data-exam-id');
        if (examId) {
          this._exportExamSubmissionsToCsv(examId);
        }
      });
    });

    const gradebookBackdrop = this.container.querySelector('#gradebookModalBackdrop');
    if (gradebookBackdrop) {
      gradebookBackdrop.addEventListener('click', (e) => {
        if (e.target === gradebookBackdrop) {
          this.gradebookExamId = null;
          this.render();
        }
      });
    }

    // Delete Assigned Exam
    this.container.querySelectorAll('.btn-delete-assigned-exam').forEach(btn => {
      btn.addEventListener('click', async () => {
        const examId = btn.getAttribute('data-exam-id');
        const examTitle = btn.getAttribute('data-exam-title') || 'Đề thi này';

        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`Xóa đề thi "${examTitle}" và tất cả kết quả nộp bài liên quan?\n\nHành động này không thể hoàn tác.`)) {
          return;
        }

        examManager.deleteExam(examId);
        if (cloudSyncManager && cloudSyncManager.isConnected) {
          try {
            await cloudSyncManager.serverDeleteExam(examId);
          } catch {}
        }

        this.render();
      });
    });

    // 5. Teacher's A4 & LaTeX Print Studio Events
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

  /**
   * Helper to open the authentication modal directly.
   * @param {'login'|'register'|'quick'} [tab]
   */
  _openAuthModal(tab = 'login') {
    if (typeof this.onOpenAuth === 'function') {
      this.onOpenAuth(tab);
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-auth', { detail: { tab } }));
    }
    const btnProfile = document.getElementById('btnUserDropdownProfile');
    if (btnProfile) {
      btnProfile.click();
      return;
    }
    const globalAuthBtn = document.getElementById('btnUserAuth');
    if (globalAuthBtn) {
      globalAuthBtn.click();
    }
  }

  /**
   * Initializes intuitive keyboard shortcuts for quiz navigation and answer selection.
   * - ArrowRight: Move to next question
   * - ArrowLeft: Move to previous question
   * - Enter / Space: Move to next question if current question is already answered
   * - A / B / C / D or 1 / 2 / 3 / 4: Select corresponding answer option
   * Note: Purely silent interaction, no visual annotations per user design.
   */
  _initKeyboardNavigation() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // 1. Only respond when QuizView is active and mounted
      if (!this.container || !this.container.classList.contains('active')) return;

      // 2. Ignore if modal dialog is open
      if (document.body.classList.contains('modal-open') || document.querySelector('.auth-modal-overlay.open')) {
        return;
      }

      // 3. Ignore if user is typing into input, textarea, or select
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable)) {
        return;
      }

      // Context 1: Practice Arena Mode
      if (this.activeTab === 'practice' && this.practiceQuestions && this.practiceQuestions.length > 0) {
        const q = this.practiceQuestions[this.currentIndex];

        // Arrow Right: Next question
        if (e.key === 'ArrowRight') {
          if (this.currentIndex < this.practiceQuestions.length - 1) {
            e.preventDefault();
            this.currentIndex++;
            this.render();
          }
          return;
        }

        // Arrow Left: Previous question
        if (e.key === 'ArrowLeft') {
          if (this.currentIndex > 0) {
            e.preventDefault();
            this.currentIndex--;
            this.render();
          }
          return;
        }

        // Enter or Space: Advance to next question if answered
        if ((e.key === 'Enter' || e.key === ' ') && q && this.userAnswers[q.id]) {
          if (this.currentIndex < this.practiceQuestions.length - 1) {
            e.preventDefault();
            this.currentIndex++;
            this.render();
          }
          return;
        }

        // Option selection keys: A, B, C, D or 1, 2, 3, 4
        const keyMap = {
          'a': 'A', 'A': 'A', '1': 'A',
          'b': 'B', 'B': 'B', '2': 'B',
          'c': 'C', 'C': 'C', '3': 'C',
          'd': 'D', 'D': 'D', '4': 'D',
        };
        const optId = keyMap[e.key];
        if (optId && q && !this.userAnswers[q.id]) {
          const optExists = q.options && q.options.some(opt => opt.id === optId);
          if (optExists) {
            e.preventDefault();
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
            this.render();
          }
          return;
        }
      }

      // Context 2: Active Timed Exam Session
      if (this.activeTab === 'myExams' && this.activeExamSession && this.activeExamSession.questions) {
        const session = this.activeExamSession;
        const currentQ = session.questions[session.currentQIndex];

        // Arrow Right: Next question in exam
        if (e.key === 'ArrowRight') {
          if (session.currentQIndex < session.questions.length - 1) {
            e.preventDefault();
            session.currentQIndex++;
            this.render();
          }
          return;
        }

        // Arrow Left: Previous question in exam
        if (e.key === 'ArrowLeft') {
          if (session.currentQIndex > 0) {
            e.preventDefault();
            session.currentQIndex--;
            this.render();
          }
          return;
        }

        // Option selection keys: A, B, C, D or 1, 2, 3, 4
        const keyMap = {
          'a': 'A', 'A': 'A', '1': 'A',
          'b': 'B', 'B': 'B', '2': 'B',
          'c': 'C', 'C': 'C', '3': 'C',
          'd': 'D', 'D': 'D', '4': 'D',
        };
        const optId = keyMap[e.key];
        if (optId && currentQ) {
          const optExists = currentQ.options && currentQ.options.some(opt => opt.id === optId);
          if (optExists) {
            e.preventDefault();
            session.answers[currentQ.id] = optId;
            this.render();
          }
          return;
        }
      }
    });
  }
}
