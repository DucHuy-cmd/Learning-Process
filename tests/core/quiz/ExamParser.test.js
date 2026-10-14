import { describe, it, expect } from 'vitest';
import {
  parseExamText,
  parseExamCsv,
  generateSampleExamText,
  generateSampleExamCsv,
} from '../../../src/core/quiz/ExamParser.js';

describe('ExamParser Test Suite', () => {
  it('parses standard Vietnamese formatted exam text successfully', () => {
    const raw = `
Câu 1: Cho mệnh đề P: "Hôm nay trời mưa". Phủ định của P là?
A. Hôm nay trời không mưa
B. Hôm nay trời mưa rất to
C. Hôm nay trời nắng ráo
D. Hôm nay trời âm u
Đáp án: A
Giải thích: Phủ định của P là không P.

Câu 2: Số tập con của một tập hợp gồm n phần tử là?
A. 2^n
B. n^2
C. 2n
D. n!
Đáp án đúng: A
Lời giải: Mỗi phần tử có 2 khả năng nên là 2^n.
    `;

    const result = parseExamText(raw);
    expect(result.success).toBe(true);
    expect(result.totalCount).toBe(2);
    expect(result.errors.length).toBe(0);

    const q1 = result.questions[0];
    expect(q1.question).toContain('Cho mệnh đề P');
    expect(q1.options.length).toBe(4);
    expect(q1.options[0].text).toBe('Hôm nay trời không mưa');
    expect(q1.correctId).toBe('A');
    expect(q1.explanation).toContain('Phủ định của P');

    const q2 = result.questions[1];
    expect(q2.question).toContain('Số tập con');
    expect(q2.correctId).toBe('A');
    expect(q2.explanation).toContain('Mỗi phần tử');
  });

  it('handles inline options, flexible answer labels, and asterisks', () => {
    const raw = `
1. Đồ thị vô hướng liên thông không chu trình là:
A. Cây   B. Rừng   C. Chu trình   D. Đồ thị đầy đủ
Key: A

2. Phép hội P ∧ Q đúng khi:
*B. Cả P và Q đều đúng
A. Chỉ P đúng
C. Chỉ Q đúng
D. Cả hai đều sai
    `;

    const result = parseExamText(raw);
    expect(result.success).toBe(true);
    expect(result.totalCount).toBe(2);
    expect(result.questions[0].correctId).toBe('A');
    expect(result.questions[1].correctId).toBe('B');
  });

  it('reports descriptive errors for missing questions, options, or answers', () => {
    const emptyResult = parseExamText('');
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.errors.length).toBeGreaterThan(0);

    const invalidRaw = `
Câu 1: Câu này không có đáp án đúng
A. Phương án 1
B. Phương án 2
C. Phương án 3
D. Phương án 4

Câu 2: Câu này thiếu phương án
A. Chỉ có một phương án
Đáp án: A
    `;

    const invalidResult = parseExamText(invalidRaw);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errors.some(e => e.includes('Câu 1') && e.includes('Thiếu đáp án'))).toBe(true);
    expect(invalidResult.errors.some(e => e.includes('Câu 2') && e.includes('phương án'))).toBe(true);
  });

  it('parses CSV exam files with standard headers and semicolon delimiters', () => {
    const sampleCsv = generateSampleExamCsv();
    const result = parseExamCsv(sampleCsv);
    expect(result.success).toBe(true);
    expect(result.totalCount).toBe(5);
    expect(result.questions[0].correctId).toBe('A');
    expect(result.questions[2].correctId).toBe('B');
  });

  it('reports descriptive errors for invalid CSV content', () => {
    const emptyResult = parseExamCsv('');
    expect(emptyResult.success).toBe(false);

    const badHeaders = `Tên sinh viên,Điểm số\nNguyen Van A,10`;
    const badResult = parseExamCsv(badHeaders);
    expect(badResult.success).toBe(false);
    expect(badResult.errors[0]).toContain('Cấu trúc cột CSV không đúng');
  });

  it('generates rich sample exam text that parses cleanly with 100% success', () => {
    const sampleText = generateSampleExamText();
    const result = parseExamText(sampleText);
    expect(result.success).toBe(true);
    expect(result.totalCount).toBe(5);
    expect(result.errors.length).toBe(0);
  });
});
