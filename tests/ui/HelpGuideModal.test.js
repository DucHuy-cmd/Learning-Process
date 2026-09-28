/**
 * @file HelpGuideModal.test.js
 * Unit test suite for HelpGuideModal component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { HelpGuideModal } from '../../src/ui/components/HelpGuideModal.js';

describe('HelpGuideModal (Trung Tâm Hướng Dẫn & Trợ Giúp)', () => {
  let dom;
  let modal;
  let container;
  let onNavigateMock;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="header-actions">
            <button class="btn-icon" id="btnHelpGuideToggle">❓ Hướng dẫn</button>
            <button class="btn-icon" id="btnThemeToggle">☀️ Sáng</button>
          </div>
          <div id="appContainer"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
    });

    global.window = dom.window;
    global.document = dom.window.document;

    container = document.body;
    onNavigateMock = vi.fn();
    modal = new HelpGuideModal({ container, onNavigate: onNavigateMock });
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
  });

  // =========================================================================
  // 1. DOM INITIALIZATION
  // =========================================================================
  describe('DOM Structure & Initial State', () => {
    it('creates backdrop, dialog, header, tabs, and footer in container', () => {
      const backdrop = document.getElementById('helpGuideModal');
      expect(backdrop).not.toBeNull();
      expect(backdrop.getAttribute('role')).toBe('dialog');
      expect(backdrop.getAttribute('aria-modal')).toBe('true');
      expect(backdrop.style.display).toBe('none');

      const dialog = backdrop.querySelector('.help-guide-dialog');
      expect(dialog).not.toBeNull();

      const title = dialog.querySelector('.modal-title');
      expect(title.textContent).toContain('Trung Tâm Hướng Dẫn & Trợ Giúp');

      const tabs = dialog.querySelectorAll('.help-tab-btn');
      expect(tabs.length).toBe(3);
    });

    it('renders the 3 primary tabs: Quickstart, Shortcuts, Tips', () => {
      const tabQuickstart = modal.dialogEl.querySelector('button[data-tab="quickstart"]');
      const tabShortcuts = modal.dialogEl.querySelector('button[data-tab="shortcuts"]');
      const tabTips = modal.dialogEl.querySelector('button[data-tab="tips"]');

      expect(tabQuickstart).not.toBeNull();
      expect(tabShortcuts).not.toBeNull();
      expect(tabTips).not.toBeNull();
      expect(tabQuickstart.classList.contains('active')).toBe(true);
    });
  });

  // =========================================================================
  // 2. LIFECYCLE (OPEN / CLOSE)
  // =========================================================================
  describe('Open & Close Lifecycle', () => {
    it('opens and closes correctly with open() and close()', () => {
      expect(modal.isOpen).toBe(false);

      modal.open('quickstart');
      expect(modal.isOpen).toBe(true);
      expect(modal.backdropEl.style.display).toBe('flex');

      modal.close();
      expect(modal.isOpen).toBe(false);
      expect(modal.backdropEl.style.display).toBe('none');
    });

    it('closes when clicking close button or understand button', () => {
      modal.open();
      const closeBtn = modal.dialogEl.querySelector('#btnCloseHelpGuide');
      closeBtn.click();
      expect(modal.isOpen).toBe(false);

      modal.open();
      const understandBtn = modal.dialogEl.querySelector('#btnHelpUnderstand');
      understandBtn.click();
      expect(modal.isOpen).toBe(false);
    });

    it('closes when clicking on outer backdrop', () => {
      modal.open();
      modal.backdropEl.click();
      expect(modal.isOpen).toBe(false);
    });
  });

  // =========================================================================
  // 3. TAB SWITCHING
  // =========================================================================
  describe('Tab Switching', () => {
    beforeEach(() => {
      modal.open();
    });

    it('switches to Shortcuts tab when clicking its tab button', () => {
      const tabShortcuts = modal.dialogEl.querySelector('button[data-tab="shortcuts"]');
      tabShortcuts.click();

      expect(modal.activeTab).toBe('shortcuts');
      expect(modal.dialogEl.querySelector('.guide-pane-shortcuts')).not.toBeNull();
      expect(modal.dialogEl.textContent).toContain('Chế độ Bút vẽ & Con trỏ Laser');
    });

    it('switches to Tips tab when clicking its tab button', () => {
      const tabTips = modal.dialogEl.querySelector('button[data-tab="tips"]');
      tabTips.click();

      expect(modal.activeTab).toBe('tips');
      expect(modal.dialogEl.querySelector('.guide-pane-tips')).not.toBeNull();
      expect(modal.dialogEl.textContent).toContain('Cú pháp gõ nhanh các phép toán Logic');
    });

    it('switches tabs programmatically with setTab()', () => {
      modal.setTab('tips');
      expect(modal.activeTab).toBe('tips');
      expect(modal.dialogEl.querySelector('.guide-pane-tips')).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. LAB NAVIGATION INTEGRATION
  // =========================================================================
  describe('One-Click Lab Navigation', () => {
    beforeEach(() => {
      modal.open('quickstart');
    });

    it('navigates to Logic Lab and closes modal', () => {
      const btn = modal.dialogEl.querySelector('button[data-nav="logic"]');
      expect(btn).not.toBeNull();
      btn.click();

      expect(onNavigateMock).toHaveBeenCalledWith('logic');
      expect(modal.isOpen).toBe(false);
    });

    it('navigates to Counting Lab and closes modal', () => {
      const btn = modal.dialogEl.querySelector('button[data-nav="counting"]');
      expect(btn).not.toBeNull();
      btn.click();

      expect(onNavigateMock).toHaveBeenCalledWith('counting');
      expect(modal.isOpen).toBe(false);
    });

    it('navigates to Relation Lab and closes modal', () => {
      const btn = modal.dialogEl.querySelector('button[data-nav="relation"]');
      expect(btn).not.toBeNull();
      btn.click();

      expect(onNavigateMock).toHaveBeenCalledWith('relation');
      expect(modal.isOpen).toBe(false);
    });

    it('navigates to Graph Lab and closes modal', () => {
      const btn = modal.dialogEl.querySelector('button[data-nav="lab"]');
      expect(btn).not.toBeNull();
      btn.click();

      expect(onNavigateMock).toHaveBeenCalledWith('lab');
      expect(modal.isOpen).toBe(false);
    });
  });

  // =========================================================================
  // 5. KEYBOARD SHORTCUTS
  // =========================================================================
  describe('Keyboard Shortcuts', () => {
    it('toggles modal when pressing ? key', () => {
      expect(modal.isOpen).toBe(false);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?' }));
      expect(modal.isOpen).toBe(true);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?' }));
      expect(modal.isOpen).toBe(false);
    });

    it('closes modal when pressing Escape key', () => {
      modal.open();
      expect(modal.isOpen).toBe(true);

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(modal.isOpen).toBe(false);
    });

    it('does not toggle modal when typing ? inside an input element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      expect(modal.isOpen).toBe(false);
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(modal.isOpen).toBe(false);

      document.body.removeChild(input);
    });
  });

  // =========================================================================
  // 6. DESTRUCTION & CLEANUP
  // =========================================================================
  describe('Cleanup', () => {
    it('destroy() removes backdrop from DOM and stops reacting to ?', () => {
      modal.destroy();
      expect(document.getElementById('helpGuideModal')).toBeNull();

      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '?' }));
      expect(document.getElementById('helpGuideModal')).toBeNull();
    });
  });
});
