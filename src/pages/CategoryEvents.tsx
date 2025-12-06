
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getEvents, getCategories } from "@/lib/api";
import { Loader2, Search } from "lucide-react";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import EventCard from "@/components/EventCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { format, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { BackButton } from "@/components/BackButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeCategoryName } from "@/lib/i18n-utils";

const CategoryEvents = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const categoryName = useMemo(() => {
    if (!categories || !categorySlug) return '';
    const category = categories.find(cat => 
      cat.name.toLowerCase().replace(/\s+/g, '-') === categorySlug
    );
    return category?.name || '';
  }, [categories, categorySlug]);

  const categoryEvents = useMemo(() => {
    if (!events || !categoryName) return [];
    return events.filter(event => event.categories?.name === categoryName);
  }, [events, categoryName]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {categoryName ? localizeCategoryName(categoryName, t) : t('common.error', 'Categoria non trovata')}
        </h1>
        <p className="text-gray-600">
          {categoryEvents.length > 0 
            ? `${categoryEvents.length} ${t('events.count_in_category', 'eventi in questa categoria')}`
            : t('events.none_in_category', 'Nessun evento disponibile in questa categoria')
          }
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="mx-auto h-12 w-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-xl text-gray-500">Caricamento eventi...</p>
        </div>
      ) : categoryEvents.length > 0 ? (
  <div className={`grid gap-6 items-stretch ${isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {categoryEvents.map((event) => (
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
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-xl text-gray-500">Nessun evento trovato</p>
          <p className="text-gray-400">Gli eventi per questa categoria verranno aggiunti presto!</p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default CategoryEvents;
