import { ArrowLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import { NotebookForm } from '../notebook/NotebookForm';
import { NotebookTree } from '../notebook/NotebookTree';

interface SidebarProps {
  workspaceId: string;
  workspaceName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  workspaceId,
  workspaceName,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-gray-950/40 transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:self-stretch',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-zinc-800">
          <Link
            to="/dashboard"
            onClick={onClose}
            aria-label="Noted dashboard"
            className="flex items-center"
          >
            <Logo size="sm" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-800">
          <Link
            to="/dashboard"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500 transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Workspaces
          </Link>
          <h2 className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {workspaceName ?? 'Workspace'}
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto border-b border-gray-200 px-2 py-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-zinc-400">
              Notebooks
            </span>
          </div>
          <NotebookTree workspaceId={workspaceId} onNavigate={onClose} />
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-zinc-800">
            <NotebookForm workspaceId={workspaceId} />
          </div>
        </nav>

        <div className="border-b border-gray-200 px-4 py-3 text-[11px] text-gray-400 dark:border-zinc-800 dark:text-zinc-500">
          Press{' '}
          <kbd className="rounded border border-gray-200 bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            ⌘K
          </kbd>{' '}
          to search notes.
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
