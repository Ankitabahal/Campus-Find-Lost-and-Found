> **Live Website:** https://campusfind2026.ai.studio  
> **GitHub Repository:** https://github.com/Ankitabahal/Campus-Find-Lost-and-Found

# CampusFind — Smart Lost & Found System

A full-stack campus lost-and-found web application with React + Vite, Node.js + Express, and MySQL (with an isolated local SQLite fallback for workspace development).

## Included features
- User registration and login (`bcryptjs` password hashing + JWT sessions)
- Lost/found reports with item name, category, description, date, approximate location, and optional image upload
- Public browse/search and category/type filtering
- Attribute-based possible-match scoring (category, text similarity, date, and location)
- Match notifications
- Ownership claim submission and administrator review (approve / reject / request more information)
- User dashboard, report history, claims, and notifications
- Administrator dashboard, report moderation, user management, and summary statistics
- Database schema for `User`, `Item_Report`, `Claim`, `Match_Record`, `Handover`, and `Notification` (auto-initialized safely on startup via `CREATE TABLE IF NOT EXISTS`)

## Requirements
- Node.js 22+ (or Node.js 18+ when connecting to MySQL)
- MySQL 8 (for production / Railway)

## Local Development (AI Studio / Isolated Dev Mode)
1. Copy `.env.example` to `.env` if you want to customize local settings.
2. When `MYSQL_URL` and `DB_HOST` are left blank, the server automatically uses an isolated local SQLite database at `.local-dev/campusfind.sqlite` so production data is never touched.
3. Install dependencies and start the combined dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open **http://localhost:3000** in your browser.

## Deployment (Railway Backend + MySQL & Vercel Frontend)

### 1. Backend + MySQL on Railway
1. Create a MySQL service in Railway and link it to your backend service (which injects `MYSQL_URL`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`).
2. Set the backend service root directory to `server` (Start Command: `npm start`, or run `node server.ts` from root if hosting full-stack).
3. Configure these environment variables in Railway:
   - `JWT_SECRET` — a long random secret string
   - `CLIENT_URL` — your Vercel frontend URL(s), comma-separated (e.g. `https://your-app.vercel.app,http://localhost:5173`)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — initial administrator credentials
   - `DB_DRIVER=mysql` (optional; auto-detected when `MYSQL_URL` or `DB_HOST` is present)
4. On boot, `server/src/db.js` automatically ensures all schema tables exist safely (`CREATE TABLE IF NOT EXISTS`) without overwriting existing data.

### 2. Frontend on Vercel
1. Import the GitHub repository in Vercel.
   - If deploying from the repository **root** (recommended, uses `src/` + `vite.config.ts`): Build Command `npm run build`, Output Directory `dist`.
   - If deploying from `client/`: Build Command `npm run build`, Output Directory `dist`.
2. Add the environment variable in Vercel:
   - `VITE_API_URL=https://<your-railway-backend-domain>/api`
3. Redeploy so Vite bakes `VITE_API_URL` into the client bundle.

## First administrator login
The server creates an administrator account automatically on first startup if `ADMIN_EMAIL` does not already exist:

- Email: `admin@campusfind.edu` (or your `ADMIN_EMAIL`)
- Password: `ChangeMe123!` (or your `ADMIN_PASSWORD`)

Change `JWT_SECRET` and `ADMIN_PASSWORD` before using in production.
