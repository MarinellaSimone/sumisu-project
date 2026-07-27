// Richiede utente autenticato
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  // richiesta API -> 401 JSON, altrimenti redirect al login
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  return res.redirect('/login');
}

// Richiede ruolo admin (per Spedizioni, Anagrafiche, Rintracciabilità, Utenti)
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.ruolo === 'admin') return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  return res.status(403).render('403', { user: req.session.user });
}

// Rende l'utente disponibile alle view EJS
function injectUser(req, res, next) {
  res.locals.user = req.session ? req.session.user : null;
  next();
}

module.exports = { requireAuth, requireAdmin, injectUser };
