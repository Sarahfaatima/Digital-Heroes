import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import ScoreManager from '../../components/ScoreManager'
import { Loading, ErrorState, EmptyState, Badge, Alert, Balls, Modal, CharityImage } from '../../components/ui'
import { money, dateFmt, monthLabel } from '../../utils/format'

export function Scores() {
  const { isSubscribed } = useAuth()
  const { data, loading, error, reload } = useFetch(() => api.get('/scores'), [])
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Scores</span><h1>My golf scores</h1></div></div>
      {!isSubscribed && <div className="alert alert-warn">An active subscription is required to add or change scores. <Link to="/plans">Subscribe →</Link></div>}
      <ScoreManager
        scores={data.items}
        disabled={!isSubscribed}
        onChanged={() => reload(true)}
        actions={{
          create: (p) => api.post('/scores', p),
          update: (id, p) => api.put(`/scores/${id}`, p),
          remove: (id) => api.del(`/scores/${id}`),
        }}
      />
    </>
  )
}

export function MyCharity() {
  const { refresh } = useAuth()
  const toast = useToast()
  const { data: profile, reload: reloadProfile, loading, error } = useFetch(() => api.get('/user/profile'), [])
  const { data: list } = useFetch(() => api.get('/charities'), [])
  const { data: dash, reload: reloadDash } = useFetch(() => api.get('/user/dashboard'), [])
  const [pct, setPct] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [donation, setDonation] = useState({ charityId: '', amount: '10' })

  if (loading && !profile) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reloadProfile} />
  const u = profile.user
  const current = pct ?? u.charityPercent

  const save = async (patch, ok) => {
    setBusy(true)
    setMsg('')
    try {
      await api.put('/user/charity', patch)
      await Promise.all([reloadProfile(true), reloadDash(true), refresh()])
      setPct(null)
      toast(ok)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }
  const donate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await api.post('/donations', { charityId: donation.charityId || u.charity?._id, amountCents: Math.round(Number(donation.amount) * 100) })
      toast('Thank you for your donation (demo payment)')
      reloadDash(true)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  const feeCents = dash?.subscription?.amountCents || 1000

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Charity</span><h1>Where your money goes</h1></div></div>
      <Alert>{msg}</Alert>
      <div className="grid grid-2">
        <div className="card">
          <h3>Your contribution</h3>
          <div className="field">
            <label htmlFor="pc">{current}% of each payment{feeCents ? ` = ${money(Math.round((feeCents * current) / 100))}` : ''}</label>
            <input id="pc" type="range" min="10" max="100" step="5" value={current} onChange={(e) => setPct(Number(e.target.value))} />
            <span className="hint">Minimum 10%. Increase it whenever you like.</span>
          </div>
          <button className="btn btn-primary" disabled={busy || pct === null || pct === u.charityPercent} onClick={() => save({ charityPercent: pct }, 'Contribution updated')}>Save percentage</button>
          {dash && <p className="muted small mt mb0">Total given so far: <strong>{money(dash.contributions.totalCents)}</strong></p>}
        </div>
        <div className="card">
          <h3>Independent donation</h3>
          <p className="muted small">A one-off gift, separate from your subscription and gameplay. Demo payment.</p>
          <form onSubmit={donate}>
            <div className="field"><label htmlFor="dc">Charity</label>
              <select id="dc" value={donation.charityId || u.charity?._id || ''} onChange={(e) => setDonation({ ...donation, charityId: e.target.value })}>
                {list?.items?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="da">Amount (USD)</label><input id="da" type="number" min="1" value={donation.amount} onChange={(e) => setDonation({ ...donation, amount: e.target.value })} /></div>
            <button className="btn" disabled={busy}>Donate</button>
          </form>
        </div>
      </div>

      <h2 className="mt">Choose your charity</h2>
      {!list ? <Loading /> : (
        <div className="grid grid-3">
          {list.items.map((c) => {
            const selected = u.charity?._id === c._id
            return (
              <div key={c._id} className="card charity-card" style={selected ? { borderColor: 'var(--violet)', boxShadow: 'var(--shadow-lg)' } : {}}>
                <div className="charity-img" style={{ aspectRatio: '16/8' }}><CharityImage src={c.imageUrl} alt={c.name} /></div>
                <div className="charity-body">
                  <span className="tag">{c.category}</span>
                  <h3 style={{ margin: '8px 0 4px' }}>{c.name}</h3>
                  <p className="muted small">{c.shortDescription}</p>
                  <div className="btn-row">
                    <button className={`btn btn-sm ${selected ? 'btn-success' : ''}`} disabled={busy || selected} onClick={() => save({ charityId: c._id }, `Now supporting ${c.name}`)}>{selected ? '✓ Selected' : 'Select'}</button>
                    <Link to={`/charities/${c._id}`} className="small">Details</Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export function Draws() {
  const { data, loading, error, reload } = useFetch(async () => {
    const [mine, all] = await Promise.all([api.get('/user/draws'), api.get('/draws')])
    return { mine, all }
  }, [])
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const { mine, all } = data
  const myByDraw = Object.fromEntries(mine.entered.map((e) => [e.draw._id, e]))

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Draws</span><h1>Monthly draws</h1></div></div>
      <h3>Upcoming</h3>
      <div className="grid grid-2">
        {all.upcoming.length === 0 && <EmptyState emoji="🎟️" title="No upcoming draws" />}
        {all.upcoming.map((u) => (
          <div key={u.id} className="card">
            <div className="row-between"><h3 className="mb0">{monthLabel(u.month)}</h3><Badge value="open" tone="blue" /></div>
            <p className="muted small">Draw mode: {u.mode}. Numbers are revealed when the admin publishes the draw.</p>
            {u.rolloverInCents > 0 && <Alert type="success">🔥 Jackpot rollover: {money(u.rolloverInCents)} added to the 5-match prize</Alert>}
          </div>
        ))}
      </div>
      <h3 className="mt">Results & participation</h3>
      {all.published.length === 0 ? <EmptyState emoji="🎯" title="No draws published yet" /> : all.published.map((d) => {
        const mineEntry = myByDraw[d.id]
        return (
          <div key={d.id} className="card" style={{ marginBottom: '1rem' }}>
            <div className="row-between">
              <div><h3 className="mb0">{monthLabel(d.month)}</h3><span className="muted small">{d.participants} entries · pool {money(d.poolCents + d.rolloverInCents)} · {d.mode}</span></div>
              {mineEntry ? <Badge value={mineEntry.matches >= 3 ? `${mineEntry.matches} matches - winner!` : `${mineEntry.matches} matches`} tone={mineEntry.matches >= 3 ? 'green' : 'blue'} /> : <Badge value="not entered" tone="gray" />}
            </div>
            <div style={{ margin: '1rem 0' }}><Balls numbers={d.numbers} hits={mineEntry?.scores || []} /></div>
            {mineEntry && <p className="small muted mb0">Your numbers: {mineEntry.scores.join(', ')}</p>}
          </div>
        )
      })}
    </>
  )
}

export function Winnings() {
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => api.get('/user/winnings'), [])
  const [target, setTarget] = useState(null)
  const [viewing, setViewing] = useState(null)
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Winnings</span><h1>My winnings</h1></div></div>
      <div className="grid grid-3">
        <div className="card stat"><div className="label">Total won</div><div className="value">{money(data.totalWonCents)}</div></div>
        <div className="card stat"><div className="label">Paid out</div><div className="value">{money(data.paidCents)}</div></div>
        <div className="card stat"><div className="label">Pending</div><div className="value">{money(data.pendingCents)}</div></div>
      </div>
      <div className="mt">
        {data.items.length === 0 ? <EmptyState emoji="🏆" title="No winnings yet">Keep your scores up to date - every draw is a new chance.</EmptyState> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Draw</th><th>Match</th><th>Prize</th><th>Verification</th><th>Payment</th><th /></tr></thead>
              <tbody>
                {data.items.map((w) => (
                  <tr key={w.id}>
                    <td>{w.draw?.title || '-'}</td><td>{w.matchType} numbers</td><td><strong>{money(w.prizeCents)}</strong></td>
                    <td><Badge value={w.verificationStatus} />{w.adminNote && <div className="small muted">{w.adminNote}</div>}</td>
                    <td><Badge value={w.paymentStatus} /></td>
                    <td className="actions">
                      {(w.verificationStatus === 'awaiting_proof' || w.verificationStatus === 'rejected') && <button className="btn btn-sm" onClick={() => setTarget(w)}>{w.verificationStatus === 'rejected' ? 'Re-upload proof' : 'Upload proof'}</button>}
                      {w.hasProof && <button className="btn btn-ghost btn-sm" onClick={() => setViewing(w)}>View proof</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {target && <ProofUpload winner={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); toast('Proof submitted - awaiting admin review'); reload(true) }} />}
      {viewing && <ProofViewer winnerId={viewing.id} onClose={() => setViewing(null)} />}
    </>
  )
}

function ProofUpload({ winner, onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = (e) => {
    const f = e.target.files[0]
    setError('')
    if (f && f.size > 2 * 1024 * 1024) { setError('Image must be 2MB or smaller'); e.target.value = ''; return setFile(null) }
    setFile(f || null)
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!file) return setError('Choose a screenshot first')
    setBusy(true)
    try {
      const f = new FormData()
      f.append('proof', file)
      await api.upload(`/user/winnings/${winner.id}/proof`, f)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Upload winner proof" onClose={onClose}>
      <p className="muted">Upload a screenshot of your scores from the golf platform for the {winner.draw?.title}. PNG, JPEG or WebP, max 2MB.</p>
      <form onSubmit={submit}>
        <div className="field"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} aria-label="Proof screenshot" /></div>
        <Alert>{error}</Alert>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Uploading...' : 'Submit proof'}</button>
      </form>
    </Modal>
  )
}

export function ProofViewer({ winnerId, onClose }) {
  const { data: url, loading, error } = useFetch(async () => URL.createObjectURL(await api.blob(`/winners/${winnerId}/proof`)), [winnerId])
  return (
    <Modal title="Winner proof" onClose={onClose} wide>
      {loading ? <Loading /> : error ? <Alert>{error.message}</Alert> : <img className="proof-img" src={url} alt="Winner proof screenshot" />}
    </Modal>
  )
}

export function Profile() {
  const { refresh } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => api.get('/user/profile'), [])
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const f = form || { name: data.user.name, phone: data.user.phone || '', country: data.user.country || '', currentPassword: '', newPassword: '' }
  const set = (k) => (e) => setForm({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const body = { name: f.name, phone: f.phone, country: f.country }
      if (f.newPassword) { body.currentPassword = f.currentPassword; body.newPassword = f.newPassword }
      await api.put('/user/profile', body)
      await refresh()
      await reload(true)
      setForm(null)
      toast('Profile saved')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Profile</span><h1>Your profile</h1></div></div>
      <form className="card" style={{ maxWidth: 640 }} onSubmit={submit}>
        <div className="field"><label htmlFor="em">Email</label><input id="em" value={data.user.email} disabled /></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="nm">Name</label><input id="nm" required minLength={2} value={f.name} onChange={set('name')} /></div>
          <div className="field"><label htmlFor="ph">Phone</label><input id="ph" value={f.phone} onChange={set('phone')} /></div>
          <div className="field"><label htmlFor="co">Country</label><input id="co" value={f.country} onChange={set('country')} /></div>
        </div>
        <h3 className="mt">Change password</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" value={f.currentPassword} onChange={set('currentPassword')} /></div>
          <div className="field"><label htmlFor="np">New password</label><input id="np" type="password" minLength={8} autoComplete="new-password" value={f.newPassword} onChange={set('newPassword')} /></div>
        </div>
        <Alert>{msg}</Alert>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
        <p className="muted small mt mb0">Member since {dateFmt(data.user.createdAt)}</p>
      </form>
    </>
  )
}
