import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loading, ErrorState, EmptyState, Badge, Stat, Alert, Balls } from '../../components/ui'
import { money, dateFmt, monthLabel, planLabel } from '../../utils/format'

export default function Dashboard() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const { data: d, loading, error, reload } = useFetch(() => api.get('/user/dashboard'), [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (loading && !d) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const sub = d.subscription

  const cancel = async () => {
    if (!window.confirm('Cancel your subscription? You will lose access to score entry and draws.')) return
    setBusy(true)
    setErr('')
    try {
      await api.post('/subscription/cancel')
      await refresh()
      toast('Subscription cancelled')
      reload(true)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="panel-head">
        <div><span className="eyebrow">Dashboard</span><h1>Hi, {user?.name?.split(' ')[0]} 👋</h1></div>
        <Link to="/scores" className="btn btn-primary">+ Add a score</Link>
      </div>
      <Alert>{err}</Alert>

      {!sub.isActive && (
        <div className="alert alert-warn">
          <strong>Your subscription is {sub.status}.</strong> Subscribe to add scores and enter monthly draws.{' '}
          <Link to="/plans">View plans →</Link>
        </div>
      )}

      <div className="grid grid-4">
        <Stat label="Subscription" value={<Badge value={sub.isActive ? 'active' : sub.status} />} sub={sub.isActive ? `${planLabel(sub.plan)} · renews ${dateFmt(sub.renewalDate)}` : sub.currentPeriodEnd ? `Ended ${dateFmt(sub.currentPeriodEnd)}` : 'Not subscribed'} />
        <Stat label="Draws entered" value={d.draws.enteredCount} sub={d.draws.eligibleForNextDraw ? 'You are in the next draw ✓' : 'Add a score & subscribe to enter'} />
        <Stat label="Total winnings" value={money(d.winnings.totalWonCents)} sub={d.winnings.count ? `${money(d.winnings.paidCents)} paid · ${money(d.winnings.pendingCents)} pending` : 'No wins yet - good luck!'} />
        <Stat label="Charity given" value={money(d.contributions.totalCents)} sub={`${d.charityPercent}% of your fee`} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <div className="row-between"><h3>Latest scores</h3><Link to="/scores" className="small">Manage →</Link></div>
          {d.scores.length === 0 ? (
            <EmptyState emoji="⛳" title="No scores yet" action={<Link to="/scores" className="btn btn-sm">Enter your first score</Link>}>Your scores are your draw numbers.</EmptyState>
          ) : d.scores.map((s) => (
            <div key={s.id} className="score-row"><div className="score-val">{s.value}</div><div className="grow"><strong>{dateFmt(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong></div></div>
          ))}
        </div>

        <div className="card">
          <h3>Subscription</h3>
          <dl className="kv">
            <dt>Status</dt><dd><Badge value={sub.isActive ? 'active' : sub.status} /></dd>
            <dt>Plan</dt><dd>{planLabel(sub.plan)}{sub.amountCents ? ` · ${money(sub.amountCents)}` : ''}</dd>
            <dt>Renewal date</dt><dd>{sub.isActive ? dateFmt(sub.renewalDate) : '-'}</dd>
            <dt>Payment status</dt><dd>{sub.lastPaymentStatus && sub.lastPaymentStatus !== 'none' ? <Badge value={sub.lastPaymentStatus} /> : '-'}</dd>
          </dl>
          <div className="btn-row mt">
            <Link to="/plans" className="btn btn-sm">{sub.isActive ? 'Renew / change plan' : 'Subscribe'}</Link>
            {sub.isActive && <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>Cancel subscription</button>}
          </div>
        </div>

        <div className="card">
          <div className="row-between"><h3>Your charity</h3><Link to="/charity" className="small">Change →</Link></div>
          {d.charity ? (
            <>
              <p style={{ font: '600 1.2rem var(--display)', marginBottom: 6 }}>{d.charity.name}</p>
              <div className="row-between small"><span className="muted">Contribution</span><strong>{d.charityPercent}% of subscription</strong></div>
              <div className="meter" style={{ margin: '8px 0 12px' }}><span style={{ width: `${d.charityPercent}%` }} /></div>
              <p className="muted small mb0">Given so far: <strong>{money(d.contributions.totalCents)}</strong> ({money(d.contributions.subscriptionCents)} subscription + {money(d.contributions.donationCents)} donations)</p>
            </>
          ) : <EmptyState emoji="💜" title="No charity selected" action={<Link to="/charity" className="btn btn-sm">Choose a charity</Link>} />}
        </div>

        <div className="card">
          <div className="row-between"><h3>Upcoming draws</h3><Link to="/draws" className="small">All draws →</Link></div>
          {d.draws.upcoming.length === 0 ? <EmptyState emoji="🎟️" title="No upcoming draws" /> : d.draws.upcoming.map((u) => (
            <div key={u.id} style={{ marginBottom: 10 }}>
              <div className="row-between"><strong>{monthLabel(u.month)}</strong><Badge value={u.status === 'draft' ? 'open' : u.status} tone="blue" /></div>
              <span className="muted small">{u.rolloverInCents > 0 ? `Includes ${money(u.rolloverInCents)} jackpot rollover` : 'Numbers are drawn at month end'}</span>
            </div>
          ))}
          {d.draws.entered[0] && (
            <>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '1rem 0' }} />
              <p className="small muted">Last draw entered: {d.draws.entered[0].draw.title} - {d.draws.entered[0].matches} match{d.draws.entered[0].matches === 1 ? '' : 'es'}</p>
              <Balls small numbers={d.draws.entered[0].draw.numbers} hits={d.draws.entered[0].scores} />
            </>
          )}
        </div>
      </div>
      {d.winnings.awaitingProof > 0 && (
        <div className="alert alert-info mt">🏆 You have a win waiting for proof. <Link to="/winnings">Upload your screenshot →</Link></div>
      )}
    </>
  )
}
