# Digital Heroes

## Overview
Digital Heroes is a subscription platform that combines Stableford golf-score tracking, monthly prize draws and charity giving. Visitors browse charities and how it works; subscribers log their latest 5 scores, enter monthly draws, choose a charity and claim winnings; administrators manage users, draws, charities, winner verification and reports. Built from `Digital Heroes PRD (Level 1).pdf`.

## Features
- **Public:** landing page (what you do, how you win, charity impact, subscribe CTA, featured charity), How It Works, charity directory with search + category filter, charity detail (events, donation), plans, register, login.
- **Subscriber:** dashboard (subscription status, renewal date, scores, charity %, draws entered, upcoming draws, winnings, payment status), score CRUD, charity selection + contribution %, independent donation, draws & results, winnings + proof upload, profile/password.
- **Admin:** users (search, edit profile/role/block, subscription override, edit scores), draws (configure mode, simulate, inspect, publish), charities CRUD (events, featured), winners (view proof, approve/reject, mark paid), reports.
- **Business logic (server-side):** 5-score rolling window, one score per date, subscription lifecycle with real-time lapse check on every authenticated request, prize pool tiers, equal split, jackpot rollover, random and frequency-weighted draws.

## Tech Stack
React 19 + Vite + React Router (JavaScript, plain CSS) · Node.js + Express · MongoDB + Mongoose · JWT + bcrypt · Multer (proof upload). No UI/state libraries.

## Architecture
```
server/src
  config/        businessRules.js (ALL business numbers), env config, db
  models/        Mongoose schemas
  services/      business logic (auth, score, subscription, paymentProvider, draw, winner, charity, user, admin)
  controllers/   thin request/response adapters
  routes/        REST routes (+ /api/admin guarded by requireAdmin)
  middleware/    authenticate (JWT + fresh DB user + subscription check), requireAdmin, error handler
  utils/         drawEngine.js (pure draw/prize maths), helpers, AppError
  seed/          seed.js, devMemory.js (in-memory MongoDB dev runner)
server/tests     API end-to-end tests
client/src       components, pages (public/user/admin), layouts, context, hooks, services (api.js), utils, styles
```
Role is always read from the database, never from the client or token. Payment logic is isolated in `services/paymentProvider.js`.

## Database Models
`User`, `Subscription` (1 per user, with payment history), `Score` (unique index user+date), `Charity` (with events), `Draw` (1 per month, numbers, tiers, rollover), `DrawEntry` (participation snapshot), `Winner` (verification + payment status), `WinnerProof` (image stored in MongoDB), `Contribution` (subscription share or independent donation).

## API
Auth: `POST /api/auth/register|login|logout`, `GET /api/auth/me` · Scores: `GET/POST /api/scores`, `PUT/DELETE /api/scores/:id` · Charities: `GET /api/charities?search=&category=&featured=`, `GET /api/charities/:id` · Subscription: `GET/POST /api/subscription`, `POST /api/subscription/cancel` · User: `GET /api/user/dashboard|profile|draws|winnings`, `PUT /api/user/profile|charity`, `POST /api/user/winnings/:id/proof`, `POST /api/donations`, `GET /api/winners/:id/proof` · Draws: `GET /api/draws`, `GET /api/draws/:id` · Config: `GET /api/config`.
Admin (`/api/admin`, admin only): `GET/PUT users(/:id)`, `POST/PUT/DELETE users/:id/scores(/:scoreId)`, `GET/POST/PUT/DELETE charities`, `GET draws`, `POST draws/simulate`, `POST draws/publish`, `GET winners`, `PUT winners/:id/verify` (`{action:"approve"|"reject", note}`), `PUT winners/:id/payout`, `GET reports`.

## Local Setup
Requires Node 20+ and MongoDB (local, Atlas, or use the built-in in-memory mode).
```bash
npm run install:all
cp server/.env.example server/.env      # set MONGODB_URI and JWT_SECRET
npm run seed                            # demo data
npm run server                          # API on :5000
npm run client                          # web on :5173 (proxies /api)
```
No MongoDB available? `npm run server:memory` starts an in-memory MongoDB, seeds it and serves the API (data resets on exit; first run downloads a mongod binary).

## Environment Variables
| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | JWT signing secret (required in production) |
| `CLIENT_URL` | server | Allowed CORS origin(s), comma separated |
| `PORT`, `JWT_EXPIRES_IN`, `PAYMENT_PROVIDER` | server | optional |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | server | reserved for a future Stripe provider |
| `VITE_API_URL` | client | deployed API base URL (empty in dev) |

## Seed Data
`npm run seed` wipes the database and creates: admin, 9 subscribers (one lapsed, one never subscribed), 6 charities (one featured, with events), a **published example draw for last month** (the demo user is a 3-match winner awaiting proof), an upcoming draw for the current month, and sample contributions.

## Demo Credentials
| Role | Email | Password |
|---|---|---|
| Admin | `admin@digitalheroes.demo` | `Admin@12345` |
| Subscriber | `user@digitalheroes.demo` | `User@12345` |

## Testing
`npm test` runs 13 end-to-end API tests against an in-memory MongoDB: register/login/me, role isolation, subscription (monthly/yearly/failure/cancel/lapse), score rules (range, dates, duplicate, 6th rollover, edit, delete), charities (search/filter/select/percent/donation), dashboard, prize maths, draw simulate/publish/duplicate publish/rollover, winner proof → reject → re-upload → approve → paid, admin user/charity management, reports, error handling. UI was smoke-tested in headless Chrome for every route (no console errors). See `IMPLEMENTATION_CHECKLIST.md`.

## Deployment
- **Database:** create a MongoDB Atlas cluster, copy the connection string.
- **API (Render / Railway / Fly):** root `server`, build `npm install`, start `npm start`. Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (frontend URL), `NODE_ENV=production`. Run `npm run seed` once (with `SEED_FORCE=true` in production) for demo data.
- **Frontend (Vercel/Netlify):** root `client`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<api-host>`. `vercel.json` already rewrites all routes to `index.html`.
- The PRD suggests Vercel + Supabase; the requested MongoDB stack is used instead, so the DB is MongoDB Atlas.

## PRD Assumptions
All values live in `server/src/config/businessRules.js`.
- **Prices:** monthly $10, yearly $100 (~17% discount). Currency USD.
- **Prize pool:** 50% of each subscription (monthly-equivalent) funds the pool; split 40/35/25 across 5/4/3 matches. Pool = sum over active subscribers at draw time.
- **Draw numbers:** 5 distinct numbers from 1-45 (same range as Stableford scores). A subscriber's numbers are their stored scores; matches = distinct scores found in the drawn numbers. A user wins only their highest tier.
- **Eligibility:** active subscription and at least 1 score. Blocked users excluded.
- **Algorithmic mode:** each number's probability is proportional to how many participants hold it (+1 smoothing).
- **Rollover:** if nobody matches 5, that tier's pool (incl. earlier rollover) is added to the next published draw's jackpot.
- **Rounding:** prizes rounded down to the cent.
- **Score window:** "oldest" is by score date. A new score older than all 5 stored ones is rejected (it would be deleted immediately). Future dates rejected.
- **Simulation:** each run picks new numbers and saves them on the draw; publishing uses exactly those numbers and re-evaluates against current scores. Upcoming draw numbers are hidden from the public until publish.
- **Subscription:** cancel takes effect immediately (status `cancelled`, no access); a period that ends unrenewed becomes `lapsed`. Non-subscribers can browse and manage profile/charity but cannot add/edit scores or enter draws. Charity share is recorded as a `Contribution` at each payment.
- **Charity:** selected at signup (required), minimum 10%, max 100%. Deleting a charity in use deactivates it instead.
- **Winner flow:** awaiting proof → pending → approved/rejected (rejected can re-upload) → paid (only after approval). Proof images (PNG/JPEG/WebP, ≤2MB, magic-byte checked) are stored in MongoDB.
- **Payments:** demo provider - no real charge. "Simulate a declined card" checkbox exercises failures.

## Known Limitations
- Payments are simulated; Stripe is not integrated (drop-in point: `paymentProvider.js`). No automatic recurring billing - renewal is a user action and expired periods lapse.
- No email notifications, password reset, or rate limiting.
- Draws are triggered by an admin (no scheduler). Publishing is not wrapped in a DB transaction (standalone MongoDB); it uses an atomic claim and rolls back on failure.
- JWT is stored in localStorage; logout discards the token (no server-side revocation).
- Charity images use external URLs (seed uses picsum.photos) with a graceful fallback.
- The PRD's Vercel + Supabase deployment constraints were replaced by the requested Node/MongoDB stack. No public URL has been deployed from this environment.
