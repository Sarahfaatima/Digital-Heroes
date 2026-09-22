import { useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Alert, Modal } from './ui'
import { money, dateFmt } from '../utils/format'

/** DEMO payment step. Swap the API call for Stripe Checkout later - the surrounding flow stays the same. */
export default function CheckoutModal({ plan, planDef, onClose, onDone }) {
  const { refresh } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fail, setFail] = useState(false)

  const pay = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const d = await api.post('/subscription', { plan, simulateFailure: fail })
      await refresh()
      toast(`Subscription active until ${dateFmt(d.subscription.renewalDate)}`)
      onDone?.(d.subscription)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Subscribe - ${planDef.label}`} onClose={onClose}>
      <Alert type="info">Demo checkout: no real card is charged. Use the sample card below.</Alert>
      <form onSubmit={pay}>
        <div className="field">
          <label htmlFor="cn">Card number</label>
          <input id="cn" defaultValue="4242 4242 4242 4242" inputMode="numeric" readOnly />
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="ce">Expiry</label><input id="ce" defaultValue="12 / 30" readOnly /></div>
          <div className="field"><label htmlFor="cc">CVC</label><input id="cc" defaultValue="123" readOnly /></div>
        </div>
        <label className="check small" style={{ marginBottom: '1rem' }}>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Simulate a declined card (for testing)
        </label>
        <Alert>{error}</Alert>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Processing...' : `Pay ${money(planDef.priceCents)} ${plan === 'yearly' ? '/ year' : '/ month'}`}
        </button>
      </form>
    </Modal>
  )
}
