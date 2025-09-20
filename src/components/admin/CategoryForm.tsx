
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/api";

const formSchema = z.object({
  name: z.string().min(2, { message: "Il nome deve essere di almeno 2 caratteri." }),
});

type CategoryFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  defaultValues?: Category;
  isEditing: boolean;
};

export function CategoryForm({ onSubmit, defaultValues, isEditing }: CategoryFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: defaultValues?.name || "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Categoria</FormLabel>
              <FormControl>
                <Input placeholder="Es. Workshop" {...field} />
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
