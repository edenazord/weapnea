import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useIsMobile";

const PrivacyPolicy = () => {
  const isMobile = useIsMobile();

  const Content = () => (
    <div className="">
      <PageTopBar />
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <PageHeader
          title={"WeApnea – Privacy Policy (UE/GDPR)"}
          subtitle={"Ultimo aggiornamento: 06/10/2025"}
        />

        <div className="prose prose-slate max-w-none">
          <p>
            La presente informativa descrive le modalità di trattamento dei dati personali degli utenti che visitano e utilizzano il sito www.weapnea.com (di seguito “Sito”).
          </p>

          <h3>1. Titolare del Trattamento</h3>
          <p>
            <strong>WeApnea</strong> (progetto sportivo in fase di formalizzazione legale)
            <br />
            📧 Email di contatto: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
            <br />
            📍 Sede legale: Da definire – struttura legale in fase di registrazione.
            <br />
            Questa informativa sarà aggiornata con i dati societari completi alla formalizzazione dell’entità legale (es. società o associazione).
          </p>

          <h3>2. Tipologie di dati trattati</h3>
          <ul>
            <li>
              Dati forniti volontariamente dall’utente tramite form di contatto, email o iscrizione alla newsletter (es. nome, cognome, email, eventuali informazioni legate alla pratica sportiva inserite volontariamente).
            </li>
            <li>Dati di navigazione raccolti automaticamente (IP, browser, device, pagine visitate) a fini statistici e di sicurezza.</li>
            <li>Cookie e tecnologie similari, secondo quanto indicato nella Cookie Policy.</li>
          </ul>

          <h3>3. Finalità del trattamento</h3>
          <ul>
            <li>Rispondere a richieste o contatti dell’utente</li>
            <li>Gestire eventuali iscrizioni a servizi o newsletter (solo con consenso esplicito)</li>
            <li>Gestire community, profili atleta o partecipazione ad attività sportive/eventistiche</li>
            <li>Effettuare analisi statistiche aggregate per migliorare il Sito</li>
            <li>Adempiere ad eventuali obblighi legali in caso di collaborazioni commerciali o sponsorizzazioni</li>
          </ul>

          <h3>4. Basi giuridiche (art. 6 GDPR)</h3>
          <ul>
            <li>Esecuzione di misure contrattuali o precontrattuali su richiesta dell’utente</li>
            <li>Consenso esplicito per finalità di marketing o profilazione</li>
            <li>Legittimo interesse per analisi statistiche anonime e sicurezza del sito</li>
          </ul>

          <h3>5. Conservazione dei dati</h3>
          <p>
            I dati sono conservati per il tempo necessario alla finalità per cui sono stati raccolti o fino a richiesta di cancellazione. I dati utilizzati per finalità promozionali vengono conservati fino alla revoca del consenso.
          </p>

          <h3>6. Comunicazione a terzi</h3>
          <ul>
            <li>Fornitori tecnici (es. hosting, newsletter, strumenti di analytics)</li>
            <li>Partner o sponsor solo previo consenso esplicito dell’utente</li>
            <li>Autorità competenti in caso di obblighi normativi</li>
            <li>Non è previsto trasferimento a terzi per finalità commerciali non autorizzate.</li>
          </ul>

          <h3>7. Diritti dell’utente (artt. 15–22 GDPR)</h3>
          <ul>
            <li>Accedere ai propri dati</li>
            <li>Chiederne rettifica o cancellazione</li>
            <li>Limitare o opporsi al trattamento</li>
            <li>Revocare in qualsiasi momento il consenso prestato</li>
          </ul>
          <p>
            Per esercitare tali diritti: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
          </p>

          <h3>8. Sicurezza</h3>
          <p>
            WeApnea adotta misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita o alterazione.
          </p>

          <h3>9. Minori</h3>
          <p>
            Salvo diversa indicazione, i servizi del Sito sono riservati a utenti maggiorenni. Eventuali dati forniti da minori saranno eliminati su segnalazione.
          </p>

          <h3>10. Modifiche</h3>
          <p>
            La presente informativa può essere aggiornata. Le modifiche rilevanti saranno comunicate sul Sito o via email agli utenti registrati.
          </p>
        </div>
      </div>
    </div>
  );

  return isMobile ? (
    <MobileLayout>
      <Content />
    </MobileLayout>
  ) : (
    <Layout>
      <Content />
    </Layout>
  );
};

export default PrivacyPolicy;
