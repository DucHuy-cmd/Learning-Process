/**
 * @file app.js
 * Main UI Application Coordinator
 * 
 * Sets up routing, view switching (Home, Theory, Lab, AI), theme toggling,
 * and initializes application views.
 */

import { HomeView } from './views/HomeView.js';
import { TheoryView } from './views/TheoryView.js';
import { LabView } from './views/LabView.js';
import { AiAssistantView } from './views/AiAssistantView.js';
import { FundamentalsView } from './views/FundamentalsView.js';
import { LogicLabView } from './views/LogicLabView.js';
import { QuizView } from './views/QuizView.js';
import { CountingLabView } from './views/CountingLabView.js';
import { RelationLabView } from './views/RelationLabView.js';
import { AdminView } from './views/AdminView.js';
import { TeacherAnnotationTool } from './components/TeacherAnnotationTool.js';
import { HelpGuideModal } from './components/HelpGuideModal.js';
import { AuthModal } from './components/AuthModal.js';
import { authManager } from '../core/auth/AuthManager.js';
import { cloudSyncManager } from '../core/sync/CloudSyncManager.js';
import { quizHistoryManager } from '../core/quiz/QuizHistoryManager.js';
import { aiHistoryManager } from '../core/ai/AiHistoryManager.js';

export class App {
  constructor() {
    this.currentView = 'home';
    this.views = {};
    this.teacherTool = null;
    this.helpModal = null;
    this.authModal = null;
    
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('graph_platform_theme') || 'dark';
    } catch {
      // Ignore storage errors in restricted contexts
    }
    this.theme = savedTheme;

    this._applyTheme(this.theme);
    this._initViews();
    this._initTeacherTools();
    this._initHelpGuide();
    this._initAuthModal();
    this._initCloudSync();
    this._bindNavigation();
    this._handleInitialRoute();
  }

  _applyTheme(theme) {
    this.theme = theme;
    if (typeof document !== 'undefined' && document.body) {
      if (theme === 'light') {
        document.body.classList.add('theme-light');
      } else {
        document.body.classList.remove('theme-light');
      }
      const themeBtn = document.getElementById('btnThemeToggle');
      if (themeBtn) {
        themeBtn.textContent = theme === 'light' ? '🌙 Tối' : '☀️ Sáng';
      }
    }

    try {
      localStorage.setItem('graph_platform_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }

  toggleTheme() {
    const nextTheme = this.theme === 'light' ? 'dark' : 'light';
    this._applyTheme(nextTheme);
  }

  _initViews() {
    // 1. Home View
    const homeContainer = document.getElementById('homeView');
    if (homeContainer) {
      this.views.home = new HomeView({
        container: homeContainer,
        onNavigate: (viewName, subtab = null) => {
          if (viewName === 'quiz' && subtab) {
            this.openQuizWithTab(subtab);
          } else {
            this.navigate(viewName, true, subtab);
          }
        },
      });
    }

    // 2. Theory View
    const theoryContainer = document.getElementById('theoryView');
    if (theoryContainer) {
      this.views.theory = new TheoryView({
        container: theoryContainer,
        onOpenLabWithAlgo: (algoKey) => this.openLabWithAlgo(algoKey),
        onOpenFundamentals: () => this.navigate('fundamentals'),
        onOpenLogic: (subtab, expr) => this.openLogicWithTab(subtab, expr),
        onOpenCounting: (subtab) => this.openCountingWithTab(subtab),
        onOpenRelation: (subtab, subsubtab) => this.openRelationWithTab(subtab, subsubtab),
        onOpenQuiz: (topic) => this.openQuizWithTab('practice', topic),
        onNavigate: (viewName, subtab = null) => {
          this.navigate(viewName, true, subtab);
        },
      });
    }

    // 3. Algorithm Lab View
    const labContainer = document.getElementById('labView');
    if (labContainer) {
      this.views.lab = new LabView({
        container: labContainer,
      });
    }

    // 4. Logic Lab View
    const logicContainer = document.getElementById('logicView');
    if (logicContainer) {
      this.views.logic = new LogicLabView({
        container: logicContainer,
      });
    }

    // 5. AI Assistant View
    const aiContainer = document.getElementById('aiView');
    if (aiContainer) {
      this.views.ai = new AiAssistantView({
        container: aiContainer,
        onNavigate: (viewName, subtab = null) => this.navigate(viewName, true, subtab),
        onOpenLabWithAlgo: (algoKey) => this.openLabWithAlgo(algoKey),
        onOpenLabWithGraph: (graph, name, algo) => this.openLabWithGraph(graph, name, algo),
        onOpenLogic: (subtab, expr) => this.openLogicWithTab(subtab, expr),
        onOpenCounting: (subtab) => this.openCountingWithTab(subtab),
        onOpenRelation: (subtab, subsubtab) => this.openRelationWithTab(subtab, subsubtab),
        onOpenQuiz: (subtab, topic) => this.openQuizWithTab(subtab, topic),
      });
    }

    // 6. Fundamentals View
    const fundamentalsContainer = document.getElementById('fundamentalsView');
    if (fundamentalsContainer) {
      this.views.fundamentals = new FundamentalsView({
        container: fundamentalsContainer,
        onBack: () => this.navigate('theory'),
      });
    }

    // 7. Quiz & Exam Studio View
    const quizContainer = document.getElementById('quizView');
    if (quizContainer) {
      this.views.quiz = new QuizView({
        container: quizContainer,
        onOpenLabWithAlgo: (algoKey) => this.openLabWithAlgo(algoKey),
        onOpenLogicWithExpr: (expr) => this.openLogicWithExpression(expr),
        onOpenCounting: (tab) => this.openCountingWithTab(tab),
        onOpenRelation: (tab, subtab) => this.openRelationWithTab(tab, subtab),
      });
    }

    // 8. Counting Lab View (Phòng thí nghiệm Phép đếm)
    const countingContainer = document.getElementById('countingView');
    if (countingContainer) {
      this.views.counting = new CountingLabView({
        container: countingContainer,
      });
    }

    // 9. Relation Lab View (Phòng thí nghiệm Quan hệ - Chương 4)
    const relationContainer = document.getElementById('relationView');
    if (relationContainer) {
      this.views.relation = new RelationLabView({
        container: relationContainer,
      });
    }

    // 10. Admin Database & Student Management View
    const adminContainer = document.getElementById('adminView');
    if (adminContainer) {
      this.views.admin = new AdminView({
        container: adminContainer,
        onNavigate: (viewName) => this.navigate(viewName),
      });
    }
  }

  _initTeacherTools() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      this.teacherTool = new TeacherAnnotationTool({ authManager });
      const teacherBtn = document.getElementById('btnTeacherToolsToggle');
      if (teacherBtn) {
        teacherBtn.addEventListener('click', () => {
          if (this.teacherTool && authManager.isAdmin()) {
            this.teacherTool.toggle();
          }
        });
      }
      this._updateTeacherToolsVisibility();
      authManager.onAuthStateChanged(() => {
        this._updateTeacherToolsVisibility();
      });
    } catch (err) {
      console.warn('TeacherAnnotationTool initialization deferred or failed:', err);
    }
  }

  _updateTeacherToolsVisibility() {
    const teacherBtn = document.getElementById('btnTeacherToolsToggle');
    const isAdmin = authManager.isAdmin();
    if (teacherBtn) {
      teacherBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }
    if (!isAdmin && this.teacherTool && this.teacherTool.isActive) {
      this.teacherTool.deactivate();
    }
  }

  _initHelpGuide() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      this.helpModal = new HelpGuideModal({
        container: document.body,
        onNavigate: (viewName, subtab = null) => {
          this.navigate(viewName, true, subtab);
        },
      });

      const btnHelp = document.getElementById('btnHelpGuideToggle');
      if (btnHelp) {
        btnHelp.addEventListener('click', () => {
          if (this.helpModal) {
            this.helpModal.open();
          }
        });
      }
    } catch (err) {
      console.warn('HelpGuideModal initialization deferred or failed:', err);
    }
  }

  _initAuthModal() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      this.authModal = new AuthModal({
        onAuthChange: (user) => {
          this._updateUserHeaderBadge();
          this._updateTeacherToolsVisibility();
          if (this.currentView === 'admin' && !authManager.isAdmin()) {
            this.navigate('home');
          }
          if (this.views.quiz && typeof this.views.quiz.render === 'function') {
            this.views.quiz.render();
          }
          if (this.views.ai && typeof this.views.ai.onUserChanged === 'function') {
            this.views.ai.onUserChanged(authManager.getCurrentUser());
          }
          if (this.views.admin && typeof this.views.admin.render === 'function' && this.currentView === 'admin') {
            this.views.admin.render();
          }
        },
      });

      const btnAuth = document.getElementById('btnUserAuth');
      if (btnAuth) {
        btnAuth.addEventListener('click', () => {
          if (this.authModal) {
            this.authModal.open();
          }
        });
      }

      authManager.onAuthStateChanged((event, user) => {
        this._updateUserHeaderBadge();
        this._updateTeacherToolsVisibility();
        if (this.currentView === 'admin' && !authManager.isAdmin()) {
          this.navigate('home');
        }
        if (this.views.quiz && typeof this.views.quiz.render === 'function') {
          this.views.quiz.render();
        }
        if (this.views.ai && typeof this.views.ai.onUserChanged === 'function') {
          this.views.ai.onUserChanged(authManager.getCurrentUser());
        }
        if (this.views.admin && typeof this.views.admin.render === 'function' && this.currentView === 'admin') {
          this.views.admin.render();
        }
      });

      this._updateUserHeaderBadge();
      this._updateTeacherToolsVisibility();
    } catch (err) {
      console.warn('AuthModal initialization deferred or failed:', err);
    }
  }

  _initCloudSync() {
    if (typeof window === 'undefined') return;
    try {
      cloudSyncManager.checkConnection().then(connected => {
        if (connected) {
          cloudSyncManager.syncUsers(authManager);
          cloudSyncManager.syncQuizLeaderboard(quizHistoryManager);
          cloudSyncManager.verifyCurrentUser(authManager);
          const user = authManager.getCurrentUser();
          if (user) {
            cloudSyncManager.syncAiHistory(user.id, aiHistoryManager);
          }
        }
      }).catch(() => {});

      // Heartbeat session check: periodically checks if user account was deleted on server
      if (this._syncHeartbeatTimer) clearInterval(this._syncHeartbeatTimer);
      this._syncHeartbeatTimer = setInterval(() => {
        if (authManager.isLoggedIn() && !authManager.isAdmin()) {
          cloudSyncManager.verifyCurrentUser(authManager);
        }
      }, 12000);
    } catch {
      // offline
    }
  }

  _updateUserHeaderBadge(user = null) {
    const btnAuth = document.getElementById('btnUserAuth');
    const lblName = document.getElementById('lblUserAuthName');
    const iconAuth = document.getElementById('iconUserAuth');
    const navBtnAdmin = document.getElementById('navBtnAdmin');

    const currentUser = authManager.getCurrentUser();
    const isAdmin = authManager.isAdmin();

    if (navBtnAdmin) {
      navBtnAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    if (!btnAuth || !lblName) return;

    if (currentUser) {
      btnAuth.classList.add('logged-in');
      if (iconAuth) iconAuth.textContent = currentUser.avatar || (isAdmin ? '👑' : '🎓');
      lblName.textContent = currentUser.fullName.split(' ').slice(-1)[0] || currentUser.fullName;
      btnAuth.title = `Tài khoản: ${currentUser.fullName} (${currentUser.className || (isAdmin ? 'Quản trị viên' : 'Sinh viên')}) • Bấm để xem hồ sơ`;
    } else {
      btnAuth.classList.remove('logged-in');
      if (iconAuth) iconAuth.textContent = '👤';
      lblName.textContent = 'Đăng nhập';
      btnAuth.title = 'Hệ thống tài khoản & Lịch sử AI';
    }
  }

  _bindNavigation() {
    if (typeof document === 'undefined') return;

    // Nav buttons & Dropdown items
    document.querySelectorAll('.nav-btn[data-view], .dropdown-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.navigate(view);
        this.closeLabDropdown();
      });
    });

    // Lab Dropdown menu interactions
    const labDropdown = document.getElementById('labDropdown');
    const btnLabDropdown = document.getElementById('btnLabDropdown');
    if (btnLabDropdown && labDropdown) {
      // Hover opens dropdown immediately
      labDropdown.addEventListener('mouseenter', () => {
        this.openLabDropdown();
      });

      // Leaving dropdown schedules smooth close
      labDropdown.addEventListener('mouseleave', () => {
        this.scheduleCloseLabDropdown(200);
      });

      // Click also toggles dropdown for touch/click accessibility
      btnLabDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = labDropdown.classList.toggle('open');
        btnLabDropdown.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!labDropdown.contains(e.target)) {
          this.closeLabDropdown();
        }
      });

      // Close dropdown on ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeLabDropdown();
        }
      });
    }

    // Brand click -> home
    const brand = document.getElementById('brandLogo');
    if (brand) {
      brand.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate('home');
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Hash change for browser back/forward
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        if (typeof window === 'undefined' || !window.location) return;
        const rawHash = window.location.hash.replace('#', '') || 'home';
        const [viewName, subtab] = rawHash.split('/');
        if (rawHash === 'studio' || (viewName === 'quiz' && subtab === 'studio')) {
          this.openQuizWithTab('studio');
        } else {
          this._activateView(viewName || rawHash);
          if (viewName === 'quiz' && subtab && this.views.quiz && typeof this.views.quiz.setTab === 'function') {
            this.views.quiz.setTab(subtab);
          }
        }
      });
    }
  }

  openLabDropdown() {
    if (typeof document === 'undefined') return;
    if (this._labDropdownTimer) {
      clearTimeout(this._labDropdownTimer);
      this._labDropdownTimer = null;
    }
    const labDropdown = document.getElementById('labDropdown');
    const btnLabDropdown = document.getElementById('btnLabDropdown');
    if (labDropdown) {
      labDropdown.classList.add('open');
    }
    if (btnLabDropdown) {
      btnLabDropdown.setAttribute('aria-expanded', 'true');
    }
  }

  scheduleCloseLabDropdown(delay = 200) {
    if (typeof document === 'undefined') return;
    if (this._labDropdownTimer) {
      clearTimeout(this._labDropdownTimer);
    }
    this._labDropdownTimer = setTimeout(() => {
      this.closeLabDropdown();
      this._labDropdownTimer = null;
    }, delay);
  }

  closeLabDropdown() {
    if (typeof document === 'undefined') return;
    if (this._labDropdownTimer) {
      clearTimeout(this._labDropdownTimer);
      this._labDropdownTimer = null;
    }
    const labDropdown = document.getElementById('labDropdown');
    const btnLabDropdown = document.getElementById('btnLabDropdown');
    if (labDropdown) {
      labDropdown.classList.remove('open');
    }
    if (btnLabDropdown) {
      btnLabDropdown.setAttribute('aria-expanded', 'false');
    }
  }

  _handleInitialRoute() {
    if (typeof window === 'undefined') return;
    const rawHash = window.location.hash.replace('#', '') || 'home';
    const [viewName, subtab] = rawHash.split('/');
    if (viewName === 'admin' && !authManager.isAdmin()) {
      this.navigate('home', false);
      return;
    }
    if (rawHash === 'studio' || (viewName === 'quiz' && subtab === 'studio')) {
      if (authManager.isAdmin()) {
        this.openQuizWithTab('studio');
      } else {
        this.openQuizWithTab('practice');
      }
    } else {
      this.navigate(viewName || rawHash, false, subtab);
    }
  }

  navigate(viewName, updateHash = true, subtab = null) {
    if (viewName === 'admin' && !authManager.isAdmin()) {
      viewName = 'home';
    }
    if (viewName === 'studio') {
      viewName = 'quiz';
      subtab = 'studio';
    }
    if (subtab === 'studio' && !authManager.isAdmin()) {
      subtab = 'practice';
    }
    if (!this.views[viewName]) viewName = 'home';
    if (updateHash && typeof window !== 'undefined') {
      window.location.hash = subtab ? `#${viewName}/${subtab}` : `#${viewName}`;
    }
    this._activateView(viewName);
    if (viewName === 'quiz' && subtab && this.views.quiz && typeof this.views.quiz.setTab === 'function') {
      this.views.quiz.setTab(subtab);
    }
  }

  _activateView(viewName) {
    this.currentView = viewName;
    if (typeof document === 'undefined') return;

    // Reset window and body scroll position on any view switch
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        if (!navigator.userAgent?.includes('jsdom')) {
          window.scrollTo(0, 0);
        }
      } catch {}
    }
    if (typeof document !== 'undefined') {
      try {
        if (document.body) document.body.scrollTop = 0;
        if (document.documentElement) document.documentElement.scrollTop = 0;
      } catch {}
    }

    // Lock page in AI view to eliminate scroll displacement & black void
    if (viewName === 'ai') {
      document.documentElement.classList.add('view-ai-active');
      document.body.classList.add('view-ai-active');
    } else {
      document.documentElement.classList.remove('view-ai-active');
      document.body.classList.remove('view-ai-active');
    }

    // Verify session validity when navigating between views
    if (authManager.isLoggedIn() && !authManager.isAdmin()) {
      try {
        cloudSyncManager.verifyCurrentUser(authManager);
      } catch {}
    }

    // Toggle view elements
    ['home', 'theory', 'lab', 'logic', 'counting', 'relation', 'ai', 'fundamentals', 'quiz', 'admin'].forEach(v => {
      const el = document.getElementById(`${v}View`);
      if (el) {
        el.classList.toggle('active', v === viewName);
      }
    });

    if (viewName === 'admin' && this.views.admin && typeof this.views.admin.render === 'function') {
      this.views.admin.render();
    }

    // Toggle active nav button
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Update Lab Dropdown state
    const labViews = ['logic', 'counting', 'relation', 'lab'];
    const isLabActive = labViews.includes(viewName);
    const labToggle = document.getElementById('btnLabDropdown');
    const labDropdownText = document.getElementById('labDropdownText');
    if (labToggle) {
      labToggle.classList.toggle('active', isLabActive);
    }
    if (labDropdownText) {
      const labTitles = {
        logic: 'Logic Lab',
        counting: 'Counting Lab',
        relation: 'Relation Lab',
        lab: 'Graph Lab'
      };
      labDropdownText.textContent = isLabActive ? `Phòng Lab: ${labTitles[viewName]}` : 'Phòng Lab';
    }

    // Toggle active state on dropdown items
    document.querySelectorAll('.dropdown-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewName);
    });

    // If navigating to Lab, re-render or trigger zoom layer sizing
    if (viewName === 'lab' && this.views.lab && this.views.lab.graphCanvas) {
      this.views.lab.graphCanvas._updateTransform();
    }
  }

  openLabWithAlgo(algoKey) {
    this.navigate('lab');
    if (this.views.lab) {
      this.views.lab.setAlgorithm(algoKey);
    }
  }

  openLabWithGraph(graph, name = 'Đồ thị từ AI', algo = 'dijkstra') {
    this.navigate('lab');
    if (this.views.lab) {
      if (typeof this.views.lab.setCustomGraph === 'function') {
        this.views.lab.setCustomGraph(graph, name, algo);
      } else if (typeof this.views.lab.setAlgorithm === 'function') {
        this.views.lab.setAlgorithm(algo);
      }
    }
  }

  openLogicWithExpression(expr) {
    this.navigate('logic');
    if (this.views.logic && typeof this.views.logic.setExpression === 'function') {
      this.views.logic.setExpression(expr);
    }
  }

  openLogicWithTab(subtab = 'table', expr = null) {
    this.navigate('logic');
    if (this.views.logic) {
      if (expr && typeof this.views.logic.setExpression === 'function') {
        this.views.logic.setExpression(expr);
      }
      if (subtab && typeof this.views.logic.switchSubTab === 'function') {
        this.views.logic.switchSubTab(subtab);
      }
    }
  }

  openCountingWithTab(subtab = 'mapping') {
    this.navigate('counting', true, subtab);
    if (this.views.counting && typeof this.views.counting.setTab === 'function') {
      this.views.counting.setTab(subtab);
    }
  }

  openRelationWithTab(subtab = 'matrix', subsubtab = null) {
    this.navigate('relation', true, subtab);
    if (this.views.relation && typeof this.views.relation.setTab === 'function') {
      this.views.relation.setTab(subtab, subsubtab);
    }
  }

  openQuizWithTab(subtab = 'practice', topic = null) {
    if (subtab === 'studio' && !authManager.isAdmin()) {
      subtab = 'practice';
    }
    this.navigate('quiz', true, subtab);
    if (this.views.quiz) {
      if (typeof this.views.quiz.setTab === 'function') {
        this.views.quiz.setTab(subtab);
      }
      if (topic && typeof this.views.quiz.setTopic === 'function') {
        this.views.quiz.setTopic(topic);
      }
    }
  }
}

/**
 * Safe bootstrap function that mounts the app immediately if DOM is ready,
 * or attaches to DOMContentLoaded if document is still parsing.
 */
export function initApp() {
  if (typeof window !== 'undefined' && !window.__app) {
    window.__app = new App();
  }
  return window.__app;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
