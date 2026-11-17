import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, Menu, X } from 'lucide-react';
import { api } from './api';
import { CreateQuestionPage } from './components/CreateQuestionPage';
import { GradeWorkspacePage } from './components/GradeWorkspacePage';
import { HistoryPage } from './components/HistoryPage';
import { LoginPage } from './components/LoginPage';
import { ResultsPage } from './components/ResultsPage';
import type {
  DashboardSummary,
  GradingHistoryEntry,
  PageId,
  Question,
  Subject,
  Submission,
  TeacherProfile,
} from './types';

const DEFAULT_TEACHER: TeacherProfile = {
  id: 1,
  name: 'Dr. Elena Vance',
  email: 'elena.vance@smartgrade.edu',
  department: 'Life Sciences & STEM Assessment',
};

const STORAGE_KEY = 'smartgrade_teacher_session';

export default function App() {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as TeacherProfile) : DEFAULT_TEACHER;
    } catch {
      return DEFAULT_TEACHER;
    }
  });

  const [currentPage, setCurrentPage] = useState<PageId>('workspace');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [history, setHistory] = useState<GradingHistoryEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(
    null
  );
  const [focusedQuestionId, setFocusedQuestionId] = useState<number | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'report' | 'rubric'>('report');

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
    setCurrentPage('workspace');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
  }

  function handleSwitchAccount() {
    setTeacher(null);
    setSelectedSubmissionId(null);
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

  const navLinks: Array<{ id: PageId; label: string }> = [
    { id: 'workspace', label: 'Grade & Rubrics' },
    { id: 'results', label: 'Class Results' },
    { id: 'history', label: 'Grading History' },
    { id: 'create-question', label: 'New Question' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => {
            setCurrentPage('workspace');
            setSelectedSubmissionId(null);
          }}
          className="flex items-center gap-2.5 text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
            <BookOpenCheck className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            SMARTGRADE
          </span>
        </button>

        <nav
          className="hidden md:flex items-center gap-7 text-sm font-medium"
          aria-label="Primary navigation"
        >
          {navLinks.map((link) => {
            const active = currentPage === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  setCurrentPage(link.id);
                  if (link.id !== 'results') {
                    setSelectedSubmissionId(null);
                  }
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.label}
                {link.id === 'results' &&
                  summary &&
                  summary.pending_reviews > 0 && (
                    <span className="ml-1.5 font-mono tabular-nums text-xs text-amber-700">
                      ({summary.pending_reviews})
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="hidden md:inline-flex rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Switch Account
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-6 py-3 space-y-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => {
                setCurrentPage(link.id);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentPage === link.id
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-700'
              }`}
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="block w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500"
          >
            Switch Account ({teacher.name})
          </button>
        </div>
      )}

      <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {currentPage === 'workspace' && (
          <GradeWorkspacePage
            questions={questions}
            submissions={submissions}
            teacherName={teacher.name}
            loading={loadingData}
            initialQuestionId={focusedQuestionId}
            initialTab={workspaceTab}
            onDataChanged={loadAllData}
            onOpenNewQuestion={() => setCurrentPage('create-question')}
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

        {currentPage === 'create-question' && (
          <CreateQuestionPage
            subjects={subjects}
            questions={questions}
            onDataChanged={loadAllData}
            onEditRubric={(qId) => {
              setFocusedQuestionId(qId);
              setWorkspaceTab('rubric');
              setCurrentPage('workspace');
            }}
            onSubmitForQuestion={(qId) => {
              setFocusedQuestionId(qId);
              setWorkspaceTab('report');
              setCurrentPage('workspace');
            }}
            onNavigate={setCurrentPage}
          />
        )}
      </main>
    </div>
  );
}
