import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';

import { authApi } from '../../api/auth';
import type { ApiError, TokenResponse } from '../../types/api';

interface RegisterFormProps {
  onSuccess: (tokens: TokenResponse) => void;
}

const PASSWORD_MIN = 8;

const INPUT_CLASSES =
  'h-10 rounded-md border border-gray-300 bg-white px-3 text-gray-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-400';

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await authApi.register({
        email,
        password,
        display_name: displayName,
      });
      onSuccess(tokens);
    } catch (err) {
      setError(extractErrorDetail(err) ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700 dark:text-zinc-300">Display name</span>
        <input
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={INPUT_CLASSES}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700 dark:text-zinc-300">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASSES}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700 dark:text-zinc-300">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASSES}
        />
        <span className="text-xs text-gray-500 dark:text-zinc-400">
          At least {PASSWORD_MIN} characters.
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700 dark:text-zinc-300">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={INPUT_CLASSES}
        />
      </label>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center rounded-md bg-brand-gradient px-4 font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

function extractErrorDetail(err: unknown): string | null {
  if (isAxiosError<ApiError>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}

export default RegisterForm;
