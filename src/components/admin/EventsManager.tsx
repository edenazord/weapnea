import { useState, useEffect } from "react";
import { parseISO, isValid, startOfDay } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent, EventWithCategory, Event, getCategories, getSetting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EventForm } from "./EventForm";
import { AllenamentiForm } from "./AllenamentiForm";
import { toast } from "sonner";
import { Edit, Trash2, Plus, Search, ArrowUp, ArrowDown, Users, Filter } from "lucide-react";
import { EventParticipantsModal } from "@/components/EventParticipantsModal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import * as z from "zod";

type SortableColumn = 'title' | 'category' | 'date' | 'cost' | 'nation' | 'discipline' | 'level';

export default function EventsManager() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState({ column: 'date' as SortableColumn, direction: 'desc' });

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  // Query per recuperare le categorie
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // Posizione salvata per "Eventi Passati"
  const { data: pastPos } = useQuery({
    queryKey: ["settings", "past_events_category_position"],
    queryFn: () => getSetting<{ index: number }>("past_events_category_position"),
  });

  // Trova la categoria "Allenamenti"
  const allenamentiCategory = categories?.find(cat => 
    cat.name.toLowerCase().includes('allenamenti')
  );

  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["events", debouncedSearchTerm, sort.column, sort.direction, profile?.role, profile?.id],
    queryFn: () => getEvents(debouncedSearchTerm, sort, undefined, undefined, profile?.role, profile?.id),
  });

  // Filtra eventi in base alla categoria selezionata
  const isEventPast = (event: EventWithCategory) => {
    if (!event?.date) return false;
    try {
      const todayStart = startOfDay(new Date());
      const start = parseISO(event.date);
      const end = event.end_date ? parseISO(event.end_date) : undefined;
      const startPast = isValid(start) && start < todayStart;
      const endPast = end && isValid(end) && end < todayStart;
      return Boolean(endPast || (!end && startPast));
    } catch { return false; }
  };

  const events = allEvents?.filter(event => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "past") return isEventPast(event);
    if (categoryFilter === "allenamenti") return event.category_id === allenamentiCategory?.id;
    return event.category_id === categoryFilter;
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setIsSheetOpen(false);
      setSelectedEvent(undefined);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  };

  const createMutation = useMutation({
    ...mutationOptions,
    mutationFn: createEvent,
    onSuccess: () => {
      toast.success("Evento creato con successo!");
      mutationOptions.onSuccess();
    },
  });

  const updateMutation = useMutation({
    ...mutationOptions,
    mutationFn: (data: { id: string; values: Partial<Event> }) => updateEvent(data.id, data.values),
     onSuccess: () => {
      toast.success("Evento aggiornato con successo!");
      mutationOptions.onSuccess();
    },
  });

  const deleteMutation = useMutation({
    ...mutationOptions,
    mutationFn: deleteEvent,
    onSuccess: () => {
      toast.success("Evento eliminato con successo!");
      mutationOptions.onSuccess();
    },
  });

  const handleEventFormSubmit = async (values: any) => {
    const eventData = {
      title: values.title,
      slug: values.slug,
      description: values.description,
      discipline: values.discipline,
      location: values.location,
      date: values.date,
      end_date: values.end_date,
      participants: values.participants != null ? Number(values.participants) : null,
      cost: values.cost != null ? Number(values.cost) : null,
      image_url: values.image_url,
      category_id: values.category_id,
      nation: values.nation,
      level: values.level,
      activity_description: values.activity_description,
      language: values.language,
      about_us: values.about_us,
      objectives: values.objectives,
      included_in_activity: values.included_in_activity,
      not_included_in_activity: values.not_included_in_activity,
      notes: values.notes,
      schedule_logistics: values.schedule_logistics,
      gallery_images: values.gallery_images,
    };

    try {
      if (selectedEvent) {
        await updateMutation.mutateAsync({ id: selectedEvent.id, values: eventData as any });
      } else {
        await createMutation.mutateAsync(eventData as any);
      }
    } catch (error) {
      // Error handling is already done in mutation options
    }
  };

  const handleAllenamentiFormSubmit = (values: any) => {
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
    
    if (selectedEvent) {
      updateMutation.mutate({ id: selectedEvent.id, values: eventData });
    } else {
      createMutation.mutate(eventData);
    }
  };
  
  const openSheet = (event?: Event, isAllenamento = false) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
    // Se stiamo creando un allenamento, imposta automaticamente il filtro categoria
    if (isAllenamento && !event) {
      setCategoryFilter("allenamenti");
    } else if (!event && !isAllenamento) {
      // Se stiamo creando un evento normale, resettiamo il filtro
      setCategoryFilter("all");
    }
  };

  const isAllenamentoForm = categoryFilter === "allenamenti" || 
    (selectedEvent && selectedEvent.category_id === allenamentiCategory?.id);

  const handleSort = (column: SortableColumn) => {
    setSort(currentSort => ({
      column,
      direction: currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortableHeader = ({ column, label }: { column: SortableColumn, label: string }) => (
    <TableHead>
      <Button variant="ghost" onClick={() => handleSort(column)} className="px-2 py-1 h-auto -ml-2">
        {label}
        {sort.column === column && (
          sort.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 inline" /> : <ArrowDown className="ml-2 h-4 w-4 inline" />
        )}
      </Button>
    </TableHead>
  );

  const formatDateRange = (startDate: string | null, endDate: string | null) => {
    if (!startDate) return 'N/A';
    
    const formatToItalian = (dateStr: string) => {
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const formattedStartDate = formatToItalian(startDate);
    
    if (!endDate || endDate === startDate) {
      return formattedStartDate;
    }
    
    const formattedEndDate = formatToItalian(endDate);
    return `${formattedStartDate} - ${formattedEndDate}`;
  };

  const formatDiscipline = (discipline: string | null) => {
    if (!discipline) return 'N/A';
    return discipline.charAt(0).toUpperCase() + discipline.slice(1);
  };

  const formatLevel = (level: string | null) => {
    if (!level) return 'N/A';
    return level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca eventi per titolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtra per categoria" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Tutti gli eventi</SelectItem>
                  {(() => {
                    // Costruisci la lista ordinata: categorie reali per order_index, inserendo synthetic "past" all'indice salvato.
                    const realCats = (categories || []).slice().sort((a, b) => a.order_index - b.order_index);
                    const items: Array<{ type: 'real' | 'past' | 'allenamenti'; id: string; name: string }>
                      = realCats.map(c => ({ type: 'real', id: c.id, name: c.name }));

                    const pastIndex = (pastPos?.value && typeof pastPos.value.index === 'number')
                      ? Math.max(0, Math.min(pastPos.value.index, items.length))
                      : items.length;

                    // Inserisci Past
                    items.splice(pastIndex, 0, { type: 'past', id: 'past', name: 'Eventi Passati' });

                    // Opzionalmente: se esiste Allenamenti, garantisci che appaia con label dedicata ma rispettando l'ordine naturale
                    // Qui manteniamo anche un item dedicato se presente tra le categorie reali, evitando duplicati nel mapping

                    return items.map((it) => (
                      <SelectItem key={`${it.type}-${it.id}`} value={it.id === 'past' ? 'past' : it.id}>
                        {it.type === 'past' ? 'Eventi Passati' : it.name}
                      </SelectItem>
                    ));
                  })()}
                  {allenamentiCategory && (
                    // In caso Allenamenti sia una categoria reale già nella lista sopra, evitiamo doppione
                    categories?.some(c => c.id === allenamentiCategory.id) ? null : (
                      <SelectItem value="allenamenti">Allenamenti Condivisi</SelectItem>
                    )
                  )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-2">
          {allenamentiCategory && (
            <Button 
              onClick={() => openSheet(undefined, true)} 
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
            >
              <Users className="mr-2 h-4 w-4" />
              Crea Allenamento
            </Button>
          )}
          <Button onClick={() => openSheet()}>
            <Plus className="mr-2 h-4 w-4" /> Crea Evento
          </Button>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if (!open) setSelectedEvent(undefined); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedEvent 
                ? (isAllenamentoForm ? "Modifica Allenamento Condiviso" : "Modifica Evento")
                : (isAllenamentoForm ? "Crea Allenamento Condiviso" : "Nuovo Evento")
              }
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {isAllenamentoForm && allenamentiCategory ? (
              <AllenamentiForm
                key={selectedEvent?.id || 'new-allenamento'}
                onSubmit={handleAllenamentiFormSubmit}
                defaultValues={selectedEvent}
                isEditing={!!selectedEvent}
                allenamentiCategoryId={allenamentiCategory.id}
              />
            ) : (
              <EventForm
                key={selectedEvent?.id || 'new-event'}
                onSubmit={handleEventFormSubmit}
                defaultValues={selectedEvent}
                isEditing={!!selectedEvent}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Table>
        <TableHeader>
          <TableRow className="hidden md:table-row">
            <SortableHeader column="title" label="Titolo" />
            <SortableHeader column="category" label="Categoria" />
            <SortableHeader column="discipline" label="Disciplina" />
            <SortableHeader column="level" label="Livello" />
            <SortableHeader column="nation" label="Nazione" />
            <SortableHeader column="date" label="Date" />
            <TableHead>Luogo</TableHead>
            <SortableHeader column="cost" label="Costo" />
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                Caricamento...
              </TableCell>
            </TableRow>
          ) : events?.length ? (
            events.map((event: EventWithCategory) => (
              <TableRow key={event.id} className="block md:table-row mb-4 border rounded-lg md:border-b md:rounded-none">
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left">
                  <span className="font-bold md:hidden float-left">Titolo</span>
                  <div className="flex items-center gap-2">
                    {event.category_id === allenamentiCategory?.id && (
                      <Users className="h-4 w-4 text-blue-600" />
                    )}
                    {event.title}
                  </div>
                </TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Categoria</span>{event.categories?.name || 'N/A'}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Disciplina</span>{formatDiscipline(event.discipline)}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Livello</span>{formatLevel(event.level)}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Nazione</span>{event.nation || 'N/A'}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Date</span>{formatDateRange(event.date, event.end_date)}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left"><span className="font-bold md:hidden float-left">Luogo</span>{event.location}</TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right md:text-left">
                  <span className="font-bold md:hidden float-left">Costo</span>
                  {event.category_id === allenamentiCategory?.id && event.instructors && Array.isArray(event.instructors) ? (
                    <div className="text-sm">
                      <div>{event.cost != null && event.cost > 0 ? `€${event.cost}` : 'Gratuito'}</div>
                      <div className="text-muted-foreground">{event.instructors.length} istruttori</div>
                    </div>
                  ) : (
                    event.cost != null && event.cost > 0 ? `${event.cost}€` : 'Gratuito'
                  )}
                </TableCell>
                <TableCell className="block md:table-cell p-3 md:p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EventParticipantsModal 
                      eventId={event.id}
                      eventTitle={event.title}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openSheet(event)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente l'evento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(event.id)}>Elimina</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                Nessun evento trovato.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
