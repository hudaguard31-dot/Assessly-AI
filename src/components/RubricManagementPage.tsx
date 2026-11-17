import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import type { Question, RegradeResultItem, RubricCriterion } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface RubricManagementPageProps {
  questions: Question[];
  initialQuestionId: number | null;
  onDataChanged: () => Promise<void>;
  onOpenSubmission: (submissionId: number) => void;
}

export function RubricManagementPage({
  questions,
  initialQuestionId,
  onDataChanged,
  onOpenSubmission,
}: RubricManagementPageProps) {
  const [selectedId, setSelectedId] = useState<number>(
    initialQuestionId ?? questions[0]?.id ?? 0
  );
  const selectedQuestion =
    questions.find((q) => q.id === selectedId) ?? questions[0] ?? null;

  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [regradeSummary, setRegradeSummary] = useState<{
    rubricVersion: number;
    regradedCount: number;
    results: RegradeResultItem[];
    errors: Array<{ student_name: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    if (initialQuestionId && questions.some((q) => q.id === initialQuestionId)) {
      setSelectedId(initialQuestionId);
    }
  }, [initialQuestionId, questions]);

  useEffect(() => {
    if (selectedQuestion) {
      setCriteria(
        selectedQuestion.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          max_marks: c.max_marks,
        }))
      );
      setRegradeSummary(null);
      setError('');
    }
  }, [selectedQuestion?.id, selectedQuestion?.rubric_version]);

  if (!selectedQuestion) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        No questions found. Create a question first to manage its rubric.
      </div>
    );
  }

  const totalMaxMarks = criteria.reduce(
    (sum, c) => sum + (Number.isFinite(Number(c.max_marks)) ? Number(c.max_marks) : 0),
    0
  );

  function addCriterion() {
    setCriteria((prev) => [
      ...prev,
      { name: '', description: '', max_marks: 2 },
    ]);
  }

  function removeCriterion(index: number) {
    if (criteria.length <= 1) return;
    setCriteria((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateCriterion(
    index: number,
    field: keyof RubricCriterion,
    value: string | number
  ) {
    setCriteria((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function handleSaveAndRegrade(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuestion) return;
    setError('');
    setSaving(true);
    setRegradeSummary(null);
    try {
      const res = await api.updateRubricAndRegrade(
        selectedQuestion.id,
        criteria.map((c) => ({
          name: c.name,
          description: c.description,
          max_marks: Number(c.max_marks),
        }))
      );
      await onDataChanged();
      setRegradeSummary({
        rubricVersion: res.question.rubric_version,
        regradedCount: res.regraded_count,
        results: res.regraded_results,
        errors: res.errors,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update rubric and regrade submissions.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Question Selector Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-end">
          <div className="lg:col-span-2">
            <label
              htmlFor="rubric-question-select"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Select Question to Edit Rubric
            </label>
            <select
              id="rubric-question-select"
              value={selectedQuestion.id}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.subject_code}] {q.title} — {q.submission_count ?? 0} answers
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between lg:justify-end gap-6 text-sm border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Rubric Version</span>
              <span className="font-mono font-semibold text-slate-900">
                v{selectedQuestion.rubric_version}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Affected Answers</span>
              <span className="font-mono tabular-nums font-semibold text-blue-700">
                {selectedQuestion.submission_count ?? 0} submissions
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Prompt: </span>
          {selectedQuestion.prompt}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Rubric Editor */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Dynamic Rubric Criteria
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Modify criteria or marks below. Saving automatically regrades all
              affected student answers with Gemini AI and logs score deltas.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Updated Total</span>
              <span className="font-mono tabular-nums text-lg font-semibold text-blue-700">
                {totalMaxMarks} marks
              </span>
            </div>
            <button
              type="button"
              onClick={addCriterion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Criterion</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveAndRegrade} className="mt-5 space-y-3">
          {criteria.map((c, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3.5 rounded-lg bg-slate-50 border border-slate-200"
            >
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Criterion Name
                </label>
                <input
                  type="text"
                  required
                  value={c.name}
                  onChange={(e) => updateCriterion(idx, 'name', e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Expectation / Scoring Guidance
                </label>
                <input
                  type="text"
                  value={c.description}
                  onChange={(e) =>
                    updateCriterion(idx, 'description', e.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  required
                  min="0.5"
                  step="0.5"
                  value={c.max_marks}
                  onChange={(e) =>
                    updateCriterion(
                      idx,
                      'max_marks',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="md:col-span-1 flex md:justify-end md:pt-6">
                <button
                  type="button"
                  onClick={() => removeCriterion(idx)}
                  disabled={criteria.length <= 1}
                  aria-label={`Remove criterion ${idx + 1}`}
                  className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              {(selectedQuestion.submission_count ?? 0) > 0
                ? `${selectedQuestion.submission_count} existing student submissions will be automatically regraded via Gemini AI.`
                : 'No existing submissions yet. Saving updates the rubric for future submissions.'}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {saving
                  ? 'Regrading Affected Answers...'
                  : 'Save Rubric & Regrade Affected Answers'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* Regrade Results Comparison Table */}
      {regradeSummary && (
        <section className="rounded-xl border border-blue-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="w-5 h-5 text-blue-700 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Rubric v{regradeSummary.rubricVersion} Applied —{' '}
                  {regradeSummary.regradedCount} Answers Regraded
                </h3>
                <p className="text-xs text-slate-600">
                  Previous and updated marks are recorded in Grading History.
                </p>
              </div>
            </div>
          </div>

          {regradeSummary.errors.length > 0 && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800">
              {regradeSummary.errors.map((err, i) => (
                <p key={i}>
                  {err.student_name}: {err.error}
                </p>
              ))}
            </div>
          )}

          {regradeSummary.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-4 text-right">Previous Score</th>
                    <th className="py-3 px-4 text-right">Updated Score</th>
                    <th className="py-3 px-4 text-right">Delta</th>
                    <th className="py-3 px-4 text-right">Confidence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {regradeSummary.results.map((r) => {
                    const delta = Math.round((r.new_score - r.previous_score) * 100) / 100;
                    return (
                      <tr key={r.submission_id} className="hover:bg-slate-50">
                        <td className="py-3 px-6 font-medium text-slate-900">
                          {r.student_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                          {r.previous_score}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {r.new_score}/{r.max_marks}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                            delta > 0
                              ? 'text-emerald-700'
                              : delta < 0
                              ? 'text-red-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {r.new_confidence}%
                        </td>
                        <td className="py-3 px-4">
                          <StatusIndicator
                            status={r.reliability_status}
                            compact
                          />
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenSubmission(r.submission_id)}
                            className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                          >
                            Inspect
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
      )}
    </div>
  );
}
