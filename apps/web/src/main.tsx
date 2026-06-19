import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { WalletProvider } from './lib/WalletProvider';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { JoinLivePage } from './pages/JoinLivePage';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import { HandReplayPage } from './pages/HandReplayPage';
import { ReceiptsPage } from './pages/ReceiptsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 2_000 } },
});

/** The receipt graph now lives on the Replay page — keep old links working. */
function GraphRedirect() {
  const { id } = useParams();
  return <Navigate to={`/hands/${id ?? ''}`} replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing stands alone — no chrome, edge to edge. */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/join-live" element={<JoinLivePage />} />
          <Route element={<Layout />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/table/:id" element={<TablePage />} />
            <Route path="/hands/:id" element={<HandReplayPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/graph/:id" element={<GraphRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </WalletProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
