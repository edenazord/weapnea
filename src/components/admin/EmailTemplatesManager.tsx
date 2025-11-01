
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEmailTemplates, updateEmailTemplate, EmailTemplate, seedEmailTemplatesDefaults } from '@/lib/email-templates-api';
import { Mail, Save, Eye, Database } from 'lucide-react';

const EmailTemplatesManager = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const { toast } = useToast();

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getEmailTemplates();
      setTemplates(data);
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

  const handleSave = async (template: EmailTemplate) => {
    setSaving(template.id);
    try {
      await updateEmailTemplate(template.template_type, {
        subject: template.subject,
        html_content: template.html_content,
        is_active: template.is_active,
      });
      
      toast({
        title: 'Successo',
        description: 'Template email aggiornato',
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

  const updateTemplate = (index: number, field: keyof EmailTemplate, value: any) => {
    setTemplates(prev => prev.map((template, i) => 
      i === index ? { ...template, [field]: value } : template
    ));
  };

  const getTemplateTitle = (type: string) => {
    switch (type) {
      case 'welcome':
        return 'Iscrizione';
      case 'password_reset':
        return 'Recupero Password';
      case 'event_registration_user':
        return 'Iscrizione Evento (Utente)';
      case 'event_registration_organizer':
        return 'Conferma Iscrizione (Organizzatore)';
      default:
        return type;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Mail className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Gestione Template Email</h2>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nessun template trovato</CardTitle>
            <CardDescription>
              Puoi caricare i template predefiniti per iniziare: Iscrizione, Recupero Password, Iscrizione Evento (Utente), Conferma Iscrizione (Organizzatore)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                setSeeding(true);
                const res = await seedEmailTemplatesDefaults();
                if (res) {
                  const n = (res && (res.count ?? res.inserted)) ?? null;
                  toast({ title: 'Template creati', description: n ? `${n} template caricati` : 'Template predefiniti caricati' });
                  await loadTemplates();
                } else {
                  toast({ title: 'Errore', description: 'Impossibile caricare i template predefiniti', variant: 'destructive' });
                }
                setSeeding(false);
              }}
              disabled={seeding}
            >
              <Database className="h-4 w-4 mr-2" />
              {seeding ? 'Caricamento...' : 'Carica template predefiniti'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="welcome" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          {templates.map((template) => (
            <TabsTrigger key={template.template_type} value={template.template_type}>
              {getTemplateTitle(template.template_type)}
            </TabsTrigger>
          ))}
        </TabsList>

        {templates.map((template, index) => (
          <TabsContent key={template.template_type} value={template.template_type}>
            <Card>
              <CardHeader>
                <CardTitle>{getTemplateTitle(template.template_type)}</CardTitle>
                <CardDescription>
                  Personalizza il template per le email di {getTemplateTitle(template.template_type).toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => updateTemplate(index, 'is_active', checked)}
                  />
                  <Label>Template attivo</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`subject-${template.template_type}`}>Oggetto</Label>
                  <Input
                    id={`subject-${template.template_type}`}
                    value={template.subject}
                    onChange={(e) => updateTemplate(index, 'subject', e.target.value)}
                    placeholder="Oggetto dell'email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`content-${template.template_type}`}>Contenuto HTML</Label>
                  <Textarea
                    id={`content-${template.template_type}`}
                    value={template.html_content}
                    onChange={(e) => updateTemplate(index, 'html_content', e.target.value)}
                    placeholder="Contenuto HTML dell'email"
                    rows={10}
                  />
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Preview functionality could be implemented here
                      toast({
                        title: 'Info',
                        description: 'Funzionalità di anteprima in sviluppo',
                      });
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Anteprima
                  </Button>

                  <Button
                    variant="brand"
                    onClick={() => handleSave(template)}
                    disabled={saving === template.id}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving === template.id ? 'Salvataggio...' : 'Salva'}
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
