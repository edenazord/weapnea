import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBlogTags, createBlogTag, updateBlogTag, deleteBlogTag, BlogTag } from '@/lib/blog-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Loader2, Tag, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LANGUAGES = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
];

const BlogTagManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterLang, setFilterLang] = useState<string>('all');
  const [newTagName, setNewTagName] = useState('');
  const [newTagLang, setNewTagLang] = useState('it');
  const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['blog-tags', filterLang === 'all' ? undefined : filterLang],
    queryFn: () => getBlogTags(filterLang === 'all' ? undefined : filterLang),
  });

  const createMutation = useMutation({
    mutationFn: ({ name, language }: { name: string; language: string }) => createBlogTag(name, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
      setNewTagName('');
      toast({ title: 'Tag creato', description: 'Il tag è stato creato con successo.' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile creare il tag. Potrebbe già esistere.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateBlogTag(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
      setEditingTag(null);
      toast({ title: 'Tag aggiornato', description: 'Il tag è stato aggiornato.' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile aggiornare il tag.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBlogTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-tags'] });
      setDeleteDialog(null);
      toast({ title: 'Tag eliminato', description: 'Il tag è stato eliminato.' });
    },
    onError: () => {
      toast({ title: 'Errore', description: 'Impossibile eliminare il tag.', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    const name = newTagName.trim();
    if (!name) return;
    createMutation.mutate({ name, language: newTagLang });
  };

  const handleUpdate = () => {
    if (!editingTag || !editName.trim()) return;
    updateMutation.mutate({ id: editingTag.id, name: editName.trim() });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Gestione Tag Blog
        </h3>
        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tutte le lingue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le lingue</SelectItem>
            {LANGUAGES.map(l => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Create new tag */}
      <div className="flex items-center gap-2 p-4 border rounded-lg bg-gray-50">
        <Input
          placeholder="Nome del tag..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          className="flex-1 max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Select value={newTagLang} onValueChange={setNewTagLang}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => (
              <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreate} disabled={!newTagName.trim() || createMutation.isPending} variant="brand" size="sm">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Aggiungi
        </Button>
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Caricamento tag...
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nessun tag creato. Inizia creando il primo tag.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 bg-white border rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow"
            >
              {editingTag?.id === tag.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 w-32 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate();
                      if (e.key === 'Escape') setEditingTag(null);
                    }}
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleUpdate} disabled={updateMutation.isPending}>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingTag(null)}>
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-medium text-sm">{tag.name}</span>
                  <Badge variant="outline" className="text-xs">{tag.language.toUpperCase()}</Badge>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                    setEditingTag(tag);
                    setEditName(tag.name);
                  }}>
                    <Edit className="h-3.5 w-3.5 text-gray-400 hover:text-blue-600" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDeleteDialog(tag.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo tag? Verrà rimosso da tutti gli articoli associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Annulla</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogTagManager;
