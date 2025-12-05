import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CreditCard } from "lucide-react";
import { startCheckout } from "@/lib/payments-api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { backendConfig } from "@/lib/backendConfig";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventPaymentButtonProps {
  eventId: string;
  eventTitle: string;
  eventCost: number;
  disabled?: boolean;
  isFull?: boolean;
  className?: string;
  organizerId?: string | null;
}

export const EventPaymentButton = ({ 
  eventId, 
  eventTitle, 
  eventCost, 
  disabled = false,
  isFull = false,
  className = "",
  organizerId = null
}: EventPaymentButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: myParticipations } = useQuery({
    queryKey: ["me", "participations"],
    queryFn: async () => {
      const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
      const res = await fetch(`${backendConfig.apiBaseUrl || ''}/api/me/participations`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return [] as Array<{ event_id: string }>; // silenzioso
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const isAlreadyRegistered = useMemo(() => {
    return Array.isArray(myParticipations) && myParticipations.some((p: any) => p.event_id === eventId);
  }, [myParticipations, eventId]);
  const isOrganizer = useMemo(() => {
    return Boolean(user?.id && organizerId && user.id === organizerId);
  }, [user?.id, organizerId]);

  const handlePayment = async () => {
  if (!user) {
      // Reindirizza alla pagina di login se l'utente non è autenticato
      navigate('/auth');
      return;
    }

    // Blocca lato UI se l'evento è pieno
    if (isFull) {
      toast.error(t('events.slots_full', 'Posti esauriti per questo evento.'));
      return;
    }

    setIsLoading(true);
    try {
      // Controlla SEMPRE i campi profilo obbligatori (sia eventi a pagamento che gratuiti)
      const missing: string[] = [];
      const today = new Date();
      const isEmpty = (v?: string | null) => !v || String(v).trim() === '';
      if (isEmpty(user.phone)) missing.push(t('profile.fields.phone', 'Telefono'));
      if (isEmpty(user.assicurazione)) missing.push(t('profile.fields.insurance', 'Assicurazione'));
      const sa = user.scadenza_assicurazione ? new Date(user.scadenza_assicurazione) : null;
      const sc = user.scadenza_certificato_medico ? new Date(user.scadenza_certificato_medico) : null;
      if (!sa || isNaN(sa.getTime()) || sa < today) missing.push(t('profile.fields.insurance_expiry', 'Scadenza assicurazione'));
      if (!sc || isNaN(sc.getTime()) || sc < today) missing.push(t('profile.fields.medical_cert_expiry', 'Scadenza certificato medico'));
      // Richiedi anche il tipo di certificato medico (agonistico/non_agonistico)
      const tipo = (user as any).certificato_medico_tipo as string | null | undefined;
      if (!tipo || !['agonistico', 'non_agonistico'].includes(String(tipo))) {
        missing.push(t('profile.fields.medical_cert_type', 'Tipo certificato medico'));
      }
      if (missing.length) {
        setMissingFields(missing);
        setShowProfileModal(true);
        setIsLoading(false);
        return;
      }

      if (eventCost > 0) {
        // Pagamenti non ancora abilitati: mostra messaggio informativo
        toast.info('Il pagamento online non è ancora disponibile. Per iscriverti, contatta l\'organizzatore.');
        return;
      } else {
        // Evento gratuito - iscrizione diretta tramite API
        const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
        const res = await fetch(`${backendConfig.apiBaseUrl || ''}/api/events/${encodeURIComponent(eventId)}/register-free`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
          const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.error === 'Event is not free') {
            toast.error(t('events.event_not_free', 'Questo evento non è gratuito.'));
          } else if (data?.error === 'Event not found') {
            toast.error(t('events.event_not_found', 'Evento non trovato.'));
          } else if (data?.error === 'profile_incomplete') {
            const miss = Array.isArray(data?.missing) ? data.missing : [];
            const map: Record<string,string> = {
              phone: t('profile.fields.phone', 'Telefono'),
              assicurazione: t('profile.fields.insurance', 'Assicurazione'),
              scadenza_assicurazione: t('profile.fields.insurance_expiry', 'Scadenza assicurazione'),
              scadenza_certificato_medico: t('profile.fields.medical_cert_expiry', 'Scadenza certificato medico'),
                certificato_medico_tipo: t('profile.fields.medical_cert_type', 'Tipo certificato medico'),
            };
            const human = miss.map((k:string)=> map[k] || k);
            setMissingFields(human);
            setShowProfileModal(true);
          } else if (data?.error === 'Login required') {
            navigate('/auth');
            return;
          } else {
            toast.error(t('events.registration_error', 'Impossibile completare l\'iscrizione.'));
          }
          return;
        }
        // Aggiorna immediatamente lo stato UI e la cache delle partecipazioni
        try {
          queryClient.setQueryData<Array<{ event_id: string }>>(
            ["me", "participations"],
            (prev) => {
              const arr = Array.isArray(prev) ? prev.slice() : [];
              if (!arr.some(p => p.event_id === eventId)) {
                arr.push({ event_id: eventId });
              }
              return arr;
            }
          );
        } catch (_) {
          // Ignora eventuali errori di aggiornamento cache: l'iscrizione è comunque avvenuta
        }
        setJustRegistered(true);
        toast.success(t('events.registration_success', 'Iscrizione completata!'));
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error(t('events.payment_error', 'Errore nel processo di pagamento'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Button 
      onClick={handlePayment}
      disabled={disabled || isLoading || isAlreadyRegistered || justRegistered || isFull || isOrganizer}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('common.loading', 'Caricamento...')}
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {isFull
            ? t('events.full', 'Completo')
            : (isAlreadyRegistered || justRegistered)
              ? t('events.enrolled', 'Iscritto')
              : (isOrganizer
                  ? t('events.organizer', 'Organizzatore')
                  : t('events.register', 'Iscriviti'))}
        </>
      )}
    </Button>

    <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.complete_profile', 'Completa il tuo profilo')}</DialogTitle>
          <DialogDescription>
            {t('profile.complete_profile_desc', 'Per procedere al pagamento, completa i seguenti campi del profilo:')}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 space-y-1">
          {missingFields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={() => setShowProfileModal(false)}>{t('common.close', 'Chiudi')}</Button>
          <Button onClick={() => { setShowProfileModal(false); navigate('/profile'); }}>{t('common.go_to_profile', 'Vai al profilo')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};