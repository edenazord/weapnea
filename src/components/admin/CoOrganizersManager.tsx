import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiGet, apiSend } from '@/lib/apiClient';
import { toast } from 'sonner';
import { UserPlus, X, Mail, Check, Clock, XCircle, Loader2 } from 'lucide-react';
import { ensureAbsoluteUrl } from '@/lib/utils';

type CoOrganizer = {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  full_name: string | null;
  avatar_url: string | null;
  public_slug: string | null;
  public_profile_enabled: boolean;
  invited_at: string;
  responded_at: string | null;
};

interface CoOrganizersManagerProps {
  eventId: string;
}

export function CoOrganizersManager({ eventId }: CoOrganizersManagerProps) {
  const [coOrganizers, setCoOrganizers] = useState<CoOrganizer[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadCoOrganizers = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await apiGet(`/api/events/${eventId}/co-organizers`);
      setCoOrganizers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('[CoOrganizers] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadCoOrganizers();
  }, [loadCoOrganizers]);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error('Inserisci un indirizzo email valido');
      return;
    }
    setSending(true);
    try {
      const result = await apiSend(`/api/events/${eventId}/co-organizers/invite`, 'POST', { email: trimmed });
      const res = result as { ok?: boolean; error?: string; message?: string; user_exists?: boolean };
      if (res.ok) {
        toast.success(
          res.user_exists
            ? 'Invito inviato! L\'utente riceverà un\'email per accettare.'
            : 'Invito inviato! L\'utente dovrà registrarsi su WeApnea prima di accettare.'
        );
        setEmail('');
        loadCoOrganizers();
      } else {
        toast.error(res.message || 'Errore nell\'invio dell\'invito');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('already_organizer')) {
        toast.error('Questo utente è già l\'organizzatore principale dell\'evento.');
      } else if (msg.includes('already_coorganizer')) {
        toast.error('Questo utente è già co-organizzatore dell\'evento.');
      } else if (msg.includes('already_invited')) {
        toast.error('Questo utente ha già un invito pendente.');
      } else {
        toast.error('Errore nell\'invio dell\'invito');
      }
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (coOrgId: string) => {
    try {
      await apiSend(`/api/events/${eventId}/co-organizers/${coOrgId}`, 'DELETE');
      toast.success('Co-organizzatore rimosso');
      loadCoOrganizers();
    } catch {
      toast.error('Errore nella rimozione');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge variant="default" className="bg-green-100 text-green-800 text-xs"><Check className="h-3 w-3 mr-1" /> Accettato</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs"><Clock className="h-3 w-3 mr-1" /> In attesa</Badge>;
      case 'declined':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs"><XCircle className="h-3 w-3 mr-1" /> Rifiutato</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-sm">Co-Organizzatori</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Invita uno o più co-organizzatori per email. Appariranno nella pagina dell'evento dopo aver accettato l'invito.
      </p>

      {/* Invite input */}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Email del co-organizzatore..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleInvite}
          disabled={sending || !email.trim()}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
          Invita
        </Button>
      </div>

      {/* List of co-organizers */}
      {loading && <p className="text-xs text-muted-foreground">Caricamento...</p>}
      {!loading && coOrganizers.length > 0 && (
        <div className="space-y-2">
          {coOrganizers.map((co) => (
            <div key={co.id} className="flex items-center gap-3 p-2 rounded-md bg-white border">
              <Avatar className="h-8 w-8">
                <AvatarImage src={ensureAbsoluteUrl(co.avatar_url || undefined) || ''} alt={co.full_name || co.email} />
                <AvatarFallback>{(co.full_name || co.email).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{co.full_name || co.email}</p>
                {co.full_name && <p className="text-xs text-muted-foreground truncate">{co.email}</p>}
              </div>
              {statusBadge(co.status)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={() => handleRemove(co.id)}
                title="Rimuovi"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {!loading && coOrganizers.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nessun co-organizzatore invitato.</p>
      )}
    </div>
  );
}
