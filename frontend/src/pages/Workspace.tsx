import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { SearchPanel } from '../components/search/SearchPanel';
import { workspacesApi } from '../api/workspaces';
import type { WorkspaceWithMembers } from '../types/api';

export function Workspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    data: workspace,
    isLoading,
    isError,
  } = useQuery<WorkspaceWithMembers>({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspacesApi.get(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!workspaceId) {
    return null;
  }

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      title={workspace?.name}
      onOpenSearch={() => setSearchOpen(true)}
    >
      <div className="mx-auto max-w-3xl px-8 py-10">
        {isLoading && <p className="text-sm text-gray-500">Loading workspace…</p>}
        {isError && (
          <p className="text-sm text-red-600">Failed to load workspace.</p>
        )}
        {workspace && (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">
              {workspace.name}
            </h2>
            {workspace.description && (
              <p className="mt-2 text-gray-600">{workspace.description}</p>
            )}
            <p className="mt-6 text-sm text-gray-500">
              Press{' '}
              <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs">
                ⌘K
              </kbd>{' '}
              to search notes in this workspace.
            </p>
          </>
        )}
      </div>
      <SearchPanel
        workspaceId={workspaceId}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </AppShell>
  );
}

export default Workspace;
