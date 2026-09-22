import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { Reveal, Loading } from '../../components/ui'

const emojis = ['🎟️', '⛳', '🎯', '💜', '🔎']

export default function HowItWorks() {
  const { data: cfg } = useFetch(() => api.get('/config'), [])
  const tiers = cfg?.prizePool?.tiers
  return (
    <div className="section">
      <div className="container">
        <Reveal className="center">
          <span className="eyebrow">How it works</span>
          <h1>Scores in. Impact out.</h1>
          <p className="lead">Everything you need to know about subscribing, scoring, winning and giving.</p>
        </Reveal>

        <div className="grid grid-2 mt">
          {[
            ['Subscribe', 'Choose the monthly plan, or the discounted yearly plan. Your subscription unlocks score entry and monthly draw entry. If it lapses or is cancelled, your access is restricted until you renew.'],
            ['Enter your scores', `Log your latest Stableford scores (1-${cfg?.scores?.max ?? 45}) with the date you played. One score per date, and we keep your latest ${cfg?.scores?.maxStored ?? 5}. A new score replaces the oldest automatically.`],
            ['Monthly draw', 'Once a month five numbers are drawn - either purely at random or weighted by how frequently scores appear on the platform. Admins simulate the draw first, then publish it.'],
            ['Match & win', 'Your saved scores are your numbers. Match 3, 4 or 5 of the drawn numbers to win. Prizes in each tier are split equally between everyone in that tier.'],
            ['Verify & get paid', 'Winners upload a screenshot of their scores as proof. An admin approves it, and the payout moves from Pending to Paid.'],
            ['Give back', 'You choose a charity when you join. At least 10% of your subscription goes to them - increase it any time, or make a separate one-off donation.'],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={(i % 2) * 90} className="card card-hover">
              <div className="icon-badge">{emojis[i % 5]}</div>
              <h3>{t}</h3>
              <p className="muted mb0">{d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="card mt">
          <h2>Prize pool breakdown</h2>
          <p className="muted">{cfg ? `${cfg.prizePool.poolPercentOfFee}% of each subscription fee funds the pool.` : ''} The pool is divided into tiers automatically:</p>
          {!tiers ? <Loading /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Match</th><th>Share of pool</th><th>If unclaimed</th></tr></thead>
                <tbody>
                  {[5, 4, 3].map((m) => (
                    <tr key={m}><td><strong>{m} numbers</strong></td><td>{tiers[m].share}%</td><td>{tiers[m].rollover ? 'Jackpot rolls over to next month' : 'Not carried forward'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Reveal>

        <div className="center mt"><Link to="/plans" className="btn btn-primary btn-lg">Choose a plan</Link></div>
      </div>
    </div>
  )
}
