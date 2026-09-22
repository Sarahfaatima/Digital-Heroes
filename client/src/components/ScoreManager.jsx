import { useState } from 'react'
import { Alert, EmptyState } from './ui'
import { useToast } from '../context/ToastContext'
import { dateFmt, todayStr } from '../utils/format'

/**
 * Score entry + list. Used by the user "My scores" page and by the admin user editor.
 * `actions` = { create(payload), update(id, payload), remove(id) } each returning a promise.
 * All rules are enforced by the API; this only surfaces its errors.
 */
export default function ScoreManager({ scores, actions, onChanged, disabled }) {
  const toast = useToast()
  const [form, setForm] = useState({ value: '', date: todayStr() })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn, okMsg) => {
    setBusy(true)
    setError('')
    try {
      const r = await fn()
      if (okMsg) toast(r?.removedIds?.length ? `${okMsg} Oldest score was rolled off.` : okMsg)
      await onChanged()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (e) => {
    e.preventDefault()
    const ok = await run(() => actions.create({ value: form.value === '' ? null : Number(form.value), date: form.date }), 'Score added.')
    if (ok) setForm({ value: '', date: todayStr() })
  }
  const save = async (e) => {
    e.preventDefault()
    const ok = await run(() => actions.update(editing.id, { value: Number(editing.value), date: editing.date }), 'Score updated.')
    if (ok) setEditing(null)
  }
  const del = (s) => window.confirm(`Delete the score of ${s.value} on ${dateFmt(s.date)}?`) && run(() => actions.remove(s.id), 'Score deleted.')

  return (
    <div>
      <form className="card" onSubmit={add}>
        <h3>Add a score</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="sv">Stableford score (1-45)</label><input id="sv" type="number" min="1" max="45" step="1" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} disabled={disabled} /></div>
          <div className="field"><label htmlFor="sd">Date played</label><input id="sd" type="date" max={todayStr()} required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={disabled} /></div>
        </div>
        <span className="hint">One score per date. Only your latest 5 are kept - adding a 6th removes the oldest.</span>
        <div style={{ marginTop: 12 }}>
          <Alert>{!editing && error}</Alert>
          <button className="btn btn-primary" disabled={busy || disabled}>{busy ? 'Saving...' : 'Add score'}</button>
        </div>
      </form>

      <h3 className="mt">Latest scores <span className="muted small">({scores.length}/5, newest first)</span></h3>
      <div className="meter" style={{ marginBottom: 14 }}><span style={{ width: `${(scores.length / 5) * 100}%` }} /></div>
      {scores.length === 0 ? (
        <EmptyState emoji="⛳" title="No scores yet">Add your first Stableford score above to enter the next draw.</EmptyState>
      ) : (
        scores.map((s) =>
          editing?.id === s.id ? (
            <form key={s.id} className="score-row" onSubmit={save} style={{ flexWrap: 'wrap' }}>
              <input aria-label="Score" type="number" min="1" max="45" required style={{ width: 90 }} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
              <input aria-label="Date" type="date" max={todayStr()} required style={{ width: 170 }} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              <div className="actions">
                <button className="btn btn-sm" disabled={busy}>Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setError('') }}>Cancel</button>
              </div>
              {error && <div style={{ flexBasis: '100%' }}><Alert>{error}</Alert></div>}
            </form>
          ) : (
            <div key={s.id} className="score-row">
              <div className="score-val">{s.value}</div>
              <div className="grow"><strong>{dateFmt(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
              <div className="actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing({ id: s.id, value: s.value, date: s.date }); setError('') }} disabled={disabled}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => del(s)} disabled={disabled}>Delete</button>
              </div>
            </div>
          )
        )
      )}
    </div>
  )
}
