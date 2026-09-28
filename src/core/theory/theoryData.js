/**
 * @file theoryData.js
 * Comprehensive Curriculum Theory & Algorithm Analysis Data
 * Covers all 4 Core Pillars / 5 Chapters of Discrete Mathematics:
 * - Chapter 1 & 2: Propositional & Predicate Logic (Logic Lab)
 * - Chapter 3: Combinatorics & Counting Methods (Counting Lab)
 * - Chapter 4: Binary Relations & Boolean Algebra (Relation Lab)
 * - Chapter 5: Graph Theory & Core Optimization Algorithms (Algorithm Lab)
 */

export const THEORY_CHAPTERS = [
  { id: 'all', label: '🌟 Tất cả chuyên đề', count: 19 },
  { id: 'ch1_2', label: '⚡ Chương 1 & 2: Cơ sở Logic', color: '#f59e0b', count: 4 },
  { id: 'ch3', label: '🎲 Chương 3: Đại số Tổ hợp', color: '#10b981', count: 5 },
  { id: 'ch4', label: '🔗 Chương 4: Quan hệ & Bool', color: '#8b5cf6', count: 5 },
  { id: 'ch5', label: '🌐 Chương 5: Lý thuyết Đồ thị', color: '#3b82f6', count: 5 },
];

export const THEORY_TOPICS = [
  // =========================================================================
  // CHƯƠNG 1 & 2: CƠ SỞ LOGIC MỆNH ĐỀ & VỊ TỪ
  // =========================================================================
  {
    id: 'logic_props',
    chapter: 'ch1_2',
    chapterName: 'Chương 1 & 2: Cơ sở Logic',
    color: '#f59e0b',
    badge: 'Mệnh đề & Phép toán',
    title: '1. Mệnh đề & Các phép toán Logic',
    summary: 'Khái niệm chân trị Đúng (1) / Sai (0). 6 phép toán logic nền tảng: Phủ định (NOT), Hội (AND), Tuyển (OR), Tuyển loại trừ (XOR), Kéo theo (IMPLIES) và Tương đương (EQUIV).',
    complexity: 'O(1) cho mỗi phép tính chân trị',
    algoKey: null,
    labAction: {
      type: 'logic',
      subtab: 'table',
      expr: '(p && q) || !r',
      label: '🔬 Thử biểu thức trong Logic Lab',
    },
    quizFilter: 'logic',
    details: {
      formulation: 'Cho các mệnh đề cơ sở p, q nhận giá trị chân lý thuộc {0, 1}. Mục tiêu là xây dựng và đánh giá chân trị của các biểu thức logic phức hợp.',
      coreIdea: 'Mỗi phép toán logic tương ứng với một hàm Boole f: {0, 1}ⁿ → {0, 1}. Phép kéo theo p → q chỉ sai khi tiền đề p đúng mà hệ quả q sai (1 → 0 = 0). Phép XOR (⊕) cho kết quả 1 khi đúng một trong hai toán hạng mang giá trị 1.',
      pseudocode: `// 6 phép toán logic cơ bản
NOT(p)      = !p
AND(p, q)   = p && q
OR(p, q)    = p || q
XOR(p, q)   = (p || q) && !(p && q)
IMPLIES(p, q) = !p || q
EQUIV(p, q)   = (p && q) || (!p && !q)`,
      stepTrace: `Bảng chân trị chuẩn của 6 phép toán:
p | q | ¬p | p ∧ q | p ∨ q | p ⊕ q | p → q | p ↔ q
--+---+----+-------+-------+-------+-------+------
0 | 0 |  1 |   0   |   0   |   0   |   1   |   1
0 | 1 |  1 |   0   |   1   |   1   |   1   |   0
1 | 0 |  0 |   0   |   1   |   1   |   0   |   0
1 | 1 |  0 |   1   |   1   |   0   |   1   |   1`,
      complexityNotes: 'Thời gian đánh giá một biểu thức với n toán hạng là O(n). Duyệt toàn bộ không gian biến với k biến độc lập mất 2^k trạng thái.',
      examTips: '⚠️ Bẫy thường gặp: Trong phép kéo theo p → q, nếu tiền đề p = 0 thì toàn bộ mệnh đề luôn ĐÚNG (Vacuous Truth) bất kể q nhận giá trị gì!',
    },
  },
  {
    id: 'logic_truthtable',
    chapter: 'ch1_2',
    chapterName: 'Chương 1 & 2: Cơ sở Logic',
    color: '#f59e0b',
    badge: 'Bảng chân trị',
    title: '2. Bảng chân trị & Tương đương Logic',
    summary: 'Duyệt toàn bộ 2ⁿ trường hợp của n biến để chứng minh tương đương logic A ≡ B. Phân loại biểu thức thành Hằng đúng (Tautology), Hằng sai (Contradiction) hoặc Tiếp định (Contingency).',
    complexity: 'O(2ⁿ · k) với n biến, k toán tử',
    algoKey: null,
    labAction: {
      type: 'logic',
      subtab: 'table',
      expr: '!(p && q) <=> (!p || !q)',
      label: '🔬 Kiểm tra De Morgan trong Logic Lab',
    },
    quizFilter: 'logic',
    details: {
      formulation: 'Cho biểu thức logic E(p₁, p₂, ..., pₙ). Xác định cột kết quả của E trên 2ⁿ tổ hợp giá trị biến và kiểm tra xem E có luôn nhận giá trị 1 (Hằng đúng) hay không.',
      coreIdea: 'Hai mệnh đề A và B được gọi là tương đương logic (ký hiệu A ≡ B hoặc A ⇔ B) nếu và chỉ nếu A ↔ B là một Hằng đúng (Tautology), nghĩa là cột chân trị của A và B hoàn toàn đồng nhất trong mọi dòng.',
      pseudocode: `Thuật toán sinh bảng chân trị:
1. Xác định tập n biến độc lập: V = {p_1, ..., p_n}
2. Sắp xếp 2^n dòng nhị phân từ 00...0 đến 11...1 (hoặc theo mã Gray)
3. Với mỗi dòng chân trị:
     Đánh giá từng biểu thức con theo thứ tự ưu tiên: NOT -> AND -> OR -> IMPLIES -> EQUIV
4. Kết luận:
     Nếu tất cả kết quả = 1: HẰNG ĐÚNG (Tautology)
     Nếu tất cả kết quả = 0: HẰNG SAI (Contradiction)
     Ngược lại: TIẾP ĐỊNH (Contingency)`,
      stepTrace: `Chứng minh Luật De Morgan: ¬(p ∧ q) ≡ ¬p ∨ ¬q
p | q | p ∧ q | ¬(p ∧ q) | ¬p | ¬q | ¬p ∨ ¬q | (4) ↔ (7)
--+---+-------+----------+----+----+---------+----------
0 | 0 |   0   |    1     |  1 |  1 |    1    |    1
0 | 1 |   0   |    1     |  1 |  0 |    1    |    1
1 | 0 |   0   |    1     |  0 |  1 |    1    |    1
1 | 1 |   1   |    0     |  0 |  0 |    0    |    1
==> Cột (4) và (7) giống hệt nhau ==> Đẳng thức được chứng minh!`,
      complexityNotes: 'Không gian trạng thái tăng lũy thừa 2ⁿ, do đó bảng chân trị hiệu quả nhất với n ≤ 5 biến. Với n lớn hơn, cần dùng thuật toán SAT hoặc DPLL.',
      examTips: 'Đề thi trắc nghiệm thường hỏi về các luật: Luật De Morgan, Luật phân phối p ∧ (q ∨ r) ≡ (p ∧ q) ∨ (p ∧ r), và Luật kéo theo p → q ≡ ¬p ∨ q.',
    },
  },
  {
    id: 'logic_kmap',
    chapter: 'ch1_2',
    chapterName: 'Chương 1 & 2: Cơ sở Logic',
    color: '#f59e0b',
    badge: 'Tối thiểu hóa',
    title: '3. Tối thiểu hóa bằng Bìa Karnaugh (K-Map)',
    summary: 'Phương pháp trực quan rút gọn hàm Boole thành dạng Tổng các tích cực tiểu (Minimal SOP) cho 2, 3, 4 biến dựa trên mã Gray và quy tắc khoanh nhóm ô 1 kề nhau theo lũy thừa của 2.',
    complexity: 'O(2ⁿ) kích thước ma trận',
    algoKey: null,
    labAction: {
      type: 'logic',
      subtab: 'kmap',
      expr: '(A && B) || (!A && B)',
      label: '🔬 Mở Bìa Karnaugh trong Logic Lab',
    },
    quizFilter: 'logic',
    details: {
      formulation: 'Cho hàm Boole biểu diễn bởi các minterm f(A, B, C, D) = ∑m(...). Tìm biểu thức tuyển chuẩn tắc rút gọn nhất có ít tích nhất và ít biến nhất.',
      coreIdea: 'Sử dụng mã Gray (chỉ khác nhau 1 bit giữa 2 ô kề nhau) trên các cạnh của bìa. Hai ô 1 kề nhau có thể kết hợp nhờ định lý xy + xȳ = x(y + ȳ) = x để triệt tiêu biến đối ngẫu.',
      pseudocode: `Thuật toán Karnaugh:
1. Lập lưới 2x2 (2 biến), 2x4 (3 biến), hoặc 4x4 (4 biến) theo thứ tự mã Gray: 00, 01, 11, 10
2. Điền 1 vào các ô ứng với minterm của hàm Boole
3. Khoanh các nhóm ô 1 hình chữ nhật có kích thước là lũy thừa của 2 (1, 2, 4, 8, 16):
     - Mỗi ô 1 phải thuộc ít nhất một nhóm
     - Nhóm càng lớn càng triệt tiêu được nhiều biến
     - Cho phép khoanh quấn vòng qua các mép biên và 4 góc
4. Trích xuất tích tối thiểu từ mỗi nhóm và nối lại bằng dấu OR (+)`,
      stepTrace: `Ví dụ 2 biến: f(A, B) = A·B + Ā·B
Bìa K-Map:
    B=0  B=1
A=0 [ 0 ][ 1 ]
A=1 [ 0 ][ 1 ]
Nhóm 2 ô 1 kề nhau ở cột B=1: A thay đổi (0 -> 1) bị triệt tiêu, B giữ nguyên = 1.
==> Biểu thức rút gọn tối thiểu: f(A, B) = B.`,
      complexityNotes: 'K-Map trực quan tuyệt vời cho 2-4 biến. Với n ≥ 5 biến, phương pháp Quine-McCluskey được ưu tiên trong máy tính số.',
      examTips: '⚠️ Bẫy kinh điển: Thứ tự nhãn cột và dòng trong K-Map bắt buộc phải là 00, 01, 11, 10 (mã Gray), KHÔNG được viết 00, 01, 10, 11!',
    },
  },
  {
    id: 'logic_circuit',
    chapter: 'ch1_2',
    chapterName: 'Chương 1 & 2: Cơ sở Logic',
    color: '#f59e0b',
    badge: 'Mạch số',
    title: '4. Thiết kế Mạch Logic Số',
    summary: 'Mô hình hóa các cổng logic chuẩn ANSI/IEEE (AND, OR, NOT, XOR, NAND, NOR). Chuyển đổi biểu thức Boole thành sơ đồ mạch điện tử và mô phỏng lan truyền tín hiệu tức thì.',
    complexity: 'O(Số cổng logic)',
    algoKey: null,
    labAction: {
      type: 'logic',
      subtab: 'circuit',
      expr: '(A && B) || !C',
      label: '🔬 Thiết kế Mạch số trong Logic Lab',
    },
    quizFilter: 'logic',
    details: {
      formulation: 'Biến đổi biểu thức logic dạng SOP hoặc POS thành sơ đồ mạng các cổng logic tương ứng, tính toán giá trị điện áp đầu ra (High/Low) từ các đầu vào số.',
      coreIdea: 'Mọi cổng logic có thể được cấu thành từ các hệ cổng đầy đủ chức năng như {NAND} hoặc {NOR} (cổng vạn năng - Universal Gates). Tín hiệu được lan truyền từ tầng đầu vào qua các tầng trung gian đến đầu ra.',
      pseudocode: `Mô phỏng mạch logic số:
1. Đọc biểu thức và phân tích thành cây cú pháp (AST)
2. Gán giá trị logic cho các nút lá (Inputs)
3. Lan truyền tín hiệu theo thứ tự Post-order:
     Output_Gate = Gate_Function(Input_Signals)
4. Cập nhật trạng thái màu dây dẫn (Xanh lá = 1, Đỏ/Xám = 0)`,
      stepTrace: `Ví dụ mạch Half-Adder (Bộ nửa cộng 2 bit A, B):
- Sum   = A ⊕ B (Cổng XOR)
- Carry = A ∧ B (Cổng AND)
A=1, B=1 ==> Sum = 0, Carry = 1 (Tương ứng 1 + 1 = 10 trong hệ nhị phân).`,
      complexityNotes: 'Độ trễ truyền lan (Propagation Delay) tỷ lệ thuận với số tầng cổng logic từ đầu vào đến đầu ra.',
      examTips: 'Cổng NAND và NOR là hai cổng vạn năng (Universal Gates): Bất kỳ biểu thức Boole nào cũng có thể hiện thực chỉ bằng một loại cổng NAND duy nhất.',
    },
  },

  // =========================================================================
  // CHƯƠNG 3: ĐẠI SỐ TỔ HỢP & PHÉP ĐẾM
  // =========================================================================
  {
    id: 'count_basic',
    chapter: 'ch3',
    chapterName: 'Chương 3: Đại số Tổ hợp',
    color: '#10b981',
    badge: 'Nguyên lý đếm',
    title: '5. Quy tắc cộng, nhân & Bù trừ (PIE)',
    summary: 'Nền tảng phép đếm rời rạc: Quy tắc cộng cho các biến cố xung khắc, quy tắc nhân cho các giai đoạn độc lập liên tiếp, và nguyên lý bù trừ |A ∪ B| = |A| + |B| - |A ∩ B|.',
    complexity: 'O(2ⁿ) hạng tử nguyên lý bù trừ',
    algoKey: null,
    labAction: {
      type: 'counting',
      tab: 'pascal',
      label: '🎲 Mở Studio Tổ hợp trong Counting Lab',
    },
    quizFilter: 'counting',
    details: {
      formulation: 'Cho các tập hợp hữu hạn A, B, C. Tính lực lượng hợp |A ∪ B ∪ C| khi các tập hợp có phần tử chung chồng chéo lên nhau.',
      coreIdea: 'Cộng số phần tử của từng tập riêng lẻ, trừ đi các phần giao đôi một (bị đếm thừa 2 lần), cộng lại phần giao ba (bị trừ thừa), và tiếp tục đan dấu (+, -, +, -...).',
      pseudocode: `Nguyên lý bù trừ (Principle of Inclusion-Exclusion):
|A ∪ B| = |A| + |B| - |A ∩ B|
|A ∪ B ∪ C| = |A| + |B| + |C| 
             - (|A ∩ B| + |A ∩ C| + |B ∩ C|) 
             + |A ∩ B ∩ C|`,
      stepTrace: `Đếm số nguyên từ 1 đến 100 chia hết cho 2 hoặc 3:
- |A| (chia hết cho 2) = ⌊100/2⌋ = 50
- |B| (chia hết cho 3) = ⌊100/3⌋ = 33
- |A ∩ B| (chia hết cho bội chung 6) = ⌊100/6⌋ = 16
==> |A ∪ B| = 50 + 33 - 16 = 67 số.`,
      complexityNotes: 'Nguyên lý bù trừ cho n tập hợp gồm 2ⁿ - 1 số hạng, phản ánh bản chất phân hoạch không gian nhị phân.',
      examTips: '⚠️ Đừng quên tìm Bội chung nhỏ nhất (BCNN) khi xét phần giao của các điều kiện chia hết (ví dụ: chia hết cho 4 và 6 thì giao là chia hết cho 12, không phải 24)!',
    },
  },
  {
    id: 'count_comb',
    chapter: 'ch3',
    chapterName: 'Chương 3: Đại số Tổ hợp',
    color: '#10b981',
    badge: 'Tổ hợp & Pascal',
    title: '6. Hoán vị, Chỉnh hợp & Tổ hợp',
    summary: 'Công thức Pₙ = n!, Chỉnh hợp Aₙᵏ = n!/(n-k)!, Tổ hợp Cₙᵏ = n!/(k!(n-k)!). Khám phá Tam giác Pascal, tính chất đối xứng Cₙᵏ = Cₙⁿ⁻ᵏ và đẳng thức tổng dòng ∑Cₙᵏ = 2ⁿ.',
    complexity: 'O(n) tính toán / O(n²) Tam giác Pascal',
    algoKey: null,
    labAction: {
      type: 'counting',
      tab: 'pascal',
      label: '🎲 Khám phá Tam giác Pascal tương tác',
    },
    quizFilter: 'counting',
    details: {
      formulation: 'Tính số cách chọn k phần tử từ tập n phần tử có phân biệt thứ tự (Chỉnh hợp) hoặc không phân biệt thứ tự (Tổ hợp).',
      coreIdea: 'Tam giác Pascal được xây dựng đệ quy dựa trên đẳng thức Pascal: C(n, k) = C(n-1, k-1) + C(n-1, k). Mỗi ô bằng tổng hai ô ngay phía trên nó.',
      pseudocode: `Đẳng thức Pascal và Khai triển Nhị thức Newton:
C(n, k) = C(n-1, k-1) + C(n-1, k) với C(n, 0) = C(n, n) = 1
(a + b)ⁿ = ∑ [k=0..n] C(n, k) · aⁿ⁻ᵏ · bᵏ`,
      stepTrace: `Xây dựng 5 dòng đầu Tam giác Pascal:
n=0:       1
n=1:      1   1
n=2:     1   2   1
n=3:    1   3   3   1
n=4:   1   4   6   4   1
Tổng dòng n=4: 1 + 4 + 6 + 4 + 1 = 16 = 2⁴.`,
      complexityNotes: 'Tính C(n, k) bằng công thức Pascal tránh được tràn số nguyên (Overflow) so với việc tính trực tiếp n! khi n lớn.',
      examTips: 'Phân biệt nhanh: Có xếp thứ tự (ví dụ: xếp hàng, phân công chức vụ Trưởng/Phó) dùng Chỉnh hợp Aₙᵏ; Không quan tâm thứ tự (ví dụ: chọn ban đại diện, bốc thăm) dùng Tổ hợp Cₙᵏ.',
    },
  },
  {
    id: 'count_dirichlet',
    chapter: 'ch3',
    chapterName: 'Chương 3: Đại số Tổ hợp',
    color: '#10b981',
    badge: 'Chuồng bồ câu',
    title: '7. Nguyên lý Dirichlet (Pigeonhole Principle)',
    summary: 'Nếu nhốt N đồ vật vào k cái hộp mà N > k thì tồn tại ít nhất một hộp chứa từ 2 đồ vật trở lên. Dạng tổng quát: Tồn tại ít nhất một hộp chứa không ít hơn ⌈N/k⌉ đồ vật.',
    complexity: 'O(1) tính cận / O(N) mô phỏng phân phối',
    algoKey: null,
    labAction: {
      type: 'counting',
      tab: 'dirichlet',
      label: '🎲 Mở Đấu trường Dirichlet trong Counting Lab',
    },
    quizFilter: 'counting',
    details: {
      formulation: 'Cho hàm f: X → Y với |X| = N và |Y| = k. Nếu N > k, chứng minh f không thể là đơn ánh.',
      coreIdea: 'Chứng minh bằng phản chứng: Giả sử mọi hộp đều chứa tối đa ⌈N/k⌉ - 1 đồ vật, khi đó tổng số vật tối đa là k · (⌈N/k⌉ - 1) < N, mâu thuẫn với giả thiết có N vật.',
      pseudocode: `Định lý Dirichlet dạng mở rộng:
Đầu vào: N vật, k hộp
Cận dưới cho hộp chứa nhiều nhất:
max_in_box = ⌈N / k⌉ = Math.ceil(N / k)
Cận trên cho hộp chứa ít nhất:
min_in_box = ⌊N / k⌋ = Math.floor(N / k)`,
      stepTrace: `Bài toán ngày sinh trong tháng:
Trong một lớp học có 25 sinh viên (N = 25) và 12 tháng sinh (k = 12).
Theo nguyên lý Dirichlet:
⌈25 / 12⌉ = ⌈2.083⌉ = 3.
==> Chắc chắn có ít nhất 3 sinh viên có cùng tháng sinh!`,
      complexityNotes: 'Nguyên lý Dirichlet là một công cụ quy nạp phi kiến thiết (Non-constructive proof): Chứng minh sự tồn tại mà không cần chỉ ra cụ thể vị trí.',
      examTips: 'Bí quyết giải bài toán Dirichlet: Luôn xác định đúng hai đại lượng: Đối tượng nào đóng vai trò là "Thỏ" (N) và tiêu chí phân loại nào đóng vai trò là "Chuồng" (k).',
    },
  },
  {
    id: 'count_recurrence',
    chapter: 'ch3',
    chapterName: 'Chương 3: Đại số Tổ hợp',
    color: '#10b981',
    badge: 'Hệ thức truy hồi',
    title: '8. Hệ thức truy hồi & Bài toán Tháp Hà Nội',
    summary: 'Giải phương trình sai phân tuyến tính thuần nhất bậc 1 và bậc 2: aₙ = c₁·aₙ₋₁ + c₂·aₙ₋₂ qua phương trình đặc trưng. Thuật toán đệ quy Tháp Hà Nội với công thức tối ưu Tₙ = 2ⁿ - 1.',
    complexity: 'O(1) nghiệm đóng / O(2ⁿ) đệ quy Tháp Hà Nội',
    algoKey: null,
    labAction: {
      type: 'counting',
      tab: 'recurrence',
      label: '🎲 Giải hệ thức & Tháp Hà Nội trong Lab',
    },
    quizFilter: 'counting',
    details: {
      formulation: 'Tìm công thức số hạng tổng quát aₙ thỏa mãn aₙ = c₁·aₙ₋₁ + c₂·aₙ₋₂ cùng hai điều kiện ban đầu a₀, a₁.',
      coreIdea: 'Thử nghiệm nghiệm dạng aₙ = rⁿ dẫn đến phương trình đặc trưng bậc 2: r² - c₁·r - c₂ = 0. Tùy thuộc vào biệt thức Δ, nghiệm tổng quát nhận 1 trong 3 dạng (phân biệt, kép, phức).',
      pseudocode: `Phương pháp giải phương trình đặc trưng bậc 2:
1. Viết PT đặc trưng: r² - c₁·r - c₂ = 0
2. Tính Δ = c₁² + 4c₂:
   - TH1: Δ > 0 ==> Hai nghiệm thực phân biệt r₁, r₂:
         aₙ = α₁·r₁ⁿ + α₂·r₂ⁿ
   - TH2: Δ = 0 ==> Nghiệm kép r₀:
         aₙ = (α₁ + α₂·n)·r₀ⁿ
3. Thay n = 0, n = 1 vào điều kiện ban đầu để giải hệ phương trình tìm α₁, α₂.`,
      stepTrace: `Dãy Fibonacci: Fₙ = Fₙ₋₁ + Fₙ₋₂, F₀ = 0, F₁ = 1
- PT đặc trưng: r² - r - 1 = 0 ==> r₁,₂ = (1 ± √5) / 2 (Tỷ lệ vàng φ)
- Nghiệm tổng quát (Công thức Binet):
  Fₙ = (1 / √5) · [ ((1+√5)/2)ⁿ - ((1-√5)/2)ⁿ ]
F₀ = 0, F₁ = 1, F₂ = 1, F₃ = 2, F₄ = 3, F₅ = 5...`,
      complexityNotes: 'Tính aₙ bằng đệ quy ngây thơ mất O(2ⁿ), dùng quy hoạch động mất O(n), dùng nhân ma trận mất O(log n), và dùng nghiệm đóng mất O(1).',
      examTips: 'Với bài toán Tháp Hà Nội n đĩa: Số bước di chuyển tối thiểu luôn là Tₙ = 2ⁿ - 1 (với 3 đĩa là 7 bước, 4 đĩa là 15 bước).',
    },
  },
  {
    id: 'count_mapping',
    chapter: 'ch3',
    chapterName: 'Chương 3: Đại số Tổ hợp',
    color: '#10b981',
    badge: 'Ánh xạ & Hàm số',
    title: '9. Ánh xạ, Đơn ánh, Toàn ánh & Song ánh',
    summary: 'Định nghĩa ánh xạ f: X → Y. Các điều kiện chặt chẽ: Đơn ánh (Injective), Toàn ánh (Surjective), Song ánh (Bijective) và hàm ngược f⁻¹. Các công thức đếm số lượng hàm |Y|^|X|, đơn ánh, song ánh n!.',
    complexity: 'O(|X| · |Y|) kiểm tra đồ thị ánh xạ',
    algoKey: null,
    labAction: {
      type: 'counting',
      tab: 'mapping',
      label: '🎲 Mở Studio Ánh xạ tương tác',
    },
    quizFilter: 'counting',
    details: {
      formulation: 'Cho tập nguồn X có m phần tử và tập đích Y có n phần tử. Phân loại quan hệ hàm f và tính tổng số các loại ánh xạ có thể thiết lập.',
      coreIdea: 'Một quan hệ là hàm nếu mỗi x ∈ X có đúng một mũi tên đi ra. Đơn ánh đòi hỏi không có 2 mũi tên nào đến cùng một y. Toàn ánh đòi hỏi mọi y đều có ít nhất một mũi tên đến. Song ánh đòi hỏi mỗi y có đúng một mũi tên đến.',
      pseudocode: `Số lượng các loại ánh xạ từ X (|X|=m) đến Y (|Y|=n):
1. Tổng số hàm số:               N_all = nᵐ
2. Số đơn ánh (chỉ khi m ≤ n):   N_inj = Aₙᵐ = n! / (n - m)!
3. Số song ánh (chỉ khi m = n):  N_bij = n!
4. Số toàn ánh (chỉ khi m ≥ n):  N_surj = ∑ [k=0..n] (-1)ᵏ · Cₙᵏ · (n - k)ᵐ`,
      stepTrace: `Ví dụ |X| = 3, |Y| = 3:
- Tổng số hàm: 3³ = 27 hàm
- Số đơn ánh = Số song ánh: 3! = 6 song ánh
- Tồn tại hàm ngược f⁻¹ khi và chỉ khi f là song ánh.`,
      complexityNotes: 'Kiểm tra toàn ánh mất O(m + n), kiểm tra đơn ánh mất O(m) bằng bảng băm (hash set).',
      examTips: '⚠️ Điều kiện ắt có: Muốn có đơn ánh thì |X| ≤ |Y|. Muốn có toàn ánh thì |X| ≥ |Y|. Muốn có song ánh thì bắt buộc |X| = |Y|!',
    },
  },

  // =========================================================================
  // CHƯƠNG 4: QUAN HỆ & ĐẠI SỐ BOOL
  // =========================================================================
  {
    id: 'rel_matrix',
    chapter: 'ch4',
    chapterName: 'Chương 4: Quan hệ & Đại số Bool',
    color: '#8b5cf6',
    badge: 'Ma trận nhị phân',
    title: '10. Quan hệ hai ngôi & Ma trận Boolean MR',
    summary: 'Biểu diễn quan hệ R ⊆ A × B dưới dạng tập cặp có thứ tự, đồ thị có hướng và ma trận nhị phân Boolean MR. Phép hợp, giao, phần bù và tích hợp quan hệ S ∘ R bằng phép nhân Boole.',
    complexity: 'O(|A| · |B|) biểu diễn ma trận',
    algoKey: null,
    labAction: {
      type: 'relation',
      tab: 'matrix',
      label: '🔗 Mở Studio Ma trận Quan hệ',
    },
    quizFilter: 'relation',
    details: {
      formulation: 'Cho hai tập hữu hạn A = {a₁, ..., aₘ} và B = {b₁, ..., bₙ}. Biểu diễn quan hệ R dưới dạng ma trận kích thước m × n với M_R[i, j] ∈ {0, 1}.',
      coreIdea: 'M_R[i, j] = 1 nếu (aᵢ, bⱼ) ∈ R, và bằng 0 nếu ngược lại. Phép tích hợp hai quan hệ R (trên A×B) và S (trên B×C) được tính bằng tích Boole ma trận: M_(S ∘ R) = M_R ⊙ M_S.',
      pseudocode: `Tích Boole của hai ma trận M_R (m×k) và M_S (k×n):
Với mỗi hàng i từ 1 đến m:
  Với mỗi cột j từ 1 đến n:
    M_tich[i, j] = (M_R[i, 1] ∧ M_S[1, j]) ∨ 
                   (M_R[i, 2] ∧ M_S[2, j]) ∨ ... ∨ 
                   (M_R[i, k] ∧ M_S[k, j])`,
      stepTrace: `Ví dụ ma trận 3×3:
M_R = [ [1, 0, 1],
        [0, 1, 0],
        [1, 1, 0] ]
Đường chéo chính toàn 1 là điều kiện cần của tính phản xạ.`,
      complexityNotes: 'Phép nhân ma trận Boole cơ bản mất O(n³), có thể tăng tốc bằng bitwise operations (bitsets) lên O(n³ / 64).',
      examTips: '⚠️ Chú ý thứ tự ký hiệu: Tích hợp S ∘ R nghĩa là thực hiện R trước rồi mới đến S: (a, c) ∈ S ∘ R khi tồn tại b sao cho (a, b) ∈ R và (b, c) ∈ S.',
    },
  },
  {
    id: 'rel_props',
    chapter: 'ch4',
    chapterName: 'Chương 4: Quan hệ & Đại số Bool',
    color: '#8b5cf6',
    badge: 'Tính chất quan hệ',
    title: '11. Bốn tính chất nền tảng của Quan hệ',
    summary: 'Kiểm tra tự động 4 tính chất cốt lõi: Phản xạ (Reflexive), Đối xứng (Symmetric), Phản xứng (Antisymmetric) và Bắc cầu (Transitive) trên ma trận nhị phân Boolean MR.',
    complexity: 'O(n) phản xạ, O(n²) đối xứng, O(n³) bắc cầu',
    algoKey: null,
    labAction: {
      type: 'relation',
      tab: 'properties',
      label: '🔗 Kiểm tra 4 tính chất trong Lab',
    },
    quizFilter: 'relation',
    details: {
      formulation: 'Cho quan hệ R trên tập A có n phần tử với ma trận M_R. Kiểm tra xem R có thỏa mãn 4 tính chất kinh điển hay không.',
      coreIdea: 'Kiểm tra phản xạ qua đường chéo chính. Kiểm tra đối xứng qua tính đối xứng của ma trận (M_R = M_Rᵀ). Kiểm tra phản xứng: Nếu M[i, j] = 1 (i ≠ j) thì bắt buộc M[j, i] = 0. Kiểm tra bắc cầu: M_R² ≤ M_R.',
      pseudocode: `Kiểm tra 4 tính chất trên ma trận n×n:
1. Phản xạ:   ∀i: M[i, i] == 1
2. Đối xứng:  ∀i, j: M[i, j] == M[j, i]
3. Phản xứng: ∀i ≠ j: Nếu M[i, j] == 1 thì M[j, i] == 0
4. Bắc cầu:   ∀i, j, k: Nếu M[i, k] == 1 && M[k, j] == 1 thì M[i, j] == 1`,
      stepTrace: `Phân tích quan hệ bé hơn hoặc bằng (≤) trên {1, 2, 3}:
- Phản xạ: 1≤1, 2≤2, 3≤3 (ĐÚNG)
- Đối xứng: 1≤2 nhưng 2≰1 (KHÔNG ĐỐI XỨNG)
- Phản xứng: a≤b và b≤a ==> a=b (ĐÚNG)
- Bắc cầu: a≤b và b≤c ==> a≤c (ĐÚNG)
==> Quan hệ (≤) là một quan hệ thứ tự!`,
      complexityNotes: 'Kiểm tra bắc cầu ngây thơ mất O(n³). Có thể dùng nhân ma trận Boole để kiểm tra M_R ⊙ M_R ≤ M_R.',
      examTips: '⚠️ Bẫy phổ biến nhất: "Không đối xứng" KHÔNG CÓ NGHĨA LÀ "Phản xứng"! Một quan hệ có thể vừa không đối xứng vừa không phản xứng, hoặc thậm chí vừa đối xứng vừa phản xứng (khi quan hệ rỗng hoặc chỉ chứa các cặp (a, a)).',
    },
  },
  {
    id: 'rel_closure',
    chapter: 'ch4',
    chapterName: 'Chương 4: Quan hệ & Đại số Bool',
    color: '#8b5cf6',
    badge: 'Bao đóng & Warshall',
    title: '12. Bao đóng quan hệ & Thuật toán Warshall',
    summary: 'Mở rộng quan hệ nhỏ nhất thỏa mãn tính chất: Bao đóng phản xạ R ∪ Δ, bao đóng đối xứng R ∪ R⁻¹, và bao đóng bắc cầu R* bằng Thuật toán Warshall với 3 vòng lặp O(n³).',
    complexity: 'O(n³) Thuật toán Warshall',
    algoKey: null,
    labAction: {
      type: 'relation',
      tab: 'warshall',
      label: '🔗 Chạy thuật toán Warshall từng bước',
    },
    quizFilter: 'relation',
    details: {
      formulation: 'Cho quan hệ R với ma trận M_R. Tìm bao đóng bắc cầu R* sao cho R ⊆ R*, R* có tính bắc cầu và là tập nhỏ nhất thỏa mãn điều kiện đó.',
      coreIdea: 'Thuật toán Warshall xây dựng dãy ma trận W^(0), W^(1), ..., W^(n). Tại bước k, đường đi giữa đỉnh i và j được kết nối nếu tồn tại đường đi qua đỉnh trung gian k.',
      pseudocode: `Thuật toán Warshall (Transitive Closure):
1. Khởi tạo W = M_R
2. For k = 1 to n:       // Đỉnh trung gian
     For i = 1 to n:     // Đỉnh xuất phát
       For j = 1 to n:   // Đỉnh kết thúc
         W[i, j] = W[i, j] ∨ (W[i, k] ∧ W[k, j])
3. Trả về ma trận bao đóng W`,
      stepTrace: `Ý nghĩa bước k của Warshall:
W[i, j] trở thành 1 nếu:
- Đã có đường đi trực tiếp i -> j từ trước: W[i, j] = 1, HOẶC
- Có đường nối i -> k và k -> j: W[i, k] = 1 và W[k, j] = 1.
Sau đúng n bước qua n đỉnh trung gian, mọi đường đi gián tiếp đều được bổ sung!`,
      complexityNotes: 'Warshall là phiên bản đại số Boole của thuật toán Floyd-Warshall tìm đường đi ngắn nhất mọi cặp đỉnh.',
      examTips: 'Thuật toán Warshall cho kết quả ma trận bao đóng bắc cầu hoàn chỉnh. Để tìm bao đóng tương đương, ta kết hợp: (R ∪ Δ ∪ R⁻¹)*.',
    },
  },
  {
    id: 'rel_equiv',
    chapter: 'ch4',
    chapterName: 'Chương 4: Quan hệ & Đại số Bool',
    color: '#8b5cf6',
    badge: 'Tương đương & Lớp',
    title: '13. Quan hệ tương đương & Phân hoạch tập hợp',
    summary: 'Quan hệ thỏa mãn đủ 3 tính chất: Phản xạ, Đối xứng và Bắc cầu. Định lý phân hoạch: Các lớp tương đương [a] rời nhau từng đôi một và hợp lại thành toàn bộ tập hợp A.',
    complexity: 'O(n³) kiểm tra và sinh các lớp',
    algoKey: null,
    labAction: {
      type: 'relation',
      tab: 'hasse',
      subsubtab: 'equivalence',
      label: '🔗 Phân tích Lớp tương đương trong Lab',
    },
    quizFilter: 'relation',
    details: {
      formulation: 'Cho quan hệ tương đương R trên A. Xác định các lớp tương đương [a] = {x ∈ A | x R a} và tập thương A / R.',
      coreIdea: 'Định lý cơ bản về quan hệ tương đương: Hai lớp [a] và [b] hoặc trùng nhau hoàn toàn ([a] = [b] khi a R b), hoặc rời nhau đôi một ([a] ∩ [b] = ∅ khi (a, b) ∉ R). Hợp của tất cả các lớp bằng chính tập A ban đầu.',
      pseudocode: `Thuật toán phân hoạch lớp tương đương:
1. Tập còn lại U = A, Tập thương Classes = []
2. While U chưa rỗng:
     Chọn đại diện a ∈ U
     Lớp [a] = { x ∈ A | a R x }
     Thêm [a] vào Classes
     U = U \\ [a]
3. Trả về Classes (Phân hoạch của A)`,
      stepTrace: `Ví dụ quan hệ đồng dư modulo 3 trên tập A = {0, 1, 2, 3, 4, 5, 6}:
- Lớp [0] = {0, 3, 6} (chia hết cho 3)
- Lớp [1] = {1, 4}    (chia 3 dư 1)
- Lớp [2] = {2, 5}    (chia 3 dư 2)
Ba lớp này hoàn toàn rời nhau và hợp lại bằng toàn bộ tập A!`,
      complexityNotes: 'Cấu trúc Disjoint-Set (Union-Find) trong thuật toán Kruskal chính là sự hiện thực hóa tối ưu của quan hệ tương đương trong khoa học máy tính.',
      examTips: 'Mỗi quan hệ tương đương trên tập A xác định duy nhất một phân hoạch của A, và ngược lại, mỗi phân hoạch của A sinh ra duy nhất một quan hệ tương đương.',
    },
  },
  {
    id: 'rel_order',
    chapter: 'ch4',
    chapterName: 'Chương 4: Quan hệ & Đại số Bool',
    color: '#8b5cf6',
    badge: 'Thứ tự & Hasse',
    title: '14. Quan hệ thứ tự (Poset) & Biểu đồ Hasse',
    summary: 'Quan hệ thỏa mãn: Phản xạ, Phản xứng và Bắc cầu. Tập sắp thứ tự một phần (Poset), phần tử trội kề, biểu đồ Hasse loại bỏ khuyên và cạnh bắc cầu, phần tử tối đại/tối tiểu, Lưới (Lattice).',
    complexity: 'O(n³) rút gọn biểu đồ Hasse',
    algoKey: null,
    labAction: {
      type: 'relation',
      tab: 'hasse',
      subsubtab: 'hasse',
      label: '🔗 Vẽ Biểu đồ Hasse tương tác trong Lab',
    },
    quizFilter: 'relation',
    details: {
      formulation: 'Cho quan hệ thứ tự (A, ≤). Vẽ biểu đồ Hasse và tìm phần tử tối đại (Maximal), tối tiểu (Minimal), phần tử lớn nhất (Greatest), bé nhất (Least).',
      coreIdea: 'Biểu đồ Hasse là đồ thị có hướng rút gọn: 1) Loại bỏ mọi khuyên tự thân (tính phản xạ); 2) Loại bỏ mọi cạnh bắc cầu (nếu x < y và y < z thì xóa cạnh x -> z); 3) Vẽ chiều mũi tên hướng lên trên và bỏ dấu mũi tên.',
      pseudocode: `Quy tắc vẽ biểu đồ Hasse:
1. Lập ma trận quan hệ thứ tự M_R
2. Bỏ đường chéo chính: M[i, i] = 0 (loại phản xạ)
3. Loại bỏ quan hệ bắc cầu:
   Nếu M[i, k] == 1 và M[k, j] == 1 với k ≠ i, k ≠ j:
     Gán M[i, j] = 0
4. Các cạnh còn lại là quan hệ phủ kề (Covering relation).
5. Phân tầng tọa độ Y theo thứ tự tô-pô và vẽ đường nối thẳng.`,
      stepTrace: `Quan hệ chia hết (|) trên tập ước của 12: D₁₂ = {1, 2, 3, 4, 6, 12}
- Tầng 0 (Đáy): 1 (Phần tử bé nhất - Least element)
- Tầng 1: 2, 3
- Tầng 2: 4 (nối với 2), 6 (nối với 2 và 3)
- Tầng 3 (Đỉnh): 12 (nối với 4 và 6) (Phần tử lớn nhất - Greatest element)`,
      complexityNotes: 'Biểu đồ Hasse cho phép nhận biết nhanh cấu trúc Lưới (Lattice): Mọi cặp phần tử đều có Cận trên nhỏ nhất (sup / LUB) và Cận dưới lớn nhất (inf / GLB).',
      examTips: '⚠️ Phân biệt: Phần tử "Lớn nhất" (Greatest) nếu tồn tại thì là DUY NHẤT và lớn hơn mọi phần tử khác; Phần tử "Tối đại" (Maximal) có thể có NHIỀU phần tử và chỉ cần không có ai lớn hơn nó.',
    },
  },

  // =========================================================================
  // CHƯƠNG 5: LÝ THUYẾT ĐỒ THỊ & THUẬT TOÁN TỐI ƯU
  // =========================================================================
  {
    id: 'graph_dijkstra',
    chapter: 'ch5',
    chapterName: 'Chương 5: Lý thuyết Đồ thị',
    color: '#3b82f6',
    badge: 'Đường đi ngắn nhất',
    title: '15. Thuật toán Dijkstra (Tìm đường ngắn nhất)',
    summary: 'Tìm đường đi ngắn nhất từ một đỉnh nguồn tới tất cả các đỉnh còn lại trong đồ thị có trọng số không âm bằng phương pháp Tham lam (Greedy) kết hợp kỹ thuật Giãn cạnh (Edge Relaxation).',
    complexity: 'O((V + E) log V) với Min-Heap / O(V²) với mảng',
    algoKey: 'dijkstra',
    labAction: {
      type: 'algo',
      algoKey: 'dijkstra',
      label: '🚀 Chạy mô phỏng Dijkstra trong Lab',
    },
    quizFilter: 'dijkstra',
    details: {
      formulation: 'Cho đồ thị có trọng số G = (V, E, w) với trọng số w(u, v) ≥ 0 và đỉnh nguồn s. Tìm khoảng cách ngắn nhất d[v] từ s đến mọi đỉnh v ∈ V và mảng truy vết p[v].',
      coreIdea: 'Nguyên lý tham lam (Greedy Strategy): Tại mỗi bước, chọn đỉnh u chưa chốt có khoảng cách tạm thời d[u] nhỏ nhất. Chốt đỉnh u vào tập đã xong S. Sau đó tiến hành Giãn cạnh (Relaxation) cho mọi đỉnh kề v: nếu d[u] + w(u, v) < d[v] thì cập nhật d[v] = d[u] + w(u, v) và p[v] = u.',
      pseudocode: `Thuật toán Dijkstra (với Priority Queue / Min-Heap):
1. Khởi tạo:
     Với mọi v ∈ V: d[v] = ∞, p[v] = null
     d[s] = 0
     Hàng đợi ưu tiên Q = [(0, s)]
2. While Q không rỗng:
     (dist, u) = Q.pop_min()
     Nếu dist > d[u]: bỏ qua (đã được cập nhật ngắn hơn)
     Với mỗi cạnh (u, v, w) kề với u:
       Nếu d[u] + w < d[v]:
         d[v] = d[u] + w
         p[v] = u
         Q.push((d[v], v))
3. Truy vết đường đi: Đi ngược từ đích về nguồn theo mảng p[]`,
      stepTrace: `Mô phỏng đồ thị mẫu từ đỉnh nguồn A:
Đỉnh kề: A-(4)->B, A-(2)->C, C-(1)->B, B-(5)->D, C-(8)->D
- Khởi tạo: d = [A:0, B:∞, C:∞, D:∞]
- Bước 1: Chọn A (d=0). Giãn cạnh: d[B]=4, d[C]=2. Chốt A.
- Bước 2: Chọn C (d=2 nhỏ nhất). Giãn cạnh:
    C->B: 2 + 1 = 3 < 4 ==> CẬP NHẬT d[B]=3!
    C->D: 2 + 8 = 10 ==> d[D]=10. Chốt C.
- Bước 3: Chọn B (d=3). Giãn cạnh B->D: 3 + 5 = 8 < 10 ==> CẬP NHẬT d[D]=8! Chốt B.
- Bước 4: Chọn D (d=8). Chốt D.
==> Khoảng cách ngắn nhất A->D là 8 qua đường A -> C -> B -> D.`,
      complexityNotes: 'Dùng mảng thường duyệt min mất O(V²), phù hợp đồ thị dày (E ≈ V²). Dùng Min-Heap mất O((V + E) log V), tối ưu vượt trội cho đồ thị thưa (E ≪ V²).',
      examTips: '⚠️ ĐIỀU KIỆN TIÊN QUYẾT: Dijkstra chỉ áp dụng được khi mọi trọng số cạnh w(e) ≥ 0. Nếu đồ thị có cạnh âm, bắt buộc phải dùng thuật toán Bellman-Ford O(V·E) hoặc Floyd-Warshall O(V³)!',
    },
  },
  {
    id: 'graph_prim',
    chapter: 'ch5',
    chapterName: 'Chương 5: Lý thuyết Đồ thị',
    color: '#3b82f6',
    badge: 'Cây khung nhỏ nhất',
    title: '16. Thuật toán Prim (Cây khung nhỏ nhất - MST)',
    summary: 'Xây dựng cây khung nhỏ nhất (Minimum Spanning Tree) bằng cách xuất phát từ một đỉnh tùy ý và liên tục kết nạp cạnh có trọng số nhỏ nhất nối giữa tập đỉnh đã chọn Vmst và phần còn lại.',
    complexity: 'O((V + E) log V) với Min-Heap',
    algoKey: 'prim',
    labAction: {
      type: 'algo',
      algoKey: 'prim',
      label: '🚀 Chạy mô phỏng Prim trong Lab',
    },
    quizFilter: 'mst',
    details: {
      formulation: 'Cho đồ thị vô hướng liên thông có trọng số G = (V, E, w). Tìm cây khung T = (V, E_T) với E_T ⊆ E sao cho |E_T| = |V| - 1 và tổng trọng số ∑ w(e) là nhỏ nhất.',
      coreIdea: 'Tính chất lát cắt (Cut Property): Phân chia tập đỉnh thành hai phần S và V \\ S. Cạnh có trọng số nhỏ nhất vượt qua lát cắt này chắc chắn thuộc về cây khung nhỏ nhất. Prim liên tục mở rộng S từ 1 đỉnh cho đến khi S = V.',
      pseudocode: `Thuật toán Prim:
1. Chọn đỉnh bắt đầu s tùy ý: V_mst = {s}, E_mst = ∅
2. While |V_mst| < |V|:
     Tìm cạnh e = (u, v) có trọng số w(e) nhỏ nhất sao cho:
       u ∈ V_mst và v ∉ V_mst
     Nếu không tìm thấy ==> Đồ thị không liên thông!
     V_mst = V_mst ∪ {v}
     E_mst = E_mst ∪ {e}
3. Trả về cây khung E_mst với tổng trọng số nhỏ nhất`,
      stepTrace: `Trace trên đồ thị 4 đỉnh A, B, C, D:
Cạnh: A-B(1), B-C(2), C-D(3), A-D(4), B-D(5)
- Bắt đầu: V_mst = {A}
- Bước 1: Cạnh nhỏ nhất từ {A} là (A, B, 1). Kết nạp B ==> V_mst = {A, B}
- Bước 2: Cạnh nhỏ nhất từ {A, B} là (B, C, 2). Kết nạp C ==> V_mst = {A, B, C}
- Bước 3: Cạnh nhỏ nhất từ {A, B, C} sang {D} là (C, D, 3). Kết nạp D ==> V_mst = {A, B, C, D}
==> Cây khung MST gồm 3 cạnh: (A,B), (B,C), (C,D) với tổng trọng số = 1 + 2 + 3 = 6.`,
      complexityNotes: 'Cài đặt bằng Min-Heap lưu khoảng cách từ các đỉnh ngoài vào cây khung đạt độ phức tạp O((V + E) log V).',
      examTips: 'Prim phát triển cây từ một đỉnh cục bộ lan ra (Vertex-based), thích hợp cho đồ thị dày. Trong khi Kruskal xét cạnh trên toàn cục (Edge-based).',
    },
  },
  {
    id: 'graph_kruskal',
    chapter: 'ch5',
    chapterName: 'Chương 5: Lý thuyết Đồ thị',
    color: '#3b82f6',
    badge: 'Cây khung nhỏ nhất',
    title: '17. Thuật toán Kruskal (MST & Disjoint Set)',
    summary: 'Xây dựng cây khung nhỏ nhất bằng cách sắp xếp tất cả các cạnh theo trọng số tăng dần, lần lượt chọn cạnh nhỏ nhất không tạo chu trình nhờ cấu trúc tập rời rạc (Union-Find).',
    complexity: 'O(E log E) chi phí sắp xếp cạnh',
    algoKey: 'kruskal',
    labAction: {
      type: 'algo',
      algoKey: 'kruskal',
      label: '🚀 Chạy mô phỏng Kruskal trong Lab',
    },
    quizFilter: 'mst',
    details: {
      formulation: 'Tìm tập |V| - 1 cạnh liên thông không chu trình có tổng trọng số cực tiểu trên đồ thị vô hướng có trọng số.',
      coreIdea: 'Tiếp cận tham lam trực tiếp trên tập cạnh: Sắp xếp toàn bộ cạnh theo trọng số tăng dần. Với mỗi cạnh (u, v), dùng Union-Find để kiểm tra: Nếu u và v thuộc hai thành phần liên thông khác nhau (Find(u) ≠ Find(v)), ta kết nạp cạnh đó và hợp nhất hai thành phần (Union(u, v)).',
      pseudocode: `Thuật toán Kruskal:
1. Sắp xếp tất cả các cạnh E theo trọng số w(e) tăng dần
2. Khởi tạo cấu trúc Disjoint Set: Mỗi đỉnh v là một tập riêng biệt (MakeSet(v))
3. E_mst = ∅
4. For each (u, v) in E (đã sắp xếp):
     If Find(u) ≠ Find(v):
       E_mst = E_mst ∪ {(u, v)}
       Union(u, v)
       Nếu |E_mst| == |V| - 1: Dừng sớm (Đã đủ cạnh cây khung)
5. Trả về E_mst`,
      stepTrace: `Danh sách cạnh sắp xếp: e1(1), e2(2), e3(3), e4(4), e5(5)
- Xét e1: Không tạo chu trình ==> CHỌN
- Xét e2: Không tạo chu trình ==> CHỌN
- Xét e3: Không tạo chu trình ==> CHỌN
- Xét e4: Nối hai đỉnh đã cùng một tập ==> TẠO CHU TRÌNH ==> BỎ QUA!
Đủ |V| - 1 cạnh thì kết thúc.`,
      complexityNotes: 'Giai đoạn sắp xếp cạnh mất O(E log E). Giai đoạn duyệt cạnh với Union-Find (Path Compression + Union by Rank) chỉ mất O(E · α(V)) gần như tuyến tính.',
      examTips: 'Kruskal cực kỳ hiệu quả khi đồ thị thưa (E ≪ V²). Nếu tất cả các trọng số cạnh đôi một khác nhau thì đồ thị có DUY NHẤT một cây khung nhỏ nhất!',
    },
  },
  {
    id: 'graph_euler',
    chapter: 'ch5',
    chapterName: 'Chương 5: Lý thuyết Đồ thị',
    color: '#3b82f6',
    badge: 'Chu trình / Đường đi',
    title: '18. Chu trình & Đường đi Euler',
    summary: 'Duyệt qua mỗi cạnh của đồ thị đúng một lần. Định lý Euler về số đỉnh bậc lẻ và thuật toán Hierholzer với ngăn xếp (Stack) để truy vết chu trình trong thời gian tuyến tính O(V + E).',
    complexity: 'O(V + E) thời gian tuyến tính',
    algoKey: 'euler',
    labAction: {
      type: 'algo',
      algoKey: 'euler',
      label: '🚀 Chạy mô phỏng Euler trong Lab',
    },
    quizFilter: 'euler_hamilton',
    details: {
      formulation: 'Tìm một đường đi hoặc chu trình khép kín đi qua TẤT CẢ các cạnh của đồ thị G = (V, E) mỗi cạnh ĐÚNG MỘT LẦN.',
      coreIdea: 'Định lý Euler (1736 - Bài toán 7 cây cầu Königsberg): Đồ thị vô hướng liên thông có Chu trình Euler khi và chỉ khi TẤT CẢ các đỉnh đều có bậc chẵn; Có Đường đi Euler khi và chỉ khi có ĐÚNG 2 đỉnh bậc lẻ (khi đó đường đi bắt đầu từ một đỉnh lẻ và kết thúc ở đỉnh lẻ còn lại).',
      pseudocode: `Thuật toán Hierholzer tìm chu trình Euler:
1. Kiểm tra điều kiện bậc: Nếu vi phạm ==> Kết luận không có chu trình Euler
2. Stack = [start_vertex], Circuit = []
3. While Stack không rỗng:
     v = Stack.peek()
     Nếu v còn cạnh kề chưa đi qua:
       Chọn cạnh (v, u), xóa cạnh (v, u) khỏi đồ thị
       Stack.push(u)
     Ngược lại:
       Circuit.push(Stack.pop())
4. Đảo ngược mảng Circuit để có chu trình Euler chuẩn`,
      stepTrace: `Phân tích đồ thị bài toán Nhà Euler:
Đỉnh: A(bậc 4), B(bậc 4), C(bậc 2), D(bậc 2).
Tất cả các đỉnh đều có bậc chẵn ==> Tồn tại Chu trình Euler!
Thuật toán Hierholzer truy vết không bao giờ bị kẹt ở đỉnh trung gian.`,
      complexityNotes: 'Hierholzer có độ phức tạp tối ưu tuyệt đối O(V + E), mỗi cạnh được thăm và xóa đúng một lần.',
      examTips: '⚠️ Bẫy đề thi: Đường đi Euler đi qua mỗi CẠNH đúng 1 lần (đỉnh có thể đi qua nhiều lần). Ngược lại, Hamilton đi qua mỗi ĐỈNH đúng 1 lần (cạnh có thể không đi qua hết).',
    },
  },
  {
    id: 'graph_hamilton',
    chapter: 'ch5',
    chapterName: 'Chương 5: Lý thuyết Đồ thị',
    color: '#3b82f6',
    badge: 'Chu trình / Đường đi',
    title: '19. Chu trình & Đường đi Hamilton',
    summary: 'Tìm đường đi hoặc chu trình khép kín đi qua mỗi đỉnh của đồ thị đúng một lần. Bài toán NP-đầy đủ kinh điển liên quan đến Bài toán người du lịch (TSP), giải bằng thuật toán quay lui.',
    complexity: 'O(V!) độ phức tạp giai thừa',
    algoKey: 'hamilton',
    labAction: {
      type: 'algo',
      algoKey: 'hamilton',
      label: '🚀 Chạy mô phỏng Hamilton trong Lab',
    },
    quizFilter: 'euler_hamilton',
    details: {
      formulation: 'Tìm chu trình đơn đi qua tất cả các đỉnh của đồ thị mỗi đỉnh đúng một lần rồi quay trở lại đỉnh xuất phát.',
      coreIdea: 'Khác với Euler có tiêu chuẩn kiểm tra bậc chẵn/lẻ đơn giản, bài toán Hamilton là NP-complete, không có điều kiện cần và đủ tổng quát tính được trong thời gian đa thức. Một số điều kiện đủ kinh điển: Định lý Dirac (deg(v) ≥ n/2) và Định lý Ore (deg(u) + deg(v) ≥ n với mọi u, v không kề nhau).',
      pseudocode: `Thuật toán Quay lui (Backtracking) tìm Hamilton:
Function Try(k):
  For each vertex v kề với Path[k-1]:
    If v chưa được thăm (visited[v] == false):
      Path[k] = v
      visited[v] = true
      If k == |V|:
        If Path[k] kề với Path[1]: Ghi nhận Chu trình Hamilton!
      Else:
        Try(k + 1)
      visited[v] = false // Quay lui (Backtrack)`,
      stepTrace: `Đồ thị ngũ giác C₅: A - B - C - D - E - A
Đường đi Hamilton: A -> B -> C -> D -> E -> A.
Mọi đỉnh được thăm đúng 1 lần trước khi quay lại A.`,
      complexityNotes: 'Không gian tìm kiếm trong trường hợp xấu nhất là O(V!). Với đồ thị lớn, ta dùng quy hoạch động trạng thái (Held-Karp) O(V² · 2^V) hoặc giải thuật xấp xỉ.',
      examTips: 'Định lý Dirac: Nếu đồ thị đơn vô hướng có n ≥ 3 đỉnh và deg(v) ≥ n/2 với mọi v thì đồ thị chắc chắn có chu trình Hamilton (đây là điều kiện ĐỦ, không phải điều kiện cần).',
    },
  },
];
