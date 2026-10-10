/**
 * @file ServerDataStore.js
 * Persistent Server Database store for multi-device user accounts, AI history sessions, and Quiz Leaderboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USERS } from '../../core/auth/AuthManager.js';
import { INITIAL_LEADERBOARD } from '../../core/quiz/QuizHistoryManager.js';
import { DEFAULT_EXAMS } from '../../core/quiz/ExamManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = process.env.VERCEL 
  ? '/tmp/data' 
  : path.resolve(__dirname, '../../../data');
const DB_FILE = process.env.VITEST 
  ? path.join(DB_DIR, 'server_db_test.json')
  : path.join(DB_DIR, 'server_db.json');

function getDefaultStats() {
  return {};
}

export const serverUsers = [...DEMO_USERS];
export const serverAiSessions = {};
export const serverQuizStats = getDefaultStats();
export const serverExams = [...DEFAULT_EXAMS];
export const serverExamSubmissions = [];

export function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users) && data.users.length > 0) {
        // Filter out legacy dummy users & author duchuy
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        let validUsers = data.users.filter(u => !legacyIds.has(u.id) && u.username !== 'duchuy');
        if (!validUsers.some(u => u.username === 'admin' || u.id === 'user_admin')) {
          validUsers.unshift(DEMO_USERS[0]);
        }
        serverUsers.length = 0;
        serverUsers.push(...(validUsers.length > 0 ? validUsers : DEMO_USERS));
      }
      if (data.aiSessions && typeof data.aiSessions === 'object') {
        for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
        Object.assign(serverAiSessions, data.aiSessions);
      }
      if (data.quizStats && typeof data.quizStats === 'object') {
        for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        for (const [k, v] of Object.entries(data.quizStats)) {
          if (!legacyIds.has(k) && k !== 'user_duchuy' && v.username !== 'duchuy') {
            serverQuizStats[k] = v;
          }
        }
      }
      if (Array.isArray(data.exams)) {
        serverExams.length = 0;
        serverExams.push(...data.exams);
      }
      if (Array.isArray(data.examSubmissions)) {
        serverExamSubmissions.length = 0;
        serverExamSubmissions.push(...data.examSubmissions);
      }
    }
  } catch {
    // In-memory fallback
  }
}

export function getKVConfig() {
  if (typeof process === 'undefined' || !process.env) return { url: '', token: '' };
  const env = process.env;
  const url = env.KV_REST_API_URL ||
              env.UPSTASH_REDIS_REST_URL ||
              env.STORAGE_REST_API_URL ||
              Object.entries(env).find(([k]) => k.endsWith('_REST_API_URL') || k.endsWith('_REDIS_URL'))?.[1] || '';
  const token = env.KV_REST_API_TOKEN ||
                env.UPSTASH_REDIS_REST_TOKEN ||
                env.STORAGE_REST_API_TOKEN ||
                Object.entries(env).find(([k]) => k.endsWith('_REST_API_TOKEN') || k.endsWith('_REDIS_TOKEN'))?.[1] || '';
  return { url, token };
}

export function isKVConfigured() {
  const { url, token } = getKVConfig();
  return Boolean(url && token);
}

export async function fetchFromKV() {
  const { url: KV_URL, token: KV_TOKEN } = getKVConfig();
  if (!KV_URL || !KV_TOKEN || typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`${KV_URL}/get/trr:database`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json && json.result) {
      const data = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
      if (Array.isArray(data.users) && data.users.length > 0) {
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        let validUsers = data.users.filter(u => !legacyIds.has(u.id) && u.username !== 'duchuy');
        if (!validUsers.some(u => u.username === 'admin' || u.id === 'user_admin')) {
          validUsers.unshift(DEMO_USERS[0]);
        }
        serverUsers.length = 0;
        serverUsers.push(...(validUsers.length > 0 ? validUsers : DEMO_USERS));
      }
      if (data.aiSessions && typeof data.aiSessions === 'object') {
        for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
        Object.assign(serverAiSessions, data.aiSessions);
      }
      if (data.quizStats && typeof data.quizStats === 'object') {
        for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        for (const [k, v] of Object.entries(data.quizStats)) {
          if (!legacyIds.has(k) && k !== 'user_duchuy' && v.username !== 'duchuy') {
            serverQuizStats[k] = v;
          }
        }
      }
      if (Array.isArray(data.exams)) {
        serverExams.length = 0;
        serverExams.push(...data.exams);
      }
      if (Array.isArray(data.examSubmissions)) {
        serverExamSubmissions.length = 0;
        serverExamSubmissions.push(...data.examSubmissions);
      }
      return true;
    }
  } catch (err) {
    console.warn('[ServerDataStore] Error loading from KV:', err);
  }
  return false;
}

export async function writeToKV() {
  const { url: KV_URL, token: KV_TOKEN } = getKVConfig();
  if (!KV_URL || !KV_TOKEN || typeof fetch === 'undefined') return false;
  try {
    const payload = JSON.stringify({
      users: serverUsers,
      aiSessions: serverAiSessions,
      quizStats: serverQuizStats,
      exams: serverExams,
      examSubmissions: serverExamSubmissions,
      lastUpdated: new Date().toISOString(),
    });
    const res = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', 'trr:database', payload]),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch (err) {
    console.warn('[ServerDataStore] Error saving to KV:', err);
  }
  return false;
}

export function saveDatabase() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const data = {
      users: serverUsers,
      aiSessions: serverAiSessions,
      quizStats: serverQuizStats,
      exams: serverExams,
      examSubmissions: serverExamSubmissions,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // In-memory fallback for read-only filesystem
  }

  // Also write to Cloud KV if configured
  if (isKVConfigured()) {
    writeToKV().catch(() => {});
  }
}

export async function executeKVCommand(commandArray) {
  const { url: KV_URL, token: KV_TOKEN } = getKVConfig();
  if (!KV_URL || !KV_TOKEN || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandArray),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[ServerDataStore] Error executing KV command:', err);
    return null;
  }
}

/**
 * Saves a single exam submission atomically using Redis HSET.
 * Prevents race conditions and lost data when 100 students submit simultaneously.
 * @param {Object} submission
 * @returns {Promise<boolean>}
 */
export async function saveSubmissionToKV(submission) {
  if (!submission || !submission.examId || !submission.userId) return false;
  try {
    const res = await executeKVCommand(['HSET', `trr:subs:${submission.examId}`, submission.userId, JSON.stringify(submission)]);
    return Boolean(res);
  } catch {
    return false;
  }
}

/**
 * Fetches all submissions for an exam directly from atomic Redis hash.
 * @param {string} examId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchSubmissionsFromKV(examId) {
  if (!examId) return [];
  try {
    const json = await executeKVCommand(['HVALS', `trr:subs:${examId}`]);
    if (json && Array.isArray(json.result)) {
      return json.result.map(item => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
  } catch {
    // fallback
  }
  return [];
}

/**
 * Clears KV submissions for an exam or all exams.
 * @param {string} [examId]
 * @returns {Promise<boolean>}
 */
export async function clearSubmissionsFromKV(examId = null) {
  try {
    if (examId) {
      await executeKVCommand(['DEL', `trr:subs:${examId}`]);
    } else {
      for (const exam of serverExams) {
        if (exam && exam.id) {
          await executeKVCommand(['DEL', `trr:subs:${exam.id}`]);
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Initial load
loadDatabase();
if (isKVConfigured()) {
  fetchFromKV().catch(() => {});
}
