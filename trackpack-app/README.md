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
