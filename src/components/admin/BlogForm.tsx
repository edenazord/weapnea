
import { useState } from 'react';
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

const formSchema = z.object({
  title: z.string().min(2, {
    message: "Il titolo deve essere di almeno 2 caratteri.",
  }),
  content: z.string().min(10, {
    message: "Il contenuto deve essere di almeno 10 caratteri.",
  }),
  image_url: z.string().url({
    message: "L'URL dell'immagine deve essere valido.",
  }).optional(),
  category: z.string().optional(),
});

interface BlogFormProps {
  article?: {
    id: string;
    title: string;
    content: string;
    image_url?: string;
    category?: string;
  };
  onSave: () => void;
  onCancel: () => void;
}

const BlogForm = ({ article, onSave, onCancel }: BlogFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: article?.title || "",
      content: article?.content || "",
      image_url: article?.image_url || "",
      category: article?.category || "",
    },
  });

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
        title: values.title,
        content: values.content,
        cover_image_url: values.image_url || null,
        author_id: user.id,
        slug: values.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
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
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Immagine</FormLabel>
              <FormControl>
                <Input placeholder="URL dell'immagine" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
