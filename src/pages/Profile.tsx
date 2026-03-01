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
import { UserCircle, FileText, Calendar, Shield, Building, Users, MapPin, Eye, X, PlusCircle, Pencil, Trash2, MessageCircle, Phone, Bell, ChevronLeft, ChevronRight, UserPlus, Download } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { buildFriendlyEventPath } from "@/lib/seo-utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageHead from "@/components/PageHead";
import BlogManager from "@/components/admin/BlogManager";
// import ProfileMobileNav from "@/components/ProfileMobileNav";
import { format, parseISO, isValid } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useDebounce } from "@/hooks/useDebounce";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createEvent, Event, getEvents, EventWithCategory, updateEvent, deleteEvent } from "@/lib/api";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventForm } from "@/components/admin/EventForm";
import { CenteredNotice } from "@/components/CenteredNotice";
import { useChatStore } from "@/hooks/useChatStore";
import EventInvite from "@/components/EventInvite";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const canManageBlog = user?.role === 'admin' || user?.role === 'creator' || user?.role === 'blogger';
  const VALID_TABS = ['events', 'personal', 'certs', 'bests', 'visibility', 'blog'];
  const initialTab = (() => {
    const hash = location.hash?.replace('#', '');
    return hash && VALID_TABS.includes(hash) ? hash : 'events';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [eventsFreeMode, setEventsFreeMode] = useState(true); // default true per sicurezza
  // Step corrente nella sezione Certificazioni (0=Assicurazione, 1=Cert. medico, 2=Brevetto)
  const [certStep, setCertStep] = useState(0);
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
    club_team: "",
    public_profile_enabled: false,
    public_slug: "",
  public_show_bio: true,
  public_show_instagram: true,
  public_show_company_info: true,
  public_show_certifications: true,
  public_show_events: true,
  public_show_records: true,
  public_show_personal: true,
  newsletter_new_events: false,
  });

  const [bestEntries, setBestEntries] = useState<BestEntry[]>([]);
  const [certEntries, setCertEntries] = useState<CertEntry[]>([]);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const debouncedPublicSlug = useDebounce(formData.public_slug, 400);

  // Sync activeTab -> URL hash
  useEffect(() => {
    const hash = activeTab && activeTab !== 'events' ? `#${activeTab}` : '';
    const currentHash = location.hash || '';
    if (hash !== currentHash) {
      navigate({ hash }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Sync URL hash -> activeTab (browser back/forward)
  useEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (hash && VALID_TABS.includes(hash) && hash !== activeTab) {
      setActiveTab(hash);
    } else if (!hash && activeTab !== 'events') {
      setActiveTab('events');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

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
  const organizerEligible = publicEnabled && hasSlug && hasInsurance && insuranceOk && medicalOk;

  // Lista requisiti mancanti per organizzare
  const missingRequirements: string[] = [];
  if (!publicEnabled) missingRequirements.push(t('profile.requirements.public_profile', 'Profilo pubblico attivo'));
  if (!hasSlug) missingRequirements.push(t('profile.requirements.public_slug', 'Slug profilo pubblico'));
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
  const [inviteEvent, setInviteEvent] = useState<{ id: string; title: string } | null>(null);
  // Stato per modale requisiti mancanti organizzazione evento
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  // Snapshot dei campi mancanti al momento dell'apertura del modal (non cambia durante la compilazione)
  const [missingSnapshot, setMissingSnapshot] = useState<{
    publicEnabled: boolean; hasSlug: boolean;
    hasInsurance: boolean; insuranceOk: boolean; medicalOk: boolean;
  } | null>(null);

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
      setNoticeMsg(t('profile_extra.created_success', 'Creato con successo!'));
      setNoticeOpen(true);
  // Chiudi lo sheet laterale
  setIsSheetOpen(false);
      // Aggiorna elenco organizzati
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: t('profile_extra.create_error_title', 'Errore creazione'), description: err?.message || t('profile_extra.create_error_desc', 'Creazione fallita'), variant: 'destructive' });
    }
  });

  const editMutation = useMutation({
    mutationFn: (payload: { id: string; patch: Partial<Event> }) => updateEvent(payload.id, payload.patch),
    onSuccess: () => {
      setNoticeMsg(t('profile_extra.saved_success', 'Salvato con successo!'));
      setNoticeOpen(true);
      setIsEditSheetOpen(false);
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: t('profile_extra.save_error_title', 'Errore salvataggio'), description: err?.message || t('profile_extra.save_error_desc', 'Modifica fallita'), variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      setNoticeMsg(t('profile_extra.deleted_success', 'Evento eliminato con successo!'));
      setNoticeOpen(true);
      refetchOrganized();
    },
    onError: (err: any) => {
      toast({ title: t('profile_extra.delete_error_title', 'Errore eliminazione'), description: err?.message || t('profile_extra.delete_error_desc', 'Eliminazione fallita'), variant: 'destructive' });
    }
  });

  const handleDeleteEvent = (id: string, title: string) => {
    if (window.confirm(t('profile_extra.delete_confirm', 'Sei sicuro di voler eliminare l\'evento "{title}"? Questa azione non può essere annullata.').replace('{title}', title))) {
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
      const text = ev.fixed_appointment_text ? ev.fixed_appointment_text : t('profile_extra.recurring_appointment', 'Appuntamento ricorrente');
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
        club_team: (user as any).club_team || "",
        public_profile_enabled: (user as any).public_profile_enabled ?? false,
        public_slug: (user as any).public_slug || "",
  public_show_bio: (user as any).public_show_bio ?? true,
  public_show_instagram: (user as any).public_show_instagram ?? true,
  public_show_company_info: (user as any).public_show_company_info ?? true,
  public_show_certifications: (user as any).public_show_certifications ?? true,
  public_show_events: (user as any).public_show_events ?? true,
  public_show_records: (user as any).public_show_records ?? true,
  public_show_personal: (user as any).public_show_personal ?? true,
  newsletter_new_events: (user as any).newsletter_new_events ?? false,
      });

      if (user.personal_best) {
        const pb = user.personal_best as any;
        let entries: BestEntry[] = [];
        let isLegacy = false;
        if (Array.isArray(pb)) {
          // Formato nuovo: array di { discipline, value } – mantieni l'ordine dell'utente
          entries = pb.filter((e: any) => e?.discipline && e?.value).map((e: any) => ({ discipline: e.discipline as BestDiscipline, value: String(e.value) }));
        } else if (pb && typeof pb === 'object') {
          isLegacy = true;
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
        // Ordina solo per il formato legacy (oggetto); il formato array preserva l'ordine dell'utente
        if (isLegacy) {
          const order: Record<string, number> = Object.fromEntries(DISCIPLINE_CODES.map((d, i) => [d.code, i]));
          entries.sort((a, b) => (order[a.discipline] ?? 999) - (order[b.discipline] ?? 999));
        }
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
      const slug = debouncedPublicSlug?.trim();
      if (!slug) { setSlugStatus('idle'); return; }
      // Se lo slug corrente coincide con quello già assegnato all'utente, non verifichiamo
      if (user?.public_slug && String(user.public_slug).toLowerCase() === String(slug).toLowerCase()) {
        setSlugStatus('available');
        return;
      }
      // Se ha già uno slug ma non sta editando, mostra available
      if (user?.public_slug && !isEditingSlug) { setSlugStatus('available'); return; }
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
  }, [debouncedPublicSlug, formData.public_profile_enabled, user?.id, user?.public_slug, isEditingSlug]);

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

  const moveBest = (idx: number, direction: 'up' | 'down') => {
    setBestEntries(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
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

    // Validazioni extra: la dichiarazione di assicurazione può essere salvata anche senza i dati assicurativi dettagliati.
    // I campi assicurativi (nome, numero, scadenza) restano facoltativi.
    // Se però l'utente ha compilato l'assicurazione, la dichiarazione è obbligatoria
    if (formData.assicurazione?.trim() && !formData.dichiarazione_assicurazione_valida) {
      toast({
        title: t('profile.sections.certifications.insurance_declaration_required_title', 'Dichiarazione assicurazione richiesta'),
        description: t('profile.sections.certifications.insurance_declaration_required_desc', 'Per salvare i dati assicurativi devi spuntare la dichiarazione di copertura assicurativa in corso di validità.'),
        variant: 'destructive'
      });
      return;
    }
    // Brevetto: richiede brevetto, numero_brevetto e scadenza_brevetto futura
    if (formData.dichiarazione_brevetto_valido) {
      const hasBrevetto = !!formData.brevetto?.trim();
      const hasNumeroBrevetto = !!(formData.numero_brevetto && String(formData.numero_brevetto).trim());
      const expiryBrevetto = formData.scadenza_brevetto ? new Date(formData.scadenza_brevetto) : null;
      const futureBrevetto = expiryBrevetto ? expiryBrevetto >= new Date(new Date().setHours(0,0,0,0)) : false;
      if (!hasBrevetto || !hasNumeroBrevetto || !futureBrevetto) {
        toast({
          title: t('profile_extra.patent_incomplete_title', 'Dati Brevetto incompleti'),
          description: t('profile_extra.patent_incomplete_desc', 'Inserisci brevetto, numero e una scadenza futura prima di confermare la dichiarazione brevetto valido.'),
          variant: 'destructive'
        });
        return;
      }
    }

    // Blocca submit se lo slug è preso da altri
    if (formData.public_profile_enabled) {
      if (!formData.public_slug?.trim()) {
        toast({ title: t('profile_extra.slug_missing_title', 'Slug mancante'), description: t('profile_extra.slug_missing_desc', 'Inserisci uno slug per il profilo pubblico oppure disattiva la visibilità.'), variant: 'destructive' });
        return;
      }
      if (slugStatus === 'taken' || slugStatus === 'checking') {
        toast({ title: t('profile_extra.slug_taken_title', 'Slug non disponibile'), description: t('profile_extra.slug_taken_desc', 'Scegli uno slug diverso, quello attuale è già occupato.'), variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      // Autogenera slug se visibilità attiva e slug mancante
      let computedSlug = formData.public_slug?.trim() ? slugify(formData.public_slug) : "";
      // Se lo slug è già stato assegnato e non lo stiamo editando, usa quello esistente
      if (user?.public_slug && !isEditingSlug) {
        computedSlug = String(user.public_slug);
      }
      if (formData.public_profile_enabled && !computedSlug) {
        const base = formData.full_name || formData.company_name || user.email?.split('@')[0] || '';
        computedSlug = slugify(base);
        if (!computedSlug) {
          throw new Error('Slug mancante');
        }
      }
      if (formData.public_profile_enabled && slugStatus === 'taken') {
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
        club_team: formData.club_team || null,
        company_name: formData.company_name || null,
        vat_number: formData.vat_number || null,
        company_address: formData.company_address || null,
        personal_best: bestEntries
          .filter(e => e.value && e.discipline)
          .map(e => ({ discipline: e.discipline, value: e.value })),
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
          toast({ title: t('profile_extra.slug_conflict_title', 'Slug in conflitto'), description: t('profile_extra.slug_conflict_desc', 'Lo slug scelto è già in uso. Scegline un altro e riprova.'), variant: 'destructive' });
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

      setIsEditingSlug(false);
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
    <div className="px-4 py-1 profile-theme">
      <PageHead title={t('profile_extra.page_title', 'Il Mio Profilo')} description={t('profile_extra.page_description', 'Gestisci il tuo profilo WeApnea, certificazioni e preferenze.')} />
      <div className="max-w-5xl mx-auto">
        <CenteredNotice
          open={noticeOpen}
          onClose={() => setNoticeOpen(false)}
          title={t('profile_extra.notice_title', 'Operazione completata')}
          message={noticeMsg}
        />
        {!isMobile && (
          <div className="mb-1">
            <BackButton fallbackPath="/" label={t('not_found.back_home', 'Torna alla Home')} />
          </div>
        )}
        
        {/* Header profilo rimosso su richiesta (icona + titolo + sottotitolo) */}

        {/* Ruolo rimosso su richiesta */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          {/* Mobile: griglia icone compatta – sticky sotto la navbar */}
          <div className="md:hidden sticky top-[57px] z-30 -mx-4 px-4 py-2 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
            <div className="grid grid-cols-5 gap-1 p-1 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-neutral-700/50">
              {[
                { value: 'events', icon: Calendar, label: t('profile.tabs.events_short', 'Eventi') },
                { value: 'personal', icon: UserCircle, label: t('profile.tabs.personal_short', 'Profilo') },
                { value: 'certs', icon: Shield, label: t('profile.tabs.certs_short', 'Cert.') },
                { value: 'bests', icon: FileText, label: t('profile.tabs.bests_short', 'Record') },
                { value: 'visibility', icon: Eye, label: t('profile.tabs.visibility_short', 'Visib.') },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all text-center ${
                    activeTab === tab.value
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                </button>
              ))}
              {canManageBlog && (
                <button
                  type="button"
                  onClick={() => setActiveTab('blog')}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all text-center col-span-5 ${
                    activeTab === 'blog'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="text-[10px] font-medium leading-none">{t('profile.tabs.blog', 'Blog')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Container unico – su desktop ha border/bg, su mobile è trasparente */}
          <div className="md:flex md:rounded-xl md:border md:border-gray-200 md:dark:border-neutral-700 md:bg-white md:dark:bg-neutral-900 md:shadow-sm md:overflow-hidden">
            {/* Sidebar – solo desktop */}
            <TabsList className="hidden md:flex h-auto w-48 min-w-[12rem] flex-col items-stretch gap-0.5 bg-transparent p-3 border-r border-gray-200 dark:border-neutral-700 sticky top-20 self-start rounded-none">
              <TabsTrigger value="events" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                <Calendar className="h-4 w-4 mr-2" />
                {t('profile.tabs.events', 'Miei eventi')}
              </TabsTrigger>
              <TabsTrigger value="personal" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                <UserCircle className="h-4 w-4 mr-2" />
                {t('profile.tabs.personal', 'Personali')}
              </TabsTrigger>
              <TabsTrigger value="certs" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                <Shield className="h-4 w-4 mr-2" />
                {t('profile.tabs.certs', 'Certificazioni')}
              </TabsTrigger>
              <TabsTrigger value="bests" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                <FileText className="h-4 w-4 mr-2" />
                {t('profile.tabs.bests', 'Record')}
              </TabsTrigger>
              <TabsTrigger value="visibility" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                <Eye className="h-4 w-4 mr-2" />
                {t('profile.tabs.visibility', 'Visibilità')}
              </TabsTrigger>
              {canManageBlog && (
                <TabsTrigger value="blog" className="justify-start w-full px-3 py-2 rounded-lg text-sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('profile.tabs.blog', 'Blog')}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Contenuto */}
            <div className="flex-1 min-w-0 md:p-5 md:bg-gray-50/40 md:dark:bg-neutral-950/20">
              <form onSubmit={handleSubmit}>
            <TabsContent value="events">
              <Card className="border-0 md:border shadow-none md:shadow-sm">
                <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">{t('profile.sections.my_events.title', 'I Miei Eventi')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.my_events.description', 'Gestisci i tuoi eventi e crea nuovi eventi')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-1 md:px-6">
                  {/* Sotto-tab interne alla sezione Eventi */}
                  <div className="mb-6" role="tablist" aria-label="Sotto sezione eventi">
                    <div className="inline-flex rounded-md shadow-sm overflow-hidden border border-purple-200 bg-white dark:bg-neutral-900 w-full md:w-auto">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!showOrganizer}
                        onClick={() => setShowOrganizer(false)}
                        className={
                          `flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60
                          ${!showOrganizer
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                            : 'bg-transparent text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-800/30'}
                          `
                        }
                      >
                        {t('profile.sections.my_events.my_registrations_label', 'Elenco Iscrizioni')}
                      </button>
                      {(!organizerEligible && user?.role !== 'admin') ? (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={showOrganizer}
                          onClick={() => {
                            setMissingSnapshot({
                              publicEnabled: !!formData.public_profile_enabled,
                              hasSlug: !!(formData.public_slug && formData.public_slug.trim()),
                              hasInsurance: !!(formData.assicurazione && formData.assicurazione.trim()),
                              insuranceOk: formData.scadenza_assicurazione ? (new Date(formData.scadenza_assicurazione) >= toleranceDate) : false,
                              medicalOk: formData.scadenza_certificato_medico ? (new Date(formData.scadenza_certificato_medico) >= toleranceDate) : false,
                            });
                            setShowMissingFieldsModal(true);
                          }}
                          className={
                            `flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 border-l border-purple-200
                            bg-transparent text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-800/30`
                          }
                        >
                          {t('profile.sections.my_events.organize_event_label', 'Organizza Evento')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={showOrganizer}
                          onClick={() => setShowOrganizer(true)}
                          className={
                            `flex-1 md:flex-none px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 border-l border-purple-200
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
                            <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg">
                              <div className="flex items-start gap-3 min-w-0">
                                {p.events.image_url && (
                                  <img src={p.events.image_url} alt={p.events.title} className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-sm md:text-base truncate">{p.events.title}</h3>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm text-muted-foreground mt-1">
                                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                                    {p.events.fixed_appointment === true
                                      ? ((p.events.fixed_appointment_text && p.events.fixed_appointment_text.trim()) || t('events.recurring_label', 'Appuntamento ricorrente'))
                                      : formatEventDate(p.events.date, p.events.end_date)}</span>
                                    {p.events.location && (
                                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.events.location}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button asChild variant="outline" size="sm" className="self-start md:self-center flex-shrink-0">
                                <Link to={buildFriendlyEventPath(p.events.slug)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  {t('common.view', 'Visualizza')}
                                </Link>
                              </Button>
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
                        <h3 className="font-semibold mb-3">{t('profile.sections.my_events.your_organized_events', 'I tuoi eventi organizzati')}</h3>
                        {isLoadingOrganized ? (
                          <div className="py-4 text-sm text-muted-foreground">{t('profile.sections.my_events.loading_events', 'Caricamento eventi...')}</div>
                        ) : (organizedEvents && organizedEvents.length > 0 ? (
                          <div className="grid gap-3">
                            {organizedEvents.map(ev => {
                              const isSoldOut = typeof ev.participants === 'number' && ev.participants > 0 && typeof ev.participants_paid_count === 'number' && ev.participants_paid_count >= ev.participants;
                              return (
                              <div key={ev.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Link to={buildFriendlyEventPath(ev.slug)} className="font-semibold text-sm md:text-base hover:underline truncate block">{ev.title}</Link>
                                      {isSoldOut && (
                                        <Badge className="bg-red-500 text-white text-[10px] px-2 py-0.5 flex-shrink-0">Sold Out</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs md:text-sm text-muted-foreground">
                                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatEventWithFixed(ev)}</span>
                                      {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{ev.location}</span>}
                                      {!eventsFreeMode && ev.cost != null && ev.cost > 0 && <span className="font-medium text-foreground">€{Number(ev.cost).toFixed(2)}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button type="button" size="sm" variant="outline" className="gap-1 hidden md:inline-flex" onClick={() => openParticipantsForEvent({ id: ev.id, title: ev.title })}>
                                      <Users className="h-4 w-4" />
                                      <span className="font-semibold">{typeof ev.participants_paid_count === 'number' ? ev.participants_paid_count : 0}</span>
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="md:hidden gap-1 h-8 px-2" onClick={() => openParticipantsForEvent({ id: ev.id, title: ev.title })}>
                                      <Users className="h-4 w-4" />
                                      <span className="text-xs font-semibold">{typeof ev.participants_paid_count === 'number' ? ev.participants_paid_count : 0}</span>
                                    </Button>
                                    {!isSoldOut && (
                                      <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_invite', 'Invita')} onClick={() => setInviteEvent({ id: ev.id, title: ev.title })} className="h-8 w-8">
                                        <UserPlus className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_edit', 'Modifica')} onClick={() => openEditEvent(ev)} className="h-8 w-8">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" title={t('profile.sections.my_events.action_delete', 'Elimina')} onClick={() => handleDeleteEvent(ev.id, ev.title)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-6 text-sm text-muted-foreground border rounded-md text-center">
                            {t('profile.sections.my_events.no_organized_events', 'Nessun evento organizzato ancora.')}
                          </div>
                        ))}
                      </div>
                      {inviteEvent && (
                        <EventInvite
                          eventId={inviteEvent.id}
                          eventTitle={inviteEvent.title}
                          open={!!inviteEvent}
                          onOpenChange={(open) => { if (!open) setInviteEvent(null); }}
                        />
                      )}
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
                  className="overflow-y-auto p-0 [&>button]:hidden w-full sm:w-[540px] sm:max-w-[540px]"
                  onInteractOutside={(e) => { e.preventDefault(); }}
                  onEscapeKeyDown={(e) => { e.preventDefault(); }}
                >
                  <div className="sticky top-0 z-50 bg-background border-b shadow-sm supports-[backdrop-filter]:bg-background/80 backdrop-blur">
                    <div className="flex items-center justify-between gap-2 px-6 py-3">
                      <SheetTitle className="text-base sm:text-lg">
                        {t('profile_extra.enrolled_title', 'Iscritti — {event}').replace('{event}', participantsEventTitle || t('profile_extra.event_fallback', 'Evento'))}
                      </SheetTitle>
                      <div className="flex items-center gap-1">
                        {participants.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('profile_extra.download_csv', 'Scarica CSV')}
                            title={t('profile_extra.download_csv_title', 'Scarica CSV partecipanti')}
                            onClick={() => {
                              const headers = [t('profile_extra.csv_headers_name', 'Nome'), t('profile_extra.csv_headers_email', 'Email'), t('profile_extra.csv_headers_phone', 'Telefono'), t('profile_extra.csv_headers_company', 'Azienda'), t('profile_extra.csv_headers_paid', 'Pagato il')];
                              const rows = participants.map((p) => [
                                p.full_name || '',
                                (p as any).email || '',
                                p.phone || '',
                                p.company_name || '',
                                p.paid_at ? format(parseISO(p.paid_at), 'dd/MM/yyyy HH:mm', { locale: itLocale }) : '',
                              ]);
                              const csvContent = [headers, ...rows]
                                .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                                .join('\n');
                              const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `partecipanti-${(participantsEventTitle || 'evento').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <SheetClose asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label={t('profile_extra.close', 'Chiudi')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </SheetClose>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {participantsLoading ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">{t('profile_extra.loading_enrolled', 'Caricamento iscritti...')}</div>
                    ) : participants.length > 0 ? (
                      <>
                      {/* Desktop: Table */}
                      <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('profile_extra.name_col', 'Nome')}</TableHead>
                            <TableHead>{t('profile_extra.phone_col', 'Telefono')}</TableHead>
                            <TableHead>{t('profile_extra.paid_col', 'Pagato il')}</TableHead>
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
                                {p.phone ? (
                                  <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                                    <Phone className="h-3.5 w-3.5" />{p.phone}
                                  </a>
                                ) : <span className="text-muted-foreground/50">—</span>}
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
                                      title={t('profile_extra.chat_participant', 'Chatta con questo partecipante')}
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
                                    title={t('profile_extra.remove_participant', 'Rimuovi partecipante')}
                                    onClick={async () => {
                                      const confirmed = window.confirm(t('profile_extra.confirm_remove', 'Rimuovere {name}?').replace('{name}', p.full_name || t('profile_extra.remove_participant', 'questo partecipante')));
                                      if (!confirmed) return;
                                      try {
                                        await removeEventParticipant(participantsEventId, p.user_id);
                                        toast({ title: t('profile_extra.participant_removed_title', 'Partecipante rimosso'), description: t('profile_extra.participant_removed_desc', "L'utente è stato rimosso dall'evento.") });
                                        setParticipants(prev => prev.filter(part => part.user_id !== p.user_id));
                                      } catch (e) {
                                        toast({ title: t('profile_extra.error', 'Errore'), description: t('profile_extra.remove_error', 'Impossibile rimuovere il partecipante'), variant: "destructive" });
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
                      </div>
                      {/* Mobile: Card layout */}
                      <div className="md:hidden space-y-3">
                        {participants.map(p => (
                          <div key={p.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-sm truncate min-w-0">
                                {p.public_profile_enabled && p.public_slug ? (
                                  <Link className="underline" to={`/profile/${p.public_slug}`} target="_blank" rel="noreferrer">
                                    {p.full_name || p.company_name || p.user_id}
                                  </Link>
                                ) : (
                                  <span>{p.full_name || p.company_name || p.user_id}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {user?.id !== p.user_id && (
                                  <button
                                    type="button"
                                    className="p-2 rounded hover:bg-blue-50 text-blue-600"
                                    title={t('profile_extra.chat_tooltip', 'Chatta')}
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
                                  title={t('profile_extra.remove_tooltip', 'Rimuovi')}
                                  onClick={async () => {
                                    const confirmed = window.confirm(t('profile_extra.confirm_remove', 'Rimuovere {name}?').replace('{name}', p.full_name || t('profile_extra.remove_participant', 'questo partecipante')));
                                    if (!confirmed) return;
                                    try {
                                      await removeEventParticipant(participantsEventId, p.user_id);
                                      toast({ title: t('profile_extra.participant_removed_title', 'Partecipante rimosso'), description: t('profile_extra.participant_removed_desc', "L'utente è stato rimosso dall'evento.") });
                                      setParticipants(prev => prev.filter(part => part.user_id !== p.user_id));
                                    } catch (e) {
                                      toast({ title: t('profile_extra.error', 'Errore'), description: t('profile_extra.remove_error', 'Impossibile rimuovere il partecipante'), variant: "destructive" });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {p.phone ? (
                                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                                  <Phone className="h-3.5 w-3.5" />{p.phone}
                                </a>
                              ) : null}
                              <span>{p.paid_at ? t('profile_extra.paid_label', 'Pagato: {date}').replace('{date}', format(parseISO(p.paid_at), 'dd/MM/yyyy HH:mm', { locale: itLocale })) : t('profile_extra.not_paid', 'Non pagato')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground text-sm">{t('profile_extra.no_enrolled', 'Nessun iscritto al momento.')}</div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </TabsContent>

            <TabsContent value="personal">
              <Card className="border-0 md:border shadow-none md:shadow-sm">
                <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">{t('profile.sections.personal_info.title', 'Informazioni Personali')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.personal_info.description', 'Aggiorna le tue informazioni personali e di contatto')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-1 md:px-6">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('profile.sections.personal_info.phone_privacy_note', 'Sarà visibile solo dall\'organizzatore se ti iscrivi ad un suo evento')}
                      </p>
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

                  <div>
                    <Label htmlFor="club_team">{t('profile.sections.personal_info.club_team_label', 'Club / Associazione / Team')}</Label>
                    <Input
                      id="club_team"
                      value={formData.club_team}
                      onChange={(e) => handleInputChange('club_team', e.target.value)}
                      placeholder={t('profile.sections.personal_info.club_team_placeholder', 'Es. ASD Apnea Team Italia')}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('profile.sections.personal_info.club_team_hint', 'Facoltativo. Sarà visibile sul profilo pubblico.')}
                    </p>
                  </div>
                </CardContent>
              </Card>

            </TabsContent>

            {/* Visibilità - nuova tab dedicata (resa disponibile per tutti i ruoli) */}
            <TabsContent value="visibility">
                <Card className="border-0 md:border shadow-none md:shadow-sm">
                  <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                    <CardTitle className="text-lg md:text-xl">{t('profile.sections.visibility.title', 'Visibilità')}</CardTitle>
                    <CardDescription>
                      {t('profile.sections.visibility.description', 'Rendi visibile una pagina pubblica del tuo profilo su un URL parlante. Puoi scegliere cosa mostrare.')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 px-1 md:px-6">
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
                      <div className="flex items-center gap-2">
                        <Input
                          id="public_slug"
                          value={formData.public_slug}
                          onChange={(e) => setFormData(prev => ({ ...prev, public_slug: slugify(e.target.value) }))}
                          placeholder={t('profile.sections.visibility.public_slug_placeholder', 'es. nome-cognome')}
                          disabled={!formData.public_profile_enabled || (Boolean(user?.public_slug) && !isEditingSlug)}
                          className="flex-1"
                        />
                        {formData.public_profile_enabled && user?.public_slug && !isEditingSlug && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingSlug(true)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            {t('profile.sections.visibility.edit_slug', 'Modifica')}
                          </Button>
                        )}
                        {isEditingSlug && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsEditingSlug(false);
                              setFormData(prev => ({ ...prev, public_slug: user?.public_slug || '' }));
                              setSlugStatus('available');
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {t('profile.sections.visibility.cancel_edit_slug', 'Annulla')}
                          </Button>
                        )}
                      </div>
                      {isEditingSlug && (
                        <p className="text-xs text-amber-600 mt-1">{t('profile.sections.visibility.slug_change_warning', 'Attenzione: cambiare lo slug modificherà il tuo URL pubblico. Il vecchio URL sarà reindirizzato automaticamente.')}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.public_url_prefix', 'URL: /profile/')}{formData.public_slug || '<slug>'}</p>
                        {formData.public_profile_enabled && (isEditingSlug || !user?.public_slug) && (
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
                      </div>
                      {formData.public_profile_enabled && formData.public_slug && (
                        <div className="flex flex-wrap gap-2 mt-2">
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
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between border rounded-md p-3 gap-3">
                        <div className="min-w-0">
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

                      <div className="flex items-center justify-between border rounded-md p-3 gap-3">
                        <div className="min-w-0">
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

                      <div className="flex items-center justify-between border rounded-md p-3 gap-3">
                        <div className="min-w-0">
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

                      <div className="flex items-center justify-between border rounded-md p-3 gap-3">
                        <div className="min-w-0">
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

                    {/* Newsletter preferences */}
                    <div className="border-t pt-5 mt-5">
                      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                        <Bell className="h-4 w-4 text-blue-600" />
                        {t('profile.sections.visibility.newsletter_title', 'Notifiche & Newsletter')}
                      </h3>
                      <div className="flex items-center justify-between border rounded-md p-3 gap-3">
                        <div className="min-w-0">
                          <Label htmlFor="newsletter_new_events">{t('profile.sections.visibility.newsletter_events', 'Nuovi eventi')}</Label>
                          <p className="text-xs text-muted-foreground">{t('profile.sections.visibility.newsletter_events_desc', 'Ricevi un\'email quando viene pubblicato un nuovo evento')}</p>
                        </div>
                        <Switch
                          id="newsletter_new_events"
                          checked={formData.newsletter_new_events || false}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, newsletter_new_events: Boolean(v) }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            <TabsContent value="certs">
              <Card className="border-0 md:border shadow-none md:shadow-sm">
                  <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">{t('profile.sections.certifications.title', 'Certificazioni')}</CardTitle>
                </CardHeader>
                <CardContent className="px-1 md:px-6">

                  {/* ═══ Step indicator ═══ */}
                  <div className="flex items-center justify-center gap-1 mb-6">
                    {[
                      { icon: Shield, label: t('profile.sections.certifications.accordion_insurance', 'Assicurazione') },
                      { icon: FileText, label: t('profile.sections.certifications.accordion_medical', 'Cert. Medico') },
                      { icon: FileText, label: t('profile.sections.certifications.accordion_brevetto', 'Brevetto') },
                    ].map((step, idx) => (
                      <div key={idx} className="flex items-center">
                        {idx > 0 && <div className={`hidden sm:block w-8 h-0.5 mx-1 ${idx <= certStep ? 'bg-primary' : 'bg-border'}`} />}
                        <button
                          type="button"
                          onClick={() => setCertStep(idx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            idx === certStep
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : idx < certStep
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          <step.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{step.label}</span>
                          <span className="sm:hidden">{idx + 1}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* ═══ Step 0 — Assicurazione ═══ */}
                  {certStep === 0 && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-semibold">{t('profile.sections.certifications.accordion_insurance', 'Assicurazione')}</h3>
                        <Badge variant="outline" className="text-xs">{t('profile.sections.certifications.required_badge', 'Obbligatoria')}</Badge>
                      </div>

                      <div className="flex items-start gap-3 p-3 border rounded-md border-primary/30 bg-primary/5">
                        <Checkbox
                          id="dichiarazione_assicurazione_valida"
                          checked={Boolean(formData.dichiarazione_assicurazione_valida)}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, dichiarazione_assicurazione_valida: Boolean(v) }))}
                        />
                        <Label htmlFor="dichiarazione_assicurazione_valida" className="text-sm cursor-pointer">
                          {t('profile.sections.certifications.insurance_declaration', 'Dichiaro di avere una copertura assicurativa in corso di validità')}
                        </Label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t('profile.sections.certifications.insurance_label', 'Assicurazione')}</Label>
                          <Input value={formData.assicurazione} onChange={(e) => handleInputChange('assicurazione', e.target.value)} placeholder={t('profile.sections.certifications.insurance_placeholder', 'Nome assicurazione')} />
                        </div>
                        <div>
                          <Label>{t('profile.sections.certifications.insurance_expiry_label', 'Scadenza Assicurazione')}</Label>
                          <DatePicker date={formData.scadenza_assicurazione ? new Date(formData.scadenza_assicurazione) : undefined} onDateChange={(date) => handleInputChange('scadenza_assicurazione', toLocalDateString(date))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t('profile.sections.certifications.insurance_number_label', 'Numero assicurazione')}</Label>
                          <Input value={formData.numero_assicurazione} onChange={(e) => handleInputChange('numero_assicurazione', e.target.value)} placeholder={t('profile.sections.certifications.insurance_number_placeholder', 'Inserire numero assicurazione')} />
                        </div>
                      </div>

                      {/* Assicurazioni aggiuntive */}
                      {insuranceEntries.length > 0 && (
                        <div className="mt-2 space-y-3">
                          <p className="text-sm font-medium">{t('profile.sections.certifications.other_insurances', 'Altre assicurazioni')}</p>
                          {insuranceEntries.map((entry) => (
                            <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="text-xs text-muted-foreground">#{insuranceEntries.indexOf(entry) + 1}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}><X className="h-4 w-4" /></Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Input value={entry.name} onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })} placeholder={t('profile.sections.certifications.insurance_placeholder', 'Nome assicurazione')} />
                                <Input value={entry.number} onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })} placeholder={t('profile.sections.certifications.insurance_number_placeholder', 'Numero')} />
                                <DatePicker date={entry.expiry ? new Date(entry.expiry) : undefined} onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addCert('insurance')}>
                        <PlusCircle className="h-4 w-4 mr-2" />{t('profile.sections.certifications.add_insurance', 'Aggiungi assicurazione')}
                      </Button>
                    </div>
                  )}

                  {/* ═══ Step 1 — Certificato medico ═══ */}
                  {certStep === 1 && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-200">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-semibold">{t('profile.sections.certifications.accordion_medical', 'Certificato medico')}</h3>
                        <Badge variant="secondary" className="text-xs">{t('profile.sections.certifications.organizer_only_badge', 'Per organizzatori')}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>{t('profile.sections.certifications.medical_expiry_label', 'Scadenza Certificato Medico')}</Label>
                          <DatePicker
                            date={formData.scadenza_certificato_medico ? new Date(formData.scadenza_certificato_medico) : undefined}
                            onDateChange={(date) => handleInputChange('scadenza_certificato_medico', toLocalDateString(date))}
                          />
                        </div>
                        <div>
                          <Label>{t('profile.sections.certifications.medical_type_label', 'Tipo certificato medico')}</Label>
                          <Select value={(formData as any).certificato_medico_tipo || ''} onValueChange={(v) => handleInputChange('certificato_medico_tipo', v)}>
                            <SelectTrigger><SelectValue placeholder={t('profile.sections.certifications.medical_type_placeholder', 'Seleziona tipo')} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="agonistico">{t('profile.sections.certifications.medical_type_agonistico', 'Agonistico')}</SelectItem>
                              <SelectItem value="non_agonistico">{t('profile.sections.certifications.medical_type_non_agonistico', 'Non agonistico')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Certificati medici aggiuntivi */}
                      {medicalEntries.length > 0 && (
                        <div className="mt-2 space-y-3">
                          <p className="text-sm font-medium">{t('profile.sections.certifications.other_medicals', 'Altri certificati medici')}</p>
                          {medicalEntries.map((entry) => (
                            <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="text-xs text-muted-foreground">#{medicalEntries.indexOf(entry) + 1}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}><X className="h-4 w-4" /></Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Input value={entry.name} onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })} placeholder={t('profile.sections.certifications.medical_name_placeholder', 'Tipo certificato')} />
                                <Input value={entry.number} onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })} placeholder={t('profile.sections.certifications.cert_number_placeholder', 'Numero')} />
                                <DatePicker date={entry.expiry ? new Date(entry.expiry) : undefined} onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addCert('medical')}>
                        <PlusCircle className="h-4 w-4 mr-2" />{t('profile.sections.certifications.add_medical', 'Aggiungi certificato medico')}
                      </Button>
                    </div>
                  )}

                  {/* ═══ Step 2 — Brevetto ═══ */}
                  {certStep === 2 && (
                    <div className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          <h3 className="text-base font-semibold">{t('profile.sections.certifications.accordion_brevetto', 'Brevetto')}</h3>
                          <Badge variant="secondary" className="text-xs">{t('profile.sections.certifications.organizer_only_badge', 'Per organizzatori')}</Badge>
                        </div>
                        <Switch
                          checked={!!(formData.brevetto?.trim() || formData.dichiarazione_brevetto_valido || (formData as any)._showBrevetto)}
                          onCheckedChange={(v) => {
                            if (!v) {
                              setFormData(prev => ({ ...prev, brevetto: '', didattica_brevetto: '', numero_brevetto: '', foto_brevetto_url: '', scadenza_brevetto: '', dichiarazione_brevetto_valido: false, _showBrevetto: false } as any));
                            } else {
                              setFormData(prev => ({ ...prev, _showBrevetto: true } as any));
                            }
                          }}
                        />
                      </div>

                      {(formData.brevetto?.trim() || formData.dichiarazione_brevetto_valido || (formData as any)._showBrevetto) && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>{t('profile.sections.certifications.brevetto_label', 'Brevetto')}</Label>
                              <Input value={formData.brevetto} onChange={(e) => handleInputChange('brevetto', e.target.value)} placeholder={t('profile.sections.certifications.brevetto_placeholder', 'Inserire tipologia brevetto')} />
                            </div>
                            <div>
                              <Label>{t('profile.sections.certifications.brevetto_expiry_label', 'Scadenza Brevetto')}</Label>
                              <DatePicker date={formData.scadenza_brevetto ? new Date(formData.scadenza_brevetto) : undefined} onDateChange={(date) => handleInputChange('scadenza_brevetto', toLocalDateString(date))} />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>{t('profile.sections.certifications.brevetto_didattica_label', 'Didattica brevetto')}</Label>
                              <Input value={formData.didattica_brevetto} onChange={(e) => handleInputChange('didattica_brevetto', e.target.value)} placeholder={t('profile.sections.certifications.brevetto_didattica_placeholder', 'Inserire didattica brevetto')} />
                            </div>
                            <div>
                              <Label>{t('profile.sections.certifications.brevetto_number_label', 'Numero brevetto')}</Label>
                              <Input value={formData.numero_brevetto} onChange={(e) => handleInputChange('numero_brevetto', e.target.value)} placeholder={t('profile.sections.certifications.brevetto_number_placeholder', 'Inserire numero brevetto')} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('profile.sections.certifications.brevetto_photo_label', 'Foto brevetto')}</Label>
                            <ImageUpload
                              currentImageUrl={formData.foto_brevetto_url || undefined}
                              onImageUploaded={(url) => handleInputChange('foto_brevetto_url', url)}
                              onImageRemoved={() => handleInputChange('foto_brevetto_url', '')}
                            />
                          </div>
                          <div className="flex items-start gap-3 p-3 border rounded-md">
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
                            <div className="mt-2 space-y-3">
                              <p className="text-sm font-medium">{t('profile.sections.certifications.other_certificates', 'Altri brevetti / certificazioni')}</p>
                              {certificateEntries.map((entry) => (
                                <div key={entry.originalIdx} className="p-3 border rounded-md space-y-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-xs text-muted-foreground">#{certificateEntries.indexOf(entry) + 1}</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCert(entry.originalIdx)}><X className="h-4 w-4" /></Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <Input value={entry.name} onChange={(e) => handleCertChange(entry.originalIdx, { name: e.target.value })} placeholder={t('profile.sections.certifications.cert_name_placeholder', 'es. PADI Open Water')} />
                                    <Input value={entry.number} onChange={(e) => handleCertChange(entry.originalIdx, { number: e.target.value })} placeholder={t('profile.sections.certifications.cert_number_placeholder', 'Numero')} />
                                    <DatePicker date={entry.expiry ? new Date(entry.expiry) : undefined} onDateChange={(date) => handleCertChange(entry.originalIdx, { expiry: toLocalDateString(date) })} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addCert('certificate')}>
                            <PlusCircle className="h-4 w-4 mr-2" />{t('profile.sections.certifications.add_certificate', 'Aggiungi brevetto')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ Navigazione Indietro / Avanti ═══ */}
                  <div className="flex items-center justify-between mt-8 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={certStep === 0}
                      onClick={() => setCertStep(s => s - 1)}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('common.back', 'Indietro')}
                    </Button>
                    <span className="text-xs text-muted-foreground">{certStep + 1} / 3</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={certStep === 2}
                      onClick={() => setCertStep(s => s + 1)}
                      className="gap-1"
                    >
                      {t('common.next', 'Avanti')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                </CardContent>
              </Card>

            </TabsContent>

            <TabsContent value="bests">
              <Card className="border-0 md:border shadow-none md:shadow-sm">
                <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                  <CardTitle className="text-lg md:text-xl">{t('profile.sections.personal_bests.title', 'Record Personali')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.personal_bests.description', 'Registra i tuoi migliori risultati in apnea')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-1 md:px-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t('profile.sections.personal_bests.helper', 'Inserisci i tuoi migliori risultati: tempo in mm:ss per STA, metri per le altre discipline.')}
                    </p>
                    {bestEntries.length < DISCIPLINE_CODES.length && (
                      <Button type="button" variant="outline" size="sm" onClick={addBest} className="flex-shrink-0">
                        {t('profile.sections.personal_bests.add', 'Aggiungi record')}
                      </Button>
                    )}
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden md:block">
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
                              <div className="flex items-center justify-end gap-1">
                                <Button type="button" variant="ghost" size="sm" disabled={idx === 0} onClick={() => moveBest(idx, 'up')} title="Sposta su">
                                  ▲
                                </Button>
                                <Button type="button" variant="ghost" size="sm" disabled={idx === bestEntries.length - 1} onClick={() => moveBest(idx, 'down')} title="Sposta giù">
                                  ▼
                                </Button>
                                <Button type="button" variant="destructive" size="sm" onClick={() => removeBest(idx)}>
                                  {t('common.delete', 'Elimina')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>

                  {/* Mobile: Card layout */}
                  <div className="md:hidden space-y-3">
                    {bestEntries.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('profile.sections.personal_bests.empty', 'Nessun record inserito. Aggiungi il primo!')}</p>
                    )}
                    {bestEntries.map((entry, idx) => {
                      const used = new Set(bestEntries.map((b, i) => i === idx ? undefined : b.discipline));
                      const invalid = !isValidBest(entry);
                      const placeholder = (() => {
                        const d = DISCIPLINE_CODES.find(d => d.code === entry.discipline);
                        return d?.hint === 'mm:ss' ? t('profile.sections.personal_bests.time_placeholder', 'es. 4:30') : t('profile.sections.personal_bests.meters_placeholder', 'es. 75');
                      })();
                      return (
                        <div key={idx} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
                            <div className="flex items-center gap-1">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveBest(idx, 'up')}>▲</Button>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={idx === bestEntries.length - 1} onClick={() => moveBest(idx, 'down')}>▼</Button>
                              <Button type="button" variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => removeBest(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
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
                          <Input
                            value={entry.value}
                            onChange={(e) => handleBestChange(idx, { value: e.target.value })}
                            placeholder={placeholder}
                            className={invalid && entry.value ? 'border-destructive' : ''}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organizzazione eventi: visibile come tab; disabilitata se non si soddisfano i requisiti (eccetto admin) */}
            {/* Tab organizer rimossa: funzionalità spostata in events */}

            {canManageBlog && (
              <TabsContent value="blog">
                <Card className="border-0 md:border shadow-none md:shadow-sm">
                  <CardHeader className="px-1 md:px-6 pb-3 md:pb-6">
                    <CardTitle className="text-lg md:text-xl">{t('profile.sections.blog.title', 'Gestione Articoli Blog')}</CardTitle>
                    <CardDescription>
                      {t('profile.sections.blog.description', 'Crea, modifica e gestisci i tuoi articoli del blog')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-1 md:px-6">
                    <BlogManager />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Company-specific extra content can be added here if needed */}

            {/* Modale requisiti mancanti per organizzare evento */}
            <Dialog open={showMissingFieldsModal} onOpenChange={(open) => { setShowMissingFieldsModal(open); if (!open) setMissingSnapshot(null); }}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('profile.missing_modal.title', 'Completa i dati per organizzare')}</DialogTitle>
                  <DialogDescription>
                    {t('profile.missing_modal.description', 'Per poter organizzare un evento devi compilare i seguenti campi obbligatori. Compila e salva per continuare.')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  {/* Profilo pubblico */}
                  {missingSnapshot && !missingSnapshot.publicEnabled && (
                    <div className="space-y-2">
                      <Label className="font-semibold">{t('profile.requirements.public_profile', 'Profilo pubblico attivo')}</Label>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={formData.public_profile_enabled}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_profile_enabled: Boolean(v) }))}
                        />
                        <span className="text-sm text-muted-foreground">{formData.public_profile_enabled ? t('common.active', 'Attivo') : t('common.inactive', 'Non attivo')}</span>
                      </div>
                    </div>
                  )}
                  {/* Slug profilo pubblico */}
                  {missingSnapshot && !missingSnapshot.hasSlug && (
                    <div className="space-y-2">
                      <Label htmlFor="modal_public_slug">{t('profile.requirements.public_slug', 'Slug profilo pubblico')}</Label>
                      <Input
                        id="modal_public_slug"
                        value={formData.public_slug}
                        onChange={(e) => handleInputChange('public_slug', e.target.value)}
                        placeholder={t('profile.sections.visibility.slug_placeholder', 'es. mario-rossi')}
                      />
                      <p className="text-xs text-muted-foreground">{t('profile.missing_modal.slug_hint', 'L\'indirizzo pubblico del tuo profilo (es. weapnea.com/profile/mario-rossi)')}</p>
                    </div>
                  )}
                  {/* Telefono */}

                  {/* Assicurazione */}
                  {missingSnapshot && (!missingSnapshot.hasInsurance || !missingSnapshot.insuranceOk) && (
                    <div className="space-y-3">
                      <Label className="font-semibold">{t('profile.sections.certifications.accordion_insurance', 'Assicurazione')}</Label>
                      {!missingSnapshot.hasInsurance && (
                        <div className="space-y-1">
                          <Label htmlFor="modal_assicurazione">{t('profile.sections.certifications.insurance_label', 'Nome Assicurazione')}</Label>
                          <Input
                            id="modal_assicurazione"
                            value={formData.assicurazione}
                            onChange={(e) => handleInputChange('assicurazione', e.target.value)}
                            placeholder={t('profile.sections.certifications.insurance_placeholder', 'Nome assicurazione')}
                          />
                        </div>
                      )}
                      {!missingSnapshot.insuranceOk && (
                        <div className="space-y-1">
                          <Label htmlFor="modal_scadenza_assicurazione">{t('profile.sections.certifications.insurance_expiry_label', 'Scadenza Assicurazione')}</Label>
                          <DatePicker
                            date={formData.scadenza_assicurazione ? new Date(formData.scadenza_assicurazione) : undefined}
                            onDateChange={(date) => handleInputChange('scadenza_assicurazione', toLocalDateString(date))}
                          />
                          {formData.scadenza_assicurazione && new Date(formData.scadenza_assicurazione) < toleranceDate && (
                            <p className="text-xs text-destructive">{t('profile.missing_modal.insurance_expired', 'La scadenza inserita non è valida o è già trascorsa.')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Certificato medico */}
                  {missingSnapshot && !missingSnapshot.medicalOk && (
                    <div className="space-y-2">
                      <Label htmlFor="modal_scadenza_certificato_medico" className="font-semibold">{t('profile.sections.certifications.medical_expiry_label', 'Scadenza Certificato Medico')}</Label>
                      <DatePicker
                        date={formData.scadenza_certificato_medico ? new Date(formData.scadenza_certificato_medico) : undefined}
                        onDateChange={(date) => handleInputChange('scadenza_certificato_medico', toLocalDateString(date))}
                      />
                      {formData.scadenza_certificato_medico && new Date(formData.scadenza_certificato_medico) < toleranceDate && (
                        <p className="text-xs text-destructive">{t('profile.missing_modal.medical_expired', 'La scadenza inserita non è valida o è già trascorsa.')}</p>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={() => { setShowMissingFieldsModal(false); setMissingSnapshot(null); }}>
                    {t('common.cancel', 'Annulla')}
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    disabled={loading}
                    onClick={async (e) => {
                      // Salva il profilo con i campi compilati nel modale
                      await handleSubmit(e as any);
                      // Dopo il salvataggio, chiudi se ora i requisiti sono ok
                      // (i valori di formData vengono già aggiornati in tempo reale)
                      const nowPublic = formData.public_profile_enabled;
                      const nowSlug = !!(formData.public_slug && formData.public_slug.trim());
                      const nowInsurance = !!(formData.assicurazione && formData.assicurazione.trim());
                      const nowInsuranceOk = formData.scadenza_assicurazione ? (new Date(formData.scadenza_assicurazione) >= toleranceDate) : false;
                      const nowMedicalOk = formData.scadenza_certificato_medico ? (new Date(formData.scadenza_certificato_medico) >= toleranceDate) : false;
                      if (nowPublic && nowSlug && nowInsurance && nowInsuranceOk && nowMedicalOk) {
                        setShowMissingFieldsModal(false);
                        setMissingSnapshot(null);
                        setShowOrganizer(true);
                      }
                    }}
                  >
                    {loading ? t('profile.buttons.saving', 'Salvando...') : t('profile.missing_modal.save_and_continue', 'Salva e continua')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
            </div>
          </div>
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
