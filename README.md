# GRAPH ALGORITHMS TRACER / GRAPH AI LAB

Nền tảng trực quan hóa và mô phỏng từng bước các thuật toán đồ thị: **Dijkstra, Kruskal, Prim, Euler, Hamilton** kết hợp tương tác dữ liệu, bảng ma trận chuẩn giáo trình và kiểm thử tự động.

---

## 1. TỔNG QUAN HIỆN TẠI

Dự án hiện đã tách ứng dụng thành các module `src/core`, `src/app`, `src/ui` và `src/server`. Ngoài các bài học và phòng thí nghiệm thuật toán, nền tảng có đăng nhập, trợ lý AI, ngân hàng câu hỏi, đề thi được giao và bộ kiểm thử Vitest.

## 2. LUYỆN TẬP VÀ ĐỀ THI CHÍNH THỨC

- **Tự luyện tập**: làm câu hỏi và xem lời giải ngay; kết quả luyện tập không được ghi vào bảng xếp hạng thi chính thức.
- **Studio ra đề (Admin)**: tạo đề bằng cách bốc câu hỏi ngẫu nhiên theo chuyên đề hoặc chọn câu hỏi thủ công; giao cho toàn bộ sinh viên hoặc các tài khoản được chọn.
- **Đề thi được giao**: giới hạn thời gian, xáo trộn câu hỏi/đáp án theo cấu hình, nộp một lần và chấm thang điểm 10.
- **Bảng xếp hạng chính thức**: xếp theo điểm trung bình các đề đã nộp, số đề hoàn thành, tỷ lệ đúng và thời gian làm bài.
- Dữ liệu đề thi và bài nộp được lưu cục bộ hoặc đồng bộ qua backend; cấu hình KV lưu cả đề thi và bài nộp.

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
d:/Nam2_ky1/Dijktra-demo/
├── index.html                   # Ứng dụng web hiện tại (4,632 dòng - NGUYÊN BẢN)
├── legacy/
│   └── index.html               # Bản sao Golden Master 100% nguyên bản (READ-ONLY)
├── package.json                 # Cấu hình test scripts & devDependencies
├── vitest.config.js             # Cấu hình Vitest
├── tests/
│   ├── helpers/
│   │   └── legacy-runner.js     # JSDOM harness chạy test trên Golden Master
│   ├── fixtures/                # Dữ liệu đồ thị mẫu cố định (JSON)
│   │   ├── dijkstra/
│   │   ├── kruskal/
│   │   ├── prim/
│   │   ├── euler/
│   │   ├── hamilton/
│   │   └── expected/            # Kết quả kỳ vọng chuẩn toán học (JSON)
│   └── regression/              # Bộ test kiểm thử hồi quy REG-01 -> REG-18
│       ├── dijkstra.test.js
│       ├── kruskal.test.js
│       ├── prim.test.js
│       ├── euler.test.js
│       ├── hamilton.test.js
│       ├── parsers.test.js
│       ├── visualization.test.js
│       ├── storage-tabs.test.js
│       └── controls.test.js
├── docs/                        # Tài liệu kỹ thuật Phase 1
│   ├── PROJECT_INVENTORY.md     # Kiểm kê toàn bộ file, DOM, CSS tokens
│   ├── GOLDEN_MASTER.md         # Quy chuẩn bảo vệ Golden Master
│   ├── LOCAL_STORAGE_SCHEMA.md  # Chi tiết 5 khóa localStorage và fallback
│   ├── KNOWN_ISSUES.md          # Đăng ký nợ kỹ thuật và rủi ro
│   ├── REGRESSION_TESTS.md      # Đặc tả chi tiết 18 ca kiểm thử hồi quy
│   ├── PHASE_1_TEST_MATRIX.md   # Ma trận độ phủ kiểm thử và nghiệm thu
│   └── PHASE_1_REPORT.md        # Báo cáo tổng kết Phase 1
└── README.md                    # Tài liệu hướng dẫn này
```

---

## 4. HƯỚNG DẪN VẬN HÀNH

### 4.1 Chạy ứng dụng web
Chạy backend phục vụ ứng dụng tại `http://localhost:3000`:
```bash
npm start
```

### 4.2 Chạy kiểm thử
```bash
npm install
npm test
npm run test:watch
```

---

## 5. QUY TRÌNH THIẾT LẬP GIT BASELINE
Để khóa baseline v1.0.0 trên Git repository cục bộ của bạn, thực hiện các lệnh sau:
```bash
git init
git add .
git commit -m "chore(baseline): establish phase-1 golden master and regression safety net"
git tag -a v1.0.0-golden-master -m "Baseline v1.0.0 Golden Master freeze"
```

---

## 6. LỊCH SỬ KIẾN TRÚC
`legacy/index.html` và bộ kiểm thử regression được giữ lại làm tài liệu/baseline của giai đoạn đầu dự án. Ứng dụng đang hoạt động hiện được khởi chạy qua server Node.js.
