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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
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
