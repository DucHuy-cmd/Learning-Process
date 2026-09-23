# KNOWN ISSUES & TECHNICAL DEBT REGISTER

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Thời điểm lập:** Phase 1 Baseline Audit (23/09/2026)  
**Mục đích:** Ghi nhận toàn bộ rủi ro, nợ kỹ thuật và các trường hợp biên để xử lý trong Phase 2+ mà không làm phá vỡ an toàn Phase 1.  

---

## 1. NỢ KIẾN TRÚC & TỔ CHỨC MÃ NGUỒN

### ISSUE-01: Kiến trúc Monolithic đơn file cực lớn
- **Mô tả:** Toàn bộ 4,632 dòng mã (HTML, CSS và JavaScript) tập trung trong duy nhất file `index.html`.
- **Rủi ro:** Khó bảo trì, xung đột code khi làm việc nhóm, nguy cơ side-effects diện rộng khi chỉnh sửa một hàm nhỏ.
- **Kế hoạch giải quyết:** Phase 2 sẽ bóc tách thành kiến trúc module hóa với Vite + TypeScript (`src/core`, `src/ui`, `src/algorithms`, `src/storage`).

### ISSUE-02: Ô nhiễm Global Scope (Global State Pollution)
- **Mô tả:** Hơn 20 biến trạng thái toàn cục (`curGraph`, `adj`, `edgeList`, `currentAlgo`, `trace`, `stepIdx`, `openGraphTabs`, `activeGraphId`, `zoomScale`, `panX`, `panY`...) cùng tồn tại tự do trong thẻ `<script>`.
- **Rủi ro:** Nguy cơ ghi đè trạng thái ngoài ý muốn giữa các thành phần giao diện và thuật toán.
- **Kế hoạch giải quyết:** Encapsulate thành các Service và Store hướng đối tượng / reactive store trong Phase 2.

### ISSUE-03: Không có Module System và TypeScript
- **Mô tả:** Mã nguồn JavaScript ES5/ES6 tự do, không có kiểu dữ liệu tĩnh (`types`), không có `interface` hợp đồng.
- **Rủi ro:** Lỗi thời gian chạy (runtime errors) khi thao tác với đối tượng đỉnh hoặc cạnh thiếu thuộc tính.
- **Kế hoạch giải quyết:** Chuyển đổi hoàn toàn sang TypeScript có type definitions nghiêm ngặt trong Phase 2.

---

## 2. RỦI RO THUẬT TOÁN VÀ HIỆU NĂNG

### ISSUE-04: Giới hạn tính toán đồng bộ thuật toán Hamilton (Backtracking Explosion)
- **Mô tả:** Thuật toán Hamilton sử dụng DFS đệ quy quay lui trực tiếp trên luồng chính (Main UI Thread).
- **Rủi ro:** Với đồ thị đầy đủ hoặc mật độ dày có $N \ge 12$ đỉnh, số nhánh quay lui bùng nổ hàm mũ. Mặc dù đã có chốt chặn `cap = 30,000` bước, trình duyệt vẫn có thể bị khựng (jank / lag) trong vài trăm mili-giây.
- **Kế hoạch giải quyết:** Đưa engine giải thuật vào Web Worker chạy ngầm không chặn UI trong các phase tương lai.

### ISSUE-05: Tiền tính toán toàn bộ Frames (Eager Frame Computation)
- **Mô tả:** Khi chọn đồ thị hoặc đổi bước, hệ thống tính toán trước toàn bộ mảng `frames[]` (có thể lên tới hàng nghìn frame) và lưu vào bộ nhớ RAM.
- **Rủi ro:** Tốn dung lượng bộ nhớ đối với các đồ thị lớn hoặc vết chạy dài.
- **Kế hoạch giải quyết:** Xem xét cơ chế Generator / Lazy Frame Evaluation cho các thuật toán phức tạp trong Phase 3+.

### ISSUE-06: Kruskal & Prim từ chối đồ thị có hướng ở runtime
- **Mô tả:** Khi người dùng bật cờ có hướng mà chọn Kruskal hoặc Prim, thuật toán chỉ trả về 1 frame thông báo "Không áp dụng" thay vì tự động chuyển đổi thành vô hướng hoặc vô hiệu hóa nút bấm từ UI.
- **Rủi ro:** Người dùng có thể bỡ ngỡ khi thấy bảng tiến trình trống.
- **Kế hoạch giải quyết:** Cải thiện UI validation và gợi ý thông minh trong Phase 4.

---

## 3. HẠNG MỤC GIAO DIỆN & TRỰC QUAN HÓA

### ISSUE-07: Canvas SVG ViewBox cố định
- **Mô tả:** Kích thước canvas cố định `viewBox="0 0 940 450"`.
- **Rủi ro:** Đối với đồ thị có trên 25 đỉnh, các đỉnh có thể bị co cụm hoặc tràn viền nếu không zoom/pan.
- **Kế hoạch giải quyết:** Bổ sung thuật toán tự động tính toán bounding box và bố cục tự động (Force-directed, Circular layout) trong tương lai.

### ISSUE-08: Highlight mã nguồn C++ thủ công
- **Mô tả:** Mã nguồn C++ hiển thị dạng mảng chuỗi HTML thủ công, các dòng được highlight bằng cách kiểm tra số dòng mảng `lines: [22, 23, 24]`.
- **Rủi ro:** Rất khó cập nhật code mẫu mới hoặc bổ sung ngôn ngữ khác (Python, Java).
- **Kế hoạch giải quyết:** Tích hợp bộ syntax highlighter chuyên nghiệp (PrismJS / Shiki) và mapping AST linh hoạt trong Phase 3.

---

## 4. LỖI THỰC TẾ TRONG MÃ NGUỒN CŨ (CONFIRMED LEGACY APPLICATION DEFECTS)
*(Các lỗi tồn tại sẵn trong `legacy/index.html` được ghi nhận chính thức trong Phase 1 — TUYỆT ĐỐI CHƯA SỬA trong Phase 1)*

### BUG-PRIM-001: Prim header generation uses nodeS incorrectly with Array.map
- **Vị trí:** `legacy/index.html:1793` (`headers: [...curGraph.nodes.map(nodeS), "Tv", "Te"]`) kết hợp dòng 1594 (`const nodeS = (i) => ...`).
- **Mô tả:** Phương thức `Array.prototype.map(nodeS)` truyền đối tượng Node vào tham số đầu tiên `i` của hàm `nodeS(i)`. Vì `nodeS` mong đợi `i` là chỉ số số nguyên (`i >= 0 && i < n`), phép so sánh `object >= 0` trở thành `NaN >= 0` $\to$ `false`.
- **Hệ quả:** Thuật toán Prim tính toán chính xác MST và các bước ma trận, nhưng mảng thuộc tính `headers` trả về bị biến thành toàn dấu trừ: `['-','-','-','-','-','-','-','-','Tv','Te']`.
- **Trạng thái:** **CHƯA SỬA (CONFIRMED LEGACY BUG)**. Bảo tồn nguyên trạng trong Phase 1, test suite ghi nhận hành vi này.

### BUG-PRIM-002: Prim directed-graph rejection branch throws TypeError
- **Vị trí:** `legacy/index.html:1577` (`headers: [...curGraph.nodes.map(nodeShort), "Tv", "Te"]`) kết hợp dòng 2874 (`function nodeShort(i){ return curGraph.nodes[i].short...; }`).
- **Mô tả:** Khi nhận đồ thị có hướng, khối lệnh từ chối tại dòng 1546 cố gắng sinh headers bằng `curGraph.nodes.map(nodeShort)`. Hàm `nodeShort` nhận đối tượng Node vào biến `i`, thực hiện `curGraph.nodes[object]` $\to$ `undefined`. Khi đọc `.short`, JavaScript ném `TypeError: Cannot read properties of undefined (reading 'short')`.
- **Hệ quả:** Khối thông báo từ chối đồ thị có hướng của Prim bị crash runtime thay vì trả về thông báo lỗi hòa nhã.
- **Trạng thái:** **CHƯA SỬA (CONFIRMED LEGACY BUG)**. Bảo tồn nguyên trạng trong Phase 1, test suite khẳng định việc ném `TypeError`.

### BUG-PARSER-001: Plain "A B weight" syntax is not parsed correctly despite comment
- **Vị trí:** `legacy/index.html:4260-4267` trong hàm `parseEdgeList`.
- **Mô tả:** Comment dòng 4260 khẳng định hỗ trợ cú pháp `// Cú pháp 2: A B: 1 hoặc A B 1 (không có dấu -)`. Tuy nhiên biểu thức chính quy tại dòng 4262 lại dùng `(?:\s*[:=,]\s*([0-9.]+))?`, bắt buộc phải có ký tự `:`, `=`, hoặc `,`. Khi người dùng nhập `C D 10` (phân cách bằng khoảng trắng thuần túy), nhóm trọng số không khớp, `match[3]` thành `undefined` và trọng số bị gán mặc định về `1.0`.
- **Hệ quả:** Dữ liệu cạnh `C D 10` bị nhận thành `['C', 'D', 1.0]`.
- **Trạng thái:** **CHƯA SỬA (CONFIRMED LEGACY BUG)**. Bảo tồn nguyên trạng trong Phase 1, test suite ghi nhận hành vi này.
