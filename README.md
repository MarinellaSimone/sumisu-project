# TrackPack — Gestionale tracciabilità packaging

App Node.js + Express + Supabase (PostgreSQL) generata dal mock `trackpack_login_mock`.
Autenticazione a sessione con ruoli **admin** / **operatore**, tracciabilità completa
MP → SM → PF → DDT.

## Stack
- **Node.js + Express** — server e API REST
- **Supabase** (PostgreSQL) — database
- **express-session** — sessioni server-side (cookie httpOnly)
- **bcryptjs** — hashing password
- **EJS** — rendering delle pagine

## Struttura
```
trackpack/
├── .env                  # variabili (già compilato con i tuoi valori)
├── .env.example
├── package.json
├── db/
│   ├── schema.sql        # schema DB da eseguire su Supabase
│   └── seed.js           # popolamento utenti + dati demo
├── src/
│   ├── server.js         # entry point
│   ├── supabase.js       # client Supabase
│   ├── lotto.js          # generatori codici lotto (LT/SM/PF/DDT)
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js       # login / logout
│       └── api.js        # tutte le API dati
├── views/                # login.ejs, app.ejs, 403.ejs
└── public/               # css, js client, logo
```

## Setup

### 1. Configura le variabili
Il file `.env` è già presente con i valori che hai fornito. Sostituisci
`SUPABASE_URL` e `SUPABASE_ANON_KEY` con quelli reali del tuo progetto Supabase
(li trovi in *Project Settings → API*), e imposta un `SESSION_SECRET` casuale.

```
SUPABASE_URL=https://<tuo-progetto>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SESSION_SECRET=<stringa-casuale-lunga>
PORT=3000
```

### 2. Crea lo schema del database
Apri l'**SQL Editor** di Supabase, incolla il contenuto di `db/schema.sql`
ed eseguilo una volta.

> **RLS**: con la anon key valgono le Row Level Security policy di Supabase.
> Per un gestionale interno la via più semplice è disattivare RLS sulle tabelle
> (*Table editor → tabella → RLS: disable*), oppure usare una `service_role` key
> lato server (da tenere segreta, mai nel client).

### 3. Installa e popola
```bash
npm install
npm run init-db      # crea utenti demo + anagrafiche + lotti di esempio
```

Per un database gia esistente, esegui prima `db/migration_add_materiali_codice_numerico.sql`
nell'SQL Editor di Supabase.

Per sincronizzare anche gli articoli PF esistenti, esegui
`db/migration_add_articoli_codice_numerico.sql` nello stesso SQL Editor.

La tabella `tipologie` (`tipologia`, `codice`) e gestita manualmente su Supabase;
l'applicazione la visualizza soltanto in lettura. Per nuove installazioni viene
creata da `db/schema.sql`; per database esistenti puoi eseguire
`db/migration_add_tipologie.sql`.

### 4. Avvia
```bash
npm start            # oppure: npm run dev  (auto-reload)
```
App su **http://localhost:3000**

## Credenziali demo
| Username     | Password    | Ruolo     |
|--------------|-------------|-----------|
| `admin`      | `admin2026` | admin     |
| `operatore1` | `pass123`   | operatore |
| `operatore2` | `pass123`   | operatore (disabilitato) |

## Ruoli e permessi
- **Operatore** — Dashboard, Ricevimento MP, Lavorazione SM, Produzione PF, Magazzino
- **Admin** — tutto quanto sopra + Spedizioni/DDT, Anagrafiche, Rintracciabilità, Gestione utenti

I permessi sono applicati sia lato UI (voci di menu nascoste) sia lato server
(le API riservate rispondono `403` agli operatori).

## Moduli funzionali
1. **Dashboard** — KPI live, lotti sotto soglia, ultimi movimenti, ordini PF attivi
2. **Ricevimento MP** — registra materie prime, genera codice `LT-AAAAMMGG-MAT-NNN`
3. **Lavorazione SM** — interna/esterna, consuma lotti MP, genera `SM-AAAAMMGG-TIPO-NNN`
4. **Produzione PF** — collega lotti MP e SM, genera `PF-AAAAMMGG-ART-NNN`
5. **Magazzino** — giacenze correnti MP / SM / PF
6. **SPEDIZIONI PF** — genera `DDT-AAAA-NNNN`, scarica le giacenze PF
7. **Anagrafiche** — fornitori, materiali MP/SM, articoli PF (GTIN-14)
8. **Rintracciabilità** — ricostruisce la catena a monte/valle da qualsiasi codice lotto
9. **Gestione utenti** — crea/disabilita/elimina utenti, reset password

## Tracciabilità
Le tabelle ponte `sm_consumi_mp`, `pf_consumi_mp`, `pf_consumi_sm` e
`spedizioni_righe` registrano i legami tra lotti. La ricerca di rintracciabilità
naviga questi legami in entrambe le direzioni:
- da un lotto **MP** → verso gli SM/PF che lo hanno usato
- da un lotto **PF** → verso SM, MP e il DDT di spedizione

## Note di produzione
- Le sessioni sono in memoria (ok per singola istanza/demo). Per il deploy usa
  `connect-pg-simple` verso il Postgres di Supabase (dipendenza già inclusa).
- Imposta `cookie.secure = true` in `src/server.js` quando servi dietro HTTPS.
- Le etichette/barcode del mock sono un layer di UI: qui l'app si concentra sulla
  logica dati e sulla persistenza. Si possono reintrodurre come modale di stampa
  a partire dai codici lotto generati.
