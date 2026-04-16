import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, FolderOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';

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
        className="border-gray-200 bg-gray-50 shadow-none"
      />
    );
  }
  if (isError) {
    return (
      <div className="px-3 py-2 text-sm text-red-600">
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
        className="border-gray-200 bg-gray-50"
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

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        <span className="inline-block w-3 text-gray-400">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="truncate">{notebook.title}</span>
      </button>
      {expanded && (
        <ul className="ml-5 mt-1 space-y-0.5 border-l border-gray-200 pl-2">
          {isLoading && (
            <li className="px-2 py-1">
              <LoadingState
                compact
                title="Loading notes…"
                className="border-gray-200 bg-white shadow-none"
              />
            </li>
          )}
          {isError && (
            <li className="px-2 py-1 text-xs text-red-600">
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
                description="Add the first note in this notebook to start writing."
                className="border-gray-200 bg-white"
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
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
