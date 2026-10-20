import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import { handleRequest } from '../../src/server/app.js';
import { serverImportedFiles, saveDatabase } from '../../src/server/auth/ServerDataStore.js';
import { CloudSyncManager } from '../../src/core/sync/CloudSyncManager.js';

describe('Multi-Device Cloud Sync for Imported Word Files & Questions', () => {
  let server;
  let baseUrl;
  let port;

  beforeEach(async () => {
    serverImportedFiles.length = 0;

    server = http.createServer(async (req, res) => {
      try {
        await handleRequest(req, res);
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    serverImportedFiles.length = 0;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('API Endpoints: /api/quiz/imported-files', () => {
    it('GET /api/quiz/imported-files returns empty array initially', async () => {
      const res = await fetch(`${baseUrl}/api/quiz/imported-files`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.files)).toBe(true);
      expect(data.files.length).toBe(0);
    });

    it('POST /api/quiz/imported-files rejects invalid file payload', async () => {
      const res = await fetch(`${baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('POST /api/quiz/imported-files pushes single file entry successfully', async () => {
      const newFile = {
        id: 'file_test_001',
        name: 'De_Thi_Giua_Ky_Toan_Roi_Rac.docx',
        uploadedAt: new Date().toISOString(),
        questionCount: 2,
        questions: [
          {
            id: 'q_1',
            question: 'Mệnh đề P -> Q sai khi nào?',
            options: ['P đúng, Q sai', 'P sai, Q đúng', 'P đúng, Q đúng', 'P sai, Q sai'],
            correctId: 'A',
          },
          {
            id: 'q_2',
            question: 'Số hoán vị của 5 phần tử là bao nhiêu?',
            options: ['24', '120', '720', '60'],
            correctId: 'B',
          },
        ],
      };

      const res = await fetch(`${baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: newFile }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.file.id).toBe('file_test_001');
      expect(data.files.length).toBe(1);
      expect(data.files[0].name).toBe('De_Thi_Giua_Ky_Toan_Roi_Rac.docx');
      expect(serverImportedFiles.length).toBe(1);
    });

    it('POST /api/quiz/imported-files supports batch upload and merges files without duplicating', async () => {
      const batchFiles = [
        {
          id: 'file_b1',
          name: 'Chuong1_Logic.docx',
          questionCount: 5,
          questions: [{ id: 'q_logic_1', question: 'Logic question 1' }],
        },
        {
          id: 'file_b2',
          name: 'Chuong2_ToHop.docx',
          questionCount: 10,
          questions: [{ id: 'q_tohop_1', question: 'Counting question 1' }],
        },
      ];

      const res = await fetch(`${baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: batchFiles }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.files.length).toBe(2);

      // Re-uploading with updated questions should update in place
      const updatedBatch = [
        {
          id: 'file_b1',
          name: 'Chuong1_Logic.docx',
          questionCount: 6,
          questions: [{ id: 'q_logic_1' }, { id: 'q_logic_2' }],
        },
      ];

      const res2 = await fetch(`${baseUrl}/api/quiz/imported-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: updatedBatch }),
      });
      const data2 = await res2.json();
      expect(data2.files.length).toBe(2);
      const file1 = data2.files.find(f => f.id === 'file_b1');
      expect(file1.questionCount).toBe(2);
    });

    it('DELETE /api/quiz/imported-files/:id removes file from cloud repository', async () => {
      serverImportedFiles.push(
        { id: 'f_del_1', name: 'File1.docx', questionCount: 1, questions: [] },
        { id: 'f_del_2', name: 'File2.docx', questionCount: 2, questions: [] }
      );

      const res = await fetch(`${baseUrl}/api/quiz/imported-files/f_del_1`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.deletedId).toBe('f_del_1');
      expect(serverImportedFiles.length).toBe(1);
      expect(serverImportedFiles[0].id).toBe('f_del_2');
    });

    it('DELETE /api/quiz/imported-files/:id returns 404 for non-existent file', async () => {
      const res = await fetch(`${baseUrl}/api/quiz/imported-files/f_unknown_999`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('POST /api/quiz/imported-files/clear-all clears all cloud files', async () => {
      serverImportedFiles.push({ id: 'f1', name: 'F1.docx' }, { id: 'f2', name: 'F2.docx' });
      const res = await fetch(`${baseUrl}/api/quiz/imported-files/clear-all`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(serverImportedFiles.length).toBe(0);
    });
  });

  describe('CloudSyncManager integration with Imported Files', () => {
    it('syncImportedFiles(), pushImportedFile(), pushBatchImportedFiles() work end-to-end', async () => {
      const syncManager = new CloudSyncManager({ baseUrl });

      // 1. Initially empty
      const initialFiles = await syncManager.syncImportedFiles();
      expect(initialFiles).toEqual([]);

      // 2. Push single file
      const newFile = {
        id: 'file_cloud_sync_1',
        name: 'DeThiMau.docx',
        questionCount: 3,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
      };
      const pushRes = await syncManager.pushImportedFile(newFile);
      expect(pushRes.success).toBe(true);

      // 3. Sync from another simulated client (e.g. mobile client)
      const mobileSyncManager = new CloudSyncManager({ baseUrl });
      const syncedOnMobile = await mobileSyncManager.syncImportedFiles();
      expect(syncedOnMobile.length).toBe(1);
      expect(syncedOnMobile[0].name).toBe('DeThiMau.docx');
      expect(syncedOnMobile[0].questionCount).toBe(3);

      // 4. Mobile pushes another file
      await mobileSyncManager.pushImportedFile({
        id: 'file_cloud_sync_2',
        name: 'DeThiMobile.docx',
        questionCount: 4,
        questions: [{ id: 'qm1' }],
      });

      // 5. PC syncs and gets both files
      const pcSynced = await syncManager.syncImportedFiles();
      expect(pcSynced.length).toBe(2);

      // 6. Delete file
      const delRes = await syncManager.pushDeleteImportedFile('file_cloud_sync_1');
      expect(delRes.success).toBe(true);

      const afterDel = await mobileSyncManager.syncImportedFiles();
      expect(afterDel.length).toBe(1);
      expect(afterDel[0].id).toBe('file_cloud_sync_2');
    });
  });
});
