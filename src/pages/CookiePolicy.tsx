import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useIsMobile";

const CookiePolicy = () => {
  const isMobile = useIsMobile();

  const Content = () => (
    <div className="">
      <PageTopBar />
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <PageHeader
          title={"WeApnea – Cookie Policy (UE/GDPR)"}
          subtitle={"Ultimo aggiornamento: 06/10/2025"}
        />

        <div className="prose prose-slate max-w-none">
          <h3>1. Cosa sono i cookie</h3>
          <p>
            I cookie sono piccoli file salvati nel dispositivo dell’utente per migliorare la navigazione e abilitare determinate funzionalità.
          </p>

          <h3>2. Tipologie di cookie utilizzati</h3>
          <ul>
            <li><strong>Tecnici / Necessari</strong>: funzionamento del sito (es. lingua, login) – non richiedono consenso.</li>
            <li><strong>Statistici (anonimizzati)</strong>: analisi visite (es. Google Analytics con IP anonimizzato) – richiedono consenso.</li>
            <li><strong>Marketing / Profilazione</strong>: remarketing e personalizzazione contenuti – richiedono consenso.</li>
          </ul>

          <h3>3. Gestione del consenso</h3>
          <p>
            Al primo accesso viene mostrato un banner cookie che consente di accettare tutti i cookie, rifiutare quelli non necessari o gestire le preferenze. L’utente può modificare le preferenze in ogni momento tramite browser o tramite un link “Impostazioni Cookie” presente nel Sito.
          </p>

          <h3>4. Disabilitazione tramite browser</h3>
          <p>
            L’utente può gestire i cookie dalle impostazioni del proprio browser (Chrome, Firefox, Safari, ecc.). La disattivazione dei cookie tecnici può compromettere alcune funzionalità del Sito.
          </p>

          <h3>5. Strumenti di terza parte</h3>
          <p>
            Il Sito può utilizzare servizi esterni come Google Analytics o pixel social. In caso di cookie marketing, questi vengono attivati solo previo consenso esplicito.
          </p>

          <h3>6. Contatti</h3>
          <p>
            Per chiarimenti o richieste sulla gestione dei dati o dei cookie: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
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

export default CookiePolicy;
