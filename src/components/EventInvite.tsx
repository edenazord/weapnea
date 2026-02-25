import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const API = backendConfig.apiBaseUrl;
const getToken = () => localStorage.getItem('api_token') || '';

interface EventInviteProps {
  eventId: string;
  eventTitle: string;
  /** Controlled open state from parent */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EventInvite({ eventId, eventTitle, open, onOpenChange }: EventInviteProps) {
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error(t('invite.invalid_email', 'Inserisci un indirizzo email valido'));
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
        body: JSON.stringify({ emails: [trimmed] }),
      });
      if (res.ok) {
        toast.success(t('invite.sent_success', 'Invito inviato!'));
        setEmail('');
        onOpenChange(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-5 w-5" />
            {t('invite.title', 'Invita partecipante')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <strong>{eventTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t('invite.email_label', 'Email')}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="nome@esempio.com"
              autoFocus
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !email.trim()}
            className="w-full gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending
              ? t('invite.sending', 'Invio in corso...')
              : t('invite.send', 'Invita')
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
