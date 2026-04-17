import { authApi } from '../../api/auth';

interface GoogleOAuthButtonProps {
  label?: string;
}

export function GoogleOAuthButton({ label = 'Continue with Google' }: GoogleOAuthButtonProps) {
  function handleClick() {
    window.location.assign(authApi.googleLoginUrl());
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-offset-zinc-950"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.22 1.17-1.62 3.43-5.1 3.43a5.23 5.23 0 1 1 0-10.46c1.64 0 2.74.7 3.37 1.3l2.3-2.22C16.2 4.5 14.3 3.6 12 3.6a8.4 8.4 0 1 0 0 16.8c4.85 0 8.06-3.4 8.06-8.19 0-.55-.06-.97-.14-1.4H12Z"
      />
      <path
        fill="#4285F4"
        d="M20.06 12.21c0-.55-.06-.97-.14-1.4H12v3h4.56a3.9 3.9 0 0 1-1.7 2.57l2.75 2.13c1.6-1.48 2.45-3.66 2.45-6.3Z"
      />
      <path
        fill="#FBBC05"
        d="M6.77 14.27a5.23 5.23 0 0 1 0-4.54L3.92 7.55a8.4 8.4 0 0 0 0 8.9l2.85-2.18Z"
      />
      <path
        fill="#34A853"
        d="M12 20.4c2.3 0 4.23-.76 5.63-2.07l-2.75-2.13c-.76.53-1.78.9-2.88.9-2.2 0-4.08-1.48-4.75-3.5L4.4 15.78A8.4 8.4 0 0 0 12 20.4Z"
      />
    </svg>
  );
}

export default GoogleOAuthButton;
