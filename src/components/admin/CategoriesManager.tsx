import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  reorderCategories, 
  type CategoryWithEventCount, 
  getSetting, 
  setSetting, 
  getEvents, 
  type EventWithCategory
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CategoryForm } from "./CategoryForm";
import { toast } from "sonner";
import { Edit, Trash2, Plus, ArrowUpDown, History } from "lucide-react";
import { DraggableList } from "./DraggableList";
import { parseISO, isValid, startOfDay } from "date-fns";

const PAST_SETTING_KEY = "past_events_category_position";
const SYNTHETIC_PAST_ID = "__past_events__";

type DraggableItem = { id: string; name: string };

type ListEntry =
  | { kind: "real"; data: CategoryWithEventCount }
  | { kind: "past"; data: { id: string; name: string; events_count: number } };

function isEventPast(event: EventWithCategory) {
  if (!event?.date) return false;
  try {
    const todayStart = startOfDay(new Date());
    const start = parseISO(event.date);
    const end = event.end_date ? parseISO(event.end_date) : undefined;
    const startPast = isValid(start) && start < todayStart;
    const endPast = end && isValid(end) && end < todayStart;
    return Boolean(endPast || (!end && startPast));
  } catch {
    return false;
  }
}

export default function CategoriesManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithEventCount | undefined>(undefined);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // settings per posizione "Eventi Passati"
  const { data: pastPos } = useQuery({
    queryKey: ["settings", PAST_SETTING_KEY],
    queryFn: () => getSetting<{ index: number }>(PAST_SETTING_KEY),
  });

  // eventi per conteggio "passati"
  const { data: allEvents } = useQuery({
    queryKey: ["events", "for-past-count"],
    queryFn: () => getEvents(),
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsDialogOpen(false);
      setSelectedCategory(undefined);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  } as const;

  const createMutation = useMutation({
    ...mutationOptions,
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success("Categoria creata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const updateMutation = useMutation({
    ...mutationOptions,
    mutationFn: (data: { id: string; values: Partial<Pick<CategoryWithEventCount, "name" | "order_index">> }) =>
      updateCategory(data.id, data.values),
    onSuccess: () => {
      toast.success("Categoria aggiornata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const deleteMutation = useMutation({
    ...mutationOptions,
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success("Categoria eliminata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Ordine categorie aggiornato con successo!");
      setIsReorderMode(false);
    },
    onError: (error: Error) => {
      toast.error(`Errore nel riordinamento: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: { name: string }) => {
    if (selectedCategory) {
      updateMutation.mutate({ id: selectedCategory.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const openDialog = (category?: CategoryWithEventCount) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  const pastCount = useMemo(() => (allEvents || []).filter(isEventPast).length, [allEvents]);

  // Niente return anticipato: la modalità riordino viene renderizzata nel JSX sottostante

  // Vista NORMALE: costruisci righe con inserimento dell'elemento sintetico alla posizione salvata
  const entries: ListEntry[] = useMemo(() => {
    const list: ListEntry[] = (categories || []).map(c => ({ kind: "real", data: c }));
    const total = list.length;
    const idx = (pastPos?.value && typeof (pastPos as any).value?.index === "number")
      ? Math.max(0, Math.min((pastPos as any).value.index, total))
      : total;
    list.splice(idx, 0, { kind: "past", data: { id: SYNTHETIC_PAST_ID, name: "Eventi Passati", events_count: pastCount } });
    return list;
  }, [categories, pastPos, pastCount]);

  return (
    <div className="space-y-4">
      {isReorderMode && categories ? (
        (() => {
          const baseItems: DraggableItem[] = categories.map(cat => ({ id: cat.id, name: cat.name }));
          const defaultIndex = baseItems.length; // fallback alla fine
          const insertIndex = (pastPos?.value && typeof (pastPos as any).value?.index === "number")
            ? Math.max(0, Math.min((pastPos as any).value.index, baseItems.length))
            : defaultIndex;
          const itemsWithPast: DraggableItem[] = [...baseItems];
          itemsWithPast.splice(insertIndex, 0, { id: SYNTHETIC_PAST_ID, name: "Eventi Passati" });

          const handleReorder = async (itemIds: string[]) => {
            const idx = itemIds.indexOf(SYNTHETIC_PAST_ID);
            const realIds = itemIds.filter(id => id !== SYNTHETIC_PAST_ID);
            await reorderMutation.mutateAsync(realIds);
            await setSetting(PAST_SETTING_KEY, { index: idx === -1 ? realIds.length : idx });
            await queryClient.invalidateQueries({ queryKey: ["settings", PAST_SETTING_KEY] });
            toast.success("Posizione 'Eventi Passati' aggiornata");
            setIsReorderMode(false);
          };

          return (
            <DraggableList
              items={itemsWithPast}
              onReorder={handleReorder}
              onCancel={() => setIsReorderMode(false)}
            />
          );
        })()
      ) : isLoading ? (
        <div>Caricamento categorie...</div>
      ) : (
        <>
      <div className="flex justify-between">
        <Button 
          variant="outline"
          onClick={() => setIsReorderMode(true)}
          disabled={!categories || categories.length === 0}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" /> 
          Riordina Categorie
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedCategory(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Crea Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedCategory ? "Modifica Categoria" : "Nuova Categoria"}</DialogTitle>
            </DialogHeader>
            <CategoryForm 
              onSubmit={handleFormSubmit}
              defaultValues={selectedCategory}
              isEditing={!!selectedCategory}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, idx) => (
            entry.kind === "real" ? (
              <TableRow key={entry.data.id}>
                <TableCell>
                  <div className="flex items-center justify-between">
                    <span>{entry.data.name}</span>
                    <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {entry.data.events_count}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => openDialog(entry.data)}>
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
                          Questa azione non può essere annullata. Questo eliminerà permanentemente la categoria.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(entry.data.id)}>Elimina</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={`past-${idx}`} className="bg-muted/40">
                <TableCell>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Eventi Passati</span>
                    <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {entry.data.events_count}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" disabled title="Elemento di sistema">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled title="Elemento di sistema">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          ))}
        </TableBody>
      </Table>
        </>
      )}
    </div>
  );
}
