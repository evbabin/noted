import { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';

import { useCreateNotebook } from '../../hooks/useNotebook';
import type { Notebook } from '../../types/api';

interface NotebookFormProps {
  workspaceId: string;
  /** Called after a notebook is created successfully. */
  onCreated?: (notebook: Notebook) => void;
}

/**
 * Inline form to create a new notebook within a workspace.
 *
 * Renders as a compact "+" button that expands into an inline text input
 * so the user can type a title and press Enter without a modal disrupting flow.
 */
export function NotebookForm({ workspaceId, onCreated }: NotebookFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  const createMutation = useCreateNotebook(workspaceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(
      { title: trimmed },
      {
        onSuccess: (notebook) => {
          setTitle('');
          setIsOpen(false);
          toast.success(`"${notebook.title}" created`);
          onCreated?.(notebook);
        },
        onError: (err) => {
          const message = isAxiosError<{ detail?: string }>(err)
            ? err.response?.data?.detail ?? 'Failed to create notebook.'
            : 'Failed to create notebook.';
          toast.error(message);
        },
      },
    );
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-zinc-800"
        aria-label="New notebook"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        New notebook
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 px-1">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Notebook title"
        disabled={createMutation.isPending}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            setTitle('');
          }
        }}
        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
      />
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setTitle('');
        }}
        className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export default NotebookForm;
