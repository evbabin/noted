import { Link, useLocation, useNavigate } from 'react-router-dom';

import { tokenStorage } from '../api/client';
import { GoogleOAuthButton } from '../components/auth/GoogleOAuthButton';
import { LoginForm } from '../components/auth/LoginForm';
import type { TokenResponse } from '../types/api';

interface LocationState {
  from?: { pathname?: string };
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';

  function handleSuccess(tokens: TokenResponse) {
    tokenStorage.set(tokens.access_token, tokens.refresh_token);
    navigate(fromPath, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-center text-2xl font-semibold text-gray-900">Sign in to Noted</h1>
          <LoginForm onSuccess={handleSuccess} />
          <Divider />
          <GoogleOAuthButton />
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      OR
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export default Login;
