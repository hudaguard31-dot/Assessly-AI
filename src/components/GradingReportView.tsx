import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Quote,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api';
import type { Submission } from '../types';
import { StatusIndicator } from './StatusIndicator';

interface GradingReportViewProps {
  submission: Submission;
  teacherName: string;
  onBack: () => void;
  onUpdated: (updated: Submission) => Promise<void>;
}

export function GradingReportView({
  submission,
  teacherName,
  onBack,
  onUpdated,
}: GradingReportViewProps) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [editedGrades, setEditedGrades] = useState<
    Array<{ id: number; awarded_marks: number; reasoning: string }>
  >([]);
  const [teacherNote, setTeacherNote] = useState(submission.teacher_note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    setEditedGrades(
      submission.criterion_grades.map((g) => ({
        id: g.id ?? 0,
        awarded_marks: g.awarded_marks,
        reasoning: g.reasoning,
      }))
    );
    setTeacherNote(submission.teacher_note || '');
    setOverrideMode(false);
    setSavedBanner(false);
    setError('');
  }, [submission]);

  const percentage =
    submission.max_marks > 0
      ? Math.round((submission.total_score / submission.max_marks) * 100)
      : 0;

  const overrideTotal = editedGrades.reduce(
    (sum, g) => sum + (Number.isFinite(g.awarded_marks) ? g.awarded_marks : 0),
    0
  );

  async function handleSaveOverride(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.applyManualOverride(submission.id, {
        grades: editedGrades,
        teacher_note: teacherNote,
        teacher_name: teacherName,
      });
      await onUpdated(res.submission);
      setOverrideMode(false);
      setSavedBanner(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save manual override.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Results</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOverrideMode((v) => !v);
            setSavedBanner(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
        >
          <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {overrideMode ? 'Cancel Manual Edit' : 'Manual Review / Adjust Marks'}
          </span>
        </button>
      </div>

      {savedBanner && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Teacher review saved and recorded in Grading History.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* Report Header Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-medium text-blue-700">
                {submission.subject_code}
              </span>
              <span aria-hidden="true">·</span>
              <span>{submission.question_title}</span>
              <span aria-hidden="true">·</span>
              <span>Rubric v{submission.rubric_version}</span>
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold text-slate-900">
              {submission.student_name}
              {submission.student_id && (
                <span className="ml-2.5 font-mono text-sm font-normal text-slate-500">
                  {submission.student_id}
                </span>
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed max-w-3xl">
              {submission.overall_feedback}
            </p>
          </div>

          <div className="flex items-center gap-8 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Total Score</span>
              <p className="mt-0.5 font-mono tabular-nums text-3xl font-semibold text-slate-900">
                {submission.total_score}
                <span className="text-lg font-normal text-slate-400">
                  /{submission.max_marks}
                </span>
              </p>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {percentage}%
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block">AI Confidence</span>
              <p
                className={`mt-0.5 font-mono tabular-nums text-3xl font-semibold ${
                  submission.confidence >= 80
                    ? 'text-emerald-700'
                    : submission.confidence >= 55
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {submission.confidence}%
              </p>
              <div className="mt-0.5">
                <StatusIndicator
                  status={submission.reliability_status}
                  manualOverride={submission.manual_override}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Confidence & Uncertainty Warning Callout */}
        {!submission.manual_override &&
          submission.reliability_status !== 'reliable' && (
            <div
              className={`mt-5 rounded-lg border p-4 ${
                submission.reliability_status === 'manual_required'
                  ? 'border-red-200 bg-red-50/70'
                  : 'border-amber-200 bg-amber-50/70'
              }`}
            >
              <div className="flex items-start gap-3">
                {submission.reliability_status === 'manual_required' ? (
                  <ShieldAlert
                    className="w-5 h-5 text-red-700 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="w-5 h-5 text-amber-700 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {submission.reliability_status === 'manual_required'
                      ? 'Manual Teacher Grading Required — AI Confidence Too Low'
                      : 'Teacher Review Recommended — Uncertainty Detected'}
                  </p>
                  {submission.uncertainty_reasons.length > 0 ? (
                    <ul className="mt-1.5 list-disc list-inside text-xs text-slate-700 space-y-1">
                      {submission.uncertainty_reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-700">
                      The AI identified borderline or incomplete evidence and
                      recommends manual verification.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

        {submission.teacher_note && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-slate-800">
            <span className="font-semibold text-blue-900">Teacher Note: </span>
            {submission.teacher_note}
          </div>
        )}
      </section>

      {/* Explainable Criterion Breakdown (View or Manual Override Form) */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Explainable Criterion-by-Criterion Evaluation
            </h3>
            <p className="text-xs text-slate-500">
              Every score is backed by verbatim evidence quoted from the
              student’s answer.
            </p>
          </div>
          {overrideMode && (
            <span className="font-mono tabular-nums text-sm font-semibold text-blue-700">
              Adjusted Total: {Math.round(overrideTotal * 100) / 100}/
              {submission.max_marks}
            </span>
          )}
        </div>

        {overrideMode ? (
          <form onSubmit={handleSaveOverride} className="p-6 space-y-5">
            {submission.criterion_grades.map((g, idx) => {
              const draft = editedGrades[idx];
              return (
                <div
                  key={g.id ?? idx}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="font-medium text-sm text-slate-900">
                      {g.criterion_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600">
                        Awarded Marks:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={g.max_marks}
                        step="0.5"
                        value={draft?.awarded_marks ?? g.awarded_marks}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditedGrades((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, awarded_marks: val }
                                : item
                            )
                          );
                        }}
                        className="w-20 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums focus:border-blue-600 focus:outline-none"
                      />
                      <span className="font-mono text-xs text-slate-500">
                        / {g.max_marks}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic">
                    Evidence: “{g.evidence_quote}”
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Reason / Teacher Feedback
                    </label>
                    <input
                      type="text"
                      value={draft?.reasoning ?? g.reasoning}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditedGrades((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, reasoning: val } : item
                          )
                        );
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}

            <div>
              <label
                htmlFor="teacher-override-note"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Overall Teacher Review Note
              </label>
              <textarea
                id="teacher-override-note"
                rows={2}
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="Explain why marks were adjusted or confirm AI evaluation..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOverrideMode(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{saving ? 'Saving...' : 'Save Teacher Review'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-slate-200">
            {submission.criterion_grades.map((g, idx) => (
              <div key={g.id ?? idx} className="p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <h4 className="font-display text-sm font-semibold text-slate-900">
                      {g.criterion_name}
                    </h4>
                    {g.is_manual_override && (
                      <span className="text-xs font-medium text-blue-700">
                        · Manually Adjusted
                      </span>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-base font-semibold text-slate-900">
                    {g.awarded_marks} / {g.max_marks}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-4 py-3 flex items-start gap-2.5">
                  <Quote
                    className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="text-sm text-slate-800">
                    <span className="text-xs font-medium text-slate-500 block mb-0.5">
                      Student Answer Evidence
                    </span>
                    <p className="italic">“{g.evidence_quote}”</p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  <span className="font-medium text-slate-800">Reasoning: </span>
                  {g.reasoning}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Side-by-side Full Student Answer & Model Answer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            Full Student Submission
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {submission.answer_text}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            Reference Model Answer
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {submission.model_answer}
          </p>
        </section>
      </div>
    </div>
  );
}
