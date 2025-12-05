import { useState } from "react";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiSend } from "@/lib/apiClient";
import { Mail, Send } from "lucide-react";

const Contattaci = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot anti-spam
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({ title: t('contact.missing_fields_title', 'Campi mancanti'), description: t('contact.missing_fields_desc', 'Compila nome, email e messaggio.'), variant: "destructive" });
      return false;
    }
    const emailOk = /.+@.+\..+/.test(email.trim());
    if (!emailOk) {
      toast({ title: t('contact.invalid_email_title', 'Email non valida'), description: t('contact.invalid_email_desc', 'Inserisci un indirizzo email valido.'), variant: "destructive" });
      return false;
    }
    if (message.trim().length < 10) {
      toast({ title: t('contact.short_message_title', 'Messaggio troppo breve'), description: t('contact.short_message_desc', 'Aggiungi qualche dettaglio in più.'), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (hp) return; // bot
    setLoading(true);
    try {
      await apiSend('/api/contact', 'POST', { name: name.trim(), email: email.trim(), message: message.trim() });
      toast({ title: t('contact.sent_title', 'Messaggio inviato'), description: t('contact.sent_desc', 'Ti risponderemo al più presto.') });
      setName(""); setEmail(""); setMessage("");
    } catch (err: any) {
      toast({ title: t('contact.error_title', 'Invio non riuscito'), description: err?.message || t('contact.error_desc', 'Riprova più tardi.'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      {/* Hero con topbar e header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 pointer-events-none" />
        <PageTopBar className="relative z-10" fallbackPath="/" label={t('not_found.back_home', 'Torna alla Home')} />
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-10 md:pt-14 pb-4">
          <PageHeader
            title={t('contact.page_title', 'Contattaci')}
            subtitle={t('contact.page_subtitle', 'Hai domande, suggerimenti o vuoi collaborare con noi? Scrivici!')}
          />
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-xl border border-white/30">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">{t('contact.name_label', 'Nome')}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contact.name_placeholder', 'Il tuo nome')} />
              </div>
              <div>
                <Label htmlFor="email">{t('contact.email_label', 'Email')}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contact.email_placeholder', 'nome@esempio.com')} />
              </div>
            </div>
            <div>
              <Label htmlFor="message">{t('contact.message_label', 'Messaggio')}</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder={t('contact.message_placeholder', 'Come possiamo aiutarti?')} />
            </div>
            {/* Honeypot */}
            <input type="text" value={hp} onChange={(e)=>setHp(e.target.value)} className="hidden" tabIndex={-1} aria-hidden="true" />
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center text-sm text-muted-foreground gap-2">
                <Mail className="h-4 w-4 text-purple-600" />
                <span>{t('contact.response_time', 'Rispondiamo in 24-48 ore lavorative')}</span>
              </div>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600">
                <Send className="h-4 w-4 mr-2" /> {loading ? t('contact.sending', 'Invio…') : t('contact.send_button', 'Invia')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return isMobile ? <MobileLayout>{content}</MobileLayout> : <Layout>{content}</Layout>;
};

export default Contattaci;
