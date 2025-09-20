import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getForumCategories, createForumCategory, updateForumCategory, deleteForumCategory, reorderForumCategories, type ForumCategory } from "@/lib/forum-api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ForumCategoryForm } from "./ForumCategoryForm";
import { toast } from "sonner";
import { Edit, Trash2, Plus, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DraggableList } from "./DraggableList";

export default function ForumCategoriesManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | undefined>(undefined);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: getForumCategories,
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setIsDialogOpen(false);
      setSelectedCategory(undefined);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  };

  const createMutation = useMutation({
    ...mutationOptions,
    mutationFn: createForumCategory,
    onSuccess: () => {
      toast.success("Categoria forum creata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const updateMutation = useMutation({
    ...mutationOptions,
    mutationFn: (data: { id: string; values: any }) => updateForumCategory(data.id, data.values),
    onSuccess: () => {
      toast.success("Categoria forum aggiornata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const deleteMutation = useMutation({
    ...mutationOptions,
    mutationFn: deleteForumCategory,
    onSuccess: () => {
      toast.success("Categoria forum eliminata con successo!");
      mutationOptions.onSuccess();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderForumCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      toast.success("Ordine categorie forum aggiornato con successo!");
      setIsReorderMode(false);
    },
    onError: (error: Error) => {
      toast.error(`Errore nel riordinamento: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    if (selectedCategory) {
      updateMutation.mutate({ id: selectedCategory.id, values });
    } else {
      createMutation.mutate(values);
    }
  };
  
  const openDialog = (category?: ForumCategory) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  }

  const handleDeleteCategory = (categoryId: string) => {
    deleteMutation.mutate(categoryId);
  };

  if (isLoading) return <div>Caricamento categorie forum...</div>;

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
              <Plus className="mr-2 h-4 w-4" /> Crea Categoria Forum
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedCategory ? "Modifica Categoria Forum" : "Nuova Categoria Forum"}</DialogTitle>
            </DialogHeader>
            <ForumCategoryForm 
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
            <TableHead>Descrizione</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Colore</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories?.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>{category.description || "-"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{category.slug}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: category.color || '#3B82F6' }}
                  />
                  <span className="text-sm text-gray-600">{category.color}</span>
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
                        Questa azione non può essere annullata. Questo eliminerà permanentemente la categoria del forum e tutti i topic associati.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Elimina</AlertDialogAction>
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
