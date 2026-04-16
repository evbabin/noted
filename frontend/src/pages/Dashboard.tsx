import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';
import { workspacesApi } from '../api/workspaces';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import type { Workspace } from '../types/api';

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    tokenStorage.clear();
    if (refresh) {
      authApi.logout(refresh).catch(() => {});
    }
    navigate('/login', { replace: true });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Your workspaces</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </header>

      <CreateWorkspaceForm
        onSubmit={(payload) => createMutation.mutate(payload)}
        submitting={createMutation.isPending}
      />

      <section className="mt-8 sm:mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
          All workspaces
        </h2>

        {isLoading && (
          <LoadingState
            title="Loading workspaces…"
            message="Pulling in your latest workspace list."
          />
        )}

        {isError && (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load workspaces.{` `}
            <button
              type="button"
              onClick={() => refetch()}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && workspaces && workspaces.length === 0 && (
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace above to start organizing notebooks and notes."
          />
        )}

        {workspaces && workspaces.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  to={`/workspaces/${w.id}`}
                  className="block rounded-md border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-400 hover:shadow-sm"
                >
                  <h3 className="text-base font-medium text-gray-900">{w.name}</h3>
                  {w.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{w.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Updated {new Date(w.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
        New workspace
      </h2>
      <div className="flex flex-col gap-3 xl:flex-row">
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          maxLength={500}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 xl:w-auto"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default Dashboard;
