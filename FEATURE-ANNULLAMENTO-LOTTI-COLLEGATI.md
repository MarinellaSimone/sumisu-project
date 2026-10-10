# Feature futura: annullamento e cancellazione di lotti collegati

## Obiettivo

Permettere di correggere una catena di produzione errata (MP → SM → PF)
annullando i consumi registrati, ripristinando le giacenze e mantenendo la
tracciabilità coerente. Dopo l'annullamento, i lotti senza più collegamenti
potranno essere eliminati dallo storico con la normale funzione di
cancellazione.

## Comportamento attuale

- L'eliminazione dallo storico è consentita solo se il lotto non ha i collegamenti controllati ad altri (es. Mp collegato a SM e viceversa)
- L'azione **Elimina** nel Magazzino non cancella il lotto: imposta quantità e
  giacenza a zero. Non rimuove i consumi e non ripristina le giacenze dei lotti
  collegati.


