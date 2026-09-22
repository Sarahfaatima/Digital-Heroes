import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { api } from '../../services/api'
import { Reveal, Balls, CharityImage } from '../../components/ui'
import CharityCard from '../../components/CharityCard'
import { money } from '../../utils/format'

const STEPS = [
  ['1', 'Subscribe & choose a cause', 'Pick monthly or yearly, then choose the charity that receives at least 10% of every payment.'],
  ['2', 'Log your last 5 rounds', 'Add Stableford scores (1-45). We keep your five most recent - simple, honest and always current.'],
  ['3', 'Enter the monthly draw', 'Your five scores become your five numbers. Match 3, 4 or 5 of the drawn numbers to win a share of the prize pool.'],
  ['4', 'Celebrate the impact', 'Whether you win or not, your subscription is already helping the cause you picked.'],
]

export default function Home() {
  const { data } = useFetch(() => api.get('/charities', { featured: 'true' }), [])
  const { data: all } = useFetch(() => api.get('/charities'), [])
  const { data: draws } = useFetch(() => api.get('/draws'), [])
  const featured = data?.items?.[0]
  const latest = draws?.published?.[0]

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="pill">💜 Every subscription funds a cause</span>
            <h1 style={{ marginTop: '1.2rem' }}>Play your round. <span className="grad-text">Change a life.</span></h1>
            <p className="lead">Subscribe, log your latest golf scores and enter monthly prize draws - while a share of every payment goes to the charity you believe in.</p>
            <div className="btn-row" style={{ marginTop: '1.8rem' }}>
              <Link to="/plans" className="btn btn-primary btn-lg">Subscribe now →</Link>
              <Link to="/how-it-works" className="btn btn-light btn-lg">How it works</Link>
            </div>
          </div>
          <div className="hero-card">
            <span className="pill">{latest ? `Latest draw · ${latest.title}` : 'Monthly draw'}</span>
            <div className="big" style={{ margin: '0.8rem 0' }}>{latest ? money(latest.poolCents + latest.rolloverInCents) : '$--'}</div>
            <p style={{ color: 'rgba(255,255,255,.7)', marginBottom: 14 }}>prize pool shared between 3, 4 and 5-number matches</p>
            {latest ? <Balls numbers={latest.numbers} /> : <Balls numbers={[7, 14, 21, 28, 35]} />}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="center">
            <span className="eyebrow">What you do</span>
            <h2>Four simple steps</h2>
            <p className="lead">No golf expertise in the app - just your scores, a draw, and a cause.</p>
          </Reveal>
          <div className="grid grid-4 mt">
            {STEPS.map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 90} className="card step card-hover">
                <div className="step-num">{n}</div>
                <h3>{t}</h3>
                <p className="muted mb0">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section band">
        <div className="container grid grid-2" style={{ alignItems: 'center', gap: '3rem' }}>
          <Reveal>
            <span className="eyebrow">How you win</span>
            <h2>Your scores are your numbers</h2>
            <p className="lead">Each month five numbers between 1 and 45 are drawn. The more of your latest five scores match, the bigger your prize.</p>
            <Link to="/how-it-works" className="btn">See the full breakdown</Link>
          </Reveal>
          <Reveal delay={120} className="card">
            {[['5 numbers', 40, 'Jackpot - rolls over if unclaimed'], ['4 numbers', 35, 'Split equally between winners'], ['3 numbers', 25, 'Split equally between winners']].map(([l, p, s]) => (
              <div key={l} style={{ marginBottom: '1.1rem' }}>
                <div className="row-between"><strong>{l}</strong><strong className="grad-text">{p}% of pool</strong></div>
                <div className="meter" style={{ margin: '6px 0' }}><span style={{ width: `${p * 2}%` }} /></div>
                <span className="muted small">{s}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="center">
            <span className="eyebrow">Charity first</span>
            <h2>The heart of Digital Heroes</h2>
            <p className="lead">You choose where your contribution goes. Give the 10% minimum, or dial it up - it is your call.</p>
          </Reveal>
          {featured && (
            <Reveal className="card mt" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="grid grid-2" style={{ gap: 0 }}>
                <div className="charity-img" style={{ aspectRatio: 'auto', minHeight: 260 }}><CharityImage src={featured.imageUrl} alt={featured.name} /></div>
                <div style={{ padding: 'clamp(1.5rem, 4vw, 2.6rem)' }}>
                  <span className="tag tag-feat">★ Featured charity</span>
                  <h2 style={{ margin: '0.8rem 0 0.5rem' }}>{featured.name}</h2>
                  <p className="lead">{featured.shortDescription}</p>
                  <Link to={`/charities/${featured._id}`} className="btn btn-primary">Learn more</Link>
                </div>
              </div>
            </Reveal>
          )}
          {all?.items?.length > 0 && (
            <div className="grid grid-3 mt">
              {all.items.filter((c) => c._id !== featured?._id).slice(0, 3).map((c, i) => (
                <Reveal key={c._id} delay={i * 90}><CharityCard charity={c} /></Reveal>
              ))}
            </div>
          )}
          <div className="center mt"><Link to="/charities" className="btn btn-ghost">Browse all charities</Link></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal className="cta-band">
            <h2>Ready to be a hero?</h2>
            <p style={{ opacity: 0.9, maxWidth: 520, margin: '0 auto 1.6rem' }}>Join today. Your first round could fund a well, a scholarship - and win you a prize.</p>
            <Link to="/plans" className="btn btn-light btn-lg">Subscribe & start giving →</Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
