import { useState } from 'react'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { ProofViewer } from '../user/UserPages'
import { Loading, ErrorState, EmptyState, Badge, Modal, Alert } from '../../components/ui'
import { money, dateFmt } from '../../utils/format'

export default function AdminWinners() {
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const { data, loading, error, reload } = useFetch(() => api.get('/admin/winners', { status, payment }), [status, payment])
  const [proof, setProof] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const act = async (fn, ok) => {
    try {
      await fn()
      toast(ok)
      reload(true)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <div className="panel-head"><div><span className="eyebrow">Winners</span><h1>Winner verification & payouts</h1></div></div>
      <div className="search-row">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Verification status">
          <option value="">All verification states</option><option value="awaiting_proof">Awaiting proof</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment status">
          <option value="">All payment states</option><option value="pending">Payment pending</option><option value="paid">Paid</option>
        </select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? <EmptyState emoji="🏆" title="No winners match" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Winner</th><th>Draw</th><th>Match</th><th>Prize</th><th>Verification</th><th>Payment</th><th>Actions</th></tr></thead>
            <tbody>
              {data.items.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.user?.name}</strong><div className="muted small">{w.user?.email}</div></td>
                  <td>{w.draw?.title}</td><td>{w.matchType}</td><td><strong>{money(w.prizeCents)}</strong></td>
                  <td><Badge value={w.verificationStatus} />{w.adminNote && <div className="muted small">{w.adminNote}</div>}</td>
                  <td><Badge value={w.paymentStatus} />{w.paidAt && <div className="muted small">{dateFmt(w.paidAt)}</div>}</td>
                  <td>
                    <div className="actions">
                      {w.hasProof && <button className="btn btn-ghost btn-sm" onClick={() => setProof(w)}>View proof</button>}
                      {w.verificationStatus === 'pending' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => act(() => api.put(`/admin/winners/${w.id}/verify`, { action: 'approve' }), 'Winner approved')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setRejecting(w)}>Reject</button>
                        </>
                      )}
                      {w.verificationStatus === 'approved' && w.paymentStatus === 'pending' && (
                        <button className="btn btn-sm" onClick={() => act(() => api.put(`/admin/winners/${w.id}/payout`), 'Marked as paid')}>Mark paid</button>
                      )}
                      {w.verificationStatus === 'awaiting_proof' && <span className="muted small">Waiting for user</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {proof && <ProofViewer winnerId={proof.id} onClose={() => setProof(null)} />}
      {rejecting && <RejectModal winner={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); toast('Proof rejected'); reload(true) }} />}
    </>
  )
}

function RejectModal({ winner, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/admin/winners/${winner.id}/verify`, { action: 'reject', note })
      onDone()
    } catch (e2) {
      setErr(e2.message)
    }
  }
  return (
    <Modal title={`Reject proof - ${winner.user?.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="rn">Reason (shown to the winner)</label><textarea id="rn" required value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <Alert>{err}</Alert>
        <button className="btn btn-danger">Reject submission</button>
      </form>
    </Modal>
  )
}
