/**
 * @file HomeView.js
 * Landing Page View Component
 * 
 * 4 Core Pillars for Discrete Mathematics:
 * - Pillar 1: Chương 1+2: Logic Lab (Mệnh đề, Vị từ, Bảng chân trị, K-Map, Mạch số)
 * - Pillar 2: Chương 3: Counting Lab (Ánh xạ, Dirichlet, Tổ hợp, Hệ thức truy hồi)
 * - Pillar 3: Chương 4: Relation Lab (Ma trận Boolean, 4 Tính chất, Roy-Warshall, Hasse POSET)
 * - Pillar 4: Chương 5: Graph Lab (Lý thuyết Đồ thị, Dijkstra, Kruskal, Prim, Euler, Hamilton)
 * + Academic & Teaching Suite (Đấu trường trắc nghiệm, Studio Soạn đề, AI Vision)
 */

import { authManager } from '../../core/auth/AuthManager.js';

export class HomeView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onNavigate] - Callback(viewName)
   */
  constructor({ container = null, onNavigate = null } = {}) {
    this.container = container;
    this.onNavigate = onNavigate || (() => {});

    authManager.onAuthStateChanged(() => {
      if (this.container) {
        this.render();
      }
    });

    if (this.container) {
      this.render();
    }
  }

  /**
   * Mounts and renders content into container.
   * @param {HTMLElement} [targetContainer]
   */
  render(targetContainer = null) {
    if (targetContainer) {
      this.container = targetContainer;
    }
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="home-container" style="max-width:1200px;margin:0 auto;padding:24px 20px 80px;">
        
        <!-- 1. Hero Section -->
        <section class="hero-section" style="text-align:center;padding:36px 16px 28px;">
          <div class="hero-pill-badge" style="display:inline-flex;align-items:center;gap:8px;padding:6px 18px;border-radius:30px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.28);margin-bottom:16px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
            <span style="font-size:12.5px;font-weight:700;color:var(--text);letter-spacing:0.3px;">
              ✨ Không Gian Học Tập &amp; Thực Nghiệm Toán Rời Rạc Tương Tác
            </span>
          </div>
          <h1 class="hero-title" style="font-size:36px;font-weight:800;color:var(--text);margin:0 0 14px;line-height:1.25;">
            Toán Rời Rạc Platform
          </h1>
          <p class="hero-subtitle" style="max-width:900px;margin:0 auto 10px;font-size:15px;color:var(--dim);line-height:1.65;">
            Hệ thống số hóa giáo trình chuẩn trọn vẹn 4 phân môn cốt lõi: <strong>Logic Mệnh đề & Đại số Boole</strong> (Chương 1 & 2), <strong>Phương pháp đếm & Giải tích Tổ hợp</strong> (Chương 3), <strong>Lý thuyết Quan hệ & Biểu đồ Hasse</strong> (Chương 4), và <strong>Lý thuyết Đồ thị cùng các thuật toán kinh điển</strong> (Chương 5). Mô phỏng trực quan từng bước biến đổi trạng thái, kiểm thử tương tác và ngân hàng trắc nghiệm ôn luyện thi.
          </p>

          <!-- Horizontal Theory Navigation Tab Bar -->
          <div style="display:flex;justify-content:center;margin-top:20px;">
            <button type="button" class="btn-primary home-theory-bar-btn" id="btnHomeTheoryBar" 
                    title="Chuyển đến trang Tổng hợp Lý thuyết Toán Rời Rạc">
              <span class="home-theory-icon">📚</span>
              <span>Lý Thuyết Tổng Hợp &amp; Giáo Trình Chi Tiết</span>
              <span class="home-theory-arrow">→</span>
            </button>
          </div>
        </section>

        <!-- 2. The 4 Core Pillars of Discrete Mathematics -->
        <div class="section-head" style="margin-top:36px;margin-bottom:24px;text-align:center;">
          <h2 class="section-title" style="font-size:25px;font-weight:800;color:var(--text);margin:0;">4 Trụ Cột Cốt Lõi Toán Rời Rạc</h2>
        </div>

        <section class="four-pillars-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(265px, 1fr));gap:20px;margin-bottom:40px;">
          
          <!-- Pillar 1: Logic Lab (Chương 1 + 2) - Amber Theme -->
          <div class="pillar-card" id="pillarLogic" style="background:var(--panel);border:1.5px solid rgba(245,158,11,0.4);border-radius:12px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;transition:all 0.2s ease;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:30px;">⚡</span>
                <span class="pill-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.35);padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;">Chương 1 & 2: Logic & Boole</span>
              </div>
              <h3 style="font-size:18px;font-weight:800;color:var(--text);margin:0 0 8px 0;">Logic Lab</h3>
              <p style="font-size:13px;color:var(--dim);line-height:1.55;margin:0 0 14px 0;">
                Phòng thực nghiệm Logic Mệnh đề, vị từ và Đại số Boole. Lập bảng chân trị tự động từng dòng biến đổi, chứng minh tương đương logic, tối tiểu hóa hàm Boole bằng Bìa Karnaugh (K-Map 2-4 biến), chuyển đổi dạng chuẩn tắc DNF/CNF và trực quan hóa sơ đồ cổng mạch logic số tương tác.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Bảng chân trị</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Bìa Karnaugh K-Map</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Chuẩn tắc DNF/CNF</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Sơ đồ Cổng Logic</span>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin-top:auto;padding-top:14px;">
              <button class="btn-primary" type="button" id="btnPillarLogic" style="padding:10px 28px;font-size:13px;font-weight:700;border-radius:8px;background:#f59e0b;border:1px solid #d97706;color:#18181b;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">Vào Logic Lab →</button>
            </div>
          </div>

          <!-- Pillar 2: Counting Lab (Chương 3) - Emerald Theme -->
          <div class="pillar-card" id="pillarCounting" style="background:var(--panel);border:1.5px solid rgba(16,185,129,0.4);border-radius:12px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;transition:all 0.2s ease;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:30px;">🎲</span>
                <span class="pill-badge" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.35);padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;">Chương 3: Phương pháp Đếm</span>
              </div>
              <h3 style="font-size:18px;font-weight:800;color:var(--text);margin:0 0 8px 0;">Counting Lab</h3>
              <p style="font-size:13px;color:var(--dim);line-height:1.55;margin:0 0 14px 0;">
                Phòng thực nghiệm Đại số Tổ hợp và Giải tích Đếm. Mô phỏng trực quan Ánh xạ (Đơn ánh, Toàn ánh, Song ánh, Hàm ngược f⁻¹), Nguyên lý Dirichlet (Chuồng bồ câu) tính toán tự động, Tam giác Pascal & Phép tính Hoán vị - Chỉnh hợp - Tổ hợp, và cỗ máy Giải hệ thức truy hồi tuyến tính thuần nhất từng bước chi tiết.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Studio Ánh xạ & Hàm số</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Nguyên lý Dirichlet</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Hoán vị - Tổ hợp</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Hệ thức Truy hồi</span>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin-top:auto;padding-top:14px;">
              <button class="btn-primary" type="button" id="btnPillarCounting" style="padding:10px 28px;font-size:13px;font-weight:700;border-radius:8px;background:#10b981;border:1px solid #059669;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">Vào Counting Lab →</button>
            </div>
          </div>

          <!-- Pillar 3: Relation Lab (Chương 4) - Violet Theme -->
          <div class="pillar-card" id="pillarRelation" style="background:var(--panel);border:1.5px solid rgba(139,92,246,0.4);border-radius:12px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;transition:all 0.2s ease;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:30px;">🔗</span>
                <span class="pill-badge" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.35);padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;">Chương 4: Quan hệ & Thứ tự</span>
              </div>
              <h3 style="font-size:18px;font-weight:800;color:var(--text);margin:0 0 8px 0;">Relation Lab</h3>
              <p style="font-size:13px;color:var(--dim);line-height:1.55;margin:0 0 14px 0;">
                Phòng thực nghiệm Quan hệ hai ngôi và Thứ tự. Khảo sát đồng bộ 3 trong 1 (Ma trận Boolean M_R, Đồ thị có hướng Bézier và Danh sách cặp), kiểm tra 4 tính chất (Phản xạ, Đối xứng, Phản xứng, Bắc cầu), mô phỏng thuật toán Roy-Warshall từng bước tính Bao đóng W₀ ➔ W_n, phân tích Phân hoạch Lớp tương đương & Tập thương A/R, và tự động dựng Biểu đồ Hasse (POSET) phân tích 4 cực trị.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Ma trận Boolean & Đồ thị</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Thanh tra 4 Tính chất</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Thuật toán Warshall</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Biểu đồ Hasse & Lớp Tương đương</span>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin-top:auto;padding-top:14px;">
              <button class="btn-primary" type="button" id="btnPillarRelation" style="padding:10px 28px;font-size:13px;font-weight:700;border-radius:8px;background:#8b5cf6;border:1px solid #7c3aed;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">Vào Relation Lab →</button>
            </div>
          </div>

          <!-- Pillar 4: Graph Lab (Chương 5) - Blue Theme -->
          <div class="pillar-card" id="pillarGraph" style="background:var(--panel);border:1.5px solid rgba(59,130,246,0.4);border-radius:12px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;transition:all 0.2s ease;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <span style="font-size:30px;">🕸️</span>
                <span class="pill-badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.35);padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:700;">Chương 5: Lý thuyết Đồ thị</span>
              </div>
              <h3 style="font-size:18px;font-weight:800;color:var(--text);margin:0 0 8px 0;">Graph Lab</h3>
              <p style="font-size:13px;color:var(--dim);line-height:1.55;margin:0 0 14px 0;">
                Phòng thực nghiệm Lý thuyết Đồ thị & Cây. Mô phỏng tương tác 5 thuật toán kinh điển: Tìm đường đi ngắn nhất (Dijkstra), Cây khung nhỏ nhất MST (Kruskal với Disjoint Set & Prim với Min-Heap), Chu trình / Đường đi Euler (Hierholzer với Stack) và Chu trình Hamilton (Quay lui Backtracking). Tự do vẽ đồ thị, nhập ma trận kề / danh sách cạnh và điều khiển phát từng bước.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Dijkstra đường đi ngắn nhất</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Kruskal & Prim Cây khung</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Euler & Hamilton</span>
                <span style="font-size:11px;padding:2px 8px;background:var(--panel-alt);border-radius:4px;color:var(--dim);border:1px solid var(--line);">Bảng trạng thái từng bước</span>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin-top:auto;padding-top:14px;">
              <button class="btn-primary" type="button" id="btnPillarGraph" style="padding:10px 28px;font-size:13px;font-weight:700;border-radius:8px;background:#3b82f6;border:1px solid #2563eb;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">Vào Graph Lab →</button>
            </div>
          </div>

        </section>

        <!-- 3. Academic & Teaching Suite Highlight (Giữ lại thanh ngang đấu trường trắc nghiệm) -->
        <section class="academic-suite" style="margin-top:28px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:24px;display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:20px;">
          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div style="font-size:28px;">🎮</div>
            <div>
              <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 4px 0;">Đấu trường Trắc nghiệm</h4>
              <p style="font-size:12.5px;color:var(--dim);margin:0 0 10px 0;line-height:1.4;">
                Hàng trăm câu hỏi trắc nghiệm rèn luyện phản xạ tính toán, chấm điểm tức thì và giải thích chi tiết từng bước.
              </p>
              <button type="button" class="btn-sm" id="btnHomeQuizArena" style="font-size:12px;padding:5px 14px;cursor:pointer;">Vào luyện tập →</button>
            </div>
          </div>

          <div style="display:${authManager.isAdmin() ? 'flex' : 'none'};gap:14px;align-items:flex-start;">
            <div style="font-size:28px;">👩‍🏫</div>
            <div>
              <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 4px 0;">Studio Soạn đề & In ấn A4</h4>
              <p style="font-size:12.5px;color:var(--dim);margin:0 0 10px 0;line-height:1.4;">
                Công cụ hỗ trợ Giảng viên xuất đề thi chuẩn giấy in A4, phiếu tô trắc nghiệm chuẩn máy chấm và bảng đáp án.
              </p>
              <button type="button" class="btn-sm" id="btnHomeQuizStudio" style="font-size:12px;padding:5px 14px;cursor:pointer;">Vào Studio soạn đề →</button>
            </div>
          </div>

          <div style="display:${authManager.isAdmin() ? 'none' : 'flex'};gap:14px;align-items:flex-start;">
            <div style="font-size:28px;">🏆</div>
            <div>
              <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 4px 0;">Bảng Vàng Thành Tích</h4>
              <p style="font-size:12.5px;color:var(--dim);margin:0 0 10px 0;line-height:1.4;">
                Theo dõi bảng xếp hạng sinh viên xuất sắc, điểm số và thành tích rèn luyện qua các bài thi trắc nghiệm Toán Rời Rạc.
              </p>
              <button type="button" class="btn-sm" id="btnHomeLeaderboard" style="font-size:12px;padding:5px 14px;cursor:pointer;">Xem bảng xếp hạng →</button>
            </div>
          </div>

          <div style="display:flex;gap:14px;align-items:flex-start;">
            <div style="font-size:28px;">📷</div>
            <div>
              <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 4px 0;">AI Vision Trợ Giảng</h4>
              <p style="font-size:12.5px;color:var(--dim);margin:0 0 10px 0;line-height:1.4;">
                Nhận diện đồ thị hoặc công thức logic trực tiếp từ ảnh chụp bài tập, bài giảng viết tay một cách tự động.
              </p>
              <button type="button" class="btn-sm" id="btnHomeAiVision" style="font-size:12px;padding:5px 14px;cursor:pointer;">Thử AI Vision →</button>
            </div>
          </div>
        </section>

        <!-- 4. Minimalist & Premium Footer (Idea 4) -->
        <footer class="home-footer" id="homeFooter">
          <div class="footer-brand-wrap">
            <span class="footer-brand-icon">⚡</span>
            <span class="footer-brand-title">Toán Rời Rạc Platform</span>
            <span class="footer-brand-badge">Đại Học</span>
            <span class="footer-class-badge">Học phần Toán Rời Rạc</span>
          </div>

          <p class="footer-desc">
            Nền tảng số hóa giáo trình chuẩn và mô phỏng thực nghiệm trực quan 4 phân môn cốt lõi của Toán&nbsp;Rời&nbsp;Rạc.
          </p>

          <div class="footer-team-row">
            <span class="footer-team-label">Nhóm tác giả:</span>
            <div class="footer-author-group">
              <span class="footer-author-pill">Đức Huy</span>
              <span class="footer-author-pill">Nhất Vũ</span>
              <span class="footer-author-pill">Trường Vũ</span>
              <span class="footer-author-pill">Ngọc Hưng</span>
            </div>
          </div>

          <div class="footer-bottom-bar">
            <span>© 2026 Toán Rời Rạc Platform. All rights reserved.</span>
            <span class="footer-version-tag">Sinh viên • Discrete Mathematics</span>
          </div>
        </footer>

      </div>
    `;

    // 0. Hero Theory Navigation Tab Bar
    const btnHomeTheoryBar = this.container.querySelector('#btnHomeTheoryBar');
    if (btnHomeTheoryBar) {
      btnHomeTheoryBar.addEventListener('click', () => this.onNavigate('theory'));
    }

    // 1. Pillar 1: Logic Lab
    const pillarLogic = this.container.querySelector('#pillarLogic');
    if (pillarLogic) pillarLogic.addEventListener('click', () => this.onNavigate('logic'));

    const btnPillarLogic = this.container.querySelector('#btnPillarLogic');
    if (btnPillarLogic) btnPillarLogic.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNavigate('logic');
    });

    // 2. Pillar 2: Counting Lab
    const pillarCounting = this.container.querySelector('#pillarCounting');
    if (pillarCounting) pillarCounting.addEventListener('click', () => this.onNavigate('counting'));

    const btnPillarCounting = this.container.querySelector('#btnPillarCounting');
    if (btnPillarCounting) btnPillarCounting.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNavigate('counting');
    });

    // 3. Pillar 3: Relation Lab
    const pillarRelation = this.container.querySelector('#pillarRelation');
    if (pillarRelation) pillarRelation.addEventListener('click', () => this.onNavigate('relation'));

    const btnPillarRelation = this.container.querySelector('#btnPillarRelation');
    if (btnPillarRelation) btnPillarRelation.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNavigate('relation');
    });

    // 4. Pillar 4: Graph Lab
    const pillarGraph = this.container.querySelector('#pillarGraph');
    if (pillarGraph) pillarGraph.addEventListener('click', () => this.onNavigate('lab'));

    const btnPillarGraph = this.container.querySelector('#btnPillarGraph');
    if (btnPillarGraph) btnPillarGraph.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNavigate('lab');
    });

    // 5. Academic suite buttons
    const btnHomeQuizArena = this.container.querySelector('#btnHomeQuizArena');
    if (btnHomeQuizArena) btnHomeQuizArena.addEventListener('click', () => this.onNavigate('quiz', 'practice'));

    const btnHomeQuizStudio = this.container.querySelector('#btnHomeQuizStudio');
    if (btnHomeQuizStudio) btnHomeQuizStudio.addEventListener('click', () => this.onNavigate('quiz', 'studio'));

    const btnHomeLeaderboard = this.container.querySelector('#btnHomeLeaderboard');
    if (btnHomeLeaderboard) btnHomeLeaderboard.addEventListener('click', () => this.onNavigate('quiz', 'leaderboard'));

    const btnHomeAiVision = this.container.querySelector('#btnHomeAiVision');
    if (btnHomeAiVision) btnHomeAiVision.addEventListener('click', () => this.onNavigate('ai'));
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }
}
