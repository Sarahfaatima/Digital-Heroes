import { useEffect, useRef, useState } from 'react'

export const Loading = ({ label = 'Loading...' }) => (
  <div className="state" role="status">
    <div className="spinner" />
    {label}
  </div>
)

export const ErrorState = ({ error, onRetry }) => (
  <div className="state">
    <span className="emoji">⚠️</span>
    <p>{error?.message || 'Something went wrong.'}</p>
    {onRetry && (
      <button className="btn btn-ghost btn-sm" onClick={() => onRetry()}>
        Try again
      </button>
    )}
  </div>
)

export const EmptyState = ({ emoji = '🌱', title, children, action }) => (
  <div className="state">
    <span className="emoji">{emoji}</span>
    <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>{title}</strong>
    {children && <p>{children}</p>}
    {action}
  </div>
)

export const Alert = ({ type = 'error', children }) =>
  children ? <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div> : null

const BADGE = {
  active: 'green', approved: 'green', paid: 'green', published: 'green', succeeded: 'green',
  pending: 'amber', simulated: 'blue', draft: 'blue', awaiting_proof: 'amber',
  cancelled: 'red', lapsed: 'red', rejected: 'red', inactive: 'red', blocked: 'red', failed: 'red',
}
export const Badge = ({ value, tone }) => (
  <span className={`badge badge-${tone || BADGE[value] || 'gray'}`}>{String(value ?? '').replace(/_/g, ' ')}</span>
)

/** Fades content in when it scrolls into view. */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', ...rest }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setSeen(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <h3 className="mb0">{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Balls = ({ numbers = [], hits = [], small }) => (
  <div className="balls">
    {numbers.map((n, i) => (
      <span key={n} className={`ball ${small ? 'sm' : ''} ${hits.includes(n) ? 'hit' : ''}`} style={{ animationDelay: `${i * 80}ms` }}>
        {n}
      </span>
    ))}
  </div>
)

export const Stat = ({ label, value, sub }) => (
  <div className="card stat">
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    {sub && <div className="sub">{sub}</div>}
  </div>
)

export const CharityImage = ({ src, alt }) => {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: '2.5rem' }}>💜</div>
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
}
