import { useState } from 'react'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loading, ErrorState, EmptyState, Badge, Modal, Alert, CharityImage } from '../../components/ui'
import { dateFmt } from '../../utils/format'

const blank = { name: '', category: 'General', shortDescription: '', description: '', imageUrl: '', website: '', featured: false, active: true, events: [] }

export default function AdminCharities() {
  const toast = useToast()
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/charities'), [])
  const [editing, setEditing] = useState(null)

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return
    try {
      const r = await api.del(`/admin/charities/${c._id}`)
      toast(r.message || 'Charity deleted')
      reload(true)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <div className="panel-head">
        <div><span className="eyebrow">Charities</span><h1>Charity management</h1></div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...blank })}>+ Add charity</button>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? <EmptyState emoji="💜" title="No charities" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th /><th>Name</th><th>Category</th><th>Events</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c._id}>
                  <td style={{ width: 70 }}><div className="charity-img" style={{ width: 56, borderRadius: 10 }}><CharityImage src={c.imageUrl} alt="" /></div></td>
                  <td><strong>{c.name}</strong>{c.featured && <> <Badge value="featured" tone="amber" /></>}<div className="muted small">{c.shortDescription}</div></td>
                  <td>{c.category}</td><td>{c.events?.length || 0}</td>
                  <td><Badge value={c.active ? 'active' : 'inactive'} /></td>
                  <td><div className="actions"><button className="btn btn-sm" onClick={() => setEditing({ ...blank, ...c, events: (c.events || []).map((e) => ({ ...e, date: e.date?.slice(0, 10) })) })}>Edit</button><button className="btn btn-ghost btn-sm" onClick={() => remove(c)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CharityForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(true) }} />}
    </>
  )
}

function CharityForm({ initial, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(initial)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setEvent = (i, k, v) => setF({ ...f, events: f.events.map((ev, j) => (j === i ? { ...ev, [k]: v } : ev)) })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const body = { name: f.name, category: f.category, shortDescription: f.shortDescription, description: f.description, imageUrl: f.imageUrl, website: f.website, featured: f.featured, active: f.active, events: f.events.map(({ title, date, location, description }) => ({ title, date, location, description })) }
    try {
      if (f._id) await api.put(`/admin/charities/${f._id}`, body)
      else await api.post('/admin/charities', body)
      toast(f._id ? 'Charity updated' : 'Charity created')
      onSaved()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={f._id ? 'Edit charity' : 'Add charity'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="cn">Name</label><input id="cn" required value={f.name} onChange={set('name')} /></div>
          <div className="field"><label htmlFor="cc">Category</label><input id="cc" value={f.category} onChange={set('category')} /></div>
        </div>
        <div className="field"><label htmlFor="cs">Short description</label><input id="cs" maxLength={240} value={f.shortDescription} onChange={set('shortDescription')} /></div>
        <div className="field"><label htmlFor="cd">Full description</label><textarea id="cd" value={f.description} onChange={set('description')} /></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="ci">Image URL</label><input id="ci" type="url" value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://..." /></div>
          <div className="field"><label htmlFor="cw">Website</label><input id="cw" type="url" value={f.website} onChange={set('website')} placeholder="https://..." /></div>
        </div>
        <div className="btn-row" style={{ marginBottom: 16 }}>
          <label className="check"><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Featured on homepage</label>
          <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Visible in directory</label>
        </div>
        <div className="row-between"><h3 className="mb0">Upcoming events</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, events: [...f.events, { title: '', date: '', location: '', description: '' }] })}>+ Add event</button></div>
        {f.events.map((ev, i) => (
          <div key={i} className="card mt" style={{ padding: '1rem' }}>
            <div className="form-grid">
              <div className="field"><label>Title</label><input required value={ev.title} onChange={(e) => setEvent(i, 'title', e.target.value)} /></div>
              <div className="field"><label>Date</label><input required type="date" value={(ev.date || '').slice(0, 10)} onChange={(e) => setEvent(i, 'date', e.target.value)} /></div>
              <div className="field"><label>Location</label><input value={ev.location || ''} onChange={(e) => setEvent(i, 'location', e.target.value)} /></div>
            </div>
            <div className="field"><label>Description</label><input value={ev.description || ''} onChange={(e) => setEvent(i, 'description', e.target.value)} /></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, events: f.events.filter((_, j) => j !== i) })}>Remove event {ev.date ? `(${dateFmt(ev.date)})` : ''}</button>
          </div>
        ))}
        <div className="mt"><Alert>{msg}</Alert><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save charity'}</button></div>
      </form>
    </Modal>
  )
}
