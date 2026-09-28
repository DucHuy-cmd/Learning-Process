/**
 * @file PlaybackControls.js
 * UI Playback Component
 * 
 * Subscribes to and commands PlaybackController instance.
 * Exposes First, Prev, Play/Pause, Next, Last, Step Jump Direct Input,
 * Step Scrubber Slider, and Speed controls.
 */

export class PlaybackControls {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element for playback controls
   * @param {Function} [options.onStepChange] - Callback invoked when playback step changes
   * @param {Function} [options.onPlayRequest] - Callback invoked when play button is clicked to run/toggle
   * @param {Function} [options.onFirstRequest] - Callback invoked when first button is clicked (|◀)
   * @param {Function} [options.onPrevRequest] - Callback invoked when prev button is clicked (◀)
   * @param {Function} [options.onNextRequest] - Callback invoked when next button is clicked (▶)
   * @param {Function} [options.onLastRequest] - Callback invoked when last button is clicked (▶|)
   */
  constructor({ container, onStepChange, onPlayRequest, onFirstRequest, onPrevRequest, onNextRequest, onLastRequest }) {
    this.container = container;
    this.onStepChange = onStepChange || (() => {});
    this.onPlayRequest = onPlayRequest || null;
    this.onFirstRequest = onFirstRequest || null;
    this.onPrevRequest = onPrevRequest || null;
    this.onNextRequest = onNextRequest || null;
    this.onLastRequest = onLastRequest || null;
    this.controller = null;
    this.unsubscribe = null;
    this._keyHandler = null;

    this._render();
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="playback-bar">
        <div class="playback-buttons">
          <button type="button" class="ctrl-btn" id="btnFirst" title="Về bước đầu tiên (|◀)">|◀</button>
          <button type="button" class="ctrl-btn" id="btnPrev" title="Bước trước (◀)">◀</button>
          <button type="button" class="ctrl-btn btn-play" id="btnPlay" title="Tự động chạy / Tạm dừng (Space)">▶ Chạy</button>
          <button type="button" class="ctrl-btn" id="btnNext" title="Bước tiếp theo (▶)">▶</button>
          <button type="button" class="ctrl-btn" id="btnLast" title="Đến bước cuối cùng (▶|)">▶|</button>
          
          <div class="step-jump-box" title="Vị trí bước hiện tại / Tổng số bước">
            <span class="step-jump-label">Bước:</span>
            <input type="number" class="step-jump-input" id="stepJumpInput" min="1" max="1" value="0" style="display:none;" aria-label="Nhập số bước cần nhảy">
            <span class="step-counter-text" id="stepCounterText">0 / 0</span>
          </div>
        </div>

        <!-- Step Scrubber Slider: hidden per user request to clean up clutter -->
        <div class="playback-scrubber" style="display: none;">
          <input type="range" class="step-slider" id="stepSlider" min="0" max="0" value="0" disabled title="Kéo để chuyển nhanh đến bước bất kỳ">
        </div>

        <div class="playback-speed-wrap">
          <label for="speedSlider" class="playback-speed-label">Tốc độ:</label>
          <input type="range" id="speedSlider" min="0.25" max="3" step="0.25" value="1" class="speed-slider" title="Điều chỉnh tốc độ chạy tự động">
          <span id="speedValText" class="speed-val-text">1.00x</span>
        </div>
      </div>
    `;

    this.btnFirst = this.container.querySelector('#btnFirst');
    this.btnPrev = this.container.querySelector('#btnPrev');
    this.btnPlay = this.container.querySelector('#btnPlay');
    this.btnNext = this.container.querySelector('#btnNext');
    this.btnLast = this.container.querySelector('#btnLast');
    this.stepJumpInput = this.container.querySelector('#stepJumpInput');
    this.counterText = this.container.querySelector('#stepCounterText');
    this.stepSlider = this.container.querySelector('#stepSlider');
    this.speedSlider = this.container.querySelector('#speedSlider');
    this.speedValText = this.container.querySelector('#speedValText');

    this._bindEvents();
  }

  _bindEvents() {
    this.btnFirst.addEventListener('click', () => {
      if (this.onFirstRequest) {
        this.onFirstRequest();
      } else if (this.controller) {
        this.controller.pause();
        this.controller.first();
      }
    });

    this.btnPrev.addEventListener('click', () => {
      if (this.onPrevRequest) {
        this.onPrevRequest();
      } else if (this.controller) {
        this.controller.pause();
        this.controller.prev();
      }
    });

    this.btnPlay.addEventListener('click', () => {
      if (this.onPlayRequest) {
        this.onPlayRequest();
      } else if (this.controller) {
        if (this.controller.isAtEnd) {
          this.controller.first();
          this.controller.play();
        } else {
          this.controller.togglePlay();
        }
      }
    });

    this.btnNext.addEventListener('click', () => {
      if (this.onNextRequest) {
        this.onNextRequest();
      } else if (this.controller) {
        this.controller.pause();
        this.controller.next();
      }
    });

    this.btnLast.addEventListener('click', () => {
      if (this.onLastRequest) {
        this.onLastRequest();
      } else if (this.controller) {
        this.controller.pause();
        this.controller.last();
      }
    });

    this._keyHandler = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.btnPlay.click();
      } else if (e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        this.btnNext.click();
      } else if (e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        this.btnPrev.click();
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.btnFirst.click();
      } else if (e.key === 'End') {
        e.preventDefault();
        this.btnLast.click();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._keyHandler);
    }

    const handleJump = () => {
      if (!this.controller || this.controller.totalSteps <= 0) return;
      const val = parseInt(this.stepJumpInput.value, 10);
      if (!isNaN(val)) {
        const targetIdx = Math.max(0, Math.min(this.controller.totalSteps - 1, val - 1));
        this.controller.goto(targetIdx);
      }
    };

    if (this.stepJumpInput) {
      this.stepJumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleJump();
          this.stepJumpInput.blur();
        }
      });
      this.stepJumpInput.addEventListener('change', () => {
        handleJump();
      });
    }

    if (this.stepSlider) {
      this.stepSlider.addEventListener('input', (e) => {
        if (this.controller) {
          const targetIdx = parseInt(e.target.value, 10);
          if (!isNaN(targetIdx)) {
            this.controller.goto(targetIdx);
          }
        }
      });
    }

    this.speedSlider.addEventListener('input', (e) => {
      const speedMult = parseFloat(e.target.value);
      this.speedValText.textContent = `${speedMult.toFixed(2)}x`;
      if (this.controller) {
        // Map 1x -> 1000ms, 2x -> 500ms, 0.5x -> 2000ms
        const intervalMs = Math.round(1000 / speedMult);
        this.controller.setSpeed(intervalMs);
      }
    });
  }

  /**
   * Attaches a new PlaybackController instance.
   * 
   * @param {import('../../app/playback/PlaybackController.js').PlaybackController} controller
   */
  setController(controller) {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.controller = controller;

    if (!controller) {
      this._updateUI({
        currentIndex: -1,
        totalSteps: 0,
        isPlaying: false,
        isAtStart: true,
        isAtEnd: true,
      });
      return;
    }

    this.unsubscribe = controller.subscribe((step, state) => {
      const currentState = state || (step && step.state) || {};
      this._updateUI(currentState);
      this.onStepChange(currentState, step);
    });

    // Initial sync
    this._updateUI({
      currentIndex: controller.currentIndex,
      totalSteps: controller.totalSteps,
      isPlaying: controller.isPlaying,
      isAtStart: controller.isAtStart,
      isAtEnd: controller.isAtEnd,
    });
  }

  _updateUI(state) {
    const { currentIndex, totalSteps, isPlaying, isAtStart, isAtEnd } = state;

    const safeTotal = typeof totalSteps === 'number' && !isNaN(totalSteps) ? totalSteps : 0;
    const safeCurrent = typeof currentIndex === 'number' && !isNaN(currentIndex) && currentIndex >= 0 ? currentIndex + 1 : 0;

    if (this.counterText) {
      this.counterText.textContent = `${safeCurrent} / ${safeTotal}`;
    }

    if (this.stepJumpInput) {
      if (safeTotal <= 0) {
        this.stepJumpInput.disabled = true;
        this.stepJumpInput.min = '0';
        this.stepJumpInput.max = '0';
        this.stepJumpInput.value = '0';
      } else {
        this.stepJumpInput.disabled = false;
        this.stepJumpInput.min = '1';
        this.stepJumpInput.max = String(safeTotal);
        this.stepJumpInput.value = String(safeCurrent > 0 ? safeCurrent : 1);
      }
    }

    // All playback navigation buttons are always enabled and responsive
    this.btnFirst.disabled = false;
    this.btnPrev.disabled = false;
    this.btnNext.disabled = false;
    this.btnLast.disabled = false;

    if (isPlaying) {
      this.btnPlay.textContent = '⏸ Dừng';
      this.btnPlay.classList.add('active-play');
      this.btnPlay.title = 'Tạm dừng chạy tự động (Space)';
    } else {
      if (isAtEnd && safeTotal > 1) {
        this.btnPlay.textContent = '🔁 Phát lại';
        this.btnPlay.title = 'Phát lại thuật toán từ đầu (Space)';
      } else {
        this.btnPlay.textContent = '▶ Chạy';
        this.btnPlay.title = 'Tự động chạy thuật toán (Space)';
      }
      this.btnPlay.classList.remove('active-play');
    }
    // btnPlay is always enabled if onPlayRequest exists or if safeTotal > 1
    this.btnPlay.disabled = this.onPlayRequest ? false : (safeTotal <= 1);

    // Synchronize step scrubber slider
    if (this.stepSlider) {
      if (safeTotal <= 1) {
        this.stepSlider.disabled = true;
        this.stepSlider.min = '0';
        this.stepSlider.max = '0';
        this.stepSlider.value = '0';
      } else {
        this.stepSlider.disabled = false;
        this.stepSlider.min = '0';
        this.stepSlider.max = String(safeTotal - 1);
        this.stepSlider.value = String(currentIndex >= 0 ? currentIndex : 0);
      }
    }
  }

  /**
   * Cleans up subscriptions and listeners.
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this._keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyHandler);
    }
  }
}
