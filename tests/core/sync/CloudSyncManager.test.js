/**
 * @file CloudSyncManager.test.js
 * Unit test suite for CloudSyncManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudSyncManager } from '../../../src/core/sync/CloudSyncManager.js';
import { AuthManager } from '../../../src/core/auth/AuthManager.js';
import { AiHistoryManager } from '../../../src/core/ai/AiHistoryManager.js';
import { QuizHistoryManager } from '../../../src/core/quiz/QuizHistoryManager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
}

describe('CloudSyncManager (Multi-device Cloud Sync Service)', () => {
  let sync;
  let originalFetch;

  beforeEach(() => {
    sync = new CloudSyncManager({ baseUrl: 'http://localhost:3000', timeoutMs: 500 });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('manages connection status and subscribers', () => {
    let captured = null;
    const unsub = sync.subscribe(status => {
      captured = status;
    });

    expect(captured).not.toBeNull();
    expect(captured.isConnected).toBe(false);

    unsub();
  });

  it('detects server connection status via checkConnection()', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const isConnected = await sync.checkConnection();
    expect(isConnected).toBe(true);
    expect(sync.isConnected).toBe(true);

    // When server is offline
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const isOffline = await sync.checkConnection();
    expect(isOffline).toBe(false);
    expect(sync.isConnected).toBe(false);
  });

  it('syncs users from server into local AuthManager storage', async () => {
    const storage = new MockStorage();
    const authManager = new AuthManager({ storage });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        users: [
          { id: 'user_machine_b', username: 'student_b', fullName: 'Sinh viên Máy B' },
        ],
      }),
    });

    await sync.syncUsers(authManager);
    const users = authManager.getUsers();
    expect(users.some(u => u.username === 'student_b')).toBe(true);
  });

  it('pushes new user registration to server', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: { username: 'student_new' } }),
    });

    const res = await sync.pushRegister({ username: 'student_new', fullName: 'Mới' });
    expect(res).not.toBeNull();
    expect(res.success).toBe(true);
  });

  it('syncs AI sessions from server into local AiHistoryManager', async () => {
    const storage = new MockStorage();
    const aiManager = new AiHistoryManager({ storage });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        sessions: [
          {
            id: 'session_cloud_1',
            userId: 'user_duchuy',
            title: 'Hội thoại từ máy khác',
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });

    await sync.syncAiHistory('user_duchuy', aiManager);
    const sessions = aiManager.getUserSessions('user_duchuy');
    expect(sessions.some(s => s.id === 'session_cloud_1')).toBe(true);
  });

  it('syncs Quiz leaderboard from server into local QuizHistoryManager', async () => {
    const storage = new MockStorage();
    const quizManager = new QuizHistoryManager({ storage });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        leaderboard: [
          {
            userId: 'user_from_phone',
            fullName: 'Sinh viên Làm Bài Qua Điện Thoại',
            score: 5000,
            accuracy: 98,
            totalAnswered: 50,
            correctCount: 49,
            maxStreak: 25,
          },
        ],
      }),
    });

    await sync.syncQuizLeaderboard(quizManager);
    const leaderboard = quizManager.getLeaderboard();
    expect(leaderboard.some(u => u.userId === 'user_from_phone')).toBe(true);
  });

  it('pushes quiz answer and exam records to server', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const ansRes = await sync.pushQuizAnswer('user_123', true, { fullName: 'Test' });
    expect(ansRes.success).toBe(true);

    const examRes = await sync.pushQuizExam('user_123', { score: 10, maxScore: 10 });
    expect(examRes.success).toBe(true);
  });
});
