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
}

// Initial load
loadDatabase();
