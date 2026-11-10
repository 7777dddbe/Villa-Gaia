# Villa Gaia, sito web

Sito statico (Astro + GSAP) per i tre appartamenti di Villa Gaia a Malcesine, Lago di Garda. Stesso sistema di prenotazione e stesso stile di Villa Mamma. Pensato per Netlify, dominio residencevillagaia.com.

## Cosa modificare, e dove

Tutto ciò che cambia spesso sta in file di configurazione, non nel codice.

| Cosa | File |
|---|---|
| Numero WhatsApp, email, sconto diretto, soggiorno minimo, stagione, animali, tassa di soggiorno, orari, codici, testi dei messaggi WhatsApp | `src/config/sito.json` |
| Prezzi Booking a notte per periodo e date speciali | `src/config/prezzi.json` |
| Dati degli appartamenti (tipo, piano, vista, letti, metrature, servizi) | `src/config/appartamenti.json` |
| Voto e recensioni | `src/config/recensioni.json` |
| Tutti i testi del sito (italiano, inglese, tedesco) | `src/i18n/it.json`, `en.json`, `de.json` |
| Foto | `src/assets/foto/` (leggi il file LEGGIMI.md lì dentro). Gli originali sono in `villa gaia photos/` |
| Posizione della villa sulla mappa | `src/config/sito.json` → `indirizzo.lat` e `indirizzo.lng` |
| Prenotazioni di prova (finché nessun calendario è collegato) | `netlify/dati-prova.json` |

Dove manca un dato trovi `[DA COMPLETARE]`: sul sito appare come un'etichetta gialla, così si vede subito cosa manca. `npm run dati-mancanti` li elenca.

## Da controllare con il proprietario

Questi dati sono stimati o presi da Villa Mamma, non confermati:

- **Appartamenti**: quanti sono (3 codici di registrazione sul vecchio sito), posti letto, letti, metrature, piano e vista. Le foto sono assegnate a Gaia 1, 2 e 3 a occhio.
- **Prezzi**: sono vuoti. Il sito scrive "Scrivici per il prezzo" e apre WhatsApp.
- **Stagione** (1 aprile - 31 ottobre), **soggiorno minimo** (2 notti), **sconto diretto** (10%), **tassa di soggiorno** (2 € a persona a notte): valori di Villa Mamma.
- **Animali**: oggi "non ammessi" ovunque. Il vecchio modulo chiede se si viaggia con un cane.
- **Coordinate** della villa per la mappa e **CIN / LOC** ufficiali.
- **Recensioni**: oggi c'è solo il voto 4,9 su 5 (41 recensioni su FeWo-direkt). Servono i testi.
- **Dominio**: ho usato residencevillagaia.com.

## Prezzi

- In `prezzi.json` scrivi solo il **prezzo Booking.com a notte** (o il prezzo di listino). Il prezzo diretto il sito lo calcola da solo togliendo lo sconto di `sito.json`.
- Le **date speciali** vincono sui periodi (bassa, media, alta).
- Se una notte della stagione resta senza prezzo, durante la build compare un avviso `[prezzi.json]`. Sul sito quell'appartamento appare comunque, con l'invito a chiedere il prezzo su WhatsApp.
- La tassa di soggiorno è solo una nota sotto il prezzo, non entra nel totale.

## Disponibilità (Google Calendar e Booking.com)

Il sito chiede la disponibilità a `/api/disponibilita`, una funzione Netlify (`netlify/functions/disponibilita.mts`). Legge **Google Calendar** e, se collegati, i **calendari iCal di Booking.com**: un appartamento prenotato in uno qualsiasi dei due non compare tra i liberi.

- **Google Calendar**: un solo calendario. Ogni prenotazione è un evento il cui **titolo contiene il nome dell'appartamento**: `Gaia 1`, `Gaia 2` o `Gaia 3` (maiuscole o minuscole non importa). Variabili Netlify: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- **Booking.com**: link iCal per appartamento nelle variabili `ICAL_GAIA1`, `ICAL_GAIA2`, `ICAL_GAIA3`.
- Se un calendario collegato non risponde, il sito mostra un errore e invita a scrivere su WhatsApp: un appartamento occupato non appare mai libero.
- Finché non c'è nessun calendario collegato, il sito usa `netlify/dati-prova.json` (lista vuota: tutto libero) e mostra "Disponibilità di prova".

La guida passo passo è in [GUIDA-PUBBLICAZIONE.md](GUIDA-PUBBLICAZIONE.md).

## Mappa

OpenStreetMap: niente cookie e niente chiavi. Si carica solo quando il visitatore arriva alla sezione "Dove siamo". La villa compare quando inserisci le sue coordinate: in Google Maps fai clic destro sull'ingresso e copia i due numeri.

## Provarlo sul computer

Serve Node.js 22 o più recente.

```
npm install
npm run dev
```

Poi apri http://localhost:4321/it/ (italiano), / (inglese), /de/ (tedesco). `npm run check` controlla gli errori nel codice, `npm run build` crea il sito finito.

## Cosa è diverso da Villa Mamma

- Tolte le sezioni solo di Villa Mamma (Starlink, colonnina bici).
- Aggiunta la sezione **La villa** (piscina, giardino, dintorni) con le foto in `src/assets/foto/villa/`.
- Servizi nuovi: TV satellitare, riscaldamento, piscina, terrazza o balcone.
- Il voto viene da FeWo-direkt (4,9 su 5), non da Booking.com.
