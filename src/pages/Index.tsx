
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEvents, getNationsWithEvents, getCategories } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import EventCard from "@/components/EventCard";
// import SponsorSection from "@/components/SponsorSection";
import { SearchWithDropdown } from "@/components/SearchWithDropdown";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, parseISO, isValid, startOfDay } from "date-fns";
import { localizeCategoryName } from "@/lib/i18n-utils";
import { it } from "date-fns/locale";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { getPublicConfig } from "@/lib/publicConfig";

const Index = () => {
  console.log('Index component rendering...');
  
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [nationFilter, setNationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const isMobile = useIsMobile();

  const { data: events, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ["events", searchTerm, nationFilter, dateFilter],
    queryFn: async () => {
      console.log('🔄 Fetching events...');
      try {
        const result = await getEvents(searchTerm, { column: 'date', direction: 'asc' }, nationFilter, dateFilter);
        console.log('✅ Events fetched successfully:', result);
        return result || [];
      } catch (error) {
        console.error('❌ Error fetching events:', error);
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 60000,
    retry: 1,
    refetchOnWindowFocus: false,
  });


  const { data: nations, isLoading: nationsLoading, refetch: refetchNations } = useQuery({
    queryKey: ["nations-with-events"],
    queryFn: async () => {
      console.log('🔄 Fetching nations...');
      try {
        const result = await getNationsWithEvents();
        console.log('✅ Nations fetched successfully:', result);
        return result || [];
      } catch (error) {
        console.error('❌ Error fetching nations:', error);
        throw error;
      }
    },
    staleTime: 60000,
    gcTime: 120000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      console.log('🔄 Fetching categories...');
      try {
        const result = await getCategories();
        console.log('✅ Categories fetched successfully:', result);
        return result || [];
      } catch (error) {
        console.error('❌ Error fetching categories:', error);
        throw error;
      }
    },
    staleTime: 60000,
    gcTime: 120000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch public-config to know where to place the Past Events group
  const { data: publicCfg } = useQuery({
    queryKey: ["public-config"],
    queryFn: getPublicConfig,
    staleTime: 60000,
  });

  const isLoading = eventsLoading || nationsLoading || categoriesLoading;
  const hasError = eventsError;

  console.log("🔍 Loading states:", { eventsLoading, nationsLoading, categoriesLoading });
  console.log("🔍 Events data:", events);

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

  const upcomingEvents = useMemo(() => {
    if (!events || !Array.isArray(events)) {
      return [];
    }
    
    // Considera "oggi" come inizio giornata, così gli eventi di oggi risultano ancora futuri
    const todayStart = startOfDay(new Date());
    
    let filteredEvents = events
      .filter(event => {
        if (!event || !event.date) {
          return false;
        }
        try {
          const start = parseISO(event.date);
          const end = event.end_date ? parseISO(event.end_date) : undefined;
          const startOk = isValid(start) && start >= todayStart;
          const endOk = end && isValid(end) && end >= todayStart;
          // Includi se la data di inizio è oggi o futura, oppure se la data di fine non è ancora passata
          return Boolean(startOk || endOk);
        } catch {
          return false;
        }
      });

    // Apply category filter
    if (categoryFilter !== "all") {
      filteredEvents = filteredEvents.filter(event => 
        event.category_id === categoryFilter
      );
    }

    // Apply discipline filter
    if (disciplineFilter !== "all") {
      filteredEvents = filteredEvents.filter(event => 
        event.discipline === disciplineFilter
      );
    }

    return filteredEvents.sort((a, b) => {
      const dateA = parseISO(a.date!);
      const dateB = parseISO(b.date!);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, categoryFilter, disciplineFilter]);

  // Eventi passati (tutti gli eventi con fine prima di oggi; se end_date manca, in base alla start)
  const pastEvents = useMemo(() => {
    if (!events || !Array.isArray(events)) return [];
    const todayStart = startOfDay(new Date());
    return events
      .filter(event => {
        if (!event || !event.date) return false;
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
        // più recenti prima
        const aDate = parseISO(a.end_date || a.date!);
        const bDate = parseISO(b.end_date || b.date!);
        return bDate.getTime() - aDate.getTime();
      });
  }, [events]);

  // Raggruppamento eventi per categoria
  const eventsByCategory = useMemo(() => {
    if (!upcomingEvents) return [];
    
    console.log('🏷️ Categories available:', categories);
    console.log('📅 Upcoming events:', upcomingEvents);
    
    const grouped: any[] = [];
    
    // Categorie esistenti con i loro eventi, ordinate per order_index
    let categorizedGroups: any[] = [];
    if (categories) {
      categorizedGroups = categories
      .map(category => {
        const categoryEvents = upcomingEvents.filter(event => 
          event.category_id === category.id
        );
        
        console.log(`📂 Category "${category.name}" (order: ${category.order_index}):`, categoryEvents.length, 'events');
        
        return {
          ...category,
          events: categoryEvents
        };
      })
      .filter(category => category.events.length > 0)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }

    // Inserisci il gruppo "Eventi Passati" tra le categorie (prima degli "Allenamenti")
    if (pastEvents.length > 0) {
      const pastGroup = {
        id: 'past-events',
        name: t('homepage.past_events', 'Eventi Passati'),
        order_index: typeof publicCfg?.pastEventsCategoryPosition === 'number' ? publicCfg.pastEventsCategoryPosition : 1000,
        events: pastEvents
      };
      if (typeof publicCfg?.pastEventsCategoryPosition === 'number') {
        const pos = Math.min(Math.max(publicCfg.pastEventsCategoryPosition, 0), categorizedGroups.length);
        categorizedGroups.splice(pos, 0, pastGroup);
      } else {
        categorizedGroups.push(pastGroup);
      }
    }

    // Aggiungi le categorie (incluse eventualmente "Eventi Passati")
    grouped.push(...categorizedGroups);
    
    // Poi aggiungi gli eventi senza categoria (allenamenti)
    const uncategorizedEvents = upcomingEvents.filter(event => !event.category_id);
    if (uncategorizedEvents.length > 0) {
      console.log('🏃 Uncategorized events (Allenamenti):', uncategorizedEvents.length);
      grouped.push({
        id: 'uncategorized',
        name: t('homepage.uncategorized_events', 'Allenamenti'),
        order_index: 999, // Metti gli allenamenti alla fine
        events: uncategorizedEvents
      });
    }

    // Nota: "Eventi Passati" è già stato inserito tra le categorie sopra

    console.log('📊 Final grouped categories:', grouped);
    return grouped;
  }, [categories, upcomingEvents, pastEvents, t, publicCfg]);

  const handleRetry = () => {
    console.log("🔄 Retrying queries...");
    refetchEvents();
    refetchNations();
    refetchCategories();
  };

  console.log('Index component: About to render content');

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-x-hidden">
      <div className="space-y-8 py-8">
        {/* Search Section */}
        <section className={`${isMobile ? 'px-2' : 'px-6'}`}>
          <SearchWithDropdown
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            nationFilter={nationFilter}
            onNationChange={setNationFilter}
            dateFilter={dateFilter}
            onDateChange={setDateFilter}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            disciplineFilter={disciplineFilter}
            onDisciplineChange={setDisciplineFilter}
            nations={nations}
            categories={categories}
            isMobile={isMobile}
          />
        </section>



        {/* Main Content Section */}
        <section className={`${isMobile ? 'px-2' : 'px-6'}`}>
          <div className="w-full">
            {/* Events Content */}
            <div className="w-full">
              {isLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                  <p className="mt-4 text-xl text-blue-600">{t('homepage.loading_events', 'Caricamento eventi...')}</p>
                </div>
              ) : hasError ? (
                <div className="text-center py-20">
                  <div className="max-w-md mx-auto">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      {t('homepage.error_title', 'Errore nel caricamento')}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {t('homepage.error_description', 'Si è verificato un errore durante il caricamento degli eventi.')}
                    </p>
                    <div className="space-y-3">
                      <Button 
                        onClick={handleRetry}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t('homepage.retry_btn', 'Riprova')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : !events || events.length === 0 ? (
                <div className="text-center py-20">
                  <Calendar className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('homepage.no_events_title', 'Nessun evento disponibile')}</h3>
                  <p className="text-gray-600">
                    {t('homepage.no_events_description', 'Al momento non ci sono eventi pubblicati.')}
                  </p>
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-20">
                  <Calendar className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('homepage.no_results_title', 'Nessun evento trovato')}</h3>
                  <p className="text-gray-600">
                    {t('homepage.no_results_description', 'Non ci sono eventi futuri che corrispondono ai tuoi filtri.')}
                  </p>
                </div>
              ) : eventsByCategory.length === 0 ? (
                <div className="text-center py-20">
                  <Calendar className="mx-auto h-12 w-12 text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('homepage.no_results_title', 'Nessun evento trovato')}</h3>
                  <p className="text-gray-600">
                    {t('homepage.no_results_description', 'Non ci sono eventi futuri che corrispondono ai tuoi filtri.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Sponsor Section temporarily disabled */}
                  {/* <SponsorSection /> */}
                  
                  {eventsByCategory.map((category, index) => (
                    <div key={category.id}>
                      <div className="space-y-6">
                        {/* Titolo Categoria */}
                        <div className="flex items-center gap-4 mb-6">
                          <h2 className="text-3xl md:text-4xl font-bold leading-relaxed pb-1 bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
                            {localizeCategoryName(category.name, t)}
                          </h2>
                          <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-md hover:shadow-lg transition-shadow">
                            {category.events.length}
                          </span>
                        </div>

                        {/* Carosello Eventi */}
                        <Carousel
                          opts={{
                            align: "start",
                            loop: false,
                          }}
                          className="w-full"
                        >
                          <CarouselContent className="-ml-1 md:-ml-2 w-full items-stretch">
                            {category.events.map((event) => (
                            <CarouselItem 
                              key={event.id} 
                              className={`pl-1 md:pl-2 h-full ${
                                isMobile 
                                  ? "basis-full" 
                                  : "basis-1/4"
                              }`}
                              >
                                <EventCard 
                                  event={event} 
                                  variant="full" 
                                  formatDate={formatEventDate} 
                                />
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          {category.events.length > (isMobile ? 1 : 4) && (
                            <>
                              <CarouselPrevious className={`left-2 z-20 bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white shadow-lg ${isMobile ? 'flex top-16' : 'hidden md:flex top-20'}`} />
                              <CarouselNext className={`right-2 z-20 bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white shadow-lg ${isMobile ? 'flex top-16' : 'hidden md:flex top-20'}`} />
                            </>
                          )}
                        </Carousel>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  console.log('Index component: About to render layout');

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default Index;
