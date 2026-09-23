# GOLDEN MASTER SPECIFICATION

**Tài liệu:** Golden Master Baseline  
**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Ngày thiết lập:** 23/09/2026  
**Đường dẫn:** `legacy/index.html`  

---

## 1. MỤC ĐÍCH CỦA BẢN SAO GOLDEN MASTER

Bản sao Golden Master tại `legacy/index.html` là **bản chụp nguyên trạng 100% (Bit-by-bit identical copy)** của hệ thống trước bất kỳ can thiệp kỹ thuật nào của dự án chuyển đổi.

### Vai trò cốt lõi:
1. **Mỏ neo an toàn (Absolute Safety Net):** Là thước đo tham chiếu cao nhất để xác thực rằng các phase cải tiến (Phase 2, 3, ...) không làm thay đổi hành vi hoặc làm mất bất kỳ tính năng nào.
2. **Cơ sở cho Regression Runner:** Bộ kiểm thử hồi quy Vitest sử dụng trực tiếp file này thông qua JSDOM harness (`tests/helpers/legacy-runner.js`) để chạy các ca kiểm thử hồi quy mà không sửa đổi file gốc.
3. **Cơ chế Rollback tức thì:** Nếu quá trình refactor gặp sự cố không thể khắc phục, `legacy/index.html` luôn sẵn sàng để khôi phục trạng thái làm việc ổn định ngay lập tức.

---

## 2. THÔNG SỐ KỸ THUẬT VÀ TÍNH TOÀN VẸN (INTEGRITY METRICS)

- **Đường dẫn nguồn gốc:** `d:\Nam2_ky1\Dijktra-demo\index.html`
- **Đường dẫn Golden Master:** `d:\Nam2_ky1\Dijktra-demo\legacy\index.html`
- **Kích thước file:** 188,396 bytes
- **Tổng số dòng:** 4,632 dòng mã
- **Số hàm logic chính:** 48 hàm
- **Mức độ tương thích:** Hoàn toàn giống 100% dòng từng dòng (Identical).

---

## 3. QUY TẮC BẢO VỆ VĨNH VIỄN (IMMUTABILITY PROTOCOL)

1. **KHÔNG CHỈNH SỬA:** Tuyệt đối không được mở `legacy/index.html` để thêm, bớt hoặc format lại bất kỳ ký tự nào, kể cả khoảng trắng hay comment.
2. **CHỈ ĐỌC (READ-ONLY):** Các công cụ kiểm thử, bundler hoặc test runner chỉ được đọc nội dung file này ở chế độ Read-Only.
3. **KHÔNG XÓA:** Thư mục `legacy/` và file `legacy/index.html` phải luôn được lưu giữ trong kho lưu trữ Git của dự án qua tất cả các Phase.

---

## 4. CHIẾN LƯỢC GIT BASELINE COMMIT

Để đảm bảo tính toàn vẹn cấp hệ thống quản lý phiên bản, người phát triển cần thực hiện commit baseline đầu tiên theo trình tự lệnh sau trong terminal:

```bash
# 1. Khởi tạo Git repository nếu chưa có
git init

# 2. Thêm toàn bộ các file baseline vào staging
git add index.html legacy/index.html package.json vitest.config.js tests/ docs/ README.md

# 3. Tạo commit cơ sở cho Phase 1
git commit -m "chore(baseline): establish phase-1 golden master and regression safety net"

# 4. Gắn thẻ (Tag) cố định cho Golden Master
git tag -a v1.0.0-golden-master -m "Baseline v1.0.0 Golden Master freeze"
```
