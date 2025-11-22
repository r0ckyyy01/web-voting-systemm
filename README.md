# Secure Web Voting System

A full-stack secure web voting system with a React frontend, Node.js/Express REST API backend, and MySQL database.

## Project structure

- `backend/` – Node.js + Express API, authentication, vote handling, admin endpoints
- `frontend/` – React single-page app (Vite) for voters and admins
- `sql/` – Database schema and seed scripts

## Requirements

- Node.js 18+
- npm
- MySQL 8+

## 1. Database setup

1. Create and initialize the database:

   ```sql path=null start=null
   SOURCE sql/schema.sql;
   SOURCE sql/seed_positions_candidates.sql;
   SOURCE sql/seed_access_codes.sql;
   ```

2. Extend `sql/seed_access_codes.sql` to list access codes up to `VOTE-0269` (there are 269 total voters). Each row is of the form:

   ```sql path=null start=null
   ('VOTE-0001'),
   ```

3. Create an admin user (run in the MySQL console after you know the password hash):

   ```sql path=null start=null
   USE secure_voting;
   INSERT INTO admins (username, password_hash)
   VALUES ('admin_username', 'bcrypt-hash-here');
   ```

   To generate a bcrypt hash, run the small helper script below (see **Admin user creation**).

## 2. Backend setup

1. Copy environment template:

   ```bash path=null start=null
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and set:

   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET` – long random string
   - `CORS_ORIGIN` – origin of the frontend in production (e.g. `https://vote.example.com`)

3. Install dependencies (already done in this zip but safe to repeat):

   ```bash path=null start=null
   cd backend
   npm install
   ```

4. Start the backend API in development:

   ```bash path=null start=null
   npm run dev
   ```

   The server listens on `http://localhost:4000` and exposes:

   - `POST /api/voter/login` – login with single-use access code
   - `GET /api/voter/ballot` – fetch all positions and candidates
   - `POST /api/voter/ballot` – submit a complete ballot (one candidate per position)
   - `POST /api/admin/login` – admin authentication
   - `GET /api/admin/results` – results grouped by position, sorted by vote count
   - `GET /api/admin/turnout` – overall turnout statistics
   - `GET /api/admin/export` – CSV export of results
   - `GET /api/admin/audit-logs` – latest 500 audit log entries

## 3. Frontend setup

1. Install dependencies:

   ```bash path=null start=null
   cd frontend
   npm install
   ```

2. Start the dev server:

   ```bash path=null start=null
   npm run dev
   ```

3. Open the printed URL (by default `http://localhost:5173`). The dev server proxies `/api` calls to the backend on port 4000.

## 4. Voter user flow

1. Voter navigates to the main page and stays on the **Voter** tab.
2. Voter enters their unique access code (e.g. `VOTE-0001`).
3. If the code is valid and unused, the server issues a secure session cookie and the app loads the ballot.
4. On the ballot page, the voter:
   - Sees all positions (Chairperson, Vice Chairperson, Secretary, Vice Secretary, Organizing Secretary, Treasurer, Chief Whip, Patron).
   - For each position, sees candidates listed by **alias** and full formal name.
   - Chooses **exactly one** candidate per position using radio buttons.
5. The voter proceeds to the **Confirm** page, reviews their selections, and submits.
6. On submit, the server:
   - Validates one-candidate-per-position and that all positions are present.
   - Verifies each candidate belongs to the selected position.
   - Checks the voter has not already voted.
   - Records votes in the `votes` table.
   - Marks `voters.voted = 1`.
   - Writes an entry into `audit_logs`.
7. The voter sees a **Thank you** page and cannot reuse the access code.

## 5. Admin panel flow

1. Switch to the **Admin** tab in the UI.
2. Log in with admin username/password (see **Admin user creation** below).
3. After login, the dashboard shows:
   - Turnout counts and percentage.
   - Results per position, sorted by votes.
   - A button to **Export results as CSV**.
   - A scrollable list of recent audit log events.

### Admin user creation

1. In `backend`, create a temporary script `hash-admin-password.mjs`:

   ```javascript path=null start=null
   import bcrypt from 'bcrypt';

   const password = process.argv[2];
   if (!password) {
     console.error('Usage: node hash-admin-password.mjs <plain-password>');
     process.exit(1);
   }

   const rounds = 12;
   const hash = await bcrypt.hash(password, rounds);
   console.log(hash);
   ```

2. Run it:

   ```bash path=null start=null
   cd backend
   node hash-admin-password.mjs "YourStrongPasswordHere"
   ```

3. Copy the printed hash and insert into the `admins` table as shown earlier.
4. Remove the helper script once done.

## 6. Security notes

- **Single use access codes** – backend enforces `voters.voted = 1` after a successful ballot; duplicate use returns an error.
- **Database constraint** – the `votes` table has `UNIQUE(voter_id, position_id)` to prevent more than one vote per position.
- **Server-side validation** – `POST /api/voter/ballot` rejects:
  - Missing positions (must include every position in the database).
  - Duplicate positions in the same ballot.
  - Candidate IDs that do not belong to their claimed positions.
- **Password hashing** – admin passwords are stored as bcrypt hashes.
- **HTTPS** – in production, terminate HTTPS at your reverse proxy (e.g. Nginx) and set `NODE_ENV=production`. Configure your SSL certificates using a tool like Let’s Encrypt.
- **Secrets** – keep `.env` files out of version control. Rotate `JWT_SECRET` and database credentials periodically.

### Rotating secrets

1. Generate a new strong `JWT_SECRET`.
2. Update `.env` on the server.
3. Restart the backend process. Existing sessions will be invalidated; users will need to re-authenticate.
4. For database credential rotation, create a new MySQL user, grant the necessary privileges, update `.env`, restart backend, then revoke the old user.

### Exporting and archiving results

1. Use the **Export results as CSV** button in the admin dashboard to download `results.csv`.
2. Store exports in an encrypted location (e.g. encrypted volume or S3 bucket with server-side encryption and restricted access).
3. Optionally, take a MySQL logical backup:

   ```bash path=null start=null
   mysqldump -u your_mysql_user -p secure_voting > secure_voting_backup.sql
   ```

## 7. Running in production (overview)

1. Build the frontend:

   ```bash path=null start=null
   cd frontend
   npm run build
   ```

2. Serve the built frontend (e.g. with Nginx or a static host) and point it at the backend API URL.
3. Run the backend with a process manager (e.g. `pm2`, `systemd`) and behind an HTTPS-terminating reverse proxy.

## 8. User manual (quick reference)

### For voters

- You receive a unique access code.
- Go to the voting site URL during the voting window.
- Enter your access code and follow on-screen instructions.
- Review and submit your ballot.
- You will see a confirmation page once your vote is recorded.

### For admins

- Log in via the **Admin** tab.
- Monitor turnout and results in real time.
- Export results as CSV when voting closes.
- Review audit logs for suspicious activity (e.g. repeated invalid logins).