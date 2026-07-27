const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');

const router = express.Router();

// POST /login  { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Inserisci username e password' });
  }

  const { data: user, error } = await supabase
    .from('utenti')
    .select('*')
    .eq('username', username.trim())
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Errore server' });
  if (!user || !user.attivo) {
    return res.status(401).json({ error: 'Username o password errati. Riprova.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Username o password errati. Riprova.' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    nome: user.nome,
    ruolo: user.ruolo,
  };
  res.json({ ok: true, user: req.session.user });
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/me — utente corrente
router.get('/api/me', (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  res.status(401).json({ error: 'Non autenticato' });
});

module.exports = router;
