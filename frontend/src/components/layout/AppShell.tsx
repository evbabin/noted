import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Keep the underlying page from scrolling when the mobile drawer is open.
    if (!sidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          title={title ?? workspaceName}
          onOpenSearch={onOpenSearch}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50 text-gray-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
