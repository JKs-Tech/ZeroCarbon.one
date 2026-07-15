import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RequireAuth } from '../features/auth/RequireAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Role } from '../constants';
import { LoginPage } from '../features/auth/LoginPage';

const DashboardPage = lazy(() =>
  import('../features/documents/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const UploadPage = lazy(() =>
  import('../features/documents/UploadPage').then((m) => ({ default: m.UploadPage })),
);
const DocumentDetailsPage = lazy(() =>
  import('../features/documents/DocumentDetailsPage').then((m) => ({
    default: m.DocumentDetailsPage,
  })),
);
const HumanReviewPage = lazy(() =>
  import('../features/review/HumanReviewPage').then((m) => ({ default: m.HumanReviewPage })),
);
const AdminDashboardPage = lazy(() =>
  import('../features/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/documents/:id" element={<DocumentDetailsPage />} />
            <Route path="/documents/:id/review" element={<HumanReviewPage />} />
            <Route element={<RequireAuth roles={[Role.ADMIN]} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
