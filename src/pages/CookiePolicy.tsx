import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Cookie, ListOrdered, CalendarDays } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const CookiePolicy = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const Content = () => (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <PageHeader
          title={t('cookie.page_title', 'WeApnea – Cookie Policy (UE/GDPR)')}
          subtitle={t('cookie.last_updated', 'Ultimo aggiornamento: 06/10/2025')}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
                <ListOrdered className="h-4 w-4" />
                {t('cookie.toc_title', 'Indice')}
              </div>
              <nav className="space-y-2 text-sm">
                <a className="block hover:text-blue-700" href="#cosa-sono">1. Cosa sono i cookie</a>
                <a className="block hover:text-blue-700" href="#tipologie">2. Tipologie di cookie utilizzati</a>
                <a className="block hover:text-blue-700" href="#consenso">3. Gestione del consenso</a>
                <a className="block hover:text-blue-700" href="#browser">4. Disabilitazione tramite browser</a>
                <a className="block hover:text-blue-700" href="#terze-parti">5. Strumenti di terza parte</a>
                <a className="block hover:text-blue-700" href="#contatti">6. Contatti</a>
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
                <Cookie className="h-5 w-5" />
                <span className="font-semibold">{t('cookie.heading', 'Informativa Cookie')}</span>
              </div>
              <div className="prose prose-slate max-w-none">
                <CookieAccordion />
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

export default CookiePolicy;

function CookieAccordion() {
  const [open, setOpen] = useState<string | undefined>("cosa-sono");
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
      <AccordionItem value="cosa-sono">
        <AccordionTrigger id="cosa-sono">1. Cosa sono i cookie</AccordionTrigger>
        <AccordionContent>
          <p>
            I cookie sono piccoli file salvati nel dispositivo dell’utente per migliorare la navigazione e abilitare determinate funzionalità.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="tipologie">
        <AccordionTrigger id="tipologie">2. Tipologie di cookie utilizzati</AccordionTrigger>
        <AccordionContent>
          <ul>
            <li><strong>Tecnici / Necessari</strong>: funzionamento del sito (es. lingua, login) – non richiedono consenso.</li>
            <li><strong>Statistici (anonimizzati)</strong>: analisi visite (es. Google Analytics con IP anonimizzato) – richiedono consenso.</li>
            <li><strong>Marketing / Profilazione</strong>: remarketing e personalizzazione contenuti – richiedono consenso.</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="consenso">
        <AccordionTrigger id="consenso">3. Gestione del consenso</AccordionTrigger>
        <AccordionContent>
          <p>
            Al primo accesso viene mostrato un banner cookie che consente di accettare tutti i cookie, rifiutare quelli non necessari o gestire le preferenze. L’utente può modificare le preferenze in ogni momento tramite browser o tramite un link “Impostazioni Cookie” presente nel Sito.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="browser">
        <AccordionTrigger id="browser">4. Disabilitazione tramite browser</AccordionTrigger>
        <AccordionContent>
          <p>
            L’utente può gestire i cookie dalle impostazioni del proprio browser (Chrome, Firefox, Safari, ecc.). La disattivazione dei cookie tecnici può compromettere alcune funzionalità del Sito.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="terze-parti">
        <AccordionTrigger id="terze-parti">5. Strumenti di terza parte</AccordionTrigger>
        <AccordionContent>
          <p>
            Il Sito può utilizzare servizi esterni come Google Analytics o pixel social. In caso di cookie marketing, questi vengono attivati solo previo consenso esplicito.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="contatti">
        <AccordionTrigger id="contatti">6. Contatti</AccordionTrigger>
        <AccordionContent>
          <p>
            Per chiarimenti o richieste sulla gestione dei dati o dei cookie: <a href="mailto:weapnea@gmail.com">weapnea@gmail.com</a>
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
