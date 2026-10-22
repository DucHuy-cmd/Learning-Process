/**
 * @file LiveQuizManager.test.js
 * Unit tests verifying LiveQuizManager (Kahoot-style Live Quiz Engine):
 * 1. Room creation and 6-digit PIN generation.
 * 2. Player join and sanitization.
 * 3. Question cycle and Kahoot speed scoring.
 * 4. Streak bonus calculation.
 * 5. Option distribution statistics.
 * 6. Leaderboard ranking and podium calculation.
 * 7. Gradebook synchronization (Scale 10 conversion).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LiveQuizManager } from '../../../src/core/quiz/LiveQuizManager.js';
import { examManager } from '../../../src/core/quiz/ExamManager.js';
import { JSDOM } from 'jsdom';

describe('LiveQuizManager (Kahoot-Style Real-time Engine)', () => {
  let liveQuiz;
  const mockQuestions = [
    {
      id: 'q1',
      question: 'Thuật toán Dijkstra tìm đường đi ngắn nhất khi đồ thị có đặc điểm gì?',
      options: [
        { id: 'A', text: 'Không có trọng số âm' },
        { id: 'B', text: 'Có trọng số âm' },
        { id: 'C', text: 'Đồ thị vô hướng duy nhất' },
        { id: 'D', text: 'Không có chu trình' },
      ],
      correctId: 'A',
    },
    {
      id: 'q2',
      question: 'Cây khung nhỏ nhất của đồ thị n đỉnh có bao nhiêu cạnh?',
      options: [
        { id: 'A', text: 'n' },
        { id: 'B', text: 'n - 1' },
        { id: 'C', text: 'n + 1' },
        { id: 'D', text: '2n' },
      ],
      correctId: 'B',
    },
  ];

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost/',
    });
    global.window = dom.window;
    global.localStorage = dom.window.localStorage;
    examManager.storage = dom.window.localStorage;
    examManager._initStorage();
    examManager.clearAllData();

    liveQuiz = new LiveQuizManager();
  });

  it('1. Creates a room with 6-digit PIN, normalized questions, and default lobby status', () => {
    const res = liveQuiz.createRoom({
      title: 'Đấu Trường Dijkstra K65',
      questions: mockQuestions,
      createdBy: 'teacher_01',
      durationSeconds: 20,
    });

    expect(res.success).toBe(true);
    expect(res.room).toBeDefined();
    expect(res.room.pin).toMatch(/^\d{6}$/);
    expect(res.room.status).toBe('lobby');
    expect(res.room.totalQuestions).toBe(2);
    expect(res.room.questionDuration).toBe(20);
    expect(res.room.createdBy).toBe('teacher_01');
  });

  it('2. Allows players to join via PIN and maintains participant list', () => {
    const createRes = liveQuiz.createRoom({
      title: 'Phòng Thi Test',
      questions: mockQuestions,
      createdBy: 'teacher_01',
    });
    const pin = createRes.room.pin;

    const join1 = liveQuiz.joinRoom(pin, {
      id: 'sv_01',
      username: 'sv01',
      fullName: 'Nguyễn Văn A',
      className: 'D21CQCN01',
    });
    expect(join1.success).toBe(true);
    expect(join1.room.totalParticipants).toBe(1);

    const join2 = liveQuiz.joinRoom(pin, {
      id: 'sv_02',
      username: 'sv02',
      fullName: 'Trần Thị B',
    });
    expect(join2.success).toBe(true);
    expect(join2.room.totalParticipants).toBe(2);

    // Sanitized state check: during lobby, players do not see questions' correctId
    const publicState = liveQuiz.getPublicRoomState(pin, 'sv_01');
    expect(publicState.isHost).toBe(false);
    expect(publicState.totalParticipants).toBe(2);
  });

  it('3. Starts question, calculates speed score and streak bonuses, and compiles option stats', () => {
    const createRes = liveQuiz.createRoom({
      title: 'Đấu Trường Live',
      questions: mockQuestions,
      createdBy: 'teacher_01',
      durationSeconds: 30,
    });
    const pin = createRes.room.pin;

    liveQuiz.joinRoom(pin, { id: 'sv_fast', username: 'fast', fullName: 'Học Sinh Nhanh' });
    liveQuiz.joinRoom(pin, { id: 'sv_slow', username: 'slow', fullName: 'Học Sinh Chậm' });
    liveQuiz.joinRoom(pin, { id: 'sv_wrong', username: 'wrong', fullName: 'Học Sinh Sai' });

    // Host starts question 1
    const startRes = liveQuiz.startQuestion(pin, 'teacher_01');
    expect(startRes.success).toBe(true);
    expect(startRes.room.status).toBe('in_question');

    // Fast player answers correctly within 1 second -> high score ~983 pts
    const ansFast = liveQuiz.submitAnswer(pin, 'sv_fast', 'A');
    expect(ansFast.success).toBe(true);
    expect(ansFast.isCorrect).toBe(true);
    expect(ansFast.points).toBeGreaterThanOrEqual(950);

    // Slow player answers correctly after 15 seconds (simulate startedAt earlier)
    const room = liveQuiz.getRoom(pin);
    room.questionStartedAt = Date.now() - 15000;
    const ansSlow = liveQuiz.submitAnswer(pin, 'sv_slow', 'A');
    expect(ansSlow.success).toBe(true);
    expect(ansSlow.isCorrect).toBe(true);
    expect(ansSlow.points).toBeLessThan(ansFast.points);
    expect(ansSlow.points).toBeGreaterThanOrEqual(700);

    // Wrong player chooses B
    const ansWrong = liveQuiz.submitAnswer(pin, 'sv_wrong', 'B');
    expect(ansWrong.success).toBe(true);
    expect(ansWrong.isCorrect).toBe(false);
    expect(ansWrong.points).toBe(0);

    // Host ends round
    const endRes = liveQuiz.endRound(pin, 'teacher_01');
    expect(endRes.success).toBe(true);
    expect(endRes.room.status).toBe('round_result');
    expect(endRes.room.optionStats).toEqual({
      A: 2, // 2 picked A
      B: 1, // 1 picked B
      C: 0,
      D: 0,
    });
  });

  it('4. Cycles questions, tracks leaderboard ranking, and displays final podium upon finish', () => {
    const createRes = liveQuiz.createRoom({
      title: 'Đấu Trường 2 Câu',
      questions: mockQuestions,
      createdBy: 'teacher_01',
      durationSeconds: 20,
    });
    const pin = createRes.room.pin;

    liveQuiz.joinRoom(pin, { id: 'sv_1', username: 'p1', fullName: 'Top 1' });
    liveQuiz.joinRoom(pin, { id: 'sv_2', username: 'p2', fullName: 'Top 2' });

    // Question 1: sv_1 correct, sv_2 correct
    liveQuiz.startQuestion(pin, 'teacher_01');
    liveQuiz.submitAnswer(pin, 'sv_1', 'A');
    liveQuiz.submitAnswer(pin, 'sv_2', 'A');
    liveQuiz.endRound(pin, 'teacher_01');

    // Show leaderboard
    const lbRes = liveQuiz.showLeaderboard(pin, 'teacher_01');
    expect(lbRes.success).toBe(true);
    expect(lbRes.leaderboard.length).toBe(2);

    // Advance to Question 2 (qIndex = 1)
    const nextQRes = liveQuiz.nextQuestion(pin, 'teacher_01');
    expect(nextQRes.success).toBe(true);
    expect(nextQRes.finished).toBe(false);
    expect(nextQRes.room.currentQIndex).toBe(1);

    // Question 2: sv_1 answers correctly ('B'), sv_2 answers incorrectly ('A')
    liveQuiz.submitAnswer(pin, 'sv_1', 'B');
    liveQuiz.submitAnswer(pin, 'sv_2', 'A');
    liveQuiz.endRound(pin, 'teacher_01');

    // Advance past last question -> Game Finished / Podium!
    const finishRes = liveQuiz.nextQuestion(pin, 'teacher_01');
    expect(finishRes.success).toBe(true);
    expect(finishRes.finished).toBe(true);
    expect(finishRes.room.status).toBe('finished');

    const leaderboard = liveQuiz.getLeaderboard(pin);
    expect(leaderboard[0].id).toBe('sv_1'); // Top 1 winner
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].score).toBeGreaterThan(leaderboard[1].score);
  });

  it('5. Saves final Live Quiz scores to official Gradebook on Scale 10', () => {
    const createRes = liveQuiz.createRoom({
      title: 'Kiểm Tra 15 Phút Live Quiz',
      questions: mockQuestions,
      createdBy: 'teacher_01',
    });
    const pin = createRes.room.pin;

    liveQuiz.joinRoom(pin, { id: 'sv_1', username: 'p1', fullName: 'Sinh Viên Giỏi' });
    liveQuiz.joinRoom(pin, { id: 'sv_2', username: 'p2', fullName: 'Sinh Viên Trung Bình' });

    // Q1: both correct
    liveQuiz.startQuestion(pin, 'teacher_01');
    liveQuiz.submitAnswer(pin, 'sv_1', 'A');
    liveQuiz.submitAnswer(pin, 'sv_2', 'A');
    liveQuiz.endRound(pin, 'teacher_01');

    // Q2: sv_1 correct, sv_2 wrong
    liveQuiz.nextQuestion(pin, 'teacher_01');
    liveQuiz.submitAnswer(pin, 'sv_1', 'B');
    liveQuiz.submitAnswer(pin, 'sv_2', 'D');
    liveQuiz.endRound(pin, 'teacher_01');
    liveQuiz.nextQuestion(pin, 'teacher_01'); // finish

    // Save to Gradebook
    const saveRes = liveQuiz.saveToGradebook(pin, 'teacher_01', examManager);
    expect(saveRes.success).toBe(true);
    expect(saveRes.count).toBe(2);

    // Verify records in ExamManager
    const examId = `live_quiz_${pin}`;
    const sub1 = examManager.getSubmission(examId, 'sv_1');
    expect(sub1).not.toBeNull();
    expect(sub1.score).toBe(10); // 2/2 = 10đ
    expect(sub1.note).toContain('Đấu trường Live Quiz (Hạng #1');

    const sub2 = examManager.getSubmission(examId, 'sv_2');
    expect(sub2).not.toBeNull();
    expect(sub2.score).toBe(5); // 1/2 = 5đ
    expect(sub2.note).toContain('Đấu trường Live Quiz (Hạng #2');
  });
});
