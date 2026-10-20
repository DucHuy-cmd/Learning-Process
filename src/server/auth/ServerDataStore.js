/**
 * @file ServerDataStore.js
 * Persistent Server Database store for multi-device user accounts, AI history sessions, and Quiz Leaderboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USERS } from '../../core/auth/AuthManager.js';
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
export const serverCustomQuestions = [];
export const serverImportedFiles = [];
export const serverDeletedUsers = new Set();
export const serverDeletedExams = new Set();
export const serverDeletedImportedFiles = new Set();
export let serverDbResetTime = 0;
export let serverImportedFilesResetTime = 0;

export function markImportedFileDeleted(fileId) {
  if (!fileId) return;
  serverDeletedImportedFiles.add(String(fileId).trim());
}

export function unmarkImportedFileDeleted(fileId) {
  if (!fileId) return;
  serverDeletedImportedFiles.delete(String(fileId).trim());
}

export function isImportedFileDeleted(fileId) {
  if (!fileId) return false;
  return serverDeletedImportedFiles.has(String(fileId).trim());
}

export function recordImportedFilesReset() {
  serverImportedFilesResetTime = Date.now();
  for (const f of serverImportedFiles) {
    if (f && f.id) markImportedFileDeleted(f.id);
  }
}

export function markUserDeleted(identifier) {
  if (!identifier) return;
  serverDeletedUsers.add(String(identifier).trim().toLowerCase());
}

export function unmarkUserDeleted(identifier) {
  if (!identifier) return;
  serverDeletedUsers.delete(String(identifier).trim().toLowerCase());
}

export function isUserDeleted(identifier) {
  if (!identifier) return false;
  return serverDeletedUsers.has(String(identifier).trim().toLowerCase());
}

export function markExamDeleted(examId) {
  if (!examId) return;
  serverDeletedExams.add(String(examId).trim());
}

export function unmarkExamDeleted(examId) {
  if (!examId) return;
  serverDeletedExams.delete(String(examId).trim());
}

export function isExamDeleted(examId) {
  if (!examId) return false;
  return serverDeletedExams.has(String(examId).trim());
}

export function recordDbReset(studentList = []) {
  serverDbResetTime = Date.now();
  if (Array.isArray(studentList)) {
    for (const u of studentList) {
      if (u.id) markUserDeleted(u.id);
      if (u.username) markUserDeleted(u.username);
      if (u.email) markUserDeleted(u.email);
    }
  }
}

export function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.users) && data.users.length > 0) {
        // Filter out legacy dummy users & author duchuy
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        let validUsers = data.users.filter(u => !legacyIds.has(u.id) && u.username !== 'duchuy');
        const adminIdx = validUsers.findIndex(u => u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin');
        if (adminIdx === -1) {
          validUsers.unshift({ ...DEMO_USERS[0] });
        } else {
          validUsers[adminIdx] = {
            ...validUsers[adminIdx],
            ...DEMO_USERS[0],
            role: 'admin',
            username: 'admin',
            password: DEMO_USERS[0].password,
          };
        }
        // Ensure no other accounts have admin role
        validUsers = validUsers.map((u, i) => {
          if (i === (adminIdx === -1 ? 0 : adminIdx)) return u;
          if (u.role === 'admin') return { ...u, role: 'student' };
          return u;
        });
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
      if (Array.isArray(data.customQuestions)) {
        serverCustomQuestions.length = 0;
        serverCustomQuestions.push(...data.customQuestions);
      }
      if (Array.isArray(data.deletedImportedFiles)) {
        serverDeletedImportedFiles.clear();
        for (const item of data.deletedImportedFiles) {
          if (item) serverDeletedImportedFiles.add(String(item).trim());
        }
      }
      if (typeof data.importedFilesResetTime === 'number') {
        serverImportedFilesResetTime = data.importedFilesResetTime;
      }
      if (Array.isArray(data.importedFiles)) {
        serverImportedFiles.length = 0;
        const valid = data.importedFiles.filter(f => !serverDeletedImportedFiles.has(f.id));
        serverImportedFiles.push(...valid);
      }
      if (Array.isArray(data.deletedUsers)) {
        serverDeletedUsers.clear();
        for (const item of data.deletedUsers) {
          if (item) serverDeletedUsers.add(String(item).trim().toLowerCase());
        }
      }
      if (Array.isArray(data.deletedExams)) {
        serverDeletedExams.clear();
        for (const item of data.deletedExams) {
          if (item) serverDeletedExams.add(String(item).trim());
        }
      }
      if (typeof data.dbResetTime === 'number') {
        serverDbResetTime = data.dbResetTime;
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
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json && json.result) {
      const data = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
      if (Array.isArray(data.users) && data.users.length > 0) {
        const legacyIds = new Set(['user_duchuy', 'user_giangvien', 'user_nhatvu', 'user_truongvu', 'user_ngochung']);
        let validUsers = data.users.filter(u => !legacyIds.has(u.id) && u.username !== 'duchuy');
        const adminIdx = validUsers.findIndex(u => u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin');
        if (adminIdx === -1) {
          validUsers.unshift({ ...DEMO_USERS[0] });
        } else {
          validUsers[adminIdx] = {
            ...validUsers[adminIdx],
            ...DEMO_USERS[0],
            role: 'admin',
            username: 'admin',
            password: DEMO_USERS[0].password,
          };
        }
        // Ensure no other accounts have admin role
        validUsers = validUsers.map((u, i) => {
          if (i === (adminIdx === -1 ? 0 : adminIdx)) return u;
          if (u.role === 'admin') return { ...u, role: 'student' };
          return u;
        });
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
      if (Array.isArray(data.customQuestions)) {
        serverCustomQuestions.length = 0;
        serverCustomQuestions.push(...data.customQuestions);
      }
      if (Array.isArray(data.deletedImportedFiles)) {
        serverDeletedImportedFiles.clear();
        for (const item of data.deletedImportedFiles) {
          if (item) serverDeletedImportedFiles.add(String(item).trim());
        }
      }
      if (typeof data.importedFilesResetTime === 'number') {
        serverImportedFilesResetTime = data.importedFilesResetTime;
      }
      if (Array.isArray(data.importedFiles)) {
        serverImportedFiles.length = 0;
        const valid = data.importedFiles.filter(f => !serverDeletedImportedFiles.has(f.id));
        serverImportedFiles.push(...valid);
      }
      if (Array.isArray(data.deletedUsers)) {
        serverDeletedUsers.clear();
        for (const item of data.deletedUsers) {
          if (item) serverDeletedUsers.add(String(item).trim().toLowerCase());
        }
      }
      if (Array.isArray(data.deletedExams)) {
        serverDeletedExams.clear();
        for (const item of data.deletedExams) {
          if (item) serverDeletedExams.add(String(item).trim());
        }
      }
      if (typeof data.dbResetTime === 'number') {
        serverDbResetTime = data.dbResetTime;
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
      deletedUsers: Array.from(serverDeletedUsers),
      deletedExams: Array.from(serverDeletedExams),
      deletedImportedFiles: Array.from(serverDeletedImportedFiles),
      dbResetTime: serverDbResetTime,
      importedFilesResetTime: serverImportedFilesResetTime,
      aiSessions: serverAiSessions,
      quizStats: serverQuizStats,
      exams: serverExams,
      examSubmissions: serverExamSubmissions,
      customQuestions: serverCustomQuestions,
      importedFiles: serverImportedFiles,
      lastUpdated: new Date().toISOString(),
    });
    const res = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', 'trr:database', payload]),
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
      deletedUsers: Array.from(serverDeletedUsers),
      deletedExams: Array.from(serverDeletedExams),
      deletedImportedFiles: Array.from(serverDeletedImportedFiles),
      dbResetTime: serverDbResetTime,
      importedFilesResetTime: serverImportedFilesResetTime,
      aiSessions: serverAiSessions,
      quizStats: serverQuizStats,
      exams: serverExams,
      examSubmissions: serverExamSubmissions,
      customQuestions: serverCustomQuestions,
      importedFiles: serverImportedFiles,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // In-memory fallback for read-only filesystem
  }

  // Also write to Cloud KV if configured
  if (isKVConfigured()) {
    return writeToKV().catch(() => {});
  }
  return Promise.resolve(true);
}

// Initial load
loadDatabase();
if (isKVConfigured()) {
  fetchFromKV().catch(() => {});
}
