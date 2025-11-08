import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
// import { supabase } from "@/integrations/supabase/client";
import { apiSend, apiGet } from "@/lib/apiClient";
import { backendConfig } from "@/lib/backendConfig";
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
import { UserCircle, FileText, Calendar, Shield, Building, Users, MapPin, Eye, X, PlusCircle } from "lucide-react";
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
import { getCategories, createEvent, Event } from "@/lib/api";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { EventForm } from "@/components/admin/EventForm";
import { AllenamentiForm } from "@/components/admin/AllenamentiForm";
import { CenteredNotice } from "@/components/CenteredNotice";

type BestDiscipline = 'STA' | 'DYN' | 'DYNB' | 'DNF' | 'FIM' | 'CWT' | 'CWTB' | 'CNF' | 'VWT' | 'NLT';
type BestEntry = { discipline: BestDiscipline; value: string };
type PersonalBest = Record<string, string> | BestEntry[];

const DISCIPLINES: { code: BestDiscipline; label: string; hint: string }[] = [
  { code: 'STA', label: 'Apnea Statica', hint: 'mm:ss' },
  { code: 'DYN', label: 'Apnea Dinamica', hint: 'metri' },
  { code: 'DYNB', label: 'Apnea Dinamica Bipinne', hint: 'metri' },
  { code: 'DNF', label: 'Apnea Dinamica senza pinne', hint: 'metri' },
  { code: 'FIM', label: 'Free Immersion', hint: 'metri' },
  { code: 'CWT', label: 'Assetto Costante (monopinna)', hint: 'metri' },
  { code: 'CWTB', label: 'Assetto Costante (bipinne)', hint: 'metri' },
  { code: 'CNF', label: 'Assetto Costante Senza Attrezzi', hint: 'metri' },
  { code: 'VWT', label: 'Variable Weight', hint: 'metri' },
  { code: 'NLT', label: 'No Limits', hint: 'metri' },
];

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
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
    assicurazione: "",
    numero_assicurazione: "",
    dichiarazione_brevetto_valido: false,
    dichiarazione_assicurazione_valida: false,
    scadenza_assicurazione: "",
    instagram_contact: "",
    phone: "",
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
  const hasPhone = !!(formData.phone && formData.phone.trim());
  const hasInsurance = !!(formData.assicurazione && formData.assicurazione.trim());
  const insuranceOk = formData.scadenza_assicurazione ? (new Date(formData.scadenza_assicurazione) >= today) : false;
  const medicalOk = formData.scadenza_certificato_medico ? (new Date(formData.scadenza_certificato_medico) >= today) : false;
  const publicEnabled = !!formData.public_profile_enabled;
  const hasSlug = !!(formData.public_slug && formData.public_slug.trim());
  const organizerEligible = publicEnabled && hasSlug && hasPhone && hasInsurance && insuranceOk && medicalOk;

  // Nessun calcolo di progress: le sezioni sono opzionali/variabili per ruolo

  // Stato/queries per creazione evento dal profilo
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAllenamentiMode, setIsAllenamentiMode] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState("");
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: organizerEligible,
  });
  const allenamentiCategory = categories?.find((c: any) => c.name?.toLowerCase?.().includes('allenamenti'));

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Event>) => createEvent(payload as Event),
    onSuccess: () => {
      setNoticeMsg("Creato con successo!");
      setNoticeOpen(true);
      setIsCreateOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Errore creazione', description: err?.message || 'Creazione fallita', variant: 'destructive' });
    }
  });

  const handleOpenCreateEvent = () => { setIsAllenamentiMode(false); setIsCreateOpen(true); };
  const handleOpenCreateAllenamento = () => { setIsAllenamentiMode(true); setIsCreateOpen(true); };

  const handleEventFormSubmit = async (values: any) => {
    try {
      await createMutation.mutateAsync(values as Partial<Event>);
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
      fixed_appointment: values.fixed_appointment,
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
        assicurazione: user.assicurazione || "",
        numero_assicurazione: (user as any).numero_assicurazione || "",
        dichiarazione_brevetto_valido: Boolean((user as any).dichiarazione_brevetto_valido) || false,
        dichiarazione_assicurazione_valida: Boolean((user as any).dichiarazione_assicurazione_valida) || false,
        scadenza_assicurazione: user.scadenza_assicurazione || "",
        instagram_contact: user.instagram_contact || "",
        phone: (user as any).phone || "",
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
            if ((DISCIPLINES as any).some((d: any) => d.code === code) && v) {
              if (!seen.has(code)) {
                entries.push({ discipline: code, value: String(v) });
                seen.add(code);
              }
            }
          }
        }
        // Ensure stable order by DISCIPLINES
        const order: Record<string, number> = Object.fromEntries(DISCIPLINES.map((d, i) => [d.code, i]));
        entries.sort((a, b) => (order[a.discipline] ?? 999) - (order[b.discipline] ?? 999));
        setBestEntries(entries);
      } else {
        setBestEntries([]);
      }
    }
  }, [user]);

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
    const next = DISCIPLINES.find(d => !used.has(d.code));
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

  const handleAvatarUpdate = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
      // Se lo slug è già stato assegnato (immutabile), impedisci modifica o rimozione lato client
      if (user?.public_slug) {
        if (!computedSlug || computedSlug.toLowerCase() !== String(user.public_slug).toLowerCase()) {
          toast({ title: 'Slug bloccato', description: 'Lo slug pubblico è già assegnato e non può essere modificato per il momento.', variant: 'destructive' });
          return;
        }
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
        
        {!isMobile && (
          <div className="flex items-center gap-4 mb-8">
            <UserCircle className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">{t('profile.title', 'Il Mio Profilo')}</h1>
              <p className="text-gray-600">{t('profile.subtitle', 'Gestisci le tue informazioni personali')}</p>
            </div>
          </div>
        )}

        {/* Ruolo rimosso su richiesta */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex gap-2 md:grid md:grid-cols-6">
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
              Visibilità
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
                  {/* Sottomenu locale */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Button type="button" variant={!showOrganizer ? 'default' : 'outline'} size="sm" onClick={() => setShowOrganizer(false)}>
                      Elenco Iscrizioni
                    </Button>
                    <Button type="button" variant={showOrganizer ? 'default' : 'outline'} size="sm" onClick={() => setShowOrganizer(true)} disabled={!organizerEligible && user?.role !== 'admin'}>
                      Organizza Evento
                    </Button>
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
                                    {formatEventDate(p.events.date, p.events.end_date)}
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
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        {user?.role === 'admin'
                          ? 'Accesso completo (admin).'
                          : organizerEligible
                            ? 'Hai i requisiti necessari per organizzare. Puoi creare un nuovo evento.'
                            : 'Per organizzare devi attivare il profilo pubblico e compilare le certificazioni obbligatorie.'}
                      </div>
                      {(user?.role === 'admin' || organizerEligible) ? (
                        <div className="flex flex-wrap gap-2">
                          {allenamentiCategory && (
                            <Button 
                              type="button"
                              onClick={handleOpenCreateAllenamento}
                              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                            >
                              <Users className="mr-2 h-4 w-4" /> Crea Allenamento
                            </Button>
                          )}
                          <Button 
                            type="button"
                            onClick={handleOpenCreateEvent}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                          >
                            <PlusCircle className="mr-2 h-4 w-4" /> Crea Evento
                          </Button>
                        </div>
                      ) : null}
                      {!(user?.role === 'admin' || organizerEligible) && (
                        <div className="text-xs text-muted-foreground">Completa le sezioni "Certificazioni" e "Visibilità" per abilitare la creazione.</div>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowOrganizer(false)}>← Torna agli Eventi</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder={t('profile.sections.personal_info.phone_placeholder', 'Es. +39 333 1234567')}
                      />
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
                    <CardTitle>Visibilità</CardTitle>
                    <CardDescription>
                      Rendi visibile una pagina pubblica del tuo profilo su un URL parlante. Puoi scegliere cosa mostrare.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="public_profile_enabled">Attiva profilo pubblico</Label>
                        <p className="text-sm text-muted-foreground">La pagina sarà visibile su /instructor/slug</p>
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
                      <Label htmlFor="public_slug">Slug pubblico</Label>
                      <Input
                        id="public_slug"
                        value={formData.public_slug}
                        onChange={(e) => setFormData(prev => ({ ...prev, public_slug: slugify(e.target.value) }))}
                        placeholder="es. nome-cognome"
                        disabled={!formData.public_profile_enabled || Boolean(user?.public_slug)}
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-muted-foreground">URL: /instructor/{formData.public_slug || '<slug>'}</p>
                        {formData.public_profile_enabled && !user?.public_slug && (
                          slugStatus === 'checking' ? (
                            <span className="text-xs text-blue-600">Verifica disponibilità...</span>
                          ) : slugStatus === 'available' ? (
                            <span className="text-xs text-green-600">Disponibile</span>
                          ) : slugStatus === 'taken' ? (
                            <span className="text-xs text-red-600">Non disponibile</span>
                          ) : slugStatus === 'error' ? (
                            <span className="text-xs text-amber-600">Impossibile verificare ora (server non raggiungibile)</span>
                          ) : null
                        )}
                        {formData.public_profile_enabled && formData.public_slug && (
                          <>
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/instructor/${formData.public_slug}`}>Apri profilo pubblico</Link>
                            </Button>
                            <Button
                              size="sm"
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const url = `${window.location.origin}/instructor/${formData.public_slug}`;
                                navigator.clipboard.writeText(url).then(() => {
                                  toast({ title: 'Link copiato', description: 'URL del profilo pubblico copiato negli appunti.' });
                                }).catch(() => {
                                  toast({ title: 'Impossibile copiare', description: 'Copia manualmente questo URL: ' + url });
                                });
                              }}
                            >
                              Copia link
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_events">Mostra Eventi</Label>
                          <p className="text-xs text-muted-foreground">Rende visibile la sezione Eventi nella pagina pubblica</p>
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
                          <Label htmlFor="public_show_personal">Mostra Personali</Label>
                          <p className="text-xs text-muted-foreground">Bio, Instagram e info aziendali (se presenti)</p>
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
                          <Label htmlFor="public_show_certifications">Mostra Certificazioni</Label>
                          <p className="text-xs text-muted-foreground">Brevetto e assicurazione</p>
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
                          <Label htmlFor="public_show_records">Mostra Record</Label>
                          <p className="text-xs text-muted-foreground">Record personali dalla sezione "Record"</p>
                        </div>
                        <Switch
                          id="public_show_records"
                          checked={formData.public_show_records}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_records: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>
                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_bio">Mostra biografia</Label>
                          <p className="text-xs text-muted-foreground">La tua bio nella pagina pubblica</p>
                        </div>
                        <Switch
                          id="public_show_bio"
                          checked={formData.public_show_bio}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_bio: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_instagram">Mostra Instagram</Label>
                          <p className="text-xs text-muted-foreground">Link al profilo Instagram</p>
                        </div>
                        <Switch
                          id="public_show_instagram"
                          checked={formData.public_show_instagram}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_instagram: Boolean(v) }))}
                          disabled={!formData.public_profile_enabled}
                        />
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <Label htmlFor="public_show_company_info">Mostra info aziendali</Label>
                          <p className="text-xs text-muted-foreground">Indirizzo e P.IVA (solo aziende)</p>
                        </div>
                        <Switch
                          id="public_show_company_info"
                          checked={formData.public_show_company_info}
                          onCheckedChange={(v) => setFormData(prev => ({ ...prev, public_show_company_info: Boolean(v) }))}
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
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Assicurazione</div>
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
                            <Label htmlFor="numero_assicurazione">Numero assicurazione</Label>
                            <Input
                              id="numero_assicurazione"
                              value={formData.numero_assicurazione}
                              onChange={(e) => handleInputChange('numero_assicurazione', e.target.value)}
                              placeholder="Inserire numero assicurazione"
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
                            Dichiaro di essere istruttore brevettato e di avere una copertura assicurativa in corso di validità
                          </Label>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="medico">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> Certificato medico</div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div>
                          <Label htmlFor="scadenza_certificato_medico">{t('profile.sections.certifications.medical_expiry_label', 'Scadenza Certificato Medico')}</Label>
                          <DatePicker
                            date={formData.scadenza_certificato_medico ? new Date(formData.scadenza_certificato_medico) : undefined}
                            onDateChange={(date) => handleInputChange('scadenza_certificato_medico', toLocalDateString(date))}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="brevetto">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> Brevetto (opzionale)</div>
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
                            <Label htmlFor="didattica_brevetto">Didattica brevetto</Label>
                            <Input
                              id="didattica_brevetto"
                              value={formData.didattica_brevetto}
                              onChange={(e) => handleInputChange('didattica_brevetto', e.target.value)}
                              placeholder="Inserire didattica brevetto"
                            />
                          </div>
                          <div>
                            <Label htmlFor="numero_brevetto">Numero brevetto</Label>
                            <Input
                              id="numero_brevetto"
                              value={formData.numero_brevetto}
                              onChange={(e) => handleInputChange('numero_brevetto', e.target.value)}
                              placeholder="Inserire numero brevetto"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 mt-4">
                          <Label>Foto brevetto</Label>
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
                            Dichiaro di essere istruttore certificato con BREVETTO in corso di validità
                          </Label>
                        </div>
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
                    {bestEntries.length < DISCIPLINES.length && (
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
                          const d = DISCIPLINES.find(d => d.code === entry.discipline);
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
                                  {DISCIPLINES.map(d => (
                                    <SelectItem key={d.code} value={d.code} disabled={used.has(d.code)}>
                                      {d.label}
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
