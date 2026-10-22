/**
 * @vitest-environment jsdom
 * @file LiveQuizArena.test.js
 * End-to-end UI integration tests for Live Quiz (Kahoot / Quizizz Realtime Arena) in QuizView:
 * - Join banner rendering in MyExams
 * - Live Quiz studio subtab & room creation
 * - Host arena: Lobby -> In Question -> Round Result -> Leaderboard -> Podium
 * - Player arena: Lobby -> In Question (4 colored shapes) -> Round Result -> Leaderboard -> Podium
 * - Auto-save to Gradebook (Scale 10)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizView } from '../../src/ui/views/QuizView.js';
import { liveQuizManager } from '../../src/core/quiz/LiveQuizManager.js';
import { examManager } from '../../src/core/quiz/ExamManager.js';
import { authManager } from '../../src/core/auth/AuthManager.js';

describe('Live Quiz Kahoot UI & Realtime Arena Integration', () => {
  let container;
  let quizView;

  const sampleQuestions = [
    {
      id: 'lq_q1',
      question: 'Định lý Dirac: Đồ thị đơn n đỉnh (n >= 3) có deg(v) >= n/2 thì có chu trình gì?',
      options: [
        { id: 'A', text: 'Hamilton' },
        { id: 'B', text: 'Euler' },
        { id: 'C', text: 'Đẳng cấu' },
        { id: 'D', text: 'Phẳng' },
      ],
      correctId: 'A',
      explanation: 'Định lý Dirac khẳng định tồn tại chu trình Hamilton.',
    },
    {
      id: 'lq_q2',
      question: 'Thuật toán Dijkstra không hoạt động đúng trên đồ thị có đặc điểm nào?',
      options: [
        { id: 'A', text: 'Trọng số âm' },
        { id: 'B', text: 'Có hướng' },
        { id: 'C', text: 'Vô hướng' },
        { id: 'D', text: 'Đồ thị thưa' },
      ],
      correctId: 'A',
      explanation: 'Dijkstra yêu cầu tất cả trọng số cung/cạnh phải không âm (>= 0).',
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    window.alert = vi.fn();
    liveQuizManager.rooms.clear();
    liveQuizManager.subscribers.clear();
    examManager.exams = [];
    examManager.submissions = [];

    // Setup admin user
    authManager.currentUser = {
      id: 'teacher_host',
      username: 'teacher',
      fullName: 'TS. Nguyễn Văn Giáo',
      role: 'admin',
    };
  });

  afterEach(() => {
    if (quizView) {
      quizView._disconnectLiveQuiz();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it('1. Renders Live Quiz Join Banner in MyExams view for all users', () => {
    quizView = new QuizView({ container });
    quizView.activeTab = 'myExams';
    quizView.render();

    const banner = container.querySelector('.live-quiz-join-banner');
    expect(banner).not.toBeNull();

    const pinInput = container.querySelector('#inputLiveQuizPin');
    const joinBtn = container.querySelector('#btnJoinLiveQuiz');
    expect(pinInput).not.toBeNull();
    expect(joinBtn).not.toBeNull();
    expect(joinBtn.textContent).toContain('Vào Phòng Thi');
  });

  it('2. Admin can open Studio Tab 4 (Live Quiz) and see creation form', () => {
    quizView = new QuizView({ container });
    quizView.activeTab = 'studio';
    quizView.setStudioSubTab('liveQuiz');
    quizView.render();

    const tabLive = container.querySelector('#tabStudioLiveQuiz');
    expect(tabLive).not.toBeNull();

    const sourceSelect = container.querySelector('#selectLiveQuizSource');
    const titleInput = container.querySelector('#inputLiveQuizTitle');
    const durSelect = container.querySelector('#selectLiveQuizDuration');
    const createBtn = container.querySelector('#btnCreateLiveQuizFromStudio');

    expect(sourceSelect).not.toBeNull();
    expect(titleInput).not.toBeNull();
    expect(durSelect).not.toBeNull();
    expect(createBtn).not.toBeNull();
  });

  it('3. Host creates room and enters Lobby view with 6-digit PIN', async () => {
    quizView = new QuizView({ container });

    const createRes = await quizView._apiLiveQuizCreate({
      title: 'Đấu trường K65',
      questions: sampleQuestions,
      createdBy: 'teacher_host',
      durationSeconds: 20,
    });

    expect(createRes.success).toBe(true);
    const pin = createRes.room.pin;
    expect(pin).toMatch(/^\d{6}$/);

    quizView.liveQuizRoom = createRes.room;
    quizView.liveQuizRole = 'host';
    quizView._connectLiveQuiz(pin, 'teacher_host');
    quizView.render();

    const pinDisplay = container.querySelector('#liveQuizDisplayPin');
    expect(pinDisplay).not.toBeNull();
    expect(pinDisplay.textContent.trim()).toBe(pin);

    const startBtn = container.querySelector('#btnHostStartGame');
    expect(startBtn).not.toBeNull();
    expect(startBtn.textContent).toContain('BẮT ĐẦU ĐẤU TRƯỜNG');
  });

  it('4. Student enters PIN and joins Player Lobby', async () => {
    // 1. Host creates room
    const createRes = liveQuizManager.createRoom({
      title: 'Đấu Trường Sinh Viên',
      questions: sampleQuestions,
      createdBy: 'teacher_host',
    });
    const pin = createRes.room.pin;

    // 2. Student logs in
    authManager.currentUser = {
      id: 'sv_hoang',
      username: 'hoang_k65',
      fullName: 'Hoàng Minh Tuấn',
      className: 'K65-CNTT',
      role: 'student',
    };

    quizView = new QuizView({ container });
    quizView.activeTab = 'myExams';
    quizView.render();

    // Type PIN and join
    const pinInput = container.querySelector('#inputLiveQuizPin');
    pinInput.value = pin;
    await quizView._joinLiveQuiz(pin);

    expect(quizView.liveQuizRole).toBe('player');
    expect(quizView.liveQuizRoom.pin).toBe(pin);

    const playerLobbyText = container.textContent;
    expect(playerLobbyText).toContain('Đã Vào Phòng: Đấu Trường Sinh Viên');
    expect(playerLobbyText).toContain('Hoàng Minh Tuấn');
    expect(playerLobbyText).toContain('Hãy nhìn lên màn chiếu của Giảng viên');
  });

  it('5. Full game loop: Host starts Q1 -> Player answers -> Host ends round -> Leaderboard -> Podium & Gradebook', async () => {
    // 1. Create Room
    const createRes = liveQuizManager.createRoom({
      title: 'Đấu Trường Chung Kết',
      questions: sampleQuestions,
      createdBy: 'teacher_host',
      durationSeconds: 30,
    });
    const pin = createRes.room.pin;

    // 2. Player joins room
    const studentUser = {
      id: 'sv_linh',
      username: 'linh_k65',
      fullName: 'Vũ Thùy Linh',
      className: 'K65-KHMT',
      role: 'student',
    };
    liveQuizManager.joinRoom(pin, studentUser);

    // 3. Initialize Host QuizView
    authManager.currentUser = { id: 'teacher_host', username: 'teacher', role: 'admin' };
    const hostView = new QuizView({ container });
    hostView.liveQuizRoom = liveQuizManager.getPublicRoomState(pin, 'teacher_host');
    hostView.liveQuizRole = 'host';
    hostView._connectLiveQuiz(pin, 'teacher_host');
    hostView.render();

    // 4. Host starts Question 1
    await hostView._hostStartQuestion();
    expect(hostView.liveQuizRoom.status).toBe('in_question');
    expect(container.querySelector('#liveQuizTimerDisplay')).not.toBeNull();
    expect(container.textContent).toContain('Định lý Dirac');

    // 5. Setup Player QuizView in another container
    const playerContainer = document.createElement('div');
    document.body.appendChild(playerContainer);

    authManager.currentUser = studentUser;
    const playerView = new QuizView({ container: playerContainer });
    playerView.liveQuizRoom = liveQuizManager.getPublicRoomState(pin, studentUser.id);
    playerView.liveQuizRole = 'player';
    playerView._connectLiveQuiz(pin, studentUser.id);
    playerView.render();

    // Verify 4 giant shapes appear on mobile player
    const shapes = playerContainer.querySelectorAll('.btn-player-shape');
    expect(shapes.length).toBe(4);

    // Player taps Option 'A' (correct for Q1)
    await playerView._playerAnswer('A');
    expect(playerView.liveQuizSelectedOption).toBe('A');
    expect(playerContainer.textContent).toContain('ĐÃ CHỌN ĐÁP ÁN: A');

    // 6. Host ends round
    authManager.currentUser = { id: 'teacher_host', username: 'teacher', role: 'admin' };
    await hostView._hostEndRound();
    expect(hostView.liveQuizRoom.status).toBe('round_result');
    expect(hostView.liveQuizRoom.optionStats.A).toBe(1);

    // Player checks round result (Green card, Points)
    playerView._handleLiveRoomUpdate(liveQuizManager.getPublicRoomState(pin, studentUser.id));
    expect(playerContainer.textContent).toContain('CHÍNH XÁC');

    // 7. Host shows Leaderboard
    await hostView._hostShowLeaderboard();
    expect(hostView.liveQuizRoom.status).toBe('leaderboard');
    expect(container.textContent).toContain('BẢNG VÀNG DẪN ĐẦU');
    expect(container.textContent).toContain('Vũ Thùy Linh');

    // 8. Host advances past Q2 to Podium
    // Q2
    await hostView._hostNextQuestion();
    expect(hostView.liveQuizRoom.currentQIndex).toBe(1);
    await hostView._hostEndRound();
    await hostView._hostNextQuestion(); // finishes game

    expect(hostView.liveQuizRoom.status).toBe('finished');
    expect(container.querySelector('.live-podium')).not.toBeNull();
    expect(container.textContent).toContain('BỤC VINH QUANG CHUNG CUỘC');

    // 9. Host saves results to Gradebook
    await hostView._hostSaveGradebook();
    expect(hostView.liveQuizRoom.savedToGradebook).toBe(true);

    // Check submission in ExamManager
    const submissions = examManager.getSubmissions();
    expect(submissions.length).toBe(1);
    expect(submissions[0].userId).toBe('sv_linh');
    expect(submissions[0].note).toContain('Hạng #1');

    // Cleanup playerContainer
    playerView._disconnectLiveQuiz();
    if (playerContainer.parentNode) {
      playerContainer.parentNode.removeChild(playerContainer);
    }
  });
});
