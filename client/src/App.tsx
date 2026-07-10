import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
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
import BookDashboardPage from './pages/BookDashboardPage';
import PublicBookPage from './pages/PublicBookPage';
import PublishSubmitPage from './pages/PublishSubmitPage';
import ClubsPage from './pages/ClubsPage';
import ClubDetailPage from './pages/ClubDetailPage';
import ClubReadPage from './pages/ClubReadPage';
import ClubMemberProgressPage from './pages/ClubMemberProgressPage';
import AcceptClubInvitePage from './pages/AcceptClubInvitePage';
import LiveSchedule from './pages/live/LiveSchedule';
import LiveEpisode from './pages/live/LiveEpisode';
import LiveDashboard from './pages/live/LiveDashboard';
import LiveBible from './pages/live/LiveBible';
import LiveQueue from './pages/live/LiveQueue';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import BookLandingPage from './pages/BookLandingPage';
import DocsPage from './pages/DocsPage';
import MyFeedbackPage from './pages/MyFeedbackPage';
import BookChatPage from './pages/BookChatPage';
import BookSignaturesPage from './pages/BookSignaturesPage';
import BookPrintPage from './pages/BookPrintPage';

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
        <Route path="book/:bookId/chat" element={
          <ProtectedRoute>
            <BookChatPage />
          </ProtectedRoute>
        } />

        {/* Public reader — no auth required */}
        <Route path="read/:slug" element={<PublicBookPage />} />
        <Route path="read/share/:token" element={<PublicBookPage />} />

        {/* Book landing page — QR code destination, no auth required */}
        <Route path="book-landing/:slug" element={<BookLandingPage />} />
        <Route path="bl/:slug" element={<BookLandingPage />} />

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

        <Route path="edit/book/:bookId/signatures" element={
          <ProtectedRoute>
            <BookSignaturesPage />
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

        <Route path="edit/book/:bookId/dashboard" element={
          <ProtectedRoute>
            <BookDashboardPage />
          </ProtectedRoute>
        } />

        <Route path="edit/book/:bookId/print" element={
          <ProtectedRoute>
            <BookPrintPage />
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
        <Route path="clubs/:clubId/read" element={
          <ProtectedRoute>
            <ClubReadPage />
          </ProtectedRoute>
        } />
        <Route path="clubs/:clubId/members/:memberId/progress" element={
          <ProtectedRoute>
            <ClubMemberProgressPage />
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

        <Route path="live/bible" element={
          <ProtectedRoute>
            <LiveBible />
          </ProtectedRoute>
        } />

        <Route path="live/episode/:id/queue" element={
          <ProtectedRoute>
            <LiveQueue />
          </ProtectedRoute>
        } />

        {/* Profile */}
        <Route path="profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="profile/:userId" element={<ProfilePage />} />

        {/* Super admin */}
        <Route path="admin" element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } />

        {/* My Feedback */}
        <Route path="my-feedback" element={
          <ProtectedRoute>
            <MyFeedbackPage />
          </ProtectedRoute>
        } />

        {/* Help / Documentation — public */}
        <Route path="docs" element={<DocsPage />} />
        <Route path="help" element={<DocsPage />} />
      </Route>

    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FeedbackProvider>
            <AppRoutes />
          </FeedbackProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
