import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const API = backendConfig.apiBaseUrl;
const getToken = () => localStorage.getItem('api_token') || '';

interface EventInviteProps {
  eventId: string;
  eventTitle: string;
}

export default function EventInvite({ eventId, eventTitle }: EventInviteProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const addEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      toast.error(t('invite.invalid_email', 'Email non valida'));
      return;
    }
    if (emails.includes(trimmed)) {
      toast.error(t('invite.duplicate_email', 'Email già aggiunta'));
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    }
  };

  const parseBulk = () => {
    const parsed = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && isValidEmail(s));
    const unique = [...new Set([...emails, ...parsed])];
    setEmails(unique);
    setBulkText('');
    setBulkMode(false);
    if (parsed.length > 0) {
      toast.success(t('invite.bulk_added', `${parsed.length} email aggiunte`));
    }
  };

  const handleSend = async () => {
    if (emails.length === 0) {
      toast.error(t('invite.no_emails', 'Aggiungi almeno un indirizzo email'));
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ emails }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          t('invite.sent_success', `Inviti inviati: ${data.sent} su ${data.total}`)
        );
        setEmails([]);
        setOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Errore');
      }
    } catch {
      toast.error(t('invite.network_error', 'Errore di rete'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          {t('invite.button', 'Invita partecipanti')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('invite.title', 'Invita partecipanti')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('invite.description', 'Invia un\'email di invito all\'evento')}{' '}
            <strong>{eventTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Email list */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Single email input */}
          {!bulkMode && (
            <div className="space-y-1.5">
              <Label>{t('invite.email_label', 'Indirizzo email')}</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="nome@esempio.com"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addEmail}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('invite.hint', 'Premi Invio o virgola per aggiungere')}
              </p>
            </div>
          )}

          {/* Bulk mode */}
          {bulkMode && (
            <div className="space-y-1.5">
              <Label>{t('invite.bulk_label', 'Incolla più email')}</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={t('invite.bulk_placeholder', 'Incolla email separate da virgola, punto e virgola o a capo')}
                rows={5}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={parseBulk}>
                  {t('invite.bulk_add', 'Aggiungi tutte')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setBulkMode(false); setBulkText(''); }}>
                  {t('common.cancel', 'Annulla')}
                </Button>
              </div>
            </div>
          )}

          {!bulkMode && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setBulkMode(true)}
            >
              {t('invite.bulk_toggle', 'Incolla più email contemporaneamente')}
            </button>
          )}

          {/* Send button */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {emails.length} {emails.length === 1 ? 'destinatario' : 'destinatari'}
            </span>
            <Button
              onClick={handleSend}
              disabled={sending || emails.length === 0}
              className="gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending
                ? t('invite.sending', 'Invio in corso...')
                : t('invite.send', 'Invia inviti')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
