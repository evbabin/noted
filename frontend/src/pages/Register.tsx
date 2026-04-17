import { Link, useNavigate } from 'react-router-dom';

import { GoogleOAuthButton } from '../components/auth/GoogleOAuthButton';
import { RegisterForm } from '../components/auth/RegisterForm';
import { Logo } from '../components/ui/Logo';
import { useAuthStore } from '../stores/authStore';
import type { TokenResponse } from '../types/api';

export function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  function handleSuccess(tokens: TokenResponse) {
    // Same rationale as Login — keep tokenStorage and authStore.user in sync so
    // the TopBar user menu and any user-aware UI reflect the new session.
    setSession(tokens);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-6rem] flex justify-center"
      >
        <div className="h-72 w-[44rem] max-w-full rounded-full bg-gradient-to-r from-brand-500/20 via-brand-400/10 to-blue-500/20 blur-3xl" />
      </div>
      <div className="noted-dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link to="/" aria-label="Noted home">
            <Logo size="lg" showWordmark tagline="Study smarter" />
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
            Create your account
          </h1>
          <p className="mb-6 mt-1 text-center text-sm text-gray-500 dark:text-zinc-400">
            Start organizing notes, inviting collaborators, and generating quizzes.
          </p>
          <RegisterForm onSuccess={handleSuccess} />
          <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
            Or
            <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
          </div>
          <GoogleOAuthButton label="Sign up with Google" />
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-zinc-500">
          © {new Date().getFullYear()} Noted — collaborative study notes.
        </p>
      </div>
    </div>
  );
}

export default Register;
