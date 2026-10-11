/**
 * @file logicApi.test.js
 * Test Suite for Phase 1 Backend Logic Vision API (/api/logic/analyze)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest } from '../../src/server/app.js';
import {
  setBackendLogicAIProvider,
  getBackendLogicAIProvider,
  setBackendAIProvider,
  isAIConfigured,
} from '../../src/server/ai/AIProviderAdapter.js';
import { buildLogicVisionPrompt } from '../../src/server/ai/logicVisionPrompt.js';

/**
 * Creates mock HTTP request and response for testing handleRequest.
 */
function createMockHttp({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', ...headers };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
    },
    end(chunk) {
      if (chunk) {
        this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
      }
      this.emit?.('finish');
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
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.emit('data', body);
      } else if (typeof body === 'string') {
        req.emit('data', Buffer.from(body, 'utf8'));
      } else {
        req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
      }
    }
    req.emit('end');
  });

  return { req, res };
}

describe('Phase 1: Backend Logic AI Vision Service (/api/logic/analyze)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    setBackendLogicAIProvider(null);
    setBackendAIProvider(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setBackendLogicAIProvider(null);
    setBackendAIProvider(null);
  });

  describe('Route Isolation & Matching', () => {
    it('does not allow /api/graph/analyze to intercept /api/logic/analyze', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      
      let graphCalled = false;
      let logicCalled = false;

      setBackendAIProvider(async () => {
        graphCalled = true;
        return { directed: false, weighted: false, nodes: [], edges: [] };
      });

      setBackendLogicAIProvider(async () => {
        logicCalled = true;
        return {
          expression: 'p → q',
          variables: ['p', 'q'],
          exerciseType: 'truth_table',
          expression2: null,
          warnings: [],
        };
      });

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'problem.png',
            type: 'image/png',
            data: Buffer.from('test').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      expect(logicCalled).toBe(true);
      expect(graphCalled).toBe(false);

      const json = res.getJson();
      expect(json.success).toBe(true);
      expect(json.data.expression).toBe('p → q');
    });
  });

  describe('Prompt Builder & Schema', () => {
    it('builds system prompt with expression mode schema', () => {
      const prompt = buildLogicVisionPrompt('expression');
      expect(prompt).toContain('TARGET MODE: "expression"');
      expect(prompt).toContain('"expression"');
      expect(prompt).toContain('"exerciseType"');
    });

    it('builds system prompt with quiz mode schema', () => {
      const prompt = buildLogicVisionPrompt('quiz');
      expect(prompt).toContain('TARGET MODE: "quiz"');
      expect(prompt).toContain('"question"');
      expect(prompt).toContain('"options"');
      expect(prompt).toContain('"correctId"');
    });
  });

  describe('Input Validation & Guards', () => {
    it('returns 400 NO_FILE when no file is uploaded', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze',
        headers: { 'content-type': 'application/json' },
        body: {},
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('NO_FILE');
    });

    it('returns 400 INVALID_FILE when file type is unsupported', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'unsupported.exe',
            type: 'application/x-msdownload',
            data: Buffer.from('binary').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_FILE');
    });

    it('returns 503 AI_NOT_CONFIGURED when no API key is set', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'problem.png',
            type: 'image/png',
            data: Buffer.from('test').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(503);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('AI_NOT_CONFIGURED');
    });

    it('returns 503 AI_NOT_CONFIGURED when API key is a template placeholder', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyYourGeminiApiKeyHere';
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'problem.png',
            type: 'image/png',
            data: Buffer.from('test').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(503);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('AI_NOT_CONFIGURED');
    });
  });

  describe('Mode: expression', () => {
    it('processes valid expression successfully and returns 200', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      const mockResult = {
        expression: '(p → q) * (q → r) → (p → r)',
        variables: ['p', 'q', 'r'],
        exerciseType: 'truth_table',
        expression2: null,
        sourceText: 'Kiểm chứng hằng đúng',
        warnings: ['Ảnh hơi nghiêng nhưng đọc rõ'],
      };

      setBackendLogicAIProvider(async () => mockResult);

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=expression',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'logic_hw.png',
            type: 'image/png',
            data: Buffer.from('hw').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.success).toBe(true);
      expect(json.mode).toBe('expression');
      expect(json.data.expression).toBe('(p → q) * (q → r) → (p → r)');
      expect(json.warnings).toEqual(['Ảnh hơi nghiêng nhưng đọc rõ']);
    });

    it('returns 400 INVALID_AI_SPEC when AI returns empty or invalid expression', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      setBackendLogicAIProvider(async () => ({
        expression: '',
        variables: [],
      }));

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=expression',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'logic_hw.png',
            type: 'image/png',
            data: Buffer.from('hw').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_AI_SPEC');
    });
  });

  describe('Mode: quiz', () => {
    it('processes valid quiz question successfully and returns 200', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      const mockQuiz = {
        question: 'Cho hai mệnh đề p = Đúng (1) và q = Sai (0). Mệnh đề p → q có giá trị chân trị là gì?',
        options: [
          { id: 'A', text: '1 (Đúng)' },
          { id: 'B', text: '0 (Sai)' },
          { id: 'C', text: 'Không xác định' },
          { id: 'D', text: 'Cả A và B đều đúng' },
        ],
        correctId: 'B',
        explanation: 'Theo định nghĩa phép kéo theo, 1 → 0 nhận giá trị 0.',
        topicName: 'Phép kéo theo Logic',
        difficulty: 'easy',
        relatedExpression: 'p → q',
        warnings: [],
      };

      setBackendLogicAIProvider(async () => mockQuiz);

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=quiz',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'exam_question.png',
            type: 'image/png',
            data: Buffer.from('quiz').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.success).toBe(true);
      expect(json.mode).toBe('quiz');
      expect(json.data.question).toContain('p = Đúng (1)');
      expect(json.data.correctId).toBe('B');
      expect(json.data.options).toHaveLength(4);
    });

    it('returns 400 INVALID_AI_SPEC when quiz lacks options or correctId does not match', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      setBackendLogicAIProvider(async () => ({
        question: 'Câu hỏi thiếu đáp án',
        options: [{ id: 'A', text: 'Chỉ có 1 lựa chọn' }],
        correctId: 'Z',
      }));

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=quiz',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'bad_quiz.png',
            type: 'image/png',
            data: Buffer.from('quiz').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_AI_SPEC');
    });

    it('returns 500 when AI provider throws an error without crashing the server', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      setBackendLogicAIProvider(async () => {
        throw new Error('Gemini API rate limit exceeded');
      });

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=quiz',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'test.png',
            type: 'image/png',
            data: Buffer.from('data').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(500);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('AI_PROVIDER_ERROR');
    });

    it('sanitizes and redacts sensitive API keys from provider error messages', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      setBackendLogicAIProvider(async () => {
        throw new Error('API failed with key AIzaSyDUMMY1234567890abcdefghijklmnopqr and token=secret_token_123');
      });

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/logic/analyze?mode=expression',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'test.png',
            type: 'image/png',
            data: Buffer.from('data').toString('base64'),
          },
        },
      });

      await handleRequest(req, res);

      expect(res.statusCode).toBe(500);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.message).toContain('[REDACTED');
      expect(json.message).not.toContain('AIzaSyDUMMY1234567890abcdefghijklmnopqr');
      expect(json.message).not.toContain('secret_token_123');
    });
  });
});
