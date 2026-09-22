import { NavLink, Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export function PublicLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

function PanelLayout({ title, links }) {
  return (
    <>
      <Navbar />
      <div className="panel">
        <aside className="sidebar" aria-label={title}>
          <h4>{title}</h4>
          {links.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <span aria-hidden="true">{icon}</span> {label}
            </NavLink>
          ))}
        </aside>
        <main className="panel-main">
          <Outlet />
        </main>
      </div>
    </>
  )
}

export const UserLayout = () => (
  <PanelLayout
    title="My space"
    links={[
      ['/dashboard', 'Dashboard', '🏠', true],
      ['/scores', 'My scores', '⛳'],
      ['/charity', 'My charity', '💜'],
      ['/draws', 'Draws', '🎟️'],
      ['/winnings', 'Winnings', '🏆'],
      ['/profile', 'Profile', '👤'],
    ]}
  />
)

export const AdminLayout = () => (
  <PanelLayout
    title="Admin"
    links={[
      ['/admin', 'Overview', '📊', true],
      ['/admin/users', 'Users', '👥'],
      ['/admin/draws', 'Draws', '🎟️'],
      ['/admin/charities', 'Charities', '💜'],
      ['/admin/winners', 'Winners', '🏆'],
      ['/admin/reports', 'Reports', '📈'],
    ]}
  />
)
