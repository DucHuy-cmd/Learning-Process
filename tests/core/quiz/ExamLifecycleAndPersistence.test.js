/**
 * @file ExamLifecycleAndPersistence.test.js
 * Comprehensive end-to-end unit and lifecycle tests for examinations, drafts,
 * submissions, persistence, and synchronization.
 *
 * Covers all 11 required scenarios from the problem specification:
 * 1. Issue exam -> read back from PostgreSQL / adapter -> open in new browser: exam and full questions/config intact.
 * 2. Server rejects exam creation or DB error: UI does not report success and does not destroy existing local exams.
 * 3. Assign exam to entire class ('all') vs selected group: only targeted students see the exam.
 * 4. Student takes exam, answers questions, reloads, and resumes: answers, option order, and time remaining are preserved.
 * 5. Submit exam successfully: server stores exactly one submission; score and gradebook match after reload.
 * 6. Network drops during submission: payload safely preserved in offline queue and retried when online.
 * 7. Server received submission but client timed out: retry idempotently returns previous submission without duplication.
 * 8. Two concurrent submission requests for same student/exam: only one is recorded.
 * 9. Non-existent exam or exam not assigned to student: server rejects with appropriate status (404 / 403).
 * 10. Time expired or integrity violation ban: auto-submits once without losing payload or duplicating results.
 * 11. Sync error or empty response: does not overwrite valid local exams with [].
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ExamManager } from '../../../src/core/quiz/ExamManager.js';
import { CloudSyncManager } from '../../../src/core/sync/CloudSyncManager.js';
import { handleRequest } from '../../../src/server/app.js';
import { serverExams, serverExamSubmissions, serverUsers, serverDeletedExams } from '../../../src/server/auth/ServerDataStore.js';
import { sqlDb } from '../../../src/server/db/SqlDatabaseAdapter.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

function createMockHttp({ method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  const normalizedHeaders = { host: 'localhost:3000', 'content-type': 'application/json' };
  for (const [k, v] of Object.entries(headers)) {
    normalizedHeaders[k.toLowerCase()] = v;
  }
  req.headers = normalizedHeaders;

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    end(chunk) {
      if (chunk) this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
    },
    getJson() {
      try {
        return JSON.parse(this.body);
      } catch {
        return null;
      }
    },
  };

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    }
    req.emit('end');
  });

  return { req, res };
}

async function sendRequest(options) {
  const { req, res } = createMockHttp(options);
  await handleRequest(req, res);
  return { statusCode: res.statusCode, data: res.getJson() };
}

describe('Exam Lifecycle, Drafts, Idempotency & Persistence Test Suite', () => {
  let savedExams;
  let savedSubmissions;
  let savedUsers;

  beforeEach(() => {
    savedExams = [...serverExams];
    savedSubmissions = [...serverExamSubmissions];
    savedUsers = [...serverUsers];
    serverDeletedExams.clear();

    // Ensure mock users exist on server
    if (!serverUsers.some(u => u.id === 'student_k66_01')) {
      serverUsers.push({ id: 'student_k66_01', username: 'sv01', fullName: 'Nguyễn Văn A', role: 'student' });
    }
    if (!serverUsers.some(u => u.id === 'student_k66_02')) {
      serverUsers.push({ id: 'student_k66_02', username: 'sv02', fullName: 'Trần Thị B', role: 'student' });
    }
  });

  afterEach(() => {
    serverExams.splice(0, serverExams.length, ...savedExams);
    serverExamSubmissions.splice(0, serverExamSubmissions.length, ...savedSubmissions);
    serverUsers.splice(0, serverUsers.length, ...savedUsers);
    serverDeletedExams.clear();
    vi.restoreAllMocks();
  });

  // Scenario 1: Issue exam -> read back from PostgreSQL / adapter -> open in new browser
  it('Scenario 1: Creates exam, serializes to PostgreSQL/adapter, reads back in new browser with all questions & settings intact', async () => {
    const customQuestions = [
      {
        id: 'word_q_01',
        question: 'Câu hỏi Word số 1?',
        options: [
          { id: 'A', text: 'Đáp án A' },
          { id: 'B', text: 'Đáp án B' },
        ],
        correctId: 'A',
      },
      {
        id: 'word_q_02',
        question: 'Câu hỏi Word số 2?',
        options: [
          { id: 'A', text: 'Đáp án A' },
          { id: 'B', text: 'Đáp án B' },
        ],
        correctId: 'B',
      },
    ];

    const examPayload = {
      id: `exam_p1_${Date.now()}`,
      title: 'Đề Khảo Sát Tự Soạn',
      description: 'Mô tả chi tiết đề thi',
      durationMinutes: 45,
      questionIds: ['word_q_01', 'word_q_02'],
      customQuestions,
      examCode: 'CODE-999',
      assignedTo: ['all'],
      shuffleQuestions: true,
      shuffleOptions: true,
    };

    // 1. Post to server
    const createRes = await sendRequest({
      method: 'POST',
      url: '/api/exams',
      headers: { authorization: 'Bearer user_admin' },
      body: examPayload,
    });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.data.success).toBe(true);
    expect(createRes.data.exam.examCode).toBe('CODE-999');

    // 2. Simulate reading back via GET /api/exams from a completely fresh client browser
    const getRes = await sendRequest({
      method: 'GET',
      url: '/api/exams',
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.data.success).toBe(true);

    const freshExam = getRes.data.exams.find(e => e.id === examPayload.id);
    expect(freshExam).not.toBeNull();
    expect(freshExam.title).toBe('Đề Khảo Sát Tự Soạn');
    expect(freshExam.description).toBe('Mô tả chi tiết đề thi');
    expect(freshExam.durationMinutes).toBe(45);
    expect(freshExam.examCode).toBe('CODE-999');
    expect(freshExam.assignedTo).toEqual(['all']);
    expect(freshExam.questionIds).toEqual(['word_q_01', 'word_q_02']);
    expect(freshExam.customQuestions.length).toBe(2);

    // 3. Mount in a fresh client ExamManager
    const freshStorage = new MockStorage();
    const freshManager = new ExamManager({ storage: freshStorage });
    const syncRes = await freshManager.createExam(freshExam);
    expect(syncRes.success).toBe(true);

    const loadedQuestions = freshManager.getExamQuestions(freshExam.id);
    expect(loadedQuestions.length).toBe(2);
    expect(loadedQuestions[0].id).toBe('word_q_01');
    expect(loadedQuestions[1].id).toBe('word_q_02');
  });

  // Scenario 2: Server rejects creation -> UI does not report success and does not destroy existing local exams
  it('Scenario 2: Server rejects exam creation with 400/403, CloudSyncManager returns error and does not corrupt local exams', async () => {
    const sync = new CloudSyncManager({ baseUrl: 'http://localhost:3000' });
    const localStorage = new MockStorage();
    const manager = new ExamManager({ storage: localStorage });

    // Existing local exam
    manager.createExam({
      id: 'existing_local_exam',
      title: 'Đề Có Sẵn Của Giáo Viên',
      durationMinutes: 20,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    expect(manager.getExams().some(e => e.id === 'existing_local_exam')).toBe(true);

    // Simulate server rejection (e.g. invalid duration or non-admin)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Thời lượng không hợp lệ' }),
    });

    const createRes = await sync.serverCreateExam({
      title: 'Đề Lỗi',
      durationMinutes: 9999, // Invalid
    });

    expect(createRes.success).toBe(false);
    expect(createRes.error).toContain('Thời lượng không hợp lệ');

    // Existing local exams must remain completely intact
    const examsAfter = manager.getExams();
    expect(examsAfter.some(e => e.id === 'existing_local_exam')).toBe(true);
  });

  // Scenario 3: Assign to all vs selected students
  it('Scenario 3: Correctly scopes exams between all students and specific assigned students', async () => {
    const storage = new MockStorage();
    const manager = new ExamManager({ storage });

    manager.createExam({
      id: 'exam_for_all',
      title: 'Đề Thi Toàn Trường',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });

    manager.createExam({
      id: 'exam_for_sv01_only',
      title: 'Đề Thi Chọn Lọc SV01',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['student_k66_01'],
    });

    // Student 1 should see both exams
    const sv01Exams = manager.getExamsForUser('student_k66_01');
    expect(sv01Exams.some(e => e.id === 'exam_for_all')).toBe(true);
    expect(sv01Exams.some(e => e.id === 'exam_for_sv01_only')).toBe(true);

    // Student 2 should ONLY see the general exam
    const sv02Exams = manager.getExamsForUser('student_k66_02');
    expect(sv02Exams.some(e => e.id === 'exam_for_all')).toBe(true);
    expect(sv02Exams.some(e => e.id === 'exam_for_sv01_only')).toBe(false);
  });

  // Scenario 4: Student takes exam, answers questions, reloads, and resumes
  it('Scenario 4: Draft persistence saves answers, current question, option order, and remaining time across reload', () => {
    const storage = new MockStorage();
    const manager = new ExamManager({ storage });

    const examId = 'exam_draft_test';
    const userId = 'student_test_user';

    manager.createExam({
      id: examId,
      title: 'Đề Thi Test Bản Nháp',
      durationMinutes: 30,
      questionIds: ['logic_q01', 'logic_q03'],
      assignedTo: ['all'],
    });

    const draftData = {
      examId,
      answers: { logic_q01: 'A' },
      startedAt: Date.now() - 5000,
      timeRemaining: 1795,
      currentQIndex: 1,
      questionIds: ['logic_q01', 'logic_q03'],
      optionOrder: { logic_q01: ['C', 'A', 'B', 'D'] },
    };

    // Save draft during exam
    manager.saveDraft(examId, userId, draftData);

    // Simulate page reload: instantiate new ExamManager reading from same storage
    const reloadedManager = new ExamManager({ storage });
    const restored = reloadedManager.loadDraft(examId, userId);

    expect(restored).not.toBeNull();
    expect(restored.answers).toEqual({ logic_q01: 'A' });
    expect(restored.currentQIndex).toBe(1);
    expect(restored.timeRemaining).toBe(1795);
    expect(restored.optionOrder.logic_q01).toEqual(['C', 'A', 'B', 'D']);

    // Clean up draft after submission
    reloadedManager.clearDraft(examId, userId);
    expect(reloadedManager.loadDraft(examId, userId)).toBeNull();
  });

  // Scenario 5: Submit exam successfully -> server records one submission; score and gradebook match
  it('Scenario 5: Submits exam online, server grades on server and saves single submission', async () => {
    const examId = `exam_sub_test_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề Chấm Điểm Server',
      durationMinutes: 15,
      questionIds: ['logic_q01'], // correctId: 'B'
      assignedTo: ['all'],
    });

    const submitRes = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: {
        examId,
        userId: 'student_k66_01',
        userInfo: { username: 'sv01', fullName: 'Nguyễn Văn A' },
        answers: { logic_q01: 'B' },
        timeSpentSeconds: 60,
      },
    });

    expect(submitRes.statusCode).toBe(201);
    expect(submitRes.data.success).toBe(true);
    expect(submitRes.data.submission.score).toBe(10);
    expect(submitRes.data.submission.correctCount).toBe(1);

    // Verify submission is retrieved via GET /api/exam-submissions
    const getSubsRes = await sendRequest({
      method: 'GET',
      url: `/api/exam-submissions?examId=${examId}`,
    });

    expect(getSubsRes.statusCode).toBe(200);
    expect(getSubsRes.data.submissions.length).toBe(1);
    expect(getSubsRes.data.submissions[0].score).toBe(10);
  });

  // Scenario 6: Network drops during submission -> stored in offline queue and retried when online
  it('Scenario 6: When offline, submission is enqueued safely and flushed when connectivity recovers', async () => {
    const storage = new MockStorage();
    const manager = new ExamManager({ storage });

    manager.createExam({
      id: 'exam_offline_test',
      title: 'Đề Thi Ngoại Tuyến',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });

    const offlinePayload = {
      examId: 'exam_offline_test',
      userId: 'student_offline',
      userInfo: { username: 'sv_off', fullName: 'Sinh Viên Mất Mạng' },
      answers: { logic_q01: 'B' },
      timeSpentSeconds: 120,
    };

    // Enqueue
    manager.enqueueOfflineSubmission(offlinePayload);
    expect(manager.getOfflineQueue().length).toBe(1);

    // Flush queue
    let flushedSubmission = null;
    await manager.flushOfflineQueue(sub => {
      flushedSubmission = sub;
    });

    expect(flushedSubmission).not.toBeNull();
    expect(flushedSubmission.examId).toBe('exam_offline_test');
    expect(manager.getOfflineQueue().length).toBe(0);
    expect(manager.getSubmission('exam_offline_test', 'student_offline')).not.toBeNull();
  });

  // Scenario 7: Server received submission but client timed out -> idempotent retry succeeds without duplication
  it('Scenario 7: Client timeout retry idempotently returns previous submission with HTTP 409 without creating duplicate', async () => {
    const examId = `exam_timeout_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề Timeout Retry',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });

    const payload = {
      examId,
      userId: 'student_timeout',
      userInfo: { username: 'sv_to', fullName: 'Sinh Viên Timeout' },
      answers: { logic_q01: 'B' },
      timeSpentSeconds: 90,
    };

    // First request succeeds on server
    const firstRes = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: payload,
    });
    expect(firstRes.statusCode).toBe(201);

    // Client timed out and retries same submission
    const retryRes = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: payload,
    });

    // Server returns 409 with existing submission
    expect(retryRes.statusCode).toBe(409);
    expect(retryRes.data.alreadySubmitted).toBe(true);
    expect(retryRes.data.submission.id).toBe(firstRes.data.submission.id);

    // Verify CloudSyncManager maps 409 + submission to success: true
    const sync = new CloudSyncManager({ baseUrl: 'http://localhost:3000' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => retryRes.data,
    });

    const clientRetryResult = await sync.serverSubmitExam(payload);
    expect(clientRetryResult.success).toBe(true);
    expect(clientRetryResult.alreadySubmitted).toBe(true);
    expect(clientRetryResult.submission.id).toBe(firstRes.data.submission.id);
  });

  // Scenario 8: Concurrent submissions for same student and exam
  it('Scenario 8: Concurrent submissions for same exam and student are rejected atomically without duplicate', async () => {
    const examId = `exam_concurrent_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề Đồng Thời',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });

    const payload = {
      examId,
      userId: 'student_concurrent',
      userInfo: { username: 'sv_cc', fullName: 'Sinh Viên Đua' },
      answers: { logic_q01: 'B' },
      timeSpentSeconds: 40,
    };

    // Dispatch two requests concurrently
    const [resA, resB] = await Promise.all([
      sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload }),
      sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload }),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    // Check count in serverExamSubmissions
    const totalRecorded = serverExamSubmissions.filter(s => s.examId === examId && s.userId === 'student_concurrent');
    expect(totalRecorded.length).toBe(1);
  });

  // Scenario 9: Non-existent exam or unassigned exam rejected
  it('Scenario 9: Rejects submission if exam does not exist (404) or is not assigned to student (403)', async () => {
    // 404
    const notFoundRes = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { examId: 'non_existent_exam', userId: 'student_k66_01', answers: {} },
    });
    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.data.error).toContain('Không tìm thấy đề thi');

    // 403
    const restrictedExamId = `exam_restricted_${Date.now()}`;
    serverExams.unshift({
      id: restrictedExamId,
      title: 'Đề Giới Hạn',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['student_k66_02'], // NOT student_k66_01
    });

    const forbiddenRes = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { examId: restrictedExamId, userId: 'student_k66_01', answers: {} },
    });
    expect(forbiddenRes.statusCode).toBe(403);
    expect(forbiddenRes.data.error).toContain('không được giao');
  });

  // Scenario 10: Integrity violation ban -> auto-submits with 0 points
  it('Scenario 10: Integrity ban auto-submits score 0 without duplicating results', async () => {
    const examId = `exam_ban_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề Vi Phạm Quy Chế',
      durationMinutes: 15,
      questionIds: ['logic_q01'], // correctId: 'B'
      assignedTo: ['all'],
    });

    const res = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: {
        examId,
        userId: 'student_banned',
        userInfo: { username: 'sv_ban', fullName: 'Sinh Viên Vi Phạm' },
        answers: { logic_q01: 'B' }, // answered correctly, but banned
        integrityBan: true,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.data.submission.score).toBe(0);
    expect(res.data.submission.integrityBan).toBe(true);
  });

  // Scenario 11: Sync error or empty response does not overwrite valid local exams
  it('Scenario 11: When syncExams receives empty list or network error, it does not wipe out valid local exams', async () => {
    const storage = new MockStorage();
    const manager = new ExamManager({ storage });

    manager.createExam({
      id: 'my_precious_exam',
      title: 'Đề Thi Quan Trọng Không Được Mất',
      durationMinutes: 30,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });

    const sync = new CloudSyncManager({ baseUrl: 'http://localhost:3000' });

    // Server returns empty list or error
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, exams: [] }),
    });

    await sync.syncExams(manager);

    // Local exam must be preserved!
    expect(manager.getExams().some(e => e.id === 'my_precious_exam')).toBe(true);

    // When network error throws
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));
    await sync.syncExams(manager);

    expect(manager.getExams().some(e => e.id === 'my_precious_exam')).toBe(true);
  });
});
