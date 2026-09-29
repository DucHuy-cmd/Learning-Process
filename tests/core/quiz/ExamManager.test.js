import { describe, it, expect, beforeEach } from 'vitest';
import { ExamManager, DEFAULT_EXAMS } from '../../../src/core/quiz/ExamManager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('ExamManager Core Module', () => {
  let storage;
  let manager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new ExamManager({ storage });
  });

  it('initializes with default seed exam', () => {
    const exams = manager.getExams();
    expect(exams.length).toBeGreaterThanOrEqual(1);
    expect(exams[0].id).toBe(DEFAULT_EXAMS[0].id);
    expect(exams[0].title).toContain('Khảo Sát Năng Lực');
    expect(exams[0].assignedTo).toContain('all');
  });

  it('keeps exams and submissions in memory when storage is unavailable', () => {
    const memoryManager = new ExamManager({ storage: null });
    const created = memoryManager.createExam({
      title: 'Đề kiểm tra bộ nhớ',
      questionIds: ['logic_q01'],
    });

    expect(created.success).toBe(true);
    expect(memoryManager.getExamById(created.exam.id)).toEqual(created.exam);

    const submitted = memoryManager.submitExam({
      examId: created.exam.id,
      userId: 'user_memory_test',
      answers: { logic_q01: 'B' },
    });

    expect(submitted.success).toBe(true);
    expect(memoryManager.getSubmission(created.exam.id, 'user_memory_test')).toEqual(submitted.submission);
  });

  it('rejects submissions from students who were not assigned the exam', () => {
    const created = manager.createExam({
      title: 'Đề chỉ dành cho một sinh viên',
      questionIds: ['logic_q01'],
      assignedTo: ['user_assigned'],
    });

    const result = manager.submitExam({
      examId: created.exam.id,
      userId: 'user_not_assigned',
      answers: { logic_q01: 'B' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('không được giao');
  });

  it('allows admin to create a new exam assigned to specific students or all', () => {
    const res = manager.createExam({
      title: 'Kiểm tra 15 phút: Mệnh đề & Vị từ',
      durationMinutes: 15,
      questionIds: ['logic_q01', 'logic_q02', 'logic_q03'],
      assignedTo: ['user_sv_01', 'user_sv_02'],
    });

    expect(res.success).toBe(true);
    expect(res.exam.id).toBeDefined();
    expect(res.exam.durationMinutes).toBe(15);
    expect(res.exam.questionIds.length).toBe(3);

    const examsForSv1 = manager.getExamsForUser('user_sv_01');
    expect(examsForSv1.some(e => e.id === res.exam.id)).toBe(true);

    const examsForSv3 = manager.getExamsForUser('user_sv_03');
    // sv3 has the default 'all' exam, but not the specific exam
    expect(examsForSv3.some(e => e.id === res.exam.id)).toBe(false);
  });

  it('grades submissions on standard Scale 10 and prevents re-submission (1 attempt only)', () => {
    const exam = manager.getExams()[0];
    const qCount = exam.questionIds.length;

    // Student 1 submits
    const subRes1 = manager.submitExam({
      examId: exam.id,
      userId: 'user_sv_01',
      userInfo: { username: 'sv_hoanganh', fullName: 'Hoàng Anh', className: 'K66-CNTT' },
      answers: {
        [exam.questionIds[0]]: 'B', // logic_q01 correct is B
      },
      timeSpentSeconds: 300,
    });

    expect(subRes1.success).toBe(true);
    expect(subRes1.submission.score).toBeGreaterThanOrEqual(0);
    expect(subRes1.submission.score).toBeLessThanOrEqual(10);
    expect(subRes1.submission.totalQuestions).toBe(qCount);

    // Second attempt MUST be blocked!
    const subRes2 = manager.submitExam({
      examId: exam.id,
      userId: 'user_sv_01',
      userInfo: { username: 'sv_hoanganh' },
      answers: {},
    });

    expect(subRes2.success).toBe(false);
    expect(subRes2.error).toContain('1 lần duy nhất');
  });

  it('computes official leaderboard sorted by Average GPA (Điểm Trung Bình Thang 10)', () => {
    const exam = manager.getExams()[0];

    // SV1 submits with score 10/10
    const answers10 = {};
    // Give all correct answers for sv1
    answers10['logic_q01'] = 'B';
    answers10['logic_q03'] = 'B';
    answers10['circuit_q01'] = 'C';
    answers10['count_q01'] = 'B';
    answers10['count_q07'] = 'B';
    answers10['count_q12'] = 'C';
    answers10['rel_q01'] = 'B';
    answers10['rel_q03'] = 'A';
    answers10['graph_q01'] = 'A';
    answers10['dijkstra_q01'] = 'B';

    manager.submitExam({
      examId: exam.id,
      userId: 'user_sv_top',
      userInfo: { username: 'sv_top', fullName: 'Thủ Khoa', className: 'K66' },
      answers: answers10,
      timeSpentSeconds: 150,
    });

    // SV2 submits with 5/10
    manager.submitExam({
      examId: exam.id,
      userId: 'user_sv_mid',
      userInfo: { username: 'sv_mid', fullName: 'Trung Bình', className: 'K66' },
      answers: {
        'logic_q01': 'B',
        'logic_q03': 'B',
        'circuit_q01': 'C',
        'count_q01': 'B',
        'rel_q03': 'A',
      },
      timeSpentSeconds: 200,
    });

    const leaderboard = manager.getLeaderboard(10);
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].username).toBe('sv_top');
    expect(leaderboard[0].averageScore).toBe(10);
    expect(leaderboard[0].rankBadge).toBe('🥇');
    expect(leaderboard[1].username).toBe('sv_mid');
    expect(leaderboard[1].averageScore).toBe(5);
    expect(leaderboard[1].rankBadge).toBe('🥈');
  });
});
