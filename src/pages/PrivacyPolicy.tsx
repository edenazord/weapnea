import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Shield, ListOrdered, CalendarDays } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";

const PrivacyPolicy = () => {
  const isMobile = useIsMobile();

  const Content = () => (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <PageHeader
          title={"WeApnea – Privacy Policy (UE/GDPR)"}
          subtitle={"Ultimo aggiornamento: 06/10/2025"}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
                <ListOrdered className="h-4 w-4" />
                Indice
              </div>
              <nav className="space-y-2 text-sm">
                <a className="block hover:text-blue-700" href="#titolare">1. Titolare del Trattamento</a>
                <a className="block hover:text-blue-700" href="#tipologie">2. Tipologie di dati trattati</a>
                <a className="block hover:text-blue-700" href="#finalita">3. Finalità del trattamento</a>
                <a className="block hover:text-blue-700" href="#basi">4. Basi giuridiche</a>
                <a className="block hover:text-blue-700" href="#conservazione">5. Conservazione dei dati</a>
                <a className="block hover:text-blue-700" href="#terzi">6. Comunicazione a terzi</a>
                <a className="block hover:text-blue-700" href="#diritti">7. Diritti dell’utente</a>
                <a className="block hover:text-blue-700" href="#sicurezza">8. Sicurezza</a>
                <a className="block hover:text-blue-700" href="#minori">9. Minori</a>
                <a className="block hover:text-blue-700" href="#modifiche">10. Modifiche</a>
              </nav>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <CalendarDays className="h-4 w-4" />
                06/10/2025
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-9">
            <div className="bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl shadow-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4 text-blue-700">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Informativa Privacy</span>
              </div>
              <div className="prose prose-slate max-w-none">
                <p>
                  La presente informativa descrive le modalità di trattamento dei dati personali degli utenti che visitano e utilizzano il sito www.weapnea.com (di seguito “Sito”).
                </p>

                {/* Accordion Sections */}
                <PrivacyAccordion />
              </div>
            </div>
          </main>
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

// Accordion component to keep main render tidy
function PrivacyAccordion() {
  const [open, setOpen] = useState<string | undefined>("titolare");
  useEffect(() => {
    try {
      const hash = window.location?.hash?.replace('#','');
      if (hash) setOpen(hash);
    } catch (e) {
      // no-op
    }
  }, []);
  return (
    <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
      <AccordionItem value="titolare">
        <AccordionTrigger id="titolare">1. Titolare del Trattamento</AccordionTrigger>
        <AccordionContent>
          <p>
            <strong>WeApnea</strong> (progetto sportivo in fase di formalizzazione legale)
            <br />
            📧 Email di contatto: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
            <br />
            📍 Sede legale: Da definire – struttura legale in fase di registrazione.
            <br />
            Questa informativa sarà aggiornata con i dati societari completi alla formalizzazione dell’entità legale (es. società o associazione).
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="tipologie">
        <AccordionTrigger id="tipologie">2. Tipologie di dati trattati</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li>
              Dati forniti volontariamente dall’utente tramite form di contatto, email o iscrizione alla newsletter (es. nome, cognome, email, eventuali informazioni legate alla pratica sportiva inserite volontariamente).
            </li>
            <li>Dati di navigazione raccolti automaticamente (IP, browser, device, pagine visitate) a fini statistici e di sicurezza.</li>
            <li>Cookie e tecnologie similari, secondo quanto indicato nella Cookie Policy.</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="finalita">
        <AccordionTrigger id="finalita">3. Finalità del trattamento</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li>Rispondere a richieste o contatti dell’utente</li>
            <li>Gestire eventuali iscrizioni a servizi o newsletter (solo con consenso esplicito)</li>
            <li>Gestire community, profili atleta o partecipazione ad attività sportive/eventistiche</li>
            <li>Effettuare analisi statistiche aggregate per migliorare il Sito</li>
            <li>Adempiere ad eventuali obblighi legali in caso di collaborazioni commerciali o sponsorizzazioni</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="basi">
        <AccordionTrigger id="basi">4. Basi giuridiche (art. 6 GDPR)</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li>Esecuzione di misure contrattuali o precontrattuali su richiesta dell’utente</li>
            <li>Consenso esplicito per finalità di marketing o profilazione</li>
            <li>Legittimo interesse per analisi statistiche anonime e sicurezza del sito</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="conservazione">
        <AccordionTrigger id="conservazione">5. Conservazione dei dati</AccordionTrigger>
        <AccordionContent>
          <p>
            I dati sono conservati per il tempo necessario alla finalità per cui sono stati raccolti o fino a richiesta di cancellazione. I dati utilizzati per finalità promozionali vengono conservati fino alla revoca del consenso.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="terzi">
        <AccordionTrigger id="terzi">6. Comunicazione a terzi</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li>Fornitori tecnici (es. hosting, newsletter, strumenti di analytics)</li>
            <li>Partner o sponsor solo previo consenso esplicito dell’utente</li>
            <li>Autorità competenti in caso di obblighi normativi</li>
            <li>Non è previsto trasferimento a terzi per finalità commerciali non autorizzate.</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="diritti">
        <AccordionTrigger id="diritti">7. Diritti dell’utente (artt. 15–22 GDPR)</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li>Accedere ai propri dati</li>
            <li>Chiederne rettifica o cancellazione</li>
            <li>Limitare o opporsi al trattamento</li>
            <li>Revocare in qualsiasi momento il consenso prestato</li>
          </ul>
          <p>
            Per esercitare tali diritti: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="sicurezza">
        <AccordionTrigger id="sicurezza">8. Sicurezza</AccordionTrigger>
        <AccordionContent>
          <p>
            WeApnea adotta misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati, perdita o alterazione.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="minori">
        <AccordionTrigger id="minori">9. Minori</AccordionTrigger>
        <AccordionContent>
          <p>
            Salvo diversa indicazione, i servizi del Sito sono riservati a utenti maggiorenni. Eventuali dati forniti da minori saranno eliminati su segnalazione.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="modifiche">
        <AccordionTrigger id="modifiche">10. Modifiche</AccordionTrigger>
        <AccordionContent>
          <p>
            La presente informativa può essere aggiornata. Le modifiche rilevanti saranno comunicate sul Sito o via email agli utenti registrati.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
