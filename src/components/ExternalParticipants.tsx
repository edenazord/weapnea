import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Trash2, Loader2, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const API = backendConfig.apiBaseUrl;
const getToken = () => localStorage.getItem('api_token') || '';

interface ExternalParticipant {
  id: string;
  event_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  notes?: string;
  invited_at?: string;
  created_at: string;
}

interface ExternalParticipantsProps {
  eventId: string;
}

export default function ExternalParticipants({ eventId }: ExternalParticipantsProps) {
  const { t } = useLanguage();
  const [participants, setParticipants] = useState<ExternalParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', notes: '' });

  const fetchList = async () => {
    try {
      const res = await fetch(`${API}/api/events/${eventId}/external-participants`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setParticipants(await res.json());
    } catch (e) {
      console.error('Failed to fetch external participants', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [eventId]);

  const handleAdd = async () => {
    if (!form.full_name.trim()) return toast.error(t('external.name_required', 'Nome obbligatorio'));
    setAdding(true);
    try {
      const res = await fetch(`${API}/api/events/${eventId}/external-participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const item = await res.json();
        setParticipants((prev) => [...prev, item]);
        setForm({ full_name: '', email: '', phone: '', notes: '' });
        setOpen(false);
        toast.success(
          form.email
            ? t('external.added_with_invite', 'Partecipante aggiunto e email di invito inviata!')
            : t('external.added', 'Partecipante esterno aggiunto!')
        );
      } else {
        const err = await res.json();
        toast.error(err.error || 'Errore');
      }
    } catch (e) {
      toast.error('Errore di rete');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/events/${eventId}/external-participants/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setParticipants((prev) => prev.filter((p) => p.id !== id));
        toast.success(t('external.removed', 'Rimosso'));
      }
    } catch (e) {
      toast.error('Errore');
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" />
          {t('external.title', 'Partecipanti Esterni')}
          {participants.length > 0 && <span className="text-gray-400 font-normal">({participants.length})</span>}
        </h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full text-xs">
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              {t('external.add', 'Aggiungi')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('external.add_title', 'Aggiungi Partecipante Esterno')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">{t('external.name', 'Nome e Cognome')} *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Mario Rossi"
                />
              </div>
              <div>
                <Label className="text-xs">{t('external.email', 'Email')} ({t('external.optional', 'opzionale - invia invito')})</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="mario@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">{t('external.phone', 'Telefono')} ({t('external.optional', 'opzionale')})</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+39 333..."
                />
              </div>
              <div>
                <Label className="text-xs">{t('external.notes', 'Note')}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('external.notes_placeholder', 'Allergie, esigenze...')}
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={adding}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                {form.email
                  ? t('external.add_send_invite', 'Aggiungi e Invia Invito')
                  : t('external.add_only', 'Aggiungi Partecipante')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : participants.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{t('external.none', 'Nessun partecipante esterno aggiunto.')}</p>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-white/60 dark:bg-neutral-800/60 rounded-lg px-3 py-2 border border-gray-100 dark:border-neutral-700">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.full_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    {p.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{p.email}</span>}
                    {p.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{p.phone}</span>}
                    {p.invited_at && <span className="text-green-500">✓ Invitato</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
