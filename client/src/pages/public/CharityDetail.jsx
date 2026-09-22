import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loading, ErrorState, CharityImage, Alert } from '../../components/ui'
import { dateFmt, money } from '../../utils/format'

export default function CharityDetail() {
  const { id } = useParams()
  const { user, refresh } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const { data, loading, error, reload } = useFetch(() => api.get(`/charities/${id}`), [id])
  const [amount, setAmount] = useState('10')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <div className="container section"><ErrorState error={error} onRetry={reload} /><div className="center"><Link to="/charities">← Back to charities</Link></div></div>
  const c = data.charity

  const choose = async () => {
    if (!user) return nav('/register', { state: { charity: c._id } })
    setBusy(true)
    try {
      await api.put('/user/charity', { charityId: c._id })
      await refresh()
      toast(`${c.name} is now your charity`)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }
  const donate = async (e) => {
    e.preventDefault()
    setMsg('')
    setBusy(true)
    try {
      await api.post('/donations', { charityId: c._id, amountCents: Math.round(Number(amount) * 100) })
      toast(`Thank you! Your ${money(Math.round(Number(amount) * 100))} donation was recorded (demo).`)
      reload(true)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section">
      <div className="container">
        <Link to="/charities" className="small">← All charities</Link>
        <div className="grid grid-2 mt" style={{ alignItems: 'start', gap: '2.5rem' }}>
          <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="charity-img" style={{ aspectRatio: '16/10' }}><CharityImage src={c.imageUrl} alt={c.name} /></div>
            </div>
            <div className="grid grid-2 mt">
              <div className="card"><div className="muted small">Supporters</div><div className="value" style={{ font: '700 1.8rem var(--display)' }}>{c.supporters}</div></div>
              <div className="card"><div className="muted small">Raised on platform</div><div className="value" style={{ font: '700 1.8rem var(--display)' }}>{money(c.raisedCents)}</div></div>
            </div>
          </div>
          <div>
            <div className="btn-row"><span className="tag">{c.category}</span>{c.featured && <span className="tag tag-feat">★ Featured</span>}</div>
            <h1 style={{ fontSize: 'clamp(2rem,4vw,3rem)', marginTop: 12 }}>{c.name}</h1>
            <p className="lead">{c.description || c.shortDescription}</p>
            {c.website && <p><a href={c.website} target="_blank" rel="noreferrer">Visit website ↗</a></p>}
            <Alert>{msg}</Alert>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={choose} disabled={busy}>{user ? 'Support this charity' : 'Sign up to support'}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-2 mt" style={{ alignItems: 'start' }}>
          <div>
            <h2>Upcoming events</h2>
            {c.events?.length ? c.events.map((ev) => (
              <div key={ev._id} className="card mt" style={{ padding: '1.1rem 1.3rem' }}>
                <div className="row-between"><strong>{ev.title}</strong><span className="badge badge-blue">{dateFmt(ev.date)}</span></div>
                {ev.location && <div className="muted small">📍 {ev.location}</div>}
                {ev.description && <p className="small mb0" style={{ marginTop: 6 }}>{ev.description}</p>}
              </div>
            )) : <p className="muted">No upcoming events listed.</p>}
          </div>
          <div>
            <h2>Make an independent donation</h2>
            <form className="card" onSubmit={donate}>
              <p className="muted small">Not tied to gameplay or your subscription. Demo only - no real payment is taken.</p>
              {user ? (
                <>
                  <div className="field"><label htmlFor="amt">Amount (USD)</label><input id="amt" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <button className="btn" disabled={busy}>Donate</button>
                </>
              ) : <Link to="/login" className="btn">Log in to donate</Link>}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
