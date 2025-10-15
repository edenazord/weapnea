import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
// import { supabase } from "@/integrations/supabase/client";
import { apiSend } from "@/lib/apiClient";
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
import { UserCircle, FileText, Calendar, Shield, Building, Heart } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
// import ProfileMobileNav from "@/components/ProfileMobileNav";

type PersonalBest = {
  static_apnea?: string;
  dynamic_apnea?: string;
  free_immersion?: string;
  constant_weight?: string;
};

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

  const [personalBest, setPersonalBest] = useState({
    static_apnea: "",
    dynamic_apnea: "",
    free_immersion: "",
    constant_weight: "",
  });

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
        const pb = user.personal_best as PersonalBest;
        setPersonalBest({
          static_apnea: pb.static_apnea || "",
          dynamic_apnea: pb.dynamic_apnea || "",
          free_immersion: pb.free_immersion || "",
          constant_weight: pb.constant_weight || "",
        });
      }
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonalBestChange = (field: string, value: string) => {
    setPersonalBest(prev => ({ ...prev, [field]: value }));
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
        personal_best: personalBest,
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
              {/* Eventi */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.sections.my_events.title', 'I Miei Eventi')}</CardTitle>
                  <CardDescription>
                    {t('profile.sections.my_events.description', 'Gestisci i tuoi eventi')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button asChild variant="outline" className="h-24 flex-col">
                      <Link to="/my-events">
                        <Calendar className="h-8 w-8 mb-2" />
                        <span className="font-semibold">{t('profile.sections.my_events.participated_button', 'Eventi Partecipati')}</span>
                        <span className="text-sm text-gray-500">{t('profile.sections.my_events.participated_sub', 'Cronologia eventi')}</span>
                      </Link>
                    </Button>
                  </div>
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
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="static_apnea">{t('profile.sections.personal_bests.static_apnea_label', 'Apnea Statica (minuti:secondi)')}</Label>
                      <Input
                        id="static_apnea"
                        value={personalBest.static_apnea}
                        onChange={(e) => handlePersonalBestChange('static_apnea', e.target.value)}
                        placeholder={t('profile.sections.personal_bests.static_apnea_placeholder', 'es. 4:30')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dynamic_apnea">{t('profile.sections.personal_bests.dynamic_apnea_label', 'Apnea Dinamica (metri)')}</Label>
                      <Input
                        id="dynamic_apnea"
                        value={personalBest.dynamic_apnea}
                        onChange={(e) => handlePersonalBestChange('dynamic_apnea', e.target.value)}
                        placeholder={t('profile.sections.personal_bests.dynamic_apnea_placeholder', 'es. 75')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="free_immersion">{t('profile.sections.personal_bests.free_immersion_label', 'Immersione Libera (metri)')}</Label>
                      <Input
                        id="free_immersion"
                        value={personalBest.free_immersion}
                        onChange={(e) => handlePersonalBestChange('free_immersion', e.target.value)}
                        placeholder={t('profile.sections.personal_bests.free_immersion_placeholder', 'es. 30')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="constant_weight">{t('profile.sections.personal_bests.constant_weight_label', 'Peso Costante (metri)')}</Label>
                      <Input
                        id="constant_weight"
                        value={personalBest.constant_weight}
                        onChange={(e) => handlePersonalBestChange('constant_weight', e.target.value)}
                        placeholder={t('profile.sections.personal_bests.constant_weight_placeholder', 'es. 45')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {user.role === 'company' && (
              <TabsContent value="company">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('profile.sections.company.title', 'Informazioni Azienda')}</CardTitle>
                    <CardDescription>
                      {t('profile.sections.company.description', 'Gestisci i dati della tua azienda')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {renderCompanyFields()}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {user.role === 'company' && (
              <TabsContent value="sponsor">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('profile.sections.sponsor.title', 'Pacchetti Sponsor')}</CardTitle>
                    <CardDescription>
                      {t('profile.sections.sponsor.description', 'Scopri i nostri pacchetti di sponsorizzazione')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-600">
                      {t('profile.sections.sponsor.cta_text', 'Aumenta la visibilità della tua azienda sponsorizzando eventi di apnea.')}
                    </p>
                    <Button asChild className="w-full">
                      <Link to="/sponsor-packages">
                        {t('profile.sections.sponsor.cta_button', 'Scopri i Pacchetti Sponsor')}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

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
