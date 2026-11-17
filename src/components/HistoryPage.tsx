import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Sparkles, UserCheck } from 'lucide-react';
import type { GradingHistoryEntry, HistoryEventType, Question } from '../types';

interface HistoryPageProps {
  history: GradingHistoryEntry[];
  questions: Question[];
  onOpenSubmission: (submissionId: number) => void;
}

const EVENT_LABELS: Record<HistoryEventType, string> = {
  initial_ai: 'Initial AI Evaluation',
  rubric_regrade: 'Rubric Change Regrade',
  manual_override: 'Manual Teacher Override',
};

export function HistoryPage({
  history,
  questions,
  onOpenSubmission,
}: HistoryPageProps) {
  const [eventFilter, setEventFilter] = useState<'all' | HistoryEventType>('all');
  const [questionFilter, setQuestionFilter] = useState<number | 'all'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      if (eventFilter !== 'all' && item.event_type !== eventFilter) return false;
      if (questionFilter !== 'all' && item.question_id !== questionFilter) return false;
      return true;
    });
  }, [history, eventFilter, questionFilter]);

  function renderEventIcon(type: HistoryEventType) {
    if (type === 'rubric_regrade') {
      return <RefreshCw className="w-4 h-4 text-blue-700" aria-hidden="true" />;
    }
    if (type === 'manual_override') {
      return <UserCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />;
    }
    return <Sparkles className="w-4 h-4 text-slate-600" aria-hidden="true" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter history by question"
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
                { id: 'all', label: 'All Events' },
                { id: 'initial_ai', label: 'Initial AI' },
                { id: 'rubric_regrade', label: 'Rubric Regrades' },
                { id: 'manual_override', label: 'Manual Overrides' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEventFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  eventFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <span className="font-mono tabular-nums text-xs text-slate-500">
          {filtered.length} recorded events
        </span>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No grading history entries match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const delta =
                entry.previous_score !== null
                  ? Math.round((entry.new_score - entry.previous_score) * 100) / 100
                  : null;

              return (
                <div key={entry.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {renderEventIcon(entry.event_type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-800">
                            {EVENT_LABELS[entry.event_type]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{entry.actor_name}</span>
                          <span aria-hidden="true">·</span>
                          <span>Rubric v{entry.rubric_version}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{entry.created_at}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {entry.student_name}{' '}
                          <span className="font-normal text-slate-500">on</span>{' '}
                          {entry.question_title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {entry.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-right">
                        {entry.previous_score !== null ? (
                          <div className="font-mono tabular-nums text-sm">
                            <span className="text-slate-400">
                              {entry.previous_score}
                            </span>
                            <span className="mx-1.5 text-slate-400">→</span>
                            <span className="font-semibold text-slate-900">
                              {entry.new_score}/{entry.max_marks}
                            </span>
                            {delta !== null && (
                              <span
                                className={`ml-2 text-xs font-medium ${
                                  delta > 0
                                    ? 'text-emerald-700'
                                    : delta < 0
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                ({delta > 0 ? `+${delta}` : delta})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                            {entry.new_score}/{entry.max_marks}
                          </div>
                        )}
                        <p className="font-mono tabular-nums text-xs text-slate-500">
                          {entry.new_confidence}% confidence
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenSubmission(entry.submission_id)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                        >
                          Open Report
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry.id)
                          }
                          aria-label="Toggle criterion breakdown"
                          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && entry.details.criteria_changes && (
                    <div className="mt-4 pl-7 pt-3 border-t border-slate-200/70 space-y-2">
                      {entry.details.criteria_changes.map((c, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50 px-3 py-2 rounded-md border border-slate-200/70"
                        >
                          <div>
                            <span className="font-medium text-slate-800">
                              {c.criterion_name}:{' '}
                            </span>
                            <span className="text-slate-600">{c.reason}</span>
                          </div>
                          <span className="font-mono tabular-nums font-medium text-slate-900 shrink-0">
                            {c.previous_marks !== undefined
                              ? `${c.previous_marks} → ${c.new_marks}/${c.max_marks}`
                              : `${c.new_marks}/${c.max_marks}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
