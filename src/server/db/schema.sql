-- ============================================================================
-- Hệ Thống Cơ Sở Dữ Liệu Quan Hệ SQL (Toán Rời Rạc & Lý Thuyết Đồ Thị)
-- Database Engine: PostgreSQL / Relational SQL Standard
-- Phiên bản: 2.0 (Relational Schema with Referential Integrity & Cascade Deletes)
-- ============================================================================

-- 1. BẢNG TÀI KHOẢN NGƯỜI DÙNG (USERS)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    class_name VARCHAR(64) DEFAULT 'Sinh viên',
    email VARCHAR(128) DEFAULT '',
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    avatar VARCHAR(32) DEFAULT '👨‍🎓',
    role VARCHAR(32) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. BẢNG ĐỀ THI TRẮC NGHIỆM & TỰ LUẬN (EXAMS)
CREATE TABLE IF NOT EXISTS exams (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    created_by VARCHAR(64) DEFAULT 'user_admin',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    shuffle_questions BOOLEAN DEFAULT FALSE,
    shuffle_options BOOLEAN DEFAULT FALSE,
    max_attempts INT DEFAULT 1,
    is_published BOOLEAN DEFAULT TRUE,
    allow_review BOOLEAN DEFAULT TRUE,
    show_answers_on_complete BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exams_published ON exams(is_published);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at);

-- 3. BẢNG KẾT QUẢ BÀI LÀM CỦA SINH VIÊN (EXAM_SUBMISSIONS)
CREATE TABLE IF NOT EXISTS exam_submissions (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
);

CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON exam_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON exam_submissions(submitted_at);

-- 4. BẢNG BẢNG XẾP HẠNG & ĐIỂM LUYỆN TẬP (QUIZ_STATS)
CREATE TABLE IF NOT EXISTS quiz_stats (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(128) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    accuracy INT NOT NULL DEFAULT 0,
    total_answered INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    last_played TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_stats_score ON quiz_stats(score DESC);

-- 5. BẢNG PHIÊN HỘI THOẠI AI TRỢ GIẢNG (AI_SESSIONS)
CREATE TABLE IF NOT EXISTS ai_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Hội thoại học tập',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);

-- 6. BẢNG NGÂN HÀNG CÂU HỎI TÙY CHỈNH (CUSTOM_QUESTIONS)
CREATE TABLE IF NOT EXISTS custom_questions (
    id VARCHAR(64) PRIMARY KEY,
    topic VARCHAR(128) DEFAULT 'Chung',
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer VARCHAR(255) NOT NULL,
    explanation TEXT DEFAULT '',
    difficulty VARCHAR(32) DEFAULT 'medium',
    created_by VARCHAR(64) DEFAULT 'user_admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_questions_topic ON custom_questions(topic);

-- 7. BẢNG QUẢN LÝ TỆP ĐỀ THI WORD/CSV TẢI LÊN (IMPORTED_FILES)
CREATE TABLE IF NOT EXISTS imported_files (
    id VARCHAR(64) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    question_count INT NOT NULL DEFAULT 0,
    exam_title VARCHAR(255) DEFAULT '',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_imported_files_uploaded_at ON imported_files(uploaded_at);
