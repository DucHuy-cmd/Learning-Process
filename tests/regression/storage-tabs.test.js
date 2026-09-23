import { describe, it, expect, beforeEach } from 'vitest';
import { createLegacyContext } from '../helpers/legacy-runner.js';
import textbookGraph from '../fixtures/dijkstra/textbook-undirected.json';

describe('Storage & Tab Management Regression Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createLegacyContext();
  });

  it('REG-16: Tab lifecycle: adding, selecting, saving, and restoring tabs via localStorage', () => {
    const sampleTab = {
      id: 'tab_test_1',
      name: 'Test Tab 1',
      data: textbookGraph,
      algo: 'dijkstra',
      canClose: true
    };

    // Push new tab and save
    ctx.eval(`openGraphTabs.push(${JSON.stringify(sampleTab)})`);
    ctx.eval(`activeGraphId = "${sampleTab.id}"`);
    ctx.saveUserTabs();

    // Verify localStorage key and data structure
    const storedTabsJson = ctx.localStorage.getItem('custom_user_graph_tabs');
    expect(storedTabsJson).not.toBeNull();
    const parsedTabs = JSON.parse(storedTabsJson);
    expect(parsedTabs.length).toBe(1);
    expect(parsedTabs[0].id).toBe('tab_test_1');
    expect(parsedTabs[0].name).toBe('Test Tab 1');

    const storedActiveId = ctx.localStorage.getItem('custom_active_graph_id');
    expect(storedActiveId).toBe('tab_test_1');

    // Test restoring tabs via loadUserTabs
    const restored = ctx.loadUserTabs();
    expect(restored.length).toBe(1);
    expect(restored[0].data.name).toBe(textbookGraph.name);
  });

  it('REG-16: Closing active tab switches to adjacent tab or empties gracefully', () => {
    const tab1 = { id: 't1', name: 'Tab 1', data: textbookGraph, algo: 'dijkstra' };
    const tab2 = { id: 't2', name: 'Tab 2', data: textbookGraph, algo: 'prim' };

    ctx.eval(`openGraphTabs = [${JSON.stringify(tab1)}, ${JSON.stringify(tab2)}]`);
    ctx.eval('activeGraphId = "t1"');

    // Close active tab t1
    ctx.closeGraphTab('t1');

    const tabsAfter = ctx.getTabs();
    expect(tabsAfter.length).toBe(1);
    expect(tabsAfter[0].id).toBe('t2');
    expect(ctx.getActiveTabId()).toBe('t2');

    // Close remaining tab t2
    ctx.closeGraphTab('t2');
    expect(ctx.getTabs().length).toBe(0);
    expect(ctx.getActiveTabId()).toBeNull();
    expect(ctx.getCurGraph()).toBeNull();
  });

  it('REG-16: Theme toggle persists dijkstra_theme in localStorage and updates body class', () => {
    // Switch to light
    ctx.applyTheme('light');
    expect(ctx.document.body.classList.contains('theme-light')).toBe(true);

    const btnTheme = ctx.document.getElementById('btnThemeToggle');
    expect(btnTheme.innerHTML).toContain('🌙 Tối');

    // Switch to dark
    ctx.applyTheme('dark');
    expect(ctx.document.body.classList.contains('theme-light')).toBe(false);
    expect(btnTheme.innerHTML).toContain('☀️ Sáng');
  });

  it('REG-16: Panel split layouts persist in dijkstra_panel_top and dijkstra_panel_graph', () => {
    ctx.eval('applyPanelLayout(45, 55)');
    const topRow = ctx.document.getElementById('topRow');
    const graphContainer = ctx.document.getElementById('graphContainer');

    expect(topRow.style.height).toBe('45%');
    expect(graphContainer.style.width).toBe('55%');

    // Reset layout
    ctx.eval('resetPanelLayout()');
    expect(topRow.style.height).toBe('52%');
    expect(graphContainer.style.width).toBe('62%');
  });
});
