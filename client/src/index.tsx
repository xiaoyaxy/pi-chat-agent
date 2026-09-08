import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { createPortal } from 'react-dom';

import RoutesComponent from './app.tsx';
import './index.css';
import { Toaster } from '@client/src/components/ui/sonner';

const CLIENT_BASE_PATH = import.meta.env.BASE_URL;

const MainApp = () => {
  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold">页面暂时无法显示</h1>
              <p className="mt-2 text-sm text-slate-500">
                请刷新页面，或点击下方按钮重试。
              </p>
              <button
                className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
                type="button"
                onClick={resetErrorBoundary}
              >
                重新加载
              </button>
            </div>
          </main>
        )}
      >
        <RoutesComponent />
        {createPortal(<Toaster />, document.body)}
      </ErrorBoundary>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);
