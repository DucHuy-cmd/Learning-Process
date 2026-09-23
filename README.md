# GRAPH ALGORITHMS TRACER / GRAPH AI LAB

Nền tảng trực quan hóa và mô phỏng từng bước các thuật toán đồ thị: **Dijkstra, Kruskal, Prim, Euler, Hamilton** kết hợp tương tác dữ liệu, bảng ma trận chuẩn giáo trình và kiểm thử tự động.

---

## 1. TRẠNG THÁI HIỆN TẠI: PHASE 1 COMPLETED

- **Phase 1: Project Foundation + Golden Master + Regression Test Safety Net** đã hoàn thành 100%.
- File gốc `index.html` được **bảo toàn nguyên vẹn**.
- Bản sao Golden Master được lưu trữ tại `legacy/index.html`.
- Toàn bộ hành vi hiện tại của hệ thống được bảo vệ bởi **18 ca kiểm thử hồi quy tự động (REG-01 đến REG-18)**.

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

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

## 3. HƯỚNG DẪN VẬN HÀNH

### 3.1 Chạy ứng dụng web
Mở trực tiếp file `index.html` trong bất kỳ trình duyệt web hiện đại nào (Chrome, Edge, Firefox, Safari) hoặc phục vụ qua extension Live Server:
```bash
# Không cần build hay bundler ở Phase 1
start index.html
```

### 3.2 Chạy bộ kiểm thử hồi quy tự động (Regression Tests)
Cài đặt các gói phụ thuộc kiểm thử và thực thi Vitest:
```bash
# 1. Cài đặt dependencies (vitest, jsdom)
npm install

# 2. Chạy toàn bộ 18 ca kiểm thử hồi quy (REG-01 đến REG-18)
npm test

# 3. Chạy ở chế độ theo dõi thay đổi (Watch mode)
npm run test:watch
```

---

## 4. QUY TRÌNH THIẾT LẬP GIT BASELINE
Để khóa baseline v1.0.0 trên Git repository cục bộ của bạn, thực hiện các lệnh sau:
```bash
git init
git add .
git commit -m "chore(baseline): establish phase-1 golden master and regression safety net"
git tag -a v1.0.0-golden-master -m "Baseline v1.0.0 Golden Master freeze"
```

---

## 5. BƯỚC TIẾP THEO
Sau khi bạn nghiệm thu và phê duyệt Phase 1, dự án sẽ sẵn sàng bước vào:
- **Phase 2: Core Architecture & Headless Engine Migration** (Thiết lập Vite + TypeScript, bóc tách module `src/core`, bảo đảm 100% test REG-01 -> REG-18 tiếp tục pass).
