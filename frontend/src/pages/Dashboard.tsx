import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  FolderPlus,
  LayoutGrid,
  LogOut,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';
import { workspacesApi } from '../api/workspaces';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Logo } from '../components/ui/Logo';
import { useAuthStore } from '../stores/authStore';
import type { Workspace } from '../types/api';

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const {
    data: workspaces,
    isLoading,
    isError,
    refetch,
  } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
    meta: { errorMessage: 'Could not load workspaces.' },
  });

  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    meta: { errorMessage: 'Failed to create workspace.' },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(`Workspace "${created.name}" created`);
    },
  });

  async function handleLogout() {
    const refresh = tokenStorage.getRefresh();
    clearSession();
    if (refresh) {
      authApi.logout(refresh).catch(() => {});
    }
    navigate('/login', { replace: true });
  }

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = (user?.display_name ?? user?.email ?? '').split(' ')[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" aria-label="Noted home" className="flex items-center">
            <Logo size="sm" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="mb-8">
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-4xl">
            Your workspaces
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-zinc-300">
            Create a workspace per class or team. Each workspace holds notebooks, notes,
            collaborators, and AI-generated quizzes.
          </p>
        </section>

        <CreateWorkspaceForm
          onSubmit={(payload) => createMutation.mutate(payload)}
          submitting={createMutation.isPending}
        />

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-zinc-400">
              All workspaces
            </h2>
            {workspaces && workspaces.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {workspaces.length} total
              </span>
            )}
          </div>

          {isLoading && (
            <LoadingState
              title="Loading workspaces…"
              message="Pulling in your latest workspace list."
            />
          )}

          {isError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
            >
              Could not load workspaces.{' '}
              <button
                type="button"
                onClick={() => refetch()}
                className="font-medium underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && workspaces && workspaces.length === 0 && (
            <EmptyState
              icon={<LayoutGrid className="h-6 w-6" />}
              title="No workspaces yet"
              description="Create your first workspace above to start organizing notebooks and notes."
            />
          )}

          {workspaces && workspaces.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workspaces.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/workspaces/${w.id}`}
                    className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
                        <Users className="h-4 w-4" />
                      </span>
                      <h3 className="truncate text-base font-semibold text-gray-900 dark:text-zinc-100">
                        {w.name}
                      </h3>
                    </div>
                    {w.description ? (
                      <p className="mt-3 line-clamp-2 text-sm text-gray-600 dark:text-zinc-300">
                        {w.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-gray-400 dark:text-zinc-500">
                        No description yet.
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-4 text-xs text-gray-400 dark:text-zinc-500">
                      <span>
                        Updated {new Date(w.updated_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-300">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

interface CreateWorkspaceFormProps {
  onSubmit: (payload: { name: string; description?: string | null }) => void;
  submitting: boolean;
}

function CreateWorkspaceForm({ onSubmit, submitting }: CreateWorkspaceFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      description: description.trim() || null,
    });
    setName('');
    setDescription('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <FolderPlus className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-zinc-400">
          New workspace
        </h2>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row">
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Workspace name (e.g. Biology 101)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-brand-400"
        />
        <input
          type="text"
          maxLength={500}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gradient px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
        >
          {submitting ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
    </form>
  );
}

export default Dashboard;
