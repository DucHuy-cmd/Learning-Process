/**
 * @file MobileAndResilientExamRoom.test.js
 * Test suite verifying Mobile/Desktop anti-cheat isolation, Per-click Auto-Save,
 * Real-time Deadline Resume, and Offline Submission Queue resilience.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { authManager } from '../../src/core/auth/AuthManager.js';
import { cloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

describe('Mobile & Resilient Exam Room (100+ Concurrency & Cross-Device Protection)', () => {
  let dom;
  let window;
  let document;
  let container;
  let testStudent;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="quizContainer"></div></body></html>`, {
      url: 'http://localhost/',
    });

    window = dom.window;
    document = window.document;
    window.alert = () => {};
    window.confirm = () => true;

    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [] }),
    });

    examManager.storage = window.localStorage;
    examManager._initStorage();
    authManager.storage = window.localStorage;
    authManager._initStorage();

    container = document.getElementById('quizContainer');

    examManager.clearAllData();
    authManager.resetUsersToDefault({ force: true });

    authManager.quickLogin('user_admin');
    const created = authManager.adminCreateUser({
      username: 'sv_concurrency_test',
      fullName: 'Sinh Viên Kiểm Thử',
      className: 'D21CQCN01-N',
      email: 'sv_test@toanrr.edu.vn',
      password: '123',
    });
    testStudent = created.user;

    authManager.quickLogin(testStudent.id);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete global.fetch;
    delete global.localStorage;
    delete global.window;
    delete global.document;
  });

  it('correctly detects mobile devices via userAgent and viewport width', () => {
    const quizView = new QuizView({ container });

    // Desktop mode (default in JSDOM)
    expect(quizView._isMobileDevice()).toBe(false);

    // Simulated mobile user agent (Android)
    const spy = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 Mobile Safari/537.36'
    );
    expect(quizView._isMobileDevice()).toBe(true);

    // Simulated iPhone user agent
    spy.mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    );
    expect(quizView._isMobileDevice()).toBe(true);

    // Small screen width fallback
    spy.mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    window.innerWidth = 480;
    expect(quizView._isMobileDevice()).toBe(true);
  });

  it('never invokes Fullscreen API on mobile devices and bypasses resize departure false-positives', async () => {
    // Set user agent to Android
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36'
    );

    const requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenSpy;

    const examRes = examManager.createExam({
      title: 'Đề Thi Android Mobile',
      questionIds: ['logic_q01', 'logic_q02'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // Fullscreen API should NEVER be requested on mobile
    expect(requestFullscreenSpy).not.toHaveBeenCalled();
    expect(session.fullscreenActive).toBe(true);

    // Simulate virtual keyboard popup (resize event) -> MUST NOT trigger departure!
    window.dispatchEvent(new window.Event('resize'));
    expect(session.isAway).toBeFalsy();
  });

  it('auto-saves draft per-click with absolute deadline and optionOrder preservation', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Auto-Save Per-Click',
      questionIds: ['logic_q01', 'logic_q02'],
      durationMinutes: 20,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
      shuffleQuestions: true,
      shuffleOptions: true,
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // Verify initial draft was saved immediately upon start
    const initialDraft = examManager.loadDraft(examId, testStudent.id);
    expect(initialDraft).not.toBeNull();
    expect(initialDraft.deadline).toBeGreaterThan(Date.now());
    expect(initialDraft.questionIds.length).toBe(2);

    // Student clicks option A on question 1
    const firstOptBtn = container.querySelector('.btn-active-exam-opt');
    const optId = firstOptBtn.getAttribute('data-opt-id');
    firstOptBtn.click();

    // Check draft in storage updated immediately
    const updatedDraft = examManager.loadDraft(examId, testStudent.id);
    expect(updatedDraft.answers[session.questions[0].id]).toBe(optId);

    // Badge indicates auto-saved status
    const badge = container.querySelector('#examAutosaveBadge');
    expect(badge.textContent).toContain('Đã tự động lưu bài');
  });

  it('auto-resumes session restoring exact question and option order with real-time remaining', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Khôi Phục Dở Dang',
      questionIds: ['logic_q01', 'logic_q02', 'logic_q03'],
      durationMinutes: 30,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    // Simulate an existing ongoing draft from 5 minutes ago (300 seconds elapsed)
    const startedAt = Date.now() - 300000;
    const deadline = startedAt + 30 * 60 * 1000;
    examManager.saveDraft(examId, testStudent.id, {
      examId,
      answers: { logic_q01: 'A' },
      startedAt,
      deadline,
      durationMinutes: 30,
      currentQIndex: 1,
      questionIds: ['logic_q02', 'logic_q01', 'logic_q03'],
      optionOrder: { logic_q02: ['C', 'A', 'B', 'D'] },
    });

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;

    // Card displays "ĐANG LÀM DỞ DANG"
    const cardBadge = container.querySelector('.exam-status-badge');
    expect(cardBadge.textContent).toContain('ĐANG LÀM DỞ DANG');

    // Click "Tiếp Tục Làm Bài"
    const resumeBtn = container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`);
    expect(resumeBtn.textContent).toContain('Tiếp Tục Làm Bài');
    resumeBtn.click();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    // Restored exact order: logic_q02 first, then logic_q01, then logic_q03
    expect(session.questions.map(q => q.id)).toEqual(['logic_q02', 'logic_q01', 'logic_q03']);
    expect(session.answers).toEqual({ logic_q01: 'A' });
    expect(session.currentQIndex).toBe(1);
    // Real time remaining should be ~25 minutes (1500s)
    expect(session.timeRemaining).toBeGreaterThanOrEqual(1495);
    expect(session.timeRemaining).toBeLessThanOrEqual(1501);
  });

  it('detects expired draft on return and automatically submits with saved answers', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Quá Hạn Khi Offline',
      questionIds: ['logic_q01'],
      durationMinutes: 10,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    // Draft started 20 minutes ago (10-minute exam -> expired 10 minutes ago)
    const startedAt = Date.now() - 20 * 60 * 1000;
    const deadline = startedAt + 10 * 60 * 1000;
    examManager.saveDraft(examId, testStudent.id, {
      examId,
      answers: { logic_q01: 'B' },
      startedAt,
      deadline,
      durationMinutes: 10,
      questionIds: ['logic_q01'],
    });

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    // Clicking start auto-detects expired draft, cleans it, and submits immediately
    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();

    // Draft is cleaned up
    expect(examManager.loadDraft(examId, testStudent.id, { includeExpired: false })).toBeNull();

    // Submission recorded
    const sub = examManager.getSubmission(examId, testStudent.id);
    expect(sub).not.toBeNull();
    expect(quizView.reviewSubmission).not.toBeNull();
  });

  it('enqueues submission in offline queue during network spike and provides downloadable Emergency Backup Slip', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Mất Mạng Lúc Nộp',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    expect(quizView.activeExamSession).not.toBeNull();

    // Simulate server offline / 504 spike during submission
    vi.spyOn(cloudSyncManager, 'serverSubmitExam').mockRejectedValue(new Error('504 Gateway Timeout'));

    // Submit exam
    await quizView._submitActiveExam();

    // Work was enqueued in offline queue safely
    const queue = examManager.getOfflineQueue();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0].examId).toBe(examId);

    // Student can review score and sees Emergency Slip download button
    expect(quizView.reviewSubmission).not.toBeNull();
    const btnSlip = container.querySelector('#btnDownloadMySlip');
    expect(btnSlip).not.toBeNull();

    // Trigger download slip
    const slipResult = examManager.downloadEmergencyBackupSlip(quizView.reviewSubmission);
    expect(slipResult).toBe(true);
  });
});
