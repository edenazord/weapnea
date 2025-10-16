import AdminLayout from "@/components/AdminLayout";
import DashboardMobileNav from "@/components/DashboardMobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Users, BarChart3, Edit, Trash2, Package, FolderTree, FileText, MessageSquare, Key } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EventForm } from "@/components/admin/EventForm";
import { AllenamentiForm } from "@/components/admin/AllenamentiForm";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createEvent, getEvents, updateEvent, deleteEvent, EventWithCategory, Event, getCategories } from "@/lib/api";
import { getOrganizerStats } from "@/lib/payments-api";
import { EventParticipantsModal } from "@/components/EventParticipantsModal";
import { getUserPackages } from "@/lib/packages-api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { parseISO, isValid, startOfDay, format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/publicConfig";


const Dashboard = () => {
    const [eventsFree, setEventsFree] = useState<boolean | null>(null);
    useEffect(() => {
        let mounted = true;
        getPublicConfig().then(cfg => { if (mounted) setEventsFree(Boolean(cfg.eventsFreeMode)); }).catch(() => {});
        return () => { mounted = false; };
    }, []);
    const { profile } = useAuth();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
    const [showPackagePrompt, setShowPackagePrompt] = useState(false);
    const [isAllenamentiMode, setIsAllenamentiMode] = useState(false);
    const [activeTab, setActiveTab] = useState("events");
    
    const { data: userEvents, isLoading: isLoadingEvents } = useQuery({
        queryKey: ["events", "user", profile?.id],
        queryFn: () => getEvents(undefined, { column: 'date', direction: 'desc' }, undefined, undefined, profile?.role, profile?.id),
        enabled: !!profile?.id,
    });

    const { data: organizerStats } = useQuery({
        queryKey: ["organizer-stats", profile?.id],
        queryFn: () => getOrganizerStats(profile?.id || ''),
        enabled: !!profile?.id && eventsFree !== true,
    });

    const { data: userPackages } = useQuery({
        queryKey: ['user-packages', profile?.id],
        queryFn: () => getUserPackages(profile?.id),
        enabled: !!profile?.id,
    });

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const createMutation = useMutation({
        mutationFn: createEvent,
        onSuccess: () => {
            toast.success("Evento creato con successo!");
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["events", "user", profile?.id] });
            setIsSheetOpen(false);
            setSelectedEvent(undefined);
        },
        onError: (error: Error) => {
            toast.error(`Errore: ${error.message}`);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; values: Partial<Event> }) => updateEvent(data.id, data.values),
        onSuccess: () => {
            toast.success("Evento aggiornato con successo!");
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["events", "user", profile?.id] });
            setIsSheetOpen(false);
            setSelectedEvent(undefined);
        },
        onError: (error: Error) => {
            toast.error(`Errore: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteEvent,
        onSuccess: () => {
            toast.success("Evento eliminato con successo!");
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["events", "user", profile?.id] });
        },
        onError: (error: Error) => {
            toast.error(`Errore: ${error.message}`);
        },
    });

    const hasActiveOrganizerPackage = userPackages?.some(pkg => 
        pkg.package_type === 'organizer' && pkg.status === 'active'
    );
    const canCreateEvents = (eventsFree === true) || hasActiveOrganizerPackage || profile?.role === 'admin';

    const allenamentiCategory = categories?.find(cat => 
        cat.name.toLowerCase().includes('allenamenti')
    );

    const handleAllenamentiFormSubmit = (values: any) => {
        const payload: Partial<Event> = { ...values, category_id: allenamentiCategory?.id };
        if (selectedEvent) {
            updateMutation.mutate({ id: selectedEvent.id!, values: payload });
        } else {
            createMutation.mutate(payload as Event);
        }
    };

    const handleFormSubmit = (values: any) => {
        if (selectedEvent) {
            updateMutation.mutate({ id: selectedEvent.id!, values });
        } else {
            createMutation.mutate(values);
        }
    };

    const handleDeleteEvent = (eventId: string) => {
        deleteMutation.mutate(eventId);
    };

    const openCreateSheet = () => {
        setSelectedEvent(undefined);
        setIsSheetOpen(true);
    };

    const handleCreateEventClick = () => {
        if (!canCreateEvents) {
            setShowPackagePrompt(true);
            return;
        }
        setIsAllenamentiMode(false);
        openCreateSheet();
    };

    const handleCreateAllenamentiClick = () => {
        if (!canCreateEvents) {
            setShowPackagePrompt(true);
            return;
        }
        setIsAllenamentiMode(true);
        openCreateSheet();
    };

    const handleEditEvent = (event: EventWithCategory) => {
        setSelectedEvent(event as Event);
        setIsAllenamentiMode(event.category_id === allenamentiCategory?.id);
        setIsSheetOpen(true);
    };

    const formatDateRange = (startDate: string | null, endDate: string | null) => {
        if (!startDate) return 'N/A';
        try {
            const start = parseISO(startDate);
            const startStr = isValid(start) ? format(start, 'd MMMM yyyy', { locale: itLocale }) : startDate;
            if (!endDate || endDate === startDate) return startStr;
            const end = parseISO(endDate);
            const endStr = isValid(end) ? format(end, 'd MMMM yyyy', { locale: itLocale }) : endDate;
            return `${startStr} - ${endStr}`;
        } catch {
            return endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate;
        }
    };

    const content = (
        <div className={`space-y-6 ${isMobile ? 'pb-24' : ''}`}>
            <div className="space-y-3">
                <div>
                    <h1 className={`font-bold text-blue-900 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Dashboard Organizzatore</h1>
                    <p className={`text-gray-600 ${isMobile ? 'text-sm' : 'text-base'}`}>Benvenuto, {profile?.full_name || 'Organizzatore'}!</p>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <Button className={`${isMobile ? 'flex-1 text-sm' : 'w-auto'}`} onClick={handleCreateEventClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> {isMobile ? 'Crea Evento' : 'Crea Nuovo Evento'}
                        </Button>
                        <Button variant="secondary" className={`${isMobile ? 'flex-1 text-sm' : 'w-auto'} bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700`} onClick={handleCreateAllenamentiClick}>
                            <Users className="mr-2 h-4 w-4" /> {isMobile ? 'Allenamento' : 'Crea Allenamento Condiviso'}
                        </Button>
                        {/* Pulsante "Diventa Sponsor" rimosso */}
                    </div>
                </div>

                <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if (!open) { setSelectedEvent(undefined); setIsAllenamentiMode(false); } }}>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>
                                {isAllenamentiMode ? (selectedEvent ? "Modifica Allenamento Condiviso" : "Crea Allenamento Condiviso") : (selectedEvent ? "Modifica Evento" : "Crea Nuovo Evento")}
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            {isAllenamentiMode ? (
                                <AllenamentiForm key={selectedEvent?.id || 'new-allenamento'} onSubmit={handleAllenamentiFormSubmit} defaultValues={selectedEvent} isEditing={!!selectedEvent} allenamentiCategoryId={allenamentiCategory?.id || ''} />
                            ) : (
                                <EventForm key={selectedEvent?.id || 'new-event'} onSubmit={handleFormSubmit} defaultValues={selectedEvent} isEditing={!!selectedEvent} />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

                {eventsFree !== true && (
                    <AlertDialog open={showPackagePrompt} onOpenChange={setShowPackagePrompt}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    {profile?.role === 'admin' ? 'Accesso Amministratore' : 'Scegli un Pacchetto Organizzatore'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {profile?.role === 'admin' ? 'Come amministratore puoi creare eventi senza limitazioni.' : 'Per creare eventi hai bisogno di un pacchetto organizzatore attivo. Scegli il piano più adatto alle tue esigenze.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                {profile?.role !== 'admin' && (
                                    <AlertDialogAction asChild>
                                        <Link to="/organizer-packages">Scegli Pacchetto</Link>
                                    </AlertDialogAction>
                                )}
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                <Card>
                    <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                        <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>Eventi Attivi</CardTitle>
                        <Calendar className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{userEvents?.length || 0}</div>
                        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>Eventi totali</p>
                    </CardContent>
                </Card>
                {eventsFree !== true && (
                    <Card>
                        <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                            <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>Partecipanti</CardTitle>
                            <Users className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{organizerStats?.totalPaidParticipants || 0}</div>
                            <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>Iscritti paganti</p>
                        </CardContent>
                    </Card>
                )}
                {eventsFree !== true && (
                    <Card>
                        <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                            <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>Guadagni</CardTitle>
                            <BarChart3 className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>€{organizerStats?.totalRevenue?.toFixed(2) || '0.00'}</div>
                            <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>Ricavi reali</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {isMobile && (
                <div className="grid grid-cols-3 gap-3">
                    <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-blue-50 hover:bg-blue-100 border border-blue-100">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Eventi</span>
                    </Button>
                    {eventsFree !== true && (
                        <>
                            <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-green-50 hover:bg-green-100 border border-green-100">
                                <Users className="h-5 w-5 text-green-600" />
                                <span className="text-xs font-medium text-green-700">Partecipanti</span>
                            </Button>
                            <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-purple-50 hover:bg-purple-100 border border-purple-100">
                                <BarChart3 className="h-5 w-5 text-purple-600" />
                                <span className="text-xs font-medium text-purple-700">Statistiche</span>
                            </Button>
                        </>
                    )}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>I tuoi eventi</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingEvents ? (
                        <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                            <p className="text-gray-600">Caricamento eventi...</p>
                        </div>
                    ) : userEvents && userEvents.length > 0 ? (
                        <div className="space-y-4">
                            {userEvents.map((event: EventWithCategory) => (
                                <div key={event.id} className="border rounded-lg p-4 flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg">{event.title}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{event.categories?.name} • {formatDateRange(event.date, event.end_date)}</p>
                                        {event.location && (
                                            <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                            {/* Iscritti totali (free mode o generico) */}
                                            <span className="inline-flex items-center gap-1" title={`Iscritti: ${event.participants ?? 0}`}>
                                                <Users className="h-3.5 w-3.5" />
                                                <span>{event.participants ?? 0} iscritti</span>
                                            </span>
                                            {/* In paid mode si può ancora mostrare i paganti come info aggiuntiva */}
                                            {eventsFree !== true && (
                                                <span className="inline-flex items-center gap-1" title="Iscritti paganti registrati via pagamento">
                                                    <span className="opacity-70">(paganti: {organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0})</span>
                                                </span>
                                            )}
                                            {/* Prezzo + recap a destra */}
                                            <span className="ml-auto text-gray-600">💰 Gratuito • Totale: {event.participants ?? 0}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        {/* Link rapido alla pagina evento */}
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Apri evento">
                                            <Link to={`/events/${event.slug}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13.5 3a1.5 1.5 0 0 0 0 3h2.379l-6.94 6.94a1.5 1.5 0 1 0 2.122 2.12l6.94-6.939V11.5a1.5 1.5 0 0 0 3 0V4.5A1.5 1.5 0 0 0 19.5 3h-6z"/><path d="M5.25 6.75A2.25 2.25 0 0 0 3 9v9.75A2.25 2.25 0 0 0 5.25 21h9.75A2.25 2.25 0 0 0 17.25 18.75V15a1.5 1.5 0 0 0-3 0v3.75H6V9.75h3.75a1.5 1.5 0 0 0 0-3H5.25z"/></svg>
                                            </Link>
                                        </Button>
                                        {/* Icona iscritti (solo visuale, mostra tooltip con totale) */}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title={`Iscritti: ${event.participants ?? 0}`}>
                                            <Users className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        {eventsFree !== true && (
                                            <EventParticipantsModal
                                                eventId={event.id}
                                                eventTitle={event.title}
                                                participantCount={organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0}
                                            />
                                        )}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditEvent(event)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Questa azione non può essere annullata. L'evento "{event.title}" sarà eliminato permanentemente.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDeleteEvent(event.id)}>
                                                                            Elimina
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                            <Calendar className={`text-gray-400 mx-auto mb-4 ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
                            <h3 className={`font-semibold text-gray-600 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>Nessun evento creato</h3>
                            <p className={`text-gray-500 mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>Non hai ancora creato eventi. Clicca il pulsante sopra per iniziare.</p>
                            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={handleCreateEventClick}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                {isMobile ? 'Primo Evento' : 'Crea il tuo primo evento'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className={isMobile ? 'text-lg' : 'text-xl'}>Eventi Passati</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingEvents ? (
                        <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                            <p className="text-gray-600">Caricamento eventi...</p>
                        </div>
                    ) : userEvents && userEvents.length > 0 ? (
                        (() => {
                            const todayStart = startOfDay(new Date());
                            const past = (userEvents || []).filter(e => {
                                if (!e.date) return false;
                                try {
                                    const start = parseISO(e.date);
                                    const end = e.end_date ? parseISO(e.end_date) : undefined;
                                    const startPast = isValid(start) && start < todayStart;
                                    const endPast = end && isValid(end) && end < todayStart;
                                    return Boolean(endPast || (!end && startPast));
                                } catch { return false; }
                            }).sort((a,b) => {
                                const aDate = parseISO(a.end_date || a.date!);
                                const bDate = parseISO(b.end_date || b.date!);
                                return bDate.getTime() - aDate.getTime();
                            });
                            if (past.length === 0) {
                                return (
                                    <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                                        <Calendar className={`text-gray-400 mx-auto mb-4 ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
                                        <h3 className={`font-semibold text-gray-600 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>Nessun evento passato</h3>
                                        <p className={`text-gray-500 ${isMobile ? 'text-sm' : 'text-base'}`}>Quando gli eventi si concluderanno, appariranno qui.</p>
                                    </div>
                                );
                            }
                            return (
                                <div className="space-y-4">
                                    {past.map((event: EventWithCategory) => (
                                        <div key={event.id} className="border rounded-lg p-4 flex justify-between items-start">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{event.title}</h3>
                                                <p className="text-sm text-gray-600 mt-1">{event.categories?.name} • {formatDateRange(event.date, event.end_date)}</p>
                                                {event.location && (
                                                    <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-4">
                                                {/* Link rapido alla pagina evento */}
                                                <Button asChild variant="ghost" size="icon" title="Apri evento">
                                                    <Link to={`/events/${event.slug}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13.5 3a1.5 1.5 0 0 0 0 3h2.379l-6.94 6.94a1.5 1.5 0 1 0 2.122 2.12l6.94-6.939V11.5a1.5 1.5 0 0 0 3 0V4.5A1.5 1.5 0 0 0 19.5 3h-6z"/><path d="M5.25 6.75A2.25 2.25 0 0 0 3 9v9.75A2.25 2.25 0 0 0 5.25 21h9.75A2.25 2.25 0 0 0 17.25 18.75V15a1.5 1.5 0 0 0-3 0v3.75H6V9.75h3.75a1.5 1.5 0 0 0 0-3H5.25z"/></svg>
                                                    </Link>
                                                </Button>
                                                {/* Icona iscritti (tooltip con totale) */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8" title={`Iscritti: ${event.participants ?? 0}`}>
                                                    <Users className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button asChild variant="outline" size="sm">
                                                    <Link to={`/events/${event.slug}`}>Dettagli</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    ) : (
                        <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                            <Calendar className={`text-gray-400 mx-auto mb-4 ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
                            <h3 className={`font-semibold text-gray-600 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>Nessun evento passato</h3>
                            <p className={`text-gray-500 ${isMobile ? 'text-sm' : 'text-base'}`}>Quando gli eventi si concluderanno, appariranno qui.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    if (isMobile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
                <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
                    <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>
                    <p className="text-sm text-gray-600">Benvenuto, {profile?.full_name || 'Organizzatore'}!</p>
                </div>
                <div className="pb-20 px-4 py-6">{content}</div>
                <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if (!open) { setSelectedEvent(undefined); setIsAllenamentiMode(false); } }}>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>
                                {isAllenamentiMode ? (selectedEvent ? "Modifica Allenamento Condiviso" : "Crea Allenamento Condiviso") : (selectedEvent ? "Modifica Evento" : "Crea Nuovo Evento")}
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            {isAllenamentiMode ? (
                                <AllenamentiForm key={selectedEvent?.id || 'new-allenamento'} onSubmit={handleAllenamentiFormSubmit} defaultValues={selectedEvent} isEditing={!!selectedEvent} allenamentiCategoryId={allenamentiCategory?.id || ''} />
                            ) : (
                                <EventForm key={selectedEvent?.id || 'new-event'} onSubmit={handleFormSubmit} defaultValues={selectedEvent} isEditing={!!selectedEvent} />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
                {eventsFree !== true && (
                    <AlertDialog open={showPackagePrompt} onOpenChange={setShowPackagePrompt}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    {profile?.role === 'admin' ? 'Accesso Amministratore' : 'Scegli un Pacchetto Organizzatore'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {profile?.role === 'admin' ? 'Come amministratore puoi creare eventi senza limitazioni.' : 'Per creare eventi hai bisogno di un pacchetto organizzatore attivo. Scegli il piano più adatto alle tue esigenze.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                {profile?.role !== 'admin' && (
                                    <AlertDialogAction asChild>
                                        <Link to="/organizer-packages">Scegli Pacchetto</Link>
                                    </AlertDialogAction>
                                )}
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <DashboardMobileNav activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
        );
    }

    return <AdminLayout>{content}</AdminLayout>;
};

export default Dashboard;
