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
  setCustomQuestionBank,
} from '../../core/quiz/QuizBank.js';
import { authManager } from '../../core/auth/AuthManager.js';
import { quizHistoryManager } from '../../core/quiz/QuizHistoryManager.js';
import { cloudSyncManager } from '../../core/sync/CloudSyncManager.js';
import { examManager, MAX_DISCONNECT_GRACE_SECONDS } from '../../core/quiz/ExamManager.js';
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
    this.printExamCode = '101';
    this.studioAssignExamCode = null;
    this.studioAssignTitle = null;
    this.studioAssignDuration = null;

    this._generateNewExam();

    if (authManager && typeof authManager.subscribe === 'function') {
      authManager.subscribe((event) => {
        if (cloudSyncManager && (event === 'login' || event === 'logout')) {
          cloudSyncManager.syncExams(examManager, authManager).catch(() => {});
          cloudSyncManager.syncExamSubmissions(examManager, authManager).catch(() => {});
        }
        if (this.container) {
          this.render();
        }
      });
    }

    if (examManager && typeof examManager.subscribe === 'function') {
      examManager.subscribe((event) => {
        if (!this.container || this.activeExamSession) return;
        // Never disrupt teacher in Studio tab with background re-renders
        if (this.activeTab === 'studio') return;
        if (['exams_synced', 'exam_deleted', 'exams_cleared', 'exam_created', 'data_reset', 'submissions_synced'].includes(event)) {
          this.render();
        }
      });
    }

    if (cloudSyncManager && typeof cloudSyncManager.subscribe === 'function') {
      cloudSyncManager.subscribe((status) => {
        if (this.container && (this.activeTab === 'leaderboard' || this.activeTab === 'myExams')) {
          const badge = this.container.querySelector('#heroCloudBadge');
          if (badge) {
            badge.textContent = status?.isConnected ? '🟢 Đã kết nối Máy chủ (Live)' : '💾 Lưu trữ Trình duyệt (Offline)';
            badge.style.background = status?.isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
            badge.style.color = status?.isConnected ? '#10b981' : '#f59e0b';
            badge.style.borderColor = status?.isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)';
          }
        }
      });
    }

    // Trigger initial sync once on mount
    if (cloudSyncManager) {
      try {
        cloudSyncManager.syncExams(examManager, authManager).then(() => {
          if (this.container && this.activeTab === 'myExams') {
            this.render();
          }
        }).catch(() => {});
        cloudSyncManager.syncExamSubmissions(examManager, authManager).then(() => {
          if (this.container && this.activeTab === 'myExams') {
            this.render();
          }
        }).catch(() => {});
        this.syncCloudImportedFiles().catch(() => {});
      } catch {}
    }

    this._initKeyboardNavigation();

    // ── Zero Data Loss: Start offline queue flush listener ────────────────────
    this._initOfflineQueueListener();

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

  _saveWordFiles(files, skipCloudPush = false) {
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

    // Cloud Multi-Device Sync: Push to backend server
    if (!skipCloudPush && cloudSyncManager && typeof cloudSyncManager.pushBatchImportedFiles === 'function') {
      cloudSyncManager.pushBatchImportedFiles(this.importedFiles).catch(() => {});
    }
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
    this._markFileDeletedLocally(fileId);
    this._saveWordFiles(updated, true);
    if (cloudSyncManager && cloudSyncManager.isConnected && typeof cloudSyncManager.pushDeleteImportedFile === 'function') {
      cloudSyncManager.pushDeleteImportedFile(fileId).catch(() => {});
    }
    this._showAlert(`🗑️ Đã xóa dữ liệu file "${file.name}" thành công!`);
    this.render();
  }

  _getDeletedFileIds() {
    try {
      const storage = this._getStorage();
      if (storage) {
        return JSON.parse(storage.getItem('toanrr_deleted_imported_files_v1') || '[]');
      }
    } catch {}
    return [];
  }

  _markFileDeletedLocally(fileId) {
    if (!fileId) return;
    try {
      const storage = this._getStorage();
      if (storage) {
        const list = this._getDeletedFileIds();
        if (!list.includes(fileId)) {
          list.push(fileId);
          storage.setItem('toanrr_deleted_imported_files_v1', JSON.stringify(list));
        }
      }
    } catch {}
  }

  _isFileDeletedLocally(fileId) {
    if (!fileId) return false;
    return this._getDeletedFileIds().includes(fileId);
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
    const now = Date.now();
    try {
      const storage = this._getStorage();
      if (storage) {
        storage.removeItem('toanrr_custom_imported_files_v1');
        storage.removeItem('toanrr_custom_imported_questions_v1');
        storage.removeItem('toanrr_custom_imported_raw_v1');
        storage.setItem('toanrr_last_imported_files_clear', String(now));
        storage.setItem('toanrr_deleted_imported_files_v1', JSON.stringify([]));
      }
    } catch {}
    if (typeof setCustomQuestionBank === 'function') {
      try {
        setCustomQuestionBank([]);
      } catch {}
    }
    if (cloudSyncManager && cloudSyncManager.isConnected && typeof cloudSyncManager.pushClearAllImportedFiles === 'function') {
      cloudSyncManager.pushClearAllImportedFiles().catch(err => {
        console.warn('[QuizView] pushClearAllImportedFiles error:', err);
      });
    }
  }

  /**
   * Multi-Device Cloud Synchronization for Imported Word Files.
   * Pulls files from cloud and merges with local storage.
   * @returns {Promise<boolean>}
   */
  async syncCloudImportedFiles() {
    if (!cloudSyncManager || typeof cloudSyncManager.syncImportedFiles !== 'function') return false;
    try {
      const remoteData = await cloudSyncManager.syncImportedFiles();
      if (!remoteData) return false;
      const remoteFiles = Array.isArray(remoteData) ? remoteData : (remoteData.files || []);
      const serverResetTime = remoteData.resetTime || 0;
      const serverDeleted = Array.isArray(remoteData.deletedFiles) ? remoteData.deletedFiles : [];

      const storage = this._getStorage();
      const localClearTime = storage ? parseInt(storage.getItem('toanrr_last_imported_files_clear') || '0', 10) : 0;

      // 1. If server was cleared after our last local update, purge local
      if (serverResetTime > 0 && serverResetTime > localClearTime) {
        this.importedFiles = [];
        this.importedQuestions = [];
        this.importRawText = '';
        if (storage) {
          storage.removeItem('toanrr_custom_imported_files_v1');
          storage.removeItem('toanrr_custom_imported_questions_v1');
          storage.removeItem('toanrr_custom_imported_raw_v1');
          storage.setItem('toanrr_last_imported_files_clear', String(serverResetTime));
          storage.setItem('toanrr_deleted_imported_files_v1', JSON.stringify([]));
        }
      }

      // 2. Mark any server-deleted files locally (skipping files actively present on server)
      const activeRemoteFileIds = new Set(remoteFiles.map(rf => rf?.id).filter(Boolean));
      for (const delId of serverDeleted) {
        if (!activeRemoteFileIds.has(delId)) {
          this._markFileDeletedLocally(delId);
        }
      }

      // 3. Filter remote files using local and server tombstones
      const validRemote = remoteFiles.filter(rf => rf && rf.id && !this._isFileDeletedLocally(rf.id));

      const isAdmin = authManager && typeof authManager.isAdmin === 'function' && authManager.isAdmin();

      // If user is a student/non-admin: student should NEVER override server state or push files back
      if (!isAdmin) {
        this.importedFiles = validRemote;
        this.importedQuestions = validRemote.flatMap(f => f.questions || []);
        if (storage) {
          storage.setItem('toanrr_custom_imported_files_v1', JSON.stringify(this.importedFiles));
          storage.setItem('toanrr_custom_imported_questions_v1', JSON.stringify(this.importedQuestions));
        }
        const oldIds = (this.importedFiles || []).map(f => f.id).join(',');
        const newIds = validRemote.map(f => f.id).join(',');
        if (oldIds !== newIds && this.container && (this.activeTab === 'studio' || this.studioSubTab === 'wordUpload')) {
          const activeEl = document.activeElement;
          if (!activeEl || !this.container.contains(activeEl) || !['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName)) {
            this.render();
          }
        }
        return true;
      }

      // 4. Admin Merge:
      const localFiles = Array.isArray(this.importedFiles)
        ? this.importedFiles.filter(lf => lf && lf.id && !this._isFileDeletedLocally(lf.id))
        : [];
      const mergedMap = new Map();

      validRemote.forEach(rf => mergedMap.set(rf.id, rf));

      let hasNewLocalFiles = false;
      if (localClearTime > serverResetTime) {
        localFiles.forEach(lf => {
          if (!mergedMap.has(lf.id) && !serverDeleted.includes(lf.id)) {
            mergedMap.set(lf.id, lf);
            hasNewLocalFiles = true;
          }
        });
      }

      const mergedList = Array.from(mergedMap.values());
      const oldAdminIds = (this.importedFiles || []).map(f => f.id).join(',');
      const newAdminIds = mergedList.map(f => f.id).join(',');
      this._saveWordFiles(mergedList, true);

      if (hasNewLocalFiles && cloudSyncManager.isConnected) {
        cloudSyncManager.pushBatchImportedFiles(mergedList).catch(() => {});
      }

      if (oldAdminIds !== newAdminIds && this.container && (this.activeTab === 'studio' || this.studioSubTab === 'wordUpload')) {
        const activeEl = document.activeElement;
        if (!activeEl || !this.container.contains(activeEl) || !['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName)) {
          this.render();
        }
      }
      return true;
    } catch (err) {
      console.warn('[QuizView] syncCloudImportedFiles error:', err);
    }
    return false;
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
    let hasExceeded = false;
    const exceededFiles = [];
    const breakdown = [];

    this.importedFiles.forEach(file => {
      const fileCount = file.questionCount || (file.questions ? file.questions.length : 0);
      totalAvailable += fileCount;
      let count = this.fileDistributions[file.id];
      if (count === undefined || count === null) {
        count = fileCount;
        this.fileDistributions[file.id] = count;
      } else {
        count = Math.max(0, parseInt(count, 10) || 0);
      }
      totalSelected += count;
      const isExceeded = count > fileCount;
      if (isExceeded) {
        hasExceeded = true;
        exceededFiles.push({
          fileId: file.id,
          fileName: file.name,
          selectedCount: count,
          availableCount: fileCount,
        });
      }
      if (count > 0) {
        breakdown.push({
          fileId: file.id,
          fileName: file.name,
          selectedCount: count,
          availableCount: fileCount,
          isExceeded,
        });
      }
    });

    return { totalSelected, totalAvailable, breakdown, hasExceeded, exceededFiles };
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

  _getNextExamCode() {
    const existingExams = (examManager && typeof examManager.getExams === 'function')
      ? examManager.getExams()
      : [];
    let maxNum = 100;
    (existingExams || []).forEach(ex => {
      if (!ex) return;
      if (ex.examCode) {
        const match = String(ex.examCode).match(/(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n >= 100 && n < 1000 && n > maxNum) {
            maxNum = n;
          }
        }
      }
      if (ex.title) {
        const matchTitle = ex.title.trim().match(/Đề\s*(\d+)/i);
        if (matchTitle) {
          const titleNum = parseInt(matchTitle[1], 10);
          if (!isNaN(titleNum)) {
            const impliedCode = 100 + titleNum;
            if (impliedCode > maxNum) {
              maxNum = impliedCode - 1;
            }
          }
        }
      }
    });
    return String(maxNum + 1);
  }

  setStudioSubTab(subTab) {
    this.studioSubTab = subTab;
    if (!this.container) return;
    const distSec = this.container.querySelector('#studioDistributeSection');
    const pubSec = this.container.querySelector('#studioPublishSection');
    const printSec = this.container.querySelector('#studioPrintSection');
    const assignSec = this.container.querySelector('#studioAssignSection');

    if (distSec) distSec.style.display = (subTab === 'distribute' || (subTab !== 'publish' && subTab !== 'print' && subTab !== 'assign')) ? 'block' : 'none';
    if (pubSec) pubSec.style.display = (subTab === 'publish' || subTab === 'assign') ? 'block' : 'none';
    if (assignSec) assignSec.style.display = subTab === 'print' ? 'none' : 'block';
    if (printSec) printSec.style.display = subTab === 'print' ? 'block' : 'none';

    const btnDist = this.container.querySelector('#tabStudioDistribute');
    const btnPub = this.container.querySelector('#tabStudioPublish');
    const btnPrint = this.container.querySelector('#tabStudioPrint');
    if (btnDist) btnDist.classList.toggle('active', (subTab === 'distribute' || (subTab !== 'publish' && subTab !== 'print' && subTab !== 'assign')));
    if (btnPub) btnPub.classList.toggle('active', (subTab === 'publish' || subTab === 'assign'));
    if (btnPrint) btnPrint.classList.toggle('active', subTab === 'print');
  }

  _getStudioPrintPool() {
    if (!this.importedQuestions || this.importedQuestions.length === 0) {
      return [];
    }
    const source = (this.studioPrintSource && this.studioPrintSource !== 'builtin') 
      ? this.studioPrintSource 
      : 'all_word';

    if (source === 'distributed') {
      const distQ = this._getSelectedDistributedQuestions();
      return (distQ && distQ.length > 0) ? distQ : (this.importedQuestions || []);
    }
    if (source !== 'all_word') {
      const file = (this.importedFiles || []).find(f => f.id === source);
      if (file && file.questions && file.questions.length > 0) {
        return file.questions;
      }
    }
    return this.importedQuestions || [];
  }

  _renderDistSummaryBanner(distSummary) {
    if (distSummary && distSummary.hasExceeded && distSummary.exceededFiles && distSummary.exceededFiles.length > 0) {
      return `
        <div style="padding:14px 18px;background:rgba(239,68,68,0.1);border:1.5px solid rgba(239,68,68,0.35);border-radius:8px;margin-bottom:18px;">
          <div style="font-size:13.5px;font-weight:700;color:#ef4444;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
            <span>⚠️ Cảnh báo: Số câu chọn bốc vượt quá giới hạn sẵn có trong file!</span>
          </div>
          <div style="font-size:12.5px;color:var(--text);margin-bottom:8px;line-height:1.6;">
            ${distSummary.exceededFiles.map(e => `• <strong>${this._escapeHtml(e.fileName)}</strong>: Bạn đang chọn <strong>${e.selectedCount}</strong> câu, nhưng file chỉ có <strong>${e.availableCount}</strong> câu.`).join('<br/>')}
          </div>
          <div style="font-size:12px;color:var(--dim);">
            Vui lòng điều chỉnh lại số câu chọn bốc không vượt quá số câu sẵn có trước khi bấm "Tạo và Phát Đề Thi Cho Sinh Viên".
          </div>
        </div>
      `;
    }
    if (distSummary.totalSelected === 0) {
      return `
        <div style="padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;margin-bottom:18px;text-align:center;">
          <div style="font-size:13.5px;font-weight:700;color:#ef4444;margin-bottom:4px;">⚠️ Chưa có câu hỏi nào được chọn để phát đề!</div>
          <div style="font-size:12.5px;color:var(--dim);">Vui lòng nhập số câu hoặc bấm các nút chọn nhanh (ví dụ: 10 câu, Tất cả) ở bảng phân phối ngay phía trên.</div>
        </div>
      `;
    }
    return `
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
    `;
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
          result.push(...fileQuestions.slice(0, count));
        }
      }
    });
    if (result.length === 0 && Array.isArray(this.importedQuestions) && this.importedQuestions.length > 0) {
      return [...this.importedQuestions];
    }
    return result;
  }

  _getStudioPrintExam() {
    if (!this.importedQuestions || this.importedQuestions.length === 0) {
      return null;
    }

    const pool = this._getStudioPrintPool();
    if (pool.length === 0) {
      return null;
    }

    const desiredCount = (this.studioConfig.count && !isNaN(parseInt(this.studioConfig.count, 10)) && parseInt(this.studioConfig.count, 10) > 0)
      ? parseInt(this.studioConfig.count, 10)
      : pool.length;

    let selectedQuestions;
    if (this.printShuffledQuestions && this.printShuffledQuestions.length > 0) {
      selectedQuestions = this.printShuffledQuestions.slice(0, Math.min(desiredCount, this.printShuffledQuestions.length));
    } else {
      selectedQuestions = pool.slice(0, Math.min(desiredCount, pool.length));
    }

    if (!this.printExamCode) {
      this.printExamCode = '101';
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

      const paneMyExams = this.container ? this.container.querySelector('#paneMyExams') : null;
      const paneStudio = this.container ? this.container.querySelector('#paneStudio') : null;
      const btnMyExams = this.container ? this.container.querySelector('#tabBtnMyExams') : null;
      const btnStudio = this.container ? this.container.querySelector('#tabBtnStudio') : null;

      if (paneMyExams && paneStudio) {
        paneMyExams.style.display = tabName === 'myExams' ? 'block' : 'none';
        paneStudio.style.display = tabName === 'studio' ? 'block' : 'none';
        if (btnMyExams) btnMyExams.classList.toggle('active', tabName === 'myExams');
        if (btnStudio) btnStudio.classList.toggle('active', tabName === 'studio');
      } else if (this.container) {
        this.render();
      }

      if (tabName === 'myExams') {
        try {
          if (cloudSyncManager) {
            cloudSyncManager.syncExams(examManager, authManager).then(() => {
              if (this.activeTab === 'myExams') this.render();
            }).catch(() => {});
            cloudSyncManager.syncExamSubmissions(examManager, authManager).catch(() => {});
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

    if (typeof document !== 'undefined' && document.body) {
      if (this.activeExamSession) {
        document.body.classList.add('in-active-exam');
      } else {
        document.body.classList.remove('in-active-exam');
      }
    }

    // Check my exams count
    const myExams = currentUser ? examManager.getExamsForUser(currentUser.id) : [];
    const myPendingCount = currentUser 
      ? myExams.filter(e =>
        !examManager.getSubmission(e.id, currentUser.id) &&
        !examManager.getExamViolationRecord(e.id, currentUser.id).banned
      ).length
      : 0;

    // Capture scroll position of horizontal question jump grid if active so it NEVER resets to 0
    const prevJumpGrid = this.container ? this.container.querySelector('.exam-q-jump-grid') : null;
    const savedJumpScrollLeft = prevJumpGrid ? prevJumpGrid.scrollLeft : null;

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

    // Instantly restore question jump grid scroll position without resetting to 0
    if (savedJumpScrollLeft !== null) {
      const newJumpGrid = this.container ? this.container.querySelector('.exam-q-jump-grid') : null;
      if (newJumpGrid) {
        newJumpGrid.scrollLeft = savedJumpScrollLeft;
      }
    }

    this._bindEvents();
  }

  /**
   * Resolves actual student accounts assigned to an exam target with fuzzy class matching.
   * @param {Array<string>} assignedTo
   * @returns {Array<Object>}
   * @private
   */
  _resolveAssignedStudents(assignedTo) {
    const allUsers = (typeof authManager !== 'undefined' && authManager.getUsers) ? authManager.getUsers() : [];
    const students = allUsers.filter(u => u && u.role !== 'admin' && u.username !== 'admin' && u.id !== 'user_admin');
    if (!Array.isArray(assignedTo) || assignedTo.length === 0 || assignedTo.includes('all')) {
      return students;
    }
    const classItems = assignedTo.filter(a => typeof a === 'string' && a.startsWith('class:'));
    const directStudents = new Set(assignedTo.filter(a => typeof a === 'string' && !a.startsWith('class:') && a !== 'all'));

    const cleanClassNames = classItems.map(c =>
      c.replace('class:', '').trim().toLowerCase().replace(/^lớp\s*:?\s*/i, '').replace(/\s+/g, '')
    );

    return students.filter(st => {
      if (directStudents.has(st.id) || directStudents.has(st.username)) return true;
      if (cleanClassNames.length > 0) {
        const uClass = (st.className || st.studentClass || '').trim().toLowerCase().replace(/^lớp\s*:?\s*/i, '').replace(/\s+/g, '');
        return cleanClassNames.some(cn => cn === uClass);
      }
      return false;
    });
  }

  _formatExamTarget(assignedTo) {
    if (!Array.isArray(assignedTo) || assignedTo.length === 0 || assignedTo.includes('all')) {
      return 'Toàn bộ sinh viên';
    }

    const classItems = assignedTo.filter(a => typeof a === 'string' && a.startsWith('class:'));
    const directStudents = assignedTo.filter(a => typeof a === 'string' && !a.startsWith('class:') && a !== 'all');

    if (classItems.length > 0) {
      const classNames = classItems.map(c => c.replace('class:', '').trim());
      const classStudents = this._resolveAssignedStudents(assignedTo);
      const totalCount = classStudents.length;
      return totalCount > 0 ? `Lớp ${classNames.join(', ')} (${totalCount} sinh viên)` : `Lớp ${classNames.join(', ')}`;
    }

    return `${directStudents.length} sinh viên`;
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
    const activeExamIds = new Set(assignedExams.map(e => e.id));

    // Compute user's exam summary strictly matching remaining active assigned exams
    const mySubmissions = examManager.getSubmissions().filter(s => 
      s && s.userId === currentUser.id && 
      activeExamIds.has(s.examId) && 
      !examManager._isExamDeletedLocally(s.examId)
    );
    const completedCount = mySubmissions.length;
    const avgScore = completedCount > 0 
      ? Math.round((mySubmissions.reduce((acc, s) => acc + (Number(s.score) || 0), 0) / completedCount) * 10) / 10 
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
            <div style="font-size:18px;font-weight:800;color:var(--accent);">${completedCount > 0 ? `${avgScore.toFixed(1)} / 10` : '0 / 10'}</div>
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
                  <th style="text-align:center;">Ngày &amp; Khung Giờ</th>
                  <th style="text-align:center;">Đối tượng</th>
                  <th style="text-align:center;">Đã nộp bài</th>
                  <th style="text-align:center;">Ngày tạo</th>
                  <th style="text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${assignedExams.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align:center;padding:28px;color:var(--dim);font-style:italic;">
                      Chưa có đề thi nào được tạo. Hãy chuyển sang tab "Soạn Đề Từ File Word" để nạp file và phát đề!
                    </td>
                  </tr>
                ` : assignedExams.map(item => {
                  const subs = examManager.getSubmissionsForExam(item.id);
                  const targetLabel = this._formatExamTarget(item.assignedTo);
                  const sched = examManager.getExamScheduleStatus(item);

                  return `
                    <tr>
                      <td style="font-weight:700;color:var(--text);">
                        ${this._escapeHtml(item.title)}
                        <div style="font-size:11px;color:var(--dim);font-weight:normal;">Mã: ${item.id}</div>
                      </td>
                      <td style="text-align:center;">${item.durationMinutes} phút</td>
                      <td style="text-align:center;">${item.questionIds.length} câu</td>
                      <td style="text-align:center;font-size:12px;">
                        ${item.scheduleType === 'scheduled' && item.examDate && item.startTime ? `
                          <div style="font-weight:700;color:var(--text);">📅 ${item.examDate.split('-').reverse().join('/')}</div>
                          <div style="color:var(--dim);margin:2px 0;">⏰ ${item.startTime} ➔ ${item.entryDeadline || (item.startTime + ' (+' + (item.lateEntryGraceMinutes || 15) + 'p)')}</div>
                          ${sched.status === 'open' 
                            ? '<span class="pill-badge" style="background:rgba(16,185,129,0.18);color:#10b981;font-weight:700;padding:2px 7px;border-radius:6px;font-size:10.5px;">🟢 Đang mở</span>' 
                            : sched.status === 'upcoming' 
                              ? '<span class="pill-badge" style="background:rgba(245,158,11,0.18);color:#f59e0b;font-weight:700;padding:2px 7px;border-radius:6px;font-size:10.5px;">⏳ Chưa mở</span>' 
                              : '<span class="pill-badge" style="background:rgba(239,68,68,0.18);color:#ef4444;font-weight:700;padding:2px 7px;border-radius:6px;font-size:10.5px;">🚫 Đã khóa</span>'}
                        ` : `
                          <span style="color:var(--dim);">🌐 Tự do</span>
                        `}
                      </td>
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
            const activeDraft = (!isCompleted && !isBanned) ? examManager.loadDraft(exam.id, currentUser.id, { includeExpired: false }) : null;
            const sched = examManager.getExamScheduleStatus(exam);
            const isScheduled = sched.isScheduled;
            const isUpcoming = isScheduled && sched.status === 'upcoming';
            const isClosed = isScheduled && sched.status === 'closed';

            // Determine status badge
            let statusBadgeHtml = '';
            if (isBanned) {
              statusBadgeHtml = `<span class="exam-status-badge banned">🚫 VI PHẠM (3/3): ${sub ? sub.score : 0} / 10 ĐIỂM (BỊ CẤM THI LẠI ĐỀ NÀY)</span>`;
            } else if (isCompleted) {
              statusBadgeHtml = `<span class="exam-status-badge completed">✅ ĐÃ HOÀN THÀNH: ${sub.score} / 10</span>`;
            } else if (activeDraft) {
              statusBadgeHtml = `<span class="exam-status-badge in-progress" style="background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.5);color:#f59e0b;font-weight:700;">🔄 ĐANG LÀM DỞ DANG (~${Math.ceil(activeDraft.timeRemaining / 60)} phút còn lại)</span>`;
            } else if (isUpcoming) {
              statusBadgeHtml = `<span class="exam-status-badge pending" style="background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.5);color:#f59e0b;font-weight:700;">⏳ CHƯA ĐẾN GIỜ MỞ THI (Mở lúc ${exam.startTime})</span>`;
            } else if (isClosed) {
              statusBadgeHtml = `<span class="exam-status-badge banned" style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.5);color:#ef4444;font-weight:700;">🚫 ĐÃ KHÓA CỔNG THI: 0 / 10 ĐIỂM (VẮNG THI)</span>`;
            } else {
              statusBadgeHtml = `<span class="exam-status-badge pending" style="${isScheduled ? 'background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.5);color:#10b981;font-weight:700;' : ''}">${isScheduled ? `🟢 CỔNG ĐANG MỞ (Đóng lúc ${exam.entryDeadline || ''})` : '⏳ CHƯA LÀM (Chỉ 1 lượt)'}</span>`;
            }

            return `
              <div class="exam-card">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                    ${statusBadgeHtml}
                    <span style="font-size:11px;color:var(--dim);">
                      ${new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <h3 class="exam-card-title">${this._escapeHtml(exam.title)}</h3>

                  <div class="exam-meta-row">
                    <span class="exam-meta-pill">⏱️ ${exam.durationMinutes} phút</span>
                    <span class="exam-meta-pill">🔢 ${exam.questionIds.length} câu trắc nghiệm</span>
                    <span class="exam-meta-pill">🎯 Thang 10 điểm</span>
                    ${isScheduled ? `
                      <span class="exam-meta-pill" style="background:rgba(56,189,248,0.15);color:#38bdf8;font-weight:700;">
                        📅 ${exam.examDate ? exam.examDate.split('-').reverse().join('/') : ''} • ⏰ ${exam.startTime} ➔ ${exam.entryDeadline || ''}
                      </span>
                    ` : ''}
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
                  ` : isClosed ? `
                    <div style="font-size:12px;color:#ef4444;font-weight:700;">
                      ⚠️ Đã quá giờ mở phòng thi (${exam.entryDeadline || exam.startTime}). Thí sinh không vào thi tính là vắng thi (0 điểm).
                    </div>
                    <button type="button" class="btn-sm" disabled style="font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;opacity:0.5;cursor:not-allowed;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">
                      🚫 Đã Hết Giờ Vào
                    </button>
                  ` : isUpcoming ? `
                    <div style="font-size:12px;color:#f59e0b;font-weight:600;">
                      🔒 Cổng thi sẽ mở đúng lúc ${exam.startTime} ngày ${exam.examDate ? exam.examDate.split('-').reverse().join('/') : ''} • Đóng sau ${exam.lateEntryGraceMinutes || 15} phút
                    </div>
                    <button type="button" class="btn-sm" disabled style="font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;opacity:0.55;cursor:not-allowed;background:var(--panel-alt);border:1px solid var(--line);color:var(--dim);">
                      ⏳ Chưa Mở Cổng
                    </button>
                  ` : `
                    <div style="font-size:12px;color:${isScheduled ? '#10b981' : '#f59e0b'};font-weight:600;">
                      ${activeDraft ? '💡 Bài làm đã được tự động lưu an toàn trên máy' : (isScheduled ? `⚡ Cổng mở đến ${exam.entryDeadline || ''} • Vào làm ngay để nhận đủ ${exam.durationMinutes} phút` : '⚠️ Duy nhất 1 lượt làm • <strong style="color:#ef4444;">VI PHẠM</strong> 3 lần sẽ bị 0đ')}
                    </div>
                    <button type="button" class="btn-primary btn-start-exam" data-exam-id="${exam.id}" style="font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;${activeDraft ? 'background:#f59e0b;border-color:#f59e0b;color:#000;' : (isScheduled ? 'background:#10b981;border-color:#10b981;color:#fff;' : '')}">
                      ${activeDraft ? '🔄 Tiếp Tục Làm Bài' : (isScheduled ? '▶️ Bắt Đầu Vào Thi' : '▶️ Bắt Đầu Làm Bài')}
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

    const extraOfflineSec = (session.isOffline && session.offlineStartedAt)
      ? Math.max(0, Math.floor((Date.now() - session.offlineStartedAt) / 1000))
      : 0;
    const currentCumulativeAway = (session.cumulativeDisconnectedSeconds || 0) + extraOfflineSec;
    const remainingGraceSec = Math.max(0, 120 - currentCumulativeAway);
    const graceMin = Math.floor(remainingGraceSec / 60);
    const graceSec = remainingGraceSec % 60;
    const graceFormatted = `${String(graceMin).padStart(2, '0')}:${String(graceSec).padStart(2, '0')}`;
    const graceClass = remainingGraceSec > 60 ? 'safe' : (remainingGraceSec > 30 ? 'warning' : 'danger');

    const isViolationRecorded = session.awayViolationRecorded || session.violationCount > 0;
    const currentUser = authManager.getCurrentUser() || { fullName: 'Thí sinh', username: 'student' };
    const isScreenGuarded = Boolean(session.isAway || session.lockdownPending);
    let overlayTitle = isViolationRecorded ? 'Cảnh Báo: Đã Ghi Nhận Vi Phạm Quy Chế!' : 'Cảnh Báo: Rời Màn Hình Làm Bài!';
    let overlayIcon = isViolationRecorded ? '❌' : '⚠️';
    let violationDetailMessage = 'Hệ thống phát hiện bạn vừa chuyển tab (Alt+Tab), bấm F11, rời cửa sổ làm bài hoặc thoát toàn màn hình. Thời gian rời màn hình được tính <strong>cộng dồn</strong>.';

    if (session.awayReason === 'mobile_back_button_pressed') {
      overlayTitle = 'Cảnh Báo: Bấm Nút Quay Lại Trên Điện Thoại!';
      overlayIcon = '🚫';
      violationDetailMessage = 'Hệ thống phát hiện bạn vừa <strong>bấm nút Quay lại (Back/Gesture)</strong> trên điện thoại! Hành vi này đã bị chặn và tính <strong>1 lần vi phạm quy chế</strong>.';
    } else if (session.awayReason === 'mobile_drawer_or_blur') {
      overlayTitle = 'Cảnh Báo: Kéo Thanh Thông Báo / Chuyển Ứng Dụng!';
      overlayIcon = '📱';
      violationDetailMessage = 'Hệ thống phát hiện bạn vừa <strong>kéo thanh thông báo (Notification Shade)</strong>, mở Cài đặt nhanh hoặc chuyển ứng dụng trên điện thoại! Vui lòng quay lại ngay.';
    } else if (session.awayReason === 'split_screen_detected') {
      overlayTitle = 'Cảnh Báo: Phát Hiện Chia Đôi Màn Hình!';
      overlayIcon = '📱';
      violationDetailMessage = 'Hệ thống phát hiện bạn đang bật <strong>Chế độ chia đôi màn hình (Split-Screen)</strong> hoặc Cửa sổ nổi! Vui lòng mở toàn màn hình để tiếp tục thi.';
    } else if (session.awayReason === 'three_finger_screenshot_attempt') {
      overlayTitle = 'Cảnh Báo: Chặn Cử Chỉ Chụp Màn Hình 3 Ngón Tay!';
      overlayIcon = '📸';
      violationDetailMessage = 'Hệ thống phát hiện bạn vừa dùng <strong>cử chỉ chạm 3 ngón tay để chụp ảnh màn hình</strong> bài thi! Mọi hành vi chụp / quét đề thi đều bị chặn và tính 1 lần vi phạm.';
    } else if (session.awayReason === 'quick_assistant_detected') {
      overlayTitle = 'Cảnh Báo: Kích Hoạt Trợ Lý Ảo / Quét Màn Hình Nhanh!';
      overlayIcon = '🤖';
      violationDetailMessage = 'Hệ thống phát hiện thao tác <strong>chớp màn hình / gọi Trợ lý AI (Google Assistant, Circle to Search, Gemini, Siri)</strong>! Toàn bộ nội dung đề thi đã bị che đen chống quét và tính 1 lần vi phạm.';
    } else if (session.awayReason === 'voice_cheating_detected') {
      overlayTitle = 'Cảnh Báo: Phát Hiện Nói Chuyện / Trợ Lý Giọng Nói AI!';
      overlayIcon = '🎙️';
      violationDetailMessage = 'Hệ thống phát hiện có <strong>tiếng người nói chuyện hoặc ra lệnh bằng giọng nói (Gemini Voice, Google Assistant, Siri)</strong> trong phòng thi! Đề thi đã bị che đen bảo mật và tính <strong>1 lần vi phạm quy chế</strong>.';
    } else if (session.awayReason === 'assistant_overlay_intercept') {
      overlayTitle = 'Cảnh Báo: Trợ Lý Hệ Thống Chiếm Quyền Màn Hình!';
      overlayIcon = '🤖';
      violationDetailMessage = 'Hệ thống phát hiện thao tác <strong>ngắt cảm ứng bởi Trợ lý hệ thống (Circle to Search, Google Assistant, Gemini)</strong>! Toàn bộ nội dung đề thi đã bị che đen chống quét và tính 1 lần vi phạm.';
    } else if (session.awayReason === 'long_press_ai_assist_attempt') {
      overlayTitle = 'Cảnh Báo: Chặn Nhấn Giữ Gọi Trợ Lý Ảo!';
      overlayIcon = '✋';
      violationDetailMessage = 'Hệ thống phát hiện thao tác <strong>nhấn giữ màn hình lâu (Long-press để gọi Circle to Search hoặc Google Lens)</strong>! Hành vi này đã bị chặn và tính 1 lần vi phạm.';
    }

    const lockdownOverlay = session.lockdownPending ? `
      <div class="exam-lockdown-overlay" role="dialog" aria-modal="true" aria-labelledby="examLockdownTitle"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;">
        <div class="exam-lockdown-dialog" style="background:var(--panel,#1e2130);border:2px solid ${(session.awayViolationRecorded || session.violationCount > 0) ? '#ef4444' : '#f59e0b'};border-radius:16px;padding:32px 28px;max-width:480px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.7);text-align:center;box-sizing:border-box;">
          <div class="exam-lockdown-icon" style="font-size:46px;margin-bottom:12px;">${overlayIcon}</div>
          <h2 id="examLockdownTitle" style="font-size:20px;font-weight:800;color:${(session.awayViolationRecorded || session.violationCount > 0) ? '#ef4444' : '#fbbf24'};margin:0 0 10px;">
            ${overlayTitle}
          </h2>
          <p style="font-size:14px;color:var(--text,#e2e8f0);line-height:1.5;margin:0 0 14px;">
            ${violationDetailMessage}
          </p>
          ${(session.awayViolationRecorded || session.violationCount > 0) ? `
            <div class="exam-lockdown-warning" role="alert" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:12px;color:#f87171;font-weight:700;font-size:13.5px;margin-bottom:18px;">
              Đã hết 10 giây hoặc vi phạm quy chế nghiêm trọng!<br>
              Tổng số vi phạm: <strong style="font-size:16px;color:#ef4444;">${session.violationCount}/3</strong> (Đủ 3 lần sẽ bị 0đ và dừng bài thi).<br>
              <span style="font-size:12px;color:#fca5a5;font-weight:500;">Thời gian rời cộng dồn còn: <strong id="examLockdownCountdown">${lockdownCountdown !== null ? lockdownCountdown : 10}</strong> giây trước khi bị cộng thêm 1 vi phạm.</span>
            </div>
          ` : `
            <div class="exam-lockdown-countdown" role="status" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:14px;color:#fbbf24;font-size:14.5px;margin-bottom:18px;">
              Thời gian rời cộng dồn còn: <strong id="examLockdownCountdown" style="font-size:26px;color:#f59e0b;margin:0 4px;">${lockdownCountdown !== null ? lockdownCountdown : 10}</strong> giây để tránh bị cộng thêm 1 vi phạm.<br>
              <span style="font-size:12px;color:var(--dim,#94a3b8);margin-top:4px;display:block;">(Số vi phạm hiện tại: ${session.violationCount}/3)</span>
            </div>
          `}
          <button type="button" class="btn-primary" id="btnResumeExamLockdown" style="width:100%;padding:12px 20px;font-size:15px;font-weight:700;border-radius:8px;background:var(--accent,#38bdf8);color:#000;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span>🔄</span> Quay trở lại bài thi
          </button>
        </div>
      </div>
    ` : '';

    return `
      <div class="active-exam-room ${isScreenGuarded ? 'screen-guarded' : ''}">
        <!-- Zero-Latency Anti-Screen Capture Shield -->
        <div id="examAntiCaptureShield" class="exam-anti-capture-shield" style="${isScreenGuarded ? 'display:flex;' : 'display:none;'}">
          <div style="background:var(--panel,#1e2130);border:2px solid #ef4444;border-radius:14px;padding:24px 20px;max-width:380px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.8);">
            <div style="font-size:38px;margin-bottom:10px;">🔒</div>
            <div style="font-size:16px;font-weight:800;color:#f87171;margin-bottom:8px;">
              ĐANG BẢO VỆ MÀN HÌNH BÀI THI
            </div>
            <div style="font-size:13px;color:var(--text,#e2e8f0);line-height:1.5;">
              Nội dung đề thi được che đen bảo mật tự động khi phát hiện mất tiêu điểm, chụp màn hình hoặc kích hoạt ứng dụng nổi.
            </div>
          </div>
        </div>

        <!-- Dynamic Anti-Photo Personalized Watermark -->
        <div class="exam-dynamic-watermark" aria-hidden="true">
          <div class="watermark-item">${this._escapeHtml(currentUser.fullName || currentUser.username)} • ${this._escapeHtml(currentUser.username)} • ${this._escapeHtml(exam.id)}</div>
          <div class="watermark-item">${this._escapeHtml(currentUser.fullName || currentUser.username)} • ${this._escapeHtml(currentUser.username)} • ${this._escapeHtml(exam.id)}</div>
          <div class="watermark-item">${this._escapeHtml(currentUser.fullName || currentUser.username)} • ${this._escapeHtml(currentUser.username)} • ${this._escapeHtml(exam.id)}</div>
          <div class="watermark-item">${this._escapeHtml(currentUser.fullName || currentUser.username)} • ${this._escapeHtml(currentUser.username)} • ${this._escapeHtml(exam.id)}</div>
        </div>

        ${lockdownOverlay}

        ${(this._supportsFullscreen() && !this._getFullscreenElement() && !session.lockdownPending) ? `
          <div class="active-exam-fullscreen-banner" id="mobileFullscreenWarningBanner" style="background:#f59e0b;color:#000;padding:12px 16px;border-radius:10px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:700;font-size:13.5px;box-shadow:0 4px 12px rgba(245,158,11,0.25);">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">⛶</span>
              <span>Chưa bật Toàn Màn Hình! Vui lòng bấm kích hoạt để tuân thủ quy chế thi.</span>
            </div>
            <button type="button" class="btn-primary" id="btnTriggerExamFullscreen" style="background:#000;color:#fff;padding:8px 16px;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">
              ⛶ Bật Toàn Màn Hình
            </button>
          </div>
        ` : ''}

        ${session.isOffline ? `
          <div class="active-exam-offline-banner" id="examOfflineBanner">
            <span>📡 <strong>CẢNH BÁO: MẤT KẾT NỐI INTERNET!</strong> Quỹ thời gian offline còn lại: <strong id="examOfflineTimeText">${graceFormatted}</strong></span>
            <span style="font-size:11.5px;opacity:0.9;">Vui lòng kết nối lại Wi-Fi / 4G ngay!</span>
          </div>
        ` : ''}
        
        <!-- Top bar: Title, Timer, Submitting -->
        <div class="active-exam-topbar">
          <div class="active-exam-header-left">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
              <span style="font-size:11.5px;color:var(--accent);font-weight:700;text-transform:uppercase;">
                Phòng Thi Trực Tuyến • Đang Chấm Giờ
              </span>
              <!-- Auto-save status indicator (Nhiệm vụ 3) -->
              <span class="exam-autosave-badge" id="examAutosaveBadge" title="Hệ thống tự động ghi nhận bài làm từng giây">
                <span class="autosave-dot"></span>
                <span>🟢 Đã tự động lưu bài</span>
              </span>
              <!-- 2-Minute Disconnect / Away Grace Indicator -->
              <span class="active-exam-grace-box ${graceClass}" id="examGraceBadge" title="Quỹ thời gian mất mạng hoặc rời phòng thi cho phép (Tối đa tích lũy 2 phút cho cả ca thi)">
                <span>📶 Quỹ vắng mặt:</span>
                <span id="examGraceTimeText" style="font-family:monospace;font-size:12.5px;">${graceFormatted}</span>
              </span>
              <!-- Anti-Voice / Real-time Microphone Audio Proctoring Indicator -->
              <span class="active-exam-mic-box" id="examMicBadge" title="Giám sát âm thanh phòng thi: Nghiêm cấm nói chuyện hoặc ra lệnh cho trợ lý AI">
                <span>🎙️ Chống AI giọng nói: Đang bật</span>
              </span>
            </div>
            <h2 style="font-size:19px;font-weight:700;color:var(--text);margin:0;line-height:1.3;word-break:break-word;">
              ${this._escapeHtml(exam.title)}
            </h2>
          </div>

          <div class="active-exam-actions-wrap" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- Countdown Timer -->
            <div class="active-exam-timer-box ${isUrgent ? 'urgent' : ''}" id="activeExamTimer">
              ⏱️ ${timeFormatted}
            </div>

            <!-- Fullscreen Toggle Button -->
            <button type="button" class="btn-fullscreen-toggle" id="btnToggleExamFullscreen" title="Bật/Tắt chế độ Toàn Màn Hình">
              ⛶ Toàn màn hình
            </button>

            <!-- Submit Button (Min height 44px-48px) -->
            <button type="button" class="btn-primary" id="btnSubmitActiveExam" style="background:#10b981;border-color:#10b981;font-weight:700;font-size:14px;padding:10px 20px;min-height:46px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">
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
          
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:700;background:var(--panel);border:1px solid var(--line);padding:4px 12px;border-radius:6px;color:var(--text);white-space:nowrap;">
                Câu ${session.currentQIndex + 1} / ${totalQ}
              </span>
            </div>
            <span class="pill-badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;">
              ${currentQ.topicName || currentQ.topic}
            </span>
          </div>

          <div class="exam-question-text-wrap" style="font-size:16.5px;font-weight:600;color:var(--text);line-height:1.6;margin-bottom:24px;border-left:4px solid var(--accent);padding-left:14px;word-break:break-word;overflow-wrap:break-word;" data-anti-ai="protected">
            ${this._injectAntiAiNoise(this._formatExamContent(currentQ.question))}
          </div>

          <!-- Options -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${displayedOptions.map((opt, optionIndex) => {
              const isSelected = selectedOpt === opt.id;
              const displayLabel = String.fromCharCode(65 + optionIndex);
              let style = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-size:14px;text-align:left;cursor:pointer;transition:all 0.15s ease;width:100%;min-height:48px;line-height:1.5;box-sizing:border-box;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;`;
              let badgeStyle = `background:var(--line);color:var(--text);`;

              if (isSelected) {
                style = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;background:rgba(56,189,248,0.15);border:2px solid var(--accent);color:var(--text);font-size:14px;text-align:left;cursor:pointer;width:100%;min-height:48px;line-height:1.5;box-sizing:border-box;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;`;
                badgeStyle = `background:var(--accent);color:#000;font-weight:bold;`;
              }

              return `
                <button type="button" class="btn-active-exam-opt ${isSelected ? 'selected' : ''}" data-opt-id="${opt.id}" style="${style}">
                  <span class="opt-badge" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:13px;font-weight:700;flex-shrink:0;margin-top:2px;${badgeStyle}">
                    ${displayLabel}
                  </span>
                  <span class="opt-text" style="flex:1;min-width:0;font-weight:500;white-space:normal !important;word-break:break-word !important;overflow-wrap:anywhere !important;line-height:1.5;">${this._injectAntiAiNoise(this._formatExamContent(opt.text))}</span>
                  ${isSelected ? '<span class="opt-selected-tag" style="color:var(--accent);font-weight:bold;font-size:12.5px;flex-shrink:0;white-space:nowrap;margin-left:8px;margin-top:2px;">● Đã chọn</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

        </div>

        <!-- Question Navigation Bottom Bar -->
        <div class="exam-navigation-bar">
          <button type="button" class="btn-secondary" id="btnExamPrevQ" ${session.currentQIndex === 0 ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : ''}>
            ❮ Câu trước
          </button>
          
          <div class="exam-progress-counter" style="font-size:13px;color:var(--dim);text-align:center;">
            Câu <strong>${session.currentQIndex + 1}</strong>/${totalQ} • Đã làm: <strong>${answeredCount}</strong>/${totalQ}
          </div>

          ${session.currentQIndex === totalQ - 1 ? `
            <button type="button" class="btn-primary" id="btnExamNextQSubmit" style="background:#10b981;border-color:#10b981;font-weight:700;box-shadow:0 2px 10px rgba(16,185,129,0.3);">
              Nộp bài 📤
            </button>
          ` : `
            <button type="button" class="btn-secondary btn-exam-next-primary" id="btnExamNextQ">
              Câu tiếp ❯
            </button>
          `}
        </div>

        <!-- ── Submit Confirm Modal (in-DOM, keeps fullscreen) ─────────────── -->
        ${session._showSubmitConfirm ? `
          <div id="examSubmitConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="examSubmitConfirmTitle"
            style="position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
                   background:rgba(0,0,0,0.72);backdrop-filter:blur(3px);padding:16px;box-sizing:border-box;">
            <div style="background:var(--panel,#1e2130);border:1px solid var(--line,#2a2f45);border-radius:14px;
                        padding:32px 28px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,0.6);
                        display:flex;flex-direction:column;gap:18px;text-align:center;">
              <div style="font-size:42px;line-height:1;">📤</div>
              <h3 id="examSubmitConfirmTitle"
                  style="margin:0;font-size:18px;font-weight:700;color:var(--text,#e2e8f0);line-height:1.4;">
                Xác nhận nộp bài thi
              </h3>
              ${(totalQ - answeredCount) > 0 ? `
                <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);
                            border-radius:8px;padding:12px 16px;color:#f87171;font-size:14px;font-weight:600;">
                  ⚠️ Bạn vẫn còn <strong>${totalQ - answeredCount} câu</strong> chưa chọn đáp án!
                </div>
              ` : `
                <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);
                            border-radius:8px;padding:12px 16px;color:#34d399;font-size:14px;font-weight:600;">
                  ✅ Bạn đã hoàn thành tất cả ${totalQ} câu hỏi.
                </div>
              `}
              <p style="margin:0;font-size:14px;color:var(--dim,#94a3b8);line-height:1.6;">
                Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?<br>
                <span style="color:#f87171;font-weight:600;">Hành động này không thể hoàn tác.</span>
              </p>
              <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                <button type="button" id="btnExamConfirmCancel"
                  style="flex:1;min-width:140px;padding:12px 20px;border-radius:8px;border:1px solid var(--line,#2a2f45);
                         background:var(--panel-alt,#252b3b);color:var(--text,#e2e8f0);font-size:14px;font-weight:600;
                         cursor:pointer;transition:background 0.15s;">
                  ❮ Tiếp tục làm bài
                </button>
                <button type="button" id="btnExamConfirmSubmit"
                  style="flex:1;min-width:140px;padding:12px 20px;border-radius:8px;border:1px solid #10b981;
                         background:#10b981;color:#fff;font-size:14px;font-weight:700;
                         cursor:pointer;transition:background 0.15s;">
                  Nộp bài 📤
                </button>
              </div>
            </div>
          </div>
        ` : ''}
        <!-- ── End Submit Confirm Modal ───────────────────────────────────── -->

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
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <button type="button" class="btn-primary" id="btnBackToExamsFromScore" style="padding:10px 24px;font-weight:700;font-size:13.5px;">
                📋 Quay Về Danh Sách Đề Thi
              </button>
              <button type="button" class="btn-sm" id="btnDownloadMySlip" style="padding:10px 18px;font-size:13px;font-weight:700;background:var(--panel);border:1px solid var(--line);border-radius:6px;color:var(--text);cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                <span>📥</span> Tải Phiếu Dự Phòng (.json)
              </button>
            </div>
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
    const distinctClasses = Array.from(new Set(allStudents.map(s => (s.className || 'Sinh viên').trim()))).filter(Boolean).sort();
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
    const printPool = this._getStudioPrintPool();
    const printPoolSize = printPool.length;
    const currentStudioCount = (this.studioConfig.count && !isNaN(parseInt(this.studioConfig.count, 10)) && parseInt(this.studioConfig.count, 10) > 0)
      ? Math.min(parseInt(this.studioConfig.count, 10), printPoolSize)
      : printPoolSize;

    const distSummary = this._getDistributedSummary();
    const defaultExamTitle = (this.studioAssignTitle !== null && this.studioAssignTitle !== undefined)
      ? this.studioAssignTitle
      : this._getNextExamTitle();
    const defaultExamCode = (this.studioAssignExamCode !== null && this.studioAssignExamCode !== undefined)
      ? this.studioAssignExamCode
      : this._getNextExamCode();
    const defaultDuration = (this.studioAssignDuration !== null && this.studioAssignDuration !== undefined && this.studioAssignDuration !== '')
      ? this.studioAssignDuration
      : (distSummary.totalSelected > 0 ? Math.max(15, Math.round(distSummary.totalSelected * 1.5)) : 15);

    const nowForSchedule = new Date();
    const defaultStartHour = (nowForSchedule.getHours() + 1) % 24;
    const defaultStartHourStr = String(defaultStartHour).padStart(2, '0');
    const defaultStartMinuteStr = '00';
    const defaultStartTimeStr = `${defaultStartHourStr}:${defaultStartMinuteStr}`;

    return `
      <!-- Studio Subtab Navigation (3 Tabs) -->
      <div class="studio-subtabs-nav no-print" style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid var(--line);padding-bottom:10px;flex-wrap:wrap;">
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
          <div class="studio-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">

            <!-- Action Toolbar: Download Sample & Clear Data -->
            <div class="studio-toolbar-actions" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:12px 16px;">
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
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                      <h4 style="margin:0;font-size:13.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                        <span>📂 Danh Sách Các File Đã Nạp (${this.importedFiles.length})</span>
                      </h4>
                      <span class="pill-badge" id="cloudFileStatusBadge" style="background:rgba(59,130,246,0.15);color:#3b82f6;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;">
                        ☁️ Đã đồng bộ Cloud (PC ⇆ ĐT)
                      </span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <button type="button" class="btn-sm" id="btnSyncCloudFiles" style="background:var(--panel-alt);border:1px solid var(--line);padding:4px 10px;font-size:12px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:5px;" title="Tải các file mới nhất từ máy chủ đám mây">
                        <span>🔄</span>
                        <span>Đồng bộ ngay</span>
                      </button>
                      <span style="font-size:12px;color:#10b981;font-weight:600;">
                        Tổng cộng: ${this.importedQuestions.length} câu hỏi tự soạn
                      </span>
                    </div>
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
                <div style="text-align:center;padding:24px 16px;background:var(--panel);border:1px dashed var(--line);border-radius:8px;">
                  <div style="font-size:26px;margin-bottom:6px;">☁️📂</div>
                  <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:4px;">Chưa có câu hỏi tự soạn nào trên thiết bị này</div>
                  <div style="font-size:12px;color:var(--dim);max-width:520px;margin:0 auto 12px;line-height:1.5;">
                    Vui lòng tải file mẫu Word về soạn câu hỏi rồi nạp lên, hoặc nếu bạn đã nạp file trên máy tính/điện thoại khác, bấm nút đồng bộ bên dưới để kéo file về!
                  </div>
                  <button type="button" class="btn-sm" id="btnSyncCloudFilesEmpty" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);padding:6px 14px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                    🔄 Tải file từ Đám mây (Cloud Sync)
                  </button>
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- SUB-TAB 2: PHÂN PHỐI & PHÁT ĐỀ THI CHO SINH VIÊN (DEDICATED PUBLISH TAB) -->
        <div id="studioPublishSection" style="display:${(this.studioSubTab === 'publish' || this.studioSubTab === 'assign') ? 'block' : 'none'};">
          <div class="studio-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:24px;">

            <!-- DEDICATED SECTION: MULTI-FILE QUESTION DISTRIBUTION -->
            <div id="sectionMultiFileDistribution" class="studio-inner-card" style="background:var(--panel-alt);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:20px;">
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
                          ? Math.max(0, parseInt(this.fileDistributions[f.id], 10) || 0)
                          : fileCount;
                        const isExceeded = selectedCount > fileCount;
                        return `
                          <tr class="row-distribute-file" data-file-id="${f.id}">
                            <td style="font-weight:600;color:var(--text);">
                              📄 ${this._escapeHtml(f.name)}
                            </td>
                            <td style="text-align:center;">
                              <span class="pill-badge" style="background:rgba(59,130,246,0.12);color:#3b82f6;padding:2px 8px;border-radius:6px;font-weight:700;">
                                ${fileCount} câu
                              </span>
                            </td>
                            <td style="text-align:center;">
                              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">
                                <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                                  <input type="number" min="0" value="${selectedCount}"
                                    class="form-input input-distribute-file-count"
                                    data-file-id="${f.id}"
                                    placeholder="0"
                                    autocomplete="off"
                                    style="width:78px;padding:6px 8px;text-align:center;font-size:13.5px;font-weight:700;border-radius:6px;background:var(--panel-alt);border:1.5px solid ${isExceeded ? '#ef4444' : 'var(--line)'};color:${isExceeded ? '#ef4444' : 'var(--text)'};position:relative;z-index:2;pointer-events:auto;touch-action:manipulation;" />
                                  <span class="span-dist-file-max" style="font-size:12px;color:${isExceeded ? '#ef4444' : 'var(--dim)'};font-weight:600;">/ ${fileCount}</span>
                                </div>
                                ${isExceeded ? `<span class="dist-file-warning-msg" style="font-size:10.5px;color:#ef4444;font-weight:600;">⚠️ Vượt quá ${fileCount} câu</span>` : ''}
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
                <div class="studio-dist-quick-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:8px;">
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

                  <div id="distQuickTotalSummary" style="font-weight:700;color:#10b981;font-size:13.5px;display:flex;align-items:center;gap:6px;">
                    <span>🎯 Đã chọn: ${distSummary.totalSelected} / ${distSummary.totalAvailable} câu</span>
                  </div>
                </div>
              `}
            </div>

            <!-- Distribution Info Banner (No jump-back buttons) -->
            <div id="distSummaryInfoBanner">
              ${this._renderDistSummaryBanner(distSummary)}
            </div>

            <!-- CONFIGURATION BAR -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-bottom:16px;">
              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Tiêu đề đề thi: *</label>
                <input type="text" id="txtAssignTitle" class="form-input" placeholder="Ví dụ: Đề 1, Đề 2, ..." value="${this._escapeHtml(defaultExamTitle)}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;font-weight:600;" />
              </div>

              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Thời gian làm bài (phút): *</label>
                <input type="number" min="1" max="180" id="numAssignDuration" value="${defaultDuration}" placeholder="15" autocomplete="off" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;font-weight:700;position:relative;z-index:2;pointer-events:auto;touch-action:manipulation;" />
              </div>

              <div>
                <label style="display:block;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;">Mã đề thi (Exam Code):</label>
                <input type="text" id="txtAssignExamCode" class="form-input" placeholder="Ví dụ: 101, 102..." value="${this._escapeHtml(defaultExamCode)}" style="width:100%;padding:8px 12px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-size:13px;font-family:monospace;font-weight:700;" />
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
                  <input type="radio" name="assignTarget" value="class" id="radAssignClass" />
                  <strong>Giao theo Lớp học cụ thể</strong>
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text);">
                  <input type="radio" name="assignTarget" value="custom" id="radAssignCustom" />
                  <strong>Chọn danh sách sinh viên cụ thể</strong>
                </label>
              </div>

              <!-- Class Selection Dropdown (hidden by default) -->
              <div id="assignClassWrap" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);">
                <div style="font-size:12px;color:var(--dim);margin-bottom:6px;">Chọn lớp học nhận đề thi này:</div>
                <select id="selAssignClass" style="padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);min-width:260px;">
                  ${distinctClasses.length > 0 ? distinctClasses.map(c => {
                    const countInClass = allStudents.filter(s => (s.className || 'Sinh viên').trim() === c).length;
                    return `<option value="${this._escapeHtml(c)}">🏫 Lớp: ${this._escapeHtml(c)} (${countInClass} sinh viên)</option>`;
                  }).join('') : '<option value="Sinh viên">🏫 Lớp: Sinh viên</option>'}
                </select>
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

            <!-- SCHEDULE / TIMED ENTRY WINDOW CONFIGURATION -->
            <div style="background:var(--panel-alt);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:18px;">
              <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                <span>⏰ Lập Lịch Thi &amp; Khóa Cổng Vào Phòng Thi:</span>
              </div>
              <div style="display:flex;gap:20px;margin-bottom:10px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text);">
                  <input type="radio" name="scheduleType" value="flexible" checked id="radSchedFlexible" />
                  <strong>🌐 Tự do</strong> (Sinh viên có thể vào thi bất kỳ lúc nào)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--text);">
                  <input type="radio" name="scheduleType" value="scheduled" id="radSchedFixed" />
                  <strong>📅 Cố định theo khung giờ</strong> (Khóa cổng theo ngày và giờ quy định)
                </label>
              </div>

              <!-- Fixed Schedule Controls (hidden by default) -->
              <div id="scheduleSettingsWrap" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);">
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:12px;">
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
                      📅 Ngày thi: *
                    </label>
                    <input type="date" id="dtExamDate" min="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;" />
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
                      ⏰ Giờ mở cổng (Khung 24h: 00h - 23h): *
                    </label>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <select id="selStartHour" style="flex:1;padding:8px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;">
                        ${Array.from({length: 24}, (_, i) => {
                          const hStr = String(i).padStart(2, '0');
                          let note = '';
                          if (i === 0) note = ' (00:00 - Nửa đêm)';
                          else if (i < 6) note = ' (Đêm / Rạng sáng)';
                          else if (i < 11) note = ' (Sáng)';
                          else if (i === 11 || i === 12) note = ' (Trưa)';
                          else if (i < 18) note = ` (${i - 12}h Chiều)`;
                          else if (i < 22) note = ` (${i - 12}h Tối)`;
                          else note = ` (${i - 12}h Đêm)`;
                          return `<option value="${hStr}" ${i === defaultStartHour ? 'selected' : ''}>${hStr} giờ${note}</option>`;
                        }).join('')}
                      </select>
                      <span style="font-weight:800;color:var(--dim);font-size:16px;">:</span>
                      <select id="selStartMinute" style="width:105px;padding:8px 8px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;">
                        ${Array.from({length: 60}, (_, i) => {
                          const mStr = String(i).padStart(2, '0');
                          return `<option value="${mStr}" ${i === 0 ? 'selected' : ''}>${mStr} phút</option>`;
                        }).join('')}
                      </select>
                      <input type="hidden" id="tmStartTime" value="${defaultStartTimeStr}" />
                    </div>
                  </div>
                  <div>
                    <label style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
                      ⏳ Thời gian ân hạn vào thi (phút): *
                    </label>
                    <input type="number" id="numLateGrace" min="1" max="120" value="15" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:700;" />
                  </div>
                </div>

                <div style="padding:10px 14px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:6px;font-size:12px;color:var(--dim);line-height:1.5;">
                  💡 <strong style="color:var(--text);">Quy chế khóa cổng:</strong> Sinh viên chỉ được bấm vào thi trong khung giờ mở (Ví dụ: Giờ mở 07:00 + 15 phút ân hạn ➔ Được vào thi từ <strong>07:00 đến 07:15</strong>). Sau 07:15, cổng đóng hoàn toàn. Thí sinh đến trễ hoặc không vào thi sẽ bị <strong>0 điểm (Ghi chú: Vắng thi)</strong>. Khi đã vào phòng đúng giờ, thí sinh nhận đủ trọn vẹn số phút làm bài quy định.
                </div>

                <!-- Real-time Schedule Validation Feedback -->
                <div id="scheduleTimeNotice" style="margin-top:10px;padding:9px 14px;border-radius:6px;font-size:12px;font-weight:600;display:none;line-height:1.5;"></div>
              </div>
            </div>

            <div class="studio-assign-action-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div class="studio-assign-action-hint" style="font-size:12.5px;color:var(--dim);">
                ${distSummary.totalSelected > 0
                  ? `<span style="color:#10b981;font-weight:700;">✅ Sẵn sàng phát đề với ${distSummary.totalSelected} câu hỏi tự soạn đã phân phối.</span>`
                  : '⚠️ Vui lòng phân phối câu hỏi ở tab Phân Phối Đề trước khi phát.'}
              </div>
              <button type="button" class="btn-primary btn-studio-assign" id="btnCreateAndAssignExam" style="cursor:pointer;">
                <span class="btn-assign-icon">🚀</span>
                <span class="btn-assign-text">Phát Đề Cho Sinh Viên</span>
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
          <div class="exam-studio-controls studio-card no-print" style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;">
                  <span>👩‍🏫 Studio Soạn Đề Thi Trắc Nghiệm Chuẩn A4</span>
                </div>
                <p style="font-size:12px;color:var(--dim);margin:3px 0 0;">
                  Tạo đề thi chuẩn mẫu Bộ GD&amp;ĐT &amp; Đại học, in trực tiếp ra giấy A4 hoặc chép mã nguồn LaTeX cho Overleaf.
                </p>
              </div>

              <!-- Quick Action Buttons -->
              <div class="studio-print-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn-primary" id="btnPrintExam" style="padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">
                  🖨️ In Đề / Xuất PDF (A4)
                </button>
                <button type="button" class="btn-secondary" id="btnCopyLatex" style="padding:8px 16px;font-size:13px;font-weight:600;border:1px solid var(--line);cursor:pointer;">
                  📋 Sao Chép Mã LaTeX (.tex)
                </button>
                <button type="button" class="btn-sm" id="btnGenNewExam" style="padding:8px 14px;font-size:13px;background:var(--panel-alt);border:1px solid var(--accent);color:var(--accent);font-weight:600;cursor:pointer;">
                  🎲 Đổi Mã Ngẫu Nhiên
                </button>
              </div>
            </div>

            <!-- Configuration Bar: Nguồn đề + Số lượng câu (chọn thoải mái) -->
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="color:var(--dim);font-weight:600;">Nguồn đề:</span>
                <select id="selStudioPrintSource" class="form-input" style="padding:5px 10px;font-size:12.5px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:600;max-width:380px;cursor:pointer;">
                  <option value="all_word" ${this.studioPrintSource === 'all_word' || !this.studioPrintSource ? 'selected' : ''}>
                    📂 Tất cả câu hỏi Word (${this.importedQuestions.length} câu)
                  </option>
                  ${distSummary.totalSelected > 0 ? `
                    <option value="distributed" ${this.studioPrintSource === 'distributed' ? 'selected' : ''} title="${distSummary.breakdown.map(b => `${b.fileName} [${b.selectedCount}]`).join(', ')}">
                      🎯 Bộ câu hỏi đã phân phối (${distSummary.totalSelected} câu từ ${distSummary.breakdown.length} bộ đề)
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
                    autocomplete="off"
                    style="width:80px;padding:5px 8px;font-size:13px;border-radius:6px;background:var(--panel-alt);border:1px solid var(--line);color:var(--text);font-weight:700;text-align:center;position:relative;z-index:2;pointer-events:auto;touch-action:manipulation;" />
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
                <div id="printHeaderExamCode" style="display:inline-block;margin-top:6px;padding:3px 12px;border:1.5px solid #000;font-size:13px;font-weight:bold;">
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
              <div id="printTeacherKeyExamCode" style="font-size:13px;font-weight:bold;color:#047857;margin-top:3px;">
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

    const assignedStudents = this._resolveAssignedStudents(exam.assignedTo);
    const submittedUserIds = new Set(submissions.map(s => s.userId).filter(Boolean));
    submissions.forEach(s => {
      if (s.username) submittedUserIds.add(s.username.toLowerCase());
    });

    const unsubmittedStudents = assignedStudents.filter(st => {
      return !submittedUserIds.has(st.id) && !submittedUserIds.has((st.username || '').toLowerCase());
    });

    const sched = examManager.getExamScheduleStatus(exam);
    const isClosed = sched.isScheduled && sched.status === 'closed';

    return `
      <div class="gradebook-modal-backdrop" id="gradebookModalBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:980px;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;">
          <div style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;">
                📊 Sổ Điểm Điện Tử &amp; Danh Sách Nộp Bài
              </div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:2px 0 0;">
                ${this._escapeHtml(exam.title)}
              </h3>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
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
              <span style="font-size:12px;color:var(--dim);">Tổng sinh viên được phân:</span>
              <strong style="color:var(--text);margin-left:6px;font-size:15px;">${assignedStudents.length}</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">Đã nộp bài:</span>
              <strong style="color:#10b981;margin-left:6px;font-size:15px;">${submissions.length}</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">${isClosed ? 'Vắng thi (0đ):' : 'Chưa nộp bài:'}</span>
              <strong style="color:${isClosed && unsubmittedStudents.length > 0 ? '#ef4444' : 'var(--text)'};margin-left:6px;font-size:15px;">${unsubmittedStudents.length}</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">Điểm TB bài nộp:</span>
              <strong style="color:var(--accent);margin-left:6px;font-size:15px;">${avgScore.toFixed(1)} / 10</strong>
            </div>
            <div>
              <span style="font-size:12px;color:var(--dim);">Thời lượng:</span>
              <strong style="color:var(--text);margin-left:6px;font-size:15px;">${exam.durationMinutes} phút (${exam.questionIds.length} câu)</strong>
            </div>
            ${sched.isScheduled ? `
              <div style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(56,189,248,0.12);color:#38bdf8;font-weight:600;">
                📅 Lịch: ${exam.startTime} ngày ${exam.examDate ? exam.examDate.split('-').reverse().join('/') : ''} (Khóa: ${exam.entryDeadline || ''})
              </div>
            ` : ''}
          </div>

          <div style="padding:20px 24px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;flex:1;">
            ${(submissions.length === 0 && unsubmittedStudents.length === 0) ? `
              <div style="text-align:center;padding:40px;color:var(--dim);font-style:italic;">
                Chưa có sinh viên nào trong danh sách được phân của đề thi này.
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
                    <th style="text-align:right;">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${submissions.map(sub => {
                    const allUsers = (typeof authManager !== 'undefined' && typeof authManager.getUsers === 'function')
                      ? authManager.getUsers()
                      : ((typeof authManager !== 'undefined' && typeof authManager.getAllUsers === 'function') ? authManager.getAllUsers() : []);
                    const user = allUsers.find(u => u.id === sub.userId || (u.username && u.username.toLowerCase() === (sub.userId || '').toLowerCase()));
                    const username = sub.username || user?.username || (sub.userId && !sub.userId.startsWith('user_') ? sub.userId : '');
                    const displayName = sub.fullName || sub.studentName || user?.fullName || (username ? `@${username}` : (sub.userId || 'Sinh viên'));
                    const displayClass = sub.className || sub.studentClass || user?.className || 'Sinh viên';
                    const displayAvatar = sub.avatar || user?.avatar || '👤';

                    return `
                    <tr>
                      <td>
                        <div class="table-user-cell">
                          <span class="cell-avatar">${displayAvatar}</span>
                          <div>
                            <span class="cell-name">${this._escapeHtml(displayName)}</span>
                            <span class="cell-class">${this._escapeHtml(displayClass)}${username ? ` • @${this._escapeHtml(username)}` : ''}</span>
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
                      <td style="text-align:right;white-space:nowrap;">
                        <button type="button" class="btn-sm btn-admin-review-sub" data-exam-id="${exam.id}" data-user-id="${sub.userId}" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;">
                          👁️ Xem bài làm
                        </button>
                      </td>
                    </tr>
                    `;
                  }).join('')}

                  ${unsubmittedStudents.map(st => {
                    const displayName = st.fullName || `@${st.username}`;
                    const displayClass = st.className || 'Sinh viên';
                    const displayAvatar = st.avatar || '👤';

                    return `
                    <tr style="${isClosed ? 'background:rgba(239,68,68,0.04);' : ''}">
                      <td>
                        <div class="table-user-cell">
                          <span class="cell-avatar">${displayAvatar}</span>
                          <div>
                            <span class="cell-name">${this._escapeHtml(displayName)}</span>
                            <span class="cell-class">${this._escapeHtml(displayClass)} • @${this._escapeHtml(st.username)}</span>
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;font-weight:800;color:${isClosed ? '#ef4444' : 'var(--dim)'};font-size:15px;">
                        ${isClosed ? '0 / 10 <span class="pill-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;font-size:10.5px;padding:2px 6px;margin-left:4px;border-radius:6px;">Vắng thi</span>' : '--'}
                      </td>
                      <td style="text-align:center;font-weight:600;color:var(--dim);">
                        0 / ${exam.questionIds.length}
                      </td>
                      <td style="text-align:center;color:var(--dim);">
                        --
                      </td>
                      <td style="text-align:center;color:${isClosed ? '#ef4444' : 'var(--dim)'};font-size:12px;font-weight:${isClosed ? '700' : 'normal'};">
                        ${isClosed ? '🚫 Quá hạn vào thi' : '⏳ Chưa làm bài'}
                      </td>
                      <td style="text-align:right;color:var(--dim);font-size:12px;font-style:italic;">
                        ${isClosed ? 'Không nộp bài' : 'Đang chờ thí sinh'}
                      </td>
                    </tr>
                    `;
                  }).join('')}
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
      <div class="gradebook-modal-backdrop" id="adminAnswerKeyBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="gradebook-modal-card" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;width:100%;max-width:960px;max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.4);overflow:hidden;">
          
          <!-- Modal Header -->
          <div style="padding:18px 24px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:var(--panel-alt);flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:12px;color:var(--accent);font-weight:700;text-transform:uppercase;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span>🔑 HỒ SƠ ĐÁP ÁN &amp; BAREM CHẤM DÀNH CHO ADMIN</span>
                <span class="pill-badge" style="background:#10b981;color:#fff;font-size:11px;padding:1px 8px;border-radius:10px;">Bảo Mật Giáo Viên</span>
              </div>
              <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:3px 0 0;word-break:break-word;">
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

  _formatExamContent(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = String(raw);

    // KaTeX formula rendering if window.katex exists
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
      try {
        // Block math: $$ ... $$ or \[ ... \]
        text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m, expr) => {
          try {
            return window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
          } catch { return m; }
        });
        text = text.replace(/\\\[([\s\S]+?)\\\]/g, (m, expr) => {
          try {
            return window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
          } catch { return m; }
        });
        // Inline math: $ ... $ or \( ... \)
        text = text.replace(/\$([^\$\n]+?)\$/g, (m, expr) => {
          try {
            return window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
          } catch { return m; }
        });
        text = text.replace(/\\\(([^\n]+?)\\\)/g, (m, expr) => {
          try {
            return window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
          } catch { return m; }
        });
      } catch {}
    }

    // Preserve newlines if not already containing block html
    if (!text.includes('<p>') && !text.includes('<div>') && !text.includes('<br')) {
      text = text.replace(/\n/g, '<br/>');
    }
    return text;
  }

  /**
   * Injects invisible zero-width spaces into plain text segments (outside HTML and LaTeX formulas)
   * to poison AI OCR and Accessibility Scrapers (Phase 1 & 2 anti-cheat).
   * Visual rendering for human readers remains 100% unaffected.
   * @param {string} str
   * @returns {string}
   */
  _injectAntiAiNoise(str) {
    if (!str || typeof str !== 'string') return '';
    // Preserve HTML tags, LaTeX delimiters, and HTML entities
    const parts = str.split(/(<[^>]+>|\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\[[\s\S]+?\\\]|\\\([^\)]+?\\\)|&[a-zA-Z0-9#]+;)/g);
    return parts.map(part => {
      if (!part) return '';
      // Tag, math block, or HTML entity -> keep unmodified
      if (
        (part.startsWith('<') && part.endsWith('>')) ||
        (part.startsWith('$') && part.endsWith('$')) ||
        (part.startsWith('\\[') && part.endsWith('\\]')) ||
        (part.startsWith('\\(') && part.endsWith('\\)')) ||
        (part.startsWith('&') && part.endsWith(';'))
      ) {
        return part;
      }
      // Inject zero-width space every 3 word characters (including Vietnamese accents)
      return part.replace(/([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]{3})/g, '$1\u200B');
    }).join('');
  }

  /**
   * Instantly obscures question content with a blackout blur shield upon blur, screenshot, or overlay.
   * @param {boolean} enable
   */
  _applyScreenGuard(enable) {
    if (typeof document === 'undefined') return;
    const examRoom = this.container ? this.container.querySelector('.active-exam-room') : null;
    if (examRoom) {
      if (enable) {
        examRoom.classList.add('screen-guarded');
      } else {
        examRoom.classList.remove('screen-guarded');
      }
    }
    const shield = this.container ? this.container.querySelector('#examAntiCaptureShield') : null;
    if (shield) {
      shield.style.display = enable ? 'flex' : 'none';
    }
  }

  /**
   * Detects rapid blur/focus snapping characteristic of Google Assistant, Circle to Search, or Gemini Overlay.
   * @param {Object} session
   */
  _checkQuickAssistantTrigger(session) {
    if (!session || !session.lastBlurAt) return;
    const durationMs = Date.now() - session.lastBlurAt;
    session.lastBlurAt = null;
    if (durationMs >= 200 && durationMs <= 2500 && !session.awayViolationRecorded) {
      session.quickAssistantCount = (session.quickAssistantCount || 0) + 1;
      this._handleScreenDeparture('quick_assistant_detected');
      this._recordExamLockdownTimeoutViolation(session);
    }
  }

  /**
   * Initializes real-time background microphone proctoring to detect and prevent
   * students talking to Gemini Live / Google Assistant / Siri / phone calls.
   * Instantly covers the screen with a blackout shield upon detecting human speech.
   * @param {Object} session
   */
  _initVoiceProctoring(session) {
    if (!session) return;
    if (typeof window === 'undefined') return;
    const nav = window.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    if (!nav || !nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function') return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      nav.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          if (this.activeExamSession !== session) {
            try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
            return;
          }
          session._audioStream = stream;
          let audioCtx;
          try {
            audioCtx = new AudioContextClass();
          } catch (e) {
            return;
          }
          session._audioCtx = audioCtx;

          if (typeof audioCtx.createAnalyser !== 'function') return;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.4;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          session._voiceViolationTimer = setInterval(() => {
            if (this.activeExamSession !== session || session.timeRemaining <= 0) {
              this._stopVoiceProctoring(session);
              return;
            }

            try {
              analyser.getByteFrequencyData(dataArray);
            } catch (e) {
              return;
            }

            // Human speech range ~85Hz - 3000Hz (bins 1 to 35)
            let speechEnergy = 0;
            let count = 0;
            for (let i = 1; i < Math.min(36, bufferLength); i++) {
              speechEnergy += dataArray[i];
              count++;
            }
            const avgEnergy = count > 0 ? speechEnergy / count : 0;

            // If speaking / voice talking detected (> 38 avg energy)
            if (avgEnergy > 38) {
              session._speechSpikeCount = (session._speechSpikeCount || 0) + 1;
              if (session._speechSpikeCount >= 2 && !session.awayViolationRecorded) {
                session._speechSpikeCount = 0;
                this._applyScreenGuard(true);
                this._handleScreenDeparture('voice_cheating_detected');
                this._recordExamLockdownTimeoutViolation(session);
              }
            } else {
              session._speechSpikeCount = Math.max(0, (session._speechSpikeCount || 0) - 1);
            }
          }, 400);
        })
        .catch(() => {
          // Microphone not available or denied by student
        });
    } catch (e) {}
  }

  /**
   * Safely stops voice proctoring, releases microphone hardware, and closes audio context.
   * @param {Object} session
   */
  _stopVoiceProctoring(session) {
    if (!session) return;
    if (session._voiceViolationTimer) {
      clearInterval(session._voiceViolationTimer);
      session._voiceViolationTimer = null;
    }
    if (session._audioStream) {
      try {
        session._audioStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      session._audioStream = null;
    }
    if (session._audioCtx) {
      try {
        if (typeof session._audioCtx.close === 'function') {
          session._audioCtx.close();
        }
      } catch (e) {}
      session._audioCtx = null;
    }
  }

  _showAlert(msg) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
    }
  }

  /**
   * Exports an exam's submissions to an Excel-friendly CSV with BOM.
   * Includes absent students when entry deadline has passed or when they have not submitted.
   * @param {string} examId
   */
  _exportExamSubmissionsToCsv(examId) {
    const exam = examManager.getExamById(examId);
    if (!exam) return;
    const subs = examManager.getSubmissionsForExam(examId);
    const assignedStudents = this._resolveAssignedStudents(exam.assignedTo);
    const sched = examManager.getExamScheduleStatus(exam);
    const isClosed = sched.isScheduled && sched.status === 'closed';

    const submittedUserIds = new Set(subs.map(s => s.userId).filter(Boolean));
    subs.forEach(s => {
      if (s.username) submittedUserIds.add(s.username.toLowerCase());
    });

    const unsubmittedStudents = assignedStudents.filter(st => {
      return !submittedUserIds.has(st.id) && !submittedUserIds.has((st.username || '').toLowerCase());
    });

    if (subs.length === 0 && unsubmittedStudents.length === 0) {
      this._showAlert(`Đề thi "${exam.title}" chưa có dữ liệu sinh viên để xuất điểm!`);
      return;
    }

    let csv = '\uFEFF"STT","Họ và Tên","Tài Khoản (Username)","Lớp / Đơn Vị","Điểm (Thang 10)","Số Câu Đúng","Tổng Số Câu","Thời Gian Làm","Thời Điểm Nộp","Xếp Loại / Trạng Thái"\r\n';
    let rowIndex = 1;

    subs.forEach((s) => {
      const allUsers = (typeof authManager !== 'undefined' && typeof authManager.getUsers === 'function')
        ? authManager.getUsers()
        : ((typeof authManager !== 'undefined' && typeof authManager.getAllUsers === 'function') ? authManager.getAllUsers() : []);
      const user = allUsers.find(u => u.id === s.userId || (u.username && u.username.toLowerCase() === (s.userId || '').toLowerCase()));
      const username = s.username || user?.username || (s.userId && !s.userId.startsWith('user_') ? s.userId : '');
      const fullName = s.fullName || s.studentName || user?.fullName || (username ? `@${username}` : s.userId);
      const className = s.className || s.studentClass || user?.className || 'Sinh viên';

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
        rowIndex++,
        `"${(fullName || '').replace(/"/g, '""')}"`,
        `"${(username || '').replace(/"/g, '""')}"`,
        `"${(className || 'Sinh viên').replace(/"/g, '""')}"`,
        `"${s.score}"`,
        `"${s.correctCount}"`,
        `"${s.totalQuestions}"`,
        `"${durationStr}"`,
        `"${dateStr}"`,
        `"${rating}"`,
      ];
      csv += row.join(',') + '\r\n';
    });

    unsubmittedStudents.forEach((st) => {
      const username = st.username || '';
      const fullName = st.fullName || `@${username}`;
      const className = st.className || 'Sinh viên';
      const score = isClosed ? '0' : '--';
      const rating = isClosed ? 'Vắng thi / Trễ giờ (0đ)' : 'Chưa nộp bài';
      const dateStr = isClosed ? 'Quá hạn vào thi' : 'Chưa thi';

      const row = [
        rowIndex++,
        `"${(fullName || '').replace(/"/g, '""')}"`,
        `"${(username || '').replace(/"/g, '""')}"`,
        `"${(className || 'Sinh viên').replace(/"/g, '""')}"`,
        `"${score}"`,
        `"0"`,
        `"${exam.questionIds.length}"`,
        `"0p 0s"`,
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

    // ── Fixed Schedule & Entry Window Check ────
    const sched = examManager.getExamScheduleStatus(exam);
    const isAdmin = (typeof authManager !== 'undefined' && authManager.isAdmin && authManager.isAdmin());
    const existingDraft = examManager.loadDraft(examId, currentUser.id, { includeExpired: true });

    if (!isAdmin && sched.isScheduled && !existingDraft) {
      if (sched.status === 'upcoming') {
        this._showAlert(`⏳ Chưa đến giờ mở phòng thi!\n\n${sched.message}\nVui lòng quay lại vào lúc ${exam.startTime} ngày ${exam.examDate ? exam.examDate.split('-').reverse().join('/') : ''}.`);
        return;
      }
      if (sched.status === 'closed') {
        this._showAlert(`🚫 Đã hết thời gian vào phòng thi!\n\n${sched.message}\nTheo quy chế, bạn không thể vào thi nữa và được ghi nhận 0 điểm (Vắng thi).`);
        this.render();
        return;
      }
    }

    // ── Zero Data Loss & 2-Minute Disconnect/Exit Grace Period Enforcement ────
    if (existingDraft) {
      // 1. If draft expired while student was away -> auto-submit immediately
      if (existingDraft.expired) {
        this._showAlert('⏰ Đã hết thời gian làm bài trong lúc bạn rời phòng thi!\nHệ thống tự động nộp bài và chấm điểm theo các câu bạn đã làm.');
        const submissionPayload = {
          examId: existingDraft.examId,
          userId: currentUser.id,
          userInfo: currentUser || {},
          answers: existingDraft.answers || {},
          timeSpentSeconds: (exam.durationMinutes || 15) * 60,
          optionOrder: existingDraft.optionOrder || {},
          integrityBan: false,
        };
        examManager.clearDraft(examId, currentUser.id);
        const res = examManager.submitExam(submissionPayload);
        if (cloudSyncManager) {
          cloudSyncManager.serverSubmitExam(res.submission || submissionPayload).catch(() => {
            examManager.enqueueOfflineSubmission(submissionPayload);
          });
        }
        this.reviewSubmission = res.submission;
        this.render();
        return;
      }

      // 2. Calculate cumulative disconnected / away time while web was closed / offline
      const awaySinceLastLeft = existingDraft.disconnectStartedAt
        ? Math.max(0, Math.floor((Date.now() - existingDraft.disconnectStartedAt) / 1000))
        : 0;
      const totalCumulativeDisconnected = (existingDraft.cumulativeDisconnectedSeconds || 0) + awaySinceLastLeft;

      // 3. If total cumulative disconnected time >= 120 seconds (2 minutes) -> AUTO-SUBMIT WITH DISCONNECT VIOLATION
      if (totalCumulativeDisconnected >= MAX_DISCONNECT_GRACE_SECONDS) {
        this._showAlert(
          `⛔ BÀI THI BỊ TỰ ĐỘNG NỘP DO QUÁ THỜI GIAN VẮNG MẶT / MẤT KẾT NỐI!\n\n` +
          `Hệ thống ghi nhận bạn đã rời phòng thi / ngắt kết nối quá thời gian quy định:\n` +
          `• Vừa vắng mặt: ${awaySinceLastLeft} giây\n` +
          `• Tổng thời gian vắng mặt tích lũy: ${totalCumulativeDisconnected} giây (Hạn mức tối đa: 120 giây / 2 phút).\n\n` +
          `Bài thi đã tự động kết thúc và chấm điểm theo các câu bạn đã hoàn thành.`
        );
        const submissionPayload = {
          examId: existingDraft.examId,
          userId: currentUser.id,
          userInfo: currentUser || {},
          answers: existingDraft.answers || {},
          timeSpentSeconds: Math.min((exam.durationMinutes || 15) * 60, Math.max(0, Math.floor((Date.now() - (existingDraft.startedAt || Date.now())) / 1000))),
          optionOrder: existingDraft.optionOrder || {},
          integrityBan: false,
          awayViolation: true,
          cumulativeDisconnectedSeconds: totalCumulativeDisconnected,
        };
        examManager.clearDraft(examId, currentUser.id);
        const res = examManager.submitExam(submissionPayload);
        if (cloudSyncManager) {
          cloudSyncManager.serverSubmitExam(res.submission || submissionPayload).catch(() => {
            examManager.enqueueOfflineSubmission(submissionPayload);
          });
        }
        this.reviewSubmission = res.submission;
        this.render();
        return;
      }

      // Update draft with fresh cumulative disconnected seconds and clear disconnectStartedAt
      existingDraft.cumulativeDisconnectedSeconds = totalCumulativeDisconnected;
      existingDraft.disconnectStartedAt = null;
      examManager.saveDraft(examId, currentUser.id, existingDraft);

      const remainingGrace = MAX_DISCONNECT_GRACE_SECONDS - totalCumulativeDisconnected;
      if (awaySinceLastLeft > 0) {
        this._showAlert(
          `⚠️ CẢNH BÁO VẮNG MẶT / MẤT KẾT NỐI!\n\n` +
          `Bạn vừa rời phòng thi / ngắt kết nối ${awaySinceLastLeft} giây.\n` +
          `• Quỹ thời gian vắng mặt cho phép còn lại: ${remainingGrace} giây (Tối đa tích lũy 2 phút).\n` +
          `Nếu tiếp tục thoát ra quá ${remainingGrace} giây, bài thi sẽ bị tự động nộp ngay lập tức!`
        );
      }

      const timeLeftMin = Math.ceil((existingDraft.timeRemaining || 0) / 60);
      const wantResume = typeof window !== 'undefined' && window.confirm
        ? window.confirm(
            `📂 Phát hiện bài làm chưa hoàn thành của đề thi "${exam.title}"!\n\n` +
            `• Số câu đã trả lời: ${Object.keys(existingDraft.answers || {}).length} / ${exam.questionIds.length}\n` +
            `• Thời gian còn lại: ~${timeLeftMin} phút\n` +
            `• Quỹ vắng mặt còn lại: ~${remainingGrace} giây\n\n` +
            `Bấm OK để tiếp tục làm từ chỗ đã dừng.\n` +
            `Bấm Hủy để bỏ bản nháp và bắt đầu lại từ đầu (Lưu ý: thời gian vẫn tính từ lúc bắt đầu đầu tiên).`
          )
        : true;

      if (wantResume) {
        // Restore questions in the saved order (no re-shuffle)
        const allQuestions = getAllQuestions();
        const customQuestions = Array.isArray(exam.customQuestions) ? exam.customQuestions : [];
        const questionPool = [...allQuestions, ...customQuestions];

        const savedIds = Array.isArray(existingDraft.questionIds) && existingDraft.questionIds.length > 0
          ? existingDraft.questionIds
          : exam.questionIds;

        let restoredQuestions = savedIds.map(id => questionPool.find(q => q.id === id)).filter(Boolean);
        // Fallback: if the saved order is empty, use original exam order
        if (restoredQuestions.length === 0) {
          restoredQuestions = exam.questionIds.map(id => questionPool.find(q => q.id === id)).filter(Boolean);
        }

        const restoredOptionOrder = (existingDraft.optionOrder && Object.keys(existingDraft.optionOrder).length > 0)
          ? existingDraft.optionOrder
          : Object.fromEntries(restoredQuestions.map(question => {
              const optionIds = question.options.map(option => option.id);
              return [question.id, optionIds];
            }));

        const restoredIdx = Math.min(
          Math.max(0, existingDraft.currentQIndex || 0),
          Math.max(0, restoredQuestions.length - 1)
        );

        const startedAt = existingDraft.startedAt || Date.now();
        const durationMin = existingDraft.durationMinutes || exam.durationMinutes || 15;
        const deadline = existingDraft.deadline || (startedAt + durationMin * 60 * 1000);
        const actualRemaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));

        this.activeExamSession = {
          exam,
          questions:         restoredQuestions,
          optionOrder:       restoredOptionOrder,
          answers:           { ...(existingDraft.answers || {}) },
          currentQIndex:     restoredIdx,
          timeRemaining:     existingDraft.timeRemaining != null ? existingDraft.timeRemaining : actualRemaining,
          startedAt,
          deadline,
          timerId:           null,
          violationCount:    violationRecord.count || 0,
          lockdownPending:   false,
          lockdownCountdown: null,
          lockdownTimerId:   null,
          lockdownWarning:   false,
          fullscreenActive:  false,
          _showSubmitConfirm: false,
          cumulativeDisconnectedSeconds: totalCumulativeDisconnected,
          disconnectStartedAt: null,
          isOffline: (typeof navigator !== 'undefined' && navigator.onLine === false),
        };

        // History Trap: Push state to trap Android Hardware/Gesture Back button before attaching listeners
        if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
          try {
            window.history.pushState({ inExamLockdown: true, examId }, '', window.location.href);
          } catch (e) {}
        }

        this.render();
        this._attachExamLockdownListeners();
        this._requestExamFullscreen();
        this._startExamTimer();
        return; // Resume path complete — skip the normal start flow below
      }

      // User chose NOT to resume → discard draft and start fresh
      examManager.clearDraft(examId, currentUser.id);
    }
    // ── End Zero Data Loss ────────────────────────────────────────────────────

    const confirmStart = typeof window !== 'undefined' && window.confirm
      ? window.confirm(`Bắt đầu làm đề thi: "${exam.title}"?\n\nLưu ý quan trọng:\n- Mỗi thí sinh chỉ có duy nhất 1 lượt làm.\n- Màn hình sẽ tự động khóa khi vào thi, VI PHẠM 3 lần sẽ bị 0đ (thoát toàn màn hình hoặc rời cửa sổ thi sẽ tính là VI PHẠM).\n- Quỹ thời gian mất kết nối/rời phòng thi tối đa: 2 phút (tích lũy).\n- Thời gian làm bài: ${exam.durationMinutes} phút.\n- Đồng hồ đếm ngược sẽ bắt đầu ngay bây giờ!\n\nBạn đã sẵn sàng chưa?`)
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

    const startedAt = Date.now();
    const durationMinutes = exam.durationMinutes || 15;
    const deadline = startedAt + durationMinutes * 60 * 1000;

    this.activeExamSession = {
      exam,
      questions,
      optionOrder,
      answers: {},
      currentQIndex: 0,
      timeRemaining: durationMinutes * 60,
      startedAt,
      deadline,
      timerId: null,
      violationCount: violationRecord.count || 0,
      lockdownPending: false,
      lockdownCountdown: null,
      lockdownTimerId: null,
      lockdownWarning: false,
      fullscreenActive: false,
      _showSubmitConfirm: false,
      cumulativeDisconnectedSeconds: 0,
      disconnectStartedAt: null,
      isOffline: (typeof navigator !== 'undefined' && navigator.onLine === false),
    };

    // Save initial draft immediately so early refresh never loses session
    examManager.saveDraft(exam.id, currentUser.id, {
      examId: exam.id,
      answers: {},
      startedAt,
      deadline,
      durationMinutes,
      timeRemaining: durationMinutes * 60,
      currentQIndex: 0,
      questionIds: questions.map(q => q.id),
      optionOrder,
      cumulativeDisconnectedSeconds: 0,
      disconnectStartedAt: null,
    });

    // History Trap: Push state to trap Android Hardware/Gesture Back button before attaching listeners
    if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
      try {
        window.history.pushState({ inExamLockdown: true, examId: exam.id }, '', window.location.href);
      } catch (e) {}
    }

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

      // 1. Live Offline Accumulation Check (2-Minute Disconnect Grace Period)
      if (session.isOffline && session.offlineStartedAt) {
        const liveOfflineSec = Math.max(0, Math.floor((Date.now() - session.offlineStartedAt) / 1000));
        const totalOffline = (session.cumulativeDisconnectedSeconds || 0) + liveOfflineSec;
        if (totalOffline >= MAX_DISCONNECT_GRACE_SECONDS) {
          session.cumulativeDisconnectedSeconds = totalOffline;
          this._showAlert('⛔ Bạn đã mất kết nối mạng quá 2 phút cho phép! Bài thi đang tự động được nộp.');
          this._submitActiveExam({ integrityBan: false });
          return;
        }
      }

      // 1b. Mobile Notification Shade / Quick Settings / Loss of focus check
      if (this._allowExamBlurEvent && typeof document !== 'undefined' && typeof document.hasFocus === 'function') {
        if (!document.hasFocus() && !session.isAway) {
          const reason = this._isMobileDevice() ? 'mobile_drawer_or_blur' : 'window_blur';
          this._handleScreenDeparture(reason);
        }
      }

      // 2. Decrement exam time
      session.timeRemaining--;

      const timerEl = this.container ? this.container.querySelector('#activeExamTimer') : null;
      if (timerEl) {
        const m = Math.floor(Math.max(0, session.timeRemaining) / 60);
        const s = Math.max(0, session.timeRemaining) % 60;
        timerEl.textContent = `⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (session.timeRemaining <= 120) timerEl.classList.add('urgent');
      }

      // 3. Live Update of Grace Box on Topbar
      const graceTextEl = this.container ? this.container.querySelector('#examGraceTimeText') : null;
      const graceBadgeEl = this.container ? this.container.querySelector('#examGraceBadge') : null;
      if (graceTextEl && graceBadgeEl) {
        const extraOffline = (session.isOffline && session.offlineStartedAt)
          ? Math.max(0, Math.floor((Date.now() - session.offlineStartedAt) / 1000))
          : 0;
        const currentTotalAway = (session.cumulativeDisconnectedSeconds || 0) + extraOffline;
        const remainingGrace = Math.max(0, MAX_DISCONNECT_GRACE_SECONDS - currentTotalAway);
        const gMin = Math.floor(remainingGrace / 60);
        const gSec = remainingGrace % 60;
        graceTextEl.textContent = `${String(gMin).padStart(2, '0')}:${String(gSec).padStart(2, '0')}`;
        graceBadgeEl.className = `active-exam-grace-box ${remainingGrace > 60 ? 'safe' : (remainingGrace > 30 ? 'warning' : 'danger')}`;

        const offlineTimeEl = this.container ? this.container.querySelector('#examOfflineTimeText') : null;
        if (offlineTimeEl) {
          offlineTimeEl.textContent = `${String(gMin).padStart(2, '0')}:${String(gSec).padStart(2, '0')}`;
        }
      }

      if (session.timeRemaining <= 0) {
        this._showAlert('⏰ Đã hết thời gian làm bài! Hệ thống tự động nộp bài thi của bạn.');
        this._submitActiveExam();
      }
    }, 1000);
  }

  _getFullscreenElement() {
    if (typeof document === 'undefined') return null;
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  _supportsFullscreen() {
    if (typeof document === 'undefined') return false;
    const docEl = document.documentElement;
    if (!docEl) return false;
    return Boolean(
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen
    );
  }

  /**
   * Identifies whether the current client is a Mobile device (smartphone, tablet, small touch screen).
   * Used to isolate mobile behaviour from desktop Fullscreen APIs.
   * @returns {boolean}
   * @private
   */
  _isMobileDevice() {
    const nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : (typeof navigator !== 'undefined' ? navigator : null);
    if (!nav) return false;
    const ua = nav.userAgent || '';
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua);
    const win = typeof window !== 'undefined' ? window : null;
    const isSmallScreen = win && typeof win.innerWidth === 'number' && win.innerWidth > 0 && win.innerWidth < 768;
    return Boolean(isMobileUA || isSmallScreen);
  }

  _isPhoneDevice() {
    return this._isMobileDevice();
  }

  _attachExamLockdownListeners() {
    if (typeof document === 'undefined' || this._examLockdownHandlers) return;

    this._allowExamBlurEvent = Boolean(typeof process !== 'undefined' && process.env?.NODE_ENV === 'test');
    if (!this._allowExamBlurEvent && typeof setTimeout !== 'undefined') {
      setTimeout(() => { this._allowExamBlurEvent = true; }, 300);
    }

    const onFullscreenChange = () => {
      if (!this._supportsFullscreen()) return;
      const session = this.activeExamSession;
      if (!session) return;
      const isFullscreen = Boolean(this._getFullscreenElement());
      if (isFullscreen) {
        session.fullscreenActive = true;
        if (session.isAway) {
          this._flushAwayTime(session);
        }
        this.render();
      } else {
        if (session.fullscreenActive) {
          session.fullscreenActive = false;
          this._handleScreenDeparture('fullscreen_exit');
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this._applyScreenGuard(true);
        if (this.activeExamSession) {
          this.activeExamSession.lastBlurAt = Date.now();
        }
        this._recordDepartureTimestamp();
        this._handleScreenDeparture('visibility_hidden');
      } else if (document.visibilityState === 'visible') {
        this._recordReturnTimestamp();
        const session = this.activeExamSession;
        if (session) {
          this._checkQuickAssistantTrigger(session);
          if (session.isAway) {
            this._flushAwayTime(session);
            this.render();
          } else {
            this._applyScreenGuard(false);
          }
        }
      }
    };

    const onBlur = () => {
      this._applyScreenGuard(true);
      if (this.activeExamSession) {
        this.activeExamSession.lastBlurAt = Date.now();
      }
      if (this._allowExamBlurEvent) {
        const reason = this._isMobileDevice() ? 'mobile_drawer_or_blur' : 'window_blur';
        this._handleScreenDeparture(reason);
      }
    };

    const onPopState = () => {
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;

      // 1. History Trap: Re-push state so user stays inside exam room
      if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
        try {
          window.history.pushState({ inExamLockdown: true, examId: session.exam.id }, '', window.location.href);
        } catch (err) {}
      }

      // 2. Mobile vibration feedback
      const nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : (typeof navigator !== 'undefined' ? navigator : null);
      if (nav && typeof nav.vibrate === 'function') {
        try {
          nav.vibrate([200, 100, 200]);
        } catch (err) {}
      }

      // 3. Mark departure with mobile_back_button_pressed and record immediate violation
      this._handleScreenDeparture('mobile_back_button_pressed');
      this._recordExamLockdownTimeoutViolation(session);
    };

    const onFocus = () => {
      this._recordReturnTimestamp();
      const session = this.activeExamSession;
      if (session) {
        this._checkQuickAssistantTrigger(session);
        if (session.isAway) {
          this._flushAwayTime(session);
          this.render();
        } else {
          this._applyScreenGuard(false);
        }
      }
    };

    const onPageHide = () => {
      this._recordDepartureTimestamp();
      this._handleScreenDeparture('pagehide');
    };

    const onOffline = () => {
      const session = this.activeExamSession;
      if (!session) return;
      session.isOffline = true;
      session.offlineStartedAt = Date.now();
      this.render();
    };

    const onOnline = () => {
      const session = this.activeExamSession;
      if (!session) return;
      session.isOffline = false;
      if (session.offlineStartedAt) {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - session.offlineStartedAt) / 1000));
        session.cumulativeDisconnectedSeconds = (session.cumulativeDisconnectedSeconds || 0) + elapsedSec;
        session.offlineStartedAt = null;
      }
      this._saveCurrentSessionDraft();
      if (session.cumulativeDisconnectedSeconds >= MAX_DISCONNECT_GRACE_SECONDS) {
        this._showAlert('⛔ Bạn đã mất kết nối mạng quá 2 phút cho phép! Bài thi đang tự động được nộp.');
        this._submitActiveExam({ integrityBan: false });
        return;
      }
      this.render();
    };

    const onBeforeUnload = () => {
      this._recordDepartureTimestamp();
    };

    const onResize = () => {
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;

      // On desktop: fullscreen exit detection
      if (!this._isMobileDevice() && this._supportsFullscreen()) {
        if (session.fullscreenActive && !this._getFullscreenElement()) {
          session.fullscreenActive = false;
          this._handleScreenDeparture('fullscreen_exit');
          return;
        }
      }

      // On mobile: detect Split-screen or Floating window
      if (this._isMobileDevice() && typeof window !== 'undefined' && window.screen) {
        const screenH = window.screen.height || 0;
        const screenW = window.screen.width || 0;
        if (screenH > 400 && window.innerHeight > 0 && window.innerHeight < screenH * 0.58) {
          this._handleScreenDeparture('split_screen_detected');
        } else if (screenW > 400 && window.innerWidth > 0 && window.innerWidth < screenW * 0.58) {
          this._handleScreenDeparture('split_screen_detected');
        }
      }
    };

    const onKeyDown = (e) => {
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;

      // 1. F11 Key (Browser Fullscreen toggle)
      if (e.key === 'F11' || e.keyCode === 122) {
        e.preventDefault();
        e.stopPropagation();
        this._handleScreenDeparture('f11_pressed');
        return;
      }

      // 2. Alt + Tab or Alt key combination
      if (e.altKey && (e.key === 'Tab' || e.keyCode === 9)) {
        e.preventDefault();
        e.stopPropagation();
        this._handleScreenDeparture('alt_tab_pressed');
        return;
      }

      // 3. Escape key (Exiting fullscreen)
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        this._handleScreenDeparture('escape_pressed');
        return;
      }

      // 4. Windows Key / Command (Meta) Key
      if (e.key === 'Meta' || e.keyCode === 91 || e.keyCode === 92 || e.keyCode === 93) {
        this._handleScreenDeparture('meta_key_pressed');
        return;
      }

      // 5. DevTools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Cmd+Option+I, Cmd+Option+J, Cmd+Option+C, Ctrl+U, Cmd+Option+U
      const isDevTools =
        e.key === 'F12' || e.keyCode === 123 ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key?.toLowerCase())) ||
        ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === 'u'));

      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        this._handleScreenDeparture('devtools_attempt');
        return;
      }

      // 6. Navigation / Tab manipulation shortcuts: Ctrl+T, Ctrl+N, Ctrl+W, Ctrl+Tab
      const isNavShortcut = (e.ctrlKey || e.metaKey) && ['t', 'n', 'w'].includes(e.key?.toLowerCase());
      if (isNavShortcut) {
        e.preventDefault();
        e.stopPropagation();
        this._handleScreenDeparture('tab_navigation_attempt');
        return;
      }

      // 7. Clipboard & Print shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A, Ctrl+P, Ctrl+S
      const isRestricted = (e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'p', 's'].includes(e.key?.toLowerCase());
      if (isRestricted) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    let longPressTimer = null;

    const onTouchStart = (e) => {
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;
      if (e.touches && e.touches.length >= 3) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this._applyScreenGuard(true);
        this._handleScreenDeparture('three_finger_screenshot_attempt');
        this._recordExamLockdownTimeoutViolation(session);
        return;
      }

      if (e.touches && e.touches.length === 1) {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          if (e.cancelable) e.preventDefault();
          this._applyScreenGuard(true);
          this._handleScreenDeparture('long_press_ai_assist_attempt');
          this._recordExamLockdownTimeoutViolation(session);
        }, 450);
      }
    };

    const onTouchMove = (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;
      if (e.touches && e.touches.length >= 3) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const onTouchCancel = (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const session = this.activeExamSession;
      if (!session || session.timeRemaining <= 0) return;
      this._applyScreenGuard(true);
      this._handleScreenDeparture('assistant_overlay_intercept');
      this._recordExamLockdownTimeoutViolation(session);
    };

    const preventDefaultEvent = (e) => {
      e.preventDefault();
    };

    this._examLockdownHandlers = {
      onFullscreenChange,
      onVisibilityChange,
      onBlur,
      onPopState,
      onFocus,
      onPageHide,
      onResize,
      onKeyDown,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      onOffline,
      onOnline,
      onBeforeUnload,
      preventDefaultEvent,
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: false });
    document.addEventListener('contextmenu', preventDefaultEvent);
    document.addEventListener('copy', preventDefaultEvent);
    document.addEventListener('cut', preventDefaultEvent);
    document.addEventListener('paste', preventDefaultEvent);
    document.addEventListener('selectstart', preventDefaultEvent);
    document.addEventListener('dragstart', preventDefaultEvent);

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur);
      window.addEventListener('popstate', onPopState);
      window.addEventListener('focus', onFocus);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('resize', onResize);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('offline', onOffline);
      window.addEventListener('online', onOnline);
      window.addEventListener('beforeunload', onBeforeUnload);
    }

    // Initialize real-time background voice proctoring
    if (this.activeExamSession) {
      this._initVoiceProctoring(this.activeExamSession);
    }
  }

  _detachExamLockdownListeners() {
    this._allowExamBlurEvent = false;
    if (this.activeExamSession) {
      this._cancelExamLockdownCountdown(this.activeExamSession);
      this._stopVoiceProctoring(this.activeExamSession);
    }
    if (typeof document !== 'undefined' && this._examLockdownHandlers) {
      const h = this._examLockdownHandlers;
      document.removeEventListener('fullscreenchange', h.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', h.onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', h.onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', h.onFullscreenChange);
      document.removeEventListener('visibilitychange', h.onVisibilityChange);
      document.removeEventListener('touchstart', h.onTouchStart);
      document.removeEventListener('touchmove', h.onTouchMove);
      document.removeEventListener('touchend', h.onTouchEnd);
      document.removeEventListener('touchcancel', h.onTouchCancel);
      document.removeEventListener('contextmenu', h.preventDefaultEvent);
      document.removeEventListener('copy', h.preventDefaultEvent);
      document.removeEventListener('cut', h.preventDefaultEvent);
      document.removeEventListener('paste', h.preventDefaultEvent);
      document.removeEventListener('selectstart', h.preventDefaultEvent);
      document.removeEventListener('dragstart', h.preventDefaultEvent);
    }
    if (typeof window !== 'undefined' && this._examLockdownHandlers) {
      const h = this._examLockdownHandlers;
      window.removeEventListener('blur', h.onBlur);
      window.removeEventListener('popstate', h.onPopState);
      window.removeEventListener('focus', h.onFocus);
      window.removeEventListener('pagehide', h.onPageHide);
      window.removeEventListener('resize', h.onResize);
      window.removeEventListener('keydown', h.onKeyDown, true);
      window.removeEventListener('offline', h.onOffline);
      window.removeEventListener('online', h.onOnline);
      window.removeEventListener('beforeunload', h.onBeforeUnload);
    }
    this._examLockdownHandlers = null;
  }

  _saveCurrentSessionDraft() {
    const session = this.activeExamSession;
    if (!session) return;
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) return;
    examManager.saveDraft(session.exam.id, currentUser.id, {
      examId: session.exam.id,
      answers: session.answers,
      startedAt: session.startedAt,
      deadline: session.deadline,
      durationMinutes: session.exam.durationMinutes,
      timeRemaining: session.timeRemaining,
      currentQIndex: session.currentQIndex,
      questionIds: session.questions.map(q => q.id),
      optionOrder: session.optionOrder,
      cumulativeDisconnectedSeconds: session.cumulativeDisconnectedSeconds || 0,
      disconnectStartedAt: session.disconnectStartedAt || null,
    });
  }

  _recordDepartureTimestamp() {
    const session = this.activeExamSession;
    if (!session || session.timeRemaining <= 0) return;
    session.disconnectStartedAt = Date.now();
    this._saveCurrentSessionDraft();
  }

  _recordReturnTimestamp() {
    const session = this.activeExamSession;
    if (!session || !session.disconnectStartedAt) return;
    const awaySec = Math.max(0, Math.floor((Date.now() - session.disconnectStartedAt) / 1000));
    session.cumulativeDisconnectedSeconds = (session.cumulativeDisconnectedSeconds || 0) + awaySec;
    session.disconnectStartedAt = null;
    this._saveCurrentSessionDraft();

    if (session.cumulativeDisconnectedSeconds >= MAX_DISCONNECT_GRACE_SECONDS) {
      this._showAlert('⛔ Bạn đã rời phòng thi / ngắt kết nối quá 2 phút cho phép! Bài thi đang tự động được nộp.');
      this._submitActiveExam({ integrityBan: false });
      return;
    }
  }

  _handleScreenDeparture(reason) {
    const session = this.activeExamSession;
    if (!session || session.timeRemaining <= 0) return;
    if (session.isAway) return; // Already tracking

    session.isAway = true;
    session.awayReason = reason;
    session.lockdownPending = true;
    session.awayViolationRecorded = false;
    session.awayStartedAt = Date.now();
    if (session.cumulativeAwaySeconds === undefined || session.cumulativeAwaySeconds === null) {
      session.cumulativeAwaySeconds = 0;
    }
    session.lockdownCountdown = Math.max(0, 10 - session.cumulativeAwaySeconds);

    this._startExamLockdownCountdown(session);
    this.render();
  }

  async _handleScreenReturn() {
    const session = this.activeExamSession;
    if (!session) return;

    this._flushAwayTime(session);
    if (this.activeExamSession !== session || session.violationCount >= 3) {
      return;
    }

    this._cancelExamLockdownCountdown(session);
    session.isAway = false;
    session.lockdownPending = false;
    session.awayStartedAt = null;
    session.lockdownCountdown = null;
    this._applyScreenGuard(false);

    await this._requestExamFullscreen({ preserveLockdownState: false });
    this.render();
  }

  _flushAwayTime(session) {
    if (!session || !session.isAway || !session.awayStartedAt) return;
    const now = Date.now();
    const elapsedMs = now - session.awayStartedAt;
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    if (elapsedSeconds <= 0) {
      const remainingInPool = Math.max(0, 10 - (session.cumulativeAwaySeconds || 0));
      session.lockdownCountdown = remainingInPool;
      const countdownEl = this.container?.querySelector('#examLockdownCountdown');
      if (countdownEl) countdownEl.textContent = String(remainingInPool);
      return;
    }

    session.awayStartedAt += elapsedSeconds * 1000;
    session.cumulativeAwaySeconds = (session.cumulativeAwaySeconds || 0) + elapsedSeconds;
    session.cumulativeDisconnectedSeconds = (session.cumulativeDisconnectedSeconds || 0) + elapsedSeconds;

    if (session.cumulativeDisconnectedSeconds >= MAX_DISCONNECT_GRACE_SECONDS) {
      this._showAlert('⛔ Bạn đã rời phòng thi / ngắt kết nối quá 2 phút cho phép! Bài thi đang tự động được nộp.');
      this._submitActiveExam({ integrityBan: false });
      return;
    }

    // Check if 10-second cumulative threshold(s) crossed
    while (session.cumulativeAwaySeconds >= 10 && session.violationCount < 3) {
      session.cumulativeAwaySeconds -= 10;
      session.awayViolationRecorded = true;
      this._recordExamLockdownTimeoutViolation(session);
      if (this.activeExamSession !== session || session.violationCount >= 3) {
        return;
      }
    }

    const remainingInPool = Math.max(0, 10 - (session.cumulativeAwaySeconds || 0));
    session.lockdownCountdown = remainingInPool;
    const countdownEl = this.container?.querySelector('#examLockdownCountdown');
    if (countdownEl) countdownEl.textContent = String(remainingInPool);
  }

  _startExamLockdownCountdown(session) {
    this._cancelExamLockdownCountdown(session);
    session.lockdownTimerId = setInterval(() => {
      if (this.activeExamSession !== session || !session.isAway || session.timeRemaining <= 0) {
        this._cancelExamLockdownCountdown(session);
        return;
      }
      this._flushAwayTime(session);
    }, 250);
  }

  _cancelExamLockdownCountdown(session) {
    if (session && session.lockdownTimerId !== null) {
      clearInterval(session.lockdownTimerId);
      session.lockdownTimerId = null;
    }
  }

  _recordExamLockdownViolation() {
    const session = this.activeExamSession;
    if (!session) return;
    this._recordExamLockdownTimeoutViolation(session);
  }

  _recordExamLockdownTimeoutViolation(session) {
    if (this.activeExamSession !== session || session.timeRemaining <= 0) return;
    const currentUser = authManager.getCurrentUser();
    if (!currentUser) return;

    const result = examManager.recordExamViolation(session.exam.id, currentUser.id);
    if (!result.success) {
      this._showAlert(`Không thể lưu vi phạm thi: ${result.error}`);
      return;
    }

    session.violationCount = result.record.count;
    session.awayViolationRecorded = true;
    if (session.violationCount >= 3) {
      this._finishExamForViolationBan();
      return;
    }

    session.lockdownWarning = true;
    this.render();
  }

  _requestExamFullscreen({ preserveLockdownState = false } = {}) {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('in-active-exam');
    }

    const session = this.activeExamSession;
    if (session) {
      session.fullscreenActive = true;
      if (!preserveLockdownState) {
        session.lockdownPending = false;
      }
    }

    if (typeof document === 'undefined') return Promise.resolve();
    const docEl = document.documentElement;
    const requestMethod = (
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen
    );

    if (typeof requestMethod !== 'function') {
      return Promise.resolve();
    }

    try {
      return Promise.resolve(requestMethod.call(docEl)).catch((err) => {
        console.warn('[ExamLockdown] Fullscreen request rejected:', err);
      });
    } catch (err) {
      console.warn('[ExamLockdown] Fullscreen invocation error:', err);
      return Promise.resolve();
    }
  }

  _finishExamForViolationBan() {
    this._submitActiveExam({ integrityBan: true });
  }

  async _submitActiveExam({ integrityBan = false } = {}) {
    if (!this.activeExamSession) return;

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('in-active-exam');
    }

    this._cancelExamLockdownCountdown(this.activeExamSession);
    if (this.activeExamSession.timerId) {
      clearInterval(this.activeExamSession.timerId);
      this.activeExamSession.timerId = null;
    }
    this._detachExamLockdownListeners();
    if (typeof document !== 'undefined' && this._getFullscreenElement()) {
      const exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (typeof exitMethod === 'function') {
        Promise.resolve(exitMethod.call(document)).catch(() => {});
      }
    }

    const currentUser = authManager.getCurrentUser();
    const session = this.activeExamSession;
    const timeSpentSeconds = Math.round((Date.now() - session.startedAt) / 1000);

    // ── Zero Data Loss: Offline Submission Queue ──────────────────────────────
    // Build the submission payload once so we can either submit or enqueue it
    const submissionPayload = {
      examId: session.exam.id,
      userId: currentUser ? currentUser.id : 'guest',
      userInfo: currentUser || {},
      answers: session.answers,
      timeSpentSeconds,
      optionOrder: session.optionOrder,
      integrityBan,
    };

    // Detect offline state
    const isOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;

    if (isOffline) {
      // Save to offline queue — the student's work is safe
      examManager.enqueueOfflineSubmission(submissionPayload);
      // Keep the draft alive until the submission is confirmed on the server
      // (don't clearDraft here so the session data survives another reload)
      this.activeExamSession = null;
      this._showAlert(
        '📡 Bài làm của bạn đã được lưu an toàn trên máy!\n\n' +
        'Đang nộp bài... Nếu mất mạng, bài làm của bạn đã được lưu an toàn trên máy và sẽ tự động gửi lại khi có kết nối.\n\n' +
        '→ Vui lòng kiểm tra kết nối mạng và mở lại trang để hệ thống tự động nộp bài.'
      );
      this.render();
      return;
    }
    // ── End Offline Queue ─────────────────────────────────────────────────────

    this.activeExamSession = null;
    const result = examManager.submitExam(submissionPayload);

    let serverConfirmed = false;
    let finalSubmission = result.submission;

    if (result.success && cloudSyncManager) {
      try {
        const isOnline = Boolean(
          cloudSyncManager &&
          (cloudSyncManager.isConnected || (
            typeof window !== 'undefined' &&
            window.location &&
            window.location.protocol.startsWith('http') &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            navigator.onLine !== false
          ))
        );
        if (isOnline) {
          const serverRes = await cloudSyncManager.serverSubmitExam(result.submission);
          if (serverRes && serverRes.success) {
            serverConfirmed = true;
            if (serverRes.submission) {
              finalSubmission = { ...result.submission, ...serverRes.submission };
            }
          } else {
            // Server error or timeout -> enqueue for idempotent retry
            examManager.enqueueOfflineSubmission(submissionPayload);
          }
        } else {
          examManager.enqueueOfflineSubmission(submissionPayload);
        }
      } catch {
        examManager.enqueueOfflineSubmission(submissionPayload);
      }
    }

    // ── Clear draft on successful submission ──────────────────────────────────
    if (result.success && currentUser) {
      examManager.clearDraft(session.exam.id, currentUser.id);
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (result.success) {
      if (serverConfirmed) {
        this._showAlert(integrityBan
          ? `🚫 Bạn đã bị xử lý 0 ĐIỂM và cấm thi lại đề này do VI PHẠM quy chế 3 lần.\n\nĐiểm số: 0 / 10 điểm`
          : `🎉 Bạn đã nộp bài thi thành công và máy chủ đã xác nhận!\n\nĐiểm số: ${finalSubmission.score} / 10 điểm\nSố câu đúng: ${finalSubmission.correctCount} / ${finalSubmission.totalQuestions}\n\nKết quả đã được ghi nhận vào Bảng Xếp Hạng chính thức!`);
      } else {
        this._showAlert(integrityBan
          ? `🚫 Đã ghi nhận bài thi (vi phạm quy chế). Kết quả đang chờ đồng bộ máy chủ.`
          : `📡 Bài thi đã được ghi nhận an toàn trên thiết bị!\n\nĐiểm số tạm tính: ${result.submission.score} / 10 điểm.\nKết quả đang ở hàng đợi và sẽ tự động đồng bộ lên máy chủ khi có kết nối.`);
      }
      this.reviewSubmission = finalSubmission;
    } else {
      // Primary submit failed (e.g. network hiccup) → enqueue for retry
      examManager.enqueueOfflineSubmission(submissionPayload);
      this._showAlert(integrityBan
        ? `Bạn đã bị xử lý 0 điểm và cấm thi lại đề này do VI PHẠM quy chế 3 lần. ${result.error || ''}`
        : `⚠️ ${result.error || 'Có lỗi xảy ra khi nộp bài thi.'}\n\nBài làm của bạn đã được lưu an toàn trên máy và sẽ tự động gửi lại khi có kết nối mạng.`);
    }

    await this.render();
  }

  // ── Zero Data Loss: Offline Queue Processor ───────────────────────────────

  /**
   * Attempts to flush any queued offline submissions and wires up the
   * browser's 'online' event to retry automatically when connectivity returns.
   * Called once from the constructor.
   */
  _initOfflineQueueListener() {
    if (typeof window === 'undefined') return;

    const tryFlush = () => {
      examManager.flushOfflineQueue(submission => {
        // Notify the user that their queued submission went through
        try {
          if (typeof window.alert === 'function') {
            window.alert(
              `✅ Bài thi "${submission.examTitle}" đã được nộp thành công!\n` +
              `Điểm số: ${submission.score} / 10 điểm`
            );
          }
        } catch {}
        // Re-render to reflect the new submission in the UI
        if (this.container) this.render();
      });
    };

    // Flush on initial load (handles drafts left from previous sessions)
    tryFlush();

    // Flush whenever the browser comes back online
    window.addEventListener('online', tryFlush);
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
      tabMyExams.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.setTab('myExams');
      });
    }

    const btnSwitchLocked = this.container.querySelector('#btnSwitchToMyExamsFromLockedPractice');
    if (btnSwitchLocked) {
      btnSwitchLocked.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.setTab('myExams');
      });
    }

    if (tabStudio) {
      tabStudio.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
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
        if (this.returnToGradebookExamId) {
          this.gradebookExamId = this.returnToGradebookExamId;
          this.returnToGradebookExamId = null;
        }
        this.reviewSubmission = null;
        this.render();
      });
    }

    const btnBackFromScore = this.container.querySelector('#btnBackToExamsFromScore');
    if (btnBackFromScore) {
      btnBackFromScore.addEventListener('click', () => {
        if (this.returnToGradebookExamId) {
          this.gradebookExamId = this.returnToGradebookExamId;
          this.returnToGradebookExamId = null;
        }
        this.reviewSubmission = null;
        this.render();
      });
    }

    const btnDownloadMySlip = this.container.querySelector('#btnDownloadMySlip');
    if (btnDownloadMySlip && this.reviewSubmission) {
      btnDownloadMySlip.addEventListener('click', () => {
        examManager.downloadEmergencyBackupSlip(this.reviewSubmission);
        this._showAlert('📥 Đã tải file phiếu làm bài dự phòng (.json) về máy tính thành công!');
      });
    }

    // In Active Exam Room Events
    if (this.activeExamSession) {
      const btnToggleExamFullscreen = this.container.querySelector('#btnToggleExamFullscreen');
      if (btnToggleExamFullscreen) {
        btnToggleExamFullscreen.addEventListener('click', () => {
          this._requestExamFullscreen();
        });
      }

      const btnTriggerExamFullscreen = this.container.querySelector('#btnTriggerExamFullscreen');
      if (btnTriggerExamFullscreen) {
        btnTriggerExamFullscreen.addEventListener('click', () => {
          this._requestExamFullscreen();
        });
      }

      const btnResumeExamLockdown = this.container.querySelector('#btnResumeExamLockdown');
      if (btnResumeExamLockdown) {
        btnResumeExamLockdown.addEventListener('click', async () => {
          await this._handleScreenReturn();
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

      // Prev / Next Question in Exam (Both top and bottom bars)
      const handlePrevQ = () => {
        if (this.activeExamSession && this.activeExamSession.currentQIndex > 0) {
          this.activeExamSession.currentQIndex--;
          this.render();
        }
      };
      const handleNextQ = () => {
        if (this.activeExamSession && this.activeExamSession.currentQIndex < this.activeExamSession.questions.length - 1) {
          this.activeExamSession.currentQIndex++;
          this.render();
        }
      };

      const btnExamPrevQ = this.container.querySelector('#btnExamPrevQ');
      if (btnExamPrevQ) btnExamPrevQ.addEventListener('click', handlePrevQ);

      const btnExamNextQ = this.container.querySelector('#btnExamNextQ');
      if (btnExamNextQ) btnExamNextQ.addEventListener('click', handleNextQ);

      const btnExamNextQSubmit = this.container.querySelector('#btnExamNextQSubmit');
      if (btnExamNextQSubmit) {
        btnExamNextQSubmit.addEventListener('click', () => {
          const btnSubmit = this.container.querySelector('#btnSubmitActiveExam');
          if (btnSubmit) btnSubmit.click();
        });
      }

      // Auto-scroll current question in horizontal jump bar only when outside visible view
      const activeJumpBtn = this.container.querySelector('.exam-q-jump-btn.current');
      const jumpGrid = this.container.querySelector('.exam-q-jump-grid');
      if (activeJumpBtn && jumpGrid) {
        const gridRect = (typeof jumpGrid.getBoundingClientRect === 'function') ? jumpGrid.getBoundingClientRect() : null;
        const btnRect = (typeof activeJumpBtn.getBoundingClientRect === 'function') ? activeJumpBtn.getBoundingClientRect() : null;
        const hasLayout = gridRect && gridRect.width > 0 && btnRect && btnRect.width > 0;
        const isFullyVisible = hasLayout && (btnRect.left >= gridRect.left + 4 && btnRect.right <= gridRect.right - 4);
        if (!isFullyVisible && typeof activeJumpBtn.scrollIntoView === 'function') {
          try {
            activeJumpBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
          } catch {}
        }
      }

      // Choose Option
      this.container.querySelectorAll('.btn-active-exam-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const optId = btn.getAttribute('data-opt-id');
          const currentQ = this.activeExamSession.questions[this.activeExamSession.currentQIndex];
          if (currentQ) {
            this.activeExamSession.answers[currentQ.id] = optId;

            // ── Zero Data Loss: Auto-save draft on every answer click ──────
            const session = this.activeExamSession;
            const currentUser = authManager.getCurrentUser();
            if (currentUser && session) {
              examManager.saveDraft(session.exam.id, currentUser.id, {
                examId:        session.exam.id,
                answers:       session.answers,
                startedAt:     session.startedAt,
                deadline:      session.deadline,
                durationMinutes: session.exam.durationMinutes,
                timeRemaining: session.timeRemaining,
                currentQIndex: session.currentQIndex,
                questionIds:   session.questions.map(q => q.id),
                optionOrder:   session.optionOrder,
                cumulativeDisconnectedSeconds: session.cumulativeDisconnectedSeconds || 0,
                disconnectStartedAt: session.disconnectStartedAt || null,
              });
            }
            // ── End Auto-save ─────────────────────────────────────────────

            // Update Autosave Badge visual indicator
            const autosaveBadge = this.container ? this.container.querySelector('#examAutosaveBadge') : null;
            if (autosaveBadge) {
              autosaveBadge.innerHTML = '<span class="autosave-dot saving" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b;"></span><span>💾 Đang lưu...</span>';
              setTimeout(() => {
                if (autosaveBadge) {
                  autosaveBadge.innerHTML = '<span class="autosave-dot"></span><span>🟢 Đã tự động lưu bài</span>';
                }
              }, 250);
            }

            this.render();
          }
        });
      });

      // Submit Active Exam — opens in-DOM confirm modal (no window.confirm → no fullscreen exit)
      const btnSubmitActiveExam = this.container.querySelector('#btnSubmitActiveExam');
      if (btnSubmitActiveExam) {
        btnSubmitActiveExam.addEventListener('click', () => {
          if (!this.activeExamSession) return;
          // Show the custom in-DOM confirmation modal (keeps fullscreen intact)
          this.activeExamSession._showSubmitConfirm = true;
          this.render();
        });
      }

      // In-DOM Confirm Modal: "Tiếp tục làm bài" (cancel)
      const btnExamConfirmCancel = this.container.querySelector('#btnExamConfirmCancel');
      if (btnExamConfirmCancel) {
        btnExamConfirmCancel.addEventListener('click', () => {
          if (this.activeExamSession) {
            this.activeExamSession._showSubmitConfirm = false;
          }
          this.render();
        });
      }

      // In-DOM Confirm Modal: "Nộp bài" (confirm submit)
      const btnExamConfirmSubmit = this.container.querySelector('#btnExamConfirmSubmit');
      if (btnExamConfirmSubmit) {
        btnExamConfirmSubmit.addEventListener('click', () => {
          if (this.activeExamSession) {
            this.activeExamSession._showSubmitConfirm = false;
          }
          this._submitActiveExam();
        });
      }

      // Backdrop click on the confirm overlay also closes it (cancel)
      const examSubmitConfirmOverlay = this.container.querySelector('#examSubmitConfirmOverlay');
      if (examSubmitConfirmOverlay) {
        examSubmitConfirmOverlay.addEventListener('click', (e) => {
          // Only close if the click was on the dim backdrop itself, not the dialog box
          if (e.target === examSubmitConfirmOverlay) {
            if (this.activeExamSession) {
              this.activeExamSession._showSubmitConfirm = false;
            }
            this.render();
          }
        });
      }
    }

    // 4. Teacher's Studio Events (3 Subtabs: distribute | publish | print)
    const tabStudioDistribute = this.container.querySelector('#tabStudioDistribute');
    const tabStudioPublish = this.container.querySelector('#tabStudioPublish');
    const tabStudioPrint = this.container.querySelector('#tabStudioPrint');
    const tabStudioAssign = this.container.querySelector('#tabStudioAssign');

    if (tabStudioDistribute) {
      tabStudioDistribute.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('distribute');
      });
    }

    if (tabStudioPublish) {
      tabStudioPublish.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('publish');
      });
    }

    if (tabStudioPrint) {
      tabStudioPrint.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('print');
      });
    }

    if (tabStudioAssign) {
      tabStudioAssign.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('publish');
      });
    }

    // Navigation shortcuts between Studio subtabs
    const btnProceedToPublish = this.container.querySelector('#btnProceedToPublish');
    if (btnProceedToPublish) {
      btnProceedToPublish.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('publish');
      });
    }

    const btnBackToDistribute = this.container.querySelector('#btnBackToDistribute');
    if (btnBackToDistribute) {
      btnBackToDistribute.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('distribute');
      });
    }

    const btnBackToDistributeEmpty = this.container.querySelector('#btnBackToDistributeEmpty');
    if (btnBackToDistributeEmpty) {
      btnBackToDistributeEmpty.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('distribute');
      });
    }

    const btnModifyDistFromPublish = this.container.querySelector('#btnModifyDistFromPublish');
    if (btnModifyDistFromPublish) {
      btnModifyDistFromPublish.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('distribute');
      });
    }

    const btnProceedToPrint = this.container.querySelector('#btnProceedToPrint');
    if (btnProceedToPrint) {
      btnProceedToPrint.addEventListener('click', (e) => {
        e.preventDefault();
        this.setStudioSubTab('print');
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
          ? window.confirm('Bạn có chắc chắn muốn xóa hết toàn bộ các file đề thi Word cũ đã lưu không?\n\nThao tác này sẽ dọn dẹp sạch toàn bộ dữ liệu trên cả máy này và máy chủ đám mây.')
          : true;
        if (!confirmed) return;
        this._clearAllWordFiles();
        this._showAlert('🗑️ Đã xóa sạch toàn bộ dữ liệu đề thi Word cũ! Giờ bạn có thể tải lên các file đề thi mới.');
        this.render();
      });
    }

    // Manual Cloud Sync Trigger
    const handleManualSync = async (btn) => {
      if (!btn) return;
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>Đang đồng bộ...</span>';
      try {
        await this.syncCloudImportedFiles();
        btn.innerHTML = '<span>✅</span> <span>Đã đồng bộ!</span>';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }, 1500);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        this._showAlert(`⚠️ Lỗi khi đồng bộ đám mây: ${err.message || err}`);
      }
    };

    const btnSyncCloudFiles = this.container.querySelector('#btnSyncCloudFiles');
    if (btnSyncCloudFiles) {
      btnSyncCloudFiles.addEventListener('click', () => handleManualSync(btnSyncCloudFiles));
    }

    const btnSyncCloudFilesEmpty = this.container.querySelector('#btnSyncCloudFilesEmpty');
    if (btnSyncCloudFilesEmpty) {
      btnSyncCloudFilesEmpty.addEventListener('click', () => handleManualSync(btnSyncCloudFilesEmpty));
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

    // Helper to update individual row warning UI
    const updateRowWarning = (inputEl, count, max) => {
      const isExceeded = count > max;
      inputEl.style.borderColor = isExceeded ? '#ef4444' : 'var(--line)';
      inputEl.style.color = isExceeded ? '#ef4444' : 'var(--text)';
      const row = inputEl.closest('tr');
      if (row) {
        const spanMax = row.querySelector('.span-dist-file-max');
        if (spanMax) spanMax.style.color = isExceeded ? '#ef4444' : 'var(--dim)';
        let warnEl = row.querySelector('.dist-file-warning-msg');
        if (isExceeded) {
          if (!warnEl) {
            warnEl = document.createElement('span');
            warnEl.className = 'dist-file-warning-msg';
            warnEl.style.cssText = 'font-size:10.5px;color:#ef4444;font-weight:600;';
            const wrap = inputEl.closest('td') ? inputEl.closest('td').firstElementChild : null;
            if (wrap) wrap.appendChild(warnEl);
          }
          warnEl.textContent = `⚠️ Vượt quá ${max} câu`;
        } else if (warnEl) {
          warnEl.remove();
        }
      }
    };

    // In-place UI updater for distribution table (avoids re-rendering and losing focus)
    const updateDistributionUIInPlace = () => {
      const distSummary = this._getDistributedSummary();
      const distBannerEl = this.container.querySelector('#distSummaryInfoBanner');
      if (distBannerEl) {
        distBannerEl.innerHTML = this._renderDistSummaryBanner(distSummary);
      }
      const distTotalQuick = this.container.querySelector('#distQuickTotalSummary');
      if (distTotalQuick) {
        if (distSummary.hasExceeded) {
          distTotalQuick.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Đã chọn: ${distSummary.totalSelected} / ${distSummary.totalAvailable} câu (Vượt quá số câu sẵn có)</span>`;
        } else {
          distTotalQuick.innerHTML = `<span style="color:#10b981;font-weight:700;">🎯 Đã chọn: ${distSummary.totalSelected} / ${distSummary.totalAvailable} câu</span>`;
        }
      }
      // Only auto-update duration if teacher hasn't manually customized it
      if (this.studioAssignDuration === null || this.studioAssignDuration === undefined || this.studioAssignDuration === '') {
        const numDuration = this.container.querySelector('#numAssignDuration');
        if (numDuration) {
          numDuration.value = distSummary.totalSelected > 0 ? Math.max(15, Math.round(distSummary.totalSelected * 1.5)) : 15;
        }
      }
      const hintEl = this.container.querySelector('.studio-assign-action-hint');
      if (hintEl) {
        if (distSummary.hasExceeded) {
          hintEl.innerHTML = `<span style="color:#ef4444;font-weight:700;">⚠️ Số câu chọn bốc vượt quá số câu sẵn có. Vui lòng điều chỉnh lại trước khi phát đề.</span>`;
        } else if (distSummary.totalSelected > 0) {
          hintEl.innerHTML = `<span style="color:#10b981;font-weight:700;">✅ Sẵn sàng phát đề với ${distSummary.totalSelected} câu hỏi tự soạn đã phân phối.</span>`;
        } else {
          hintEl.innerHTML = '⚠️ Vui lòng phân phối câu hỏi ở bảng phía trên trước khi phát.';
        }
      }
    };

    // Distribution Table: Per-File Question Count Input (Smooth, keyboard-friendly editing)
    this.container.querySelectorAll('.input-distribute-file-count').forEach(input => {
      const handleCountUpdate = (e) => {
        const fileId = e.target.getAttribute('data-file-id');
        const file = (this.importedFiles || []).find(f => f.id === fileId);
        const max = file ? (file.questionCount || (file.questions ? file.questions.length : 0)) : 0;
        const raw = e.target.value.trim();

        if (raw === '') {
          // Allow empty during active typing/backspacing without forcing a character
          if (!this.fileDistributions) this.fileDistributions = {};
          this.fileDistributions[fileId] = 0;
          updateRowWarning(e.target, 0, max);
          updateDistributionUIInPlace();
          return;
        }

        const parsed = parseInt(raw, 10);
        const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
        if (!this.fileDistributions) this.fileDistributions = {};
        this.fileDistributions[fileId] = val;

        // Visual warning if exceeding available questions, but DO NOT overwrite typing
        updateRowWarning(e.target, val, max);
        updateDistributionUIInPlace();
      };

      input.addEventListener('input', handleCountUpdate);
      input.addEventListener('change', handleCountUpdate);
      input.addEventListener('blur', (e) => {
        const fileId = e.target.getAttribute('data-file-id');
        const file = (this.importedFiles || []).find(f => f.id === fileId);
        const max = file ? (file.questionCount || (file.questions ? file.questions.length : 0)) : 0;
        const raw = e.target.value.trim();
        let val = parseInt(raw, 10);
        if (isNaN(val) || val < 0) {
          val = 0;
          e.target.value = '0';
        }
        if (!this.fileDistributions) this.fileDistributions = {};
        this.fileDistributions[fileId] = val;
        updateRowWarning(e.target, val, max);
        updateDistributionUIInPlace();
      });
    });

    // Distribution Table: Quick Count Buttons per File
    this.container.querySelectorAll('.btn-quick-dist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileId = btn.getAttribute('data-file-id');
        const count = parseInt(btn.getAttribute('data-count'), 10);
        const file = (this.importedFiles || []).find(f => f.id === fileId);
        const max = file ? (file.questionCount || (file.questions ? file.questions.length : 0)) : 0;
        const finalVal = Math.max(0, count);
        if (!this.fileDistributions) this.fileDistributions = {};
        this.fileDistributions[fileId] = finalVal;
        const matchingInput = this.container.querySelector(`.input-distribute-file-count[data-file-id="${fileId}"]`);
        if (matchingInput) {
          matchingInput.value = finalVal;
          updateRowWarning(matchingInput, finalVal, max);
        }
        updateDistributionUIInPlace();
      });
    });

    // Distribution Table: Global Helper Buttons
    const btnDistributeAll = this.container.querySelector('#btnDistributeAll');
    if (btnDistributeAll) {
      btnDistributeAll.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          const max = f.questionCount || (f.questions ? f.questions.length : 0);
          this.fileDistributions[f.id] = max;
          const matchingInput = this.container.querySelector(`.input-distribute-file-count[data-file-id="${f.id}"]`);
          if (matchingInput) {
            matchingInput.value = max;
            updateRowWarning(matchingInput, max, max);
          }
        });
        updateDistributionUIInPlace();
      });
    }

    const btnDistributeEven10 = this.container.querySelector('#btnDistributeEven10');
    if (btnDistributeEven10) {
      btnDistributeEven10.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          const max = f.questionCount || (f.questions ? f.questions.length : 0);
          const val = Math.min(10, max);
          this.fileDistributions[f.id] = val;
          const matchingInput = this.container.querySelector(`.input-distribute-file-count[data-file-id="${f.id}"]`);
          if (matchingInput) {
            matchingInput.value = val;
            updateRowWarning(matchingInput, val, max);
          }
        });
        updateDistributionUIInPlace();
      });
    }

    const btnDistributeClear = this.container.querySelector('#btnDistributeClear');
    if (btnDistributeClear) {
      btnDistributeClear.addEventListener('click', () => {
        if (!this.fileDistributions) this.fileDistributions = {};
        this.importedFiles.forEach(f => {
          const max = f.questionCount || (f.questions ? f.questions.length : 0);
          this.fileDistributions[f.id] = 0;
          const matchingInput = this.container.querySelector(`.input-distribute-file-count[data-file-id="${f.id}"]`);
          if (matchingInput) {
            matchingInput.value = 0;
            updateRowWarning(matchingInput, 0, max);
          }
        });
        updateDistributionUIInPlace();
      });
    }

    // Radio assign target toggle
    const radAssignAll = this.container.querySelector('#radAssignAll');
    const radAssignClass = this.container.querySelector('#radAssignClass');
    const radAssignCustom = this.container.querySelector('#radAssignCustom');
    const customStudentListWrap = this.container.querySelector('#customStudentListWrap');
    const assignClassWrap = this.container.querySelector('#assignClassWrap');

    const updateAssignTargetUI = () => {
      if (customStudentListWrap) customStudentListWrap.style.display = radAssignCustom?.checked ? 'block' : 'none';
      if (assignClassWrap) assignClassWrap.style.display = radAssignClass?.checked ? 'block' : 'none';
    };

    if (radAssignAll) radAssignAll.addEventListener('change', updateAssignTargetUI);
    if (radAssignClass) radAssignClass.addEventListener('change', updateAssignTargetUI);
    if (radAssignCustom) radAssignCustom.addEventListener('change', updateAssignTargetUI);

    // Radio schedule type toggle & live time validation helper
    const radSchedFlexible = this.container.querySelector('#radSchedFlexible');
    const radSchedFixed = this.container.querySelector('#radSchedFixed');
    const scheduleSettingsWrap = this.container.querySelector('#scheduleSettingsWrap');
    const dtExamDate = this.container.querySelector('#dtExamDate');
    const selStartHour = this.container.querySelector('#selStartHour');
    const selStartMinute = this.container.querySelector('#selStartMinute');
    const tmStartTime = this.container.querySelector('#tmStartTime');
    const numLateGrace = this.container.querySelector('#numLateGrace');
    const scheduleTimeNotice = this.container.querySelector('#scheduleTimeNotice');

    const syncHourMinuteToTmStartTime = () => {
      if (selStartHour && selStartMinute && tmStartTime) {
        tmStartTime.value = `${selStartHour.value}:${selStartMinute.value}`;
      }
      updateScheduleLiveFeedback();
    };

    const updateScheduleLiveFeedback = () => {
      if (!scheduleTimeNotice || !dtExamDate || !tmStartTime) return;
      const dateVal = dtExamDate.value.trim();
      let timeVal = tmStartTime.value.trim();
      const graceVal = parseInt(numLateGrace?.value || '15', 10) || 15;

      if (selStartHour && selStartMinute) {
        if (timeVal && timeVal.includes(':')) {
          const [hPart, mPart] = timeVal.split(':');
          if (selStartHour.value !== hPart.padStart(2, '0')) {
            selStartHour.value = hPart.padStart(2, '0');
          }
          if (selStartMinute.value !== mPart.padStart(2, '0')) {
            selStartMinute.value = mPart.padStart(2, '0');
          }
        } else {
          timeVal = `${selStartHour.value}:${selStartMinute.value}`;
          tmStartTime.value = timeVal;
        }
      }

      if (!dateVal || !timeVal) {
        scheduleTimeNotice.style.display = 'none';
        return;
      }

      const [year, month, day] = dateVal.split('-').map(Number);
      const [sh, sm] = timeVal.split(':').map(Number);
      if (isNaN(year) || isNaN(sh)) {
        scheduleTimeNotice.style.display = 'none';
        return;
      }

      const startDate = new Date(year, month - 1, day, sh, sm, 0, 0);
      const startMs = startDate.getTime();
      const deadlineMs = startMs + graceVal * 60 * 1000;
      const deadlineDate = new Date(deadlineMs);
      const deadH = String(deadlineDate.getHours()).padStart(2, '0');
      const deadM = String(deadlineDate.getMinutes()).padStart(2, '0');
      const deadStr = `${deadH}:${deadM}`;

      const nowMs = Date.now();
      const nowDate = new Date(nowMs);
      const nowH = String(nowDate.getHours()).padStart(2, '0');
      const nowM = String(nowDate.getMinutes()).padStart(2, '0');
      const nowTimeStr = `${nowH}:${nowM}`;

      scheduleTimeNotice.style.display = 'block';

      if (deadlineMs <= nowMs) {
        scheduleTimeNotice.style.background = 'rgba(239,68,68,0.12)';
        scheduleTimeNotice.style.border = '1px solid rgba(239,68,68,0.35)';
        scheduleTimeNotice.style.color = '#ef4444';
        scheduleTimeNotice.innerHTML = `⚠️ <strong>Không hợp lệ:</strong> Khung giờ vào phòng thi (${timeVal} ➔ ${deadStr} ngày ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}) đã kết thúc ở quá khứ so với thời điểm hiện tại (${nowTimeStr}). Cần chọn giờ trong tương lai hoặc tăng số phút ân hạn.`;
      } else if (nowMs >= startMs && nowMs < deadlineMs) {
        const minLeft = Math.ceil((deadlineMs - nowMs) / 60000);
        scheduleTimeNotice.style.background = 'rgba(16,185,129,0.12)';
        scheduleTimeNotice.style.border = '1px solid rgba(16,185,129,0.35)';
        scheduleTimeNotice.style.color = '#10b981';
        scheduleTimeNotice.innerHTML = `🟢 <strong>Khung giờ hợp lệ (Đang trong giờ mở):</strong> Cổng thi mở từ ${timeVal} và sẽ đóng lúc ${deadStr} (còn ~${minLeft} phút nữa để thí sinh bấm vào thi).`;
      } else {
        const minToStart = Math.ceil((startMs - nowMs) / 60000);
        const timeToStartStr = minToStart > 60 ? `${Math.floor(minToStart / 60)}h ${minToStart % 60}p` : `${minToStart} phút`;
        scheduleTimeNotice.style.background = 'rgba(56,189,248,0.12)';
        scheduleTimeNotice.style.border = '1px solid rgba(56,189,248,0.35)';
        scheduleTimeNotice.style.color = '#38bdf8';
        scheduleTimeNotice.innerHTML = `⏰ <strong>Khung giờ hợp lệ:</strong> Mở cổng lúc ${timeVal} ngày ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (sau ~${timeToStartStr}), khóa cổng lúc ${deadStr}.`;
      }
    };

    const updateScheduleUI = () => {
      if (scheduleSettingsWrap) {
        scheduleSettingsWrap.style.display = radSchedFixed?.checked ? 'block' : 'none';
        if (radSchedFixed?.checked) {
          updateScheduleLiveFeedback();
        }
      }
    };

    if (radSchedFlexible) radSchedFlexible.addEventListener('change', updateScheduleUI);
    if (radSchedFixed) radSchedFixed.addEventListener('change', updateScheduleUI);
    if (dtExamDate) dtExamDate.addEventListener('input', updateScheduleLiveFeedback);
    if (selStartHour) selStartHour.addEventListener('change', syncHourMinuteToTmStartTime);
    if (selStartMinute) selStartMinute.addEventListener('change', syncHourMinuteToTmStartTime);
    if (tmStartTime) tmStartTime.addEventListener('input', updateScheduleLiveFeedback);
    if (numLateGrace) numLateGrace.addEventListener('input', updateScheduleLiveFeedback);

    // Track custom exam title input
    const txtAssignTitle = this.container.querySelector('#txtAssignTitle');
    if (txtAssignTitle) {
      txtAssignTitle.addEventListener('focus', (e) => {
        try { e.target.select(); } catch {}
      });
      txtAssignTitle.addEventListener('input', (e) => {
        this.studioAssignTitle = e.target.value;
      });
    }

    // Track custom exam duration input
    const numAssignDuration = this.container.querySelector('#numAssignDuration');
    if (numAssignDuration) {
      numAssignDuration.addEventListener('input', (e) => {
        const raw = e.target.value.trim();
        if (raw === '') {
          this.studioAssignDuration = '';
          return;
        }
        const val = parseInt(raw, 10);
        if (!isNaN(val) && val >= 1) {
          this.studioAssignDuration = val;
        }
      });
      numAssignDuration.addEventListener('blur', (e) => {
        const raw = e.target.value.trim();
        let val = parseInt(raw, 10);
        if (isNaN(val) || val < 1) {
          val = 15;
        } else if (val > 360) {
          val = 360;
        }
        e.target.value = String(val);
        this.studioAssignDuration = val;
      });
    }

    // Track custom exam code input
    const txtAssignExamCode = this.container.querySelector('#txtAssignExamCode');
    if (txtAssignExamCode) {
      txtAssignExamCode.addEventListener('input', (e) => {
        this.studioAssignExamCode = e.target.value;
      });
      txtAssignExamCode.addEventListener('blur', (e) => {
        this.studioAssignExamCode = e.target.value.trim();
      });
    }

    // Create & Assign Exam Button (From multi-file distribution)
    const btnCreateAndAssign = this.container.querySelector('#btnCreateAndAssignExam');
    if (btnCreateAndAssign) {
      btnCreateAndAssign.addEventListener('click', async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (this._isCreatingExam) return;
        this._isCreatingExam = true;

        const originalBtnHtml = btnCreateAndAssign.innerHTML;
        btnCreateAndAssign.disabled = true;
        btnCreateAndAssign.innerHTML = '<span>⏳</span> Đang lưu và phát đề lên máy chủ...';

        try {
          const titleInput = this.container.querySelector('#txtAssignTitle');
          const durationInput = this.container.querySelector('#numAssignDuration');
          const examCodeInput = this.container.querySelector('#txtAssignExamCode');
          const chkShuffleQ = this.container.querySelector('#chkShuffleQuestions');
          const chkShuffleOpt = this.container.querySelector('#chkShuffleOptions');

          let title = (titleInput ? titleInput.value : '').trim();
          if (!title || title.length < 2) {
            title = this.studioAssignTitle || this._getNextExamTitle() || 'Đề 1';
          }

          const durationMinutes = Math.min(180, Math.max(1, parseInt(durationInput ? durationInput.value : '15', 10) || 15));
          const examCode = examCodeInput ? examCodeInput.value.trim() : null;

          // Validate distribution limits: block if teacher selected more questions than available
          const distSummary = this._getDistributedSummary();
          if (distSummary && distSummary.hasExceeded && distSummary.exceededFiles && distSummary.exceededFiles.length > 0) {
            const details = distSummary.exceededFiles.map(e => `• "${e.fileName}": chọn ${e.selectedCount} câu (chỉ có ${e.availableCount} câu sẵn có)`).join('\n');
            this._showAlert(`⚠️ Không thể tạo đề thi: Số câu chọn bốc vượt quá số lượng câu sẵn có trong file:\n\n${details}\n\nVui lòng điều chỉnh lại số câu chọn bốc không vượt quá số câu sẵn có trước khi phát đề!`);
            btnCreateAndAssign.disabled = false;
            btnCreateAndAssign.innerHTML = originalBtnHtml;
            return;
          }

          // Determine assignedTo target
          let assignedTo = ['all'];
          if (radAssignClass && radAssignClass.checked) {
            const selClass = this.container.querySelector('#selAssignClass')?.value;
            if (!selClass) {
              this._showAlert('Vui lòng chọn một lớp học để phân đề!');
              btnCreateAndAssign.disabled = false;
              btnCreateAndAssign.innerHTML = originalBtnHtml;
              return;
            }
            assignedTo = [`class:${selClass}`];
          } else if (radAssignCustom && radAssignCustom.checked) {
            const selectedStudents = [];
            this.container.querySelectorAll('.chk-assign-student:checked').forEach(chk => {
              selectedStudents.push(chk.value);
            });
            if (selectedStudents.length === 0) {
              this._showAlert('Vui lòng chọn ít nhất 1 sinh viên để phân đề!');
              btnCreateAndAssign.disabled = false;
              btnCreateAndAssign.innerHTML = originalBtnHtml;
              return;
            }
            assignedTo = selectedStudents;
          }

          // Get questions from multi-file distribution
          const questionsToAssign = this._getSelectedDistributedQuestions();

          if (questionsToAssign.length === 0) {
            this._showAlert('⚠️ Vui lòng chọn ít nhất 1 câu hỏi từ các bộ đề ở tab Phân Phối Đề trước khi phát đề!');
            btnCreateAndAssign.disabled = false;
            btnCreateAndAssign.innerHTML = originalBtnHtml;
            return;
          }

          // Guarantee strictly unique question IDs across all questions
          const seenQIds = new Set();
          const customQuestions = questionsToAssign.map((q, idx) => {
            let uniqueQId = q.id;
            if (!uniqueQId || seenQIds.has(uniqueQId)) {
              uniqueQId = `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
            }
            seenQIds.add(uniqueQId);
            return { ...q, id: uniqueQId };
          });
          const questionIds = customQuestions.map(q => q.id);

          const radSchedFixed = this.container.querySelector('#radSchedFixed');
          const isScheduled = Boolean(radSchedFixed && radSchedFixed.checked);
          let examDate = null;
          let startTime = null;
          let entryDeadline = null;
          let lateEntryGraceMinutes = 15;

          if (isScheduled) {
            const dtInput = this.container.querySelector('#dtExamDate');
            const tmStartInput = this.container.querySelector('#tmStartTime');
            const numGraceInput = this.container.querySelector('#numLateGrace');

            examDate = dtInput ? dtInput.value.trim() : null;
            startTime = tmStartInput ? tmStartInput.value.trim() : null;
            lateEntryGraceMinutes = numGraceInput ? (parseInt(numGraceInput.value, 10) || 15) : 15;

            if (!examDate || !startTime) {
              this._showAlert('⚠️ Vui lòng chọn đầy đủ Ngày thi và Giờ bắt đầu mở cổng thi!');
              btnCreateAndAssign.disabled = false;
              btnCreateAndAssign.innerHTML = originalBtnHtml;
              this._isCreatingExam = false;
              return;
            }

            const [year, month, day] = examDate.split('-').map(Number);
            const [sh, sm] = startTime.split(':').map(Number);
            const startDate = new Date(year, month - 1, day, sh, sm, 0, 0);
            const startMs = startDate.getTime();
            const deadlineMs = startMs + lateEntryGraceMinutes * 60 * 1000;
            const deadlineDate = new Date(deadlineMs);
            const deadH = String(deadlineDate.getHours()).padStart(2, '0');
            const deadM = String(deadlineDate.getMinutes()).padStart(2, '0');
            entryDeadline = `${deadH}:${deadM}`;

            let nowMs = Date.now();
            if (cloudSyncManager && typeof cloudSyncManager.getServerTimestamp === 'function') {
              try {
                nowMs = await cloudSyncManager.getServerTimestamp();
              } catch (e) {
                nowMs = Date.now();
              }
            }

            if (deadlineMs <= nowMs) {
              const nowDate = new Date(nowMs);
              const nowH = String(nowDate.getHours()).padStart(2, '0');
              const nowM = String(nowDate.getMinutes()).padStart(2, '0');
              const nowTime24 = `${nowH}:${nowM}`;
              const displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
              this._showAlert(
                `⚠️ Thời gian đăng ký không hợp lệ vì đã ở trong quá khứ!\n\n` +
                `• Khung giờ vào phòng thi (24h): ${startTime} ➔ ${entryDeadline} ngày ${displayDate}\n` +
                `• Thời điểm hiện tại (24h): ${nowTime24} ngày ${String(nowDate.getDate()).padStart(2, '0')}/${String(nowDate.getMonth() + 1).padStart(2, '0')}/${nowDate.getFullYear()}\n\n` +
                `Thời hạn đóng cổng theo cài đặt trên đã kết thúc trước thời điểm hiện tại. Vui lòng chọn ngày giờ thi trong tương lai hoặc tăng thời gian ân hạn để học sinh kịp vào thi!`
              );
              btnCreateAndAssign.disabled = false;
              btnCreateAndAssign.innerHTML = originalBtnHtml;
              this._isCreatingExam = false;
              return;
            }
          }

          const candidateId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const examPayload = {
            id: candidateId,
            title,
            description: `Đề thi trắc nghiệm ${durationMinutes} phút môn Toán Rời Rạc.`,
            durationMinutes,
            questionIds,
            customQuestions,
            examCode: (examCode && examCode.trim()) ? examCode.trim().toUpperCase() : null,
            assignedTo,
            createdBy: authManager.getCurrentUser() ? authManager.getCurrentUser().id : 'user_admin',
            shuffleQuestions: chkShuffleQ ? chkShuffleQ.checked : true,
            shuffleOptions: chkShuffleOpt ? chkShuffleOpt.checked : true,
            scheduleType: isScheduled ? 'scheduled' : 'flexible',
            examDate,
            startTime,
            entryDeadline,
            lateEntryGraceMinutes,
          };

          let serverConfirmedExam = null;
          const isOnline = Boolean(
            cloudSyncManager &&
            (cloudSyncManager.isConnected || (
              typeof window !== 'undefined' &&
              window.location &&
              window.location.protocol.startsWith('http') &&
              window.location.hostname !== 'localhost' &&
              window.location.hostname !== '127.0.0.1' &&
              navigator.onLine !== false
            ))
          );

          if (isOnline) {
            const serverRes = await cloudSyncManager.serverCreateExam(examPayload);
            if (!serverRes || !serverRes.success) {
              const errMsg = (serverRes?.error || 'Máy chủ từ chối yêu cầu').replace(/\.+$/, '');
              this._showAlert(`❌ Không thể phát đề thi: ${errMsg}. Vui lòng thử lại.`);
              btnCreateAndAssign.disabled = false;
              btnCreateAndAssign.innerHTML = originalBtnHtml;
              return;
            }
            serverConfirmedExam = serverRes.exam;
          }

          const result = examManager.createExam(serverConfirmedExam || examPayload);

          if (result.success) {
            this.gradebookExamId = null;
            this.adminAnswerKeyExamId = null;

            const targetLabel = this._formatExamTarget(assignedTo);
            const schedMsg = isScheduled
              ? `\nLịch thi: ${examDate.split('-').reverse().join('/')} từ ${startTime} (Khóa cổng lúc ${entryDeadline})`
              : '\nHình thức: Tự do (Vào thi bất kỳ lúc nào)';
            this._showAlert(`🎉 Phát đề thi thành công!\n\nĐề thi: "${title}" (Mã: ${result.exam.examCode || 'N/A'})\nSố câu: ${questionIds.length} câu\nThời lượng: ${durationMinutes} phút\nĐối tượng: ${targetLabel}${schedMsg}\n\nĐề thi đã được chuyển vào mục "Quản Lý Đề Thi". Bạn có thể bấm nút "🔑 File Đáp Án" trong bảng bất kỳ lúc nào để xem hoặc tải đáp án.`);

            this.studioAssignTitle = null;
            this.studioAssignExamCode = null;
            this.studioAssignDuration = null;
            this.render();
          } else {
            this._showAlert(result.error || result.message || 'Có lỗi xảy ra khi lưu đề thi.');
            btnCreateAndAssign.disabled = false;
            btnCreateAndAssign.innerHTML = originalBtnHtml;
          }
        } catch (err) {
          this._showAlert(`❌ Lỗi phát đề thi: ${err.message}`);
          btnCreateAndAssign.disabled = false;
          btnCreateAndAssign.innerHTML = originalBtnHtml;
        } finally {
          this._isCreatingExam = false;
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

    // Admin Review Individual Submission from Gradebook
    this.container.querySelectorAll('.btn-admin-review-sub').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const examId = btn.getAttribute('data-exam-id');
        const userId = btn.getAttribute('data-user-id');
        const sub = examManager.getSubmission(examId, userId);
        if (sub) {
          this.returnToGradebookExamId = examId;
          this.gradebookExamId = null;
          this.reviewSubmission = sub;
          this.render();
        }
      });
    });

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

        btn.disabled = true;
        try {
          let isOnline = false;
          try {
            if (cloudSyncManager && typeof cloudSyncManager.checkConnection === 'function') {
              isOnline = await cloudSyncManager.checkConnection();
            }
          } catch {}

          if (isOnline && cloudSyncManager && typeof cloudSyncManager.serverDeleteExam === 'function') {
            const serverRes = await cloudSyncManager.serverDeleteExam(examId);
            if (serverRes && !serverRes.success) {
              const isForbidden = serverRes.error === 'FORBIDDEN' || (typeof serverRes.error === 'string' && serverRes.error.toLowerCase().includes('quản trị viên'));
              const errMsg = isForbidden
                ? 'Phiên đăng nhập Quản trị viên chưa được xác thực hoặc đã hết hạn. Vui lòng đăng nhập lại tài khoản admin.'
                : (serverRes.error || 'Thất bại');
              this._showAlert(`❌ Lỗi máy chủ khi xóa đề thi: ${errMsg}`);
              btn.disabled = false;
              return;
            }
          }

          examManager.deleteExam(examId);

          if (isOnline && cloudSyncManager) {
            try {
              if (typeof cloudSyncManager.syncExams === 'function') {
                await cloudSyncManager.syncExams(examManager, authManager);
              }
              if (typeof cloudSyncManager.syncExamSubmissions === 'function') {
                await cloudSyncManager.syncExamSubmissions(examManager, authManager);
              }
            } catch {}
          }

          this._showAlert(`🗑️ Đã xóa vĩnh viễn đề thi "${examTitle}".`);
          await this.render();
        } catch (err) {
          this._showAlert(`❌ Lỗi khi xóa đề thi: ${err.message}`);
        } finally {
          btn.disabled = false;
        }
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

        btnClearAllExams.disabled = true;
        const origText = btnClearAllExams.innerHTML;
        btnClearAllExams.innerHTML = '<span>⏳ Đang xóa toàn bộ đề...</span>';

        try {
          if (cloudSyncManager && cloudSyncManager.isConnected) {
            const serverRes = await cloudSyncManager.serverClearAllExams();
            if (serverRes && !serverRes.success) {
              const isForbidden = serverRes.error === 'FORBIDDEN' || (typeof serverRes.error === 'string' && serverRes.error.toLowerCase().includes('quản trị viên'));
              const errMsg = isForbidden
                ? 'Phiên đăng nhập Quản trị viên chưa được xác thực hoặc đã hết hạn. Vui lòng đăng nhập lại tài khoản admin.'
                : (serverRes.error || 'Thất bại');
              this._showAlert(`❌ Lỗi máy chủ khi xóa đề thi: ${errMsg}`);
              return;
            }
          }

          examManager.clearAllExams();
          quizHistoryManager.clearAllExamHistory();

          this._showAlert('✅ Đã xóa toàn bộ đề thi và làm sạch dữ liệu bài làm của sinh viên thành công!');
          this.studioAssignTitle = null;
          await this.render();
        } catch (err) {
          this._showAlert(`❌ Lỗi khi xóa toàn bộ đề thi: ${err.message}`);
        } finally {
          btnClearAllExams.disabled = false;
          btnClearAllExams.innerHTML = origText;
        }
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
        this.printShuffledQuestions = null;
        this.studioSubTab = 'print';
        this.render();
      });
    }

    const numStudioCount = this.container.querySelector('#numStudioCount');
    const selStudioCount = this.container.querySelector('#selStudioCount');

    if (numStudioCount) {
      numStudioCount.addEventListener('input', (e) => {
        const raw = e.target.value.trim();
        if (raw === '') {
          this.studioConfig.count = null;
          return;
        }
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.studioConfig.count = parsed;
        }
      });
      numStudioCount.addEventListener('change', (e) => {
        const raw = e.target.value.trim();
        const parsed = parseInt(raw, 10);
        const pool = this._getStudioPrintPool();
        const max = pool.length || 1;
        if (!isNaN(parsed) && parsed > 0) {
          this.studioConfig.count = Math.min(parsed, max);
          e.target.value = String(this.studioConfig.count);
        } else {
          this.studioConfig.count = null;
          e.target.value = String(max);
        }
        this.printShuffledQuestions = null;
        this.studioSubTab = 'print';
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
        this.printShuffledQuestions = null;
        this.studioSubTab = 'print';
        this.render();
      });
    }

    // 🎲 Đổi Mã Ngẫu Nhiên: generates new random code AND shuffles both questions and options
    const btnGenNewExam = this.container.querySelector('#btnGenNewExam');
    if (btnGenNewExam) {
      btnGenNewExam.addEventListener('click', () => {
        let newCode = Math.floor(100 + Math.random() * 900);
        while (String(newCode) === String(this.printExamCode)) {
          newCode = Math.floor(100 + Math.random() * 900);
        }
        this.printExamCode = String(newCode);

        const pool = this._getStudioPrintPool();
        const desiredCount = (this.studioConfig.count && !isNaN(parseInt(this.studioConfig.count, 10)) && parseInt(this.studioConfig.count, 10) > 0)
          ? Math.min(parseInt(this.studioConfig.count, 10), pool.length)
          : pool.length;
        const baseQuestions = pool.slice(0, desiredCount);

        const shuffleOpts = (q) => {
          if (!q || !Array.isArray(q.options) || q.options.length === 0) return q;
          const orig = q.options.map(o => ({ ...o }));
          const shuffled = shuffle(orig);
          const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
          let newCorrect = q.correctId || 'A';
          const newOpts = shuffled.map((opt, i) => {
            const newId = labels[i] || opt.id;
            if (opt.id === q.correctId) {
              newCorrect = newId;
            }
            return { id: newId, text: opt.text };
          });
          return {
            ...q,
            options: newOpts,
            correctId: newCorrect,
          };
        };

        this.printShuffledQuestions = shuffle(baseQuestions).map(shuffleOpts);
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
      btnPrintExam.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
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
