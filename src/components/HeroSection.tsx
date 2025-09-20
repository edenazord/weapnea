
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Calendar, Users, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden py-20 hero-gradient">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl floating-animation" style={{ animationDelay: '-3s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative container mx-auto px-4 text-center">
        <div className="slide-up-animation">
          <Badge variant="secondary" className="mb-6 bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            {t('hero.badge_text', 'Scopri il mondo dell\'apnea')}
          </Badge>
        </div>
        
        <div className="slide-up-animation" style={{ animationDelay: '0.2s' }}>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            {t('hero.title_line1', 'La tua piattaforma per')}
            <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              {t('hero.title_line2', 'l\'apnea')}
            </span>
          </h1>
        </div>
        
        <div className="slide-up-animation" style={{ animationDelay: '0.4s' }}>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
            {t('hero.description', 'Trova eventi, corsi e competizioni di apnea. Connettiti con la community e scopri nuove opportunità per migliorare le tue performance.')}
          </p>
        </div>

        <div className="slide-up-animation" style={{ animationDelay: '0.6s' }}>
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" className="bg-white text-purple-700 hover:bg-gray-100 font-semibold px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Search className="w-5 h-5 mr-2" />
              {t('hero.btn_explore', 'Esplora Eventi')}
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-full backdrop-blur-sm">
              <Users className="w-5 h-5 mr-2" />
              {t('hero.btn_community', 'Unisciti alla Community')}
            </Button>
          </div>
        </div>

        {/* Stats section */}
        <div className="slide-up-animation" style={{ animationDelay: '0.8s' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">500+</div>
              <div className="text-white/80 font-medium">{t('hero.stats_events', 'Eventi Organizzati')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">2k+</div>
              <div className="text-white/80 font-medium">{t('hero.stats_freedivers', 'Apneisti Attivi')}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">50+</div>
              <div className="text-white/80 font-medium">{t('hero.stats_instructors', 'Istruttori Certificati')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-20 fill-current text-slate-50">
          <path d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
