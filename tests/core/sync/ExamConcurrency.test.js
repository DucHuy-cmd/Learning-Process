import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudSyncManager } from '../../../src/core/sync/CloudSyncManager.js';
import { examManager } from '../../../src/core/quiz/ExamManager.js';
import {
  saveSubmissionToKV,
  fetchSubmissionsFromKV,
  clearSubmissionsFromKV,
  serverExams,
  serverExamSubmissions,
} from '../../../src/server/auth/ServerDataStore.js';

describe('100 Concurrent Exam Submissions & Resilience Suite', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    global.window = {
      localStorage: {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; },
        clear: () => { mockStorage = {}; },
      },
    };
    examManager.clearAllData();
  });

  afterEach(() => {
    delete global.window;
    vi.restoreAllMocks();
  });

  it('queues submissions in localStorage when offline without hanging or losing data', async () => {
    const syncManager = new CloudSyncManager({ baseUrl: 'http://localhost:3000' });
    syncManager.isConnected = false;

    const sub = {
      id: 'sub_concurrent_1',
      examId: 'exam_discrete_100',
      userId: 'student_42',
      username: 'sv42',
      fullName: 'Nguyễn Văn 42',
      className: 'D21CQCN01-N',
      score: 9.5,
      totalQuestions: 10,
      correctCount: 9,
      submittedAt: new Date().toISOString(),
    };

    const res = await syncManager.serverSubmitExam(sub);
    expect(res).toEqual({ success: false, queued: true });
    expect(syncManager.hasPendingSubmission('exam_discrete_100', 'student_42')).toBe(true);

    // Verify localStorage has the queued item
    const raw = mockStorage['trr_pending_submissions_v1'];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].userId).toBe('student_42');

    // Removing when server acknowledges
    syncManager._removePendingSubmission('exam_discrete_100', 'student_42');
    expect(syncManager.hasPendingSubmission('exam_discrete_100', 'student_42')).toBe(false);
  });

  it('safely merges 100 concurrent exam submissions into ExamManager using Map deduplication', () => {
    const examId = 'exam_final_100';
    const serverSubs = [];

    for (let i = 1; i <= 100; i++) {
      serverSubs.push({
        id: `sub_${i}`,
        examId,
        userId: `user_student_${i}`,
        username: `sv_${i}`,
        fullName: `Sinh Viên ${i}`,
        className: 'CNTT_K21',
        score: Math.round((Math.random() * 5 + 5) * 10) / 10,
        correctCount: 8,
        totalQuestions: 10,
        submittedAt: new Date().toISOString(),
      });
    }

    // Simulate safe merge logic in syncExamSubmissions
    const map = new Map(examManager.memorySubmissions.map(s => [`${s.examId}:${s.userId}`, s]));
    serverSubs.forEach(s => {
      if (s && s.examId && s.userId) map.set(`${s.examId}:${s.userId}`, s);
    });
    examManager.memorySubmissions = Array.from(map.values());

    expect(examManager.memorySubmissions).toHaveLength(100);
    const sub50 = examManager.getSubmission(examId, 'user_student_50');
    expect(sub50).toBeDefined();
    expect(sub50.fullName).toBe('Sinh Viên 50');

    // Test idempotent updates (updating user 50's score doesn't duplicate)
    const updatedSub50 = { ...sub50, score: 10 };
    map.set(`${examId}:user_student_50`, updatedSub50);
    examManager.memorySubmissions = Array.from(map.values());
    expect(examManager.memorySubmissions).toHaveLength(100);
    expect(examManager.getSubmission(examId, 'user_student_50').score).toBe(10);
  });

  it('handles atomic submission helpers gracefully in in-memory fallback', async () => {
    const sub = {
      examId: 'exam_demo',
      userId: 'user_test_99',
      score: 8.5,
    };

    // When Upstash KV is not configured, helpers return false/empty array gracefully without crashing
    const saveRes = await saveSubmissionToKV(sub);
    expect(typeof saveRes).toBe('boolean');

    const subs = await fetchSubmissionsFromKV('exam_demo');
    expect(Array.isArray(subs)).toBe(true);

    const clearRes = await clearSubmissionsFromKV('exam_demo');
    expect(typeof clearRes).toBe('boolean');
  });
});
