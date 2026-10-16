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
  getAllQuestions,
  generateExamPaper,
  exportExamToLatex,
  QUIZ_TOPICS,
  QUIZ_DIFFICULTIES,
} from '../../core/quiz/QuizBank.js';
import { authManager } from '../../core/auth/AuthManager.js';
import { quizHistoryManager } from '../../core/quiz/QuizHistoryManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';
import { examManager } from '../../core/quiz/ExamManager.js';
import {
  parseExamText,
  parseExamCsv,
  generateSampleExamText,
  generateSampleExamCsv,
  generateSampleWordDocument,
  extractTextFromDocx,
  mergeImportedQuestions,
  stripHtmlToExamText,
} from '../../core/quiz/ExamParser.js';

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

    // Active primary tab: 'myExams' (for all) | 'studio' (admin only)
    this.activeTab = 'myExams';

    // Timed Exam Taking Session State
    this.activeExamSession = null; // { exam, questions, answers, currentQIndex, timeRemaining, timerId, startedAt }
    this.reviewSubmission = null; // Submission object being reviewed

    // Teacher's Exam Studio State (3 Sub-Tabs: distribute | publish | print, with 'assign' alias)
    this.studioSubTab = 'distribute'; // 'distribute' | 'publish' | 'print'
    this.fileDistributions = {}; // Map fileId -> count of questions chosen to distribute
    this.gradebookExamId = null; // Exam ID for gradebook modal
    this.studioConfig = {
      count: 10,
      topic: 'all',
      difficulty: 'all',
    };
    this.currentExam = null;
    this.showTeacherSolutions = true;

    // Admin Exam Import & Answer Key State (Persisted in localStorage)
    const saved = this._loadSavedWordFiles();
    this.importedFiles = saved.files;
    this.importedQuestions = saved.questions;
    this.importRawText = saved.rawText;
    this.importErrors = [];
    this.adminAnswerKeyExamId = null;
    this.selectedAssignFileId = 'all'; // 'all' or specific file.id
    this.selectedAssignCount = 'all'; // 'all' or string number e.g. '10', '20'
    this.studioPrintSource = 'all_word'; // 'all_word', specific file.id, or 'builtin'
    this.printExamCode = null;
    this.studioAssignTitle = null;

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

  _getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage;
      }
    } catch {}
    return null;
  }

  _loadSavedWordFiles() {
    try {
      const storage = this._getStorage();
      if (storage) {
        const storedFiles = storage.getItem('toanrr_custom_imported_files_v1');
        const raw = storage.getItem('toanrr_custom_imported_raw_v1');
        if (storedFiles) {
          const parsedFiles = JSON.parse(storedFiles);
          if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
            const allQ = parsedFiles.flatMap(f => f.questions || []);
            return { files: parsedFiles, questions: allQ, rawText: raw || '' };
          }
        }

        // Backward compatibility: migrate from toanrr_custom_imported_questions_v1
        const storedQ = storage.getItem('toanrr_custom_imported_questions_v1');
        if (storedQ) {
          const parsedQ = JSON.parse(storedQ);
          if (Array.isArray(parsedQ) && parsedQ.length > 0) {
            const legacyFile = {
              id: 'file_legacy_default',
              name: 'Đề thi đã tải lên trước đó.doc',
              uploadedAt: new Date().toISOString(),
              questionCount: parsedQ.length,
              questions: parsedQ,
            };
            return { files: [legacyFile], questions: parsedQ, rawText: raw || '' };
          }
        }
      }
    } catch {}
    return { files: [], questions: [], rawText: '' };
  }

  _saveWordFiles(files) {
    this.importedFiles = Array.isArray(files) ? files : [];
    this.importedQuestions = this.importedFiles.flatMap(f => f.questions || []);
    if (!this.fileDistributions) {
      this.fileDistributions = {};
    }
    this.importedFiles.forEach(f => {
      if (this.fileDistributions[f.id] === undefined) {
        this.fileDistributions[f.id] = f.questionCount || (f.questions ? f.questions.length : 0);
      }
    });
    try {
      const storage = this._getStorage();
      if (storage) {
        storage.setItem('toanrr_custom_imported_files_v1', JSON.stringify(this.importedFiles));
        storage.setItem('toanrr_custom_imported_questions_v1', JSON.stringify(this.importedQuestions));
      }
    } catch {}
  }

  _deleteImportedFile(fileId) {
    const file = this.importedFiles.find(f => f.id === fileId);
    if (!file) return;

    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`Bạn có chắc chắn muốn xóa dữ liệu từ file "${file.name}"?\n(${file.questionCount} câu hỏi sẽ bị gỡ khỏi hệ thống)`);
      if (!ok) return;
    }

    const updated = this.importedFiles.filter(f => f.id !== fileId);
    if (this.selectedAssignFileId === fileId) {
      this.selectedAssignFileId = 'all';
    }
    if (this.studioPrintSource === fileId) {
      this.studioPrintSource = 'all_word';
    }
    if (this.fileDistributions) {
      delete this.fileDistributions[fileId];
    }
    this._saveWordFiles(updated);
    this._showAlert(`🗑️ Đã xóa dữ liệu file "${file.name}" thành công!`);
    this.render();
  }

  _clearAllWordFiles() {
    this.importedFiles = [];
    this.importedQuestions = [];
    this.importRawText = '';
    this.importErrors = [];
    this.selectedAssignFileId = 'all';
    this.selectedAssignCount = 'all';
    this.studioPrintSource = 'all_word';
    this.fileDistributions = {};
    try {
      const storage = this._getStorage();
      if (storage) {
        storage.removeItem('toanrr_custom_imported_files_v1');
        storage.removeItem('toanrr_custom_imported_questions_v1');
        storage.removeItem('toanrr_custom_imported_raw_v1');
      }
    } catch {}
  }

  _saveWordQuestions(questions, rawText = null) {
    const list = Array.isArray(questions) ? questions : [];
    if (this.importedFiles && this.importedFiles.length > 0) {
      if (this.importedFiles.length === 1) {
        this.importedFiles[0].questions = list;
        this.importedFiles[0].questionCount = list.length;
      } else {
        const synth = {
          id: `file_${Date.now()}`,
          name: 'Bộ câu hỏi tự soạn.doc',
          uploadedAt: new Date().toISOString(),
          questionCount: list.length,
          questions: list,
        };
        this.importedFiles = [synth];
      }
    } else if (list.length > 0) {
      this.importedFiles = [{
        id: `file_${Date.now()}`,
        name: 'Bộ câu hỏi tự soạn.doc',
        uploadedAt: new Date().toISOString(),
        questionCount: list.length,
        questions: list,
      }];
    } else {
      this.importedFiles = [];
    }
    this._saveWordFiles(this.importedFiles);
    if (rawText !== null) {
      this.importRawText = rawText;
      try {
        const storage = this._getStorage();
        if (storage) storage.setItem('toanrr_custom_imported_raw_v1', this.importRawText);
      } catch {}
    }
  }

  _clearAllWordQuestions() {
    this._clearAllWordFiles();
  }

  _loadSavedWordQuestions() {
    const res = this._loadSavedWordFiles();
    return { questions: res.questions, rawText: res.rawText };
  }

  _getDistributedSummary() {
    if (!this.importedFiles || this.importedFiles.length === 0) {
      if (this.importedQuestions && this.importedQuestions.length > 0) {
        return {
          totalSelected: this.importedQuestions.length,
          totalAvailable: this.importedQuestions.length,
          breakdown: [{
            fileId: 'default_bank',
            fileName: 'Câu hỏi tự soạn đã nạp',
            selectedCount: this.importedQuestions.length,
            availableCount: this.importedQuestions.length,
          }]
        };
      }
      return { totalSelected: 0, totalAvailable: 0, breakdown: [] };
    }

    if (!this.fileDistributions) {
      this.fileDistributions = {};
    }

    let totalSelected = 0;
    let totalAvailable = 0;
    const breakdown = [];

    this.importedFiles.forEach(file => {
      const fileCount = file.questionCount || (file.questions ? file.questions.length : 0);
      totalAvailable += fileCount;
      let count = this.fileDistributions[file.id];
      if (count === undefined || count === null) {
        count = fileCount;
        this.fileDistributions[file.id] = count;
      } else {
        count = Math.min(Math.max(0, parseInt(count, 10) || 0), fileCount);
      }
      totalSelected += count;
      if (count > 0) {
        breakdown.push({
          fileId: file.id,
          fileName: file.name,
          selectedCount: count,
          availableCount: fileCount,
        });
      }
    });

    return { totalSelected, totalAvailable, breakdown };
  }

  /**
   * Computes sequential exam title: "Đề 1", "Đề 2", "Đề 3", ...
   * If an exam already exists with number N, continues to N + 1.
   */
  _getNextExamTitle() {
    const existingExams = (examManager && typeof examManager.getExams === 'function')
      ? examManager.getExams()
      : [];
    let maxNum = 0;
    (existingExams || []).forEach(ex => {
      if (!ex || !ex.title) return;
      const match = ex.title.trim().match(/^Đề\s*(\d+)/i) || ex.title.trim().match(/Đề\s*(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    });
    return `Đề ${maxNum + 1}`;
  }

  _getSelectedDistributedQuestions() {
    if (!this.importedFiles || this.importedFiles.length === 0) {
      return this.importedQuestions || [];
    }

    if (!this.fileDistributions) {
      this.fileDistributions = {};
    }

    const result = [];
    this.importedFiles.forEach(file => {
      const fileQuestions = file.questions || [];
      const fileCount = fileQuestions.length;
      let count = this.fileDistributions[file.id];
      if (count === undefined || count === null) {
        count = fileCount;
      } else {
        count = Math.min(Math.max(0, parseInt(count, 10) || 0), fileCount);
      }
      if (count > 0 && fileCount > 0) {
        if (count >= fileCount) {
          result.push(...fileQuestions);
        } else {
          const picked = shuffle([...fileQuestions]).slice(0, count);
          result.push(...picked);
        }
      }
    });
    return result;
  }

  _getStudioPrintExam() {
    if (!this.importedQuestions || this.importedQuestions.length === 0) {
      return null;
    }

    const source = (this.studioPrintSource && this.studioPrintSource !== 'builtin') 
      ? this.studioPrintSource 
      : 'all_word';

    let pool = this.importedQuestions;
    if (source === 'distributed') {
      const distQ = this._getSelectedDistributedQuestions();
      if (distQ && distQ.length > 0) {
        pool = distQ;
      }
    } else if (source !== 'all_word') {
      const file = this.importedFiles.find(f => f.id === source);
      if (file && file.questions && file.questions.length > 0) {
        pool = file.questions;
      }
    }

    if (pool.length === 0) {
      return null;
    }

    const desiredCount = (this.studioConfig.count && !isNaN(parseInt(this.studioConfig.count, 10)) && parseInt(this.studioConfig.count, 10) > 0)
      ? parseInt(this.studioConfig.count, 10)
      : pool.length;

    let selectedQuestions;
    if (pool.length <= desiredCount) {
      selectedQuestions = [...pool];
    } else {
      selectedQuestions = shuffle(pool).slice(0, desiredCount);
    }

    if (!this.printExamCode) {
      this.printExamCode = `TRR-${Math.floor(100 + Math.random() * 900)}`;
    }

    return {
      id: `print_exam_${Date.now()}`,
      examCode: this.printExamCode,
      title: 'ĐỀ THI MÔN: TOÁN RỜI RẠC',
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Sets active subtab: 'myExams' | 'studio'
   * @param {'myExams' | 'studio'} tabName
   */
  setTab(tabName) {
    if (tabName === 'leaderboard' || tabName === 'practice') {
      tabName = 'myExams';
    }
    if (tabName === 'studio' && !authManager.isAdmin()) {
      tabName = 'myExams';
    }
    const validTabs = authManager.isAdmin() ? ['myExams', 'studio'] : ['myExams'];
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
      this.studioConfig.topic = normalizedTopic;
      this._generateNewExam();
      if (this.container) {
        this.render();
      }
    }
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

    const isAdmin = authManager.isAdmin();
    const currentUser = authManager.getCurrentUser();

    if (!isAdmin && this.activeTab === 'studio') {
      this.activeTab = 'myExams';
    }
    if (this.activeTab === 'practice' || this.activeTab === 'leaderboard') {
      this.activeTab = 'myExams';
    }

    // Check my exams count
    const myExams = currentUser ? examManager.getExamsForUser(currentUser.id) : [];
    const myPendingCount = currentUser 
      ? myExams.filter(e =>
        !examManager.getSubmission(e.id, currentUser.id) &&
        !examManager.getExamViolationRecord(e.id, currentUser.id).banned
      ).length
      : 0;

    this.container.innerHTML = `
      <div class="quiz-view-container" style="max-width:1300px;margin:0 auto;padding:${this.activeExamSession ? '12px 16px 40px' : '20px 24px 60px'};">
        
        <!-- Header -->
        <div class="quiz-header" style="${this.activeExamSession ? 'display:none;' : 'display:flex;'}justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:2px 10px;border-radius:12px;font-size:11.5px;font-weight:600;">
                🎯 EdTech &amp; Khảo Thí Trực Tuyến
              </span>
              <span style="font-size:12px;color:var(--dim);">Toán Rời Rạc &amp; Cấu Trúc Dữ Liệu</span>
            </div>
            <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0;">${isAdmin ? 'Quản Trị Khảo Thí &amp; Soạn Đề Từ File Word' : 'Cổng Khảo Thí &amp; Kiểm Tra Định Kỳ'}</h1>
          </div>

          <!-- Main Nav Tabs -->
          <div class="quiz-main-tabs" style="display:flex;gap:6px;align-items:center;background:var(--panel);padding:4px;border-radius:8px;border:1px solid var(--line);flex-wrap:wrap;">
            <button type="button" class="btn-tab ${this.activeTab === 'myExams' ? 'active' : ''}" id="tabBtnMyExams" style="padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;position:relative;">
              📝 ${isAdmin ? 'Quản Lý Đề Thi' : 'Đề Thi Của Tôi'} ${myPendingCount > 0 ? `<span style="background:#ef4444;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;font-weight:700;">${myPendingCount}</span>` : ''}
            </button>
            <button type="button" class="btn-tab ${this.activeTab === 'studio' ? 'active' : ''}" id="tabBtnStudio" style="${isAdmin ? '' : 'display:none;'}padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
              👩‍🏫 Soạn Đề Từ File Word
            </button>
          </div>
        </div>

        <!-- TAB 1: MY EXAMS (TIMED ASSIGNED EXAMS) -->
        <div id="paneMyExams" style="display:${this.activeTab === 'myExams' ? 'block' : 'none'};">
          ${this._renderMyExamsView()}
        </div>

        <!-- TAB 2: TEACHER'S EXAM STUDIO -->
        ${isAdmin ? `
        <div id="paneStudio" style="display:${this.activeTab === 'studio' ? 'block' : 'none'};">
          ${this._renderStudioView()}
        </div>
        ` : ''}

        <!-- MODAL: GRADEBOOK (WHEN ADMIN VIEWS AN EXAM'S SUBMISSIONS) -->
        ${this.gradebookExamId ? this._renderGradebookModal() : ''}

        <!-- MODAL: ADMIN ANSWER KEY (FILE ĐÁP ÁN DÀNH RIÊNG CHO ADMIN) -->
        ${this.adminAnswerKeyExamId ? this._renderAdminAnswerKeyModal() : ''}

      </div>
    `;

    this._bindEvents();
  }

  _renderPracticeView() {
    return '';
  }
  // =========================================================================
  // SUB-VIEW 1: MY EXAMS (TIMED ASSIGNED EXAMS - 1 ATTEMPT, SCALE 10)
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
            Các bài kiểm tra định kỳ và đề thi khảo sát được phân phối trực tiếp cho từng sinh viên. Kết quả thi được chấm theo Thang Điểm 10.
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
      <!-- Student Exam Dashboard Header (Only shown for Students) -->
      ${!isAdmin ? `
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:4px;">
            🎓 Cổng Khảo Thí &amp; Kiểm Tra Định Kỳ
          </div>
          <h2 style="font-size:20px;font-weight:700;color:var(--text);margin:0;">
            Xin chào, ${this._escapeHtml(currentUser.fullName)}
          </h2>
          <p style="font-size:13px;color:var(--dim);margin:4px 0 0;">
            Quy chế thi trực tuyến: Mỗi thí sinh chỉ có duy nhất 1 lượt làm. Màn hình sẽ tự động khóa khi vào thi, <strong style="color:#ef4444;">VI PHẠM</strong> 3 lần sẽ bị 0đ.
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
      ` : ''}

      <!-- Assigned Exams Table & Gradebook (Quản Lý Đề Thi Cho Admin) -->
      ${isAdmin ? `
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">
              📑 Danh Sách Các Đề Thi Đã Phân Phối (${assignedExams.length})
            </h3>
            <button type="button" class="btn-danger" id="btnAdminClearAllExams" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-size:12.5px;font-weight:700;border-radius:8px;cursor:pointer;background:#ef4444;color:#fff;border:none;">
              <span>🗑️</span>
              <span>Xóa Toàn Bộ Đề Thi &amp; Dữ Liệu Sinh Viên</span>
            </button>
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
                ${assignedExams.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center;padding:28px;color:var(--dim);font-style:italic;">
                      Chưa có đề thi nào được tạo. Hãy chuyển sang tab "Soạn Đề Từ File Word" để nạp file và phát đề!
                    </td>
                  </tr>
                ` : assignedExams.map(item => {
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
                        <button type="button" class="btn-sm btn-view-admin-key" data-exam-id="${item.id}" style="background:rgba(245,158,11,0.18);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);margin-right:6px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;">
                          🔑 File Đáp Án
                        </button>
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
      ` : ''}

      <!-- Assigned Exams Grid -->
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span>📋 ${isAdmin ? 'Phòng Thi Thử Nghiệm / Xem Trước Đề (Chế Độ Quản Trị Viên):' : 'Danh Sách Đề Thi Trắc Nghiệm:'}</span>
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
                      ${isBanned ? `🚫 VI PHẠM (3/3): ${sub ? sub.score : 0} / 10 ĐIỂM (BỊ CẤM THI LẠI ĐỀ NÀY)` : (isCompleted ? `✅ ĐÃ HOÀN THÀNH: ${sub.score} / 10` : '⏳ CHƯA LÀM (Chỉ 1 lượt)')}
                    </span>
                    <span style="font-size:11px;color:var(--dim);">
                      ${new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <h3 class="exam-card-title">${this._escapeHtml(exam.title)}</h3>

                  <div class="exam-meta-row">
                    <span class="exam-meta-pill">⏱️ ${exam.durationMinutes} phút</span>
                    <span class="exam-meta-pill">🔢 ${exam.questionIds.length} câu trắc nghiệm</span>
                    <span class="exam-meta-pill">🎯 Thang 10 điểm</span>
                  </div>
                </div>

                <div style="border-top:1px solid var(--line);padding-top:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
                  ${isCompleted ? `
                    <div style="font-size:12px;color:var(--dim);">
                      ${isBanned || sub.integrityBan ? '<span style="color:#ef4444;font-weight:700;">⚠️ Vi phạm 3 lần • Xử lý 0 điểm</span>' : `Đúng ${sub.correctCount}/${sub.totalQuestions} câu • ${Math.floor(sub.timeSpentSeconds / 60)}p ${sub.timeSpentSeconds % 60}s`}
                    </div>
                    <button type="button" class="btn-sm btn-review-exam" data-exam-id="${exam.id}" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;">
                      👁️ Xem lại bài thi
                    </button>
                  ` : isBanned ? `
                    <div class="exam-ban-notice">
                      Đã vi phạm quy chế ${violationRecord.count} lần. Bạn bị xử lý 0 điểm và bị cấm thi lại đề này.
                    </div>
                  ` : `
                    <div style="font-size:12px;color:#f59e0b;font-weight:600;">
                      ⚠️ Duy nhất 1 lượt làm • <strong style="color:#ef4444;">VI PHẠM</strong> 3 lần sẽ bị 0đ
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
          <p>Vi phạm ${session.violationCount}/3. <strong style="color:#ef4444;">VI PHẠM</strong> đủ 3 lần sẽ bị 0đ và cấm thi lại đề này.</p>
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
            <h2 style="font-size:20px;font-weight:700;color:var(--text);margin:2px 0 0;line-height:1.3;word-break:break-word;">
              ${this._escapeHtml(exam.title)}
            </h2>
          </div>

          <div class="active-exam-actions-wrap" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Countdown Timer -->
            <div class="active-exam-timer-box ${isUrgent ? 'urgent' : ''}" id="activeExamTimer">
              ⏱️ ${timeFormatted}
            </div>

            <!-- Submit Button -->
            <button type="button" class="btn-primary" id="btnSubmitActiveExam" style="background:#10b981;border-color:#10b981;font-weight:700;font-size:14px;padding:10px 22px;min-height:42px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
              📤 Nộp Bài Thi (${answeredCount}/${totalQ})
            </button>
          </div>
        </div>

        <!-- Question Fast Jump Grid -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
          <div style="font-size:12px;font-weight:600;color:var(--dim);text-transform:uppercase;">
            Mục lục câu hỏi (Bấm số để chuyển nhanh):
          </div>
          <div class="exam-q-jump-hint" style="font-size:11px;color:var(--dim);">
            ⇄ Vuốt ngang
          </div>
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
        <div class="exam-question-card" style="background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:24px;margin-bottom:20px;box-sizing:border-box;">
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-size:13px;font-weight:700;background:var(--panel);border:1px solid var(--line);padding:3px 12px;border-radius:6px;color:var(--text);">
              Câu ${session.currentQIndex + 1} / ${totalQ}
            </span>
            <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">
              ${currentQ.topicName || currentQ.topic}
            </span>
          </div>

          <div style="font-size:16.5px;font-weight:600;color:var(--text);line-height:1.6;margin-bottom:24px;border-left:4px solid var(--accent);padding-left:14px;word-break:break-word;overflow-wrap:break-word;">
            ${currentQ.question}
          </div>

          <!-- Options -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${displayedOptions.map((opt, optionIndex) => {
              const isSelected = selectedOpt === opt.id;
              const displayLabel = String.fromCharCode(65 + optionIndex);
              let style = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-size:14px;text-align:left;cursor:pointer;transition:all 0.15s ease;width:100%;line-height:1.5;box-sizing:border-box;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;`;
              let badgeStyle = `background:var(--line);color:var(--text);`;

              if (isSelected) {
                style = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;background:rgba(56,189,248,0.15);border:2px solid var(--accent);color:var(--text);font-size:14px;text-align:left;cursor:pointer;width:100%;line-height:1.5;box-sizing:border-box;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;`;
                badgeStyle = `background:var(--accent);color:#000;font-weight:bold;`;
              }

              return `
                <button type="button" class="btn-active-exam-opt ${isSelected ? 'selected' : ''}" data-opt-id="${opt.id}" style="${style}">
                  <span class="opt-badge" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:13px;font-weight:700;flex-shrink:0;margin-top:2px;${badgeStyle}">
                    ${displayLabel}
                  </span>
                  <span class="opt-text" style="flex:1;min-width:0;font-weight:500;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;line-height:1.5;">${opt.text}</span>
                  ${isSelected ? '<span class="opt-selected-tag" style="color:var(--accent);font-weight:bold;font-size:12.5px;flex-shrink:0;white-space:nowrap;margin-left:8px;margin-top:2px;">● Đã chọn</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

        </div>

        <!-- Question Navigation Bottom Bar -->
        <div class="exam-navigation-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <button type="button" class="btn-secondary" id="btnExamPrevQ" ${session.currentQIndex === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;min-height:42px;"' : 'style="min-height:42px;"'}>
            ❮ Câu trước
          </button>
          
          <div class="exam-progress-counter" style="font-size:13.5px;color:var(--dim);text-align:center;">
            Đã làm: <strong>${answeredCount}</strong> / ${totalQ} câu
          </div>

          <button type="button" class="btn-secondary" id="btnExamNextQ" ${session.currentQIndex === totalQ - 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;min-height:42px;"' : 'style="min-height:42px;"'}>
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
    const questions = exam ? examManager.getExamQuestions(exam) : [];
    const isIntegrityBanned = Boolean(sub.integrityBan || (sub.userId && examManager.getExamViolationRecord(sub.examId, sub.userId).banned));

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
          <div style="background:${isIntegrityBanned ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'};border:2px solid ${isIntegrityBanned ? '#ef4444' : '#10b981'};border-radius:12px;padding:12px 24px;text-align:center;">
            <div style="font-size:12px;color:${isIntegrityBanned ? '#ef4444' : '#10b981'};font-weight:700;text-transform:uppercase;">
              ${isIntegrityBanned ? 'Vi Phạm Quy Chế (0đ)' : 'Kết Quả Chính Thức'}
            </div>
            <div style="font-size:28px;font-weight:900;color:${isIntegrityBanned ? '#ef4444' : '#10b981'};">${sub.score} <span style="font-size:16px;font-weight:normal;">/ 10 điểm</span></div>
            <div style="font-size:12.5px;color:${isIntegrityBanned ? '#ef4444' : 'var(--dim)'};margin-top:2px;">
              ${isIntegrityBanned ? 'Xử lý 0 điểm do vi phạm quy chế 3 lần' : `Đúng ${sub.correctCount}/${sub.totalQuestions} câu • ${Math.floor(sub.timeSpentSeconds / 60)}p ${sub.timeSpentSeconds % 60}s`}
            </div>
          </div>
        </div>

        ${!isAdmin ? `
          <!-- Student Result Notice: ONLY SCORE IS SHOWN, NO ANSWERS -->
          <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:12px;padding:32px 24px;text-align:center;margin-top:20px;">
            <div style="font-size:42px;margin-bottom:12px;">${isIntegrityBanned ? '🚫' : '🛡️'}</div>
            <h3 style="font-size:18px;font-weight:700;color:${isIntegrityBanned ? '#ef4444' : 'var(--text)'};margin:0 0 8px;">
              ${isIntegrityBanned ? 'Bài Thi Bị Xử Lý 0 Điểm Do Vi Phạm Quy Chế!' : 'Bài Thi Đã Được Nộp &amp; Chấm Điểm Thành Công!'}
            </h3>
            <p style="font-size:14px;color:var(--dim);max-width:540px;margin:0 auto 20px;line-height:1.6;">
              ${isIntegrityBanned
                ? 'Hệ thống ghi nhận bạn đã vi phạm quy chế thi cử quá 3 lần (thoát toàn màn hình hoặc chuyển tab/cửa sổ thi). Bài thi đã tự động nộp với mức điểm phạt là <strong>0 điểm</strong>.'
                : 'Theo quy chế khảo thí và bảo mật đề thi trực tuyến, hệ thống <strong>chỉ công bố điểm số chính thức và số câu đúng</strong>, không hiển thị lại bộ câu hỏi và đáp án chi tiết.'}
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
                        tag = '<span style="color:#10b981;font-weight:bold;margin-left:auto;flex-shrink:0;white-space:nowrap;padding-left:8px;">✓ Đáp án chuẩn</span>';
                      } else if (opt.id === userChoice) {
                        borderCol = '#ef4444';
                        bgCol = 'rgba(239,68,68,0.15)';
                        tag = '<span style="color:#ef4444;font-weight:bold;margin-left:auto;flex-shrink:0;white-space:nowrap;padding-left:8px;">✗ Lựa chọn của bạn</span>';
                      }

                      return `
                        <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-radius:6px;background:${bgCol};border:1px solid ${borderCol};font-size:13.5px;box-sizing:border-box;">
                          <span style="font-weight:700;width:24px;text-align:center;flex-shrink:0;margin-top:2px;">${displayLabel}.</span>
                          <span style="flex:1;min-width:0;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.5;">${opt.text}</span>
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
    const exam = this._getStudioPrintExam();

    const allStudents = authManager.getUsers().filter(u => u.role !== 'admin');
    const assignedExamsList = examManager.getExams();

    let currentPool = this.importedQuestions;
    if (this.selectedAssignFileId !== 'all') {
      const file = this.importedFiles.find(f => f.id === this.selectedAssignFileId);
      if (file && file.questions) {
        currentPool = file.questions;
      }
    }
    const currentPoolSize = currentPool.length;
    const currentCountDisplay = (this.selectedAssignCount === 'all' || !this.selectedAssignCount || isNaN(parseInt(this.selectedAssignCount, 10)))
      ? (currentPoolSize > 0 ? currentPoolSize : 0)
      : Math.min(parseInt(this.selectedAssignCount, 10), currentPoolSize);

    // Compute print pool & size for A4 Studio
    let printPool = this.importedQuestions;
    if (this.studioPrintSource && this.studioPrintSource !== 'all_word') {
      const pf = this.importedFiles.find(file => file.id === this.studioPrintSource);
      if (pf && pf.questions && pf.questions.length > 0) {
        printPool = pf.questions;
      }
    }
    const printPoolSize = printPool.length;
    const currentStudioCount = (this.studioConfig.count && !isNaN(parseInt(this.studioConfig.count, 10)) && parseInt(this.studioConfig.count, 10) > 0)
      ? Math.min(parseInt(this.studioConfig.count, 10), printPoolSize)
      : printPoolSize;

    const distSummary = this._getDistributedSummary();
    const defaultExamTitle = (this.studioAssignTitle !== null && this.studioAssignTitle !== undefined)
      ? this.studioAssignTitle
      : this._getNextExamTitle();

    return `
      <!-- Studio Subtab Navigation (3 Tabs) -->
      <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
        <button type="button" class="btn-tab ${(this.studioSubTab === 'distribute' || (this.studioSubTab !== 'publish' && this.studioSubTab !== 'print' && this.studioSubTab !== 'assign')) ? 'active' : ''}" id="tabStudioDistribute" style="padding:8px 18px;font-size:13.5px;font-weight:700;border-radius:6px;cursor:pointer;">
          📁 1. Nạp File Word Đề Thi
        </button>
        <button type="button" class="btn-tab ${(this.studioSubTab === 'publish' || this.studioSubTab === 'assign') ? 'active' : ''}" id="tabStudioPublish" style="padding:8px 18px;font-size:13.5px;font-weight:700;border-radius:6px;cursor:pointer;">
          🚀 2. Phân Phối &amp; Phát Đề Thi
        </button>
        <button type="button" class="btn-tab ${this.studioSubTab === 'print' ? 'active' : ''}" id="tabStudioPrint" style="padding:8px 18px;font-size:13.5px;font-weight:700;border-radius:6px;cursor:pointer;">
          🖨️ 3. Soạn Đề In Ấn Chuẩn A4 &amp; Xuất LaTeX
        </button>
      </div>

      <!-- SECTION A: ASSIGN / DISTRIBUTE & PUBLISH WRAPPER -->
      <div id="studioAssignSection" style="display:${this.studioSubTab === 'print' ? 'none' : 'block'};">
        
        <!-- SUB-TAB 1: NẠP FILE WORD ĐỀ THI -->
        <div id="studioDistributeSection" style="display:${(this.studioSubTab === 'distribute' || (this.studioSubTab !== 'publish' && this.studioSubTab !== 'print' && this.studioSubTab !== 'assign')) ? 'block' : 'none'};">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">

            <!-- Action Toolbar: Download Sample & Clear Data -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:12px 16px;">
              <div>
                <button type="button" class="btn-primary" id="btnDownloadSampleWord" style="font-size:12.5px;padding:7px 16px;border-radius:6px;background:#2563eb;border-color:#2563eb;color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  <span>📥</span>
                  <span>Tải File Mẫu Word Chuẩn (.doc)</span>
                </button>
              </div>

              <div>
                <button type="button" class="btn-sm" id="btnClearAllWordData" style="font-size:12px;padding:6px 14px;border-radius:6px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-weight:700;cursor:pointer;" title="Xóa toàn bộ câu hỏi Word đã lưu để bắt đầu đề mới">
                  🗑️ Xóa Hết Dữ Liệu Đề Thi Cũ (Word)
                </button>
              </div>
            </div>

            <!-- WORD IMPORT BOX -->
            <div id="importExamBox" style="background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:18px;">
              <!-- File Upload Zone -->
              <div style="border:2px dashed var(--line);border-radius:8px;padding:22px;text-align:center;background:var(--panel);margin-bottom:14px;">
                <div style="font-size:32px;margin-bottom:6px;">📄</div>
                <div style="font-weight:700;font-size:13.5px;color:var(--text);margin-bottom:4px;">
                  Chọn hoặc kéo thả File Word đề thi (.docx, .doc, .txt)
                </div>
                <div style="font-size:12px;color:var(--dim);margin-bottom:12px;">
                  File mới tải lên sẽ được <strong>tự động lưu và giữ lại</strong> nối tiếp với các file trước đó. Không cho phép nạp trùng file.
                </div>
                <input type="file" id="fileImportWord" accept=".docx,.doc,.txt" style="font-size:12.5px;color:var(--text);cursor:pointer;" />
              </div>

              <!-- VALIDATION ERRORS -->
              ${this.importErrors.length > 0 ? `
                <div style="margin-bottom:14px;padding:12px 16px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;">
                  <div style="font-weight:700;color:#ef4444;font-size:13px;margin-bottom:6px;">
                    ⚠️ Phát hiện ${this.importErrors.length} lỗi cú pháp cần điều chỉnh:
                  </div>
                  <ul style="margin:0;padding-left:20px;font-size:12px;color:#ef4444;line-height:1.6;">
                    ${this.importErrors.map(err => `<li>${this._escapeHtml(err)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              <!-- COMPACT IMPORT STATUS BADGE -->
              ${this.importedQuestions.length > 0 ? `
                <div style="padding:14px 18px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                  <div style="font-weight:700;color:#10b981;font-size:14px;display:flex;align-items:center;gap:8px;">
                    <span>✅ Đã nạp thành công: ${this.importedQuestions.length} câu hỏi tự soạn!</span>
                    <span style="font-size:11px;background:#10b981;color:#fff;padding:2px 8px;border-radius:10px;font-weight:700;">Đã Có Đáp Án Đúng • Sẵn Sàng Phát Đề</span>
                  </div>
                  <div style="font-size:12px;color:var(--dim);">
                    ${this.importedFiles.length} file đề thi đang lưu trữ trên hệ thống
                  </div>
                </div>

                <!-- TABLE OF IMPORTED FILES -->
                <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-top:14px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                    <h4 style="margin:0;font-size:13.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                      <span>📂 Danh Sách Các File Đã Nạp (${this.importedFiles.length})</span>
                    </h4>
                    <span style="font-size:12px;color:#10b981;font-weight:600;">
                      Tổng cộng: ${this.importedQuestions.length} câu hỏi tự soạn
                    </span>
                  </div>

                  <div style="overflow-x:auto;">
                    <table class="leaderboard-table" style="font-size:12.5px;margin:0;">
                      <thead>
                        <tr>
                          <th style="text-align:left;">Tên file đề thi</th>
                          <th style="text-align:center;">Số câu hỏi</th>
                          <th style="text-align:center;">Thời điểm nạp</th>
                          <th style="text-align:right;">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.importedFiles.map(f => `
                          <tr>
                            <td style="font-weight:600;color:var(--text);">
                              📄 ${this._escapeHtml(f.name)}
                            </td>
                            <td style="text-align:center;">
                              <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:6px;font-weight:700;">
                                ${f.questionCount} câu
                              </span>
                            </td>
                            <td style="text-align:center;color:var(--dim);font-size:11.5px;">
                              ${new Date(f.uploadedAt).toLocaleString('vi-VN')}
                            </td>
                            <td style="text-align:right;">
                              <button type="button" class="btn-sm btn-delete-imported-file" data-file-id="${f.id}" data-file-name="${this._escapeHtml(f.name)}" style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                                🗑️ Xóa file này
                              </button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : `
                <div style="text-align:center;padding:20px 16px;background:var(--panel);border:1px dashed var(--line);border-radius:8px;">
                  <div style="font-size:24px;margin-bottom:4px;">📂</div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;">Chưa có câu hỏi tự soạn nào</div>
                  <div style="font-size:12px;color:var(--dim);">
                    Vui lòng tải file mẫu Word về soạn câu hỏi, sau đó tải file lên để bắt đầu phân phối và phát đề.
                  </div>
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- SUB-TAB 2: PHÂN PHỐI & PHÁT ĐỀ THI CHO SINH VIÊN (DEDICATED PUBLISH TAB) -->
        <div id="studioPublishSection" style="display:${(this.studioSubTab === 'publish' || this.studioSubTab === 'assign') ? 'block' : 'none'};">
          <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">

            <!-- DEDICATED SECTION: MULTI-FILE QUESTION DISTRIBUTION -->
            <div id="sectionMultiFileDistribution" style="background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
                <div>
                  <div style="font-size:14.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;">
                    <span>🎯 Phân Phối Số Lượng Câu Hỏi Cho Từng Bộ Đề:</span>
                    <span class="pill-badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;font-size:11px;padding:2px 8px;border-radius:10px;">Có thể chọn ví dụ 10 câu bộ này, 10 câu bộ khác</span>
                  </div>
                  <p style="font-size:12.5px;color:var(--dim);margin:3px 0 0;">
                    Nhập số câu muốn bốc từ mỗi file bên dưới. Hệ thống sẽ bốc ngẫu nhiên số lượng câu tương ứng từ từng file để tổng hợp thành đề thi.
                  </p>
                </div>
              </div>

              ${this.importedFiles.length === 0 ? `
                <div style="text-align:center;padding:24px;background:var(--panel);border:1px dashed var(--line);border-radius:8px;">
                  <div style="font-size:13px;color:var(--dim);">Chưa có bộ file Word nào được nạp. Vui lòng chuyển sang <strong>Tab 1 (Nạp File Word Đề Thi)</strong> để tải lên ít nhất 1 file Word trước khi phân phối!</div>
                </div>
              ` : `
                <div style="overflow-x:auto;background:var(--panel);border:1px solid var(--line);border-radius:8px;margin-bottom:14px;">
                  <table class="leaderboard-table" style="font-size:13px;margin:0;">
                    <thead>
                      <tr>
                        <th style="text-align:left;">Bộ Đề / Tên File Word</th>
                        <th style="text-align:center;width:120px;">Sẵn có</th>
                        <th style="text-align:center;width:160px;">Số câu chọn bốc</th>
                        <th style="text-align:left;">Thao tác nhanh</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.importedFiles.map(f => {
                        const fileCount = f.questionCount || (f.questions ? f.questions.length : 0);
                        const selectedCount = this.fileDistributions[f.id] !== undefined
                          ? Math.min(Math.max(0, this.fileDistributions[f.id]), fileCount)
                          : fileCount;
                        return `
                          <tr>
                            <td style="font-weight:600;color:var(--text);">
                              📄 ${this._escapeHtml(f.name)}
                            </td>
                            <td style="text-align:center;">
                              <span class="pill-badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;padding:2px 8px;border-radius:6px;font-weight:700;">
                                ${fileCount} câu
                              </span>
                            </td>
                            <td style="text-align:center;">
                              <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                                <input type="number" min="0" max="${fileCount}" value="${selectedCount}"
                                  class="form-input input-distribute-file-count"
                                  data-file-id="${f.id}"
                                  style="width:75px;padding:6px;text-align:center;font-size:13.5px;font-weight:700;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);" />
                                <span style="font-size:12px;color:var(--dim);font-weight:600;">/ ${fileCount}</span>
                              </div>
                            </td>
                            <td>
                              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                ${fileCount >= 5 ? `<button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="5" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">5 câu</button>` : ''}
                                ${fileCount >= 10 ? `<button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="10" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:700;">10 câu</button>` : ''}
                                ${fileCount >= 15 ? `<button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="15" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);">15 câu</button>` : ''}
                                ${fileCount >= 20 ? `<button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="20" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:700;">20 câu</button>` : ''}
                                <button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="${fileCount}" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:rgba(16,185,129,0.12);color:#10b981;font-weight:700;border:1px solid rgba(16,185,129,0.3);">Tất cả</button>
                                <button type="button" class="btn-sm btn-quick-dist" data-file-id="${f.id}" data-count="0" style="padding:2px 8px;font-size:11px;border-radius:4px;cursor:pointer;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">0 câu</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Distribution Summary & Quick Actions -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:8px;">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="btn-sm" id="btnDistributeAll" style="font-size:12px;padding:5px 12px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;font-weight:600;">
                      ⚡ Chọn tất cả câu hỏi
                    </button>
                    <button type="button" class="btn-sm" id="btnDistributeEven10" style="font-size:12px;padding:5px 12px;cursor:pointer;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);border-radius:6px;font-weight:600;">
                      🎲 Bốc đều mỗi bộ 10 câu
                    </button>
                    <button type="button" class="btn-sm" id="btnDistributeClear" style="font-size:12px;padding:5px 12px;cursor:pointer;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-weight:600;">
                      🧹 Bỏ chọn tất cả (về 0)
                    </button>
                  </div>

                  <div style="font-weight:700;color:#10b981;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                    <span>🎯 Đã chọn: ${distSummary.totalSelected} / ${distSummary.totalAvailable} câu</span>
                  </div>
                </div>
              `}
            </div>

            <!-- Distribution Info Banner (No jump-back buttons) -->
            ${distSummary.totalSelected === 0 ? `
              <div style="padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:18px;text-align:center;">
                <div style="font-size:13.5px;font-weight:700;color:#ef4444;margin-bottom:4px;">⚠️ Chưa có câu hỏi nào được chọn để phát đề!</div>
                <div style="font-size:12.5px;color:var(--dim);">Vui lòng nhập số câu hoặc bấm các nút chọn nhanh (ví dụ: 10 câu, Tất cả) ở bảng phân phối ngay phía trên.</div>
              </div>
            ` : `
              <div style="padding:14px 18px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;margin-bottom:18px;">
                <div style="font-weight:700;color:#2563eb;font-size:13.5px;margin-bottom:6px;">
                  🎯 Đang cấu hình phát đề gồm ${distSummary.totalSelected} câu hỏi tổng hợp từ ${distSummary.breakdown.length} bộ đề:
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${distSummary.breakdown.map(b => `
                    <span class="pill-badge" style="background:var(--panel);border:1px solid var(--line);color:var(--text);font-size:11.5px;padding:3px 8px;border-radius:6px;font-weight:600;">
                      📄 ${this._escapeHtml(b.fileName)}: <strong style="color:#2563eb;">${b.selectedCount}</strong> câu
                    </span>
                  `).join('')}
                </div>
              </div>
            `}

            <!-- CONFIGURATION BAR -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-bottom:16px;">
              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Tiêu đề đề thi: *</label>
                <input type="text" id="txtAssignTitle" class="form-input" placeholder="Ví dụ: Đề 1, Đề 2, ..." value="${this._escapeHtml(defaultExamTitle)}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;font-weight:600;" />
              </div>

              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Thời gian làm bài (phút): *</label>
                <input type="number" id="numAssignDuration" min="1" max="180" value="${distSummary.totalSelected > 0 ? Math.max(15, Math.round(distSummary.totalSelected * 1.5)) : 15}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;" />
              </div>

              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Mã đề thi (Exam Code):</label>
                <input type="text" id="txtAssignExamCode" class="form-input" placeholder="Ví dụ: TRR-101" value="TRR-${Math.floor(100 + Math.random() * 900)}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;font-family:monospace;font-weight:700;" />
              </div>
            </div>

            <!-- SHUFFLE CONFIGURATION -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;margin-bottom:18px;">
              <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;background:var(--panel-alt);border:1px solid var(--line);cursor:pointer;">
                <input type="checkbox" id="chkShuffleQuestions" checked style="margin-top:3px;cursor:pointer;" />
                <div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                    <span>🔀 Xáo trộn thứ tự CÂU HỎI</span>
                  </div>
                  <div style="font-size:11.5px;color:var(--dim);margin-top:2px;line-height:1.4;">
                    Đổi vị trí thứ tự câu (Câu 1, 2, 3...) — Mỗi sinh viên sẽ nhận các câu hỏi theo thứ tự ngẫu nhiên khác nhau.
                  </div>
                </div>
              </label>

              <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;background:var(--panel-alt);border:1px solid var(--line);cursor:pointer;">
                <input type="checkbox" id="chkShuffleOptions" checked style="margin-top:3px;cursor:pointer;" />
                <div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                    <span>🔀 Xáo trộn thứ tự ĐÁP ÁN (A, B, C, D)</span>
                  </div>
                  <div style="font-size:11.5px;color:var(--dim);margin-top:2px;line-height:1.4;">
                    Đổi vị trí 4 phương án trong từng câu — Đáp án đúng sẽ nằm ngẫu nhiên ở vị trí A, B, C hoặc D.
                  </div>
                </div>
              </label>
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

            <!-- Preview Questions Accordion -->
            ${distSummary.totalSelected > 0 ? `
              <details style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:18px;">
                <summary style="font-size:13px;font-weight:700;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:6px;">
                  <span>👁️ Xem trước câu hỏi sẽ phát (${distSummary.totalSelected} câu)</span>
                </summary>
                <div style="margin-top:12px;font-size:12.5px;color:var(--text);display:flex;flex-direction:column;gap:8px;">
                  ${this._getSelectedDistributedQuestions().slice(0, 5).map((q, idx) => `
                    <div style="background:var(--panel);padding:8px 12px;border-radius:6px;border:1px solid var(--line);">
                      <div style="font-weight:600;margin-bottom:4px;">Câu ${idx + 1}: ${this._escapeHtml(q.question)}</div>
                      <div style="font-size:11.5px;color:#10b981;">✓ Đáp án: ${q.correctId || 'A'}</div>
                    </div>
                  `).join('')}
                  ${distSummary.totalSelected > 5 ? `<div style="text-align:center;font-size:12px;color:var(--dim);">... và còn ${distSummary.totalSelected - 5} câu hỏi khác được phân phối từ các bộ đề.</div>` : ''}
                </div>
              </details>
            ` : ''}

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div style="font-size:12.5px;color:var(--dim);">
                ${distSummary.totalSelected > 0
                  ? `<span style="color:#10b981;font-weight:700;">✅ Sẵn sàng phát đề với ${distSummary.totalSelected} câu hỏi tự soạn đã phân phối.</span>`
                  : '⚠️ Vui lòng phân phối câu hỏi ở tab Phân Phối Đề trước khi phát.'}
              </div>
              <button type="button" class="btn-primary" id="btnCreateAndAssignExam" style="padding:10px 24px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;cursor:pointer;">
                <span>🚀 Phát Đề Cho Sinh Viên &amp; Xuất File Đáp Án</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- SECTION B: A4 PRINT & LATEX EXPORTER (PRESERVED) -->
      <div id="studioPrintSection" style="display:${this.studioSubTab === 'print' ? 'block' : 'none'};">
        
        ${(!exam || !exam.questions || exam.questions.length === 0) ? `
          <div style="text-align:center;padding:50px 24px;background:var(--panel);border:1px dashed var(--line);border-radius:12px;margin:24px auto;max-width:680px;">
            <div style="font-size:42px;margin-bottom:12px;">📂</div>
            <h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0 0 8px;">Chưa Có Câu Hỏi Tự Soạn Nào Để In Ấn</h3>
            <p style="font-size:13px;color:var(--dim);margin:0 0 22px;line-height:1.6;">
              Hệ thống đã loại bỏ toàn bộ ngân hàng câu hỏi mẫu mặc định. Chức năng in ấn và xuất LaTeX chỉ nhận đề từ file Word bạn đã tải lên.
            </p>
            <button type="button" class="btn-primary" id="btnSwitchToAssignTabFromPrint" style="padding:10px 24px;font-size:13.5px;font-weight:700;cursor:pointer;">
              📋 Chuyển Sang Tab Nạp File Word
            </button>
          </div>
        ` : `
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

            <!-- Configuration Bar: Nguồn đề + Số lượng câu (chọn thoải mái) -->
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="color:var(--dim);font-weight:600;">Nguồn đề:</span>
                <select id="selStudioPrintSource" class="form-input" style="padding:5px 10px;font-size:12.5px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:600;">
                  <option value="all_word" ${this.studioPrintSource === 'all_word' || !this.studioPrintSource ? 'selected' : ''}>
                    📂 Tất cả câu hỏi Word (${this.importedQuestions.length} câu)
                  </option>
                  ${distSummary.totalSelected > 0 ? `
                    <option value="distributed" ${this.studioPrintSource === 'distributed' ? 'selected' : ''}>
                      🎯 Bộ câu hỏi đã phân phối (${distSummary.totalSelected} câu: ${distSummary.breakdown.map(b => `${b.fileName} [${b.selectedCount}]`).join(', ')})
                    </option>
                  ` : ''}
                  ${this.importedFiles.map(f => `
                    <option value="${f.id}" ${this.studioPrintSource === f.id ? 'selected' : ''}>
                      📄 File: ${this._escapeHtml(f.name)} (${f.questionCount} câu)
                    </option>
                  `).join('')}
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="color:var(--dim);font-weight:600;">Số lượng câu:</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="number" id="numStudioCount" class="form-input" min="1" max="${printPoolSize || 1}"
                    value="${currentStudioCount}"
                    placeholder="Số câu (1 - ${printPoolSize})"
                    style="width:80px;padding:5px 8px;font-size:13px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:700;text-align:center;" />
                  <span style="font-size:12px;color:var(--dim);font-weight:600;">/ ${printPoolSize} câu</span>
                </div>
                <select id="selStudioCount" class="form-input" style="padding:5px 8px;font-size:12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:600;">
                  <option value="all" ${currentStudioCount === printPoolSize ? 'selected' : ''}>Tất cả (${printPoolSize} câu)</option>
                  ${[5, 10, 15, 20, 25, 30, 40, 50].filter(n => n < printPoolSize).map(n => `
                    <option value="${n}" ${currentStudioCount === n ? 'selected' : ''}>${n} câu</option>
                  `).join('')}
                  ${![5, 10, 15, 20, 25, 30, 40, 50, printPoolSize].includes(currentStudioCount) && currentStudioCount > 0 ? `
                    <option value="${currentStudioCount}" selected>Tuỳ chỉnh: ${currentStudioCount} câu</option>
                  ` : ''}
                </select>
              </div>

              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto;color:var(--text);font-size:12.5px;">
                <input type="checkbox" id="chkShowSolutions" ${this.showTeacherSolutions ? 'checked' : ''} />
                <span>Hiện hướng dẫn giải chi tiết cho Quản trị viên</span>
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
        `}
      </div>
    `;
  }

  // =========================================================================
  // SUB-VIEW 4B: GRADEBOOK MODAL FOR TEACHER
  // =========================================================================

  _renderGradebookModal() {
    const exam = examManager.getExamById(this.gradebookExamId);
    if (!exam) {
      return `
        <div class="gradebook-modal-backdrop" id="gradebookModalBackdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
          <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:500px;padding:24px;text-align:center;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0 0 8px;">⚠️ Không tìm thấy đề thi</h3>
            <p style="color:var(--dim);font-size:13px;margin:0 0 20px;">Đề thi này không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
            <button type="button" class="btn-primary" id="btnCloseGradebook" style="padding:8px 20px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;">✕ Đóng</button>
          </div>
        </div>
      `;
    }

    const submissions = examManager.getSubmissionsForExam(this.gradebookExamId);
    const avgScore = submissions.length > 0 
      ? Math.round((submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length) * 10) / 10 
      : 0;

    return `
      <div class="gradebook-modal-backdrop" id="gradebookModalBackdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:960px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;">
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
                      <td style="text-align:right;font-weight:800;color:${sub.integrityBan || sub.score === 0 ? '#ef4444' : 'var(--brand)'};font-size:15px;">
                        ${sub.score} / 10 ${sub.integrityBan || (sub.userId && examManager.getExamViolationRecord(sub.examId, sub.userId).banned) ? '<span class="pill-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;font-size:10.5px;padding:2px 6px;margin-left:4px;border-radius:6px;">Vi phạm 3 lần (0đ)</span>' : ''}
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

  // =========================================================================
  // SUB-VIEW 4C: ADMIN ANSWER KEY & DETAILED SOLUTIONS MODAL
  // =========================================================================

  _renderAdminAnswerKeyModal() {
    const exam = examManager.getExamById(this.adminAnswerKeyExamId);
    if (!exam) {
      return `
        <div class="gradebook-modal-backdrop" id="adminAnswerKeyBackdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
          <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:500px;padding:24px;text-align:center;">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0 0 8px;">⚠️ Không tìm thấy đề thi</h3>
            <p style="color:var(--dim);font-size:13px;margin:0 0 20px;">Đề thi này không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
            <button type="button" class="btn-primary" id="btnCloseAdminAnswerKey" style="padding:8px 20px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;">✕ Đóng</button>
          </div>
        </div>
      `;
    }

    let questions = examManager.getExamQuestions(exam);
    if (questions.length === 0 && this.importedQuestions && this.importedQuestions.length > 0) {
      const importedMap = new Map(this.importedQuestions.map(q => [q.id, q]));
      const resolved = (exam.questionIds || []).map(id => importedMap.get(id)).filter(Boolean);
      if (resolved.length > 0) {
        questions = resolved;
      }
    }

    return `
      <div class="gradebook-modal-backdrop" id="adminAnswerKeyBackdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:960px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;">
          
          <!-- Modal Header -->
          <div style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:var(--panel-alt);">
            <div>
              <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;display:flex;align-items:center;gap:6px;">
                <span>🔑 HỒ SƠ ĐÁP ÁN &amp; BAREM CHẤM DÀNH CHO ADMIN</span>
                <span class="pill-badge" style="background:#10b981;color:#fff;font-size:11px;padding:1px 8px;border-radius:10px;">Bảo Mật Giáo Viên</span>
              </div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:3px 0 0;">
                ${this._escapeHtml(exam.title)} • Mã đề: <span style="color:var(--accent);">${this._escapeHtml(exam.examCode || exam.id)}</span>
              </h3>
            </div>
            
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" class="btn-sm" id="btnCloseAdminAnswerKey" style="padding:6px 14px;font-size:13px;border-radius:6px;cursor:pointer;">
                ✕ Đóng
              </button>
            </div>
          </div>

          <!-- Meta & Action Toolbar -->
          <div style="padding:14px 24px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:12.5px;">
              <div><span style="color:var(--dim);">Thời lượng:</span> <strong style="color:var(--text);">${exam.durationMinutes} phút</strong></div>
              <div><span style="color:var(--dim);">Tổng số câu:</span> <strong style="color:var(--text);">${questions.length} câu</strong></div>
              <div><span style="color:var(--dim);">Thang điểm:</span> <strong style="color:#10b981;">10 điểm</strong></div>
              <div><span style="color:var(--dim);">Ngày tạo:</span> <strong style="color:var(--text);">${new Date(exam.createdAt).toLocaleDateString('vi-VN')}</strong></div>
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn-primary" id="btnDownloadAnswerKeyCsv" style="background:#10b981;border-color:#10b981;color:#fff;padding:6px 14px;font-size:12.5px;font-weight:700;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                📥 Tải File Excel (.csv) Đáp Án
              </button>
              <button type="button" class="btn-secondary" id="btnCopyAnswerKeyString" style="padding:6px 14px;font-size:12.5px;font-weight:700;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                📋 Sao Chép Bảng Đáp Án
              </button>
              <button type="button" class="btn-secondary" id="btnPrintAnswerKeyA4" style="padding:6px 14px;font-size:12.5px;font-weight:700;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                🖨️ In A4 Barem
              </button>
            </div>
          </div>

          <!-- Modal Scrollable Content -->
          <div style="padding:22px 24px;overflow-y:auto;flex:1;">
            
            <!-- SECTION 1: QUICK ANSWER MATRIX KEY -->
            <div style="margin-bottom:24px;background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:16px;">
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <span>🎯 Bảng Tra Nhanh Đáp Án (Mã Đề: ${this._escapeHtml(exam.examCode || exam.id)})</span>
                <span style="font-size:11px;color:var(--dim);font-weight:normal;">(Dành cho cán bộ chấm thi đối chiếu nhanh)</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(85px, 1fr));gap:8px;">
                ${questions.map((q, idx) => `
                  <div style="background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 6px;text-align:center;">
                    <div style="font-size:11px;color:var(--dim);font-weight:600;">Câu ${idx + 1}</div>
                    <div style="font-size:18px;font-weight:900;color:#10b981;margin-top:2px;">[ ${q.correctId} ]</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- SECTION 2: DETAILED SOLUTIONS -->
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;margin-bottom:14px;">
                📖 Hướng Dẫn Chấm &amp; Lời Giải Chi Tiết Từng Câu (${questions.length} Câu):
              </div>
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${questions.map((q, idx) => `
                  <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
                      <div style="font-size:13.5px;font-weight:700;color:var(--text);line-height:1.5;">
                        Câu ${idx + 1}: ${this._escapeHtml(q.question)}
                      </div>
                      <span style="background:#10b981;color:#fff;font-size:12px;font-weight:800;padding:2px 10px;border-radius:6px;white-space:nowrap;">
                        Đ/A: ${q.correctId}
                      </span>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:8px;margin-bottom:12px;">
                      ${(q.options || []).map(opt => {
                        const isCorrect = opt.id === q.correctId;
                        return `
                          <div style="padding:8px 12px;border-radius:6px;background:${isCorrect ? 'rgba(16,185,129,0.15)' : 'var(--panel)'};border:1px solid ${isCorrect ? '#10b981' : 'var(--line)'};font-size:12.5px;color:var(--text);">
                            <strong style="${isCorrect ? 'color:#10b981;' : ''}">${opt.id}.</strong> ${this._escapeHtml(opt.text)} ${isCorrect ? '<span style="color:#10b981;font-weight:700;margin-left:4px;">✓ [Đáp án đúng]</span>' : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>

                    <div style="background:rgba(56,189,248,0.08);border-left:3px solid #38bdf8;padding:8px 12px;border-radius:4px;font-size:12px;color:var(--text);line-height:1.5;">
                      <strong>💡 Lời giải chi tiết:</strong> ${this._escapeHtml(q.explanation || 'Không có lời giải chi tiết.')}
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

  /**
   * Exports an exam's answer key and detailed solutions to Excel CSV.
   * @param {string} examId
   */
  _exportAdminAnswerKeyToCsv(examId) {
    const exam = examManager.getExamById(examId);
    if (!exam) return;
    const questions = examManager.getExamQuestions(exam);
    if (questions.length === 0) {
      this._showAlert('Không tìm thấy danh sách câu hỏi để xuất file đáp án!');
      return;
    }

    let csv = '\uFEFF"Câu","Đáp án đúng","Nội dung câu hỏi","Phương án A","Phương án B","Phương án C","Phương án D","Lời giải chi tiết"\r\n';

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const key = q.correctId || '';
      const qText = (q.question || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const optA = (q.options?.find(o => o.id === 'A')?.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const optB = (q.options?.find(o => o.id === 'B')?.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const optC = (q.options?.find(o => o.id === 'C')?.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const optD = (q.options?.find(o => o.id === 'D')?.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const exp = (q.explanation || '').replace(/"/g, '""').replace(/\n/g, ' ');

      csv += `"${qNum}","${key}","${qText}","${optA}","${optB}","${optC}","${optD}","${exp}"\r\n`;
    });

    const safeTitle = (exam.title || 'De_Thi').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    const fileName = `Dap_An_${safeTitle}_${exam.examCode || exam.id}.csv`;
    this._downloadFile(csv, fileName, 'text/csv;charset=utf-8;');
  }

  /**
   * Helper to download files to user's computer.
   */
  _downloadFile(content, fileName, mimeType = 'text/plain;charset=utf-8;') {
    if (typeof document === 'undefined') return;
    try {
      const blob = new Blob([content], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      console.error('[QuizView] Download file error:', err);
    }
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
      if (s.integrityBan || (s.userId && examManager.getExamViolationRecord(s.examId, s.userId).banned)) {
        rating = 'Vi phạm quy chế (0đ)';
      } else if (s.score >= 9.0) rating = 'Xuất sắc';
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
      ? window.confirm(`Bắt đầu làm đề thi: "${exam.title}"?\n\nLưu ý quan trọng:\n- Mỗi thí sinh chỉ có duy nhất 1 lượt làm.\n- Màn hình sẽ tự động khóa khi vào thi, VI PHẠM 3 lần sẽ bị 0đ (thoát toàn màn hình hoặc rời cửa sổ thi sẽ tính là VI PHẠM).\n- Thời gian làm bài: ${exam.durationMinutes} phút.\n- Đồng hồ đếm ngược sẽ bắt đầu ngay bây giờ!\n\nBạn đã sẵn sàng chưa?`)
      : true;

    if (!confirmStart) return;

    // Resolve questions (checking both built-in question bank and custom imported questions)
    const allQuestions = getAllQuestions();
    const customQuestions = Array.isArray(exam.customQuestions) ? exam.customQuestions : [];
    const questionPool = [...allQuestions, ...customQuestions];
    let questions = exam.questionIds.map(id => questionPool.find(q => q.id === id)).filter(Boolean);
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
    const isMobile = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));

    // Grace period ngẫu nhiên 3–5 giây, chỉ tính tối đa 1 vi phạm mỗi lần ẩn tab
    const GRACE_MIN_MS = 3000;
    const GRACE_MAX_MS = 5000;
    const _randomGrace = () => Math.floor(Math.random() * (GRACE_MAX_MS - GRACE_MIN_MS + 1)) + GRACE_MIN_MS;

    this._examLockdownHandlers = {
      fullscreenchange: () => {
        // Trên mobile không dùng fullscreen API
        if (isMobile) return;
        const session = this.activeExamSession;
        if (!session) return;
        const isFullscreen = document.fullscreenElement === document.documentElement;
        if (isFullscreen) {
          session.fullscreenActive = true;
          // Hủy grace timer nếu người dùng quay lại kịp
          if (this._desktopGraceTimer) {
            clearTimeout(this._desktopGraceTimer);
            this._desktopGraceTimer = null;
          }
          session._graceViolationIssued = false; // Reset để lần sau có thể tính
          if (session.lockdownPending) {
            this._cancelExamLockdownCountdown(session);
            session.lockdownPending = false;
            session.lockdownWarning = false;
            this.render();
          }
        } else if (session.fullscreenActive) {
          session.fullscreenActive = false;
          // Desktop grace period 3-5 giây trước khi phạt, chỉ 1 lần/phiên
          if (this._desktopGraceTimer) clearTimeout(this._desktopGraceTimer);
          if (!session._graceViolationIssued) {
            this._desktopGraceTimer = setTimeout(() => {
              this._desktopGraceTimer = null;
              if (document.fullscreenElement !== document.documentElement && !session._graceViolationIssued) {
                session._graceViolationIssued = true;
                this._recordExamLockdownViolation();
              }
            }, _randomGrace());
          }
        }
      },
      visibilitychange: () => {
        if (document.visibilityState === 'hidden') {
          if (isMobile) {
            // Mobile: grace period 3-5 giây, chỉ 1 vi phạm mỗi phiên ẩn tab
            if (this._mobileVisibilityTimer) clearTimeout(this._mobileVisibilityTimer);
            if (this._mobileViolationIssued) return;
            this._mobileVisibilityTimer = setTimeout(() => {
              this._mobileVisibilityTimer = null;
              if (document.visibilityState === 'hidden' && !this._mobileViolationIssued) {
                this._mobileViolationIssued = true;
                this._recordExamLockdownViolation();
              }
            }, _randomGrace());
          }
          // Desktop: không phạt qua visibilitychange (đã xử lý qua fullscreenchange)
        } else if (document.visibilityState === 'visible') {
          // Người dùng quay lại → reset tất cả grace timer và cờ vi phạm phiên nền
          if (isMobile) {
            if (this._mobileVisibilityTimer) {
              clearTimeout(this._mobileVisibilityTimer);
              this._mobileVisibilityTimer = null;
            }
            this._mobileViolationIssued = false;
          } else {
            if (this._desktopGraceTimer) {
              clearTimeout(this._desktopGraceTimer);
              this._desktopGraceTimer = null;
            }
            if (this.activeExamSession) {
              this.activeExamSession._graceViolationIssued = false;
            }
          }
        }
      },
    };
    document.addEventListener('fullscreenchange', this._examLockdownHandlers.fullscreenchange);
    document.addEventListener('visibilitychange', this._examLockdownHandlers.visibilitychange);
  }

  _detachExamLockdownListeners() {
    if (this._mobileVisibilityTimer) {
      clearTimeout(this._mobileVisibilityTimer);
      this._mobileVisibilityTimer = null;
    }
    if (this._desktopGraceTimer) {
      clearTimeout(this._desktopGraceTimer);
      this._desktopGraceTimer = null;
    }
    this._mobileViolationIssued = false;
    if (this.activeExamSession) {
      this.activeExamSession._graceViolationIssued = false;
    }
    if (typeof document !== 'undefined' && this._examLockdownHandlers) {
      document.removeEventListener('fullscreenchange', this._examLockdownHandlers.fullscreenchange);
      document.removeEventListener('visibilitychange', this._examLockdownHandlers.visibilitychange);
    }
    this._examLockdownHandlers = null;
  }

  _requestExamFullscreen({ preserveLockdownState = false } = {}) {
    const isMobile = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
    if (isMobile) {
      const session = this.activeExamSession;
      if (session) {
        session.fullscreenActive = true;
        session.lockdownPending = false;
      }
      return;
    }
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
    session.lockdownCountdown = 35; // Tăng lên 35 giây để thí sinh kịp quay lại
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
        ? `🚫 Bạn đã bị xử lý 0 ĐIỂM và cấm thi lại đề này do VI PHẠM quy chế 3 lần.\n\nĐiểm số: 0 / 10 điểm`
        : `🎉 Bạn đã nộp bài thi thành công!\n\nĐiểm số: ${result.submission.score} / 10 điểm\nSố câu đúng: ${result.submission.correctCount} / ${result.submission.totalQuestions}\n\nKết quả đã được ghi nhận vào Bảng Xếp Hạng chính thức!`);
      this.reviewSubmission = result.submission;
    } else {
      this._showAlert(integrityBan
        ? `Bạn đã bị xử lý 0 điểm và cấm thi lại đề này do VI PHẠM quy chế 3 lần. ${result.error || ''}`
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

    const btnSwitchLocked = this.container.querySelector('#btnSwitchToMyExamsFromLockedPractice');
    if (btnSwitchLocked) {
      btnSwitchLocked.addEventListener('click', () => {
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

    // 4. Teacher's Studio Events (3 Subtabs: distribute | publish | print)
    const tabStudioDistribute = this.container.querySelector('#tabStudioDistribute');
    const tabStudioPublish = this.container.querySelector('#tabStudioPublish');
    const tabStudioPrint = this.container.querySelector('#tabStudioPrint');
    const tabStudioAssign = this.container.querySelector('#tabStudioAssign');

    if (tabStudioDistribute) {
      tabStudioDistribute.addEventListener('click', () => {
        this.studioSubTab = 'distribute';
        this.render();
      });
    }

    if (tabStudioPublish) {
      tabStudioPublish.addEventListener('click', () => {
        this.studioSubTab = 'publish';
        this.render();
      });
    }

    if (tabStudioPrint) {
      tabStudioPrint.addEventListener('click', () => {
        this.studioSubTab = 'print';
        this.render();
      });
    }

    if (tabStudioAssign) {
      tabStudioAssign.addEventListener('click', () => {
        this.studioSubTab = 'assign';
        this.render();
      });
    }

    // Navigation shortcuts between Studio subtabs
    const btnProceedToPublish = this.container.querySelector('#btnProceedToPublish');
    if (btnProceedToPublish) {
      btnProceedToPublish.addEventListener('click', () => {
        this.studioSubTab = 'publish';
        this.render();
      });
    }

    const btnBackToDistribute = this.container.querySelector('#btnBackToDistribute');
    if (btnBackToDistribute) {
      btnBackToDistribute.addEventListener('click', () => {
        this.studioSubTab = 'distribute';
        this.render();
      });
    }

    const btnBackToDistributeEmpty = this.container.querySelector('#btnBackToDistributeEmpty');
    if (btnBackToDistributeEmpty) {
      btnBackToDistributeEmpty.addEventListener('click', () => {
        this.studioSubTab = 'distribute';
        this.render();
      });
    }

    const btnModifyDistFromPublish = this.container.querySelector('#btnModifyDistFromPublish');
    if (btnModifyDistFromPublish) {
      btnModifyDistFromPublish.addEventListener('click', () => {
        this.studioSubTab = 'distribute';
        this.render();
      });
    }

    const btnProceedToPrint = this.container.querySelector('#btnProceedToPrint');
    if (btnProceedToPrint) {
      btnProceedToPrint.addEventListener('click', () => {
        this.studioSubTab = 'print';
        this.render();
      });
    }

    // Download Sample Word Document (.doc)
    const btnDownloadSampleWord = this.container.querySelector('#btnDownloadSampleWord');
    if (btnDownloadSampleWord) {
      btnDownloadSampleWord.addEventListener('click', () => {
        const sampleDoc = generateSampleWordDocument();
        this._downloadFile(sampleDoc, 'Mau_De_Thi_Toan_Roi_Rac.doc', 'application/msword;charset=utf-8;');
      });
    }

    // Clear All Old Word Questions
    const btnClearAllWordData = this.container.querySelector('#btnClearAllWordData');
    if (btnClearAllWordData) {
      btnClearAllWordData.addEventListener('click', () => {
        const confirmed = typeof window !== 'undefined' && window.confirm
          ? window.confirm('Bạn có chắc chắn muốn xóa hết toàn bộ các file đề thi Word cũ đã lưu không?\n\nThao tác này sẽ dọn dẹp sạch toàn bộ dữ liệu để bạn nạp file mới.')
          : true;
        if (!confirmed) return;
        this._clearAllWordFiles();
        this._showAlert('🗑️ Đã xóa sạch toàn bộ dữ liệu đề thi Word cũ! Giờ bạn có thể tải lên các file đề thi mới.');
        this.render();
      });
    }

    // Delete single imported file
    this.container.querySelectorAll('.btn-delete-imported-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute('data-file-id');
        if (fileId) {
          this._deleteImportedFile(fileId);
        }
      });
    });

    // File Import Word (.docx, .doc, .txt) with Duplicate Check
    const fileImportWord = this.container.querySelector('#fileImportWord');
    if (fileImportWord) {
      fileImportWord.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Check duplicate file name
        const fileNameLower = file.name.trim().toLowerCase();
        const isDuplicate = this.importedFiles.some(f => f.name.trim().toLowerCase() === fileNameLower);
        if (isDuplicate) {
          this._showAlert(`⚠️ File "${file.name}" đã tồn tại trong danh sách đề thi!\nHệ thống không cho phép nạp trùng file. Vui lòng đổi tên file hoặc xóa file cũ trước khi nạp lại.`);
          e.target.value = '';
          return;
        }

        try {
          let textContent = '';

          if (fileNameLower.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            textContent = await extractTextFromDocx(arrayBuffer);
          } else {
            const raw = await file.text();
            textContent = stripHtmlToExamText(raw);
          }

          if (!textContent || !textContent.trim()) {
            this._showAlert('⚠️ Không đọc được nội dung văn bản trong file Word này. Vui lòng kiểm tra lại định dạng file hoặc dùng file mẫu.');
            return;
          }

          this.importRawText = textContent;
          const res = parseExamText(textContent);

          if (res.questions && res.questions.length > 0) {
            const newFileEntry = {
              id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              uploadedAt: new Date().toISOString(),
              questionCount: res.questions.length,
              questions: res.questions,
            };
            this._saveWordFiles([...this.importedFiles, newFileEntry]);
            this.selectedAssignFileId = newFileEntry.id;
            this.selectedAssignCount = 'all';
            this.importErrors = res.errors || [];
            this._showAlert(`✅ Đã nạp thành công ${res.questions.length} câu hỏi từ file "${file.name}"!\nTổng số file hiện có: ${this.importedFiles.length} file (${this.importedQuestions.length} câu hỏi).`);
          } else {
            this.importErrors = res.errors && res.errors.length > 0
              ? res.errors
              : ['Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng tải file mẫu chuẩn để xem định dạng.'];
            this._showAlert('⚠️ Không nhận diện được câu hỏi nào từ file.\nVui lòng xem danh sách lỗi bên dưới hoặc tải file mẫu chuẩn.');
          }
          this.render();
        } catch (err) {
          console.error('[QuizView] Error reading Word file:', err);
          this._showAlert(`❌ Lỗi khi đọc file Word: ${err.message || err}`);
        }
      });
    }

    // Distribution Table: Per-File Question Count Input
    this.container.querySelectorAll('.input-distribute-file-count').forEach(input => {
      input.addEventListener('change', (e) => {
        const fileId = e.target.getAttribute('data-file-id');
        const max = parseInt(e.target.getAttribute('max'), 10) || 0;
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) {
          val = 0;
        } else if (val > max) {
          val = max;
        }
        if (!this.fileDistributions) this.fileDistributions = {};
        this.fileDistributions[fileId] = val;
        this.render();
      });
    });

    // Distribution Table: Quick Count Buttons per File
    this.container.querySelectorAll('.btn-quick-dist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileId = btn.getAttribute('data-file-id');
        const count = parseInt(btn.getAttribute('data-count'), 10);
        const file = this.importedFiles.find(f => f.id === fileId);
        const max = file ? (file.questionCount || (file.questions ? file.questions.length : 0)) : 0;
        if (!this.fileDistributions) this.fileDistributions = {};
        this.fileDistributions[fileId] = Math.min(Math.max(0, count), max);
        this.render();
      });
    });

    // Distribution Table: Global Helper Buttons
    const btnDistributeAll = this.container.querySelector('#btnDistributeAll');
    if (btnDistributeAll) {
      btnDistributeAll.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          this.fileDistributions[f.id] = f.questionCount || (f.questions ? f.questions.length : 0);
        });
        this.render();
      });
    }

    const btnDistributeEven10 = this.container.querySelector('#btnDistributeEven10');
    if (btnDistributeEven10) {
      btnDistributeEven10.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          const max = f.questionCount || (f.questions ? f.questions.length : 0);
          this.fileDistributions[f.id] = Math.min(10, max);
        });
        this.render();
      });
    }

    const btnDistributeClear = this.container.querySelector('#btnDistributeClear');
    if (btnDistributeClear) {
      btnDistributeClear.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          this.fileDistributions[f.id] = 0;
        });
        this.render();
      });
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

    // Track custom exam title input
    const txtAssignTitle = this.container.querySelector('#txtAssignTitle');
    if (txtAssignTitle) {
      txtAssignTitle.addEventListener('input', (e) => {
        this.studioAssignTitle = e.target.value;
      });
    }

    // Create & Assign Exam Button (From multi-file distribution)
    const btnCreateAndAssign = this.container.querySelector('#btnCreateAndAssignExam');
    if (btnCreateAndAssign) {
      btnCreateAndAssign.addEventListener('click', () => {
        const titleInput = this.container.querySelector('#txtAssignTitle');
        const durationInput = this.container.querySelector('#numAssignDuration');
        const examCodeInput = this.container.querySelector('#txtAssignExamCode');
        const chkShuffleQ = this.container.querySelector('#chkShuffleQuestions');
        const chkShuffleOpt = this.container.querySelector('#chkShuffleOptions');

        const title = titleInput ? titleInput.value.trim() : '';
        const durationMinutes = durationInput ? parseInt(durationInput.value, 10) : 15;
        const examCode = examCodeInput ? examCodeInput.value.trim() : null;

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

        // Get questions from multi-file distribution
        const questionsToAssign = this._getSelectedDistributedQuestions();

        if (questionsToAssign.length === 0) {
          this._showAlert('⚠️ Vui lòng chọn ít nhất 1 câu hỏi từ các bộ đề ở tab Phân Phối Đề trước khi phát đề!');
          return;
        }

        const customQuestions = [...questionsToAssign];
        const questionIds = customQuestions.map(q => q.id);

        const result = examManager.createExam({
          title,
          description: `Đề thi trắc nghiệm ${durationMinutes} phút môn Toán Rời Rạc.`,
          durationMinutes,
          questionIds,
          customQuestions,
          examCode,
          assignedTo,
          createdBy: authManager.getCurrentUser() ? authManager.getCurrentUser().id : 'user_admin',
          shuffleQuestions: chkShuffleQ ? chkShuffleQ.checked : true,
          shuffleOptions: chkShuffleOpt ? chkShuffleOpt.checked : true,
        });

        if (result.success) {
          if (cloudSyncManager && cloudSyncManager.isConnected) {
            cloudSyncManager.serverCreateExam(result.exam).catch(() => {});
          }
          this.gradebookExamId = null;
          this.adminAnswerKeyExamId = result.exam.id;
          this._showAlert(`🎉 Tạo và phát đề thi thành công!\n\nĐề thi: "${title}" (Mã: ${result.exam.examCode})\nSố câu: ${questionIds.length} câu\nThời lượng: ${durationMinutes} phút\nĐối tượng: ${assignedTo.includes('all') ? 'Toàn bộ sinh viên' : assignedTo.length + ' sinh viên'}\n\nĐề thi đã được chuyển vào mục "Quản Lý Đề Thi". Hệ thống đã chuẩn bị sẵn File Đáp Án dành riêng cho Quản trị viên.`);
          this.studioAssignTitle = null;
          this.render();
        } else {
          this._showAlert(result.error || result.message || 'Có lỗi xảy ra khi tạo đề thi.');
        }
      });
    }

    // Admin Answer Key Modal & Row Events
    this.container.querySelectorAll('.btn-view-admin-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const examId = btn.getAttribute('data-exam-id');
        this.gradebookExamId = null;
        this.adminAnswerKeyExamId = examId;
        this.render();
      });
    });

    const btnCloseAnswerKey = this.container.querySelector('#btnCloseAdminAnswerKey');
    if (btnCloseAnswerKey) {
      btnCloseAnswerKey.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.adminAnswerKeyExamId = null;
        this.render();
      });
    }

    const adminAnswerKeyBackdrop = this.container.querySelector('#adminAnswerKeyBackdrop');
    if (adminAnswerKeyBackdrop) {
      adminAnswerKeyBackdrop.addEventListener('click', (e) => {
        if (e.target === adminAnswerKeyBackdrop) {
          this.adminAnswerKeyExamId = null;
          this.render();
        }
      });
    }

    const btnDownloadAnswerKeyCsv = this.container.querySelector('#btnDownloadAnswerKeyCsv');
    if (btnDownloadAnswerKeyCsv && this.adminAnswerKeyExamId) {
      btnDownloadAnswerKeyCsv.addEventListener('click', () => {
        this._exportAdminAnswerKeyToCsv(this.adminAnswerKeyExamId);
      });
    }

    const btnPrintAnswerKey = this.container.querySelector('#btnPrintAnswerKeyA4');
    if (btnPrintAnswerKey) {
      btnPrintAnswerKey.addEventListener('click', () => {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        }
      });
    }

    const btnCopyAnswerKey = this.container.querySelector('#btnCopyAnswerKeyString');
    if (btnCopyAnswerKey && this.adminAnswerKeyExamId) {
      btnCopyAnswerKey.addEventListener('click', () => {
        const exam = examManager.getExamById(this.adminAnswerKeyExamId);
        const questions = examManager.getExamQuestions(exam);
        const matrixStr = questions.map((q, idx) => `Câu ${idx + 1}: ${q.correctId}`).join(' | ');
        const fullText = `=== ĐÁP ÁN ĐỀ THI: ${exam?.title || ''} (Mã đề: ${exam?.examCode || ''}) ===\n${matrixStr}`;

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(fullText).then(() => {
            btnCopyAnswerKey.textContent = '✓ Đã sao chép!';
            setTimeout(() => {
              btnCopyAnswerKey.textContent = '📋 Sao Chép Bảng Đáp Án';
            }, 2000);
          }).catch(() => {
            prompt('Sao chép đáp án dưới đây:', fullText);
          });
        } else {
          prompt('Sao chép đáp án dưới đây:', fullText);
        }
      });
    }

    // View Gradebook for Exam
    this.container.querySelectorAll('.btn-view-gradebook').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const examId = btn.getAttribute('data-exam-id');
        this.adminAnswerKeyExamId = null;
        this.gradebookExamId = examId;
        this.render();
      });
    });

    const btnCloseGradebook = this.container.querySelector('#btnCloseGradebook');
    if (btnCloseGradebook) {
      btnCloseGradebook.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    // Clear All Assigned Exams & Student Exam Submissions
    const btnClearAllExams = this.container.querySelector('#btnAdminClearAllExams');
    if (btnClearAllExams) {
      btnClearAllExams.addEventListener('click', async () => {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(
          '⚠️ CẢNH BÁO QUAN TRỌNG:\n\nBạn có chắc chắn muốn xóa TOÀN BỘ đề thi đã giao và tất cả dữ liệu bài làm, điểm số thi trong tài khoản sinh viên không?\n\nHành động này không thể hoàn tác!'
        )) {
          return;
        }

        examManager.clearAllExams();
        quizHistoryManager.clearAllExamHistory();
        if (cloudSyncManager && cloudSyncManager.isConnected) {
          try {
            await cloudSyncManager.serverClearAllExams();
          } catch {}
        }

        this._showAlert('✅ Đã xóa toàn bộ đề thi và làm sạch dữ liệu bài làm của sinh viên thành công!');
        this.studioAssignTitle = null;
        this.render();
      });
    }

    // 5. Teacher's A4 & LaTeX Print Studio Events
    const btnSwitchToAssign = this.container.querySelector('#btnSwitchToAssignTabFromPrint');
    if (btnSwitchToAssign) {
      btnSwitchToAssign.addEventListener('click', () => {
        this.studioSubTab = 'assign';
        this.render();
      });
    }

    const selPrintSource = this.container.querySelector('#selStudioPrintSource');
    if (selPrintSource) {
      selPrintSource.addEventListener('change', (e) => {
        this.studioPrintSource = e.target.value;
        this.render();
      });
    }

    const numStudioCount = this.container.querySelector('#numStudioCount');
    const selStudioCount = this.container.querySelector('#selStudioCount');

    if (numStudioCount) {
      numStudioCount.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val === '') {
          this.studioConfig.count = null;
        } else {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.studioConfig.count = parsed;
          }
        }
      });
      numStudioCount.addEventListener('change', (e) => {
        const val = e.target.value.trim();
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.studioConfig.count = parsed;
        } else {
          this.studioConfig.count = null;
        }
        this.render();
      });
    }

    if (selStudioCount) {
      selStudioCount.addEventListener('change', (e) => {
        if (e.target.value === 'all') {
          this.studioConfig.count = null;
        } else {
          this.studioConfig.count = parseInt(e.target.value, 10);
        }
        this.render();
      });
    }

    const btnGenNewExam = this.container.querySelector('#btnGenNewExam');
    if (btnGenNewExam) {
      btnGenNewExam.addEventListener('click', () => {
        this.printExamCode = `TRR-${Math.floor(100 + Math.random() * 900)}`;
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
        const exam = this._getStudioPrintExam();
        if (!exam) {
          this._showAlert('Vui lòng nạp file Word câu hỏi trước khi in đề!');
          return;
        }
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
        const exam = this._getStudioPrintExam();
        if (!exam) {
          this._showAlert('Vui lòng nạp file Word câu hỏi trước khi sao chép mã LaTeX!');
          return;
        }
        const latex = exportExamToLatex(exam);
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

      // Context: Active Timed Exam Session
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
