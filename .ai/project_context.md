# Project Overview

## What this project does
TrackPack is a small web-based manufacturing traceability and inventory management application for packaging operations. It tracks raw materials (MP), semi-finished goods (SM), finished products (PF), and shipments (DDT), while recording consumption links between lots to enable upstream/downstream traceability. It also generates GS1-style barcodes and printable labels for lots.

## Main business purpose
The system is designed to manage internal packaging production and logistics for Sumisu S.r.l. / Dulcibana. It covers:
- intake of raw materials from suppliers,
- semi-finished work orders,
- finished product production,
- inventory status,
- shipment creation and DDT generation,
- traceability of materials across production stages,
- barcode/label generation and printing for lots,
- user and role management.

## Target users
- **Operatore**: production/operator users who register raw material receipts, create semi-finished goods, produce finished products, generate/print lot labels, and consult inventory.
- **Admin**: administrative users who additionally manage shipments, suppliers/materials/articles, traceability, and user accounts.

## High-level architecture
- Single Express application with server-rendered EJS pages for `login` and the main `app` shell.
- Client-side JavaScript in `public/js/app.js` provides a SPA-like user experience, page switching, form submission, and API interaction.
- Backend routes are split into authentication routes, main API routes, and a dedicated barcode/label generation route. Most app functionality is exposed through REST-style JSON endpoints under `/api`, with barcode/label generation under `/barcode`.
- Session-based authentication is managed with `express-session` and a server-side session store. User roles are enforced by middleware.
- Data persistence and business state live in Supabase PostgreSQL tables defined by `db/schema.sql`, with demo seed data created by `db/seed.js`.
- Barcode/label generation is handled by a small dedicated module (`src/barcode/`) that encodes GS1 Application Identifier data, renders a CODE128 barcode image, and produces a printable EJS-rendered label per lot type.

# Technology Stack

## Languages
- JavaScript (Node.js backend and frontend client script)
- SQL (PostgreSQL schema)
- HTML / EJS templating
- CSS

## Frameworks
- Node.js runtime
- Express web framework
- EJS view templating

## Databases
- PostgreSQL via Supabase
- Schema defined in `db/schema.sql`

## External services
- Supabase for hosted PostgreSQL and database client access
- CDN-hosted Tabler icons for frontend icons

## Key libraries
- `canvas` — server-side canvas rendering used to draw the barcode image
- `jsbarcode` — CODE128 barcode symbol generation, rendered onto the `canvas` instance
- `bcryptjs` — password hashing for user accounts

## Infrastructure
- Server-side Express app serving HTML, static assets, and JSON APIs
- Environment-based configuration through `.env` and `.env.example`
- Session data stored in memory by default, with a note in source to use `connect-pg-simple` for PostgreSQL-backed sessions in production

## Build tools
- npm / Node package manager
- `package.json` scripts:
  - `npm start` → `node src/server.js`
  - `npm run dev` → `node --watch src/server.js`
  - `npm run init-db` → `node db/seed.js`

## Deployment approach
- Deploy as a Node.js application behind an HTTP server or platform that supports Node.
- Requires environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SESSION_SECRET`, and optional `PORT`.
- Uses a Supabase-hosted PostgreSQL database for data storage.
- Recommended production improvement: enable secure cookies and replace in-memory session store with a persistent session store like `connect-pg-simple`.

# Repository Structure

## Root
- path: `/`
- purpose: repository metadata, app entry point definition, and environment configuration.
- contains: `package.json`, `package-lock.json`, `README.md`, `.env.example`, `.gitignore`, `.ai/project_context.md`
- important files:
  - `package.json`: dependencies, scripts, entry point, project metadata
  - `README.md`: setup and feature summary
  - `.env.example`: sample environment variable definitions
  - `.gitignore`: ignored files and folders
- dependencies:
  - depends on `src/` for application logic and `db/` for schema/seed
  - `README.md` documents the repository structure and usage

## db/
- path: `/db`
- purpose: database modeling and initial seed data
- contains: SQL schema and seeding script
- important files:
  - `schema.sql`: PostgreSQL table definitions and indexes for users, suppliers, materials, finished products, lots, consumption links, shipments, etc.
  - `seed.js`: demo data insertion for users, suppliers, materials, articles, lots, and shipments
- dependencies:
  - uses `src/supabase.js` to connect to Supabase inside `db/seed.js`
  - defines database objects relied on by `src/routes/api.js` and `src/routes/auth.js`

## src/
- path: `/src`
- purpose: backend source code for server setup, routing, business logic, database client, and barcode/label generation
- contains: entry point, API routes, authentication routes, barcode routes/module, middleware, Supabase client, lotto generation logic, and shared constants
- important files:
  - `server.js`: Express app setup, view engine, middleware, route registration (including `/barcode`), static serving, and app startup
  - `supabase.js`: Supabase client initialization using environment variables
  - `costants.js`: shared constants, notably `LABEL_TYPES` (`MP`, `SM`, `PF`) used to select which label template/type to render
  - `lotto.js`: business logic for generating sequential lot codes and DDT numbers
  - `routes/auth.js`: login, logout, and current user information endpoints
  - `routes/api.js`: main application API endpoints for dashboard, inventory, production, shipments, traceability, and user management
  - `routes/barcode.js`: `/barcode` endpoints; `GET /barcode` health check, `GET /barcode/generate` builds a GS1 barcode + rendered label for a given type/date/quantity/lot and returns the barcode data plus rendered HTML
  - `barcode/BarcodeCodec.js`: encodes/decodes GS1 Application Identifier strings (fixed GTIN `01`, production date `10`, expiry date `17`, quantity `37`); `create()` builds both the raw encoded value and a human-readable representation, `parse()` decodes a scanned barcode string back into its components
  - `barcode/BarcodeImage.js`: renders a CODE128 barcode image server-side using `canvas` + `jsbarcode`, returning a base64 PNG data URL
  - `barcode/LabelGenerator.js`: assembles label data (company, barcode value/text, lot, quantity, formatted date, image) for a given label `type`, generating the barcode via `BarcodeCodec` if not already provided
  - `barcode/LabelRenderer.js`: renders the appropriate EJS template from `views/barcodes/{type}.ejs` (e.g. `mp.ejs`) with the label data, producing printable label HTML
  - `middleware/auth.js`: authentication and admin authorization guards plus user injection into EJS views
- dependencies:
  - `server.js` imports routes and middleware from `src/routes/` and `src/middleware/`
  - `routes/api.js` and `routes/auth.js` use `src/supabase.js` and `src/lotto.js`
  - `routes/api.js` uses `bcryptjs` for password hashing when creating or managing users
  - `routes/barcode.js` uses `src/costants.js` (`LABEL_TYPES`) and the `src/barcode/` module (`BarcodeCodec`, `BarcodeImage`, `LabelGenerator`, `LabelRenderer`)
  - `barcode/LabelRenderer.js` depends on templates in `views/barcodes/`
  - `middleware/auth.js` is used by `server.js` and route definitions to protect endpoints

## public/
- path: `/public`
- purpose: client-side static assets for styling, behavior, and branding
- contains: CSS, JavaScript, and branding image
- important files:
  - `css/style.css`: visual styling for the application UI
  - `js/app.js`: frontend application logic, navigation, form handling, API calls, list rendering, and UI state
  - `logo-sumisu.png`: brand/logo asset displayed in the login and app shell
- dependencies:
  - `views/app.ejs` and `views/login.ejs` reference the static assets
  - `js/app.js` consumes APIs exposed by `src/routes/api.js` and `src/routes/barcode.js`

## views/
- path: `/views`
- purpose: server-rendered templates for page views and printable barcode labels
- contains: EJS templates for login, the main application shell, access denied page, and per-lot-type barcode label templates
- important files:
  - `login.ejs`: login page HTML and client-side login workflow
  - `app.ejs`: main app shell with navigation, page sections, and injected user data
  - `403.ejs`: access denied page for unauthorized users
  - `barcodes/mp.ejs`: printable label template for raw material (MP) lots; renders company name, barcode image, human-readable barcode text, lot code, and quantity in kg
  - `barcodes/*.ejs`: additional per-type label templates (e.g. SM, PF) selected at render time based on `LABEL_TYPES`
- dependencies:
  - `views/app.ejs` depends on `public/js/app.js` for interactive page behavior
  - `views/barcodes/*.ejs` are rendered by `src/barcode/LabelRenderer.js` using data assembled by `src/barcode/LabelGenerator.js`
  - `server.js` renders these views and injects authenticated user state

## Important cross-folder dependencies
- `src/server.js` is the app entry point and ties together the backend stack, routes (including `/barcode`), middleware, views, and static assets.
- `src/routes/auth.js` and `src/routes/api.js` both depend on `src/supabase.js` for database access.
- `db/seed.js` also depends on `src/supabase.js` to populate demo data.
- `src/routes/api.js` depends on `src/lotto.js` for lot number generation and also uses `bcryptjs` for user password management.
- `src/routes/barcode.js` depends on `src/costants.js` and the `src/barcode/` module to encode GS1 data, render a barcode image, and render a printable label via `views/barcodes/*.ejs`.
- `views/app.ejs` renders the UI shell and loads `public/js/app.js`, which drives the page workflow and calls backend `/api` and `/barcode` endpoints.
- `db/schema.sql` describes the PostgreSQL tables referenced by API routes and frontend forms.

# Summary
TrackPack is an Express/EJS web application for packaging production traceability with a Supabase PostgreSQL backend. It is organized as a monolithic Node application with a server-rendered view shell and a single-page-like frontend behavior. The repository is structured around backend source code in `src/` (including a dedicated GS1 barcode/label generation module), database schema and seed data in `db/`, public static UI assets in `public/`, and EJS views in `views/` (including printable per-lot-type barcode label templates under `views/barcodes/`).