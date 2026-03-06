import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Users, Target, Heart, Globe, GraduationCap, Handshake } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHead from "@/components/PageHead";
import { Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";

const ChiSiamo = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const MemberCard = ({ name, src, desc }: { name: string; src: string; desc: string }) => (
    <div className="text-center px-2">
      <div className="mx-auto w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden shadow-md bg-gray-100">
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
        />
      </div>
      <h4 className="mt-3 text-base font-semibold text-gray-900">{name}</h4>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );

  const content = (
    <div className="min-h-screen bg-white">
      <PageHead title="Chi Siamo" description="Scopri il team WeApnea e la nostra missione per la community dell'apnea." />

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        {/* Left */}
        <div className="space-y-5">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
            {t('about_page.hero_heading_pre', 'About')}{' '}
            <span className="text-[#0891b2]">WeApnea.com</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-gray-600">
            {t('about_page.hero_tagline', 'Connecting freedivers worldwide.')}
          </p>
          <p className="text-gray-500 leading-relaxed">
            {t('about_page.subtitle', "WeApnea è la prima piattaforma internazionale dedicata all'apnea, nata dalla passione di un gruppo di apneisti che ha voluto creare uno spazio di condivisione e crescita per tutta la community.")}
          </p>
          <Link
            to="#mission"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 bg-[#0891b2] hover:bg-[#0e7490] text-white font-semibold px-7 py-3 rounded-full transition-colors shadow-md shadow-cyan-200"
          >
            {t('about_page.cta_mission', 'La Nostra Mission')} <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Right – image */}
        <div className="relative">
          <img
            src="/images/cenote-1.webp"
            alt="Apneisti sott'acqua"
            className="w-full h-[320px] md:h-[400px] object-cover rounded-3xl shadow-2xl"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
          />
        </div>
      </section>

      {/* ── 3 FEATURE STRIP ── */}
      <section className="bg-[#e0f7fa]/60 border-y border-cyan-100">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-3 gap-6 text-center">
          {[
            { icon: <GraduationCap className="h-7 w-7 text-[#0891b2]" />, label: t('about_page.feature_learn', 'Impara l\'Apnea') },
            { icon: <Target className="h-7 w-7 text-[#0891b2]" />, label: t('about_page.feature_improve', 'Migliora le Abilità') },
            { icon: <Handshake className="h-7 w-7 text-[#0891b2]" />, label: t('about_page.feature_community', 'Entra nella Community') },
          ].map((f, i, arr) => (
            <div key={i} className={`flex flex-col items-center gap-3 ${i < arr.length - 1 ? 'border-r border-cyan-200' : ''}`}>
              <div className="w-14 h-14 rounded-full border-2 border-[#0891b2]/30 flex items-center justify-center bg-white shadow-sm">
                {f.icon}
              </div>
              <span className="text-sm md:text-base font-semibold text-gray-700">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION & VISION ── */}
      <section id="mission" className="max-w-6xl mx-auto px-6 py-14 md:py-16 grid md:grid-cols-2 gap-8">
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#0891b2] flex items-center justify-center">
              <Target className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('about_page.mission_title', 'La Nostra Mission')}</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">{t('about_page.mission_desc', "Connettere apneisti di tutto il mondo attraverso una piattaforma che facilita la partecipazione a eventi, viaggi e attività formative. Vogliamo rendere l'apnea più accessibile e creare una community globale di appassionati.")}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#0891b2] flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('about_page.vision_title', 'La Nostra Vision')}</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">{t('about_page.vision_desc', "Diventare il punto di riferimento internazionale per l'apnea, dove ogni apneista può trovare opportunità di crescita, condivisione di esperienze e connessioni autentiche.")}</p>
        </div>
      </section>

      {/* ── VALORI ── */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">{t('about_page.values_title', 'I Nostri Valori')}</h2>
            <p className="text-gray-500 mt-2">{t('about_page.values_subtitle', 'I principi che guidano ogni nostra scelta')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Users className="h-7 w-7 text-[#0891b2]" />, title: t('about_page.values.community_title', 'Community'), desc: t('about_page.values.community_desc', 'Crediamo nella forza della community e nella condivisione di esperienze per crescere insieme come apneisti.') },
              { icon: <Heart className="h-7 w-7 text-[#0891b2]" />, title: t('about_page.values.passion_title', 'Passione'), desc: t('about_page.values.passion_desc', "L'apnea è la nostra passione e vogliamo trasmetterla attraverso eventi e esperienze indimenticabili.") },
              { icon: <Globe className="h-7 w-7 text-[#0891b2]" />, title: t('about_page.values.innovation_title', 'Innovazione'), desc: t('about_page.values.innovation_desc', "Utilizziamo la tecnologia per rendere l'apnea più accessibile e connettere apneisti in tutto il mondo.") },
            ].map((v, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-[#0891b2]/25 bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  {v.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm md:text-base">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('about_page.team_title', 'Il Nostro Team')}</h2>
        <p className="text-gray-500 mb-10 max-w-2xl leading-relaxed">
          {t('about_page.team_desc', "Siamo un team di apneisti appassionati, sviluppatori e professionisti del settore che lavorano insieme per creare la migliore esperienza possibile per la community dell'apnea.")}
        </p>
        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {[
              { name: "Pol", src: "/images/team/Paolo.jpg", desc: "Founder" },
              { name: "Leo", src: "/images/team/Leo.jpg", desc: "Co-Founder" },
              { name: "Marta", src: "/images/team/Marta.jpg", desc: "Marketing" },
              { name: "Filippo", src: "/images/team/Filippo.jpg", desc: "Tech" },
              { name: "Ruggero", src: "/images/team/Ruggero.jpg", desc: "Operations" },
            ].map((m) => (
              <CarouselItem key={m.name} className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/5">
                <MemberCard {...m} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 bg-white border border-gray-200 shadow-sm hover:bg-gray-50" />
          <CarouselNext className="right-0 bg-white border border-gray-200 shadow-sm hover:bg-gray-50" />
        </Carousel>
      </section>
    </div>
  );

  return isMobile ? (
    <MobileLayout>{content}</MobileLayout>
  ) : (
    <Layout>{content}</Layout>
  );
};

export default ChiSiamo;