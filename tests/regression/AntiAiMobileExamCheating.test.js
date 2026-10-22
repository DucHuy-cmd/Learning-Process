/**
 * @file AntiAiMobileExamCheating.test.js
 * Comprehensive test suite verifying Phase 1 & 2 Anti-AI Mobile Screen & Voice Cheating Defenses:
 * 1. Zero-Latency Screen Blackout Shield on blur / assistant overlay.
 * 2. Invisible Zero-Width Unicode Noise Injection (Anti-OCR & Tokenizer Poisoning).
 * 3. 3-Finger Swipe Screenshot Gesture Blocking.
 * 4. Quick Assistant / Circle to Search Snapping Detection.
 * 5. Dynamic Personalized Watermark (Student Name + ID + Exam ID).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { authManager } from '../../src/core/auth/AuthManager.js';

describe('Anti-AI Mobile Screen & Voice Cheating Defenses (Phase 1 & Phase 2)', () => {
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
      username: 'sv_ai_defense_test',
      fullName: 'Nguyễn Văn Kiểm Thử',
      className: 'D21CQCN01-N',
      email: 'sv_ai@toanrr.edu.vn',
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

  it('1. Injects invisible zero-width unicode spaces (Anti-OCR noise) into text without altering LaTeX math', () => {
    const quizView = new QuizView({ container });

    // Plain text test
    const raw = 'Đồ thị vô hướng liên thông';
    const poisoned = quizView._injectAntiAiNoise(raw);
    expect(poisoned).toContain('\u200B');
    // Human readability remains unchanged when stripping zero-width spaces
    expect(poisoned.replace(/\u200B/g, '')).toBe(raw);

    // Math formula preservation test
    const mathRaw = 'Cho đồ thị $G = (V, E)$ và ma trận $A_{ij}$';
    const poisonedMath = quizView._injectAntiAiNoise(mathRaw);
    expect(poisonedMath).toContain('$G = (V, E)$');
    expect(poisonedMath).toContain('$A_{ij}$');
  });

  it('2. Instantly applies screen-guarded class and displays Anti-Screen Capture Shield upon blur or visibility hidden', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Chụp Màn Hình AI',
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

    const examRoom = container.querySelector('.active-exam-room');
    const shield = container.querySelector('#examAntiCaptureShield');
    expect(examRoom).not.toBeNull();
    expect(shield).not.toBeNull();
    expect(shield.style.display).toBe('none');

    // Simulate Google Assistant / Circle to Search overlay trigger -> fires blur
    window.dispatchEvent(new window.Event('blur'));

    // Verify: Zero-Latency Shield is immediately displayed and exam room receives .screen-guarded
    expect(examRoom.classList.contains('screen-guarded')).toBe(true);
    expect(shield.style.display).toBe('flex');

    // Resume exam -> shield is lifted and room is un-guarded
    const resumeBtn = container.querySelector('#btnResumeExamLockdown');
    expect(resumeBtn).not.toBeNull();
    resumeBtn.click();
    const updatedExamRoom = container.querySelector('.active-exam-room');
    const updatedShield = container.querySelector('#examAntiCaptureShield');
    expect(updatedExamRoom.classList.contains('screen-guarded')).toBe(false);
    expect(updatedShield.style.display).toBe('none');
  });

  it('3. Intercepts 3-finger swipe screenshot touch gestures, prevents default, and records an immediate violation', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Vuốt 3 Ngón Tay',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Simulate 3-finger touch gesture on document
    const touchEvent = new window.Event('touchstart', { bubbles: true, cancelable: true });
    touchEvent.touches = [{}, {}, {}]; // 3 touch points
    document.dispatchEvent(touchEvent);

    // Verify: prevented default, 1 violation recorded, awayReason = three_finger_screenshot_attempt
    expect(touchEvent.defaultPrevented).toBe(true);
    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);
    expect(session.awayReason).toBe('three_finger_screenshot_attempt');

    // Lockdown overlay warns about 3-finger gesture
    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Chặn Cử Chỉ Chụp Màn Hình 3 Ngón Tay');
  });

  it('4. Detects rapid Assistant / Circle to Search snapping (quick blur-focus cycle) and records violation', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Trợ Lý Ảo Quick Snap',
      questionIds: ['logic_q01'],
      durationMinutes: 20,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Simulate user triggering Circle to Search: blur occurs at T, focus returns at T + 600ms
    session.lastBlurAt = Date.now() - 600; // 600ms duration (characteristic of overlay snap)
    window.dispatchEvent(new window.Event('focus'));

    // Verify: detected quick assistant snap and recorded 1 violation
    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);
    expect(session.awayReason).toBe('quick_assistant_detected');

    // Verify lockdown dialog title
    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Kích Hoạt Trợ Lý Ảo / Quét Màn Hình Nhanh');
  });

  it('5. Renders dynamic personalized watermark containing student full name, username, and exam ID', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Watermark Cá Nhân Hóa',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    // Verify watermark exists
    const watermark = container.querySelector('.exam-dynamic-watermark');
    expect(watermark).not.toBeNull();
    expect(watermark.textContent).toContain('Nguyễn Văn Kiểm Thử');
    expect(watermark.textContent).toContain('sv_ai_defense_test');
    expect(watermark.textContent).toContain(examId);

    // Verify question container has data-anti-ai attribute and poisoned text
    const qWrap = container.querySelector('.exam-question-text-wrap');
    expect(qWrap).not.toBeNull();
    expect(qWrap.getAttribute('data-anti-ai')).toBe('protected');
    expect(qWrap.textContent).toContain('\u200B');

    // Verify microphone proctoring badge is displayed on topbar
    const micBadge = container.querySelector('#examMicBadge');
    expect(micBadge).not.toBeNull();
    expect(micBadge.textContent).toContain('Chống AI giọng nói');
  });

  it('6. Intercepts touchcancel event when Android system assistant overlay steals touch, blacks out screen and records violation', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Touchcancel Trợ Lý Ảo',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Dispatch touchcancel event (simulating Android OS overlay stealing touch)
    const cancelEvt = new window.Event('touchcancel', { bubbles: true, cancelable: true });
    document.dispatchEvent(cancelEvt);

    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);
    expect(session.awayReason).toBe('assistant_overlay_intercept');

    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Trợ Lý Hệ Thống Chiếm Quyền Màn Hình');
  });

  it('7. Handles real-time voice speech cheating detection, triggers screen blackout and records violation', async () => {
    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Gemini Voice Nói Chuyện',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Simulate voice proctoring detecting speech
    quizView._applyScreenGuard(true);
    quizView._handleScreenDeparture('voice_cheating_detected');
    quizView._recordExamLockdownTimeoutViolation(session);

    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);
    expect(session.awayReason).toBe('voice_cheating_detected');

    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Phát Hiện Nói Chuyện / Trợ Lý Giọng Nói AI');
  });

  it('8. Traps long-press touch gesture (>450ms) to block Circle to Search / context menu and records violation', async () => {
    vi.useFakeTimers();

    const examRes = examManager.createExam({
      title: 'Đề Thi Chống Nhấn Giữ Long Press',
      questionIds: ['logic_q01'],
      durationMinutes: 15,
      assignedTo: [testStudent.id],
      createdBy: 'user_admin',
    });
    const examId = examRes.exam.id;

    const quizView = new QuizView({ container });
    quizView.setTab('myExams');

    container.querySelector(`.btn-start-exam[data-exam-id="${examId}"]`).click();
    await Promise.resolve();

    const session = quizView.activeExamSession;
    expect(session).not.toBeNull();
    expect(session.violationCount).toBe(0);

    // Simulate single-finger touch held down for > 450ms
    const touchStart = new window.Event('touchstart', { bubbles: true, cancelable: true });
    touchStart.touches = [{}];
    document.dispatchEvent(touchStart);

    // Advance timers past 450ms threshold
    vi.advanceTimersByTime(500);

    expect(session.violationCount).toBe(1);
    expect(session.awayViolationRecorded).toBe(true);
    expect(session.awayReason).toBe('long_press_ai_assist_attempt');

    const title = container.querySelector('#examLockdownTitle');
    expect(title.textContent).toContain('Chặn Nhấn Giữ Gọi Trợ Lý Ảo');
  });
});
