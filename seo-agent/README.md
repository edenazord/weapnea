# SEO Agent – WeApnea

Tool automatico che analizza le performance SEO del sito WeApnea, decide quali meta tag modificare (title e description per pagina e per lingua), applica le modifiche e poi misura se hanno funzionato, salvando tutto in una memoria storica.

## Obiettivo

1. Leggere i dati di performance da **Google Search Console** (clic, impressioni, CTR, posizione, query).
2. Chiedere a **DeepSeek** di proporre modifiche ai meta tag, passando dati attuali e storico.
3. Applicare le modifiche tramite l'API admin del backend (`PUT /api/admin/seo-settings`).
4. Valutare dopo qualche settimana se la modifica ha migliorato o peggiorato i risultati.
5. Salvare l'esito in una **memoria storica**, così le decisioni successive tengono conto di ciò che ha funzionato e di ciò che non ha funzionato.

## Come funziona

```mermaid
flowchart LR
  GSC[Google Search Console] -->|metriche e query 28 giorni| AGENT[seo-agent]
  API[Backend WeApnea seo_settings] -->|meta attuali| AGENT
  MEM[(data/memory)] -->|storico e esiti| AGENT
  AGENT -->|prompt JSON| DS[DeepSeek API]
  DS -->|modifiche proposte| AGENT
  AGENT -->|validazione e PUT| API
  AGENT -->|actions e evaluations| MEM
```

Il ciclo è composto dai comandi principali (vedi [Comandi](#comandi)). Il workflow GitHub esegue `cron` in automatico: le sezioni collaborano tra loro e inviano un solo messaggio WhatsApp per run (vedi [Automazioni](#automazioni-cron)).

- `run`: raccoglie i dati, chiede a DeepSeek le modifiche, le valida e le mostra. Con `--apply` le scrive davvero. Senza `--apply` è un dry-run e salva solo una proposta.
- `evaluate`: per ogni modifica applicata da almeno `SEO_EVAL_DAYS` giorni confronta le metriche prima e dopo, assegna un verdetto (`migliorato`, `peggiorato`, `neutro`, `dati-insufficienti`) e chiede a DeepSeek una lezione sintetica. Con `SEO_AUTO_ROLLBACK=true` (default) ripristina i valori precedenti in caso di peggioramento, salvo che la pagina abbia modifiche successive.
- `history`: stampa lo storico delle modifiche con esito e lezione.
- `report`: andamento a 28 giorni e 12 settimane, esiti delle modifiche e controlli tecnici (sitemap e indicizzazione delle pagine statiche).

### Come decide se una modifica è giusta o sbagliata

Il verdetto è calcolato con regole sulle metriche, non dal modello:

| Verdetto             | Regola                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `dati-insufficienti` | meno di 60 impressioni complessive nei due periodi (`SEO_MIN_IMPRESSIONS`, default 30 per periodo)    |
| `peggiorato`         | clic in calo di oltre il 15% (con almeno 10 clic prima) oppure posizione media peggiorata di oltre 1,5 |
| `migliorato`         | clic in crescita di oltre il 15% (e almeno 3 clic in più) oppure posizione migliorata di oltre 1,5     |
| `neutro`             | nessuna delle condizioni sopra                                                                         |

DeepSeek riceve metriche e verdetto e scrive una lezione (`was_right` e `lesson`). Questa lezione torna nei prompt successivi insieme allo storico della pagina, così il modello evita di ripetere approcci già falliti.

Nei prompt di decisione ogni pagina riceve anche `ctrExpected` (CTR indicativa per la sua posizione media) e `ctrGap` (differenza in punti percentuali). Un `ctrGap` negativo segnala un titolo che non attira clic rispetto alla posizione occupata. La tabella di riferimento è una stima generica, non dati del sito.

**Limite importante:** la correlazione non è causalità. Stagionalità, aggiornamenti di Google o altri contenuti possono cambiare i numeri senza che il meta tag c'entri. Per questo il periodo di valutazione è di 21 giorni per default e il tool non applica modifiche automatiche senza `--apply`.

## Come si integra con il sito

- Le pagine statiche leggono title e description dalla tabella `seo_settings` tramite `GET /api/public/seo-settings` (vedi [PageHead.tsx](../src/components/PageHead.tsx) e [useSeoSettings.ts](../src/hooks/useSeoSettings.ts)).
- Le traduzioni sono salvate nel campo `translations` per lingua. L'italiano è nei campi `title` e `description`.
- Il backend espone `GET` e `PUT /api/admin/seo-settings`, protetti da `Authorization: Bearer <API_TOKEN>`.
- Il title non deve includere il brand "WeApnea", perché `PageHead` lo aggiunge in automatico.
- Le modifiche sono visibili subito nel frontend (cache di 10 minuti nel client). I bot ricevono i meta tramite `/api/seo-meta`.

## Struttura della cartella

```
seo-agent/
  README.md            questa documentazione
  package.json         script npm (nessuna dipendenza esterna)
  .gitignore           esclude .env, secrets/, data/proposals/, data/cron.log, docs/
  src/
    index.mjs          CLI: run, evaluate, cron, report, monitor, opportunities, content, indexing, analytics, overview, history
    content.mjs        idee contenuti settimanali (blog, query GSC, Wikipedia, autocomplete, GA4) e invio WhatsApp
    sources.mjs        fonti pubbliche senza chiave: visite Wikipedia e suggerimenti di ricerca Google
    indexing.mjs       controllo di indicizzazione delle URL della sitemap (URL Inspection API)
    analytics.mjs      report mensile: pagine più visitate (GA4) e Core Web Vitals reali (CrUX)
    overview.mjs       snapshot della panoramica SEO mostrata nell'admin (GSC, GA4, CrUX, sitemap, indicizzazione, bot)
    agent.mjs          logica: raccolta, decisione, validazione, applicazione, valutazione
    technical.mjs      controlli tecnici: sitemap e URL Inspection su Search Console
    sitemap.mjs        lettura e parsing della sitemap pubblica
    monitor.mjs        controlli tecnici periodici con avvisi WhatsApp per i problemi nuovi
    opportunities.mjs  query vicine alla prima pagina e query contese tra più pagine
    prompt.mjs         prompt per DeepSeek (decisione e valutazione)
    google.mjs         client Search Console (autenticazione service account)
    deepseek.mjs       client DeepSeek (output JSON)
    site-api.mjs       client API admin del backend
    memory.mjs         memoria storica su file JSONL
    config.mjs         configurazione da variabili d'ambiente
  data/                creato automaticamente
    memory/
      actions.jsonl       ogni modifica applicata (prima e dopo, motivo, stato)
      evaluations.jsonl   esito di ogni modifica (metriche, verdetto, lezione)
      sitemap-snapshot.json   vecchia lastmod della sitemap (non più usato dal cron)
      monitor-state.json      problemi tecnici già segnalati nel gruppo
      indexing-state.json     pagine non indicizzate già segnalate, con il loro stato Google
      analytics-state.json    mese dell'ultimo report inviato
      content-state.json      data dell'ultimo messaggio di idee contenuti
    proposals/            proposte di ogni run (anche dry-run), per audit
```

## Setup

Requisiti: Node.js 20.6 o superiore (usa `--env-file`). Nessuna dipendenza da installare.

1. **Google Search Console**
   - In Google Cloud crea un progetto, abilita la _Search Console API_ e crea un _service account_.
   - Scarica la chiave JSON e salvala in `seo-agent/secrets/service-account.json`.
   - In Search Console, nella property del sito, aggiungi l'email del service account con permesso **Completo**. Il permesso di sola lettura non basta: il reinvio della sitemap è una scrittura.
2. **DeepSeek**: crea una API key su platform.deepseek.com.
3. **Backend**: usa lo stesso valore di `API_TOKEN` impostato su Render.
4. Crea `seo-agent/.env` con le variabili della tabella sotto. Il file non va committato.
5. **PageSpeed** (opzionale): `PAGESPEED_API_KEY`. Senza chiave le richieste condividono una quota giornaliera che si esaurisce in fretta; in quel caso il monitor avvisa nei log e salta il controllo.

### Variabili d'ambiente

| Variabile                                                 | Obbligatoria per       | Descrizione                                                                             |
| --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `API_TOKEN`                                               | run, cron, sync        | token admin del backend                                                                 |
| `GOOGLE_SERVICE_ACCOUNT_FILE`                             | run, cron, report, monitor, opportunities | percorso della chiave JSON del service account                       |
| `DEEPSEEK_API_KEY`                                        | run, cron, evaluate    | API key DeepSeek                                                                        |
| `API_BASE_URL`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`     | no                     | override degli endpoint e del modello                                                   |
| `GSC_SITE_URL`                                            | no                     | proprietà Search Console (default `sc-domain:weapnea.com`)                              |
| `PUBLIC_BASE_URL`                                         | no                     | dominio pubblico usato per sitemap e monitor (default `https://www.weapnea.com`)        |
| `PAGESPEED_API_KEY`                                       | no                     | chiave PageSpeed Insights, evita la quota condivisa                                     |
| `GA4_PROPERTY_ID`                                         | no (report mensile)    | ID numerico della proprietà Google Analytics 4. Il service account deve avere accesso Viewer |
| `CRUX_API_KEY`                                            | no (report mensile)    | API key di Chrome UX Report, con restrizione alla sola "Chrome UX Report API"           |
| `BOT_API_URL`, `BOT_API_TOKEN`, `BOT_GROUP_JID`           | no (avvisi WhatsApp)   | bot WhatsApp e gruppo di destinazione dei recap e degli avvisi                          |
| `SEO_ALLOWED_PATHS`, `SEO_LANGUAGES`                      | no                     | path modificabili e lingue supportate                                                   |
| `SEO_MAX_CHANGES_PER_RUN`, `SEO_BATCH_SIZE`, `SEO_RUN_BUDGET_MINUTES` | no                | limiti per run                                                                       |
| `SEO_MIN_IMPRESSIONS`, `SEO_EVAL_DAYS`, `SEO_AUTO_ROLLBACK` | no                   | soglie di valutazione e rollback                                                        |
| `SEO_CONTENT_INTERVAL_DAYS`                               | no                     | intervallo in giorni tra due messaggi di idee contenuti (default 7)                     |

### Secret GitHub per il cron

Il workflow `.github/workflows/seo-agent.yml` legge questi secret: `SEO_API_TOKEN` (mappato su `API_TOKEN`), `DEEPSEEK_API_KEY`, `GOOGLE_SA_JSON` (scritto in `secrets/service-account.json`), `BOT_API_TOKEN`, `BOT_GROUP_JID`, `PAGESPEED_API_KEY` (opzionale), `CRUX_API_KEY` (opzionale). `GA4_PROPERTY_ID` è una variabile del repository (`vars.GA4_PROPERTY_ID`), non un segreto.

## Comandi

Eseguili dalla cartella `seo-agent`:

```bash
npm run run        # dry-run: analizza e salva una proposta, non modifica nulla
npm run apply      # applica le modifiche proposte
npm run evaluate   # valuta le modifiche applicate abbastanza vecchie
npm run history    # storico con esiti
node --env-file=.env src/index.mjs monitor        # controlli tecnici; avvisa nel gruppo solo i problemi nuovi
node --env-file=.env src/index.mjs opportunities  # query in posizione 4–15 e query contese tra pagine
node --env-file=.env src/index.mjs content        # anteprima delle idee contenuti: non invia nulla e non salva lo stato
node --env-file=.env src/index.mjs indexing       # stampa le URL non indicizzate da Google: non invia nulla e non salva lo stato
node --env-file=.env src/index.mjs analytics      # stampa il report mensile: non invia nulla
npm run overview                                  # stampa lo snapshot della panoramica SEO: non lo salva nel backend
```

Consiglio: esegui prima `npm run run` e controlla la proposta in `data/proposals/`. Passa ad `apply` solo quando i risultati ti convincono.

## Automazioni (cron)

Il workflow `.github/workflows/seo-agent.yml` esegue `cron` alle 08:00 e alle 18:00 UTC. Prima dei passi qui sotto girano il monitor tecnico e il controllo di indicizzazione, descritti nella lista dettagliata. In ordine:

1. **Ottimizzazione** dei meta tag (`runOptimization` in modalità apply) e valutazione delle modifiche vecchie.
2. **Reinvio sitemap** a Search Console: solo se Google non l'ha riscaricata da più di 3 giorni.
Il monitor e il controllo di indicizzazione girano per primi, così i loro risultati servono anche agli altri passi:

1. **Monitor tecnico**: verifica che ogni URL della sitemap risponda 200, che `robots.txt` contenga la riga `Sitemap:`, che il dominio senza www faccia un redirect permanente (301 o 308) verso www, e le prestazioni mobile della home con PageSpeed (punteggio sotto 50 o LCP sopra 4 s). Non invia nulla da solo.
2. **Indicizzazione**: ispeziona ogni URL della sitemap con l'URL Inspection API di Search Console (5 richieste in parallelo). Le pagine non indicizzate (verdict diverso da `PASS`) con uno stato tecnico (duplicato, canonical diversa, redirect, soft 404, noindex, non trovata) vengono escluse dall'ottimizzazione, perché title e description non le risolvono. Segnala nel digest solo le pagine non indicizzate il cui stato è cambiato rispetto all'ultima segnalazione, così non si ripete lo stesso avviso ogni 12 ore. Il primo run registra lo stato attuale in silenzio, senza avvisi: da lì in poi segnala solo i cambiamenti. Per vedere l'elenco completo usare il comando `indexing`.
3. **Ottimizzazione**: le pagine con un problema di status (URL della sitemap che non risponde 200) o con uno stato tecnico di indicizzazione vengono escluse dal run e riportate in `technicalSkipped`. Per ogni pagina candidata l'agente riceve le sue opportunità (query in posizione 4–15 e query contese con altre pagine) e, se GA4 è configurato, le visite reali degli ultimi 28 giorni (`ga4`), così può usarle nei title e nelle description.
4. **Valutazione** delle modifiche precedenti e **recap** del progresso.
5. **Reinvio sitemap** a Search Console, se necessario.
6. **Opportunità**: stampa nei log le query da spingere e quelle contese tra più pagine.
7. **Digest WhatsApp**: un solo messaggio nel gruppo per run, che unisce pagine aggiornate, sitemap reinviata, nuovi problemi tecnici, pagine non indicizzate e pagine saltate. Se non c'è nulla da segnalare, non invia niente.

8. **Idee contenuti** (una volta a settimana, `SEO_CONTENT_INTERVAL_DAYS`, default 7): il tool legge gli articoli già pubblicati nel blog in tutte le lingue e le query di Search Console con almeno 10 impressioni negli ultimi 28 giorni. Aggiunge tre segnali facoltativi: visite alle voci Wikipedia su apnea/freediving (ultimi 30 giorni contro i 30 precedenti), suggerimenti di completamento di Google per lingua e le pagine più visitate su GA4. DeepSeek propone al massimo 3 argomenti che non duplicano articoli esistenti, con un titolo per ciascuna delle 6 lingue del sito. Il messaggio WhatsApp è solo un suggerimento: il sito non viene modificato e non vengono scritte bozze. Il primo invio avviene al primo cron dopo il deploy; lo stato è in `data/memory/content-state.json`, e viene salvato solo dopo un invio riuscito. Se una fonte non risponde, le idee si generano con le altre.
9. **Report mensile** (una volta al mese, al primo cron del mese): pagine più visitate negli ultimi 28 giorni da GA4 e Core Web Vitals reali su mobile (LCP, INP, CLS, p75) da CrUX. Se né `GA4_PROPERTY_ID` né `CRUX_API_KEY` sono impostate, non invia nulla. CrUX risponde 404 quando il sito non ha abbastanza traffico Chrome: in quel caso la sezione viene omessa.
10. **Panoramica SEO** (ad ogni run del cron, alla fine): costruisce lo snapshot mostrato nella sezione SEO dell'admin e lo salva nel backend con `PUT /api/admin/seo-overview`. Riusa il risultato del controllo di indicizzazione del run, senza fare altre chiamate a URL Inspection. Non invia nulla su WhatsApp. Se il backend non accetta il salvataggio (per esempio perché l'endpoint non è ancora stato deployato), emette un `::warning::` e il cron continua.

Fonti senza chiave usate solo per le idee contenuti: Wikipedia (pageviews) e il suggerimento di ricerca Google. Il suggerimento di Google non è un'API documentata e può cambiare o essere limitato; i seed sono specifici per lingua perché "apnea" da solo in italiano porta soprattutto ad "apnea notturna".

Lo stato del monitor e quello dell'indicizzazione (problemi già segnalati) si salvano solo dopo un invio riuscito: se WhatsApp fallisce, i problemi vengono riproposti al run successivo.

Ogni passo accessorio (monitor, indicizzazione, sitemap, digest) è protetto: se fallisce emette un `::warning::` e il cron continua.

Limiti del monitor: lo SPA risponde 200 anche per le pagine inesistenti (fallback su `/`), quindi il controllo degli status trova soprattutto errori 5xx e redirect inattesi, non le pagine vuote.

## Panoramica SEO nell'admin

La sezione SEO dell'admin è in sola lettura. Non modifica più title, description e immagini OG per pagina: quelle le gestisce il bot. Mostra lo snapshot generato dal cron:

- Search Console: clic, impressioni, CTR e posizione media negli ultimi 28 giorni (con ritardo di 3 giorni), confrontati con i 28 precedenti. Top query e top pagine.
- GA4: sessioni, utenti attivi e pagine più visitate negli ultimi 28 giorni.
- Core Web Vitals reali (CrUX, mobile, p75), quando il sito ha abbastanza traffico.
- Sitemap: URL inviate e indicizzate, errori, ultimo download. Il conteggio degli indicizzati viene da Google e può restare a 0 per un po'.
- Indicizzazione: pagine controllate, indicizzate, non indicizzate e con problemi tecnici, con canonical dichiarata e canonical scelta da Google.
- Bot: ultimo run, modifiche applicate, valutazioni ed esiti, più l'attività del bot.

Lo snapshot è un unico record nella tabella `seo_overview` del backend, sovrascritto ad ogni run. L'admin lo legge con `GET /api/admin/seo-overview`. Se il cron non ha ancora girato, la sezione mostra uno stato vuoto. Il blocco GTM / GA4 / Search Console in fondo alla sezione resta modificabile, come prima.

## Sicurezza e controlli

- **Dry-run di default**: i comandi a mano non scrivono nulla sul sito senza `--apply`. Il cron del workflow invece applica le modifiche in automatico (`runOptimization({ apply: true })`), con gli stessi limiti e lo stesso rollback.
- **Allow-list**: il tool modifica solo i path in `SEO_ALLOWED_PATHS` e solo i campi `title` e `description`.
- **Validazione**: lunghezze (title 20–60, description 50–160), lingue supportate, valori non vuoti e diversi dall'attuale. Le modifiche scartate compaiono nella proposta con il motivo.
- **Limite per run**: massimo `SEO_MAX_CHANGES_PER_RUN` modifiche (default 5), contate su tutti i gruppi insieme. Il resto dei target passa al run successivo. Ogni lingua e ogni campo contano come una modifica: il primo recupero delle traduzioni del blog richiede più run (o un valore più alto della variabile).
- **Soglia di dati**: nessuna modifica per pagine con poche impressioni (il prompt lo impone, la valutazione lo richiede).
- **Rollback**: attivo di default (`SEO_AUTO_ROLLBACK=true`). Ripristina i valori precedenti se il verdetto è `peggiorato`. Non ripristina se la pagina ha ricevuto modifiche successive, per non cancellare il lavoro più recente. Imposta `SEO_AUTO_ROLLBACK=false` per la sola revisione manuale.
- **Brand nel title**: un title che contiene "WeApnea" viene scartato, perché il sito lo aggiunge da sé.
- **Segreti**: `.env` e `secrets/` sono nel `.gitignore`. Non committare mai le chiavi.

## Limiti attuali

- Copre le pagine statiche di `seo_settings`, gli articoli del blog (`/blog/<slug>`) e gli eventi (`/<slug>`): tutti salvati in `seo_settings` per path, con traduzioni. Gli articoli del blog hanno le traduzioni di title e description in tutte le lingue del sito (`SEO_LANGUAGES`), come gli eventi. Ogni run è limitato da `SEO_MAX_CHANGES_PER_RUN` e dal budget di tempo (`SEO_RUN_BUDGET_MINUTES`, default 40); i target rimasti passano al run successivo.
- Non modifica sitemap, robots, og_image, dati strutturati o contenuti delle pagine: solo meta tag. L'unica scrittura sulla sitemap è il reinvio a Search Console (vedi sotto).
- **Filtri della sitemap** (`/sitemap.xml` in `server/index.cjs`): include gli eventi solo se la data è oggi o futura, e i profili solo se la bio ha almeno 80 caratteri. Le pagine escluse restano raggiungibili dal sito. Soglia modificabile in quel punto del codice.
- **Reinvio sitemap:** a ogni `cron` il tool reinvia `sitemap.xml` se Google non l'ha riscaricata da più di 3 giorni. Usa lo scope `webmasters` (scrittura), separato dallo scope di sola lettura del resto. Il service account deve avere il permesso Completo sulla proprietà.
- Google Search Console ha un ritardo di 2–3 giorni: il tool usa come ultimo giorno disponibile oggi meno 3.
- La prima valutazione utile arriva dopo circa 3 settimane. Serve tempo per avere campioni significativi.
- Il cron gira due volte al giorno su GitHub Actions. Per eseguire i comandi a mano serve il file `.env` locale.
- **Bing Webmaster**: il reinvio della sitemap a Bing non è implementato. Le API legacy di Bing Webmaster si ritirano il 31/08/2026 e la REST che le sostituisce non è ancora verificata. IndexNow è stato rimosso dal cron perché la chiave restituiva 403 `UserForbiddedToAccessSite`.
- **Redirect del dominio senza www**: `weapnea.com` risponde 308 verso `www.weapnea.com`, impostato via API Vercel (`PATCH /v9/projects/{project}/domains/{domain}` con `redirectStatusCode`), perché la dashboard non permette di scegliere il codice. Se il monitor segnala di nuovo il problema, ripetere la chiamata.

## Prossimi passi possibili

- Estendere il tool agli articoli del blog (`seo_title`, `seo_description`).
- Aggiungere il reinvio della sitemap a Bing Webmaster, quando la API REST è verificata.
- Aggiungere dati strutturati per gli eventi (JSON-LD).
- Aggiungere una vista di riepilogo nella dashboard admin.
- Integrare dati SEM (Google Ads) per confrontare parole chiave a pagamento e organiche.
