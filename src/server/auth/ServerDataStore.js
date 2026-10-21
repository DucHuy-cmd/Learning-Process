import { sqlDb } from '../db/SqlDatabaseAdapter.js';
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

export function recordDbReset(customTimestamp) {
  serverDbResetTime = customTimestamp || Date.now();
  // On full database reset, clear all tombstone sets so clean data can be imported without ghost bans
  serverDeletedUsers.clear();
  serverDeletedExams.clear();
  serverDeletedImportedFiles.clear();
  return serverDbResetTime;
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
  // If Cloud PostgreSQL is configured, it takes full precedence
  if (sqlDb.isCloudEnabled) return false;
  // Fallback to existing cloud storage on Vercel during transition so data is never lost
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

export async function fetchFromPostgres() {
  if (!sqlDb.isCloudEnabled) return false;
  try {
    await sqlDb.initSchema();

    // 1. Load users
    const usersRes = await sqlDb.executeRawPostgres('SELECT * FROM users ORDER BY created_at ASC;');
    if (Array.isArray(usersRes.rows)) {
      serverUsers.length = 0;
      for (const row of usersRes.rows) {
        serverUsers.push({
          id: row.id,
          username: row.username,
          fullName: row.full_name || row.fullName || row.username,
          className: row.class_name || row.className || 'Sinh viên',
          email: row.email || '',
          password: row.password || '123456',
          avatar: row.avatar || '👨‍🎓',
          role: row.role || 'student',
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        });
      }
      const adminIdx = serverUsers.findIndex(u => u.username === 'admin' || u.id === 'user_admin' || u.role === 'admin');
      if (adminIdx === -1) {
        serverUsers.unshift({ ...DEMO_USERS[0] });
      }
    }

    // 2. Load exams
    const examsRes = await sqlDb.executeRawPostgres('SELECT * FROM exams ORDER BY created_at DESC;');
    if (Array.isArray(examsRes.rows)) {
      serverExams.length = 0;
      for (const r of examsRes.rows) {
        if (isExamDeleted(r.id)) continue;
        serverExams.push({
          id: r.id,
          title: r.title,
          durationMinutes: r.duration_minutes || r.durationMinutes || 30,
          createdBy: r.created_by || r.createdBy || 'user_admin',
          questions: typeof r.questions === 'string' ? JSON.parse(r.questions) : (r.questions || []),
          shuffleQuestions: Boolean(r.shuffle_questions),
          shuffleOptions: Boolean(r.shuffle_options),
          maxAttempts: r.max_attempts || 1,
          isPublished: r.is_published !== false,
          allowReview: r.allow_review !== false,
          showAnswersOnComplete: r.show_answers_on_complete !== false,
          createdAt: r.created_at || new Date().toISOString(),
        });
      }
    }

    // 3. Load exam_submissions
    const subRes = await sqlDb.executeRawPostgres('SELECT * FROM exam_submissions ORDER BY submitted_at DESC;');
    if (Array.isArray(subRes.rows)) {
      serverExamSubmissions.length = 0;
      for (const r of subRes.rows) {
        if (isExamDeleted(r.exam_id)) continue;
        serverExamSubmissions.push({
          id: r.id,
          examId: r.exam_id,
          userId: r.user_id,
          examTitle: r.exam_title,
          studentName: r.student_name,
          studentClass: r.student_class,
          answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {}),
          score: parseFloat(r.score) || 0,
          maxScore: parseFloat(r.max_score) || 10,
          totalQuestions: r.total_questions || 0,
          correctCount: r.correct_count || 0,
          timeSpentSeconds: r.time_spent_seconds || 0,
          submittedAt: r.submitted_at || new Date().toISOString(),
        });
      }
    }

    // 4. Load quiz_stats
    const qsRes = await sqlDb.executeRawPostgres('SELECT * FROM quiz_stats;');
    if (Array.isArray(qsRes.rows)) {
      for (const k of Object.keys(serverQuizStats)) delete serverQuizStats[k];
      for (const r of qsRes.rows) {
        serverQuizStats[r.user_id] = {
          fullName: r.full_name,
          score: r.score,
          accuracy: r.accuracy,
          totalAnswered: r.total_answered,
          correctCount: r.correct_count,
          maxStreak: r.max_streak,
          lastPlayed: r.last_played,
        };
      }
    }

    // 5. Load imported_files
    const ifRes = await sqlDb.executeRawPostgres('SELECT * FROM imported_files ORDER BY uploaded_at DESC;');
    if (Array.isArray(ifRes.rows)) {
      serverImportedFiles.length = 0;
      for (const r of ifRes.rows) {
        if (isImportedFileDeleted(r.id)) continue;
        serverImportedFiles.push({
          id: r.id,
          name: r.filename,
          questionCount: r.question_count,
          examTitle: r.exam_title,
          questions: typeof r.questions === 'string' ? JSON.parse(r.questions) : (r.questions || []),
          uploadedAt: r.uploaded_at,
        });
      }
    }

    // 6. Load durable system metadata (e.g. durable dbResetTime, exams_cleared_by_admin)
    try {
      const metaRes = await sqlDb.executeRawPostgres('SELECT key, value FROM system_metadata;');
      if (Array.isArray(metaRes.rows)) {
        for (const m of metaRes.rows) {
          if (m.key === 'db_reset_time') {
            const val = typeof m.value === 'string' ? JSON.parse(m.value) : m.value;
            const ts = val?.timestamp || Number(val);
            if (ts && !isNaN(ts)) {
              serverDbResetTime = ts;
            }
          }
          if (m.key === 'exams_cleared_by_admin') {
            const isCleared = m.value === true || m.value?.cleared === true || String(m.value) === 'true';
            if (isCleared) {
              serverExams.length = 0;
            }
          }
        }
      }
    } catch {}

    return true;
  } catch (err) {
    console.warn('[ServerDataStore] Error loading from Postgres:', err.message);
    return false;
  }
}

export async function saveToPostgres() {
  if (!sqlDb.isCloudEnabled) return false;
  try {
    await sqlDb.initSchema();

    // 1. Clean up users from postgres that are not in serverUsers (except admin)
    if (serverUsers.length > 0) {
      const activeUsernames = serverUsers.map(u => `'${(u.username || '').toLowerCase().replace(/'/g, "''")}'`).join(',');
      await sqlDb.executeRawPostgres(`DELETE FROM users WHERE username != 'admin' AND username NOT IN (${activeUsernames});`);
    } else {
      await sqlDb.executeRawPostgres("DELETE FROM users WHERE username != 'admin';");
    }

    // Upsert active users (keyed on username to allow re-creation without conflicts)
    for (const u of serverUsers) {
      if (!u || !u.id) continue;
      const username = (u.username || '').toLowerCase();
      const fullName = u.fullName || u.username;
      const className = u.className || 'Sinh viên';
      const email = u.email || `${username}@toanrr.edu.vn`;
      const password = u.password || '123456';
      const avatar = u.avatar || '👨‍🎓';
      const role = u.role || 'student';
      const createdAt = u.createdAt || new Date().toISOString();

      await sqlDb.executeRawPostgres(`
        INSERT INTO users (id, username, full_name, class_name, email, password, avatar, role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (username) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          class_name = EXCLUDED.class_name,
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          avatar = EXCLUDED.avatar,
          role = EXCLUDED.role;
      `, [u.id, username, fullName, className, email, password, avatar, role, createdAt]);
    }

    // 2. Upsert exams
    if (serverExams.length > 0) {
      const activeExamIds = serverExams.map(e => `'${String(e.id).replace(/'/g, "''")}'`).join(',');
      await sqlDb.executeRawPostgres(`DELETE FROM exams WHERE id NOT IN (${activeExamIds});`);
    } else {
      await sqlDb.executeRawPostgres('DELETE FROM exams;');
    }

    for (const e of serverExams) {
      if (!e || !e.id) continue;
      await sqlDb.executeRawPostgres(`
        INSERT INTO exams (id, title, duration_minutes, created_by, questions, shuffle_questions, shuffle_options, max_attempts, is_published, allow_review, show_answers_on_complete, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          duration_minutes = EXCLUDED.duration_minutes,
          questions = EXCLUDED.questions,
          is_published = EXCLUDED.is_published;
      `, [
        e.id, 
        e.title, 
        e.durationMinutes || 30, 
        e.createdBy || 'user_admin', 
        JSON.stringify(e.questions || []), 
        Boolean(e.shuffleQuestions), 
        Boolean(e.shuffleOptions), 
        e.maxAttempts || 1, 
        e.isPublished !== false, 
        e.allowReview !== false, 
        e.showAnswersOnComplete !== false, 
        e.createdAt || new Date().toISOString()
      ]);
    }

    // 3. Exam submissions
    if (serverExamSubmissions.length === 0) {
      await sqlDb.executeRawPostgres('DELETE FROM exam_submissions;');
    } else {
      for (const s of serverExamSubmissions) {
        if (!s || !s.id) continue;
        await sqlDb.executeRawPostgres(`
          INSERT INTO exam_submissions (id, exam_id, user_id, exam_title, student_name, student_class, answers, score, max_score, total_questions, correct_count, time_spent_seconds, submitted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO NOTHING;
        `, [
          s.id, s.examId, s.userId, s.examTitle || '', s.studentName || '', s.studentClass || '',
          JSON.stringify(s.answers || {}), s.score || 0, s.maxScore || 10,
          s.totalQuestions || 0, s.correctCount || 0, s.timeSpentSeconds || 0, s.submittedAt || new Date().toISOString()
        ]);
      }
    }

    // 4. Quiz stats
    if (Object.keys(serverQuizStats).length === 0) {
      await sqlDb.executeRawPostgres('DELETE FROM quiz_stats;');
    }

    // 5. Imported files
    if (serverImportedFiles.length > 0) {
      const activeFileIds = serverImportedFiles.map(f => `'${String(f.id).replace(/'/g, "''")}'`).join(',');
      await sqlDb.executeRawPostgres(`DELETE FROM imported_files WHERE id NOT IN (${activeFileIds});`);
      for (const f of serverImportedFiles) {
        if (!f || !f.id) continue;
        await sqlDb.executeRawPostgres(`
          INSERT INTO imported_files (id, filename, question_count, questions, uploaded_at)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          ON CONFLICT (id) DO UPDATE SET
            filename = EXCLUDED.filename,
            question_count = EXCLUDED.question_count,
            questions = EXCLUDED.questions;
        `, [
          f.id,
          f.name || f.filename || 'Đề thi Word',
          f.questionCount || (Array.isArray(f.questions) ? f.questions.length : 0),
          JSON.stringify(f.questions || []),
          f.uploadedAt || new Date().toISOString()
        ]);
      }
    } else {
      await sqlDb.executeRawPostgres('DELETE FROM imported_files;');
    }

    return true;
  } catch (err) {
    console.warn('[ServerDataStore] Error saving to Postgres:', err.message);
    return false;
  }
}

export function saveDatabase() {
  // Sync in-memory states with Relational SQL Database tables
  try {
    sqlDb.tables.users.clear();
    for (const u of serverUsers) {
      if (u && u.id) sqlDb.tables.users.set(u.id, { ...u });
    }
    sqlDb.tables.exams.clear();
    for (const e of serverExams) {
      if (e && e.id) sqlDb.tables.exams.set(e.id, { ...e });
    }
    sqlDb.tables.exam_submissions.clear();
    for (const s of serverExamSubmissions) {
      if (s && s.id) sqlDb.tables.exam_submissions.set(s.id, { ...s });
    }
    sqlDb.tables.custom_questions.clear();
    for (const q of serverCustomQuestions) {
      if (q && q.id) sqlDb.tables.custom_questions.set(q.id, { ...q });
    }
    sqlDb.tables.imported_files.clear();
    for (const f of serverImportedFiles) {
      if (f && f.id) sqlDb.tables.imported_files.set(f.id, { ...f });
    }
  } catch {
    // Graceful fallback
  }

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

  if (sqlDb.isCloudEnabled) {
    return saveToPostgres().catch(() => {});
  }

  if (isKVConfigured()) {
    return writeToKV().catch(() => {});
  }

  return Promise.resolve(true);
}

// Initial load
loadDatabase();
if (sqlDb.isCloudEnabled) {
  fetchFromPostgres().catch(() => {});
} else if (isKVConfigured()) {
  fetchFromKV().catch(() => {});
}

export { sqlDb };
