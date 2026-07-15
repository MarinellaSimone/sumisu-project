require('dotenv').config()
const express = require('express')
const session = require('express-session')
const helmet  = require('helmet')
const morgan  = require('morgan')
const path    = require('path')
const fs      = require('fs')

const app = express()

// ── SECURITY & LOGGING ───────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(morgan('dev'))

// ── BODY PARSING ─────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ── SESSION ───────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'trackpack-secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: false, maxAge: 8 * 60 * 60 * 1000 }
}))

// ── FLASH & AUTH CONTEXT ───────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user = req.session.user
  if (req.session.flash) {
    res.locals.flash = req.session.flash
    delete req.session.flash
  }
  next()
})

// ── STATIC ────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')))

// ── AUTH GUARD ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const openPaths = ['/login', '/logout']
  if (openPaths.includes(req.path)) {
    return next()
  }
  if (!req.session.user) {
    return res.redirect('/login')
  }
  next()
})

// ── VIEW ENGINE (EJS manual render) ──────────────────────────────────────
// Usiamo EJS per i partials ma rendiamo le pagine come stringhe inline
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Override render per iniettare il body nel layout
const originalRender = app.response.render
app.use((req, res, next) => {
  const _render = res.render.bind(res)
  res.render = function(view, data, cb) {
    if (view === 'layout') {
      // body è già una stringa EJS compilata
      const ejs = require('ejs')
      const layoutPath = path.join(__dirname, 'views/partials/layout.ejs')
      const bodyHtml = data.body || ''
      // Compila body come template con i dati
      let compiledBody
      try { compiledBody = ejs.render(bodyHtml, data) }
      catch(e) { compiledBody = `<pre style="color:red">${e.message}</pre>` }
      data.body = compiledBody
      _render(layoutPath, data, cb)
    } else {
      _render(view, data, cb)
    }
  }
  next()
})

// ── ROUTES ────────────────────────────────────────────────────────────────
app.use('/', require('./src/routes/index'))

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('layout', {
    title: 'Pagina non trovata',
    body: '<div class="empty"><i class="ti ti-error-404"></i><p>Pagina non trovata.</p></div>'
  })
})

// ── ERROR ─────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).render('layout', {
    title: 'Errore',
    body: `<div class="empty"><i class="ti ti-mood-sad"></i><p>${err.message}</p></div>`
  })
})

// ── START ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`\n✅  TrackPack in ascolto su http://localhost:${PORT}\n`))
