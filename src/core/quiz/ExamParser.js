/**
 * ExamParser.js
 * 
 * High-performance, fault-tolerant parser for teacher exam authoring.
 * Supports:
 * 1. Raw Text copy-pasted from Microsoft Word / Google Docs / PDF.
 * 2. Excel / CSV table format.
 * 3. Validation and sample generation.
 */

/**
 * Parses raw text copied from Word or text files.
 * Format sample:
 *   Câu 1: Cho mệnh đề P: "Hôm nay trời mưa". Phủ định của P là?
 *   A. Hôm nay trời không mưa
 *   B. Hôm nay trời mưa rất to
 *   C. Hôm nay trời nắng ráo
 *   D. Hôm nay trời âm u
 *   Đáp án: A
 *   Giải thích: Phủ định của P là không P.
 * 
 * @param {string} rawText
 * @returns {{ success: boolean, questions: Array<Object>, errors: Array<string>, totalCount: number }}
 */
export function parseExamText(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { success: false, questions: [], errors: ['Nội dung đề thi đang trống.'], totalCount: 0 };
  }

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = splitIntoQuestionBlocks(normalized);

  if (blocks.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ['Không tìm thấy câu hỏi nào. Vui lòng bắt đầu bằng "Câu 1:", "Câu 2:" hoặc "1.", "2.".'],
      totalCount: 0,
    };
  }

  const questions = [];
  const errors = [];

  blocks.forEach((block, index) => {
    const qNum = index + 1;
    const parsed = parseSingleQuestionBlock(block, qNum);
    if (parsed.error) {
      errors.push(`Câu ${qNum}: ${parsed.error}`);
    } else {
      questions.push(parsed.question);
    }
  });

  return {
    success: errors.length === 0 && questions.length > 0,
    questions,
    errors,
    totalCount: questions.length,
  };
}

/**
 * Splits text into question blocks based on common question prefixes.
 */
function splitIntoQuestionBlocks(text) {
  // Regex matching "Câu 1:", "Bài 1:", "Question 1:", or "1." at beginning of line
  const regex = /(?:^|\n)\s*(?:câu|bài|question|\b)\s*(\d+)[\s.:)-]+(?=[^\n\d])/gi;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      num: parseInt(match[1], 10),
      length: match[0].length,
    });
  }

  if (matches.length === 0) {
    // Fallback: check if double newline separates blocks
    const doubleNewlineBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (doubleNewlineBlocks.length > 0 && doubleNewlineBlocks.some(b => /[A-D][\s.:)]+/i.test(b))) {
      return doubleNewlineBlocks;
    }
    return [text.trim()];
  }

  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    const rawBlock = text.slice(start, end).trim();
    if (rawBlock) {
      blocks.push(rawBlock);
    }
  }

  return blocks;
}

/**
 * Parses an individual question block.
 */
function parseSingleQuestionBlock(rawBlock, index) {
  let block = rawBlock;

  // 1. Extract Correct Answer
  // Matches: "Đáp án: A", "Đáp án đúng: B", "ĐA: C", "Key: D", "Chọn: A", "Answer: B"
  let correctId = null;
  const answerRegex = /(?:đáp\s*án(?:\s*đúng)?|đa|key|answer|chọn)\s*[:=]\s*([A-D])/i;
  const answerMatch = block.match(answerRegex);
  if (answerMatch) {
    correctId = answerMatch[1].toUpperCase();
    block = block.replace(answerMatch[0], '');
  }

  // If not found via keyword, check if an option has an asterisk marker like "*A." or "*[A]"
  if (!correctId) {
    const starMatch = block.match(/(?:^|[\s\n\t]+)\*\s*([A-D])[\s.:\)-]+/i);
    if (starMatch) {
      correctId = starMatch[1].toUpperCase();
    }
  }

  // 2. Extract Explanation
  // Matches: "Giải thích:", "Lời giải:", "Hướng dẫn giải:", "HD:", "Explanation:"
  let explanation = '';
  const explRegex = /(?:giải\s*thích|lời\s*giải|hướng\s*dẫn(?:\s*giải)?|hd|explanation)\s*[:=]\s*([\s\S]*)$/i;
  const explMatch = block.match(explRegex);
  if (explMatch) {
    explanation = explMatch[1].trim();
    block = block.slice(0, explMatch.index).trim();
  }

  // 3. Extract Options A, B, C, D
  // Handle both multiline ("A. ...\nB. ...") and inline ("A. ... B. ... C. ... D. ...")
  const optionRegex = /(?:^|[\s\n\t]+)\*?\s*([A-D])[\s.:\)-]+([\s\S]*?)(?=(?:[\s\n\t]+\*?\s*[A-D][\s.:\)-]+)|$)/gi;
  const rawOptions = [];
  let optMatch;

  // Find where the first option starts
  const firstOptIndex = block.search(/(?:^|[\s\n\t]+)\*?\s*[A-D][\s.:\)-]+/i);
  let questionText = block;

  if (firstOptIndex !== -1) {
    questionText = block.slice(0, firstOptIndex).trim();
    const optionsSection = block.slice(firstOptIndex);

    while ((optMatch = optionRegex.exec(optionsSection)) !== null) {
      const optLetter = optMatch[1].toUpperCase();
      const optText = optMatch[2].trim();
      rawOptions.push({ id: optLetter, text: optText });
    }
  }

  // Clean question prefix (e.g., "Câu 1: ", "1. ")
  questionText = questionText.replace(/^(?:câu|bài|question|\b)\s*\d+[\s.:)-]+\s*/i, '').trim();

  // Validate question text
  if (!questionText) {
    return { error: 'Không tìm thấy nội dung câu hỏi.' };
  }

  // Ensure at least 2 options exist
  if (rawOptions.length < 2) {
    return { error: `Chỉ tìm thấy ${rawOptions.length} phương án trả lời. Cần ít nhất 2 phương án (A, B, C, D).` };
  }

  // Map into standard A, B, C, D list
  const standardOptions = ['A', 'B', 'C', 'D'].map(id => {
    const found = rawOptions.find(o => o.id === id);
    return {
      id,
      text: found ? found.text : `[Phương án ${id}]`,
    };
  }).filter(opt => rawOptions.some(o => o.id === opt.id));

  // If correct answer wasn't explicitly labeled, check if marked with asterisk (e.g. "*A. ...")
  if (!correctId) {
    const starMatch = rawBlock.match(/\*\s*([A-D])[\s.:\)-]+/i);
    if (starMatch) {
      correctId = starMatch[1].toUpperCase();
    }
  }

  if (!correctId) {
    return { error: 'Thiếu đáp án đúng (Ví dụ: "Đáp án: A").' };
  }

  const validOptionIds = standardOptions.map(o => o.id);
  if (!validOptionIds.includes(correctId)) {
    return { error: `Đáp án đúng "${correctId}" không nằm trong các phương án (${validOptionIds.join(', ')}).` };
  }

  return {
    question: {
      id: `custom_q_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      question: questionText,
      options: standardOptions,
      correctId,
      explanation: explanation || 'Lời giải chi tiết cho câu hỏi này.',
      topic: 'custom',
      topicName: 'Đề Thi Tự Soạn',
      difficulty: 'medium',
      source: 'custom_import',
    },
  };
}

/**
 * Parses CSV formatted string.
 * Supports comma, semicolon, and tab delimiters.
 * Expected columns:
 *   Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng, Lời giải
 * 
 * @param {string} csvText
 * @returns {{ success: boolean, questions: Array<Object>, errors: Array<string>, totalCount: number }}
 */
export function parseExamCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return { success: false, questions: [], errors: ['Nội dung file CSV đang trống.'], totalCount: 0 };
  }

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { success: false, questions: [], errors: ['File CSV phải có dòng tiêu đề và ít nhất 1 dòng câu hỏi.'], totalCount: 0 };
  }

  const headerRow = rows[0].map(h => h.trim().toLowerCase());
  
  // Find column indices
  let qIdx = headerRow.findIndex(h => /câu\s*hỏi|question|nội\s*dung/i.test(h));
  let aIdx = headerRow.findIndex(h => /đáp\s*án\s*a|phương\s*án\s*a|^a$/i.test(h));
  let bIdx = headerRow.findIndex(h => /đáp\s*án\s*b|phương\s*án\s*b|^b$/i.test(h));
  let cIdx = headerRow.findIndex(h => /đáp\s*án\s*c|phương\s*án\s*c|^c$/i.test(h));
  let dIdx = headerRow.findIndex(h => /đáp\s*án\s*d|phương\s*án\s*d|^d$/i.test(h));
  let keyIdx = headerRow.findIndex(h => /đáp\s*án\s*đúng|correct|key|^đáp\s*án$/i.test(h));
  let expIdx = headerRow.findIndex(h => /lời\s*giải|giải\s*thích|explanation|hướng\s*dẫn/i.test(h));

  // Fallback positional indexing if headers are standard
  if (qIdx === -1 && rows[0].length >= 5) {
    qIdx = 0;
    aIdx = 1;
    bIdx = 2;
    cIdx = 3;
    dIdx = 4;
    keyIdx = 5;
    expIdx = 6;
  }

  if (qIdx === -1 || aIdx === -1 || bIdx === -1) {
    return {
      success: false,
      questions: [],
      errors: ['Cấu trúc cột CSV không đúng. Cần các cột: "Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng".'],
      totalCount: 0,
    };
  }

  const questions = [];
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const rowNum = i; // 1-indexed for data rows
    const qText = row[qIdx] ? row[qIdx].trim() : '';
    const optA = aIdx !== -1 && row[aIdx] ? row[aIdx].trim() : '';
    const optB = bIdx !== -1 && row[bIdx] ? row[bIdx].trim() : '';
    const optC = cIdx !== -1 && row[cIdx] ? row[cIdx].trim() : '';
    const optD = dIdx !== -1 && row[dIdx] ? row[dIdx].trim() : '';
    let key = keyIdx !== -1 && row[keyIdx] ? row[keyIdx].trim().toUpperCase() : '';
    const exp = expIdx !== -1 && row[expIdx] ? row[expIdx].trim() : 'Lời giải chi tiết cho câu hỏi này.';

    // Clean key (e.g., "A." or "Đáp án A" -> "A")
    const keyMatch = key.match(/([A-D])/);
    if (keyMatch) key = keyMatch[1];

    if (!qText) {
      errors.push(`Dòng ${rowNum}: Nội dung câu hỏi đang để trống.`);
      continue;
    }
    if (!optA || !optB) {
      errors.push(`Dòng ${rowNum}: Cần ít nhất 2 phương án A và B.`);
      continue;
    }
    if (!key || !['A', 'B', 'C', 'D'].includes(key)) {
      errors.push(`Dòng ${rowNum}: Đáp án đúng không hợp lệ ("${key}"). Phải là A, B, C hoặc D.`);
      continue;
    }

    const options = [
      { id: 'A', text: optA },
      { id: 'B', text: optB },
    ];
    if (optC) options.push({ id: 'C', text: optC });
    if (optD) options.push({ id: 'D', text: optD });

    questions.push({
      id: `custom_csv_q_${Date.now()}_${rowNum}_${Math.random().toString(36).slice(2, 6)}`,
      question: qText,
      options,
      correctId: key,
      explanation: exp || 'Lời giải chi tiết cho câu hỏi này.',
      topic: 'custom',
      topicName: 'Đề Thi Tự Soạn',
      difficulty: 'medium',
      source: 'csv_import',
    });
  }

  return {
    success: errors.length === 0 && questions.length > 0,
    questions,
    errors,
    totalCount: questions.length,
  };
}

/**
 * Standard CSV line tokenizer respecting quotes and escapes.
 */
function parseCsvRows(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  let delimiter = ',';

  // Autodetect delimiter from first line (',' or ';' or '\t')
  const firstLine = lines.split('\n')[0] || '';
  if (firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length)) {
    delimiter = ';';
  } else if (firstLine.includes('\t') && (firstLine.split('\t').length > firstLine.split(',').length)) {
    delimiter = '\t';
  }

  for (let i = 0; i < lines.length; i++) {
    const char = lines[i];
    const nextChar = lines[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Generates sample exam text to paste into the editor.
 */
export function generateSampleExamText() {
  return `Câu 1: Cho mệnh đề P: "Hôm nay trời mưa". Mệnh đề phủ định ¬P là gì?
A. Hôm nay trời không mưa
B. Hôm nay trời mưa rất to
C. Hôm nay trời nhiều mây
D. Hôm nay trời nắng ráo
Đáp án: A
Giải thích: Phủ định của mệnh đề P là "Không phải P", tức là "Hôm nay trời không mưa".

Câu 2: Số tập con của một tập hợp gồm n phần tử được tính theo công thức nào?
A. 2^n
B. n^2
C. 2n
D. n!
Đáp án: A
Giải thích: Mỗi phần tử có 2 khả năng (thuộc hoặc không thuộc tập con), nên số tập hợp con là 2 * 2 * ... * 2 = 2^n.

Câu 3: Đồ thị vô hướng liên thông và không chứa chu trình được gọi là gì?
A. Đồ thị Euler
B. Cây (Tree)
C. Đồ thị Hamilton
D. Đồ thị lưỡng phân
Đáp án: B
Giải thích: Theo định nghĩa trong Lý thuyết Đồ thị, cây là đồ thị vô hướng liên thông và không có chu trình đơn.

Câu 4: Cho hai tập hợp A = {1, 2, 3} và B = {2, 3, 4}. Giao của hai tập hợp A ∩ B là:
A. {1, 2, 3, 4}
B. {2, 3}
C. {1, 4}
D. ∅ (Tập rỗng)
Đáp án: B
Giải thích: Giao của hai tập hợp A ∩ B là tập hợp các phần tử thuộc cả A và B, gồm {2, 3}.

Câu 5: Trong logic mệnh đề, phép toán nào có giá trị SAI khi và chỉ khi cả hai mệnh đề đều sai?
A. Phép hội (AND - ∧)
B. Phép tuyển (OR - ∨)
C. Phép kéo theo (→)
D. Phép tương đương (↔)
Đáp án: B
Giải thích: Mệnh đề tuyển P ∨ Q sai khi và chỉ khi cả P sai và Q sai.`;
}

/**
 * Generates sample CSV string to download.
 */
export function generateSampleExamCsv() {
  return `"Câu hỏi","Đáp án A","Đáp án B","Đáp án C","Đáp án D","Đáp án đúng","Lời giải chi tiết"
"Cho mệnh đề P: 'Hôm nay trời mưa'. Mệnh đề phủ định ¬P là gì?","Hôm nay trời không mưa","Hôm nay trời mưa to","Hôm nay trời nhiều mây","Hôm nay trời nắng ráo","A","Phủ định của P là 'Không phải P'."
"Số tập con của một tập hợp gồm n phần tử được tính theo công thức nào?","2^n","n^2","2n","n!","A","Số tập con của tập n phần tử là 2^n."
"Đồ thị vô hướng liên thông và không chứa chu trình được gọi là gì?","Đồ thị Euler","Cây (Tree)","Đồ thị Hamilton","Đồ thị lưỡng phân","B","Cây là đồ thị vô hướng liên thông không có chu trình."
"Cho hai tập hợp A = {1, 2, 3} và B = {2, 3, 4}. Giao của hai tập hợp A ∩ B là:","{1, 2, 3, 4}","{2, 3}","{1, 4}","Tập rỗng","B","Giao A ∩ B là {2, 3}."
"Trong logic mệnh đề, phép toán nào có giá trị SAI khi và chỉ khi cả hai mệnh đề đều sai?","Phép hội (AND)","Phép tuyển (OR)","Phép kéo theo (->)","Phép tương đương (<->)","B","Phép tuyển P ∨ Q chỉ sai khi cả hai cùng sai."`;
}
