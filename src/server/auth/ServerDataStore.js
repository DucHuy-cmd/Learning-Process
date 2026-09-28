/**
 * @file ServerDataStore.js
 * Persistent Server Database store for multi-device user accounts, AI history sessions, and Quiz Leaderboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USERS } from '../../core/auth/AuthManager.js';
import { INITIAL_LEADERBOARD } from '../../core/quiz/QuizHistoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = process.env.VERCEL 
  ? '/tmp/data' 
  : path.resolve(__dirname, '../../../data');
const DB_FILE = path.join(DB_DIR, 'server_db.json');

function getDefaultStats() {
  return {};
}

export const serverUsers = [...DEMO_USERS];
export const serverAiSessions = {};
export const serverQuizStats = getDefaultStats();

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
      aiSessions: serverAiSessions,
      quizStats: serverQuizStats,
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

// Initial load
loadDatabase();
if (isKVConfigured()) {
  fetchFromKV().catch(() => {});
}
