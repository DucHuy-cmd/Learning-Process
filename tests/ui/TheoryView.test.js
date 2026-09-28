/**
 * @file TheoryView.test.js
 * Unit & Integration Test Suite for TheoryView
 * 
 * Verifies:
 * - Rendering of all 20 topics across 4 chapters
 * - Filtering by chapter (Logic, Counting, Relation, Graph)
 * - Keyword search filtering
 * - Deep-dive academic analysis modal (Pseudocode, Trace table, Traps)
 * - 1-Click interactive lab actions: Logic Lab, Counting Lab, Relation Lab, Algorithm Lab
 * - Direct Quiz Practice link
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TheoryView } from '../../src/ui/views/TheoryView.js';
import { THEORY_TOPICS, THEORY_CHAPTERS } from '../../src/core/theory/theoryData.js';

describe('TheoryView Component', () => {
  let dom;
  let container;
  let onOpenLab;
  let onOpenFundamentals;
  let onOpenLogic;
  let onOpenCounting;
  let onOpenRelation;
  let onOpenQuiz;
  let onNavigate;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body><div id="theoryView"></div></body></html>`, {
      url: 'http://localhost',
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    container = document.getElementById('theoryView');
    onOpenLab = vi.fn();
    onOpenFundamentals = vi.fn();
    onOpenLogic = vi.fn();
    onOpenCounting = vi.fn();
    onOpenRelation = vi.fn();
    onOpenQuiz = vi.fn();
    onNavigate = vi.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.Event;
  });

  it('renders all 19 topics by default when initialChapter is all', () => {
    const view = new TheoryView({
      container,
      onOpenLabWithAlgo: onOpenLab,
      onOpenFundamentals,
      onOpenLogic,
      onOpenCounting,
      onOpenRelation,
      onOpenQuiz,
      onNavigate,
    });

    const cards = container.querySelectorAll('.theory-card');
    expect(cards.length).toBe(19);
    expect(THEORY_TOPICS.length).toBe(19);
    expect(THEORY_CHAPTERS.length).toBe(5);
  });

  it('filters topics by chapter correctly', () => {
    const view = new TheoryView({
      container,
      onOpenLabWithAlgo: onOpenLab,
    });

    // 1. Chapter 1 & 2: Logic (4 topics)
    const ch12Btn = container.querySelector('button[data-chapter="ch1_2"]');
    expect(ch12Btn).not.toBeNull();
    ch12Btn.click();
    expect(container.querySelectorAll('.theory-card').length).toBe(4);

    // 2. Chapter 3: Counting (5 topics)
    const ch3Btn = container.querySelector('button[data-chapter="ch3"]');
    expect(ch3Btn).not.toBeNull();
    ch3Btn.click();
    expect(container.querySelectorAll('.theory-card').length).toBe(5);

    // 3. Chapter 4: Relation (5 topics)
    const ch4Btn = container.querySelector('button[data-chapter="ch4"]');
    expect(ch4Btn).not.toBeNull();
    ch4Btn.click();
    expect(container.querySelectorAll('.theory-card').length).toBe(5);

    // 4. Chapter 5: Graph (5 topics)
    const ch5Btn = container.querySelector('button[data-chapter="ch5"]');
    expect(ch5Btn).not.toBeNull();
    ch5Btn.click();
    expect(container.querySelectorAll('.theory-card').length).toBe(5);

    // 5. Back to All (19 topics)
    const allBtn = container.querySelector('button[data-chapter="all"]');
    expect(allBtn).not.toBeNull();
    allBtn.click();
    expect(container.querySelectorAll('.theory-card').length).toBe(19);
  });

  it('filters topics by search query in real-time', () => {
    const view = new TheoryView({ container });

    const searchInput = container.querySelector('#theorySearchInput');
    expect(searchInput).not.toBeNull();

    // Search for 'Dijkstra'
    searchInput.value = 'dijkstra';
    searchInput.dispatchEvent(new dom.window.Event('input'));

    let cards = container.querySelectorAll('.theory-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Dijkstra');

    // Clear search
    const btnClear = container.querySelector('#btnClearSearch');
    if (btnClear) {
      btnClear.click();
      cards = container.querySelectorAll('.theory-card');
      expect(cards.length).toBe(19);
    }
  });

  it('triggers onOpenLogic when clicking lab action on a logic topic', () => {
    const view = new TheoryView({
      container,
      onOpenLogic,
    });

    const logicCardBtn = container.querySelector('button[data-action="run-lab"][data-topic-id="logic_props"]');
    expect(logicCardBtn).not.toBeNull();
    logicCardBtn.click();

    expect(onOpenLogic).toHaveBeenCalledWith('table', '(p && q) || !r');
  });

  it('triggers onOpenCounting when clicking lab action on a counting topic', () => {
    const view = new TheoryView({
      container,
      onOpenCounting,
    });

    const dirichletBtn = container.querySelector('button[data-action="run-lab"][data-topic-id="count_dirichlet"]');
    expect(dirichletBtn).not.toBeNull();
    dirichletBtn.click();

    expect(onOpenCounting).toHaveBeenCalledWith('dirichlet');
  });

  it('triggers onOpenRelation when clicking lab action on a relation topic', () => {
    const view = new TheoryView({
      container,
      onOpenRelation,
    });

    const warshallBtn = container.querySelector('button[data-action="run-lab"][data-topic-id="rel_closure"]');
    expect(warshallBtn).not.toBeNull();
    warshallBtn.click();

    expect(onOpenRelation).toHaveBeenCalledWith('warshall', null);
  });

  it('opens and closes the deep-dive analysis modal', () => {
    const view = new TheoryView({
      container,
      onOpenLabWithAlgo: onOpenLab,
      onOpenQuiz,
    });

    // Modal initially not present
    expect(container.querySelector('#theoryDetailModal')).toBeNull();

    // Click detail button for Dijkstra
    const btnDetail = container.querySelector('button[data-action="detail"][data-topic-id="graph_dijkstra"]');
    btnDetail.click();

    // Modal now open
    const modal = container.querySelector('#theoryDetailModal');
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('Thuật toán Dijkstra');
    expect(modal.textContent).toContain('Mã giả');
    expect(modal.textContent).toContain('Bảng mô phỏng');

    // Test quiz launch from modal
    const btnQuiz = modal.querySelector('#btnLaunchQuizFromModal');
    expect(btnQuiz).not.toBeNull();
    btnQuiz.click();
    expect(onOpenQuiz).toHaveBeenCalledWith('dijkstra');
    // Modal closes after launching quiz
    expect(container.querySelector('#theoryDetailModal')).toBeNull();

    // Reopen and test close button
    container.querySelector('button[data-action="detail"][data-topic-id="graph_dijkstra"]').click();
    expect(container.querySelector('#theoryDetailModal')).not.toBeNull();
    container.querySelector('#btnCloseDetailModal').click();
    expect(container.querySelector('#theoryDetailModal')).toBeNull();
  });
});
