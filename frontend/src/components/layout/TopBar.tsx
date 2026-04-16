import { Menu, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth';
import { tokenStorage } from '../../api/client';

interface TopBarProps {
  title?: string;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
}

export function TopBar({ title, onOpenSearch, onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    const refresh = tokenStorage.getRefresh();
    tokenStorage.clear();
    if (refresh) {
      authApi.logout(refresh).catch(() => {});
    }
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <h1 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
          {title ?? ''}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 sm:px-3"
          >
            <Search className="h-3.5 w-3.5 sm:hidden" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden rounded border border-gray-200 bg-gray-100 px-1 text-[10px] text-gray-500 sm:inline-block">
              ⌘K
            </kbd>
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-3"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export default TopBar;
