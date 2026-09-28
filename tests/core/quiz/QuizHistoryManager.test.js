/**
 * @file QuizHistoryManager.test.js
 * Unit Test Suite for QuizHistoryManager & Leaderboard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuizHistoryManager, INITIAL_LEADERBOARD } from '../../../src/core/quiz/QuizHistoryManager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('QuizHistoryManager & Leaderboard', () => {
  let storage;
  let manager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new QuizHistoryManager({ storage });
  });

  it('initializes with pre-seeded K66 CNTT team leaderboard', () => {
    const leaderboard = manager.getLeaderboard();
    expect(leaderboard.length).toBeGreaterThanOrEqual(INITIAL_LEADERBOARD.length);
    expect(leaderboard[0].rankBadge).toBe('🥇');
    expect(leaderboard[0].fullName).toBe('Đức Huy');
    expect(leaderboard[1].rankBadge).toBe('🥈');
    expect(leaderboard[1].fullName).toBe('Nhất Vũ');
    expect(leaderboard[2].rankBadge).toBe('🥉');
    expect(leaderboard[2].fullName).toBe('Trường Vũ');
  });

  it('records correct answer and increases score and streak', () => {
    const stats = manager.recordAnswer('user_duchuy', true);
    expect(stats.totalAnswered).toBe(41);
    expect(stats.correctCount).toBe(39);
    expect(stats.score).toBe(2950);
  });

  it('records incorrect answer and resets current streak', () => {
    manager.recordAnswer('user_nhatvu', false);
    const stats = manager.getUserStats('user_nhatvu');
    expect(stats.currentStreak).toBe(0);
    expect(stats.totalAnswered).toBe(39);
  });

  it('records completed exam and stores in user history', () => {
    manager.recordExam('user_truongvu', {
      title: 'Đề thi kiểm tra 15 phút Logic Boole',
      score: 9,
      maxScore: 10,
      topic: 'logic',
    });

    const stats = manager.getUserStats('user_truongvu');
    expect(stats.history.length).toBeGreaterThan(0);
    expect(stats.history[0].examTitle).toContain('Logic Boole');
    expect(stats.history[0].accuracy).toBe(90);
  });
});
