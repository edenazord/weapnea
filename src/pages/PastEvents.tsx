import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEvents, EventWithCategory } from "@/lib/api";
import { Loader2, Calendar } from "lucide-react";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import EventCard from "@/components/EventCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { format, parseISO, isValid, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { BackButton } from "@/components/BackButton";

const PastEvents = () => {
  const isMobile = useIsMobile();

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const pastEvents = useMemo(() => {
    if (!events) return [];
    const todayStart = startOfDay(new Date());
    return events
      .filter(event => {
        if (!event.date) return false;
        try {
          const start = parseISO(event.date);
          const end = event.end_date ? parseISO(event.end_date) : undefined;
          const startPast = isValid(start) && start < todayStart;
          const endPast = end && isValid(end) && end < todayStart;
          return Boolean(endPast || (!end && startPast));
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const aDate = parseISO(a.end_date || a.date!);
        const bDate = parseISO(b.end_date || b.date!);
        return bDate.getTime() - aDate.getTime();
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
        <BackButton fallbackPath="/" label="Torna alla Home" />
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Eventi Passati</h1>
        <p className="text-gray-600">Tutti gli eventi già svolti, dal più recente</p>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-xl text-gray-500">Caricamento eventi...</p>
        </div>
      ) : pastEvents.length > 0 ? (
        <div className={`grid gap-6 items-stretch ${isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {pastEvents.map((event) => (
            <EventCard 
              key={event.id} 
              event={event as EventWithCategory} 
              variant="full" 
              formatDate={formatEventDate} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-xl text-gray-500">Nessun evento passato</p>
          <p className="text-gray-400">Appena si concluderanno eventi, li vedrai qui.</p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default PastEvents;
