
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEvents, EventWithCategory } from "@/lib/api";
import { Loader2, Calendar } from "lucide-react";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import EventCard from "@/components/EventCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { BackButton } from "@/components/BackButton";

const UpcomingEvents = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const upcomingEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    return events
      .filter(event => {
        if (!event.date) return false;
        try {
          const eventDate = parseISO(event.date);
          return isValid(eventDate) && eventDate >= now;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = parseISO(a.date!);
        const dateB = parseISO(b.date!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [events]);

  const formatEventDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (isValid(date)) {
        return format(date, "d MMMM yyyy", { locale: it });
      }
    } catch {
      return dateString;
    }
    return dateString;
  };

  const content = (
    <div className={isMobile ? "px-4 py-6" : ""}>
      {/* Back Button */}
      <div className="mb-6">
        <BackButton fallbackPath="/" label={t('not_found.back_home', 'Torna alla Home')} />
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('events.upcoming_title', 'Eventi Imminenti')}</h1>
        <p className="text-gray-600">{t('events.upcoming_subtitle', 'Tutti gli eventi in programma ordinati per data')}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-xl text-gray-500">{t('common.loading_events', 'Caricamento eventi...')}</p>
        </div>
      ) : upcomingEvents.length > 0 ? (
  <div className={`grid gap-6 items-stretch ${isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {upcomingEvents.map((event) => (
            <EventCard 
              key={event.id} 
              event={event} 
              variant="full" 
              formatDate={formatEventDate} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-xl text-gray-500">{t('events.no_upcoming', 'Nessun evento imminente')}</p>
          <p className="text-gray-400">{t('events.check_back_soon', 'Torna presto per vedere i nuovi eventi!')}</p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default UpcomingEvents;
