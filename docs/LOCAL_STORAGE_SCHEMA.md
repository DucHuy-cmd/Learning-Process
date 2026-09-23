# LOCAL STORAGE SCHEMA SPECIFICATION

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Phiên bản Schema:** v1.0 (Legacy Baseline)  
**Ngày tài liệu hóa:** 23/09/2026  

---

## 1. DANH SÁCH TOÀN BỘ CÁC KEY TRONG LOCAL STORAGE

Hệ thống hiện tại sử dụng chính xác **5 khóa (keys)** trong `localStorage`:

| Tên Khóa (Storage Key) | Kiểu Dữ Liệu | Mục Đích Sử Dụng | Giá Trị Mặc Định |
| :--- | :--- | :--- | :--- |
| `custom_user_graph_tabs` | `string` (JSON Array) | Lưu trữ danh sách toàn bộ các tab bài tập người dùng đã tạo. | `[]` (mảng rỗng) |
| `custom_active_graph_id` | `string` | Lưu ID của tab đồ thị đang được kích hoạt và hiển thị. | `null` |
| `dijkstra_theme` | `string` (`"dark"` \| `"light"`) | Lưu lựa chọn giao diện Sáng / Tối của người dùng. | `"dark"` |
| `dijkstra_panel_top` | `string` (Float Number) | Tỉ lệ phần trăm chiều cao của tầng trên (`#topRow`). | `"52.0"` (tương đương 52%) |
| `dijkstra_panel_graph` | `string` (Float Number) | Tỉ lệ phần trăm chiều rộng của khung đồ thị SVG (`#graphContainer`). | `"62.0"` (tương đương 62%) |

---

## 2. CHI TIẾT CẤU TRÚC JSON SCHEMA

### 2.1 Khóa `custom_user_graph_tabs`
Lưu trữ một mảng các đối tượng tab:
```json
[
  {
    "id": "graph_1727100000000_1",
    "name": "Bài tập 1 (Có hướng)",
    "algo": "dijkstra",
    "canClose": true,
    "data": {
      "name": "Bài tập 1 (Có hướng)",
      "isBuilding": false,
      "directed": true,
      "algo": "dijkstra",
      "nodes": [
        {
          "id": "A",
          "name": "A",
          "short": "A",
          "kind": "phong",
          "floor": 1,
          "x": 100,
          "y": 200
        },
        {
          "id": "B",
          "name": "B",
          "short": "B",
          "kind": "phong",
          "floor": 1,
          "x": 300,
          "y": 100
        }
      ],
      "edges": [
        ["A", "B", 4.5]
      ]
    }
  }
]
```

#### Quy cách trường:
- `id` (`string`, bắt buộc): Định danh duy nhất của tab (thường sinh bởi `graph_${Date.now()}_${counter}`).
- `name` (`string`, bắt buộc): Tên hiển thị trên thanh tab VS Code.
- `algo` (`string`, tùy chọn): Thuật toán được chọn mặc định khi chuyển vào tab (`"dijkstra"` | `"kruskal"` | `"prim"` | `"euler"` | `"hamilton"`).
- `canClose` (`boolean`, tùy chọn): Cho phép hiển thị nút đóng `x`.
- `data` (`object`, bắt buộc): Dữ liệu đồ thị cốt lõi:
  - `data.name`: Tên bài tập.
  - `data.isBuilding`: Cờ nhận diện sơ đồ tòa nhà tầng 1/tầng 2. Mặc định `false`.
  - `data.directed`: Cờ đồ thị có hướng (`true`) hoặc vô hướng (`false`).
  - `data.nodes`: Mảng danh sách đỉnh:
    - `id`: Mã định danh đỉnh.
    - `name`: Tên đầy đủ của đỉnh.
    - `short`: Tên viết tắt hiển thị trên đồ họa SVG.
    - `kind`: Thể loại đỉnh (`"sanh"` | `"hl"` | `"phong"` | `"cauthang"`).
    - `x`, `y`: Tọa độ 2D trên canvas SVG.
  - `data.edges`: Mảng 2 chiều các cạnh: `[ [uId, vId, weight], ... ]`.

### 2.2 Khóa `custom_active_graph_id`
- Chuỗi thuần túy (e.g. `"graph_1727100000000_1"`).
- Nếu không có tab nào mở (`openGraphTabs.length === 0`), khóa này bị xóa khỏi `localStorage` (`removeItem`).

### 2.3 Khóa `dijkstra_theme`
- Nhận 1 trong 2 giá trị chuỗi: `"dark"` hoặc `"light"`.
- Nếu chưa được lưu, mặc định là `"dark"`.

### 2.4 Khóa `dijkstra_panel_top` và `dijkstra_panel_graph`
- Chuỗi biểu diễn số thực định dạng 1 chữ số thập phân (e.g. `"52.0"`, `"60.5"`).
- Phạm vi hợp lệ của `top`: $18\% \le \text{pct} \le 82\%$.
- Phạm vi hợp lệ của `graph`: $25\% \le \text{pct} \le 78\%$.

---

## 3. XỬ LÝ LỖI VÀ TƯƠNG THÍCH NGƯỢC (FALLBACK MECHANISMS)

1. **Dữ liệu JSON hỏng (Corrupted JSON):**  
   Hàm `loadUserTabs()` bọc trong khối `try { ... } catch(e) {}`. Nếu parse JSON thất bại hoặc `localStorage` bị lỗi, hàm trả về mảng rỗng `[]` và không làm crash ứng dụng.
2. **Thiếu trường `data.directed` (Legacy Data Migration):**  
   Khi đọc tab từ `localStorage`, nếu `t.data.directed === undefined`, mã tự động gán `t.data.directed = false` để tương thích tuyệt đối với dữ liệu từ các phiên bản trước.
3. **Tab rỗng khi khởi động:**  
   Nếu không có tab nào trong `localStorage`, hệ thống hiển thị overlay hướng dẫn trống (`#emptyGraphState`) và tự động kích hoạt modal tạo đồ thị sau 250ms.

---

## 4. CAM KẾT TƯƠNG THÍCH CHO PHASE 2

Khi chuyển đổi sang TypeScript và kiến trúc module hóa trong Phase 2, `StorageService` **BẮT BUỘC** phải:
1. Đọc đúng các tên key legacy nêu trên để giữ nguyên toàn bộ dữ liệu bài tập mà người dùng đã lưu trên trình duyệt của họ.
2. Cung cấp adapter để serialize / deserialize hai chiều giữa schema này và Graph Model mới.
