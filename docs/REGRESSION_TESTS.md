# REGRESSION TEST SUITE SPECIFICATION (REG-01 TO REG-18)

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Framework:** Vitest + JSDOM Harness  
**Mục tiêu:** Mạng lưới an toàn tuyệt đối (Safety Net) bảo vệ hành vi của hệ thống trước và sau refactor.  

---

## BẢNG TRA CỨU 18 MÃ KIỂM THỬ HỒI QUY (TEST MATRIX)

| Mã ID | Tên Ca Kiểm Thử | File Test | File Fixture Đầu Vào | Kết Quả Kỳ Vọng Chính |
| :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Dijkstra trên đồ thị vô hướng chuẩn giáo trình | `tests/regression/dijkstra.test.js` | `tests/fixtures/dijkstra/textbook-undirected.json` | Đường đi `u → y → z → w`, tổng chi phí = `9.0`, bảng ma trận có bước 0 đến bước kết thúc. |
| **REG-02** | Dijkstra trên đồ thị có hướng & nhận diện không tới đích | `tests/regression/dijkstra.test.js` | `tests/fixtures/dijkstra/directed-sample.json` | Đường đi hợp lệ `A → C → B → D` (chi phí = `8.0`); đường ngược chiều `D → A` không có đường đi (`Infinity`, `noPath = true`). |
| **REG-03** | Kruskal MST trên đồ thị vô hướng | `tests/regression/kruskal.test.js` | `tests/fixtures/kruskal/sample-undirected.json` | MST gồm đúng 3 cạnh, tổng trọng số = `6.0`, từ chối các cạnh tạo chu trình. |
| **REG-04** | Kruskal từ chối đồ thị có hướng | `tests/regression/kruskal.test.js` | `tests/fixtures/kruskal/sample-directed.json` | Trả về 1 frame thông báo "Kruskal chỉ áp dụng cho đồ thị vô hướng.", không crash. |
| **REG-05** | Prim MST trên đồ thị slide 8 đỉnh X1-X8 | `tests/regression/prim.test.js` | `tests/fixtures/prim/slide-x1-x8.json` | Đủ 8 đỉnh kết nạp vào $T_v$, MST 7 cạnh, tổng trọng số = `101.0`, cột $T_v, T_e$ sinh chuẩn giáo trình. |
| **REG-06** | Prim từ chối đồ thị có hướng | `tests/regression/prim.test.js` | `tests/fixtures/prim/sample-directed.json` | Trả về thông báo "Prim chỉ áp dụng cho đồ thị vô hướng.", không crash. |
| **REG-07** | Euler chu trình trên đồ thị vô hướng | `tests/regression/euler.test.js` | `tests/fixtures/euler/circuit-undirected.json` | Nhận diện đúng 0 đỉnh bậc lẻ, sinh chu trình duyệt hết 6 cạnh (7 đỉnh), đỉnh đầu = đỉnh cuối. |
| **REG-08** | Euler đường đi trên đồ thị vô hướng | `tests/regression/euler.test.js` | `tests/fixtures/euler/path-undirected.json` | Nhận diện đúng 2 đỉnh bậc lẻ, sinh đường đi duyệt hết 8 cạnh (9 đỉnh) xuất phát và kết thúc tại 2 đỉnh lẻ. |
| **REG-09** | Euler trên đồ thị có hướng cân bằng bậc | `tests/regression/euler.test.js` | `tests/fixtures/euler/circuit-directed.json` | Nhận diện in-degree == out-degree, duyệt khép kín toàn bộ cạnh có hướng. |
| **REG-10** | Euler nhận diện đồ thị không liên thông | `tests/regression/euler.test.js` | `tests/fixtures/euler/disconnected-undirected.json` | Trả về `type = "none"`, `connected = false`, thông báo dừng do không liên thông. |
| **REG-11** | Hamilton chu trình & đường đi vô hướng | `tests/regression/hamilton.test.js` | `tests/fixtures/hamilton/undirected-cycle.json` | Tìm thấy chu trình qua 4 đỉnh; tìm thấy đường đi qua 4 đỉnh bằng quay lui. |
| **REG-12** | Hamilton chu trình có hướng | `tests/regression/hamilton.test.js` | `tests/fixtures/hamilton/directed-cycle.json` | Tìm thấy chu trình có hướng khép kín qua 3 đỉnh tam giác. |
| **REG-13** | Bộ phân tích ma trận kề (Matrix Parser) | `tests/regression/parsers.test.js` | Chuỗi đầu vào test inline | Phân tích đúng cả có hướng và vô hướng, gộp đối xứng, bỏ qua 0, -, inf. |
| **REG-14** | Bộ phân tích danh sách cạnh (Edge List Parser) | `tests/regression/parsers.test.js` | Chuỗi đầu vào test inline | Tự động nhận dạng `->`, `-`, gán trọng số mặc định 1.0, lọc bỏ ghi chú `#` và `//`. |
| **REG-15** | Hiển thị đồ họa SVG & Snapshot Frames | `tests/regression/visualization.test.js` | `tests/fixtures/dijkstra/textbook-undirected.json` | Dựng đúng các thẻ SVG `<g>`, `<line>`, `<path>`, cập nhật text formula, desc, zoom/pan transform. |
| **REG-16** | Vòng đời Tab & Local Storage Schema | `tests/regression/storage-tabs.test.js` | `tests/fixtures/dijkstra/textbook-undirected.json` | Đọc ghi chính xác 5 key, chuyển đổi tab, xóa tab, chuyển theme và lưu panel layout. |
| **REG-17** | Bộ điều khiển bước mô phỏng (Step Controls) | `tests/regression/controls.test.js` | `tests/fixtures/dijkstra/textbook-undirected.json` | Bước tới, bước lùi, nhảy bước, chặn biên $0$ và $\text{length}-1$. |
| **REG-18** | Bộ chuyển đổi thuật toán & Giao diện | `tests/regression/controls.test.js` | `tests/fixtures/dijkstra/textbook-undirected.json` | Đổi tiêu đề code C++, cập nhật các nút chọn đỉnh nguồn/đích, ẩn/hiện bảng tương ứng theo thuật toán. |

---

## HƯỚNG DẪN THỰC THI KIỂM THỬ

Để chạy toàn bộ bộ kiểm thử hồi quy:

```bash
# Cài đặt môi trường kiểm thử (nếu chưa cài)
npm install

# Chạy toàn bộ 18 ca kiểm thử hồi quy
npm test

# Chạy kiểm thử ở chế độ theo dõi thay đổi (Watch mode)
npm run test:watch
```
