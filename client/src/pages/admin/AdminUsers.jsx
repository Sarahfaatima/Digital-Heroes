import { useEffect, useState } from 'react'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import ScoreManager from '../../components/ScoreManager'
import { Loading, ErrorState, EmptyState, Badge, Modal, Alert } from '../../components/ui'
import { dateFmt, money, planLabel } from '../../utils/format'

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editId, setEditId] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1) }, 250)
    return () => clearTimeout(t)
  }, [search])
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/users', { search: q, status, page }), [q, status, page])

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Users</span><h1>User management</h1></div></div>
      <div className="search-row">
        <input type="search" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by subscription">
          <option value="">All subscriptions</option>
          <option value="active">Active</option><option value="cancelled">Cancelled</option><option value="lapsed">Lapsed</option><option value="inactive">Inactive / none</option>
        </select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? <EmptyState emoji="👥" title="No users match" /> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Subscription</th><th>Renews</th><th>Charity</th><th /></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <td><strong>{u.name}</strong>{u.isBlocked && <> <Badge value="blocked" /></>}</td>
                    <td>{u.email}</td><td><Badge value={u.role} tone={u.role === 'admin' ? 'blue' : 'gray'} /></td>
                    <td><Badge value={u.subscription.isActive ? 'active' : u.subscription.status} /> <span className="muted small">{planLabel(u.subscription.plan) !== '-' ? planLabel(u.subscription.plan) : ''}</span></td>
                    <td>{u.subscription.isActive ? dateFmt(u.subscription.renewalDate) : '-'}</td>
                    <td>{u.charity?.name || '-'} <span className="muted small">{u.charityPercent}%</span></td>
                    <td><button className="btn btn-sm" onClick={() => setEditId(u._id)}>View / edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row-between mt">
            <span className="muted small">{data.total} users · page {data.page} of {data.pages}</span>
            <div className="btn-row"><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button><button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next →</button></div>
          </div>
        </>
      )}
      {editId && <UserEditor id={editId} onClose={() => setEditId(null)} onSaved={() => reload(true)} />}
    </>
  )
}

function UserEditor({ id, onClose, onSaved }) {
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/users/${id}`), [id])
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [subForm, setSubForm] = useState({ status: '', plan: '', extendMonths: '' })

  const put = async (body, ok) => {
    setBusy(true)
    setMsg('')
    try {
      await api.put(`/admin/users/${id}`, body)
      toast(ok)
      setForm(null)
      await reload(true)
      onSaved()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="User details" onClose={onClose} wide>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (() => {
        const { user, scores, subscription, winnings } = data
        const f = form || { name: user.name, phone: user.phone || '', country: user.country || '', role: user.role, isBlocked: user.isBlocked, charityPercent: user.charityPercent }
        const set = (k, v) => setForm({ ...f, [k]: v })
        return (
          <>
            <Alert>{msg}</Alert>
            <h3>Profile</h3>
            <p className="muted small">{user.email} · joined {dateFmt(user.createdAt)} · charity: {user.charity?.name || 'none'}</p>
            <div className="form-grid">
              <div className="field"><label>Name</label><input value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div className="field"><label>Phone</label><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="field"><label>Country</label><input value={f.country} onChange={(e) => set('country', e.target.value)} /></div>
              <div className="field"><label>Role</label><select value={f.role} onChange={(e) => set('role', e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></div>
              <div className="field"><label>Charity %</label><input type="number" min="10" max="100" value={f.charityPercent} onChange={(e) => set('charityPercent', Number(e.target.value))} /></div>
            </div>
            <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={f.isBlocked} onChange={(e) => set('isBlocked', e.target.checked)} /> Block this account</label>
            <button className="btn" disabled={busy || !form} onClick={() => put(form, 'User updated')}>Save profile</button>

            <h3 className="mt">Subscription</h3>
            <dl className="kv">
              <dt>Status</dt><dd><Badge value={subscription.isActive ? 'active' : subscription.status} /></dd>
              <dt>Plan</dt><dd>{planLabel(subscription.plan)}</dd>
              <dt>Renewal / end</dt><dd>{dateFmt(subscription.currentPeriodEnd)}</dd>
              <dt>Last payment</dt><dd>{subscription.lastPaymentStatus || '-'}</dd>
            </dl>
            <div className="form-grid mt">
              <div className="field"><label>Set status</label><select value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}><option value="">(no change)</option><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="lapsed">Lapsed</option><option value="inactive">Inactive</option></select></div>
              <div className="field"><label>Plan</label><select value={subForm.plan} onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })}><option value="">(no change)</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
              <div className="field"><label>Extend by (months)</label><input type="number" min="1" max="24" value={subForm.extendMonths} onChange={(e) => setSubForm({ ...subForm, extendMonths: e.target.value })} /></div>
            </div>
            <button className="btn" disabled={busy || (!subForm.status && !subForm.plan && !subForm.extendMonths)} onClick={() => put({ subscription: Object.fromEntries(Object.entries(subForm).filter(([, v]) => v !== '')) }, 'Subscription updated').then(() => setSubForm({ status: '', plan: '', extendMonths: '' }))}>Apply subscription change</button>

            <h3 className="mt">Golf scores</h3>
            <ScoreManager
              scores={scores}
              onChanged={async () => { await reload(true); onSaved() }}
              actions={{
                create: (p) => api.post(`/admin/users/${id}/scores`, p),
                update: (sid, p) => api.put(`/admin/users/${id}/scores/${sid}`, p),
                remove: (sid) => api.del(`/admin/users/${id}/scores/${sid}`),
              }}
            />

            <h3 className="mt">Winnings</h3>
            {winnings.length === 0 ? <p className="muted">No winnings.</p> : winnings.map((w) => (
              <div key={w._id} className="row-between small" style={{ marginBottom: 6 }}><span>{w.draw?.title} · {w.matchType} numbers · {money(w.prizeCents)}</span><span><Badge value={w.verificationStatus} /> <Badge value={w.paymentStatus} /></span></div>
            ))}
          </>
        )
      })()}
    </Modal>
  )
}
