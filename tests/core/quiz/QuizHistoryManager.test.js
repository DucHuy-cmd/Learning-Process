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

  it('initializes with clean empty leaderboard ready for fresh attempts', () => {
    const leaderboard = manager.getLeaderboard();
    expect(leaderboard.length).toBe(0);
  });

  it('records correct answer and increases score and streak', () => {
    const stats = manager.recordAnswer('user_duchuy', true);
    expect(stats.totalAnswered).toBe(1);
    expect(stats.correctCount).toBe(1);
    expect(stats.score).toBe(100);
  });

  it('records incorrect answer and resets current streak', () => {
    manager.recordAnswer('user_giangvien', false);
    const stats = manager.getUserStats('user_giangvien');
    expect(stats.currentStreak).toBe(0);
    expect(stats.totalAnswered).toBe(1);
  });

  it('records completed exam and stores in user history', () => {
    manager.recordExam('user_duchuy', {
      title: 'Đề thi kiểm tra 15 phút Logic Boole',
      score: 9,
      maxScore: 10,
      topic: 'logic',
    });

    const stats = manager.getUserStats('user_duchuy');
    expect(stats.history.length).toBeGreaterThan(0);
    expect(stats.history[0].examTitle).toContain('Logic Boole');
    expect(stats.history[0].accuracy).toBe(90);
  });
});
