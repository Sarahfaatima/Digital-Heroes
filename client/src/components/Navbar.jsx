import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const Logo = () => (
  <Link to="/" className="logo" aria-label="Digital Heroes home">
    <span className="logo-mark">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 21C6 16.7 3 13 3 9.5a4.5 4.5 0 0 1 9-1.6A4.5 4.5 0 0 1 21 9.5c0 3.500-3 7.200-9 11.500z" /></svg>
    </span>
    Digital Heroes
  </Link>
)

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const close = () => setOpen(false)
  const doLogout = async () => {
    await logout()
    close()
    nav('/')
  }
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Logo />
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
          <NavLink to="/how-it-works" onClick={close}>How it works</NavLink>
          <NavLink to="/charities" onClick={close}>Charities</NavLink>
          <NavLink to="/plans" onClick={close}>Plans</NavLink>
          {user && <NavLink to={isAdmin ? '/admin' : '/dashboard'} onClick={close}>{isAdmin ? 'Admin' : 'Dashboard'}</NavLink>}
        </nav>
        <div className="nav-actions">
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={doLogout}>Log out</button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Log in</Link>
              <Link to="/plans" className="btn btn-primary btn-sm">Subscribe</Link>
            </>
          )}
          <button className="burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
        </div>
      </div>
    </header>
  )
}
