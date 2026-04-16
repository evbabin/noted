import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm sm:px-8 sm:py-12">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <p className="mt-4 text-gray-600">That page doesn&apos;t exist.</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
