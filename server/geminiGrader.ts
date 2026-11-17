import { GoogleGenAI, Type } from '@google/genai';
import type { CriterionGrade, Question, ReliabilityStatus } from '../src/types.ts';

export interface GeminiGradingOutput {
  total_score: number;
  confidence: number;
  reliability_status: ReliabilityStatus;
  uncertainty_reasons: string[];
  overall_feedback: string;
  criterion_grades: CriterionGrade[];
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add a valid Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('ECONNRESET') ||
        msg.includes('fetch failed');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastError;
}

export async function gradeAnswerWithGemini(
  question: Question,
  studentAnswer: string
): Promise<GeminiGradingOutput> {
  const trimmedAnswer = studentAnswer.trim();
  if (!trimmedAnswer) {
    return {
      total_score: 0,
      confidence: 15,
      reliability_status: 'manual_required',
      uncertainty_reasons: ['Student answer is empty or contains no readable content.'],
      overall_feedback:
        'No answer text was provided. Manual teacher verification is required.',
      criterion_grades: question.criteria.map((c) => ({
        criterion_id: c.id ?? null,
        criterion_name: c.name,
        max_marks: c.max_marks,
        awarded_marks: 0,
        evidence_quote: 'No relevant evidence found in answer.',
        reasoning: 'Student submission is empty.',
        is_manual_override: false,
      })),
    };
  }

  const ai = getAiClient();

  const rubricText = question.criteria
    .map(
      (c, i) =>
        `${i + 1}. Criterion: "${c.name}" | Max Marks: ${c.max_marks} | Expectation: ${
          c.description || 'Evaluate conceptual accuracy for this criterion.'
        }`
    )
    .join('\n');

  const systemInstruction = `You are SMARTGRADE, an expert academic examiner and grading assistant.
Follow this exact 10-step grading process strictly and fairly:
Step 1: Read the question carefully.
Step 2: Understand the teacher's model answer.
Step 3: Read every rubric criterion and its maximum marks.
Step 4: Analyze the student's answer conceptually.
  - Accept correct alternative scientific/academic explanations even if wording differs from the model answer.
  - Do NOT penalize minor grammar, spelling, or punctuation mistakes unless language quality is explicitly part of the rubric.
  - Do NOT award full marks merely for keyword-stuffing if the student does not demonstrate conceptual understanding.
Step 5: Evaluate EACH rubric criterion independently.
Step 6: Award marks (between 0 and the criterion's max_marks, using clean increments such as whole numbers or 0.5) based strictly on evidence present in the student's answer.
Step 7: For every criterion, quote the exact verbatim sentence or phrase from the student's answer as evidence (or write "No relevant evidence found in answer." if absent) and provide a clear, concise explanation for why marks were awarded or deducted.
Step 8: Sum the criterion marks accurately.
Step 9: Estimate grading confidence (0 to 100 integer) and list concrete uncertainty reasons if the answer is unclear, incomplete, ambiguous, contradictory, off-topic, too brief, or borderline.
Step 10: Recommend manual teacher review whenever confidence < 80 or any meaningful uncertainty exists. Never pretend an uncertain evaluation is reliable.`;

  const userPrompt = `QUESTION TITLE: ${question.title}
QUESTION PROMPT:
${question.prompt}

MODEL ANSWER:
${question.model_answer}

TEACHER RUBRIC (Total Max Marks: ${question.max_marks}):
${rubricText}

STUDENT ANSWER TO EVALUATE:
"""
${trimmedAnswer}
"""

Evaluate each of the ${question.criteria.length} rubric criteria in the exact order listed above.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            criteria_evaluations: {
              type: Type.ARRAY,
              description:
                'One evaluation entry per rubric criterion in the exact order given.',
              items: {
                type: Type.OBJECT,
                properties: {
                  criterion_name: {
                    type: Type.STRING,
                    description: 'Exact name of the rubric criterion.',
                  },
                  awarded_marks: {
                    type: Type.NUMBER,
                    description:
                      'Marks awarded for this criterion, between 0 and max_marks.',
                  },
                  evidence_quote: {
                    type: Type.STRING,
                    description:
                      'Exact verbatim quote from student answer supporting the score, or "No relevant evidence found in answer."',
                  },
                  reasoning: {
                    type: Type.STRING,
                    description:
                      'Clear explanation for why marks were awarded or deducted.',
                  },
                },
                required: [
                  'criterion_name',
                  'awarded_marks',
                  'evidence_quote',
                  'reasoning',
                ],
              },
            },
            confidence: {
              type: Type.INTEGER,
              description:
                'Estimated grading confidence percentage from 0 to 100.',
            },
            manual_review_recommended: {
              type: Type.BOOLEAN,
              description:
                'True if the answer is ambiguous, incomplete, off-topic, or confidence is below 80.',
            },
            uncertainty_reasons: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                'Specific reasons for uncertainty or why teacher review is recommended. Empty array if reliable.',
            },
            overall_feedback: {
              type: Type.STRING,
              description:
                'Concise overall summary of strengths, gaps, and reliability.',
            },
          },
          required: [
            'criteria_evaluations',
            'confidence',
            'manual_review_recommended',
            'uncertainty_reasons',
            'overall_feedback',
          ],
        },
      },
    })
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty response while grading.');
  }

  let parsed: {
    criteria_evaluations: Array<{
      criterion_name: string;
      awarded_marks: number;
      evidence_quote: string;
      reasoning: string;
    }>;
    confidence: number;
    manual_review_recommended: boolean;
    uncertainty_reasons: string[];
    overall_feedback: string;
  };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Failed to parse structured JSON grading output from Gemini.');
  }

  // Reconcile & clamp marks strictly against the authoritative rubric in SQLite
  const criterionGrades: CriterionGrade[] = question.criteria.map((criterion, idx) => {
    const match =
      parsed.criteria_evaluations.find(
        (e) =>
          e.criterion_name.trim().toLowerCase() === criterion.name.trim().toLowerCase()
      ) ?? parsed.criteria_evaluations[idx];

    const rawAwarded = match ? Number(match.awarded_marks) : 0;
    const clamped = Number.isFinite(rawAwarded)
      ? Math.max(0, Math.min(criterion.max_marks, Math.round(rawAwarded * 2) / 2))
      : 0;

    return {
      criterion_id: criterion.id ?? null,
      criterion_name: criterion.name,
      max_marks: criterion.max_marks,
      awarded_marks: clamped,
      evidence_quote:
        match?.evidence_quote?.trim() || 'No relevant evidence found in answer.',
      reasoning:
        match?.reasoning?.trim() || 'Criterion evaluated against student response.',
      is_manual_override: false,
    };
  });

  const totalScore =
    Math.round(criterionGrades.reduce((sum, g) => sum + g.awarded_marks, 0) * 100) /
    100;

  const confidence = Math.max(
    0,
    Math.min(100, Math.round(Number(parsed.confidence) || 0))
  );
  const uncertaintyReasons = Array.isArray(parsed.uncertainty_reasons)
    ? parsed.uncertainty_reasons.map((r) => String(r).trim()).filter(Boolean)
    : [];

  let reliabilityStatus: ReliabilityStatus = 'reliable';
  if (confidence < 55) {
    reliabilityStatus = 'manual_required';
  } else if (
    confidence < 80 ||
    parsed.manual_review_recommended ||
    uncertaintyReasons.length > 0
  ) {
    reliabilityStatus = 'review_recommended';
  }

  return {
    total_score: totalScore,
    confidence,
    reliability_status: reliabilityStatus,
    uncertainty_reasons: uncertaintyReasons,
    overall_feedback:
      parsed.overall_feedback?.trim() || 'AI evaluation completed against rubric.',
    criterion_grades: criterionGrades,
  };
}
