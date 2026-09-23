# PROJECT INVENTORY: GRAPH ALGORITHMS TRACER

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Phiên bản khảo sát:** Baseline v1.0 (Phase 1 Golden Master)  
**Thời gian lập:** 23/09/2026  

---

## 1. CẤU TRÚC FILE VÀ THƯ MỤC

| Đường dẫn file / thư mục | Kích thước | Số dòng | Vai trò & Mục đích | Trạng thái bảo tồn |
| :--- | :--- | :--- | :--- | :--- |
| `index.html` | ~188 KB | 4,632 | Điểm truy cập web chính của hệ thống, chứa toàn bộ HTML, CSS và JS legacy. | **NGUYÊN BẢN (KHÔNG SỬA)** |
| `legacy/index.html` | ~188 KB | 4,632 | Bản sao Golden Master 100% nguyên bản của `index.html` làm căn cứ đối chiếu. | **GOLDEN MASTER BẢO TỒN** |
| `package.json` | ~400 B | 16 | Cấu hình Node.js package, script test `vitest`, dependencies kiểm thử. | Mới tạo trong Phase 1 |
| `vitest.config.js` | ~200 B | 10 | Cấu hình môi trường chạy kiểm thử Vitest. | Mới tạo trong Phase 1 |
| `tests/helpers/legacy-runner.js` | ~3 KB | 95 | Test harness nạp `legacy/index.html` vào JSDOM độc lập cho từng ca test. | Mới tạo trong Phase 1 |
| `tests/fixtures/...` | ~10 KB | ~350 | 12 file JSON đồ thị mẫu cố định cho 5 thuật toán. | Mới tạo trong Phase 1 |
| `tests/fixtures/expected/...` | ~5 KB | ~120 | 5 file JSON chứa kết quả kỳ vọng chuẩn toán học và giáo trình. | Mới tạo trong Phase 1 |
| `tests/regression/...` | ~25 KB | ~600 | 9 file test suite kiểm thử hồi quy bao phủ mã REG-01 đến REG-18. | Mới tạo trong Phase 1 |
| `docs/...` | ~40 KB | ~1,200 | Bộ tài liệu kỹ thuật hoàn chỉnh của Phase 1. | Mới tạo trong Phase 1 |
| `README.md` | ~4 KB | ~100 | Hướng dẫn vận hành dự án và chạy bộ test suite. | Cập nhật trong Phase 1 |

---

## 2. PHÂN TÍCH CẤU TRÚC HTML DOM

### 2.1 Header Bar
- `#vscodeTabsBar`: Khung chứa các tab bài tập kiểu VS Code.
- Nút `#btnThemeToggle`: Chuyển đổi Dark Mode / Light Mode.
- Nút `#btnResetPanels`: Khôi phục tỉ lệ chia khung kéo thả về mặc định.
- Nút `#btnCustomGraph`: Mở modal tự tạo đồ thị mới.
- Nút `#btnFullscreen`: Bật / tắt chế độ toàn màn hình.

### 2.2 Control Bar
- Nhóm chọn thuật toán `#algoSwitch`: Dijkstra, Kruskal, Prim, Euler, Hamilton.
- `#graphTypeSel`: Dropdown chọn loại đồ thị (Vô hướng / Có hướng).
- `#startLabel`, `#startSel`: Chọn đỉnh nguồn hoặc đỉnh gốc MST.
- `#endGroupWrap` (`#endSel`): Chọn đỉnh đích (chỉ cho Dijkstra).
- `#hamModeGroup`: Chọn chế độ Chu trình (Cycle) hoặc Đường đi (Path) cho Hamilton.
- Nhóm điều khiển mô phỏng: `#btnStepBack`, `#btnStepForward`, `#btnSkipNode`, `#btnPlay`, `#speedSel`.

### 2.3 Main Stage (Hai tầng chia khung kéo thả)
- Tầng trên `#topRow`:
  - Khung trái `#graphContainer`: Chứa canvas SVG `#svg` và thẻ `<g id="zoomLayer">`, cùng cụm nút Zoom/Pan.
  - Thanh kéo dọc `#resizerVertical`.
  - Khung phải `#codeContainer`: Hiển thị mã nguồn C++ mẫu có highlight dòng theo frame.
- Thanh kéo ngang `#resizerHorizontal`.
- Tầng dưới `#bottomRow`:
  - Bảng tiến trình / ma trận chuẩn giáo trình `#matrixTable` (`#matrixHead`, `#matrixBody`).
  - Hộp hàng đợi `#pqBox` (`#pqItems`): Min-Heap, tập $T_e$, danh sách cạnh MST, ngăn xếp Euler.
  - Banner kết quả `#algoResultBanner`: Hiển thị kết luận có/không có chu trình hoặc đường đi Euler.

### 2.4 Modal Tạo Đồ Thị (`#customModal`)
- Radio `customInputMode`: Chuyển đổi giữa Danh sách cạnh (`#customListWrap`) và Ma trận kề (`#customMatrixWrap`).
- `#modalAlgoSwitch`: Chọn thuật toán gán cho bài tập mới.
- `#modalDirectedSwitch`: Chọn đồ thị Có hướng hoặc Vô hướng.
- Nút `#btnFillSample`: Tự động điền dữ liệu mẫu nhanh.
- Nút `#btnApplyCustom`: Khởi tạo bài tập và thêm tab mới.

---

## 3. THIẾT KẾ CSS DESIGN TOKENS

Hệ thống token màu chuẩn được khai báo tại `:root`:
- `--bg: #090d14`: Màu nền tổng thể chế độ tối.
- `--panel: #0f1722`: Màu panel giao diện.
- `--panel-alt: #141f2e`: Màu panel phụ / header bảng.
- `--line: #1c293a`: Màu đường viền / khung ngăn cách.
- `--text: #e2edf8`: Màu chữ chính.
- `--dim: #7e92a6`: Màu chữ phụ / chú thích mờ.
- `--accent: #f59e0b`: Màu vàng hổ phách (nhấn mạnh).
- `--accent2: #10b981`: Màu xanh lục bảo.
- `--blue: #0284c7`, `--green: #10b981`, `--red: #ef4444`, `--orange: #ff5722`.
- Class `body.theme-light`: Ghi đè biến token cho chế độ sáng dịu mắt.

---

## 4. TỔNG HỢP HÀM TOÀN CỤC VÀ STATE TRONG JAVASCRIPT

### 4.1 State Quản Lý
- `curGraph`: Đối tượng đồ thị đang mở (`{ name, directed, nodes, edges, isBuilding, algo }`).
- `adj`: Danh sách kề dạng mảng `adj[u] = [ { to, weight } ]`.
- `edgeList`: Mảng phẳng các cạnh `{ a, b, w }`.
- `currentAlgo`: Tên thuật toán hiện tại (`dijkstra` | `kruskal` | `prim` | `euler` | `hamilton`).
- `trace`: Kết quả chạy thuật toán chứa mảng `frames[]`.
- `stepIdx`: Chỉ số bước chạy hiện tại ($0 \le \text{stepIdx} < \text{frames.length}$).
- `openGraphTabs`: Mảng các tab người dùng đang mở.
- `activeGraphId`: ID của tab đang kích hoạt.

### 4.2 Hàm Cốt Lõi Thuật Toán
- `buildTraceAndMatrix(startIndex, endIndex)`: Dijkstra.
- `buildTraceKruskal()`: Kruskal (Union-Find).
- `buildTracePrim(startIndex)`: Prim (mở rộng cây khung $T_v, T_e$).
- `buildTraceEuler(startIndex)`: Euler (Hierholzer stack).
- `buildTraceHamilton(startIndex, wantCycle)`: Hamilton (Backtracking).

### 4.3 Hàm Tiện Ích & Render
- `parseAdjacencyMatrix(text, isDirected)`: Phân tích ma trận kề.
- `parseEdgeList(text, defaultDirected)`: Phân tích danh sách cạnh.
- `setupGraphData(graph)`: Nạp dữ liệu đồ thị vào runtime.
- `renderGraphBase()`: Dựng SVG đỉnh và cạnh.
- `paintFrame(frame)`: Vẽ snapshot bước chạy lên canvas và bảng ma trận.
- `saveUserTabs()` / `loadUserTabs()`: Đọc và ghi tab vào `localStorage`.
- `stepForward()` / `stepBackward()` / `jumpToStep(idx)`: Điều phối bước chạy.
