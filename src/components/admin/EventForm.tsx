
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Event, Category } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { getCategories, EU_COUNTRIES } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { generateEventSlug } from "@/lib/seo-utils";
import { ImageUpload } from "./ImageUpload";
import { LocationPicker } from "./LocationPicker";
import { MultipleImageUpload } from "./MultipleImageUpload";
import { DISCIPLINE_OPTIONS, LEVEL_OPTIONS } from './event-constants';

// Opzioni per il livello
// Opzioni spostate in event-constants.ts

const eventFormSchema = z.object({
  title: z.string().min(2, { message: "Il titolo è obbligatorio." }),
  slug: z.string().optional(),
  description: z.string().optional(),
  discipline: z.string().optional(),
  location: z.string().optional(),
  date: z.string().optional(),
  end_date: z.string().optional(),
  participants: z.coerce.number().int().optional(),
  cost: z.coerce.number().optional(),
  image_url: z.string().optional(),
  category_id: z.string().uuid({ message: "Seleziona una categoria." }),
  nation: z.string().optional(),
  level: z.string().optional(),
  activity_description: z.string().optional(),
  language: z.string().optional(),
  about_us: z.string().optional(),
  objectives: z.string().optional(),
  included_in_activity: z.string().optional(),
  not_included_in_activity: z.string().optional(),
  notes: z.string().optional(),
  schedule_logistics: z.string().optional(),
  gallery_images: z.array(z.string()).optional(),
});

type EventFormProps = {
  onSubmit: (values: z.infer<typeof eventFormSchema>) => void;
  defaultValues?: Event;
  isEditing: boolean;
};

export function EventForm({ onSubmit, defaultValues, isEditing }: EventFormProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const form = useForm<z.infer<typeof eventFormSchema>>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      slug: defaultValues?.slug || "",
      description: defaultValues?.description || "",
      discipline: defaultValues?.discipline || "",
      location: defaultValues?.location || "",
      // Normalizza per input date (YYYY-MM-DD)
      date: (defaultValues?.date || "").toString().slice(0, 10),
      end_date: (defaultValues?.end_date || "").toString().slice(0, 10),
      participants: defaultValues?.participants || 0,
      cost: defaultValues?.cost || 0,
      image_url: defaultValues?.image_url || "",
      category_id: defaultValues?.category_id || undefined,
      nation: defaultValues?.nation || "",
      level: defaultValues?.level || "",
      activity_description: defaultValues?.activity_description || "",
      language: defaultValues?.language || "",
      about_us: defaultValues?.about_us || "",
      objectives: defaultValues?.objectives || "",
      included_in_activity: defaultValues?.included_in_activity || "",
      not_included_in_activity: defaultValues?.not_included_in_activity || "",
      notes: defaultValues?.notes || "",
      schedule_logistics: defaultValues?.schedule_logistics || "",
      gallery_images: defaultValues?.gallery_images || [],
    },
  });

  const handleSubmit = (values: z.infer<typeof eventFormSchema>) => {
    // Auto-generate SEO-friendly slug
    if (!values.slug || values.slug.trim() === '') {
      values.slug = generateEventSlug(values.title, values.date || '');
    }
    
    // Transform empty strings to null for new fields
    const transformedValues = {
      ...values,
      level: values.level && values.level.trim() !== '' ? values.level : null,
      activity_description: values.activity_description && values.activity_description.trim() !== '' ? values.activity_description : null,
      language: values.language && values.language.trim() !== '' ? values.language : null,
      about_us: values.about_us && values.about_us.trim() !== '' ? values.about_us : null,
      objectives: values.objectives && values.objectives.trim() !== '' ? values.objectives : null,
      included_in_activity: values.included_in_activity && values.included_in_activity.trim() !== '' ? values.included_in_activity : null,
      not_included_in_activity: values.not_included_in_activity && values.not_included_in_activity.trim() !== '' ? values.not_included_in_activity : null,
      notes: values.notes && values.notes.trim() !== '' ? values.notes : null,
      schedule_logistics: values.schedule_logistics && values.schedule_logistics.trim() !== '' ? values.schedule_logistics : null,
      gallery_images: values.gallery_images && values.gallery_images.length > 0 ? values.gallery_images : null,
    };
    
    onSubmit(transformedValues);
  };

  // Mappa il nome paese restituito da Nominatim a una delle opzioni della select (EU_COUNTRIES)
  const normalizeCountryForSelect = (country?: string): string | null => {
    if (!country) return null;
    const c = country.trim();
    // Mappa comuni IT -> EN dove necessario (o identità quando già coincide)
    const map: Record<string, string> = {
      'Italia': 'Italia',
      'Italy': 'Italia',
      'Francia': 'France',
      'France': 'France',
      'Germania': 'Germany',
      'Germany': 'Germany',
      'Spagna': 'Spain',
      'Spain': 'Spain',
      'Portogallo': 'Portugal',
      'Portugal': 'Portugal',
      'Paesi Bassi': 'Netherlands',
      'Olanda': 'Netherlands',
      'Netherlands': 'Netherlands',
      'Grecia': 'Greece',
      'Greece': 'Greece',
      'Austria': 'Austria',
      'Belgio': 'Belgium',
      'Belgium': 'Belgium',
      'Bulgaria': 'Bulgaria',
      'Croazia': 'Croatia',
      'Croatia': 'Croatia',
      'Cipro': 'Cyprus',
      'Cyprus': 'Cyprus',
      'Repubblica Ceca': 'Czech Republic',
      'Czechia': 'Czech Republic',
      'Czech Republic': 'Czech Republic',
      'Danimarca': 'Denmark',
      'Denmark': 'Denmark',
      'Estonia': 'Estonia',
      'Finlandia': 'Finland',
      'Finland': 'Finland',
      'Irlanda': 'Ireland',
      'Ireland': 'Ireland',
      'Lettonia': 'Latvia',
      'Latvia': 'Latvia',
      'Lituania': 'Lithuania',
      'Lithuania': 'Lithuania',
      'Lussemburgo': 'Luxembourg',
      'Luxembourg': 'Luxembourg',
      'Malta': 'Malta',
      'Polonia': 'Poland',
      'Poland': 'Poland',
      'Romania': 'Romania',
      'Slovacchia': 'Slovakia',
      'Slovakia': 'Slovakia',
      'Slovenia': 'Slovenia',
      'Svezia': 'Sweden',
      'Sweden': 'Sweden',
    };
    const mapped = map[c] || c;
    // Verifica che esista tra le opzioni
    return EU_COUNTRIES.includes(mapped) ? mapped : null;
  };

  const handleImageUploaded = (url: string) => {
    form.setValue('image_url', url);
  };

  const handleImageRemoved = () => {
    form.setValue('image_url', '');
  };

  const handleGalleryImagesChanged = (urls: string[]) => {
    form.setValue('gallery_images', urls);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titolo</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {isAdmin && (
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug (opzionale)</FormLabel>
                <FormControl><Input {...field} placeholder="Lascia vuoto per auto-generazione" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingCategories ? (
                    <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                  ) : (
                    categories?.map((cat: Category) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="discipline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Disciplina</FormLabel>
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
              <FormLabel>Livello</FormLabel>
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

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Aggiungi una descrizione dell'evento..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="activity_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione Attività</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descrizione dettagliata dell'attività..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lingua</FormLabel>
              <FormControl><Input {...field} placeholder="es. Italiano, Inglese, Francese" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="about_us"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chi Siamo</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Informazioni sull'organizzatore..."
                  {...field}
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
              <FormLabel>Obiettivi</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Obiettivi dell'evento..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="included_in_activity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cosa è Incluso nell'Attività</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Cosa è incluso nell'attività..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="not_included_in_activity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cosa NON è Incluso nell'Attività</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Cosa non è incluso nell'attività..."
                  {...field}
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
                  placeholder="es. Non adatto a donne in gravidanza, portare documento e brevetto..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="schedule_logistics"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Orari e Logistica</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Orari dell'evento e informazioni logistiche..."
                  {...field}
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
              <FormLabel>Nazione</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una nazione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EU_COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <LocationPicker
                  value={field.value || ""}
                  onChange={field.onChange}
                  onPlaceSelected={(info) => {
                    const country = info.address?.country;
                    const normalized = normalizeCountryForSelect(country);
                    if (normalized) {
                      form.setValue('nation', normalized);
                    }
                  }}
                  placeholder="Cerca una località..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data di Inizio</FormLabel>
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

        <FormField
          control={form.control}
          name="participants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Partecipanti</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Costo (€)</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Immagini</h3>
          
          <div>
            <FormLabel>Immagine Principale</FormLabel>
            <ImageUpload
              onImageUploaded={handleImageUploaded}
              currentImageUrl={form.watch('image_url')}
              onImageRemoved={handleImageRemoved}
            />
          </div>

          <div>
            <FormLabel>Galleria Immagini</FormLabel>
            <MultipleImageUpload
              onImagesChanged={handleGalleryImagesChanged}
              currentImages={form.watch('gallery_images') || []}
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full"
        >
          {isEditing ? "Salva Modifiche" : "Crea Evento"}
        </Button>
      </form>
    </Form>
  );
}
