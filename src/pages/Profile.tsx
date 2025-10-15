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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserCircle, FileText, Calendar, Shield, Building, Users, MapPin, Eye } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
// import ProfileMobileNav from "@/components/ProfileMobileNav";
import { format, parseISO, isValid } from "date-fns";
import { it as itLocale } from "date-fns/locale";

type BestDiscipline = 'STA' | 'DYN' | 'DYNB' | 'DNF' | 'FIM' | 'CWT' | 'CWTB' | 'CNF' | 'VWT' | 'NLT';
type BestEntry = { discipline: BestDiscipline; value: string };
type PersonalBest = Record<string, string> | BestEntry[];

const DISCIPLINES: { code: BestDiscipline; label: string; hint: string }[] = [
  { code: 'STA', label: 'Apnea Statica', hint: 'mm:ss' },
  { code: 'DYN', label: 'Apnea Dinamica', hint: 'metri' },
  { code: 'DYNB', label: 'Apnea Dinamica Bipinne', hint: 'metri' },
  { code: 'DNF', label: 'Apnea Dinamica senza pinne', hint: 'metri' },
  { code: 'FIM', label: 'Free Immersion', hint: 'metri' },
  { code: 'CWT', label: 'Peso Costante (monopinna)', hint: 'metri' },
  { code: 'CWTB', label: 'Peso Costante (bipinne)', hint: 'metri' },
  { code: 'CNF', label: 'Costante senza pinne', hint: 'metri' },
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
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    brevetto: "",
    scadenza_brevetto: "",
    scadenza_certificato_medico: "",
    assicurazione: "",
    scadenza_assicurazione: "",
    instagram_contact: "",
  phone: "",
    avatar_url: "",
    company_name: "",
    vat_number: "",
    company_address: "",
  });

  const [bestEntries, setBestEntries] = useState<BestEntry[]>([]);

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

  const formatEventDate = (start?: string, end?: string) => {
    if (start) {
      const s = parseISO(start);
      if (isValid(s)) {
        if (end) {
          const e = parseISO(end);
          if (isValid(e) && e.getTime() !== s.getTime()) {
            return `${format(s, 'dd/MM/yyyy', { locale: itLocale })} - ${format(e, 'dd/MM/yyyy', { locale: itLocale })}`;
          }
        }
        return format(s, 'dd/MM/yyyy', { locale: itLocale });
      }
    }
    return t('events.date_tbd', 'Data da definire');
  };

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        bio: user.bio || "",
        brevetto: user.brevetto || "",
        scadenza_brevetto: user.scadenza_brevetto || "",
        scadenza_certificato_medico: user.scadenza_certificato_medico || "",
        assicurazione: user.assicurazione || "",
        scadenza_assicurazione: user.scadenza_assicurazione || "",
  instagram_contact: user.instagram_contact || "",
  phone: (user as any).phone || "",
        avatar_url: user.avatar_url || "",
        company_name: user.company_name || "",
        vat_number: user.vat_number || "",
        company_address: user.company_address || "",
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
          for (const [k, v] of Object.entries(pb)) {
            const code = (mapLegacy[k] || k) as BestDiscipline;
            if ((DISCIPLINES as any).some((d: any) => d.code === code) && v) {
              entries.push({ discipline: code, value: String(v) });
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

  const handleAvatarUpdate = (url: string) => {
    setFormData(prev => ({ ...prev, avatar_url: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const dataToUpdate = {
        ...formData,
        scadenza_brevetto: formData.scadenza_brevetto || null,
        scadenza_certificato_medico: formData.scadenza_certificato_medico || null,
        scadenza_assicurazione: formData.scadenza_assicurazione || null,
        bio: formData.bio || null,
        brevetto: formData.brevetto || null,
        assicurazione: formData.assicurazione || null,
        instagram_contact: formData.instagram_contact || null,
        phone: formData.phone || null,
        company_name: formData.company_name || null,
        vat_number: formData.vat_number || null,
        company_address: formData.company_address || null,
        personal_best: (() => {
          // Save as object { CODE: value }, keeping legacy keys for the classic four for backward compatibility
          const obj: Record<string, string> = {};
          for (const e of bestEntries) {
            if (e.value && e.discipline) obj[e.discipline] = e.value;
          }
          // Legacy aliasing
          if (obj['STA'] !== undefined) obj['static_apnea'] = obj['STA'];
          if (obj['DYN'] !== undefined) obj['dynamic_apnea'] = obj['DYN'];
          if (obj['FIM'] !== undefined) obj['free_immersion'] = obj['FIM'];
          if (obj['CWT'] !== undefined) obj['constant_weight'] = obj['CWT'];
          return obj;
        })(),
      };

  const res = await apiSend('/api/profile', 'PUT', dataToUpdate);
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
        description: t('profile.toasts.update_error_desc', "Si è verificato un errore nell'aggiornare il profilo."),
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
    <div className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
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
          <TabsList className="w-full overflow-x-auto flex gap-2 md:grid md:grid-cols-4">
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
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.sections.my_events.title', 'I Miei Eventi')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.my_events.description', 'Gestisci i tuoi eventi')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingParticipations ? (
                    <div className="py-8 text-center text-gray-500">{t('common.loading', 'Caricamento...')}</div>
                  ) : participations.length > 0 ? (
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
                              <Link to={`/events/${p.events.slug}`}>
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

            <TabsContent value="certs">
              <Card>
                  <CardHeader>
                  <CardTitle>{t('profile.sections.certifications.title', 'Certificazioni e Assicurazioni')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.certifications.description', 'Mantieni aggiornate le tue certificazioni. Per iscriversi agli eventi a pagamento sono obbligatori: Telefono, Assicurazione e relative scadenze, Certificato medico valido.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="brevetto">{t('profile.sections.certifications.brevetto_label', 'Brevetto')}</Label>
                      <Select
                        value={formData.brevetto}
                        onValueChange={(value) => handleInputChange('brevetto', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('profile.sections.certifications.brevetto_placeholder', 'Seleziona brevetto')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('profile.sections.certifications.brevetto_options.none', 'Nessun brevetto')}</SelectItem>
                          <SelectItem value="open_water">{t('profile.sections.certifications.brevetto_options.open_water', 'Open Water')}</SelectItem>
                          <SelectItem value="advanced">{t('profile.sections.certifications.brevetto_options.advanced', 'Advanced')}</SelectItem>
                          <SelectItem value="rescue">{t('profile.sections.certifications.brevetto_options.rescue', 'Rescue')}</SelectItem>
                          <SelectItem value="master">{t('profile.sections.certifications.brevetto_options.master', 'Master')}</SelectItem>
                          <SelectItem value="instructor">{t('profile.sections.certifications.brevetto_options.instructor', 'Instructor')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="scadenza_brevetto">{t('profile.sections.certifications.brevetto_expiry_label', 'Scadenza Brevetto')}</Label>
                      <DatePicker
                        date={formData.scadenza_brevetto ? new Date(formData.scadenza_brevetto) : undefined}
                        onDateChange={(date) => handleInputChange('scadenza_brevetto', date?.toISOString().split('T')[0] || '')}
                      />
                    </div>
                  </div>

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
                        onDateChange={(date) => handleInputChange('scadenza_assicurazione', date?.toISOString().split('T')[0] || '')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="scadenza_certificato_medico">{t('profile.sections.certifications.medical_expiry_label', 'Scadenza Certificato Medico')}</Label>
                    <DatePicker
                      date={formData.scadenza_certificato_medico ? new Date(formData.scadenza_certificato_medico) : undefined}
                      onDateChange={(date) => handleInputChange('scadenza_certificato_medico', date?.toISOString().split('T')[0] || '')}
                    />
                  </div>
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
                  {bestEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('profile.sections.personal_bests.empty', 'Nessun record inserito. Aggiungi il primo!')}</p>
                  )}
                  {bestEntries.map((entry, idx) => {
                    const used = new Set(bestEntries.map((b, i) => i === idx ? undefined : b.discipline));
                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4">
                          <Label>{t('profile.sections.personal_bests.discipline', 'Disciplina')}</Label>
                          <Select value={entry.discipline} onValueChange={(v) => handleBestChange(idx, { discipline: v as BestDiscipline })}>
                            <SelectTrigger>
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
                        </div>
                        <div className="md:col-span-6">
                          <Label>{t('profile.sections.personal_bests.value', 'Valore')}</Label>
                          <Input
                            value={entry.value}
                            onChange={(e) => handleBestChange(idx, { value: e.target.value })}
                            placeholder={(() => {
                              const d = DISCIPLINES.find(d => d.code === entry.discipline);
                              return d?.hint === 'mm:ss' ? t('profile.sections.personal_bests.time_placeholder', 'es. 4:30') : t('profile.sections.personal_bests.meters_placeholder', 'es. 75');
                            })()}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {(() => {
                              const d = DISCIPLINES.find(d => d.code === entry.discipline);
                              return d?.hint === 'mm:ss' ? t('profile.sections.personal_bests.time_hint', 'Formato consigliato: mm:ss') : t('profile.sections.personal_bests.meters_hint', 'Formato consigliato: metri interi (es. 75)');
                            })()}
                          </p>
                        </div>
                        <div className="md:col-span-2 flex gap-2">
                          <Button type="button" variant="destructive" className="w-full" onClick={() => removeBest(idx)}>
                            {t('common.delete', 'Elimina')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {bestEntries.length < DISCIPLINES.length && (
                    <Button type="button" variant="outline" onClick={addBest}>
                      {t('profile.sections.personal_bests.add', 'Aggiungi record')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Company-specific extra content can be added here if needed */}

            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={loading} className="w-full md:w-auto">
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
