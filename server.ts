import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  applyManualOverride,
  authenticateTeacher,
  createQuestion,
  createSubject,
  deleteQuestion,
  getDashboardSummary,
  getQuestionById,
  getSubmissionById,
  initDatabase,
  listGradingHistory,
  listQuestions,
  listSubjects,
  listSubmissions,
  registerTeacher,
  saveNewSubmissionGrade,
  updateQuestionRubric,
  updateSubmissionFromRegrade,
} from './server/db.ts';
import { gradeAnswerWithGemini } from './server/geminiGrader.ts';
import type { RegradeResultItem } from './src/types.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '2mb' }));

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const teacher = authenticateTeacher(String(email), String(password));
  if (!teacher) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  res.json({ teacher });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, department } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  try {
    const teacher = registerTeacher(
      String(name),
      String(email),
      String(password),
      String(department ?? 'General Studies')
    );
    res.status(201).json({ teacher });
  } catch (err) {
    res.status(409).json({
      error: err instanceof Error ? err.message : 'Unable to register account.',
    });
  }
});

// Dashboard summary
app.get('/api/dashboard', (_req, res) => {
  res.json(getDashboardSummary());
});

// Subjects
app.get('/api/subjects', (_req, res) => {
  res.json({ subjects: listSubjects() });
});

app.post('/api/subjects', (req, res) => {
  const { name, code, description } = req.body ?? {};
  if (!name || !code) {
    res.status(400).json({ error: 'Subject name and code are required.' });
    return;
  }
  const subject = createSubject(
    String(name),
    String(code),
    String(description ?? '')
  );
  res.status(201).json({ subject });
});

// Questions & Rubrics
app.get('/api/questions', (_req, res) => {
  res.json({ questions: listQuestions() });
});

app.post('/api/questions', (req, res) => {
  const { subject_id, title, prompt, model_answer, criteria } = req.body ?? {};
  if (!subject_id || !title || !prompt || !model_answer) {
    res.status(400).json({
      error: 'Subject, title, question prompt, and model answer are required.',
    });
    return;
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    res.status(400).json({ error: 'At least one rubric criterion is required.' });
    return;
  }
  for (const c of criteria) {
    if (!c.name || !Number.isFinite(Number(c.max_marks)) || Number(c.max_marks) <= 0) {
      res.status(400).json({
        error: 'Each rubric criterion must have a name and positive maximum marks.',
      });
      return;
    }
  }
  const question = createQuestion({
    subject_id: Number(subject_id),
    title: String(title),
    prompt: String(prompt),
    model_answer: String(model_answer),
    criteria: criteria.map((c: { name: string; description?: string; max_marks: number }) => ({
      name: String(c.name),
      description: String(c.description ?? ''),
      max_marks: Number(c.max_marks),
    })),
  });
  res.status(201).json({ question });
});

app.delete('/api/questions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid question ID.' });
    return;
  }
  deleteQuestion(id);
  res.json({ ok: true });
});

// Dynamic Rubric Editing + Automatic Regrading of Affected Answers
app.put('/api/questions/:id/rubric', async (req, res) => {
  const questionId = Number(req.params.id);
  const { criteria } = req.body ?? {};
  if (!Number.isFinite(questionId)) {
    res.status(400).json({ error: 'Invalid question ID.' });
    return;
  }
  const existingQuestion = getQuestionById(questionId);
  if (!existingQuestion) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    res.status(400).json({ error: 'Rubric must contain at least one criterion.' });
    return;
  }
  for (const c of criteria) {
    if (!c.name || !Number.isFinite(Number(c.max_marks)) || Number(c.max_marks) <= 0) {
      res.status(400).json({
        error: 'Each rubric criterion must have a valid name and positive max marks.',
      });
      return;
    }
  }

  const affectedSubmissions = listSubmissions(questionId);
  const updatedQuestion = updateQuestionRubric(
    questionId,
    criteria.map((c: { name: string; description?: string; max_marks: number }) => ({
      name: String(c.name),
      description: String(c.description ?? ''),
      max_marks: Number(c.max_marks),
    }))
  );

  const regradedResults: RegradeResultItem[] = [];
  const errors: Array<{ student_name: string; error: string }> = [];

  for (const sub of affectedSubmissions) {
    try {
      const aiResult = await gradeAnswerWithGemini(updatedQuestion, sub.answer_text);
      const updatedSub = updateSubmissionFromRegrade({
        submission: sub,
        question: updatedQuestion,
        total_score: aiResult.total_score,
        confidence: aiResult.confidence,
        reliability_status: aiResult.reliability_status,
        uncertainty_reasons: aiResult.uncertainty_reasons,
        overall_feedback: aiResult.overall_feedback,
        criterion_grades: aiResult.criterion_grades,
      });
      regradedResults.push({
        submission_id: updatedSub.id,
        student_name: updatedSub.student_name,
        previous_score: sub.total_score,
        new_score: updatedSub.total_score,
        max_marks: updatedQuestion.max_marks,
        previous_confidence: sub.confidence,
        new_confidence: updatedSub.confidence,
        reliability_status: updatedSub.reliability_status,
      });
    } catch (err) {
      errors.push({
        student_name: sub.student_name,
        error: err instanceof Error ? err.message : 'Regrading failed.',
      });
    }
  }

  res.json({
    question: updatedQuestion,
    regraded_count: regradedResults.length,
    regraded_results: regradedResults,
    errors,
  });
});

// Submissions & AI Evaluation
app.get('/api/submissions', (req, res) => {
  const qId = req.query.questionId ? Number(req.query.questionId) : undefined;
  res.json({ submissions: listSubmissions(qId) });
});

app.get('/api/submissions/:id', (req, res) => {
  const id = Number(req.params.id);
  const sub = getSubmissionById(id);
  if (!sub) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  res.json({ submission: sub });
});

app.post('/api/submissions/evaluate', async (req, res) => {
  const { question_id, student_name, student_id, answer_text } = req.body ?? {};
  const qId = Number(question_id);
  if (!Number.isFinite(qId) || !student_name || !answer_text) {
    res.status(400).json({
      error: 'Question, student name, and written answer are required.',
    });
    return;
  }

  const question = getQuestionById(qId);
  if (!question) {
    res.status(404).json({ error: 'Selected question was not found.' });
    return;
  }

  try {
    const aiResult = await gradeAnswerWithGemini(question, String(answer_text));
    const submission = saveNewSubmissionGrade({
      question,
      student_name: String(student_name),
      student_id: String(student_id ?? ''),
      answer_text: String(answer_text),
      total_score: aiResult.total_score,
      confidence: aiResult.confidence,
      reliability_status: aiResult.reliability_status,
      uncertainty_reasons: aiResult.uncertainty_reasons,
      overall_feedback: aiResult.overall_feedback,
      criterion_grades: aiResult.criterion_grades,
    });
    res.status(201).json({ submission });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to evaluate answer with Gemini AI.';
    const status = message.includes('GEMINI_API_KEY') ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

// Manual Teacher Override
app.post('/api/submissions/:id/override', (req, res) => {
  const submissionId = Number(req.params.id);
  const { grades, teacher_note, teacher_name } = req.body ?? {};
  if (!Number.isFinite(submissionId) || !Array.isArray(grades)) {
    res.status(400).json({ error: 'Valid submission ID and criterion grades are required.' });
    return;
  }
  try {
    const submission = applyManualOverride({
      submissionId,
      grades,
      teacher_note: String(teacher_note ?? ''),
      teacher_name: String(teacher_name ?? 'Teacher'),
    });
    res.json({ submission });
  } catch (err) {
    res.status(404).json({
      error: err instanceof Error ? err.message : 'Unable to apply manual override.',
    });
  }
});

// Grading History
app.get('/api/history', (req, res) => {
  const qId = req.query.questionId ? Number(req.query.questionId) : undefined;
  res.json({ history: listGradingHistory(qId) });
});

// CSV Export
function csvCell(val: string | number): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

app.get('/api/results/export', (req, res) => {
  const qId = req.query.questionId ? Number(req.query.questionId) : undefined;
  const submissions = listSubmissions(qId);
  const header = [
    'Submission ID',
    'Student Name',
    'Student ID',
    'Subject',
    'Question',
    'Score',
    'Max Marks',
    'Percentage',
    'AI Confidence (%)',
    'Status',
    'Manual Override',
    'Teacher Note',
    'Graded At',
  ].join(',');

  const lines = submissions.map((s) => {
    const pct = s.max_marks > 0 ? Math.round((s.total_score / s.max_marks) * 100) : 0;
    const statusLabel = s.manual_override
      ? 'Verified by Teacher'
      : s.reliability_status === 'reliable'
      ? 'Reliable'
      : s.reliability_status === 'review_recommended'
      ? 'Teacher Review Recommended'
      : 'Manual Grading Required';

    return [
      csvCell(s.id),
      csvCell(s.student_name),
      csvCell(s.student_id || '-'),
      csvCell(`${s.subject_code ?? ''} ${s.subject_name ?? ''}`.trim()),
      csvCell(s.question_title ?? ''),
      csvCell(s.total_score),
      csvCell(s.max_marks),
      csvCell(`${pct}%`),
      csvCell(s.confidence),
      csvCell(statusLabel),
      csvCell(s.manual_override ? 'Yes' : 'No'),
      csvCell(s.teacher_note),
      csvCell(s.updated_at),
    ].join(',');
  });

  const csv = [header, ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="smartgrade-results.csv"'
  );
  res.send(csv);
});

async function startServer(): Promise<void> {
  const port = 3000;
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*path', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SMARTGRADE server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SMARTGRADE server:', err);
  process.exit(1);
});
