/**
 * @file FundamentalsView.js
 * Graph Fundamentals Educational View Component
 *
 * Explains core graph theory concepts:
 * - Vertices & Edges (G = (V, E))
 * - Directed vs Undirected graphs
 * - Weighted graphs
 * - Degree (in-degree, out-degree)
 * - Paths & Cycles
 * - Connectivity (components, weak/strong connectivity)
 * - Representations (Adjacency Matrix vs Edge List)
 * - Spanning Trees
 *
 * Follows TheoryView styling standards using CSS tokens and inline SVGs.
 */

export class FundamentalsView {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container]
   * @param {Function} [options.onBack] - Callback when user navigates back to theory view
   */
  constructor({ container = null, onBack = null } = {}) {
    this.container = container;
    this.onBack = onBack || (() => {});

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
      <div class="theory-container" style="max-width:1100px;margin:0 auto;padding:24px 20px 80px;">
        <!-- Top Navigation / Action Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
          <button class="btn-sm btn-icon" id="btnBackToTheory" title="Quay lại danh sách chuyên đề">
            <span>←</span>
            <span>Quay lại Lý thuyết</span>
          </button>
          <span class="theory-badge" style="background:rgba(2,132,199,0.15);color:var(--blue-light);border:1px solid var(--line);">
            📚 Chuyên đề Đại cương
          </span>
        </div>

        <!-- Section Header -->
        <div class="section-head" style="margin-bottom:32px;">
          <h2 class="section-title" style="font-size:26px;display:flex;align-items:center;gap:10px;">
            <span>🌐</span>
            <span>Đại cương Lý thuyết Đồ thị (Graph Theory Fundamentals)</span>
          </h2>
          <p class="section-subtitle" style="font-size:14px;color:var(--dim);max-width:800px;line-height:1.6;margin-top:8px;">
            Nền tảng toán học rời rạc cấu thành các cấu trúc mạng và thuật toán tối ưu.
            Mọi bài toán Dijkstra, Prim, Kruskal, Euler và Hamilton đều bắt đầu từ các khái niệm cơ bản dưới đây.
          </p>
        </div>

        <!-- Content Grid -->
        <div style="display:flex;flex-direction:column;gap:24px;">

          <!-- Section 1: Định nghĩa Đồ thị -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 01</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">1. Định nghĩa Đồ thị (Graph Definition)</h3>
            </div>
            <p style="color:var(--text);font-size:13.5px;line-height:1.7;margin-bottom:14px;">
              Một đồ thị <code style="color:var(--accent);font-weight:600;">G = (V, E)</code> được cấu thành bởi hai tập hợp:
            </p>
            <ul style="color:var(--dim);font-size:13px;line-height:1.8;padding-left:20px;margin-bottom:16px;">
              <li><strong style="color:var(--text);">Tập đỉnh (Vertices / Nodes) <code>V</code></strong>: Tập hữu hạn các điểm đối tượng (ví dụ: các thành phố, giao lộ, máy chủ mạng). Số lượng đỉnh ký hiệu là <code>|V|</code> hay <code>n</code>.</li>
              <li><strong style="color:var(--text);">Tập cạnh (Edges) <code>E</code></strong>: Tập các đường nối liên kết giữa các cặp đỉnh. Số lượng cạnh ký hiệu là <code>|E|</code> hay <code>m</code>. Một cạnh nối đỉnh <code>u</code> và đỉnh <code>v</code> được ký hiệu là <code>(u, v)</code> hoặc <code>u - v</code>.</li>
            </ul>
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;display:flex;align-items:center;justify-content:center;gap:30px;flex-wrap:wrap;">
              <svg width="240" height="90" viewBox="0 0 240 90" style="overflow:visible;">
                <!-- Edge -->
                <line x1="45" y1="45" x2="195" y2="45" stroke="var(--blue-light)" stroke-width="2.5" />
                <!-- Node 1 -->
                <circle cx="45" cy="45" r="20" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2.5" />
                <text x="45" y="50" text-anchor="middle" fill="var(--text)" font-weight="700" font-size="13">u</text>
                <!-- Node 2 -->
                <circle cx="195" cy="45" r="20" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2.5" />
                <text x="195" y="50" text-anchor="middle" fill="var(--text)" font-weight="700" font-size="13">v</text>
                <!-- Label -->
                <text x="120" y="35" text-anchor="middle" fill="var(--dim)" font-size="12">cạnh e = (u, v)</text>
              </svg>
            </div>
          </div>

          <!-- Section 2: Có hướng vs Vô hướng -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 02</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">2. Đồ thị Có hướng vs Đồ thị Vô hướng</h3>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;">
                <h4 style="color:var(--accent);font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                  <span>⇄</span> Đồ thị Vô hướng (Undirected)
                </h4>
                <p style="color:var(--dim);font-size:13px;line-height:1.6;margin-bottom:12px;">
                  Các cạnh không có chiều. Cạnh <code>(u, v)</code> cũng chính là <code>(v, u)</code>. Lưu thông hai chiều đối xứng.
                </p>
                <div style="text-align:center;padding:10px 0;">
                  <svg width="180" height="60" viewBox="0 0 180 60">
                    <line x1="30" y1="30" x2="150" y2="30" stroke="var(--blue-light)" stroke-width="2" />
                    <circle cx="30" cy="30" r="14" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2" />
                    <text x="30" y="34" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700">A</text>
                    <circle cx="150" cy="30" r="14" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2" />
                    <text x="150" y="34" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700">B</text>
                    <text x="90" y="22" text-anchor="middle" fill="var(--dim)" font-size="11">A - B</text>
                  </svg>
                </div>
              </div>

              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;">
                <h4 style="color:var(--blue-light);font-size:15px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                  <span>➔</span> Đồ thị Có hướng (Directed / Digraph)
                </h4>
                <p style="color:var(--dim);font-size:13px;line-height:1.6;margin-bottom:12px;">
                  Mỗi cạnh là một cặp có thứ tự (cung / arc) <code>u → v</code> với điểm đầu <code>u</code> và điểm cuối <code>v</code>.
                </p>
                <div style="text-align:center;padding:10px 0;">
                  <svg width="180" height="60" viewBox="0 0 180 60">
                    <defs>
                      <marker id="arrowFundamentals" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L8,3 z" fill="var(--blue-light)" />
                      </marker>
                    </defs>
                    <line x1="30" y1="30" x2="132" y2="30" stroke="var(--blue-light)" stroke-width="2" marker-end="url(#arrowFundamentals)" />
                    <circle cx="30" cy="30" r="14" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2" />
                    <text x="30" y="34" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700">A</text>
                    <circle cx="150" cy="30" r="14" fill="var(--panel-alt)" stroke="var(--accent)" stroke-width="2" />
                    <text x="150" y="34" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700">B</text>
                    <text x="85" y="22" text-anchor="middle" fill="var(--dim)" font-size="11">A → B</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Đồ thị có trọng số -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 03</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">3. Đồ thị Có Trọng số (Weighted Graph)</h3>
            </div>
            <p style="color:var(--dim);font-size:13.5px;line-height:1.7;margin-bottom:12px;">
              Mỗi cạnh <code>e = (u, v)</code> được gán một số thực <code style="color:var(--accent);font-weight:600;">w(e)</code> đại diện cho độ dài, chi phí, khoảng cách hoặc dung lượng đường truyền.
            </p>
            <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text);">
              💡 <strong>Ứng dụng thực tế:</strong>
              Thuật toán <strong>Dijkstra</strong> tối ưu hóa tổng trọng số đường đi ngắn nhất: \(\sum w(e) \to \min\).
              Thuật toán <strong>Prim & Kruskal</strong> tìm cây khung có tổng trọng số các cạnh nhỏ nhất: \(W(T) = \sum_{e \in T} w(e) \to \min\).
            </div>
          </div>

          <!-- Section 4: Bậc của đỉnh -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 04</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">4. Bậc của Đỉnh (Degree of a Vertex)</h3>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:14px;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                <h4 style="color:var(--text);font-size:14px;margin-bottom:6px;">Đồ thị vô hướng — Bậc <code>deg(v)</code></h4>
                <p style="color:var(--dim);font-size:13px;line-height:1.6;">
                  Số lượng cạnh liên thuộc với đỉnh <code>v</code> (khuyên/loop tính 2).
                  <br><strong>Định lý bắt tay:</strong> Tổng bậc của tất cả các đỉnh bằng 2 lần số cạnh:
                  <br><code style="color:var(--accent);">∑ deg(v) = 2 · |E|</code>
                  → Số đỉnh bậc lẻ luôn là số chẵn.
                </p>
              </div>

              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                <h4 style="color:var(--text);font-size:14px;margin-bottom:6px;">Đồ thị có hướng — Bán bậc vào/ra</h4>
                <p style="color:var(--dim);font-size:13px;line-height:1.6;">
                  • <strong>Bán bậc vào (In-degree) <code>deg⁻(v)</code></strong>: số cung đi vào <code>v</code>.
                  <br>• <strong>Bán bậc ra (Out-degree) <code>deg⁺(v)</code></strong>: số cung đi ra từ <code>v</code>.
                  <br><code style="color:var(--blue-light);">∑ deg⁻(v) = ∑ deg⁺(v) = |E|</code>
                </p>
              </div>
            </div>
            <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:12px;font-size:12.5px;color:var(--text);">
              📌 <strong>Ý nghĩa với thuật toán Euler:</strong>
              Đồ thị vô hướng có chu trình Euler khi mọi đỉnh đều có bậc chẵn.
              Đồ thị có hướng có chu trình Euler khi mọi đỉnh có <code>deg⁻(v) = deg⁺(v)</code>.
            </div>
          </div>

          <!-- Section 5: Đường đi & Chu trình -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 05</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">5. Đường đi (Path) & Chu trình (Cycle)</h3>
            </div>
            <div style="color:var(--dim);font-size:13.5px;line-height:1.7;">
              <p style="margin-bottom:8px;">
                • <strong style="color:var(--text);">Đường đi (Path):</strong> Dãy luân phiên các đỉnh và cạnh <code>v₀, e₁, v₁, e₂, ..., eₖ, vₖ</code> sao cho cạnh <code>eᵢ</code> nối đỉnh <code>vᵢ₋₁</code> và <code>vᵢ</code>. Đường đi đơn là đường đi không lặp lại đỉnh nào.
              </p>
              <p style="margin-bottom:8px;">
                • <strong style="color:var(--text);">Chu trình (Cycle / Circuit):</strong> Đường đi khép kín có đỉnh xuất phát trùng với đỉnh kết thúc (<code>v₀ = vₖ</code>) và độ dài ít nhất là 1 cạnh (đối với có hướng) hoặc 3 cạnh (đối với vô hướng đơn).
              </p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
                <div style="background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px;">
                  <strong style="color:var(--accent);">Chu trình Euler:</strong> Đi qua <em>mọi cạnh</em> của đồ thị đúng 1 lần rồi trở về điểm xuất phát.
                </div>
                <div style="background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px;">
                  <strong style="color:var(--accent);">Chu trình Hamilton:</strong> Đi qua <em>mọi đỉnh</em> của đồ thị đúng 1 lần rồi trở về đỉnh xuất phát.
                </div>
              </div>
            </div>
          </div>

          <!-- Section 6: Tính liên thông -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 06</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">6. Tính Liên thông (Connectivity)</h3>
            </div>
            <ul style="color:var(--dim);font-size:13px;line-height:1.8;padding-left:20px;">
              <li><strong style="color:var(--text);">Đồ thị vô hướng liên thông (Connected):</strong> Nếu luôn tồn tại đường đi giữa bất kỳ cặp đỉnh nào trong đồ thị. Nếu không liên thông, đồ thị phân rã thành các <em>thành phần liên thông</em> tách rời.</li>
              <li><strong style="color:var(--text);">Liên thông mạnh (Strongly Connected):</strong> Trong đồ thị có hướng, với mọi cặp đỉnh <code>u, v</code>, luôn có đường đi có hướng từ <code>u → v</code> và từ <code>v → u</code>.</li>
              <li><strong style="color:var(--text);">Liên thông yếu (Weakly Connected):</strong> Trong đồ thị có hướng, nếu coi mọi cung có hướng thành cạnh vô hướng mà đồ thị vô hướng kết quả là liên thông.</li>
            </ul>
          </div>

          <!-- Section 7: Biểu diễn Ma trận kề & Danh sách cạnh -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 07</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">7. Các Phương pháp Biểu diễn Đồ thị</h3>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;">
              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                <h4 style="color:var(--blue-light);font-size:14px;margin-bottom:6px;">🔢 Ma trận kề (Adjacency Matrix)</h4>
                <p style="color:var(--dim);font-size:12.5px;line-height:1.6;margin-bottom:10px;">
                  Ma trận vuông cỡ <code>n × n</code>, trong đó phần tử <code>A[i][j]</code> biểu thị trọng số cạnh từ đỉnh <code>i</code> đến đỉnh <code>j</code> (hoặc 0/inf nếu không có cạnh).
                </p>
                <div style="background:var(--panel-alt);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;color:var(--text);">
                  &nbsp;&nbsp;A&nbsp;&nbsp;B&nbsp;&nbsp;C<br>
                  A&nbsp;0&nbsp;&nbsp;4&nbsp;&nbsp;2<br>
                  B&nbsp;4&nbsp;&nbsp;0&nbsp;&nbsp;1<br>
                  C&nbsp;2&nbsp;&nbsp;1&nbsp;&nbsp;0
                </div>
                <div style="font-size:11.5px;color:var(--dim);margin-top:8px;">
                  Ưu điểm: Kiểm tra cạnh <code>(u, v)</code> trong <code>O(1)</code>. Bộ nhớ <code>O(V²)</code>.
                </div>
              </div>

              <div style="background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;">
                <h4 style="color:var(--accent);font-size:14px;margin-bottom:6px;">📝 Danh sách cạnh (Edge List)</h4>
                <p style="color:var(--dim);font-size:12.5px;line-height:1.6;margin-bottom:10px;">
                  Danh sách lưu trữ các bộ ba <code>(u, v, w)</code> cho mỗi cạnh của đồ thị. Rất trực quan và tiện dụng khi nhập liệu.
                </p>
                <div style="background:var(--panel-alt);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;color:var(--text);">
                  A - B: 4<br>
                  A - C: 2<br>
                  B - C: 1
                </div>
                <div style="font-size:11.5px;color:var(--dim);margin-top:8px;">
                  Ưu điểm: Tối ưu bộ nhớ <code>O(E)</code> cho đồ thị thưa. Phù hợp cho Kruskal duyệt cạnh.
                </div>
              </div>
            </div>
          </div>

          <!-- Section 8: Cây và Cây khung -->
          <div class="theory-card" style="padding:22px;border:1px solid var(--card-border);background:var(--card-bg);border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span class="theory-badge">Khái niệm 08</span>
              <h3 style="font-size:18px;color:var(--text);font-weight:700;">8. Cây & Cây khung (Tree & Spanning Tree)</h3>
            </div>
            <p style="color:var(--dim);font-size:13.5px;line-height:1.7;margin-bottom:12px;">
              • <strong style="color:var(--text);">Cây (Tree):</strong> Một đồ thị vô hướng, liên thông và không chứa bất kỳ chu trình nào. Một cây có <code>n</code> đỉnh thì luôn có đúng <code>n - 1</code> cạnh.
            </p>
            <p style="color:var(--dim);font-size:13.5px;line-height:1.7;margin-bottom:12px;">
              • <strong style="color:var(--text);">Cây khung (Spanning Tree):</strong> Đồ thị con của đồ thị liên thông <code>G</code>, chứa <em>toàn bộ</em> các đỉnh của <code>G</code> và là một cây (gồm đúng <code>|V| - 1</code> cạnh liên thông không chu trình).
            </p>
            <p style="color:var(--dim);font-size:13.5px;line-height:1.7;">
              • <strong style="color:var(--text);">Cây khung nhỏ nhất (MST - Minimum Spanning Tree):</strong> Cây khung có tổng trọng số các cạnh là bé nhất. Hai thuật toán kinh điển tìm MST là <strong>Prim</strong> (phát triển tập đỉnh Tv) và <strong>Kruskal</strong> (kết nạp cạnh tăng dần cùng Disjoint-Set).
            </p>
          </div>

        </div>

        <!-- Bottom Return Button -->
        <div style="margin-top:36px;text-align:center;">
          <button class="btn-primary" id="btnBottomBackToTheory" style="padding:10px 24px;font-size:14px;">
            ← Quay lại Chuyên đề Lý thuyết
          </button>
        </div>
      </div>
    `;

    // Bind back button events
    const btnBack = this.container.querySelector('#btnBackToTheory');
    if (btnBack) {
      btnBack.addEventListener('click', () => this.onBack());
    }

    const btnBottomBack = this.container.querySelector('#btnBottomBackToTheory');
    if (btnBottomBack) {
      btnBottomBack.addEventListener('click', () => this.onBack());
    }
  }

  /**
   * Mounts view into target element.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.render(container);
  }
}
