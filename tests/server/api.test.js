/**
 * @file api.test.js
 * Test Suite for Phase 5A: Backend AI Vision Graph Specification Service
 * 
 * Tests:
 * 1. Health Check (GET /api/health)
 * 2. Input Validation (File types, size limits, missing file)
 * 3. AI Provider Configuration & 503 Guard
 * 4. AI Vision Analysis (Undirected, Directed, Weighted, Ambiguities)
 * 5. Schema Validation & Normalization
 * 6. Provider Error Handling & Code Fence Stripping
 * 7. Frontend GraphVisionAdapter Integration
 * 8. End-to-End Pipeline: AI Spec -> Core Graph -> Dijkstra, Kruskal, Prim, Euler, Hamilton
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { handleRequest, validateBackendFile } from '../../src/server/app.js';
import {
  setBackendAIProvider,
  getBackendAIProvider,
  isAIConfigured,
  cleanJsonResponseText,
} from '../../src/server/ai/AIProviderAdapter.js';
import { extractBoundary, parseMultipartData } from '../../src/server/parseMultipart.js';
import {
  analyzeGraphFile,
  validateFileSupport,
  validateGraphSpecification,
  createGraphFromSpecification,
  graphToSpecification,
  graphToEdgeList,
  graphToAdjacencyMatrix,
  setAnalyzerProvider,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from '../../src/app/ai/GraphVisionAdapter.js';
import { extractDocx, extractTextFromDocumentXml } from '../../src/app/ai/DocxExtractor.js';
import { AlgorithmRegistry } from '../../src/app/algorithms/AlgorithmRegistry.js';
import { PlaybackController } from '../../src/app/playback/PlaybackController.js';
import { AlgorithmStatus } from '../../src/core/models/Types.js';

// =========================================================================
// MOCK HTTP HELPERS
// =========================================================================

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

describe('Phase 5A: Backend AI Vision Service & Input Pipeline', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    setBackendAIProvider(null);
    setAnalyzerProvider(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setBackendAIProvider(null);
    setAnalyzerProvider(null);
  });

  // =========================================================================
  // 1. HEALTH CHECK ENDPOINT
  // =========================================================================
  describe('GET /api/health', () => {
    it('returns 200 OK and reports AI unconfigured when no keys are present', async () => {
      const { req, res } = createMockHttp({ method: 'GET', url: '/api/health' });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json).not.toBeNull();
      expect(json.status).toBe('ok');
      expect(json.aiConfigured).toBe(false);
      expect(Array.isArray(json.supportedFormats)).toBe(true);
      expect(json.supportedFormats).toContain('.png');
      expect(json.supportedFormats).toContain('.pdf');
    });

    it('reports aiConfigured: true when environment variable or provider is set', async () => {
      process.env.GEMINI_API_KEY = 'test_key_gemini_123';
      const { req, res } = createMockHttp({ method: 'GET', url: '/api/health' });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.aiConfigured).toBe(true);
    });
  });

  // =========================================================================
  // 2. INPUT VALIDATION & FILE PARSING
  // =========================================================================
  describe('File Validation & Multipart Parser', () => {
    it('extracts boundary correctly from multipart Content-Type', () => {
      const header = 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW';
      expect(extractBoundary(header)).toBe('----WebKitFormBoundary7MA4YWxkTrZu0gW');
    });

    it('rejects missing file in POST /api/graph/analyze with 400 NO_FILE', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: { foo: 'bar' },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('NO_FILE');
    });

    it('rejects unsupported file extension (.exe) with 400 INVALID_FILE', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'malicious.exe',
            type: 'application/x-msdownload',
            data: Buffer.from('dummy exe content').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_FILE');
      expect(json.message).toContain('không được hỗ trợ');
    });

    it('rejects file larger than 15MB with 400 INVALID_FILE', () => {
      const largeFile = {
        filename: 'huge_graph.png',
        type: 'image/png',
        data: Buffer.alloc(10),
        size: 16 * 1024 * 1024,
      };
      const check = validateBackendFile(largeFile);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('15MB');
    });

    it('validates supported extensions in validateFileSupport on frontend', () => {
      expect(validateFileSupport({ name: 'graph.png', size: 1024 }).valid).toBe(true);
      expect(validateFileSupport({ name: 'graph.jpg', size: 1024 }).valid).toBe(true);
      expect(validateFileSupport({ name: 'graph.jpeg', size: 1024 }).valid).toBe(true);
      expect(validateFileSupport({ name: 'graph.webp', size: 1024 }).valid).toBe(true);
      expect(validateFileSupport({ name: 'graph.pdf', size: 1024 }).valid).toBe(true);
      expect(validateFileSupport({ name: 'graph.docx', size: 1024 }).valid).toBe(true);

      const invalid = validateFileSupport({ name: 'graph.zip', size: 1024 });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('không được hỗ trợ');
    });
  });

  // =========================================================================
  // 3. UNCONFIGURED AI PROVIDER GUARD (503)
  // =========================================================================
  describe('Unconfigured AI Provider Guard (503)', () => {
    it('returns 503 AI_NOT_CONFIGURED when no API key is set on server', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'dijkstra_graph.png',
            type: 'image/png',
            data: Buffer.from('fake image content').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(503);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('AI_NOT_CONFIGURED');
      expect(json.message).toContain('AI Vision chưa được cấu hình');
    });

    it('cleans markdown code block wraps from raw text', () => {
      const fenced = '```json\n{"directed":false,"weighted":true,"nodes":[],"edges":[]}\n```';
      const cleaned = cleanJsonResponseText(fenced);
      expect(cleaned).toBe('{"directed":false,"weighted":true,"nodes":[],"edges":[]}');

      const plainFenced = '```\n{"nodes":[]}\n```';
      expect(cleanJsonResponseText(plainFenced)).toBe('{"nodes":[]}');
    });
  });

  // =========================================================================
  // 4. CANONICAL GRAPH SPECIFICATION EXTRACTION
  // =========================================================================
  describe('AI Vision Graph Extraction (Canonical Schema)', () => {
    it('extracts valid undirected weighted graph (A -5- B, A -2- C, B -1- C)', async () => {
      const mockSpec = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }],
        edges: [
          { from: 'A', to: 'B', weight: 5 },
          { from: 'A', to: 'C', weight: 2 },
          { from: 'B', to: 'C', weight: 1 },
        ],
        confidence: 0.95,
        warnings: [],
      };

      setBackendAIProvider(async () => mockSpec);

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'test_graph.png',
            type: 'image/png',
            data: Buffer.from('img').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.success).toBe(true);
      expect(json.graph).toBeDefined();
      expect(json.graph.directed).toBe(false);
      expect(json.graph.weighted).toBe(true);
      expect(json.graph.nodes).toHaveLength(3);
      expect(json.graph.edges).toHaveLength(3);
      expect(json.warnings).toEqual([]);
    });

    it('extracts valid directed graph with arrows (A -> B, B -> C)', async () => {
      const mockSpec = {
        directed: true,
        weighted: true,
        nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
        edges: [
          { from: 'A', to: 'B', weight: 4 },
          { from: 'B', to: 'C', weight: 8 },
        ],
        confidence: 0.92,
      };

      setBackendAIProvider(async () => mockSpec);

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'directed.png',
            type: 'image/png',
            data: Buffer.from('img').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.graph.directed).toBe(true);
      expect(json.graph.edges[0].from).toBe('A');
      expect(json.graph.edges[0].to).toBe('B');
      expect(json.graph.edges[0].weight).toBe(4);
    });

    it('returns warnings array when image has ambiguous edge weights or direction', async () => {
      const mockSpecWithWarnings = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: null }],
        warnings: [
          'Trọng số cạnh A-B bị mờ, mặc định gán trọng số = 1.',
          'Mũi tên trên cạnh A-B không rõ nét, giả định vô hướng.',
        ],
      };

      setBackendAIProvider(async () => mockSpecWithWarnings);

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'ambiguous.png',
            type: 'image/png',
            data: Buffer.from('img').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const json = res.getJson();
      expect(json.success).toBe(true);
      expect(json.warnings).toHaveLength(2);
      expect(json.warnings[0]).toContain('Trọng số cạnh A-B bị mờ');
      expect(json.warnings[1]).toContain('Mũi tên trên cạnh A-B');
    });

    it('returns 400 INVALID_AI_SPEC when AI returns invalid schema or missing nodes', async () => {
      // Missing nodes array
      setBackendAIProvider(async () => ({
        directed: false,
        weighted: false,
        edges: [{ from: 'A', to: 'B' }],
      }));

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'broken.png',
            type: 'image/png',
            data: Buffer.from('img').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.success).toBe(false);
      expect(json.error).toBe('INVALID_AI_SPEC');
      expect(json.errors.length).toBeGreaterThan(0);
    });

    it('returns 400 INVALID_AI_SPEC when edge references unknown node', async () => {
      setBackendAIProvider(async () => ({
        directed: false,
        weighted: false,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ from: 'A', to: 'Z', weight: 1 }], // 'Z' is not in nodes
      }));

      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {
          file: {
            filename: 'invalid_node.png',
            type: 'image/png',
            data: Buffer.from('img').toString('base64'),
          },
        },
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(400);
      const json = res.getJson();
      expect(json.error).toBe('INVALID_AI_SPEC');
      expect(json.errors[0]).toContain('Z');
    });
  });

  // =========================================================================
  // 5. FRONTEND GRAPH VISION ADAPTER
  // =========================================================================
  describe('GraphVisionAdapter.js Frontend Unit & Schema Tests', () => {
    it('normalizes string node shorthand to { id, name } objects', () => {
      const spec = {
        directed: false,
        weighted: true,
        nodes: ['X', 'Y', 'Z'],
        edges: [
          { from: 'X', to: 'Y', weight: 3 },
          { from: 'Y', to: 'Z', weight: 4 },
        ],
      };

      const result = validateGraphSpecification(spec);
      expect(result.valid).toBe(true);
      expect(result.normalizedSpec.nodes[0]).toEqual({ id: 'X', name: 'X' });
      expect(result.normalizedSpec.nodes[1]).toEqual({ id: 'Y', name: 'Y' });
      expect(result.normalizedSpec.nodes[2]).toEqual({ id: 'Z', name: 'Z' });
    });

    it('converts GraphSpecification to Core Graph instance', () => {
      const spec = {
        directed: true,
        weighted: true,
        nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
        edges: [
          { from: '1', to: '2', weight: 10 },
          { from: '2', to: '3', weight: 20 },
        ],
      };

      const graph = createGraphFromSpecification(spec);
      expect(graph).toBeDefined();
      expect(graph.isDirected).toBe(true);
      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(2);

      const adj1 = graph.getNeighbors('1');
      expect(adj1).toHaveLength(1);
      expect(adj1[0].node).toBe('2');
      expect(adj1[0].weight).toBe(10);
    });

    it('bridges extracted graph to Edge List and Matrix text formats', () => {
      const spec = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: 7 }],
      };

      const graph = createGraphFromSpecification(spec);
      const edgeList = graphToEdgeList(graph);
      expect(edgeList).toBe('A - B: 7');

      const matrixText = graphToAdjacencyMatrix(graph);
      expect(matrixText).toContain('A B');
      expect(matrixText).toContain('0 7');
      expect(matrixText).toContain('7 0');
    });

    it('serializes Core Graph back to canonical GraphSpecification', () => {
      const spec = {
        directed: false,
        weighted: true,
        nodes: [{ id: 'A' }, { id: 'B' }],
        edges: [{ from: 'A', to: 'B', weight: 5 }],
      };

      const graph = createGraphFromSpecification(spec);
      const serialized = graphToSpecification(graph);

      expect(serialized.directed).toBe(false);
      expect(serialized.weighted).toBe(true);
      expect(serialized.nodes).toEqual([{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }]);
      expect(serialized.edges).toHaveLength(1);
      expect(serialized.edges[0]).toEqual({ from: 'A', to: 'B', weight: 5 });
    });

    it('validates Word (.docx) support in validateBackendFile and validateFileSupport', () => {
      const docxFile = {
        filename: 'Bai-tap-chuong-5.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: Buffer.from('PK\x03\x04test'),
        size: 547 * 1024,
      };
      expect(validateBackendFile(docxFile).valid).toBe(true);
      expect(validateFileSupport({ name: 'Bai-tap-chuong-5.docx', size: 547 * 1024 }).valid).toBe(true);
    });

    it('extracts text from document.xml correctly', () => {
      const xml = '<w:document><w:body><w:p><w:t>Bai tap 1: Cho do thi G</w:t></w:p><w:p><w:t>Canh (A, B) = 5</w:t></w:p></w:body></w:document>';
      const xmlBytes = Buffer.from(xml, 'utf8');
      const result = extractTextFromDocumentXml(xmlBytes);
      expect(result.text).toContain('Bai tap 1: Cho do thi G');
      expect(result.text).toContain('Canh (A, B) = 5');
      expect(result.paragraphs).toHaveLength(2);
    });

    it('executes Vercel serverless handlers correctly', async () => {
      const { default: healthHandler } = await import('../../api/health.js');
      const { default: analyzeHandler } = await import('../../api/graph/analyze.js');

      const { req: hReq, res: hRes } = createMockHttp({ method: 'GET', url: '/api/health' });
      await healthHandler(hReq, hRes);
      expect(hRes.statusCode).toBe(200);

      const { req: aReq, res: aRes } = createMockHttp({
        method: 'POST',
        url: '/api/graph/analyze',
        headers: { 'content-type': 'application/json' },
        body: {},
      });
      await analyzeHandler(aReq, aRes);
      expect(aRes.statusCode).toBe(400); // 400 NO_FILE
    });
  });

  // =========================================================================
  // 6. END-TO-END PIPELINE: AI SPEC -> CORE GRAPH -> ALL 5 ALGORITHMS
  // =========================================================================
  describe('End-to-End Pipeline: AI Spec -> Core Graph -> Algorithm Execution', () => {
    // 5-node weighted undirected graph:
    // A -4- B, A -2- C, B -1- C, B -5- D, C -8- D, D -2- E, C -10- E
    const sampleAiSpec = {
      directed: false,
      weighted: true,
      nodes: [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
        { id: 'C', name: 'C' },
        { id: 'D', name: 'D' },
        { id: 'E', name: 'E' },
      ],
      edges: [
        { from: 'A', to: 'B', weight: 4 },
        { from: 'A', to: 'C', weight: 2 },
        { from: 'B', to: 'C', weight: 1 },
        { from: 'B', to: 'D', weight: 5 },
        { from: 'C', to: 'D', weight: 8 },
        { from: 'D', to: 'E', weight: 2 },
        { from: 'C', to: 'E', weight: 10 },
      ],
      confidence: 0.98,
      warnings: [],
    };

    it('successfully runs Dijkstra on the AI-extracted graph', () => {
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();

      const result = registry.run('dijkstra', graph, { startNode: 'A', targetNode: 'E' });
      expect(result).toBeDefined();
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);

      // Shortest path A -> B -> D -> E:
      // A->C(2) + C->B(1) = 3 to B; B->D(5) = 8 to D; D->E(2) = 10 to E.
      // Or A->B(4) + B->D(5) + D->E(2) = 11. Shortest is A -> C -> B -> D -> E = 10.
      expect(result.totalWeight).toBe(10);
      expect(result.path).toEqual(['A', 'C', 'B', 'D', 'E']);
      expect(result.steps.length).toBeGreaterThan(0);

      // Verify PlaybackController can step through the AI-extracted graph's execution
      const playback = new PlaybackController();
      playback.load(result.steps);
      expect(playback.stepCount).toBe(result.steps.length);
      playback.stepForward();
      expect(playback.currentStepIndex).toBe(1);
      playback.seek(playback.stepCount - 1);
      expect(playback.currentStepIndex).toBe(playback.stepCount - 1);
    });

    it('successfully runs Kruskal MST on the AI-extracted graph', () => {
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();

      const result = registry.run('kruskal', graph);
      expect(result).toBeDefined();
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toBeDefined();
      // MST of 5 nodes has exactly 4 edges
      expect(result.edges.length).toBe(4);
      // Min weights: (B,C:1), (A,C:2), (D,E:2), (B,D:5) = 1 + 2 + 2 + 5 = 10
      expect(result.totalWeight).toBe(10);
    });

    it('successfully runs Prim MST on the AI-extracted graph', () => {
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();

      const result = registry.run('prim', graph, { startNode: 'A' });
      expect(result).toBeDefined();
      expect(result.status).toBe(AlgorithmStatus.SUCCESS);
      expect(result.edges).toHaveLength(4);
      expect(result.totalWeight).toBe(10);
    });

    it('successfully runs Euler on the AI-extracted graph', () => {
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();

      const result = registry.run('euler', graph, { startNode: 'A' });
      expect(result).toBeDefined();
      expect(result.algorithm).toBe('euler');
      expect(typeof result.status).toBe('string');
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('successfully runs Hamilton on the AI-extracted graph', () => {
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();

      const result = registry.run('hamilton', graph, { startNode: 'A' });
      expect(result).toBeDefined();
      expect(result.algorithm).toBe('hamilton');
      expect(typeof result.status).toBe('string');
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('proves AI only extracts graph structure and Core algorithms compute all logic deterministically', () => {
      // The sampleAiSpec contains ONLY topology (nodes & edges)
      expect(sampleAiSpec.data).toBeUndefined();
      expect(sampleAiSpec.steps).toBeUndefined();
      expect(sampleAiSpec.path).toBeUndefined();

      // Only Core Graph + AlgorithmRegistry compute the steps
      const graph = createGraphFromSpecification(sampleAiSpec);
      const registry = new AlgorithmRegistry();
      const dijkstraResult = registry.run('dijkstra', graph, { startNode: 'A', targetNode: 'E' });

      // Core steps are generated deterministically
      expect(dijkstraResult.steps.length).toBeGreaterThan(5);
      expect(dijkstraResult.steps[0].action).toBeDefined();
    });
  });

  // =========================================================================
  // 9. BACKEND AUTH & AI HISTORY API ENDPOINTS
  // =========================================================================
  describe('Backend Auth & AI History Endpoints', () => {
    it('GET /api/auth/users returns demo users without passwords', async () => {
      const { req, res } = createMockHttp({ method: 'GET', url: '/api/auth/users' });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(1);
      expect(data.users.some(u => u.username === 'admin')).toBe(true);
      expect(data.users[0].password).toBeUndefined();
    });

    it('GET /api/auth/verify checks validity of user session', async () => {
      // 1. Valid admin user
      const validReq = createMockHttp({
        method: 'GET',
        url: '/api/auth/verify?username=admin',
      });
      await handleRequest(validReq.req, validReq.res);
      expect(validReq.res.statusCode).toBe(200);
      const validData = JSON.parse(validReq.res.body);
      expect(validData.valid).toBe(true);

      // 2. Deleted / non-existent user returns 404
      const invalidReq = createMockHttp({
        method: 'GET',
        url: '/api/auth/verify?userId=deleted_user_xyz',
      });
      await handleRequest(invalidReq.req, invalidReq.res);
      expect(invalidReq.res.statusCode).toBe(404);
      const invalidData = JSON.parse(invalidReq.res.body);
      expect(invalidData.valid).toBe(false);
    });

    it('POST /api/auth/login authenticates admin and returns user info', async () => {
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('admin');
    });

    it('POST /api/auth/register creates new student account', async () => {
      const uniqueUsername = `sv_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const { req, res } = createMockHttp({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: uniqueUsername,
          fullName: 'Lê Văn B',
          email: `${uniqueUsername}@k66.edu.vn`,
          password: 'password123',
        }),
      });
      await handleRequest(req, res);

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.user.username).toBe(uniqueUsername);
    });

    it('GET /api/ai/history, POST /api/ai/history, and DELETE /api/ai/history/:id work end-to-end', async () => {
      // 1. Post a new session
      const postReq = createMockHttp({
        method: 'POST',
        url: '/api/ai/history',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 'user_admin',
          title: 'Hỏi về Dijkstra',
          mode: 'bridge',
          messages: [{ role: 'user', text: 'Giải thích Dijkstra' }],
        }),
      });
      await handleRequest(postReq.req, postReq.res);
      expect(postReq.res.statusCode).toBe(200);
      const postData = JSON.parse(postReq.res.body);
      expect(postData.success).toBe(true);
      const sessionId = postData.session.id;

      // 2. Get sessions for user
      const getReq = createMockHttp({
        method: 'GET',
        url: '/api/ai/history?userId=user_admin',
      });
      await handleRequest(getReq.req, getReq.res);
      expect(getReq.res.statusCode).toBe(200);
      const getData = JSON.parse(getReq.res.body);
      expect(getData.sessions.some(s => s.id === sessionId)).toBe(true);

      // 3. Delete session
      const delReq = createMockHttp({
        method: 'DELETE',
        url: `/api/ai/history/${sessionId}`,
      });
      await handleRequest(delReq.req, delReq.res);
      expect(delReq.res.statusCode).toBe(200);
    });

    it('GET /api/quiz/leaderboard, GET /api/quiz/stats, POST /api/quiz/answer, and POST /api/quiz/exam work end-to-end', async () => {
      const testUserId = `user_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // 1. Get initial leaderboard (starts clean and empty)
      const lbReq = createMockHttp({
        method: 'GET',
        url: '/api/quiz/leaderboard',
      });
      await handleRequest(lbReq.req, lbReq.res);
      expect(lbReq.res.statusCode).toBe(200);
      const lbData = JSON.parse(lbReq.res.body);
      expect(lbData.success).toBe(true);
      expect(Array.isArray(lbData.leaderboard)).toBe(true);

      // Register student so they exist in server database
      const regReq = createMockHttp({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: testUserId,
          fullName: 'Sinh viên Server Test',
          email: `${testUserId}@toanrr.edu.vn`,
          password: 'password123',
        }),
      });
      await handleRequest(regReq.req, regReq.res);
      expect(regReq.res.statusCode).toBe(200);
      const actualUserId = JSON.parse(regReq.res.body).user.id;

      // 2. Post answer for user
      const ansReq = createMockHttp({
        method: 'POST',
        url: '/api/quiz/answer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: actualUserId,
          isCorrect: true,
          userInfo: { fullName: 'Sinh viên Server Test', username: testUserId },
        }),
      });
      await handleRequest(ansReq.req, ansReq.res);
      expect(ansReq.res.statusCode).toBe(200);
      const ansData = JSON.parse(ansReq.res.body);
      expect(ansData.success).toBe(true);
      expect(ansData.stats.score).toBe(100);
      expect(ansData.stats.correctCount).toBe(1);

      // Verify user now ranks on leaderboard
      const lbReq2 = createMockHttp({
        method: 'GET',
        url: '/api/quiz/leaderboard',
      });
      await handleRequest(lbReq2.req, lbReq2.res);
      expect(lbReq2.res.statusCode).toBe(200);
      const lbData2 = JSON.parse(lbReq2.res.body);
      expect(lbData2.success).toBe(true);
      expect(lbData2.leaderboard.length).toBeGreaterThan(0);
      expect(lbData2.leaderboard[0].rankBadge).toBe('🥇');

      // 3. Post exam record
      const examReq = createMockHttp({
        method: 'POST',
        url: '/api/quiz/exam',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: actualUserId,
          examResult: { title: 'Bài thi thử nghiệm Cloud', score: 10, maxScore: 10 },
          userInfo: { fullName: 'Sinh viên Server Test' },
        }),
      });
      await handleRequest(examReq.req, examReq.res);
      expect(examReq.res.statusCode).toBe(200);
      const examData = JSON.parse(examReq.res.body);
      expect(examData.success).toBe(true);
      expect(examData.stats.history.length).toBe(1);

      // 4. Get stats for this user
      const statsReq = createMockHttp({
        method: 'GET',
        url: `/api/quiz/stats?userId=${actualUserId}`,
      });
      await handleRequest(statsReq.req, statsReq.res);
      expect(statsReq.res.statusCode).toBe(200);
      const statsData = JSON.parse(statsReq.res.body);
      expect(statsData.stats.userId).toBe(actualUserId);
      expect(statsData.stats.score).toBe(100);
    });
  });
});
