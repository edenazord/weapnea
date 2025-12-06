import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Cookie, ListOrdered, CalendarDays } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const sectionIds = [
  "cosa-sono",
  "tipologie",
  "consenso",
  "browser",
  "terze-parti",
  "contatti",
];

const CookiePolicy = () => {
  const isMobile = useIsMobile();
  const { t, currentLanguage } = useLanguage();
  const [activeSection, setActiveSection] = useState<string | undefined>("cosa-sono");

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
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
        <PageHeader
          title={t("cookie_policy.title", "WeApnea – Cookie Policy (UE/GDPR)")}
          subtitle={`${t("cookie_policy.last_update", "Ultimo aggiornamento")}: 06/10/2025`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* TOC */}
          <aside className="lg:col-span-3">
            <div className="sticky top-24 bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl shadow-md p-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
                <ListOrdered className="h-4 w-4" />
                {t("cookie_policy.toc_title", "Indice")}
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
                    {t(`cookie_policy.sections.${id}.title`, id)}
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
                <Cookie className="h-5 w-5" />
                <span className="font-semibold">{t("cookie_policy.info_title", "Informativa Cookie")}</span>
              </div>
              <div className="prose prose-slate max-w-none">
                <CookieAccordion activeSection={activeSection} onSectionChange={setActiveSection} t={t} />
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

export default CookiePolicy;

interface CookieAccordionProps {
  activeSection: string | undefined;
  onSectionChange: (section: string | undefined) => void;
  t: (key: string, fallback?: string) => string;
}

function CookieAccordion({ activeSection, onSectionChange, t }: CookieAccordionProps) {
  return (
    <Accordion type="single" collapsible value={activeSection} onValueChange={onSectionChange}>
      <AccordionItem value="cosa-sono">
        <AccordionTrigger id="cosa-sono">{t("cookie_policy.sections.cosa-sono.title", "1. Cosa sono i cookie")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("cookie_policy.sections.cosa-sono.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="tipologie">
        <AccordionTrigger id="tipologie">{t("cookie_policy.sections.tipologie.title", "2. Tipologie di cookie utilizzati")}</AccordionTrigger>
        <AccordionContent>
          <ul>
            {[0, 1, 2].map((i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: t(`cookie_policy.sections.tipologie.items.${i}`, "") }} />
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="consenso">
        <AccordionTrigger id="consenso">{t("cookie_policy.sections.consenso.title", "3. Gestione del consenso")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("cookie_policy.sections.consenso.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="browser">
        <AccordionTrigger id="browser">{t("cookie_policy.sections.browser.title", "4. Disabilitazione tramite browser")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("cookie_policy.sections.browser.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="terze-parti">
        <AccordionTrigger id="terze-parti">{t("cookie_policy.sections.terze-parti.title", "5. Strumenti di terza parte")}</AccordionTrigger>
        <AccordionContent>
          <p>{t("cookie_policy.sections.terze-parti.content", "")}</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="contatti">
        <AccordionTrigger id="contatti">{t("cookie_policy.sections.contatti.title", "6. Contatti")}</AccordionTrigger>
        <AccordionContent>
          <p dangerouslySetInnerHTML={{ __html: t("cookie_policy.sections.contatti.content", "") }} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
