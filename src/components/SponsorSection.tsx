import sponsorAquaTech from "@/assets/sponsor-aquatech.jpg";
import sponsorDeepBlue from "@/assets/sponsor-deepblue.jpg";
import sponsorEcoWave from "@/assets/sponsor-ecowave.jpg";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const SponsorSection = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const sponsors = [
    {
      src: sponsorAquaTech,
      alt: "AquaTech Solutions - Tecnologie Marine",
    },
    {
      src: sponsorDeepBlue,
      alt: "DeepBlue Gear - Attrezzature Subacquee",
    },
    {
      src: sponsorEcoWave,
      alt: "EcoWave Energy - Energia Sostenibile",
    },
  ];

  if (isMobile) {
    return (
      <div className="space-y-6">
        {/* Titolo Sezione - Stesso stile delle categorie eventi */}
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-3xl md:text-4xl font-bold leading-relaxed pb-1 bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
            {t('homepage.sponsors.title', 'Partner & Sponsor')}
          </h2>
        </div>

        {/* Carosello Sponsor - Stesso stile degli eventi */}
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          plugins={[Autoplay({ delay: 3000 }) as any]}
          className="w-full"
        >
          <CarouselContent className="-ml-1 md:-ml-2 w-full">
            {sponsors.map((sponsor, index) => (
              <CarouselItem 
                key={index} 
                className="pl-1 md:pl-2 basis-full"
              >
                {/* Card Sponsor - Stesso stile delle EventCard */}
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-0 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-8">
                    <img 
                      src={sponsor.src} 
                      alt={sponsor.alt}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-2">
                      {sponsor.alt.split(' - ')[0]}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {sponsor.alt.split(' - ')[1]}
                    </p>
                    <div className="flex justify-center">
                      <button className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-colors">
                        {t('homepage.sponsors.learn_more', 'Scopri di più')}
                      </button>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {sponsors.length > 1 && (
            <>
              <CarouselPrevious className="left-2 z-20 bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white shadow-lg flex top-16" />
              <CarouselNext className="right-2 z-20 bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white shadow-lg flex top-16" />
            </>
          )}
        </Carousel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Titolo Sezione Desktop */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-3xl md:text-4xl font-bold leading-relaxed pb-1 bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
          {t('homepage.sponsors.title', 'Partner & Sponsor')}
        </h2>
      </div>

  {/* Layout Desktop - Griglia di card sponsor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sponsors.map((sponsor, index) => (
          <div key={index} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-0 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-8">
              <img 
                src={sponsor.src} 
                alt={sponsor.alt}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-2">
                {sponsor.alt.split(' - ')[0]}
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                {sponsor.alt.split(' - ')[1]}
              </p>
              <div className="flex justify-center">
                <button className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-colors">
                  {t('homepage.sponsors.learn_more', 'Scopri di più')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SponsorSection;