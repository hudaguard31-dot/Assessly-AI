import { useState } from 'react';
import { ArrowRight, BookOpenCheck, Lock, Mail, User } from 'lucide-react';
import { api } from '../api';
import type { TeacherProfile } from '../types';

interface LoginPageProps {
  onLogin: (teacher: TeacherProfile) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('elena.vance@smartgrade.edu');
  const [password, setPassword] = useState('smartgrade2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(name, email, password, department);
      onLogin(res.teacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoSignIn() {
    setError('');
    setLoading(true);
    try {
      const res = await api.login('elena.vance@smartgrade.edu', 'smartgrade2026');
      onLogin(res.teacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left editorial & institutional showcase column */}
      <div className="lg:w-1/2 bg-blue-950 text-white p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <BookOpenCheck className="w-6 h-6 text-blue-300" aria-hidden="true" />
            <span className="font-display text-xl font-bold tracking-tight">
              SMARTGRADE
            </span>
          </div>

          <div className="mt-10 max-w-lg">
            <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-white [text-wrap:balance]">
              Consistent, evidence-backed grading for every written answer.
            </h1>
            <p className="mt-4 text-base text-blue-100 leading-relaxed">
              Evaluate short answers against custom rubrics, inspect exact student
              evidence for every mark, and regrade an entire class in seconds when
              your criteria evolve.
            </p>
          </div>
        </div>

        <div className="my-8 rounded-xl overflow-hidden border border-blue-800/60 bg-blue-900/40 max-w-lg">
          <img
            src="/src/assets/images/login_academic_desk_1794949191636.jpg"
            alt="Academic assessment desk with structured rubrics and notebooks"
            referrerPolicy="no-referrer"
            className="w-full h-56 lg:h-64 object-cover"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-blue-800/70 pt-6 max-w-lg text-sm">
          <div>
            <p className="font-medium text-white">Criterion Evidence</p>
            <p className="mt-1 text-blue-200 text-xs leading-relaxed">
              Every awarded or deducted mark cites verbatim student text.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Instant Regrading</p>
            <p className="mt-1 text-blue-200 text-xs leading-relaxed">
              Edit a rubric once to re-evaluate all affected answers automatically.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Honest Confidence</p>
            <p className="mt-1 text-blue-200 text-xs leading-relaxed">
              Ambiguous responses are flagged for manual teacher review.
            </p>
          </div>
        </div>
      </div>

      {/* Right Teacher Sign-In / Registration column */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-semibold text-slate-900">
              {mode === 'login' ? 'Teacher Sign In' : 'Create Teacher Account'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              {mode === 'login'
                ? 'Access your subjects, rubrics, and AI grading reports.'
                : 'Set up an instructor workspace saved to the local SQLite database.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                if (email === 'elena.vance@smartgrade.edu') {
                  setEmail('');
                  setPassword('');
                }
              }}
              className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Teacher
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label
                    htmlFor="teacher-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="teacher-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Prof. Marcus Reid"
                      className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="teacher-dept"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Department
                  </label>
                  <input
                    id="teacher-dept"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Department of Natural Sciences"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="teacher-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="teacher-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="teacher-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="teacher-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <span>
                {loading
                  ? 'Signing in...'
                  : mode === 'login'
                  ? 'Sign In to Dashboard'
                  : 'Create Account & Continue'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                  <p className="font-medium text-slate-800">Demo Teacher Account</p>
                  <p className="mt-0.5">elena.vance@smartgrade.edu</p>
                </div>
                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  disabled={loading}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Quick Demo Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
