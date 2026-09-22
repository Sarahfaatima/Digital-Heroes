import { Link } from 'react-router-dom'
import { CharityImage } from './ui'

export default function CharityCard({ charity: c }) {
  return (
    <Link to={`/charities/${c._id}`} className="card card-hover charity-card">
      <div className="charity-img">
        <CharityImage src={c.imageUrl} alt={c.name} />
      </div>
      <div className="charity-body">
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <span className="tag">{c.category}</span>
          {c.featured && <span className="tag tag-feat">★ Featured</span>}
        </div>
        <h3 style={{ marginBottom: 6 }}>{c.name}</h3>
        <p className="muted small mb0">{c.shortDescription}</p>
      </div>
    </Link>
  )
}
