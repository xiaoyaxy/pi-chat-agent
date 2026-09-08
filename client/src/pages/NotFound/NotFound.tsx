import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="text-center">
        <p className="text-sm font-medium text-indigo-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold">页面不存在</h1>
        <Link
          className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
          to="/"
        >
          返回对话
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
