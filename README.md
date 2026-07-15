# TrackPack App
### Gestionale tracciabilità packaging alimentare — UI ispirata a Sumisu

Stack: **Node.js + Express + Supabase + EJS**

---

## 1. Setup Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un account gratuito
2. Clicca **New project** — scegli un nome (es. `trackpack`), regione EU (Frankfurt)
3. Aspetta ~2 minuti che il progetto venga creato
4. Vai su **Settings → API**:
   - Copia il **Project URL** (es. `https://abcdefgh.supabase.co`)
   - Copia la **anon public key** (lunga stringa JWT)
5. Vai su **SQL Editor** e incolla il contenuto di `supabase_schema.sql`, poi clicca **Run**
6. Il database è pronto con tabelle e dati di esempio

---

## 2. Configurazione

Copia `.env.example` in `.env` e compila:

```bash
cp .env.example .env
```

Modifica `.env`:

```env
SUPABASE_URL=https://il-tuo-progetto.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...la-tua-chiave...
SESSION_SECRET=una-stringa-casuale-lunga
PORT=3000
```

---

## 3. Installazione e avvio

```bash
npm install
npm start
```

Apri il browser su **http://localhost:3000**

### Sviluppo (auto-reload):
```bash
npm run dev
```

---

## 4. Struttura progetto

```
trackpack-app/
├── app.js                    ← Applicazione Express principale
├── .env                      ← Variabili d'ambiente (da compilare)
├── supabase_schema.sql       ← Schema DB da eseguire su Supabase
├── public/
│   ├── css/app.css           ← Stile con palette Sumisu (verde + viola)
│   └── js/app.js             ← JS client: toast, modal, riciclo, traccia
├── src/
│   ├── supabase.js           ← Client Supabase
│   └── routes/index.js       ← Tutte le route (8 sezioni)
└── views/
    ├── partials/layout.ejs   ← Layout con sidebar
    └── pages/
        ├── dashboard.ejs
        ├── mp.ejs            ← Ricevimento MP
        ├── sm.ejs            ← Lavorazione SM
        ├── pf.ejs            ← Produzione PF (con codici riciclo)
        ├── magazzino.ejs
        ├── spedizioni.ejs
        ├── anagrafiche.ejs
        └── traccia.ejs       ← Rintracciabilità 3 colonne
```

---

## 5. Sezioni dell'app

| Sezione | URL | Funzione |
|---------|-----|----------|
| Dashboard | `/` | KPI live, flusso lotti, ultimi movimenti |
| Ricevimento MP | `/mp` | Inserimento e storico lotti materie prime |
| Lavorazione SM | `/sm` | Lavorazioni interne/esterne con lotti MP |
| Produzione PF | `/pf` | Ordini produzione + etichetta con codici riciclo |
| Magazzino | `/magazzino` | Giacenze MP/SM/PF con tab |
| Spedizioni | `/spedizioni` | Creazione DDT e storico |
| Anagrafiche | `/anagrafiche` | Fornitori, materiali, articoli PF |
| Rintracciabilità | `/traccia` | Catena completa da qualsiasi codice lotto |

---

## 6. Palette colori Sumisu

```css
--su-verde:  #b8cc8a   /* verde salvia */
--su-viola:  #6b5bb5   /* viola Sumisu */
```

---

## 7. Prossimi passi (Modulo 2)

- [ ] Autenticazione utenti con Supabase Auth
- [ ] Generazione PDF DDT reale (puppeteer o pdfkit)
- [ ] Distinta base (BOM) per articolo PF
- [ ] Stampa ZPL reale via TCP (Zebra ZD230)
- [ ] Deploy su Railway: `railway up`


## 8. Spiegazione progetto (come editare)

Project structure is small and centered around a single Express app with EJS templates and static assets.

Root files
- `app.js`
  - Main Express server.
  - Loads `.env`, sets up middleware:
    - helmet, morgan
    - body parsing
    - session support
    - static file serving
    - auth guard that redirects unauthenticated users to `/login`
  - Mounts routes from `src/routes/index.js`
  - Defines 404 and error handlers
- `package.json`
  - Node dependencies and startup scripts
- `.env.example`
  - Environment variables for Supabase, session secret, and auth credentials

Backend code
- `src/routes/index.js`
  - Contains all app routes including dashboard, MP/SM/PF forms, trace API, and now `/login` + `/logout`
  - Uses a small `render()` helper to load page templates from `views/pages/*.ejs`
  - Uses Supabase client `sb` for database operations
  - Contains page-specific logic and form handlers
- `src/supabase.js`
  - Creates and exports the Supabase client using `SUPABASE_URL` and `SUPABASE_ANON_KEY`

Views
- `views/partials/layout.ejs`
  - Main page shell / layout wrapper
  - Includes sidebar, topbar, flash messages, and page content area
  - Renders different markup when `loginPage` is truthy, so the login page is shown without the normal app shell
- `views/pages/*.ejs`
  - Page-specific HTML fragments loaded into layout
  - Existing app pages: `dashboard.ejs`, `mp.ejs`, `sm.ejs`, `pf.ejs`, `magazzino.ejs`, `spedizioni.ejs`, `anagrafiche.ejs`, `traccia.ejs`
  - New login page: `views/pages/login.ejs`

Static assets
- `public/css/app.css`
  - App styling and layout CSS
  - Includes styles for sidebar, cards, forms, and also the auth/login page
- `public/js/app.js`
  - Client-side UI helpers: toast, modal, tabs, dynamic form rows, trace API fetch, etc.
  - Not directly involved in login except general page behavior

How login works
- In `src/routes/index.js`
  - `GET /login` renders `login.ejs` with `loginPage: true`
  - `POST /login` checks `username`/`password` against `AUTH_USER` / `AUTH_PASS`
  - Successful login stores `req.session.user`
- In `app.js`
  - Middleware sets `res.locals.user` and `res.locals.flash`
  - Auth guard redirects all requests except `/login` and `/logout` to `/login` if no session user exists
- In `views/partials/layout.ejs`
  - Uses `loginPage` to choose between login layout and the normal sidebar app shell

What to modify manually
- Change login UI content: `views/pages/login.ejs`
- Change login styles: `public/css/app.css`
- Change auth credentials or add env-driven users: `.env.example`, or use real env file with `AUTH_USER` / `AUTH_PASS`
- Change auth behavior or login flow: `src/routes/index.js`
- Change global layout or app menu: `views/partials/layout.ejs`
- Change page-specific forms and data logic: `src/routes/index.js` and corresponding `views/pages/*.ejs`



Updated todo list

For this app, the cleanest approach is:

1. Keep business/data logic in the route (`src/routes/index.js`)
2. Keep presentation in the EJS file (`views/pages/sm.ejs`)
3. Keep client interaction in `public/js/app.js`


### Best pattern for editing a page

- In `src/routes/index.js`, compute anything the page needs before rendering:
  - lists of options
  - default values
  - flags like `showAdvancedFields`
  - derived values from the database
- Pass those values in the render data object:
  ```js
  res.render('layout', {
    title: 'Lavorazione SM',
    tipi, fornitori, lottiMP,
    storico,
    showExternalFields: true,
    body: require('fs').readFileSync(...),
  })
  ```
- In `sm.ejs`, only use EJS for simple conditionals and loops:
  - `<% if (showExternalFields) { %> ... <% } %>`
  - `<% tipi.forEach(tipo => { %> ... <% }) %>`
  - avoid complex expressions or business rules inside the template

### For client-side behavior
`sm.ejs` can include buttons or controls that call functions in `public/js/app.js`, like `setSMTipo('int')`.


1. Add a dedicated page-specific function in `app.js`, for example `initSMPage()`
2. Call it from `sm.ejs` with a small inline script, or attach it on DOM ready


### When to create partials
If `sm.ejs` gets large, break repeated sections into smaller includes:
- `views/pages/sm-form.ejs`
- `views/pages/sm-history.ejs`
Then include:
```ejs
<%- include('sm-form') %>
<%- include('sm-history') %>
```



