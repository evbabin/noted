import { useNavigate } from 'react-router-dom';

import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';

export function Dashboard() {
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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Your workspaces</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </header>
      <p className="text-gray-600">Workspace list coming in Phase 3.</p>
    </div>
  );
}

export default Dashboard;
