/**
 * @file TeacherAnnotationTool.js
 * Interactive Presentation, Drawing Pen & Laser Pointer Tool for University Lecturers ("Cô").
 * 
 * Capabilities:
 * 1. 🔴 Glowing Laser Pointer with dynamic motion comet trail & radar ping pulse
 * 2. ✏️ Smooth Freehand Drawing Pen with Bézier curve smoothing
 * 3. ✨ Semi-transparent Highlighter (Bút dạ quang) that preserves underlying text readability
 * 4. ➡️ Teaching Direction Arrows & 🔲 Focus Rectangles
 * 5. 👆 Click-Through Mode: Interact with the website (step algorithms, drag nodes) while keeping notes visible!
 * 6. 🧽 Eraser, ↩️ Undo history stack, and 🗑️ 1-click Clear All
 * 7. 📸 Save / Export annotations as PNG lecture notes
 * 8. ⌨️ Teacher Keyboard shortcuts (L, P, H, A, R, E, Space/M, Ctrl+Z, Esc)
 */

export class TeacherAnnotationTool {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.container] - Root container (default: document.body)
   */
  constructor({ container = null, authManager = null } = {}) {
    this.container = container || (typeof document !== 'undefined' ? document.body : null);
    this.authManager = authManager || (typeof window !== 'undefined' && window.authManager ? window.authManager : null);
    
    // Core State
    this.isActive = false;
    this.currentTool = 'laser'; // 'laser' | 'pen' | 'highlighter' | 'arrow' | 'rect' | 'eraser'
    this.currentColor = '#ef4444'; // Red default for high visibility
    this.currentSize = 3.5;
    this.isClickThrough = false; // When true, mouse clicks pass through canvas to webpage
    this.isMinimized = false;

    // Drawing Data
    this.strokes = []; // Array of completed stroke objects
    this.currentStroke = null;
    this.isDrawing = false;
    this.startPoint = null;

    // Laser State
    this.laserPos = { x: -100, y: -100 };
    this.laserTrail = []; // [{x, y, alpha}]
    this.laserRipples = []; // [{x, y, radius, alpha}]
    this.animFrameId = null;

    // DOM Elements
    this.canvas = null;
    this.ctx = null;
    this.dockEl = null;

    // Bound listeners for cleanup
    this._handlePointerDown = this._onPointerDown.bind(this);
    this._handlePointerMove = this._onPointerMove.bind(this);
    this._handlePointerUp = this._onPointerUp.bind(this);
    this._handleResize = this._onResize.bind(this);
    this._handleKeyDown = this._onKeyDown.bind(this);

    if (this.container && typeof document !== 'undefined') {
      this._initDOM();
    }
  }

  /**
   * Checks if user has permission to use Teacher Presentation Tools.
   * Defaults to true in standalone or unit test environments without AuthManager.
   * @private
   */
  _isAdmin() {
    if (!this.authManager) return true;
    if (typeof this.authManager.isAdmin === 'function') {
      return this.authManager.isAdmin();
    }
    return true;
  }

  _initDOM() {
    if (!this.container) return;

    // 1. Overlay Fullscreen Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'teacherAnnotationCanvas';
    this.canvas.className = 'teacher-annotation-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9990;
      pointer-events: none;
      display: none;
    `;
    this.container.appendChild(this.canvas);
    
    // Safely acquire 2D context; provide fallback for test environments (JSDOM)
    const hasNativeCanvas = typeof window !== 'undefined' && typeof window.CanvasRenderingContext2D !== 'undefined';
    if (hasNativeCanvas && typeof this.canvas.getContext === 'function') {
      try {
        this.ctx = this.canvas.getContext('2d');
      } catch {
        this.ctx = this._createFallbackContext();
      }
    } else {
      this.ctx = this._createFallbackContext();
    }
    this._resizeCanvas();

    // 2. Floating Teacher Dock Toolbar
    this.dockEl = document.createElement('div');
    this.dockEl.id = 'teacherToolsDock';
    this.dockEl.className = 'teacher-tools-dock';
    this.dockEl.setAttribute('role', 'toolbar');
    this.dockEl.setAttribute('aria-label', 'Công cụ Giảng viên');
    this.dockEl.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9995;
      display: none;
    `;
    this.container.appendChild(this.dockEl);

    this._renderDockContent();
    this._bindEvents();
  }

  _resizeCanvas() {
    if (!this.canvas || typeof window === 'undefined') return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
    this._redrawAllStrokes();
  }

  _createFallbackContext() {
    const noop = () => {};
    return {
      canvas: this.canvas,
      setTransform: noop,
      scale: noop,
      clearRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      closePath: noop,
      stroke: noop,
      fill: noop,
      arc: noop,
      rect: noop,
      roundRect: noop,
      strokeRect: noop,
      fillRect: noop,
      quadraticCurveTo: noop,
      save: noop,
      restore: noop,
      createRadialGradient: () => ({ addColorStop: noop }),
      lineWidth: 1,
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineCap: 'round',
      lineJoin: 'round',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      shadowBlur: 0,
      shadowColor: 'transparent',
    };
  }

  _renderDockContent() {
    if (!this.dockEl) return;

    this.dockEl.innerHTML = `
      <div class="teacher-dock-card">
        <!-- Drag & Title Grip -->
        <div class="teacher-dock-grip" id="teacherDockGrip" title="Nhấp và kéo để di chuyển thanh công cụ">
          <span class="grip-icon">⠿</span>
          <span class="grip-title">👩‍🏫 Bút Giảng Dạy</span>
        </div>

        <!-- Mode Buttons Group -->
        <div class="teacher-btn-group mode-group">
          <button type="button" class="dock-btn ${this.currentTool === 'laser' ? 'active' : ''}" data-tool="laser" title="Con trỏ Laser phát sáng (Phím L)">
            <span class="tool-emoji">🔴</span>
            <span class="tool-text">Laser</span>
          </button>
          <button type="button" class="dock-btn ${this.currentTool === 'pen' ? 'active' : ''}" data-tool="pen" title="Bút vẽ tự do nét mượt (Phím P)">
            <span class="tool-emoji">✏️</span>
            <span class="tool-text">Bút vẽ</span>
          </button>
          <button type="button" class="dock-btn ${this.currentTool === 'highlighter' ? 'active' : ''}" data-tool="highlighter" title="Bút dạ quang làm nổi bật (Phím H)">
            <span class="tool-emoji">✨</span>
            <span class="tool-text">Dạ quang</span>
          </button>
          <button type="button" class="dock-btn ${this.currentTool === 'arrow' ? 'active' : ''}" data-tool="arrow" title="Mũi tên chỉ hướng (Phím A)">
            <span class="tool-emoji">➡️</span>
            <span class="tool-text">Mũi tên</span>
          </button>
          <button type="button" class="dock-btn ${this.currentTool === 'rect' ? 'active' : ''}" data-tool="rect" title="Khung chữ nhật bao quanh (Phím R)">
            <span class="tool-emoji">🔲</span>
            <span class="tool-text">Khung</span>
          </button>
          <button type="button" class="dock-btn ${this.currentTool === 'eraser' ? 'active' : ''}" data-tool="eraser" title="Tẩy / Xóa nét vẽ (Phím E)">
            <span class="tool-emoji">🧽</span>
            <span class="tool-text">Tẩy</span>
          </button>
        </div>

        <div class="dock-divider"></div>

        <!-- Palette Swatches -->
        <div class="teacher-btn-group color-group">
          <button type="button" class="color-dot ${this.currentColor === '#ef4444' ? 'selected' : ''}" data-color="#ef4444" style="background:#ef4444;" title="Màu Đỏ (Cảnh báo, điểm chốt)"></button>
          <button type="button" class="color-dot ${this.currentColor === '#facc15' ? 'selected' : ''}" data-color="#facc15" style="background:#facc15;" title="Màu Vàng (Lưu ý quan trọng)"></button>
          <button type="button" class="color-dot ${this.currentColor === '#10b981' ? 'selected' : ''}" data-color="#10b981" style="background:#10b981;" title="Màu Xanh lá (Kết quả đúng)"></button>
          <button type="button" class="color-dot ${this.currentColor === '#38bdf8' ? 'selected' : ''}" data-color="#38bdf8" style="background:#38bdf8;" title="Màu Xanh dương (Chú thích)"></button>
          <button type="button" class="color-dot ${this.currentColor === '#ffffff' ? 'selected' : ''}" data-color="#ffffff" style="background:#ffffff;border:1px solid #94a3b8;" title="Màu Trắng"></button>
        </div>

        <div class="dock-divider"></div>

        <!-- Size Swatches -->
        <div class="teacher-btn-group size-group">
          <button type="button" class="size-pill ${this.currentSize === 2.5 ? 'active' : ''}" data-size="2.5" title="Nét mảnh (2.5px)">S</button>
          <button type="button" class="size-pill ${this.currentSize === 4.5 ? 'active' : ''}" data-size="4.5" title="Nét vừa (4.5px)">M</button>
          <button type="button" class="size-pill ${this.currentSize === 8 ? 'active' : ''}" data-size="8" title="Nét đậm (8px)">L</button>
        </div>

        <div class="dock-divider"></div>

        <!-- Utility Actions -->
        <div class="teacher-btn-group action-group">
          <button type="button" class="dock-btn-action ${this.isClickThrough ? 'active-clickthrough' : ''}" id="btnToggleClickThrough" title="Chế độ Tương tác (Phím Space / M): Nhấp nút web bên dưới mà vẫn giữ nét vẽ">
            <span class="action-icon">👆</span>
            <span class="action-text">${this.isClickThrough ? 'Đang bấm web' : 'Tương tác'}</span>
          </button>
          <button type="button" class="dock-btn-action" id="btnUndoStroke" title="Hoàn tác nét vẽ cuối (Ctrl + Z)">
            <span class="action-icon">↩️</span>
          </button>
          <button type="button" class="dock-btn-action" id="btnClearAllStrokes" title="Xóa toàn bộ nét vẽ">
            <span class="action-icon">🗑️</span>
          </button>
          <button type="button" class="dock-btn-action" id="btnExportAnnotation" title="Chụp và tải về ảnh bài giảng">
            <span class="action-icon">📸</span>
          </button>
          <button type="button" class="dock-btn-action btn-close-tools" id="btnCloseTeacherTools" title="Đóng chế độ Giảng dạy (Phím Esc)">
            <span class="action-icon">✕</span>
          </button>
        </div>
      </div>
    `;

    this._bindDockButtons();
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    // Window events
    window.addEventListener('resize', this._handleResize);
    window.addEventListener('keydown', this._handleKeyDown);

    // Canvas pointer events
    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', this._handlePointerDown);
      this.canvas.addEventListener('pointermove', this._handlePointerMove);
      this.canvas.addEventListener('pointerup', this._handlePointerUp);
      this.canvas.addEventListener('pointercancel', this._handlePointerUp);
    }

    // Enable dragging for dock toolbar
    this._initDockDrag();
  }

  _bindDockButtons() {
    if (!this.dockEl) return;

    // Tool switch buttons
    this.dockEl.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        this.setTool(tool);
      });
    });

    // Color buttons
    this.dockEl.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        this.setColor(color);
      });
    });

    // Size buttons
    this.dockEl.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseFloat(btn.getAttribute('data-size'));
        this.setSize(size);
      });
    });

    // Action buttons
    const btnClickThrough = this.dockEl.querySelector('#btnToggleClickThrough');
    if (btnClickThrough) {
      btnClickThrough.addEventListener('click', () => this.toggleClickThrough());
    }

    const btnUndo = this.dockEl.querySelector('#btnUndoStroke');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.undo());
    }

    const btnClear = this.dockEl.querySelector('#btnClearAllStrokes');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clear());
    }

    const btnExport = this.dockEl.querySelector('#btnExportAnnotation');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportImage());
    }

    const btnClose = this.dockEl.querySelector('#btnCloseTeacherTools');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.deactivate());
    }
  }

  _initDockDrag() {
    const grip = this.dockEl ? this.dockEl.querySelector('#teacherDockGrip') : null;
    if (!grip) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerMove = (e) => {
      if (!isDragging || !this.dockEl) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.dockEl.style.left = `${initialLeft + dx}px`;
      this.dockEl.style.top = `${initialTop + dy}px`;
      this.dockEl.style.bottom = 'auto';
      this.dockEl.style.transform = 'none';
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      }
    };

    grip.addEventListener('pointerdown', (e) => {
      if (!this.dockEl) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.dockEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    });
  }

  /**
   * Activates presentation drawing & laser mode.
   */
  activate() {
    if (!this._isAdmin()) return;
    this.isActive = true;
    if (this.canvas) {
      this.canvas.style.display = 'block';
      this._updateCanvasPointerMode();
    }
    if (this.dockEl) {
      this.dockEl.style.display = 'flex';
    }

    // Sync header button state if present
    const headerBtn = document.getElementById('btnTeacherToolsToggle');
    if (headerBtn) {
      headerBtn.classList.add('active');
    }
    const statusLbl = document.getElementById('lblTeacherToolStatus');
    if (statusLbl) {
      statusLbl.textContent = 'Đang bật';
      statusLbl.style.background = 'rgba(16, 185, 129, 0.2)';
      statusLbl.style.color = '#10b981';
    }

    this._startLaserLoop();
  }

  /**
   * Deactivates presentation drawing mode.
   */
  deactivate() {
    this.isActive = false;
    if (this.canvas) {
      this.canvas.style.display = 'none';
      this.canvas.style.pointerEvents = 'none';
    }
    if (this.dockEl) {
      this.dockEl.style.display = 'none';
    }

    const headerBtn = document.getElementById('btnTeacherToolsToggle');
    if (headerBtn) {
      headerBtn.classList.remove('active');
    }
    const statusLbl = document.getElementById('lblTeacherToolStatus');
    if (statusLbl) {
      statusLbl.textContent = 'Tắt';
      statusLbl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusLbl.style.color = 'var(--accent)';
    }

    this._stopLaserLoop();
  }

  /**
   * Toggles active state.
   */
  toggle() {
    if (!this._isAdmin()) return;
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * Switches active tool.
   * @param {'laser'|'pen'|'highlighter'|'arrow'|'rect'|'eraser'} toolName
   */
  setTool(toolName) {
    if (['laser', 'pen', 'highlighter', 'arrow', 'rect', 'eraser'].includes(toolName)) {
      this.currentTool = toolName;
      if (this.isClickThrough) {
        this.isClickThrough = false;
      }
      this._updateCanvasPointerMode();
      this._updateDockUI();
    }
  }

  /**
   * Sets drawing color.
   * @param {string} colorHex
   */
  setColor(colorHex) {
    this.currentColor = colorHex;
    this._updateDockUI();
  }

  /**
   * Sets stroke size.
   * @param {number} size
   */
  setSize(size) {
    this.currentSize = size;
    this._updateDockUI();
  }

  /**
   * Toggles click-through interaction mode.
   */
  toggleClickThrough() {
    this.isClickThrough = !this.isClickThrough;
    this._updateCanvasPointerMode();
    this._updateDockUI();
  }

  _updateDockUI() {
    if (!this.dockEl) return;

    this.dockEl.querySelectorAll('.dock-btn[data-tool]').forEach(btn => {
      const tool = btn.getAttribute('data-tool');
      if (tool === this.currentTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.dockEl.querySelectorAll('.color-dot[data-color]').forEach(dot => {
      const col = dot.getAttribute('data-color');
      if (col === this.currentColor) {
        dot.classList.add('selected');
      } else {
        dot.classList.remove('selected');
      }
    });

    this.dockEl.querySelectorAll('.size-pill[data-size]').forEach(pill => {
      const sz = parseFloat(pill.getAttribute('data-size'));
      if (sz === this.currentSize) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    const clickThroughBtn = this.dockEl.querySelector('#btnToggleClickThrough');
    if (clickThroughBtn) {
      if (this.isClickThrough) {
        clickThroughBtn.classList.add('active-clickthrough');
        const textSpan = clickThroughBtn.querySelector('.action-text');
        if (textSpan) textSpan.textContent = 'Đang bấm web';
      } else {
        clickThroughBtn.classList.remove('active-clickthrough');
        const textSpan = clickThroughBtn.querySelector('.action-text');
        if (textSpan) textSpan.textContent = 'Tương tác';
      }
    }
  }

  _updateCanvasPointerMode() {
    if (!this.canvas) return;
    if (!this.isActive || this.isClickThrough) {
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.cursor = 'default';
    } else {
      this.canvas.style.pointerEvents = 'auto';
      if (this.currentTool === 'laser') {
        this.canvas.style.cursor = 'crosshair';
      } else if (this.currentTool === 'eraser') {
        this.canvas.style.cursor = 'cell';
      } else {
        this.canvas.style.cursor = 'crosshair';
      }
    }
  }

  // =========================================================================
  // DRAWING LOGIC & POINTER EVENT HANDLERS
  // =========================================================================

  _onPointerDown(e) {
    if (!this.isActive || this.isClickThrough) return;

    const x = e.clientX;
    const y = e.clientY;

    if (this.currentTool === 'laser') {
      // Create expanding laser radar pulse ring
      this.laserRipples.push({ x, y, radius: 8, alpha: 0.9 });
      return;
    }

    if (this.currentTool === 'eraser') {
      this._eraseAt(x, y);
      this.isDrawing = true;
      return;
    }

    this.isDrawing = true;
    this.startPoint = { x, y };

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.currentStroke = {
        type: this.currentTool,
        color: this.currentColor,
        size: this.currentTool === 'highlighter' ? 22 : this.currentSize,
        points: [{ x, y }],
      };
    } else if (this.currentTool === 'arrow' || this.currentTool === 'rect') {
      this.currentStroke = {
        type: this.currentTool,
        color: this.currentColor,
        size: this.currentSize,
        start: { x, y },
        end: { x, y },
      };
    }
  }

  _onPointerMove(e) {
    if (!this.isActive) return;

    const x = e.clientX;
    const y = e.clientY;

    // Laser pointer tracking
    if (this.currentTool === 'laser') {
      this.laserPos = { x, y };
      this.laserTrail.push({ x, y, alpha: 0.85 });
      if (this.laserTrail.length > 14) {
        this.laserTrail.shift();
      }
      return;
    }

    if (!this.isDrawing || !this.currentStroke) return;

    if (this.currentTool === 'eraser') {
      this._eraseAt(x, y);
      return;
    }

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.currentStroke.points.push({ x, y });
      this._redrawAllStrokes();
      this._drawSingleStroke(this.currentStroke);
    } else if (this.currentTool === 'arrow' || this.currentTool === 'rect') {
      this.currentStroke.end = { x, y };
      this._redrawAllStrokes();
      this._drawSingleStroke(this.currentStroke);
    }
  }

  _onPointerUp() {
    if (this.isDrawing && this.currentStroke) {
      this.strokes.push(this.currentStroke);
      this.currentStroke = null;
      this.isDrawing = false;
      this._redrawAllStrokes();
    }
    this.isDrawing = false;
  }

  _eraseAt(x, y) {
    const eraserRadius = 26;
    const beforeCount = this.strokes.length;
    this.strokes = this.strokes.filter(s => {
      if (s.type === 'pen' || s.type === 'highlighter') {
        return !s.points.some(p => Math.hypot(p.x - x, p.y - y) < eraserRadius);
      }
      if (s.type === 'arrow' || s.type === 'rect') {
        const d1 = Math.hypot(s.start.x - x, s.start.y - y);
        const d2 = Math.hypot(s.end.x - x, s.end.y - y);
        return d1 >= eraserRadius && d2 >= eraserRadius;
      }
      return true;
    });

    if (this.strokes.length !== beforeCount) {
      this._redrawAllStrokes();
    }
  }

  /**
   * Re-draws all saved strokes on canvas.
   */
  _redrawAllStrokes() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const stroke of this.strokes) {
      this._drawSingleStroke(stroke);
    }
  }

  _drawSingleStroke(stroke) {
    if (!this.ctx || !stroke) return;
    const ctx = this.ctx;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.type === 'highlighter') {
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    } else {
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    if (stroke.type === 'pen' || stroke.type === 'highlighter') {
      const pts = stroke.points;
      if (pts.length < 2) {
        if (pts.length === 1) {
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();

    } else if (stroke.type === 'arrow') {
      const { start, end } = stroke;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = Math.max(14, stroke.size * 3.5);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Arrow head
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

    } else if (stroke.type === 'rect') {
      const { start, end } = stroke;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, 8);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================================
  // LASER POINTER RENDER LOOP (Animation Frame)
  // =========================================================================

  _startLaserLoop() {
    this._stopLaserLoop();

    const loop = () => {
      if (this.isActive && this.currentTool === 'laser' && this.ctx && this.canvas) {
        this._renderLaserOverlay();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  _stopLaserLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  _renderLaserOverlay() {
    if (!this.ctx || !this.canvas) return;
    this._redrawAllStrokes();

    const ctx = this.ctx;
    ctx.save();

    // 1. Draw Fading Laser Comet Trail
    for (let i = 0; i < this.laserTrail.length; i++) {
      const pt = this.laserTrail[i];
      pt.alpha *= 0.88;
      if (pt.alpha > 0.05) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 * pt.alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${pt.alpha * 0.7})`;
        ctx.fill();
      }
    }
    this.laserTrail = this.laserTrail.filter(pt => pt.alpha > 0.05);

    // 2. Draw Expanding Ripple Rings (on click)
    for (let i = 0; i < this.laserRipples.length; i++) {
      const rip = this.laserRipples[i];
      rip.radius += 2.2;
      rip.alpha -= 0.035;

      if (rip.alpha > 0) {
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${rip.alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    this.laserRipples = this.laserRipples.filter(rip => rip.alpha > 0);

    // 3. Draw Core Laser Dot
    if (this.laserPos.x > 0 && this.laserPos.y > 0) {
      const lx = this.laserPos.x;
      const ly = this.laserPos.y;

      // Outer Halo
      const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, 18);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
      grad.addColorStop(0.35, 'rgba(239, 68, 68, 0.45)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.beginPath();
      ctx.arc(lx, ly, 18, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Sharp white center hot core
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    ctx.restore();
  }

  // =========================================================================
  // ACTIONS & UTILITIES
  // =========================================================================

  undo() {
    if (this.strokes.length > 0) {
      this.strokes.pop();
      this._redrawAllStrokes();
    }
  }

  clear() {
    this.strokes = [];
    this.laserTrail = [];
    this.laserRipples = [];
    this._redrawAllStrokes();
  }

  exportImage() {
    if (!this.canvas) return;
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `bai-giang-chu-thich-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {
      alert('Không thể lưu ảnh chú thích ở chế độ bảo mật hiện tại.');
    }
  }

  _onResize() {
    this._resizeCanvas();
  }

  _onKeyDown(e) {
    if (!this._isAdmin()) return;
    // Only capture shortcuts when active or to toggle
    const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    const key = e.key ? e.key.toLowerCase() : '';

    if (e.key === 'Escape' && this.isActive) {
      this.deactivate();
      e.preventDefault();
      return;
    }

    // Ctrl + Z for Undo
    if ((e.ctrlKey || e.metaKey) && key === 'z' && this.isActive) {
      this.undo();
      e.preventDefault();
      return;
    }

    if (!this.isActive) return;

    if (key === 'l') {
      this.setTool('laser');
    } else if (key === 'p') {
      this.setTool('pen');
    } else if (key === 'h') {
      this.setTool('highlighter');
    } else if (key === 'a') {
      this.setTool('arrow');
    } else if (key === 'r') {
      this.setTool('rect');
    } else if (key === 'e') {
      this.setTool('eraser');
    } else if (key === 'm' || key === ' ') {
      this.toggleClickThrough();
      e.preventDefault();
    }
  }

  destroy() {
    this.deactivate();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._handleResize);
      window.removeEventListener('keydown', this._handleKeyDown);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.dockEl && this.dockEl.parentNode) {
      this.dockEl.parentNode.removeChild(this.dockEl);
    }
  }
}
