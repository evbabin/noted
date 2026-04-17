import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FilePlus, FolderOpen } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';

import { notebooksApi } from '../../api/notebooks';
import { notesApi } from '../../api/notes';
import type { Notebook, NoteSummary } from '../../types/api';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';

interface NotebookTreeProps {
  workspaceId: string;
  onNavigate?: () => void;
}

export function NotebookTree({ workspaceId, onNavigate }: NotebookTreeProps) {
  const {
    data: notebooks,
    isLoading,
    isError,
    refetch,
  } = useQuery<Notebook[]>({
    queryKey: ['notebooks', workspaceId],
    queryFn: () => notebooksApi.list(workspaceId),
    meta: { errorMessage: 'Failed to load notebooks.' },
  });

  if (isLoading) {
    return (
        <LoadingState
          compact
          title="Loading notebooks…"
          message="Fetching notebooks in this workspace."
          className="border-gray-200 bg-gray-50 shadow-none dark:border-zinc-800 dark:bg-zinc-950"
        />
      );
  }
  if (isError) {
    return (
      <div className="px-3 py-2 text-sm text-red-600 dark:text-red-300">
        Failed to load notebooks.{` `}
        <button
          type="button"
          onClick={() => refetch()}
          className="underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!notebooks || notebooks.length === 0) {
    return (
      <EmptyState
        compact
        icon={<FolderOpen className="h-5 w-5" />}
        title="No notebooks yet"
        description="Create a notebook to organize notes in this workspace."
          className="border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950"
      />
    );
  }

  return (
    <ul className="space-y-1">
      {notebooks.map((nb) => (
        <NotebookNode
          key={nb.id}
          notebook={nb}
          workspaceId={workspaceId}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function NotebookNode({
  notebook,
  workspaceId,
  onNavigate,
}: {
  notebook: Notebook;
  workspaceId: string;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: notes,
    isLoading,
    isError,
    refetch,
  } = useQuery<NoteSummary[]>({
    queryKey: ['notes', notebook.id],
    queryFn: () => notesApi.listInNotebook(notebook.id),
    enabled: expanded,
    meta: { errorMessage: 'Failed to load notes.' },
  });

  // Create a new note inside this notebook, then navigate to it.
  const createNoteMutation = useMutation({
    mutationFn: () =>
      notesApi.create(notebook.id, { title: 'Untitled' }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['notes', notebook.id] });
      toast.success('Note created');
      onNavigate?.();
      navigate(`/workspaces/${workspaceId}/notes/${note.id}`);
    },
    onError: (err) => {
      const message = isAxiosError<{ detail?: string }>(err)
        ? err.response?.data?.detail ?? 'Failed to create note.'
        : 'Failed to create note.';
      toast.error(message);
    },
  });

  return (
    <li>
      <div className="group flex w-full items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span className="inline-block w-3 text-gray-400 dark:text-zinc-500">
            {expanded ? '▾' : '▸'}
          </span>
          <span className="truncate">{notebook.title}</span>
        </button>
        {/* Add-note button — visible on hover or when the notebook is expanded */}
        <button
          type="button"
          title="New note"
          aria-label={`New note in ${notebook.title}`}
          onClick={() => {
            if (!expanded) setExpanded(true);
            createNoteMutation.mutate();
          }}
          disabled={createNoteMutation.isPending}
          className="mr-1 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 group-hover:opacity-100 aria-expanded:opacity-100 disabled:opacity-50"
        >
          <FilePlus className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <ul className="ml-5 mt-1 space-y-0.5 border-l border-gray-200 pl-2 dark:border-zinc-800">
          {isLoading && (
            <li className="px-2 py-1">
              <LoadingState
                compact
                title="Loading notes…"
                className="border-gray-200 bg-white shadow-none dark:border-zinc-800 dark:bg-zinc-900"
              />
            </li>
          )}
          {isError && (
            <li className="px-2 py-1 text-xs text-red-600 dark:text-red-300">
              Failed to load notes.{` `}
              <button
                type="button"
                onClick={() => refetch()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </li>
          )}
          {notes && notes.length === 0 && (
            <li className="px-2 py-1">
              <EmptyState
                compact
                icon={<FileText className="h-5 w-5" />}
                title="No notes"
                description="Click + to add your first note."
                className="border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              />
            </li>
          )}
          {notes?.map((note) => (
            <li key={note.id}>
              <NavLink
                to={`/workspaces/${workspaceId}/notes/${note.id}`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block truncate rounded px-2 py-1 text-sm ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                   }`
                }
              >
                {note.title || 'Untitled'}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default NotebookTree;
