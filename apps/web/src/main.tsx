import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import { HandReplayPage } from './pages/HandReplayPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { GraphPage } from './pages/GraphPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 2_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing stands alone — no chrome, edge to edge. */}
          <Route path="/" element={<LandingPage />} />
          <Route element={<Layout />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/table/:id" element={<TablePage />} />
            <Route path="/hands/:id" element={<HandReplayPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/graph/:id" element={<GraphPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
