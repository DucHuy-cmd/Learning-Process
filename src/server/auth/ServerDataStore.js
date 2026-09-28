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
  const statsMap = {};
  for (const item of INITIAL_LEADERBOARD) {
    statsMap[item.userId] = {
      ...item,
      history: [
        {
          id: `quiz_init_${item.userId}`,
          examTitle: 'Đề thi tổng hợp 4 phân môn Toán Rời Rạc',
          score: item.score / 100,
          maxScore: 30,
          accuracy: item.accuracy,
          date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        },
      ],
    };
  }
  return statsMap;
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
        serverUsers.length = 0;
        serverUsers.push(...data.users);
      }
      if (data.aiSessions && typeof data.aiSessions === 'object') {
        for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
        Object.assign(serverAiSessions, data.aiSessions);
      }
      if (data.quizStats && typeof data.quizStats === 'object') {
        for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
        Object.assign(serverQuizStats, data.quizStats);
      }
    }
  } catch {
    // In-memory fallback
  }
}

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function isKVConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

export async function fetchFromKV() {
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
        serverUsers.length = 0;
        serverUsers.push(...data.users);
      }
      if (data.aiSessions && typeof data.aiSessions === 'object') {
        for (const k of Object.keys(serverAiSessions)) delete serverAiSessions[k];
        Object.assign(serverAiSessions, data.aiSessions);
      }
      if (data.quizStats && typeof data.quizStats === 'object') {
        for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
        Object.assign(serverQuizStats, data.quizStats);
      }
      return true;
    }
  } catch (err) {
    console.warn('[ServerDataStore] Error loading from KV:', err);
  }
  return false;
}

export async function writeToKV() {
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
  if (KV_URL && KV_TOKEN) {
    writeToKV().catch(() => {});
  }
}

// Initial load
loadDatabase();
if (KV_URL && KV_TOKEN) {
  fetchFromKV().catch(() => {});
}
