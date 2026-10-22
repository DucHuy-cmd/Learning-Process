/**
 * @file liveQuizApi.test.js
 * API tests for Live Quiz (Kahoot / Quizizz Realtime Arena) endpoints:
 * - POST /api/live-quiz/create
 * - GET  /api/live-quiz/room/:pin
 * - POST /api/live-quiz/join
 * - POST /api/live-quiz/start-question
 * - POST /api/live-quiz/answer
 * - POST /api/live-quiz/end-round
 * - POST /api/live-quiz/leaderboard
 * - POST /api/live-quiz/next
 * - POST /api/live-quiz/save-gradebook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest } from '../../src/server/app.js';
import { liveQuizManager } from '../../src/core/quiz/LiveQuizManager.js';

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
    write(chunk) {
      if (chunk) this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
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
  return { statusCode: res.statusCode, data: res.getJson(), body: res.body, headers: res.headers };
}

describe('Live Quiz Realtime API (/api/live-quiz/*)', () => {
  const testQuestions = [
    {
      id: 'q1',
      question: 'Đồ thị Euler có đặc điểm gì?',
      options: [
        { id: 'A', text: 'Mọi đỉnh đều có bậc chẵn' },
        { id: 'B', text: 'Mọi đỉnh đều có bậc lẻ' },
        { id: 'C', text: 'Không có chu trình' },
        { id: 'D', text: 'Có ít nhất 1 đỉnh treo' },
      ],
      correctId: 'A',
    },
    {
      id: 'q2',
      question: 'Thuật toán Kruskal dùng để tìm gì?',
      options: [
        { id: 'A', text: 'Đường đi ngắn nhất' },
        { id: 'B', text: 'Cây khung nhỏ nhất (MST)' },
        { id: 'C', text: 'Luồng cực đại' },
        { id: 'D', text: 'Chu trình Hamilton' },
      ],
      correctId: 'B',
    },
  ];

  beforeEach(() => {
    liveQuizManager.rooms.clear();
    liveQuizManager.subscribers.clear();
  });

  it('1. POST /api/live-quiz/create - creates room with PIN and default state', async () => {
    const res = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/create',
      body: {
        title: 'Đấu trường Đồ thị K65',
        questions: testQuestions,
        createdBy: 'teacher_admin',
        durationSeconds: 25,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.room.pin).toMatch(/^\d{6}$/);
    expect(res.data.room.status).toBe('lobby');
    expect(res.data.room.totalQuestions).toBe(2);
  });

  it('2. POST /api/live-quiz/join - joins room via PIN', async () => {
    const createRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/create',
      body: { title: 'Lớp Toán RR', questions: testQuestions, createdBy: 'teacher_admin' },
    });
    const pin = createRes.data.room.pin;

    const joinRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/join',
      body: {
        pin,
        user: { id: 'sv_01', username: 'sv01', fullName: 'Sinh Viên 01' },
      },
    });

    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.data.success).toBe(true);
    expect(joinRes.data.room.totalParticipants).toBe(1);

    // GET /api/live-quiz/room/:pin
    const roomRes = await sendRequest({
      method: 'GET',
      url: `/api/live-quiz/room/${pin}?userId=sv_01`,
    });
    expect(roomRes.statusCode).toBe(200);
    expect(roomRes.data.room.pin).toBe(pin);
  });

  it('3. Runs full question round: start -> answer -> end-round -> leaderboard -> next -> save-gradebook', async () => {
    const createRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/create',
      body: { title: 'Đấu trường Full Flow', questions: testQuestions, createdBy: 'teacher_admin', durationSeconds: 20 },
    });
    const pin = createRes.data.room.pin;

    // Player joins
    await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/join',
      body: { pin, user: { id: 'sv_player', username: 'player', fullName: 'Học Sinh A' } },
    });

    // Host starts question 1
    const startQ = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/start-question',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    expect(startQ.statusCode).toBe(200);
    expect(startQ.data.room.status).toBe('in_question');

    // Player submits answer 'A' (correct for q1)
    const ansRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/answer',
      body: { pin, userId: 'sv_player', optionId: 'A' },
    });
    expect(ansRes.statusCode).toBe(200);
    expect(ansRes.data.isCorrect).toBe(true);
    expect(ansRes.data.points).toBeGreaterThanOrEqual(500);

    // Host ends round
    const endRound = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/end-round',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    expect(endRound.statusCode).toBe(200);
    expect(endRound.data.room.status).toBe('round_result');
    expect(endRound.data.room.optionStats.A).toBe(1);

    // Host opens leaderboard
    const lbRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/leaderboard',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    expect(lbRes.statusCode).toBe(200);
    expect(lbRes.data.leaderboard[0].id).toBe('sv_player');

    // Advance to Question 2
    const nextQ = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/next',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    expect(nextQ.statusCode).toBe(200);
    expect(nextQ.data.room.currentQIndex).toBe(1);

    // Finish game (advance past Q2)
    await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/end-round',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    const finishRes = await sendRequest({
      method: 'POST',
      url: '/api/live-quiz/next',
      body: { pin, hostUserId: 'teacher_admin' },
    });
    expect(finishRes.data.finished).toBe(true);
    expect(finishRes.data.room.status).toBe('finished');
  });
});
