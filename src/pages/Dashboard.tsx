
import AdminLayout from "@/components/AdminLayout";
import AppMobileLayout from "@/components/AppMobileLayout";
import DashboardMobileNav from "@/components/DashboardMobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Users, BarChart3, Edit, Trash2, Package, Crown, FolderTree, FileText, MessageSquare, Key } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import * as z from "zod";
import { parseISO, isValid, startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/publicConfig";


const Dashboard = () => {
    const [eventsFree, setEventsFree] = useState(false);
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
    
    // Query per recuperare gli eventi dell'organizzatore
    const { data: userEvents, isLoading: isLoadingEvents } = useQuery({
        queryKey: ["events", "user", profile?.id],
        queryFn: () => getEvents(undefined, { column: 'date', direction: 'desc' }, undefined, undefined, profile?.role, profile?.id),
        enabled: !!profile?.id,
    });

    // Query per recuperare le statistiche reali dei pagamenti
    const { data: organizerStats, isLoading: isLoadingStats } = useQuery({
        queryKey: ["organizer-stats", profile?.id],
        queryFn: () => getOrganizerStats(profile?.id || ''),
        enabled: !!profile?.id,
    });

    // Query per recuperare i pacchetti dell'utente
    const { data: userPackages } = useQuery({
        queryKey: ['user-packages', profile?.id],
        queryFn: () => getUserPackages(profile?.id),
        enabled: !!profile?.id,
    });

    // Query per recuperare le categorie
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

    // Controlla se l'utente ha un pacchetto organizzatore attivo o è admin
    const hasActiveOrganizerPackage = userPackages?.some(pkg => 
        pkg.package_type === 'organizer' && pkg.status === 'active'
    );
    
    const canCreateEvents = hasActiveOrganizerPackage || profile?.role === 'admin';

    // Trova la categoria "Allenamenti"
    const allenamentiCategory = categories?.find(cat => 
        cat.name.toLowerCase().includes('allenamenti')
    );

    const handleAllenamentiFormSubmit = (values: any) => {
        console.log('🏃‍♂️ AllenamentiForm submit triggered with values:', values);
        console.log('📋 allenamentiCategory:', allenamentiCategory);
        
        if (!allenamentiCategory?.id) {
            toast.error('Errore: categoria Allenamenti non trovata. Contatta l\'amministratore.');
            return;
        }

        const eventData = {
            title: values.title,
            slug: values.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description: `Allenamento condiviso: ${values.activity_details}`,
            discipline: values.discipline,
            location: values.location,
            date: values.date,
            end_date: values.end_date || null,
            participants: null,
            cost: values.cost ? Number(values.cost) : null,
            image_url: values.image_url || null,
            category_id: values.category_id,
            nation: values.nation,
            level: values.level,
            activity_description: values.activity_details,
            about_us: values.who_we_are,
            objectives: values.objectives,
            notes: values.notes || null,
            schedule_logistics: values.schedule_meeting_point,
            // Nuovi campi specifici per allenamenti
            activity_details: values.activity_details,
            who_we_are: values.who_we_are,
            fixed_appointment: values.fixed_appointment,
            instructors: values.instructors,
            max_participants_per_instructor: values.max_participants_per_instructor,
            schedule_meeting_point: values.schedule_meeting_point,
            responsibility_waiver_accepted: values.responsibility_waiver_accepted,
            privacy_accepted: values.privacy_accepted,
        };
        
        console.log('📤 Event data to be sent:', eventData);
        
        if (selectedEvent) {
            console.log('✏️ Updating event:', selectedEvent.id);
            updateMutation.mutate({ id: selectedEvent.id, values: eventData });
        } else {
            console.log('🆕 Creating new event');
            createMutation.mutate(eventData);
        }
    };

    const handleFormSubmit = (values: any) => {
        const eventData = {
            title: values.title,
            slug: values.slug || values.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            description: values.description || '',
            discipline: values.discipline || null,
            location: values.location || null,
            date: values.date || null,
            end_date: values.end_date || null,
            participants: values.participants ? Number(values.participants) : null,
            cost: values.cost ? Number(values.cost) : null,
            image_url: values.image_url || null,
            category_id: values.category_id,
            nation: values.nation || null,
            level: values.level || null,
            activity_description: values.activity_description || null,
            language: values.language || null,
            about_us: values.about_us || null,
            objectives: values.objectives || null,
            included_in_activity: values.included_in_activity || null,
            not_included_in_activity: values.not_included_in_activity || null,
            notes: values.notes || null,
            schedule_logistics: values.schedule_logistics || null,
            gallery_images: values.gallery_images || null,
        };
        
        if (selectedEvent) {
            updateMutation.mutate({ id: selectedEvent.id, values: eventData });
        } else {
            createMutation.mutate(eventData);
        }
    };


    const handleDeleteEvent = (eventId: string) => {
        deleteMutation.mutate(eventId);
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

    const openCreateSheet = () => {
        setSelectedEvent(undefined);
        setIsSheetOpen(true);
    };

    const handleEditEvent = (event: EventWithCategory) => {
        setSelectedEvent(event as Event);
        // Controlla se è un allenamento condiviso
        setIsAllenamentiMode(event.category_id === allenamentiCategory?.id);
        setIsSheetOpen(true);
    };
    
    const formatDateRange = (startDate: string | null, endDate: string | null) => {
        if (!startDate) return 'N/A';
        if (!endDate || endDate === startDate) return startDate;
        return `${startDate} - ${endDate}`;
    };
    
    const renderMobileContent = () => {
        switch (activeTab) {
            case "events":
                return (
                    <div className="space-y-6">
                        {/* Header Events */}
                        <div className="space-y-3">
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <Button 
                                        className="flex-1 text-sm" 
                                        onClick={handleCreateEventClick}
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" /> 
                                        Crea Evento
                                    </Button>
                                    
                                    <Button 
                                        variant="secondary"
                                        className="flex-1 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700" 
                                        onClick={handleCreateAllenamentiClick}
                                    >
                                        <Users className="mr-2 h-4 w-4" /> 
                                        Allenamento
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid gap-4 grid-cols-1">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">Eventi Attivi</CardTitle>
                                    <Calendar className="text-muted-foreground h-4 w-4" />
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-xl">{userEvents?.length || 0}</div>
                                    <p className="text-muted-foreground text-xs">Eventi totali</p>
                                </CardContent>
                            </Card>
                            
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">Partecipanti</CardTitle>
                                    <Users className="text-muted-foreground h-4 w-4" />
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-xl">{organizerStats?.totalPaidParticipants || 0}</div>
                                    <p className="text-muted-foreground text-xs">Iscritti paganti</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">Guadagni</CardTitle>
                                    <BarChart3 className="text-muted-foreground h-4 w-4" />
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-xl">€{organizerStats?.totalRevenue?.toFixed(2) || '0.00'}</div>
                                    <p className="text-muted-foreground text-xs">Ricavi reali</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Events List */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">I tuoi eventi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoadingEvents ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-600">Caricamento eventi...</p>
                                    </div>
                                ) : userEvents && userEvents.length > 0 ? (
                                    <div className="space-y-4">
                                        {userEvents.map((event: EventWithCategory) => (
                                            <div key={event.id} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-base">{event.title}</h3>
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            {event.categories?.name} • {formatDateRange(event.date, event.end_date)}
                                                        </p>
                                                        {event.location && (
                                                            <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                                        )}
                                                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                                            <span>👥 {organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0} iscritti</span>
                                                            {eventsFree ? (
                                                                <span>💰 Gratuito</span>
                                                            ) : (event.cost && event.cost > 0 ? (
                                                                <span>💰 €{event.cost}</span>
                                                            ) : (
                                                                <span>💰 Gratuito</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1 ml-2">
                                                        <EventParticipantsModal
                                                            eventId={event.id}
                                                            eventTitle={event.title}
                                                            participantCount={organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0}
                                                        />
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => handleEditEvent(event)}
                                                        >
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
                                                                    <AlertDialogAction 
                                                                        onClick={() => handleDeleteEvent(event.id)}
                                                                        className="bg-red-600 hover:bg-red-700"
                                                                    >
                                                                        Elimina
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Calendar className="text-gray-400 mx-auto mb-4 h-12 w-12" />
                                        <h3 className="font-semibold text-gray-600 mb-2 text-base">
                                            Nessun evento creato
                                        </h3>
                                        <p className="text-gray-500 mb-4 text-sm">
                                            Non hai ancora creato eventi. Clicca il pulsante sopra per iniziare.
                                        </p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleCreateEventClick}
                                        >
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Primo Evento
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                );
            
            case "categories":
                return (
                    <div className="text-center py-20">
                        <FolderTree className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Gestione Categorie</h3>
                        <p className="text-gray-500">Funzionalità in sviluppo</p>
                    </div>
                );
            
            case "blog":
                return (
                    <div className="text-center py-20">
                        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Gestione Blog</h3>
                        <p className="text-gray-500">Funzionalità in sviluppo</p>
                    </div>
                );
            
            case "forum":
                return (
                    <div className="text-center py-20">
                        <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Gestione Forum</h3>
                        <p className="text-gray-500">Funzionalità in sviluppo</p>
                    </div>
                );
            
            case "users":
                return (
                    <div className="text-center py-20">
                        <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Gestione Utenti</h3>
                        <p className="text-gray-500">Funzionalità in sviluppo</p>
                    </div>
                );
            
            case "packages":
                return (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Pacchetti Organizzatore
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-gray-600 text-sm">
                                    Gestisci i tuoi pacchetti organizzatore per creare eventi premium.
                                </p>
                                <Button asChild className="w-full">
                                    <Link to="/organizer-packages">
                                        Visualizza Pacchetti
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Crown className="h-5 w-5" />
                                    Diventa Sponsor
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-gray-600 text-sm">
                                    Promuovi il tuo brand attraverso i nostri eventi di apnea.
                                </p>
                                <Button asChild variant="outline" className="w-full">
                                    <Link to="/sponsor-packages">
                                        Pacchetti Sponsor
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );
            
            case "tokens":
                return (
                    <div className="text-center py-20">
                        <Key className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Gestione Token</h3>
                        <p className="text-gray-500">Funzionalità in sviluppo</p>
                    </div>
                );
            
            default:
                return (
                    <div className="text-center py-20">
                        <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">Dashboard</h3>
                        <p className="text-gray-500">Seleziona una sezione dal menu</p>
                    </div>
                );
        }
    };

    const content = (
        <div className={`space-y-6 ${isMobile ? 'pb-24' : ''}`}>
            
            {/* Header */}
            <div className="space-y-3">
                <div>
                    <h1 className={`font-bold text-blue-900 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                        Dashboard Organizzatore
                    </h1>
                    <p className={`text-gray-600 ${isMobile ? 'text-sm' : 'text-base'}`}>
                        Benvenuto, {profile?.full_name || 'Organizzatore'}!
                    </p>
                </div>
                
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <Button 
                            className={`${isMobile ? 'flex-1 text-sm' : 'w-auto'}`} 
                            onClick={handleCreateEventClick}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> 
                            {isMobile ? 'Crea Evento' : 'Crea Nuovo Evento'}
                        </Button>
                        
                        {/* Pulsante per Allenamenti Condivisi */}
                        <Button 
                            variant="secondary"
                            className={`${isMobile ? 'flex-1 text-sm' : 'w-auto'} bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700`} 
                            onClick={handleCreateAllenamentiClick}
                        >
                            <Users className="mr-2 h-4 w-4" /> 
                            {isMobile ? 'Allenamento' : 'Crea Allenamento Condiviso'}
                        </Button>
                        
                        <Button 
                            variant="outline"
                            className={`${isMobile ? 'flex-1 text-sm' : 'w-auto'}`}
                            asChild
                        >
                            <Link to="/sponsor-packages">
                                <Crown className="mr-2 h-4 w-4" /> 
                                Diventa Sponsor
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Sheet per creare/modificare eventi */}
                <Sheet open={isSheetOpen} onOpenChange={(open) => { 
                    setIsSheetOpen(open); 
                    if (!open) {
                        setSelectedEvent(undefined);
                        setIsAllenamentiMode(false);
                    }
                }}>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>
                                {isAllenamentiMode 
                                    ? (selectedEvent ? "Modifica Allenamento Condiviso" : "Crea Allenamento Condiviso")
                                    : (selectedEvent ? "Modifica Evento" : "Crea Nuovo Evento")
                                }
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            {isAllenamentiMode ? (
                                <AllenamentiForm
                                    key={selectedEvent?.id || 'new-allenamento'}
                                    onSubmit={handleAllenamentiFormSubmit}
                                    defaultValues={selectedEvent}
                                    isEditing={!!selectedEvent}
                                    allenamentiCategoryId={allenamentiCategory?.id || ''}
                                />
                            ) : (
                                <EventForm
                                    key={selectedEvent?.id || 'new-event'}
                                    onSubmit={handleFormSubmit}
                                    defaultValues={selectedEvent}
                                    isEditing={!!selectedEvent}
                                />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Dialog per pacchetti */}
                <AlertDialog open={showPackagePrompt} onOpenChange={setShowPackagePrompt}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    {profile?.role === 'admin' ? 'Accesso Amministratore' : 'Scegli un Pacchetto Organizzatore'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {profile?.role === 'admin' 
                                        ? 'Come amministratore puoi creare eventi senza limitazioni.'
                                        : 'Per creare eventi hai bisogno di un pacchetto organizzatore attivo. Scegli il piano più adatto alle tue esigenze.'
                                    }
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                {profile?.role !== 'admin' && (
                                    <AlertDialogAction asChild>
                                        <Link to="/organizer-packages">
                                            Scegli Pacchetto
                                        </Link>
                                    </AlertDialogAction>
                                )}
                            </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            {/* Stats Cards - responsive grid */}
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                <Card>
                    <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                        <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>
                            Eventi Attivi
                        </CardTitle>
                        <Calendar className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                            {userEvents?.length || 0}
                        </div>
                        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>
                            Eventi totali
                        </p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                        <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>
                            Partecipanti
                        </CardTitle>
                        <Users className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                            {organizerStats?.totalPaidParticipants || 0}
                        </div>
                        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>
                            Iscritti paganti
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                        <CardTitle className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>
                            Guadagni
                        </CardTitle>
                        <BarChart3 className={`text-muted-foreground ${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                            €{organizerStats?.totalRevenue?.toFixed(2) || '0.00'}
                        </div>
                        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-xs'}`}>
                            Ricavi reali
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions for mobile - integrated design */}
            {isMobile && (
                <div className="grid grid-cols-3 gap-3">
                    <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-blue-50 hover:bg-blue-100 border border-blue-100">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Eventi</span>
                    </Button>
                    <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-green-50 hover:bg-green-100 border border-green-100">
                        <Users className="h-5 w-5 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Partecipanti</span>
                    </Button>
                    <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 bg-purple-50 hover:bg-purple-100 border border-purple-100">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">Statistiche</span>
                    </Button>
                </div>
            )}

            {/* Recent Events Section */}
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
                                        <p className="text-sm text-gray-600 mt-1">
                                            {event.categories?.name} • {formatDateRange(event.date, event.end_date)}
                                        </p>
                                        {event.location && (
                                            <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                        )}
                                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                            <span>👥 {organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0} iscritti paganti</span>
                                            {eventsFree ? (
                                                <span>💰 Gratuito</span>
                                            ) : (event.cost && event.cost > 0 ? (
                                                <span>💰 €{event.cost}</span>
                                            ) : (
                                                <span>💰 Gratuito</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <EventParticipantsModal
                                            eventId={event.id}
                                            eventTitle={event.title}
                                            participantCount={organizerStats?.paymentsByEvent?.find(p => p.eventId === event.id)?.totalPaidParticipants || 0}
                                        />
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8"
                                            onClick={() => handleEditEvent(event)}
                                        >
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
                                                    <AlertDialogAction 
                                                        onClick={() => handleDeleteEvent(event.id)}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
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
                            <h3 className={`font-semibold text-gray-600 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                                Nessun evento creato
                            </h3>
                            <p className={`text-gray-500 mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>
                                Non hai ancora creato eventi. Clicca il pulsante sopra per iniziare.
                            </p>
                            <Button 
                                variant="outline" 
                                size={isMobile ? "sm" : "default"} 
                                onClick={handleCreateEventClick}
                            >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                {isMobile ? 'Primo Evento' : 'Crea il tuo primo evento'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Past Events Section */}
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
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {event.categories?.name} • {formatDateRange(event.date, event.end_date)}
                                                </p>
                                                {event.location && (
                                                    <p className="text-sm text-gray-500 mt-1">📍 {event.location}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2 ml-4">
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
                
                <div className="pb-20 px-4 py-6">
                    {renderMobileContent()}
                </div>
                <Sheet open={isSheetOpen} onOpenChange={(open) => { 
                    setIsSheetOpen(open); 
                    if (!open) {
                        setSelectedEvent(undefined);
                        setIsAllenamentiMode(false);
                    }
                }}>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>
                                {isAllenamentiMode 
                                    ? (selectedEvent ? "Modifica Allenamento Condiviso" : "Crea Allenamento Condiviso")
                                    : (selectedEvent ? "Modifica Evento" : "Crea Nuovo Evento")
                                }
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            {isAllenamentiMode ? (
                                <AllenamentiForm
                                    key={selectedEvent?.id || 'new-allenamento'}
                                    onSubmit={handleAllenamentiFormSubmit}
                                    defaultValues={selectedEvent}
                                    isEditing={!!selectedEvent}
                                    allenamentiCategoryId={allenamentiCategory?.id || ''}
                                />
                            ) : (
                                <EventForm
                                    key={selectedEvent?.id || 'new-event'}
                                    onSubmit={handleFormSubmit}
                                    defaultValues={selectedEvent}
                                    isEditing={!!selectedEvent}
                                />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Dialog per pacchetti */}
                <AlertDialog open={showPackagePrompt} onOpenChange={setShowPackagePrompt}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-600" />
                                {profile?.role === 'admin' ? 'Accesso Amministratore' : 'Scegli un Pacchetto Organizzatore'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {profile?.role === 'admin' 
                                    ? 'Come amministratore puoi creare eventi senza limitazioni.'
                                    : 'Per creare eventi hai bisogno di un pacchetto organizzatore attivo. Scegli il piano più adatto alle tue esigenze.'
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            {profile?.role !== 'admin' && (
                                <AlertDialogAction asChild>
                                    <Link to="/organizer-packages">
                                        Scegli Pacchetto
                                    </Link>
                                </AlertDialogAction>
                            )}
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                
                <DashboardMobileNav 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab} 
                />
            </div>
        );
    }

    return <AdminLayout>{content}</AdminLayout>;
};

export default Dashboard;
