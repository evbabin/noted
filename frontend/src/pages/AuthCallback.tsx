import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { LoadingState } from '../components/ui/LoadingState';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode double-invocation — Google codes are single-use.
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get('code');
    if (!code) {
      navigate('/login?error=missing_code', { replace: true });
      return;
    }

    authApi
      .exchangeGoogleCode(code)
      .then((data) => {
        setSession(data);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=google_auth_failed', { replace: true });
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
      <LoadingState title="Signing you in…" message="Completing Google authentication." />
    </div>
  );
}

export default AuthCallback;
