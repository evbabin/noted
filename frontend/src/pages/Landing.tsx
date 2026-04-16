import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { tokenStorage } from '../api/client';

const featureCards = [
  {
    title: 'Structured notes',
    description:
      'Organize material with workspaces, notebooks, and notes so study content stays easy to navigate.',
    icon: BookOpenText,
  },
  {
    title: 'Real-time collaboration',
    description:
      'Write together with live presence, shared editing, and synchronized note updates.',
    icon: Users,
  },
  {
    title: 'AI quiz generation',
    description:
      'Turn any note into multiple-choice, fill-in-the-blank, or flashcard quizzes in a few clicks.',
    icon: BrainCircuit,
  },
  {
    title: 'Fast workspace search',
    description:
      'Search across notes with ranked results so the right concept is never buried in a long notebook.',
    icon: Search,
  },
  {
    title: 'Role-based sharing',
    description:
      'Invite collaborators with owner, editor, commenter, or viewer access to match each workspace.',
    icon: ShieldCheck,
  },
  {
    title: 'Study loop in one place',
    description:
      'Go from writing notes to practicing recall and reviewing attempts without switching tools.',
    icon: Sparkles,
  },
] as const;

const workflowSteps = [
  {
    title: 'Capture the material',
    description:
      'Write lecture notes, summaries, and key concepts in a collaborative editor built for shared study sessions.',
  },
  {
    title: 'Generate practice',
    description:
      'Use AI to create quizzes directly from note content when you are ready to test recall.',
  },
  {
    title: 'Review and repeat',
    description:
      'Take quizzes, inspect results, and refine your notes while the context is still fresh.',
  },
] as const;

const highlights = [
  'Email/password and Google OAuth sign-in',
  'Shared workspaces for class notes and team study guides',
  'Quiz review flow with attempt history and scoring',
] as const;

export function Landing() {
  const isAuthenticated = Boolean(tokenStorage.getAccess());
  const primaryHref = isAuthenticated ? '/dashboard' : '/register';
  const primaryLabel = isAuthenticated ? 'Open dashboard' : 'Start studying free';
  const secondaryHref = isAuthenticated ? '/dashboard' : '/login';
  const secondaryLabel = isAuthenticated ? 'Go to workspace' : 'Sign in';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-lg font-semibold text-gray-900">Noted</p>
            <p className="text-xs text-gray-500">Collaborative study notes</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={secondaryHref}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {secondaryLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to={primaryHref}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create account
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Notes, collaboration, and quiz practice in one workflow
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Write together, learn faster, and turn notes into active recall.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
                Noted bridges the gap between note-taking and studying. Capture knowledge,
                collaborate in real time, and generate quizzes from your notes without
                leaving the workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={secondaryHref}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {secondaryLabel}
                </Link>
              </div>

              <ul className="mt-8 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                {highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white">
                <p className="text-sm font-medium text-blue-100">Why teams use Noted</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <StatCard label="Live collaboration" value="Shared notes" />
                  <StatCard label="AI study support" value="Quiz generation" />
                  <StatCard label="Searchable content" value="Workspace-wide" />
                  <StatCard label="Access control" value="Role-based sharing" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-sm font-medium text-gray-900">
                  Built for the full study loop
                </p>
                <p className="text-sm leading-6 text-gray-600">
                  Keep lecture notes, team summaries, and practice material in the same
                  place so the path from writing to review stays short.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-gray-200 bg-white px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Everything needed to move from notes to recall
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                Noted combines the writing, sharing, search, and quiz surfaces that are
                usually spread across multiple tools.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                A simple workflow for collaborative studying
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                The product flow is designed to keep students and teams moving from shared
                context to deliberate practice without extra setup.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                >
                  <span className="text-sm font-semibold text-blue-700">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-medium text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-6 sm:pb-16">
          <div className="mx-auto max-w-6xl rounded-2xl bg-slate-900 px-6 py-10 text-white shadow-sm sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold sm:text-3xl">
                  Start building a better study workflow.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                  Create a workspace, invite collaborators, and let your notes power the
                  next quiz session.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={secondaryHref}
                  className="inline-flex items-center justify-center rounded-md border border-slate-600 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-blue-100">{label}</p>
    </div>
  );
}

export default Landing;
