
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ForumCategory } from "@/lib/forum-api";

const formSchema = z.object({
  name: z.string().min(2, { message: "Il nome deve essere di almeno 2 caratteri." }),
  description: z.string().optional(),
  slug: z.string().min(2, { message: "Lo slug deve essere di almeno 2 caratteri." }),
  color: z.string().optional(),
});

type ForumCategoryFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: ForumCategory;
  isEditing: boolean;
};

export function ForumCategoryForm({ onSubmit, defaultValues, isEditing }: ForumCategoryFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      slug: defaultValues?.slug || "",
      color: defaultValues?.color || "#3B82F6",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Categoria</FormLabel>
              <FormControl>
                <Input placeholder="Es. Discussioni Generali" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Textarea placeholder="Descrizione della categoria..." {...field} />
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
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input placeholder="discussioni-generali" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colore</FormLabel>
              <FormControl>
                <Input type="color" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">{isEditing ? "Salva Modifiche" : "Crea Categoria"}</Button>
      </form>
    </Form>
  );
}
