import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import PageHead from "@/components/PageHead";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Shield, ListOrdered, CalendarDays } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const sectionIds = [
  "titolare",
  "tipologie", 
  "finalita",
  "basi",
  "conservazione",
  "terzi",
  "diritti",
  "sicurezza",
  "minori",
  "modifiche",
];

const PrivacyPolicy = () => {
  const isMobile = useIsMobile();
  const { t, currentLanguage } = useLanguage();
  const [activeSection, setActiveSection] = useState<string | undefined>("titolare");

  useEffect(() => {
    try {
      const hash = window.location?.hash?.replace('#', '');
      if (hash) setActiveSection(hash);
    } catch (e) {
      // no-op
    }
  }, []);

  const handleTocClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const Content = () => (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      <PageHead title="Privacy Policy" />
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <PageHeader
          title={t("privacy_policy.title", "WeApnea – Privacy Policy (UE/GDPR)")}
          subtitle={`${t("privacy_policy.last_update", "Ultimo aggiornamento")}: 06/10/2025`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
                <ListOrdered className="h-4 w-4" />
                {t("privacy_policy.toc_title", "Indice")}
              </div>
              <nav className="space-y-2 text-sm">
                {sectionIds.map((id) => (
                  <a
                    key={id}
                    className={`block hover:text-blue-700 transition-all cursor-pointer ${
                      activeSection === id ? "font-bold text-blue-700" : ""
                    }`}
                    href={`#${id}`}
                    onClick={(e) => handleTocClick(e, id)}
                  >
                    {t(`privacy_policy.sections.${id}.title`, id)}
                  </a>
                ))}
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
                <span className="font-semibold">{t("privacy_policy.info_title", "Informativa Privacy")}</span>
              </div>
              <div className="prose prose-slate max-w-none">
                <p>{t("privacy_policy.intro", "La presente informativa descrive le modalità di trattamento dei dati personali degli utenti che visitano e utilizzano il sito www.weapnea.com (di seguito \"Sito\").")}</p>

                <PrivacyAccordion activeSection={activeSection} onSectionChange={setActiveSection} t={t} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );

  return isMobile ? (
    <MobileLayout key={currentLanguage}>
      <Content />
    </MobileLayout>
  ) : (
    <Layout key={currentLanguage}>
      <Content />
    </Layout>
  );
};

export default PrivacyPolicy;

interface PrivacyAccordionProps {
  activeSection: string | undefined;
  onSectionChange: (section: string | undefined) => void;
  t: (key: string, fallback?: string) => string;
}

function PrivacyAccordion({ activeSection, onSectionChange, t }: PrivacyAccordionProps) {
  return (
    <Accordion type="single" collapsible value={activeSection} onValueChange={onSectionChange}>
      <AccordionItem value="titolare">
        <AccordionTrigger id="titolare">{t("privacy_policy.sections.titolare.title", "1. Titolare del Trattamento")}</AccordionTrigger>
        <AccordionContent>
          <p dangerouslySetInnerHTML={{ __html: t("privacy_policy.sections.titolare.content", "") }} />
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="tipologie">
        <AccordionTrigger id="tipologie">{t("privacy_policy.sections.tipologie.title", "2. Tipologie di dati trattati")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2].map((i) => (
              <li key={i}>{t(`privacy_policy.sections.tipologie.items.${i}`, "")}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="finalita">
        <AccordionTrigger id="finalita">{t("privacy_policy.sections.finalita.title", "3. Finalità del trattamento")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i}>{t(`privacy_policy.sections.finalita.items.${i}`, "")}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="basi">
        <AccordionTrigger id="basi">{t("privacy_policy.sections.basi.title", "4. Basi giuridiche (art. 6 GDPR)")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2].map((i) => (
              <li key={i}>{t(`privacy_policy.sections.basi.items.${i}`, "")}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="conservazione">
        <AccordionTrigger id="conservazione">{t("privacy_policy.sections.conservazione.title", "5. Conservazione dei dati")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("privacy_policy.sections.conservazione.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="terzi">
        <AccordionTrigger id="terzi">{t("privacy_policy.sections.terzi.title", "6. Comunicazione a terzi")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>{t(`privacy_policy.sections.terzi.items.${i}`, "")}</li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="diritti">
        <AccordionTrigger id="diritti">{t("privacy_policy.sections.diritti.title", "7. Diritti dell'utente (artt. 15–22 GDPR)")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>{t(`privacy_policy.sections.diritti.items.${i}`, "")}</li>
            ))}
          </ul>
          <p dangerouslySetInnerHTML={{ __html: t("privacy_policy.sections.diritti.contact", "") }} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="sicurezza">
        <AccordionTrigger id="sicurezza">{t("privacy_policy.sections.sicurezza.title", "8. Sicurezza")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("privacy_policy.sections.sicurezza.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="minori">
        <AccordionTrigger id="minori">{t("privacy_policy.sections.minori.title", "9. Minori")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("privacy_policy.sections.minori.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="modifiche">
        <AccordionTrigger id="modifiche">{t("privacy_policy.sections.modifiche.title", "10. Modifiche")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("privacy_policy.sections.modifiche.content", "")}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
