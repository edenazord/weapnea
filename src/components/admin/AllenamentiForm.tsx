import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DISCIPLINE_OPTIONS, LEVEL_OPTIONS } from "./event-constants";
import { ImageUpload } from "./ImageUpload";
import { LocationPicker } from "./LocationPicker";

const allenamentiFormSchema = z.object({
  title: z.string().min(2, { message: "Il titolo è obbligatorio." }),
  category_id: z.string().uuid(),
  discipline: z.string().min(1, { message: "La disciplina è obbligatoria." }),
  level: z.string().min(1, { message: "Il livello è obbligatorio." }),
  activity_details: z.string().min(10, { message: "Descrivi come si svolge l'attività (minimo 10 caratteri)." }),
  who_we_are: z.string().min(10, { message: "Descrivi chi siete (minimo 10 caratteri)." }),
  objectives: z.string().min(10, { message: "Gli obiettivi sono obbligatori (minimo 10 caratteri)." }),
  notes: z.string().optional(),
  schedule_meeting_point: z.string().min(5, { message: "Orari e punto di ritrovo sono obbligatori." }),
  nation: z.string().min(1, { message: "La nazione è obbligatoria." }),
  location: z.string().min(1, { message: "La località è obbligatoria." }),
  date: z.string().min(1, { message: "La data di inizio è obbligatoria." }),
  end_date: z.string().optional(),
  fixed_appointment: z.boolean().default(false),
  instructors: z.array(z.object({
    name: z.string().min(1, { message: "Nome istruttore obbligatorio" }),
    certificate_url: z.string().url().optional().or(z.literal(""))
  })).min(1, { message: "Almeno un istruttore è richiesto." }).max(10, { message: "Massimo 10 istruttori." }),
  max_participants_per_instructor: z.coerce.number().min(1).max(6, { message: "Massimo 6 partecipanti per istruttore." }),
  responsibility_waiver_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare la liberatoria di responsabilità." }),
  privacy_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare il trattamento della privacy." }),
  image_url: z.string().optional(),
  cost: z.coerce.number().optional(),
});

type AllenamentiFormProps = {
  onSubmit: (values: z.infer<typeof allenamentiFormSchema>) => void;
  defaultValues?: any;
  isEditing: boolean;
  allenamentiCategoryId: string;
};

export function AllenamentiForm({ onSubmit, defaultValues, isEditing, allenamentiCategoryId }: AllenamentiFormProps) {
  const form = useForm<z.infer<typeof allenamentiFormSchema>>({
    resolver: zodResolver(allenamentiFormSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      category_id: allenamentiCategoryId,
      discipline: defaultValues?.discipline || "",
      level: defaultValues?.level || "",
      activity_details: defaultValues?.activity_details || "",
      who_we_are: defaultValues?.who_we_are || "",
      objectives: defaultValues?.objectives || "",
      notes: defaultValues?.notes || "",
      schedule_meeting_point: defaultValues?.schedule_meeting_point || "",
      nation: defaultValues?.nation || "",
      location: defaultValues?.location || "",
      // Normalizza le date a YYYY-MM-DD per gli input type="date"
      date: (defaultValues?.date || "").toString().slice(0, 10),
      end_date: (defaultValues?.end_date || "").toString().slice(0, 10),
      fixed_appointment: defaultValues?.fixed_appointment || false,
      instructors: defaultValues?.instructors || [{ name: "", certificate_url: "" }],
      max_participants_per_instructor: defaultValues?.max_participants_per_instructor || 6,
      responsibility_waiver_accepted: defaultValues?.responsibility_waiver_accepted || false,
      privacy_accepted: defaultValues?.privacy_accepted || false,
      image_url: defaultValues?.image_url || "",
      cost: defaultValues?.cost || 0,
    },
  });

  const handleImageUploaded = (url: string) => {
    form.setValue('image_url', url);
  };

  const handleImageRemoved = () => {
    form.setValue('image_url', '');
  };

  const addInstructor = () => {
    const currentInstructors = form.getValues('instructors');
    if (currentInstructors.length < 10) {
      form.setValue('instructors', [...currentInstructors, { name: "", certificate_url: "" }]);
    }
  };

  const removeInstructor = (index: number) => {
    const currentInstructors = form.getValues('instructors');
    if (currentInstructors.length > 1) {
      form.setValue('instructors', currentInstructors.filter((_, i) => i !== index));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Mostra errori di validazione principali */}
        {Object.keys(form.formState.errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">Errori di validazione:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {Object.entries(form.formState.errors).map(([field, error]) => (
                <li key={field}>
                  • {field}: {error?.message || 'Errore di validazione'}
                </li>
              ))}
            </ul>
          </div>
        )}
        

        {/* Informazioni Base */}
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Informazioni Base</h4>
          
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titolo dell'Allenamento *</FormLabel>
                <FormControl><Input {...field} placeholder="es. Allenamento Apnea Avanzato" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discipline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disciplina *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona una disciplina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DISCIPLINE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Livello *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un livello" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Descrizione Attività */}
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Descrizione Attività</h4>
          
          <FormField
            control={form.control}
            name="activity_details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Come si svolge l'attività *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Descrivi dettagliatamente come si svolgerà l'allenamento..."
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="who_we_are"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chi siamo *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Presentazione degli organizzatori/istruttori..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="objectives"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Obiettivi *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Quali sono gli obiettivi di questo allenamento..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note e Avvertenze</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Eventuali note importanti, avvertenze, requisiti particolari..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Logistica */}
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Logistica</h4>
          
          <FormField
            control={form.control}
            name="schedule_meeting_point"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orari e Punto di Ritrovo *</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="es. Ritrovo ore 9:00 presso il Porto di Portofino, inizio attività ore 9:30..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nazione *</FormLabel>
                <FormControl><Input {...field} placeholder="es. Italia" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Località *</FormLabel>
                <FormControl>
                  <LocationPicker
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Cerca una località..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data di Inizio *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data di Fine</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={form.watch('date') || undefined}
                      {...field}
                      onChange={(e) => {
                        const start = form.getValues('date');
                        const end = e.target.value;
                        // Impedisci una fine precedente all'inizio
                        if (start && end && end < start) {
                          form.setValue('end_date', start);
                        } else {
                          field.onChange(end);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="fixed_appointment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Appuntamento fisso</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Spunta se questo è un appuntamento fisso ricorrente
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Istruttori */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-lg">Istruttori (max 10)</h4>
            <Button type="button" variant="outline" size="sm" onClick={addInstructor}>
              Aggiungi Istruttore
            </Button>
          </div>
          
          {form.watch('instructors').map((instructor, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium">Istruttore {index + 1}</h5>
                {form.watch('instructors').length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeInstructor(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Rimuovi
                  </Button>
                )}
              </div>
              
              <FormField
                control={form.control}
                name={`instructors.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome e Cognome *</FormLabel>
                    <FormControl><Input {...field} placeholder="Nome e cognome dell'istruttore" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Foto Brevetto (opzionale)</FormLabel>
                <ImageUpload
                  onImageUploaded={(url) => {
                    const instructors = form.getValues('instructors');
                    instructors[index].certificate_url = url;
                    form.setValue('instructors', instructors);
                  }}
                  currentImageUrl={instructor.certificate_url}
                  onImageRemoved={() => {
                    const instructors = form.getValues('instructors');
                    instructors[index].certificate_url = "";
                    form.setValue('instructors', instructors);
                  }}
                />
              </div>
            </div>
          ))}

          <FormField
            control={form.control}
            name="max_participants_per_instructor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Partecipanti per Istruttore (max 6) *</FormLabel>
                <FormControl><Input type="number" min="1" max="6" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Immagine e Costo */}
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Immagine e Costo</h4>
          
          <div>
            <FormLabel>Immagine Principale</FormLabel>
            <ImageUpload
              onImageUploaded={handleImageUploaded}
              currentImageUrl={form.watch('image_url')}
              onImageRemoved={handleImageRemoved}
            />
          </div>

          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo (€)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} placeholder="0 per gratuito" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Liberatorie */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium text-lg">Liberatorie Obbligatorie</h4>
          
          <FormField
            control={form.control}
            name="responsibility_waiver_accepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium">
                    Accetto la liberatoria di responsabilità *
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Confermo di essere responsabile per l'attività e i partecipanti
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="privacy_accepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium">
                    Accetto il trattamento della privacy *
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Confermo il trattamento dei dati secondo la normativa vigente
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
        >
          {isEditing ? "Salva Allenamento" : "Crea Allenamento Condiviso"}
        </Button>
      </form>
    </Form>
  );
}