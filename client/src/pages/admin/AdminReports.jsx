import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { Loading, ErrorState, Stat, Badge, EmptyState } from '../../components/ui'
import { money, monthLabel } from '../../utils/format'

function useReports() {
  return useFetch(() => api.get('/admin/reports'), [])
}

export function AdminOverview() {
  const { data: r, loading, error, reload } = useReports()
  if (loading && !r) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Admin</span><h1>Overview</h1></div></div>
      <div className="grid grid-4">
        <Stat label="Total users" value={r.totalUsers} sub={`${r.activeSubscribers} active subscribers`} />
        <Stat label="Prize pool paid out" value={money(r.prizePool.totalDistributedCents)} sub={`Jackpot carry: ${money(r.prizePool.jackpotCarryCents)}`} />
        <Stat label="Charity total" value={money(r.charity.totalCents)} sub={`${money(r.charity.donationCents)} independent donations`} />
        <Stat label="Proofs to review" value={r.winners.pendingReview} sub={`${r.winners.count} winners in total`} />
      </div>
      <div className="grid grid-2 mt">
        <div className="card"><h3>Quick actions</h3>
          <div className="btn-row">
            <Link className="btn" to="/admin/draws">Run a draw</Link>
            <Link className="btn btn-ghost" to="/admin/winners">Review winners</Link>
            <Link className="btn btn-ghost" to="/admin/users">Manage users</Link>
            <Link className="btn btn-ghost" to="/admin/charities">Manage charities</Link>
          </div>
        </div>
        <div className="card"><h3>Recent draws</h3>
          {r.draws.recent.length === 0 ? <EmptyState title="No draws yet" /> : r.draws.recent.slice(0, 4).map((d) => (
            <div key={d.id} className="row-between" style={{ marginBottom: 8 }}><span>{monthLabel(d.month)}</span><Badge value={d.status} /></div>
          ))}
        </div>
      </div>
    </>
  )
}

function Bars({ rows, fmt = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="bar-chart">
      {rows.map((r) => (
        <div key={r.label} className="bar-row">
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="meter"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <strong>{fmt(r.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function AdminReports() {
  const { data: r, loading, error, reload } = useReports()
  if (loading && !r) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Reports</span><h1>Reports & analytics</h1></div></div>
      <div className="grid grid-4">
        <Stat label="Total users" value={r.totalUsers} sub={`${r.activeSubscribers} active`} />
        <Stat label="Prize pool generated" value={money(r.prizePool.totalGeneratedCents)} sub="Across published draws" />
        <Stat label="Prizes awarded" value={money(r.winners.prizeCents)} sub={`${money(r.winners.paidCents)} paid`} />
        <Stat label="Charity contributions" value={money(r.charity.totalCents)} sub={`${money(r.charity.subscriptionCents)} subs + ${money(r.charity.donationCents)} donations`} />
      </div>
      <div className="grid grid-2 mt">
        <div className="card"><h3>Subscriptions by status</h3>
          <Bars rows={Object.entries(r.subscriptionsByStatus).map(([label, value]) => ({ label, value }))} />
        </div>
        <div className="card"><h3>Contributions by charity</h3>
          {r.charity.byCharity.length === 0 ? <EmptyState title="No contributions yet" /> : <Bars rows={r.charity.byCharity.map((c) => ({ label: c.name, value: c.totalCents }))} fmt={money} />}
        </div>
      </div>
      <h3 className="mt">Draw statistics</h3>
      <p className="muted small">{r.draws.published} published of {r.draws.total} draws · Jackpot currently carried forward: {money(r.prizePool.jackpotCarryCents)}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Month</th><th>Status</th><th>Mode</th><th>Participants</th><th>Pool</th><th>Winners</th><th>Rollover out</th></tr></thead>
          <tbody>
            {r.draws.recent.map((d) => (
              <tr key={d.id}><td>{monthLabel(d.month)}</td><td><Badge value={d.status} /></td><td>{d.mode}</td><td>{d.participants}</td><td>{money(d.poolCents)}</td><td>{d.winners}</td><td>{money(d.rolloverOutCents)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
