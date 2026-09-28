/**
 * @file TeacherAnnotationTool.test.js
 * Comprehensive unit test suite for Teacher Presentation, Drawing Pen & Laser Pointer Tool.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TeacherAnnotationTool } from '../../src/ui/components/TeacherAnnotationTool.js';

describe('TeacherAnnotationTool (Chế độ Giảng dạy: Bút vẽ & Laser Pointer)', () => {
  let dom;
  let tool;
  let container;
  let headerBtn;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="header-actions">
            <button class="btn-icon" id="btnTeacherToolsToggle">✏️ Bút giảng dạy</button>
            <button class="btn-icon" id="btnThemeToggle">☀️ Sáng</button>
          </div>
          <div id="appContainer"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);

    container = document.body;
    headerBtn = document.getElementById('btnTeacherToolsToggle');
    tool = new TeacherAnnotationTool({ container });
  });

  afterEach(() => {
    if (tool) {
      tool.destroy();
    }
  });

  // =========================================================================
  // 1. DOM INITIALIZATION
  // =========================================================================
  describe('DOM Structure and Setup', () => {
    it('creates canvas and floating dock toolbar in container', () => {
      const canvas = document.getElementById('teacherAnnotationCanvas');
      const dock = document.getElementById('teacherToolsDock');
      const badge = document.getElementById('teacherMiniBadge');

      expect(canvas).not.toBeNull();
      expect(dock).not.toBeNull();
      expect(badge).toBeNull(); // Floating mini badge was removed per UX requirement

      expect(canvas.tagName.toLowerCase()).toBe('canvas');
      expect(dock.getAttribute('role')).toBe('toolbar');

      // Default inactive states
      expect(canvas.style.display).toBe('none');
      expect(dock.style.display).toBe('none');
    });

    it('renders all teaching tools in the dock toolbar', () => {
      const dock = document.getElementById('teacherToolsDock');
      const tools = ['laser', 'pen', 'highlighter', 'arrow', 'rect', 'eraser'];

      tools.forEach((toolName) => {
        const btn = dock.querySelector(`button[data-tool="${toolName}"]`);
        expect(btn).not.toBeNull();
      });

      // Default selected tool is laser
      const laserBtn = dock.querySelector('button[data-tool="laser"]');
      expect(laserBtn.classList.contains('active')).toBe(true);
    });

    it('renders color swatches and size selectors', () => {
      const dock = document.getElementById('teacherToolsDock');

      const redDot = dock.querySelector('button[data-color="#ef4444"]');
      const yellowDot = dock.querySelector('button[data-color="#facc15"]');
      const greenDot = dock.querySelector('button[data-color="#10b981"]');
      expect(redDot).not.toBeNull();
      expect(yellowDot).not.toBeNull();
      expect(greenDot).not.toBeNull();
      expect(redDot.classList.contains('selected')).toBe(true);

      const sizeS = dock.querySelector('button[data-size="2.5"]');
      const sizeM = dock.querySelector('button[data-size="4.5"]');
      const sizeL = dock.querySelector('button[data-size="8"]');
      expect(sizeS).not.toBeNull();
      expect(sizeM).not.toBeNull();
      expect(sizeL).not.toBeNull();
    });

    it('renders interactive action controls (click-through, undo, clear, export, close)', () => {
      const dock = document.getElementById('teacherToolsDock');
      expect(dock.querySelector('#btnToggleClickThrough')).not.toBeNull();
      expect(dock.querySelector('#btnUndoStroke')).not.toBeNull();
      expect(dock.querySelector('#btnClearAllStrokes')).not.toBeNull();
      expect(dock.querySelector('#btnExportAnnotation')).not.toBeNull();
      expect(dock.querySelector('#btnCloseTeacherTools')).not.toBeNull();
    });
  });

  // =========================================================================
  // 2. ACTIVATION / DEACTIVATION LIFECYCLE
  // =========================================================================
  describe('Activation & Deactivation Lifecycle', () => {
    it('activates and deactivates correctly with toggle()', () => {
      expect(tool.isActive).toBe(false);

      // 1. Activate
      tool.activate();
      expect(tool.isActive).toBe(true);
      expect(tool.canvas.style.display).toBe('block');
      expect(tool.dockEl.style.display).toBe('flex');
      expect(headerBtn.classList.contains('active')).toBe(true);

      // 2. Deactivate
      tool.deactivate();
      expect(tool.isActive).toBe(false);
      expect(tool.canvas.style.display).toBe('none');
      expect(tool.dockEl.style.display).toBe('none');
      expect(headerBtn.classList.contains('active')).toBe(false);

      // 3. Toggle back to active
      tool.toggle();
      expect(tool.isActive).toBe(true);
    });

    it('toggles when clicking the header toggle button', () => {
      expect(tool.isActive).toBe(false);
      headerBtn.click();
      tool.toggle(); // simulate app.js toggle on headerBtn click
      expect(tool.isActive).toBe(true);
    });

    it('closes when clicking the close button on the dock toolbar', () => {
      tool.activate();
      const closeBtn = document.getElementById('btnCloseTeacherTools');
      closeBtn.click();
      expect(tool.isActive).toBe(false);
    });
  });

  // =========================================================================
  // 3. TOOL SELECTION & CONFIGURATION
  // =========================================================================
  describe('Tool Switching & Settings', () => {
    beforeEach(() => {
      tool.activate();
    });

    it('switches tools via setTool() and updates UI active states', () => {
      const penBtn = tool.dockEl.querySelector('button[data-tool="pen"]');
      const laserBtn = tool.dockEl.querySelector('button[data-tool="laser"]');

      tool.setTool('pen');
      expect(tool.currentTool).toBe('pen');
      expect(penBtn.classList.contains('active')).toBe(true);
      expect(laserBtn.classList.contains('active')).toBe(false);

      tool.setTool('highlighter');
      expect(tool.currentTool).toBe('highlighter');

      tool.setTool('arrow');
      expect(tool.currentTool).toBe('arrow');

      tool.setTool('rect');
      expect(tool.currentTool).toBe('rect');

      tool.setTool('eraser');
      expect(tool.currentTool).toBe('eraser');
    });

    it('switches tool when clicking on dock tool buttons', () => {
      const highlighterBtn = tool.dockEl.querySelector('button[data-tool="highlighter"]');
      highlighterBtn.click();
      expect(tool.currentTool).toBe('highlighter');
    });

    it('sets color and updates palette swatch selection', () => {
      tool.setColor('#10b981');
      expect(tool.currentColor).toBe('#10b981');

      const greenDot = tool.dockEl.querySelector('button[data-color="#10b981"]');
      const redDot = tool.dockEl.querySelector('button[data-color="#ef4444"]');
      expect(greenDot.classList.contains('selected')).toBe(true);
      expect(redDot.classList.contains('selected')).toBe(false);

      // Click blue swatch
      const blueDot = tool.dockEl.querySelector('button[data-color="#38bdf8"]');
      blueDot.click();
      expect(tool.currentColor).toBe('#38bdf8');
    });

    it('sets size and updates size pills', () => {
      tool.setSize(8);
      expect(tool.currentSize).toBe(8);

      const sizeL = tool.dockEl.querySelector('button[data-size="8"]');
      expect(sizeL.classList.contains('active')).toBe(true);

      const sizeS = tool.dockEl.querySelector('button[data-size="2.5"]');
      sizeS.click();
      expect(tool.currentSize).toBe(2.5);
    });
  });

  // =========================================================================
  // 4. CLICK-THROUGH INTERACTION MODE
  // =========================================================================
  describe('Click-Through (Tương tác bài giảng) Mode', () => {
    beforeEach(() => {
      tool.activate();
    });

    it('starts with pointerEvents auto in pen/laser mode, then passes through in click-through mode', () => {
      expect(tool.isClickThrough).toBe(false);
      expect(tool.canvas.style.pointerEvents).toBe('auto');

      // Enable click-through
      tool.toggleClickThrough();
      expect(tool.isClickThrough).toBe(true);
      expect(tool.canvas.style.pointerEvents).toBe('none');

      const clickThroughBtn = tool.dockEl.querySelector('#btnToggleClickThrough');
      expect(clickThroughBtn.classList.contains('active-clickthrough')).toBe(true);
      expect(clickThroughBtn.textContent).toContain('Đang bấm web');

      // Disable click-through
      tool.toggleClickThrough();
      expect(tool.isClickThrough).toBe(false);
      expect(tool.canvas.style.pointerEvents).toBe('auto');
      expect(clickThroughBtn.classList.contains('active-clickthrough')).toBe(false);
      expect(clickThroughBtn.textContent).toContain('Tương tác');
    });

    it('toggles click-through when clicking button in dock', () => {
      const clickThroughBtn = tool.dockEl.querySelector('#btnToggleClickThrough');
      clickThroughBtn.click();
      expect(tool.isClickThrough).toBe(true);
      clickThroughBtn.click();
      expect(tool.isClickThrough).toBe(false);
    });
  });

  // =========================================================================
  // 5. DRAWING, STROKES, UNDO, CLEAR
  // =========================================================================
  describe('Drawing Operations & History Stack', () => {
    beforeEach(() => {
      tool.activate();
    });

    it('draws a pen stroke on pointer events and records it in strokes history', () => {
      tool.setTool('pen');

      tool._onPointerDown({ clientX: 100, clientY: 100, preventDefault: () => {} });
      expect(tool.isDrawing).toBe(true);
      expect(tool.currentStroke).not.toBeNull();
      expect(tool.currentStroke.points.length).toBe(1);

      tool._onPointerMove({ clientX: 120, clientY: 130, preventDefault: () => {} });
      tool._onPointerMove({ clientX: 140, clientY: 160, preventDefault: () => {} });
      expect(tool.currentStroke.points.length).toBe(3);

      tool._onPointerUp();
      expect(tool.isDrawing).toBe(false);
      expect(tool.strokes.length).toBe(1);
      expect(tool.strokes[0].type).toBe('pen');
    });

    it('records arrow and rectangle strokes with start and end points', () => {
      // 1. Arrow
      tool.setTool('arrow');
      tool._onPointerDown({ clientX: 50, clientY: 50, preventDefault: () => {} });
      tool._onPointerMove({ clientX: 200, clientY: 150, preventDefault: () => {} });
      tool._onPointerUp();

      expect(tool.strokes.length).toBe(1);
      expect(tool.strokes[0].type).toBe('arrow');
      expect(tool.strokes[0].end).toEqual({ x: 200, y: 150 });

      // 2. Rectangle
      tool.setTool('rect');
      tool._onPointerDown({ clientX: 10, clientY: 10, preventDefault: () => {} });
      tool._onPointerMove({ clientX: 80, clientY: 60, preventDefault: () => {} });
      tool._onPointerUp();

      expect(tool.strokes.length).toBe(2);
      expect(tool.strokes[1].type).toBe('rect');
      expect(tool.strokes[1].end).toEqual({ x: 80, y: 60 });
    });

    it('erases strokes intersecting eraser path', () => {
      // Create a stroke at (100, 100)
      tool.setTool('pen');
      tool._onPointerDown({ clientX: 100, clientY: 100, preventDefault: () => {} });
      tool._onPointerMove({ clientX: 105, clientY: 105, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(1);

      // Erase near (102, 102)
      tool.setTool('eraser');
      tool._onPointerDown({ clientX: 102, clientY: 102, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(0);
    });

    it('undo() removes the last stroke', () => {
      tool.setTool('pen');
      tool._onPointerDown({ clientX: 10, clientY: 10, preventDefault: () => {} });
      tool._onPointerUp();
      tool._onPointerDown({ clientX: 20, clientY: 20, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(2);

      tool.undo();
      expect(tool.strokes.length).toBe(1);

      tool.undo();
      expect(tool.strokes.length).toBe(0);

      // Calling undo on empty stack does not crash
      tool.undo();
      expect(tool.strokes.length).toBe(0);
    });

    it('undo button in dock triggers undo()', () => {
      tool.setTool('pen');
      tool._onPointerDown({ clientX: 10, clientY: 10, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(1);

      const undoBtn = tool.dockEl.querySelector('#btnUndoStroke');
      undoBtn.click();
      expect(tool.strokes.length).toBe(0);
    });

    it('clear() and clear button empty all strokes and trails', () => {
      tool.setTool('pen');
      tool._onPointerDown({ clientX: 10, clientY: 10, preventDefault: () => {} });
      tool._onPointerUp();
      tool._onPointerDown({ clientX: 20, clientY: 20, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(2);

      const clearBtn = tool.dockEl.querySelector('#btnClearAllStrokes');
      clearBtn.click();
      expect(tool.strokes.length).toBe(0);
      expect(tool.laserTrail.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. LASER POINTER & ANIMATIONS
  // =========================================================================
  describe('Laser Pointer Feature', () => {
    beforeEach(() => {
      tool.activate();
      tool.setTool('laser');
    });

    it('tracks pointer movement for laser comet trail', () => {
      tool._onPointerMove({ clientX: 250, clientY: 300, preventDefault: () => {} });
      expect(tool.laserPos).toEqual({ x: 250, y: 300 });
      expect(tool.laserTrail.length).toBe(1);
      expect(tool.laserTrail[0].x).toBe(250);
      expect(tool.laserTrail[0].y).toBe(300);
    });

    it('creates radar pulse ripple on laser pointer click', () => {
      tool._onPointerDown({ clientX: 400, clientY: 200, preventDefault: () => {} });
      expect(tool.laserRipples.length).toBe(1);
      expect(tool.laserRipples[0].x).toBe(400);
      expect(tool.laserRipples[0].y).toBe(200);
    });
  });

  // =========================================================================
  // 7. KEYBOARD SHORTCUTS
  // =========================================================================
  describe('Teacher Keyboard Shortcuts', () => {
    beforeEach(() => {
      tool.activate();
    });

    it('switches tools with L, P, H, A, R, E', () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'p' }));
      expect(tool.currentTool).toBe('pen');

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'h' }));
      expect(tool.currentTool).toBe('highlighter');

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a' }));
      expect(tool.currentTool).toBe('arrow');

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r' }));
      expect(tool.currentTool).toBe('rect');

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e' }));
      expect(tool.currentTool).toBe('eraser');

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'l' }));
      expect(tool.currentTool).toBe('laser');
    });

    it('toggles click-through mode with Space or M', () => {
      expect(tool.isClickThrough).toBe(false);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ' }));
      expect(tool.isClickThrough).toBe(true);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm' }));
      expect(tool.isClickThrough).toBe(false);
    });

    it('undoes with Ctrl+Z', () => {
      tool.setTool('pen');
      tool._onPointerDown({ clientX: 10, clientY: 10, preventDefault: () => {} });
      tool._onPointerUp();
      expect(tool.strokes.length).toBe(1);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
      expect(tool.strokes.length).toBe(0);
    });

    it('deactivates with Escape', () => {
      expect(tool.isActive).toBe(true);
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(tool.isActive).toBe(false);
    });

    it('ignores shortcuts when user is typing in an input element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      tool.setTool('laser');
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      expect(tool.currentTool).toBe('laser'); // Not changed to pen

      document.body.removeChild(input);
    });
  });

  // =========================================================================
  // 8. CLEANUP & DESTROY
  // =========================================================================
  describe('Cleanup & Destruction', () => {
    it('destroy() removes canvas, dock, and mini badge from the DOM', () => {
      tool.destroy();

      expect(document.getElementById('teacherAnnotationCanvas')).toBeNull();
      expect(document.getElementById('teacherToolsDock')).toBeNull();
      expect(document.getElementById('teacherMiniBadge')).toBeNull();
    });
  });
});
