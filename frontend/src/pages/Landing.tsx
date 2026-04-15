import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900">Noted</h1>
      <p className="mt-4 text-lg text-gray-600">
        Collaborative study notes with AI-powered quiz generation.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/login"
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

export default Landing;
