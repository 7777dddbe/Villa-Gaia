# Guida: mettere online residencevillagaia.com e collegare i calendari

Quattro passi, da fare una volta sola. Servono circa 45 minuti in tutto.

1. Completa i dati mancanti
2. Metti il progetto su GitHub
3. Pubblica su Netlify e collega il dominio
4. Collega Google Calendar e Booking.com

---

## 1. Completa i dati mancanti

Nella cartella del progetto apri un terminale e scrivi:

```
npm run dati-mancanti
```

Ti elenca tutto ciò che è ancora `[DA COMPLETARE]`. **Prima di andare online servono almeno:**

- `sito.json` → `contatti.whatsapp` (solo cifre con prefisso, es. `393331234567`) e `contatti.email`
- `prezzi.json` → i prezzi e i periodi veri (quelli di adesso sono di esempio)
- le foto degli appartamenti in `src/assets/foto/gaia1`, `gaia2`, `gaia3`

Il resto (metrature, coordinate, recensioni...) si può aggiungere anche dopo: le etichette gialle `[DA COMPLETARE]` restano visibili sul sito finché il dato manca.

---

## 2. Metti il progetto su GitHub

Netlify pubblica il sito leggendolo da GitHub. Ogni volta che cambi un file su GitHub, il sito si aggiorna da solo in un paio di minuti.

1. Crea un account gratuito su https://github.com.
2. Installa **GitHub Desktop** (https://desktop.github.com) ed entra con l'account.
3. In GitHub Desktop: *File → Add local repository* → scegli la cartella `T:\Villa Gaia\Website` → quando lo chiede, *create a repository*.
4. Premi **Publish repository**. Lascia spuntato **Keep this code private**.

Il file `.gitignore` esclude già le cartelle pesanti e il file `.env` con le chiavi.

---

## 3. Pubblica su Netlify e collega il dominio

### Pubblicare

1. Crea un account gratuito su https://www.netlify.com ed entra con GitHub.
2. **Add new site → Import an existing project → GitHub** → scegli il repository del sito.
3. Netlify legge da solo le impostazioni dal file `netlify.toml` (comando `npm run build`, cartella `dist`, funzioni in `netlify/functions`). Premi **Deploy**.
4. Dopo 1-2 minuti il sito è online a un indirizzo tipo `qualcosa.netlify.app`. Provalo da telefono.

### Collegare residencevillagaia.com

1. Su Netlify: **Domain management → Add a domain** → scrivi `residencevillagaia.com`.
2. Netlify ti mostra cosa impostare dal tuo registrar (dove hai comprato il dominio). Hai due strade:
   - **più semplice:** usa i *nameserver* di Netlify (Netlify DNS) e copiali nel pannello del registrar;
   - **oppure** lascia i DNS dove sono e aggiungi i record che Netlify indica (un record `A` per `residencevillagaia.com` e un `CNAME` per `www`).
3. Il certificato HTTPS (il lucchetto) Netlify lo attiva da solo, gratis, appena il dominio risponde. Può servire fino a qualche ora.

---

## 4. Collega Google Calendar e Booking.com

Il sito legge **un solo calendario Google**. Ogni prenotazione è un evento il cui titolo contiene il nome dell'appartamento: `Gaia 1`, `Gaia 2` o `Gaia 3`. Esempi: "Gaia 1 - famiglia Müller", "gaia 3 Rossi 4 pers.".

- Un evento di tutto il giorno dal giorno di arrivo al giorno di partenza va benissimo. Il giorno di partenza resta prenotabile da chi arriva.
- Un evento che nomina due appartamenti ("Gaia 2 + Gaia 3") li blocca tutti e due.
- Gli eventi senza nome di appartamento vengono ignorati.

Per leggerlo, il sito usa un **account di servizio** Google: un "utente robot" che può solo guardare quel calendario.

### 4a. Il calendario

1. In Google Calendar, a sinistra: **Altri calendari → + → Crea nuovo calendario** → nome "Villa Gaia prenotazioni".
2. Apri le **Impostazioni** di quel calendario → sezione **Integra calendario** → copia l'**ID calendario** (finisce con `@group.calendar.google.com`).

### 4b. L'account di servizio

1. Vai su https://console.cloud.google.com, entra con lo stesso account Google e crea un **nuovo progetto** ("Villa Gaia sito").
2. Menu **API e servizi → Libreria** → cerca **Google Calendar API** → **Abilita**.
3. Menu **IAM e amministrazione → Account di servizio → Crea account di servizio**. Nome "sito-villagaia", poi **Fine**: non servono ruoli.
4. Apri l'account appena creato → scheda **Chiavi → Aggiungi chiave → Crea nuova chiave → JSON**. Si scarica un file `.json`: **tienilo privato**, è la password del robot.
5. Copia l'**email dell'account di servizio** (tipo `sito-villagaia@...iam.gserviceaccount.com`).

### 4c. Dare al robot il permesso di guardare

1. Torna nelle **Impostazioni** del calendario "Villa Gaia prenotazioni".
2. **Condividi con persone e gruppi specifici → Aggiungi persone** → incolla l'email dell'account di servizio.
3. Permesso: **Visualizzare tutti i dettagli degli eventi**. Invia.

### 4d. Le chiavi su Netlify

Su Netlify: **Site configuration → Environment variables → Add a variable**. Crea queste tre:

| Nome | Valore |
|---|---|
| `GOOGLE_CALENDAR_ID` | l'ID calendario del punto 4a |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | il campo `client_email` del file JSON |
| `GOOGLE_PRIVATE_KEY` | il campo `private_key` del file JSON, tutto, da `-----BEGIN PRIVATE KEY-----` a `-----END PRIVATE KEY-----` |

Spunta **Contains secret values** e, se l'opzione c'è, limita le variabili alle **Functions**. Poi **Deploys → Trigger deploy → Deploy site**.

Le chiavi stanno solo su Netlify: non vanno mai scritte nei file del sito né caricate su GitHub.

### 4e. Verifica

Apri nel browser (cambia le date con date vere della stagione):

```
https://residencevillagaia.com/api/disponibilita?checkin=2027-06-12&checkout=2027-06-16
```

Deve rispondere con `"fonte":"google"` (con anche Booking collegato, ad esempio `"fonte":"google+booking-gaia1+booking-gaia2+booking-gaia3"`). Sul sito sparisce l'etichetta gialla "Disponibilità di prova".

Se compare un errore, su Netlify apri **Logs → Functions → disponibilita**: il messaggio dice quale calendario non ha risposto (`google`, `booking-gaia1`...) e perché. Per Google di solito è il calendario non condiviso con il robot o l'API non abilitata.

### Prenotazioni da Booking.com

Il sito legge da solo anche le prenotazioni di Booking: non serve copiarle in Google Calendar. Booking fornisce per ogni appartamento un **link iCal** (un indirizzo che finisce con `.ics`) con tutte le date occupate. Basta darlo al sito, una volta sola.

**Trovare il link nell'extranet di Booking** (https://admin.booking.com):

1. Apri **Tariffe e disponibilità → Sincronizza calendari**.
2. Accanto all'appartamento (Gaia 1, Gaia 2 o Gaia 3) scegli **Aggiungi connessione calendario**, oppure apri la connessione che c'è già.
3. Nella parte **Esporta calendario** copia il link (pulsante **Copia**). Non serve importare niente.
4. Ripeti per gli altri appartamenti. Se su Booking i tre appartamenti sono strutture separate, cambia struttura in alto e rifai i passi.

Le voci possono avere nomi un po' diversi a seconda della versione dell'extranet: cerca sempre "Sincronizza calendari" ed "Esporta".

**Metterlo su Netlify:** **Site configuration → Environment variables → Add a variable**, una per appartamento:

| Nome | Valore |
|---|---|
| `ICAL_GAIA1` | il link di Gaia 1 |
| `ICAL_GAIA2` | il link di Gaia 2 |
| `ICAL_GAIA3` | il link di Gaia 3 |

Spunta **Contains secret values**: chi ha il link vede le tue date occupate. Un appartamento che non è su Booking si lascia semplicemente senza variabile. Poi **Deploys → Trigger deploy → Deploy site** e verifica come al punto 4e.

**Da sapere:**

- Funziona anche senza Google Calendar: bastano i link di Booking.
- Contano anche i giorni che chiudi a mano su Booking: per il sito sono occupati.
- Il sito rilegge i link al massimo ogni 5 minuti, e Booking aggiorna il suo calendario con qualche minuto di ritardo. Una prenotazione appena arrivata può quindi comparire sul sito dopo un po'.
- Se Booking non risponde, il sito non mostra appartamenti liberi "a caso": dà un errore e invita a scrivere su WhatsApp.
- Le prenotazioni dirette (WhatsApp, email) continuano ad andare in Google Calendar. Se vuoi che blocchino anche Booking, nella stessa pagina **Sincronizza calendari** puoi importare in Booking il link iCal segreto di Google Calendar (Google Calendar → Impostazioni del calendario → **Indirizzo segreto in formato iCal**).

---

## Dopo la pubblicazione

- **Cambiare prezzi, testi o foto:** modifica i file su GitHub (anche dal sito github.com, matita ✏️ → *Commit changes*). Netlify ripubblica da solo.
- **Google:** in https://search.google.com/search-console aggiungi `residencevillagaia.com` e invia la sitemap `https://residencevillagaia.com/sitemap.xml`. Le tre lingue sono già collegate tra loro.
- **Privacy:** il sito non usa cookie né statistiche, quindi niente banner. Conviene comunque una breve informativa privacy (contatti via WhatsApp ed email, mappa OpenStreetMap). Il testo va fatto controllare da chi segue i tuoi adempimenti.
