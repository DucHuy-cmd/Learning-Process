/**
 * @file HelpGuideModal.js
 * Comprehensive User Guide & Shortcuts Center Modal Component ("Trung Tâm Hướng Dẫn & Trợ Giúp").
 * 
 * Features:
 * 1. 🚀 Khởi đầu nhanh (Quick Start): 30-second guides for all 4 Lab rooms, Theory & Quiz Studio.
 * 2. ⌨️ Phím tắt toàn năng (Shortcuts): Teacher Presentation & Laser shortcuts, playback, navigation.
 * 3. 💡 Mẹo & Thủ thuật (Tips & Tricks): Logic formula typing syntax, AI Vision uploads, PDF export.
 * 4. 🔗 One-click Navigation links into Logic Lab, Counting Lab, Relation Lab, Graph Lab, Quiz Studio.
 * 5. ⌨️ Global '?' shortcut & Esc to close.
 */

export class HelpGuideModal {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.container] - Modal container or document.body
   * @param {Function} [options.onNavigate] - Callback (viewName, subtab)
   */
  constructor({ container = null, onNavigate = null } = {}) {
    this.container = container || (typeof document !== 'undefined' ? document.body : null);
    this.onNavigate = onNavigate || (() => {});
    this.isOpen = false;
    this.activeTab = 'quickstart'; // 'quickstart' | 'shortcuts' | 'tips'

    this.backdropEl = null;
    this.dialogEl = null;

    this._handleKeyDown = this._onKeyDown.bind(this);

    if (this.container && typeof document !== 'undefined') {
      this._initDOM();
    }
  }

  _initDOM() {
    if (!this.container) return;

    // Outer Backdrop
    this.backdropEl = document.createElement('div');
    this.backdropEl.id = 'helpGuideModal';
    this.backdropEl.className = 'modal-backdrop help-guide-backdrop';
    this.backdropEl.setAttribute('role', 'dialog');
    this.backdropEl.setAttribute('aria-modal', 'true');
    this.backdropEl.setAttribute('aria-label', 'Trung Tâm Hướng Dẫn & Trợ Giúp');
    this.backdropEl.style.display = 'none';

    // Modal Dialog Box
    this.dialogEl = document.createElement('div');
    this.dialogEl.className = 'modal-dialog help-guide-dialog';
    this.backdropEl.appendChild(this.dialogEl);

    this.container.appendChild(this.backdropEl);

    this._renderContent();
    this._bindEvents();
  }

  _renderContent() {
    if (!this.dialogEl) return;

    this.dialogEl.innerHTML = `
      <!-- Modal Header -->
      <div class="modal-head help-modal-head">
        <div class="head-title-wrap">
          <span class="help-head-icon">📖</span>
          <div>
            <h3 class="modal-title">Trung Tâm Hướng Dẫn &amp; Trợ Giúp</h3>
            <span class="help-head-sub">Nền tảng Thực nghiệm &amp; Giảng dạy Toán Rời Rạc Đại học</span>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="btnCloseHelpGuide" aria-label="Đóng hướng dẫn" title="Đóng (Phím Esc)">✕</button>
      </div>

      <!-- Tab Navigation -->
      <div class="help-tabs-bar">
        <button type="button" class="help-tab-btn ${this.activeTab === 'quickstart' ? 'active' : ''}" data-tab="quickstart">
          <span>🚀</span>
          <span>Khởi đầu nhanh</span>
        </button>
        <button type="button" class="help-tab-btn ${this.activeTab === 'shortcuts' ? 'active' : ''}" data-tab="shortcuts">
          <span>⌨️</span>
          <span>Phím tắt toàn năng</span>
        </button>
        <button type="button" class="help-tab-btn ${this.activeTab === 'tips' ? 'active' : ''}" data-tab="tips">
          <span>💡</span>
          <span>Mẹo &amp; Cú pháp</span>
        </button>
      </div>

      <!-- Modal Body (Tab Panes) -->
      <div class="modal-body help-modal-body" id="helpModalBody">
        ${this._renderActiveTabPane()}
      </div>

      <!-- Modal Footer -->
      <div class="help-modal-foot">
        <span class="help-foot-hint">💡 <strong>Mẹo:</strong> Nhấn phím <kbd class="kbd-pill">?</kbd> trên bàn phím ở bất kỳ đâu để bật lại hướng dẫn này.</span>
        <button type="button" class="btn-primary-sm" id="btnHelpUnderstand">Đã hiểu &amp; Bắt đầu</button>
      </div>
    `;

    this._bindTabButtons();
  }

  _renderActiveTabPane() {
    switch (this.activeTab) {
      case 'shortcuts':
        return this._renderShortcutsPane();
      case 'tips':
        return this._renderTipsPane();
      case 'quickstart':
      default:
        return this._renderQuickStartPane();
    }
  }

  _renderQuickStartPane() {
    return `
      <div class="guide-pane-quickstart">
        <p class="guide-intro">
          Chào mừng bạn đến với hệ thống học tập trực quan Toán Rời Rạc! Hãy chọn phòng thực nghiệm tương ứng với bài học:
        </p>

        <div class="guide-cards-grid">
          <!-- Card 1: Logic Lab -->
          <div class="guide-lab-card" data-accent="amber">
            <div class="card-top">
              <span class="guide-card-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;">⚡</span>
              <div class="card-head-text">
                <h4 class="guide-card-title">1. Logic Lab (Chương 1 &amp; 2)</h4>
                <span class="guide-card-sub">Logic Mệnh đề, Bìa K-Map &amp; Mạch số</span>
              </div>
            </div>
            <ul class="guide-card-features">
              <li><strong>Bảng chân trị:</strong> Nhập công thức như <code>(p -> q) & ~r</code> để tự động giải bảng và phân tích hằng đúng / mâu thuẫn.</li>
              <li><strong>Bìa Karnaugh (K-Map):</strong> Tối giản hàm Boole 2-4 biến với các nhóm ô bao phủ trực quan sinh động.</li>
              <li><strong>Sơ đồ mạch số:</strong> Mô phỏng trực tiếp cổng logic AND, OR, NOT, XOR phản ứng tức thì theo công tắc.</li>
            </ul>
            <button type="button" class="guide-card-btn" data-nav="logic">
              Vào Logic Lab <span>➔</span>
            </button>
          </div>

          <!-- Card 2: Counting Lab -->
          <div class="guide-lab-card" data-accent="green">
            <div class="card-top">
              <span class="guide-card-icon" style="background:rgba(16,185,129,0.15);color:#10b981;">🧮</span>
              <div class="card-head-text">
                <h4 class="guide-card-title">2. Counting Lab (Chương 3)</h4>
                <span class="guide-card-sub">Đại số Tổ hợp, Dirichlet &amp; Hệ thức truy hồi</span>
              </div>
            </div>
            <ul class="guide-card-features">
              <li><strong>Tổ hợp &amp; Chỉnh hợp:</strong> Tính nhanh $C(n,k)$, $A(n,k)$, $P_n$ kèm lời giải và công thức khai triển nhị thức.</li>
              <li><strong>Mô phỏng Dirichlet:</strong> Trực quan hóa nguyên lý chuồng bồ câu qua bài toán chia $k$ đồ vật vào $n$ hộp.</li>
              <li><strong>Hệ thức truy hồi:</strong> Giải phương trình đặc trưng bậc 1 &amp; bậc 2, tìm nghiệm tổng quát chi tiết.</li>
            </ul>
            <button type="button" class="guide-card-btn" data-nav="counting">
              Vào Counting Lab <span>➔</span>
            </button>
          </div>

          <!-- Card 3: Relation Lab -->
          <div class="guide-lab-card" data-accent="purple">
            <div class="card-top">
              <span class="guide-card-icon" style="background:rgba(168,85,247,0.15);color:#a855f7;">🔄</span>
              <div class="card-head-text">
                <h4 class="guide-card-title">3. Relation Lab (Chương 4)</h4>
                <span class="guide-card-sub">Quan hệ Nhị phân, Bao đóng &amp; Tương đương / Thứ tự</span>
              </div>
            </div>
            <ul class="guide-card-features">
              <li><strong>Kiểm tra 5 tính chất:</strong> Tự động kiểm tra Phản xạ, Đối xứng, Phản xứng, Bắc cầu; kết luận Quan hệ Tương đương hoặc Thứ tự (Poset).</li>
              <li><strong>Ma trận &amp; Đồ thị:</strong> Tương tác nhấp bật/tắt ô ma trận $M_R$, đồ thị quan hệ tự động biến đổi thời gian thực.</li>
              <li><strong>Bao đóng Warshall:</strong> Tìm bao đóng phản xạ $r(R)$, đối xứng $s(R)$ và bắc cầu $t(R)$ từng bước.</li>
            </ul>
            <button type="button" class="guide-card-btn" data-nav="relation">
              Vào Relation Lab <span>➔</span>
            </button>
          </div>

          <!-- Card 4: Graph Lab -->
          <div class="guide-lab-card" data-accent="blue">
            <div class="card-top">
              <span class="guide-card-icon" style="background:rgba(56,189,248,0.15);color:#38bdf8;">🌐</span>
              <div class="card-head-text">
                <h4 class="guide-card-title">4. Graph Lab (Chương 5)</h4>
                <span class="guide-card-sub">Lý thuyết Đồ thị &amp; 5 Thuật toán kinh điển</span>
              </div>
            </div>
            <ul class="guide-card-features">
              <li><strong>Vẽ đồ thị tương tác:</strong> Nhấp thêm đỉnh, kéo nối cạnh có trọng số, đổi đồ thị vô hướng / có hướng linh hoạt.</li>
              <li><strong>5 Thuật toán chuẩn:</strong> Dijkstra (đường đi ngắn nhất), Prim &amp; Kruskal (cây khung nhỏ nhất), Euler &amp; Hamilton.</li>
              <li><strong>Điều khiển từng bước:</strong> Xem bảng trạng thái biến đổi, đồng bộ hóa mã nguồn (C++/Python/JS).</li>
            </ul>
            <button type="button" class="guide-card-btn" data-nav="lab">
              Vào Graph Lab <span>➔</span>
            </button>
          </div>
        </div>

        <div class="guide-extra-row">
          <div class="guide-extra-card">
            <span class="extra-icon">🎯</span>
            <div>
              <h5 class="extra-title">Luyện tập &amp; Đề thi</h5>
              <p class="extra-desc">56+ câu hỏi trắc nghiệm chất lượng cao bao trùm 4 chương, chế độ thi thử tính giờ và giải thích chi tiết.</p>
            </div>
            <button type="button" class="extra-nav-btn" data-nav="quiz">Vào Luyện thi ➔</button>
          </div>

          <div class="guide-extra-card">
            <span class="extra-icon">🤖</span>
            <div>
              <h5 class="extra-title">Trợ lý AI Assistant</h5>
              <p class="extra-desc">Hỏi đáp trực tiếp mọi vướng mắc lý thuyết Toán Rời Rạc và giải bài tập tự động 24/7.</p>
            </div>
            <button type="button" class="extra-nav-btn" data-nav="ai">Hỏi Trợ lý AI ➔</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderShortcutsPane() {
    return `
      <div class="guide-pane-shortcuts">
        <p class="guide-intro">
          Các phím tắt tiện lợi giúp giảng viên và sinh viên điều khiển hệ thống mượt mà như một phần mềm chuyên nghiệp:
        </p>

        <!-- Nhóm 1: Giảng dạy & Bút vẽ -->
        <div class="shortcut-section">
          <div class="section-title-wrap">
            <span class="section-badge">👩‍🏫 Dành cho Cô &amp; Thuyết trình</span>
            <h4 class="section-title">Chế độ Bút vẽ &amp; Con trỏ Laser</h4>
          </div>
          <table class="shortcut-table">
            <thead>
              <tr>
                <th style="width: 140px;">Phím tắt</th>
                <th style="width: 220px;">Công cụ</th>
                <th>Mô tả hoạt động</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd class="kbd-pill">L</kbd></td>
                <td><strong>🔴 Con trỏ Laser</strong></td>
                <td>Bật tia laser phát sáng với vệt sao băng comet trail và radar pulse khi nhấp chuột.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">P</kbd></td>
                <td><strong>✏️ Bút vẽ tự do</strong></td>
                <td>Nét vẽ mượt mà với thuật toán làm mượt Bézier curve; vẽ chú thích lên bài giảng.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">H</kbd></td>
                <td><strong>✨ Bút dạ quang</strong></td>
                <td>Tô sáng bán trong suốt, làm nổi bật công thức hay ma trận mà không che chữ bên dưới.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">A</kbd></td>
                <td><strong>➡️ Mũi tên chỉ hướng</strong></td>
                <td>Vẽ nhanh mũi tên chỉ luồng thuật toán, đỉnh đồ thị hoặc bước suy diễn.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">R</kbd></td>
                <td><strong>🔲 Khung chữ nhật</strong></td>
                <td>Đóng khung làm nổi bật vùng kiến thức, ô ma trận hoặc nhóm bảng chân trị.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">E</kbd></td>
                <td><strong>🧽 Tẩy xóa nét</strong></td>
                <td>Nhấp vào nét vẽ để xóa nhanh từng phần chú thích.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">Space</kbd> hoặc <kbd class="kbd-pill">M</kbd></td>
                <td><strong>👆 Tương tác xuyên màn hình</strong></td>
                <td><span class="highlight-badge">Tuyệt chiêu:</span> Vừa giữ nguyên hình vẽ trên bảng, vừa nhấp chuột bấm nút web bên dưới!</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">Ctrl</kbd> + <kbd class="kbd-pill">Z</kbd></td>
                <td><strong>↩️ Hoàn tác (Undo)</strong></td>
                <td>Hoàn tác nét vẽ vừa thao tác trước đó.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">Esc</kbd></td>
                <td><strong>Đóng chế độ giảng dạy</strong></td>
                <td>Thu gọn thanh công cụ về góc màn hình.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Nhóm 2: Điều khiển thuật toán -->
        <div class="shortcut-section">
          <div class="section-title-wrap">
            <span class="section-badge">▶️ Graph Lab &amp; Mô phỏng</span>
            <h4 class="section-title">Điều khiển luồng bước chạy thuật toán</h4>
          </div>
          <table class="shortcut-table">
            <thead>
              <tr>
                <th style="width: 140px;">Phím tắt</th>
                <th style="width: 220px;">Hành động</th>
                <th>Mô tả hoạt động</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd class="kbd-pill">Space</kbd></td>
                <td><strong>Phát / Tạm dừng (Play / Pause)</strong></td>
                <td>Tự động chạy từng bước thuật toán đồ thị theo tốc độ cài đặt.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">→</kbd> (Mũi tên phải)</td>
                <td><strong>Bước tiếp theo (Step Forward)</strong></td>
                <td>Tiến hành một bước xử lý kế tiếp trong thuật toán.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">←</kbd> (Mũi tên trái)</td>
                <td><strong>Bước lùi lại (Step Backward)</strong></td>
                <td>Quay lại trạng thái đỉnh/cạnh của bước trước đó.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">Home</kbd></td>
                <td><strong>Về trạng thái đầu</strong></td>
                <td>Reset đồ thị về bước 0 trước khi chạy thuật toán.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">End</kbd></td>
                <td><strong>Nhảy đến kết quả cuối</strong></td>
                <td>Chạy nhanh đến bước kết luận và hiển thị cây khung / đường đi ngắn nhất.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">F</kbd></td>
                <td><strong>Toàn màn hình (Fullscreen)</strong></td>
                <td>Phóng to toàn bộ phòng thí nghiệm đồ thị để chiếu trên máy chiếu giảng đường.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Nhóm 3: Toàn hệ thống -->
        <div class="shortcut-section">
          <div class="section-title-wrap">
            <span class="section-badge">🌐 Trợ giúp &amp; Cửa sổ</span>
            <h4 class="section-title">Phím tắt chung</h4>
          </div>
          <table class="shortcut-table">
            <thead>
              <tr>
                <th style="width: 140px;">Phím tắt</th>
                <th style="width: 220px;">Hành động</th>
                <th>Mô tả hoạt động</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd class="kbd-pill">?</kbd></td>
                <td><strong>Mở trung tâm trợ giúp</strong></td>
                <td>Bật/Tắt cửa sổ Hướng dẫn sử dụng &amp; Phím tắt này bất cứ lúc nào.</td>
              </tr>
              <tr>
                <td><kbd class="kbd-pill">Esc</kbd></td>
                <td><strong>Đóng cửa sổ / Thoát</strong></td>
                <td>Đóng popup trợ giúp, hộp thoại nhập dữ liệu, hoặc menu đang mở.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderTipsPane() {
    return `
      <div class="guide-pane-tips">
        <p class="guide-intro">
          Các mẹo hữu ích giúp giải bài tập nhanh chóng và tận dụng tối đa sức mạnh của nền tảng:
        </p>

        <!-- Tip 1: Cú pháp Logic -->
        <div class="guide-tip-box">
          <div class="tip-box-header">
            <span class="tip-badge">Cú pháp chuẩn</span>
            <h4 class="tip-title">⚡ Cú pháp gõ nhanh các phép toán Logic</h4>
          </div>
          <p class="tip-text">Trong Logic Lab, bạn có thể gõ trực tiếp bằng bàn phím thông thường, hệ thống sẽ tự động nhận diện ký hiệu tương đương:</p>
          <div class="syntax-grid">
            <div class="syntax-item">
              <span class="syntax-name">Phủ định ($\neg p$):</span>
              <code>~p</code> hoặc <code>!p</code>
            </div>
            <div class="syntax-item">
              <span class="syntax-name">Phép Hội AND ($p * q$):</span>
              <code>p * q</code>, <code>p q</code> (viết liền), hoặc <code>p &amp; q</code>
            </div>
            <div class="syntax-item">
              <span class="syntax-name">Phép Tuyển OR ($p + q$):</span>
              <code>p + q</code> hoặc <code>p | q</code>
            </div>
            <div class="syntax-item">
              <span class="syntax-name">Phép Kéo theo ($p \rightarrow q$):</span>
              <code>p -> q</code>
            </div>
            <div class="syntax-item">
              <span class="syntax-name">Tương đương ($p \leftrightarrow q$):</span>
              <code>p <-> q</code>
            </div>
            <div class="syntax-item">
              <span class="syntax-name">Phép Tuyển loại XOR ($p \oplus q$):</span>
              <code>p (+) q</code> hoặc <code>p xor q</code>
            </div>
          </div>
        </div>

        <!-- Tip 2: AI Vision Scanner -->
        <div class="guide-tip-box">
          <div class="tip-box-header">
            <span class="tip-badge">Trí tuệ nhân tạo</span>
            <h4 class="tip-title">📸 Quét đề thi bằng hình ảnh (AI Vision)</h4>
          </div>
          <p class="tip-text">
            Bạn có hình ảnh đồ thị trong đề thi hoặc tài liệu PDF/Word? 
            Hãy vào <strong>Graph Lab</strong> ➡️ nhấn nút <strong>"Nhập đồ thị"</strong> ➡️ chọn tab <strong>"Tải ảnh / File"</strong>. 
            Hệ thống hỗ trợ kéo thả ảnh (PNG, JPG, WebP) hoặc file tài liệu (DOCX, PDF) lên đến 15MB. AI sẽ tự động trích xuất các đỉnh, cạnh và trọng số chính xác trong 3 giây!
          </p>
        </div>

        <!-- Tip 3: Xuất bài giảng & In đề -->
        <div class="guide-tip-box">
          <div class="tip-box-header">
            <span class="tip-badge">Xuất dữ liệu</span>
            <h4 class="tip-title">🖨️ Xuất ảnh bài giảng &amp; In đề thi PDF</h4>
          </div>
          <p class="tip-text">
            • <strong>Lưu ảnh bài giảng:</strong> Khi cô sử dụng Bút giảng dạy, hãy nhấp vào biểu tượng <strong>📸 Máy ảnh</strong> trên thanh công cụ để tải ảnh chụp màn hình ghi chú chất lượng cao định dạng PNG gửi cho sinh viên.<br>
            • <strong>In đề thi làm trên giấy:</strong> Trong tab <strong>Luyện tập &amp; Đề thi</strong>, hãy chọn <em>Đề thi mô phỏng</em> và nhấp <strong>"In đề thi / Xuất PDF"</strong> để tạo bản in sạch đẹp, chuẩn form đề thi kết thúc học phần.
          </p>
        </div>

        <!-- Tip 4: Chế độ Sáng / Tối -->
        <div class="guide-tip-box">
          <div class="tip-box-header">
            <span class="tip-badge">Hiển thị</span>
            <h4 class="tip-title">☀️ Chống chói khi dùng Máy Chiếu Giảng Đường</h4>
          </div>
          <p class="tip-text">
            Mặc định giao diện sử dụng <strong>Dark Mode</strong> dịu mắt khi học đêm. Khi giảng dạy trên máy chiếu trong lớp học có ánh sáng mạnh, cô có thể bấm nút <strong>☀️ Sáng</strong> ở góc phải trên cùng để chuyển sang <strong>Light Mode</strong> với độ tương phản cao, chữ đen nền sáng rõ ràng cho sinh viên ngồi xa.
          </p>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    // Window keyboard listener for '?' and Escape
    window.addEventListener('keydown', this._handleKeyDown);

    // Backdrop click outside to close
    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', (e) => {
        if (e.target === this.backdropEl) {
          this.close();
        }
      });
    }
  }

  _bindTabButtons() {
    if (!this.dialogEl) return;

    // Close buttons
    const btnClose = this.dialogEl.querySelector('#btnCloseHelpGuide');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    const btnUnderstand = this.dialogEl.querySelector('#btnHelpUnderstand');
    if (btnUnderstand) {
      btnUnderstand.addEventListener('click', () => this.close());
    }

    // Tab buttons
    this.dialogEl.querySelectorAll('.help-tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.setTab(tab);
      });
    });

    // Navigation buttons in quickstart pane
    this.dialogEl.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-nav');
        this.close();
        if (typeof this.onNavigate === 'function') {
          this.onNavigate(view);
        }
      });
    });
  }

  _onKeyDown(e) {
    // Ignore when typing inside input / textarea / select
    const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    // Escape closes modal if open
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
      e.preventDefault();
      return;
    }

    // '?' toggles modal
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
      e.preventDefault();
    }
  }

  /**
   * Opens the help guide modal.
   * @param {'quickstart'|'shortcuts'|'tips'} [tab='quickstart']
   */
  open(tab = 'quickstart') {
    this.isOpen = true;
    if (['quickstart', 'shortcuts', 'tips'].includes(tab)) {
      this.activeTab = tab;
    }
    if (this.backdropEl) {
      this.backdropEl.style.display = 'flex';
      this._renderContent();
    }
  }

  /**
   * Closes the modal.
   */
  close() {
    this.isOpen = false;
    if (this.backdropEl) {
      this.backdropEl.style.display = 'none';
    }
  }

  /**
   * Switches active tab pane.
   * @param {'quickstart'|'shortcuts'|'tips'} tabName
   */
  setTab(tabName) {
    if (['quickstart', 'shortcuts', 'tips'].includes(tabName)) {
      this.activeTab = tabName;
      if (this.backdropEl && this.isOpen) {
        this._renderContent();
      }
    }
  }

  /**
   * Destroys component and removes listeners.
   */
  destroy() {
    this.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._handleKeyDown);
    }
    if (this.backdropEl && this.backdropEl.parentNode) {
      this.backdropEl.parentNode.removeChild(this.backdropEl);
    }
  }
}
