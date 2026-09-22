import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Loading, ErrorState, Reveal, Alert } from '../../components/ui'
import CheckoutModal from '../../components/CheckoutModal'
import { money, dateFmt } from '../../utils/format'

export default function Plans() {
  const { user, subscription } = useAuth()
  const nav = useNavigate()
  const { data: cfg, error, loading, reload } = useFetch(() => api.get('/config'), [])
  const [chosen, setChosen] = useState(null)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const { monthly, yearly } = cfg.plans
  const saving = Math.round((1 - yearly.priceCents / (monthly.priceCents * 12)) * 100)
  const poolPct = cfg.prizePool.poolPercentOfFee

  const choose = (id) => (user ? setChosen(id) : nav('/register'))
  const feats = [
    'Enter your latest 5 Stableford scores',
    'Automatic entry into every monthly draw',
    `Minimum ${cfg.charity.minPercent}% of your fee goes to your chosen charity`,
    `${poolPct}% of every fee funds the prize pool`,
    'Winner verification & tracked payouts',
  ]

  return (
    <div className="section">
      <div className="container">
        <Reveal className="center">
          <span className="eyebrow">Plans</span>
          <h1>One subscription. Two ways to give.</h1>
          <p className="lead">Choose how you'd like to play. Cancel any time.</p>
        </Reveal>
        {subscription?.isActive && (
          <div style={{ maxWidth: 640, margin: '1.5rem auto 0' }}>
            <Alert type="success">You're on the {subscription.plan} plan - renews {dateFmt(subscription.renewalDate)}. Selecting a plan below renews / extends it.</Alert>
          </div>
        )}
        <div className="grid grid-2 mt" style={{ maxWidth: 820, margin: '2rem auto 0' }}>
          <Reveal className="card plan">
            <h3>{monthly.label}</h3>
            <div className="price">{money(monthly.priceCents)}<span className="muted small"> / month</span></div>
            <ul>{feats.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className="btn btn-ghost btn-lg" onClick={() => choose('monthly')}>Choose monthly</button>
          </Reveal>
          <Reveal delay={100} className="card plan best">
            <span className="ribbon">Save {saving}%</span>
            <h3>{yearly.label}</h3>
            <div className="price">{money(yearly.priceCents)}<span className="muted small"> / year</span></div>
            <ul>{feats.map((f) => <li key={f}>{f}</li>)}<li><strong>{money(monthly.priceCents * 12 - yearly.priceCents)} cheaper</strong> than paying monthly</li></ul>
            <button className="btn btn-primary btn-lg" onClick={() => choose('yearly')}>Choose yearly</button>
          </Reveal>
        </div>
        {!user && <p className="center muted small mt">You'll create a free account and pick your charity first.</p>}
      </div>
      {chosen && <CheckoutModal plan={chosen} planDef={cfg.plans[chosen]} onClose={() => setChosen(null)} onDone={() => nav('/dashboard')} />}
    </div>
  )
}
