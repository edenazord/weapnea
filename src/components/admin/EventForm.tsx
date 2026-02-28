
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Event, Category } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { generateEventSlug } from "@/lib/seo-utils";
// Rimosso ImageUpload in favore della sola galleria: la prima immagine sarà la copertina
import { LocationPicker } from "./LocationPicker";
import { MultipleImageUpload } from "./MultipleImageUpload";
import { DISCIPLINE_OPTIONS, LEVEL_OPTIONS } from './event-constants';
import { useEffect, useState } from 'react';
import { getPublicConfig } from '@/lib/publicConfig';
import { FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { backendConfig } from '@/lib/backendConfig';
import { ensureAbsoluteUrl } from '@/lib/utils';

// Opzioni per il livello
// Opzioni spostate in event-constants.ts

// Definizione shape riusabile (senza superRefine) per edit e create
const eventFormShape = z.object({
  title: z.string().min(2, { message: "Il titolo è obbligatorio." }),
  slug: z.string().optional(),
  description: z.string().optional(),
  discipline: z.string().optional(),
  location: z.string().optional(),
  // Con strategia B la data è richiesta SOLO se non è appuntamento fisso
  date: z.string().optional(),
  end_date: z.string().optional(),
  participants: z.coerce.number().int().optional(),
  cost: z.coerce.number().optional(),
  image_url: z.string().optional(),
  category_id: z.string().uuid({ message: "Seleziona una categoria." }),
  nation: z.string().optional(),
  level: z.string().optional(),
  // Campo legacy mantenuto per compatibilità, popolato automaticamente con "description"
  activity_description: z.string().optional(),
  language: z.string().optional(),
  about_us: z.string().optional(),
  objectives: z.string().optional(),
  included_in_activity: z.string().optional(),
  not_included_in_activity: z.string().optional(),
  notes: z.string().optional(),
  schedule_logistics: z.string().optional(),
  gallery_images: z.array(z.string()).optional(),
  pdf_url: z.string().optional(),
  whatsapp_group_url: z.string().optional(),
  // Appuntamento fisso (strategia B)
  fixed_appointment: z.boolean().optional(),
  fixed_appointment_text: z.string().optional(),
  validity_start: z.string().optional(),
  validity_end: z.string().optional(),
  // Liberatorie (solo obbligatorie in creazione, opzionali in modifica)
  responsibility_waiver_accepted: z.boolean().optional(),
  privacy_accepted: z.boolean().optional(),
});
// Schema base (edit) con validazioni condizionali
const eventFormBaseSchema = eventFormShape.superRefine((vals, ctx) => {
  if (!vals.description || vals.description.trim() === '' || vals.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'La descrizione è obbligatoria.' });
  }
  const isFixed = vals.fixed_appointment === true;
  if (isFixed) {
    if (!vals.validity_start || String(vals.validity_start).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validity_start'], message: 'Inserisci la data di inizio validità' });
    }
    if (vals.validity_start && vals.validity_end && vals.validity_end < vals.validity_start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validity_end'], message: 'La data di fine deve essere successiva a quella di inizio' });
    }
  } else {
    if (!vals.date || String(vals.date).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Inserisci la data di inizio' });
    }
    if (!vals.end_date || String(vals.end_date).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'Inserisci la data di fine' });
    }
    if (vals.date && vals.end_date && vals.end_date < vals.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'La data di fine deve essere successiva a quella di inizio' });
    }
  }
});

// Schema creazione: parte dallo shape e aggiunge liberatorie obbligatorie + stessa logica condizionale
const eventFormCreateSchema = eventFormShape.extend({
  responsibility_waiver_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare la liberatoria di responsabilità." }),
  privacy_accepted: z.boolean().refine(val => val === true, { message: "Devi accettare il trattamento della privacy." }),
}).superRefine((vals, ctx) => {
  if (!vals.description || vals.description.trim() === '' || vals.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'La descrizione è obbligatoria.' });
  }
  const isFixed = vals.fixed_appointment === true;
  if (isFixed) {
    if (!vals.validity_start || String(vals.validity_start).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validity_start'], message: 'Inserisci la data di inizio validità' });
    }
    if (vals.validity_start && vals.validity_end && vals.validity_end < vals.validity_start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validity_end'], message: 'La data di fine deve essere successiva a quella di inizio' });
    }
  } else {
    if (!vals.date || String(vals.date).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Inserisci la data di inizio' });
    }
    if (!vals.end_date || String(vals.end_date).trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'Inserisci la data di fine' });
    }
    if (vals.date && vals.end_date && vals.end_date < vals.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'La data di fine deve essere successiva a quella di inizio' });
    }
  }
});

type EventFormProps = {
  onSubmit: (values: z.infer<typeof eventFormBaseSchema>) => void;
  defaultValues?: Event;
  isEditing: boolean;
};

export function EventForm({ onSubmit, defaultValues, isEditing }: EventFormProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [eventsFree, setEventsFree] = useState(false);

  useEffect(() => {
    let mounted = true;
    getPublicConfig().then(cfg => { if (mounted) setEventsFree(Boolean(cfg.eventsFreeMode)); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const form = useForm<z.infer<typeof eventFormBaseSchema>>({
    resolver: zodResolver(isEditing ? eventFormBaseSchema : eventFormCreateSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      title: defaultValues?.title || "",
      slug: defaultValues?.slug || "",
      // Unifica i due campi descrittivi in uno solo, preferendo quello principale se presente
      description: (defaultValues?.description || defaultValues?.activity_description) || "",
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
      // Se in modifica non ci sono immagini in galleria ma esiste image_url, lo mostro come prima immagine
      gallery_images: (defaultValues?.gallery_images && defaultValues.gallery_images.length > 0)
        ? defaultValues.gallery_images
        : (defaultValues?.image_url ? [defaultValues.image_url] : []),
      pdf_url: (defaultValues as any)?.pdf_url || "",
      fixed_appointment: defaultValues?.fixed_appointment || false,
      fixed_appointment_text: (defaultValues as any)?.fixed_appointment_text || "",
      validity_start: (defaultValues?.date || "").toString().slice(0, 10),
      validity_end: (defaultValues?.end_date || "").toString().slice(0, 10),
      responsibility_waiver_accepted: defaultValues?.responsibility_waiver_accepted || false,
      privacy_accepted: defaultValues?.privacy_accepted || false,
    },
  });

  // Stato dinamico appuntamento fisso
  const isFixed = form.watch('fixed_appointment');

  const handleSubmit = (values: z.infer<typeof eventFormBaseSchema>) => {
    // Date normalization: evita stringhe vuote lato DB (prima per usarla nello slug)
    const isFixed = values.fixed_appointment === true;
    const startDate = (isFixed ? (values.validity_start || '') : (values.date || '')).trim();
    const endDateRaw = (isFixed ? (values.validity_end || '') : (values.end_date || '')).trim();
    // Auto-generate SEO-friendly slug se mancante
    if (!values.slug || values.slug.trim() === '') {
      values.slug = generateEventSlug(values.title, startDate || '');
    }
    // Transform empty strings to null per i campi testuali
    const singleDesc = values.description && values.description.trim() !== '' ? values.description.trim() : null;
    const gallery = values.gallery_images && values.gallery_images.length > 0 ? values.gallery_images : null;
    // Se end_date è vuota, usa la stessa di startDate (evento di 1 giorno)
    const normalizedEndDate = endDateRaw !== '' ? endDateRaw : startDate;
    const transformedValues = {
      ...values,
      date: startDate,
      end_date: normalizedEndDate,
      // Mantieni sempre il costo salvato a DB; sarà il server a mascherarlo se EVENTS_FREE_MODE=true
      cost: (values.cost !== undefined && values.cost !== null) ? Number(values.cost) : null,
      level: values.level && values.level.trim() !== '' ? values.level : null,
      // Mantieni activity_description allineato a description per compatibilità
      activity_description: singleDesc,
      description: singleDesc,
  fixed_appointment: isFixed ? true : false,
  fixed_appointment_text: values.fixed_appointment_text && values.fixed_appointment_text.trim() !== '' ? values.fixed_appointment_text.trim() : null,
      language: values.language && values.language.trim() !== '' ? values.language : null,
      about_us: values.about_us && values.about_us.trim() !== '' ? values.about_us : null,
      objectives: values.objectives && values.objectives.trim() !== '' ? values.objectives : null,
      included_in_activity: values.included_in_activity && values.included_in_activity.trim() !== '' ? values.included_in_activity : null,
      not_included_in_activity: values.not_included_in_activity && values.not_included_in_activity.trim() !== '' ? values.not_included_in_activity : null,
      notes: values.notes && values.notes.trim() !== '' ? values.notes : null,
      schedule_logistics: values.schedule_logistics && values.schedule_logistics.trim() !== '' ? values.schedule_logistics : null,
      gallery_images: gallery,
      pdf_url: values.pdf_url && values.pdf_url.trim() !== '' ? values.pdf_url.trim() : null,
      // La prima della galleria diventa l'immagine principale (copertina)
      image_url: gallery && gallery.length > 0 ? gallery[0] : null,
    };
    
    // Rimuovi campi solo UI (non esistono a DB)
    const { validity_start: _vs, validity_end: _ve, ...clean } = transformedValues as any;
    onSubmit(clean);
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
      <form
        onSubmit={(e) => {
          // Evita che il submit del form interno propaghi e attivi il form del profilo esterno
          e.stopPropagation();
          form.handleSubmit(handleSubmit)(e);
        }}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titolo <span className="text-red-500">*</span></FormLabel>
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
              <FormLabel>Categoria <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
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
              <Select onValueChange={field.onChange} value={field.value || ''}>
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
              <Select onValueChange={field.onChange} value={field.value || ''}>
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
          <FormLabel>Descrizione <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value || ''}
                  onChange={(val) => {
                    field.onChange(val);
                    form.trigger('description');
                  }}
                  placeholder="Aggiungi una descrizione dell'evento..."
                  minHeight="120px"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Unificazione: rimosso campo separato "Descrizione Attività". Usare solo "Descrizione". */}

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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Informazioni sull'organizzatore..."
                  minHeight="100px"
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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Obiettivi dell'evento..."
                  minHeight="100px"
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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Cosa è incluso nell'attività..."
                  minHeight="100px"
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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Cosa non è incluso nell'attività..."
                  minHeight="100px"
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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="es. Non adatto a donne in gravidanza, portare documento e brevetto..."
                  minHeight="100px"
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
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Orari dell'evento e informazioni logistiche..."
                  minHeight="100px"
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
              <FormControl>
                <LocationPicker
                  value={field.value || ""}
                  onChange={field.onChange}
                  onPlaceSelected={(info) => {
                    const country = info.address?.country?.trim();
                    if (country) form.setValue('nation', country);
                  }}
                  placeholder="Cerca una località..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Toggle appuntamento fisso */}
        <FormField
          control={form.control}
          name="fixed_appointment"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={(val) => field.onChange(Boolean(val))}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium">Appuntamento fisso (ricorrente)</FormLabel>
                <p className="text-xs text-muted-foreground">Usa un intervallo di validità + testo (es. "Ogni martedì e giovedì ore 19:00").</p>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isFixed && (
          <>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data di Inizio <span className="text-red-500">*</span></FormLabel>
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
                  <FormLabel>Data di Fine <span className="text-red-500">*</span></FormLabel>
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
          </>
        )}

        {isFixed && (
          <div className="space-y-4 rounded-md border p-4">
            <h4 className="font-medium">Intervallo di validità</h4>
            <FormField
              control={form.control}
              name="validity_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validità dal <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validity_end"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validità fino al (opzionale)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={form.watch('validity_start') || undefined}
                      {...field}
                      onChange={(e) => {
                        const start = form.getValues('validity_start');
                        const end = e.target.value;
                        if (start && end && end < start) {
                          form.setValue('validity_end', start);
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
              name="fixed_appointment_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione ricorrenza</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Es. Ogni martedì e giovedì alle 19:00, ritrovo 18:45"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

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
              {eventsFree && (
                <p className="text-xs text-muted-foreground mt-1">Attenzione: al momento gli eventi sono in modalità gratuita, il costo non sarà mostrato agli utenti ma verrà salvato.</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Galleria Immagini</h3>
          <p className="text-sm text-muted-foreground">La prima immagine diventa automaticamente la copertina. Dimensioni raccomandate: 1200×630 px.</p>
          <MultipleImageUpload
            onImagesChanged={handleGalleryImagesChanged}
            currentImages={form.watch('gallery_images') || []}
          />
        </div>

        {/* Upload PDF allegato */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Allegato PDF</h3>
          <p className="text-sm text-muted-foreground">Carica un PDF (programma, brochure, regolamento...).</p>
          {form.watch('pdf_url') ? (
            <div className="flex items-center gap-3 p-3 border rounded-md bg-gray-50">
              <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
              <a href={form.watch('pdf_url') || ''} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                {form.watch('pdf_url')?.split('/').pop()}
              </a>
              <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('pdf_url', '')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 15 * 1024 * 1024) {
                    toast.error('Il PDF è troppo grande. Massimo 15MB.');
                    return;
                  }
                  try {
                    const fd = new FormData();
                    fd.append('file', file);
                    const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
                    const { apiBaseUrl } = backendConfig;
                    const res = await fetch(`${apiBaseUrl || ''}/api/upload`, {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                      body: fd,
                    });
                    if (!res.ok) {
                      let serverMsg = `Upload failed (${res.status})`;
                      try { const j = await res.json(); serverMsg = j.error || serverMsg; } catch {}
                      throw new Error(serverMsg);
                    }
                    const data = await res.json();
                    const abs = ensureAbsoluteUrl(data.url, apiBaseUrl) || data.url;
                    form.setValue('pdf_url', abs);
                    toast.success('PDF caricato con successo!');
                  } catch (err: any) {
                    console.error('[pdf-upload]', err);
                    toast.error(err?.message || 'Errore durante il caricamento del PDF.');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Link Gruppo WhatsApp (opzionale) */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Gruppo WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Inserisci il link del gruppo WhatsApp. Verrà incluso nell'email di conferma iscrizione.
          </p>
          <FormField
            control={form.control}
            name="whatsapp_group_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Link gruppo WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://chat.whatsapp.com/..."
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Liberatorie obbligatorie - solo in creazione */}
        {!isEditing && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-lg font-semibold">Liberatorie Obbligatorie</h3>

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
                    Accetto la liberatoria di responsabilità <span className="text-red-500">*</span>
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
                    Accetto il trattamento della privacy <span className="text-red-500">*</span>
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
          variant="brand"
        >
          {isEditing ? "Salva Modifiche" : "Crea Evento"}
        </Button>
        <p className="text-xs text-muted-foreground text-center"><span className="text-red-500">*</span> Campi obbligatori</p>
      </form>
    </Form>
  );
}
