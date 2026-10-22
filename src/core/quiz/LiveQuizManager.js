/**
 * @file LiveQuizManager.js
 * Core engine for real-time Kahoot-style Live Quiz (Đấu Trường Trực Tiếp).
 * Handles rooms, 6-digit PIN generation, player state, Kahoot speed scoring,
 * streak bonuses, round statistics, real-time event broadcasting, and Gradebook integration.
 */

export class LiveQuizManager {
  constructor() {
    /** @type {Map<string, Object>} PIN -> Room */
    this.rooms = new Map();
    /** @type {Map<string, Set<Function>>} PIN -> Set of subscriber callbacks */
    this.subscribers = new Map();
  }

  /**
   * Generates a random, collision-free 6-digit PIN string (e.g. "849201").
   * @returns {string}
   */
  generatePin() {
    let pin;
    let attempts = 0;
    do {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      attempts++;
    } while (this.rooms.has(pin) && attempts < 100);
    return pin;
  }

  /**
   * Creates a new Live Quiz Room.
   * @param {Object} options
   * @param {string} options.title
   * @param {string} [options.examId]
   * @param {Array<Object>} options.questions
   * @param {string} options.createdBy
   * @param {number} [options.durationSeconds=30]
   * @returns {{ success: boolean, room?: Object, error?: string }}
   */
  createRoom({ title, examId = null, questions = [], createdBy, durationSeconds = 30 }) {
    if (!title || typeof title !== 'string') {
      return { success: false, error: 'Tiêu đề phòng Live Quiz không được để trống.' };
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return { success: false, error: 'Phòng Live Quiz cần có ít nhất 1 câu hỏi.' };
    }

    const pin = this.generatePin();
    const normalizedQuestions = questions.map((q, idx) => ({
      id: q.id || `q_${idx + 1}`,
      question: q.question || '',
      topic: q.topic || 'general',
      topicName: q.topicName || q.topic || 'Toán Rời Rạc',
      options: (q.options || []).map((opt, oIdx) => ({
        id: opt.id || String.fromCharCode(65 + oIdx),
        text: opt.text || '',
      })),
      correctId: q.correctId || 'A',
      explanation: q.explanation || '',
    }));

    const room = {
      pin,
      title: title.trim(),
      examId,
      createdBy,
      status: 'lobby', // 'lobby' | 'in_question' | 'round_result' | 'leaderboard' | 'finished'
      questions: normalizedQuestions,
      currentQIndex: 0,
      questionDuration: Math.max(10, Math.min(120, Number(durationSeconds) || 30)),
      questionStartedAt: null,
      participants: {}, // userId -> { id, username, fullName, className, score, streak, lastPoints, lastCorrect }
      answers: {}, // qIndex -> { userId -> { optionId, isCorrect, points, elapsedMs, answeredAt } }
      createdAt: Date.now(),
      updatedAt: Date.now(),
      savedToGradebook: false,
    };

    this.rooms.set(pin, room);
    this.subscribers.set(pin, new Set());
    return { success: true, room: this.getPublicRoomState(pin) };
  }

  /**
   * Retrieves raw room by PIN.
   * @param {string} pin
   * @returns {Object|null}
   */
  getRoom(pin) {
    if (!pin) return null;
    const cleanPin = String(pin).trim();
    return this.rooms.get(cleanPin) || null;
  }

  /**
   * Subscribes a listener to room state updates (used by SSE).
   * @param {string} pin
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(pin, callback) {
    const cleanPin = String(pin).trim();
    if (!this.subscribers.has(cleanPin)) {
      this.subscribers.set(cleanPin, new Set());
    }
    const set = this.subscribers.get(cleanPin);
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  }

  /**
   * Broadcasts an event to all connected room subscribers.
   * @param {string} pin
   * @param {string} event
   * @param {Object} [extraData={}]
   */
  broadcast(pin, event, extraData = {}) {
    const cleanPin = String(pin).trim();
    const set = this.subscribers.get(cleanPin);
    if (!set || set.size === 0) return;

    const payload = {
      event,
      pin: cleanPin,
      timestamp: Date.now(),
      room: this.getPublicRoomState(cleanPin),
      ...extraData,
    };

    for (const cb of set) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[LiveQuiz broadcast error] PIN ${cleanPin}:`, err);
      }
    }
  }

  /**
   * Returns a sanitized room state tailored for the requester.
   * Strips correctId during 'in_question' unless requester is the host.
   * @param {string} pin
   * @param {string} [requesterUserId]
   * @returns {Object|null}
   */
  getPublicRoomState(pin, requesterUserId = null) {
    const room = this.getRoom(pin);
    if (!room) return null;

    const isHost = requesterUserId && room.createdBy === requesterUserId;
    const currentQ = room.questions[room.currentQIndex] || null;

    let sanitizedCurrentQ = null;
    if (currentQ) {
      sanitizedCurrentQ = {
        id: currentQ.id,
        question: currentQ.question,
        topic: currentQ.topic,
        topicName: currentQ.topicName,
        options: currentQ.options,
        // Only host sees correctId during question; players see it only in round_result or finished
        correctId: (isHost || room.status === 'round_result' || room.status === 'finished')
          ? currentQ.correctId
          : undefined,
      };
    }

    const participantsList = Object.values(room.participants).map(p => ({
      id: p.id,
      username: p.username,
      fullName: p.fullName,
      className: p.className,
      score: p.score,
      streak: p.streak,
      lastPoints: p.lastPoints,
      lastCorrect: p.lastCorrect,
    }));

    // Calculate current question answer statistics
    const currentQAnswers = room.answers[room.currentQIndex] || {};
    const answeredCount = Object.keys(currentQAnswers).length;
    const totalParticipants = Object.keys(room.participants).length;

    // Option distribution for host or round_result
    const optionStats = {};
    if (currentQ) {
      currentQ.options.forEach(opt => { optionStats[opt.id] = 0; });
      Object.values(currentQAnswers).forEach(ans => {
        if (optionStats[ans.optionId] !== undefined) {
          optionStats[ans.optionId]++;
        }
      });
    }

    return {
      pin: room.pin,
      title: room.title,
      examId: room.examId,
      createdBy: room.createdBy,
      status: room.status,
      currentQIndex: room.currentQIndex,
      totalQuestions: room.questions.length,
      currentQuestion: sanitizedCurrentQ,
      questionDuration: room.questionDuration,
      questionStartedAt: room.questionStartedAt,
      timeRemaining: room.questionStartedAt
        ? Math.max(0, Math.ceil(room.questionDuration - (Date.now() - room.questionStartedAt) / 1000))
        : room.questionDuration,
      participants: participantsList,
      totalParticipants,
      answeredCount,
      leaderboard: this.getLeaderboard(room.pin),
      optionStats: (isHost || room.status === 'round_result' || room.status === 'finished') ? optionStats : undefined,
      isHost: Boolean(isHost),
      savedToGradebook: room.savedToGradebook,
    };
  }

  /**
   * Player joins the room by PIN using their logged-in account.
   * @param {string} pin
   * @param {Object} user
   * @returns {{ success: boolean, room?: Object, error?: string }}
   */
  joinRoom(pin, user) {
    const room = this.getRoom(pin);
    if (!room) {
      return { success: false, error: 'Mã PIN phòng Live Quiz không tồn tại hoặc đã đóng.' };
    }
    if (room.status === 'finished') {
      return { success: false, error: 'Trận đấu Live Quiz này đã kết thúc.' };
    }
    if (!user || !user.id) {
      return { success: false, error: 'Vui lòng đăng nhập tài khoản để tham gia Live Quiz.' };
    }

    if (!room.participants[user.id]) {
      room.participants[user.id] = {
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.username,
        className: user.className || '',
        score: 0,
        streak: 0,
        lastPoints: 0,
        lastCorrect: null,
        joinedAt: Date.now(),
      };
    }

    room.updatedAt = Date.now();
    this.broadcast(room.pin, 'PLAYER_JOINED', {
      player: {
        id: user.id,
        username: user.username,
        fullName: user.fullName || user.username,
      },
      totalParticipants: Object.keys(room.participants).length,
    });

    return { success: true, room: this.getPublicRoomState(room.pin, user.id) };
  }

  /**
   * Host starts a question round.
   * @param {string} pin
   * @param {string} hostUserId
   * @returns {{ success: boolean, error?: string }}
   */
  startQuestion(pin, hostUserId) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.createdBy !== hostUserId) {
      return { success: false, error: 'Chỉ Giảng viên tạo phòng mới có quyền bắt đầu câu hỏi.' };
    }
    if (room.currentQIndex >= room.questions.length) {
      return { success: false, error: 'Đã hết danh sách câu hỏi.' };
    }

    room.status = 'in_question';
    room.questionStartedAt = Date.now();
    room.updatedAt = Date.now();
    if (!room.answers[room.currentQIndex]) {
      room.answers[room.currentQIndex] = {};
    }

    this.broadcast(room.pin, 'QUESTION_STARTED', {
      currentQIndex: room.currentQIndex,
      totalQuestions: room.questions.length,
      questionDuration: room.questionDuration,
      questionStartedAt: room.questionStartedAt,
    });

    return { success: true, room: this.getPublicRoomState(room.pin, hostUserId) };
  }

  /**
   * Player submits an answer to the current question.
   * Calculates Kahoot speed-based score + streak bonus.
   * @param {string} pin
   * @param {string} userId
   * @param {string} optionId
   * @returns {{ success: boolean, points?: number, isCorrect?: boolean, streak?: number, error?: string }}
   */
  submitAnswer(pin, userIdOrPayload, maybeOptionId = null) {
    let userId = userIdOrPayload;
    let optionId = maybeOptionId;
    if (userIdOrPayload && typeof userIdOrPayload === 'object') {
      userId = userIdOrPayload.userId;
      optionId = userIdOrPayload.optionId;
    }

    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.status !== 'in_question') {
      return { success: false, error: 'Hiện tại chưa mở nhận đáp án hoặc đã hết giờ làm bài câu này.' };
    }

    const participant = room.participants[userId];
    if (!participant) {
      return { success: false, error: 'Bạn chưa tham gia vào phòng đấu này.' };
    }

    const qIndex = room.currentQIndex;
    if (!room.answers[qIndex]) {
      room.answers[qIndex] = {};
    }

    // Only allow one answer per question
    if (room.answers[qIndex][userId]) {
      return { success: false, error: 'Bạn đã nộp đáp án cho câu này rồi.' };
    }

    const currentQ = room.questions[qIndex];
    if (!currentQ) {
      return { success: false, error: 'Không tìm thấy câu hỏi hiện tại.' };
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - (room.questionStartedAt || now));
    const durationMs = room.questionDuration * 1000;
    const isCorrect = currentQ.correctId === optionId;

    let points = 0;
    if (isCorrect) {
      // Kahoot speed formula: Max 1000 pts down to 500 pts at timeout limit
      const fraction = Math.min(1, elapsedMs / (2 * durationMs));
      const basePoints = Math.round(1000 * (1 - fraction));
      // Streak bonus: +50 pts per streak up to 250 pts
      const streakBonus = participant.streak >= 2 ? Math.min(250, participant.streak * 50) : 0;
      points = Math.max(500, basePoints) + streakBonus;

      participant.streak++;
      participant.score += points;
      participant.lastPoints = points;
      participant.lastCorrect = true;
    } else {
      participant.streak = 0;
      participant.lastPoints = 0;
      participant.lastCorrect = false;
    }

    room.answers[qIndex][userId] = {
      optionId,
      isCorrect,
      points,
      elapsedMs,
      answeredAt: now,
    };

    room.updatedAt = now;
    const answeredCount = Object.keys(room.answers[qIndex]).length;
    const totalParticipants = Object.keys(room.participants).length;

    this.broadcast(room.pin, 'ANSWER_SUBMITTED', {
      answeredCount,
      totalParticipants,
      userId,
    });

    return {
      success: true,
      points,
      isCorrect,
      streak: participant.streak,
      totalScore: participant.score,
    };
  }

  /**
   * Host ends the question round and reveals correct answer and response distribution.
   * @param {string} pin
   * @param {string} hostUserId
   * @returns {{ success: boolean, error?: string }}
   */
  endRound(pin, hostUserId) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.createdBy !== hostUserId) {
      return { success: false, error: 'Chỉ Giảng viên mới có quyền kết thúc vòng đấu.' };
    }

    room.status = 'round_result';
    room.updatedAt = Date.now();

    const currentQ = room.questions[room.currentQIndex];
    const correctId = currentQ ? currentQ.correctId : null;

    this.broadcast(room.pin, 'ROUND_ENDED', {
      currentQIndex: room.currentQIndex,
      correctId,
    });

    return { success: true, room: this.getPublicRoomState(room.pin, hostUserId) };
  }

  /**
   * Returns sorted leaderboard for the room.
   * @param {string} pin
   * @returns {Array<Object>}
   */
  getLeaderboard(pin) {
    const room = this.getRoom(pin);
    if (!room) return [];

    const sorted = Object.values(room.participants)
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);

    return sorted.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      username: p.username,
      fullName: p.fullName,
      className: p.className,
      score: p.score,
      streak: p.streak,
      lastPoints: p.lastPoints,
      lastCorrect: p.lastCorrect,
    }));
  }

  /**
   * Host transitions to leaderboard display.
   * @param {string} pin
   * @param {string} hostUserId
   * @returns {{ success: boolean, leaderboard?: Array<Object>, error?: string }}
   */
  showLeaderboard(pin, hostUserId) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.createdBy !== hostUserId) {
      return { success: false, error: 'Chỉ Giảng viên mới có quyền mở Bảng Vàng.' };
    }

    room.status = 'leaderboard';
    room.updatedAt = Date.now();
    const leaderboard = this.getLeaderboard(room.pin);

    this.broadcast(room.pin, 'LEADERBOARD_UPDATED', {
      leaderboard: leaderboard.slice(0, 10), // Top 10
    });

    return { success: true, leaderboard, room: this.getPublicRoomState(room.pin, hostUserId) };
  }

  /**
   * Advances to next question, or finishes game if this was the last question.
   * @param {string} pin
   * @param {string} hostUserId
   * @returns {{ success: boolean, finished?: boolean, error?: string }}
   */
  nextQuestion(pin, hostUserId) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.createdBy !== hostUserId) {
      return { success: false, error: 'Chỉ Giảng viên mới có quyền chuyển câu hỏi.' };
    }

    if (room.currentQIndex < room.questions.length - 1) {
      room.currentQIndex++;
      room.status = 'in_question';
      room.questionStartedAt = Date.now();
      room.updatedAt = Date.now();
      if (!room.answers[room.currentQIndex]) {
        room.answers[room.currentQIndex] = {};
      }

      this.broadcast(room.pin, 'QUESTION_STARTED', {
        currentQIndex: room.currentQIndex,
        totalQuestions: room.questions.length,
        questionDuration: room.questionDuration,
        questionStartedAt: room.questionStartedAt,
      });

      return { success: true, finished: false, room: this.getPublicRoomState(room.pin, hostUserId) };
    }

    // Game finished -> Podium
    room.status = 'finished';
    room.updatedAt = Date.now();
    const leaderboard = this.getLeaderboard(room.pin);

    this.broadcast(room.pin, 'GAME_FINISHED', {
      podium: leaderboard.slice(0, 3),
      leaderboard,
    });

    return { success: true, finished: true, room: this.getPublicRoomState(room.pin, hostUserId) };
  }

  /**
   * Host saves final Live Quiz results directly into ExamManager Gradebook (Scale 10).
   * @param {string} pin
   * @param {string} hostUserId
   * @param {Object} examManager
   * @returns {{ success: boolean, count?: number, error?: string }}
   */
  saveToGradebook(pin, hostUserId, examManager) {
    const room = this.getRoom(pin);
    if (!room) return { success: false, error: 'Phòng không tồn tại.' };
    if (room.createdBy !== hostUserId) {
      return { success: false, error: 'Chỉ Giảng viên mới có quyền lưu điểm vào Sổ điểm.' };
    }
    if (!examManager || typeof examManager.submitExam !== 'function') {
      return { success: false, error: 'Không tìm thấy hệ thống ExamManager.' };
    }

    const leaderboard = this.getLeaderboard(room.pin);
    const totalQ = room.questions.length || 1;
    let savedCount = 0;

    // Use linked examId or create a designated live quiz exam id
    const examId = room.examId || `live_quiz_${room.pin}`;

    // Ensure designated live quiz exam exists in examManager if not already there
    if (!examManager.getExamById(examId)) {
      examManager.createExam({
        id: examId,
        title: `[Live Quiz] ${room.title} (PIN: ${room.pin})`,
        customQuestions: room.questions,
        questionIds: room.questions.map(q => q.id),
        durationMinutes: Math.max(5, Math.ceil((totalQ * room.questionDuration) / 60)),
        assignedTo: ['all'],
        createdBy: hostUserId,
      });
    }

    for (const player of leaderboard) {
      // Reconstruct answers dict and count correct
      const userAnswers = {};
      let correctCount = 0;

      for (let qIdx = 0; qIdx < totalQ; qIdx++) {
        const q = room.questions[qIdx];
        const ans = room.answers[qIdx]?.[player.id];
        if (ans) {
          userAnswers[q.id] = ans.optionId;
          if (ans.isCorrect) correctCount++;
        }
      }

      const res = examManager.submitExam({
        examId,
        userId: player.id,
        userInfo: {
          username: player.username,
          fullName: player.fullName,
          className: player.className,
        },
        answers: userAnswers,
        timeSpentSeconds: totalQ * room.questionDuration,
        note: `Đấu trường Live Quiz (Hạng #${player.rank}, Điểm Kahoot: ${player.score})`,
      });

      if (res && res.success) {
        savedCount++;
      }
    }

    room.savedToGradebook = true;
    room.updatedAt = Date.now();
    return { success: true, count: savedCount };
  }
}

// Global Singleton Instance
export const liveQuizManager = new LiveQuizManager();
