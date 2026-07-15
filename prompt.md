Updated todo list

Project summary for a new Claude chat:

- Node.js + Express application.
- Uses EJS views with a custom `layout` wrapper and static assets under `public/css` and `public/js`.
- Main server entry: `app.js`.
  - Middleware: `helmet`, `morgan`, body parsing, sessions (`express-session`), static files.
  - Custom auth/flash context middleware to expose `user` and flash messages.
  - Authentication guard redirects unauthenticated users to `/login`.
  - Routes mounted from `src/routes/index.js`.

- Backend integration:
  - Uses Supabase client in `src/supabase.js`.
  - Reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, session secret, and auth creds from environment.

- Main feature routes in `src/routes/index.js`:
  - `/login`, `/logout`
  - `/` dashboard
  - `/mp` materie prime receipt
  - `/sm` semi-finished work
  - `/pf` finished products production
  - `/magazzino` warehouse inventory
  - `/spedizioni` shipping / DDT
  - `/anagrafiche` master data (suppliers, materials, articles)
  - `/traccia` traceability search
  - `/api/traccia/:codice` API for tracing a lot code across MP/SM/PF and shipments

- Views:
  - Shared `views/partials/layout.ejs`
  - Page templates in `views/pages/*.ejs`
  - New login page at `views/pages/login.ejs`

- Styling and client behavior:
  - Single CSS file `public/css/app.css` with adaptive layout, auth page styling, dashboard, forms, tables, pills, etc.
  - Client JS in `public/js/app.js` handling toast messages, tabs, form previews, trace search, dynamic rows, etc.

- Environment defaults:
  - `.env.example` includes `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`, plus added `AUTH_USER`, `AUTH_PASS`, and `PORT`.

- Current state:
  - App is a packaging traceability management UI for Sumisu/TrackPack.
  - Auth is simple session-based login with hardcoded credentials from env.
  - The login page and access guard are implemented and working.