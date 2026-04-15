import { Link } from 'react-router-dom';

import { NotebookTree } from '../notebook/NotebookTree';

interface SidebarProps {
  workspaceId: string;
  workspaceName?: string;
}

export function Sidebar({ workspaceId, workspaceName }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-4 py-3">
        <Link
          to="/dashboard"
          className="text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-700"
        >
          ← Workspaces
        </Link>
        <h2 className="mt-1 truncate text-sm font-semibold text-gray-900">
          {workspaceName ?? 'Workspace'}
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Notebooks
          </span>
        </div>
        <NotebookTree workspaceId={workspaceId} />
      </nav>
    </aside>
  );
}

export default Sidebar;
