import type {
  DashboardSummary,
  GradingHistoryEntry,
  Question,
  RegradeResultItem,
  Subject,
  Submission,
  TeacherProfile,
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ teacher: TeacherProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(name: string, email: string, password: string, department: string) {
    return request<{ teacher: TeacherProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, department }),
    });
  },

  getDashboard() {
    return request<DashboardSummary>('/api/dashboard');
  },

  getSubjects() {
    return request<{ subjects: Subject[] }>('/api/subjects');
  },

  createSubject(name: string, code: string, description: string) {
    return request<{ subject: Subject }>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify({ name, code, description }),
    });
  },

  getQuestions() {
    return request<{ questions: Question[] }>('/api/questions');
  },

  createQuestion(payload: {
    subject_id: number;
    title: string;
    prompt: string;
    model_answer: string;
    criteria: Array<{ name: string; description: string; max_marks: number }>;
  }) {
    return request<{ question: Question }>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteQuestion(id: number) {
    return request<{ ok: boolean }>(`/api/questions/${id}`, {
      method: 'DELETE',
    });
  },

  updateRubricAndRegrade(
    questionId: number,
    criteria: Array<{ name: string; description: string; max_marks: number }>
  ) {
    return request<{
      question: Question;
      regraded_count: number;
      regraded_results: RegradeResultItem[];
      errors: Array<{ student_name: string; error: string }>;
    }>(`/api/questions/${questionId}/rubric`, {
      method: 'PUT',
      body: JSON.stringify({ criteria }),
    });
  },

  getSubmissions(questionId?: number) {
    const query = questionId ? `?questionId=${questionId}` : '';
    return request<{ submissions: Submission[] }>(`/api/submissions${query}`);
  },

  getSubmission(id: number) {
    return request<{ submission: Submission }>(`/api/submissions/${id}`);
  },

  evaluateSubmission(payload: {
    question_id: number;
    student_name: string;
    student_id: string;
    answer_text: string;
  }) {
    return request<{ submission: Submission }>('/api/submissions/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  applyManualOverride(
    submissionId: number,
    payload: {
      grades: Array<{ id: number; awarded_marks: number; reasoning?: string }>;
      teacher_note: string;
      teacher_name: string;
    }
  ) {
    return request<{ submission: Submission }>(
      `/api/submissions/${submissionId}/override`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  getHistory(questionId?: number) {
    const query = questionId ? `?questionId=${questionId}` : '';
    return request<{ history: GradingHistoryEntry[] }>(`/api/history${query}`);
  },
};
