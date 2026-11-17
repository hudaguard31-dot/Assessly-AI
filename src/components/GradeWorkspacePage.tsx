import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  Plus,
  Quote,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../api';
import type {
  Question,
  RegradeResultItem,
  RubricCriterion,
  Submission,
} from '../types';
import { StatusIndicator } from './StatusIndicator';

interface GradeWorkspacePageProps {
  questions: Question[];
  submissions: Submission[];
  teacherName: string;
  loading: boolean;
  initialQuestionId?: number | null;
  initialTab?: 'report' | 'rubric';
  onDataChanged: () => Promise<void>;
  onOpenNewQuestion: () => void;
}

export function GradeWorkspacePage({
  questions,
  submissions,
  teacherName,
  loading,
  initialQuestionId,
  initialTab = 'report',
  onDataChanged,
  onOpenNewQuestion,
}: GradeWorkspacePageProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<number>(
    initialQuestionId ?? questions[0]?.id ?? 0
  );
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(
    null
  );
  const [rightTab, setRightTab] = useState<'report' | 'rubric'>(initialTab);

  useEffect(() => {
    if (initialQuestionId && questions.some((q) => q.id === initialQuestionId)) {
      setSelectedQuestionId(initialQuestionId);
      setSelectedSubmissionId(null);
    }
  }, [initialQuestionId, questions]);

  useEffect(() => {
    setRightTab(initialTab);
  }, [initialTab]);

  // Answer input state (only asks for answer; student name is optional)
  const [answerText, setAnswerText] = useState('');
  const [showOptionalMeta, setShowOptionalMeta] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState('');

  // Inline Rubric editor state
  const [draftCriteria, setDraftCriteria] = useState<RubricCriterion[]>([]);
  const [savingRubric, setSavingRubric] = useState(false);
  const [rubricError, setRubricError] = useState('');
  const [regradeResults, setRegradeResults] = useState<{
    rubricVersion: number;
    results: RegradeResultItem[];
  } | null>(null);

  // Inline Manual override state
  const [overrideMode, setOverrideMode] = useState(false);
  const [editedGrades, setEditedGrades] = useState<
    Array<{ id: number; awarded_marks: number; reasoning: string }>
  >([]);
  const [teacherNote, setTeacherNote] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId) ?? questions[0] ?? null,
    [questions, selectedQuestionId]
  );

  const questionSubmissions = useMemo(() => {
    if (!selectedQuestion) return [];
    return submissions.filter((s) => s.question_id === selectedQuestion.id);
  }, [submissions, selectedQuestion]);

  const activeSubmission = useMemo(() => {
    if (questionSubmissions.length === 0) return null;
    return (
      questionSubmissions.find((s) => s.id === selectedSubmissionId) ??
      questionSubmissions[0]
    );
  }, [questionSubmissions, selectedSubmissionId]);

  // Keep selected question valid when questions load
  useEffect(() => {
    if (questions.length > 0 && !questions.some((q) => q.id === selectedQuestionId)) {
      setSelectedQuestionId(questions[0].id);
    }
  }, [questions, selectedQuestionId]);

  // Sync draft rubric whenever selected question or its version changes
  useEffect(() => {
    if (selectedQuestion) {
      setDraftCriteria(
        selectedQuestion.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          max_marks: c.max_marks,
        }))
      );
      setRegradeResults(null);
      setRubricError('');
    }
  }, [selectedQuestion?.id, selectedQuestion?.rubric_version]);

  // Sync manual override form when active submission changes
  useEffect(() => {
    if (activeSubmission) {
      setEditedGrades(
        activeSubmission.criterion_grades.map((g) => ({
          id: g.id ?? 0,
          awarded_marks: g.awarded_marks,
          reasoning: g.reasoning,
        }))
      );
      setTeacherNote(activeSubmission.teacher_note || '');
      setOverrideMode(false);
    }
  }, [activeSubmission?.id, activeSubmission?.updated_at]);

  function handleQuestionChange(qId: number) {
    setSelectedQuestionId(qId);
    setSelectedSubmissionId(null);
    setAnswerText('');
    setStudentName('');
    setGradeError('');
    setRightTab('report');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAnswerText(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function fillSampleAnswer(kind: 'strong' | 'partial') {
    if (!selectedQuestion) return;
    const title = selectedQuestion.title.toLowerCase();
    if (title.includes('photosynthesis')) {
      setAnswerText(
        kind === 'strong'
          ? 'Photosynthesis is the process by which green plants convert sunlight into chemical energy. Chlorophyll inside leaves absorbs light energy. Plants take in carbon dioxide from the air and water from soil to produce glucose and release oxygen.'
          : 'Plants use sunlight and water to make food in green leaves. Chlorophyll helps trap light, though I forgot what gas is released.'
      );
      return;
    }
    if (title.includes('newton')) {
      setAnswerText(
        kind === 'strong'
          ? "Newton's Second Law says net force equals mass times acceleration (F = ma). Greater net force gives more acceleration, while larger mass reduces acceleration for the same force, like pushing an empty cart vs a full cart."
          : 'Force equals mass times acceleration. Heavier things are harder to push and move slower.'
      );
      return;
    }
    if (title.includes('binary search')) {
      setAnswerText(
        kind === 'strong'
          ? 'Binary search works on a sorted list by comparing the target to the middle item and eliminating half of the remaining elements each step, giving O(log n) time complexity.'
          : 'It splits the list in half repeatedly until it finds the item, which is fast.'
      );
      return;
    }
    setAnswerText(
      kind === 'strong'
        ? selectedQuestion.model_answer
        : 'It involves key causes and factors that led to major changes during that period.'
    );
  }

  async function handleGradeAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuestion) return;
    setGradeError('');
    setGrading(true);
    try {
      const res = await api.evaluateSubmission({
        question_id: selectedQuestion.id,
        student_name: studentName.trim(),
        student_id: '',
        answer_text: answerText,
      });
      await onDataChanged();
      setSelectedSubmissionId(res.submission.id);
      setRightTab('report');
      setAnswerText('');
      setStudentName('');
    } catch (err) {
      setGradeError(
        err instanceof Error ? err.message : 'Unable to grade answer.'
      );
    } finally {
      setGrading(false);
    }
  }

  function addCriterion() {
    setDraftCriteria((prev) => [
      ...prev,
      { name: '', description: '', max_marks: 2 },
    ]);
  }

  function removeCriterion(index: number) {
    if (draftCriteria.length <= 1) return;
    setDraftCriteria((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateCriterion(
    index: number,
    field: keyof RubricCriterion,
    value: string | number
  ) {
    setDraftCriteria((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function handleSaveRubricAndRegrade(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuestion) return;
    setRubricError('');
    setSavingRubric(true);
    setRegradeResults(null);
    try {
      const res = await api.updateRubricAndRegrade(
        selectedQuestion.id,
        draftCriteria.map((c) => ({
          name: c.name,
          description: c.description,
          max_marks: Number(c.max_marks),
        }))
      );
      await onDataChanged();
      setRegradeResults({
        rubricVersion: res.question.rubric_version,
        results: res.regraded_results,
      });
    } catch (err) {
      setRubricError(
        err instanceof Error ? err.message : 'Failed to update rubric.'
      );
    } finally {
      setSavingRubric(false);
    }
  }

  async function handleSaveOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubmission) return;
    setSavingOverride(true);
    try {
      await api.applyManualOverride(activeSubmission.id, {
        grades: editedGrades,
        teacher_note: teacherNote,
        teacher_name: teacherName,
      });
      await onDataChanged();
      setOverrideMode(false);
    } finally {
      setSavingOverride(false);
    }
  }

  if (loading && questions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (!selectedQuestion) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-600">No questions available yet.</p>
        <button
          type="button"
          onClick={onOpenNewQuestion}
          className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer"
        >
          Create First Question
        </button>
      </div>
    );
  }

  const draftTotalMarks = draftCriteria.reduce(
    (sum, c) => sum + (Number.isFinite(Number(c.max_marks)) ? Number(c.max_marks) : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Question Switcher + Prompt Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="active-question-select"
              className="block text-xs font-medium text-slate-500 mb-1.5"
            >
              Choose Inbuilt Question
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="active-question-select"
                value={selectedQuestion.id}
                onChange={(e) => handleQuestionChange(Number(e.target.value))}
                className="flex-1 min-w-[260px] max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.subject_code} · {q.title} ({q.max_marks} marks)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onOpenNewQuestion}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Question</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Max Marks</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {selectedQuestion.max_marks}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Rubric</span>
              <span className="font-mono tabular-nums font-semibold text-blue-700">
                v{selectedQuestion.rubric_version} ({selectedQuestion.criteria.length}{' '}
                criteria)
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Responses</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {questionSubmissions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="text-sm text-slate-700 leading-relaxed max-w-4xl">
            <span className="font-semibold text-slate-900">Question: </span>
            {selectedQuestion.prompt}
          </div>
          <button
            type="button"
            onClick={() => setShowModelAnswer((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{showModelAnswer ? 'Hide Model Answer' : 'View Model Answer'}</span>
            {showModelAnswer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {showModelAnswer && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-900">Model Answer: </span>
            {selectedQuestion.model_answer}
          </div>
        )}
      </section>

      {/* Main Two-Column Easy Grader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Answer Input (only asks for answer) + Inbuilt Responses List */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Enter Answer to Grade
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fillSampleAnswer('strong')}
                  className="rounded-md bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Sample Strong
                </button>
                <button
                  type="button"
                  onClick={() => fillSampleAnswer('partial')}
                  className="rounded-md bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
                >
                  Sample Partial
                </button>
              </div>
            </div>

            {gradeError && (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
              >
                {gradeError}
              </div>
            )}

            <form onSubmit={handleGradeAnswer} className="space-y-3">
              <textarea
                aria-label="Written answer"
                required
                rows={6}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type or paste your answer here..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 leading-relaxed placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowOptionalMeta((v) => !v)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showOptionalMeta
                    ? 'Hide student name'
                    : '+ Optional: Add student name'}
                </button>

                <label className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium cursor-pointer">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload .txt</span>
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              {showOptionalMeta && (
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Student name (optional, auto-numbered if blank)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              )}

              <button
                type="submit"
                disabled={grading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {grading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Grading with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>Grade Answer</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Inbuilt & Submitted Responses Selector */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Responses ({questionSubmissions.length})
              </h3>
              <span className="text-xs text-slate-500">
                Click to inspect score & evidence
              </span>
            </div>

            {questionSubmissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No responses yet for this question. Enter an answer above to
                grade it.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {questionSubmissions.map((sub) => {
                  const isSelected = activeSubmission?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubmissionId(sub.id);
                        setRightTab('report');
                      }}
                      className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {sub.student_name}
                        </span>
                        <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 shrink-0">
                          {sub.total_score}/{sub.max_marks}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        {sub.answer_text}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        <StatusIndicator
                          status={sub.reliability_status}
                          manualOverride={sub.manual_override}
                          compact
                        />
                        <span className="font-mono tabular-nums text-slate-500">
                          {sub.confidence}% confidence
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: Explainable Report OR Inline Rubric Grader Editor */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setRightTab('report')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rightTab === 'report'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grading Report
              </button>
              <button
                type="button"
                onClick={() => setRightTab('rubric')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rightTab === 'rubric'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Edit Rubric Grader ({selectedQuestion.criteria.length})
              </button>
            </div>

            {rightTab === 'report' && activeSubmission && (
              <button
                type="button"
                onClick={() => setOverrideMode((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{overrideMode ? 'Cancel Edit' : 'Adjust Marks'}</span>
              </button>
            )}
          </div>

          {rightTab === 'report' ? (
            activeSubmission ? (
              <div className="p-5 sm:p-6 space-y-5">
                {/* Score & Confidence Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{activeSubmission.student_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>Rubric v{activeSubmission.rubric_version}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">
                      {activeSubmission.overall_feedback}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div>
                      <span className="text-xs text-slate-500 block">Score</span>
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
                        {activeSubmission.total_score}/{activeSubmission.max_marks}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">
                        Confidence
                      </span>
                      <span
                        className={`font-mono tabular-nums text-2xl font-semibold ${
                          activeSubmission.confidence >= 80
                            ? 'text-emerald-700'
                            : activeSubmission.confidence >= 55
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {activeSubmission.confidence}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reliability status / warning */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusIndicator
                    status={activeSubmission.reliability_status}
                    manualOverride={activeSubmission.manual_override}
                  />
                  {activeSubmission.teacher_note && (
                    <span className="text-xs text-blue-800">
                      Note: {activeSubmission.teacher_note}
                    </span>
                  )}
                </div>

                {!activeSubmission.manual_override &&
                  activeSubmission.reliability_status !== 'reliable' && (
                    <div
                      className={`rounded-lg border p-3.5 text-xs ${
                        activeSubmission.reliability_status === 'manual_required'
                          ? 'border-red-200 bg-red-50/70 text-red-900'
                          : 'border-amber-200 bg-amber-50/70 text-amber-900'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {activeSubmission.reliability_status ===
                        'manual_required' ? (
                          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold">
                            Teacher Review Recommended
                          </p>
                          {activeSubmission.uncertainty_reasons.length > 0 && (
                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                              {activeSubmission.uncertainty_reasons.map(
                                (r, i) => (
                                  <li key={i}>{r}</li>
                                )
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Submitted Answer Preview */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    Submitted Answer
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {activeSubmission.answer_text}
                  </p>
                </div>

                {/* Criterion Breakdown OR Manual Override Form */}
                {overrideMode ? (
                  <form onSubmit={handleSaveOverride} className="space-y-4">
                    {activeSubmission.criterion_grades.map((g, idx) => (
                      <div
                        key={g.id ?? idx}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">
                            {g.criterion_name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={g.max_marks}
                              step="0.5"
                              value={editedGrades[idx]?.awarded_marks ?? g.awarded_marks}
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
                              className="w-18 rounded border border-slate-300 bg-white px-2 py-1 text-sm font-mono tabular-nums"
                            />
                            <span className="font-mono text-xs text-slate-500">
                              / {g.max_marks}
                            </span>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={editedGrades[idx]?.reasoning ?? g.reasoning}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedGrades((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, reasoning: val } : item
                              )
                            );
                          }}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                    <input
                      type="text"
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      placeholder="Optional teacher review note..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOverrideMode(false)}
                        className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingOverride}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {savingOverride ? 'Saving...' : 'Save Adjusted Marks'}
                        </span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-500">
                      Criterion Breakdown & Evidence
                    </h3>
                    {activeSubmission.criterion_grades.map((g, idx) => (
                      <div
                        key={g.id ?? idx}
                        className="rounded-lg border border-slate-200 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-semibold text-slate-900">
                            {g.criterion_name}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-blue-700 shrink-0">
                            {g.awarded_marks} / {g.max_marks}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded px-3 py-2">
                          <Quote className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                          <span className="italic">“{g.evidence_quote}”</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {g.reasoning}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-slate-500">
                Enter an answer on the left or choose a response to view its
                grading breakdown.
              </div>
            )
          ) : (
            /* TAB 2: INLINE RUBRIC GRADER EDITOR */
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Edit Rubric Criteria
                  </h3>
                  <p className="text-xs text-slate-600">
                    Changes automatically regrade all {questionSubmissions.length}{' '}
                    responses for this question using Gemini AI.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-sm font-semibold text-blue-700">
                    Total: {draftTotalMarks} marks
                  </span>
                  <button
                    type="button"
                    onClick={addCriterion}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add Criterion</span>
                  </button>
                </div>
              </div>

              {rubricError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  {rubricError}
                </div>
              )}

              <form onSubmit={handleSaveRubricAndRegrade} className="space-y-3">
                {draftCriteria.map((c, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start p-3 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-xs text-slate-500 mb-1">
                        Criterion
                      </label>
                      <input
                        type="text"
                        required
                        value={c.name}
                        onChange={(e) =>
                          updateCriterion(idx, 'name', e.target.value)
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-xs text-slate-500 mb-1">
                        Expectation
                      </label>
                      <input
                        type="text"
                        value={c.description}
                        onChange={(e) =>
                          updateCriterion(idx, 'description', e.target.value)
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">
                        Marks
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
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-1 flex sm:justify-end sm:pt-6">
                      <button
                        type="button"
                        onClick={() => removeCriterion(idx)}
                        disabled={draftCriteria.length <= 1}
                        aria-label={`Remove criterion ${idx + 1}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingRubric}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${savingRubric ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>
                      {savingRubric
                        ? 'Regrading Responses...'
                        : `Save Rubric & Regrade (${questionSubmissions.length})`}
                    </span>
                  </button>
                </div>
              </form>

              {regradeResults && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Rubric v{regradeResults.rubricVersion} saved —{' '}
                      {regradeResults.results.length} responses regraded
                    </span>
                  </div>
                  {regradeResults.results.length > 0 && (
                    <div className="divide-y divide-blue-100 bg-white rounded border border-blue-100 text-xs">
                      {regradeResults.results.map((r) => {
                        const delta =
                          Math.round((r.new_score - r.previous_score) * 100) /
                          100;
                        return (
                          <div
                            key={r.submission_id}
                            className="px-3 py-2 flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-900">
                              {r.student_name}
                            </span>
                            <span className="font-mono tabular-nums">
                              {r.previous_score} →{' '}
                              <strong className="text-slate-900">
                                {r.new_score}/{r.max_marks}
                              </strong>{' '}
                              <span
                                className={
                                  delta > 0
                                    ? 'text-emerald-700'
                                    : delta < 0
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                                }
                              >
                                ({delta > 0 ? `+${delta}` : delta})
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
