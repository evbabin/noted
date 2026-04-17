import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { authApi } from '../../api/auth';
import { tokenStorage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

interface TopBarProps {
  title?: string;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
}

export function TopBar({ title, onOpenSearch, onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  async function handleLogout() {
    const refresh = tokenStorage.getRefresh();
    tokenStorage.clear();
    if (refresh) {
      authApi.logout(refresh).catch(() => { });
    }
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-gray-200/80 bg-white/90 px-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        {/*<Link
          to="/dashboard"
          className="hidden items-center lg:flex"
          aria-label="Noted dashboard"
        >
          <Logo size="sm" /> 
        </Link>*/}
        {title && (
          <>
            <span
              aria-hidden="true"
              className="hidden text-gray-300 dark:text-zinc-700 lg:inline"
            >
              /
            </span>
            <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100 sm:text-base">
              {title}
            </h1>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:px-3"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search notes…</span>
            <kbd className="hidden rounded border border-gray-200 bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:inline-block">
              ⌘K
            </kbd>
          </button>
        )}
        <UserMenu
          name={user?.display_name ?? user?.email ?? null}
          email={user?.email ?? null}
          avatarUrl={user?.avatar_url ?? null}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}

interface UserMenuProps {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  onLogout: () => void;
}

function UserMenu({ name, email, avatarUrl, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2.5 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar src={avatarUrl} name={name} size={26} />
        <span className="hidden max-w-[10rem] truncate text-xs font-medium sm:inline">
          {name ?? 'Account'}
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 sm:inline" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-gray-100 px-3 py-3 dark:border-zinc-800">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
              {name ?? 'Signed in'}
            </p>
            {email && (
              <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                {email}
              </p>
            )}
          </div>
          <div className="py-1 text-sm">
            <Link
              to="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <UserRound className="h-4 w-4" />
              All workspaces
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TopBar;
