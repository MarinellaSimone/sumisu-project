const path = require('path');
const express = require('express');
const session = require('express-session');
require('dotenv').config();

const { requireAuth, requireAdmin, injectUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// ---- Body parsing ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Static ----
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Sessioni ----
// Store in memoria: adatto a un singolo processo / demo.
// In produzione usa connect-pg-simple verso il Postgres di Supabase.
app.use(session({
  name: 'trackpack.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 ore
    sameSite: 'lax',
    secure: false, // metti true dietro HTTPS
  },
}));

app.use(injectUser);

// ---- Pagine ----
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/app');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/app');
  res.render('login');
});

app.get('/app', requireAuth, (req, res) => {
  res.render('app', { user: req.session.user });
});

// ---- Route auth & API ----
app.use('/', authRoutes);
app.use('/api', requireAuth, apiRoutes);

// ---- 404 ----
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint non trovato' });
  res.status(404).send('Pagina non trovata');
});

app.listen(PORT, () => {
  console.log(`\n[TrackPack] Server avviato su http://localhost:${PORT}\n`);
});
