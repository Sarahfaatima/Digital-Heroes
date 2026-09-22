import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <h4>Digital Heroes</h4>
          <p className="small" style={{ maxWidth: 360 }}>Every round you log can win a monthly prize - and every subscription funds a cause you choose.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <p className="small"><Link to="/how-it-works">How it works</Link><br /><Link to="/charities">Charities</Link><br /><Link to="/plans">Plans</Link></p>
        </div>
        <div>
          <h4>Account</h4>
          <p className="small"><Link to="/login">Log in</Link><br /><Link to="/register">Create account</Link></p>
        </div>
      </div>
      <div className="container small" style={{ marginTop: '2rem', opacity: 0.6 }}>Demo build - payments are simulated and no real money moves.</div>
    </footer>
  )
}
