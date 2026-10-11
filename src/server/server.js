/**
 * @file server.js
 * Standalone server runner for Graph Algorithms Platform backend.
 * 
 * Usage:
 *   node src/server/server.js
 * Or:
 *   npm start
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './app.js';

// Natively load .env file if present in project root
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch {
  // Ignore env file reading errors
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ [Lỗi] Cổng ${PORT} hiện đang có một tiến trình Node khác sử dụng.`);
    console.error(`👉 Bạn có thể mở trực tiếp trình duyệt tại: http://localhost:${PORT}`);
    console.error(`Hoặc chạy lệnh sau trong PowerShell để giải phóng cổng:\n`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
  } else {
    console.error('[Backend Error]', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, async () => {
  console.log(`[Backend] Graph Algorithms & Logic Lab server running at http://localhost:${PORT}`);
  console.log(`[Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[Backend] Graph Vision: POST http://localhost:${PORT}/api/graph/analyze`);
  console.log(`[Backend] Logic Vision: POST http://localhost:${PORT}/api/logic/analyze`);

  try {
    const { isAIConfigured } = await import('./ai/AIProviderAdapter.js');
    if (isAIConfigured()) {
      console.log(`[Backend] AI Status: ĐÃ CẤU HÌNH (Sẵn sàng nhận diện biểu thức & trắc nghiệm qua AI Vision) ✓`);
    } else {
      console.warn(`[Backend] AI Status: CHƯA CẤU HÌNH ⚠️ (Chưa tìm thấy GEMINI_API_KEY hợp lệ trong file .env)`);
      console.warn(`[Backend] 👉 Hướng dẫn: Tạo file .env tại thư mục gốc với nội dung: GEMINI_API_KEY=AIzaSy...`);
    }
  } catch {}
});
