
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEventById, getEventBySlug, EventWithCategory } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Users, Waves, CreditCard, Globe, BookOpen, Target, Check, X, Clock, Languages, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UserNav } from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isValid } from "date-fns";
import { it } from "date-fns/locale";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { GoogleMap } from "@/components/GoogleMap";
import { EventPaymentButton } from "@/components/EventPaymentButton";
import { getPublicConfig } from "@/lib/publicConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiGet } from "@/lib/apiClient";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { friendlyToCanonicalSlug } from "@/lib/seo-utils";

const EventDetailSkeleton = () => (
    <div className="min-h-screen bg-blue-50">
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Waves className="h-8 w-8 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-900">WeApnea</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </div>
        </header>

        <main className="container mx-auto px-4 py-8 md:py-12">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Card className="overflow-hidden shadow-lg">
                        <Skeleton className="w-full h-64 md:h-96" />
                        <div className="p-6 md:p-8">
                            <Skeleton className="h-10 w-3/4 mb-4" />
                            <Skeleton className="h-6 w-full mb-2" />
                            <Skeleton className="h-6 w-5/6" />
                        </div>
                    </Card>
                </div>
                <div className="md:col-span-1">
                    <Card className="shadow-lg p-6 sticky top-28">
                        <Skeleton className="h-8 w-1/2 mb-6" />
                        <div className="space-y-4">
                            <div className="flex items-start"><Skeleton className="h-5 w-5 mr-3 mt-1" /><Skeleton className="h-10 w-3/4" /></div>
                            <div className="flex items-start"><Skeleton className="h-5 w-5 mr-3 mt-1" /><Skeleton className="h-10 w-3/4" /></div>
                            <div className="flex items-start"><Skeleton className="h-5 w-5 mr-3 mt-1" /><Skeleton className="h-10 w-3/4" /></div>
                        </div>
                        <Skeleton className="h-12 w-full mt-8" />
                    </Card>
                </div>
            </div>
        </main>
    </div>
);

const EventDetail = () => {
    const { slug } = useParams<{ slug: string }>();
    const { user, loading: authLoading } = useAuth();
    const isMobile = useIsMobile();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    // null = sconosciuto; evita di mostrare prezzo finché non abbiamo la config
    const [eventsFree, setEventsFree] = useState<boolean | null>(null);

    useEffect(() => {
        let mounted = true;
    getPublicConfig().then(cfg => { if (mounted) setEventsFree(Boolean(cfg.eventsFreeMode)); }).catch(() => { if (mounted) setEventsFree(null); });
        return () => { mounted = false; };
    }, []);

    // Auto scroll to top on route change
    useScrollToTop();

    console.log("🔍 EventDetail - Parametro slug ricevuto dalla URL:", slug);

        const { data: event, isLoading, isError, error } = useQuery<EventWithCategory>({
      queryKey: ['event', slug],
      queryFn: async () => {
        if (!slug) {
          console.error("❌ EventDetail - Slug mancante");
          throw new Error('Slug evento mancante');
        }
        
                // Normalizza slug: supporta sia canonico (YYYY-MM-DD-...) sia friendly (DD-mese-YYYY-...)
                const maybeCanonical = friendlyToCanonicalSlug(slug) || slug;
                console.log("🔍 EventDetail - Tentativo di recupero evento con slug:", slug, "-> normalizzato:", maybeCanonical);
        
        // Verifica se è un UUID o uno slug
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                const isUUID = uuidRegex.test(maybeCanonical);
        
        console.log("🔍 EventDetail - Is UUID?", isUUID);
        
        if (isUUID) {
          // Se è un UUID, cerca per ID
          console.log("📍 EventDetail - Ricerca per ID UUID");
          try {
                        const eventById = await getEventById(maybeCanonical);
            console.log("✅ EventDetail - Evento trovato per ID:", eventById.title, "Slug:", eventById.slug);
            return eventById;
          } catch (idError) {
            console.error("❌ EventDetail - Errore ricerca per ID:", idError);
                        throw new Error(`Evento non trovato per ID: ${maybeCanonical}`);
          }
        } else {
          // Se non è un UUID, prova prima con lo slug
          console.log("📍 EventDetail - Ricerca per slug");
          try {
                        const eventBySlug = await getEventBySlug(maybeCanonical);
            console.log("✅ EventDetail - Evento trovato per slug:", eventBySlug.title, "ID:", eventBySlug.id);
            return eventBySlug;
          } catch (slugError) {
            console.error("❌ EventDetail - Errore ricerca per slug:", slugError);
                        throw new Error(`Evento non trovato per slug: ${maybeCanonical}`);
          }
        }
      },
            enabled: !!slug,
    });

        // Organizer profile query (must be declared unconditionally after the first query)
        const organizerId = event?.organizer_id || event?.organizer?.id || event?.created_by || undefined;
                const { data: organizerProfile } = useQuery<{ id: string; full_name: string | null; company_name: string | null; avatar_url: string | null; role: string }>(
            {
                queryKey: ['organizer-profile', organizerId],
                queryFn: async () => {
                    try {
                        const res = await apiGet(`/api/instructors/${organizerId}`);
                        return res as any;
                    } catch (e: any) {
                        const msg = (e && e.message) ? String(e.message) : '';
                        // Se il profilo non è pubblico o non esiste, evita di propagare l'errore
                        if (msg.includes(' 404 ') || msg.toLowerCase().includes('not found')) {
                            return null as any;
                        }
                        throw e;
                    }
                },
                        enabled: !!organizerId && !event?.organizer_name,
                staleTime: 60_000,
                    retry: false,
                    refetchOnWindowFocus: false,
            }
        );

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

    const getDisplayDate = () => {
        if (!event?.date) return '';
        
        const startDate = formatEventDate(event.date);
        
        if (!event.end_date || event.end_date === event.date) {
            return startDate;
        }
        
        const endDate = formatEventDate(event.end_date);
        return `${startDate} - ${endDate}`;
    };

    // Lightbox helpers
    const galleryAbs = (event?.gallery_images || []).map((g) => ensureAbsoluteUrl(g) || "");
    const hasGallery = galleryAbs.length > 0;
    const goPrev = () => {
        if (!hasGallery) return;
        setLightboxIndex((i) => (i - 1 + galleryAbs.length) % galleryAbs.length);
    };
    const goNext = () => {
        if (!hasGallery) return;
        setLightboxIndex((i) => (i + 1) % galleryAbs.length);
    };
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen, galleryAbs.length]);

    // Helper functions to format the display values
    const formatEventType = (eventType: string | null) => {
        if (!eventType) return null;
        const typeMap: { [key: string]: string } = {
            'corso': 'Corso',
            'escursione': 'Escursione',
            'gara': 'Gara',
            'workshop': 'Workshop',
            'conferenza': 'Conferenza',
            'evento_sociale': 'Evento Sociale'
        };
        return typeMap[eventType] || eventType.charAt(0).toUpperCase() + eventType.slice(1);
    };

    const formatLevel = (level: string | null) => {
        if (!level) return null;
        const levelMap: { [key: string]: string } = {
            'principiante_senza_brevetto': 'Principiante senza brevetto',
            'inesperto_con_brevetto': 'Inesperto con brevetto',
            'avanzato_con_brevetto': 'Avanzato con brevetto',
            'tutti_i_brevettati': 'Tutti i brevettati',
            'brevettati_e_non': 'Sia brevettati che non'
        };
        return levelMap[level] || level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDiscipline = (discipline: string | null) => {
        if (!discipline) return null;
        const disciplineMap: { [key: string]: string } = {
            'indoor': 'Indoor',
            'outdoor': 'Outdoor',
            'indoor&outdoor': 'Indoor & Outdoor'
        };
        return disciplineMap[discipline] || discipline.charAt(0).toUpperCase() + discipline.slice(1);
    };

    if (isLoading) {
        console.log("⏳ EventDetail - Caricamento in corso...");
        return <EventDetailSkeleton />;
    }

    if (isError || !event) {
        console.error("❌ EventDetail - Errore o evento non trovato:", error);
        
        const errorContent = (
            <div className={`flex flex-col min-h-screen items-center justify-center bg-gray-50 text-center ${isMobile ? 'px-4' : 'px-4'}`}>
                <h1 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>Evento non trovato</h1>
                <div className="max-w-2xl space-y-4">
                    <p className={`text-gray-600 mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>
                        L'evento che stai cercando non esiste o potrebbe essere stato rimosso.
                    </p>
                    
                    {/* Show more helpful error information */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className={`text-blue-800 font-semibold mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
                            Debug info:
                        </p>
                        <ul className={`text-blue-700 text-left space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            <li>• Parametro URL: <code className="bg-gray-200 px-1 rounded">{slug || 'UNDEFINED'}</code></li>
                            <li>• Tipo: {/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug || '') ? 'UUID' : 'Slug'}</li>
                            <li>• Errore: {error?.message || 'Sconosciuto'}</li>
                        </ul>
                    </div>
                    
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className={`text-red-800 font-semibold mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
                            Possibili cause:
                        </p>
                        <ul className={`text-red-700 text-left space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            <li>• Lo slug dell'evento potrebbe essere cambiato dopo un aggiornamento</li>
                            <li>• L'evento potrebbe essere stato eliminato</li>
                            <li>• Il link potrebbe non essere aggiornato</li>
                        </ul>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <Button asChild size={isMobile ? "sm" : "default"}>
                        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Torna alla Home</Link>
                    </Button>
                    
                    {/* Show link to admin if user might be able to create events */}
                    {user && (
                        <div className="pt-2">
                            <p className={`text-gray-600 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                Sei autenticato? Puoi provare a vedere tutti gli eventi:
                            </p>
                            <Button variant="outline" asChild size={isMobile ? "sm" : "default"}>
                                <Link to="/admin">Vai al Pannello Admin</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );

        if (isMobile) {
            return <MobileLayout>{errorContent}</MobileLayout>;
        }
        return <Layout>{errorContent}</Layout>;
    }

        console.log("✅ EventDetail - Evento caricato con successo:", event.title);

    const content = (
        <div className={`${isMobile ? 'p-4' : 'container mx-auto px-4 py-8 md:py-12'}`}>
            <Button variant="ghost" asChild className={`mb-6 ${isMobile ? '' : '-ml-4'}`}>
                <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Torna a tutti gli eventi</Link>
            </Button>
            <div className={`grid gap-8 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-3'}`}>
                {/* Colonna sinistra - Contenuto principale */}
                <div className={isMobile ? 'col-span-1' : 'md:col-span-2'}>
                    {/* Immagine principale e descrizione */}
                    <Card className="overflow-hidden shadow-lg">
                        <img src={ensureAbsoluteUrl(event.image_url) || "/placeholder.svg"} alt={event.title} className={`w-full object-cover ${isMobile ? 'h-48' : 'h-64 md:h-96'}`} />
                        <div className={`${isMobile ? 'p-4' : 'p-6 md:p-8'}`}>
                                                        {/* Organizzatore con avatar sopra al titolo */}
                                                                                                                {(organizerId) && (
                                                                                        <div className="mb-3 flex items-center gap-3">
                                                                                            <Link to={(event as any).organizer_public_enabled && (event as any).organizer_public_slug ? `/instructor/${(event as any).organizer_public_slug}` : `/instructor/id/${organizerId}`} className="flex items-center gap-3 group">
                                                                    <Avatar className="h-9 w-9">
                                                                                                                                <AvatarImage src={ensureAbsoluteUrl(event.organizer_avatar_url || organizerProfile?.avatar_url || undefined) || ''} alt={event.organizer_name || organizerProfile?.full_name || organizerProfile?.company_name || 'Organizzatore'} />
                                                                        <AvatarFallback>
                                                                                                                                    {(event.organizer_name || organizerProfile?.full_name || organizerProfile?.company_name || event.organizer?.company_name || event.organizer?.full_name || 'O')
                                                                                .charAt(0)
                                                                                .toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col leading-tight">
                                                                        <span className="text-xs text-gray-500">Organizzato da</span>
                                                                        <span className="text-sm font-medium text-blue-700 group-hover:underline">
                                                                                                                                    {event.organizer_name || organizerProfile?.company_name || organizerProfile?.full_name || event.organizer?.company_name || event.organizer?.full_name || 'Organizzatore'}
                                                                        </span>
                                                                    </div>
                                                                </Link>
                                                            </div>
                                                        )}

                                                        <h1 className={`font-bold text-blue-900 mb-2 leading-tight ${isMobile ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>{event.title}</h1>
                            
                            {/* Nota: la sezione 'Organizzato da' è ora integrata sopra al titolo con avatar */}
                            
                            <div className={`prose max-w-none text-gray-700 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.description || "Nessuna descrizione fornita per questo evento."}
                            </div>
                        </div>
                    </Card>

                    {/* Descrizione Attività */}
                    {event.activity_description && (
                        <Card className="shadow-lg p-6 mt-8">
                            <h2 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Descrizione Attività</h2>
                            <div className={`text-gray-600 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.activity_description}
                            </div>
                        </Card>
                    )}

                    {/* Mappa Google Maps */}
                    {event.location && (
                        <Card className="shadow-lg p-6 mt-8">
                            <h2 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Posizione</h2>
                            <GoogleMap location={event.location} eventTitle={event.title} />
                        </Card>
                    )}

                    {/* Obiettivi */}
                    {event.objectives && (
                        <Card className={`shadow-lg p-6 mt-8`}>
                            <h2 className={`font-bold text-blue-900 mb-4 flex items-center ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                                <Target className="h-6 w-6 mr-2 text-blue-600" />
                                Obiettivi
                            </h2>
                            <div className={`text-gray-600 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.objectives}
                            </div>
                        </Card>
                    )}

                    {/* Chi siamo */}
                    {event.about_us && (
                        <Card className={`shadow-lg p-6 mt-8`}>
                            <h2 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Chi Siamo</h2>
                            <div className={`text-gray-600 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.about_us}
                            </div>
                        </Card>
                    )}

                    {/* Note e avvertenze */}
                    {event.notes && (
                        <Card className={`shadow-lg p-6 mt-8 border-orange-200 bg-orange-50`}>
                            <h2 className={`font-bold text-orange-800 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Note e Avvertenze</h2>
                            <div className={`text-orange-700 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.notes}
                            </div>
                        </Card>
                    )}

                    {/* Orari e Logistica - spostata qui alla fine della colonna sinistra */}
                    {event.schedule_logistics && (
                        <Card className={`shadow-lg p-6 mt-8`}>
                            <h2 className={`font-bold text-blue-900 mb-4 flex items-center ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                                <Clock className="h-6 w-6 mr-2 text-blue-600" />
                                Orari e Logistica
                            </h2>
                            <div className={`text-gray-600 whitespace-pre-wrap ${isMobile ? 'text-sm' : ''}`}>
                                {event.schedule_logistics}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Colonna destra - Informazioni rapide e dettagli */}
                <div className={isMobile ? 'col-span-1' : 'md:col-span-1'}>
                    {/* Informazioni Rapide */}
                    <Card className={`shadow-lg p-6`}>
                        <h2 className={`font-bold text-blue-900 mb-6 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Informazioni Rapide</h2>
                        <div className="space-y-4">
                            <div className="flex items-start">
                                <Calendar className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                <div>
                                    <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Data</p>
                                    <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{getDisplayDate()}</p>
                                </div>
                            </div>
                            {event.location && (
                                <div className="flex items-start">
                                    <MapPin className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                     <div>
                                        <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Luogo</p>
                                        <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{event.location}</p>
                                    </div>
                                </div>
                            )}
                            {event.participants && (
                                <div className="flex items-start">
                                    <Users className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                     <div>
                                        <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Partecipanti</p>
                                        <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{event.participants} posti</p>
                                    </div>
                                </div>
                            )}
                                                        {eventsFree === false && (event.cost != null && event.cost > 0) && (
                              <div className="flex items-start">
                                  <CreditCard className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                  <div>
                                      <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Costo</p>
                                      <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{event.cost != null && event.cost > 0 ? `${event.cost}€` : 'Gratuito'}</p>
                                  </div>
                              </div>
                            )}
                            {event.nation && (
                                <div className="flex items-start">
                                    <Globe className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                    <div>
                                        <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Nazione</p>
                                        <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{event.nation}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <EventPaymentButton
                            eventId={event.id}
                            eventTitle={event.title}
                            eventCost={event.cost ? Number(event.cost) : 0}
                            className="w-full mt-8"
                        />
                    </Card>

                    {/* Informazioni Dettagliate - senza logistica che è stata spostata a sinistra */}
                    {(event.event_type || event.discipline || event.level || event.language) && (
                        <Card className={`shadow-lg p-6 mt-6`}>
                            <h2 className={`font-bold text-blue-900 mb-6 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Dettagli Evento</h2>
                            <div className="space-y-4">
                                {event.event_type && (
                                    <div className="flex items-start">
                                        <FileText className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                        <div>
                                            <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Tipologia</p>
                                            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{formatEventType(event.event_type)}</p>
                                        </div>
                                    </div>
                                )}
                                {event.discipline && (
                                    <div className="flex items-start">
                                        <Waves className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                        <div>
                                            <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Disciplina</p>
                                            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{formatDiscipline(event.discipline)}</p>
                                        </div>
                                    </div>
                                )}
                                {event.level && (
                                    <div className="flex items-start">
                                        <BookOpen className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                        <div>
                                            <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Livello</p>
                                            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{formatLevel(event.level)}</p>
                                        </div>
                                    </div>
                                )}
                                {event.language && (
                                    <div className="flex items-start">
                                        <Languages className="h-5 w-5 mr-3 mt-1 text-blue-600" />
                                        <div>
                                            <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Lingua</p>
                                            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>{event.language}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Cosa è incluso/non incluso - rimane a destra */}
                    {(event.included_in_activity || event.not_included_in_activity) && (
                        <Card className={`shadow-lg p-6 mt-6`}>
                            <h2 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Incluso/Non Incluso</h2>
                            {event.included_in_activity && (
                                <div className="mb-4">
                                    <div className="flex items-center mb-2">
                                        <Check className="h-5 w-5 mr-2 text-green-600" />
                                        <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Incluso</p>
                                    </div>
                                    <div className={`text-gray-600 whitespace-pre-wrap ml-7 ${isMobile ? 'text-sm' : ''}`}>
                                        {event.included_in_activity}
                                    </div>
                                </div>
                            )}
                            {event.not_included_in_activity && (
                                <div>
                                    <div className="flex items-center mb-2">
                                        <X className="h-5 w-5 mr-2 text-red-600" />
                                        <p className={`font-semibold text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Non Incluso</p>
                                    </div>
                                    <div className={`text-gray-600 whitespace-pre-wrap ml-7 ${isMobile ? 'text-sm' : ''}`}>
                                        {event.not_included_in_activity}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Galleria immagini - rimane a destra */}
                    {hasGallery && (
                        <Card className={`shadow-lg p-6 mt-6`}>
                            <h2 className={`font-bold text-blue-900 mb-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Galleria</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {galleryAbs.map((src, index) => (
                                    <img
                                        key={index}
                                        src={src || '/placeholder.svg'}
                                        alt={`Galleria ${index + 1}`}
                                        className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-zoom-in"
                                        onClick={() => { setLightboxIndex(index); setLightboxOpen(true); }}
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                    />
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Lightbox Dialog */}
                    <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                        <DialogContent className="w-screen max-w-[95vw] p-0 bg-transparent border-none shadow-none">
                            <DialogTitle className="sr-only">Galleria immagini</DialogTitle>
                            <DialogDescription className="sr-only">Zoom immagine {lightboxIndex + 1} di {galleryAbs.length}</DialogDescription>
                                                        <div className="relative w-screen h-screen flex items-center justify-center">
                                                                {/* Image */}
                                {hasGallery && (
                                    <img
                                        src={galleryAbs[lightboxIndex] || '/placeholder.svg'}
                                        alt={`Immagine ${lightboxIndex + 1} di ${galleryAbs.length}`}
                                        className="max-h-[90vh] max-w-[95vw] object-contain drop-shadow-2xl"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                                    />
                                )}
                                                                {/* Bottom controls: prev | counter | next */}
                                                                {hasGallery && (
                                                                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white">
                                                                        {/* Prev */}
                                                                        {galleryAbs.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                aria-label="Immagine precedente"
                                                                                className="p-2 rounded-full bg-black/40 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                                                                                onClick={goPrev}
                                                                            >
                                                                                <ChevronLeft className="h-5 w-5" />
                                                                            </button>
                                                                        )}
                                                                        {/* Counter */}
                                                                        <div className="bg-black/40 px-3 py-1 rounded-full text-sm text-white/90 tabular-nums">
                                                                            {lightboxIndex + 1} / {galleryAbs.length}
                                                                        </div>
                                                                        {/* Next */}
                                                                        {galleryAbs.length > 1 && (
                                                                            <button
                                                                                type="button"
                                                                                aria-label="Immagine successiva"
                                                                                className="p-2 rounded-full bg-black/40 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                                                                                onClick={goNext}
                                                                            >
                                                                                <ChevronRight className="h-5 w-5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );

    if (isMobile) {
        return <MobileLayout>{content}</MobileLayout>;
    }

    return (
        <div className="min-h-screen bg-blue-50">
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <Link to="/" className="flex items-center space-x-2">
                    <Waves className="h-8 w-8 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-900">WeApnea</span>
                  </Link>
                   <div className="flex items-center space-x-3">
                    {authLoading ? (
                      <div className="flex items-center space-x-3">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    ) : user ? (
                      <UserNav />
                    ) : (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/auth">Accedi</Link>
                        </Button>
                        <Button size="sm" asChild>
                          <Link to="/auth?view=register">Registrati</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1">
                {content}
            </main>
        </div>
    );
};

export default EventDetail;
