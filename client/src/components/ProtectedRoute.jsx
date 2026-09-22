import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loading } from './ui'

/** Guards a route group. `admin` additionally requires the admin role (server re-checks every API call). */
export default function ProtectedRoute({ admin = false }) {
  const { user, isAdmin, booting } = useAuth()
  const loc = useLocation()
  if (booting) return <Loading label="Checking your session..." />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
