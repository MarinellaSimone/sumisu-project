const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('\n[TrackPack] ATTENZIONE: SUPABASE_URL o SUPABASE_ANON_KEY mancanti nel file .env\n');
}

// Un solo client condiviso in tutta l'app.
// NB: con la anon key le Row Level Security policy di Supabase si applicano.
// Per un gestionale interno puoi disattivare RLS sulle tabelle oppure
// usare una service_role key (da tenere SOLO lato server).
const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
