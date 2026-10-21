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
  saveDatabase, 
  fetchFromPostgres,
  saveToPostgres,
  isKVConfigured, 
  fetchFromKV, 
  writeToKV,
  sqlDb
} from './auth/ServerDataStore.js';
import { DEFAULT_EXAMS } from '../core/quiz/ExamManager.js';
import { STATIC_QUESTION_BANK } from '../core/quiz/QuizBank.js';
import { DEMO_USERS } from '../core/auth/AuthManager.js';

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

/**
 * Verifies if incoming request is from an administrator via HTTP headers.
 * Authentication credentials must strictly reside in headers (Authorization or x-user-id).
 * If a Bearer token is provided, it serves as the authoritative identity.
 * Prevents identity spoofing where an unprivileged token tries to masquerade via x-user-id.
 * 
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isRequestFromAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const xUserId = (req.headers['x-user-id'] || '').trim();

  let tokenCandidate = '';
  if (authHeader.startsWith('Bearer ')) {
    tokenCandidate = authHeader.slice(7).trim();
  } else if (authHeader) {
    tokenCandidate = authHeader.trim();
  }

  // Token is authoritative if provided
  const candidateId = tokenCandidate || xUserId;
  if (!candidateId) return false;

  // Anti-spoofing guard: If both token and x-user-id are provided, they must not contradict
  if (tokenCandidate && xUserId && tokenCandidate.toLowerCase() !== xUserId.toLowerCase()) {
    const tokenIsAdmin = tokenCandidate === 'user_admin' || tokenCandidate.toLowerCase() === 'admin';
    const xUserIsAdmin = xUserId === 'user_admin' || xUserId.toLowerCase() === 'admin';
    if (!tokenIsAdmin || !xUserIsAdmin) {
      return false; // Conflicting identities / spoofing detected
    }
  }

  const user = serverUsers.find(u =>
    u.id === candidateId ||
    u.username.toLowerCase() === candidateId.toLowerCase()
  );

  return Boolean(user && (user.role === 'admin' || user.username.toLowerCase() === 'admin' || user.id === 'user_admin'));
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
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

  // Route: GET /api/health
  if (req.method === 'GET' && (pathname === '/api/health' || pathname.endsWith('/health'))) {
    const dbStatus = sqlDb.getStatus();
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

  // Route: GET /api/database/status
  if (req.method === 'GET' && (pathname === '/api/database/status' || pathname === '/api/admin/database/status')) {
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
    sendJson(res, 200, {
      success: true,
      users: serverUsers.map(u => {
        const copy = { ...u };
        delete copy.password;
        return copy;
      }),
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
      const found = serverUsers.find(
        u => u.username.toLowerCase() === (username || '').toLowerCase() || u.email.toLowerCase() === (username || '').toLowerCase()
      );
      if (!found) {
        sendJson(res, 401, { success: false, error: 'Tài khoản không tồn tại.' });
        return;
      }
      if (found.username === 'admin' || found.id === 'user_admin' || found.role === 'admin') {
        if (password !== DEMO_USERS[0].password) {
          sendJson(res, 401, { success: false, error: 'Mật khẩu không chính xác.' });
          return;
        }
      } else {
        if (found.password && found.password !== password) {
          sendJson(res, 401, { success: false, error: 'Mật khẩu không chính xác.' });
          return;
        }
      }
      const user = { ...found };
      delete user.password;
      sendJson(res, 200, { success: true, user });
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
        password: data.password || '123456',
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

  // Route: GET /api/admin/users (Quản trị viên xem toàn bộ database tài khoản)
  if (req.method === 'GET' && pathname === '/api/admin/users') {
    sendJson(res, 200, {
      success: true,
      users: serverUsers.map(u => {
        const copy = { ...u };
        delete copy.password;
        return copy;
      }),
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
        password: data.password || '123456',
        avatar: data.avatar || '👨‍🎓',
        role: 'student',
        createdAt: new Date().toISOString(),
      };
      unmarkUserDeleted(cleanUsername);
      if (newUser.email) unmarkUserDeleted(newUser.email);
      if (newUser.id) unmarkUserDeleted(newUser.id);
      serverUsers.push(newUser);
      await saveDatabase();
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

      const existingUsernames = new Set(serverUsers.map(u => u.username.toLowerCase()));
      const createdUsers = [];
      const skippedCount = { value: 0 };
      const nowTs = Date.now();

      for (let i = 0; i < usersInput.length; i++) {
        const data = usersInput[i];
        const cleanUsername = (data.username || '').trim().toLowerCase();
        if (!cleanUsername || !data.fullName) {
          skippedCount.value++;
          continue;
        }
        if (existingUsernames.has(cleanUsername)) {
          skippedCount.value++;
          continue;
        }
        const newUser = {
          id: data.id || `user_${nowTs}_${Math.random().toString(36).slice(2, 6)}_${i}`,
          username: cleanUsername,
          fullName: data.fullName,
          className: data.className || 'Sinh viên',
          email: data.email || `${cleanUsername}@toanrr.edu.vn`,
          password: data.password || '123456',
          avatar: data.avatar || '👨‍🎓',
          role: 'student',
          createdAt: new Date().toISOString(),
        };
        existingUsernames.add(cleanUsername);
        unmarkUserDeleted(cleanUsername);
        if (newUser.email) unmarkUserDeleted(newUser.email);
        if (newUser.id) unmarkUserDeleted(newUser.id);
        serverUsers.push(newUser);
        createdUsers.push(newUser);
      }

      // Ghi database 1 lần duy nhất sau khi thêm toàn bộ
      if (createdUsers.length > 0) {
        await saveDatabase();
      }

      const publicUsers = createdUsers.map(u => { const p = { ...u }; delete p.password; return p; });
      sendJson(res, 200, {
        success: true,
        addedCount: createdUsers.length,
        skippedCount: skippedCount.value,
        createdUsers: publicUsers,
      });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }
  }

  // Route: GET /api/auth/verify
  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    const userId = parsedUrl.searchParams.get('userId');
    const username = parsedUrl.searchParams.get('username');
    if (!userId && !username) {
      sendJson(res, 400, { valid: false, error: 'Thiếu thông tin người dùng.' });
      return;
    }
    const exists = serverUsers.some(u =>
      (userId && u.id === userId) ||
      (username && u.username.toLowerCase() === username.toLowerCase())
    );
    if (!exists) {
      sendJson(res, 404, { valid: false, error: 'Tài khoản không tồn tại trên hệ thống.' });
    } else {
      sendJson(res, 200, { valid: true });
    }
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
      }
      delete serverQuizStats[rawTarget];
      if (queryUsername) delete serverQuizStats[queryUsername];
      await saveDatabase();
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
    found.password = newPassword;
    await saveDatabase();
    sendJson(res, 200, { success: true, message: `Mật khẩu của sinh viên @${found.username} đã được đặt lại thành ${newPassword}.` });
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
    const adminUser = serverUsers.find(u => u.username === 'admin' || u.id === 'user_admin') || {
      id: 'user_admin',
      username: 'admin',
      fullName: 'Quản Trị Viên',
      className: 'Quản trị viên',
      email: 'admin@toanrr.edu.vn',
      password: DEMO_USERS[0].password,
      avatar: '👑',
      role: 'admin',
      bio: 'Quản trị viên hệ thống',
    };
    recordDbReset();
    serverUsers.length = 0;
    serverUsers.push({
      ...adminUser,
      ...DEMO_USERS[0],
      fullName: 'Quản Trị Viên',
      className: 'Quản trị viên',
      role: 'admin',
      password: DEMO_USERS[0].password,
    });
    for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
    for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
    serverExams.length = 0;
    serverExams.push(...DEFAULT_EXAMS);
    serverExamSubmissions.length = 0;
    serverCustomQuestions.length = 0;
    serverImportedFiles.length = 0;
    serverDeletedUsers.clear();
    serverDeletedExams.clear();
    serverDeletedImportedFiles.clear();

    if (sqlDb.isCloudEnabled) {
      try {
        await sqlDb.executeRawPostgres('DELETE FROM exam_submissions;');
        await sqlDb.executeRawPostgres('DELETE FROM quiz_stats;');
        await sqlDb.executeRawPostgres('DELETE FROM ai_sessions;');
        await sqlDb.executeRawPostgres('DELETE FROM custom_questions;');
        await sqlDb.executeRawPostgres('DELETE FROM imported_files;');
        await sqlDb.executeRawPostgres("DELETE FROM exams WHERE id NOT IN ('exam_intro_eval_2026');");
        await sqlDb.executeRawPostgres("DELETE FROM users WHERE username != 'admin';");
      } catch (err) {
        console.warn('[app.js] Error cleaning Postgres on reset:', err.message);
      }
    }

    await saveDatabase();
    sendJson(res, 200, { success: true, message: 'Đã xóa toàn bộ database thành công.' });
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
    sendJson(res, 200, {
      success: true,
      files: serverImportedFiles.filter(f => !serverDeletedImportedFiles.has(f.id)),
      deletedFiles: Array.from(serverDeletedImportedFiles),
      resetTime: serverImportedFilesResetTime,
    });
    return;
  }

  // Route: POST /api/quiz/imported-files/clear-all
  if (req.method === 'POST' && (pathname === '/api/quiz/imported-files/clear-all' || pathname.endsWith('/imported-files/clear-all'))) {
    recordImportedFilesReset();
    serverImportedFiles.length = 0;
    serverCustomQuestions.length = 0;
    await saveDatabase();
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
        sendJson(res, 200, { success: true, files: serverImportedFiles });
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
      sendJson(res, 200, { success: true, file: fileEntry, files: serverImportedFiles });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu file không hợp lệ.' });
      return;
    }
  }

  // Route: DELETE /api/quiz/imported-files/:id or DELETE /api/quiz/imported-files?id=...
  if (req.method === 'DELETE' && (pathname === '/api/quiz/imported-files' || pathname.startsWith('/api/quiz/imported-files/'))) {
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
      await saveDatabase();
      sendJson(res, 200, {
        success: true,
        message: `Đã xóa file "${deleted.name}" thành công.`,
        deletedId: targetId,
        files: serverImportedFiles,
        deletedFiles: Array.from(serverDeletedImportedFiles),
      });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy file cần xóa trên máy chủ.' });
    }
    return;
  }

  // Route: GET /api/exams
  if (req.method === 'GET' && pathname === '/api/exams') {
    sendJson(res, 200, { success: true, exams: serverExams });
    return;
  }

  // Route: POST /api/exams (Admin creates an assigned exam)
  if (req.method === 'POST' && pathname === '/api/exams') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const title = (data.title || '').trim();
      const questionIds = Array.isArray(data.questionIds) ? data.questionIds : [];
      const durationMinutes = Number(data.durationMinutes);
      const customQuestions = Array.isArray(data.customQuestions) ? data.customQuestions : [];
      customQuestions.forEach(cq => {
        if (cq && cq.id && !serverCustomQuestions.some(scq => scq.id === cq.id)) {
          serverCustomQuestions.push(cq);
        }
      });
      const validQuestionIds = new Set([
        ...STATIC_QUESTION_BANK.map(question => question.id),
        ...serverCustomQuestions.map(question => question.id),
        ...customQuestions.map(question => question.id),
      ]);
      const assignedTo = Array.isArray(data.assignedTo) ? data.assignedTo : ['all'];
      if (
        title.length < 3 ||
        questionIds.length === 0 ||
        questionIds.length !== new Set(questionIds).size ||
        questionIds.some(id => !validQuestionIds.has(id)) ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 1 ||
        durationMinutes > 180 ||
        assignedTo.length === 0 ||
        assignedTo.some(id => typeof id !== 'string' || (id !== 'all' && !serverUsers.some(user => user.id === id)))
      ) {
        sendJson(res, 400, { success: false, error: 'Thông tin đề thi, thời lượng, câu hỏi hoặc danh sách sinh viên không hợp lệ.' });
        return;
      }
      const examId = typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (serverExams.some(exam => exam.id === examId)) {
        sendJson(res, 409, { success: false, error: 'Mã đề thi đã tồn tại trên máy chủ.' });
        return;
      }
      const exam = {
        id: examId,
        title,
        description: typeof data.description === 'string' ? data.description.trim() : '',
        durationMinutes,
        questionIds,
        customQuestions,
        examCode: typeof data.examCode === 'string' && data.examCode.trim() ? data.examCode.trim() : null,
        assignedTo,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy || 'user_admin',
        shuffleQuestions: Boolean(data.shuffleQuestions),
        shuffleOptions: Boolean(data.shuffleOptions),
      };
      unmarkExamDeleted(examId);
      serverExams.unshift(exam);
      saveDatabase();
      sendJson(res, 201, { success: true, exam });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu không hợp lệ.' });
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
    await saveDatabase();
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

    const examId = pathname.replace('/api/exams/', '').trim();
    const idx = serverExams.findIndex(e => e.id === examId);
    if (idx !== -1) {
      serverExams.splice(idx, 1);
      const remainingSubs = serverExamSubmissions.filter(s => s.examId !== examId);
      serverExamSubmissions.length = 0;
      serverExamSubmissions.push(...remainingSubs);
      markExamDeleted(examId);
      await saveDatabase();
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy đề thi.' });
    }
    return;
  }

  // Route: GET /api/exam-submissions
  if (req.method === 'GET' && pathname === '/api/exam-submissions') {
    const examId = parsedUrl.searchParams.get('examId');
    const userId = parsedUrl.searchParams.get('userId');
    let list = [...serverExamSubmissions];
    if (examId) list = list.filter(s => s.examId === examId);
    if (userId) list = list.filter(s => s.userId === userId);
    sendJson(res, 200, { success: true, submissions: list });
    return;
  }

  // Route: POST /api/exam-submissions (1 Attempt Only, Scale 10)
  if (req.method === 'POST' && pathname === '/api/exam-submissions') {
    try {
      const bodyBuffer = await readRequestBody(req);
      const data = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const { examId, userId, userInfo = {}, answers = {}, optionOrder = {}, timeSpentSeconds = 0, integrityBan = false } = data;

      if (!userId || userId === 'guest') {
        sendJson(res, 400, { success: false, error: 'Yêu cầu đăng nhập tài khoản sinh viên.' });
        return;
      }

      const existing = serverExamSubmissions.find(s => s.examId === examId && s.userId === userId);
      if (existing) {
        sendJson(res, 409, {
          success: false,
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
      if (!Array.isArray(exam.assignedTo) || (!exam.assignedTo.includes('all') && !exam.assignedTo.includes(userId))) {
        sendJson(res, 403, { success: false, error: 'Đề thi này không được giao cho tài khoản của bạn.' });
        return;
      }
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        sendJson(res, 400, { success: false, error: 'Danh sách đáp án không hợp lệ.' });
        return;
      }

      const qMap = new Map();
      STATIC_QUESTION_BANK.forEach(q => qMap.set(q.id, q));
      serverCustomQuestions.forEach(q => qMap.set(q.id, q));
      const totalQuestions = exam.questionIds.length;
      let correctCount = 0;
      const normalizedOptionOrder = {};
      exam.questionIds.forEach(qId => {
        const q = qMap.get(qId);
        if (q && answers[qId] === q.correctId) correctCount++;
        const validOptionIds = q ? q.options.map(option => option.id) : [];
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

      const submission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        examId,
        examTitle: exam.title,
        userId,
        username: userInfo.username || data.username || userId,
        fullName: userInfo.fullName || data.fullName || userInfo.username || userId,
        className: userInfo.className || data.className || 'Sinh viên',
        avatar: userInfo.avatar || data.avatar || '👤',
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
      saveDatabase();
      sendJson(res, 201, { success: true, submission });
      return;
    } catch {
      sendJson(res, 400, { success: false, error: 'Dữ liệu nộp bài không hợp lệ.' });
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
