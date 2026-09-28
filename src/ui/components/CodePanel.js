/**
 * @file CodePanel.js
 * Real Source Code Viewer Component with Single-Pass Tokenizer Syntax Highlighting,
 * Active Line Tracking, Language Switching (C++, Python, C, Java), Copy, Download,
 * and Fullscreen Focus Mode.
 */

import { getCodeExample, SUPPORTED_LANGUAGES } from '../../app/code-examples/index.js';

export class CodePanel {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {string} [options.algorithmKey='dijkstra']
   * @param {string} [options.languageKey='cpp']
   * @param {Function} [options.onLanguageChange] - Callback invoked when user switches language
   * @param {Function} [options.onFullscreenToggle] - Callback invoked when user toggles fullscreen
   */
  constructor({ container, algorithmKey = 'dijkstra', languageKey = 'cpp', onLanguageChange, onFullscreenToggle } = {}) {
    this.container = container;
    this.currentAlgo = algorithmKey;
    this.currentLang = languageKey;
    this.currentGraph = null;
    this.graphOptions = {};
    this.activeLines = [];
    this.onLanguageChange = onLanguageChange || (() => {});
    this.onFullscreenToggle = onFullscreenToggle || (() => {});

    this._render();
  }

  _render() {
    if (!this.container) return;

    const example = this.getCurrentCodeExample();
    const langOptionsHtml = SUPPORTED_LANGUAGES.map(l =>
      `<option value="${l.key}" ${l.key === this.currentLang ? 'selected' : ''}>${l.name}</option>`
    ).join('');

    this.container.innerHTML = `
      <div class="code-panel">
        <div class="code-panel-header">
          <div class="code-header-left">
            <span class="code-panel-title">SOURCE CODE</span>
            <span class="code-algo-badge" id="codeAlgoBadge">${escapeHtml(example.title)}</span>
          </div>
          <div class="code-header-right">
            <div class="code-lang-wrap">
              <label for="codeLangSelect" class="code-lang-label">Ngôn ngữ:</label>
              <select id="codeLangSelect" class="form-select code-lang-select" title="Chọn ngôn ngữ lập trình">
                ${langOptionsHtml}
              </select>
            </div>
            <button type="button" class="btn-sm code-btn" id="btnCopyCode" title="Sao chép toàn bộ mã nguồn vào clipboard">
              📋 Sao chép
            </button>
            <button type="button" class="btn-sm code-btn" id="btnDownloadCode" title="Tải xuống tệp mã nguồn">
              💾 Tải về
            </button>
            <button type="button" class="btn-sm code-btn btn-fullscreen" id="btnCodeFullscreen" title="Mở rộng / Thu nhỏ mã nguồn toàn màn hình">
              ⛶
            </button>
          </div>
        </div>
        <div class="code-panel-body" id="codeLinesWrap">
          ${this._renderLines(example.lines)}
        </div>
      </div>
    `;

    this.badgeEl = this.container.querySelector('#codeAlgoBadge');
    this.langSelect = this.container.querySelector('#codeLangSelect');
    this.btnCopy = this.container.querySelector('#btnCopyCode');
    this.btnDownload = this.container.querySelector('#btnDownloadCode');
    this.btnFullscreen = this.container.querySelector('#btnCodeFullscreen');
    this.linesWrap = this.container.querySelector('#codeLinesWrap');

    this._bindEvents();
  }

  _bindEvents() {
    if (this.langSelect) {
      this.langSelect.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }

    if (this.btnCopy) {
      this.btnCopy.addEventListener('click', () => {
        this.copyCode();
      });
    }

    if (this.btnDownload) {
      this.btnDownload.addEventListener('click', () => {
        this.downloadCode();
      });
    }

    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        this.onFullscreenToggle();
      });
    }
  }

  _renderLines(lines = []) {
    return lines.map((text, idx) => {
      const lineNum = idx + 1;
      const isActive = this.activeLines.includes(lineNum);
      const activeCls = isActive ? ' active-line' : '';
      const highlightedContent = highlightSyntax(text, this.currentLang);

      return `
        <div class="code-line${activeCls}" data-line="${lineNum}">
          <span class="code-line-num">${lineNum}</span>
          <span class="code-line-content">${highlightedContent}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Retrieves current code example definition.
   */
  getCurrentCodeExample() {
    return getCodeExample(this.currentAlgo, this.currentLang, this.currentGraph, this.graphOptions);
  }

  /**
   * Retrieves current action-to-line mapping.
   */
  getCurrentMapping() {
    return this.getCurrentCodeExample().mapping;
  }

  /**
   * Retrieves raw unformatted source code string.
   */
  getCurrentSource() {
    return this.getCurrentCodeExample().source;
  }

  /**
   * Retrieves current source filename (e.g. dijkstra.cpp).
   */
  getCurrentFilename() {
    return this.getCurrentCodeExample().filename;
  }

  /**
   * Updates algorithm and reloads code.
   * @param {string} algoKey
   */
  setAlgorithm(algoKey) {
    this.currentAlgo = algoKey;
    this._refreshCode();
  }

  /**
   * Updates programming language and reloads code.
   * @param {string} langKey
   */
  setLanguage(langKey) {
    if (this.currentLang === langKey) return;
    this.currentLang = langKey;
    if (this.langSelect && this.langSelect.value !== langKey) {
      this.langSelect.value = langKey;
    }
    this._refreshCode();
    this.onLanguageChange(langKey);
  }

  /**
   * Synchronizes graph data to reflect current graph in source example.
   * @param {Object} graph
   * @param {Object} [options={}]
   */
  setGraph(graph, options = {}) {
    this.currentGraph = graph;
    this.graphOptions = options;
    this._refreshCode();
  }

  _refreshCode() {
    const example = this.getCurrentCodeExample();
    if (this.badgeEl) {
      this.badgeEl.textContent = example.title;
    }
    if (this.linesWrap) {
      this.linesWrap.innerHTML = this._renderLines(example.lines);
    }
    // Re-apply active lines
    this.update(this.activeLines);
  }

  /**
   * Copies raw executable source code to clipboard.
   */
  async copyCode() {
    const rawSource = this.getCurrentSource();
    if (!rawSource) return;

    try {
      const nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : (typeof navigator !== 'undefined' ? navigator : null);
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        await nav.clipboard.writeText(rawSource);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch {
      // Fallback
      if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = rawSource;
        document.body.appendChild(ta);
        ta.select();
        if (typeof document.execCommand === 'function') {
          document.execCommand('copy');
        }
        document.body.removeChild(ta);
      }
    }

    if (this.btnCopy) {
      const origText = this.btnCopy.textContent;
      this.btnCopy.textContent = '✓ Đã chép!';
      this.btnCopy.style.borderColor = 'var(--green)';
      setTimeout(() => {
        if (this.btnCopy) {
          this.btnCopy.textContent = origText;
          this.btnCopy.style.borderColor = '';
        }
      }, 1500);
    }
  }

  /**
   * Downloads source code file with exact filename and extension.
   */
  downloadCode() {
    const rawSource = this.getCurrentSource();
    const filename = this.getCurrentFilename();
    if (!rawSource || !filename) return;

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([rawSource], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Highlights specified line numbers and centers active line in viewport.
   * @param {number[]} activeLines
   */
  update(activeLines = []) {
    this.activeLines = Array.isArray(activeLines) ? [...activeLines] : [];
    if (!this.linesWrap) return;

    const lineEls = this.linesWrap.querySelectorAll('.code-line');
    lineEls.forEach((el) => {
      const lineNum = parseInt(el.getAttribute('data-line'), 10);
      const isActive = this.activeLines.includes(lineNum);
      el.classList.toggle('active-line', isActive);
      if (isActive && this.activeLines[0] === lineNum && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  /**
   * Clears line highlights.
   */
  reset() {
    this.update([]);
  }
}

/**
 * Token-based syntax highlighter for C++, Python, C, Java.
 * Uses a single-pass tokenizer on unescaped raw text, completely eliminating
 * tag mutation issues and preventing class attributes from leaking as text.
 */
export function highlightSyntax(rawLine, lang = 'cpp') {
  if (!rawLine) return '&nbsp;';

  // 1. Separate comments
  let codePart = rawLine;
  let commentPart = '';

  if (lang === 'python') {
    const hashIdx = rawLine.indexOf('#');
    if (hashIdx !== -1) {
      codePart = rawLine.substring(0, hashIdx);
      commentPart = rawLine.substring(hashIdx);
    }
  } else {
    // C, C++, Java
    const slashIdx = rawLine.indexOf('//');
    if (slashIdx !== -1) {
      codePart = rawLine.substring(0, slashIdx);
      commentPart = rawLine.substring(slashIdx);
    }
  }

  const highlightedCode = tokenizeAndHighlight(codePart, lang);
  const highlightedComment = commentPart ? `<span class="tok-com">${escapeHtml(commentPart)}</span>` : '';

  return highlightedCode + highlightedComment;
}

function tokenizeAndHighlight(text, lang) {
  if (!text) return '';

  const keywordsByLang = {
    python: new Set([
      'def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'while', 'for',
      'in', 'is', 'not', 'and', 'or', 'break', 'continue', 'True', 'False', 'None', 'as', 'lambda'
    ]),
    cpp: new Set([
      '#include', 'using', 'namespace', 'struct', 'class', 'const', 'auto', 'return',
      'if', 'else', 'while', 'for', 'break', 'continue', 'true', 'false', 'nullptr',
      'int', 'long', 'void', 'bool', 'size_t', 'greater'
    ]),
    c: new Set([
      '#include', '#define', 'typedef', 'struct', 'const', 'static', 'return',
      'if', 'else', 'while', 'for', 'break', 'continue', 'true', 'false',
      'int', 'void', 'bool', 'sizeof'
    ]),
    java: new Set([
      'import', 'public', 'private', 'protected', 'static', 'class', 'new', 'return',
      'if', 'else', 'while', 'for', 'break', 'continue', 'implements', 'override',
      'null', 'true', 'false', 'int', 'void', 'boolean', 'String'
    ]),
  };

  const types = new Set([
    'vector', 'queue', 'priority_queue', 'unordered_map', 'unordered_set', 'pair', 'string',
    'Map', 'List', 'Set', 'HashMap', 'HashSet', 'ArrayList', 'PriorityQueue', 'Deque', 'ArrayDeque',
    'Dict', 'Tuple', 'Optional', 'NodeAdj', 'Edge', 'DijkstraResult', 'KruskalResult', 'PrimResult',
    'EulerResult', 'HamiltonResult', 'DSU', 'DisjointSet', 'Result'
  ]);

  const kwSet = keywordsByLang[lang] || keywordsByLang.cpp;

  // Single-pass tokenizer regex:
  // 1. Strings: "(?:\\.|[^"\\])*" or '(?:\\.|[^'\\])*'
  // 2. Preprocessor: #[a-zA-Z_]+
  // 3. Identifiers/Words: \b[a-zA-Z_][a-zA-Z0-9_]*\b
  // 4. Numbers: \b\d+(?:\.\d+)?\b
  // 5. Symbols & whitespace: [^\s\w"']+|\s+
  const tokenRegex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[a-zA-Z_]+|\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+(?:\.\d+)?\b|[^\s\w"']+|\s+)/g;

  let result = '';
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'")) {
      // String literal
      result += `<span class="tok-str">${escapeHtml(token)}</span>`;
    } else if (/^\d/.test(token)) {
      // Number literal
      result += `<span class="tok-num">${escapeHtml(token)}</span>`;
    } else if (kwSet.has(token)) {
      // Keyword
      result += `<span class="tok-kw">${escapeHtml(token)}</span>`;
    } else if (types.has(token)) {
      // Type
      result += `<span class="tok-type">${escapeHtml(token)}</span>`;
    } else {
      // Plain identifier, symbol, or whitespace
      result += escapeHtml(token);
    }
  }

  return result;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
