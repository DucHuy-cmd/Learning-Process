/**
 * @file LogicVisionAdapter.js
 * Application-layer AI Vision Adapter for Propositional Logic & Quiz Generation
 * 
 * Provides DOM-independent, pure ES Module client-side logic:
 * - File format and size verification (.png, .jpg, .jpeg, .webp, .pdf, .docx up to 15MB)
 * - Safe HTTP transmission to backend /api/logic/analyze via FormData (no client-exposed API keys)
 * - Error classification (NETWORK_ERROR, FILE_TOO_LARGE, RATE_LIMIT_EXCEEDED, AI_NOT_CONFIGURED, etc.)
 * - Parsing and AST verification using the core LogicParser engine
 * - Three-stage state tracking:
 *   1. AI Proposed
 *   2. Parser Confirmed (AST valid, variables extracted)
 *   3. User Confirmed / Applied (manual approval before entering Logic Lab)
 * - Custom Question normalization with mandatory 'pending' status (never auto-approved)
 */

import { parseLogicExpression, extractVariables } from '../../core/logic/LogicParser.js';

export const MAX_LOGIC_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const SUPPORTED_LOGIC_EXTENSIONS = Object.freeze([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.docx',
]);

export const SUPPORTED_LOGIC_MIME_TYPES = Object.freeze(new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip',
  'application/octet-stream',
]));

let customMockAnalyzer = null;

/**
 * Registers an optional mock analyzer function for automated testing.
 * @param {Function|null} fn - async (file, options) => Object
 */
export function setLogicVisionMockAnalyzer(fn) {
  customMockAnalyzer = typeof fn === 'function' ? fn : null;
}

/**
 * Gets the registered mock analyzer.
 * @returns {Function|null}
 */
export function getLogicVisionMockAnalyzer() {
  return customMockAnalyzer;
}

/**
 * Validates file input against supported formats and 15MB size limit.
 * @param {File|Object} file - File or file-like object { name, size, type }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLogicFileSupport(file) {
  if (!file) {
    return { valid: false, error: 'Không tìm thấy tệp đính kèm. Vui lòng chọn tệp.' };
  }

  const size = typeof file.size === 'number' ? file.size : 0;
  if (size <= 0) {
    return { valid: false, error: 'Tệp rỗng hoặc không có dữ liệu (kích thước 0 bytes).' };
  }

  if (size > MAX_LOGIC_FILE_SIZE_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Tệp quá lớn (${sizeMb}MB). Giới hạn tối đa là 15MB.` };
  }

  const filename = (file.name || file.filename || '').toLowerCase();
  const hasValidExt = SUPPORTED_LOGIC_EXTENSIONS.some(ext => filename.endsWith(ext));
  const hasValidMime = file.type ? SUPPORTED_LOGIC_MIME_TYPES.has(file.type) : false;

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: `Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp: ${SUPPORTED_LOGIC_EXTENSIONS.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates a logic expression string directly using the core recursive descent LogicParser.
 * @param {string} expressionText
 * @returns {{ valid: boolean, error: string|null, ast: Object|null, variables: string[] }}
 */
export function validateExpressionWithParser(expressionText) {
  if (!expressionText || typeof expressionText !== 'string' || !expressionText.trim()) {
    return {
      valid: false,
      error: 'Biểu thức logic rỗng hoặc không phải chuỗi ký tự.',
      ast: null,
      variables: [],
    };
  }

  try {
    const ast = parseLogicExpression(expressionText);
    const variables = extractVariables(ast);
    return {
      valid: true,
      error: null,
      ast,
      variables,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message || 'Lỗi cú pháp biểu thức logic.',
      ast: null,
      variables: [],
    };
  }
}

/**
 * Normalizes and validates the AI response for mode: "expression".
 * Preserves AI data, verifies with parser, and prepares navigation mapping for LogicLabView.
 * 
 * @param {Object} rawSpec
 * @returns {Object} Normalized Expression Result Model
 * @throws {Error} If rawSpec is fundamentally invalid
 */
export function normalizeExpressionResult(rawSpec) {
  if (!rawSpec || typeof rawSpec !== 'object') {
    throw new Error('Dữ liệu từ AI không phải là đối tượng hợp lệ.');
  }

  const rawExpression = typeof rawSpec.expression === 'string' ? rawSpec.expression.trim() : '';
  if (!rawExpression) {
    throw new Error('Không tìm thấy biểu thức logic trong kết quả AI.');
  }

  const rawExpression2 = typeof rawSpec.expression2 === 'string' && rawSpec.expression2.trim()
    ? rawSpec.expression2.trim()
    : null;

  // Run core parser verification on expression 1
  const parseValidation1 = validateExpressionWithParser(rawExpression);

  // Run core parser verification on expression 2 (if present)
  let parseValidation2 = null;
  if (rawExpression2) {
    parseValidation2 = validateExpressionWithParser(rawExpression2);
  }

  // Aggregate detected variables
  const detectedVars = new Set(parseValidation1.variables);
  if (parseValidation2) {
    parseValidation2.variables.forEach(v => detectedVars.add(v));
  }
  if (Array.isArray(rawSpec.variables)) {
    rawSpec.variables.forEach(v => {
      if (typeof v === 'string' && v.trim()) detectedVars.add(v.trim());
    });
  }

  // Map exercise type to LogicLabView verified tabs and subtabs
  // Primary tabs: 'single' | 'equiv' | 'normal'
  // Subtabs in 'single': 'table' | 'kmap' | 'circuit'
  const rawExerciseType = typeof rawSpec.exerciseType === 'string' ? rawSpec.exerciseType.toLowerCase().trim() : '';
  let targetTab = 'single';
  let targetSubTab = 'table';
  let isKnownExerciseType = true;

  if (rawExerciseType === 'equivalence' || rawExpression2) {
    targetTab = 'equiv';
    targetSubTab = null;
  } else if (rawExerciseType === 'kmap') {
    targetTab = 'single';
    targetSubTab = 'kmap';
  } else if (rawExerciseType === 'circuit') {
    targetTab = 'single';
    targetSubTab = 'circuit';
  } else if (rawExerciseType === 'truth_table' || rawExerciseType === 'table') {
    targetTab = 'single';
    targetSubTab = 'table';
  } else if (rawExerciseType === 'normal' || rawExerciseType === 'dnf' || rawExerciseType === 'cnf') {
    targetTab = 'normal';
    targetSubTab = null;
  } else {
    isKnownExerciseType = false;
    targetTab = 'single';
    targetSubTab = 'table';
  }

  const isParserConfirmed = parseValidation1.valid && (!rawExpression2 || parseValidation2.valid);
  const parserErrors = [];
  if (!parseValidation1.valid) parserErrors.push(`Biểu thức 1: ${parseValidation1.error}`);
  if (parseValidation2 && !parseValidation2.valid) parserErrors.push(`Biểu thức 2: ${parseValidation2.error}`);

  return {
    mode: 'expression',
    rawSpec,
    expression: rawExpression,
    expression2: rawExpression2,
    variables: Array.from(detectedVars).sort(),
    exerciseType: rawSpec.exerciseType || 'truth_table',
    isKnownExerciseType,
    navigation: {
      targetTab,
      targetSubTab,
    },
    sourceText: rawSpec.sourceText || '',
    warnings: Array.isArray(rawSpec.warnings) ? [...rawSpec.warnings] : [],
    // Three-stage lifecycle:
    isAiProposed: true,
    isParserConfirmed,
    parserErrors,
    isUserApplied: false, // Must be explicitly confirmed by user before applying
  };
}

/**
 * Normalizes and validates the AI response for mode: "quiz".
 * Produces an isolated custom question structure with status: 'pending'.
 * Never automatically marks questions as approved or writes to static bank.
 * 
 * @param {Object} rawSpec
 * @param {Object} [options={}]
 * @param {string} [options.idPrefix='logic_custom']
 * @returns {Object} Normalized Custom Question Model
 * @throws {Error} If question, options, or correctId are invalid
 */
export function normalizeQuizResult(rawSpec, { idPrefix = 'logic_custom' } = {}) {
  if (!rawSpec || typeof rawSpec !== 'object') {
    throw new Error('Dữ liệu từ AI không phải là đối tượng hợp lệ.');
  }

  const question = typeof rawSpec.question === 'string' ? rawSpec.question.trim() : '';
  if (!question) {
    throw new Error('Thiếu nội dung câu hỏi trong kết quả AI.');
  }

  if (!Array.isArray(rawSpec.options) || rawSpec.options.length < 2) {
    throw new Error('Câu hỏi trắc nghiệm phải có ít nhất 2 phương án lựa chọn.');
  }

  const validOptionIds = new Set();
  const options = rawSpec.options.map((opt, idx) => {
    const defaultId = String.fromCharCode(65 + idx); // A, B, C, D...
    const id = typeof opt.id === 'string' && opt.id.trim() ? opt.id.trim().toUpperCase() : defaultId;
    const text = typeof opt.text === 'string' ? opt.text.trim() : String(opt || '');
    validOptionIds.add(id);
    return { id, text };
  });

  const rawCorrectId = typeof rawSpec.correctId === 'string' ? rawSpec.correctId.trim().toUpperCase() : '';
  if (!validOptionIds.has(rawCorrectId)) {
    throw new Error(`Đáp án đúng (correctId: "${rawCorrectId}") không tồn tại trong danh sách lựa chọn (${Array.from(validOptionIds).join(', ')}).`);
  }

  const generatedId = `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    mode: 'quiz',
    id: generatedId,
    question,
    options,
    correctId: rawCorrectId,
    explanation: typeof rawSpec.explanation === 'string' ? rawSpec.explanation.trim() : '',
    topic: 'logic',
    topicName: typeof rawSpec.topicName === 'string' && rawSpec.topicName.trim()
      ? rawSpec.topicName.trim()
      : 'Logic Mệnh đề & Bìa K',
    difficulty: ['easy', 'medium', 'hard'].includes(rawSpec.difficulty) ? rawSpec.difficulty : 'medium',
    relatedExpression: typeof rawSpec.relatedExpression === 'string' ? rawSpec.relatedExpression.trim() : '',
    actionLink: rawSpec.relatedExpression ? { view: 'logic', expression: rawSpec.relatedExpression.trim() } : null,
    source: 'ai_vision',
    status: 'pending', // [MANDATORY] Must start as 'pending' for teacher review
    createdAt: new Date().toISOString(),
    warnings: Array.isArray(rawSpec.warnings) ? [...rawSpec.warnings] : [],
    rawSpec,
  };
}

/**
 * Sends logic problem file/image to backend /api/logic/analyze and normalizes result.
 * 
 * @param {File|Blob|Object} file - Uploaded file or file descriptor
 * @param {Object} [options={}]
 * @param {'expression'|'quiz'} [options.mode='expression']
 * @param {string} [options.endpoint='/api/logic/analyze']
 * @returns {Promise<Object>} Normalized Expression Result or Quiz Result
 */
export async function analyzeLogicFile(file, options = {}) {
  const mode = options.mode === 'quiz' ? 'quiz' : 'expression';

  // 1. Client-side file validation
  const fileCheck = validateLogicFileSupport(file);
  if (!fileCheck.valid) {
    const err = new Error(fileCheck.error);
    err.code = 'INVALID_FILE';
    throw err;
  }

  // 2. Custom mock analyzer hook for automated testing
  if (customMockAnalyzer) {
    const rawResult = await customMockAnalyzer(file, { mode, ...options });
    if (mode === 'quiz') {
      return normalizeQuizResult(rawResult);
    }
    return normalizeExpressionResult(rawResult);
  }

  // 3. Prepare FormData payload (browser sends multipart/form-data with automatic boundary)
  let requestBody;
  let requestHeaders = {};

  if (typeof FormData !== 'undefined' && (file instanceof Blob || (typeof File !== 'undefined' && file instanceof File))) {
    const formData = new FormData();
    formData.append('file', file, file.name || 'uploaded_logic_file.png');
    formData.append('mode', mode);
    requestBody = formData;
  } else if (file && file.data) {
    // Node.js or JSON base64 descriptor
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify({
      mode,
      file: {
        filename: file.filename || file.name || 'uploaded_logic_file.png',
        type: file.type || 'image/png',
        data: Buffer.isBuffer(file.data)
          ? file.data.toString('base64')
          : (typeof file.data === 'string' ? file.data : Buffer.from(file.data).toString('base64')),
        encoding: 'base64',
      },
    });
  } else {
    // Generic FormData fallback
    if (typeof FormData !== 'undefined') {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      requestBody = formData;
    } else {
      const err = new Error('Môi trường hiện tại không hỗ trợ FormData.');
      err.code = 'UNSUPPORTED_ENVIRONMENT';
      throw err;
    }
  }

  const candidateEndpoints = [];
  if (options.endpoint) {
    candidateEndpoints.push(options.endpoint);
  } else {
    // 1. Primary relative endpoint (standard on port 3000 and production/Vercel)
    candidateEndpoints.push(`/api/logic/analyze?mode=${encodeURIComponent(mode)}`);

    // 2. Localhost fallback if running on another dev port or file: protocol
    if (typeof window !== 'undefined' && window.location) {
      const { hostname, port, protocol } = window.location;
      if (protocol === 'file:' || ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000')) {
        candidateEndpoints.push(`http://localhost:3000/api/logic/analyze?mode=${encodeURIComponent(mode)}`);
        candidateEndpoints.push(`http://127.0.0.1:3000/api/logic/analyze?mode=${encodeURIComponent(mode)}`);
      }
    }
  }

  let response = null;
  let lastFetchError = null;

  for (const ep of candidateEndpoints) {
    try {
      const fetchOpts = {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      };
      if (options.signal) {
        fetchOpts.signal = options.signal;
      }
      const res = await fetch(ep, fetchOpts);
      // If we got 404 on a secondary port (like port 5500 serving frontend without backend), continue probing
      if (res.status === 404 && candidateEndpoints.length > 1 && ep === candidateEndpoints[0]) {
        continue;
      }
      response = res;
      break;
    } catch (networkErr) {
      lastFetchError = networkErr;
      if (networkErr.name === 'AbortError') {
        throw networkErr;
      }
      // Continue to next candidate endpoint
    }
  }

  if (!response) {
    const err = new Error(
      'Không thể kết nối đến máy chủ backend (http://localhost:3000). Vui lòng đảm bảo server Node.js đang chạy bằng lệnh "npm start" trong terminal.'
    );
    err.code = 'NETWORK_ERROR';
    err.originalError = lastFetchError;
    throw err;
  }

  // 4. Handle HTTP Error statuses with standard error codes
  if (!response.ok) {
    let errorJson = null;
    let rawText = '';
    try {
      rawText = await response.text();
      errorJson = JSON.parse(rawText);
    } catch {
      // response text is not JSON
    }

    const serverCode = errorJson?.error || null;
    const serverMessage = errorJson?.message || rawText || `Lỗi máy chủ (${response.status})`;

    const err = new Error(serverMessage);
    if (response.status === 413 || serverCode === 'INVALID_FILE') {
      err.code = 'FILE_TOO_LARGE';
    } else if (response.status === 429) {
      err.code = 'RATE_LIMIT_EXCEEDED';
      err.message = 'Hạn ngạch xử lý AI đã đạt giới hạn (429 Rate Limit). Vui lòng thử lại sau giây lát.';
    } else if (response.status === 503 || serverCode === 'AI_NOT_CONFIGURED') {
      err.code = 'AI_NOT_CONFIGURED';
      err.message = serverMessage || 'Dịch vụ AI Vision chưa được kích hoạt trên máy chủ (Thiếu API Key).';
    } else if (serverCode === 'INVALID_AI_SPEC') {
      err.code = 'INVALID_AI_SPEC';
      err.message = serverMessage || 'Dữ liệu logic do AI sinh không đúng định dạng chuẩn.';
    } else if (serverCode === 'NO_FILE') {
      err.code = 'NO_FILE';
    } else {
      err.code = serverCode || `HTTP_${response.status}`;
    }

    err.status = response.status;
    err.rawResponse = errorJson || rawText;
    throw err;
  }

  // 5. Parse JSON response
  let jsonResult;
  try {
    jsonResult = await response.json();
  } catch (parseErr) {
    const err = new Error('Máy chủ trả về phản hồi không phải định dạng JSON hợp lệ.');
    err.code = 'MALFORMED_RESPONSE';
    throw err;
  }

  if (!jsonResult || !jsonResult.success || !jsonResult.data) {
    const err = new Error(jsonResult?.message || 'Phản hồi từ máy chủ không hợp lệ.');
    err.code = jsonResult?.error || 'INVALID_RESPONSE';
    throw err;
  }

  // 6. Normalize and validate result according to requested mode
  if (mode === 'quiz') {
    return normalizeQuizResult(jsonResult.data);
  }
  return normalizeExpressionResult(jsonResult.data);
}
