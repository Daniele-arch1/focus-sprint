# Focus Sprint

Un'app Pomodoro leggera, in HTML/CSS/JS puro, senza dipendenze.

## Funzionalità

- Timer per sessioni di **lavoro**, **pausa breve** e **pausa lunga**, con cicli automatici (4 sessioni di lavoro → pausa lunga).
- Anello di progresso animato e titolo della scheda aggiornato in tempo reale.
- Statistiche giornaliere (sessioni, minuti di focus, giorni di fila) e grafico degli ultimi 7 giorni, salvati in `localStorage`.
- Suono ambientale (rumore rosa) generato via Web Audio API, per accompagnare le sessioni di lavoro.
- Tema chiaro/scuro, con rilevamento automatico della preferenza di sistema.
- Durate personalizzabili per lavoro, pausa breve e pausa lunga.

## Avvio in locale

Basta aprire [`index.html`](index.html) in un browser, oppure servirlo con un piccolo server statico, ad esempio:

```bash
npx serve focus-sprint
```

Nessuna build o installazione richiesta.
