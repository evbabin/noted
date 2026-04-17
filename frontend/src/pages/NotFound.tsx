import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Logo } from '../components/ui/Logo';

export function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-6rem] flex justify-center"
      >
        <div className="h-72 w-[44rem] max-w-full rounded-full bg-gradient-to-r from-brand-500/20 via-brand-400/10 to-blue-500/20 blur-3xl" />
      </div>
      <div className="noted-dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-8 sm:py-14">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" tagline="Page not found" />
          </div>
          <p className="text-6xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            404
          </p>
          <p className="mt-3 text-gray-600 dark:text-zinc-400">
            That page doesn&apos;t exist — or it was moved.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
