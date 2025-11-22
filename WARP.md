# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands

### Backend API (Node/Express)

- From repo root: `cd backend`
- Copy environment template: on Unix shells `cp .env.example .env`; on PowerShell `Copy-Item .env.example .env`
- Install dependencies: `npm install`
- Start development server (listens on `http://localhost:4000`): `npm run dev`
- Start in production mode (Unix-style): `npm start` (sets `NODE_ENV=production` and runs `src/server.js`)

The backend expects a MySQL instance configured via `.env`:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` (long random string)
- `CORS_ORIGIN` (frontend origin in production)

### Frontend SPA (React + Vite)

- From repo root: `cd frontend`
- Install dependencies: `npm install`
- Start development server (Vite on `http://localhost:5173`): `npm run dev`
  - Dev server proxies `/api` to `http://localhost:4000` (see `frontend/vite.config.mts`).
- Build production assets: `npm run build`
- Locally preview the production build: `npm run preview`

### Database (MySQL)

The database schema and seed data live under `sql/` and assume a schema named `secure_voting`.

In a MySQL client:

- Create schema and core tables:
  - `SOURCE sql/schema.sql;`
- Seed positions and candidates:
  - `SOURCE sql/seed_positions_candidates.sql;`
- Seed voter access codes:
  - `SOURCE sql/seed_access_codes.sql;`
  - The script currently inserts `VOTE-0001` through `VOTE-0020` and includes a comment reminding you to extend the list up to `VOTE-0269` if you need all 269 voters.

### Admin user creation (password hashing)

There is no committed helper script for admin password hashing, but the README describes a pattern:

- In `backend/`, create a temporary `hash-admin-password.mjs` that uses `bcrypt.hash` on a plaintext password.
- Run it with Node (e.g. `node hash-admin-password.mjs "YourStrongPasswordHere"`) to obtain a hash.
- Insert a row into `admins` with `username` and the generated `password_hash`.
- Remove the helper script after use.

### Tests

- `backend/package.json` defines `npm test` as a stub that simply prints "No tests defined" and exits successfully.
- There is currently no automated test suite or configured test runner for either backend or frontend, so there is no built-in way to run a single test file.

## Architecture overview

### High-level layout

- `backend/`: Node.js + Express REST API that handles voter and admin authentication, ballot retrieval and submission, results, turnout, CSV export, and audit logging.
- `frontend/`: React single-page app (via Vite) that implements both the voter ballot flow and the admin dashboard.
- `sql/`: MySQL schema and seed scripts defining voters, positions, candidates, votes, admins, and audit logs.

The system is cookie-based: successful voter or admin authentication sets an HTTP-only JWT cookie, and subsequent API calls rely on that cookie for authorization.

### Database schema (sql/schema.sql)

Key tables and relationships:

- `voters`: one row per voter with a unique `access_code` and a `voted` flag; `access_code` is the single-use credential presented by voters.
- `positions`: electoral positions (Chairperson, Treasurer, etc.), with optional descriptions consumed by the frontend ballot UI.
- `candidates`: links to `positions` via `position_id`; each has `full_name` and `alias` (short label used prominently in the UI).
- `admins`: admin accounts with `username` and `password_hash` (bcrypt), used by the admin login flow.
- `votes`: records each choice made by a voter for a specific position; foreign keys back to `voters`, `positions`, and `candidates` and a `UNIQUE (voter_id, position_id)` constraint enforcing one vote per position.
- `audit_logs`: append-only log of security-relevant events (e.g., logins, ballot submissions) with `actor`, `action`, `details`, and timestamp.

Controllers in the backend read and enforce these constraints (e.g., verifying that each submitted vote references a candidate matching its position and that every position receives exactly one vote).

### Backend API structure (backend/src)

**Entry point and infrastructure**

- `server.js` wires up the Express app:
  - Loads environment variables via `dotenv`.
  - Applies security and infrastructure middleware: `helmet`, `cors` (respecting `CORS_ORIGIN` with credentials), JSON body parsing, `cookie-parser`, and `morgan` for request logging.
  - Mounts the voter and admin routers under `/api/voter` and `/api/admin` respectively.
  - Exposes a lightweight `GET /health` endpoint for basic liveness checks.
- `db.js` creates a MySQL connection pool using `mysql2/promise`, reading connection parameters from `.env`. All controllers import this pool for queries and transactions.

**Authentication middleware**

- `middleware/auth.js` centralizes JWT handling for both voters and admins:
  - `setVoterToken(res, payload)` and `setAdminToken(res, payload)` issue signed JWTs (secret from `JWT_SECRET`) and set them as HTTP-only cookies (`voter_token` / `admin_token`) with `sameSite='lax'` and `secure` depending on `NODE_ENV`.
  - `requireVoterAuth` and `requireAdminAuth` read and verify the respective cookies, attach the decoded payload to `req.voter` or `req.admin`, and reject unauthenticated/invalid sessions with `401` JSON responses.

**Routing layer**

- `routes/voterRoutes.js`:
  - `POST /api/voter/login` → `loginWithAccessCode` (no prior auth).
  - `GET /api/voter/ballot` → `requireVoterAuth` → `getBallot`.
  - `POST /api/voter/ballot` → `requireVoterAuth` → `submitBallot`.
- `routes/adminRoutes.js`:
  - `POST /api/admin/login` → `adminLogin`.
  - `GET /api/admin/results` → `requireAdminAuth` → `getResults`.
  - `GET /api/admin/turnout` → `requireAdminAuth` → `getTurnout`.
  - `GET /api/admin/export` → `requireAdminAuth` → `exportResultsCsv`.
  - `GET /api/admin/audit-logs` → `requireAdminAuth` → `getAuditLogs`.

This separation keeps the HTTP surface area clear: routers handle URL structure and middleware, while controllers own data access and business rules.

**Voter controller** (`controllers/voterController.js`)

- `loginWithAccessCode`:
  - Validates that an `accessCode` is present in the request body.
  - Looks up the voter by `access_code` and ensures `voted` is still `0` (single-use enforcement at login time).
  - On success, issues a voter JWT cookie via `setVoterToken` and records a `voter` login event into `audit_logs`.
- `getBallot`:
  - Joins `positions` and `candidates` and reshapes rows into a nested `{ positions: [...] }` structure where each position includes its candidate list.
  - This structure matches what the React ballot UI expects.
- `submitBallot`:
  - Expects a `votes` array in the request body (each item with `positionId` and `candidateId`).
  - Loads all `positions` and enforces exactly one vote per existing position: rejects missing or duplicate positions and unknown `positionId`s.
  - Opens a transaction and locks the current voter row (`SELECT ... FOR UPDATE`) to ensure they have not already voted (`voted` flag still `0`).
  - For each vote, validates that the candidate exists and belongs to the specified position.
  - Inserts one row into `votes` per selection, sets `voters.voted = 1`, writes an `audit_logs` entry describing the submission, and commits the transaction.

**Admin controller** (`controllers/adminController.js`)

- `adminLogin`:
  - Verifies username/password, fetches the admin by `username`, compares against `password_hash` with `bcrypt.compare`, and sets an admin JWT cookie via `setAdminToken`.
  - Logs successful logins into `audit_logs` with an `admin:<username>` actor label.
- `getResults`:
  - Aggregates votes per candidate and per position using a `LEFT JOIN` on `votes`.
  - Returns a `{ positions: [...] }` structure where each position has a list of candidates with their vote counts, sorted by position then votes.
- `getTurnout`:
  - Computes overall turnout by counting total voters vs those with `voted = 1`; includes the derived percentage in the JSON response.
- `exportResultsCsv`:
  - Runs a similar aggregation query and serializes results into a CSV string, setting appropriate `Content-Type` and `Content-Disposition` headers for download.
- `getAuditLogs`:
  - Returns the latest 500 `audit_logs` entries ordered by `created_at DESC` for display in the admin UI.

Across controllers, errors are logged to the server console and surfaced to clients as generic `500` JSON messages, while validation errors return `4xx` codes with short messages that the frontend surfaces to users.

### Frontend SPA structure (frontend/src)

The frontend is a minimal React app without routing libraries; it uses component state to manage both the voter flow and the admin dashboard in a single page.

- `main.jsx` mounts the app into `#root`, wrapping it in `React.StrictMode` and importing the global stylesheet `styles.css`.
- `App.jsx` defines all UI components and orchestrates client-side state and API calls:
  - **Top-level state**: `mode` (`'voter'` or `'admin'`), voter `step` (`'login' | 'ballot' | 'confirm' | 'done'`), loaded `positions`, `selections` by position ID, submission error/loading flags, and `adminLoggedIn`.
  - **Layout**: header with tabs to switch between Voter and Admin modes, and a `<main>` area that conditionally renders the appropriate flow.

**Voter flow components** (inline in `App.jsx`)

- `AccessCodeLogin`:
  - Simple form that posts `accessCode` to `/api/voter/login` with `withCredentials: true` so the backend can set the voter cookie.
  - On success, invokes `onLoggedIn` to advance the app to the ballot step; on error, displays the backend-provided message.
- `Ballot`:
  - Renders the list of positions and radio-button candidates using the `positions` array returned from `GET /api/voter/ballot`.
  - Updates `selections` in parent state and moves to the confirm step on submit.
- `Confirm`:
  - Shows a read-only summary of choices derived from `positions` and `selections`.
  - Provides Back/Submit actions; submit delegates to a callback that posts the ballot.
- `ThankYou`:
  - Final screen shown after a successful submission.

When the voter `step` switches to `'ballot'`, a `useEffect` in `App` loads the ballot from `/api/voter/ballot` (with credentials) and stores it in `positions`. `submitBallot` then maps `positions` and `selections` into the `{ votes: [{ positionId, candidateId }, ...] }` structure the backend expects and posts it to `/api/voter/ballot`.

**Admin flow components**

- `AdminLogin`:
  - Posts `{ username, password }` to `/api/admin/login` with credentials; on success, sets `adminLoggedIn` in `App`.
- `AdminDashboard`:
  - On mount, concurrently loads:
    - `/api/admin/results` for per-position candidate results,
    - `/api/admin/turnout` for turnout stats,
    - `/api/admin/audit-logs` for the latest log entries.
  - Renders results grouped by position, showing alias, full name, and vote count.
  - Displays turnout as an absolute count and percentage.
  - Shows a scrolling list of audit log rows with timestamp, actor, action, and details.
  - Provides an **Export results as CSV** button that calls `/api/admin/export` and triggers a file download using the browser `Blob` and `URL.createObjectURL` APIs.

**Styling**

- `styles.css` contains the global styles for layout, cards, buttons, ballot grid, admin dashboard, and audit log. All React components reference class names defined there (e.g., `layout`, `card`, `position`, `audit-log`, `error`).

Understanding how the frontend components map onto backend routes (and how both map onto the SQL schema) is key for extending this system: changes to ballot structure, new admin views, or additional audit events typically require coordinated updates across `sql/`, backend controllers/routes, and the React components using their JSON responses.