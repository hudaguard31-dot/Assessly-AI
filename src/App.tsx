import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { api } from './api';
import { CreateQuestionPage } from './components/CreateQuestionPage';
import { DashboardPage } from './components/DashboardPage';
import { HistoryPage } from './components/HistoryPage';
import { LoginPage } from './components/LoginPage';
import { ResultsPage } from './components/ResultsPage';
import { RubricManagementPage } from './components/RubricManagementPage';
import { Sidebar } from './components/Sidebar';
import { SubmitAnswerPage } from './components/SubmitAnswerPage';
import type {
  DashboardSummary,
  GradingHistoryEntry,
  PageId,
  Question,
  Subject,
  Submission,
  TeacherProfile,
} from './types';

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Teacher Dashboard',
    subtitle: 'Overview of subjects, class averages, and evaluations needing review.',
  },
  'create-question': {
    title: 'Questions & Subjects',
    subtitle: 'Manage subjects, model answers, and initial grading rubrics.',
  },
  rubrics: {
    title: 'Rubric Management',
    subtitle: 'Edit grading criteria and automatically regrade affected answers.',
  },
  'submit-answer': {
    title: 'Evaluate Student Answer',
    subtitle: 'Submit or upload written answers for explainable AI grading.',
  },
  results: {
    title: 'AI Grading Results',
    subtitle: 'Inspect criterion evidence, confidence scores, and manual overrides.',
  },
  history: {
    title: 'Grading History',
    subtitle: 'Audit log of AI evaluations, rubric regrades, and teacher adjustments.',
  },
};

const STORAGE_KEY = 'smartgrade_teacher_session';

export default function App() {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as TeacherProfile) : null;
    } catch {
      return null;
    }
  });

  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [history, setHistory] = useState<GradingHistoryEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [focusedQuestionId, setFocusedQuestionId] = useState<number | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(
    null
  );

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashRes, subjRes, qRes, subRes, histRes] = await Promise.all([
        api.getDashboard(),
        api.getSubjects(),
        api.getQuestions(),
        api.getSubmissions(),
        api.getHistory(),
      ]);
      setSummary(dashRes);
      setSubjects(subjRes.subjects);
      setQuestions(qRes.questions);
      setSubmissions(subRes.submissions);
      setHistory(histRes.history);
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (teacher) {
      loadAllData();
    }
  }, [teacher, loadAllData]);

  function handleLogin(profile: TeacherProfile) {
    setTeacher(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
  }

  function handleLogout() {
    setTeacher(null);
    setSelectedSubmissionId(null);
    setCurrentPage('dashboard');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function handleOpenSubmission(submissionId: number) {
    setSelectedSubmissionId(submissionId);
    setCurrentPage('results');
  }

  if (!teacher) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const headerMeta = PAGE_TITLES[currentPage];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          if (page !== 'results') {
            setSelectedSubmissionId(null);
          }
        }}
        teacher={teacher}
        onLogout={handleLogout}
        pendingReviews={summary?.pending_reviews ?? 0}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 lg:px-8 py-4 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-slate-900 truncate">
                {headerMeta.title}
              </h1>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                {headerMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {currentPage !== 'submit-answer' && (
              <button
                type="button"
                onClick={() => setCurrentPage('submit-answer')}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Evaluate Answer
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              summary={summary}
              loading={loadingData}
              onNavigate={setCurrentPage}
              onOpenSubmission={handleOpenSubmission}
            />
          )}

          {currentPage === 'create-question' && (
            <CreateQuestionPage
              subjects={subjects}
              questions={questions}
              onDataChanged={loadAllData}
              onEditRubric={(qId) => {
                setFocusedQuestionId(qId);
                setCurrentPage('rubrics');
              }}
              onSubmitForQuestion={(qId) => {
                setFocusedQuestionId(qId);
                setCurrentPage('submit-answer');
              }}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === 'rubrics' && (
            <RubricManagementPage
              questions={questions}
              initialQuestionId={focusedQuestionId}
              onDataChanged={loadAllData}
              onOpenSubmission={handleOpenSubmission}
            />
          )}

          {currentPage === 'submit-answer' && (
            <SubmitAnswerPage
              questions={questions}
              initialQuestionId={focusedQuestionId}
              onSubmissionGraded={async (sub) => {
                await loadAllData();
                setSelectedSubmissionId(sub.id);
                setCurrentPage('results');
              }}
            />
          )}

          {currentPage === 'results' && (
            <ResultsPage
              questions={questions}
              submissions={submissions}
              selectedSubmissionId={selectedSubmissionId}
              teacherName={teacher.name}
              onSelectSubmission={setSelectedSubmissionId}
              onDataChanged={loadAllData}
            />
          )}

          {currentPage === 'history' && (
            <HistoryPage
              history={history}
              questions={questions}
              onOpenSubmission={handleOpenSubmission}
            />
          )}
        </main>
      </div>
    </div>
  );
}
