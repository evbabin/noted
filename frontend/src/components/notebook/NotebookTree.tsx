import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';

import { notebooksApi } from '../../api/notebooks';
import { notesApi } from '../../api/notes';
import type { Notebook, NoteSummary } from '../../types/api';

interface NotebookTreeProps {
  workspaceId: string;
}

export function NotebookTree({ workspaceId }: NotebookTreeProps) {
  const {
    data: notebooks,
    isLoading,
    isError,
  } = useQuery<Notebook[]>({
    queryKey: ['notebooks', workspaceId],
    queryFn: () => notebooksApi.list(workspaceId),
  });

  if (isLoading) {
    return <p className="px-3 py-2 text-sm text-gray-500">Loading notebooks…</p>;
  }
  if (isError) {
    return (
      <p className="px-3 py-2 text-sm text-red-600">Failed to load notebooks.</p>
    );
  }
  if (!notebooks || notebooks.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-gray-500">No notebooks yet.</p>
    );
  }

  return (
    <ul className="space-y-1">
      {notebooks.map((nb) => (
        <NotebookNode key={nb.id} notebook={nb} workspaceId={workspaceId} />
      ))}
    </ul>
  );
}

function NotebookNode({ notebook, workspaceId }: { notebook: Notebook; workspaceId: string }) {
  const [expanded, setExpanded] = useState(false);

  const {
    data: notes,
    isLoading,
  } = useQuery<NoteSummary[]>({
    queryKey: ['notes', notebook.id],
    queryFn: () => notesApi.listInNotebook(notebook.id),
    enabled: expanded,
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
            <li className="px-2 py-1 text-xs text-gray-400">Loading…</li>
          )}
          {notes && notes.length === 0 && (
            <li className="px-2 py-1 text-xs text-gray-400">No notes</li>
          )}
          {notes?.map((note) => (
            <li key={note.id}>
              <NavLink
                to={`/workspaces/${workspaceId}/notes/${note.id}`}
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
