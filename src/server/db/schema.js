/**
 * @file schema.js
 * Embedded Relational Database Schema DDL for PostgreSQL and In-Memory Engines.
 * Directly embedded in JS to guarantee inclusion in Vercel Serverless Function bundles.
 */

export const SCHEMA_STATEMENTS = [
  // 1. users
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    class_name VARCHAR(64) DEFAULT 'Sinh viên',
    email VARCHAR(128) DEFAULT '',
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    avatar VARCHAR(32) DEFAULT '👨‍🎓',
    role VARCHAR(32) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

  // 2. exams
  `CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    duration_minutes INT NOT NULL DEFAULT 30,
    created_by VARCHAR(64) DEFAULT 'user_admin',
    question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_to JSONB NOT NULL DEFAULT '["all"]'::jsonb,
    exam_code VARCHAR(64) DEFAULT NULL,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    shuffle_options BOOLEAN DEFAULT TRUE,
    max_attempts INT DEFAULT 1,
    is_published BOOLEAN DEFAULT TRUE,
    allow_review BOOLEAN DEFAULT TRUE,
    show_answers_on_complete BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS question_ids JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS assigned_to JSONB DEFAULT '["all"]'::jsonb`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_code VARCHAR(64) DEFAULT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_exams_published ON exams(is_published)`,
  `CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_exams_code ON exams(exam_code)`,

  // 3. exam_submissions
  `CREATE TABLE IF NOT EXISTS exam_submissions (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    exam_title VARCHAR(255) DEFAULT '',
    student_name VARCHAR(128) DEFAULT '',
    student_class VARCHAR(64) DEFAULT '',
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    total_questions INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    time_spent_seconds INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON exam_submissions(exam_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON exam_submissions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON exam_submissions(submitted_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_exam_user_unique ON exam_submissions(exam_id, user_id)`,

  // 4. quiz_stats
  `CREATE TABLE IF NOT EXISTS quiz_stats (
    user_id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(128) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    accuracy INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    last_played TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quiz_stats_score ON quiz_stats(score DESC)`,

  // 5. ai_sessions
  `CREATE TABLE IF NOT EXISTS ai_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) DEFAULT 'Hội thoại học tập',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id)`,

  // 6. custom_questions
  `CREATE TABLE IF NOT EXISTS custom_questions (
    id VARCHAR(64) PRIMARY KEY,
    topic VARCHAR(128) DEFAULT 'Chung',
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer VARCHAR(255) NOT NULL,
    explanation TEXT DEFAULT '',
    difficulty VARCHAR(32) DEFAULT 'medium',
    created_by VARCHAR(64) DEFAULT 'user_admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_custom_questions_topic ON custom_questions(topic)`,

  // 7. imported_files
  `CREATE TABLE IF NOT EXISTS imported_files (
    id VARCHAR(64) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    question_count INT NOT NULL DEFAULT 0,
    exam_title VARCHAR(255) DEFAULT '',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_imported_files_uploaded_at ON imported_files(uploaded_at)`,

  // 8. system_metadata
  `CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_system_metadata_key ON system_metadata(key)`
];

export const SCHEMA_DDL = SCHEMA_STATEMENTS.join(';\n') + ';';
