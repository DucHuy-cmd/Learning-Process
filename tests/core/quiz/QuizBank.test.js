import { describe, it, expect } from 'vitest';
import {
  STATIC_QUESTION_BANK,
  generateExamPaper,
  exportExamToLatex,
  QUIZ_TOPICS,
  QUIZ_DIFFICULTIES,
} from '../../../src/core/quiz/QuizBank.js';

describe('QuizBank Core Engine & Exam Generator', () => {
  describe('STATIC_QUESTION_BANK Integrity', () => {
    it('contains at least 20 curated academic questions', () => {
      expect(STATIC_QUESTION_BANK.length).toBeGreaterThanOrEqual(20);
    });

    it('ensures each question has complete metadata and valid options', () => {
      STATIC_QUESTION_BANK.forEach(q => {
        expect(q.id).toBeDefined();
        expect(typeof q.id).toBe('string');
        expect(['logic', 'boolean', 'counting', 'relation', 'graph']).toContain(q.topic);
        expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
        expect(q.question).toBeDefined();
        expect(q.question.length).toBeGreaterThan(10);
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBe(4);

        const optionIds = q.options.map(opt => opt.id);
        expect(optionIds).toEqual(['A', 'B', 'C', 'D']);
        expect(['A', 'B', 'C', 'D']).toContain(q.correctId);
        expect(q.explanation).toBeDefined();
        expect(q.explanation.length).toBeGreaterThan(15);
      });
    });

    it('covers all 5 academic chapters: Logic, Boolean, Counting, Relation, and Graph domains', () => {
      const logicQs = STATIC_QUESTION_BANK.filter(q => q.topic === 'logic');
      const booleanQs = STATIC_QUESTION_BANK.filter(q => q.topic === 'boolean');
      const countingQs = STATIC_QUESTION_BANK.filter(q => q.topic === 'counting');
      const relationQs = STATIC_QUESTION_BANK.filter(q => q.topic === 'relation');
      const graphQs = STATIC_QUESTION_BANK.filter(q => q.topic === 'graph');

      expect(STATIC_QUESTION_BANK.length).toBe(125);
      expect(logicQs.length).toBe(25);
      expect(booleanQs.length).toBe(25);
      expect(countingQs.length).toBe(25);
      expect(relationQs.length).toBe(25);
      expect(graphQs.length).toBe(25);
    });
  });

  describe('generateExamPaper()', () => {
    it('generates an exam with requested question count (default 5)', () => {
      const exam = generateExamPaper();
      expect(exam.questions.length).toBe(5);
      expect(exam.totalQuestions).toBe(5);
      expect(exam.examCode).toBeGreaterThanOrEqual(100);
      expect(exam.examCode).toBeLessThan(1000);
    });

    it('generates an exam with 10 questions and builds matching answer key', () => {
      const exam = generateExamPaper({ count: 10 });
      expect(exam.questions.length).toBe(10);
      expect(Object.keys(exam.answerKey).length).toBe(10);

      exam.questions.forEach((q, idx) => {
        const questionNumber = idx + 1;
        expect(exam.answerKey[questionNumber]).toBe(q.correctId);
      });
    });

    it('filters questions by topic when requested', () => {
      ['logic', 'boolean', 'counting', 'relation', 'graph'].forEach(topic => {
        const exam = generateExamPaper({ count: 5, topic });
        exam.questions.forEach(q => {
          expect(q.topic).toBe(topic);
        });
      });
    });

    it('filters questions by difficulty when requested', () => {
      const easyExam = generateExamPaper({ count: 5, difficulty: 'easy' });
      easyExam.questions.forEach(q => {
        expect(q.difficulty).toBe('easy');
      });
    });
  });

  describe('exportExamToLatex()', () => {
    it('generates standard LaTeX source code matching university exam formatting', () => {
      const exam = generateExamPaper({ count: 5 });
      const latex = exportExamToLatex(exam);

      expect(typeof latex).toBe('string');
      expect(latex).toContain('\\documentclass[12pt,a4paper]{article}');
      expect(latex).toContain('\\usepackage{amsmath,amssymb,amsfonts}');
      expect(latex).toContain('\\usepackage{multicol}');
      expect(latex).toContain(`MÃ ĐỀ THI: ${exam.examCode}`);
      expect(latex).toContain('\\section*{PHẦN CÂU HỎI TRẮC NGHIỆM');
      expect(latex).toContain('\\newpage');
      expect(latex).toContain('ĐÁP ÁN & HƯỚNG DẪN CHẤM (DÀNH CHO GIẢNG VIÊN');
      expect(latex).toContain('\\subsection*{1. Bảng Đáp Án Nhanh}');
      expect(latex).toContain('\\subsection*{2. Hướng Dẫn Lời Giải Chi Tiết}');
      expect(latex).toContain('\\end{document}');

      exam.questions.forEach((q) => {
        expect(latex).toContain(q.question);
        expect(latex).toContain(`\\textbf{Đáp án ${q.correctId}.}`);
      });
    });
  });
});
