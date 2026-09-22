import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Alert } from '../../components/ui'

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(form.email, form.password)
      nav(loc.state?.from || (u.role === 'admin' ? '/admin' : '/dashboard'), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  const fill = (email, password) => setForm({ email, password })

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Welcome back</h2>
        <p className="muted">Log in to manage your scores, charity and draws.</p>
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <Alert>{error}</Alert>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p className="small center mt">New here? <Link to="/register">Create an account</Link></p>
        <div className="alert alert-info small" style={{ marginTop: '1rem' }}>
          <strong>Demo accounts</strong>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill('user@digitalheroes.demo', 'User@12345')}>Use subscriber</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fill('admin@digitalheroes.demo', 'Admin@12345')}>Use admin</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const { data } = useFetch(() => api.get('/charities'), [])
  const [form, setForm] = useState({ name: '', email: '', password: '', charityId: loc.state?.charity || '', charityPercent: 10 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.charityId) return setError('Please choose a charity to support.')
    setBusy(true)
    try {
      await register({ ...form, charityPercent: Number(form.charityPercent) })
      nav('/plans', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ width: 'min(520px,100%)' }}>
        <h2>Become a hero</h2>
        <p className="muted">Create your account and choose the cause you'll support.</p>
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="name">Full name</label><input id="name" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
          <div className="field"><label htmlFor="pw">Password</label><input id="pw" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /><span className="hint">At least 8 characters.</span></div>
          <div className="field">
            <label htmlFor="ch">Charity you'll support</label>
            <select id="ch" required value={form.charityId} onChange={set('charityId')}>
              <option value="">Select a charity...</option>
              {data?.items?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pc">Contribution: <strong>{form.charityPercent}%</strong> of your subscription</label>
            <input id="pc" type="range" min="10" max="100" step="5" value={form.charityPercent} onChange={set('charityPercent')} />
            <span className="hint">Minimum 10%. You can change this any time.</span>
          </div>
          <Alert>{error}</Alert>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
        </form>
        <p className="small center mt">Already registered? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  )
}
