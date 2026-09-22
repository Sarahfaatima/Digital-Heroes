import { useEffect, useState } from 'react'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import CharityCard from '../../components/CharityCard'
import { Loading, ErrorState, EmptyState, Reveal } from '../../components/ui'

export default function Charities() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, loading, error, reload } = useFetch(() => api.get('/charities', { search: q, category }), [q, category])

  return (
    <div className="section">
      <div className="container">
        <Reveal>
          <span className="eyebrow">Charity directory</span>
          <h1>Causes worth playing for</h1>
          <p className="lead">Search and filter the charities on Digital Heroes. Pick one when you subscribe.</p>
        </Reveal>
        <div className="search-row mt">
          <input type="search" placeholder="Search charities..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search charities" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {(data?.categories || []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? (
          <EmptyState emoji="🔍" title="No charities found">Try a different search or category.</EmptyState>
        ) : (
          <div className="grid grid-3">
            {data.items.map((c) => <CharityCard key={c._id} charity={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
