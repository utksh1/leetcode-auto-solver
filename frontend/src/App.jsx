import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DailyChallenge from './pages/DailyChallenge';
import ProblemSolver from './pages/ProblemSolver';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/daily" element={<DailyChallenge />} />
              <Route path="/solver" element={<ProblemSolver />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
