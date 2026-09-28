/**
 * @file AiHistoryManager.js
 * Multi-session AI Chat History Manager with Lab Snapshots & Account Association.
 * 
 * Features:
 * - Sessions indexed by userId (supports guest & logged-in accounts).
 * - Full conversation message history persistence with KaTeX & LaTeX preserved.
 * - Lab Snapshot retention (Graph, Logic, Counting, Relation) so users can reload labs with 1 click.
 * - JSON Export / Import for sharing study sessions across team members.
 */

const STORAGE_KEY_SESSIONS = 'trr_ai_sessions_v1';

export class AiHistoryManager {
  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage]
   */
  constructor(options = {}) {
    this.storage = options.storage || null;
  }

  _getStorage() {
    return this.storage || (typeof window !== 'undefined' ? window.localStorage : null) || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  /**
   * Reads raw sessions dictionary from storage.
   * @private
   * @returns {Record<string, Object>}
   */
  _readAll() {
    const storage = this._getStorage();
    if (!storage) return {};
    try {
      const raw = storage.getItem(STORAGE_KEY_SESSIONS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Writes raw sessions dictionary to storage.
   * @private
   * @param {Record<string, Object>} sessionsMap
   */
  _writeAll(sessionsMap) {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsMap));
    } catch (err) {
      console.error('[AiHistoryManager] Failed to persist sessions:', err);
    }
  }

  /**
   * Returns list of sessions belonging to a specific user (or 'guest'), sorted by latest update.
   * @param {string} [userId='guest']
   * @returns {Array<Object>}
   */
  getUserSessions(userId = 'guest') {
    const all = this._readAll();
    const list = Object.values(all).filter(s => (s.userId || 'guest') === userId);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Gets a specific session by its ID.
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getSession(sessionId) {
    const all = this._readAll();
    return all[sessionId] || null;
  }

  /**
   * Creates a new conversation session.
   * @param {string} userId
   * @param {Object} data
   * @param {string} [data.title]
   * @param {string} [data.mode='bridge'] - 'bridge' | 'theory' | 'hint'
   * @param {Array<Object>} [data.messages=[]]
   * @param {Object} [data.labSnapshot]
   * @returns {Object} Newly created session
   */
  createSession(userId = 'guest', data = {}) {
    const all = this._readAll();
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const title = data.title || (data.messages && data.messages.length > 0 && data.messages[0].text
      ? data.messages[0].text.slice(0, 38).trim() + '...'
      : 'Hội thoại mới');

    const session = {
      id,
      userId: userId || 'guest',
      title,
      mode: data.mode || 'bridge',
      messages: data.messages || [],
      labSnapshot: data.labSnapshot || null,
      createdAt: now,
      updatedAt: now,
    };

    all[id] = session;
    this._writeAll(all);
    return session;
  }

  /**
   * Updates an existing session with new messages, mode, title, or lab snapshot.
   * @param {string} sessionId
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateSession(sessionId, updates = {}) {
    const all = this._readAll();
    if (!all[sessionId]) return null;

    const existing = all[sessionId];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Auto-derive title from first user prompt if still default
    if ((!updated.title || updated.title === 'Hội thoại mới') && updated.messages && updated.messages.length > 0) {
      const firstUserMsg = updated.messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.text) {
        updated.title = firstUserMsg.text.replace(/^[#\s]+/, '').slice(0, 42).trim() + '...';
      }
    }

    all[sessionId] = updated;
    this._writeAll(all);
    return updated;
  }

  /**
   * Deletes a session by ID.
   * @param {string} sessionId
   * @returns {boolean}
   */
  deleteSession(sessionId) {
    const all = this._readAll();
    if (!all[sessionId]) return false;

    delete all[sessionId];
    this._writeAll(all);
    return true;
  }

  /**
   * Clears all sessions for a specific user.
   * @param {string} userId
   */
  clearUserSessions(userId = 'guest') {
    const all = this._readAll();
    let changed = false;

    for (const id of Object.keys(all)) {
      if ((all[id].userId || 'guest') === userId) {
        delete all[id];
        changed = true;
      }
    }

    if (changed) {
      this._writeAll(all);
    }
  }

  /**
   * Exports a session to JSON string for backup or sharing.
   * @param {string} sessionId
   * @returns {string|null}
   */
  exportSessionJson(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  /**
   * Imports a shared session JSON and saves it under target user.
   * @param {string} jsonStr
   * @param {string} targetUserId
   * @returns {Object|null}
   */
  importSessionJson(jsonStr, targetUserId = 'guest') {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !Array.isArray(parsed.messages)) {
        return null;
      }
      return this.createSession(targetUserId, {
        title: `[Nhập] ${parsed.title || 'Bài toán chia sẻ'}`,
        mode: parsed.mode || 'bridge',
        messages: parsed.messages,
        labSnapshot: parsed.labSnapshot || null,
      });
    } catch {
      return null;
    }
  }
}

// Global Singleton instance
export const aiHistoryManager = new AiHistoryManager();
