import { useState } from 'react';
import { FolderPlus, Plus, Trash2, CheckCircle2, SlidersHorizontal, ClipboardList } from 'lucide-react';
import { api } from '../api';
import type { PageId, Question, RubricCriterion, Subject } from '../types';

interface CreateQuestionPageProps {
  subjects: Subject[];
  questions: Question[];
  onDataChanged: () => Promise<void>;
  onEditRubric: (questionId: number) => void;
  onSubmitForQuestion: (questionId: number) => void;
  onNavigate: (page: PageId) => void;
}

export function CreateQuestionPage({
  subjects,
  questions,
  onDataChanged,
  onEditRubric,
  onSubmitForQuestion,
}: CreateQuestionPageProps) {
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [subjName, setSubjName] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjDesc, setSubjDesc] = useState('');
  const [subjLoading, setSubjLoading] = useState(false);

  const [subjectId, setSubjectId] = useState<number>(subjects[0]?.id ?? 0);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [modelAnswer, setModelAnswer] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([
    { name: 'Core Concept & Definition', description: 'Accurately defines the main principle.', max_marks: 2 },
    { name: 'Mechanism / Key Explanation', description: 'Explains how the process works conceptually.', max_marks: 3 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const effectiveSubjectId =
    subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id ?? 0;

  const totalMaxMarks = criteria.reduce(
    (sum, c) => sum + (Number.isFinite(Number(c.max_marks)) ? Number(c.max_marks) : 0),
    0
  );

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubjLoading(true);
    try {
      const res = await api.createSubject(subjName, subjCode, subjDesc);
      await onDataChanged();
      setSubjectId(res.subject.id);
      setSubjName('');
      setSubjCode('');
      setSubjDesc('');
      setShowNewSubject(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subject.');
    } finally {
      setSubjLoading(false);
    }
  }

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

  async function handleCreateQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!effectiveSubjectId) {
      setError('Please create or select a subject first.');
      return;
    }
    setSaving(true);
    try {
      await api.createQuestion({
        subject_id: effectiveSubjectId,
        title,
        prompt,
        model_answer: modelAnswer,
        criteria: criteria.map((c) => ({
          name: c.name,
          description: c.description,
          max_marks: Number(c.max_marks),
        })),
      });
      await onDataChanged();
      setTitle('');
      setPrompt('');
      setModelAnswer('');
      setCriteria([
        { name: 'Core Concept & Definition', description: '', max_marks: 2 },
        { name: 'Supporting Explanation', description: '', max_marks: 3 },
      ]);
      setSuccessMsg('Question and rubric saved to SQLite database.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion(id: number, qTitle: string) {
    setError('');
    try {
      await api.deleteQuestion(id);
      await onDataChanged();
      setSuccessMsg(`Deleted "${qTitle}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete question.');
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Subject Creation Collapsible Panel */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Subjects ({subjects.length})
            </h2>
            <p className="text-xs text-slate-500">
              Organize questions and rubrics by course or subject code.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewSubject((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showNewSubject ? 'Close Subject Form' : 'Add Subject'}</span>
          </button>
        </div>

        {showNewSubject && (
          <form
            onSubmit={handleCreateSubject}
            className="p-6 bg-slate-50/60 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject Name
              </label>
              <input
                type="text"
                required
                value={subjName}
                onChange={(e) => setSubjName(e.target.value)}
                placeholder="Organic Chemistry"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject Code
              </label>
              <input
                type="text"
                required
                value={subjCode}
                onChange={(e) => setSubjCode(e.target.value)}
                placeholder="CHEM-201"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={subjDesc}
                onChange={(e) => setSubjDesc(e.target.value)}
                placeholder="Reaction mechanisms and synthesis"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={subjLoading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 cursor-pointer whitespace-nowrap"
            >
              {subjLoading ? 'Saving...' : 'Create Subject'}
            </button>
          </form>
        )}

        <div className="px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-slate-900">{s.code}</span>
              <span aria-hidden="true">·</span>
              <span>{s.name}</span>
              <span className="text-slate-400">({s.question_count ?? 0})</span>
            </div>
          ))}
        </div>
      </section>

      {/* Create Question Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Create Assessment Question & Rubric
            </h2>
            <p className="text-sm text-slate-600">
              Define the question, reference model answer, and initial grading
              criteria.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">
              Calculated Maximum Marks
            </span>
            <span className="font-mono tabular-nums text-xl font-semibold text-blue-700">
              {totalMaxMarks} marks
            </span>
          </div>
        </div>

        <form onSubmit={handleCreateQuestion} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="q-subject"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Subject
              </label>
              <select
                id="q-subject"
                value={effectiveSubjectId}
                onChange={(e) => setSubjectId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="q-title"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Question Title
              </label>
              <input
                id="q-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Explain Cellular Respiration"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="q-prompt"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Question Prompt
            </label>
            <textarea
              id="q-prompt"
              required
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Write the exact question prompt given to students..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="q-model-answer"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Model Answer
            </label>
            <textarea
              id="q-model-answer"
              required
              rows={4}
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              placeholder="Enter the ideal conceptual reference answer. Gemini will also accept valid alternative explanations..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Rubric Builder */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Grading Rubric Criteria
                </h3>
                <p className="text-xs text-slate-500">
                  Break down marks into independent criteria evaluated with
                  student answer evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={addCriterion}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Criterion</span>
              </button>
            </div>

            <div className="space-y-3">
              {criteria.map((criterion, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3.5 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Criterion Name
                    </label>
                    <input
                      type="text"
                      required
                      value={criterion.name}
                      onChange={(e) =>
                        updateCriterion(index, 'name', e.target.value)
                      }
                      placeholder="e.g., Role of chlorophyll"
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Evaluation Expectation
                    </label>
                    <input
                      type="text"
                      value={criterion.description}
                      onChange={(e) =>
                        updateCriterion(index, 'description', e.target.value)
                      }
                      placeholder="What must the student demonstrate?"
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
                      value={criterion.max_marks}
                      onChange={(e) =>
                        updateCriterion(
                          index,
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
                      onClick={() => removeCriterion(index)}
                      disabled={criteria.length <= 1}
                      aria-label={`Remove criterion ${index + 1}`}
                      className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving ? 'Saving Question...' : 'Save Question & Rubric'}
            </button>
          </div>
        </form>
      </section>

      {/* Question Directory */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Question Bank ({questions.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {questions.map((q) => (
            <div
              key={q.id}
              className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-medium text-blue-700">
                    {q.subject_code}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{q.subject_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {q.max_marks} marks
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Rubric v{q.rubric_version}</span>
                  <span aria-hidden="true">·</span>
                  <span>{q.submission_count ?? 0} submissions</span>
                </div>
                <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
                  {q.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                  {q.prompt}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onEditRubric(q.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Edit Rubric</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSubmitForQuestion(q.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer whitespace-nowrap"
                >
                  <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Grade Answer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(q.id, q.title)}
                  aria-label={`Delete ${q.title}`}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
