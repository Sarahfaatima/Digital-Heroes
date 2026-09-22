import { useState } from 'react'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loading, ErrorState, Badge, Alert, Balls } from '../../components/ui'
import { money, monthLabel, dateFmt } from '../../utils/format'

function TierTable({ tiers }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Match</th><th>Share</th><th>Tier pool</th><th>Winners</th><th>Prize each</th></tr></thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.match}><td><strong>{t.match} numbers</strong></td><td>{t.sharePercent}%</td><td>{money(t.poolCents)}</td><td>{t.winnerCount}</td><td>{t.winnerCount ? money(t.prizeEachCents) : t.match === 5 ? 'Rolls over' : '-'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminDraws() {
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/draws'), [])
  const [mode, setMode] = useState('random')
  const [sim, setSim] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const upcoming = data.items.filter((d) => d.status !== 'published').sort((a, b) => a.month.localeCompare(b.month))[0]
  const history = data.items.filter((d) => d.status === 'published')
  const current = sim?.draw || (upcoming?.status === 'simulated' ? upcoming : null)

  const simulate = async () => {
    setBusy('sim')
    setMsg('')
    try {
      const r = await api.post('/admin/draws/simulate', { month: upcoming?.month, mode })
      setSim(r)
      toast('Simulation complete - nothing has been published yet')
      reload(true)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy('')
    }
  }
  const publish = async () => {
    if (!window.confirm(`Publish the ${monthLabel(current.month)} draw? This creates winners and cannot be undone.`)) return
    setBusy('pub')
    setMsg('')
    try {
      const r = await api.post('/admin/draws/publish', { drawId: current.id })
      toast(`Draw published - ${r.winners.length} winner(s)`)
      setSim(null)
      reload(true)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Draws</span><h1>Draw management</h1></div></div>
      <Alert>{msg}</Alert>
      {!upcoming ? <div className="card">No unpublished draw exists.</div> : (
        <div className="card">
          <div className="row-between"><h3 className="mb0">Configure · {monthLabel(upcoming.month)}</h3><Badge value={upcoming.status} /></div>
          {upcoming.rolloverInCents > 0 && <div className="alert alert-success" style={{ marginTop: 12 }}>Jackpot rollover of {money(upcoming.rolloverInCents)} will be added to the 5-match tier.</div>}
          <div className="form-grid mt">
            <div className="field">
              <label htmlFor="mode">Draw mode</label>
              <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="random">Random - standard lottery style</option>
                <option value="algorithmic">Algorithmic - weighted by score frequency</option>
              </select>
              <span className="hint">Simulation never notifies users or creates winners. You can re-run it as often as you like.</span>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={simulate} disabled={!!busy}>{busy === 'sim' ? 'Simulating...' : current ? '↻ Re-run simulation' : '▶ Run simulation'}</button>
            <button className="btn btn-primary" onClick={publish} disabled={!current || !!busy}>{busy === 'pub' ? 'Publishing...' : 'Publish results'}</button>
          </div>
        </div>
      )}

      {current && (
        <div className="card mt">
          <div className="row-between"><h3 className="mb0">Simulation result</h3><span className="muted small">{current.mode} · {dateFmt(current.simulatedAt)}</span></div>
          <div style={{ margin: '1rem 0' }}><Balls numbers={current.numbers} /></div>
          <dl className="kv" style={{ marginBottom: 16 }}>
            <dt>Active subscribers</dt><dd>{current.activeSubscribers}</dd>
            <dt>Participants</dt><dd>{current.participants}</dd>
            <dt>New pool</dt><dd>{money(current.poolCents)}</dd>
            <dt>Rollover in</dt><dd>{money(current.rolloverInCents)}</dd>
            <dt>Total prize pool</dt><dd>{money(current.poolCents + current.rolloverInCents)}</dd>
          </dl>
          <TierTable tiers={current.tiers} />
          {sim && (
            <>
              <h4 className="mt">Would-be winners ({sim.winners.length})</h4>
              {sim.winners.length === 0 ? <p className="muted small">No participant matches 3 or more numbers - the 5-match jackpot would roll over.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Scores</th><th>Match</th><th>Prize</th></tr></thead>
                    <tbody>{sim.winners.map((w) => <tr key={w.userId}><td>{w.name}</td><td>{w.email}</td><td>{w.scores.join(', ')}</td><td>{w.matchType}</td><td><strong>{money(w.prizeCents)}</strong></td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <p className="muted small mt mb0">Publishing re-checks against current scores using these exact numbers.</p>
            </>
          )}
        </div>
      )}

      <h3 className="mt">Published draws</h3>
      {history.length === 0 ? <p className="muted">Nothing published yet.</p> : history.map((d) => (
        <div key={d.id} className="card" style={{ marginBottom: '1rem' }}>
          <div className="row-between"><h3 className="mb0">{monthLabel(d.month)}</h3><span className="muted small">{d.mode} · published {dateFmt(d.publishedAt)} · {d.participants} entries</span></div>
          <div style={{ margin: '0.8rem 0' }}><Balls small numbers={d.numbers} /></div>
          <TierTable tiers={d.tiers} />
          {d.rolloverOutCents > 0 && <p className="small muted mt mb0">💰 {money(d.rolloverOutCents)} jackpot carried into the next draw.</p>}
        </div>
      ))}
    </>
  )
}
