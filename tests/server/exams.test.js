import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest } from '../../src/server/app.js';
import { serverExams, serverExamSubmissions } from '../../src/server/auth/ServerDataStore.js';

function createMockHttp({ method, url, body }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json' };

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
      return JSON.parse(this.body);
    },
  };

  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
    req.emit('end');
  });

  return { req, res };
}

async function sendRequest(options) {
  const { req, res } = createMockHttp(options);
  await handleRequest(req, res);
  return { statusCode: res.statusCode, data: res.getJson() };
}

describe('Assigned exam API', () => {
  let savedExams;
  let savedSubmissions;

  beforeEach(() => {
    savedExams = [...serverExams];
    savedSubmissions = [...serverExamSubmissions];
  });

  afterEach(() => {
    serverExams.splice(0, serverExams.length, ...savedExams);
    serverExamSubmissions.splice(0, serverExamSubmissions.length, ...savedSubmissions);
  });

  it('creates an exam with a stable ID and shuffle settings', async () => {
    const exam = {
      id: `exam_api_${Date.now()}`,
      title: 'Đề kiểm tra API',
      durationMinutes: 30,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
      shuffleQuestions: true,
      shuffleOptions: true,
    };

    const result = await sendRequest({
      method: 'POST',
      url: '/api/exams',
      body: exam,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.exam.id).toBe(exam.id);
    expect(result.data.exam.shuffleOptions).toBe(true);
  });

  it('rejects a submission for an exam not assigned to that student', async () => {
    const examId = `exam_private_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề riêng',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['user_assigned'],
    });

    const result = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { examId, userId: 'user_other', answers: { logic_q01: 'B' } },
    });

    expect(result.statusCode).toBe(403);
    expect(result.data.error).toContain('không được giao');
  });

  it('grades submissions on the server and enforces one attempt per student', async () => {
    const examId = `exam_submit_${Date.now()}`;
    serverExams.unshift({
      id: examId,
      title: 'Đề tính điểm',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    const payload = {
      examId,
      userId: 'user_api_student',
      userInfo: { username: 'api_student', fullName: 'Sinh viên API' },
      answers: { logic_q01: 'B' },
      optionOrder: { logic_q01: ['D', 'C', 'B', 'A'] },
      timeSpentSeconds: 75,
    };

    const first = await sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload });
    const second = await sendRequest({ method: 'POST', url: '/api/exam-submissions', body: payload });

    expect(first.statusCode).toBe(201);
    expect(first.data.submission.score).toBe(10);
    expect(first.data.submission.fullName).toBe('Sinh viên API');
    expect(first.data.submission.optionOrder.logic_q01).toEqual(['D', 'C', 'B', 'A']);
    expect(second.statusCode).toBe(409);

    const otherExamId = `${examId}_other`;
    serverExams.unshift({
      id: otherExamId,
      title: 'Đề khác',
      durationMinutes: 15,
      questionIds: ['logic_q01'],
      assignedTo: ['all'],
    });
    const otherExamSubmission = await sendRequest({
      method: 'POST',
      url: '/api/exam-submissions',
      body: { ...payload, examId: otherExamId },
    });
    expect(otherExamSubmission.statusCode).toBe(201);
  });

});
