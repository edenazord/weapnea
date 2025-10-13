import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBlogArticles, deleteBlogArticle } from "@/lib/blog-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, Eye, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import BlogForm from "./BlogForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BlogManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [language, setLanguage] = useState<'it'|'en'|'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-blog-articles', searchTerm, language],
    queryFn: () => {
      console.log("Fetching blog articles with search term:", searchTerm);
      return getBlogArticles(
        false,
        searchTerm,
        { column: 'created_at', direction: 'desc' },
        language === 'all' ? undefined : language
      );
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  console.log("Blog articles loading state:", isLoading);
  console.log("Blog articles data:", articles);
  console.log("Blog articles error:", error);

  const deleteMutation = useMutation({
    mutationFn: deleteBlogArticle,
    onSuccess: () => {
      toast({
        title: "Articolo eliminato",
        description: "L'articolo è stato eliminato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ['admin-blog-articles'] });
      setDeleteDialog(null);
    },
    onError: (error) => {
      console.error("Error deleting article:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'articolo.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    console.log("Deleting article with ID:", id);
    deleteMutation.mutate(id);
  };

  const handleFormSuccess = () => {
    console.log("Blog form success, invalidating queries");
    setShowForm(false);
    setEditingArticle(null);
    queryClient.invalidateQueries({ queryKey: ['admin-blog-articles'] });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: it });
    } catch {
      return dateString;
    }
  };

  const handleRetry = () => {
    console.log("Retrying blog articles fetch");
    refetch();
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Errore nel caricamento
          </h3>
          <p className="text-gray-600 mb-4">
            Si è verificato un errore durante il caricamento degli articoli.
          </p>
          <Button onClick={handleRetry} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Cerca articoli..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={(v) => setLanguage(v as 'all' | 'it' | 'en')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tutte le lingue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le lingue</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="en">Inglese</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Articolo
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titolo</TableHead>
              <TableHead>Lingua</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Data Creazione</TableHead>
              <TableHead>Ultima Modifica</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Caricamento articoli...
                  </div>
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {searchTerm ? 'Nessun articolo trovato per la ricerca.' : 'Nessun articolo creato.'}
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{article.title}</div>
                      {article.excerpt && (
                        <div className="text-sm text-gray-500 line-clamp-1">
                          {article.excerpt}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {(article.language || 'it').toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={article.published ? "default" : "secondary"}>
                      {article.published ? "Pubblicato" : "Bozza"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(article.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(article.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {article.published && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log("Editing article:", article.id);
                          setEditingArticle(article);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog(article.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm || !!editingArticle} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingArticle(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Modifica Articolo" : "Nuovo Articolo"}
            </DialogTitle>
            <DialogDescription>
              {editingArticle ? "Modifica i dettagli dell'articolo." : "Crea un nuovo articolo per il blog."}
            </DialogDescription>
          </DialogHeader>
          <BlogForm
            article={editingArticle}
            onSave={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingArticle(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Annulla
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogManager;
