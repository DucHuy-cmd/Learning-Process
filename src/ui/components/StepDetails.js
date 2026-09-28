/**
 * @file StepDetails.js
 * Compact Step Information Status Strip Component
 * 
 * Re-architected as a slim, high-density status strip (36-48px height)
 * displaying: Step number, Phase badge, Action name, Description, and Formula.
 * Eliminates oversized cards to preserve maximum vertical space for Graph and Code.
 */

export class StepDetails {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   */
  constructor({ container }) {
    this.container = container;
    this._render();
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="step-compact-strip" id="stepCompactStrip" style="display:none;">
        <div class="step-strip-meta">
          <span class="step-strip-num" id="stepTitle">Bước 0</span>
          <span class="phase-badge" id="stepPhaseBadge">Sẵn sàng</span>
        </div>
        <div class="step-strip-desc" id="stepDesc" title=""></div>
        <div class="step-strip-formula" id="stepFormula" style="display:none;"></div>
      </div>
    `;

    this.stripEl = this.container.querySelector('#stepCompactStrip');
    this.titleEl = this.container.querySelector('#stepTitle');
    this.phaseBadge = this.container.querySelector('#stepPhaseBadge');
    this.descEl = this.container.querySelector('#stepDesc');
    this.formulaEl = this.container.querySelector('#stepFormula');
  }

  /**
   * Updates display with formatted presentation step.
   * 
   * @param {Object|null} presentationStep - Output of StepFormatter.formatStep()
   */
  update(presentationStep) {
    if (!presentationStep) {
      if (this.stripEl) {
        this.stripEl.style.display = 'none';
      }
      if (this.titleEl) this.titleEl.textContent = 'Bước 0';
      if (this.phaseBadge) this.phaseBadge.textContent = 'Sẵn sàng';
      if (this.descEl) {
        this.descEl.textContent = '';
        this.descEl.title = '';
      }
      if (this.formulaEl) this.formulaEl.style.display = 'none';
      return;
    }

    if (this.stripEl) {
      this.stripEl.style.display = 'flex';
    }

    const actionText = presentationStep.action ? ` [${presentationStep.action}]` : '';
    this.titleEl.textContent = `Bước ${presentationStep.stepNumber}${actionText}`;
    this.phaseBadge.textContent = presentationStep.phase || 'Đang chạy';
    this.descEl.textContent = presentationStep.description || '';
    this.descEl.title = presentationStep.description || '';

    if (presentationStep.formula) {
      this.formulaEl.style.display = 'inline-block';
      this.formulaEl.textContent = presentationStep.formula;
    } else {
      this.formulaEl.style.display = 'none';
    }
  }
}
