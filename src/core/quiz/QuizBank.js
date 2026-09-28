/**
 * @file QuizBank.js
 * Question Repository, Procedural Exam Generator, and LaTeX/Print Exporter
 * for Discrete Mathematics & Logic Education.
 * 
 * Fully covers all 4 Curriculum Pillars / Chapters:
 * - Chapter 1 & 2: Propositional & Predicate Logic, Karnaugh Maps & Digital Circuits (Logic Lab)
 * - Chapter 3: Combinatorics & Counting Methods (Counting Lab)
 * - Chapter 4: Binary Relations & Boolean Algebra, Warshall & Hasse (Relation Lab)
 * - Chapter 5: Graph Theory & Core Optimization Algorithms (Algorithm Lab)
 */

export const QUIZ_TOPICS = {
  ALL: 'all',
  LOGIC: 'logic',
  COUNTING: 'counting',
  RELATION: 'relation',
  GRAPH: 'graph',
};

export const QUIZ_DIFFICULTIES = {
  ALL: 'all',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

/**
 * Curated Question Bank covering university-level Discrete Mathematics across all chapters.
 */
export const STATIC_QUESTION_BANK = [
  // =========================================================================
  // CHƯƠNG 1 & 2: CƠ SỞ LOGIC MỆNH ĐỀ & VỊ TỪ
  // =========================================================================
  {
    id: 'logic_q01',
    topic: 'logic',
    topicName: 'Logic Mệnh đề',
    difficulty: 'easy',
    question: 'Cho hai mệnh đề p = Đúng (1) và q = Sai (0). Mệnh đề kéo theo (p → q) có giá trị chân trị là gì?',
    options: [
      { id: 'A', text: '1 (Đúng)' },
      { id: 'B', text: '0 (Sai)' },
      { id: 'C', text: 'Không xác định được' },
      { id: 'D', text: 'Cả 1 và 0 đều đúng' },
    ],
    correctId: 'B',
    explanation: 'Theo định nghĩa phép kéo theo, p → q chỉ nhận giá trị SAI duy nhất khi tiền đề p Đúng (1) và kết luận q Sai (0). Do đó 1 → 0 = 0.',
    actionLink: { view: 'logic', expression: 'p → q' },
  },
  {
    id: 'logic_q02',
    topic: 'logic',
    topicName: 'Bản chất Mệnh đề',
    difficulty: 'easy',
    question: 'Biểu thức logic p ∨ ¬p (Luật triệt tam) thuộc loại mệnh đề nào sau đây?',
    options: [
      { id: 'A', text: 'Mâu thuẫn / Hằng sai (Contradiction)' },
      { id: 'B', text: 'Tiếp liên / Thỏa được (Contingency)' },
      { id: 'C', text: 'Hằng đúng (Tautology)' },
      { id: 'D', text: 'Không thể phân loại' },
    ],
    correctId: 'C',
    explanation: 'Với mọi giá trị của p: khi p=1 thì p ∨ ¬p = 1 ∨ 0 = 1; khi p=0 thì 0 ∨ 1 = 1. Biểu thức luôn nhận giá trị Đúng ở tất cả các trường hợp nên là Hằng đúng (Tautology).',
    actionLink: { view: 'logic', expression: 'p ∨ ¬p' },
  },
  {
    id: 'logic_q03',
    topic: 'logic',
    topicName: 'Tương đương Logic',
    difficulty: 'medium',
    question: 'Theo luật De Morgan, phủ định của mệnh đề hội ¬(p ∧ q) tương đương logic với biểu thức nào?',
    options: [
      { id: 'A', text: '¬p ∧ ¬q' },
      { id: 'B', text: '¬p ∨ ¬q' },
      { id: 'C', text: 'p ∨ q' },
      { id: 'D', text: '¬p → q' },
    ],
    correctId: 'B',
    explanation: 'Luật De Morgan khẳng định: Phủ định của một hội bằng tuyển của các phủ định: ¬(p ∧ q) ≡ ¬p ∨ ¬q.',
    actionLink: { view: 'logic', expression: '¬(p ∧ q) ↔ (¬p ∨ ¬q)' },
  },
  {
    id: 'logic_q04',
    topic: 'logic',
    topicName: 'Quy tắc Suy diễn',
    difficulty: 'medium',
    question: 'Quy tắc suy diễn "Nếu p → q đúng và tiền đề p đúng thì suy ra kết luận q đúng" có tên gọi kinh điển là gì?',
    options: [
      { id: 'A', text: 'Khẳng định tiền đề (Modus Ponens)' },
      { id: 'B', text: 'Phủ định hậu đề (Modus Tollens)' },
      { id: 'C', text: 'Tam đoạn luận giả thiết (Hypothetical Syllogism)' },
      { id: 'D', text: 'Luật triệt tiêu mâu thuẫn' },
    ],
    correctId: 'A',
    explanation: 'Quy tắc ((p → q) ∧ p) → q là quy tắc suy diễn cơ bản nhất trong toán học, được gọi là Modus Ponens (Khẳng định tiền đề).',
    actionLink: { view: 'logic', expression: '((p → q) ∧ p) → q' },
  },
  {
    id: 'logic_q05',
    topic: 'logic',
    topicName: 'Tương đương Phản đảo',
    difficulty: 'medium',
    question: 'Mệnh đề phản đảo (Contrapositive) của mệnh đề kéo theo "Nếu trời mưa thì đường trơn" (p → q) là mệnh đề nào?',
    options: [
      { id: 'A', text: 'Nếu đường trơn thì trời mưa (q → p)' },
      { id: 'B', text: 'Nếu trời không mưa thì đường không trơn (¬p → ¬q)' },
      { id: 'C', text: 'Nếu đường không trơn thì trời không mưa (¬q → ¬p)' },
      { id: 'D', text: 'Trời mưa và đường không trơn (p ∧ ¬q)' },
    ],
    correctId: 'C',
    explanation: 'Mệnh đề phản đảo của p → q là ¬q → ¬p. Theo định lý tương đương phản đảo, p → q ≡ ¬q → ¬p.',
    actionLink: { view: 'logic', expression: '(p → q) ↔ (¬q → ¬p)' },
  },
  {
    id: 'logic_q06',
    topic: 'logic',
    topicName: 'Dạng chuẩn tắc',
    difficulty: 'medium',
    question: 'Một hàm logic 3 biến f(p, q, r) có bao nhiêu dòng trong bảng chân trị toàn phần?',
    options: [
      { id: 'A', text: '3 dòng' },
      { id: 'B', text: '6 dòng' },
      { id: 'C', text: '8 dòng (2³)' },
      { id: 'D', text: '16 dòng (2⁴)' },
    ],
    correctId: 'C',
    explanation: 'Với n biến mệnh đề độc lập, không gian chân trị toàn phần có chính xác 2ⁿ trường hợp gán trị. Với 3 biến, tổng số dòng là 2³ = 8 dòng.',
    actionLink: { view: 'logic', expression: 'p ∧ q ∧ r' },
  },
  {
    id: 'logic_q07',
    topic: 'logic',
    topicName: 'Lượng từ & Phủ định',
    difficulty: 'easy',
    question: 'Phủ định của mệnh đề lượng từ "Mọi sinh viên đều qua môn" (kí hiệu ∀x, P(x)) là mệnh đề nào?',
    options: [
      { id: 'A', text: 'Không có sinh viên nào qua môn (∀x, ¬P(x))' },
      { id: 'B', text: 'Có ít nhất một sinh viên không qua môn (∃x, ¬P(x))' },
      { id: 'C', text: 'Mọi sinh viên đều trượt môn' },
      { id: 'D', text: 'Có ít nhất một sinh viên qua môn (∃x, P(x))' },
    ],
    correctId: 'B',
    explanation: 'Theo quy tắc phủ định lượng từ: ¬(∀x, P(x)) ≡ ∃x, ¬P(x). Phủ định của "tất cả đều đạt" là "tồn tại ít nhất một người không đạt".',
  },
  {
    id: 'logic_q08',
    topic: 'logic',
    topicName: 'Quy tắc Suy diễn',
    difficulty: 'medium',
    question: 'Cho hai tiền đề: "Nếu hôm nay là Chủ nhật thì trường đóng cửa" (p → q) và "Trường không đóng cửa" (¬q). Theo quy tắc Phủ định hậu đề (Modus Tollens), kết luận rút ra là gì?',
    options: [
      { id: 'A', text: 'Hôm nay là Chủ nhật (p)' },
      { id: 'B', text: 'Hôm nay không phải là Chủ nhật (¬p)' },
      { id: 'C', text: 'Trường sắp mở cửa' },
      { id: 'D', text: 'Không thể kết luận được gì' },
    ],
    correctId: 'B',
    explanation: 'Quy tắc Modus Tollens: ((p → q) ∧ ¬q) → ¬p. Vì hậu đề q sai, tiền đề p bắt buộc phải sai để mệnh đề kéo theo không bị mâu thuẫn.',
    actionLink: { view: 'logic', expression: '((p → q) ∧ ¬q) → ¬p' },
  },
  {
    id: 'kmap_q01',
    topic: 'logic',
    topicName: 'Bìa Karnaugh',
    difficulty: 'easy',
    question: 'Quy tắc gom nhóm các ô số 1 liền kề trên Bìa Karnaugh yêu cầu số lượng ô trong mỗi nhóm phải là:',
    options: [
      { id: 'A', text: 'Số lượng ô bất kỳ (1, 2, 3, 4, 5...)' },
      { id: 'B', text: 'Số nguyên tố (2, 3, 5, 7)' },
      { id: 'C', text: 'Lũy thừa của 2 (1, 2, 4, 8, 16...)' },
      { id: 'D', text: 'Số chia hết cho 3' },
    ],
    correctId: 'C',
    explanation: 'Các tế bào liền kề trên Bìa K chỉ có thể triệt tiêu biến khi tạo thành khối chữ nhật có kích thước là lũy thừa của 2 (2⁰=1, 2¹=2, 2²=4, 2³=8, 2⁴=16 ô).',
  },
  {
    id: 'kmap_q02',
    topic: 'logic',
    topicName: 'Bìa Karnaugh',
    difficulty: 'hard',
    question: 'Trên Bìa Karnaugh 4 biến (p, q, r, s), nếu 4 ô ở 4 góc biên (m0, m2, m8, m10) đều chứa giá trị 1, nhóm này sẽ rút gọn tối tiểu thành dạng nào?',
    options: [
      { id: 'A', text: '¬p ∧ ¬r' },
      { id: 'B', text: '¬q ∧ ¬s' },
      { id: 'C', text: 'p ∧ s' },
      { id: 'D', text: 'q ∧ r' },
    ],
    correctId: 'B',
    explanation: 'Nhờ tính chất cuộn tròn hình xuyến (torus) của mã Gray, 4 góc biên m0(0000), m2(0010), m8(1000), m10(1010) kề nhau. Ở 4 góc này, p và r đổi giá trị nên bị triệt tiêu; chỉ còn q=0 (¬q) và s=0 (¬s) giữ nguyên. Rút gọn thành ¬q ∧ ¬s.',
    actionLink: { view: 'logic', expression: '(¬p ∧ ¬q ∧ ¬r ∧ ¬s) ∨ (¬p ∧ ¬q ∧ r ∧ ¬s) ∨ (p ∧ ¬q ∧ ¬r ∧ ¬s) ∨ (p ∧ ¬q ∧ r ∧ ¬s)' },
  },
  {
    id: 'circuit_q01',
    topic: 'logic',
    topicName: 'Mạch Logic Số',
    difficulty: 'easy',
    question: 'Cổng logic nào chỉ cho ngõ ra bằng 1 khi hai tín hiệu đầu vào có giá trị khác nhau (một 0 và một 1)?',
    options: [
      { id: 'A', text: 'Cổng AND' },
      { id: 'B', text: 'Cổng OR' },
      { id: 'C', text: 'Cổng XOR (Tuyển loại trừ)' },
      { id: 'D', text: 'Cổng NOT' },
    ],
    correctId: 'C',
    explanation: 'Cổng XOR (Exclusive OR, ký hiệu ⊕) thực hiện phép tuyển loại trừ: 0 ⊕ 0 = 0, 1 ⊕ 1 = 0, nhưng 0 ⊕ 1 = 1 và 1 ⊕ 0 = 1.',
    actionLink: { view: 'logic', expression: 'p ⊕ q' },
  },
  {
    id: 'circuit_q02',
    topic: 'logic',
    topicName: 'Mạch Logic Số',
    difficulty: 'medium',
    question: 'Biểu thức (¬s ∧ p) ∨ (s ∧ q) mô tả chức năng của linh kiện số quan trọng nào sau đây?',
    options: [
      { id: 'A', text: 'Mạch giải mã (Decoder 2-to-4)' },
      { id: 'B', text: 'Bộ chọn kênh đa hợp (2-to-1 Multiplexer - MUX)' },
      { id: 'C', text: 'Bộ đếm nhị phân' },
      { id: 'D', text: 'Thanh ghi dịch' },
    ],
    correctId: 'B',
    explanation: 'Khi chân chọn s=0 thì biểu thức bằng (1 ∧ p) ∨ (0 ∧ q) = p (cho kênh p đi qua). Khi s=1 thì biểu thức bằng (0 ∧ p) ∨ (1 ∧ q) = q (cho kênh q đi qua). Đây chính là bộ đa hợp 2-to-1 MUX.',
    actionLink: { view: 'logic', expression: '(¬s ∧ p) ∨ (s ∧ q)' },
  },

  // =========================================================================
  // CHƯƠNG 3: ĐẠI SỐ TỔ HỢP & PHÉP ĐẾM
  // =========================================================================
  {
    id: 'count_q01',
    topic: 'counting',
    topicName: 'Ánh xạ & Hàm số',
    difficulty: 'easy',
    question: 'Một ánh xạ f: A → B được gọi là Đơn ánh (Injective / One-to-one) khi thỏa mãn điều kiện nào?',
    options: [
      { id: 'A', text: 'Mỗi phần tử của B đều có ít nhất một phần tử của A ánh xạ tới' },
      { id: 'B', text: 'Với mọi x₁, x₂ ∈ A, nếu x₁ ≠ x₂ thì f(x₁) ≠ f(x₂)' },
      { id: 'C', text: 'Tập A và tập B có số lượng phần tử bằng nhau' },
      { id: 'D', text: 'Mọi phần tử của A đều ánh xạ tới cùng một phần tử trong B' },
    ],
    correctId: 'B',
    explanation: 'Định nghĩa đơn ánh: các phần tử khác nhau ở tập nguồn A phải có ảnh khác nhau ở tập đích B: x₁ ≠ x₂ ⇒ f(x₁) ≠ f(x₂) (tương đương f(x₁) = f(x₂) ⇒ x₁ = x₂).',
    actionLink: { view: 'counting', tab: 'mapping' },
  },
  {
    id: 'count_q02',
    topic: 'counting',
    topicName: 'Ánh xạ & Bản số',
    difficulty: 'medium',
    question: 'Cho hai tập hữu hạn A và B. Để tồn tại một Toàn ánh (Surjection) từ A lên B, điều kiện cần về số lượng phần tử là gì?',
    options: [
      { id: 'A', text: '|A| < |B|' },
      { id: 'B', text: '|A| ≥ |B|' },
      { id: 'C', text: '|A| + |B| là số chẵn' },
      { id: 'D', text: '|A| ≤ |B|' },
    ],
    correctId: 'B',
    explanation: 'Toàn ánh đòi hỏi mỗi phần tử của B đều phải được ít nhất một phần tử của A ánh xạ tới. Do đó, tập nguồn A phải có ít nhất bằng số phần tử của tập đích B (|A| ≥ |B|).',
    actionLink: { view: 'counting', tab: 'mapping' },
  },
  {
    id: 'count_q03',
    topic: 'counting',
    topicName: 'Ánh xạ & Hàm ngược',
    difficulty: 'medium',
    question: 'Điều kiện cần và đủ để ánh xạ f: A → B có ánh xạ ngược f⁻¹: B → A là gì?',
    options: [
      { id: 'A', text: 'f là đơn ánh' },
      { id: 'B', text: 'f là toàn ánh' },
      { id: 'C', text: 'f là song ánh (vừa đơn ánh vừa toàn ánh)' },
      { id: 'D', text: 'Tập A là tập con của B' },
    ],
    correctId: 'C',
    explanation: 'Ánh xạ ngược f⁻¹ tồn tại khi và chỉ khi f là Song ánh (Bijective). Khi đó mỗi phần tử y ∈ B tương ứng duy nhất với một phần tử x ∈ A.',
    actionLink: { view: 'counting', tab: 'mapping' },
  },
  {
    id: 'count_q04',
    topic: 'counting',
    topicName: 'Nguyên lý Dirichlet',
    difficulty: 'easy',
    question: 'Một hộp chứa các viên bi gồm 3 màu: Đỏ, Xanh, Vàng. Cần lấy ngẫu nhiên ít nhất bao nhiêu viên bi để chắc chắn có ít nhất 2 viên cùng màu?',
    options: [
      { id: 'A', text: '3 viên' },
      { id: 'B', text: '4 viên' },
      { id: 'C', text: '5 viên' },
      { id: 'D', text: '6 viên' },
    ],
    correctId: 'B',
    explanation: 'Theo Nguyên lý Dirichlet: Có 3 màu (3 chuồng). Khi lấy 4 viên bi (4 bồ câu), chắc chắn có ít nhất 1 màu chứa ⌈4/3⌉ = 2 viên cùng màu.',
    actionLink: { view: 'counting', tab: 'dirichlet' },
  },
  {
    id: 'count_q05',
    topic: 'counting',
    topicName: 'Nguyên lý Dirichlet tổng quát',
    difficulty: 'medium',
    question: 'Trong một buổi sinh hoạt lớp có 45 sinh viên. Theo nguyên lý Dirichlet, chắc chắn có ít nhất bao nhiêu sinh viên sinh trong cùng một tháng?',
    options: [
      { id: 'A', text: '3 sinh viên' },
      { id: 'B', text: '4 sinh viên' },
      { id: 'C', text: '5 sinh viên' },
      { id: 'D', text: '12 sinh viên' },
    ],
    correctId: 'B',
    explanation: 'Một năm có 12 tháng (12 hộp). Áp dụng nguyên lý Dirichlet tổng quát: có ít nhất ⌈45 / 12⌉ = ⌈3.75⌉ = 4 sinh viên sinh cùng một tháng.',
    actionLink: { view: 'counting', tab: 'dirichlet' },
  },
  {
    id: 'count_q06',
    topic: 'counting',
    topicName: 'Nguyên lý Dirichlet nâng cao',
    difficulty: 'hard',
    question: 'Chọn ngẫu nhiên 5 số nguyên phân biệt từ tập S = {1, 2, 3, 4, 5, 6, 7, 8}. Khẳng định nào sau đây luôn luôn đúng?',
    options: [
      { id: 'A', text: 'Luôn tồn tại ít nhất hai số có tổng bằng 9' },
      { id: 'B', text: 'Tất cả 5 số đều là số lẻ' },
      { id: 'C', text: 'Luôn tồn tại hai số có hiệu bằng 4' },
      { id: 'D', text: 'Tích của 5 số luôn là số lẻ' },
    ],
    correctId: 'A',
    explanation: 'Chia tập S thành 4 cặp số có tổng bằng 9: {1, 8}, {2, 7}, {3, 6}, {4, 5} (4 chuồng). Khi chọn 5 số (5 bồ câu), theo Dirichlet chắc chắn có ít nhất 2 số rơi vào cùng một cặp, do đó tổng của chúng bằng 9.',
    actionLink: { view: 'counting', tab: 'dirichlet' },
  },
  {
    id: 'count_q07',
    topic: 'counting',
    topicName: 'Chỉnh hợp & Tổ hợp',
    difficulty: 'easy',
    question: 'Có bao nhiêu cách bầu một ban cán sự gồm 1 Lớp trưởng, 1 Lớp phó và 1 Bí thư từ một tập thể gồm 10 sinh viên?',
    options: [
      { id: 'A', text: 'C(10, 3) = 120 cách' },
      { id: 'B', text: 'A(10, 3) = 10 × 9 × 8 = 720 cách' },
      { id: 'C', text: '10³ = 1000 cách' },
      { id: 'D', text: '30 cách' },
    ],
    correctId: 'B',
    explanation: 'Vì 3 chức vụ Lớp trưởng, Lớp phó, Bí thư phân biệt rạch ròi nên việc chọn và xếp đặt có tính thứ tự. Đây là bài toán Chỉnh hợp chập 3 của 10 phần tử: A(10, 3) = 10! / (10 - 3)! = 720 cách.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },
  {
    id: 'count_q08',
    topic: 'counting',
    topicName: 'Quy tắc đếm cơ bản',
    difficulty: 'medium',
    question: 'Một mã bảo mật dài đúng 4 ký tự gồm: ký tự đầu tiên là một chữ cái in hoa (trong 26 chữ cái tiếng Anh), 3 ký tự tiếp theo là các chữ số từ 0 đến 9 (có thể lặp lại). Có bao nhiêu mã bảo mật có thể tạo ra?',
    options: [
      { id: 'A', text: '26 × 10 × 9 × 8 = 18.720 mã' },
      { id: 'B', text: '26 + 10 + 10 + 10 = 56 mã' },
      { id: 'C', text: '26 × 10³ = 26.000 mã' },
      { id: 'D', text: '36⁴ = 1.679.616 mã' },
    ],
    correctId: 'C',
    explanation: 'Theo quy tắc nhân: Vị trí 1 có 26 cách chọn; Vị trí 2 có 10 cách; Vị trí 3 có 10 cách; Vị trí 4 có 10 cách. Tổng số mã = 26 × 10 × 10 × 10 = 26.000 mã.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },
  {
    id: 'count_q09',
    topic: 'counting',
    topicName: 'Tam giác Pascal',
    difficulty: 'easy',
    question: 'Theo đồng nhất thức Pascal, giá trị tổ hợp C(n, k) được tính qua hai tổ hợp ở hàng trên theo công thức nào?',
    options: [
      { id: 'A', text: 'C(n, k) = C(n - 1, k - 1) + C(n - 1, k)' },
      { id: 'B', text: 'C(n, k) = C(n - 1, k) × C(n - 1, k - 1)' },
      { id: 'C', text: 'C(n, k) = C(n, k - 1) + C(n - 1, k)' },
      { id: 'D', text: 'C(n, k) = C(n - 1, k) - C(n - 1, k - 1)' },
    ],
    correctId: 'A',
    explanation: 'Đồng nhất thức Pascal: C(n, k) = C(n - 1, k - 1) + C(n - 1, k). Trong Tam giác Pascal, mỗi phần tử bên trong bằng tổng của hai số nằm ngay phía trên nó.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },
  {
    id: 'count_q10',
    topic: 'counting',
    topicName: 'Nhị thức Newton',
    difficulty: 'medium',
    question: 'Tổng hệ số của tất cả các số hạng trong khai triển nhị thức (1 + 1)ⁿ = ∑ C(n, k) (k từ 0 đến n) bằng bao nhiêu?',
    options: [
      { id: 'A', text: '2n' },
      { id: 'B', text: 'n²' },
      { id: 'C', text: '2ⁿ' },
      { id: 'D', text: 'n!' },
    ],
    correctId: 'C',
    explanation: 'Thay x = 1 và y = 1 vào khai triển nhị thức Newton (x + y)ⁿ = ∑ C(n, k) xⁿ⁻ᵏ yᵏ, ta được: 2ⁿ = C(n, 0) + C(n, 1) + ... + C(n, n). Đây cũng chính là tổng số tập con của một tập hợp n phần tử.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },
  {
    id: 'count_q11',
    topic: 'counting',
    topicName: 'Tổ hợp lặp',
    difficulty: 'hard',
    question: 'Số nghiệm nguyên không âm (x₁, x₂, x₃) của phương trình x₁ + x₂ + x₃ = 7 là bao nhiêu?',
    options: [
      { id: 'A', text: 'C(7, 3) = 35 nghiệm' },
      { id: 'B', text: 'C(7 + 3 - 1, 7) = C(9, 7) = 36 nghiệm' },
      { id: 'C', text: 'A(9, 3) = 504 nghiệm' },
      { id: 'D', text: '7³ = 343 nghiệm' },
    ],
    correctId: 'B',
    explanation: 'Bài toán chia kẹo Euler (Stars and Bars): Số nghiệm nguyên không âm của x₁ + ... + xₙ = k là tổ hợp lặp C(k + n - 1, k). Với n = 3, k = 7: C(7 + 3 - 1, 7) = C(9, 7) = C(9, 2) = 36 nghiệm.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },
  {
    id: 'count_q12',
    topic: 'counting',
    topicName: 'Hệ thức truy hồi & Tháp Hà Nội',
    difficulty: 'easy',
    question: 'Bài toán Tháp Hà Nội với n đĩa có hệ thức truy hồi Hₙ = 2Hₙ₋₁ + 1 với H₁ = 1. Số bước chuyển tối thiểu để dời toàn bộ tháp có n = 4 đĩa là:',
    options: [
      { id: 'A', text: '7 bước' },
      { id: 'B', text: '8 bước' },
      { id: 'C', text: '15 bước (2⁴ - 1)' },
      { id: 'D', text: '16 bước (2⁴)' },
    ],
    correctId: 'C',
    explanation: 'Nghiệm tường minh của hệ thức Tháp Hà Nội là Hₙ = 2ⁿ - 1. Với n = 4 đĩa: H₄ = 2⁴ - 1 = 16 - 1 = 15 bước.',
    actionLink: { view: 'counting', tab: 'recurrence' },
  },
  {
    id: 'count_q13',
    topic: 'counting',
    topicName: 'Dãy Fibonacci & Truy hồi',
    difficulty: 'medium',
    question: 'Phương trình đặc trưng của hệ thức truy hồi tuyến tính bậc 2 của dãy Fibonacci Fₙ = Fₙ₋₁ + Fₙ₋₂ là phương trình nào?',
    options: [
      { id: 'A', text: 'r² - r - 1 = 0' },
      { id: 'B', text: 'r² + r + 1 = 0' },
      { id: 'C', text: 'r² - 2r + 1 = 0' },
      { id: 'D', text: 'r² - r + 1 = 0' },
    ],
    correctId: 'A',
    explanation: 'Giả sử nghiệm có dạng Fₙ = rⁿ. Thay vào hệ thức rⁿ = rⁿ⁻¹ + rⁿ⁻² ⇒ chia cho rⁿ⁻² ta được phương trình đặc trưng: r² - r - 1 = 0. Nghiệm của phương trình này dẫn tới tỉ lệ vàng φ = (1 + √5)/2.',
    actionLink: { view: 'counting', tab: 'recurrence' },
  },
  {
    id: 'count_q14',
    topic: 'counting',
    topicName: 'Nguyên lý Bao hàm - Loại trừ',
    difficulty: 'medium',
    question: 'Trong một lớp gồm 50 sinh viên: có 30 sinh viên giỏi Python, 25 sinh viên giỏi C++, và 10 sinh viên giỏi cả hai ngôn ngữ. Hỏi có bao nhiêu sinh viên không giỏi ngôn ngữ nào trong hai ngôn ngữ trên?',
    options: [
      { id: 'A', text: '0 sinh viên' },
      { id: 'B', text: '5 sinh viên' },
      { id: 'C', text: '10 sinh viên' },
      { id: 'D', text: '15 sinh viên' },
    ],
    correctId: 'B',
    explanation: 'Theo Nguyên lý Bao hàm - Loại trừ: Số sinh viên giỏi ít nhất 1 ngôn ngữ là |P ∪ C| = |P| + |C| - |P ∩ C| = 30 + 25 - 10 = 45 sinh viên. Số sinh viên không giỏi ngôn ngữ nào = 50 - 45 = 5 sinh viên.',
    actionLink: { view: 'counting', tab: 'pascal' },
  },

  // =========================================================================
  // CHƯƠNG 4: QUAN HỆ 2 NGÔI & ĐẠI SỐ BOOL
  // =========================================================================
  {
    id: 'rel_q01',
    topic: 'relation',
    topicName: 'Ma trận Boolean',
    difficulty: 'easy',
    question: 'Cho quan hệ R trên tập A = {1, 2, 3} xác định bởi R = {(1, 1), (1, 2), (2, 3), (3, 3)}. Phần tử ở hàng 1 cột 3 của ma trận Boolean M_R[1, 3] có giá trị là bao nhiêu?',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '0' },
      { id: 'C', text: '3' },
      { id: 'D', text: 'Không xác định' },
    ],
    correctId: 'B',
    explanation: 'Theo định nghĩa ma trận biểu diễn quan hệ Boolean: M_R[i, j] = 1 nếu (aᵢ, aⱼ) ∈ R, và bằng 0 nếu ngược lại. Vì cặp (1, 3) ∉ R nên M_R[1, 3] = 0.',
    actionLink: { view: 'relation', tab: 'matrix' },
  },
  {
    id: 'rel_q02',
    topic: 'relation',
    topicName: 'Hợp thành quan hệ',
    difficulty: 'medium',
    question: 'Cho quan hệ R từ A sang B và quan hệ S từ B sang C. Ma trận Boolean biểu diễn quan hệ hợp thành S ∘ R được tính theo phép toán nào?',
    options: [
      { id: 'A', text: 'Cộng đại số thông thường M_R + M_S' },
      { id: 'B', text: 'Tích Boolean ma trận: M_(S ∘ R) = M_R ⊙ M_S' },
      { id: 'C', text: 'Phép trừ ma trận M_R - M_S' },
      { id: 'D', text: 'Nghịch đảo ma trận M_R⁻¹' },
    ],
    correctId: 'B',
    explanation: 'Quan hệ hợp thành S ∘ R có ma trận Boolean được tính bằng tích Boolean (Boolean product): M_(S ∘ R) = M_R ⊙ M_S, trong đó phép nhân là phép HỘI (∧) và phép cộng là phép TUYỂN (∨).',
    actionLink: { view: 'relation', tab: 'matrix' },
  },
  {
    id: 'rel_q03',
    topic: 'relation',
    topicName: 'Tính chất Phản xạ',
    difficulty: 'easy',
    question: 'Dấu hiệu nhận biết nhanh nhất một quan hệ R trên tập A có tính chất phản xạ (Reflexive) thông qua ma trận Boolean M_R là:',
    options: [
      { id: 'A', text: 'Tất cả các phần tử trên đường chéo chính đều bằng 1 (M_R[i, i] = 1, ∀i)' },
      { id: 'B', text: 'Tất cả các phần tử ngoài đường chéo chính đều bằng 0' },
      { id: 'C', text: 'Ma trận đối xứng qua đường chéo chính' },
      { id: 'D', text: 'Đường chéo chính chứa ít nhất một số 1' },
    ],
    correctId: 'A',
    explanation: 'Tính phản xạ đòi hỏi (a, a) ∈ R với mọi a ∈ A. Do đó, tất cả các ô trên đường chéo chính M_R[i, i] đều bắt buộc phải mang giá trị 1.',
    actionLink: { view: 'relation', tab: 'properties' },
  },
  {
    id: 'rel_q04',
    topic: 'relation',
    topicName: 'Tính chất Đối xứng',
    difficulty: 'easy',
    question: 'Một quan hệ R trên tập A có tính đối xứng (Symmetric) khi và chỉ khi ma trận Boolean M_R thỏa mãn điều kiện nào sau đây?',
    options: [
      { id: 'A', text: 'M_R = M_Rᵀ (Ma trận bằng ma trận chuyển vị của chính nó)' },
      { id: 'B', text: 'M_R có định thức bằng 0' },
      { id: 'C', text: 'M_R ⊙ M_R = M_R' },
      { id: 'D', text: 'M_R[i, i] = 0 với mọi i' },
    ],
    correctId: 'A',
    explanation: 'Tính đối xứng đòi hỏi (a, b) ∈ R ⇒ (b, a) ∈ R, nghĩa là M_R[i, j] = M_R[j, i] với mọi i, j. Điều này tương đương với ma trận đối xứng M_R = M_Rᵀ.',
    actionLink: { view: 'relation', tab: 'properties' },
  },
  {
    id: 'rel_q05',
    topic: 'relation',
    topicName: 'Tính chất Phản đối xứng',
    difficulty: 'medium',
    question: 'Cho tập A = {1, 2, 3}. Quan hệ R = {(1, 1), (2, 2), (3, 3)} có tính chất nào sau đây?',
    options: [
      { id: 'A', text: 'Chỉ đối xứng chứ không phản đối xứng' },
      { id: 'B', text: 'Chỉ phản đối xứng chứ không đối xứng' },
      { id: 'C', text: 'Vừa có tính đối xứng, vừa có tính phản đối xứng' },
      { id: 'D', text: 'Không đối xứng cũng không phản đối xứng' },
    ],
    correctId: 'C',
    explanation: 'Quan hệ đồng nhất Δ = {(a, a)}: R đối xứng vì (a, b) ∈ R ⇒ a=b ⇒ (b, a) ∈ R; R cũng phản đối xứng vì (a, b) ∈ R ∧ (b, a) ∈ R ⇒ a = b (mệnh đề luôn thỏa mãn). Đây là ví dụ kinh điển minh họa phản đối xứng KHÔNG PHẢI là phủ định của đối xứng.',
    actionLink: { view: 'relation', tab: 'properties' },
  },
  {
    id: 'rel_q06',
    topic: 'relation',
    topicName: 'Tính chất Bắc cầu',
    difficulty: 'easy',
    question: 'Cho tập A = {1, 2, 3} và quan hệ R = {(1, 2), (2, 3)}. Để quan hệ này có tính chất bắc cầu (Transitive), ta bắt buộc phải bổ sung thêm cặp nào?',
    options: [
      { id: 'A', text: 'Cặp (2, 1)' },
      { id: 'B', text: 'Cặp (3, 2)' },
      { id: 'C', text: 'Cặp (1, 3)' },
      { id: 'D', text: 'Cặp (3, 1)' },
    ],
    correctId: 'C',
    explanation: 'Tính chất bắc cầu quy định: Nếu (a, b) ∈ R và (b, c) ∈ R thì bắt buộc (a, c) ∈ R. Vì có (1, 2) và (2, 3) nên cần bổ sung cặp (1, 3).',
    actionLink: { view: 'relation', tab: 'properties' },
  },
  {
    id: 'rel_q07',
    topic: 'relation',
    topicName: 'Bao đóng quan hệ',
    difficulty: 'easy',
    question: 'Bao đóng phản xạ của quan hệ R trên tập A, ký hiệu r(R), được xác định bởi công thức nào sau đây?',
    options: [
      { id: 'A', text: 'R ∪ R⁻¹' },
      { id: 'B', text: 'R ∪ Δ_A (với Δ_A = {(x, x) | x ∈ A})' },
      { id: 'C', text: 'R ∩ Δ_A' },
      { id: 'D', text: 'R² = R ⊙ R' },
    ],
    correctId: 'B',
    explanation: 'Bao đóng phản xạ là quan hệ phản xạ nhỏ nhất chứa R. Nó thu được bằng cách hợp thêm tất cả các cặp đường chéo (x, x): r(R) = R ∪ Δ_A.',
    actionLink: { view: 'relation', tab: 'warshall' },
  },
  {
    id: 'rel_q08',
    topic: 'relation',
    topicName: 'Thuật toán Roy-Warshall',
    difficulty: 'medium',
    question: 'Thuật toán Roy-Warshall trong lý thuyết quan hệ được sử dụng nhằm mục đích chính nào?',
    options: [
      { id: 'A', text: 'Tìm bao đóng phản xạ' },
      { id: 'B', text: 'Tìm bao đóng đối xứng' },
      { id: 'C', text: 'Tìm bao đóng bắc cầu (Transitive Closure / Đường đi liên thông)' },
      { id: 'D', text: 'Tìm phần tử lớn nhất của POSET' },
    ],
    correctId: 'C',
    explanation: 'Thuật toán Roy-Warshall tính toán bao đóng bắc cầu của ma trận nhị phân qua n bước lặp trung gian k (k = 1..n), tương đương với tìm ma trận liên thông đường đi giữa mọi cặp đỉnh.',
    actionLink: { view: 'relation', tab: 'warshall' },
  },
  {
    id: 'rel_q09',
    topic: 'relation',
    topicName: 'Thuật toán Roy-Warshall',
    difficulty: 'medium',
    question: 'Với một tập hợp gồm n phần tử, thuật toán Roy-Warshall cập nhật bao đóng bắc cầu có độ phức tạp thời gian là bao nhiêu?',
    options: [
      { id: 'A', text: 'O(n)' },
      { id: 'B', text: 'O(n²)' },
      { id: 'C', text: 'O(n³)' },
      { id: 'D', text: 'O(2ⁿ)' },
    ],
    correctId: 'C',
    explanation: 'Thuật toán gồm 3 vòng lặp lồng nhau: vòng lặp ngoài duyệt k từ 1 đến n (đỉnh trung gian), và 2 vòng lặp trong duyệt mọi cặp hàng i, cột j từ 1 đến n. Tổng số phép toán là n × n × n = O(n³).',
    actionLink: { view: 'relation', tab: 'warshall' },
  },
  {
    id: 'rel_q10',
    topic: 'relation',
    topicName: 'Quan hệ Tương đương',
    difficulty: 'easy',
    question: 'Một quan hệ 2 ngôi R trên tập A được gọi là Quan hệ tương đương (Equivalence Relation) khi thỏa mãn đồng thời 3 tính chất nào?',
    options: [
      { id: 'A', text: 'Phản xạ, Đối xứng, Bắc cầu' },
      { id: 'B', text: 'Phản xạ, Phản đối xứng, Bắc cầu' },
      { id: 'C', text: 'Đối xứng, Phản đối xứng, Bắc cầu' },
      { id: 'D', text: 'Phản xạ, Đối xứng, Không bắc cầu' },
    ],
    correctId: 'A',
    explanation: 'Định nghĩa: Quan hệ tương đương là quan hệ thỏa mãn 3 tính chất: Phản xạ (Reflexive), Đối xứng (Symmetric) và Bắc cầu (Transitive). Ví dụ kinh điển là quan hệ bằng nhau (=) hoặc quan hệ đồng dư modulo m.',
    actionLink: { view: 'relation', tab: 'hasse' },
  },
  {
    id: 'rel_q11',
    topic: 'relation',
    topicName: 'Lớp tương đương & Modulo',
    difficulty: 'medium',
    question: 'Xét quan hệ đồng dư modulo 3 trên tập số nguyên ℤ: a R b ⇔ a ≡ b (mod 3). Tập thương ℤ/R gồm bao nhiêu lớp tương đương?',
    options: [
      { id: 'A', text: '1 lớp duy nhất' },
      { id: 'B', text: '2 lớp tương đương' },
      { id: 'C', text: '3 lớp tương đương: [0], [1], [2]' },
      { id: 'D', text: 'Vô số lớp tương đương' },
    ],
    correctId: 'C',
    explanation: 'Mọi số nguyên khi chia cho 3 chỉ có 3 số dư có thể: 0, 1 hoặc 2. Do đó tập các lớp tương đương gồm đúng 3 lớp: [0] = {3k}, [1] = {3k+1}, [2] = {3k+2}. Các lớp này tạo thành một phân hoạch của ℤ.',
    actionLink: { view: 'relation', tab: 'hasse' },
  },
  {
    id: 'rel_q12',
    topic: 'relation',
    topicName: 'Quan hệ Thứ tự & POSET',
    difficulty: 'easy',
    question: 'Một quan hệ thứ tự bộ phận (Partial Order) trên tập A đòi hỏi phải thỏa mãn bộ 3 tính chất nào?',
    options: [
      { id: 'A', text: 'Phản xạ, Đối xứng, Bắc cầu' },
      { id: 'B', text: 'Phản xạ, Phản đối xứng, Bắc cầu' },
      { id: 'C', text: 'Không phản xạ, Đối xứng, Bắc cầu' },
      { id: 'D', text: 'Phản đối xứng, Đối xứng, Bắc cầu' },
    ],
    correctId: 'B',
    explanation: 'Tập sắp thứ tự bộ phận (POSET - Partially Ordered Set) được định nghĩa bởi 3 tính chất: Phản xạ (Reflexive), Phản đối xứng (Antisymmetric) và Bắc cầu (Transitive). Ký hiệu (A, ≤).',
    actionLink: { view: 'relation', tab: 'hasse' },
  },
  {
    id: 'rel_q13',
    topic: 'relation',
    topicName: 'Biểu đồ Hasse',
    difficulty: 'medium',
    question: 'Trong Biểu đồ Hasse của một tập thứ tự bộ phận (POSET), quy tắc tối giản hóa nào sau đây được áp dụng?',
    options: [
      { id: 'A', text: 'Vẽ tất cả các khuyên phản xạ (x, x) ở mọi đỉnh' },
      { id: 'B', text: 'Lược bỏ khuyên phản xạ và lược bỏ các cạnh bắc cầu suy diễn được, chỉ giữ lại quan hệ phủ trực tiếp' },
      { id: 'C', text: 'Vẽ mũi tên theo cả hai chiều lên và xuống' },
      { id: 'D', text: 'Nối cạnh giữa tất cả các cặp đỉnh' },
    ],
    correctId: 'B',
    explanation: 'Biểu đồ Hasse tối giản đồ thị thứ tự bằng cách: (1) Bỏ mọi khuyên phản xạ (ngầm hiểu x ≤ x); (2) Bỏ các cạnh bắc cầu suy diễn được (nếu x ≤ y và y ≤ z thì không vẽ cạnh x → z); (3) Vẽ đỉnh lớn hơn ở trên đỉnh nhỏ hơn.',
    actionLink: { view: 'relation', tab: 'hasse' },
  },
  {
    id: 'rel_q14',
    topic: 'relation',
    topicName: 'Phần tử Tối đại vs Lớn nhất',
    difficulty: 'hard',
    question: 'Cho POSET (A, ≤). Điểm khác biệt căn bản giữa phần tử tối đại (Maximal element) và phần tử lớn nhất (Greatest element) là gì?',
    options: [
      { id: 'A', text: 'Phần tử tối đại luôn là duy nhất, còn phần tử lớn nhất có thể có nhiều phần tử' },
      { id: 'B', text: 'Phần tử tối đại là phần tử không có phần tử nào lớn hơn nó; còn phần tử lớn nhất phải lớn hơn hoặc bằng MỌI phần tử trong tập' },
      { id: 'C', text: 'Hai khái niệm này hoàn toàn tương đương nhau trong mọi POSET' },
      { id: 'D', text: 'Phần tử lớn nhất nằm ở đáy biểu đồ Hasse' },
    ],
    correctId: 'B',
    explanation: 'Trong POSET: a là tối đại nếu không tồn tại x sao cho a < x (có thể có nhiều phần tử tối đại). Còn a là phần tử lớn nhất nếu x ≤ a với MỌI x ∈ A (nếu tồn tại thì phần tử lớn nhất là duy nhất).',
    actionLink: { view: 'relation', tab: 'hasse' },
  },

  // =========================================================================
  // CHƯƠNG 5: LÝ THUYẾT ĐỒ THỊ & THUẬT TOÁN TỐI ƯU
  // =========================================================================
  {
    id: 'graph_q01',
    topic: 'graph',
    topicName: 'Đồ thị cơ bản',
    difficulty: 'easy',
    question: 'Một đơn đồ thị vô hướng có 5 đỉnh với bậc lần lượt là 2, 3, 3, 4, 4. Tổng số cạnh của đồ thị này là bao nhiêu?',
    options: [
      { id: 'A', text: '8 cạnh' },
      { id: 'B', text: '16 cạnh' },
      { id: 'C', text: '10 cạnh' },
      { id: 'D', text: '7 cạnh' },
    ],
    correctId: 'A',
    explanation: 'Theo Định lý bắt tay (Handshaking Lemma): Tổng bậc của tất cả các đỉnh bằng 2 lần số cạnh (Σ deg(v) = 2|E|). Tổng bậc = 2 + 3 + 3 + 4 + 4 = 16. Do đó số cạnh |E| = 16 / 2 = 8 cạnh.',
  },
  {
    id: 'graph_q02',
    topic: 'graph',
    topicName: 'Đồ thị cơ bản',
    difficulty: 'easy',
    question: 'Đơn đồ thị đầy đủ K₅ (5 đỉnh, mỗi cặp đỉnh đều có cạnh nối) có tất cả bao nhiêu cạnh?',
    options: [
      { id: 'A', text: '5 cạnh' },
      { id: 'B', text: '10 cạnh' },
      { id: 'C', text: '20 cạnh' },
      { id: 'D', text: '25 cạnh' },
    ],
    correctId: 'B',
    explanation: 'Số cạnh của đồ thị đầy đủ Kn được tính theo công thức tổ hợp C(n, 2) = n(n - 1) / 2. Với K₅, số cạnh là 5 × 4 / 2 = 10 cạnh.',
  },
  {
    id: 'graph_q03',
    topic: 'graph',
    topicName: 'Bậc của đỉnh',
    difficulty: 'medium',
    question: 'Trong bất kỳ đồ thị vô hướng nào, số lượng đỉnh có bậc lẻ luôn luôn là:',
    options: [
      { id: 'A', text: 'Một số lẻ' },
      { id: 'B', text: 'Một số chẵn' },
      { id: 'C', text: 'Một số chia hết cho 4' },
      { id: 'D', text: 'Tùy thuộc vào số đỉnh' },
    ],
    correctId: 'B',
    explanation: 'Vì tổng bậc tất cả các đỉnh bằng 2|E| (luôn là số chẵn), nên tổng bậc của các đỉnh bậc lẻ phải là số chẵn. Điều này suy ra số lượng đỉnh có bậc lẻ bắt buộc phải là một số chẵn.',
  },
  {
    id: 'graph_q04',
    topic: 'graph',
    topicName: 'Đồ thị phẳng & Euler',
    difficulty: 'medium',
    question: 'Theo công thức Euler cho một đơn đồ thị phẳng liên thông có V đỉnh, E cạnh và F miền mặt phẳng (faces), hệ thức nào sau đây luôn đúng?',
    options: [
      { id: 'A', text: 'V + E + F = 2' },
      { id: 'B', text: 'V - E + F = 2' },
      { id: 'C', text: 'V + E - F = 1' },
      { id: 'D', text: 'E = V + F' },
    ],
    correctId: 'B',
    explanation: 'Công thức Euler cho đồ thị phẳng liên thông: V - E + F = 2 (Đỉnh trừ Cạnh cộng Miền bằng 2). Đây là bất biến tôpô nền tảng của hình học phẳng.',
  },
  {
    id: 'graph_q05',
    topic: 'graph',
    topicName: 'Định lý Kuratowski',
    difficulty: 'hard',
    question: 'Theo Định lý Kuratowski, một đồ thị là đồ thị phẳng khi và chỉ khi nó không chứa đồ thị con đồng phôi (homeomorphic) với hai đồ thị cơ sở nào?',
    options: [
      { id: 'A', text: 'K₃ và K₄' },
      { id: 'B', text: 'K₅ (đồ thị đầy đủ 5 đỉnh) và K₃,₃ (đồ thị hai phía đầy đủ 3-3)' },
      { id: 'C', text: 'K₄ và C₅' },
      { id: 'D', text: 'Đồ thị Petersen' },
    ],
    correctId: 'B',
    explanation: 'Định lý Kuratowski (1930): Đồ thị là phẳng ⇔ không chứa đồ thị con đồng phôi với K₅ (đồ thị phi phẳng nhỏ nhất) hoặc K₃,₃ (bài toán 3 nhà 3 giếng).',
  },
  {
    id: 'euler_q01',
    topic: 'graph',
    topicName: 'Đồ thị Euler',
    difficulty: 'easy',
    question: 'Điều kiện cần và đủ để một đồ thị vô hướng liên thông có Chu trình Euler (Eulerian Circuit) là:',
    options: [
      { id: 'A', text: 'Mọi đỉnh đều có bậc lẻ' },
      { id: 'B', text: 'Có đúng 2 đỉnh bậc lẻ' },
      { id: 'C', text: 'Mọi đỉnh đều có bậc chẵn' },
      { id: 'D', text: 'Số đỉnh bằng số cạnh' },
    ],
    correctId: 'C',
    explanation: 'Định lý Euler khẳng định: Một đồ thị liên thông có chu trình Euler khi và chỉ khi mọi đỉnh của đồ thị đều có bậc chẵn (deg(v) là số chẵn với mọi v).',
    actionLink: { view: 'lab', algoKey: 'euler', preset: 'euler_circuit' },
  },
  {
    id: 'euler_q02',
    topic: 'graph',
    topicName: 'Đồ thị Euler',
    difficulty: 'medium',
    question: 'Một đồ thị liên thông có đúng 2 đỉnh bậc lẻ thì đồ thị đó có tính chất nào?',
    options: [
      { id: 'A', text: 'Có chu trình Euler' },
      { id: 'B', text: 'Có đường đi Euler (bắt đầu ở 1 đỉnh lẻ và kết thúc ở đỉnh lẻ còn lại)' },
      { id: 'C', text: 'Không có đường đi lẫn chu trình Euler' },
      { id: 'D', text: 'Là đồ thị hai phía' },
    ],
    correctId: 'B',
    explanation: 'Nếu đồ thị liên thông có đúng 2 đỉnh bậc lẻ, đồ thị có Đường đi Euler (Eulerian Trail) xuất phát từ một trong hai đỉnh lẻ đó và kết thúc ở đỉnh lẻ còn lại.',
    actionLink: { view: 'lab', algoKey: 'euler', preset: 'euler_path' },
  },
  {
    id: 'euler_q03',
    topic: 'graph',
    topicName: 'Thuật toán Fleury',
    difficulty: 'hard',
    question: 'Thuật toán Fleury dùng để xây dựng chu trình/đường đi Euler đưa ra nguyên tắc quan trọng nào khi lựa chọn cạnh tiếp theo để đi qua?',
    options: [
      { id: 'A', text: 'Luôn chọn cạnh có trọng số nhỏ nhất' },
      { id: 'B', text: 'Không bao giờ đi qua cạnh là CẦU (cạnh cắt liên thông) trừ khi không còn sự lựa chọn nào khác' },
      { id: 'C', text: 'Luôn ưu tiên đi qua đỉnh có bậc lớn nhất' },
      { id: 'D', text: 'Chỉ chọn các cạnh tạo thành chu trình con' },
    ],
    correctId: 'B',
    explanation: 'Nguyên tắc vàng của Fleury: "Đừng đốt cháy cầu nối phía sau bạn". Khi xóa cạnh đã đi qua, nếu cạnh đó là CẦU (làm đồ thị còn lại tách thành 2 thành phần liên thông), ta không được chọn nó trừ phi đó là cạnh duy nhất còn lại từ đỉnh hiện tại.',
    actionLink: { view: 'lab', algoKey: 'euler', preset: 'euler_circuit' },
  },
  {
    id: 'hamilton_q01',
    topic: 'graph',
    topicName: 'Đồ thị Hamilton',
    difficulty: 'medium',
    question: 'Điểm khác biệt cốt lõi giữa Chu trình Euler và Chu trình Hamilton là:',
    options: [
      { id: 'A', text: 'Euler đi qua mỗi đỉnh đúng 1 lần; Hamilton đi qua mỗi cạnh đúng 1 lần' },
      { id: 'B', text: 'Euler đi qua mỗi cạnh đúng 1 lần; Hamilton đi qua mỗi đỉnh (trừ đỉnh đầu/cuối) đúng 1 lần' },
      { id: 'C', text: 'Chu trình Hamilton chỉ áp dụng cho đồ thị có hướng' },
      { id: 'D', text: 'Chu trình Euler luôn dài hơn chu trình Hamilton' },
    ],
    correctId: 'B',
    explanation: 'Chu trình Euler tập trung vào cạnh: đi qua MỌI CẠNH đúng 1 lần. Chu trình Hamilton tập trung vào đỉnh: đi qua MỌI ĐỈNH đúng 1 lần rồi quay về đỉnh xuất phát.',
  },
  {
    id: 'hamilton_q02',
    topic: 'graph',
    topicName: 'Đồ thị Hamilton',
    difficulty: 'hard',
    question: 'Định lý Dirac: Đơn đồ thị vô hướng có n đỉnh (n ≥ 3) chắc chắn có chu trình Hamilton nếu bậc của mọi đỉnh thỏa mãn điều kiện nào?',
    options: [
      { id: 'A', text: 'deg(v) ≥ n / 2' },
      { id: 'B', text: 'deg(v) ≥ n - 1' },
      { id: 'C', text: 'deg(v) ≤ n / 2' },
      { id: 'D', text: 'deg(v) là số chẵn' },
    ],
    correctId: 'A',
    explanation: 'Định lý Dirac (1952): Nếu đơn đồ thị n đỉnh (n ≥ 3) có deg(v) ≥ n / 2 với mọi đỉnh v thì đồ thị đó là đồ thị Hamilton.',
  },
  {
    id: 'mst_q01',
    topic: 'graph',
    topicName: 'Cây khung nhỏ nhất',
    difficulty: 'easy',
    question: 'Một cây khung (Spanning Tree) của một đồ thị liên thông có n đỉnh sẽ có chính xác bao nhiêu cạnh?',
    options: [
      { id: 'A', text: 'n cạnh' },
      { id: 'B', text: 'n - 1 cạnh' },
      { id: 'C', text: 'n + 1 cạnh' },
      { id: 'D', text: '2n cạnh' },
    ],
    correctId: 'B',
    explanation: 'Theo định nghĩa cây trong lý thuyết đồ thị: Cây là đồ thị liên thông phi chu trình. Cây có n đỉnh luôn luôn chứa đúng n - 1 cạnh.',
  },
  {
    id: 'mst_q02',
    topic: 'graph',
    topicName: 'Thuật toán Kruskal',
    difficulty: 'medium',
    question: 'Thuật toán Kruskal xây dựng cây khung nhỏ nhất (MST) theo chiến lược nào sau đây?',
    options: [
      { id: 'A', text: 'Bắt đầu từ một đỉnh gốc, mở rộng dần tập đỉnh liên thông' },
      { id: 'B', text: 'Sắp xếp tất cả các cạnh theo trọng số tăng dần, lần lượt chọn cạnh nhỏ nhất không tạo thành chu trình' },
      { id: 'C', text: 'Xóa dần các cạnh có trọng số lớn nhất cho đến khi đồ thị hết chu trình' },
      { id: 'D', text: 'Duyệt theo chiều rộng (BFS)' },
    ],
    correctId: 'B',
    explanation: 'Thuật toán Kruskal sắp xếp toàn bộ cạnh theo trọng số không giảm. Sau đó dùng cấu trúc tập rời rạc (Disjoint Set Union) để nạp từng cạnh nhỏ nhất mà không tạo chu trình cho tới khi đủ n - 1 cạnh.',
    actionLink: { view: 'lab', algoKey: 'kruskal', preset: 'building' },
  },
  {
    id: 'mst_q03',
    topic: 'graph',
    topicName: 'Thuật toán Prim',
    difficulty: 'medium',
    question: 'Thuật toán Prim khác với thuật toán Kruskal ở điểm mấu chốt nào trong quá trình thực thi?',
    options: [
      { id: 'A', text: 'Prim chỉ áp dụng cho đồ thị có hướng' },
      { id: 'B', text: 'Cây con của Prim luôn duy trì tính liên thông ở mọi bước mở rộng, trong khi Kruskal có thể tạo ra một rừng các cụm rời rạc' },
      { id: 'C', text: 'Prim cho kết quả tổng trọng số nhỏ hơn Kruskal' },
      { id: 'D', text: 'Kruskal dùng hàng đợi ưu tiên còn Prim không dùng' },
    ],
    correctId: 'B',
    explanation: 'Tại mỗi bước trung gian, thuật toán Prim luôn mở rộng một cây liên thông duy nhất từ tập đỉnh đã xét. Trong khi đó, Kruskal gom các cạnh độc lập nên có thể chứa nhiều cây con rời rạc trước khi nối lại ở bước cuối.',
    actionLink: { view: 'lab', algoKey: 'prim', preset: 'prim_slide' },
  },
  {
    id: 'dijkstra_q01',
    topic: 'graph',
    topicName: 'Thuật toán Dijkstra',
    difficulty: 'easy',
    question: 'Điều kiện tiên quyết để thuật toán Dijkstra đảm bảo tìm được đường đi ngắn nhất chính xác là gì?',
    options: [
      { id: 'A', text: 'Đồ thị phải là đồ thị phẳng' },
      { id: 'B', text: 'Trọng số của tất cả các cạnh phải không âm (w(e) ≥ 0)' },
      { id: 'C', text: 'Đồ thị phải là đồ thị có hướng phi chu trình (DAG)' },
      { id: 'D', text: 'Mọi đỉnh phải có bậc chẵn' },
    ],
    correctId: 'B',
    explanation: 'Thuật toán Dijkstra dựa trên chiến lược tham lam (Greedy): một khi đỉnh đã được "chốt nhãn tối ưu", khoảng cách của nó sẽ không đổi. Nếu có cạnh trọng số âm, giả định này bị phá vỡ và Dijkstra có thể cho kết quả sai (khi đó phải dùng Bellman-Ford).',
    actionLink: { view: 'lab', algoKey: 'dijkstra', preset: 'building' },
  },
  {
    id: 'dijkstra_q02',
    topic: 'graph',
    topicName: 'Thuật toán Dijkstra',
    difficulty: 'hard',
    question: 'Nếu triển khai thuật toán Dijkstra sử dụng Cấu trúc dữ liệu Min-Heap (Binary Heap), độ phức tạp thời gian của thuật toán với V đỉnh và E cạnh là bao nhiêu?',
    options: [
      { id: 'A', text: 'O(V²)' },
      { id: 'B', text: 'O((V + E) log V)' },
      { id: 'C', text: 'O(V × E)' },
      { id: 'D', text: 'O(2^V)' },
    ],
    correctId: 'B',
    explanation: 'Khi dùng Min-Heap (như MinHeap.js trong dự án), mỗi thao tác trích xuất đỉnh nhỏ nhất mất O(log V) và mỗi thao tác cập nhật nhãn khoảng cách cạnh (relax) mất O(log V). Tổng thời gian đạt O((V + E) log V).',
    actionLink: { view: 'lab', algoKey: 'dijkstra', preset: 'building' },
  },
  {
    id: 'dijkstra_q03',
    topic: 'graph',
    topicName: 'Thuật toán Dijkstra',
    difficulty: 'medium',
    question: 'Trong bước duyệt các đỉnh kề của đỉnh u đang xét, phép toán "nới lỏng cạnh" (relax) giữa u và v với trọng số w(u, v) thực hiện kiểm tra điều kiện nào?',
    options: [
      { id: 'A', text: 'Nếu d[u] + w(u, v) < d[v] thì d[v] = d[u] + w(u, v) và p[v] = u' },
      { id: 'B', text: 'Nếu d[u] > d[v] + w(u, v) thì d[u] = d[v] + w(u, v)' },
      { id: 'C', text: 'Nếu w(u, v) < d[v] thì gán d[v] = w(u, v)' },
      { id: 'D', text: 'Nếu d[v] == 0 thì cập nhật d[v] = d[u]' },
    ],
    correctId: 'A',
    explanation: 'Nguyên lý nới lỏng (Relaxation): Nếu đường đi từ nguồn s qua u rồi đến v có tổng chi phí d[u] + w(u, v) nhỏ hơn kỷ lục hiện tại d[v], ta lập tức cập nhật d[v] mới và ghi nhận u là đỉnh đi trước v (p[v] = u).',
    actionLink: { view: 'lab', algoKey: 'dijkstra', preset: 'building' },
  },
];

/**
 * Procedurally generates a custom examination paper tailored to requirements.
 * 
 * @param {Object} options
 * @param {number} [options.count=5] - Number of questions (5, 10, 15, 20)
 * @param {'all'|'logic'|'counting'|'relation'|'graph'} [options.topic='all']
 * @param {'all'|'easy'|'medium'|'hard'} [options.difficulty='all']
 * @returns {Object} Exam model with questions, answer key, and metadata
 */
export function generateExamPaper(options = {}) {
  const {
    count = 5,
    topic = 'all',
    difficulty = 'all',
  } = options;

  let pool = [...STATIC_QUESTION_BANK];

  if (topic !== 'all') {
    pool = pool.filter(q => q.topic === topic);
  }

  if (difficulty !== 'all') {
    pool = pool.filter(q => q.difficulty === difficulty);
  }

  // If pool is smaller than count, include other questions to fulfill count
  if (pool.length < count) {
    const remaining = STATIC_QUESTION_BANK.filter(q => !pool.some(p => p.id === q.id));
    pool = pool.concat(remaining);
  }

  // Shuffle array using Fisher-Yates
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selectedQuestions = shuffled.slice(0, Math.min(count, shuffled.length));

  // Generate unique Exam Code (e.g. 102, 205, 301)
  const examCode = Math.floor(100 + Math.random() * 900);

  // Build Answer Key map: { 1: 'B', 2: 'C', ... }
  const answerKey = {};
  selectedQuestions.forEach((q, idx) => {
    answerKey[idx + 1] = q.correctId;
  });

  return {
    examCode,
    topic,
    difficulty,
    createdAt: new Date().toLocaleDateString('vi-VN'),
    totalQuestions: selectedQuestions.length,
    questions: selectedQuestions,
    answerKey,
  };
}

/**
 * Exports an examination paper into clean, standard LaTeX format.
 * Suitable for university exam papers (amsmath, geometry, enumerate).
 * 
 * @param {Object} exam
 * @returns {string} LaTeX source code
 */
export function exportExamToLatex(exam) {
  let latex = `% ==========================================================================\n`;
  latex += `% ĐỀ THI TRẮC NGHIỆM MÔN TOÁN RỜI RẠC & CẤU TRÚC RỜI RẠC\n`;
  latex += `% Mã đề: ${exam.examCode} — Ngày tạo: ${exam.createdAt}\n`;
  latex += `% Nền tảng: Graph Algorithms & Logic Platform (EdTech Interactive Suite)\n`;
  latex += `% ==========================================================================\n\n`;

  latex += `\\documentclass[12pt,a4paper]{article}\n`;
  latex += `\\usepackage[utf8]{inputenc}\n`;
  latex += `\\usepackage[vietnamese]{babel}\n`;
  latex += `\\usepackage{amsmath,amssymb,amsfonts}\n`;
  latex += `\\usepackage{geometry}\n`;
  latex += `\\geometry{left=2cm,right=2cm,top=2cm,bottom=2cm}\n`;
  latex += `\\usepackage{enumerate}\n`;
  latex += `\\usepackage{multicol}\n\n`;

  latex += `\\begin{document}\n\n`;

  // Header Box
  latex += `\\noindent\n`;
  latex += `\\begin{tabular}{@{}p{8.5cm}p{8.5cm}@{}}\n`;
  latex += `  \\textbf{TRƯỜNG ĐẠI HỌC ...........................} & \\textbf{ĐỀ THI MÔN: TOÁN RỜI RẠC} \\\\\n`;
  latex += `  \\textbf{KHOA CÔNG NGHỆ THÔNG TIN} & \\textbf{Thời gian làm bài:} 45 phút \\\\\n`;
  latex += `  \\textit{Họ và tên thí sinh:} .................................... & \\textbf{MÃ ĐỀ THI: ${exam.examCode}} \\\\\n`;
  latex += `  \\textit{Mã số sinh viên (MSSV):} ........................... & \\textit{Lớp:} .................................... \\\\\n`;
  latex += `\\end{tabular}\n\n`;
  latex += `\\vspace{0.3cm}\n`;
  latex += `\\hrule height 1pt\n`;
  latex += `\\vspace{0.4cm}\n\n`;

  // Questions
  latex += `\\section*{PHẦN CÂU HỎI TRẮC NGHIỆM (${exam.totalQuestions} CÂU)}\n\n`;
  latex += `\\begin{enumerate}[\\bfseries Câu 1:]\n`;

  exam.questions.forEach((q) => {
    latex += `  \\item ${q.question}\n`;
    latex += `  \\begin{multicols}{2}\n`;
    latex += `  \\begin{enumerate}[A.]\n`;
    q.options.forEach((opt) => {
      latex += `    \\item ${opt.text}\n`;
    });
    latex += `  \\end{enumerate}\n`;
    latex += `  \\end{multicols}\n\n`;
  });

  latex += `\\end{enumerate}\n\n`;

  // Page break for Teacher Answer Key
  latex += `\\newpage\n`;
  latex += `\\section*{ĐÁP ÁN & HƯỚNG DẪN CHẤM (DÀNH CHO GIẢNG VIÊN - MÃ ĐỀ: ${exam.examCode})}\n\n`;

  // Fast Answer Grid Table
  latex += `\\subsection*{1. Bảng Đáp Án Nhanh}\n`;
  latex += `\\begin{center}\n`;
  latex += `\\begin{tabular}{|${exam.questions.map(() => 'c|').join('')}}\n\\hline\n`;
  latex += `\\textbf{Câu} & ${exam.questions.map((_, i) => `\\textbf{${i + 1}}`).join(' & ')} \\\\\n\\hline\n`;
  latex += `\\textbf{Đáp án} & ${exam.questions.map((q) => `\\textbf{${q.correctId}}`).join(' & ')} \\\\\n\\hline\n`;
  latex += `\\end{tabular}\n`;
  latex += `\\end{center}\n\n`;

  // Detailed Explanations
  latex += `\\subsection*{2. Hướng Dẫn Lời Giải Chi Tiết}\n`;
  latex += `\\begin{enumerate}[\\bfseries Câu 1:]\n`;
  exam.questions.forEach((q) => {
    latex += `  \\item \\textbf{Đáp án ${q.correctId}.} ${q.explanation}\n\n`;
  });
  latex += `\\end{enumerate}\n\n`;

  latex += `\\end{document}\n`;

  return latex;
}
