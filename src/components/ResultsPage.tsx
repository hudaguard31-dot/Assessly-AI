import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { Question, Submission } from '../types';
import { GradingReportView } from './GradingReportView';
import { StatusIndicator } from './StatusIndicator';

interface ResultsPageProps {
  questions: Question[];
  submissions: Submission[];
  selectedSubmissionId: number | null;
  teacherName: string;
  onSelectSubmission: (id: number | null) => void;
  onDataChanged: () => Promise<void>;
}

export function ResultsPage({
  questions,
  submissions,
  selectedSubmissionId,
  teacherName,
  onSelectSubmission,
  onDataChanged,
}: ResultsPageProps) {
  const [questionFilter, setQuestionFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'reliable' | 'needs_review' | 'verified'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSubmission =
    selectedSubmissionId !== null
      ? submissions.find((s) => s.id === selectedSubmissionId) ?? null
      : null;

  const questionScopedSubmissions = useMemo(() => {
    if (questionFilter === 'all') return submissions;
    return submissions.filter((s) => s.question_id === questionFilter);
  }, [submissions, questionFilter]);

  const filteredSubmissions = useMemo(() => {
    return questionScopedSubmissions.filter((s) => {
      if (statusFilter === 'reliable' && (s.manual_override || s.reliability_status !== 'reliable')) {
        return false;
      }
      if (statusFilter === 'needs_review' && (s.manual_override || s.reliability_status === 'reliable')) {
        return false;
      }
      if (statusFilter === 'verified' && !s.manual_override) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.student_name.toLowerCase().includes(q) ||
          s.student_id.toLowerCase().includes(q) ||
          (s.question_title ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [questionScopedSubmissions, statusFilter, searchQuery]);

  // Analytics computed for scoped submissions
  const classAveragePct = useMemo(() => {
    if (questionScopedSubmissions.length === 0) return 0;
    const sum = questionScopedSubmissions.reduce(
      (acc, s) => acc + (s.max_marks > 0 ? (s.total_score / s.max_marks) * 100 : 0),
      0
    );
    return Math.round((sum / questionScopedSubmissions.length) * 10) / 10;
  }, [questionScopedSubmissions]);

  const avgConfidence = useMemo(() => {
    if (questionScopedSubmissions.length === 0) return 0;
    const sum = questionScopedSubmissions.reduce((acc, s) => acc + s.confidence, 0);
    return Math.round(sum / questionScopedSubmissions.length);
  }, [questionScopedSubmissions]);

  const needsReviewCount = useMemo(
    () =>
      questionScopedSubmissions.filter(
        (s) => !s.manual_override && s.reliability_status !== 'reliable'
      ).length,
    [questionScopedSubmissions]
  );

  // Criterion-wise performance breakdown (shown when a specific question is selected or defaulted to first question with submissions)
  const criterionBreakdown = useMemo(() => {
    const targetQuestionId =
      questionFilter !== 'all'
        ? questionFilter
        : questions.find((q) =>
            submissions.some((s) => s.question_id === q.id)
          )?.id;

    if (!targetQuestionId) return null;
    const q = questions.find((item) => item.id === targetQuestionId);
    const qSubs = submissions.filter((s) => s.question_id === targetQuestionId);
    if (!q || qSubs.length === 0) return null;

    const stats = q.criteria.map((c) => {
      let totalAwarded = 0;
      let count = 0;
      for (const sub of qSubs) {
        const match = sub.criterion_grades.find(
          (g) => g.criterion_name.toLowerCase() === c.name.toLowerCase()
        );
        if (match) {
          totalAwarded += match.awarded_marks;
          count++;
        }
      }
      const avgAwarded = count > 0 ? totalAwarded / count : 0;
      const pct = c.max_marks > 0 ? Math.round((avgAwarded / c.max_marks) * 100) : 0;
      return {
        name: c.name,
        avgAwarded: Math.round(avgAwarded * 100) / 100,
        maxMarks: c.max_marks,
        pct,
      };
    });

    return {
      questionTitle: q.title,
      submissionCount: qSubs.length,
      stats,
    };
  }, [questionFilter, questions, submissions]);

  if (selectedSubmission) {
    return (
      <GradingReportView
        submission={selectedSubmission}
        teacherName={teacherName}
        onBack={() => onSelectSubmission(null)}
        onUpdated={async (updated) => {
          await onDataChanged();
          onSelectSubmission(updated.id);
        }}
      />
    );
  }

  const csvUrl =
    questionFilter !== 'all'
      ? `/api/results/export?questionId=${questionFilter}`
      : '/api/results/export';

  return (
    <div className="space-y-6">
      {/* Top Analytics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Class Average</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {classAveragePct.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Evaluated Answers</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {questionScopedSubmissions.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Avg AI Confidence</p>
          <p className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-blue-700">
            {avgConfidence}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Needs Review</p>
          <p
            className={`mt-1.5 font-mono tabular-nums text-2xl font-semibold ${
              needsReviewCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {needsReviewCount}
          </p>
        </div>
      </div>

      {/* Criterion-Wise Class Performance */}
      {criterionBreakdown && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Criterion-Wise Performance — {criterionBreakdown.questionTitle}
              </h2>
              <p className="text-xs text-slate-500">
                Class average score per rubric criterion across{' '}
                {criterionBreakdown.submissionCount} evaluated submissions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {criterionBreakdown.stats.map((st) => (
              <div key={st.name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-800 truncate pr-2">
                    {st.name}
                  </span>
                  <span className="font-mono tabular-nums text-slate-600 shrink-0">
                    {st.avgAwarded}/{st.maxMarks} ({st.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${st.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results Table & Filters */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter results by question"
              value={questionFilter}
              onChange={(e) =>
                setQuestionFilter(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Questions</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.subject_code}] {q.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'reliable', label: 'Reliable' },
                  { id: 'needs_review', label: 'Needs Review' },
                  { id: 'verified', label: 'Verified' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student..."
                className="w-48 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <a
              href={csvUrl}
              download="smartgrade-results.csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download CSV</span>
            </a>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No grading results match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Student</th>
                  <th className="py-3 px-4">Question</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right">Percent</th>
                  <th className="py-3 px-4 text-right">AI Confidence</th>
                  <th className="py-3 px-4">Grading Status</th>
                  <th className="py-3 px-6 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSubmissions.map((sub) => {
                  const pct =
                    sub.max_marks > 0
                      ? Math.round((sub.total_score / sub.max_marks) * 100)
                      : 0;
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onSelectSubmission(sub.id)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-6">
                        <p className="font-medium text-slate-900">
                          {sub.student_name}
                        </p>
                        {sub.student_id && (
                          <p className="text-xs font-mono text-slate-400">
                            {sub.student_id}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800 max-w-xs truncate">
                          {sub.question_title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {sub.subject_code} · Rubric v{sub.rubric_version}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {sub.total_score}/{sub.max_marks}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {pct}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {sub.confidence}%
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusIndicator
                          status={sub.reliability_status}
                          manualOverride={sub.manual_override}
                        />
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSubmission(sub.id);
                          }}
                          className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          View Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
