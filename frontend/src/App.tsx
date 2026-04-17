import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { AppToaster } from './components/ui/Toast';
import { queryClient } from './lib/queryClient';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { NotePage } from './pages/Note';
import { NotFound } from './pages/NotFound';
import { QuizPage } from './pages/QuizPage';
import { QuizReviewPage } from './pages/QuizReviewPage';
import { Register } from './pages/Register';
import { Workspace } from './pages/Workspace';

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workspaces/:workspaceId" element={<Workspace />} />
              <Route
                path="/workspaces/:workspaceId/notes/:noteId"
                element={<NotePage />}
              />
              <Route path="/notes/:noteId/quizzes" element={<QuizPage />} />
              <Route path="/quizzes/:quizId" element={<QuizReviewPage />} />
            </Route>

            <Route path="/home" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <ThemeToggle />
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
