import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Users, Target, Heart, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/PageHeader";
import PageTopBar from "@/components/PageTopBar";

const ChiSiamo = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  
  const content = (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* Page Header */}
  <PageHeader
          title={t('about_page.title', 'Chi Siamo')}
          subtitle={t("about_page.subtitle", "WeApnea è la prima piattaforma internazionale dedicata all'apnea, nata dalla passione di un gruppo di apneisti che ha voluto creare uno spazio di condivisione e crescita per tutta la community.")}
  />

        {/* Mission & Vision Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20">
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 mr-4">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('about_page.mission_title', 'La Nostra Mission')}</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">{t('about_page.mission_desc', "Connettere apneisti di tutto il mondo attraverso una piattaforma che facilita la partecipazione a eventi, viaggi e attività formative. Vogliamo rendere l'apnea più accessibile e creare una community globale di appassionati.")}</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20">
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 mr-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('about_page.vision_title', 'La Nostra Vision')}</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">{t('about_page.vision_desc', "Diventare il punto di riferimento internazionale per l'apnea, dove ogni apneista può trovare opportunità di crescita, condivisione di esperienze e connessioni autentiche con altri membri della community.")}</p>
          </div>
        </div>

        {/* Values Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-white/20 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent">
              {t('about_page.values_title', 'I Nostri Valori')}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">{t('about_page.values.community_title', 'Community')}</h3>
              <p className="text-gray-600">{t('about_page.values.community_desc', 'Crediamo nella forza della community e nella condivisione di esperienze per crescere insieme come apneisti.')}</p>
            </div>

            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Heart className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">{t('about_page.values.passion_title', 'Passione')}</h3>
              <p className="text-gray-600">{t('about_page.values.passion_desc', "L'apnea è la nostra passione e vogliamo trasmetterla attraverso eventi e esperienze indimenticabili.")}</p>
            </div>

            <div className="text-center">
              <div className="p-4 rounded-full bg-gradient-to-r from-pink-100 to-blue-100 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Globe className="h-8 w-8 text-pink-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">{t('about_page.values.innovation_title', 'Innovazione')}</h3>
              <p className="text-gray-600">{t('about_page.values.innovation_desc', "Utilizziamo la tecnologia per rendere l'apnea più accessibile e connettere apneisti in tutto il mondo.")}</p>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-900 to-purple-700 bg-clip-text text-transparent">
            {t('about_page.team_title', 'Il Nostro Team')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {t('about_page.team_desc', "Siamo un team di apneisti appassionati, sviluppatori e professionisti del settore che lavorano insieme per creare la migliore esperienza possibile per la community dell'apnea.")}
          </p>
        </div>
      </div>
    </div>
  );

  return isMobile ? (
    <MobileLayout>{content}</MobileLayout>
  ) : (
    <Layout>{content}</Layout>
  );
};

export default ChiSiamo;