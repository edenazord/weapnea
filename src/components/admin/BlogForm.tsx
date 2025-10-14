
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
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { apiSend } from '@/lib/apiClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/admin/ImageUpload";

// Schema semplice: validiamo solo che la lingua sia stringa non vuota
const formSchema = z.object({
  language: z.string().min(2, { message: 'Lingua richiesta' }),
  title: z.string().min(2, { message: "Il titolo deve essere di almeno 2 caratteri." }),
  content: z.string().min(10, { message: "Il contenuto deve essere di almeno 10 caratteri." }),
  image_url: z.string().url().optional(),
  category: z.string().optional(),
});

interface BlogFormProps {
  article?: {
    id: string;
    language?: 'it' | 'en';
    title: string;
    content: string;
    cover_image_url?: string | null; // campo reale restituito dall'API
    category?: string;
    slug?: string; // facoltativo, utile per non rigenerare slug se già esistente
  };
  onSave: () => void;
  onCancel: () => void;
}

const BlogForm = ({ article, onSave, onCancel }: BlogFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: article?.language || "it",
      title: article?.title || "",
      content: article?.content || "",
      // mappiamo cover_image_url nel campo di form image_url
      image_url: article?.cover_image_url || "",
      category: article?.category || "",
    },
  });

  // Quando cambia l'articolo (apertura dialog in edit), resettiamo i valori del form
  useEffect(() => {
    if (article) {
      form.reset({
        language: article.language || 'it',
        title: article.title || '',
        content: article.content || '',
        image_url: article.cover_image_url || '',
        category: article.category || '',
      });
    } else {
      form.reset({
        language: 'it',
        title: '',
        content: '',
        image_url: '',
        category: '',
      });
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
      const generatedSlug = values.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const articleData = {
        language: values.language,
        title: values.title,
        content: values.content,
        cover_image_url: values.image_url || null,
        author_id: user.id,
        // Se siamo in edit manteniamo lo slug esistente (evita 404 su link già pubblicati)
        slug: article?.slug || generatedSlug,
        // published lasciato invariato lato server (default false)
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
              <FormLabel>Lingua</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={'Seleziona la lingua'} />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.native_name || l.name || l.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Input placeholder="Titolo dell'articolo" {...field} />
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
                <Textarea placeholder="Contenuto dell'articolo" {...field} className="min-h-[100px]" />
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
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <FormControl>
                <Input placeholder="Categoria" {...field} />
              </FormControl>
              <FormMessage />
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
