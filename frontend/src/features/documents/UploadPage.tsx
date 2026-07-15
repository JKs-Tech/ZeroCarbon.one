import { Navigate } from 'react-router-dom';

/** Upload lives on the Workspace dashboard — keep route for old links. */
export function UploadPage() {
  return <Navigate to="/dashboard" replace />;
}
