
import { useState, useEffect, useRef } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { apiSend } from '@/lib/apiClient';
import { useQuery } from '@tanstack/react-query';
import { getBlogTags, BlogTag } from '@/lib/blog-api';
import { Badge } from "@/components/ui/badge";
import { X, Tag } from "lucide-react";
// Rimuoviamo il Select custom per affidabilità nelle opzioni lingua
import { ImageUpload } from "@/components/admin/ImageUpload";

// Schema semplice: validiamo solo che la lingua sia stringa non vuota
const formSchema = z.object({
  language: z.string().min(2, { message: 'Lingua richiesta' }),
  title: z.string().min(2, { message: "Il titolo deve essere di almeno 2 caratteri." }),
  slug: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().min(10, { message: "Il contenuto deve essere di almeno 10 caratteri." }),
  image_url: z.string().url().optional(),
  published: z.boolean().default(false),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
});

interface BlogFormProps {
  article?: {
    id: string;
    language?: 'it' | 'en';
    title: string;
    subtitle?: string | null;
    content: string;
    cover_image_url?: string | null;
    category?: string;
    slug?: string;
    published?: boolean;
    tags?: BlogTag[];
  };
  onSave: () => void;
  onCancel: () => void;
}

const BlogForm = ({ article, onSave, onCancel }: BlogFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Fallback immediato: mostriamo subito tutte le lingue previste
  const fallbackLangs: { code: string; native_name: string; name?: string }[] = [
    { code: 'it', native_name: 'Italiano', name: 'Italian' },
    { code: 'en', native_name: 'English', name: 'English' },
    { code: 'es', native_name: 'Español', name: 'Spanish' },
    { code: 'fr', native_name: 'Français', name: 'French' },
    { code: 'pl', native_name: 'Polski', name: 'Polish' },
    { code: 'ru', native_name: 'Русский', name: 'Russian' },
  ];
  const [languages, setLanguages] = useState<{ code: string; native_name: string; name?: string }[]>(fallbackLangs);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return; // evita doppi fetch in StrictMode dev
    loadedRef.current = true;
    const base = (import.meta?.env?.BASE_URL || '/').replace(/\\+/g,'/');
    const url = base.endsWith('/') ? `${base}locales/languages.json` : `${base}/locales/languages.json`;
    const absolute = new URL(url, window.location.origin).toString();
    const load = async () => {
      setLoadingLanguages(true);
      try {
        const res = await fetch(absolute, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Formato inatteso languages.json');
        setLanguages(data);
        // Se l'articolo ha una lingua non presente (vecchia), la aggiungiamo in coda
        if (article?.language && !data.some((l: any) => l.code === article.language)) {
          setLanguages(prev => [...prev, { code: article.language!, native_name: article.language!, name: article.language! }]);
        }
      } catch (e) {
        console.error('Errore caricamento lingue', e);
        // fallback già presente (fallbackLangs)
      } finally {
        setLoadingLanguages(false);
      }
    };
    load();
  }, [article?.language]);

  const generateSlug = (title: string) => title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const [tagsLang, setTagsLang] = useState(article?.language || 'it');

  // Load available tags for the current form language
  const { data: availableTags = [] } = useQuery({
    queryKey: ['blog-tags', tagsLang],
    queryFn: () => getBlogTags(tagsLang),
  });

  // Initialize selected tags when editing
  useEffect(() => {
    if (article?.tags) {
      setSelectedTagIds(article.tags.map(t => t.id));
    } else {
      setSelectedTagIds([]);
    }
  }, [article]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: article?.language || "it",
      title: article?.title || "",
      slug: article?.slug || "",
      subtitle: article?.subtitle || "",
      content: article?.content || "",
      // mappiamo cover_image_url nel campo di form image_url
      image_url: article?.cover_image_url || "",
      published: article?.published ?? false,
      seo_title: (article as any)?.seo_title || "",
      seo_description: (article as any)?.seo_description || "",
    },
  });

  // Quando cambia l'articolo (apertura dialog in edit), resettiamo i valori del form
  useEffect(() => {
    if (article) {
      form.reset({
        language: article.language || 'it',
        title: article.title || '',
        slug: article.slug || '',
        subtitle: article.subtitle || '',
        content: article.content || '',
        image_url: article.cover_image_url || '',
        published: article.published ?? false,
        seo_title: (article as any)?.seo_title || '',
        seo_description: (article as any)?.seo_description || '',
      });
      setSlugManuallyEdited(true); // in edit, consideriamo lo slug come "manuale"
    } else {
      form.reset({
        language: 'it',
        title: '',
        slug: '',
        subtitle: '',
        content: '',
        image_url: '',
        published: false,
        seo_title: '',
        seo_description: '',
      });
      setSlugManuallyEdited(false);
    }
  }, [article, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per salvare un articolo",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const articleData = {
        language: values.language,
        title: values.title,
        subtitle: values.subtitle || null,
        content: values.content,
        cover_image_url: values.image_url || null,
        author_id: user.id,
        slug: values.slug || generateSlug(values.title),
        published: values.published,
        seo_title: values.seo_title || null,
        seo_description: values.seo_description || null,
        tag_ids: selectedTagIds,
      };

      if (article) {
        await apiSend(`/api/blog/${encodeURIComponent(article.id)}`, 'PUT', articleData);
      } else {
        await apiSend('/api/blog', 'POST', articleData);
      }

      toast({
        title: "Successo",
        description: `Articolo ${article ? 'aggiornato' : 'creato'} con successo`,
      });

      onSave();
    } catch (error) {
      console.error('Errore nel salvare l\'articolo:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nel salvare l'articolo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="blog-language-select" className="block mb-1">Lingua</FormLabel>
              <FormControl>
                <select
                  id="blog-language-select"
                  className="w-[220px] border rounded-md h-10 px-3 text-sm bg-background mt-1"
                  value={field.value}
                  onChange={(e) => { field.onChange(e.target.value); setTagsLang(e.target.value); }}
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.native_name || l.name || l.code}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titolo</FormLabel>
              <FormControl>
                <Input placeholder="Titolo dell'articolo" {...field} onChange={(e) => {
                  field.onChange(e);
                  // Auto-genera slug dal titolo se non modificato manualmente
                  if (!slugManuallyEdited) {
                    form.setValue('slug', generateSlug(e.target.value), { shouldDirty: true });
                  }
                }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug (URL)</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Input placeholder="slug-articolo" {...field} onChange={(e) => {
                    field.onChange(e);
                    setSlugManuallyEdited(true);
                  }} className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const title = form.getValues('title');
                    if (title) {
                      form.setValue('slug', generateSlug(title), { shouldDirty: true });
                      setSlugManuallyEdited(false);
                    }
                  }}>
                    Rigenera
                  </Button>
                </div>
              </FormControl>
              <FormDescription>Lo slug viene usato nell'URL: /blog/slug</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sottotitolo</FormLabel>
              <FormControl>
                <Input placeholder="Sottotitolo dell'articolo (opzionale)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contenuto</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Contenuto dell'articolo"
                  minHeight="200px"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Copertina (immagine o video)</FormLabel>
          <FormControl>
            <div>
              <ImageUpload
                supportVideo
                currentImageUrl={form.getValues('image_url') || undefined}
                onImageUploaded={(url) => form.setValue('image_url', url, { shouldDirty: true })}
                onImageRemoved={() => form.setValue('image_url', '', { shouldDirty: true })}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
        {/* Tag Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Tag</span>
          </div>
          {/* Selected tags */}
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {selectedTagIds.map(tid => {
              const t = availableTags.find(tag => tag.id === tid);
              if (!t) return null;
              return (
                <Badge key={tid} variant="secondary" className="flex items-center gap-1 pr-1">
                  {t.name}
                  <button type="button" className="ml-1 hover:bg-gray-200 rounded-full p-0.5" onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tid))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          {/* Available tags to add */}
          {availableTags.filter(t => !selectedTagIds.includes(t.id)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableTags.filter(t => !selectedTagIds.includes(t.id)).map(t => (
                <button
                  key={t.id}
                  type="button"
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => setSelectedTagIds(prev => [...prev, t.id])}
                >
                  + {t.name}
                </button>
              ))}
            </div>
          )}
          {availableTags.length === 0 && (
            <p className="text-xs text-gray-400">Nessun tag disponibile per la lingua selezionata. Crea tag nella sezione "Gestione Tag Blog".</p>
          )}
        </div>
        {/* SEO Fields */}
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">SEO (Search Engine Optimization)</h4>
          <FormField
            control={form.control}
            name="seo_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SEO Title</FormLabel>
                <FormControl>
                  <Input placeholder="Titolo per i motori di ricerca (max 60 caratteri)" maxLength={70} {...field} />
                </FormControl>
                <FormDescription>Se vuoto, verrà usato il titolo dell'articolo.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="seo_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta Description</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Descrizione per i motori di ricerca (max 160 caratteri)"
                    maxLength={170}
                    value={field.value || ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  {(field.value?.length || 0)}/160 caratteri. Questa descrizione appare nei risultati di Google.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Pubblica</FormLabel>
                <FormDescription>
                  Rendi l'articolo visibile nella pagina pubblica del blog
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default BlogForm;
