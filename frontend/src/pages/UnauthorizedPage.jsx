import { Link } from 'react-router-dom';

const UnauthorizedPage = () => {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center"
      aria-labelledby="unauthorized-title"
    >
      <h1
        id="unauthorized-title"
        className="text-2xl font-bold text-gray-900 sm:text-3xl"
      >
        Access Denied
      </h1>
      <p className="mt-2 text-gray-600">
        You do not have permission to view this page.
      </p>
      <Link
        to="/"
        className="mt-4 text-[#0D2B55] font-semibold hover:text-[#C9992A] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 rounded"
      >
        Go Home
      </Link>
    </main>
  );
};

export default UnauthorizedPage;