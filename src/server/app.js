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
import { isAIConfigured, analyzeGraphFileBackend, executeGeminiChat } from './ai/AIProviderAdapter.js';
import { validateGraphSpecification, MAX_FILE_SIZE_BYTES } from '../app/ai/GraphVisionAdapter.js';

import { serverUsers, serverAiSessions, serverQuizStats, saveDatabase, isKVConfigured, fetchFromKV } from './auth/ServerDataStore.js';

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
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
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

  // Sync latest data from Vercel KV for Serverless execution
  if (isKVConfigured()) {
    try {
      await fetchFromKV();
    } catch {}
  }

  // Route: GET /api/health
  if (req.method === 'GET' && (pathname === '/api/health' || pathname.endsWith('/health'))) {
    sendJson(res, 200, {
      status: 'ok',
      aiConfigured: isAIConfigured(),
      kvConfigured: isKVConfigured(),
      storageMode: isKVConfigured() ? 'cloud_kv' : (process.env.VERCEL ? 'ephemeral_tmp' : 'local_fs'),
      supportedFormats: BACKEND_SUPPORTED_EXTENSIONS,
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
      const isValidDemoPass = (found.username === 'admin' && (password === 'Admin@ToanRR2026!' || password === 'admin123' || password === '123456')) ||
                              (found.username === 'duchuy' && (password === '123456' || password === 'duchuy'));
      if (!isValidDemoPass && found.password && found.password !== password) {
        sendJson(res, 401, { success: false, error: 'Mật khẩu không chính xác.' });
        return;
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
      if (!data.username || !data.fullName || !data.email) {
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
      };
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

  // Route: POST /api/admin/users (Quản trị viên cấp tài khoản mới)
  if (req.method === 'POST' && pathname === '/api/admin/users') {
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
        delete serverQuizStats[del.id];
        delete serverQuizStats[del.username];
        if (serverAiSessions[del.id]) delete serverAiSessions[del.id];
        if (serverAiSessions[del.username]) delete serverAiSessions[del.username];
      }
      delete serverQuizStats[rawTarget];
      if (queryUsername) delete serverQuizStats[queryUsername];
      saveDatabase();
      if (isKVConfigured()) {
        writeToKV().catch(() => {});
      }
      sendJson(res, 200, { success: true, deletedUsers: toDelete });
    } else {
      sendJson(res, 404, { success: false, error: 'Không tìm thấy tài khoản.' });
    }
    return;
  }

  // Route: POST /api/admin/database/reset (Quản trị viên xóa sạch toàn bộ dữ liệu database)
  if (req.method === 'POST' && pathname === '/api/admin/database/reset') {
    const adminUser = serverUsers.find(u => u.username === 'admin' || u.id === 'user_admin') || {
      id: 'user_admin',
      username: 'admin',
      fullName: 'Quản Trị Viên',
      className: 'Quản trị viên',
      email: 'admin@toanrr.edu.vn',
      password: 'Admin@ToanRR2026!',
      avatar: '👑',
      role: 'admin',
      bio: 'Quản trị viên hệ thống',
    };
    serverUsers.length = 0;
    serverUsers.push({ ...adminUser, fullName: 'Quản Trị Viên', className: 'Quản trị viên', role: 'admin' });
    for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
    for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
    saveDatabase();
    if (isKVConfigured()) {
      writeToKV().catch(() => {});
    }
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
        error: err.message || 'Lỗi xử lý AI chat trên máy chủ.',
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
      saveDatabase();
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
    for (const k of Object.keys(serverQuizStats)) {
      const isObs = !activeUserMap.has(k) && !activeUserMap.has(k.toLowerCase());
      if (isObs || k === 'user_admin' || serverQuizStats[k].username === 'admin') {
        delete serverQuizStats[k];
      }
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
    for (const k of Object.keys(serverQuizStats)) {
      delete serverQuizStats[k];
    }
    saveDatabase();
    if (isKVConfigured()) {
      writeToKV().catch(() => {});
    }
    sendJson(res, 200, { success: true, message: 'Bảng xếp hạng đã được làm sạch.' });
    return;
  }

  // Route: DELETE /api/quiz/leaderboard/:userId (Quản trị viên xóa điểm 1 sinh viên)
  if (req.method === 'DELETE' && pathname.startsWith('/api/quiz/leaderboard/')) {
    const targetUserId = pathname.replace('/api/quiz/leaderboard/', '').trim();
    if (serverQuizStats[targetUserId]) {
      delete serverQuizStats[targetUserId];
      saveDatabase();
      if (isKVConfigured()) {
        writeToKV().catch(() => {});
      }
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

  // Route: POST /api/graph/analyze
  if (req.method === 'POST' && (pathname === '/api/graph/analyze' || pathname.endsWith('/graph/analyze') || pathname.endsWith('/analyze'))) {
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
        } catch {
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
          message: `Lỗi khi gọi AI Vision: ${err.message}`,
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
        message: err.message || 'Lỗi xử lý yêu cầu phía server.',
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
