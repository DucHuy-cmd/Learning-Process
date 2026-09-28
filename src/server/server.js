/**
 * @file server.js
 * Standalone server runner for Graph Algorithms Platform backend.
 * 
 * Usage:
 *   node src/server/server.js
 * Or:
 *   npm start
 */

import { createServer } from './app.js';


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

server.listen(PORT, HOST, () => {
  console.log(`[Backend] Graph Algorithms AI Vision server running at http://localhost:${PORT}`);
  console.log(`[Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[Backend] Vision endpoint: POST http://localhost:${PORT}/api/graph/analyze`);
});
