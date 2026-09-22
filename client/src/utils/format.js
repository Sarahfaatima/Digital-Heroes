export const money = (cents = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)

export const dateFmt = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts }) : '-'

export const monthLabel = (m) =>
  m ? new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

export const todayStr = () => new Date().toISOString().slice(0, 10)

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

export const planLabel = (p) => (p === 'yearly' ? 'Yearly' : p === 'monthly' ? 'Monthly' : '-')
