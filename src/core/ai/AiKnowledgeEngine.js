/**
 * @file AiKnowledgeEngine.js
 * Intelligent Academic Reasoning & Lab Bridge Engine for Discrete Mathematics.
 * 
 * Features:
 * 1. Rich academic domain knowledge across all 4 university chapters:
 *    - Logic Lab: Propositional logic, Truth tables, Karnaugh maps (2-4 vars), Digital circuits
 *    - Counting Lab: Combinatorics, Dirichlet pigeonhole principle, Pascal triangle, Linear recurrence
 *    - Relation Lab: Binary relations, 5 core properties, Equivalence & Poset/Hasse, Warshall closures
 *    - Graph Lab: Dijkstra shortest path, Prim & Kruskal MST, Euler cycle/path, Hamilton graph
 * 2. Deep "Lab Bridge" action generator: Automatically packages runnable datasets and links directly into Labs!
 * 3. Gemini API Client integration with seamless offline fallback to the Smart Local Engine.
 */

export class AiKnowledgeEngine {
  constructor() {
    this.history = [];
  }

  /**
   * Processes a user question or prompt.
   * @param {string} prompt - User message text
   * @param {Object} [options={}]
   * @param {string} [options.mode='bridge'] - 'bridge' | 'theory' | 'hint'
   * @param {string} [options.apiKey=''] - Optional Gemini API key
   * @param {string} [options.model='gemini-1.5-flash']
   * @returns {Promise<{ text: string, labAction?: Object, isFromApi: boolean }>}
   */
  async ask(prompt, options = {}) {
    const { mode = 'bridge', apiKey = '', model = 'gemini-3.8-flash' } = options;
    const cleanPrompt = (prompt || '').trim();

    if (!cleanPrompt) {
      return {
        text: 'Xin chào! Bạn có thể đặt câu hỏi về bất kỳ chủ đề Toán Rời Rạc nào (Logic, Phép đếm, Quan hệ, Đồ thị), hoặc yêu cầu tôi tạo bài toán để thực nghiệm ngay trên các phòng Lab.',
        isFromApi: false,
      };
    }

    // 1. Try Gemini API if client explicit key is present
    if (apiKey) {
      try {
        const apiResponse = await this._callGeminiApi(cleanPrompt, apiKey, model, mode);
        if (apiResponse && apiResponse.text) {
          return {
            text: apiResponse.text,
            labAction: apiResponse.labAction || this._detectLabActionFallback(cleanPrompt),
            isFromApi: true,
          };
        }
      } catch (err) {
        console.warn('Client Gemini API query failed, falling back to server/local engine:', err);
      }
    }

    // 2. Try Backend Serverless AI (/api/ai/chat) which has Vercel GEMINI_API_KEY
    try {
      const serverResponse = await this._callServerAiChat(cleanPrompt, mode, model);
      if (serverResponse && serverResponse.text) {
        return {
          text: serverResponse.text,
          labAction: serverResponse.labAction || this._detectLabActionFallback(cleanPrompt),
          isFromApi: true,
        };
      }
    } catch {}

    // 3. Fallback: Smart Local Knowledge Engine
    const localResult = this._solveLocally(cleanPrompt, mode);
    return {
      text: localResult.text,
      labAction: localResult.labAction,
      isFromApi: false,
    };
  }

  /**
   * Calls the backend server AI chat endpoint if reachable.
   * @param {string} prompt
   * @param {string} mode
   * @param {string} model
   * @returns {Promise<{ text: string, labAction: Object|null }|null>}
   */
  async _callServerAiChat(prompt, mode, model) {
    if (typeof fetch === 'undefined') return null;
    const candidates = ['/api/ai/chat'];
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      const port = window.location.port;
      if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000') {
        candidates.push('http://localhost:3000/api/ai/chat');
      }
    }

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode, model }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.text) {
            return {
              text: data.text,
              labAction: data.labAction || null,
            };
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Calls Google Gemini API with Discrete Math Teacher System Instructions.
   */
  async _callGeminiApi(prompt, apiKey, model, mode) {
    const systemInstruction = `
Bạn là Trợ lý AI Chuyên gia Giảng dạy & Thực nghiệm môn Toán Rời Rạc (Discrete Mathematics) cấp Đại học.
Mục tiêu của bạn:
1. Giải thích cặn kẽ, chính xác về mặt toán học, sử dụng các ký hiệu rõ ràng: p ∧ q, p ∨ q, p → q, ¬p, C(n,k), A(n,k), M_R, v.v.
2. Trình bày bài giải rõ ràng theo từng bước (Step-by-step reasoning).
3. ĐẶC BIỆT (TÍNH NĂNG LAB BRIDGE):
Nếu câu hỏi của người dùng liên quan đến 1 trong 4 phòng lab sau đây, hãy đính kèm ở CUỐI CÙNG phản hồi một khối JSON độc lập (bọc trong \`\`\`json ... \`\`\`) với định dạng:
{
  "labAction": {
    "type": "logic" | "counting" | "relation" | "graph",
    "title": "Tên bài toán / Đồ thị",
    "subtab": "table" | "kmap" | "circuit" (nếu là logic) HOẶC "mapping" | "dirichlet" | "pascal" | "recurrence" (nếu là counting) HOẶC "matrix" | "properties" | "warshall" | "hasse" (nếu là relation),
    "algo": "dijkstra" | "prim" | "kruskal" | "euler" | "hamilton" (nếu là graph),
    "expr": "(p -> q) & r" (nếu là logic),
    "graphSpec": { "directed": false, "weighted": true, "nodes": [{"id":"A"}, {"id":"B"}], "edges": [{"from":"A","to":"B","weight":5}] } (nếu là graph)
  }
}
Chế độ phản hồi hiện tại: ${mode === 'hint' ? 'Gợi ý từng bước (không giải hộ toàn bộ ngay)' : mode === 'theory' ? 'Giải thích lý thuyết sâu sắc' : 'Gia sư thực nghiệm (kèm dữ liệu nạp vào Lab)'}.
`;

    const candidateModels = Array.from(new Set([model, 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-pro-latest']));
    let lastError = null;

    for (const candModel of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: prompt }] },
            ],
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Parse labAction JSON block if present
          let labAction = null;
          let cleanText = candidateText;

          const jsonMatch = candidateText.match(/```json\s*(\{[\s\S]*?"labAction"[\s\S]*?\})\s*```/i);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed.labAction) {
                labAction = parsed.labAction;
                cleanText = candidateText.replace(jsonMatch[0], '').trim();
              }
            } catch {
              // Ignore json parse error and keep text
            }
          }

          return { text: cleanText, labAction };
        } else {
          const errBody = await res.text();
          lastError = new Error(`Gemini API error [${res.status}]: ${errBody}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('Không thể kết nối đến Gemini API.');
  }

  /**
   * Local Academic Knowledge Engine with pattern matching and step-by-step reasoning.
   */
  _solveLocally(prompt, mode) {
    const q = prompt.toLowerCase();

    // -----------------------------------------------------------------------
    // SPECIALIZED TOPICS: THEORY & HINT MODES
    // -----------------------------------------------------------------------
    // 0.1 DIJKSTRA NEGATIVE WEIGHT TRAP (HINT / THEORY)
    if ((q.includes('bẫy') || q.includes('âm') || q.includes('thất bại')) && q.includes('dijkstra')) {
      return {
        text: `### 🌐 Bẫy Trọng Số Âm Trong Thuật Toán Dijkstra

**1. Tại sao Dijkstra thất bại khi có cạnh trọng số âm?**
- Bản chất của Dijkstra là thuật toán **Tham lam (Greedy)**: Nó dựa trên giả định rằng khi một đỉnh $u$ được lấy ra khỏi hàng đợi ưu tiên (đã hoàn thành - *settled*), khoảng cách $d[u]$ của nó đã là **tối ưu tuyệt đối** và sẽ không bao giờ giảm thêm.
- Giả định này chỉ đúng khi mọi cạnh đều có trọng số không âm ($w \\ge 0$). Khi có cạnh âm, một đường đi vòng qua nhiều đỉnh nhưng có cạnh âm lớn có thể có tổng trọng số nhỏ hơn, nhưng đỉnh đó đã bị đóng nhãn và không được cập nhật lại!

**2. Phản ví dụ kinh điển (3 đỉnh):**
- Đồ thị có 3 đỉnh $A, B, C$:
  - Cạnh $A \\to B$ trọng số $2$
  - Cạnh $A \\to C$ trọng số $5$
  - Cạnh $B \\to C$ trọng số $-4$
- **Dijkstra thực thi:**
  1. Ban đầu: $d[A]=0, d[B]=\\infty, d[C]=\\infty$.
  2. Xét đỉnh $A$: cập nhật $d[B]=2, d[C]=5$. Đỉnh $A$ hoàn tất.
  3. Lấy đỉnh $B$ ($d[B]=2$ nhỏ nhất): cập nhật $d[C] = \\min(5, 2 + (-4)) = -2$. Đỉnh $B$ hoàn tất.
  4. Nếu đỉnh $C$ đã được lấy ra trước đó (ví dụ trong đồ thị lớn), nhãn của $C$ sẽ không bao giờ được sửa, dẫn đến kết quả sai!

**3. Giải pháp khắc phục:**
- Dùng **Thuật toán Bellman-Ford**: Độ phức tạp $O(V \\cdot E)$, chạy đúng với trọng số âm và phát hiện được chu trình âm (*Negative Cycle*).
- Dùng **Thuật toán Floyd-Warshall**: Tìm mọi cặp đường đi ngắn nhất với độ phức tạp $O(V^3)$.`,
        labAction: {
          type: 'graph',
          title: 'Thuật toán Dijkstra & Bellman-Ford',
          algo: 'dijkstra',
        },
      };
    }

    // 0.2 DNF vs CNF CANONICAL FORMS (THEORY)
    if (q.includes('dnf') || q.includes('cnf') || q.includes('chuẩn tắc')) {
      return {
        text: `### ⚡ Dạng Chuẩn Tắc Tuyển (DNF) vs Chuẩn Tắc Hội (CNF)

**1. Định nghĩa chuẩn mực:**
- **Minterm (Tiểu hạng):** Một tích logic của tất cả các biến (dưới dạng biến hoặc phủ định của nó). Minterm $m_i$ nhận giá trị $1$ tại đúng một tổ hợp biến.
- **Maxterm (Đại hạng):** Một tổng logic của tất cả các biến. Maxterm $M_i$ nhận giá trị $0$ tại đúng một tổ hợp biến.
- **DNF (Disjunctive Normal Form - Chuẩn tắc tuyển):** Tổng của các tích:
  $$f = \\sum m(i_1, i_2, \\dots, i_k) = m_1 \\lor m_2 \\lor \\dots \\lor m_k$$
- **CNF (Conjunctive Normal Form - Chuẩn tắc hội):** Tích của các tổng:
  $$f = \\prod M(j_1, j_2, \\dots, j_m) = M_1 \\land M_2 \\land \\dots \\land M_m$$

**2. Định lý biểu diễn hàm Boole:**
- Mọi hàm Boole đều có thể biểu diễn một cách **duy nhất** dưới dạng chuẩn tắc tuyển chính tắc (Canonical DNF) và chuẩn tắc hội chính tắc (Canonical CNF).
- **Mối liên hệ đối ngẫu:** Các chỉ số không xuất hiện trong DNF của $f$ chính là các chỉ số xuất hiện trong CNF của $f$:
  $$\\{j_1, \\dots, j_m\\} = \\{0, 1, \\dots, 2^n - 1\\} \\setminus \\{i_1, \\dots, i_k\\}$$

**3. Phương pháp chuyển đổi đại số:**
- Từ bảng chân trị: Các dòng có kết quả $1$ cho ta các Minterm của DNF; các dòng có kết quả $0$ cho ta các Maxterm của CNF.
- Dùng luật phân phối và De Morgan để biến đổi trực tiếp giữa DNF và CNF.`,
        labAction: {
          type: 'logic',
          title: 'Bảng chân trị & Dạng chuẩn tắc',
          subtab: 'table',
          expr: '(p & q) | (~p & r)',
        },
      };
    }

    // 0.3 FUNCTIONAL COMPLETENESS (THEORY)
    if (q.includes('đầy đủ') && (q.includes('hàm') || q.includes('chức năng') || q.includes('nand'))) {
      return {
        text: `### ⚡ Tính Đầy Đủ Chức Năng (Functional Completeness) trong Logic Mệnh Đề

**1. Khái niệm:**
- Một tập các liên từ logic $S$ được gọi là **đầy đủ chức năng (functionally complete)** nếu mọi hàm Boole đều có thể biểu diễn chỉ bằng các liên từ thuộc $S$.

**2. Các tập liên từ kinh điển:**
- Tập cơ bản: $\\{\\neg, \\land, \\lor\\}$ (theo định lý DNF/CNF).
- Tập tối thiểu: $\\{\\neg, \\land\\}$ hoặc $\\{\\neg, \\lor\\}$ (vì $p \\lor q \\equiv \\neg(\\neg p \\land \\neg q)$ theo luật De Morgan).
- **Tập đơn phần tử (Cổng vạn năng):**
  - Cổng **NAND** (Ký hiệu Sheffer stroke $|$):
    - $\\neg p \\equiv p \\text{ NAND } p$
    - $p \\land q \\equiv (p \\text{ NAND } q) \\text{ NAND } (p \\text{ NAND } q)$
    - $p \\lor q \\equiv (p \\text{ NAND } p) \\text{ NAND } (q \\text{ NAND } q)$
  - Cổng **NOR** (Ký hiệu Peirce arrow $\\downarrow$): Cũng là cổng vạn năng tương tự.

**3. Định lý Post (Emil Post 1941):**
Một tập hợp các phép toán là đầy đủ hàm khi và chỉ khi nó không là tập con của bất kỳ lớp nào trong 5 lớp đóng sau:
1. Bảo toàn giá trị 0 ($T_0$)
2. Bảo toàn giá trị 1 ($T_1$)
3. Tự đối ngẫu ($S$)
4. Đơn điệu ($M$)
5. Tuyến tính ($L$)`,
        labAction: {
          type: 'logic',
          title: 'Mạch logic với cổng NAND',
          subtab: 'circuit',
          expr: '~(a & b)',
        },
      };
    }

    // 0.4 DIRAC & ORE THEOREMS (THEORY)
    if (q.includes('dirac') || q.includes('ore')) {
      return {
        text: `### 🌐 Định lý Dirac & Định lý Ore về Chu trình Hamilton

**1. Định lý Dirac (Gabriel Andrew Dirac - 1952):**
- **Phát biểu:** Cho đồ thị đơn vô hướng $G = (V, E)$ có $n \\ge 3$ đỉnh. Nếu mọi đỉnh $v \\in V$ đều thỏa mãn:
  $$\\deg(v) \\ge \\frac{n}{2}$$
  thì đồ thị $G$ có ít nhất một chu trình Hamilton.
- **Ý nghĩa:** Đây là điều kiện đủ quan trọng dựa trên bậc tối thiểu của đồ thị $\\delta(G) \\ge n/2$.

**2. Định lý Ore (Øystein Ore - 1960):**
- **Phát biểu:** Cho đồ thị đơn vô hướng $G = (V, E)$ có $n \\ge 3$ đỉnh. Nếu với mọi cặp đỉnh $u, v$ không kề nhau ($u \\ne v$ và $(u, v) \\notin E$), ta đều có:
  $$\\deg(u) + \\deg(v) \\ge n$$
  thì đồ thị $G$ có chu trình Hamilton.
- **Mối liên hệ:** Định lý Ore là dạng tổng quát hóa của định lý Dirac (vì nếu $\\deg(u) \\ge n/2$ và $\\deg(v) \\ge n/2$ thì hiển nhiên $\\deg(u) + \\deg(v) \\ge n$).

**3. Lưu ý quan trọng khi làm bài:**
- Cả Dirac và Ore đều chỉ là **điều kiện đủ**, không phải điều kiện cần!
- Một đồ thị không thỏa mãn Dirac hay Ore vẫn có thể có chu trình Hamilton (ví dụ: đồ thị chu trình đơn $C_n$ với mọi đỉnh bậc 2 có chu trình Hamilton nhưng chỉ thỏa mãn Dirac khi $n \\le 4$).`,
        labAction: {
          type: 'graph',
          title: 'Đồ thị kiểm chứng Hamilton',
          algo: 'hamilton',
        },
      };
    }

    // 0.5 CUT PROPERTY OF MST (THEORY)
    if (q.includes('vết cắt') || q.includes('cut property')) {
      return {
        text: `### 🌐 Tính Chất Vết Cắt (Cut Property) của Cây Khung Nhỏ Nhất (MST)

**1. Định nghĩa Lát cắt (Cut):**
- Một lát cắt $(S, V \\setminus S)$ trong đồ thị $G = (V, E)$ là sự phân hoạch tập đỉnh $V$ thành hai tập con rời nhau $S$ và $V \\setminus S$.
- Một cạnh $(u, v)$ được gọi là **băng qua lát cắt (cross the cut)** nếu $u \\in S$ và $v \\in V \\setminus S$.

**2. Định lý Tính chất Vết cắt (The Cut Property):**
- **Phát biểu:** Với mọi lát cắt $(S, V \\setminus S)$ của đồ thị liên thông có trọng số $G$, nếu cạnh $e$ là cạnh có **trọng số nhỏ nhất** băng qua lát cắt đó, thì luôn tồn tại một cây khung nhỏ nhất (MST) của $G$ chứa cạnh $e$. Nếu trọng số cạnh $e$ là nhỏ nhất duy nhất, thì mọi MST đều phải chứa $e$.

**3. Ý nghĩa đối với thuật toán Prim và Kruskal:**
- **Thuật toán Prim:** Tại mỗi bước, đặt $S$ là tập các đỉnh đã kết nạp vào cây. Thuật toán chọn cạnh nhẹ nhất băng qua lát cắt $(S, V \\setminus S)$. Theo Cut Property, cạnh này luôn an toàn để thêm vào MST.
- **Thuật toán Kruskal:** Khi xét cạnh nhẹ nhất $(u, v)$ kết nối 2 thành phần liên thông, cạnh này chính là cạnh nhẹ nhất băng qua lát cắt ngăn cách thành phần của $u$ với phần còn lại của đồ thị.`,
        labAction: {
          type: 'graph',
          title: 'Mô phỏng Cut Property MST',
          algo: 'prim',
        },
      };
    }

    // 0.6 LATTICE & ADVANCED POSET (THEORY)
    if (q.includes('lưới') || q.includes('lattice')) {
      return {
        text: `### 🔄 Cấu Trúc Lưới (Lattice) trong Thứ Tự Bộ Phận (Poset)

**1. Định nghĩa Lưới (Lattice):**
- Một tập sắp thứ tự bộ phận $(P, \\le)$ được gọi là một **Lưới (Lattice)** nếu với mọi cặp phần tử $a, b \\in P$, luôn tồn tại:
  1. **Chặn trên nhỏ nhất (Least Upper Bound - LUB / Supremum):** Ký hiệu là $a \\lor b$ (*Join*).
  2. **Chặn dưới lớn nhất (Greatest Lower Bound - GLB / Infimum):** Ký hiệu là $a \\land b$ (*Meet*).

**2. Các ví dụ kinh điển:**
- **Tập số thực $(\\mathbb{R}, \\le)$:** Là một lưới tuyến tính với $a \\lor b = \\max(a, b)$ và $a \\land b = \\min(a, b)$.
- **Tập lũy thừa $(\\mathcal{P}(S), \\subseteq)$:** Là một lưới Boole với $A \\lor B = A \\cup B$ và $A \\land B = A \\cap B$.
- **Quan hệ chia hết $(\\mathbb{Z}^+, \\mid)$:** Là một lưới với $a \\lor b = \\text{BCNN}(a, b)$ và $a \\land b = \\text{UCLN}(a, b)$.

**3. Phân biệt Phần tử Tối đại (Maximal) vs Lớn nhất (Greatest):**
- **Phần tử tối đại (Maximal element) $m$:** Không có phần tử nào lớn hơn nó (nếu $m \\le x$ thì $x = m$). Một Poset có thể có nhiều phần tử tối đại.
- **Phần tử lớn nhất (Greatest element) $M$:** Lớn hơn hoặc bằng mọi phần tử khác ($\\forall x, x \\le M$). Nếu tồn tại, phần tử lớn nhất là duy nhất.`,
        labAction: {
          type: 'relation',
          title: 'Biểu đồ Hasse & Lưới Quan hệ chia hết',
          subtab: 'hasse',
        },
      };
    }

    // 0.7 K-MAP GROUPING HINTS (HINT)
    if (q.includes('mẹo') && (q.includes('kmap') || q.includes('khoanh') || q.includes('bìa'))) {
      return {
        text: `### ⚡ Mẹo Khoanh Nhóm Bìa Karnaugh (K-Map) 4 Biến Không Bị Lỗi

**1. Các nguyên tắc vàng cần nhớ khi đi thi:**
1. **Quy tắc lũy thừa của 2:** Kích thước nhóm BẮT BUỘC là $1, 2, 4, 8, 16$. Tuyệt đối không được khoanh nhóm 3, 5 hay 6 ô!
2. **Ưu tiên kích thước tối đại:** Nhóm càng lớn thì biểu thức càng gọn (Nhóm 16 ô $\\to$ hằng số 1; Nhóm 8 ô $\\to$ 1 biến; Nhóm 4 ô $\\to$ 2 biến; Nhóm 2 ô $\\to$ 3 biến; Nhóm 1 ô $\\to$ 4 biến).
3. **Mẹo bọc biên (Wrap-around):**
   - 4 góc của bìa 4 biến $(m_0, m_2, m_8, m_{10})$ luôn gom thành 1 nhóm 4 ô rất gọn: $\\overline{B} \\cdot \\overline{D}$.
   - Hàng đầu tiên ($00$) và hàng cuối cùng ($10$) liền kề nhau.
   - Cột ngoài cùng bên trái ($00$) và cột ngoài cùng bên phải ($10$) liền kề nhau.

**2. Cách tránh nhóm dư thừa (Redundant Implicants):**
- **Bước 1:** Tìm các ô 1 "cô đơn" (chỉ có duy nhất 1 cách gom nhóm). Những nhóm này gọi là **Tế bào nguyên tố cốt yếu (Essential Prime Implicants)** – bắt buộc phải khoanh trước.
- **Bước 2:** Sau khi khoanh các nhóm cốt yếu, kiểm tra xem còn ô 1 nào chưa được bao phủ không. Nếu còn, chỉ khoanh thêm nhóm lớn nhất chứa các ô đó.
- **Bước 3:** Kiểm tra lại từng nhóm: Nếu TẤT CẢ các ô 1 trong nhóm đó đều đã nằm trong các nhóm khác thì nhóm đó là **DƯ THỪA**, hãy gạch bỏ ngay!`,
        labAction: {
          type: 'logic',
          title: 'Thực hành bìa K-Map 4 biến',
          subtab: 'kmap',
          expr: '(~b & ~d) | (b & d)',
        },
      };
    }

    // 0.8 DIRICHLET RABBIT & CAGE HINT (HINT)
    if (q.includes('thỏ') || (q.includes('lồng') && q.includes('dirichlet'))) {
      return {
        text: `### 🧮 Phương Pháp Xác Định "Thỏ" và "Lồng" Trong Bài Toán Dirichlet

**1. Quy tắc cốt lõi:**
- **Thỏ (Objects - $N$):** Là tập hợp các phần tử, đối tượng cần phân loại, phân chia, hoặc kiểm tra tính chất (thường có số lượng nhiều hơn).
- **Lồng (Pigeonholes/Boxes - $k$):** Là tập hợp các đặc tính, thuộc tính, nhóm kết quả có thể nhận được (thường có số lượng cố định hoặc hữu hạn).

**2. Công thức suy luận:**
- Nếu $N > k$, luôn tồn tại ít nhất 1 lồng chứa $\\ge 2$ thỏ.
- Dạng mạnh: Luôn có ít nhất 1 lồng chứa không ít hơn $\\lceil \\frac{N}{k} \\rceil$ thỏ.

**3. Ví dụ mẫu nhận diện:**
- **Bài toán sinh nhật:** Trong 13 người bất kỳ, luôn có ít nhất 2 người cùng tháng sinh.
  - *Thỏ:* 13 người ($N = 13$).
  - *Lồng:* 12 tháng trong năm ($k = 12$).
  - *Kết luận:* Vì $13 > 12$, theo Dirichlet có ít nhất $\\lceil 13/12 \\rceil = 2$ người cùng tháng sinh.
- **Bài toán số dư:** Cho 5 số nguyên bất kỳ, luôn có ít nhất 2 số có cùng số dư khi chia cho 4.
  - *Thỏ:* 5 số nguyên ($N = 5$).
  - *Lồng:* 4 giá trị số dư khả dĩ $\\{0, 1, 2, 3\\}$ ($k = 4$).`,
        labAction: {
          type: 'counting',
          title: 'Mô phỏng Thỏ & Lồng Dirichlet',
          subtab: 'dirichlet',
        },
      };
    }

    // 0.9 INSPECT 5 MATRIX PROPERTIES QUICKLY (HINT)
    if (q.includes('5 tính chất') || (q.includes('tính chất') && (q.includes('ma trận') || q.includes('nhìn nhanh')))) {
      return {
        text: `### 🔄 Mẹo Nhìn Nhanh 5 Tính Chất Quan Hệ Trên Ma Trận 0-1 ($M_R$)

Khi nhìn vào ma trận nhị phân $n \\times n$, bạn có thể xác định tính chất trong vòng 5 giây:

1. **Phản xạ (Reflexive):**
   - *Quy tắc:* Đường chéo chính (từ trên-trái xuống dưới-phải) **toàn bộ là số 1** ($M_{ii} = 1, \\forall i$).
2. **Đối xứng (Symmetric):**
   - *Quy tắc:* Ma trận đối xứng qua đường chéo chính ($M_R = M_R^T$).
   - Nếu $M_{ij} = 1$ thì bắt buộc $M_{ji} = 1$.
3. **Phản xứng (Antisymmetric):**
   - *Quy tắc:* Với mọi cặp ô đối xứng qua đường chéo chính ngoài trục chính ($i \\ne j$), **không được phép cùng bằng 1** (nếu $M_{ij} = 1$ thì $M_{ji} = 0$). Trên đường chéo chính số 0 hay 1 tùy ý.
4. **Bắc cầu (Transitive):**
   - *Quy tắc:* Nhân ma trận logic Boole $M_R^{[2]} = M_R \\odot M_R$. Nếu $M_R^{[2]} \\le M_R$ (tức là ở mọi vị trí, nếu $M_R^{[2]}[i,j] = 1$ thì $M_R[i,j]$ cũng phải bằng 1), quan hệ có tính bắc cầu.
5. **Quan hệ tương đương:** Thỏa mãn (1) + (2) + (4).
6. **Quan hệ thứ tự bộ phận (Poset):** Thỏa mãn (1) + (3) + (4).`,
        labAction: {
          type: 'relation',
          title: 'Kiểm tra 5 tính chất trên ma trận 0-1',
          subtab: 'properties',
        },
      };
    }

    // 0.10 DETECT NON-HAMILTONIAN GRAPHS QUICKLY (HINT)
    if (q.includes('không hamilton') || (q.includes('không có') && q.includes('hamilton'))) {
      return {
        text: `### 🌐 Mẹo Phát Hiện Nhanh Đồ Thị KHÔNG Có Chu Trình Hamilton

Để chứng minh một đồ thị KHÔNG có chu trình Hamilton trong đề thi trắc nghiệm, hãy dùng các dấu hiệu loại trừ nhanh sau:

1. **Đỉnh treo (Bậc 1):**
   - Nếu đồ thị có bất kỳ đỉnh nào có bậc $\\deg(v) < 2$, đồ thị **chắc chắn không có chu trình Hamilton** (vì chu trình phải đi vào và đi ra khỏi mỗi đỉnh, đòi hỏi bậc tối thiểu là 2).
2. **Cạnh cầu (Bridge / Cut-edge):**
   - Nếu đồ thị có chứa cạnh cầu mà khi xóa đi làm đồ thị mất liên thông, đồ thị không thể có chu trình Hamilton.
3. **Định lý Xóa Đỉnh (Cut-vertex Condition):**
   - Cho tập đỉnh $S \\subset V$. Nếu xóa tập đỉnh $S$ làm cho đồ thị bị tách thành $c(G \\setminus S)$ thành phần liên thông thỏa mãn:
     $$c(G \\setminus S) > |S|$$
     thì đồ thị $G$ **không thể có chu trình Hamilton**!
4. **Đồ thị hai phía (Bipartite graph) mất cân bằng:**
   - Nếu đồ thị hai phía $G = (V_1, V_2, E)$ có $|V_1| \\ne |V_2|$, thì đồ thị không có chu trình Hamilton (vì chu trình đơn phải xen kẽ giữa 2 tập đỉnh liên tục).`,
        labAction: {
          type: 'graph',
          title: 'Kiểm tra chu trình Hamilton',
          algo: 'hamilton',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 1. GRAPH LAB: DIJKSTRA SHORTEST PATH
    // -----------------------------------------------------------------------
    if (q.includes('dijkstra') || (q.includes('ngắn nhất') && (q.includes('đồ thị') || q.includes('đường đi')))) {
      return {
        text: `### 🌐 Thuật toán Dijkstra – Tìm đường đi ngắn nhất

**1. Bản chất & Nguyên lý hoạt động:**
- **Mục tiêu:** Tìm đường đi có tổng trọng số nhỏ nhất từ một đỉnh nguồn $s$ đến tất cả các đỉnh còn lại trong đồ thị có trọng số **không âm** ($w(e) \\ge 0$).
- **Chiến lược:** Tham lam (*Greedy*). Tại mỗi bước, thuật toán chọn đỉnh $u$ chưa được xét có khoảng cách tạm thời $d[u]$ nhỏ nhất, sau đó tiến hành **giãn cạnh (relaxation)** cho tất cả các đỉnh $v$ kề với $u$:
  $$d[v] = \\min(d[v], d[u] + w(u, v))$$
- **Độ phức tạp:** $O((V + E) \\log V)$ khi cài đặt bằng hàng đợi ưu tiên (*Min-Heap*).

**2. Lưu ý quan trọng khi thi:**
- Thuật toán Dijkstra **không** chạy đúng trên đồ thị có trọng số âm (khi đó phải dùng thuật toán Bellman-Ford hoặc Floyd-Warshall).
- Khi có nhiều đỉnh cùng khoảng cách nhỏ nhất, thứ tự chọn phụ thuộc vào quy ước duyệt đỉnh (thường theo thứ tự từ điển).

Tôi đã chuẩn bị sẵn một đồ thị mạng giao thông 6 đỉnh mẫu. Bạn có thể mở trực tiếp trong Graph Lab để xem bảng trạng thái cập nhật từng bước!`,
        labAction: {
          type: 'graph',
          title: 'Đồ thị mẫu Dijkstra (6 đỉnh, có trọng số)',
          algo: 'dijkstra',
          graphSpec: {
            directed: false,
            weighted: true,
            nodes: [
              { id: 'A', name: 'Đỉnh A (Nguồn)' },
              { id: 'B', name: 'Đỉnh B' },
              { id: 'C', name: 'Đỉnh C' },
              { id: 'D', name: 'Đỉnh D' },
              { id: 'E', name: 'Đỉnh E' },
              { id: 'F', name: 'Đỉnh F (Đích)' },
            ],
            edges: [
              { from: 'A', to: 'B', weight: 4 },
              { from: 'A', to: 'C', weight: 2 },
              { from: 'B', to: 'C', weight: 1 },
              { from: 'B', to: 'D', weight: 5 },
              { from: 'C', to: 'D', weight: 8 },
              { from: 'C', to: 'E', weight: 10 },
              { from: 'D', to: 'E', weight: 2 },
              { from: 'D', to: 'F', weight: 6 },
              { from: 'E', to: 'F', weight: 3 },
            ],
          },
        },
      };
    }

    // -----------------------------------------------------------------------
    // 2. GRAPH LAB: MINIMUM SPANNING TREE (PRIM & KRUSKAL)
    // -----------------------------------------------------------------------
    if (q.includes('prim') || q.includes('kruskal') || q.includes('cây khung')) {
      return {
        text: `### 🌐 Cây khung nhỏ nhất (MST) – So sánh Prim vs Kruskal

**1. Định nghĩa Cây khung nhỏ nhất (Minimum Spanning Tree - MST):**
- Cho đồ thị vô hướng liên thông $G = (V, E)$ có trọng số.
- Cây khung của $G$ là một đồ thị con liên thông, không có chu trình và chứa toàn bộ $V$ đỉnh (gồm đúng $|V| - 1$ cạnh).
- Cây khung nhỏ nhất là cây khung có **tổng trọng số các cạnh là nhỏ nhất**.

**2. So sánh 2 Thuật toán kinh điển:**
| Tiêu chí | Thuật toán Kruskal | Thuật toán Prim |
| :--- | :--- | :--- |
| **Tiếp cận** | Hướng cạnh (*Edge-based*) | Hướng đỉnh (*Vertex-based*) |
| **Cơ chế** | Sắp xếp tất cả các cạnh theo trọng số tăng dần, thêm cạnh nếu không tạo chu trình (dùng Disjoint Set). | Bắt đầu từ 1 đỉnh, liên tục kết nạp cạnh nhẹ nhất nối cây hiện tại với đỉnh ngoài cây. |
| **Độ phức tạp** | $O(E \\log E)$ | $O(E \\log V)$ với Min-Heap |
| **Khuyên dùng** | Đồ thị thưa ($E \\approx V$) | Đồ thị dày ($E \\approx V^2$) |

Hãy bấm nút dưới đây để nạp ngay đồ thị mẫu vào Graph Lab và xem so sánh bước chạy!`,
        labAction: {
          type: 'graph',
          title: 'Đồ thị mẫu Cây Khung Nhỏ Nhất (MST)',
          algo: q.includes('prim') ? 'prim' : 'kruskal',
          graphSpec: {
            directed: false,
            weighted: true,
            nodes: [
              { id: '1', name: 'Đỉnh 1' },
              { id: '2', name: 'Đỉnh 2' },
              { id: '3', name: 'Đỉnh 3' },
              { id: '4', name: 'Đỉnh 4' },
              { id: '5', name: 'Đỉnh 5' },
              { id: '6', name: 'Đỉnh 6' },
            ],
            edges: [
              { from: '1', to: '2', weight: 3 },
              { from: '1', to: '3', weight: 1 },
              { from: '2', to: '3', weight: 3 },
              { from: '2', to: '4', weight: 6 },
              { from: '3', to: '4', weight: 4 },
              { from: '3', to: '5', weight: 5 },
              { from: '4', to: '5', weight: 5 },
              { from: '4', to: '6', weight: 2 },
              { from: '5', to: '6', weight: 4 },
            ],
          },
        },
      };
    }

    // -----------------------------------------------------------------------
    // 3. GRAPH LAB: EULER & HAMILTON
    // -----------------------------------------------------------------------
    if (q.includes('euler') || q.includes('hamilton')) {
      const isEuler = q.includes('euler');
      return {
        text: `### 🌐 Chu trình Euler vs Chu trình Hamilton

**1. Định lý Euler (Duyệt qua mọi CẠNH đúng 1 lần):**
- **Đồ thị Euler:** Đồ thị liên thông có chu trình Euler khi và chỉ khi **mọi đỉnh đều có bậc chẵn** ($deg(v) \\equiv 0 \\pmod 2$).
- **Đường đi Euler:** Có đúng 2 đỉnh bậc lẻ (bắt đầu ở 1 đỉnh lẻ, kết thúc ở đỉnh lẻ còn lại).
- **Thuật toán giải:** Thuật toán Hierholzer hoặc Fleury (thời gian tuyến tính $O(V + E)$).

**2. Chu trình Hamilton (Duyệt qua mọi ĐỈNH đúng 1 lần):**
- Là bài toán NP-đầy đủ (*NP-Complete*), không có điều kiện cần và đủ đơn giản như Euler.
- **Định lý Dirac:** Nếu đồ thị đơn vô hướng có $n \\ge 3$ đỉnh và mọi đỉnh đều có $deg(v) \\ge n/2$ thì đồ thị có chu trình Hamilton.
- **Định lý Ore:** Nếu $deg(u) + deg(v) \\ge n$ với mọi cặp đỉnh $u, v$ không kề nhau thì đồ thị có chu trình Hamilton.

Dưới đây là đồ thị mẫu đã được tối ưu để bạn quan sát thuật toán tìm chu trình!`,
        labAction: {
          type: 'graph',
          title: isEuler ? 'Đồ thị Euler mẫu (Tất cả đỉnh bậc chẵn)' : 'Đồ thị Hamilton mẫu',
          algo: isEuler ? 'euler' : 'hamilton',
          graphSpec: {
            directed: false,
            weighted: false,
            nodes: [
              { id: 'A', name: 'Đỉnh A' },
              { id: 'B', name: 'Đỉnh B' },
              { id: 'C', name: 'Đỉnh C' },
              { id: 'D', name: 'Đỉnh D' },
              { id: 'E', name: 'Đỉnh E' },
            ],
            edges: [
              { from: 'A', to: 'B', weight: 1 },
              { from: 'B', to: 'C', weight: 1 },
              { from: 'C', to: 'D', weight: 1 },
              { from: 'D', to: 'E', weight: 1 },
              { from: 'E', to: 'A', weight: 1 },
              { from: 'A', to: 'C', weight: 1 },
              { from: 'B', to: 'D', weight: 1 },
              { from: 'C', to: 'E', weight: 1 },
            ],
          },
        },
      };
    }

    // -----------------------------------------------------------------------
    // 4. LOGIC LAB: TRUTH TABLE & TAUTOLOGY
    // -----------------------------------------------------------------------
    if (q.includes('chân trị') || q.includes('hằng đúng') || q.includes('mâu thuẫn') || q.includes('tương đương logic') || (q.includes('logic') && !q.includes('kmap') && !q.includes('mạch'))) {
      const sampleExpr = '(p -> q) & (q -> r) -> (p -> r)';
      return {
        text: `### ⚡ Logic Mệnh Đề & Phân Tích Bảng Chân Trị

**1. Bảng chân trị (Truth Table):**
- Là công cụ liệt kê giá trị chân lý ($1$ - Đúng, $0$ - Sai) của mệnh đề phức hợp ứng với mọi trường hợp giá trị của các biến mệnh đề.
- Với $n$ biến logic độc lập, bảng sẽ có chính xác $2^n$ hàng.

**2. Phân loại mệnh đề:**
- **Hằng đúng (Tautology):** Mệnh đề luôn nhận giá trị $1$ ở tất cả các hàng. Ví dụ quy tắc Tam đoạn luận bắc cầu:
  $$[(p \\rightarrow q) \\land (q \\rightarrow r)] \\rightarrow (p \\rightarrow r) \\equiv 1$$
- **Mâu thuẫn (Contradiction):** Mệnh đề luôn nhận giá trị $0$ ở tất cả các hàng (ví dụ: $p \\land \\neg p$).
- **Tiếp định (Contingency):** Có ít nhất một hàng nhận $1$ và một hàng nhận $0$.

Bấm nút bên dưới để nạp biểu thức này vào Logic Lab và tự động vẽ bảng chân trị phân tích nhé!`,
        labAction: {
          type: 'logic',
          title: 'Quy tắc Tam đoạn luận bắc cầu',
          subtab: 'table',
          expr: sampleExpr,
        },
      };
    }

    // -----------------------------------------------------------------------
    // 5. LOGIC LAB: KARNAUGH MAP (K-MAP)
    // -----------------------------------------------------------------------
    if (q.includes('kmap') || q.includes('karnaugh') || q.includes('bìa') || q.includes('rút gọn hàm boole')) {
      return {
        text: `### ⚡ Tối Giản Hàm Boole Bằng Bìa Karnaugh (K-Map)

**1. Nguyên tắc cốt lõi của K-Map:**
- **Mã Gray (Gray Code):** Các ô liền kề nhau chỉ khác biệt duy nhất 1 bit (theo thứ tự: $00, 01, 11, 10$). Điều này cho phép áp dụng luật kết hợp $x \\cdot y + x \\cdot \\neg y = x$.
- **Quy tắc tạo nhóm ô (Tế bào lớn):**
  - Số lượng ô trong một nhóm phải là **lũy thừa của 2** ($1, 2, 4, 8, 16$).
  - Nhóm càng lớn thì biểu thức rút gọn được càng nhiều biến.
  - Các ô ở mép bìa (biên trái - biên phải, biên trên - biên dưới) được coi là liền kề nhau (*Wrap-around*).

**2. Ví dụ hàm 4 biến $f(A, B, C, D) = \\sum m(0, 2, 5, 7, 8, 10, 13, 15)$:**
- 4 góc: $m(0, 2, 8, 10)$ gom thành nhóm kích thước 4 $\\rightarrow \\neg B \\cdot \\neg D$.
- 4 ô giữa: $m(5, 7, 13, 15)$ gom thành nhóm kích thước 4 $\\rightarrow B \\cdot D$.
- Kết quả tối giản: $f = \\neg B \\cdot \\neg D + B \\cdot D$ (Chính là cổng XNOR $\\overline{A \\oplus B}$).

Hãy mở ngay Logic Lab để xem trực quan các nhóm bao phủ trên bìa K-Map!`,
        labAction: {
          type: 'logic',
          title: 'Tối giản K-Map 4 biến',
          subtab: 'kmap',
          expr: '(~b & ~d) | (b & d)',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 6. LOGIC LAB: CIRCUIT SIMULATION
    // -----------------------------------------------------------------------
    if (q.includes('mạch') || q.includes('cổng logic') || q.includes('adder') || q.includes('half-adder')) {
      return {
        text: `### ⚡ Thiết Kế & Mô Phỏng Sơ Đồ Mạch Số (Digital Logic Circuits)

**1. Các cổng Logic cơ bản:**
- **Cổng AND ($A \\cdot B$):** Đầu ra bằng 1 khi cả 2 đầu vào đều là 1.
- **Cổng OR ($A + B$):** Đầu ra bằng 1 khi có ít nhất một đầu vào là 1.
- **Cổng NOT ($\\neg A$):** Đảo ngược mức logic.
- **Cổng XOR ($A \\oplus B$):** Đầu ra bằng 1 khi 2 đầu vào khác nhau.

**2. Mạch cộng bán phần (Half-Adder):**
- Dùng để cộng 2 bit nhị phân $A$ và $B$:
  - Bit Tổng (Sum): $S = A \\oplus B$
  - Bit Nhớ (Carry): $C = A \\cdot B$

Trong Logic Lab, bạn có thể tự tay bật/tắt các công tắc đầu vào $A, B$ để thấy dòng điện tín hiệu đổi màu thời gian thực!`,
        labAction: {
          type: 'logic',
          title: 'Mô phỏng Mạch Logic Số',
          subtab: 'circuit',
          expr: 'a & b | c',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 7. COUNTING LAB: DIRICHLET PIGEONHOLE PRINCIPLE
    // -----------------------------------------------------------------------
    if (q.includes('dirichlet') || q.includes('chuồng bồ câu') || q.includes('chia kẹo')) {
      return {
        text: `### 🧮 Nguyên Lý Chuồng Bồ Câu (Dirichlet Principle)

**1. Phát biểu cơ bản:**
Nếu nhốt $N$ chú chim bồ câu vào $k$ cái chuồng ($N > k$), thì luôn tồn tại **ít nhất một chuồng chứa từ 2 chú chim trở lên**.

**2. Dạng tổng quát:**
Nếu chia $N$ đồ vật vào $k$ hộp, thì luôn tồn tại ít nhất một hộp chứa không ít hơn:
$$\\lceil \\frac{N}{k} \\rceil \\text{ đồ vật}$$

**3. Ứng dụng thực tế kinh điển:**
- **Sinh nhật:** Trong một nhóm gồm $367$ người, luôn có ít nhất $2$ người có cùng ngày sinh nhật (vì 1 năm nhuận tối đa có $366$ ngày).
- **Lấy tất trong bóng tối:** Một ngăn kéo có 10 đôi tất đen và 10 đôi tất trắng. Cần lấy ít nhất $3$ chiếc tất để chắc chắn có được một đôi cùng màu.

Tôi đã tích hợp sẵn đấu trường mô phỏng Dirichlet trong Counting Lab. Bạn có thể kéo thanh trượt chia $N$ chú bồ câu vào $k$ chuồng để thấy thuật toán chứng minh phản chứng!`,
        labAction: {
          type: 'counting',
          title: 'Phòng thí nghiệm Nguyên lý Dirichlet',
          subtab: 'dirichlet',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 8. COUNTING LAB: RECURRENCE RELATIONS
    // -----------------------------------------------------------------------
    if (q.includes('truy hồi') || q.includes('fibonacci') || q.includes('phương trình đặc trưng')) {
      return {
        text: `### 🧮 Giải Hệ Thức Truy Hồi Tuyến Tính Thuần Nhất

**1. Dạng phương trình thuần nhất bậc 2:**
$$a_n = c_1 a_{n-1} + c_2 a_{n-2} \\quad (c_2 \\ne 0)$$
Phương trình đặc trưng tương ứng:
$$r^2 - c_1 r - c_2 = 0$$

**2. Cách tìm nghiệm tổng quát dựa vào $\\Delta$:**
- **TH1: Có 2 nghiệm thực phân biệt $r_1 \\ne r_2$:**
  $$a_n = C_1 \\cdot r_1^n + C_2 \\cdot r_2^n$$
- **TH2: Có nghiệm kép $r_1 = r_2 = r_0$:**
  $$a_n = (C_1 + C_2 \\cdot n) \\cdot r_0^n$$
- **TH3: Nghiệm phức liên hợp:** Dùng dạng lượng giác với góc $\\theta$.

**3. Ví dụ Dãy số Fibonacci:**
$a_n = a_{n-1} + a_{n-2}$ với $a_0 = 0, a_1 = 1$. Nghiệm đặc trưng $r = \\frac{1 \\pm \\sqrt{5}}{2}$, từ đó suy ra công thức Binet kinh điển:
$$F_n = \\frac{1}{\\sqrt{5}} \\left[ \\left(\\frac{1+\\sqrt{5}}{2}\\right)^n - \\left(\\frac{1-\\sqrt{5}}{2}\\right)^n \\right]$$

Mở ngay Bộ giải Hệ thức truy hồi trong Counting Lab để nhập hệ số và xem nghiệm tổng quát từng bước!`,
        labAction: {
          type: 'counting',
          title: 'Bộ giải Hệ thức truy hồi bậc 1 & 2',
          subtab: 'recurrence',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 9. COUNTING LAB: COMBINATORICS & PASCAL
    // -----------------------------------------------------------------------
    if (q.includes('tổ hợp') || q.includes('chỉnh hợp') || q.includes('hoán vị') || q.includes('pascal') || q.includes('nhị thức')) {
      return {
        text: `### 🧮 Đại Số Tổ Hợp & Tam Giác Pascal

**1. Các công thức đếm nền tảng:**
- **Hoán vị (Permutation):** $P_n = n!$ (xếp thứ tự $n$ phần tử phân biệt).
- **Chỉnh hợp (Variation):** $A_n^k = \\frac{n!}{(n - k)!}$ (chọn $k$ phần tử và có phân biệt thứ tự).
- **Tổ hợp (Combination):** $C_n^k = \\binom{n}{k} = \\frac{n!}{k!(n - k)!}$ (chọn $k$ phần tử không kể thứ tự).

**2. Hệ thức Pascal & Nhị thức Newton:**
- **Hệ thức Pascal:** $C_n^k = C_{n-1}^{k-1} + C_{n-1}^k$ (Mỗi ô trong tam giác Pascal bằng tổng 2 ô ngay phía trên nó).
- **Khai triển nhị thức:** $(a + b)^n = \\sum_{k=0}^n C_n^k a^{n-k} b^k$. Tổng các hệ số bằng $2^n$.

Hãy khám phá Tam giác Pascal tương tác và máy tính tổ hợp chi tiết trong Counting Lab!`,
        labAction: {
          type: 'counting',
          title: 'Tam giác Pascal & Máy tính Tổ hợp',
          subtab: 'pascal',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 10. RELATION LAB: EQUIVALENCE, POSET & WARSHALL
    // -----------------------------------------------------------------------
    if (q.includes('quan hệ') || q.includes('tương đương') || q.includes('thứ tự') || q.includes('poset') || q.includes('hasse') || q.includes('warshall') || q.includes('bao đóng')) {
      return {
        text: `### 🔄 Quan Hệ Nhị Phân – Kiểm Tra Tính Chất & Bao Đóng Warshall

**1. 5 Tính chất cốt lõi của quan hệ $R$ trên tập $A$:**
1. **Phản xạ (Reflexive):** $\\forall a \\in A, aRa$ (Đường chéo chính của ma trận $M_R$ toàn số $1$).
2. **Đối xứng (Symmetric):** $aRb \\implies bRa$ (Ma trận $M_R$ đối xứng qua đường chéo chính: $M_R = M_R^T$).
3. **Phản xứng (Antisymmetric):** $(aRb \\land bRa) \\implies a = b$ (Không có 2 số $1$ đối xứng qua đường chéo).
4. **Bắc cầu (Transitive):** $(aRb \\land bRc) \\implies aRc$ ($M_R^2 \\le M_R$).

**2. Phân loại quan hệ đặc biệt:**
- **Quan hệ tương đương (Equivalence Relation):** Thỏa mãn cả 3 tính chất: **Phản xạ + Đối xứng + Bắc cầu**. Chia tập hợp thành các lớp tương đương rời nhau.
- **Quan hệ thứ tự bộ phận (Poset):** Thỏa mãn: **Phản xạ + Phản xứng + Bắc cầu**. Biểu diễn trực quan bằng **Biểu đồ Hasse**.

**3. Thuật toán Warshall:**
- Tìm bao đóng bắc cầu $t(R)$ bằng cách duyệt qua từng đỉnh trung gian $k$ từ $1$ đến $n$:
  $$W^{(k)}[i, j] = W^{(k-1)}[i, j] \\lor (W^{(k-1)}[i, k] \\land W^{(k-1)}[k, j])$$

Bấm nút dưới đây để nạp ngay quan hệ chia hết vào Relation Lab và tương tác trên ma trận 0-1!`,
        labAction: {
          type: 'relation',
          title: 'Ma trận quan hệ & Biểu đồ Hasse',
          subtab: 'hasse',
        },
      };
    }

    // -----------------------------------------------------------------------
    // 11. GENERAL / DEFAULT ACADEMIC GUIDANCE
    // -----------------------------------------------------------------------
    return {
      text: `### 🤖 Trợ Lý Thực Nghiệm Toán Rời Rạc

Tôi có thể hỗ trợ bạn học tập và thực hành toàn diện cả 4 chương của học trình Đại học:

1. **⚡ Chương 1 & 2: Logic Mệnh Đề & Mạch Số (Logic Lab)**
   - Lập bảng chân trị tự động, phân tích hằng đúng / mâu thuẫn.
   - Rút gọn hàm Boole bằng bìa Karnaugh (K-Map 2-4 biến).
   - Mô phỏng sơ đồ mạch điện logic số (AND, OR, NOT, XOR, Half-Adder).

2. **🧮 Chương 3: Phương Pháp Đếm & Tổ Hợp (Counting Lab)**
   - Tính hoán vị $P_n$, chỉnh hợp $A_n^k$, tổ hợp $C_n^k$, nhị thức Newton.
   - Mô phỏng nguyên lý chuồng bồ câu Dirichlet trực quan.
   - Giải phương trình đặc trưng hệ thức truy hồi tuyến tính bậc 1 & bậc 2.

3. **🔄 Chương 4: Quan Hệ Nhị Phân (Relation Lab)**
   - Ma trận 0-1 biểu diễn quan hệ $M_R$, đồ thị quan hệ.
   - Kiểm tra 5 tính chất, xác định Quan hệ Tương đương hoặc Thứ tự (Poset).
   - Thuật toán Roy-Warshall tìm bao đóng và vẽ biểu đồ Hasse.

4. **🌐 Chương 5: Lý Thuyết Đồ Thị & Thuật Toán (Graph Lab)**
   - Tìm đường đi ngắn nhất: Thuật toán Dijkstra.
   - Cây khung nhỏ nhất: Thuật toán Prim và Kruskal.
   - Đồ thị Euler & Hamilton: Tìm chu trình và đường đi.

*Bạn muốn giải bài tập hay tạo bài toán thực nghiệm ở phòng Lab nào? Hãy thử chọn một gợi ý bên dưới hoặc gõ câu hỏi của bạn nhé!*`,
      labAction: {
        type: 'graph',
        title: 'Đồ thị mẫu Dijkstra',
        algo: 'dijkstra',
      },
    };
  }

  _detectLabActionFallback(prompt) {
    const q = prompt.toLowerCase();
    if (q.includes('dijkstra')) return { type: 'graph', algo: 'dijkstra', title: 'Thuật toán Dijkstra' };
    if (q.includes('prim')) return { type: 'graph', algo: 'prim', title: 'Thuật toán Prim MST' };
    if (q.includes('kruskal')) return { type: 'graph', algo: 'kruskal', title: 'Thuật toán Kruskal MST' };
    if (q.includes('euler')) return { type: 'graph', algo: 'euler', title: 'Đồ thị Euler' };
    if (q.includes('kmap') || q.includes('karnaugh')) return { type: 'logic', subtab: 'kmap', title: 'Bìa Karnaugh' };
    if (q.includes('chân trị') || q.includes('mệnh đề')) return { type: 'logic', subtab: 'table', title: 'Bảng chân trị' };
    if (q.includes('dirichlet') || q.includes('chuồng bồ câu')) return { type: 'counting', subtab: 'dirichlet', title: 'Nguyên lý Dirichlet' };
    if (q.includes('truy hồi')) return { type: 'counting', subtab: 'recurrence', title: 'Hệ thức truy hồi' };
    if (q.includes('quan hệ') || q.includes('hasse') || q.includes('poset')) return { type: 'relation', subtab: 'hasse', title: 'Quan hệ thứ tự Poset' };
    return null;
  }
}
