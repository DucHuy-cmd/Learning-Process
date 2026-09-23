# BÁO CÁO PHÂN LOẠI VÀ CHẨN ĐOÁN THẤT BẠI KIỂM THỬ HỒI QUY PHASE 1
## (PHASE 1 — REGRESSION FAILURE TRIAGE REPORT)

**Dự án:** Graph Algorithms Tracer / Graph AI Lab  
**Thời điểm thực hiện:** 23/09/2026  
**Lệnh thực thi:** `npm.cmd test` (Chạy trực tiếp trên Host Machine)  
**Nguyên tắc tối cao:** **TRIAGE ONLY — TUYỆT ĐỐI KHÔNG SỬA CODE, KHÔNG SỬA TEST, KHÔNG SỬA FIXTURE, KHÔNG REFACTOR, KHÔNG BẮT ĐẦU PHASE 2.**

---

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Sau khi bộ kiểm thử hồi quy được khởi chạy thực tế trên máy chủ lưu trữ (Host Machine), hệ thống ghi nhận kết quả:
- **Test Files:** 6 failed | 3 passed (tổng số 9 files)
- **Tests:** 9 failed | 18 passed (tổng số 27 tests)

Quá trình triage và phân tích nguyên nhân gốc rễ (Root-Cause Analysis) cho toàn bộ 9 ca thất bại đã làm sáng tỏ 3 nhóm nguyên nhân chính:
1. **3 lỗi thực tế của ứng dụng cũ (Confirmed Legacy Bugs):** Lỗi crash khi từ chối đồ thị có hướng ở Prim (REG-06), lỗi hỏng tên header do truyền sai tham số hàm map ở Prim (REG-05), và lỗi regex parser bỏ sót trọng số không có dấu gạch/hai chấm (REG-14).
2. **4 lỗi do giả định của bộ kiểm thử (Confirmed Test Defects):** Khẳng định sai định dạng ô ma trận khởi tạo (REG-01), dùng sai selector DOM và thiếu ID SVG (REG-15 #1, #2), và giả định sai hợp đồng ngữ nghĩa trạng thái đồ thị không liên thông (REG-10).
3. **1 lỗi từ Test Harness Adapter (Confirmed Harness Defect):** Hàm trợ giúp `legacy-runner.js` gọi sai tên hàm điều khiển bước chạy (REG-17).
4. **1 trường hợp hành vi biên kiểm tra ma trận (Category E):** Parser ma trận kề chỉ kiểm tra số cột thiếu (`< n`) mà bỏ qua các cột thừa (REG-13).

---

## 2. KẾT QUẢ THỰC THI KIỂM THỬ (TEST EXECUTION RESULT)

| Hạng mục | Số lượng | Tỉ lệ |
| :--- | :--- | :--- |
| **Tổng số Test Files** | **9** | 100% |
| - Test Files Passed | 3 (`kruskal.test.js`, `hamilton.test.js`, `storage-tabs.test.js`) | 33.3% |
| - Test Files Failed | 6 (`dijkstra`, `prim`, `euler`, `parsers`, `visualization`, `controls`) | 66.7% |
| **Tổng số Ca Kiểm Thử (Tests)** | **27** | 100% |
| - Tests Passed | **18** | **66.7%** |
| - Tests Failed | **9** | **33.3%** |

---

## 3. BẢNG PHÂN LOẠI THẤT BẠI (FAILURE CLASSIFICATION TABLE)

| Mã ID | Tên Thất Bại Ghi Nhận | Phân Loại (Category) | Thành Phần Gây Lỗi | Bản Chất Lỗi |
| :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Nhận `'0*'` thay vì `'(0, u)*'` | **CATEGORY E / A** | Test Assertion | Legacy cố tình format ô bước 0 là `'0*'`. |
| **REG-05** | Headers Prim nhận `['-','-','-','-','-','-','-','-','Tv','Te']` | **CATEGORY D** | Legacy Application | Lỗi hàm `nodeS`: map truyền object vào hàm nhận index. |
| **REG-06** | `TypeError: Cannot read properties of undefined (reading 'short')` | **CATEGORY D** | Legacy Application | Cú pháp `nodes.map(nodeShort)` crash khi chặn có hướng. |
| **REG-10** | Nhận `'disconnected'` thay vì `'none'` | **CATEGORY E** | Test Contract | Legacy Euler phân biệt rõ `'disconnected'` và `'none'`. |
| **REG-13** | Parser không throw khi đưa vào ma trận 2 hàng (hàng 1 có 3 cột, hàng 2 có 2 cột) | **CATEGORY E / A** | Test Input / Spec | Legacy parser chỉ kiểm tra `< n`, tự cắt bỏ cột thừa. |
| **REG-14** | Nhận `['C','D',1]` thay vì `['C','D',10]` | **CATEGORY D** | Legacy Application | Regex cú pháp 2 bắt buộc phải có `[:=,]` mới nhận trọng số. |
| **REG-15 #1**| Query selector `#NL0`, `#NL1` trả về `null` | **CATEGORY A** | Test Assertion | SVG label trong legacy code chỉ có class `.node-label`, không có ID. |
| **REG-15 #2**| Query selector `#descBox`, `#formulaBox` trả về `null` | **CATEGORY A** | Test Assertion | ID thực tế trong HTML là `#stepNoteText` và `#stepFormula`. |
| **REG-17** | `TypeError: window.stepBackward is not a function` | **CATEGORY B** | Test Harness | Legacy dùng `goto(stepIdx - 1)`, không có hàm `stepBackward`. |

---

## 4. CHI TIẾT PHÂN TÍCH TỪNG CA THẤT BẠI (DEEP-DIVE TRIAGE)

### REG-01
- **Status:** FAILED
- **Category:** CATEGORY E (Legacy Semantic) / CATEGORY A (Test Expectation)
- **Test:** `tests/regression/dijkstra.test.js:35`
  ```javascript
  expect(initialRow.cells[startIndex].val).toBe('(0, u)*');
  ```
- **Implementation:** `legacy/index.html:1260-1266`
  ```javascript
  const row0 = {
    step: 0,
    cells: curGraph.nodes.map((nd, i) => {
      if (i === startIndex) return {val: "0*", type: "settled"};
      return {val: "(∞, -)", type: "init"};
    })
  };
  ```
- **Evidence:**  
  Trong `legacy/index.html`, tại bước khởi tạo ban đầu (Bước 0), đỉnh xuất phát `startIndex` chưa có đỉnh cha (`prev[startIndex] = -1`), do đó mã nguồn legacy chủ ý gán cứng chuỗi hiển thị là `"0*"`. Các bước sau khi nới lỏng hoặc chốt đỉnh mới sử dụng format `(${fmt(dist[i])}, ${pName})*`.
- **Special Check (Thuật toán cốt lõi):**  
  Thuật toán Dijkstra chạy hoàn toàn chính xác tuyệt đối:
  - Chi phí ngắn nhất: `total = 9.0` (đạt chuẩn toán học $1.0 + 3.0 + 5.0 = 9.0$).
  - Đường đi: `path = [0, 5, 6, 7]` ($u \to y \to z \to w$).
  - Reachability: `reachable = true`.
  Chỉ có duy nhất quy ước hiển thị ô bảng ma trận giáo trình ở bước 0 là khác với kỳ vọng của test.
- **Root Cause:** Test đặt kỳ vọng sai hợp đồng giao diện thực tế của mã legacy.
- **Confidence:** 100%
- **Recommended Action:** Cập nhật assertion của test thành `expect(initialRow.cells[startIndex].val).toBe('0*');` khi bước vào giai đoạn căn chỉnh test harness.
- **Modification Performed:** NONE

---

### REG-05
- **Status:** FAILED
- **Category:** CATEGORY D (Legacy Application Bug)
- **Test:** `tests/regression/prim.test.js:23`
  ```javascript
  expect(result.headers).toEqual(expectedPrim.headers);
  ```
- **Implementation:** `legacy/index.html:1594` & `legacy/index.html:1793`
  ```javascript
  // Dòng 1594:
  const nodeS = (i) => (i >= 0 && i < n) ? (curGraph.nodes[i].short || curGraph.nodes[i].name) : "-";
  
  // Dòng 1793:
  return {
    ...
    headers: [...curGraph.nodes.map(nodeS), "Tv", "Te"],
    fullMatrix: tableRows
  };
  ```
- **Evidence:**  
  Trong JavaScript, phương thức `Array.prototype.map(callback)` sẽ truyền 3 tham số vào hàm callback: `(currentValue, index, array)`.  
  Hàm `nodeS(i)` lại được viết với giả định tham số đầu vào `i` là một số nguyên (index). Khi gọi `curGraph.nodes.map(nodeS)`, tham số đầu tiên truyền vào `nodeS` là đối tượng Node `{id, name, short, ...}`.  
  Biểu thức `(nodeObject >= 0 && nodeObject < n)` bị ép kiểu thành `(NaN >= 0)` $\to$ trả về `false` cho tất cả các đỉnh $\to$ hàm `nodeS` luôn trả về `"-"`.  
  Kết quả là mảng headers bị biến thành: `['-','-','-','-','-','-','-','-','Tv','Te']`.
- **Special Check (Thời điểm phát sinh lỗi):**  
  Lỗi này KHÔNG làm dừng hay cản trở việc tính toán thuật toán. Thuật toán Prim vẫn tính ra:
  - Cây khung gồm đủ 7 cạnh (`mst.length = 7`).
  - Phủ đủ 8 đỉnh (`reached = 8`, `connected = true`).
  - Tổng trọng số MST chính xác: `total = 101.0`.
  Lỗi chỉ xuất hiện ở bước đóng gói thuộc tính `headers` của đối tượng trả về.
- **Root Cause:** Lỗi logic lập trình trong mã nguồn legacy (truyền trực tiếp hàm nhận index vào `.map()`).
- **Confidence:** 100%
- **Recommended Action:** Giữ nguyên Golden Master. Ghi nhận là Known Defect của Phase 1. Trong test suite hồi quy, cần đối chiếu với hành vi thực tế của legacy code (`['-','-','...']`) hoặc kiểm tra headers thông qua `renderPrimHeader()`.
- **Modification Performed:** NONE

---

### REG-06
- **Status:** FAILED
- **Category:** CATEGORY D (Legacy Application Bug)
- **Test:** `tests/regression/prim.test.js:38`
  ```javascript
  const result = ctx.runPrim(0);
  ```
- **Implementation:** `legacy/index.html:1546-1579` & `legacy/index.html:2874`
  ```javascript
  // Dòng 1546:
  if (curGraph && curGraph.directed) {
    ...
    return {
      frames, mst: [], total: 0, connected: false, reached: 0,
      headers: [...curGraph.nodes.map(nodeShort), "Tv", "Te"], // <-- DÒNG GÂY CRASH (Dòng 1577)
      fullMatrix: tableRows
    };
  }

  // Dòng 2874:
  function nodeShort(i){ return curGraph.nodes[i].short || curGraph.nodes[i].name; }
  ```
- **Evidence:**  
  Thuật toán Prim có đoạn kiểm tra từ chối đồ thị có hướng ở ngay đầu hàm (dòng 1546: `if (curGraph && curGraph.directed)`). Tuy nhiên, tại dòng 1577, khối code này cố gắng tạo headers bằng cách gọi: `curGraph.nodes.map(nodeShort)`.  
  Hàm toàn cục `nodeShort(i)` nhận vào `i` là chỉ số đỉnh và truy xuất `curGraph.nodes[i]`. Khi truyền vào `.map()`, tham số `i` là đối tượng Node `{id, name, ...}`.  
  Biểu thức `curGraph.nodes[{...}]` tương đương `curGraph.nodes["[object Object]"]` $\to$ `undefined`.  
  Khi truy xuất tiếp `.short`, JavaScript ném ngoại lệ:  
  `TypeError: Cannot read properties of undefined (reading 'short')`.
- **Special Check (Tính chất lỗi):**  
  Cơ chế kiểm tra và từ chối đồ thị có hướng CÓ TỒN TẠI (không bị thiếu logic), nhưng khối mã từ chối bị crash do lỗi TypeError trước khi kịp trả về kết quả.
- **Root Cause:** Lỗi cú pháp/gọi hàm trong nhánh từ chối đồ thị có hướng của `buildTracePrim`.
- **Confidence:** 100%
- **Recommended Action:** Ghi nhận là Bug-D (Legacy Defect) trong Phase 1. Test REG-06 hiện tại phản ánh chính xác việc mã legacy bị crash khi nhận đồ thị có hướng.
- **Modification Performed:** NONE

---

### REG-10
- **Status:** FAILED
- **Category:** CATEGORY E (Legacy Intentional Semantic)
- **Test:** `tests/regression/euler.test.js:56`
  ```javascript
  expect(result.type).toBe('none');
  ```
- **Implementation:** `legacy/index.html:2157-2160`
  ```javascript
  } else if (!isConnected) {
    type = "disconnected";
    typeTitle = "Đồ thị không liên thông";
    reason = `Đồ thị KHÔNG liên thông...`;
  }
  ```
- **Evidence:**  
  Mã nguồn legacy của thuật toán Euler phân loại kết quả thành 5 trạng thái có chủ đích rõ ràng:
  1. `type = "empty"`: Đồ thị không có cạnh.
  2. `type = "disconnected"`: Đồ thị có từ 2 thành phần liên thông có cạnh trở lên.
  3. `type = "circuit"`: Đồ thị có chu trình Euler (0 đỉnh lẻ).
  4. `type = "path"`: Đồ thị có đường đi Euler (đúng 2 đỉnh lẻ).
  5. `type = "none"`: Đồ thị liên thông nhưng có số đỉnh lẻ $> 2$.
- **Root Cause:** Test giả định sai hợp đồng ngữ nghĩa của hàm legacy (kỳ vọng mọi trường hợp không có Euler đều là `'none'`, trong khi legacy trả về `'disconnected'`).
- **Confidence:** 100%
- **Recommended Action:** Giữ nguyên mã legacy. Khi được phép căn chỉnh test, cập nhật assertion thành `expect(result.type).toBe('disconnected');`.
- **Modification Performed:** NONE

---

### REG-13
- **Status:** FAILED
- **Category:** CATEGORY E (Legacy Parser Semantic) / CATEGORY A (Test Input)
- **Test:** `tests/regression/parsers.test.js:52`
  ```javascript
  const invalidRows = `
    1 2 3
    4 5
  `;
  expect(() => ctx.parseMatrix(invalidRows, false)).toThrow();
  ```
- **Implementation:** `legacy/index.html:4187-4202`
  ```javascript
  const n = matrixRows.length; // n = 2 dòng
  ...
  for (let i = 0; i < n; i++) {
    if (matrixRows[i].length < n) {
      throw new Error(`Dòng ${i + 1} của ma trận chỉ có ${matrixRows[i].length} phần tử (cần đủ ${n} phần tử cho ma trận ${n}×${n})!`);
    }
  }
  ```
- **Evidence:**  
  Khi chuỗi đầu vào có 2 dòng dữ liệu, `parseAdjacencyMatrix` xác định kích thước ma trận $n = 2$.  
  Điều kiện kiểm tra lỗi ở dòng 4199 là `matrixRows[i].length < n` (chỉ ném lỗi nếu số phần tử NHỎ HƠN $n$):
  - Dòng 1 có 3 phần tử: $3 < 2$ là `false`.
  - Dòng 2 có 2 phần tử: $2 < 2$ là `false`.
  Do cả 2 dòng đều có $\ge 2$ phần tử, parser không ném lỗi mà chấp nhận đây là ma trận $2 \times 2$ hợp lệ và âm thầm bỏ qua cột thứ 3.
- **Root Cause:** Parser legacy được thiết kế theo hướng "khoan dung" với cột thừa (chỉ bắt lỗi thiếu cột so với số hàng). Test đưa vào ca kiểm thử có số cột thừa nên parser không throw.
- **Confidence:** 100%
- **Recommended Action:** Giữ nguyên mã parser legacy. Ca test kiểm tra ném lỗi kích thước cần đưa vào hàng bị thiếu phần tử (ví dụ: dòng 1 có 2 phần tử, dòng 2 chỉ có 1 phần tử cho ma trận 2 hàng).
- **Modification Performed:** NONE

---

### REG-14
- **Status:** FAILED
- **Category:** CATEGORY D (Legacy Application Bug)
- **Test:** `tests/regression/parsers.test.js:39`
  ```javascript
  const input = `
    A - B: 6
    B - C
    C D 10
  `;
  const result = ctx.parseEdgeList(input, false);
  expect(result.edges).toEqual([
    ['A', 'B', 6.0],
    ['B', 'C', 1.0],
    ['C', 'D', 10.0]
  ]);
  ```
- **Implementation:** `legacy/index.html:4260-4267`
  ```javascript
  // Cú pháp 2: A B: 1 hoặc A B 1 (không có dấu -)
  if (!match) {
    match = line.match(/^([A-Za-z0-9_À-ỹ]+)\s+([A-Za-z0-9_À-ỹ]+)(?:\s*[:=,]\s*([0-9.]+))?/i);
  }
  if (match) {
    const u = match[1].trim(), v = match[2].trim();
    const w = (match[3] !== undefined && match[3] !== "") ? parseFloat(match[3]) : 1.0;
  ```
- **Evidence:**  
  Tại dòng 4260, ghi chú của tác giả ghi rõ: `// Cú pháp 2: A B: 1 hoặc A B 1 (không có dấu -)`.  
  Tuy nhiên, trong biểu thức chính quy (Regex) ở dòng 4262:  
  Nhóm bắt trọng số được viết là `(?:\s*[:=,]\s*([0-9.]+))?`. Nhóm này bắt buộc phải có ký tự phân cách `:`, `=`, hoặc `,`.  
  Khi chuỗi đầu vào là `"C D 10"` (ngăn cách bằng khoảng trắng, không có dấu hai chấm), nhóm này không khớp $\to$ `match[3]` nhận giá trị `undefined`.  
  Tại dòng 4267, khi `match[3]` là `undefined`, trọng số tự động bị gán về giá trị mặc định `1.0`!  
  Do đó, `"C D 10"` bị phân tích thành `['C', 'D', 1.0]`.
- **Root Cause:** Bug trong biểu thức chính quy của legacy code: Regex không đúng với cú pháp được tài liệu hóa trong comment của chính nó.
- **Confidence:** 100%
- **Recommended Action:** Ghi nhận là Bug-D (Legacy Parser Defect). Giữ nguyên Golden Master.
- **Modification Performed:** NONE

---

### REG-15 (#1 và #2)
- **Status:** FAILED (2 lỗi)
- **Category:** CATEGORY A (Test Expectation / Selector Mismatch)
- **Test:** `tests/regression/visualization.test.js:22` & `tests/regression/visualization.test.js:46-47`
  ```javascript
  // Lỗi #1:
  const nodeLabel = ctx.document.getElementById(`NL${i}`);
  expect(nodeLabel).not.toBeNull();

  // Lỗi #2:
  const descBox = ctx.document.getElementById('descBox');
  const formulaBox = ctx.document.getElementById('formulaBox');
  ```
- **Implementation:** `legacy/index.html:2800-2806` & `legacy/index.html:739-742`
  ```javascript
  // Dòng 2800-2806 (SVG Node Label):
  const label = el("text", {
    class: "node-label",
    x: nd.x, y: nd.y - (curGraph.isBuilding ? 3 : 0),
    fill: color.text,
    "font-size": curGraph.isBuilding ? "11.5px" : "13px"
  });
  label.textContent = nd.short || nd.name;
  g.appendChild(label); // <-- KHÔNG CÓ THUỘC TÍNH id="NL{i}"

  // Dòng 739-742 (HTML DOM cho Note & Formula):
  <div class="step-note-bar">
    <span class="step-note-text" id="stepNoteText">Đang sẵn sàng chạy...</span>
    <span class="step-formula" id="stepFormula">dist[start] = 0.0</span>
  </div>
  ```
- **Evidence:**  
  1. Trong hàm `renderGraphBase()`, thẻ `<text>` chứa nhãn đỉnh được tạo với `class="node-label"` mà hoàn toàn KHÔNG gán thuộc tính `id`. Chỉ có hộp bao quanh đỉnh có `id="NB" + i` và nhãn phụ có `id="NS" + i`. Vì vậy `getElementById("NL0")` luôn trả về `null`.
  2. Trong mã HTML của giao diện ứng dụng, hai phần tử hiển thị lời giải thích bước và công thức toán học có ID lần lượt là `stepNoteText` và `stepFormula` (được cập nhật trong hàm `paintCommonTail` dòng 2963-2964). Không hề có phần tử nào mang ID `descBox` hay `formulaBox`.
- **Root Cause:** Bộ kiểm thử viết dựa trên giả định sai về tên ID của các phần tử DOM/SVG.
- **Confidence:** 100%
- **Recommended Action:** Cập nhật bộ test để query đúng ID thực tế: `#stepNoteText`, `#stepFormula` và dùng selector `.node-label` cho nhãn đỉnh.
- **Modification Performed:** NONE

---

### REG-17
- **Status:** FAILED
- **Category:** CATEGORY B (Test Harness / Helper Defect)
- **Test:** `tests/regression/controls.test.js:18`
  ```javascript
  ctx.stepBackward();
  ```
- **Implementation:** `tests/helpers/legacy-runner.js:72-74` & `legacy/index.html:3670-3676, 3729-3730`
  ```javascript
  // Trong tests/helpers/legacy-runner.js:
  stepForward: () => window.stepForward(),
  stepBackward: () => window.stepBackward(),
  jumpToStep: (idx) => window.jumpToStep(idx),

  // Trong legacy/index.html (Mã thực tế):
  function goto(i){
    if (!trace || !trace.frames) return;
    stepIdx = Math.max(0, Math.min(trace.frames.length - 1, i));
    paintFrame(trace.frames[stepIdx]);
    updateNav();
    if (stepIdx >= trace.frames.length - 1) stopPlay();
  }
  document.getElementById("btnNext").onclick = () => goto(stepIdx + 1);
  document.getElementById("btnPrev").onclick = () => goto(stepIdx - 1);
  ```
- **Evidence:**  
  Trong `legacy/index.html`, tác giả KHÔNG định nghĩa các hàm toàn cục tên là `stepForward` hay `stepBackward`.  
  Toàn bộ việc điều phối bước lùi / bước tới được thực hiện thông qua hàm `goto(stepIdx - 1)` và `goto(stepIdx + 1)`, hoặc bằng cách kích hoạt sự kiện click trên `#btnPrev` và `#btnNext`.  
  File test harness `legacy-runner.js` đã tự ý gọi `window.stepBackward()` $\to$ ném lỗi runtime `window.stepBackward is not a function`.
- **Root Cause:** Lỗi mapping API trong file trợ giúp test harness (`tests/helpers/legacy-runner.js`).
- **Confidence:** 100%
- **Recommended Action:** Cập nhật hàm `stepBackward` và `stepForward` trong `legacy-runner.js` để gọi đúng hàm `goto()` hoặc kích hoạt click nút bấm của legacy code.
- **Modification Performed:** NONE

---

## 5. PHÁT HIỆN LIÊN PHÂN HỆ (CROSS-CUTTING FINDINGS)

1. **Thói quen gọi `.map()` với hàm nhận Index trong JavaScript:**
   Cả hai lỗi REG-05 và REG-06 đều xuất phát từ cùng một mô-típ sai sót của tác giả code legacy: truyền trực tiếp tên một hàm helper nhận chỉ số đỉnh (như `nodeS(i)` hay `nodeShort(i)`) vào phương thức `nodes.map()`. Trong JS, `.map(fn)` luôn truyền đối tượng phần tử vào tham số thứ nhất, dẫn đến lỗi logic (trả về `"-"`) hoặc crash runtime (`TypeError: Cannot read properties of undefined`).
2. **Sự không nhất quán giữa Comment và Regex:**
   Lỗi REG-14 chỉ ra sự lệch pha giữa mong muốn thiết kế (hỗ trợ `A B 1`) và cài đặt regex thực tế (bắt buộc phải có `[:=,]`).
3. **Các thuật toán cốt lõi (Core Engines) hoạt động rất chuẩn xác:**
   - Dijkstra tìm đường ngắn nhất hoàn hảo ($9.0$).
   - Kruskal tìm MST và lọc chu trình hoàn hảo (Pass 100% test REG-03, REG-04).
   - Hamilton quay lui tìm chu trình/đường đi hoàn hảo (Pass 100% test REG-11, REG-12).
   - Thuật toán Prim tính trọng số MST hoàn hảo ($101.0$), lỗi chỉ nằm ở chuỗi header trả về và khối chặn có hướng.

---

## 6. ĐỀ XUẤT HƯỚNG XỬ LÝ (RECOMMENDED REMEDIATION)

Khi nhận được chỉ thị phê duyệt từ User, quy trình khắc phục an toàn sẽ được tiến hành như sau:
1. **Khắc phục Test Harness (`tests/helpers/legacy-runner.js`):**
   - Sửa `stepBackward` thành `() => window.goto(window.eval('stepIdx') - 1)`.
   - Sửa `stepForward` thành `() => window.goto(window.eval('stepIdx') + 1)`.
   - Sửa `jumpToStep` thành `(idx) => window.goto(idx)`.
   *(Sửa xong sẽ giải quyết triệt để lỗi REG-17 mà không cần đụng vào code legacy).*
2. **Khắc phục Bộ Test Assertions:**
   - REG-01: Chấp nhận format `'0*'` của legacy code cho ô bước 0.
   - REG-10: Cập nhật kỳ vọng thành `'disconnected'` cho đồ thị không liên thông theo đúng thiết kế legacy.
   - REG-13: Cập nhật dữ liệu test để có dòng thực sự bị thiếu phần tử ($< n$).
   - REG-15: Cập nhật selectors sang `#stepNoteText`, `#stepFormula` và class `.node-label`.
3. **Đối với các lỗi thuộc về Legacy Application (REG-05, REG-06, REG-14):**
   - Tuyệt đối KHÔNG sửa file `legacy/index.html`.
   - Lưu trữ các lỗi này vào `docs/KNOWN_ISSUES.md`.
   - Viết test assertions ghi nhận đúng hành vi hiện tại của legacy (hoặc expect crash cho REG-06) để làm mốc đối chiếu, và sẽ chính thức sửa chữa triệt để khi xây dựng engine mới ở Phase 2.

---

## 7. CÁC HẠNG MỤC CẦN Ý KIẾN QUYẾT ĐỊNH CỦA USER (ITEMS REQUIRING HUMAN DECISION)

1. **Xử lý REG-06 (Prim crash khi gặp đồ thị có hướng):**
   - *Lựa chọn 1:* Trong Phase 1, test REG-06 khẳng định việc gọi `buildTracePrim` trên đồ thị có hướng sẽ throw `TypeError` (phản ánh 100% nguyên trạng lỗi của Golden Master).
   - *Lựa chọn 2:* Chấp nhận đây là bug đã được xác nhận, đánh dấu skip hoặc ghi chú tạm thời chờ Phase 2 fix trong engine TypeScript mới.
2. **Xử lý REG-14 (Cú pháp `A B 10` thiếu dấu hai chấm):**
   - *Lựa chọn 1:* Cập nhật test case trong Phase 1 để dùng cú pháp có dấu hai chấm `A B: 10` (phù hợp với parser regex hiện tại).
   - *Lựa chọn 2:* Giữ nguyên ca test `A B 10` và khẳng định nó nhận trọng số `1.0` (phản ánh trung thực bug của Golden Master).

---

## 8. TỔNG KẾT TRẠNG THÁI TRIAGE (PHASE 1 TRIAGE STATUS)

```text
PHASE 1 TRIAGE STATUS
=============================================
- Confirmed test defects (Category A):              3 (REG-01, REG-15 #1, REG-15 #2)
- Confirmed harness defects (Category B):           1 (REG-17)
- Confirmed fixture defects (Category C):           0
- Confirmed legacy application defects (Category D): 3 (REG-05, REG-06, REG-14)
- Confirmed legacy semantic mismatch (Category E):  2 (REG-10, REG-13)
- Unresolved / Ambiguous:                           0
=============================================
TỔNG CỘNG THẤT BẠI ĐÃ ĐƯỢC CHẨN ĐOÁN:              9 / 9 (100%)
MÃ NGUỒN VÀ BẢN GỐC ĐÃ SỬA:                         0 (NONE)
```
