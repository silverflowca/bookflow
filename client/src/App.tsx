import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookEditor from './pages/BookEditor';
import ChapterEditor from './pages/ChapterEditor';
import BookReader from './pages/BookReader';
import BookSettings from './pages/BookSettings';
import Settings from './pages/Settings';
import InboxPage from './pages/InboxPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import BookCollaboratorsPage from './pages/BookCollaboratorsPage';
import BookVersionsPage from './pages/BookVersionsPage';
import BookActivityPage from './pages/BookActivityPage';
import PublicBookPage from './pages/PublicBookPage';
import PublishSubmitPage from './pages/PublishSubmitPage';
import ClubsPage from './pages/ClubsPage';
import ClubDetailPage from './pages/ClubDetailPage';
import ClubReadPage from './pages/ClubReadPage';
import AcceptClubInvitePage from './pages/AcceptClubInvitePage';
import LiveSchedule from './pages/live/LiveSchedule';
import LiveEpisode from './pages/live/LiveEpisode';
import LiveDashboard from './pages/live/LiveDashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route path="dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Reading */}
        <Route path="book/:bookId" element={<BookReader />} />
        <Route path="book/:bookId/chapter/:chapterId" element={<BookReader />} />

        {/* Public reader — no auth required */}
        <Route path="read/:slug" element={<PublicBookPage />} />
        <Route path="read/share/:token" element={<PublicBookPage />} />

        {/* Invite acceptance — works with or without auth */}
        <Route path="invite/:token" element={<AcceptInvitePage />} />
        <Route path="clubs/accept/:token" element={<AcceptClubInvitePage />} />

        {/* Protected editing routes */}
        <Route path="edit/book/:bookId" element={
          <ProtectedRoute>
            <BookEditor />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/chapter/:chapterId" element={
          <ProtectedRoute>
            <ChapterEditor />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/settings" element={
          <ProtectedRoute>
            <BookSettings />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/collaborators" element={
          <ProtectedRoute>
            <BookCollaboratorsPage />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/versions" element={
          <ProtectedRoute>
            <BookVersionsPage />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/activity" element={
          <ProtectedRoute>
            <BookActivityPage />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/submit" element={
          <ProtectedRoute>
            <PublishSubmitPage />
          </ProtectedRoute>
        } />

        <Route path="inbox" element={
          <ProtectedRoute>
            <InboxPage />
          </ProtectedRoute>
        } />

        <Route path="settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />

        {/* Book Clubs */}
        <Route path="clubs" element={
          <ProtectedRoute>
            <ClubsPage />
          </ProtectedRoute>
        } />

        <Route path="clubs/:clubId" element={
          <ProtectedRoute>
            <ClubDetailPage />
          </ProtectedRoute>
        } />

        <Route path="clubs/:clubId/read/:bookId" element={
          <ProtectedRoute>
            <ClubReadPage />
          </ProtectedRoute>
        } />

        {/* Live Show */}
        <Route path="live" element={
          <ProtectedRoute>
            <LiveSchedule />
          </ProtectedRoute>
        } />

        <Route path="live/episode/:id" element={
          <ProtectedRoute>
            <LiveEpisode />
          </ProtectedRoute>
        } />

        <Route path="live/episode/:id/dashboard" element={
          <ProtectedRoute>
            <LiveDashboard />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
