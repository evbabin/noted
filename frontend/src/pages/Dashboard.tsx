import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';
import { workspacesApi } from '../api/workspaces';
import type { ApiError, Workspace } from '../types/api';

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: workspaces,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(`Workspace "${created.name}" created`);
    },
    onError: (err) => {
      toast.error(extractErrorDetail(err) ?? 'Failed to create workspace');
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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
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

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
          All workspaces
        </h2>

        {isLoading && <p className="text-gray-500">Loading…</p>}

        {isError && (
          <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {extractErrorDetail(error) ?? 'Could not load workspaces.'}{' '}
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
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            You don&apos;t have any workspaces yet. Create your first one above.
          </p>
        )}

        {workspaces && workspaces.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
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
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
        New workspace
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
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
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function extractErrorDetail(err: unknown): string | null {
  if (isAxiosError<ApiError>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}

export default Dashboard;
