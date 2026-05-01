import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Access Denied</h1>
      <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
      <Link to="/" className="mt-4 text-blue-600 hover:underline">Go Home</Link>
    </div>
  );
};

export default UnauthorizedPage;