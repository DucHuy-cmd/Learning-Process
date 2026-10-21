import { describe, it, expect, beforeEach } from 'vitest';
import { SqlDatabaseAdapter } from '../../src/server/db/SqlDatabaseAdapter.js';

describe('SqlDatabaseAdapter (Relational SQL Engine)', () => {
  let db;

  beforeEach(async () => {
    db = new SqlDatabaseAdapter();
    await db.initSchema();
  });

  it('initializes schema and tables successfully', () => {
    const status = db.getStatus();
    expect(status.engine).toContain('PostgreSQL Relational DB');
    expect(status.tables.users).toBe(0);
    expect(status.tables.exams).toBe(0);
  });

  it('inserts and selects records in relational tables', async () => {
    const user = await db.insert('users', {
      id: 'sv_01',
      username: 'nguyenvana',
      full_name: 'Nguyễn Văn A',
      class_name: 'K66-CNTT',
    });

    expect(user.id).toBe('sv_01');
    expect(user.username).toBe('nguyenvana');

    const found = await db.select('users', u => u.username === 'nguyenvana');
    expect(found.length).toBe(1);
    expect(found[0].full_name).toBe('Nguyễn Văn A');
  });

  it('enforces UNIQUE constraint on username', async () => {
    await db.insert('users', { id: 'u1', username: 'student_dupe', full_name: 'Học viên 1' });

    await expect(async () => {
      await db.insert('users', { id: 'u2', username: 'STUDENT_DUPE', full_name: 'Học viên 2' });
    }).rejects.toThrow(/Duplicate username/);
  });

  it('performs batchInsert efficiently', async () => {
    const batch = [
      { username: 'batch1', full_name: 'B1' },
      { username: 'batch2', full_name: 'B2' },
      { username: 'batch1', full_name: 'Dupe' }, // dupe should be skipped
    ];

    const res = await db.batchInsert('users', batch);
    expect(res.addedCount).toBe(2);
    expect(res.skippedCount).toBe(1);

    const all = await db.select('users');
    expect(all.length).toBe(2);
  });

  it('cascades deletion from exam to exam_submissions (ON DELETE CASCADE)', async () => {
    // 1. Create exam
    await db.insert('exams', { id: 'exam_graph_01', title: 'Đề thi đồ thị' });

    // 2. Create user
    await db.insert('users', { id: 'user_cand_01', username: 'cand1', full_name: 'Thí sinh 1' });

    // 3. Create submissions
    await db.insert('exam_submissions', {
      id: 'sub_01',
      exam_id: 'exam_graph_01',
      user_id: 'user_cand_01',
      score: 10,
    });

    let subs = await db.select('exam_submissions');
    expect(subs.length).toBe(1);

    // 4. Delete exam -> must cascade delete submission
    await db.delete('exams', e => e.id === 'exam_graph_01');

    subs = await db.select('exam_submissions');
    expect(subs.length).toBe(0);
  });

  it('cascades deletion from user to submissions, ai_sessions, and quiz_stats', async () => {
    await db.insert('users', { id: 'u_cascade', username: 'ucascade', full_name: 'User Cascade' });
    await db.insert('exams', { id: 'e_test', title: 'E Test' });
    await db.insert('exam_submissions', { id: 's1', user_id: 'u_cascade', exam_id: 'e_test' });
    await db.insert('ai_sessions', { id: 'a1', user_id: 'u_cascade', title: 'AI chat' });

    // Delete user
    await db.delete('users', u => u.id === 'u_cascade');

    expect((await db.select('exam_submissions', s => s.user_id === 'u_cascade')).length).toBe(0);
    expect((await db.select('ai_sessions', a => a.user_id === 'u_cascade')).length).toBe(0);
  });

  it('supports ping and metrics checking', async () => {
    const pingRes = await db.ping();
    expect(pingRes.isConnected).toBe(true);
    expect(pingRes.latencyMs).toBeGreaterThanOrEqual(1);

    const status = db.getStatus();
    expect(status.storageMode).toBeDefined();
    expect(status.tables).toBeDefined();
  });
});
