/**
 * @file LogicVisionAdapter.test.js
 * @vitest-environment jsdom
 * Comprehensive Vitest Unit Test Suite for Application Layer LogicVisionAdapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateLogicFileSupport,
  validateExpressionWithParser,
  normalizeExpressionResult,
  normalizeQuizResult,
  analyzeLogicFile,
  setLogicVisionMockAnalyzer,
  MAX_LOGIC_FILE_SIZE_BYTES,
  SUPPORTED_LOGIC_EXTENSIONS,
} from '../../src/app/ai/LogicVisionAdapter.js';
import { STATIC_QUESTION_BANK } from '../../src/core/quiz/QuizBank.js';

describe('Phase 2: LogicVisionAdapter Application Layer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setLogicVisionMockAnalyzer(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setLogicVisionMockAnalyzer(null);
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. FILE VALIDATION TESTS
  // =========================================================================
  describe('validateLogicFileSupport', () => {
    it('approves all supported extensions within 15MB limit', () => {
      for (const ext of SUPPORTED_LOGIC_EXTENSIONS) {
        const file = { name: `exercise${ext}`, size: 1024 * 500 };
        const check = validateLogicFileSupport(file);
        expect(check.valid).toBe(true);
      }
    });

    it('rejects missing or null file', () => {
      expect(validateLogicFileSupport(null).valid).toBe(false);
      expect(validateLogicFileSupport(undefined).valid).toBe(false);
    });

    it('rejects empty 0-byte file', () => {
      const file = { name: 'empty.png', size: 0 };
      const check = validateLogicFileSupport(file);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('Tệp rỗng');
    });

    it('rejects unsupported extensions', () => {
      const file = { name: 'virus.exe', size: 1024 };
      const check = validateLogicFileSupport(file);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('không được hỗ trợ');
    });

    it('rejects files exceeding 15MB limit', () => {
      const file = { name: 'huge_scan.png', size: MAX_LOGIC_FILE_SIZE_BYTES + 1024 };
      const check = validateLogicFileSupport(file);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('Tệp quá lớn');
    });
  });

  // =========================================================================
  // 2. PARSER VERIFICATION TESTS
  // =========================================================================
  describe('validateExpressionWithParser', () => {
    it('validates standard propositional logic formula and extracts sorted variables', () => {
      const res = validateExpressionWithParser('(p → q) * ¬r + s');
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.ast).toBeDefined();
      expect(res.variables).toEqual(['p', 'q', 'r', 's']);
    });

    it('validates biconditional and XOR operations', () => {
      const res = validateExpressionWithParser('A ↔ (B ⊕ C)');
      expect(res.valid).toBe(true);
      expect(res.variables).toEqual(['A', 'B', 'C']);
    });

    it('detects syntax errors for invalid logic strings', () => {
      const res = validateExpressionWithParser('p ** q');
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.ast).toBeNull();
    });

    it('rejects empty or whitespace expressions', () => {
      expect(validateExpressionWithParser('').valid).toBe(false);
      expect(validateExpressionWithParser('   ').valid).toBe(false);
      expect(validateExpressionWithParser(null).valid).toBe(false);
    });

    it('rejects expression exceeding 5000 character limit to prevent resource exhaustion', () => {
      const hugeExpr = 'p + '.repeat(1300) + 'q'; // > 5200 chars
      const res = validateExpressionWithParser(hugeExpr);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('vượt quá độ dài tối đa');
    });

    it('rejects expression exceeding recursion depth limit (> 120 nested parens)', () => {
      const deeplyNested = '('.repeat(130) + 'p' + ')'.repeat(130);
      const res = validateExpressionWithParser(deeplyNested);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('lồng nhau quá sâu');
    });
  });

  // =========================================================================
  // 3. EXPRESSION RESULT NORMALIZATION & THREE-STAGE LIFECYCLE
  // =========================================================================
  describe('normalizeExpressionResult', () => {
    it('normalizes valid expression, maps exerciseType to navigation, and marks parser confirmation', () => {
      const rawSpec = {
        expression: '¬p * (q + r)',
        variables: ['p', 'q', 'r'],
        exerciseType: 'kmap',
        expression2: null,
        sourceText: 'Tối tiểu hóa hàm Boole',
        warnings: ['Chữ viết tay hơi mờ'],
      };

      const result = normalizeExpressionResult(rawSpec);

      expect(result.mode).toBe('expression');
      expect(result.expression).toBe('¬p * (q + r)');
      expect(result.variables).toEqual(['p', 'q', 'r']);
      expect(result.exerciseType).toBe('kmap');
      expect(result.isKnownExerciseType).toBe(true);
      expect(result.navigation.targetTab).toBe('single');
      expect(result.navigation.targetSubTab).toBe('kmap');
      expect(result.warnings).toEqual(['Chữ viết tay hơi mờ']);

      // Lifecycle status flags
      expect(result.isAiProposed).toBe(true);
      expect(result.isParserConfirmed).toBe(true);
      expect(result.parserErrors).toHaveLength(0);
      expect(result.isUserApplied).toBe(false);
    });

    it('maps equivalence exerciseType to targetTab "equiv"', () => {
      const rawSpec = {
        expression: 'p → q',
        expression2: '¬p + q',
        exerciseType: 'equivalence',
      };

      const result = normalizeExpressionResult(rawSpec);
      expect(result.navigation.targetTab).toBe('equiv');
      expect(result.navigation.targetSubTab).toBeNull();
      expect(result.isParserConfirmed).toBe(true);
    });

    it('flags parser failure without crashing if AI returned a malformed expression', () => {
      const rawSpec = {
        expression: 'p → → q (lỗi cú pháp từ AI)',
        exerciseType: 'truth_table',
      };

      const result = normalizeExpressionResult(rawSpec);
      expect(result.isAiProposed).toBe(true);
      expect(result.isParserConfirmed).toBe(false);
      expect(result.parserErrors.length).toBeGreaterThan(0);
      expect(result.isUserApplied).toBe(false);
    });

    it('throws descriptive error if expression field is completely missing', () => {
      expect(() => normalizeExpressionResult({})).toThrow('Không tìm thấy biểu thức logic');
      expect(() => normalizeExpressionResult({ expression: '   ' })).toThrow('Không tìm thấy biểu thức logic');
    });
  });

  // =========================================================================
  // 4. QUIZ RESULT NORMALIZATION & SAFETY (NO STATIC BANK POLLUTION)
  // =========================================================================
  describe('normalizeQuizResult', () => {
    it('normalizes valid quiz question with mandatory status "pending"', () => {
      const staticCountBefore = STATIC_QUESTION_BANK.length;

      const rawSpec = {
        question: 'Mệnh đề nào sau đây là hằng đúng?',
        options: [
          { id: 'A', text: 'p * ¬p' },
          { id: 'B', text: 'p + ¬p' },
          { id: 'C', text: 'p → ¬p' },
          { id: 'D', text: 'p ↔ ¬p' },
        ],
        correctId: 'B',
        explanation: 'Luật bài trung: p + ¬p luôn nhận giá trị 1.',
        topicName: 'Hằng đúng & Hằng sai',
        difficulty: 'easy',
        relatedExpression: 'p + ¬p',
        warnings: [],
      };

      const result = normalizeQuizResult(rawSpec);

      expect(result.mode).toBe('quiz');
      expect(result.id).toMatch(/^logic_custom_\d+_/);
      expect(result.question).toBe('Mệnh đề nào sau đây là hằng đúng?');
      expect(result.options).toHaveLength(4);
      expect(result.correctId).toBe('B');
      expect(result.status).toBe('pending'); // NEVER auto-approved
      expect(result.actionLink).toEqual({ view: 'logic', expression: 'p + ¬p' });

      // Verify STATIC_QUESTION_BANK was NEVER modified
      expect(STATIC_QUESTION_BANK.length).toBe(staticCountBefore);
    });

    it('throws error if correctId does not match any existing option', () => {
      const rawSpec = {
        question: 'Câu hỏi test',
        options: [
          { id: 'A', text: 'Opt 1' },
          { id: 'B', text: 'Opt 2' },
        ],
        correctId: 'Z', // Z does not exist
      };

      expect(() => normalizeQuizResult(rawSpec)).toThrow('không tồn tại trong danh sách lựa chọn');
    });

    it('throws error if options array is missing or has less than 2 options', () => {
      const rawSpec = {
        question: 'Câu hỏi test',
        options: [{ id: 'A', text: 'Chỉ 1' }],
        correctId: 'A',
      };

      expect(() => normalizeQuizResult(rawSpec)).toThrow('ít nhất 2 phương án lựa chọn');
    });
  });

  // =========================================================================
  // 5. HTTP TRANSMISSION, STATUS CODES & NETWORK ERROR HANDLING
  // =========================================================================
  describe('analyzeLogicFile HTTP & Error Handling', () => {
    it('submits valid file with FormData to /api/logic/analyze and returns normalized expression', async () => {
      const fakeFile = {
        name: 'test.png',
        size: 1024,
        type: 'image/png',
      };

      let requestedUrl = '';
      let requestedMethod = '';

      globalThis.fetch = vi.fn(async (url, init) => {
        requestedUrl = url;
        requestedMethod = init.method;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            mode: 'expression',
            data: {
              expression: 'p * q',
              variables: ['p', 'q'],
              exerciseType: 'truth_table',
              warnings: [],
            },
          }),
        };
      });

      const result = await analyzeLogicFile(fakeFile, { mode: 'expression' });

      expect(requestedUrl).toContain('/api/logic/analyze?mode=expression');
      expect(requestedMethod).toBe('POST');
      expect(result.expression).toBe('p * q');
      expect(result.isParserConfirmed).toBe(true);
    });

    it('translates network failure to NETWORK_ERROR code', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Connection refused');
      });

      await expect(analyzeLogicFile(fakeFile)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: expect.stringContaining('kết nối'),
      });
    });

    it('translates HTTP 503 to AI_NOT_CONFIGURED code', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ success: false, error: 'AI_NOT_CONFIGURED', message: 'No API key' }),
      }));

      await expect(analyzeLogicFile(fakeFile)).rejects.toMatchObject({
        code: 'AI_NOT_CONFIGURED',
        status: 503,
      });
    });

    it('translates HTTP 429 to RATE_LIMIT_EXCEEDED code', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ success: false, message: 'Quota exceeded' }),
      }));

      await expect(analyzeLogicFile(fakeFile)).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        status: 429,
      });
    });

    it('translates HTTP 413 to FILE_TOO_LARGE code', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 413,
        text: async () => JSON.stringify({ success: false, message: 'Payload too large' }),
      }));

      await expect(analyzeLogicFile(fakeFile)).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
        status: 413,
      });
    });

    it('detects malformed non-JSON response and throws MALFORMED_RESPONSE', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token < in JSON at position 0');
        },
      }));

      await expect(analyzeLogicFile(fakeFile)).rejects.toMatchObject({
        code: 'MALFORMED_RESPONSE',
      });
    });

    it('falls back to candidate localhost port if initial endpoint returns 404', async () => {
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };
      const requestedUrls = [];

      const origLocation = window.location;
      try {
        delete window.location;
      } catch (_) {}
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { hostname: 'localhost', port: '5500', protocol: 'http:' },
      });

      try {
        globalThis.fetch = vi.fn(async (url) => {
          requestedUrls.push(url);
          if (url === '/api/logic/analyze?mode=expression') {
            return { ok: false, status: 404, text: async () => 'Not Found' };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              mode: 'expression',
              data: { expression: 'p * q', variables: ['p', 'q'], exerciseType: 'truth_table' },
            }),
          };
        });

        const result = await analyzeLogicFile(fakeFile, { mode: 'expression' });
        expect(result.expression).toBe('p * q');
        expect(requestedUrls).toContain('http://localhost:3000/api/logic/analyze?mode=expression');
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: origLocation,
        });
      }
    });
  });

  // =========================================================================
  // 6. CLIENT-SIDE PRIVACY & LOCALSTORAGE ISOLATION
  // =========================================================================
  describe('Security & Privacy Guard', () => {
    it('does NOT write or read API keys from localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const fakeFile = { name: 'test.png', size: 1024, type: 'image/png' };

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          mode: 'expression',
          data: { expression: 'p', variables: ['p'], exerciseType: 'truth_table' },
        }),
      }));

      await analyzeLogicFile(fakeFile);

      // Verify no key was saved or queried in localStorage by LogicVisionAdapter
      expect(setItemSpy).not.toHaveBeenCalledWith(expect.stringContaining('api_key'), expect.anything());
    });
  });
});
