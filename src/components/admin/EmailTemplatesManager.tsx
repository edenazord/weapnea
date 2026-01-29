
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiSend } from '@/lib/apiClient';
import { Mail, Save, Globe } from 'lucide-react';

type EmailTemplate = {
  subject: string;
  greeting: string;
  body: string;
  signature: string;
  link_label?: string;
  ignore_notice?: string;
  closing?: string;
  contact_link?: string;
};

type EmailTemplates = {
  [templateType: string]: EmailTemplate;
};

type AllLanguagesTemplates = {
  [lang: string]: EmailTemplates;
};

const TEMPLATE_TYPES = ['welcome', 'password_reset', 'event_registration_user', 'event_registration_organizer'];
const LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

const EmailTemplatesManager = () => {
  const [templates, setTemplates] = useState<AllLanguagesTemplates>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState('it');
  const { toast } = useToast();

  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiGet('/api/email-templates');
      setTemplates(data as AllLanguagesTemplates);
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i template email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSave = async (templateType: string) => {
    const template = templates[selectedLang]?.[templateType];
    if (!template) return;

    setSaving(templateType);
    try {
      await apiSend(`/api/email-templates/lang/${selectedLang}/${templateType}`, 'PUT', template);
      toast({
        title: 'Successo',
        description: `Template "${getTemplateTitle(templateType)}" aggiornato per ${getLangName(selectedLang)}`,
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare il template',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const updateTemplate = (templateType: string, field: keyof EmailTemplate, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        [templateType]: {
          ...prev[selectedLang]?.[templateType],
          [field]: value,
        },
      },
    }));
  };

  const getTemplateTitle = (type: string) => {
    switch (type) {
      case 'welcome':
        return 'Benvenuto / Welcome';
      case 'password_reset':
        return 'Recupero Password';
      case 'event_registration_user':
        return 'Iscrizione Evento (Utente)';
      case 'event_registration_organizer':
        return 'Iscrizione Evento (Organizzatore)';
      default:
        return type;
    }
  };

  const getLangName = (code: string) => {
    return LANGUAGES.find(l => l.code === code)?.name || code;
  };

  const getTemplateFields = (type: string): (keyof EmailTemplate)[] => {
    const baseFields: (keyof EmailTemplate)[] = ['subject', 'greeting', 'body', 'signature'];
    switch (type) {
      case 'password_reset':
        return [...baseFields, 'link_label', 'ignore_notice', 'closing'];
      case 'event_registration_user':
        return [...baseFields, 'contact_link', 'closing'];
      case 'event_registration_organizer':
        return [...baseFields, 'closing'];
      default:
        return baseFields;
    }
  };

  const getFieldLabel = (field: keyof EmailTemplate) => {
    const labels: Record<keyof EmailTemplate, string> = {
      subject: 'Oggetto',
      greeting: 'Saluto iniziale',
      body: 'Corpo del messaggio',
      signature: 'Firma',
      link_label: 'Testo del pulsante',
      ignore_notice: 'Avviso ignora email',
      closing: 'Chiusura',
      contact_link: 'Link contatti',
    };
    return labels[field] || field;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Caricamento...</div>;
  }

  const currentTemplates = templates[selectedLang] || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Gestione Template Email</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedLang} onValueChange={setSelectedLang}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            <strong>Multilingua:</strong> Seleziona la lingua dal menu in alto a destra per modificare i template in quella lingua.
            Le email verranno inviate nella lingua impostata dall'utente.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="welcome" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          {TEMPLATE_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {getTemplateTitle(type).split(' / ')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {TEMPLATE_TYPES.map((templateType) => (
          <TabsContent key={templateType} value={templateType}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getTemplateTitle(templateType)}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({getLangName(selectedLang)})
                  </span>
                </CardTitle>
                <CardDescription>
                  Personalizza il template per le email di {getTemplateTitle(templateType).toLowerCase().split(' / ')[0]}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {getTemplateFields(templateType).map(field => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`${templateType}-${field}`}>{getFieldLabel(field)}</Label>
                    {field === 'body' ? (
                      <Textarea
                        id={`${templateType}-${field}`}
                        value={currentTemplates[templateType]?.[field] || ''}
                        onChange={(e) => updateTemplate(templateType, field, e.target.value)}
                        placeholder={getFieldLabel(field)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        id={`${templateType}-${field}`}
                        value={currentTemplates[templateType]?.[field] || ''}
                        onChange={(e) => updateTemplate(templateType, field, e.target.value)}
                        placeholder={getFieldLabel(field)}
                      />
                    )}
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <Button
                    variant="brand"
                    onClick={() => handleSave(templateType)}
                    disabled={saving === templateType}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving === templateType ? 'Salvataggio...' : 'Salva'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default EmailTemplatesManager;
