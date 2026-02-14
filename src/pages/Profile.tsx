import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
// import { supabase } from "@/integrations/supabase/client";
import { apiSend, apiGet } from "@/lib/apiClient";
import { backendConfig } from "@/lib/backendConfig";
import { getPublicConfig } from "@/lib/publicConfig";
import { removeEventParticipant } from "@/lib/payments-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/DatePicker";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCircle, FileText, Calendar, Shield, Building, Users, MapPin, Eye, X, PlusCircle, Pencil, Trash2, MessageCircle } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link } from "react-router-dom";
import { buildFriendlyEventPath } from "@/lib/seo-utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
// import ProfileMobileNav from "@/components/ProfileMobileNav";
import { format, parseISO, isValid } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useDebounce } from "@/hooks/useDebounce";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createEvent, Event, getEvents, EventWithCategory, updateEvent, deleteEvent } from "@/lib/api";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { EventForm } from "@/components/admin/EventForm";
import { CenteredNotice } from "@/components/CenteredNotice";
import { useChatStore } from "@/hooks/useChatStore";
// Rimosso dropdown per sostituirlo con sotto-tab statiche interne alla sezione Eventi

type BestDiscipline = 'STA' | 'DYN' | 'DYNB' | 'DNF' | 'FIM' | 'CWT' | 'CWTB' | 'CNF' | 'VWT' | 'NLT';
type BestEntry = { discipline: BestDiscipline; value: string };
type PersonalBest = Record<string, string> | BestEntry[];
type CertEntryType = 'insurance' | 'medical' | 'certificate';
type CertEntry = { type: CertEntryType; name: string; number: string; expiry: string };

const DISCIPLINE_CODES: { code: BestDiscipline; labelKey: string; hint: string }[] = [
  { code: 'STA', labelKey: 'STA', hint: 'mm:ss' },
  { code: 'DYN', labelKey: 'DYN', hint: 'metri' },
  { code: 'DYNB', labelKey: 'DYNB', hint: 'metri' },
  { code: 'DNF', labelKey: 'DNF', hint: 'metri' },
  { code: 'FIM', labelKey: 'FIM', hint: 'metri' },
  { code: 'CWT', labelKey: 'CWT', hint: 'metri' },
  { code: 'CWTB', labelKey: 'CWTB', hint: 'metri' },
  { code: 'CNF', labelKey: 'CNF', hint: 'metri' },
  { code: 'VWT', labelKey: 'VWT', hint: 'metri' },
  { code: 'NLT', labelKey: 'NLT', hint: 'metri' },
];

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { openChat } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
  const [eventsFreeMode, setEventsFreeMode] = useState(true); // default true per sicurezza
  // Stato locale per mostrare vista organizzazione dentro la tab Eventi
  const [showOrganizer, setShowOrganizer] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    brevetto: "",
    didattica_brevetto: "",
    numero_brevetto: "",
    foto_brevetto_url: "",
    scadenza_brevetto: "",
    scadenza_certificato_medico: "",
  certificato_medico_tipo: "",
    assicurazione: "",
    numero_assicurazione: "",
    dichiarazione_brevetto_valido: false,
    dichiarazione_assicurazione_valida: false,
    scadenza_assicurazione: "",
    instagram_contact: "",
    phone: "",
    contact_email: "",
    avatar_url: "",
    company_name: "",
    vat_number: "",
    company_address: "",
    public_profile_enabled: false,
    public_slug: "",
  public_show_bio: true,
  public_show_instagram: true,
  public_show_company_info: true,
  public_show_certifications: true,
  public_show_events: true,
  public_show_records: true,
  public_show_personal: true,
  });

  const [bestEntries, setBestEntries] = useState<BestEntry[]>([]);
  const [certEntries, setCertEntries] = useState<CertEntry[]>([]);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const debouncedPublicSlug = useDebounce(formData.public_slug, 400);

  type EventItem = {
    id: string;
    title: string;
    date?: string;
    end_date?: string;
    location?: string;
    image_url?: string;
    slug: string;
    fixed_appointment?: boolean | null;
    fixed_appointment_text?: string | null;
  };
  type EventParticipation = {
    id: string;
    status: string;
    registered_at: string;
    events: EventItem;
  };
  const [participations, setParticipations] = useState<EventParticipation[]>([]);
  const [isLoadingParticipations, setIsLoadingParticipations] = useState(false);
  
  // Util per serializzare una data in formato locale YYYY-MM-DD (senza shift UTC)
  const toLocalDateString = (d?: Date) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  // Requisiti per abilitare l'organizzazione eventi
  const today = new Date();
  // Tolleranza di 1 mese: chi scade nel mese corrente può ancora organizzare
  const toleranceDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  const hasPhone = !!(formData.phone && formData.phone.trim());
  const hasInsurance = !!(formData.assicurazione && formData.assicurazione.trim());
  const insuranceOk = formData.scadenza_assicurazione ? (new Date(formData.scadenza_assicurazione) >= toleranceDate) : false;
  const medicalOk = formData.scadenza_certificato_medico ? (new Date(formData.scadenza_certificato_medico) >= toleranceDate) : false;
  const publicEnabled = !!formData.public_profile_enabled;
  const hasSlug = !!(formData.public_slug && formData.public_slug.trim());
  const organizerEligible = publicEnabled && hasSlug && hasPhone && hasInsurance && insuranceOk && medicalOk;

  // Lista requisiti mancanti per organizzare
  const missingRequirements: string[] = [];
  if (!publicEnabled) missingRequirements.push(t('profile.requirements.public_profile', 'Profilo pubblico attivo'));
  if (!hasSlug) missingRequirements.push(t('profile.requirements.public_slug', 'Slug profilo pubblico'));
  if (!hasPhone) missingRequirements.push(t('profile.requirements.phone', 'Numero di telefono'));
  if (!hasInsurance) missingRequirements.push(t('profile.requirements.insurance', 'Assicurazione'));
  if (hasInsurance && !insuranceOk) missingRequirements.push(t('profile.requirements.insurance_valid', 'Assicurazione in corso di validità'));
  if (!medicalOk) missingRequirements.push(t('profile.requirements.medical', 'Certificato medico in corso di validità'));

  // Nessun calcolo di progress: le sezioni sono opzionali/variabili per ruolo

  // Stato per modale laterale (Sheet) come nei modali originali
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState("");
  // Stato per elenco iscritti a un evento
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participants, setParticipants] = useState<Array<{ id: string; user_id: string; full_name: string | null; paid_at: string | null; avatar_url?: string | null; company_name?: string | null; phone?: string | null; role?: string | null; public_profile_enabled?: boolean; public_slug?: string | null; }>>([]);
  const [participantsEventTitle, setParticipantsEventTitle] = useState<string>("");
  const [participantsEventId, setParticipantsEventId] = useState<string>("");
  // Stato per modifica evento
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithCategory | null>(null);

  // Query eventi organizzati (solo quando vista organizer attiva)
  const { data: organizedEvents, isLoading: isLoadingOrganized, refetch: refetchOrganized } = useQuery<EventWithCategory[]>({
    queryKey: ['organized-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
  const rows = await getEvents(undefined, { column: 'date', direction: 'asc' }, undefined, undefined, user.role, user.id);
      return rows.filter(r => r.organizer_id === user.id || r.organizer?.id === user.id);
    },
    enabled: !!user && showOrganizer,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Event>) => createEvent(payload as Event),
    onSuccess: () => {
      setNoticeMsg("Creato con successo!");
      setNoticeOpen(true);
  // Chiudi lo sheet laterale
  setIsSheetOpen(false);
      // Aggiorna elenco organizzati
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: 'Errore creazione', description: err?.message || 'Creazione fallita', variant: 'destructive' });
    }
  });

  const editMutation = useMutation({
    mutationFn: (payload: { id: string; patch: Partial<Event> }) => updateEvent(payload.id, payload.patch),
    onSuccess: () => {
      setNoticeMsg("Salvato con successo!");
      setNoticeOpen(true);
      setIsEditSheetOpen(false);
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: 'Errore salvataggio', description: err?.message || 'Modifica fallita', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      setNoticeMsg("Evento eliminato con successo!");
      setNoticeOpen(true);
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: 'Errore eliminazione', description: err?.message || 'Eliminazione fallita', variant: 'destructive' });
    }
  });

  const handleDeleteEvent = (id: string, title: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'evento "${title}"? Questa azione non può essere annullata.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenCreateEvent = () => { setIsSheetOpen(true); };

  const handleEventFormSubmit = async (values: any) => {
    try {
      await createMutation.mutateAsync(values as Partial<Event>);
    } catch (e) {
      // handled by mutation onError
    }
  };

  const openParticipantsForEvent = async (ev: { id: string; title: string }) => {
    setParticipantsEventId(ev.id);
    setParticipantsEventTitle(ev.title);
    setParticipantsOpen(true);
    setParticipantsLoading(true);
    try {
      const rows = await apiGet(`/api/events/${encodeURIComponent(ev.id)}/participants`);
      setParticipants(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setParticipants([]);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const openEditEvent = (ev: EventWithCategory) => {
    setEditingEvent(ev);
    setIsEditSheetOpen(true);
  };

  const handleEventEditSubmit = async (values: any) => {
    if (!editingEvent) return;
    try {
      await editMutation.mutateAsync({ id: editingEvent.id, patch: values as Partial<Event> });
    } catch (e) {
      // handled by mutation onError
    }
  };

  const handleAllenamentiFormSubmit = async (values: any) => {
    const payload: Partial<Event> = {
      title: values.title,
      slug: values.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: `Allenamento condiviso: ${values.activity_details}`,
      discipline: values.discipline,
      location: values.location,
      date: values.date,
      end_date: values.end_date || null,
      participants: null,
      cost: values.cost ? Number(values.cost) : null,
      image_url: values.image_url || null,
      category_id: values.category_id,
      nation: values.nation,
      level: values.level,
      activity_description: values.activity_details,
      about_us: values.who_we_are,
      objectives: values.objectives,
      notes: values.notes || null,
      schedule_logistics: values.schedule_meeting_point,
      activity_details: values.activity_details,
      who_we_are: values.who_we_are,
      fixed_appointment: Boolean(values.fixed_appointment),
      fixed_appointment_text: values.fixed_appointment && values.fixed_appointment_text && values.fixed_appointment_text.trim() !== ''
        ? values.fixed_appointment_text.trim()
        : null,
      schedule_meeting_point: values.schedule_meeting_point,
      responsibility_waiver_accepted: values.responsibility_waiver_accepted,
      privacy_accepted: values.privacy_accepted,
    };
    try {
      await createMutation.mutateAsync(payload);
    } catch (e) {
      // handled by mutation onError
    }
  };

  const formatEventDate = (start?: string, end?: string) => {
    if (start) {
      const s = parseISO(start);
      if (isValid(s)) {
        if (end) {
          const e = parseISO(end);
          if (isValid(e)) {
            return `${format(s, 'dd/MM/yyyy', { locale: itLocale })} - ${format(e, 'dd/MM/yyyy', { locale: itLocale })}`;
          }
        }
        return format(s, 'dd/MM/yyyy', { locale: itLocale });
      }
    }
    return t('events.date_tbd', 'Data da definire');
  };

  const formatEventWithFixed = (ev: EventWithCategory) => {
    if (ev.fixed_appointment) {
      const validity = formatEventDate(ev.date || undefined, ev.end_date || undefined);
      const text = ev.fixed_appointment_text ? ev.fixed_appointment_text : 'Appuntamento ricorrente';
      return `${text} (${validity})`;
    }
    return formatEventDate(ev.date || undefined, ev.end_date || undefined);
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[@._]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        bio: user.bio || "",
        brevetto: user.brevetto || "",
        didattica_brevetto: (user as any).didattica_brevetto || "",
        numero_brevetto: (user as any).numero_brevetto || "",
        foto_brevetto_url: (user as any).foto_brevetto_url || "",
        scadenza_brevetto: user.scadenza_brevetto || "",
        scadenza_certificato_medico: user.scadenza_certificato_medico || "",
  certificato_medico_tipo: (user as any).certificato_medico_tipo || "",
        assicurazione: user.assicurazione || "",
        numero_assicurazione: (user as any).numero_assicurazione || "",
        dichiarazione_brevetto_valido: Boolean((user as any).dichiarazione_brevetto_valido) || false,
        dichiarazione_assicurazione_valida: Boolean((user as any).dichiarazione_assicurazione_valida) || false,
        scadenza_assicurazione: user.scadenza_assicurazione || "",
        instagram_contact: user.instagram_contact || "",
        phone: (user as any).phone || "",
        contact_email: (user as any).contact_email || "",
        avatar_url: user.avatar_url || "",
        company_name: user.company_name || "",
        vat_number: user.vat_number || "",
        company_address: user.company_address || "",
        public_profile_enabled: (user as any).public_profile_enabled ?? false,
        public_slug: (user as any).public_slug || "",
  public_show_bio: (user as any).public_show_bio ?? true,
  public_show_instagram: (user as any).public_show_instagram ?? true,
  public_show_company_info: (user as any).public_show_company_info ?? true,
  public_show_certifications: (user as any).public_show_certifications ?? true,
  public_show_events: (user as any).public_show_events ?? true,
  public_show_records: (user as any).public_show_records ?? true,
  public_show_personal: (user as any).public_show_personal ?? true,
      });

      if (user.personal_best) {
        const pb = user.personal_best as any;
        let entries: BestEntry[] = [];
        if (Array.isArray(pb)) {
          entries = pb.filter((e: any) => e?.discipline && e?.value).map((e: any) => ({ discipline: e.discipline as BestDiscipline, value: String(e.value) }));
        } else if (pb && typeof pb === 'object') {
          // Map legacy keys if present
          const mapLegacy: Record<string, BestDiscipline> = {
            static_apnea: 'STA',
            dynamic_apnea: 'DYN',
            free_immersion: 'FIM',
            constant_weight: 'CWT',
          };
          const seen = new Set<BestDiscipline>();
          for (const [k, v] of Object.entries(pb)) {
            const code = (mapLegacy[k] || k) as BestDiscipline;
            if ((DISCIPLINE_CODES as any).some((d: any) => d.code === code) && v) {
              if (!seen.has(code)) {
                entries.push({ discipline: code, value: String(v) });
                seen.add(code);
              }
            }
          }
        }
        // Ensure stable order by DISCIPLINE_CODES
        const order: Record<string, number> = Object.fromEntries(DISCIPLINE_CODES.map((d, i) => [d.code, i]));
        entries.sort((a, b) => (order[a.discipline] ?? 999) - (order[b.discipline] ?? 999));
        setBestEntries(entries);
      } else {
        setBestEntries([]);
      }

      // Carica certificazioni aggiuntive (assicurazioni, certificati medici, brevetti)
      if ((user as any).other_certifications) {
        const oc = (user as any).other_certifications as any;
        if (Array.isArray(oc)) {
          setCertEntries(oc.filter((c: any) => c?.name || c?.type).map((c: any) => ({
            type: (c.type as CertEntryType) || 'certificate',
            name: String(c.name || ''),
            number: String(c.number || ''),
            expiry: String(c.expiry || ''),
          })));
        } else {
          setCertEntries([]);
        }
      } else {
        setCertEntries([]);
      }
    }
  }, [user]);

  // Carica configurazione pubblica per eventsFreeMode
  useEffect(() => {
    let mounted = true;
    getPublicConfig().then(cfg => { if (mounted) setEventsFreeMode(cfg.eventsFreeMode); });
    return () => { mounted = false; };
  }, []);

  // Live check disponibilità slug pubblico
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!formData.public_profile_enabled) { setSlugStatus('idle'); return; }
      if (user?.public_slug) { setSlugStatus('available'); return; }
      const slug = debouncedPublicSlug?.trim();
      if (!slug) { setSlugStatus('idle'); return; }
      // Se lo slug corrente coincide con quello già assegnato all'utente, non verifichiamo
      if (user?.public_slug && String(user.public_slug).toLowerCase() === String(slug).toLowerCase()) {
        setSlugStatus('available');
        return;
      }
      setSlugStatus('checking');
      try {
        // Usa endpoint dedicato di availability
        const avail = await apiGet(`/api/profile/slug-availability/${encodeURIComponent(slug)}`).catch((e:any) => e);
        if (cancelled) return;
        if (avail && typeof avail === 'object' && 'available' in avail) {
          if (avail.reserved) { setSlugStatus('taken'); return; }
          if (avail.mine) { setSlugStatus('available'); return; }
          setSlugStatus(avail.available ? 'available' : 'taken');
        } else if (avail instanceof Error) {
          setSlugStatus('error');
        } else {
          setSlugStatus('error');
        }
      } catch {
        if (!cancelled) setSlugStatus('error');
      }
    }
    check();
    return () => { cancelled = true; };
  }, [debouncedPublicSlug, formData.public_profile_enabled, user?.id, user?.public_slug]);

  useEffect(() => {
    const loadParticipations = async () => {
      if (!user) return;
      try {
        setIsLoadingParticipations(true);
        const rows = await apiGet('/api/me/participations');
        setParticipations(Array.isArray(rows) ? rows : []);
      } catch (e) {
        // opzionale: toast di errore
      } finally {
        setIsLoadingParticipations(false);
      }
    };
    loadParticipations();
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBestChange = (idx: number, patch: Partial<BestEntry>) => {
    setBestEntries(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const addBest = () => {
    const used = new Set(bestEntries.map(b => b.discipline));
    const next = DISCIPLINE_CODES.find(d => !used.has(d.code));
    if (next) setBestEntries(prev => [...prev, { discipline: next.code, value: '' }]);
  };

  const removeBest = (idx: number) => {
    setBestEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const isValidBest = (e: BestEntry) => {
    if (!e?.value) return true; // empty allowed
    if (e.discipline === 'STA') {
      return /^\d{1,2}:\d{2}$/.test(e.value.trim());
    }
    return /^\d{1,3}(?:\.\d+)?$/.test(e.value.trim());
  };

  // Funzioni per gestire certificazioni aggiuntive (assicurazioni, certificati medici, brevetti)
  const handleCertChange = (idx: number, patch: Partial<CertEntry>) => {
    setCertEntries(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const addCert = (type: CertEntryType) => {
    setCertEntries(prev => [...prev, { type, name: '', number: '', expiry: '' }]);
  };

  const removeCert = (idx: number) => {
    setCertEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // Filtra le certificazioni per tipo
  const insuranceEntries = certEntries.map((e, i) => ({ ...e, originalIdx: i })).filter(e => e.type === 'insurance');
  const medicalEntries = certEntries.map((e, i) => ({ ...e, originalIdx: i })).filter(e => e.type === 'medical');
  const certificateEntries = certEntries.map((e, i) => ({ ...e, originalIdx: i })).filter(e => e.type === 'certificate');

  const handleAvatarUpdate = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validazioni extra: le dichiarazioni possono essere salvate solo se i campi richiesti sono presenti.
    // Assicurazione: richiede assicurazione, numero_assicurazione e scadenza_assicurazione futura
    if (formData.dichiarazione_assicurazione_valida) {
      const hasAssicurazione = !!formData.assicurazione?.trim();
      const hasNumeroAssicurazione = !!(formData.numero_assicurazione && String(formData.numero_assicurazione).trim());
      const expiryAss = formData.scadenza_assicurazione ? new Date(formData.scadenza_assicurazione) : null;
      const futureAss = expiryAss ? expiryAss >= new Date(new Date().setHours(0,0,0,0)) : false;
      if (!hasAssicurazione || !hasNumeroAssicurazione || !futureAss) {
        toast({
          title: 'Dati Assicurazione incompleti',
          description: 'Compila assicurazione, numero e una scadenza valida futura prima di confermare la dichiarazione.',
          variant: 'destructive'
        });
        return;
      }
    }
    // Brevetto: richiede brevetto, numero_brevetto e scadenza_brevetto futura
    if (formData.dichiarazione_brevetto_valido) {
      const hasBrevetto = !!formData.brevetto?.trim();
      const hasNumeroBrevetto = !!(formData.numero_brevetto && String(formData.numero_brevetto).trim());
      const expiryBrevetto = formData.scadenza_brevetto ? new Date(formData.scadenza_brevetto) : null;
      const futureBrevetto = expiryBrevetto ? expiryBrevetto >= new Date(new Date().setHours(0,0,0,0)) : false;
      if (!hasBrevetto || !hasNumeroBrevetto || !futureBrevetto) {
        toast({
          title: 'Dati Brevetto incompleti',
          description: 'Inserisci brevetto, numero e una scadenza futura prima di confermare la dichiarazione brevetto valido.',
          variant: 'destructive'
        });
        return;
      }
    }

    // Blocca submit se lo slug è preso da altri
    if (formData.public_profile_enabled) {
      if (!formData.public_slug?.trim()) {
        toast({ title: 'Slug mancante', description: 'Inserisci uno slug per il profilo pubblico oppure disattiva la visibilità.', variant: 'destructive' });
        return;
      }
      if (slugStatus === 'taken' || slugStatus === 'checking') {
        toast({ title: 'Slug non disponibile', description: 'Scegli uno slug diverso, quello attuale è già occupato.', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      // Autogenera slug se visibilità attiva e slug mancante
      let computedSlug = formData.public_slug?.trim() ? slugify(formData.public_slug) : "";
      // Se lo slug è già stato assegnato, usa quello esistente (il server ignorerà modifiche)
      if (user?.public_slug) {
        computedSlug = String(user.public_slug);
      }
      if (formData.public_profile_enabled && !computedSlug) {
        const base = formData.full_name || formData.company_name || user.email?.split('@')[0] || '';
        computedSlug = slugify(base);
        if (!computedSlug) {
          throw new Error('Slug mancante');
        }
      }
      if (formData.public_profile_enabled && slugStatus === 'taken' && !user?.public_slug) {
        throw new Error('Slug non disponibile');
      }
      const dataToUpdate: any = {
        ...formData,
        public_slug: computedSlug || null,
        scadenza_brevetto: formData.scadenza_brevetto || null,
        scadenza_certificato_medico: formData.scadenza_certificato_medico || null,
        certificato_medico_tipo: formData.certificato_medico_tipo || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        bio: formData.bio || null,
        brevetto: formData.brevetto || null,
        didattica_brevetto: formData.didattica_brevetto || null,
        numero_brevetto: formData.numero_brevetto || null,
        foto_brevetto_url: formData.foto_brevetto_url || null,
        assicurazione: formData.assicurazione || null,
        numero_assicurazione: formData.numero_assicurazione || null,
        dichiarazione_brevetto_valido: Boolean(formData.dichiarazione_brevetto_valido),
        dichiarazione_assicurazione_valida: Boolean(formData.dichiarazione_assicurazione_valida),
        instagram_contact: formData.instagram_contact || null,
        phone: formData.phone || null,
        contact_email: formData.contact_email || null,
        company_name: formData.company_name || null,
        vat_number: formData.vat_number || null,
        company_address: formData.company_address || null,
        personal_best: (() => {
          const obj: Record<string, string> = {};
          for (const e of bestEntries) {
            if (e.value && e.discipline) obj[e.discipline] = e.value;
          }
          return obj;
        })(),
        other_certifications: certEntries.filter(c => c.name.trim() || c.number.trim()).map(c => ({
          type: c.type,
          name: c.name.trim(),
          number: c.number.trim(),
          expiry: c.expiry || null,
        })),
      };

      let res: any;
      try {
        res = await apiSend('/api/profile', 'PUT', dataToUpdate);
      } catch (err: any) {
        const msg = String(err?.message || '');
        // Gestione lato client di un possibile 409 dal server per slug già occupato
        if (msg.includes(' 409 ') || msg.toLowerCase().includes('conflict')) {
          toast({ title: 'Slug in conflitto', description: 'Lo slug scelto è già in uso. Scegline un altro e riprova.', variant: 'destructive' });
          setSlugStatus('taken');
          throw err;
        }
        throw err;
      }
      if (!res?.user) throw new Error('Update failed');

      toast({
        title: t('profile.toasts.update_success_title', 'Successo'),
        description: t('profile.toasts.update_success_desc', 'Profilo aggiornato con successo!'),
      });

      await refreshProfile();
    } catch (error) {
      console.error("Errore nell'aggiornamento del profilo:", error);
      toast({
        title: t('profile.toasts.update_error_title', 'Errore'),
        description: `${t('profile.toasts.update_error_desc', "Si è verificato un errore nell'aggiornare il profilo.")} ${error?.message ? `Dettagli: ${String(error.message)}` : ''}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
  <p>{t('profile.login_required', 'Devi essere autenticato per visualizzare il profilo.')}</p>
      </div>
    );
  }

  const renderCompanyFields = () => {
    if (user.role !== 'company') return null;

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="company_name">{t('profile.sections.company.fields.company_name_label', 'Nome Azienda')}</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            placeholder={t('profile.sections.company.fields.company_name_placeholder', 'Nome della tua azienda')}
          />
        </div>
        <div>
          <Label htmlFor="vat_number">{t('profile.sections.company.fields.vat_number_label', 'Partita IVA')}</Label>
          <Input
            id="vat_number"
            value={formData.vat_number}
            onChange={(e) => handleInputChange('vat_number', e.target.value)}
            placeholder={t('profile.sections.company.fields.vat_number_placeholder', 'Partita IVA')}
          />
        </div>
        <div>
          <Label htmlFor="company_address">{t('profile.sections.company.fields.company_address_label', 'Indirizzo Azienda')}</Label>
          <Textarea
            id="company_address"
            value={formData.company_address}
            onChange={(e) => handleInputChange('company_address', e.target.value)}
            placeholder={t('profile.sections.company.fields.company_address_placeholder', "Indirizzo completo dell'azienda")}
          />
        </div>
      </div>
    );
  };

  const profileContent = (
    <div className="px-4 py-6 profile-theme">
      <div className="max-w-4xl mx-auto">
        <CenteredNotice
          open={noticeOpen}
          onClose={() => setNoticeOpen(false)}
          title="Operazione completata"
          message={noticeMsg}
        />
        {!isMobile && (
          <div className="mb-6">
            <BackButton fallbackPath="/" label={t('not_found.back_home', 'Torna alla Home')} />
          </div>
        )}
        
        {/* Header profilo rimosso su richiesta (icona + titolo + sottotitolo) */}

        {/* Ruolo rimosso su richiesta */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex gap-2 md:grid md:grid-cols-6">
            <TabsTrigger value="events" className="whitespace-nowrap">
              <Calendar className="h-4 w-4 mr-2" />
              {t('profile.tabs.events', 'Eventi')}
            </TabsTrigger>
            <TabsTrigger value="personal" className="whitespace-nowrap">
              <UserCircle className="h-4 w-4 mr-2" />
              {t('profile.tabs.personal', 'Personali')}
            </TabsTrigger>
            <TabsTrigger value="certs" className="whitespace-nowrap">
              <Shield className="h-4 w-4 mr-2" />
              {t('profile.tabs.certs', 'Certificazioni')}
            </TabsTrigger>
            <TabsTrigger value="bests" className="whitespace-nowrap">
              <FileText className="h-4 w-4 mr-2" />
              {t('profile.tabs.bests', 'Record')}
            </TabsTrigger>
            <TabsTrigger value="visibility" className="whitespace-nowrap">
              {t('profile.tabs.visibility', 'Visibilità')}
            </TabsTrigger>
            {/* Rimuovo tab separato Organizza: incorporato in Eventi con sottomenu */}
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.sections.my_events.title', 'I Miei Eventi')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.my_events.description', 'Gestisci i tuoi eventi e crea nuovi eventi')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Sotto-tab interne alla sezione Eventi */}
                  <div className="mb-6" role="tablist" aria-label="Sotto sezione eventi">
                    <div className="inline-flex rounded-md shadow-sm overflow-hidden border border-purple-200 bg-white dark:bg-neutral-900">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!showOrganizer}
                        onClick={() => setShowOrganizer(false)}
                        className={
                          `px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60
                          ${!showOrganizer
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                            : 'bg-transparent text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-800/30'}
                          `
                        }
                      >
                        {t('profile.sections.my_events.my_registrations_label', 'Elenco Iscrizioni')}
                      </button>
                      {(!organizerEligible && user?.role !== 'admin') ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={showOrganizer}
                              disabled
                              className={
                                `px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 border-l border-purple-200
                                bg-transparent text-purple-700 opacity-50 cursor-not-allowed dark:text-purple-300`
                              }
                            >
                              {t('profile.sections.my_events.organize_event_label', 'Organizza Evento')}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="font-semibold mb-1">{t('profile.sections.my_events.missing_requirements', 'Requisiti mancanti:')}</p>
                            <ul className="list-disc list-inside text-sm space-y-0.5">
                              {missingRequirements.map((req, i) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={showOrganizer}
                          onClick={() => setShowOrganizer(true)}
                          className={
                            `px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 border-l border-purple-200
                            ${showOrganizer
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                              : 'bg-transparent text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-800/30'}
                            `
                          }
                        >
                          {t('profile.sections.my_events.organize_event_label', 'Organizza Evento')}
                        </button>
                      )}
                    </div>
                  </div>
                  {!showOrganizer ? (
                    isLoadingParticipations ? (
                      <div className="py-8 text-center text-gray-500">{t('common.loading', 'Caricamento...')}</div>
                    ) : (
                      participations.length > 0 ? (
                        <div className="grid gap-4">
                          {participations.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-4">
                                {p.events.image_url && (
                                  <img src={p.events.image_url} alt={p.events.title} className="w-16 h-16 object-cover rounded-lg" />
                                )}
                                <div>
                                  <h3 className="font-semibold">{p.events.title}</h3>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Calendar className="h-4 w-4" />
                                    {p.events.fixed_appointment === true
                                      ? ((p.events.fixed_appointment_text && p.events.fixed_appointment_text.trim()) || t('events.recurring_label', 'Appuntamento ricorrente'))
                                      : formatEventDate(p.events.date, p.events.end_date)}
                                    {p.events.location && (
                                      <>
                                        <MapPin className="h-4 w-4 ml-2" />
                                        {p.events.location}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button asChild variant="outline" size="sm">
                                  <Link to={buildFriendlyEventPath(p.events.slug)}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    {t('common.view', 'Visualizza')}
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-gray-600 mb-2">{t('profile.no_participations', 'Nessun evento iscritto')}</h3>
                          <p className="text-gray-500 mb-6">{t('profile.no_participations_hint', 'Non hai ancora effettuato iscrizioni.')}</p>
                          <Button asChild>
                            <Link to="/">{t('profile.discover_events', 'Scopri gli eventi')}</Link>
                          </Button>
                        </div>
                      )
                    )
                  ) : (
                    <div className="space-y-6">
                      <div className="text-sm text-muted-foreground">
                        {user?.role === 'admin'
                          ? t('profile.sections.my_events.admin_access', 'Accesso completo (admin).')
                          : organizerEligible
                            ? t('profile.sections.my_events.eligible_to_organize', 'Hai i requisiti necessari per organizzare. Puoi creare un nuovo evento.')
                            : t('profile.sections.my_events.not_eligible_to_organize', 'Per organizzare devi attivare il profilo pubblico e compilare le certificazioni obbligatorie.')}
                      </div>
                      {(user?.role === 'admin' || organizerEligible) ? (
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            type="button"
                            onClick={handleOpenCreateEvent}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                          >
                            <PlusCircle className="mr-2 h-4 w-4" /> {t('profile.sections.my_events.create_event_btn', 'Crea Evento')}
                          </Button>
                        </div>
                      ) : null}
                      {!(user?.role === 'admin' || organizerEligible) && missingRequirements.length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-800 mb-2">{t('profile.sections.my_events.missing_requirements', 'Requisiti mancanti per organizzare eventi:')}</p>
                          <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                            {missingRequirements.map((req, i) => (
                              <li key={i}>{req}</li>
                            ))}
                          </ul>
                          <p className="text-xs text-amber-600 mt-2">{t('profile.sections.my_events.complete_sections_hint', 'Completa le sezioni "Certificazioni" e "Visibilità" per abilitare la creazione.')}</p>
                        </div>
                      )}
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">{t('profile.sections.my_events.your_organized_events', 'I tuoi eventi organizzati')}</h3>
                        {isLoadingOrganized ? (
                          <div className="py-4 text-sm text-muted-foreground">{t('profile.sections.my_events.loading_events', 'Caricamento eventi...')}</div>
                        ) : (organizedEvents && organizedEvents.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('profile.sections.my_events.table_title_category', 'Titolo / Categoria')}</TableHead>
                                <TableHead>{t('profile.sections.my_events.table_discipline_level', 'Disciplina / Livello')}</TableHead>
                                <TableHead>{t('profile.sections.my_events.table_date_location', 'Data / Ricorrenza & Luogo')}</TableHead>
                                {!eventsFreeMode && <TableHead className="text-center">{t('profile.sections.my_events.table_cost', 'Costo')}</TableHead>}
                                <TableHead className="text-center">{t('profile.sections.my_events.table_enrolled', 'Iscritti')}</TableHead>
                                <TableHead className="text-right">{t('profile.sections.my_events.table_actions', 'Azioni')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {organizedEvents.map(ev => (
                                <TableRow key={ev.id}>
                                  <TableCell className="max-w-[260px]">
                                    <div className="flex flex-col">
                                      <span className="font-medium truncate" title={ev.title}>{ev.title}</span>
                                      <span className="text-xs text-muted-foreground truncate">{ev.categories?.name || '-'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <div className="flex flex-col">
                                      <span className="truncate">{ev.discipline || '-'}</span>
                                      <span className="text-xs text-muted-foreground truncate">{ev.level || '-'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="h-4 w-4" />
                                      <span className="truncate" title={formatEventWithFixed(ev)}>{formatEventWithFixed(ev)}</span>
                                      {ev.location && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <MapPin className="h-4 w-4" />
                                          <span className="truncate" title={ev.location}>{ev.location}</span>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                  {!eventsFreeMode && <TableCell className="text-sm text-center">{(ev.cost != null && ev.cost > 0) ? `€${Number(ev.cost).toFixed(2)}` : '—'}</TableCell>}
                                  <TableCell className="text-sm text-center">{typeof ev.participants_paid_count === 'number' ? ev.participants_paid_count : 0}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end">
                                      <Button type="button" asChild size="icon" variant="ghost" title={t('profile.sections.my_events.action_open', 'Apri')} aria-label={t('profile.sections.my_events.action_open', 'Apri evento')}>
                                        <Link to={buildFriendlyEventPath(ev.slug)}>
                                          <Eye className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                      <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_enrolled', 'Iscritti')} aria-label={t('profile.sections.my_events.action_enrolled', 'Vedi iscritti')} onClick={() => openParticipantsForEvent({ id: ev.id, title: ev.title })}>
                                        <Users className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_edit', 'Modifica')} aria-label={t('profile.sections.my_events.action_edit', 'Modifica evento')} onClick={() => openEditEvent(ev)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_delete', 'Elimina')} aria-label={t('profile.sections.my_events.action_delete', 'Elimina evento')} onClick={() => handleDeleteEvent(ev.id, ev.title)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="py-6 text-sm text-muted-foreground border rounded-md text-center">
                            {t('profile.sections.my_events.no_organized_events', 'Nessun evento organizzato ancora.')}
                          </div>
                        ))}
                      </div>
                      {/* Pulsante ritorno rimosso perché ridondante: si usa la sotto-tab sopra */}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sheet laterale per creazione Evento (comportamento originale) */}
              <Sheet
                open={isSheetOpen}
                onOpenChange={(open) => { setIsSheetOpen(open); }}
              >
                <SheetContent
                  className="overflow-y-auto p-0 [&>button]:hidden"
                  onInteractOutside={(e) => { e.preventDefault(); }}
                  onEscapeKeyDown={(e) => { e.preventDefault(); }}
                >
                  <div className="sticky top-0 z-50 bg-background border-b shadow-sm supports-[backdrop-filter]:bg-background/80 backdrop-blur">
                    <div className="flex items-center justify-between gap-2 px-6 py-3">
                      <SheetTitle className="text-base sm:text-lg">
                        Crea Evento
                      </SheetTitle>
                      <SheetClose asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Chiudi">
                          <X className="h-4 w-4" />
                        </Button>
                      </SheetClose>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <EventForm onSubmit={(vals) => { handleEventFormSubmit(vals); }} isEditing={false} />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sheet laterale per modifica Evento */}
              <Sheet
                open={isEditSheetOpen}
                onOpenChange={(open) => { setIsEditSheetOpen(open); if (!open) setEditingEvent(null); }}
              >
                <SheetContent
                  className="overflow-y-auto p-0 [&>button]:hidden"
                  onInteractOutside={(e) => { e.preventDefault(); }}
                  onEscapeKeyDown={(e) => { e.preventDefault(); }}
                >
                  <div className="sticky top-0 z-50 bg-background border-b shadow-sm supports-[backdrop-filter]:bg-background/80 backdrop-blur">
                    <div className="flex items-center justify-between gap-2 px-6 py-3">
                      <SheetTitle className="text-base sm:text-lg">
                        {t('profile.sections.my_events.edit_event_sheet_title', 'Modifica Evento')}
                      </SheetTitle>
                      <SheetClose asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('profile.sections.my_events.action_close', 'Chiudi')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </SheetClose>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {editingEvent ? (
                      <EventForm onSubmit={(vals) => { handleEventEditSubmit(vals); }} defaultValues={editingEvent as any} isEditing={true} />
                    ) : null}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sheet laterale: elenco iscritti evento */}
              <Sheet
                open={participantsOpen}
                onOpenChange={(open) => { setParticipantsOpen(open); if (!open) { setParticipants([]); setParticipantsEventId(''); setParticipantsEventTitle(''); } }}
              >
                <SheetContent
                  className="overflow-y-auto p-0 [&>button]:hidden"
                  onInteractOutside={(e) => { e.preventDefault(); }}
                  onEscapeKeyDown={(e) => { e.preventDefault(); }}
                >
                  <div className="sticky top-0 z-50 bg-background border-b shadow-sm supports-[backdrop-filter]:bg-background/80 backdrop-blur">
                    <div className="flex items-center justify-between gap-2 px-6 py-3">
                      <SheetTitle className="text-base sm:text-lg">
                        Iscritti — {participantsEventTitle || 'Evento'}
                      </SheetTitle>
                      <SheetClose asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Chiudi">
                          <X className="h-4 w-4" />
                        </Button>
                      </SheetClose>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {participantsLoading ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">Caricamento iscritti...</div>
                    ) : participants.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Pagato il</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {participants.map(p => (
                            <TableRow key={p.id}>
                              <TableCell>
                                {p.public_profile_enabled && p.public_slug ? (
                                  <Link className="underline" to={`/profile/${p.public_slug}`} target="_blank" rel="noreferrer">
                                    {p.full_name || p.company_name || p.user_id}
                                  </Link>
                                ) : (
                                  <span>{p.full_name || p.company_name || p.user_id}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {p.paid_at ? format(parseISO(p.paid_at), 'dd/MM/yyyy HH:mm', { locale: itLocale }) : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {user?.id !== p.user_id && (
                                    <button
                                      type="button"
                                      className="p-2 rounded hover:bg-blue-50 text-blue-600"
                                      title="Chatta con questo partecipante"
                                      onClick={() => {
                                        openChat(p.user_id, participantsEventId);
                                        setParticipantsOpen(false);
                                      }}
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="p-2 rounded hover:bg-red-50 text-red-600"
                                    title="Rimuovi partecipante"
                                    onClick={async () => {
                                      const confirmed = window.confirm(`Rimuovere ${p.full_name || 'questo partecipante'}?`);
                                      if (!confirmed) return;
                                      try {
                                        await removeEventParticipant(participantsEventId, p.user_id);
                                        toast({ title: "Partecipante rimosso", description: "L'utente è stato rimosso dall'evento." });
                                        // Aggiorna la lista
                                        setParticipants(prev => prev.filter(part => part.user_id !== p.user_id));
                                      } catch (e) {
                                        toast({ title: "Errore", description: "Impossibile rimuovere il partecipante", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground text-sm">Nessun iscritto al momento.</div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </TabsContent>

            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.sections.personal_info.title', 'Informazioni Personali')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.personal_info.description', 'Aggiorna le tue informazioni personali e di contatto')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <AvatarUpload
                    currentAvatarUrl={formData.avatar_url}
                    onAvatarUpdate={handleAvatarUpdate}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">{t('profile.sections.personal_info.full_name_label', 'Nome Completo')}</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        placeholder={t('profile.sections.personal_info.full_name_placeholder', 'Il tuo nome completo')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instagram_contact">{t('profile.sections.personal_info.instagram_label', 'Instagram')}</Label>
                      <Input
                        id="instagram_contact"
                        value={formData.instagram_contact}
                        onChange={(e) => handleInputChange('instagram_contact', e.target.value)}
                        placeholder={t('profile.sections.personal_info.instagram_placeholder', '@username')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t('profile.sections.personal_info.phone_label', 'Telefono')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          // Accetta solo numeri, +, spazi e trattini
                          const cleaned = e.target.value.replace(/[^0-9+\s\-]/g, '');
                          handleInputChange('phone', cleaned);
                        }}
                        placeholder={t('profile.sections.personal_info.phone_placeholder', 'Es. +39 333 1234567')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="account_email">{t('profile.sections.personal_info.account_email_label', 'Email account')}</Label>
                      <Input
                        id="account_email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('profile.sections.personal_info.account_email_hint', 'Email usata per la registrazione (non modificabile)')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bio">{t('profile.sections.personal_info.bio_label', 'Biografia')}</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      placeholder={t('profile.sections.personal_info.bio_placeholder', 'Raccontaci qualcosa di te...')}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* Visibilità - nuova tab dedicata (resa disponibile per tutti i ruoli) */}
            <TabsContent value="visibility">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('profile.sections.visibility.title', 'Visibilità')}</CardTitle>
                    <CardDescription>
                      {t('profile.sections.visibility.description', 'Rendi visibile una pagina pubblica del tuo profilo su un URL parlante. Puoi scegliere cosa mostrare.')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="public_profile_enabled">{t('profile.sections.visibility.enable_public_profile', 'Attiva profilo pubblico')}</Label>
                        <p className="text-sm text-muted-foreground">{t('profile.sections.visibility.enable_public_profile_desc', 'La pagina sarà visibile su /profile/slug')}</p>
                      </div>
                      <Switch
                        id="public_profile_enabled"
                        checked={formData.public_profile_enabled}
                        onCheckedChange={(v) => {
                          const enabled = Boolean(v);
                          setFormData(prev => {
                            let nextSlug = prev.public_slug;
                            if (enabled && (!nextSlug || !nextSlug.trim())) {
                              const base = prev.full_name || prev.company_name || user?.email?.split('@')[0] || '';
                              nextSlug = slugify(base);
                            }
                            return { ...prev, public_profile_enabled: enabled, public_slug: nextSlug };
                          });
                        }}
                      />
                    </div>

                    <div>
                      <Label htmlFor="public_slug">{t('profile.sections.visibility.public_slug_label', 'Slug pubblico')}</Label>
                      <Input
                        id="public_slug"
                        value={formData.public_slug}
                        onChange={(e) => setFormData(prev => ({ ...prev, public_slug: slugify(e.target.value) }))}
                        placeholder={t('profile.sections.visibility.public_slug_placeholder', 'es. nome-cognome')}
                        disabled={!formData.public_profile_enabled || Boolean(user?.public_slug)}
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.public_url_prefix', 'URL: /profile/')}{formData.public_slug || '<slug>'}</p>
                        {formData.public_profile_enabled && !user?.public_slug && (
                          slugStatus === 'checking' ? (
                            <span className="text-xs text-blue-600">{t('profile.sections.visibility.slug_checking', 'Verifica disponibilità...')}</span>
                          ) : slugStatus === 'available' ? (
                            <span className="text-xs text-green-600">{t('profile.sections.visibility.slug_available', 'Disponibile')}</span>
                          ) : slugStatus === 'taken' ? (
                            <span className="text-xs text-red-600">{t('profile.sections.visibility.slug_taken', 'Non disponibile')}</span>
                          ) : slugStatus === 'error' ? (
                            <span className="text-xs text-amber-600">{t('profile.sections.visibility.slug_error', 'Impossibile verificare ora (server non raggiungibile)')}</span>
                          ) : null
                        )}
                        {formData.public_profile_enabled && formData.public_slug && (
                          <>
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/profile/${formData.public_slug}`}>{t('profile.sections.visibility.open_public_profile', 'Apri profilo pubblico')}</Link>
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const url = `${window.location.origin}/profile/${formData.public_slug}`;
                                navigator.clipboard.writeText(url).then(() => {
                                  toast({ title: t('profile.sections.visibility.link_copied_title', 'Link copiato'), description: t('profile.sections.visibility.link_copied_desc', 'URL del profilo pubblico copiato negli appunti.') });
                                }).catch(() => {
                                  toast({ title: t('profile.sections.visibility.copy_failed_title', 'Impossibile copiare'), description: 'Copia manualmente questo URL: ' + url });
                                });
                              }}
                            >
                              {t('profile.sections.visibility.copy_link', 'Copia link')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_events">{t('profile.sections.visibility.show_events', 'Mostra Eventi')}</Label>
                          <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.show_events_desc', 'Rende visibile la sezione Eventi nella pagina pubblica')}</p>
                        </div>
                        <Switch
                          id="public_show_events"
                          checked={formData.public_show_events}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_events: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_personal">{t('profile.sections.visibility.show_personal', 'Mostra Personali')}</Label>
                          <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.show_personal_desc', 'Bio, Instagram e info aziendali (se presenti)')}</p>
                        </div>
                        <Switch
                          id="public_show_personal"
                          checked={formData.public_show_personal}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_personal: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_certifications">{t('profile.sections.visibility.show_certifications', 'Mostra Certificazioni')}</Label>
                          <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.show_certifications_desc', 'Brevetto e assicurazione')}</p>
                        </div>
                        <Switch
                          id="public_show_certifications"
                          checked={formData.public_show_certifications}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_certifications: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_records">{t('profile.sections.visibility.show_records', 'Mostra Record')}</Label>
                          <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.show_records_desc', 'Record personali dalla sezione Record')}</p>
                        </div>
                        <Switch
                          id="public_show_records"
                          checked={formData.public_show_records}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_records: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            <TabsContent value="certs">
              <Card>
                  <CardHeader>
                  <CardTitle>{t('profile.sections.certifications.title', 'Certificazioni e Assicurazioni')}</CardTitle>
                  {/* Descrizione rimossa su richiesta */}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="assicurazione">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t('profile.sections.certifications.accordion_insurance', 'Assicurazione')}</div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="assicurazione">{t('profile.sections.certifications.insurance_label', 'Assicurazione')}</Label>
                            <Input
                              id="assicurazione"
                              value={formData.assicurazione}
                              onChange={(e) => handleInputChange('assicurazione', e.target.value)}
                              placeholder={t('profile.sections.certifications.insurance_placeholder', 'Nome assicurazione')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="scadenza_assicurazione">{t('profile.sections.certifications.insurance_expiry_label', 'Scadenza Assicurazione')}</Label>
                            <DatePicker
                              date={formData.scadenza_assicurazione ? new Date(formData.scadenza_assicurazione) : undefined}
                              onDateChange={(date) => handleInputChange('scadenza_assicurazione', toLocalDateString(date))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label htmlFor="numero_assicurazione">{t('profile.sections.certifications.insurance_number_label', 'Numero assicurazione')}</Label>
                            <Input
                              id="numero_assicurazione"
                              value={formData.numero_assicurazione}
                              onChange={(e) => handleInputChange('numero_assicurazione', e.target.value)}
                              placeholder={t('profile.sections.certifications.insurance_number_placeholder', 'Inserire numero assicurazione')}
                            />
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 border rounded-md mt-4">
                          <Checkbox
                            id="dichiarazione_assicurazione_valida"
                            checked={Boolean(formData.dichiarazione_assicurazione_valida)}
                            onCheckedChange={(v) => setFormData(prev => ({ ...prev, dichiarazione_assicurazione_valida: Boolean(v) }))}
                          />
                          <Label htmlFor="dichiarazione_assicurazione_valida" className="text-sm cursor-pointer">
                            {t('profile.sections.certifications.insurance_declaration', 'Dichiaro di essere istruttore brevettato e di avere una copertura assicurativa in corso di validità')}
                          </Label>
                        </div>

                        {/* Assicurazioni aggiuntive */}
                        {insuranceEntries.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-sm font-medium">{t('profile.sections.certifications.other_insurances', 'Altre assicurazioni')}</p>
                            {insuranceEntries.map((entry) => (
                              <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-xs text-muted-foreground">#{insuranceEntries.indexOf(entry) + 1}</span>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <Input
                                    value={entry.name}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })}
                                    placeholder={t('profile.sections.certifications.insurance_placeholder', 'Nome assicurazione')}
                                  />
                                  <Input
                                    value={entry.number}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })}
                                    placeholder={t('profile.sections.certifications.insurance_number_placeholder', 'Numero')}
                                  />
                                  <DatePicker
                                    date={entry.expiry ? new Date(entry.expiry) : undefined}
                                    onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addCert('insurance')}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {t('profile.sections.certifications.add_insurance', 'Aggiungi assicurazione')}
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="medico">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> {t('profile.sections.certifications.accordion_medical', 'Certificato medico')}</div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div>
                          <Label htmlFor="scadenza_certificato_medico">{t('profile.sections.certifications.medical_expiry_label', 'Scadenza Certificato Medico')}</Label>
                          <div className="mt-1 flex items-center gap-3">
                            <DatePicker
                              date={formData.scadenza_certificato_medico ? new Date(formData.scadenza_certificato_medico) : undefined}
                              onDateChange={(date) => handleInputChange('scadenza_certificato_medico', toLocalDateString(date))}
                              placeholder={t('profile.sections.certifications.medical_select_placeholder', 'Seleziona mese e anno')}
                              className="min-w-[180px]"
                            />
                            {formData.scadenza_certificato_medico && (
                              <span className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 dark:bg-purple-800/30 dark:text-purple-200 border border-purple-200 dark:border-purple-700" title="Clicca per cambiare mese">
                                {new Date(formData.scadenza_certificato_medico).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{t('profile.sections.certifications.medical_change_hint', 'Clicca sul mese per modificarlo. Usa il selettore per scegliere una nuova scadenza (solo mesi futuri).')}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                              <Label htmlFor="certificato_medico_tipo">{t('profile.sections.certifications.medical_type_label', 'Tipo certificato medico')}</Label>
                              <Select value={(formData as any).certificato_medico_tipo || ''} onValueChange={(v) => handleInputChange('certificato_medico_tipo', v)}>
                                <SelectTrigger id="certificato_medico_tipo" className="select-trigger">
                                  <SelectValue placeholder={t('profile.sections.certifications.medical_type_placeholder', 'Seleziona tipo')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="agonistico">{t('profile.sections.certifications.medical_type_agonistico', 'Agonistico')}</SelectItem>
                                  <SelectItem value="non_agonistico">{t('profile.sections.certifications.medical_type_non_agonistico', 'Non agonistico')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Certificati medici aggiuntivi */}
                        {medicalEntries.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-sm font-medium">{t('profile.sections.certifications.other_medicals', 'Altri certificati medici')}</p>
                            {medicalEntries.map((entry) => (
                              <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-xs text-muted-foreground">#{medicalEntries.indexOf(entry) + 1}</span>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <Input
                                    value={entry.name}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })}
                                    placeholder={t('profile.sections.certifications.medical_name_placeholder', 'Tipo certificato')}
                                  />
                                  <Input
                                    value={entry.number}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })}
                                    placeholder={t('profile.sections.certifications.cert_number_placeholder', 'Numero')}
                                  />
                                  <DatePicker
                                    date={entry.expiry ? new Date(entry.expiry) : undefined}
                                    onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addCert('medical')}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {t('profile.sections.certifications.add_medical', 'Aggiungi certificato medico')}
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="brevetto">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> {t('profile.sections.certifications.accordion_brevetto', 'Brevetto (opzionale)')}</div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="brevetto">{t('profile.sections.certifications.brevetto_label', 'Brevetto')}</Label>
                            <Input
                              id="brevetto"
                              value={formData.brevetto}
                              onChange={(e) => handleInputChange('brevetto', e.target.value)}
                              placeholder={t('profile.sections.certifications.brevetto_placeholder', 'Inserire tipologia brevetto')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="scadenza_brevetto">{t('profile.sections.certifications.brevetto_expiry_label', 'Scadenza Brevetto')}</Label>
                            <DatePicker
                              date={formData.scadenza_brevetto ? new Date(formData.scadenza_brevetto) : undefined}
                              onDateChange={(date) => handleInputChange('scadenza_brevetto', toLocalDateString(date))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label htmlFor="didattica_brevetto">{t('profile.sections.certifications.brevetto_didattica_label', 'Didattica brevetto')}</Label>
                            <Input
                              id="didattica_brevetto"
                              value={formData.didattica_brevetto}
                              onChange={(e) => handleInputChange('didattica_brevetto', e.target.value)}
                              placeholder={t('profile.sections.certifications.brevetto_didattica_placeholder', 'Inserire didattica brevetto')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="numero_brevetto">{t('profile.sections.certifications.brevetto_number_label', 'Numero brevetto')}</Label>
                            <Input
                              id="numero_brevetto"
                              value={formData.numero_brevetto}
                              onChange={(e) => handleInputChange('numero_brevetto', e.target.value)}
                              placeholder={t('profile.sections.certifications.brevetto_number_placeholder', 'Inserire numero brevetto')}
                            />
                          </div>
                        </div>
                        <div className="space-y-2 mt-4">
                          <Label>{t('profile.sections.certifications.brevetto_photo_label', 'Foto brevetto')}</Label>
                          <ImageUpload
                            currentImageUrl={formData.foto_brevetto_url || undefined}
                            onImageUploaded={(url) => handleInputChange('foto_brevetto_url', url)}
                            onImageRemoved={() => handleInputChange('foto_brevetto_url', '')}
                          />
                        </div>
                        <div className="flex items-start gap-3 p-3 border rounded-md mt-4">
                          <Checkbox
                            id="dichiarazione_brevetto_valido"
                            checked={Boolean(formData.dichiarazione_brevetto_valido)}
                            onCheckedChange={(v) => setFormData(prev => ({ ...prev, dichiarazione_brevetto_valido: Boolean(v) }))}
                          />
                          <Label htmlFor="dichiarazione_brevetto_valido" className="text-sm cursor-pointer">
                            {t('profile.sections.certifications.brevetto_declaration', 'Dichiaro di essere istruttore certificato con BREVETTO in corso di validità')}
                          </Label>
                        </div>

                        {/* Brevetti aggiuntivi */}
                        {certificateEntries.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-sm font-medium">{t('profile.sections.certifications.other_certificates', 'Altri brevetti / certificazioni')}</p>
                            {certificateEntries.map((entry) => (
                              <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-xs text-muted-foreground">#{certificateEntries.indexOf(entry) + 1}</span>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <Input
                                    value={entry.name}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })}
                                    placeholder={t('profile.sections.certifications.cert_name_placeholder', 'es. PADI Open Water')}
                                  />
                                  <Input
                                    value={entry.number}
                                    onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })}
                                    placeholder={t('profile.sections.certifications.cert_number_placeholder', 'Numero')}
                                  />
                                  <DatePicker
                                    date={entry.expiry ? new Date(entry.expiry) : undefined}
                                    onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addCert('certificate')}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {t('profile.sections.certifications.add_certificate', 'Aggiungi brevetto')}
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

            </TabsContent>

            <TabsContent value="bests">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.sections.personal_bests.title', 'Record Personali')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.personal_bests.description', 'Registra i tuoi migliori risultati in apnea')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {t('profile.sections.personal_bests.helper', 'Inserisci i tuoi migliori risultati: tempo in mm:ss per STA, metri per le altre discipline.')}
                    </p>
                    {bestEntries.length < DISCIPLINE_CODES.length && (
                      <Button type="button" variant="outline" onClick={addBest}>
                        {t('profile.sections.personal_bests.add', 'Aggiungi record')}
                      </Button>
                    )}
                  </div>
                  <Table>
                    {bestEntries.length === 0 && (
                      <TableCaption>{t('profile.sections.personal_bests.empty', 'Nessun record inserito. Aggiungi il primo!')}</TableCaption>
                    )}
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">{t('profile.sections.personal_bests.discipline', 'Disciplina')}</TableHead>
                        <TableHead>{t('profile.sections.personal_bests.value', 'Valore')}</TableHead>
                        <TableHead className="w-[120px] text-right">{t('common.actions', 'Azioni')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bestEntries.map((entry, idx) => {
                        const used = new Set(bestEntries.map((b, i) => i === idx ? undefined : b.discipline));
                        const invalid = !isValidBest(entry);
                        const placeholder = (() => {
                          const d = DISCIPLINE_CODES.find(d => d.code === entry.discipline);
                          return d?.hint === 'mm:ss' ? t('profile.sections.personal_bests.time_placeholder', 'es. 4:30') : t('profile.sections.personal_bests.meters_placeholder', 'es. 75');
                        })();
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Select value={entry.discipline} onValueChange={(v) => handleBestChange(idx, { discipline: v as BestDiscipline })}>
                                <SelectTrigger className="select-trigger">
                                  <SelectValue placeholder={t('profile.sections.personal_bests.discipline_placeholder', 'Seleziona disciplina')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {DISCIPLINE_CODES.map(d => (
                                    <SelectItem key={d.code} value={d.code} disabled={used.has(d.code)}>
                                      {t(`profile.sections.personal_bests.disciplines.${d.labelKey}`, d.labelKey)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {invalid && entry.value ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Input
                                      value={entry.value}
                                      onChange={(e) => handleBestChange(idx, { value: e.target.value })}
                                      placeholder={placeholder}
                                      className='border-destructive'
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {entry.discipline === 'STA' ? 'Formato: mm:ss (es. 4:30)' : 'Formato: metri interi o con decimali (es. 75)'}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Input
                                  value={entry.value}
                                  onChange={(e) => handleBestChange(idx, { value: e.target.value })}
                                  placeholder={placeholder}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" variant="destructive" onClick={() => removeBest(idx)}>
                                {t('common.delete', 'Elimina')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organizzazione eventi: visibile come tab; disabilitata se non si soddisfano i requisiti (eccetto admin) */}
            {/* Tab organizer rimossa: funzionalità spostata in events */}

            {/* Company-specific extra content can be added here if needed */}

            <div className="flex justify-end mt-6">
              <Button
                type="submit"
                disabled={
                  loading || (
                    formData.public_profile_enabled && (
                      !formData.public_slug?.trim() || slugStatus === 'taken' || slugStatus === 'checking'
                    )
                  )
                }
                className="w-full md:w-auto"
                variant="brand"
              >
                {loading ? t('profile.buttons.saving', 'Salvando...') : t('profile.buttons.save', 'Salva Modifiche')}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{profileContent}</MobileLayout>;
  }

  return <Layout>{profileContent}</Layout>;
};

export default Profile;
