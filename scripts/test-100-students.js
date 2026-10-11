/**
 * @file test-100-students.js
 * Automated Concurrency & Stress Testing Script for Discrete Math Exam System.
 * Simulates 100 concurrent students taking an exam and submitting simultaneously.
 *
 * Usage:
 *   # Test local server (auto-spawns server if not running):
 *   node scripts/test-100-students.js
 *
 *   # Test live Vercel deployment:
 *   node scripts/test-100-students.js https://mathplatform-ten.vercel.app
 */

import { STATIC_QUESTION_BANK } from '../src/core/quiz/QuizBank.js';
import { createServer } from '../src/server/app.js';

const targetArg = process.argv[2];
const CONCURRENT_STUDENTS = 100;

// Pick 10 representative questions from the question bank
const testQuestions = STATIC_QUESTION_BANK.slice(0, 10);
const questionIds = testQuestions.map(q => q.id);

async function checkServerReachable(url) {
  try {
    const res = await fetch(`${url}/api/exams`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function run() {
  console.log('\n===============================================================');
  console.log('🚀 KIỂM THỬ CHỊU TẢI 100 THÍ SINH ĐỒNG THỜI NỘP BÀI THI');
  console.log('===============================================================\n');

  let baseUrl = targetArg ? targetArg.replace(/\/$/, '') : 'http://localhost:3000';
  let spawnedServer = null;

  if (!targetArg) {
    const isRunning = await checkServerReachable(baseUrl);
    if (!isRunning) {
      console.log('ℹ️ Máy chủ cục bộ chưa chạy. Tự động khởi động máy chủ test tại port 3000...');
      spawnedServer = createServer();
      await new Promise((resolve) => {
        spawnedServer.listen(3000, '127.0.0.1', () => {
          console.log('✅ Máy chủ kiểm thử nội bộ đã sẵn sàng tại http://127.0.0.1:3000\n');
          resolve();
        });
      });
      baseUrl = 'http://127.0.0.1:3000';
    } else {
      console.log(`🔗 Đã kết nối máy chủ đang chạy tại: ${baseUrl}\n`);
    }
  } else {
    console.log(`🌐 Mục tiêu kiểm thử (Đám mây): ${baseUrl}\n`);
  }

  // Bước 1: Tạo đề thi thử nghiệm cho 100 thí sinh
  console.log('📝 [Bước 1/4] Đang tạo đề thi kiểm thử chịu tải...');
  const examId = `exam_stress_test_${Date.now()}`;
  const examTitle = `Đề Thi Khảo Thí Tải 100 Thí Sinh (${new Date().toLocaleTimeString('vi-VN')})`;

  const createExamRes = await fetch(`${baseUrl}/api/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: examId,
      title: examTitle,
      durationMinutes: 15,
      questionIds,
      assignedTo: ['all'],
      shuffleQuestions: true,
      shuffleOptions: true,
    }),
  });

  if (!createExamRes.ok) {
    console.error(`❌ Tạo đề thi thất bại! Mã lỗi: ${createExamRes.status}`);
    const errText = await createExamRes.text();
    console.error(errText);
    if (spawnedServer) spawnedServer.close();
    process.exit(1);
  }

  console.log(`✅ Đề thi tạo thành công: "${examTitle}" (ID: ${examId})`);
  console.log(`   Số câu hỏi: ${questionIds.length} câu | Thời lượng: 15 phút | Thí sinh: Toàn bộ lớp (all)\n`);

  // Bước 2: Chuẩn bị 100 bài nộp của 100 thí sinh khác nhau
  console.log(`👥 [Bước 2/4] Chuẩn bị dữ liệu cho ${CONCURRENT_STUDENTS} sinh viên...`);
  const studentPayloads = [];

  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    const studentId = `student_stress_${String(i).padStart(3, '0')}`;
    const studentName = `Thí Sinh Test ${String(i).padStart(3, '0')}`;
    const studentClass = `D21CQCN${(i % 5) + 1}-N`;

    // Giả lập câu trả lời ngẫu nhiên cho 10 câu
    const answers = {};
    testQuestions.forEach(q => {
      // 70% chọn đúng, 30% chọn đáp án khác
      if (Math.random() < 0.7) {
        answers[q.id] = q.correctId;
      } else {
        const wrongOpts = q.options.filter(opt => opt.id !== q.correctId);
        answers[q.id] = wrongOpts.length > 0 ? wrongOpts[0].id : q.correctId;
      }
    });

    studentPayloads.push({
      examId,
      userId: studentId,
      userInfo: {
        username: `sv_${studentId}`,
        fullName: studentName,
        className: studentClass,
        avatar: '🎓',
      },
      answers,
      timeSpentSeconds: Math.floor(Math.random() * 300) + 120, // 2 - 7 phút
      integrityBan: false,
    });
  }
  console.log(`✅ Đã sinh ngẫu nhiên ${CONCURRENT_STUDENTS} bài làm độc lập.\n`);

  // Bước 3: Gửi đồng thời 100 yêu cầu nộp bài (Burst Stress Test)
  console.log(`⚡ [Bước 3/4] Bắt đầu GỬI ĐỒNG THỜI 100 bài thi nộp cùng lúc...`);
  const startTime = Date.now();

  const submissionPromises = studentPayloads.map(async (payload, idx) => {
    const reqStart = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/exam-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const reqDuration = Date.now() - reqStart;
      const data = await res.json().catch(() => null);
      return {
        index: idx + 1,
        status: res.status,
        durationMs: reqDuration,
        success: res.ok && data && data.success,
        data,
      };
    } catch (err) {
      return {
        index: idx + 1,
        status: 0,
        durationMs: Date.now() - reqStart,
        success: false,
        error: err.message,
      };
    }
  });

  const results = await Promise.all(submissionPromises);
  const totalElapsedMs = Date.now() - startTime;

  const successCount = results.filter(r => r.success).join ? results.filter(r => r.success).length : 0;
  const failCount = results.filter(r => !r.success).length;
  const latencies = results.map(r => r.durationMs);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log(`\n⏱️ KẾT QUẢ GỬI YÊU CẦU ĐỒNG THỜI:`);
  console.log(`   - Tổng thời gian hoàn thành 100 bài: ${totalElapsedMs} ms (${(totalElapsedMs / 1000).toFixed(2)} giây)`);
  console.log(`   - Tốc độ xử lý: ~${Math.round((CONCURRENT_STUDENTS / (totalElapsedMs / 1000)))} bài nộp / giây`);
  console.log(`   - Độ trễ phản hồi: Thấp nhất: ${minLatency}ms | Trung bình: ${avgLatency}ms | Cao nhất: ${maxLatency}ms`);
  console.log(`   - Thành công: ${successCount} / ${CONCURRENT_STUDENTS} (${(successCount / CONCURRENT_STUDENTS * 100).toFixed(1)}%)`);
  if (failCount > 0) {
    console.log(`   - Thất bại / Lỗi: ${failCount} bài`);
  }

  // Bước 4: Kiểm tra Sổ điểm (Gradebook) trên máy chủ
  console.log(`\n📊 [Bước 4/4] Kiểm tra Sổ điểm (Gradebook) trên máy chủ...`);
  const gradebookRes = await fetch(`${baseUrl}/api/exam-submissions?examId=${encodeURIComponent(examId)}`);
  
  if (gradebookRes.ok) {
    const gbData = await gradebookRes.json();
    const serverSubs = Array.isArray(gbData.submissions) ? gbData.submissions : [];
    console.log(`   - Tổng số bài máy chủ ghi nhận được: ${serverSubs.length} / ${CONCURRENT_STUDENTS} bài`);

    if (serverSubs.length === CONCURRENT_STUDENTS) {
      console.log(`   🎉 TUYỆT VỜI: Máy chủ ghi nhận ĐỦ 100% (100/100) bài nộp!`);
      console.log(`   🛡️ Không bài nào bị ghi đè, không bài nào bị thất lạc do xung đột ghi đồng thời.`);
      
      const scores = serverSubs.map(s => s.score);
      const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      console.log(`   - Điểm trung bình lớp ảo: ${avgScore} / 10`);
      console.log(`   - Điểm cao nhất: ${Math.max(...scores)}/10 | Điểm thấp nhất: ${Math.min(...scores)}/10`);
    } else {
      console.warn(`   ⚠️ CẢNH BÁO: Số bài nộp nhận được (${serverSubs.length}) chưa đủ ${CONCURRENT_STUDENTS}!`);
    }
  } else {
    console.warn(`   ⚠️ Không thể truy vấn sổ điểm từ máy chủ: ${gradebookRes.status}`);
  }

  // Bước 5: Dọn dẹp đề thi test để không ảnh hưởng dữ liệu lớp
  console.log(`\n🧹 Đang dọn dẹp đề thi thử nghiệm khỏi hệ thống...`);
  try {
    await fetch(`${baseUrl}/api/exams/${examId}`, { method: 'DELETE' });
    console.log(`✅ Đã xóa đề thi kiểm thử sạch sẽ.`);
  } catch {
    console.log(`ℹ️ Không thể tự động xóa đề thi thử.`);
  }

  if (spawnedServer) {
    spawnedServer.close();
    console.log(`🛑 Đã tắt máy chủ kiểm thử nội bộ.`);
  }

  console.log('\n===============================================================');
  if (successCount === CONCURRENT_STUDENTS) {
    console.log('✅ KẾT LUẬN: HỆ THỐNG ĐÃ SẴN SÀNG 100% CHO BUỔI THI THỨ 4!');
  } else {
    console.log('⚠️ KẾT LUẬN: CẦN KIỂM TRA THÊM CẤU HÌNH TRƯỚC KHI THI THẬT.');
  }
  console.log('===============================================================\n');
}

run().catch((err) => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
