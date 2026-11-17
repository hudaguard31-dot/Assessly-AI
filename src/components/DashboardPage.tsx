import { AlertTriangle, ArrowRight, FilePlus2, ClipboardList } from 'lucide-react';
import type { DashboardSummary, PageId } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface DashboardPageProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigate: (page: PageId) => void;
  onOpenSubmission: (submissionId: number) => void;
}

export function DashboardPage({
  summary,
  loading,
  onNavigate,
  onOpenSubmission,
}: DashboardPageProps) {
  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Metrics Row */}
      <section aria-label="Key assessment metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Class Average</p>
            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-slate-900">
              {summary.class_average_pct.toFixed(1)}%
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Across {summary.total_submissions} evaluated answers
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Average AI Confidence
            </p>
            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-blue-700">
              {summary.average_confidence}%
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Weighted reliability across submissions
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Needs Teacher Review
            </p>
            <p
              className={`mt-2 font-mono tabular-nums text-3xl font-semibold ${
                summary.pending_reviews > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {summary.pending_reviews}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Flagged for low confidence or ambiguity
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Active Questions & Subjects
            </p>
            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-slate-900">
              {summary.total_questions}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Organized under {summary.total_subjects} subjects
            </p>
          </div>
        </div>
      </section>

      {/* Quick Actions Strip */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Assessment Workflow
          </h2>
          <p className="text-sm text-slate-600">
            Create rubric-backed questions, evaluate student answers, or adjust
            criteria to regrade automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('create-question')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            <span>New Question</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('submit-answer')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            <span>Evaluate Student Answer</span>
          </button>
        </div>
      </section>

      {/* Flagged Review Queue (if any) */}
      {summary.review_queue.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200/80 flex items-center justify-between gap-4 bg-white">
            <div className="flex items-center gap-2.5">
              <AlertTriangle
                className="w-5 h-5 text-amber-600 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Flagged for Manual Teacher Review
                </h2>
                <p className="text-xs text-slate-600">
                  These evaluations detected ambiguity, incomplete phrasing, or
                  lower confidence.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap cursor-pointer"
            >
              View All Results
            </button>
          </div>
          <div className="divide-y divide-amber-200/60 bg-white">
            {summary.review_queue.map((item) => (
              <div
                key={item.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <span>{item.student_name}</span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600 font-normal truncate">
                      {item.question_title}
                    </span>
                  </div>
                  {item.uncertainty_reasons[0] && (
                    <p className="mt-0.5 text-xs text-slate-600 truncate max-w-2xl">
                      {item.uncertainty_reasons[0]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <p className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                      {item.total_score}/{item.max_marks}
                    </p>
                    <p className="font-mono tabular-nums text-xs text-amber-700">
                      {item.confidence}% confidence
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSubmission(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                  >
                    <span>Review Report</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Two-Column Grid: Recent Submissions & Subject Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Evaluations
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
            >
              Open Results Dashboard
            </button>
          </div>
          {summary.recent_submissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No student submissions evaluated yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-4">Question</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Confidence</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {summary.recent_submissions.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => onOpenSubmission(sub.id)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                        {sub.student_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {sub.question_title}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {sub.total_score}/{sub.max_marks}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {sub.confidence}%
                      </td>
                      <td className="py-3 px-6">
                        <StatusIndicator
                          status={sub.reliability_status}
                          manualOverride={sub.manual_override}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Subjects Overview
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('create-question')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
            >
              Manage
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {summary.subject_stats.map((subj) => (
              <div
                key={subj.id}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {subj.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {subj.code} · {subj.question_count} questions ·{' '}
                    {subj.submission_count} graded
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                    {subj.average_pct !== null ? `${subj.average_pct}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">avg</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
