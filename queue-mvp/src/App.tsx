import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { initializeDatabase } from './lib/db';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import DoctorsPage from './pages/DoctorsPage';
import BookPage from './pages/BookPage';
import TokenPage from './pages/TokenPage';
import TrackPage from './pages/TrackPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import VerifyPage from './pages/VerifyPage';
import ProfilePage from './pages/ProfilePage';
import LoadingScreen from './components/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) {
    if (user?.role === 'doctor') {
      return <Navigate to="/admin" replace />;
    }
    const params = new URLSearchParams(location.search);
    const next = params.get('next') || '/';
    return <Navigate to={next} replace />;
  }
  return children;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Clinics',
  '/login': 'Sign in',
  '/verify': 'Verify OTP',
  '/admin': 'Admin',
  '/track': 'My appointments',
  '/profile': 'My profile',
};

/** One browser-tab title per page (it used to be the same on every screen). */
function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title =
      PAGE_TITLES[pathname] ??
      (pathname.startsWith('/doctors/')
        ? 'Doctors'
        : pathname.startsWith('/book/')
          ? 'Book a token'
          : pathname.startsWith('/token/')
            ? 'Your token'
            : 'Page not found');
    document.title = `${title} — WaitSmart`;
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="space-y-3 py-12 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you are looking for does not exist.</p>
      <Link to="/" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
        Go to home
      </Link>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/verify';

  useEffect(() => {
    initializeDatabase().finally(() => setReady(true));
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <div className="flex min-h-dvh flex-col">
      <TitleSync />
      {!isAuthPage && <Header />}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 sm:max-w-xl">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/verify"
            element={
              <PublicOnlyRoute>
                <VerifyPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/admin" element={<AdminPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctors/:clinicId"
            element={
              <ProtectedRoute>
                <DoctorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:doctorId"
            element={
              <ProtectedRoute>
                <BookPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/token/:appointmentId"
            element={
              <ProtectedRoute>
                <TokenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/track"
            element={
              <ProtectedRoute>
                <TrackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isAuthPage && <Footer />}
    </div>
  );
}
