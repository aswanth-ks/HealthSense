import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading…</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
