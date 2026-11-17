export type PageId =
  | 'workspace'
  | 'results'
  | 'history'
  | 'create-question';

export interface TeacherProfile {
  id: number;
  name: string;
  email: string;
  department: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  question_count?: number;
  submission_count?: number;
  created_at: string;
}

export interface RubricCriterion {
  id?: number;
  question_id?: number;
  name: string;
  description: string;
  max_marks: number;
  sort_order?: number;
}

export interface Question {
  id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  title: string;
  prompt: string;
  model_answer: string;
  max_marks: number;
  rubric_version: number;
  criteria: RubricCriterion[];
  submission_count?: number;
  created_at: string;
  updated_at: string;
}

export type ReliabilityStatus =
  | 'reliable'
  | 'review_recommended'
  | 'manual_required';

export interface CriterionGrade {
  id?: number;
  submission_id?: number;
  criterion_id: number | null;
  criterion_name: string;
  max_marks: number;
  awarded_marks: number;
  evidence_quote: string;
  reasoning: string;
  is_manual_override: boolean;
}

export interface Submission {
  id: number;
  question_id: number;
  question_title?: string;
  question_prompt?: string;
  model_answer?: string;
  subject_name?: string;
  subject_code?: string;
  student_name: string;
  student_id: string;
  answer_text: string;
  total_score: number;
  max_marks: number;
  confidence: number;
  reliability_status: ReliabilityStatus;
  uncertainty_reasons: string[];
  overall_feedback: string;
  manual_override: boolean;
  teacher_note: string;
  rubric_version: number;
  criterion_grades: CriterionGrade[];
  graded_at: string;
  updated_at: string;
}

export type HistoryEventType =
  | 'initial_ai'
  | 'rubric_regrade'
  | 'manual_override';

export interface GradingHistoryEntry {
  id: number;
  submission_id: number;
  question_id: number;
  student_name: string;
  question_title: string;
  event_type: HistoryEventType;
  previous_score: number | null;
  new_score: number;
  max_marks: number;
  previous_confidence: number | null;
  new_confidence: number;
  rubric_version: number;
  summary: string;
  details: {
    criteria_changes?: Array<{
      criterion_name: string;
      previous_marks?: number;
      new_marks: number;
      max_marks: number;
      reason?: string;
    }>;
    teacher_note?: string;
  };
  actor_name: string;
  created_at: string;
}

export interface DashboardSummary {
  total_subjects: number;
  total_questions: number;
  total_submissions: number;
  class_average_pct: number;
  pending_reviews: number;
  average_confidence: number;
  recent_submissions: Submission[];
  review_queue: Submission[];
  subject_stats: Array<{
    id: number;
    name: string;
    code: string;
    question_count: number;
    submission_count: number;
    average_pct: number | null;
  }>;
}

export interface RegradeResultItem {
  submission_id: number;
  student_name: string;
  previous_score: number;
  new_score: number;
  max_marks: number;
  previous_confidence: number;
  new_confidence: number;
  reliability_status: ReliabilityStatus;
}
