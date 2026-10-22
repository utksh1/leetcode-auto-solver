import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import DailyChallenge from './pages/DailyChallenge';
import ProblemSolver from './pages/ProblemSolver';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';

function AppShell() {
  const location = useLocation();

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/daily" element={<DailyChallenge />} />
          <Route path="/solver" element={<ProblemSolver />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
