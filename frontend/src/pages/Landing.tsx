import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { tokenStorage } from '../api/client';
import { Logo } from '../components/ui/Logo';

const featureCards = [
  {
    title: 'Structured notes',
    description:
      'Organize study material with workspaces, notebooks, and notes so content stays easy to navigate and revisit.',
    icon: BookOpenText,
  },
  {
    title: 'Real-time collaboration',
    description:
      'Write together with live presence, shared cursors, and synchronized edits powered by WebSockets.',
    icon: Users,
  },
  {
    title: 'AI quiz generation',
    description:
      'Turn any note into multiple-choice, fill-in-the-blank, or flashcard quizzes in a single click.',
    icon: BrainCircuit,
  },
  {
    title: 'Fast workspace search',
    description:
      'PostgreSQL full-text search with snippet highlighting finds the right concept in any notebook instantly.',
    icon: Search,
  },
  {
    title: 'Role-based sharing',
    description:
      'Invite collaborators with owner, editor, commenter, or viewer access scoped to each workspace.',
    icon: ShieldCheck,
  },
  {
    title: 'Study loop in one place',
    description:
      'Move from writing to active recall without switching tools. Notes, quizzes, and attempts live together.',
    icon: Sparkles,
  },
] as const;

const workflowSteps = [
  {
    title: 'Capture the material',
    description:
      'Draft lecture notes, summaries, and key concepts in a rich collaborative editor built for shared study sessions.',
  },
  {
    title: 'Generate practice',
    description:
      'Ask the AI to produce a quiz from any note when you are ready to test recall — it arrives in seconds.',
  },
  {
    title: 'Review and repeat',
    description:
      'Take quizzes, inspect every answer with explanations, and refine your notes while context is still fresh.',
  },
] as const;

const highlights = [
  'Email/password and Google OAuth sign-in',
  'Shared workspaces for class notes and study groups',
  'Quiz review flow with attempt history and scoring',
  'Dark mode, keyboard shortcuts, and responsive UI',
] as const;

export function Landing() {
  const isAuthenticated = Boolean(tokenStorage.getAccess());
  const primaryHref = isAuthenticated ? '/dashboard' : '/register';
  const primaryLabel = isAuthenticated ? 'Open dashboard' : 'Start studying free';
  const secondaryHref = isAuthenticated ? '/dashboard' : '/login';
  const secondaryLabel = isAuthenticated ? 'Go to workspace' : 'Sign in';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="Noted home" className="flex items-center">
            <Logo size="md" tagline="Study smarter" />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to={secondaryHref}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {secondaryLabel}
            </Link>
            {!isAuthenticated && (
              <Link
                to={primaryHref}
                className="rounded-md bg-brand-gradient px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
              >
                Create account
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[-6rem] flex justify-center"
          >
            <div className="h-72 w-[48rem] max-w-full rounded-full bg-gradient-to-r from-brand-500/20 via-brand-400/10 to-blue-500/20 blur-3xl dark:from-brand-500/20 dark:via-brand-400/10 dark:to-blue-500/20" />
          </div>
          <div className="noted-dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

          <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200">
                <Sparkles className="h-3.5 w-3.5" />
                Notes, collaboration, and quiz practice in one workflow
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-5xl lg:text-6xl">
                Write together.{' '}
                <span className="bg-brand-gradient bg-clip-text text-transparent">
                  Learn faster.
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 dark:text-zinc-300 sm:text-lg">
                Noted bridges the gap between note-taking and studying. Capture knowledge
                with your team, collaborate in real time, and generate quizzes from your
                notes without ever leaving the workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-brand-glow transition hover:opacity-95"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={secondaryHref}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {secondaryLabel}
                </Link>
              </div>

              <ul className="mt-10 grid gap-3 text-sm text-gray-600 dark:text-zinc-300 sm:grid-cols-2">
                {highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-400" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-gray-200 bg-white px-4 py-16 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">
                Everything in one workflow
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-4xl">
                From blank page to confident recall
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600 dark:text-zinc-300">
                Noted combines the writing, sharing, search, and quiz surfaces that are
                usually spread across several apps — and keeps them in sync in real time.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-gray-200 bg-gray-50 p-6 transition hover:border-brand-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-500/40"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-zinc-300">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">
                How it works
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-4xl">
                A simple loop built for how students actually study
              </h2>
              <p className="mt-4 text-base leading-7 text-gray-600 dark:text-zinc-300">
                The product flow is designed to keep students and teams moving from
                shared context to deliberate practice without any extra setup.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-zinc-300">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-12 text-white shadow-brand-glow sm:px-10 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Start building a better study workflow.
                </h2>
                <p className="mt-3 text-base leading-7 text-white/85 sm:text-lg">
                  Create a workspace, invite collaborators, and let your notes power the
                  next quiz session.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-zinc-100"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={secondaryHref}
                  className="inline-flex items-center justify-center rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white px-4 py-8 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-500 dark:text-zinc-400 sm:flex-row">
          <Logo size="sm" tagline="Study smarter" />
          <p>© {new Date().getFullYear()} Noted · Built for collaborative learning.</p>
        </div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative animate-fade-in">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-brand-gradient opacity-20 blur-2xl"
      />
      <div className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-brand-glow dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-1 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-xs font-medium text-gray-400 dark:text-zinc-500">
            workspace / biology-101 / cell-division.md
          </span>
        </div>

        {/* Mock editor card */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                Mitosis vs. Meiosis
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live · 3 editors
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="h-3 w-11/12 rounded-full bg-gray-200 dark:bg-zinc-800" />
            <div className="h-3 w-9/12 rounded-full bg-gray-200 dark:bg-zinc-800" />
            <div className="h-3 w-10/12 rounded-full bg-gray-200 dark:bg-zinc-800" />
            <div className="h-3 w-7/12 rounded-full bg-gray-200 dark:bg-zinc-800" />
          </div>

          {/* Collaborator cursor */}
          <div className="relative mt-4">
            <div className="h-3 w-6/12 rounded-full bg-brand-200 dark:bg-brand-500/30" />
            <span className="absolute -top-4 left-[48%] inline-flex items-center gap-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
              Sofia
            </span>
          </div>
        </div>

        {/* AI quiz card */}
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-gradient text-white">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                Quiz ready
              </p>
              <p className="text-xs text-brand-700/80 dark:text-brand-200/80">
                8 multiple choice · 2 flashcards
              </p>
            </div>
            <span className="ml-auto text-xs font-semibold text-brand-700 dark:text-brand-200">
              Take quiz →
            </span>
          </div>
        </div>
      </div>

      {/* Floating stat chips */}
      <div className="pointer-events-none absolute -left-4 top-10 hidden rotate-[-4deg] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:block">
        <span className="mr-1 inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        Saved · v14
      </div>
      <div className="pointer-events-none absolute -right-4 bottom-20 hidden rotate-[5deg] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:block">
        <Sparkles className="mr-1 inline h-3 w-3 text-brand-500" /> AI-generated
      </div>
    </div>
  );
}

export default Landing;
