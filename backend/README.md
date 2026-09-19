# Service marketplace — backend + frontend scaffold

GPS-matched local service marketplace (plumbers, electricians, generator repair, etc.)
with three tiers: admin, customer, and provider.

## Structure

```
config/db.js            MongoDB connection
models/                 User, ProviderProfile, Category, ServiceRequest, Review
services/matching.js    Geo-ranked candidate lookup ($geoNear + scoring)
middleware/auth.js       JWT auth + role guard
routes/                 auth, public, customer, provider, admin
scripts/seedAdmin.js     One-off script to create/reset the admin account
sockets/index.js        Job offer push + accept/decline race handling
server.js               Entry point
frontend/               landing-page, login, customer-app, provider-app, admin-dashboard
brand/                  Logo assets
```

## Setup

```
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, PAYSTACK_SECRET_KEY
npm run dev
```

## Auth model

- `/api/auth/register` only ever creates a **customer** or **provider** account. There is
  no public admin registration route, on purpose.
- The **only** way an admin account is created is `scripts/seedAdmin.js`, run directly
  against the production database by whoever controls the deployment:

  ```
  ADMIN_NAME="Ops Admin" ADMIN_EMAIL="ops@servilink.example" ADMIN_PHONE="0800..." \
  ADMIN_PASSWORD="a-strong-password" ADMIN_CITY="Port Harcourt" \
  npm run seed:admin
  ```

  It's idempotent — re-running it with the same email updates that admin's password
  instead of creating a duplicate. Nothing about it is exposed over HTTP.

- All three roles log in through the same endpoint, `/api/auth/login`; the returned
  JWT carries the `role`, which `middleware/auth.js`'s `requireRole()` checks on every
  protected route.

## Public (no-login) browsing

`routes/public.js` is mounted with no auth middleware, deliberately, so an anonymous
visitor can browse before creating an account:

- `GET /api/public/categories` — active service categories
- `GET /api/public/coverage` — provider counts per city
- `GET /api/public/providers/sample` — a minimal, non-identifying sample (trade + rating
  only — never name, phone, or exact location)

Everything else requires a token and the matching role. This is the "least privilege"
layer: enough for someone to see what's covered near them, nothing that leaks provider
or customer identity.

## Frontend

`frontend/` has five self-contained HTML/CSS/JS files — no build step, no dependencies,
restyled to a standard, conventional interface (Inter, white/gray surfaces, teal primary,
rounded cards) rather than anything stylized:

- `landing-page.html` — entry point. Explains the two-sided platform, has a public
  "browse without an account" section wired to `/api/public`, and routes visitors to
  `login.html` rather than straight into either app.
- `login.html` — shared login/register for customer and provider (tabs, role passed via
  `?role=customer|provider`); admin only ever sees the login tab, with a note that admin
  accounts are seeded by operations, not self-registered.
- `customer-app.html` / `provider-app.html` / `admin-dashboard.html` — same flows as
  before, now gated: each checks `localStorage.servilink_auth` for a token with the
  matching role and redirects to `login.html` if it's missing.

Open `landing-page.html` first — the files link to each other by relative path, so keep
them (and `brand/`) together in the same static-site deploy.

**Demo mode:** every file still ships with `CONFIG.DEMO_MODE = true`, which does two
things — it fills views with mock data instead of calling the API, and it **skips the
login redirect** so you can click straight into any app to review it. Before this goes
anywhere near real users: set `DEMO_MODE = false` in all five files, point `CONFIG.API_BASE`
at your deployed backend, and the redirect guards become real. `login.html` already
stores `{ token, role, name }` in `localStorage.servilink_auth` on success and the other
three apps already read it — there's no extra wiring needed, just flipping the flag.

## How matching works

1. Customer posts a request with `categoryId` + `longitude`/`latitude`.
2. `services/matching.js` runs a `$geoNear` aggregation filtered to `available: true`,
   `verified: true`, same `city` and `category`, within a radius (default 10km, tune
   per city — Lagos likely wants a tighter radius than a lower-density city).
3. Results are re-ranked by a blended score (50% distance, 30% rating, 20% acceptance rate),
   not distance alone, so a very close but unreliable provider doesn't always win.
4. Top candidates are pushed via Socket.io (`job_offer`). First to `POST
   /api/provider/requests/:id/accept` wins — the accept route uses a single
   `findOneAndUpdate` with a status guard so two simultaneous accepts can't both succeed.
5. Everyone else notified gets `job_taken`.

## Multi-city rollout

`city` is a plain string field on `User`, `ProviderProfile`, and `ServiceRequest` — one
deployment, not one per city. Start with a single pilot city, tune the match radius and
verification process there, then open the `city` field to more values as you expand.

## Brand assets

`brand/` has the logo in the formats you'll actually need, all transparent PNG:

- `servilink-icon.png` — the mark alone (teal), for light backgrounds and favicons
- `servilink-icon-reverse.png` — the mark alone (light), for dark backgrounds
- `servilink-logo-horizontal.png` — icon + wordmark, for light backgrounds
- `servilink-logo-horizontal-reverse.png` — icon + wordmark, for dark backgrounds
- `servilink-logo-presentation.png` — the horizontal lockup on a flat background, for
  anywhere you need a non-transparent preview image (a pitch deck, a social card)

All five HTML files already reference the right variant as their favicon and header/footer logo.

## Deployment notes

- API → Render, matching your other projects. Frontend → static hosting (Vercel/Netlify).
- Create the `2dsphere` index on `ProviderProfile.location` and `ServiceRequest.location`
  in Atlas before going live (Mongoose declares it, but Atlas needs to build it).
- If you change either schema's geo field shape later, drop the old index in the Atlas
  UI first — a stale index on a renamed/retyped field is a common source of confusing
  write errors on redeploy.
- Run `npm run seed:admin` once per environment (staging, production) right after the
  database is provisioned, before anything else — everything admin-side depends on that
  account existing.

## Still to do

- Paystack integration (hold on accept, release on completion)
- Rate limiting on `/auth` routes
- Automated fallback when top candidate times out
- Image upload for verification docs / job photos
