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
// Per la galleria usiamo MultipleImageUpload; manteniamo ImageUpload per la foto brevetto istruttore (singola)
import { MultipleImageUpload } from "./MultipleImageUpload";
import { ImageUpload } from "./ImageUpload";
import { LocationPicker } from "./LocationPicker";

// Schema base (modifica): liberatorie opzionali
const allenamentiFormBaseSchema = z.object({
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
  fixed_appointment_text: z.string().optional(),
  // Multi-istruttore rimosso
  responsibility_waiver_accepted: z.boolean().optional(),
  privacy_accepted: z.boolean().optional(),
  image_url: z.string().optional(),
  cost: z.coerce.number().optional(),
  gallery_images: z.array(z.string()).optional(),
});

// Schema creazione: liberatorie obbligatorie
const allenamentiFormCreateSchema = allenamentiFormBaseSchema.extend({
  responsibility_waiver_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare la liberatoria di responsabilità." }),
  privacy_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare il trattamento della privacy." }),
});

type AllenamentiFormProps = {
  onSubmit: (values: z.infer<typeof allenamentiFormBaseSchema>) => void;
  defaultValues?: any;
  isEditing: boolean;
  allenamentiCategoryId: string;
};

export function AllenamentiForm({ onSubmit, defaultValues, isEditing, allenamentiCategoryId }: AllenamentiFormProps) {
  const form = useForm<z.infer<typeof allenamentiFormBaseSchema>>({
    resolver: zodResolver(isEditing ? allenamentiFormBaseSchema : allenamentiFormCreateSchema),
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
      fixed_appointment_text: (defaultValues as any)?.fixed_appointment_text || "",
      responsibility_waiver_accepted: defaultValues?.responsibility_waiver_accepted || false,
      privacy_accepted: defaultValues?.privacy_accepted || false,
      image_url: defaultValues?.image_url || "",
      cost: defaultValues?.cost || 0,
      // Se non ci sono immagini in galleria ma esiste image_url, lo mostro come prima immagine
      gallery_images: (defaultValues?.gallery_images && defaultValues.gallery_images.length > 0)
        ? defaultValues.gallery_images
        : (defaultValues?.image_url ? [defaultValues.image_url] : []),
    },
  });

  const handleGalleryImagesChanged = (urls: string[]) => {
    form.setValue('gallery_images', urls);
  };

  // Multi-istruttore rimosso: nessuna gestione add/remove

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((vals) => {
          const gallery = vals.gallery_images && vals.gallery_images.length > 0 ? vals.gallery_images : null;
          const transformed = {
            ...vals,
            gallery_images: gallery,
            image_url: gallery && gallery.length > 0 ? gallery[0] : null,
            fixed_appointment: Boolean(vals.fixed_appointment),
            fixed_appointment_text: vals.fixed_appointment && vals.fixed_appointment_text && vals.fixed_appointment_text.trim() !== ''
              ? vals.fixed_appointment_text.trim()
              : null,
          };
          onSubmit(transformed as any);
        })}
        className="space-y-6"
      >
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
                    onPlaceSelected={(info) => {
                      const country = info.address?.country?.trim();
                      if (country) {
                        // Scrive direttamente il testo nel campo Nazione
                        form.setValue('nation', country);
                      }
                    }}
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

          {/* Descrizione ricorrenza se appuntamento fisso */}
          {form.watch('fixed_appointment') && (
            <FormField
              control={form.control}
              name="fixed_appointment_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione ricorrenza</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Es. Ogni martedì e giovedì alle 19:00, ritrovo 18:45"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Sezione istruttori rimossa (multi-istruttore non più supportato) */}

        {/* Immagini e Costo */}
        <div className="space-y-4">
          <h4 className="font-medium text-lg">Immagini e Costo</h4>

          <div>
            <FormLabel>Galleria Immagini</FormLabel>
            <MultipleImageUpload
              onImagesChanged={handleGalleryImagesChanged}
              currentImages={form.watch('gallery_images') || []}
            />
            <p className="text-xs text-muted-foreground mt-1">La prima immagine diventa automaticamente la copertina.</p>
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

        {/* Liberatorie - solo in creazione */}
        {!isEditing && (
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
  )}

        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          variant="brand"
        >
          {isEditing ? "Salva Allenamento" : "Crea Allenamento Condiviso"}
        </Button>
      </form>
    </Form>
  );
}