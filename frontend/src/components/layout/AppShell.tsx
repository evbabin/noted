import type { ReactNode } from 'react';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  workspaceId: string;
  workspaceName?: string;
  title?: string;
  onOpenSearch?: () => void;
  children: ReactNode;
}

export function AppShell({
  workspaceId,
  workspaceName,
  title,
  onOpenSearch,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar workspaceId={workspaceId} workspaceName={workspaceName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title ?? workspaceName} onOpenSearch={onOpenSearch} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
