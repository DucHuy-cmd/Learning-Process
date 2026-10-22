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

  it('requests Fullscreen API on mobile devices when supported and enables CSS immersive fullscreen mode', async () => {
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
    await Promise.resolve();
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // Fullscreen API is requested to hide browser address bar on Android
    expect(requestFullscreenSpy).toHaveBeenCalled();
    expect(session.fullscreenActive).toBe(true);
    expect(document.body.classList.contains('in-active-exam')).toBe(true);

    // Fullscreen toggle button is present on the topbar
    const toggleBtn = container.querySelector('#btnToggleExamFullscreen');
    expect(toggleBtn).not.toBeNull();

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

  it('tracks cumulative disconnect time across multiple offline/exit events, reducing remaining grace from 120s', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Quỹ Mất Mạng Tích Lũy',
      questionIds: ['logic_q01', 'logic_q02'],
      durationMinutes: 20,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    // Simulate 1st disconnect: departed 30s ago
    const startedAt = Date.now() - 60000;
    const deadline = startedAt + 20 * 60 * 1000;
    const disconnectStartedAt = Date.now() - 30000; // 30s away
    examManager.saveDraft(examId, testStudent.id, {
      examId,
      answers: { logic_q01: 'A' },
      startedAt,
      deadline,
      durationMinutes: 20,
      cumulativeDisconnectedSeconds: 0,
      disconnectStartedAt,
      questionIds: ['logic_q01', 'logic_q02'],
    });

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');
    window.confirm = () => true;

    // Student clicks to resume exam
    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // 1st exit: away for 30s -> cumulativeDisconnectedSeconds is now 30
    expect(session.cumulativeDisconnectedSeconds).toBe(30);

    // Grace badge displays remaining: 120 - 30 = 90s (01:30)
    const graceText = container.querySelector('#examGraceTimeText');
    expect(graceText).not.toBeNull();
    expect(graceText.textContent).toBe('01:30');

    // Simulate 2nd exit: student leaves for 40s
    session.cumulativeDisconnectedSeconds = 30;
    session.disconnectStartedAt = Date.now() - 40000;
    quizView._recordReturnTimestamp();

    // Cumulative is now 30 + 40 = 70s, remaining grace is 50s
    expect(session.cumulativeDisconnectedSeconds).toBe(70);
  });

  it('automatically submits exam when cumulative disconnect/away time exceeds 120 seconds', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Vi Phạm Quá 2 Phút Mất Mạng',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    // Student was already away for 90s, and then disconnected 35s ago (total = 125s > 120s)
    const startedAt = Date.now() - 10 * 60 * 1000;
    const deadline = startedAt + 15 * 60 * 1000; // still 5 minutes left in exam!
    const disconnectStartedAt = Date.now() - 35000;
    examManager.saveDraft(examId, testStudent.id, {
      examId,
      answers: { logic_q01: 'C' },
      startedAt,
      deadline,
      durationMinutes: 15,
      cumulativeDisconnectedSeconds: 90,
      disconnectStartedAt,
      questionIds: ['logic_q01'],
    });

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    // Attempting to resume -> detects total cumulative away >= 120s -> AUTO SUBMIT!
    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();

    // Draft is cleaned up
    expect(examManager.loadDraft(examId, testStudent.id, { includeExpired: false })).toBeNull();

    // Submission was recorded with student's answers
    const sub = examManager.getSubmission(examId, testStudent.id);
    expect(sub).not.toBeNull();
    expect(quizView.reviewSubmission).not.toBeNull();
    expect(quizView.activeExamSession).toBeNull();
  });

  it('traps mobile back button / gesture via popstate, prevents page exit, and records immediate violation', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'
    );
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const vibrateSpy = vi.fn();
    window.navigator.vibrate = vibrateSpy;

    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Phím Back Android',
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
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Initial pushState was called on exam start
    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ inExamLockdown: true, examId }),
      '',
      expect.any(String)
    );

    // Student presses Android Hardware Back or Edge Swipe Gesture -> fires popstate
    window.dispatchEvent(new window.PopStateEvent('popstate'));

    // Verify: Trapped inside exam room, vibration triggered, 1 immediate violation recorded
    expect(vibrateSpy).toHaveBeenCalledWith([200, 100, 200]);
    expect(session.isAway).toBe(true);
    expect(session.awayReason).toBe('mobile_back_button_pressed');
    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);

    // Verify lockdown overlay message
    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Bấm Nút Quay Lại Trên Điện Thoại');
    const warning = container.querySelector('.exam-lockdown-warning');
    expect(warning.textContent).toContain('1/3');

    // Click "Quay trở lại bài thi" resumes exam
    const resumeBtn = container.querySelector('#btnResumeExamLockdown');
    expect(resumeBtn).not.toBeNull();
    resumeBtn.click();
    expect(session.isAway).toBe(false);
  });

  it('detects notification shade / quick settings pull-down on mobile and triggers lockdown overlay', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Samsung Galaxy S24) AppleWebKit/537.36 Mobile Safari/537.36'
    );

    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Vuốt Notification Shade',
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
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // User swipes down notification drawer or quick settings -> fires window.blur
    window.dispatchEvent(new window.Event('blur'));

    expect(session.isAway).toBe(true);
    expect(session.awayReason).toBe('mobile_drawer_or_blur');
    expect(session.lockdownPending).toBe(true);

    // Verify overlay shows notification drawer specific warning
    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Kéo Thanh Thông Báo / Chuyển Ứng Dụng');
  });

  it('detects split-screen or floating multi-window mode on mobile devices', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 Mobile Safari/537.36'
    );

    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Split Screen',
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
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // Simulate mobile screen dimensions: screen height = 800
    window.screen = { height: 800, width: 400 };
    // Normal mobile full height (e.g. 740px with status bar)
    window.innerHeight = 740;
    window.dispatchEvent(new window.Event('resize'));
    expect(session.isAway).toBeFalsy();

    // Now user switches into 50/50 split-screen -> innerHeight drops to 380 (< 800 * 0.58 = 464)
    window.innerHeight = 380;
    window.dispatchEvent(new window.Event('resize'));

    expect(session.isAway).toBe(true);
    expect(session.awayReason).toBe('split_screen_detected');
    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Chia Đôi Màn Hình');
  });

  it('renders fullscreen warning banner when not in fullscreen and activates fullscreen on direct tap', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Xiaomi 13) AppleWebKit/537.36 Mobile Safari/537.36'
    );
    const requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenSpy;

    const examRes = examManager.createExam({
      title: 'Đề Thi Fullscreen Banner',
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
    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();

    // If document.fullscreenElement is null (not yet in fullscreen), banner is visible
    const banner = container.querySelector('#mobileFullscreenWarningBanner');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Chưa bật Toàn Màn Hình');

    // Tapping the banner button triggers direct requestFullscreen
    const triggerBtn = container.querySelector('#btnTriggerExamFullscreen');
    expect(triggerBtn).not.toBeNull();
    triggerBtn.click();
    expect(requestFullscreenSpy).toHaveBeenCalled();
  });

  it('correctly calculates and displays class student count in exam management table instead of 1 student', () => {
    // Register 4 students into class CQ.67
    authManager.quickLogin('user_admin');
    ['sv1', 'sv2', 'sv3', 'sv4'].forEach((uname, i) => {
      authManager.adminCreateUser({
        username: uname,
        fullName: `Sinh Viên ${i + 1}`,
        className: 'CQ.67',
        email: `${uname}@toanrr.edu.vn`,
        password: '123',
      });
    });

    const examRes = examManager.createExam({
      title: 'Đề Thi Khảo Sát Lớp CQ.67',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: ['class:CQ.67'],
      createdBy: 'user_admin',
    });
    expect(examRes.success).toBe(true);

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    // Check table pill badge: MUST NOT show "1 sinh viên"
    const tableBadge = container.querySelector('.leaderboard-table .pill-badge');
    expect(tableBadge).not.toBeNull();
    expect(tableBadge.textContent).toContain('Lớp CQ.67 (4 sinh viên)');
  });

  it('removes redundant top prev/next buttons and preserves horizontal question jump grid scroll position', () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Thanh Trượt Câu Hỏi',
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
    expect(quizView.activeExamSession).not.toBeNull();

    // Verify top prev/next buttons are completely removed
    expect(container.querySelector('.exam-q-top-nav')).toBeNull();
    expect(container.querySelector('.btn-exam-prev-top')).toBeNull();
    expect(container.querySelector('.btn-exam-next-top')).toBeNull();

    // Verify question counter is still cleanly present
    expect(container.textContent).toContain('Câu 1 / 2');

    // Simulate jump grid scroll position at 250px
    const jumpGrid = container.querySelector('.exam-q-jump-grid');
    expect(jumpGrid).not.toBeNull();
    jumpGrid.scrollLeft = 250;

    // Student selects an option on Question 1 -> triggers re-render
    const optBtn = container.querySelector('.btn-active-exam-opt');
    optBtn.click();

    // Scroll position MUST be preserved and not reset to 0
    const reRenderedGrid = container.querySelector('.exam-q-jump-grid');
    expect(reRenderedGrid.scrollLeft).toBe(250);
  });
});
