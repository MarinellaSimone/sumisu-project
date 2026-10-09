# Feature futura: annullamento e cancellazione di lotti collegati

## Obiettivo

Permettere di correggere una catena di produzione errata (MP → SM → PF)
annullando i consumi registrati, ripristinando le giacenze e mantenendo la
tracciabilità coerente. Dopo l'annullamento, i lotti senza più collegamenti
potranno essere eliminati dallo storico con la normale funzione di
cancellazione.

## Comportamento attuale

- L'eliminazione dallo storico è consentita solo se il lotto non ha i
  collegamenti controllati dall'API.
- L'azione **Elimina** nel Magazzino non cancella il lotto: imposta quantità e
  giacenza a zero. Non rimuove i consumi e non ripristina le giacenze dei lotti
  collegati.
- Non esiste una funzione nell'interfaccia per annullare consumi o scollegare
  i lotti. Non correggere la catena cancellando manualmente righe dal database.

## Flusso proposto

L'annullamento si esegue a ritroso, dal prodotto finito verso le materie prime:

1. **Annullare la produzione PF**: rimuovere i collegamenti PF → MP e PF → SM
   registrati in `pf_consumi_mp` e `pf_consumi_sm`; per ogni collegamento
   restituire al lotto consumato la quantità effettivamente registrata.
2. Una volta che lo SM non è più usato da PF, **annullare la lavorazione SM**:
   rimuovere i collegamenti SM → MP registrati in `sm_consumi_mp` e restituire
   all'MP le quantità consumate.
3. Eliminare dallo storico, se desiderato e se non hanno altri collegamenti,
   prima PF, poi SM e infine MP.

La catena non va cancellata tutta in una volta alla cieca: un lotto può essere
condiviso da più produzioni. Prima di ogni annullamento bisogna elencare gli
utilizzi interessati e verificare che l'utente intenda annullare proprio quei
collegamenti.

## Regole per il ripristino delle giacenze

- Ripristinare la somma delle quantità dei collegamenti rimossi, non la
  quantità totale originaria del lotto.
- Aggiornare la giacenza disponibile; non modificare la quantità originaria
  del lotto consumato.
- Un collegamento con quantità zero va rimosso, ma non deve aumentare la
  giacenza.
- Ricalcolare lo stato dei lotti interessati secondo le regole applicative,
  facendo attenzione agli stati speciali e alle soglie già gestite dal
  sistema.
- Se la giacenza è stata modificata nel frattempo o il lotto consumato è stato
  usato anche altrove, aggiungere solo le quantità relative ai collegamenti
  annullati.

## Spedizioni PF

Un PF che compare in `spedizioni_righe` non deve poter essere annullato con il
flusso standard. La spedizione e i suoi documenti devono essere annullati o
corretti prima, con una procedura dedicata che gestisca anche la giacenza e la
tracciabilità. Non cancellare automaticamente righe o documenti di spedizione
come effetto collaterale dell'annullamento PF.

## Requisiti di implementazione

- Fornire azioni esplicite e distinte, ad esempio **Annulla produzione PF** e
  **Annulla lavorazione SM**, senza confonderle con l'azione di azzeramento
  giacenza del Magazzino.
- Prima della conferma mostrare il lotto, i lotti collegati, le quantità che
  saranno restituite e le eventuali condizioni che impediscono l'operazione.
- Rendere annullamento dei collegamenti, ripristino delle giacenze e
  aggiornamento dello stato atomici: se un passaggio fallisce, non deve restare
  una catena parzialmente annullata. Valutare una funzione SQL/RPC con
  transazione e controlli lato database.
- Impedire annullamenti duplicati o concorrenti che ripristinino due volte le
  stesse quantità.
- Conservare un audit dell'operazione (utente, data/ora, lotto e collegamenti
  annullati, quantità ripristinate). Definire i permessi prima
  dell'implementazione; per un'operazione distruttiva è raccomandato limitarla
  agli amministratori.
- Dopo l'annullamento aggiornare la UI e consentire la cancellazione dallo
  storico solo se non restano altri collegamenti.
- Se non è possibile completare l'operazione, mostrare un errore chiaro e non
  presentarla come riuscita.

## Criteri di accettazione

- Annullando un PF non spedito, i collegamenti PF → MP/SM sono rimossi e le
  giacenze MP/SM aumentano delle sole quantità consumate da quel PF.
- Se lo SM non ha altri utilizzi, è possibile annullare la lavorazione: si
  rimuove il collegamento SM → MP e si ripristina la quantità consumata di MP.
- Le giacenze di lotti usati da altri PF/SM non vengono sovrascritte né
  ripristinate per quantità non appartenenti all'annullamento.
- Un PF spedito, o un lotto ancora usato da altri record, viene bloccato con
  un messaggio che spiega quale passaggio occorre gestire.
- Un errore durante l'operazione non lascia collegamenti rimossi con giacenze
  non ripristinate, o giacenze ripristinate con collegamenti ancora presenti.
- Dopo l'annullamento completo della catena, PF, SM e MP diventano eliminabili
  dallo storico solo quando ciascuno non ha più altri riferimenti.
