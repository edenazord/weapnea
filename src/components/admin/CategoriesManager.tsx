import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories, CategoryWithEventCount } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CategoryForm } from "./CategoryForm";
import { toast } from "sonner";
import { Edit, Trash2, Plus, ArrowUpDown } from "lucide-react";
import { DraggableList } from "./DraggableList";

export default function CategoriesManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithEventCount | undefined>(undefined);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
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
  };

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
    mutationFn: (data: { id: string; values: { name: string } }) => updateCategory(data.id, data.values),
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
  }

  if (isLoading) return <div>Caricamento categorie...</div>;

  if (isReorderMode && categories) {
    const draggableItems = categories.map(cat => ({ id: cat.id, name: cat.name }));
    
    return (
      <DraggableList
        items={draggableItems}
        onReorder={(itemIds) => reorderMutation.mutateAsync(itemIds)}
        onCancel={() => setIsReorderMode(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
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
          <DialogContent>
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
          {categories?.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <div className="flex items-center justify-between">
                  <span>{category.name}</span>
                  <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {category.events_count}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="ghost" size="icon" onClick={() => openDialog(category)}>
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
                      <AlertDialogAction onClick={() => deleteMutation.mutate(category.id)}>Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
