import { useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth';
import { tokenStorage } from '../../api/client';

interface TopBarProps {
  title?: string;
  onOpenSearch?: () => void;
}

export function TopBar({ title, onOpenSearch }: TopBarProps) {
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
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <h1 className="truncate text-sm font-semibold text-gray-900">
        {title ?? ''}
      </h1>
      <div className="flex items-center gap-2">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            <span>Search…</span>
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 text-[10px] text-gray-500">
              ⌘K
            </kbd>
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export default TopBar;
