import { Link, Route, Routes } from 'react-router-dom'
import { PublicLayout, UserLayout, AdminLayout } from './layouts/layouts'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/public/Home'
import HowItWorks from './pages/public/HowItWorks'
import Charities from './pages/public/Charities'
import CharityDetail from './pages/public/CharityDetail'
import Plans from './pages/public/Plans'
import { Login, Register } from './pages/public/Auth'
import Dashboard from './pages/user/Dashboard'
import { Scores, MyCharity, Draws, Winnings, Profile } from './pages/user/UserPages'
import { AdminOverview, AdminReports } from './pages/admin/AdminReports'
import AdminUsers from './pages/admin/AdminUsers'
import AdminCharities from './pages/admin/AdminCharities'
import AdminDraws from './pages/admin/AdminDraws'
import AdminWinners from './pages/admin/AdminWinners'

const NotFound = () => (
  <div className="container section center">
    <h1>Page not found</h1>
    <p className="lead">That page doesn't exist.</p>
    <Link to="/" className="btn">Back home</Link>
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/charities" element={<Charities />} />
        <Route path="/charities/:id" element={<CharityDetail />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/charity" element={<MyCharity />} />
          <Route path="/draws" element={<Draws />} />
          <Route path="/winnings" element={<Winnings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute admin />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/charities" element={<AdminCharities />} />
          <Route path="/admin/draws" element={<AdminDraws />} />
          <Route path="/admin/winners" element={<AdminWinners />} />
          <Route path="/admin/reports" element={<AdminReports />} />
        </Route>
      </Route>
    </Routes>
  )
}
