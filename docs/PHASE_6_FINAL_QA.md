# BÁO CÁO TOÀN DIỆN PHASE 6: FINAL SECURITY, PERFORMANCE & QA
**Dự án:** Learning-Process / Graph Algorithms & Logic Lab  
**Thời điểm hoàn tất:** 2026-10-11  

---

## 1. TỔNG QUAN KIỂM KÊ VÀ TRẠNG THÁI PHASE 5 & 6

Toàn bộ các nhiệm vụ của Phase 5 và Phase 6 đã được triển khai, kiểm tra cấu trúc mã nguồn và đối chiếu bảo mật:
- **Phase 5 (Kiểm thử & Hồi quy):**
  - Hoàn tất khắc phục lỗi selector DOM (`#quizPreviewQuestion`, `#quizPreviewOptions`, `#quizPreviewExplanation`) trong `LogicSourceModal.js`.
  - Khắc phục sự sai lệch mã lỗi giữa `AI_ANALYSIS_FAILED` và mã hợp đồng chuẩn `AI_PROVIDER_ERROR` trong `tests/server/logicApi.test.js`.
  - Bảo tồn 100% tính bất biến của `STATIC_QUESTION_BANK` (150 câu hỏi gốc).
  - Bảo tồn 18 ca kiểm thử hồi quy Golden Master REG-01 đến REG-18 (Dijkstra, Kruskal, Prim, Euler, Hamilton, Parsers, Visualization, Storage, Controls).
- **Phase 6 (Bảo mật, Hiệu năng & QA):**
  - Vá lỗ hổng Authorization Bypass và Header Spoofing trong `isRequestFromAdmin`.
  - Áp dụng kiểm tra quyền Admin trên toàn bộ các endpoint quản trị: xóa tài khoản sinh viên, reset cơ sở dữ liệu, xóa toàn bộ đề thi, làm sạch bảng xếp hạng.
  - Tích hợp bộ lọc che giấu bí mật (`sanitizeErrorMessage`) ngăn chặn rò rỉ API key và token trong thông báo lỗi 500 trả về client.
  - Bổ sung giới hạn biên chống tấn công từ chối dịch vụ (DoS): giới hạn độ dài câu hỏi (2000 ký tự), độ dài biểu thức logic (5000 ký tự) và độ sâu lồng ngoặc (120 cấp).

---

## 2. PHÁT HIỆN BẢO MẬT & BIỆN PHÁP KHẮC PHỤC (SECURITY FINDINGS)

### SEC-01: Lỗ hổng Header Spoofing & Leo thang đặc quyền (Privilege Escalation)
- **Mức độ nghiêm trọng:** Cao (High)
- **Vị trí:** `src/server/app.js` (`isRequestFromAdmin`)
- **Mô tả:** Hàm xác thực trước đó lấy `candidateId = xUserId || tokenCandidate`. Nếu một sinh viên sở hữu token hợp lệ `Authorization: Bearer sv_k66_01` nhưng gửi kèm header `x-user-id: user_admin`, server ưu tiên `xUserId`, dẫn đến việc tài khoản sinh viên chiếm quyền quản trị viên mà không có token của Admin.
- **Khắc phục:** 
  1. Đặt Bearer token làm nguồn danh tính có thẩm quyền cao nhất (`candidateId = tokenCandidate || xUserId`).
  2. Bổ sung cơ chế phát hiện mâu thuẫn danh tính (Anti-spoofing guard): Nếu cả Bearer token và `x-user-id` đều được gửi nhưng danh tính không khớp nhau (ví dụ: token là sinh viên, header là admin), yêu cầu bị từ chối ngay lập tức với HTTP `403 FORBIDDEN`.

### SEC-02: Thiếu kiểm tra phân quyền trên các Endpoint Quản trị Hệ thống
- **Mức độ nghiêm trọng:** Nghiêm trọng (Critical)
- **Vị trí:** `src/server/app.js`
- **Mô tả:** Các route sau đây trước đó không hề kiểm tra quyền Admin phía server, cho phép bất kỳ client nào gọi trực tiếp:
  - `DELETE /api/admin/users/:id` (Xóa tài khoản người dùng)
  - `POST /api/admin/database/reset` (Xóa sạch toàn bộ database máy chủ)
  - `POST /api/quiz/leaderboard/reset` (Làm sạch bảng xếp hạng)
  - `DELETE /api/quiz/leaderboard/:userId` (Xóa điểm của một sinh viên)
  - `POST /api/exams/clear-all` / `DELETE /api/exams` (Xóa toàn bộ đề thi và bài làm)
  - `DELETE /api/exams/:id` (Xóa một đề thi cụ thể)
- **Khắc phục:** Bổ sung guard `if (!isRequestFromAdmin(req))` trên tất cả các route này, trả về HTTP `403 FORBIDDEN` nếu thiếu quyền quản trị. Cập nhật `CloudSyncManager.js` để tự động gửi thông tin xác thực Admin khi thao tác từ `AdminView`.

### SEC-03: Nguy cơ rò rỉ API Key và Secret trong Thông báo Lỗi
- **Mức độ nghiêm trọng:** Trung bình (Medium)
- **Vị trí:** `src/server/app.js` (POST `/api/ai/chat`, `/api/graph/analyze`, `/api/logic/analyze`)
- **Mô tả:** Khi AI provider bên ngoài (Gemini/OpenAI) gặp lỗi hoặc network fail, thông báo lỗi `err.message` nguyên bản có thể chứa chuỗi query parameter hoặc header chứa API key.
- **Khắc phục:** Xây dựng hàm `sanitizeErrorMessage(msg)` sử dụng regex tự động che giấu các khóa dạng `AIzaSy...`, `sk-...`, `token=...`, `key=...` thành `[REDACTED_API_KEY]` trước khi trả về client.

---

## 3. PHÁT HIỆN HIỆU NĂNG & ĐỘ TIN CẬY (PERFORMANCE & RELIABILITY)

### PERF-01: Ngăn chặn Call Stack Overflow trong Logic Parser
- **Mức độ:** Trung bình (Medium)
- **Vị trí:** `src/core/logic/LogicParser.js`
- **Mô tả:** Bộ phân tích đệ quy đi xuống (Recursive Descent Parser) có thể bị tràn ngăn xếp gọi hàm (`RangeError: Maximum call stack size exceeded`) nếu người dùng nhập chuỗi chứa hàng nghìn dấu mở ngoặc lồng nhau `((((...p...))))`.
- **Khắc phục:** Thêm biến theo dõi độ sâu đệ quy `this.depth`. Nếu độ sâu vượt quá 120 cấp ngoặc, parser chủ động ném lỗi cú pháp thân thiện thay vì làm sập ứng dụng.

### PERF-02: Giới hạn độ dài chuỗi biểu thức logic & câu hỏi trắc nghiệm
- **Mức độ:** Thấp (Low / DoS Protection)
- **Vị trí:** `src/core/logic/LogicTokenizer.js`, `src/server/app.js`
- **Mô tả:** Thiếu giới hạn độ dài tối đa cho chuỗi biểu thức logic và câu hỏi tải lên.
- **Khắc phục:**
  - `LogicTokenizer`: Giới hạn tối đa 5000 ký tự cho một biểu thức.
  - `validateCustomQuestion`: Giới hạn nội dung câu hỏi tối đa 2000 ký tự, mỗi phương án tối đa 1000 ký tự, lời giải thích tối đa 5000 ký tự.

---

## 4. BẢNG TỔNG HỢP KIỂM THỬ HỒI QUY (REG-01 ĐẾN REG-18)

| Mã test | Phạm vi | Mô tả toán học | Tiêu chuẩn nghiệm thu |
| :--- | :--- | :--- | :--- |
| REG-01 | Dijkstra | Đồ thị vô hướng $u \rightarrow w$ (chi phí 9.0) | Khớp 100% vết đỉnh $[0, 2, 4, 7]$ |
| REG-02 | Dijkstra | Đồ thị có hướng: $A \rightarrow D$ ($8.0$) & $D \rightarrow A$ (unreachable) | Reachable = true và false tương ứng |
| REG-03 | Kruskal | Cây khung nhỏ nhất (MST) vô hướng | Đúng tổng trọng số, loại bỏ cạnh tạo chu trình |
| REG-04 | Kruskal | Đồ thị có hướng | Từ chối có hướng kèm thông báo chuẩn |
| REG-05 | Prim | Cây khung đồ thị X1–X8, tiến trình $T_v, T_e$ | Khớp ma trận; kiểm soát `BUG-PRIM-001` |
| REG-06 | Prim | Đồ thị có hướng | Kiểm soát ngoại lệ di sản `BUG-PRIM-002` |
| REG-07 | Euler | Chu trình Euler (0 đỉnh bậc lẻ) | Chu trình khép kín duyệt đủ 6 cạnh |
| REG-08 | Euler | Đường đi Euler (2 đỉnh bậc lẻ) | Đường đi bắt đầu và kết thúc tại 2 đỉnh bậc lẻ |
| REG-09 | Euler | Đồ thị có hướng cân bằng bậc vào - ra | Chu trình có hướng hoàn chỉnh |
| REG-10 | Euler | Đồ thị không liên thông | Phát hiện và báo không có đường Euler |
| REG-11 | Hamilton | Chu trình & đường đi vô hướng 4 đỉnh | Duyệt đủ 4 đỉnh phân biệt |
| REG-12 | Hamilton | Chu trình có hướng tam giác | Tìm chu trình có hướng thành công |
| REG-13 | Parsers | Ma trận kề có/không header, ký hiệu vô cùng | Parse chính xác danh sách cạnh |
| REG-14 | Parsers | Danh sách cạnh có/không trọng số | Parse và lọc dữ liệu trùng |
| REG-15 | Visualization | SVG base rendering, node/edge DOM, zoom/pan | Ma trận transform chính xác |
| REG-16 | Storage | Vòng đời tab người dùng & localStorage | Lưu và phục hồi đầy đủ state |
| REG-17 | Controls | Playback stepping (Forward, Backward, Jump) | Chặn biên index chính xác |
| REG-18 | Controls | Chuyển đổi giao diện thuật toán | Tiêu đề file mã nguồn C++ đồng bộ |

---

## 5. THỰC THI KIỂM THỬ & GIỚI HẠN MÔI TRƯỜNG CỦA AGENT

- **Lệnh đã thử thực thi:**
  `npm.cmd test`
- **Kết quả trả về từ OS Sandbox:**
  `Encountered error in tool execution: Access is denied.`
- **Nguyên nhân kỹ thuật:**
  Môi trường sandbox bảo mật của agent trên Windows host chặn quyền spawn child process (`CreateProcessW`). Đây là giới hạn về quyền thực thi hệ điều hành của công cụ agent, không phải lỗi cú pháp hay mã nguồn của dự án.
- **Khuyến nghị cho người dùng:**
  Chạy trực tiếp lệnh sau trên terminal gốc của máy chủ để chạy toàn bộ suite kiểm thử tự động:
  ```powershell
  npm.cmd test
  ```

---

## 6. DANH MỤC KIỂM TRA THỦ CÔNG TRƯỚC KHI BÀN GIAO (MANUAL CHECKLIST)

1. **Khởi động ứng dụng:**
   ```powershell
   npm.cmd start
   ```
   Truy cập `http://localhost:3000`.
2. **Kiểm tra Logic Lab AI Vision:**
   - Điều hướng sang **Phòng Lab -> Logic Lab**.
   - Bấm nút **"Nhập từ ảnh"**.
   - Thử tải lên một ảnh bài toán logic (ví dụ `(p -> q) & (q -> r)`).
   - Kiểm tra giao diện xem trước biểu thức, kiểm tra phân tích cú pháp tự động và áp dụng vào bảng chân trị.
   - Thử chuyển sang tab **"Câu hỏi trắc nghiệm"**, xem trước thẻ câu hỏi với trạng thái `⏳ Chờ duyệt (Pending)`.
3. **Kiểm tra Phân quyền Admin:**
   - Mở cửa sổ ẩn danh (chưa đăng nhập), dùng curl thử gọi:
     ```bash
     curl -X POST http://localhost:3000/api/admin/database/reset
     ```
     $\rightarrow$ Đảm bảo nhận phản hồi HTTP `403 Forbidden`.
   - Đăng nhập với tài khoản `@admin` (`Admin@ToanRR2026!`), vào trang **Quản trị Database & Sinh viên**.
   - Xác nhận bảng câu hỏi AI Vision hiển thị đúng, thao tác thêm/xóa câu hỏi hoạt động bình thường.
4. **Kiểm tra Độ tin cậy Thuật toán Đồ thị:**
   - Mở phòng lab **Đồ thị (Graph Lab)**.
   - Chạy thử 5 thuật toán: Dijkstra, Kruskal, Prim, Euler, Hamilton.
   - Bấm các nút điều khiển Play/Pause, Step Forward, Step Backward để xác nhận hoạt động mượt mà.
