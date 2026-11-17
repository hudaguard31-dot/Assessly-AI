import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import type {
  CriterionGrade,
  DashboardSummary,
  GradingHistoryEntry,
  Question,
  ReliabilityStatus,
  RubricCriterion,
  Subject,
  Submission,
  TeacherProfile,
} from '../src/types.ts';

const DB_PATH = path.resolve(process.cwd(), 'smartgrade.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(originalHash, 'hex'),
    Buffer.from(candidate, 'hex')
  );
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'General Studies',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model_answer TEXT NOT NULL,
      max_marks REAL NOT NULL,
      rubric_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      max_marks REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL DEFAULT '',
      answer_text TEXT NOT NULL,
      total_score REAL NOT NULL,
      max_marks REAL NOT NULL,
      confidence INTEGER NOT NULL,
      reliability_status TEXT NOT NULL,
      uncertainty_reasons TEXT NOT NULL DEFAULT '[]',
      overall_feedback TEXT NOT NULL DEFAULT '',
      manual_override INTEGER NOT NULL DEFAULT 0,
      teacher_note TEXT NOT NULL DEFAULT '',
      rubric_version INTEGER NOT NULL DEFAULT 1,
      graded_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS criterion_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      criterion_id INTEGER,
      criterion_name TEXT NOT NULL,
      max_marks REAL NOT NULL,
      awarded_marks REAL NOT NULL,
      evidence_quote TEXT NOT NULL DEFAULT '',
      reasoning TEXT NOT NULL DEFAULT '',
      is_manual_override INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS grading_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      question_title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      previous_score REAL,
      new_score REAL NOT NULL,
      max_marks REAL NOT NULL,
      previous_confidence INTEGER,
      new_confidence INTEGER NOT NULL,
      rubric_version INTEGER NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const teacherCount = db
    .prepare('SELECT COUNT(*) as count FROM teachers')
    .get() as { count: number };

  if (teacherCount.count === 0) {
    db.prepare(
      'INSERT INTO teachers (name, email, password_hash, department) VALUES (?, ?, ?, ?)'
    ).run(
      'Dr. Elena Vance',
      'elena.vance@smartgrade.edu',
      hashPassword('smartgrade2026'),
      'Life Sciences & STEM Assessment'
    );
  }

  const subjectCount = db
    .prepare('SELECT COUNT(*) as count FROM subjects')
    .get() as { count: number };

  if (subjectCount.count > 0) return;

  const insertSubject = db.prepare(
    'INSERT INTO subjects (name, code, description) VALUES (?, ?, ?)'
  );
  const bioId = Number(
    insertSubject.run(
      'Cellular Biology',
      'BIO-101',
      'Foundational cellular energetics, metabolic pathways, and plant physiology.'
    ).lastInsertRowid
  );
  const phyId = Number(
    insertSubject.run(
      'Classical Mechanics',
      'PHY-204',
      'Newtonian dynamics, force diagrams, momentum conservation, and kinematics.'
    ).lastInsertRowid
  );
  const hisId = Number(
    insertSubject.run(
      'Modern World History',
      'HIS-110',
      'Industrial transformation, socio-economic shifts, and 19th-century institutions.'
    ).lastInsertRowid
  );

  const insertQuestion = db.prepare(
    `INSERT INTO questions (subject_id, title, prompt, model_answer, max_marks, rubric_version)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertCriterion = db.prepare(
    `INSERT INTO rubric_criteria (question_id, name, description, max_marks, sort_order)
     VALUES (?, ?, ?, ?, ?)`
  );

  // Question 1: Exact Photosynthesis example from requirements
  const q1Id = Number(
    insertQuestion.run(
      bioId,
      'Explain Photosynthesis',
      'Explain the process of photosynthesis in green plants, including the key inputs, energy source, pigment involved, and products formed.',
      'Photosynthesis is the biochemical process by which green plants, algae, and some bacteria convert light energy into chemical energy. Sunlight provides the energy required to drive the reaction, while chlorophyll inside chloroplasts absorbs light energy. Plants take in carbon dioxide from the atmosphere and water from the soil, converting them into glucose (sugar used for energy and growth) and releasing oxygen as a byproduct.',
      10,
      1
    ).lastInsertRowid
  );

  const q1Criteria = [
    {
      name: 'Definition',
      description: 'Defines photosynthesis as converting light energy into chemical energy / food in plants.',
      max_marks: 2,
    },
    {
      name: 'Role of sunlight',
      description: 'Explains that sunlight acts as the primary energy source driving the reaction.',
      max_marks: 2,
    },
    {
      name: 'Role of chlorophyll',
      description: 'Identifies chlorophyll (in chloroplasts) as the pigment that absorbs light.',
      max_marks: 2,
    },
    {
      name: 'Carbon dioxide and water',
      description: 'Identifies both carbon dioxide (CO2) and water (H2O) as essential reactants/inputs.',
      max_marks: 2,
    },
    {
      name: 'Formation of glucose and oxygen',
      description: 'States that glucose (sugar) and oxygen (O2) are produced as outputs.',
      max_marks: 2,
    },
  ];

  const q1CriterionIds: number[] = [];
  q1Criteria.forEach((c, idx) => {
    const cid = Number(
      insertCriterion.run(q1Id, c.name, c.description, c.max_marks, idx).lastInsertRowid
    );
    q1CriterionIds.push(cid);
  });

  // Question 2: Physics Newton's Second Law
  const q2Id = Number(
    insertQuestion.run(
      phyId,
      "Newton's Second Law of Motion",
      "State Newton's Second Law of Motion and explain how net force and mass affect an object's acceleration, including a real-world example.",
      "Newton's Second Law states that the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass, expressed as F_net = m * a. Increasing the net force increases acceleration, whereas increasing mass decreases acceleration for the same applied force. For example, pushing an empty shopping cart accelerates it much faster than pushing a heavily loaded cart with the same force.",
      8,
      1
    ).lastInsertRowid
  );

  const q2Criteria = [
    {
      name: 'Law Statement & Equation',
      description: 'Accurately states F = ma or defines net force in relation to mass and acceleration.',
      max_marks: 3,
    },
    {
      name: 'Direct & Inverse Proportionality',
      description: 'Explains direct relationship with net force and inverse relationship with mass.',
      max_marks: 3,
    },
    {
      name: 'Practical Example',
      description: 'Provides a coherent physical example illustrating mass or force changes.',
      max_marks: 2,
    },
  ];

  const q2CriterionIds: number[] = [];
  q2Criteria.forEach((c, idx) => {
    const cid = Number(
      insertCriterion.run(q2Id, c.name, c.description, c.max_marks, idx).lastInsertRowid
    );
    q2CriterionIds.push(cid);
  });

  // Question 3: History
  const q3Id = Number(
    insertQuestion.run(
      hisId,
      'Causes of the First Industrial Revolution',
      'Identify and explain two major factors that enabled the First Industrial Revolution to begin in 18th-century Britain.',
      'Britain possessed abundant accessible coal and iron deposits to fuel steam engines and build machinery, alongside agricultural improvements (enclosure and crop rotation) that increased food supply and freed rural labor for urban factories. Additionally, stable financial institutions and colonial trade networks provided capital for industrial investment.',
      6,
      1
    ).lastInsertRowid
  );
  q3CriteriaSeed(q3Id);

  function q3CriteriaSeed(questionId: number) {
    const list = [
      {
        name: 'Natural Resources (Coal & Iron)',
        description: 'Explains how accessible coal/iron enabled steam power and manufacturing.',
        max_marks: 3,
      },
      {
        name: 'Labor, Agriculture, or Capital',
        description: 'Explains a second structural driver such as agricultural surplus, labor shift, or investment capital.',
        max_marks: 3,
      },
    ];
    list.forEach((c, idx) => {
      insertCriterion.run(questionId, c.name, c.description, c.max_marks, idx);
    });
  }

  // Seed realistic sample submissions
  const insertSubmission = db.prepare(
    `INSERT INTO submissions (
      question_id, student_name, student_id, answer_text, total_score, max_marks,
      confidence, reliability_status, uncertainty_reasons, overall_feedback,
      manual_override, teacher_note, rubric_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertGrade = db.prepare(
    `INSERT INTO criterion_grades (
      submission_id, criterion_id, criterion_name, max_marks, awarded_marks,
      evidence_quote, reasoning, is_manual_override
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHistory = db.prepare(
    `INSERT INTO grading_history (
      submission_id, question_id, student_name, question_title, event_type,
      previous_score, new_score, max_marks, previous_confidence, new_confidence,
      rubric_version, summary, details_json, actor_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Submission 1: 8/10 Photosynthesis (matches prompt example)
  const s1Id = Number(
    insertSubmission.run(
      q1Id,
      'Aarav Sharma',
      'STU-1042',
      'Photosynthesis is the process where green plants convert light energy into chemical food energy. Sunlight gives the energy needed to power this process. Chlorophyll is a green pigment in leaves, though I am not completely sure what role it plays inside the cell. Plants take in carbon dioxide from air and water from soil to make glucose.',
      8,
      10,
      85,
      'reliable',
      JSON.stringify([]),
      'Strong conceptual explanation covering definition, energy source, and reactants. Partial credit on chlorophyll role and missing explicit mention of oxygen release.',
      0,
      '',
      1
    ).lastInsertRowid
  );

  const s1Grades = [
    {
      cid: q1CriterionIds[0],
      name: 'Definition',
      max: 2,
      awarded: 2,
      quote: 'Photosynthesis is the process where green plants convert light energy into chemical food energy.',
      reason: 'Clearly defines photosynthesis as light-to-chemical energy conversion in green plants.',
    },
    {
      cid: q1CriterionIds[1],
      name: 'Role of sunlight',
      max: 2,
      awarded: 2,
      quote: 'Sunlight gives the energy needed to power this process.',
      reason: 'Accurately identifies sunlight as the driving energy source.',
    },
    {
      cid: q1CriterionIds[2],
      name: 'Role of chlorophyll',
      max: 2,
      awarded: 1,
      quote: 'Chlorophyll is a green pigment in leaves, though I am not completely sure what role it plays inside the cell.',
      reason: 'Correctly identifies chlorophyll as a green pigment in leaves, but omits its role in absorbing light energy.',
    },
    {
      cid: q1CriterionIds[3],
      name: 'Carbon dioxide and water',
      max: 2,
      awarded: 2,
      quote: 'Plants take in carbon dioxide from air and water from soil',
      reason: 'Explicitly identifies both carbon dioxide and water as inputs.',
    },
    {
      cid: q1CriterionIds[4],
      name: 'Formation of glucose and oxygen',
      max: 2,
      awarded: 1,
      quote: 'to make glucose.',
      reason: 'Correctly mentions glucose formation, but omits oxygen as a byproduct.',
    },
  ];
  for (const g of s1Grades) {
    insertGrade.run(s1Id, g.cid, g.name, g.max, g.awarded, g.quote, g.reason, 0);
  }
  insertHistory.run(
    s1Id,
    q1Id,
    'Aarav Sharma',
    'Explain Photosynthesis',
    'initial_ai',
    null,
    8,
    10,
    null,
    85,
    1,
    'Initial AI evaluation completed using Rubric v1.',
    JSON.stringify({
      criteria_changes: s1Grades.map((g) => ({
        criterion_name: g.name,
        new_marks: g.awarded,
        max_marks: g.max,
        reason: g.reason,
      })),
    }),
    'Gemini AI'
  );

  // Submission 2: Ambiguous / incomplete Photosynthesis flagged for Teacher Review
  const s2Id = Number(
    insertSubmission.run(
      q1Id,
      'Maya Lin',
      'STU-1089',
      'Plants breathe in air and drink water in the sun and green leaves make food and stuff for growing. Chlorophyll and glucose happen in the daytime.',
      4.5,
      10,
      62,
      'review_recommended',
      JSON.stringify([
        'Vague colloquial phrasing ("air", "food and stuff") leaves uncertainty whether carbon dioxide and oxygen are understood.',
        'Keywords "chlorophyll" and "glucose" are listed without explaining their functional roles.',
      ]),
      'Student shows intuitive awareness that sunlight, water, and leaves are involved, but technical concepts are phrased ambiguously. Manual teacher review is recommended to determine partial credit intent.',
      0,
      '',
      1
    ).lastInsertRowid
  );
  const s2Grades = [
    {
      cid: q1CriterionIds[0],
      name: 'Definition',
      max: 2,
      awarded: 1,
      quote: 'green leaves make food and stuff for growing.',
      reason: 'Captures food production in leaves but lacks explanation of light-to-chemical energy conversion.',
    },
    {
      cid: q1CriterionIds[1],
      name: 'Role of sunlight',
      max: 2,
      awarded: 1,
      quote: 'in the sun ... happen in the daytime.',
      reason: 'Implies sunlight presence during daytime, but does not explain sunlight as the energy source.',
    },
    {
      cid: q1CriterionIds[2],
      name: 'Role of chlorophyll',
      max: 2,
      awarded: 0.5,
      quote: 'Chlorophyll and glucose happen in the daytime.',
      reason: 'Mentions the keyword chlorophyll without explaining what it is or that it absorbs light.',
    },
    {
      cid: q1CriterionIds[3],
      name: 'Carbon dioxide and water',
      max: 2,
      awarded: 1,
      quote: 'Plants breathe in air and drink water',
      reason: 'Identifies water, but refers generally to "air" rather than specifying carbon dioxide.',
    },
    {
      cid: q1CriterionIds[4],
      name: 'Formation of glucose and oxygen',
      max: 2,
      awarded: 1,
      quote: 'make food ... and glucose happen',
      reason: 'Mentions glucose/food formation, but omits oxygen gas release.',
    },
  ];
  for (const g of s2Grades) {
    insertGrade.run(s2Id, g.cid, g.name, g.max, g.awarded, g.quote, g.reason, 0);
  }
  insertHistory.run(
    s2Id,
    q1Id,
    'Maya Lin',
    'Explain Photosynthesis',
    'initial_ai',
    null,
    4.5,
    10,
    null,
    62,
    1,
    'Initial AI evaluation flagged for teacher review due to ambiguous phrasing.',
    JSON.stringify({
      criteria_changes: s2Grades.map((g) => ({
        criterion_name: g.name,
        new_marks: g.awarded,
        max_marks: g.max,
        reason: g.reason,
      })),
    }),
    'Gemini AI'
  );

  // Submission 3: High-scoring alternative wording Photosynthesis
  const s3Id = Number(
    insertSubmission.run(
      q1Id,
      'Liam O’Connor',
      'STU-1104',
      'Photosynthesis is how autotrophic plants capture solar radiation to synthesize sugars from inorganic molecules. Inside green leaf cells, the pigment chlorophyll traps light energy. Using water absorbed by roots and carbon dioxide entering stomata, the plant produces glucose for energy and releases oxygen gas into the air.',
      10,
      10,
      96,
      'reliable',
      JSON.stringify([]),
      'Comprehensive, accurate explanation using sound alternative scientific phrasing ("autotrophic", "solar radiation", "stomata"). All rubric criteria fully satisfied.',
      0,
      '',
      1
    ).lastInsertRowid
  );
  const s3Grades = [
    {
      cid: q1CriterionIds[0],
      name: 'Definition',
      max: 2,
      awarded: 2,
      quote: 'Photosynthesis is how autotrophic plants capture solar radiation to synthesize sugars from inorganic molecules.',
      reason: 'Accurately defines the energy capture and chemical synthesis process.',
    },
    {
      cid: q1CriterionIds[1],
      name: 'Role of sunlight',
      max: 2,
      awarded: 2,
      quote: 'capture solar radiation ... traps light energy.',
      reason: 'Clearly identifies solar light as the energy input.',
    },
    {
      cid: q1CriterionIds[2],
      name: 'Role of chlorophyll',
      max: 2,
      awarded: 2,
      quote: 'the pigment chlorophyll traps light energy.',
      reason: 'Correctly describes chlorophyll as the light-trapping pigment.',
    },
    {
      cid: q1CriterionIds[3],
      name: 'Carbon dioxide and water',
      max: 2,
      awarded: 2,
      quote: 'Using water absorbed by roots and carbon dioxide entering stomata',
      reason: 'Identifies both reactants and their physiological entry points.',
    },
    {
      cid: q1CriterionIds[4],
      name: 'Formation of glucose and oxygen',
      max: 2,
      awarded: 2,
      quote: 'produces glucose for energy and releases oxygen gas into the air.',
      reason: 'Explicitly accounts for both glucose and oxygen outputs.',
    },
  ];
  for (const g of s3Grades) {
    insertGrade.run(s3Id, g.cid, g.name, g.max, g.awarded, g.quote, g.reason, 0);
  }
  insertHistory.run(
    s3Id,
    q1Id,
    'Liam O’Connor',
    'Explain Photosynthesis',
    'initial_ai',
    null,
    10,
    10,
    null,
    96,
    1,
    'Initial AI evaluation completed using Rubric v1.',
    JSON.stringify({
      criteria_changes: s3Grades.map((g) => ({
        criterion_name: g.name,
        new_marks: g.awarded,
        max_marks: g.max,
        reason: g.reason,
      })),
    }),
    'Gemini AI'
  );

  // Submission 4: Physics submission
  const s4Id = Number(
    insertSubmission.run(
      q2Id,
      'Sofia Alvarez',
      'STU-1027',
      'Newtons second law says force equals mass times acceleration (F = ma). If you push harder with a bigger net force, the object accelerates faster. Also heavier objects with more mass are harder to speed up so acceleration goes down. Like kicking a soccer ball goes way further than kicking a bowling ball with the same kick.',
      8,
      8,
      92,
      'reliable',
      JSON.stringify([]),
      'Clear conceptual mastery of F=ma, proportionalities, and a strong comparative example. Minor apostrophe omission ignored per grading guidelines.',
      0,
      '',
      1
    ).lastInsertRowid
  );
  const s4Grades = [
    {
      cid: q2CriterionIds[0],
      name: 'Law Statement & Equation',
      max: 3,
      awarded: 3,
      quote: 'Newtons second law says force equals mass times acceleration (F = ma).',
      reason: 'Correctly states the law and mathematical equation.',
    },
    {
      cid: q2CriterionIds[1],
      name: 'Direct & Inverse Proportionality',
      max: 3,
      awarded: 3,
      quote: 'If you push harder with a bigger net force, the object accelerates faster. Also heavier objects with more mass are harder to speed up so acceleration goes down.',
      reason: 'Explains both direct proportionality to net force and inverse proportionality to mass accurately.',
    },
    {
      cid: q2CriterionIds[2],
      name: 'Practical Example',
      max: 2,
      awarded: 2,
      quote: 'Like kicking a soccer ball goes way further than kicking a bowling ball with the same kick.',
      reason: 'Provides an intuitive real-world example comparing different masses under equal force.',
    },
  ];
  for (const g of s4Grades) {
    insertGrade.run(s4Id, g.cid, g.name, g.max, g.awarded, g.quote, g.reason, 0);
  }
  insertHistory.run(
    s4Id,
    q2Id,
    'Sofia Alvarez',
    "Newton's Second Law of Motion",
    'initial_ai',
    null,
    8,
    8,
    null,
    92,
    1,
    'Initial AI evaluation completed using Rubric v1.',
    JSON.stringify({
      criteria_changes: s4Grades.map((g) => ({
        criterion_name: g.name,
        new_marks: g.awarded,
        max_marks: g.max,
        reason: g.reason,
      })),
    }),
    'Gemini AI'
  );
}

// Auth queries
export function authenticateTeacher(
  email: string,
  password: string
): TeacherProfile | null {
  const row = db
    .prepare('SELECT id, name, email, password_hash, department FROM teachers WHERE email = ?')
    .get(email.trim().toLowerCase()) as
    | {
        id: number;
        name: string;
        email: string;
        password_hash: string;
        department: string;
      }
    | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department,
  };
}

export function registerTeacher(
  name: string,
  email: string,
  password: string,
  department: string
): TeacherProfile {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db
    .prepare('SELECT id FROM teachers WHERE email = ?')
    .get(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }
  const passwordHash = hashPassword(password);
  const res = db
    .prepare(
      'INSERT INTO teachers (name, email, password_hash, department) VALUES (?, ?, ?, ?)'
    )
    .run(name.trim(), normalizedEmail, passwordHash, department.trim() || 'General Studies');
  return {
    id: Number(res.lastInsertRowid),
    name: name.trim(),
    email: normalizedEmail,
    department: department.trim() || 'General Studies',
  };
}

// Subjects
export function listSubjects(): Subject[] {
  return db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) as question_count,
        (SELECT COUNT(*) FROM submissions sub
          JOIN questions q2 ON q2.id = sub.question_id
          WHERE q2.subject_id = s.id) as submission_count
       FROM subjects s
       ORDER BY s.id ASC`
    )
    .all() as Subject[];
}

export function createSubject(
  name: string,
  code: string,
  description: string
): Subject {
  const res = db
    .prepare('INSERT INTO subjects (name, code, description) VALUES (?, ?, ?)')
    .run(name.trim(), code.trim().toUpperCase(), description.trim());
  return db
    .prepare('SELECT *, 0 as question_count, 0 as submission_count FROM subjects WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as Subject;
}

// Questions & Rubrics
export function listQuestions(): Question[] {
  const rows = db
    .prepare(
      `SELECT q.*, s.name as subject_name, s.code as subject_code,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.question_id = q.id) as submission_count
       FROM questions q
       JOIN subjects s ON s.id = q.subject_id
       ORDER BY q.id DESC`
    )
    .all() as Array<Omit<Question, 'criteria'>>;

  const criteriaStmt = db.prepare(
    'SELECT * FROM rubric_criteria WHERE question_id = ? ORDER BY sort_order ASC, id ASC'
  );

  return rows.map((q) => ({
    ...q,
    criteria: criteriaStmt.all(q.id) as RubricCriterion[],
  }));
}

export function getQuestionById(id: number): Question | null {
  const row = db
    .prepare(
      `SELECT q.*, s.name as subject_name, s.code as subject_code,
        (SELECT COUNT(*) FROM submissions sub WHERE sub.question_id = q.id) as submission_count
       FROM questions q
       JOIN subjects s ON s.id = q.subject_id
       WHERE q.id = ?`
    )
    .get(id) as Omit<Question, 'criteria'> | undefined;

  if (!row) return null;

  const criteria = db
    .prepare(
      'SELECT * FROM rubric_criteria WHERE question_id = ? ORDER BY sort_order ASC, id ASC'
    )
    .all(id) as RubricCriterion[];

  return {
    ...row,
    criteria,
  };
}

export function createQuestion(input: {
  subject_id: number;
  title: string;
  prompt: string;
  model_answer: string;
  criteria: Array<{ name: string; description: string; max_marks: number }>;
}): Question {
  const maxMarks = input.criteria.reduce((sum, c) => sum + Number(c.max_marks), 0);

  const tx = db.transaction(() => {
    const qRes = db
      .prepare(
        `INSERT INTO questions (subject_id, title, prompt, model_answer, max_marks, rubric_version)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(
        input.subject_id,
        input.title.trim(),
        input.prompt.trim(),
        input.model_answer.trim(),
        maxMarks
      );

    const questionId = Number(qRes.lastInsertRowid);
    const critStmt = db.prepare(
      `INSERT INTO rubric_criteria (question_id, name, description, max_marks, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );

    input.criteria.forEach((c, idx) => {
      critStmt.run(
        questionId,
        c.name.trim(),
        c.description.trim(),
        Number(c.max_marks),
        idx
      );
    });

    return questionId;
  });

  const newId = tx();
  return getQuestionById(newId)!;
}

export function updateQuestionRubric(
  questionId: number,
  criteria: Array<{ name: string; description: string; max_marks: number }>
): Question {
  const maxMarks = criteria.reduce((sum, c) => sum + Number(c.max_marks), 0);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE questions
       SET max_marks = ?, rubric_version = rubric_version + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(maxMarks, questionId);

    db.prepare('DELETE FROM rubric_criteria WHERE question_id = ?').run(questionId);

    const critStmt = db.prepare(
      `INSERT INTO rubric_criteria (question_id, name, description, max_marks, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    criteria.forEach((c, idx) => {
      critStmt.run(
        questionId,
        c.name.trim(),
        c.description.trim(),
        Number(c.max_marks),
        idx
      );
    });
  });

  tx();
  return getQuestionById(questionId)!;
}

export function deleteQuestion(questionId: number): void {
  db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
}

// Submissions
function hydrateSubmission(row: Record<string, unknown>): Submission {
  const grades = db
    .prepare('SELECT * FROM criterion_grades WHERE submission_id = ? ORDER BY id ASC')
    .all(row.id) as Array<Record<string, unknown>>;

  let uncertaintyReasons: string[] = [];
  try {
    uncertaintyReasons = JSON.parse(String(row.uncertainty_reasons || '[]'));
  } catch {
    uncertaintyReasons = [];
  }

  return {
    id: Number(row.id),
    question_id: Number(row.question_id),
    question_title: row.question_title ? String(row.question_title) : undefined,
    question_prompt: row.question_prompt ? String(row.question_prompt) : undefined,
    model_answer: row.model_answer ? String(row.model_answer) : undefined,
    subject_name: row.subject_name ? String(row.subject_name) : undefined,
    subject_code: row.subject_code ? String(row.subject_code) : undefined,
    student_name: String(row.student_name),
    student_id: String(row.student_id || ''),
    answer_text: String(row.answer_text),
    total_score: Number(row.total_score),
    max_marks: Number(row.max_marks),
    confidence: Number(row.confidence),
    reliability_status: row.reliability_status as ReliabilityStatus,
    uncertainty_reasons: uncertaintyReasons,
    overall_feedback: String(row.overall_feedback || ''),
    manual_override: Boolean(row.manual_override),
    teacher_note: String(row.teacher_note || ''),
    rubric_version: Number(row.rubric_version),
    criterion_grades: grades.map((g) => ({
      id: Number(g.id),
      submission_id: Number(g.submission_id),
      criterion_id: g.criterion_id !== null ? Number(g.criterion_id) : null,
      criterion_name: String(g.criterion_name),
      max_marks: Number(g.max_marks),
      awarded_marks: Number(g.awarded_marks),
      evidence_quote: String(g.evidence_quote || ''),
      reasoning: String(g.reasoning || ''),
      is_manual_override: Boolean(g.is_manual_override),
    })),
    graded_at: String(row.graded_at),
    updated_at: String(row.updated_at),
  };
}

export function listSubmissions(questionId?: number): Submission[] {
  const baseSql = `
    SELECT sub.*, q.title as question_title, q.prompt as question_prompt,
           q.model_answer as model_answer, s.name as subject_name, s.code as subject_code
    FROM submissions sub
    JOIN questions q ON q.id = sub.question_id
    JOIN subjects s ON s.id = q.subject_id
  `;
  const rows = questionId
    ? (db
        .prepare(`${baseSql} WHERE sub.question_id = ? ORDER BY sub.updated_at DESC, sub.id DESC`)
        .all(questionId) as Array<Record<string, unknown>>)
    : (db
        .prepare(`${baseSql} ORDER BY sub.updated_at DESC, sub.id DESC`)
        .all() as Array<Record<string, unknown>>);

  return rows.map(hydrateSubmission);
}

export function getSubmissionById(id: number): Submission | null {
  const row = db
    .prepare(
      `SELECT sub.*, q.title as question_title, q.prompt as question_prompt,
              q.model_answer as model_answer, s.name as subject_name, s.code as subject_code
       FROM submissions sub
       JOIN questions q ON q.id = sub.question_id
       JOIN subjects s ON s.id = q.subject_id
       WHERE sub.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? hydrateSubmission(row) : null;
}

export function saveNewSubmissionGrade(input: {
  question: Question;
  student_name: string;
  student_id: string;
  answer_text: string;
  total_score: number;
  confidence: number;
  reliability_status: ReliabilityStatus;
  uncertainty_reasons: string[];
  overall_feedback: string;
  criterion_grades: CriterionGrade[];
}): Submission {
  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO submissions (
          question_id, student_name, student_id, answer_text, total_score, max_marks,
          confidence, reliability_status, uncertainty_reasons, overall_feedback,
          manual_override, teacher_note, rubric_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?)`
      )
      .run(
        input.question.id,
        input.student_name.trim(),
        input.student_id.trim(),
        input.answer_text.trim(),
        input.total_score,
        input.question.max_marks,
        input.confidence,
        input.reliability_status,
        JSON.stringify(input.uncertainty_reasons),
        input.overall_feedback,
        input.question.rubric_version
      );

    const submissionId = Number(res.lastInsertRowid);
    const gStmt = db.prepare(
      `INSERT INTO criterion_grades (
        submission_id, criterion_id, criterion_name, max_marks, awarded_marks,
        evidence_quote, reasoning, is_manual_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    );
    for (const g of input.criterion_grades) {
      gStmt.run(
        submissionId,
        g.criterion_id,
        g.criterion_name,
        g.max_marks,
        g.awarded_marks,
        g.evidence_quote,
        g.reasoning
      );
    }

    db.prepare(
      `INSERT INTO grading_history (
        submission_id, question_id, student_name, question_title, event_type,
        previous_score, new_score, max_marks, previous_confidence, new_confidence,
        rubric_version, summary, details_json, actor_name
      ) VALUES (?, ?, ?, ?, 'initial_ai', NULL, ?, ?, NULL, ?, ?, ?, ?, 'Gemini AI')`
    ).run(
      submissionId,
      input.question.id,
      input.student_name.trim(),
      input.question.title,
      input.total_score,
      input.question.max_marks,
      input.confidence,
      input.question.rubric_version,
      input.reliability_status === 'reliable'
        ? `Initial AI evaluation completed using Rubric v${input.question.rubric_version}.`
        : `Initial AI evaluation completed using Rubric v${input.question.rubric_version} (Teacher review recommended).`,
      JSON.stringify({
        criteria_changes: input.criterion_grades.map((g) => ({
          criterion_name: g.criterion_name,
          new_marks: g.awarded_marks,
          max_marks: g.max_marks,
          reason: g.reasoning,
        })),
      })
    );

    return submissionId;
  });

  const newId = tx();
  return getSubmissionById(newId)!;
}

export function updateSubmissionFromRegrade(input: {
  submission: Submission;
  question: Question;
  total_score: number;
  confidence: number;
  reliability_status: ReliabilityStatus;
  uncertainty_reasons: string[];
  overall_feedback: string;
  criterion_grades: CriterionGrade[];
}): Submission {
  const prevScore = input.submission.total_score;
  const prevConfidence = input.submission.confidence;
  const prevGradesMap = new Map(
    input.submission.criterion_grades.map((g) => [g.criterion_name.toLowerCase(), g.awarded_marks])
  );

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE submissions
       SET total_score = ?, max_marks = ?, confidence = ?, reliability_status = ?,
           uncertainty_reasons = ?, overall_feedback = ?, manual_override = 0,
           rubric_version = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      input.total_score,
      input.question.max_marks,
      input.confidence,
      input.reliability_status,
      JSON.stringify(input.uncertainty_reasons),
      input.overall_feedback,
      input.question.rubric_version,
      input.submission.id
    );

    db.prepare('DELETE FROM criterion_grades WHERE submission_id = ?').run(input.submission.id);

    const gStmt = db.prepare(
      `INSERT INTO criterion_grades (
        submission_id, criterion_id, criterion_name, max_marks, awarded_marks,
        evidence_quote, reasoning, is_manual_override
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    );
    for (const g of input.criterion_grades) {
      gStmt.run(
        input.submission.id,
        g.criterion_id,
        g.criterion_name,
        g.max_marks,
        g.awarded_marks,
        g.evidence_quote,
        g.reasoning
      );
    }

    db.prepare(
      `INSERT INTO grading_history (
        submission_id, question_id, student_name, question_title, event_type,
        previous_score, new_score, max_marks, previous_confidence, new_confidence,
        rubric_version, summary, details_json, actor_name
      ) VALUES (?, ?, ?, ?, 'rubric_regrade', ?, ?, ?, ?, ?, ?, ?, ?, 'Gemini AI')`
    ).run(
      input.submission.id,
      input.question.id,
      input.submission.student_name,
      input.question.title,
      prevScore,
      input.total_score,
      input.question.max_marks,
      prevConfidence,
      input.confidence,
      input.question.rubric_version,
      `Automatic regrade triggered by Rubric v${input.question.rubric_version} update (${prevScore} -> ${input.total_score}/${input.question.max_marks}).`,
      JSON.stringify({
        criteria_changes: input.criterion_grades.map((g) => ({
          criterion_name: g.criterion_name,
          previous_marks: prevGradesMap.get(g.criterion_name.toLowerCase()),
          new_marks: g.awarded_marks,
          max_marks: g.max_marks,
          reason: g.reasoning,
        })),
      })
    );
  });

  tx();
  return getSubmissionById(input.submission.id)!;
}

export function applyManualOverride(input: {
  submissionId: number;
  grades: Array<{ id: number; awarded_marks: number; reasoning?: string }>;
  teacher_note: string;
  teacher_name: string;
}): Submission {
  const existing = getSubmissionById(input.submissionId);
  if (!existing) throw new Error('Submission not found.');

  const prevScore = existing.total_score;
  const prevConfidence = existing.confidence;

  const gradeMap = new Map(input.grades.map((g) => [g.id, g]));
  let newTotal = 0;

  const criteriaChanges: Array<{
    criterion_name: string;
    previous_marks: number;
    new_marks: number;
    max_marks: number;
    reason: string;
  }> = [];

  const tx = db.transaction(() => {
    const updateGradeStmt = db.prepare(
      `UPDATE criterion_grades
       SET awarded_marks = ?, reasoning = ?, is_manual_override = ?
       WHERE id = ? AND submission_id = ?`
    );

    for (const orig of existing.criterion_grades) {
      const override = orig.id ? gradeMap.get(orig.id) : undefined;
      const clampedMarks = override
        ? Math.max(0, Math.min(orig.max_marks, Number(override.awarded_marks)))
        : orig.awarded_marks;
      const changed = Math.abs(clampedMarks - orig.awarded_marks) > 0.001;
      const newReason =
        override?.reasoning !== undefined && override.reasoning.trim() !== ''
          ? override.reasoning.trim()
          : orig.reasoning;

      newTotal += clampedMarks;
      updateGradeStmt.run(
        clampedMarks,
        newReason,
        changed || orig.is_manual_override ? 1 : 0,
        orig.id,
        existing.id
      );

      criteriaChanges.push({
        criterion_name: orig.criterion_name,
        previous_marks: orig.awarded_marks,
        new_marks: clampedMarks,
        max_marks: orig.max_marks,
        reason: changed ? `Manually adjusted by teacher: ${newReason}` : newReason,
      });
    }

    const roundedTotal = Math.round(newTotal * 100) / 100;

    db.prepare(
      `UPDATE submissions
       SET total_score = ?, manual_override = 1, teacher_note = ?,
           reliability_status = 'reliable', confidence = 100,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(roundedTotal, input.teacher_note.trim(), existing.id);

    db.prepare(
      `INSERT INTO grading_history (
        submission_id, question_id, student_name, question_title, event_type,
        previous_score, new_score, max_marks, previous_confidence, new_confidence,
        rubric_version, summary, details_json, actor_name
      ) VALUES (?, ?, ?, ?, 'manual_override', ?, ?, ?, ?, 100, ?, ?, ?, ?)`
    ).run(
      existing.id,
      existing.question_id,
      existing.student_name,
      existing.question_title || 'Question',
      prevScore,
      roundedTotal,
      existing.max_marks,
      prevConfidence,
      existing.rubric_version,
      `Teacher manual review & mark override (${prevScore} -> ${roundedTotal}/${existing.max_marks}).`,
      JSON.stringify({
        criteria_changes: criteriaChanges,
        teacher_note: input.teacher_note.trim(),
      }),
      input.teacher_name
    );
  });

  tx();
  return getSubmissionById(existing.id)!;
}

export function listGradingHistory(questionId?: number): GradingHistoryEntry[] {
  const rows = questionId
    ? (db
        .prepare(
          'SELECT * FROM grading_history WHERE question_id = ? ORDER BY id DESC LIMIT 200'
        )
        .all(questionId) as Array<Record<string, unknown>>)
    : (db
        .prepare('SELECT * FROM grading_history ORDER BY id DESC LIMIT 200')
        .all() as Array<Record<string, unknown>>);

  return rows.map((r) => {
    let details = {};
    try {
      details = JSON.parse(String(r.details_json || '{}'));
    } catch {
      details = {};
    }
    return {
      id: Number(r.id),
      submission_id: Number(r.submission_id),
      question_id: Number(r.question_id),
      student_name: String(r.student_name),
      question_title: String(r.question_title),
      event_type: r.event_type as GradingHistoryEntry['event_type'],
      previous_score: r.previous_score !== null ? Number(r.previous_score) : null,
      new_score: Number(r.new_score),
      max_marks: Number(r.max_marks),
      previous_confidence:
        r.previous_confidence !== null ? Number(r.previous_confidence) : null,
      new_confidence: Number(r.new_confidence),
      rubric_version: Number(r.rubric_version),
      summary: String(r.summary),
      details,
      actor_name: String(r.actor_name),
      created_at: String(r.created_at),
    };
  });
}

export function getDashboardSummary(): DashboardSummary {
  const totalSubjects = (
    db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number }
  ).c;
  const totalQuestions = (
    db.prepare('SELECT COUNT(*) as c FROM questions').get() as { c: number }
  ).c;

  const allSubs = listSubmissions();
  const totalSubmissions = allSubs.length;
  const classAveragePct =
    totalSubmissions > 0
      ? Math.round(
          (allSubs.reduce(
            (sum, s) => sum + (s.max_marks > 0 ? (s.total_score / s.max_marks) * 100 : 0),
            0
          ) /
            totalSubmissions) *
            10
        ) / 10
      : 0;

  const pendingReviews = allSubs.filter(
    (s) => !s.manual_override && s.reliability_status !== 'reliable'
  ).length;

  const averageConfidence =
    totalSubmissions > 0
      ? Math.round(
          allSubs.reduce((sum, s) => sum + s.confidence, 0) / totalSubmissions
        )
      : 0;

  const subjectStats = db
    .prepare(
      `SELECT s.id, s.name, s.code,
        (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) as question_count,
        (SELECT COUNT(*) FROM submissions sub
          JOIN questions q2 ON q2.id = sub.question_id
          WHERE q2.subject_id = s.id) as submission_count,
        (SELECT AVG(CASE WHEN sub.max_marks > 0 THEN (sub.total_score * 100.0 / sub.max_marks) ELSE 0 END)
          FROM submissions sub
          JOIN questions q3 ON q3.id = sub.question_id
          WHERE q3.subject_id = s.id) as average_pct
       FROM subjects s
       ORDER BY s.id ASC`
    )
    .all() as Array<{
    id: number;
    name: string;
    code: string;
    question_count: number;
    submission_count: number;
    average_pct: number | null;
  }>;

  return {
    total_subjects: totalSubjects,
    total_questions: totalQuestions,
    total_submissions: totalSubmissions,
    class_average_pct: classAveragePct,
    pending_reviews: pendingReviews,
    average_confidence: averageConfidence,
    recent_submissions: allSubs.slice(0, 6),
    review_queue: allSubs
      .filter((s) => !s.manual_override && s.reliability_status !== 'reliable')
      .slice(0, 5),
    subject_stats: subjectStats.map((st) => ({
      ...st,
      average_pct:
        st.average_pct !== null ? Math.round(st.average_pct * 10) / 10 : null,
    })),
  };
}
