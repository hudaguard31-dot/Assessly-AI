import { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Sparkles, Upload } from 'lucide-react';
import { api } from '../api';
import type { Question, Submission } from '../types';

interface SubmitAnswerPageProps {
  questions: Question[];
  initialQuestionId: number | null;
  onSubmissionGraded: (submission: Submission) => Promise<void>;
}

export function SubmitAnswerPage({
  questions,
  initialQuestionId,
  onSubmissionGraded,
}: SubmitAnswerPageProps) {
  const [questionId, setQuestionId] = useState<number>(
    initialQuestionId ?? questions[0]?.id ?? 0
  );
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQuestionId && questions.some((q) => q.id === initialQuestionId)) {
      setQuestionId(initialQuestionId);
    }
  }, [initialQuestionId, questions]);

  const selectedQuestion =
    questions.find((q) => q.id === questionId) ?? questions[0] ?? null;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setAnswerText(content);
      if (!studentName.trim()) {
        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        setStudentName(cleanName);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function loadTestPreset(kind: 'strong' | 'ambiguous') {
    if (!selectedQuestion) return;
    if (selectedQuestion.title.toLowerCase().includes('photosynthesis')) {
      if (kind === 'strong') {
        setStudentName('Priya Nair');
        setStudentId('STU-1148');
        setAnswerText(
          'Photosynthesis is the biological process where plants transform solar energy into stored chemical energy in sugar. Sunlight acts as the energy driver, absorbed by the green pigment chlorophyll inside chloroplasts. Using carbon dioxide from the air and water from the roots, plants synthesize glucose and give off oxygen gas.'
        );
      } else {
        setStudentName('Jordan Lee');
        setStudentId('STU-1152');
        setAnswerText(
          'Plants use sun and water and chlorophyll to stay green and make energy for themselves. Oxygen and carbon dioxide are part of it too.'
        );
      }
      return;
    }

    if (kind === 'strong') {
      setStudentName('Noah Bennett');
      setStudentId('STU-1190');
      setAnswerText(selectedQuestion.model_answer);
    } else {
      setStudentName('Taylor Kim');
      setStudentId('STU-1194');
      setAnswerText(
        'It relates to the main idea in class and involves several factors working together depending on the situation.'
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuestion) return;
    setError('');
    setEvaluating(true);
    try {
      const res = await api.evaluateSubmission({
        question_id: selectedQuestion.id,
        student_name: studentName,
        student_id: studentId,
        answer_text: answerText,
      });
      await onSubmissionGraded(res.submission);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to evaluate answer with Gemini AI.'
      );
    } finally {
      setEvaluating(false);
    }
  }

  if (!selectedQuestion) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        Create a question first before submitting student answers.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Submission Form */}
      <section className="xl:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Submit Student Written Answer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter or upload a student answer to evaluate against the active
              rubric with Gemini AI.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadTestPreset('strong')}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              Sample Strong
            </button>
            <button
              type="button"
              onClick={() => loadTestPreset('ambiguous')}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              Sample Ambiguous
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="sub-question"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Assessment Question
            </label>
            <select
              id="sub-question"
              value={selectedQuestion.id}
              onChange={(e) => setQuestionId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.subject_code}] {q.title} ({q.max_marks} marks)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sub-student-name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Student Name
              </label>
              <input
                id="sub-student-name"
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g., Aarav Sharma"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="sub-student-id"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Student ID (Optional)
              </label>
              <input
                id="sub-student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g., STU-1042"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="sub-answer-text"
                className="block text-sm font-medium text-slate-700"
              >
                Student Written Answer
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload .txt / .md</span>
                <input
                  type="file"
                  accept=".txt,.md,.text"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
            <textarea
              id="sub-answer-text"
              required
              rows={8}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Paste or type the student's written answer here..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 leading-relaxed focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Minor spelling or grammar mistakes are ignored unless language is
              part of the rubric. Valid alternative explanations receive full
              conceptual credit.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={evaluating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {evaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Evaluating with Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Evaluate Answer with AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Right Reference Panel: Question, Rubric & Model Answer */}
      <aside className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-medium text-blue-700">
              {selectedQuestion.subject_code}
            </span>
            <span aria-hidden="true">·</span>
            <span>{selectedQuestion.subject_name}</span>
            <span aria-hidden="true">·</span>
            <span>Rubric v{selectedQuestion.rubric_version}</span>
          </div>
          <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
            {selectedQuestion.title}
          </h3>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            {selectedQuestion.prompt}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-700">
              Active Rubric Criteria
            </h4>
            <span className="font-mono tabular-nums text-xs font-semibold text-blue-700">
              Total: {selectedQuestion.max_marks} marks
            </span>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {selectedQuestion.criteria.map((c, i) => (
              <li key={i} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {c.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.description}
                    </p>
                  )}
                </div>
                <span className="font-mono tabular-nums text-xs font-medium text-slate-700 shrink-0">
                  {c.max_marks}m
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowModelAnswer((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <span>Reference Model Answer</span>
            {showModelAnswer ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showModelAnswer && (
            <p className="mt-2.5 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              {selectedQuestion.model_answer}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
