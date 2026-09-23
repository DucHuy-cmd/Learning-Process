# PHASE 1 TEST MATRIX & TRACEABILITY

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Mục tiêu:** Bảng ma trận đối soát toàn diện giữa yêu cầu hệ thống và các ca kiểm thử hồi quy Phase 1.  

---

## 1. MA TRẬN PHỦ KIỂM THỬ (COVERAGE & TRACEABILITY MATRIX)

| Mã ID | Phân hệ (Subsystem) | Hàm Legacy Được Kiểm Thử | Trọng Số / Mức Độ Rủi Ro | Dữ Liệu Đầu Vào | Xác Nhận (Assertions) Nghiêm Ngặt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Dijkstra Engine | `buildTraceAndMatrix()` | **Critical** (Cốt lõi) | Slide giáo trình 8 đỉnh $u, r, s, t, x, y, z, w$ | - `total === 9.0`<br>- `path === [0, 5, 6, 7]`<br>- `reachable === true`<br>- `fullMatrix[0].cells[0].val === '0*'` (bước 0 khởi tạo) |
| **REG-02** | Dijkstra Engine | `buildTraceAndMatrix()` | **High** | Đồ thị có hướng 4 đỉnh $A, B, C, D$ | - `total === 8.0`<br>- `path === [0, 2, 1, 3]`<br>- Chiều ngược lại: `total === Infinity`, `noPath === true` |
| **REG-03** | Kruskal Engine | `buildTraceKruskal()` | **Critical** | Đồ thị vô hướng 4 đỉnh 5 cạnh | - `total === 6.0`<br>- `mst.length === 3`<br>- `connected === true`<br>- Phát hiện & loại đúng 2 cạnh tạo chu trình |
| **REG-04** | Kruskal Engine | `buildTraceKruskal()` | **Medium** | Đồ thị có hướng (`directed: true`) | - `frames[0].phase === 'Không áp dụng'`<br>- Thông báo từ chối chính xác |
| **REG-05** | Prim Engine | `buildTracePrim()` | **Critical** | Slide giáo trình 8 đỉnh $X_1..X_8$ | - `total === 101.0`<br>- `reached === 8`<br>- `mst.length === 7`<br>- Ghi nhận BUG-PRIM-001: headers sinh toàn `'-'` |
| **REG-06** | Prim Engine | `buildTracePrim()` | **Medium** | Đồ thị có hướng (`directed: true`) | - Ghi nhận BUG-PRIM-002: nhánh từ chối ném `TypeError` khi gọi `nodes.map(nodeShort)` |
| **REG-07** | Euler Engine | `buildTraceEuler()` | **High** | 5 đỉnh, $0$ đỉnh bậc lẻ | - `type === 'circuit'`<br>- `circuit.length === 7`<br>- Duyệt đủ 6 cạnh khép kín |
| **REG-08** | Euler Engine | `buildTraceEuler()` | **High** | 5 đỉnh, đúng $2$ đỉnh bậc lẻ | - `type === 'path'`<br>- `circuit.length === 9`<br>- Bắt đầu và kết thúc tại 2 đỉnh lẻ |
| **REG-09** | Euler Engine | `buildTraceEuler()` | **Medium** | Có hướng, $in = out$ | - `type === 'circuit'`<br>- Duyệt đủ cạnh theo chiều mũi tên |
| **REG-10** | Euler Engine | `buildTraceEuler()` | **High** | Đồ thị không liên thông 2 cụm | - `type === 'disconnected'` (ngữ nghĩa chuẩn legacy)<br>- `connected === false`<br>- Không crash |
| **REG-11** | Hamilton Engine | `buildTraceHamilton()` | **High** | 4-cycle vô hướng | - Tìm thấy chu trình qua đủ 4 đỉnh phân biệt<br>- `found === true`, `truncated === false` |
| **REG-12** | Hamilton Engine | `buildTraceHamilton()` | **Medium** | 3-cycle có hướng | - Tìm thấy chu trình khép kín theo đúng chiều mũi tên |
| **REG-13** | Input Parser | `parseAdjacencyMatrix()` | **Critical** | Ma trận kề chuỗi (có/không header) | - Sinh đúng mảng `nodes` và `edges`<br>- Bắt lỗi thiếu cột với hàng có $< n$ phần tử |
| **REG-14** | Input Parser | `parseEdgeList()` | **Critical** | Danh sách cạnh chuỗi đa cú pháp | - Nhận dạng `->`, `-`<br>- Ghi nhận BUG-PARSER-001: `C D 10` thiếu delimiter rơi về mặc định `1.0` |
| **REG-15** | Renderer & UI | `renderGraphBase()`, `paintFrame()` | **High** | DOM SVG canvas | - Tồn tại `#NB{i}`, class `.node-label`, `#E{a}_{b}`<br>- Cập nhật nội dung `#stepNoteText`, `#stepFormula` |
| **REG-16** | Storage & Tabs | `saveUserTabs()`, `loadUserTabs()` | **Critical** | `localStorage` mock | - Đúng 5 khóa `custom_user_graph_tabs`, `custom_active_graph_id`, `dijkstra_theme`, `dijkstra_panel_top`, `dijkstra_panel_graph` |
| **REG-17** | Stepping Engine | `stepForward()`, `stepBackward()` | **High** | Trace kết quả | - Test harness gọi `goto(i)`<br>- Chặn biên tại $0$ và $\text{frames.length}-1$ |
| **REG-18** | UI Switcher | `updateAlgoUI()` | **Medium** | State `currentAlgo` | - Đổi nhãn nút, ẩn/hiện trường nhập tương ứng với từng thuật toán |

---

## 2. TIÊU CHUẨN ĐẠT ĐIỀU KIỆN (ACCEPTANCE CRITERIA)
1. **100% Pass Rate:** Cả 18 ca kiểm thử hồi quy phải vượt qua thành công mà không có cảnh báo nghiêm trọng nào.
2. **Không sửa code legacy:** Toàn bộ test suite chạy thông qua JSDOM adapter trên `legacy/index.html` nguyên bản.
3. **Giá trị số học tuyệt đối:** Mọi so sánh chi phí, trọng số, đường đi đều xác thực bằng số thực và mảng cụ thể, không sử dụng `toBeTruthy()` tùy tiện.
