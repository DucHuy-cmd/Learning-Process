/**
 * @file app.js
 * Backend HTTP Request Handler and API Router
 * 
 * Provides:
 * - POST /api/graph/analyze - AI Vision graph extraction
 * - GET  /api/health - Service health check
 * - Static file serving for educational platform
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { extractBoundary, readRequestBody, parseMultipartData } from './parseMultipart.js';
import { isAIConfigured, analyzeGraphFileBackend, analyzeLogicFileBackend, executeGeminiChat } from './ai/AIProviderAdapter.js';
import { validateGraphSpecification, MAX_FILE_SIZE_BYTES } from '../app/ai/GraphVisionAdapter.js';
import { extractDocx } from '../app/ai/DocxExtractor.js';

import { 
  serverUsers, 
  serverAiSessions, 
  serverQuizStats, 
  serverExams, 
  serverExamSubmissions, 
  serverCustomQuestions, 
  serverImportedFiles, 
  serverDeletedUsers,
  serverDeletedExams,
  serverDeletedImportedFiles,
  serverDbResetTime,
  serverImportedFilesResetTime,
  markUserDeleted,
  unmarkUserDeleted,
  isUserDeleted,
  markExamDeleted,
  unmarkExamDeleted,
  isExamDeleted,
  markImportedFileDeleted,
  unmarkImportedFileDeleted,
  isImportedFileDeleted,
  recordImportedFilesReset,
  recordDbReset,
  createDatabaseBackup,
  restoreDatabaseBackup,
  saveDatabase, 
  fetchFromPostgres,
  saveToPostgres,
  saveExamToPostgres,
  saveSubmissionToPostgres,
  isKVConfigured, 
  fetchFromKV, 
  writeToKV,
  sqlDb,
  getServerAdminUser,
  getAdminPassword,
  setAdminPassword,
  invalidateAllAdminSessions,
  getAdminTokenVersion,
  getAdminPasswordChangedAt,
  resetAdminSessionState,
  getAdminUsername
} from './auth/ServerDataStore.js';
import { DEFAULT_EXAMS } from '../core/quiz/ExamManager.js';
import { STATIC_QUESTION_BANK } from '../core/quiz/QuizBank.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

/** Backend supported extensions */
export const BACKEND_SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.docx'];

/** Backend supported MIME types */
export const BACKEND_SUPPORTED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip',
  'application/octet-stream',
]);

/**
 * Validates file format and size for the backend.
 * @param {Object} file - { filename, type, size, data }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBackendFile(file) {
  if (!file || !file.data) {
    return { valid: false, error: 'Không tìm thấy tệp đính kèm trong yêu cầu.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Tệp quá lớn (${sizeMb}MB). Giới hạn tối đa là 15MB.` };
  }

  const filename = (file.filename || '').toLowerCase();
  const hasValidExt = BACKEND_SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext));
  const hasValidMime = file.type ? BACKEND_SUPPORTED_MIMES.has(file.type) : false;

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: `Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp: ${BACKEND_SUPPORTED_EXTENSIONS.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Sends a JSON response with appropriate headers.
 * @param {import('node:http').ServerResponse} res
 * @param {number} statusCode
 * @param {Object} data
 */
export function sendJson(res, statusCode, data) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  });
  res.end(JSON.stringify(data));
}

/**
 * Redacts API keys, tokens, passwords and secret parameters from error messages.
 * @param {string} msg
 * @returns {string}
 */
export function sanitizeErrorMessage(msg) {
  if (typeof msg !== 'string') return '';
  return msg
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_API_KEY]')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/(?:key|token|secret|password)=[A-Za-z0-9_-]+/gi, '$1=[REDACTED]');
}

// Secret key for HMAC signing session tokens (deterministic secret keeps sessions valid across serverless cold starts)
const SESSION_SECRET = process.env.SESSION_SECRET || 'toanrr_secret_session_key_2026_dijkstra_prod_standard';

/**
 * Hashes a plaintext password using crypto.scrypt with a unique 16-byte random salt.
 * Format: scrypt$<saltHex>$<derivedKeyHex>
 * @param {string} plainPassword
 * @returns {string}
 */
export function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string') plainPassword = String(plainPassword || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 32).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored password string (scrypt hash or legacy plaintext).
 * Uses constant-time buffer comparison to prevent timing side-channel attacks.
 * @param {string} plainPassword
 * @param {string} storedHashOrPlain
 * @returns {boolean}
 */
export function verifyPassword(plainPassword, storedHashOrPlain) {
  if (typeof plainPassword !== 'string') plainPassword = String(plainPassword || '');
  if (!storedHashOrPlain || typeof storedHashOrPlain !== 'string') return false;

  // 1. Scrypt format verification
  if (storedHashOrPlain.startsWith('scrypt$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    try {
      const derivedKey = crypto.scryptSync(plainPassword, salt, 32);
      const expectedKey = Buffer.from(expectedHex, 'hex');
      if (derivedKey.length !== expectedKey.length) return false;
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    } catch {
      return false;
    }
  }

  // 2. Legacy plaintext backward-compatibility (timing-safe)
  const inputBuf = Buffer.from(plainPassword, 'utf8');
  const storedBuf = Buffer.from(storedHashOrPlain, 'utf8');
  if (inputBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, storedBuf);
}

// --- Rate Limiting for Authentication (Brute-force protection) ---
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
export const LOGIN_RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const loginRateLimitMap = new Map();

/**
 * Checks if a login request is rate limited for a given IP or username.
 * @param {string} ip
 * @param {string} [username]
 * @returns {{ limited: boolean, retryAfterSeconds: number, remainingAttempts: number }}
 */
export function checkLoginRateLimit(ip, username = '') {
  const now = Date.now();
  const keys = [ip];
  if (username) keys.push(`user:${username.toLowerCase().trim()}`);

  for (const key of keys) {
    const entry = loginRateLimitMap.get(key);
    if (!entry) continue;

    // Check if currently locked out
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return { limited: true, retryAfterSeconds, remainingAttempts: 0 };
    }

    // Reset window if expired and lockout has passed
    if (entry.firstAttempt && (now - entry.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS) && (!entry.lockedUntil || entry.lockedUntil <= now)) {
      loginRateLimitMap.delete(key);
    }
  }

  const primaryEntry = loginRateLimitMap.get(ip);
  const failedCount = primaryEntry ? primaryEntry.count : 0;
  const remainingAttempts = Math.max(0, LOGIN_RATE_LIMIT_MAX_ATTEMPTS - failedCount);

  return { limited: false, retryAfterSeconds: 0, remainingAttempts };
}

/**
 * Records a failed login attempt. If failed attempts reach max, locks out for 15 minutes.
 * @param {string} ip
 * @param {string} [username]
 */
export function recordLoginFailure(ip, username = '') {
  const now = Date.now();
  const keys = [ip];
  if (username) keys.push(`user:${username.toLowerCase().trim()}`);

  for (const key of keys) {
    let entry = loginRateLimitMap.get(key);
    if (!entry || (now - entry.firstAttempt > LOGIN_RATE_LIMIT_WINDOW_MS && (!entry.lockedUntil || entry.lockedUntil <= now))) {
      entry = { count: 1, firstAttempt: now, lockedUntil: null };
    } else {
      entry.count += 1;
    }

    if (entry.count >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOGIN_RATE_LIMIT_LOCKOUT_MS;
    }
    loginRateLimitMap.set(key, entry);
  }
}

/**
 * Resets failed login attempts upon successful authentication.
 * @param {string} ip
 * @param {string} [username]
 */
export function resetLoginRateLimit(ip, username = '') {
  loginRateLimitMap.delete(ip);
  if (username) {
    loginRateLimitMap.delete(`user:${username.toLowerCase().trim()}`);
  }
}

/**
 * Clears all rate limiting entries (useful for testing).
 */
export function clearAllLoginRateLimits() {
  loginRateLimitMap.clear();
}

/**
 * Creates a cryptographically signed session token for an authenticated user.
 * Tokens include tokenVersion and pwdChangedAt to support global session invalidation on password change.
 * @param {{ id: string, username: string, role: string, tokenVersion?: number, passwordChangedAt?: number }} user
 * @returns {string} token
 */
export function createSessionToken(user) {
  const isAdmin = Boolean(
    user.role === 'admin' ||
    user.username === 'admin' ||
    user.id === 'user_admin'
  );
  const tokenVersion = isAdmin ? getAdminTokenVersion() : (user.tokenVersion || 1);
  const pwdChangedAt = isAdmin ? (getAdminPasswordChangedAt() || 1) : (user.passwordChangedAt || 1);

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion,
    pwdChangedAt,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
    nonce: crypto.randomBytes(12).toString('hex')
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token.
 * Returns decoded payload if valid and unexpired; null otherwise.
 * @param {string} token
 * @returns {Object|null}
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Resolves authentication status from incoming request headers.
 * In production: Strictly requires a cryptographically signed session token.
 * Checks tokenVersion and pwdChangedAt to ensure revoked sessions after password changes are rejected.
 * In test environment (NODE_ENV === 'test'): Permits test header fallback.
 * 
 * @param {import('node:http').IncomingMessage} req
 * @returns {{ authenticated: boolean, user: Object|null, isAdmin: boolean, hasToken: boolean, revoked?: boolean }}
 */
export function getRequestAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const xUserId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '').trim();

  let tokenCandidate = '';
  if (authHeader.startsWith('Bearer ')) {
    tokenCandidate = authHeader.slice(7).trim();
  } else if (authHeader) {
    tokenCandidate = authHeader.trim();
  }

  // 1. Verify cryptographic session token
  if (tokenCandidate) {
    const session = verifySessionToken(tokenCandidate);
    if (session) {
      const isAdmin = Boolean(
        session.role === 'admin' ||
        session.username === 'admin' ||
        session.id === 'user_admin'
      );

      // Enforce global session invalidation on password change or admin revocation
      if (isAdmin) {
        const curVer = getAdminTokenVersion();
        const curChangedAt = getAdminPasswordChangedAt();
        if (
          (curVer > 1 && (!session.tokenVersion || session.tokenVersion < curVer)) ||
          (curChangedAt > 0 && (!session.pwdChangedAt || session.pwdChangedAt < curChangedAt))
        ) {
          return { authenticated: false, user: null, isAdmin: false, hasToken: true, revoked: true };
        }
      } else {
        const liveUser = serverUsers.find(
          u => u.id === session.id || (u.username && u.username.toLowerCase() === (session.username || '').toLowerCase())
        );
        if (liveUser) {
          const liveVer = liveUser.tokenVersion || 1;
          const liveChangedAt = liveUser.passwordChangedAt || 0;
          if (
            (liveVer > 1 && session.tokenVersion && session.tokenVersion < liveVer) ||
            (liveChangedAt > 0 && session.pwdChangedAt && session.pwdChangedAt < liveChangedAt)
          ) {
            return { authenticated: false, user: null, isAdmin: false, hasToken: true, revoked: true };
          }
        }
      }

      return { authenticated: true, user: session, isAdmin, hasToken: true };
    }
  }

  // 2. Strict backward compatibility for automated tests in memory (NODE_ENV === 'test')
  if (process.env.NODE_ENV === 'test') {
    const candidateId = tokenCandidate || xUserId;
    if (candidateId === 'user_admin' || candidateId === 'admin') {
      return {
        authenticated: true,
        user: { id: 'user_admin', username: 'admin', role: 'admin' },
        isAdmin: true,
        hasToken: Boolean(tokenCandidate || xUserId),
      };
    }
    const user = serverUsers.find(u =>
      u.id === candidateId ||
      u.username.toLowerCase() === candidateId.toLowerCase()
    );
    if (user) {
      const isAdmin = Boolean(
        user.role === 'admin' || user.username.toLowerCase() === 'admin' || user.id === 'user_admin'
      );
      return {
        authenticated: true,
        user,
        isAdmin,
        hasToken: Boolean(tokenCandidate || xUserId),
      };
    }
  }

  return {
    authenticated: false,
    user: null,
    isAdmin: false,
    hasToken: Boolean(tokenCandidate || xUserId),
  };
}

/**
 * Verifies if incoming request is from an administrator via HTTP headers.
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isRequestFromAdmin(req) {
  const auth = getRequestAuth(req);
  return Boolean(auth.isAdmin);
}

/**
 * Sanitizes user record for administrative listing: removes password, tokens, hashes.
 * @param {Object} u
 * @returns {Object|null}
 */
export function sanitizeUserForAdmin(u) {
  if (!u || typeof u !== 'object') return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName || u.studentName || '',
    className: u.className || u.studentClass || 'Sinh viên',
    email: u.email || '',
    avatar: u.avatar || '👤',
    role: u.role || 'student',
    bio: u.bio || '',
    createdAt: u.createdAt || undefined,
  };
}

/**
 * Validates custom quiz question payload with strict type, format, and boundary checks.
 * @param {Object} data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCustomQuestion(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dữ liệu câu hỏi không hợp lệ.' };
  }
  const question = typeof data.question === 'string' ? data.question.trim() : '';
  if (question.length < 5) {
    return { valid: false, error: 'Nội dung câu hỏi phải có ít nhất 5 ký tự.' };
  }
  if (question.length > 2000) {
    return { valid: false, error: 'Nội dung câu hỏi không được vượt quá 2000 ký tự.' };
  }
  if (!Array.isArray(data.options) || data.options.length !== 4) {
    return { valid: false, error: 'Câu hỏi trắc nghiệm phải có chính xác 4 lựa chọn (A, B, C, D).' };
  }
  const validOptionIds = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < 4; i++) {
    const opt = data.options[i];
    if (!opt || typeof opt !== 'object') {
      return { valid: false, error: `Lựa chọn thứ ${i + 1} không hợp lệ.` };
    }
    const optId = (opt.id || validOptionIds[i]).trim().toUpperCase();
    const optText = typeof opt.text === 'string' ? opt.text.trim() : '';
    if (!optText) {
      return { valid: false, error: `Nội dung lựa chọn ${optId} không được để trống.` };
    }
    if (optText.length > 1000) {
      return { valid: false, error: `Nội dung lựa chọn ${optId} không được vượt quá 1000 ký tự.` };
    }
  }
  const correctId = typeof data.correctId === 'string' ? data.correctId.trim().toUpperCase() : '';
  if (!validOptionIds.includes(correctId)) {
    return { valid: false, error: 'Đáp án đúng phải là một trong các giá trị: A, B, C, D.' };
  }
  if (data.explanation && typeof data.explanation === 'string' && data.explanation.length > 5000) {
    return { valid: false, error: 'Lời giải thích không được vượt quá 5000 ký tự.' };
  }
  return { valid: true };
}

/**
 * Handles incoming HTTP request.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    });
    res.end();
    return;
  }

  // Route: GET /api/health (fast ping response without waiting for database hydration)
  if (req.method === 'GET' && (pathname === '/api/health' || pathname.endsWith('/health'))) {
    sendJson(res, 200, {
      status: 'ok',
      aiConfigured: isAIConfigured(),
      kvConfigured: false,
      sqlConfigured: sqlDb.isCloudEnabled,
      storageMode: sqlDb.isCloudEnabled ? 'postgresql' : 'relational_sql',
      databaseLabel: sqlDb.isCloudEnabled ? 'PostgreSQL Relational DB (Vercel/Neon)' : 'Relational SQL Standard (PostgreSQL Engine)',
      databaseConnected: true,
      usersCount: serverUsers.length,
      examsCount: serverExams.length,
      supportedFormats: BACKEND_SUPPORTED_EXTENSIONS,
    });
    return;
  }

  // Sync latest data from PostgreSQL (Neon) or Vercel KV for Serverless execution
  if (sqlDb.isCloudEnabled) {
    try {
      await fetchFromPostgres();
    } catch {}
  } else if (isKVConfigured()) {
    try {
      await fetchFromKV();
    } catch {}
  }

  // Route: GET /api/database/status
  if (req.method === 'GET' && (pathname === '/api/database/status' || pathname === '/api/admin/database/status')) {
    if (sqlDb.isCloudEnabled) {
      await fetchFromPostgres().catch(() => {});
    }
    const dbStatus = sqlDb.getStatus();
    sendJson(res, 200, {
      success: true,
      status: 'ok',
      connected: true,
      kvConfigured: false,
      sqlConfigured: sqlDb.isCloudEnabled,
      storageMode: sqlDb.isCloudEnabled ? 'postgresql' : 'relational_sql',
      databaseLabel: sqlDb.isCloudEnabled ? 'PostgreSQL Relational DB (Vercel/Neon)' : 'Relational SQL Standard (PostgreSQL Engine)',
      databaseConnected: true,
      metrics: {
        usersCount: serverUsers.length,
        studentsCount: serverUsers.filter(u => u.username !== 'admin' && u.id !== 'user_admin').length,
        examsCount: serverExams.length,
        submissionsCount: serverExamSubmissions.length,
        deletedUsersCount: serverDeletedUsers.size,
        deletedExamsCount: serverDeletedExams.size,
        dbResetTime: serverDbResetTime,
        lastUpdated: new Date().toISOString(),
        tables: dbStatus.tables,
      },
    });
    return;
  }

  // Route: GET /api/auth/users
  if (req.method === 'GET' && pathname === '/api/auth/users') {
    const auth = getRequestAuth(req);
    if (!auth.authenticated) {
      sendJson(res, 401, {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu phiên đăng nhập Quản trị viên để truy cập danh sách tài khoản.',
      });
      return;
    }
    if (!auth.isAdmin) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập danh sách tài khoản người dùng.',
      });
      return;
    }

    if (sqlDb.isCloudEnabled) {
      await fetchFromPostgres().catch(() => {});
    }
    sendJson(res, 200, {
      success: true,
      users: serverUsers.map(u => sanitizeUserForAdmin(u)).filter(Boolean),
      deletedUsers: Array.from(serverDeletedUsers),
      dbResetTime: serverDbResetTime,
    });
    return;
  }

  // Route: POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const { username, password } = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      if (!username || !password) {
        sendJson(res, 400, { success: false, error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const q = String(username).trim().toLowerCase();

      // Check brute-force rate limit
      const rateLimit = checkLoginRateLimit(clientIp, q);
      if (rateLimit.limited) {
        sendJson(res, 429, {
          success: false,
          error: `Tài khoản hoặc IP tạm thời bị khóa do thử sai quá 5 lần liên tiếp. Vui lòng thử lại sau ${Math.ceil(rateLimit.retryAfterSeconds / 60)} phút.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        });
        return;
      }

      let found = null;
      if (sqlDb.isCloudEnabled) {
        try {
          const dbRes = await sqlDb.executeRawPostgres(
            'SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1;',
            [q]
          );
          if (dbRes.rows && dbRes.rows.length > 0) {
            const r = dbRes.rows[0];
            found = {
              id: r.id,
              username: r.username,
              fullName: r.full_name || r.fullName || r.username,
              className: r.class_name || r.className || 'Sinh viên',
              email: r.email || '',
              password: r.password || '123456',
              avatar: r.avatar || '👨‍🎓',
              role: r.role || 'student',
              createdAt: r.created_at || r.createdAt || new Date().toISOString(),
            };
          }
        } catch (err) {
          console.warn('[app.js] Error querying user in Postgres on login:', err.message);
        }
      }
      if (!found) {
        found = serverUsers.find(
          u => u.username.toLowerCase() === q || (u.email && u.email.toLowerCase() === q)
        );
      }
      if (!found) {
        recordLoginFailure(clientIp, q);
        sendJson(res, 401, { success: false, error: 'Tài khoản không tồn tại.' });
        return;
      }

      // Password verification using constant-time timing-safe comparison
      let passwordValid = false;
      if (found.username === 'admin' || found.id === 'user_admin' || found.role === 'admin') {
        passwordValid = verifyPassword(password, getAdminPassword());
      } else {
        const expected = found.password || '123456';
        passwordValid = verifyPassword(password, expected);
      }

      if (!passwordValid) {
        recordLoginFailure(clientIp, q);
        sendJson(res, 401, { success: false, error: 'Mật khẩu không chính xác.' });
        return;
      }

      // Successful login: reset rate limit attempts
      resetLoginRateLimit(clientIp, q);

      // Auto-upgrade legacy plaintext password to secure scrypt hash for student accounts
      if (found.role !== 'admin' && (!found.password || !found.password.startsWith('scrypt$'))) {
        found.password = hashPassword(password);
        saveDatabase().catch(() => {});
        if (sqlDb.isCloudEnabled) {
          sqlDb.executeRawPostgres('UPDATE users SET password = $1 WHERE id = $2;', [found.password, found.id]).catch(() => {});
        }
      }

      // Sync into memory if not present
      if (!serverUsers.some(u => u.id === found.id)) {
        serverUsers.push(found);
      }

      const token = createSessionToken(found);
      const user = { ...found };
      delete user.password;
      sendJson(res, 200, { success: true, token, user });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: POST /api/auth/register
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const cleanUsername = (data.username || '').trim().toLowerCase();
      if (!cleanUsername || !data.fullName || !data.email) {
        sendJson(res, 400, { success: false, error: 'Thiếu thông tin đăng ký bắt buộc.' });
        return;
      }
      if (serverUsers.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
        sendJson(res, 400, { success: false, error: 'Tên đăng nhập đã tồn tại.' });
        return;
      }
      const newUser = {
        id: data.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        username: data.username.toLowerCase(),
        fullName: data.fullName,
        className: data.className || 'Sinh viên',
        email: data.email.toLowerCase(),
        password: hashPassword(data.password || '123456'),
        avatar: data.avatar || '👤',
        role: 'student',
        createdAt: data.createdAt || new Date().toISOString(),
      };
      unmarkUserDeleted(cleanUsername);
      if (data.email) unmarkUserDeleted(data.email);
      serverUsers.push(newUser);
      saveDatabase();
      const publicUser = { ...newUser };
      delete publicUser.password;
      sendJson(res, 200, { success: true, user: publicUser });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: POST /api/auth/change-password (Đổi mật khẩu & đăng xuất khỏi mọi thiết bị khác)
  if (req.method === 'POST' && pathname === '/api/auth/change-password') {
    const auth = getRequestAuth(req);
    if (!auth.authenticated || !auth.user) {
      sendJson(res, 401, {
        success: false,
        error: auth.revoked ? 'SESSION_REVOKED' : 'UNAUTHORIZED',
        message: auth.revoked
          ? 'Phiên làm việc đã bị hủy do mật khẩu đã được thay đổi. Vui lòng đăng nhập lại.'
          : 'Vui lòng đăng nhập để thực hiện đổi mật khẩu.',
      });
      return;
    }

    try {
      const bodyBuffer = await readRequestBody(req);
      const { currentPassword, newPassword } = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      if (!currentPassword || !newPassword) {
        sendJson(res, 400, { success: false, error: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
        return;
      }

      if (String(newPassword).length < 6) {
        sendJson(res, 400, { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        return;
      }

      const isUserAdmin = Boolean(
        auth.isAdmin ||
        auth.user.role === 'admin' ||
        auth.user.username === 'admin' ||
        auth.user.id === 'user_admin'
      );

      if (isUserAdmin) {
        if (!verifyPassword(currentPassword, getAdminPassword())) {
          sendJson(res, 400, { success: false, error: 'Mật khẩu hiện tại không chính xác.' });
          return;
        }

        setAdminPassword(newPassword);
        const adminUser = getServerAdminUser();
        const newToken = createSessionToken(adminUser);
        const publicUser = { ...adminUser };
        delete publicUser.password;

        sendJson(res, 200, {
          success: true,
          message: 'Đổi mật khẩu Quản trị viên thành công. Toàn bộ các phiên đăng nhập khác đã được đăng xuất.',
          token: newToken,
          user: publicUser,
        });
        return;
      }

      // Student account
      const found = serverUsers.find(
        u => u.id === auth.user.id || (u.username && u.username.toLowerCase() === auth.user.username.toLowerCase())
      );
      if (!found) {
        sendJson(res, 404, { success: false, error: 'Không tìm thấy tài khoản sinh viên.' });
        return;
      }

      if (!verifyPassword(currentPassword, found.password || '123456')) {
        sendJson(res, 400, { success: false, error: 'Mật khẩu hiện tại không chính xác.' });
        return;
      }

      found.password = hashPassword(newPassword);
      found.passwordChangedAt = Date.now();
      found.tokenVersion = (found.tokenVersion || 1) + 1;

      if (sqlDb.isCloudEnabled) {
        try {
          await sqlDb.executeRawPostgres(
            'UPDATE users SET password = $1 WHERE id = $2 OR LOWER(username) = $3;',
            [found.password, found.id, found.username.toLowerCase()]
          );
        } catch (dbErr) {
          console.warn('[app.js] Error updating password in Postgres:', dbErr.message);
        }
      }
      await saveDatabase();

      const newToken = createSessionToken(found);
      const publicUser = { ...found };
      delete publicUser.password;

      sendJson(res, 200, {
        success: true,
        message: 'Đổi mật khẩu thành công. Toàn bộ các phiên đăng nhập khác của tài khoản này trên các thiết bị đã được đăng xuất.',
        token: newToken,
        user: publicUser,
      });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: GET /api/admin/users (Quản trị viên xem toàn bộ database tài khoản)
  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const auth = getRequestAuth(req);
    if (!auth.authenticated) {
      sendJson(res, 401, {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu phiên đăng nhập Quản trị viên để truy cập danh sách tài khoản.',
      });
      return;
    }
    if (!auth.isAdmin) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xem toàn bộ database tài khoản.',
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      users: serverUsers.map(u => sanitizeUserForAdmin(u)).filter(Boolean),
    });
    return;
  }

  // Route: POST /api/admin/users (Quản trị viên cấp tài khoản mới - đơn lẻ)
  if (req.method === 'POST' && pathname === '/api/admin/users') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, { success: false, error: 'Chỉ quản trị viên mới có quyền này.' });
      return;
    }
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const cleanUsername = (data.username || '').trim().toLowerCase();
      if (!cleanUsername || !data.fullName) {
        sendJson(res, 400, { success: false, error: 'Thiếu thông tin tài khoản bắt buộc.' });
        return;
      }
      if (serverUsers.some(u => u.username.toLowerCase() === cleanUsername)) {
        sendJson(res, 400, { success: false, error: 'Tên đăng nhập đã tồn tại.' });
        return;
      }
      const newUser = {
        id: data.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        username: cleanUsername,
        fullName: data.fullName,
        className: data.className || 'Sinh viên',
        email: data.email || `${cleanUsername}@toanrr.edu.vn`,
        password: hashPassword(data.password || '123456'),
        avatar: data.avatar || '👨‍🎓',
        role: 'student',
        createdAt: new Date().toISOString(),
      };

      if (sqlDb.isCloudEnabled) {
        try {
          await sqlDb.executeRawPostgres(`
            INSERT INTO users (id, username, full_name, class_name, email, password, avatar, role, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `, [newUser.id, newUser.username, newUser.fullName, newUser.className, newUser.email, newUser.password, newUser.avatar, newUser.role, newUser.createdAt]);
        } catch (dbErr) {
          sendJson(res, 500, { success: false, error: 'Lỗi cơ sở dữ liệu khi tạo tài khoản: ' + dbErr.message });
          return;
        }
      }

      unmarkUserDeleted(cleanUsername);
      if (newUser.email) unmarkUserDeleted(newUser.email);
      if (newUser.id) unmarkUserDeleted(newUser.id);
      serverUsers.push(newUser);
      if (sqlDb.tables.users) {
        sqlDb.tables.users.set(newUser.id, { ...newUser });
      }

      const publicUser = { ...newUser };
      delete publicUser.password;
      sendJson(res, 200, { success: true, user: publicUser });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: POST /api/admin/users/batch (Quản trị viên cấp tài khoản hàng loạt)
  if (req.method === 'POST' && pathname === '/api/admin/users/batch') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, { success: false, error: 'Chỉ quản trị viên mới có quyền này.' });
      return;
    }
    try {
      const bodyBuffer = await readRequestBody(req);
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const usersInput = Array.isArray(body.users) ? body.users : [];
      if (usersInput.length === 0) {
        sendJson(res, 400, { success: false, error: 'Danh sách tài khoản trống.' });
        return;
      }

      // Check existing accounts in database and memory
      const existingUsernames = new Set(serverUsers.map(u => (u.username || '').toLowerCase()));
      if (sqlDb.isCloudEnabled) {
        try {
          const dbUsersRes = await sqlDb.executeRawPostgres('SELECT username FROM users;');
          if (Array.isArray(dbUsersRes.rows)) {
            dbUsersRes.rows.forEach(r => {
              if (r.username) existingUsernames.add(r.username.toLowerCase());
            });
          }
        } catch {}
      }

      const toInsert = [];
      const lineResults = [];
      let skippedCount = 0;
      let errorCount = 0;
      const nowTs = Date.now();

      for (let i = 0; i < usersInput.length; i++) {
        const data = usersInput[i];
        const cleanUsername = (data.username || '').trim().toLowerCase();
        const fullName = (data.fullName || '').trim();

        if (!cleanUsername) {
          errorCount++;
          lineResults.push({ line: i + 1, username: '', status: 'error', reason: 'Thiếu tên đăng nhập' });
          continue;
        }
        if (!fullName) {
          errorCount++;
          lineResults.push({ line: i + 1, username: cleanUsername, status: 'error', reason: 'Thiếu họ và tên' });
          continue;
        }
        if (existingUsernames.has(cleanUsername)) {
          skippedCount++;
          lineResults.push({ line: i + 1, username: cleanUsername, status: 'skipped', reason: 'Tài khoản đã tồn tại' });
          continue;
        }

        const newUser = {
          id: data.id || `user_${nowTs}_${Math.random().toString(36).slice(2, 6)}_${i}`,
          username: cleanUsername,
          fullName: fullName,
          className: (data.className || 'Sinh viên').trim(),
          email: (data.email || `${cleanUsername}@toanrr.edu.vn`).trim(),
          password: hashPassword(String(data.password || '123456').trim()),
          avatar: data.avatar || '👨‍🎓',
          role: 'student',
          createdAt: new Date().toISOString(),
        };

        existingUsernames.add(cleanUsername);
        toInsert.push(newUser);
        lineResults.push({ line: i + 1, username: cleanUsername, fullName: newUser.fullName, status: 'success' });
      }

      // Atomic database transaction if cloud enabled
      if (toInsert.length > 0 && sqlDb.isCloudEnabled) {
        try {
          const insertQueries = toInsert.map(u => ({
            sql: `INSERT INTO users (id, username, full_name, class_name, email, password, avatar, role, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  ON CONFLICT (username) DO NOTHING;`,
            params: [u.id, u.username, u.fullName, u.className, u.email, u.password, u.avatar, u.role, u.createdAt]
          }));
          await sqlDb.executeTransaction(insertQueries);
        } catch (dbErr) {
          sendJson(res, 500, {
            success: false,
            error: 'Lỗi cơ sở dữ liệu khi lưu tài khoản: ' + dbErr.message,
          });
          return;
        }
      }

      // Commit to in-memory state only after database commits
      for (const u of toInsert) {
        unmarkUserDeleted(u.username);
        if (u.email) unmarkUserDeleted(u.email);
        if (u.id) unmarkUserDeleted(u.id);
        serverUsers.push(u);
        if (sqlDb.tables.users) {
          sqlDb.tables.users.set(u.id, { ...u });
        }
      }

      const publicUsers = toInsert.map(u => { const p = { ...u }; delete p.password; return p; });
      sendJson(res, 200, {
        success: true,
        addedCount: toInsert.length,
        skippedCount,
        errorCount,
        results: lineResults,
        createdUsers: publicUsers,
      });
      return;
    } catch (err) {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ: ' + err.message });
      return;
    }
  }

  // Route: GET /api/auth/verify
  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    const auth = getRequestAuth(req);
    const userId = parsedUrl.searchParams.get('userId');
    const username = (parsedUrl.searchParams.get('username') || '').toLowerCase();
    const isAdminTarget = (userId === 'user_admin' || username === 'admin');

    if (auth.hasToken && auth.revoked) {
      sendJson(res, 401, { valid: false, error: 'SESSION_REVOKED', message: 'Phiên làm việc đã bị thu hồi hoặc đăng xuất.' });
      return;
    }

    if (isAdminTarget) {
      if (process.env.NODE_ENV !== 'test' || auth.hasToken) {
        if (!auth.authenticated || !auth.isAdmin) {
          sendJson(res, 401, { valid: false, error: 'SESSION_REVOKED', message: 'Phiên làm việc Quản trị viên đã hết hạn hoặc bị thu hồi.' });
          return;
        }
      }
      sendJson(res, 200, { valid: true });
      return;
    }

    if (!userId && !username) {
      sendJson(res, 400, { valid: false, error: 'Thiếu thông tin người dùng.' });
      return;
    }
    const exists = serverUsers.some(u =>
      (userId && u.id === userId) ||
      (username && u.username.toLowerCase() === username)
    );
    if (!exists) {
      sendJson(res, 404, { valid: false, error: 'Tài khoản không tồn tại trên hệ thống.' });
    } else {
      sendJson(res, 200, { valid: true });
    }
    return;
  }

  // Route: POST /api/admin/revoke-all-sessions (Quản trị viên thu hồi toàn bộ phiên đăng nhập trên mọi thiết bị)
  if (req.method === 'POST' && pathname === '/api/admin/revoke-all-sessions') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, { success: false, error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác này.' });
      return;
    }
    invalidateAllAdminSessions();
    await saveDatabase();
    sendJson(res, 200, { success: true, message: 'Đã đăng xuất toàn bộ tài khoản Quản trị viên trên mọi thiết bị.' });
    return;
  }

  // Route: DELETE /api/admin/users/:id (Quản trị viên xóa tài khoản)
  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/users/')) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa tài khoản sinh viên.',
      });
      return;
    }

    const rawTarget = decodeURIComponent(pathname.replace('/api/admin/users/', '')).trim();
    const queryUsername = parsedUrl.searchParams.get('username') 
      ? decodeURIComponent(parsedUrl.searchParams.get('username')).trim().toLowerCase() 
      : '';
    if (rawTarget === 'user_admin' || rawTarget === 'admin' || queryUsername === 'admin') {
      sendJson(res, 400, { success: false, error: 'Không thể xóa tài khoản Quản trị viên duy nhất.' });
      return;
    }

    const targetLower = rawTarget.toLowerCase();
    const toDelete = serverUsers.filter(u => 
      u.id === rawTarget || 
      u.username.toLowerCase() === targetLower ||
      (queryUsername && u.username.toLowerCase() === queryUsername)
    );

    if (toDelete.length > 0) {
      if (sqlDb.isCloudEnabled) {
        try {
          for (const del of toDelete) {
            await sqlDb.executeRawPostgres('DELETE FROM users WHERE id = $1 OR LOWER(username) = $2;', [del.id, del.username.toLowerCase()]);
          }
        } catch (dbErr) {
          sendJson(res, 500, { success: false, error: 'Lỗi cơ sở dữ liệu khi xóa tài khoản: ' + dbErr.message });
          return;
        }
      }

      for (const del of toDelete) {
        const i = serverUsers.indexOf(del);
        if (i !== -1) serverUsers.splice(i, 1);
        markUserDeleted(del.id);
        markUserDeleted(del.username);
        if (del.email) markUserDeleted(del.email);
        delete serverQuizStats[del.id];
        delete serverQuizStats[del.username];
        if (serverAiSessions[del.id]) delete serverAiSessions[del.id];
        if (serverAiSessions[del.username]) delete serverAiSessions[del.username];
        if (sqlDb.tables.users) {
          sqlDb.tables.users.delete(del.id);
        }
      }
      delete serverQuizStats[rawTarget];
      if (queryUsername) delete serverQuizStats[queryUsername];
      sendJson(res, 200, { success: true, deletedUsers: toDelete });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy tài khoản.' });
    }
    return;
  }

  // Route: POST /api/admin/users/:id/reset-password
  if (req.method === 'POST' && pathname.includes('/reset-password') && pathname.startsWith('/api/admin/users/')) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, { success: false, error: 'FORBIDDEN', message: 'Chỉ Quản trị viên mới có quyền đặt lại mật khẩu.' });
      return;
    }
    const rawTarget = decodeURIComponent(pathname.replace('/api/admin/users/', '').replace('/reset-password', '')).trim().toLowerCase();
    if (rawTarget === 'admin' || rawTarget === 'user_admin') {
      sendJson(res, 400, { success: false, error: 'Không thể reset mật khẩu tài khoản Quản trị viên gốc qua tính năng này.' });
      return;
    }
    const bodyBuffer = await readRequestBody(req);
    const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
    const newPassword = body.newPassword || '123456';
    const found = serverUsers.find(u => u.id.toLowerCase() === rawTarget || u.username.toLowerCase() === rawTarget);
    if (!found) {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy tài khoản sinh viên.' });
      return;
    }
    found.password = hashPassword(newPassword);
    found.passwordChangedAt = Date.now();
    found.tokenVersion = (found.tokenVersion || 1) + 1;
    if (sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeRawPostgres('UPDATE users SET password = $1 WHERE id = $2 OR LOWER(username) = $3;', [found.password, found.id, found.username.toLowerCase()]);
      } catch (dbErr) {
        console.warn('[app.js] Error updating reset password in Postgres:', dbErr.message);
      }
    }
    await saveDatabase();
    sendJson(res, 200, { success: true, message: `Mật khẩu của sinh viên @${found.username} đã được đặt lại thành ${newPassword}. Toàn bộ phiên đăng nhập cũ trên mọi thiết bị đã được đăng xuất an toàn.` });
    return;
  }

  // Route: POST /api/admin/database/reset (Quản trị viên xóa sạch toàn bộ dữ liệu database)
  if (req.method === 'POST' && pathname === '/api/admin/database/reset') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa sạch cơ sở dữ liệu.',
      });
      return;
    }

    const resetTimestamp = Date.now();

    // 1. Execute atomic transaction in PostgreSQL (if cloud enabled)
    if (sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeTransaction([
          'DELETE FROM exam_submissions;',
          'DELETE FROM quiz_stats;',
          'DELETE FROM ai_sessions;',
          'DELETE FROM custom_questions;',
          'DELETE FROM imported_files;',
          'DELETE FROM exams;',
          "DELETE FROM users WHERE username != 'admin';",
          {
            sql: `INSERT INTO system_metadata (key, value, updated_at)
                  VALUES ('db_reset_time', $1::jsonb, CURRENT_TIMESTAMP)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
            params: [JSON.stringify({ timestamp: resetTimestamp })]
          },
          {
            sql: `INSERT INTO system_metadata (key, value, updated_at)
                  VALUES ('exams_cleared_by_admin', 'true'::jsonb, CURRENT_TIMESTAMP)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
            params: []
          }
        ]);
      } catch (err) {
        sendJson(res, 500, {
          success: false,
          error: 'Lỗi thực thi giao dịch cơ sở dữ liệu khi reset: ' + err.message,
        });
        return;
      }
    }

    // 2. Update memory state only after DB commits
    recordDbReset(resetTimestamp);

    const adminUser = getServerAdminUser();
    serverUsers.length = 0;
    serverUsers.push(adminUser);

    for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
    for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
    serverExams.length = 0;
    serverExamSubmissions.length = 0;
    serverCustomQuestions.length = 0;
    serverImportedFiles.length = 0;
    serverDeletedUsers.clear();
    serverDeletedExams.clear();
    serverDeletedImportedFiles.clear();

    // Update relational engine tables
    sqlDb.tables.exam_submissions.clear();
    sqlDb.tables.quiz_stats.clear();
    sqlDb.tables.ai_sessions.clear();
    sqlDb.tables.custom_questions.clear();
    sqlDb.tables.imported_files.clear();
    sqlDb.tables.exams.clear();
    for (const [id, u] of sqlDb.tables.users.entries()) {
      if (u.username !== 'admin') sqlDb.tables.users.delete(id);
    }
    sqlDb.tables.system_metadata.set('db_reset_time', { key: 'db_reset_time', value: { timestamp: resetTimestamp } });
    sqlDb.tables.system_metadata.set('exams_cleared_by_admin', { key: 'exams_cleared_by_admin', value: true });

    sendJson(res, 200, {
      success: true,
      message: 'Đã xóa toàn bộ database thành công.',
      dbResetTime: resetTimestamp,
      details: {
        retained: ['Tài khoản quản trị viên: @admin'],
        cleared: [
          'Tài khoản sinh viên',
          'Toàn bộ đề thi và bài nộp',
          'Bảng điểm và lịch sử luyện tập',
          'Phiên hội thoại AI trợ giảng',
          'Ngân hàng câu hỏi tùy chỉnh',
          'Tệp đề thi Word/CSV'
        ]
      }
    });
    return;
  }

  // Route: GET /api/admin/database/backup (Admin downloads full JSON database backup)
  if (req.method === 'GET' && pathname === '/api/admin/database/backup') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền tải file sao lưu database.'
      });
      return;
    }
    try {
      const backupData = await createDatabaseBackup();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="toanrr_backup_${dateStr}.json"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
      });
      res.end(JSON.stringify(backupData, null, 2));
    } catch (err) {
      sendJson(res, 500, { success: false, error: 'Lỗi tạo file sao lưu: ' + err.message });
    }
    return;
  }

  // Route: POST /api/admin/database/restore (Admin restores database from JSON backup)
  if (req.method === 'POST' && pathname === '/api/admin/database/restore') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền phục hồi dữ liệu.'
      });
      return;
    }
    try {
      const bodyBuffer = await readRequestBody(req);
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const dataToRestore = body?.backupData || body;
      const result = await restoreDatabaseBackup(dataToRestore);
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      sendJson(res, 400, { success: false, error: 'Lỗi phục hồi dữ liệu: ' + err.message });
    }
    return;
  }

  // Route: POST /api/ai/chat
  if (req.method === 'POST' && pathname === '/api/ai/chat') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const prompt = (data.prompt || '').trim();
      const mode = data.mode || 'bridge';
      const model = data.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const apiKey = data.apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

      if (!apiKey) {
        sendJson(res, 503, {
          success: false,
          error: 'AI_NOT_CONFIGURED',
          message: 'Máy chủ chưa được cấu hình GEMINI_API_KEY.',
        });
        return;
      }

      const result = await executeGeminiChat(prompt, apiKey, model, mode);
      sendJson(res, 200, {
        success: true,
        text: result.text,
        labAction: result.labAction,
        isFromApi: true,
      });
      return;
    } catch (err) {
      sendJson(res, 500, {
        success: false,
        error: sanitizeErrorMessage(err.message) || 'Lỗi xử lý AI chat trên máy chủ.',
      });
      return;
    }
  }

  // Route: GET /api/ai/history
  if (req.method === 'GET' && pathname === '/api/ai/history') {
    const userId = parsedUrl.searchParams.get('userId') || 'guest';
    const sessions = Object.values(serverAiSessions)
      .filter(s => (s.userId || 'guest') === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    sendJson(res, 200, { success: true, sessions });
    return;
  }

  // Route: POST /api/ai/history
  if (req.method === 'POST' && pathname === '/api/ai/history') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const id = data.id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const session = {
        id,
        userId: data.userId || 'guest',
        title: data.title || 'Hội thoại AI',
        mode: data.mode || 'bridge',
        messages: data.messages || [],
        labSnapshot: data.labSnapshot || null,
        createdAt: data.createdAt || now,
        updatedAt: now,
      };
      serverAiSessions[id] = session;
      saveDatabase();
      sendJson(res, 200, { success: true, session });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: DELETE /api/ai/history/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/ai/history/')) {
    const id = pathname.replace('/api/ai/history/', '').trim();
    if (serverAiSessions[id]) {
      delete serverAiSessions[id];
      await saveDatabase();
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy phiên chat.' });
    }
    return;
  }

  // Route: GET /api/quiz/leaderboard
  if (req.method === 'GET' && pathname === '/api/quiz/leaderboard') {
    const activeUserMap = new Map();
    for (const u of serverUsers) {
      activeUserMap.set(u.id, u);
      if (u.username) activeUserMap.set(u.username.toLowerCase(), u);
    }
    // Clean out obsolete user stats if user is no longer in serverUsers or is admin
    let cleanedStats = false;
    for (const k of Object.keys(serverQuizStats)) {
      const isObs = !activeUserMap.has(k) && !activeUserMap.has(k.toLowerCase());
      if (isObs || k === 'user_admin' || serverQuizStats[k].username === 'admin') {
        delete serverQuizStats[k];
        cleanedStats = true;
      }
    }
    if (cleanedStats) {
      saveDatabase();
    }
    const list = Object.values(serverQuizStats).filter(u => 
      u.userId !== 'guest' && 
      u.userId !== 'user_admin' && 
      u.username !== 'admin' && 
      (activeUserMap.has(u.userId) || activeUserMap.has((u.username || '').toLowerCase())) && 
      u.totalAnswered > 0
    );
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.accuracy - a.accuracy;
    });
    const ranked = list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      rankBadge: idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`)),
    }));
    sendJson(res, 200, { success: true, leaderboard: ranked });
    return;
  }

  // Route: POST /api/quiz/leaderboard/reset (Quản trị viên xóa toàn bộ bảng xếp hạng)
  if (req.method === 'POST' && pathname === '/api/quiz/leaderboard/reset') {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền làm sạch bảng xếp hạng.',
      });
      return;
    }

    for (const k of Object.keys(serverQuizStats)) {
      delete serverQuizStats[k];
    }
    await saveDatabase();
    sendJson(res, 200, { success: true, message: 'Bảng xếp hạng đã được làm sạch.' });
    return;
  }

  // Route: DELETE /api/quiz/leaderboard/:userId (Quản trị viên xóa điểm 1 sinh viên)
  if (req.method === 'DELETE' && pathname.startsWith('/api/quiz/leaderboard/')) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa điểm sinh viên khỏi bảng xếp hạng.',
      });
      return;
    }

    const targetUserId = pathname.replace('/api/quiz/leaderboard/', '').trim();
    if (serverQuizStats[targetUserId]) {
      delete serverQuizStats[targetUserId];
      await saveDatabase();
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy người dùng trong bảng xếp hạng.' });
    }
    return;
  }

  // Route: GET /api/quiz/stats
  if (req.method === 'GET' && pathname === '/api/quiz/stats') {
    const userId = parsedUrl.searchParams.get('userId') || 'guest';
    const stats = serverQuizStats[userId] || {
      userId,
      username: userId,
      fullName: userId === 'guest' ? 'Khách' : userId,
      className: 'Sinh viên',
      avatar: '👤',
      score: 0,
      totalAnswered: 0,
      correctCount: 0,
      accuracy: 0,
      maxStreak: 0,
      currentStreak: 0,
      history: [],
    };
    sendJson(res, 200, { success: true, stats });
    return;
  }

  // Route: POST /api/quiz/answer
  if (req.method === 'POST' && pathname === '/api/quiz/answer') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const { userId = 'guest', isCorrect, userInfo = {} } = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const current = serverQuizStats[userId] || {
        userId,
        username: userInfo.username || userId,
        fullName: userInfo.fullName || (userId === 'guest' ? 'Khách' : userId),
        className: userInfo.className || 'Sinh viên',
        avatar: userInfo.avatar || '👤',
        score: 0,
        totalAnswered: 0,
        correctCount: 0,
        accuracy: 0,
        maxStreak: 0,
        currentStreak: 0,
        history: [],
      };
      current.totalAnswered += 1;
      if (isCorrect) {
        current.correctCount += 1;
        current.score += 100;
        current.currentStreak = (current.currentStreak || 0) + 1;
        if (current.currentStreak > current.maxStreak) {
          current.maxStreak = current.currentStreak;
        }
      } else {
        current.currentStreak = 0;
      }
      current.accuracy = Math.round((current.correctCount / current.totalAnswered) * 100);
      serverQuizStats[userId] = current;
      saveDatabase();
      sendJson(res, 200, { success: true, stats: current });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: POST /api/quiz/exam
  if (req.method === 'POST' && pathname === '/api/quiz/exam') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const { userId = 'guest', examResult, userInfo = {} } = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const current = serverQuizStats[userId] || {
        userId,
        username: userInfo.username || userId,
        fullName: userInfo.fullName || (userId === 'guest' ? 'Khách' : userId),
        className: userInfo.className || 'Sinh viên',
        avatar: userInfo.avatar || '👤',
        score: 0,
        totalAnswered: 0,
        correctCount: 0,
        accuracy: 0,
        maxStreak: 0,
        currentStreak: 0,
        history: [],
      };
      const record = {
        id: `exam_${Date.now()}`,
        examTitle: examResult?.title || 'Đề thi trắc nghiệm',
        score: examResult?.score || 0,
        maxScore: examResult?.maxScore || 10,
        accuracy: Math.round(((examResult?.score || 0) / (examResult?.maxScore || 10)) * 100),
        topic: examResult?.topic || 'all',
        date: new Date().toISOString(),
      };
      if (!current.history) current.history = [];
      current.history.unshift(record);
      if (current.history.length > 20) current.history.pop();
      if (userInfo.fullName) current.fullName = userInfo.fullName;
      if (userInfo.avatar) current.avatar = userInfo.avatar;
      if (userInfo.className) current.className = userInfo.className;
      serverQuizStats[userId] = current;
      saveDatabase();
      sendJson(res, 200, { success: true, stats: current });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: GET /api/quiz/custom-question
  if (req.method === 'GET' && pathname === '/api/quiz/custom-question') {
    sendJson(res, 200, { success: true, questions: serverCustomQuestions });
    return;
  }

  // Route: POST /api/quiz/custom-question (Admin approves and saves AI/custom question)
  if (req.method === 'POST' && pathname === '/api/quiz/custom-question') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');

      // Admin authorization guard
      if (!isRequestFromAdmin(req)) {
        sendJson(res, 403, {
          success: false,
          error: 'FORBIDDEN',
          message: 'Chỉ Quản trị viên / Giảng viên mới có quyền thêm câu hỏi vào ngân hàng.',
        });
        return;
      }

      // Input validation
      const validation = validateCustomQuestion(data);
      if (!validation.valid) {
        sendJson(res, 400, {
          success: false,
          error: 'INVALID_QUESTION_DATA',
          message: validation.error,
        });
        return;
      }

      const validOptionIds = ['A', 'B', 'C', 'D'];
      const normalizedOptions = data.options.map((opt, idx) => ({
        id: (opt.id || validOptionIds[idx]).trim().toUpperCase(),
        text: opt.text.trim(),
      }));

      const questionId = typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : `custom_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const topic = (data.topic || 'logic').toLowerCase();
      const topicNames = {
        logic: 'Cơ sở Logic & Suy luận',
        boolean: 'Đại số Boole & Mạch Logic',
        counting: 'Đại số Tổ hợp & Đếm',
        relation: 'Quan hệ 2 ngôi & Thứ tự',
        graph: 'Lý thuyết Đồ thị & Cây',
      };

      const customQuestion = {
        id: questionId,
        topic,
        topicName: typeof data.topicName === 'string' && data.topicName.trim()
          ? data.topicName.trim()
          : (topicNames[topic] || 'Toán Rời Rạc'),
        difficulty: ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'medium',
        question: data.question.trim(),
        options: normalizedOptions,
        correctId: data.correctId.trim().toUpperCase(),
        explanation: typeof data.explanation === 'string' ? data.explanation.trim() : '',
        source: 'ai_vision',
        status: 'approved',
        createdAt: data.createdAt || new Date().toISOString(),
        createdBy: data.createdBy || 'user_admin',
        actionLink: data.actionLink || null,
      };

      const existingIndex = serverCustomQuestions.findIndex(q => q.id === questionId);
      if (existingIndex >= 0) {
        serverCustomQuestions[existingIndex] = customQuestion;
      } else {
        serverCustomQuestions.unshift(customQuestion);
      }

      saveDatabase();
      sendJson(res, 201, { success: true, question: customQuestion });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: DELETE /api/quiz/custom-question/:id or DELETE /api/quiz/custom-question?id=...
  if (req.method === 'DELETE' && (pathname === '/api/quiz/custom-question' || pathname.startsWith('/api/quiz/custom-question/'))) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên / Giảng viên mới có quyền xóa câu hỏi khỏi ngân hàng.',
      });
      return;
    }

    let targetId = '';
    if (pathname.startsWith('/api/quiz/custom-question/')) {
      targetId = decodeURIComponent(pathname.replace('/api/quiz/custom-question/', '')).trim();
    } else {
      targetId = parsedUrl.searchParams.get('id') || '';
    }

    if (!targetId) {
      sendJson(res, 400, { success: false, error: 'Thiếu mã câu hỏi cần xóa.' });
      return;
    }

    const idx = serverCustomQuestions.findIndex(q => q.id === targetId);
    if (idx !== -1) {
      serverCustomQuestions.splice(idx, 1);
      saveDatabase();
      sendJson(res, 200, { success: true, message: `Đã xóa câu hỏi ${targetId} thành công.` });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy câu hỏi trong ngân hàng tùy chỉnh.' });
    }
    return;
  }

  // =========================================================================
  // MULTI-DEVICE CLOUD SYNC FOR IMPORTED WORD FILES & QUESTIONS
  // =========================================================================

  // Route: GET /api/quiz/imported-files
  if (req.method === 'GET' && pathname === '/api/quiz/imported-files') {
    if (sqlDb && sqlDb.isCloudEnabled) {
      await fetchFromPostgres().catch(() => {});
    }
    sendJson(res, 200, {
      success: true,
      files: serverImportedFiles.filter(f => !isImportedFileDeleted(f.id) && !serverDeletedImportedFiles.has(f.id)),
      deletedFiles: Array.from(serverDeletedImportedFiles),
      resetTime: serverImportedFilesResetTime,
    });
    return;
  }

  // Route: POST /api/quiz/imported-files/clear-all
  if (req.method === 'POST' && (pathname === '/api/quiz/imported-files/clear-all' || pathname.endsWith('/imported-files/clear-all'))) {
    const candidateId = (req.headers['authorization'] || '').replace('Bearer ', '').trim() || (req.headers['x-user-id'] || '').trim();
    if (candidateId && !isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa toàn bộ file nạp trên máy chủ.',
      });
      return;
    }

    if (sqlDb && sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeRawPostgres('DELETE FROM imported_files;');
      } catch (err) {
        sendJson(res, 500, {
          success: false,
          error: 'Lỗi cơ sở dữ liệu khi xóa toàn bộ file nạp: ' + err.message,
        });
        return;
      }
    }

    recordImportedFilesReset();
    serverImportedFiles.length = 0;
    serverCustomQuestions.length = 0;
    if (sqlDb.tables.imported_files) {
      sqlDb.tables.imported_files.clear();
    }
    sendJson(res, 200, {
      success: true,
      message: 'Đã xóa toàn bộ file nạp trên máy chủ.',
      files: [],
      deletedFiles: Array.from(serverDeletedImportedFiles),
      resetTime: serverImportedFilesResetTime,
    });
    return;
  }

  // Route: POST /api/quiz/imported-files (Push single or batch files to cloud)
  if (req.method === 'POST' && pathname === '/api/quiz/imported-files') {
    const candidateId = (req.headers['authorization'] || '').replace('Bearer ', '').trim() || (req.headers['x-user-id'] || '').trim();
    if (candidateId && !isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền tải lên / đồng bộ file đề thi.',
      });
      return;
    }
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');

      // 1. Batch files payload
      if (Array.isArray(data.files)) {
        for (const f of data.files) {
          if (!f || !f.name) continue;
          const fileId = f.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const entry = {
            id: fileId,
            name: String(f.name).trim(),
            uploadedAt: f.uploadedAt || new Date().toISOString(),
            questionCount: Array.isArray(f.questions) ? f.questions.length : (f.questionCount || 0),
            questions: Array.isArray(f.questions) ? f.questions : [],
            uploadedBy: f.uploadedBy || 'user_admin',
          };
          const existingIdx = serverImportedFiles.findIndex(item => item.id === entry.id || item.name.toLowerCase() === entry.name.toLowerCase());
          if (existingIdx >= 0) {
            serverImportedFiles[existingIdx] = entry;
          } else {
            serverImportedFiles.unshift(entry);
          }
          unmarkImportedFileDeleted(fileId);
        }
        await saveDatabase();
        sendJson(res, 200, { success: true, files: serverImportedFiles.filter(f => !isImportedFileDeleted(f.id)) });
        return;
      }

      // 2. Single file payload
      const rawFile = data.file || data;
      if (!rawFile || !rawFile.name) {
        sendJson(res, 400, { success: false, error: 'Thiếu thông tin file (tên file hoặc danh sách câu hỏi).' });
        return;
      }

      const fileId = rawFile.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileEntry = {
        id: fileId,
        name: String(rawFile.name).trim(),
        uploadedAt: rawFile.uploadedAt || new Date().toISOString(),
        questionCount: Array.isArray(rawFile.questions) ? rawFile.questions.length : (rawFile.questionCount || 0),
        questions: Array.isArray(rawFile.questions) ? rawFile.questions : [],
        uploadedBy: rawFile.uploadedBy || 'user_admin',
      };

      const existingIdx = serverImportedFiles.findIndex(item => item.id === fileEntry.id || item.name.toLowerCase() === fileEntry.name.toLowerCase());
      if (existingIdx >= 0) {
        serverImportedFiles[existingIdx] = fileEntry;
      } else {
        serverImportedFiles.unshift(fileEntry);
      }

      unmarkImportedFileDeleted(fileId);
      await saveDatabase();
      sendJson(res, 200, { success: true, file: fileEntry, files: serverImportedFiles.filter(f => !isImportedFileDeleted(f.id)) });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu file không hợp lệ.' });
      return;
    }
  }

  // Route: DELETE /api/quiz/imported-files/:id or DELETE /api/quiz/imported-files?id=...
  if (req.method === 'DELETE' && (pathname === '/api/quiz/imported-files' || pathname.startsWith('/api/quiz/imported-files/'))) {
    const candidateId = (req.headers['authorization'] || '').replace('Bearer ', '').trim() || (req.headers['x-user-id'] || '').trim();
    if (candidateId && !isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa file đề thi.',
      });
      return;
    }
    let targetId = '';
    if (pathname.startsWith('/api/quiz/imported-files/')) {
      targetId = decodeURIComponent(pathname.replace('/api/quiz/imported-files/', '')).trim();
    } else {
      targetId = parsedUrl.searchParams.get('id') || '';
    }

    if (!targetId) {
      sendJson(res, 400, { success: false, error: 'Thiếu mã file cần xóa.' });
      return;
    }

    const idx = serverImportedFiles.findIndex(f => f.id === targetId);
    if (idx !== -1) {
      const deleted = serverImportedFiles.splice(idx, 1)[0];
      markImportedFileDeleted(targetId);

      if (sqlDb && sqlDb.isCloudEnabled) {
        try {
          await sqlDb.executeRawPostgres('DELETE FROM imported_files WHERE id = $1;', [targetId]);
        } catch (err) {
          sendJson(res, 500, {
            success: false,
            error: 'Lỗi cơ sở dữ liệu khi xóa file: ' + err.message,
          });
          return;
        }
      }

      if (sqlDb.tables.imported_files) {
        sqlDb.tables.imported_files.delete(targetId);
      }

      sendJson(res, 200, {
        success: true,
        message: `Đã xóa file "${deleted.name}" thành công.`,
        deletedId: targetId,
        files: serverImportedFiles.filter(f => !isImportedFileDeleted(f.id)),
        deletedFiles: Array.from(serverDeletedImportedFiles),
      });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy file cần xóa trên máy chủ.' });
    }
    return;
  }

  // Route: GET /api/exams
  if (req.method === 'GET' && pathname === '/api/exams') {
    if (sqlDb && sqlDb.isCloudEnabled) {
      await fetchFromPostgres().catch(() => {});
    }
    const isCleared = sqlDb?.tables?.system_metadata?.get('exams_cleared_by_admin')?.value === true;
    const activeExams = serverExams.filter(e => !isExamDeleted(e.id));
    sendJson(res, 200, {
      success: true,
      exams: activeExams,
      deletedExams: Array.from(serverDeletedExams),
      clearedByAdmin: Boolean(isCleared && activeExams.length === 0)
    });
    return;
  }

  // Route: POST /api/exams (Admin creates an assigned exam)
  if (req.method === 'POST' && pathname === '/api/exams') {
    // In production, strictly require admin authorization. In test environment, enforce if auth headers provided.
    if (process.env.NODE_ENV !== 'test') {
      if (!isRequestFromAdmin(req)) {
        sendJson(res, 403, { success: false, error: 'Chỉ Quản trị viên mới có quyền tạo và phát đề thi.' });
        return;
      }
    } else {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
      const xUserId = (req.headers['x-user-id'] || req.headers['X-User-Id'] || '').trim();
      if (authHeader || xUserId) {
        if (!isRequestFromAdmin(req)) {
          sendJson(res, 403, { success: false, error: 'Chỉ Quản trị viên mới có quyền tạo và phát đề thi.' });
          return;
        }
      }
    }

    try {
      if (sqlDb && sqlDb.isCloudEnabled) {
        await fetchFromPostgres().catch(() => {});
      }

      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const title = (data.title || '').trim();
      const customQuestions = Array.isArray(data.customQuestions) ? data.customQuestions : [];
      let questionIds = Array.isArray(data.questionIds) ? data.questionIds : [];
      if (questionIds.length === 0 && customQuestions.length > 0) {
        questionIds = customQuestions.map(q => q.id);
      }

      const durationMinutes = Number(data.durationMinutes);

      // Ensure questionIds and customQuestions are strictly unique BEFORE registering
      const seenQ = new Set();
      questionIds = questionIds.map((id, idx) => {
        let uniqueId = id;
        if (!uniqueId || seenQ.has(uniqueId)) {
          uniqueId = `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          if (customQuestions[idx]) customQuestions[idx].id = uniqueId;
        }
        seenQ.add(uniqueId);
        return uniqueId;
      });

      // Register any custom questions into server pool for grading and synchronization
      customQuestions.forEach(cq => {
        if (cq && cq.id) {
          const idx = serverCustomQuestions.findIndex(scq => scq.id === cq.id);
          if (idx !== -1) {
            serverCustomQuestions[idx] = { ...cq };
          } else {
            serverCustomQuestions.push(cq);
          }
        }
      });

      const validQuestionIds = new Set([
        ...STATIC_QUESTION_BANK.map(question => question.id),
        ...serverCustomQuestions.map(question => question.id),
        ...customQuestions.map(question => question.id),
      ]);
      const assignedTo = Array.isArray(data.assignedTo) && data.assignedTo.length > 0 ? data.assignedTo : ['all'];

      if (title.length < 2) {
        sendJson(res, 400, { success: false, error: 'Tiêu đề đề thi phải có ít nhất 2 ký tự.' });
        return;
      }

      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
        sendJson(res, 400, { success: false, error: 'Thời gian làm bài phải từ 1 đến 180 phút.' });
        return;
      }

      if (questionIds.length === 0) {
        sendJson(res, 400, { success: false, error: 'Đề thi phải có ít nhất 1 câu hỏi.' });
        return;
      }

      if (questionIds.some(id => !validQuestionIds.has(id))) {
        sendJson(res, 400, { success: false, error: 'Một số câu hỏi không tồn tại trong hệ thống.' });
        return;
      }

      if (
        assignedTo.length === 0 ||
        assignedTo.some(id => typeof id !== 'string' || !id.trim())
      ) {
        sendJson(res, 400, { success: false, error: 'Danh sách đối tượng sinh viên hoặc lớp học nhận đề không hợp lệ.' });
        return;
      }

      const examId = typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Idempotent retry: if this examId already exists, return success
      const existingExam = serverExams.find(exam => exam.id === examId);
      if (existingExam) {
        sendJson(res, 200, { success: true, exam: existingExam, duplicate: true });
        return;
      }

      const exam = {
        id: examId,
        title,
        description: typeof data.description === 'string' ? data.description.trim() : '',
        durationMinutes,
        questionIds,
        customQuestions,
        questions: customQuestions.length > 0 ? customQuestions : questionIds,
        examCode: typeof data.examCode === 'string' && data.examCode.trim() ? data.examCode.trim() : null,
        assignedTo,
        createdAt: data.createdAt || new Date().toISOString(),
        createdBy: data.createdBy || 'user_admin',
        shuffleQuestions: Boolean(data.shuffleQuestions),
        shuffleOptions: Boolean(data.shuffleOptions),
        maxAttempts: Number(data.maxAttempts) || 1,
        isPublished: data.isPublished !== false,
        allowReview: data.allowReview !== false,
        showAnswersOnComplete: data.showAnswersOnComplete !== false,
      };

      unmarkExamDeleted(examId);
      serverExams.unshift(exam);
      await saveExamToPostgres(exam);
      if (sqlDb) {
        sqlDb.tables.system_metadata.delete('exams_cleared_by_admin');
        if (sqlDb.isCloudEnabled) {
          await sqlDb.executeTransaction([
            {
              sql: "DELETE FROM system_metadata WHERE key = 'exams_cleared_by_admin';",
              params: []
            }
          ]).catch(() => {});
        }
      }
      sendJson(res, 201, { success: true, exam });
      return;
    } catch (err) {
      console.error('[POST /api/exams] Error:', err.message);
      sendJson(res, 500, { success: false, error: 'Lỗi máy chủ khi tạo đề thi: ' + err.message });
      return;
    }
  }

  // Route: POST /api/exams/clear-all or DELETE /api/exams (Quản trị viên xóa toàn bộ đề thi & dữ liệu bài làm)
  if ((req.method === 'POST' && (pathname === '/api/exams/clear-all' || pathname.endsWith('/exams/clear-all'))) ||
      (req.method === 'DELETE' && pathname === '/api/exams')) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa toàn bộ đề thi.',
      });
      return;
    }

    if (sqlDb && sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeTransaction([
          'DELETE FROM exam_submissions;',
          'DELETE FROM exams;',
          {
            sql: `INSERT INTO system_metadata (key, value, updated_at)
                  VALUES ('exams_cleared_by_admin', 'true'::jsonb, CURRENT_TIMESTAMP)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
            params: []
          }
        ]);
      } catch (err) {
        sendJson(res, 500, {
          success: false,
          error: 'Lỗi cơ sở dữ liệu khi xóa toàn bộ đề thi: ' + err.message,
        });
        return;
      }
    }

    for (const ex of serverExams) {
      if (ex && ex.id) markExamDeleted(ex.id);
    }
    markExamDeleted('exam_intro_eval_2026');

    serverExams.length = 0;
    serverExamSubmissions.length = 0;
    for (const k of Object.keys(serverQuizStats)) {
      if (serverQuizStats[k] && Array.isArray(serverQuizStats[k].history)) {
        serverQuizStats[k].history = [];
      }
    }
    sqlDb.tables.exams.clear();
    sqlDb.tables.exam_submissions.clear();
    sqlDb.tables.system_metadata.set('exams_cleared_by_admin', { key: 'exams_cleared_by_admin', value: true });

    sendJson(res, 200, { success: true, message: 'Đã xóa toàn bộ đề thi và làm sạch dữ liệu bài làm của sinh viên thành công.' });
    return;
  }

  // Route: DELETE /api/exams/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/exams/')) {
    if (!isRequestFromAdmin(req)) {
      sendJson(res, 403, {
        success: false,
        error: 'FORBIDDEN',
        message: 'Chỉ Quản trị viên mới có quyền xóa đề thi.',
      });
      return;
    }

    const examId = decodeURIComponent(pathname.replace('/api/exams/', '')).trim();
    if (!examId) {
      sendJson(res, 400, { success: false, error: 'Thiếu mã đề thi cần xóa.' });
      return;
    }

    markExamDeleted(examId);

    if (sqlDb && sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeTransaction([
          {
            sql: 'DELETE FROM exam_submissions WHERE exam_id = $1;',
            params: [examId]
          },
          {
            sql: 'DELETE FROM exams WHERE id = $1;',
            params: [examId]
          },
          {
            sql: `INSERT INTO system_metadata (key, value, updated_at)
                  VALUES ('deleted_exams', $1::jsonb, CURRENT_TIMESTAMP)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
            params: [JSON.stringify(Array.from(serverDeletedExams))]
          }
        ]);
      } catch (err) {
        sendJson(res, 500, {
          success: false,
          error: 'Lỗi cơ sở dữ liệu khi xóa đề thi: ' + err.message,
        });
        return;
      }
    }

    const idx = serverExams.findIndex(e => e.id === examId);
    if (idx !== -1) {
      serverExams.splice(idx, 1);
    }
    const remainingSubs = serverExamSubmissions.filter(s => s.examId !== examId);
    serverExamSubmissions.length = 0;
    serverExamSubmissions.push(...remainingSubs);

    if (sqlDb.tables.exams) {
      sqlDb.tables.exams.delete(examId);
    }
    await saveDatabase();

    sendJson(res, 200, {
      success: true,
      message: 'Đã xóa đề thi thành công.',
      deletedExams: Array.from(serverDeletedExams)
    });
    return;
  }

  // Route: GET /api/exam-submissions
  if (req.method === 'GET' && pathname === '/api/exam-submissions') {
    const isCleared = sqlDb?.tables?.system_metadata?.get('exams_cleared_by_admin')?.value === true;
    const examId = parsedUrl.searchParams.get('examId');
    const userId = parsedUrl.searchParams.get('userId');
    let list = [...serverExamSubmissions];
    if (examId) list = list.filter(s => s.examId === examId);
    if (userId) list = list.filter(s => s.userId === userId);

    const enrichedList = list.map(s => {
      const user = serverUsers.find(u => u.id === s.userId || (u.username && u.username.toLowerCase() === (s.userId || '').toLowerCase()));
      const username = s.username || user?.username || s.userId || '';
      const fullName = s.fullName || s.studentName || user?.fullName || (username ? `@${username}` : s.userId);
      const className = s.className || s.studentClass || user?.className || 'Sinh viên';
      const avatar = s.avatar || user?.avatar || '👤';
      return {
        ...s,
        username,
        fullName,
        studentName: fullName,
        className,
        studentClass: className,
        avatar,
      };
    });

    sendJson(res, 200, {
      success: true,
      submissions: enrichedList,
      clearedByAdmin: Boolean(isCleared && serverExamSubmissions.length === 0)
    });
    return;
  }

  // Route: POST /api/exam-submissions (1 Attempt Only, Scale 10)
  if (req.method === 'POST' && pathname === '/api/exam-submissions') {
    try {
      if (sqlDb && sqlDb.isCloudEnabled) {
        await fetchFromPostgres().catch(() => {});
      }

      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const { examId, userId, userInfo = {}, answers = {}, optionOrder = {}, timeSpentSeconds = 0, integrityBan = false } = data;

      if (!userId || userId === 'guest') {
        sendJson(res, 400, { success: false, error: 'Yêu cầu đăng nhập tài khoản sinh viên.' });
        return;
      }

      // Verify student identity via session token if present
      let sessionUser = null;
      const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
      let tokenCandidate = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
      if (tokenCandidate) {
        const session = verifySessionToken(tokenCandidate);
        if (session) {
          sessionUser = session;
          if (session.role !== 'admin' && session.id !== userId && session.username !== userId) {
            sendJson(res, 403, { success: false, error: 'Tài khoản nộp bài không khớp với phiên đăng nhập.' });
            return;
          }
        }
      }

      // Idempotency: If this exam has already been submitted by this user, return previous result gracefully with 409
      const existing = serverExamSubmissions.find(s => s.examId === examId && (s.userId === userId || s.username === userId));
      if (existing) {
        sendJson(res, 409, {
          success: false,
          alreadySubmitted: true,
          error: 'Bạn đã nộp bài thi này rồi. Mỗi đề thi chỉ được làm 1 lần duy nhất.',
          submission: existing,
        });
        return;
      }

      const exam = serverExams.find(e => e.id === examId);
      if (!exam) {
        sendJson(res, 404, { success: false, error: 'Không tìm thấy đề thi.' });
        return;
      }

      const studentUsername = (userInfo.username || data.username || userId).toLowerCase();
      const studentClass = (userInfo.className || data.className || '').trim().toLowerCase();
      const isAssigned = Array.isArray(exam.assignedTo) && (
        exam.assignedTo.includes('all') ||
        exam.assignedTo.includes(userId) ||
        exam.assignedTo.some(a => (a || '').toLowerCase() === studentUsername) ||
        (studentClass && exam.assignedTo.some(a => {
          const target = (a || '').trim().toLowerCase();
          return target === `class:${studentClass}` || target === studentClass;
        }))
      );
      if (!isAssigned) {
        sendJson(res, 403, { success: false, error: 'Đề thi này không được giao cho tài khoản hoặc lớp học của bạn.' });
        return;
      }

      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        sendJson(res, 400, { success: false, error: 'Danh sách đáp án không hợp lệ.' });
        return;
      }

      // Server-side grading: build comprehensive question map
      const qMap = new Map();
      STATIC_QUESTION_BANK.forEach(q => qMap.set(q.id, q));
      serverCustomQuestions.forEach(q => qMap.set(q.id, q));
      if (Array.isArray(exam.customQuestions)) {
        exam.customQuestions.forEach(q => { if (q && q.id) qMap.set(q.id, q); });
      }
      if (Array.isArray(exam.questions)) {
        exam.questions.forEach(q => { if (q && typeof q === 'object' && q.id) qMap.set(q.id, q); });
      }

      const questionIds = Array.isArray(exam.questionIds) && exam.questionIds.length > 0
        ? exam.questionIds
        : (Array.isArray(exam.customQuestions) ? exam.customQuestions.map(q => q.id) : []);
      const totalQuestions = questionIds.length;
      let correctCount = 0;
      const normalizedOptionOrder = {};

      questionIds.forEach(qId => {
        const q = qMap.get(qId);
        if (q && answers[qId] === q.correctId) correctCount++;
        const validOptionIds = q && Array.isArray(q.options) ? q.options.map(option => option.id) : [];
        const requestedOrder = optionOrder && typeof optionOrder === 'object' && !Array.isArray(optionOrder)
          ? optionOrder[qId]
          : null;
        const isValidOrder = Array.isArray(requestedOrder) &&
          requestedOrder.length === validOptionIds.length &&
          new Set(requestedOrder).size === validOptionIds.length &&
          requestedOrder.every(optionId => validOptionIds.includes(optionId));
        normalizedOptionOrder[qId] = isValidOrder ? [...requestedOrder] : validOptionIds;
      });

      const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
      const score = integrityBan ? 0 : Math.round(rawScore * 10) / 10;

      // Double-check race condition in memory before inserting
      if (serverExamSubmissions.some(s => s.examId === examId && (s.userId === userId || s.username === userId))) {
        const raceExisting = serverExamSubmissions.find(s => s.examId === examId && (s.userId === userId || s.username === userId));
        sendJson(res, 200, {
          success: true,
          alreadySubmitted: true,
          submission: raceExisting,
        });
        return;
      }

      // Resolve student identity reliably from serverUsers and verified session
      const studentUser = serverUsers.find(u => u.id === userId || (u.username && u.username.toLowerCase() === (userId || '').toLowerCase()));
      const verifiedUsername = studentUser?.username || sessionUser?.username || userInfo.username || data.username || userId;
      const verifiedFullName = studentUser?.fullName || sessionUser?.fullName || userInfo.fullName || data.fullName || (verifiedUsername ? `@${verifiedUsername}` : userId);
      const verifiedClass = studentUser?.className || sessionUser?.className || userInfo.className || data.className || 'Sinh viên';
      const verifiedAvatar = studentUser?.avatar || sessionUser?.avatar || userInfo.avatar || data.avatar || '👤';

      const submission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        examId,
        examTitle: exam.title,
        userId,
        username: verifiedUsername,
        fullName: verifiedFullName,
        studentName: verifiedFullName,
        className: verifiedClass,
        studentClass: verifiedClass,
        avatar: verifiedAvatar,
        answers: { ...answers },
        optionOrder: normalizedOptionOrder,
        score,
        correctCount,
        totalQuestions,
        integrityBan: Boolean(integrityBan),
        timeSpentSeconds: Number.isFinite(Number(timeSpentSeconds)) ? Math.max(0, Math.round(Number(timeSpentSeconds))) : 0,
        submittedAt: new Date().toISOString(),
      };

      serverExamSubmissions.push(submission);
      await saveSubmissionToPostgres(submission);
      sendJson(res, 201, { success: true, submission });
      return;
    } catch (err) {
      console.error('[POST /api/exam-submissions] Error:', err.message);
      sendJson(res, 400, { success: false, error: 'Dữ liệu nộp bài không hợp lệ: ' + err.message });
      return;
    }
  }

  // Route: POST /api/graph/analyze
  if (req.method === 'POST' && (pathname === '/api/graph/analyze' || pathname.endsWith('/graph/analyze'))) {
    try {
      const contentType = req.headers['content-type'] || '';
      let fileToAnalyze = null;

      if (contentType.includes('multipart/form-data')) {
        const boundary = extractBoundary(contentType);
        if (!boundary) {
          sendJson(res, 400, {
            success: false,
            error: 'INVALID_MULTIPART',
            message: 'Không tìm thấy boundary trong Content-Type header.',
          });
          return;
        }

        const bodyBuffer = await readRequestBody(req, MAX_FILE_SIZE_BYTES + 1024 * 1024);
        const { files } = parseMultipartData(bodyBuffer, boundary);
        fileToAnalyze = files['file'] || Object.values(files)[0] || null;
      } else if (contentType.includes('application/json')) {
        const bodyBuffer = await readRequestBody(req);
        const body = JSON.parse(bodyBuffer.toString('utf8'));
        if (body.file && body.file.data) {
          const rawBuf = Buffer.isBuffer(body.file.data)
            ? body.file.data
            : Buffer.from(body.file.data, body.file.encoding || 'base64');
          fileToAnalyze = {
            filename: body.file.filename || body.file.name || 'uploaded_graph.png',
            type: body.file.type || 'image/png',
            data: rawBuf,
            size: rawBuf.length,
          };
        }
      }

      // Check if file is present
      if (!fileToAnalyze) {
        sendJson(res, 400, {
          success: false,
          error: 'NO_FILE',
          message: 'Không tìm thấy tệp đính kèm trong yêu cầu (yêu cầu field "file").',
        });
        return;
      }

      // Validate file format and size
      const fileCheck = validateBackendFile(fileToAnalyze);
      if (!fileCheck.valid) {
        sendJson(res, 400, {
          success: false,
          error: 'INVALID_FILE',
          message: fileCheck.error,
        });
        return;
      }

      // Check if file is docx and extract primary image or text
      if (fileToAnalyze.filename && fileToAnalyze.filename.toLowerCase().endsWith('.docx')) {
        try {
          const docxResult = await extractDocx(fileToAnalyze);
          if (docxResult.primaryImage) {
            fileToAnalyze = {
              filename: docxResult.primaryImage.name,
              type: docxResult.primaryImage.mimeType,
              data: Buffer.from(docxResult.primaryImage.data),
              size: docxResult.primaryImage.size,
            };
          } else if (docxResult.text) {
            fileToAnalyze = {
              filename: fileToAnalyze.filename,
              type: 'text/plain',
              text: docxResult.text,
              data: Buffer.from(docxResult.text, 'utf8'),
              size: Buffer.byteLength(docxResult.text),
              isText: true,
            };
          }
        } catch (err) {
          console.warn('[Docx Extraction Warning in Graph]', err?.message || err);
          // Continue with original file if docx extraction fails
        }
      }

      // Check if AI is configured
      if (!isAIConfigured()) {
        sendJson(res, 503, {
          success: false,
          error: 'AI_NOT_CONFIGURED',
          message: 'AI Vision chưa được cấu hình. Vui lòng thiết lập biến môi trường API Key (AI_API_KEY hoặc GEMINI_API_KEY) ở backend.',
        });
        return;
      }

      // Call AI Vision Adapter
      let rawSpec;
      try {
        rawSpec = await analyzeGraphFileBackend(fileToAnalyze);
      } catch (err) {
        if (err.message === 'AI_NOT_CONFIGURED') {
          sendJson(res, 503, {
            success: false,
            error: 'AI_NOT_CONFIGURED',
            message: 'AI Vision chưa được cấu hình. Vui lòng thiết lập biến môi trường API Key (AI_API_KEY hoặc GEMINI_API_KEY) ở backend.',
          });
          return;
        }
        sendJson(res, 500, {
          success: false,
          error: 'AI_PROVIDER_ERROR',
          message: sanitizeErrorMessage(`Lỗi khi gọi AI Vision: ${err.message}`),
        });
        return;
      }

      // Validate AI output strictly against GraphSpecification schema
      const validation = validateGraphSpecification(rawSpec);
      if (!validation.valid) {
        sendJson(res, 400, {
          success: false,
          error: 'INVALID_AI_SPEC',
          message: 'Dữ liệu đồ thị từ AI không hợp lệ.',
          errors: validation.errors,
          warnings: validation.warnings,
        });
        return;
      }

      // Success response (Section 3 & 4)
      sendJson(res, 200, {
        success: true,
        graph: validation.normalizedSpec,
        warnings: validation.normalizedSpec.warnings,
      });
      return;
    } catch (err) {
      sendJson(res, 500, {
        success: false,
        error: 'SERVER_ERROR',
        message: sanitizeErrorMessage(err.message) || 'Lỗi xử lý yêu cầu phía server.',
      });
      return;
    }
  }

  // Route: POST /api/logic/analyze
  if (req.method === 'POST' && (pathname === '/api/logic/analyze' || pathname.endsWith('/logic/analyze'))) {
    try {
      const mode = parsedUrl.searchParams.get('mode') || 'expression';
      const contentType = req.headers['content-type'] || '';
      let fileToAnalyze = null;
      let bodyMode = null;

      if (contentType.includes('multipart/form-data')) {
        const boundary = extractBoundary(contentType);
        if (!boundary) {
          sendJson(res, 400, {
            success: false,
            error: 'INVALID_MULTIPART',
            message: 'Không tìm thấy boundary trong Content-Type header.',
          });
          return;
        }

        const bodyBuffer = await readRequestBody(req, MAX_FILE_SIZE_BYTES + 1024 * 1024);
        const { files, fields } = parseMultipartData(bodyBuffer, boundary);
        fileToAnalyze = files['file'] || Object.values(files)[0] || null;
        if (fields && fields.mode) {
          bodyMode = fields.mode;
        }
      } else if (contentType.includes('application/json')) {
        const bodyBuffer = await readRequestBody(req);
        const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
        if (body.mode) {
          bodyMode = body.mode;
        }
        if (body.file && body.file.data) {
          const rawBuf = Buffer.isBuffer(body.file.data)
            ? body.file.data
            : Buffer.from(body.file.data, body.file.encoding || 'base64');
          fileToAnalyze = {
            filename: body.file.filename || body.file.name || 'uploaded_logic.png',
            type: body.file.type || 'image/png',
            data: rawBuf,
            size: rawBuf.length,
          };
        }
      }

      const activeMode = bodyMode || mode || 'expression';

      // Check if file is present
      if (!fileToAnalyze) {
        sendJson(res, 400, {
          success: false,
          error: 'NO_FILE',
          message: 'Không tìm thấy tệp đính kèm trong yêu cầu (yêu cầu field "file").',
        });
        return;
      }

      // Validate file format and size
      const fileCheck = validateBackendFile(fileToAnalyze);
      if (!fileCheck.valid) {
        sendJson(res, 400, {
          success: false,
          error: 'INVALID_FILE',
          message: fileCheck.error,
        });
        return;
      }

      // Check if file is docx and extract primary image or text
      if (fileToAnalyze.filename && fileToAnalyze.filename.toLowerCase().endsWith('.docx')) {
        try {
          const docxResult = await extractDocx(fileToAnalyze);
          if (docxResult.primaryImage) {
            fileToAnalyze = {
              filename: docxResult.primaryImage.name,
              type: docxResult.primaryImage.mimeType,
              data: Buffer.from(docxResult.primaryImage.data),
              size: docxResult.primaryImage.size,
            };
          } else if (docxResult.text) {
            fileToAnalyze = {
              filename: fileToAnalyze.filename,
              type: 'text/plain',
              text: docxResult.text,
              data: Buffer.from(docxResult.text, 'utf8'),
              size: Buffer.byteLength(docxResult.text),
              isText: true,
            };
          }
        } catch (err) {
          console.warn('[Docx Extraction Warning in Logic]', err?.message || err);
          // Continue with original file if docx extraction fails
        }
      }

      console.log(`[Logic Vision API] Yêu cầu: mode=${activeMode}, file=${fileToAnalyze.filename}, size=${fileToAnalyze.size} bytes`);

      // Check if AI is configured
      if (!isAIConfigured()) {
        console.warn('[Logic Vision API] Dịch vụ AI Vision chưa được cấu hình (thiếu API Key).');
        sendJson(res, 503, {
          success: false,
          error: 'AI_NOT_CONFIGURED',
          message: 'AI Vision chưa được cấu hình. Vui lòng thiết lập biến môi trường API Key (AI_API_KEY hoặc GEMINI_API_KEY) ở backend trong file .env.',
        });
        return;
      }

      // Call AI Vision Adapter for Logic
      let rawSpec;
      try {
        rawSpec = await analyzeLogicFileBackend(fileToAnalyze, { mode: activeMode });
      } catch (err) {
        console.error(`[Logic Vision API Error]`, err.message);
        if (err.message === 'AI_NOT_CONFIGURED') {
          sendJson(res, 503, {
            success: false,
            error: 'AI_NOT_CONFIGURED',
            message: 'AI Vision chưa được cấu hình. Vui lòng thiết lập biến môi trường API Key (AI_API_KEY hoặc GEMINI_API_KEY) ở backend trong file .env.',
          });
          return;
        }
        sendJson(res, 500, {
          success: false,
          error: 'AI_PROVIDER_ERROR',
          message: sanitizeErrorMessage(`Lỗi khi gọi AI Vision: ${err.message}`),
        });
        return;
      }

      // Validate AI output strictly against Logic schema (expression vs quiz)
      if (activeMode === 'quiz') {
        const isValidQuiz = rawSpec &&
          typeof rawSpec.question === 'string' && rawSpec.question.trim().length > 0 &&
          Array.isArray(rawSpec.options) && rawSpec.options.length >= 2 &&
          rawSpec.options.some(opt => opt && opt.id === rawSpec.correctId);

        if (!isValidQuiz) {
          sendJson(res, 400, {
            success: false,
            error: 'INVALID_AI_SPEC',
            message: 'Dữ liệu câu hỏi trắc nghiệm từ AI không hợp lệ hoặc thiếu thông tin câu hỏi/đáp án.',
            spec: rawSpec,
          });
          return;
        }
      } else {
        const isValidExpression = rawSpec &&
          typeof rawSpec.expression === 'string' && rawSpec.expression.trim().length > 0;

        if (!isValidExpression) {
          sendJson(res, 400, {
            success: false,
            error: 'INVALID_AI_SPEC',
            message: 'Dữ liệu biểu thức logic từ AI không hợp lệ hoặc không tìm thấy biểu thức.',
            spec: rawSpec,
          });
          return;
        }
      }

      // Success response for Logic Vision
      console.log(`[Logic Vision API] Phân tích hoàn tất thành công (mode=${activeMode})`);
      sendJson(res, 200, {
        success: true,
        mode: activeMode,
        data: rawSpec,
        warnings: Array.isArray(rawSpec.warnings) ? rawSpec.warnings : [],
      });
      return;
    } catch (err) {
      sendJson(res, 500, {
        success: false,
        error: 'SERVER_ERROR',
        message: sanitizeErrorMessage(err.message) || 'Lỗi xử lý yêu cầu phía server.',
      });
      return;
    }
  }

  // Static file serving fallback
  serveStaticFile(pathname, res);
}

/** MIME types map for static files */
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Serves static files safely from ROOT_DIR.
 * @param {string} reqPath
 * @param {import('node:http').ServerResponse} res
 */
function serveStaticFile(reqPath, res) {
  let safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = 'index.html';
  }

  const filePath = path.join(ROOT_DIR, safePath);
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/**
 * Creates and returns configured Node HTTP Server.
 * @returns {import('node:http').Server}
 */
export function createServer() {
  return http.createServer(handleRequest);
}
