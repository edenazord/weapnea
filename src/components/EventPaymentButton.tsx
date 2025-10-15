import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CreditCard } from "lucide-react";
import { startCheckout } from "@/lib/payments-api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { backendConfig } from "@/lib/backendConfig";
import { getPublicConfig } from "@/lib/publicConfig";
import { useQuery } from "@tanstack/react-query";

interface EventPaymentButtonProps {
  eventId: string;
  eventTitle: string;
  eventCost: number;
  disabled?: boolean;
  className?: string;
}

export const EventPaymentButton = ({ 
  eventId, 
  eventTitle, 
  eventCost, 
  disabled = false,
  className = ""
}: EventPaymentButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  // null = sconosciuto; evita testo con prezzo fino a quando non carichiamo la config
  const [eventsFree, setEventsFree] = useState<boolean | null>(null);
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

  useEffect(() => {
    let mounted = true;
    getPublicConfig().then(cfg => { if (mounted) setEventsFree(Boolean(cfg.eventsFreeMode)); }).catch(() => { if (mounted) setEventsFree(null); });
    return () => { mounted = false; };
  }, []);

  const handlePayment = async () => {
  if (!user) {
      // Reindirizza alla pagina di login se l'utente non è autenticato
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
  if (!eventsFree && eventCost > 0) {
        // Gating lato UI: campi profilo obbligatori per eventi a pagamento
        const missing: string[] = [];
        const today = new Date();
        const isEmpty = (v?: string | null) => !v || String(v).trim() === '';
        if (isEmpty(user.phone)) missing.push('Telefono');
        if (isEmpty(user.assicurazione)) missing.push('Assicurazione');
        const sa = user.scadenza_assicurazione ? new Date(user.scadenza_assicurazione) : null;
        const sc = user.scadenza_certificato_medico ? new Date(user.scadenza_certificato_medico) : null;
        if (!sa || isNaN(sa.getTime()) || sa < today) missing.push('Scadenza assicurazione');
        if (!sc || isNaN(sc.getTime()) || sc < today) missing.push('Scadenza certificato medico');
        if (missing.length) {
          setMissingFields(missing);
          setShowProfileModal(true);
          setIsLoading(false);
          return;
        }

        const { url } = await startCheckout({
          kind: 'event',
          id: eventId,
          title: eventTitle,
          amount: eventCost,
        });
        window.location.href = url;
        toast.success("Reindirizzamento al pagamento...");
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
            toast.error('Questo evento non è gratuito.');
          } else if (data?.error === 'Event not found') {
            toast.error('Evento non trovato.');
          } else if (data?.error === 'Login required') {
            navigate('/auth');
            return;
          } else {
            toast.error('Impossibile completare l\'iscrizione.');
          }
          return;
        }
        toast.success('Iscrizione completata!');
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Errore nel processo di pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Button 
      onClick={handlePayment}
      disabled={disabled || isLoading || isAlreadyRegistered}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Caricamento...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          {isAlreadyRegistered
            ? 'Già iscritto'
            : (eventsFree === false && eventCost > 0 ? `Iscriviti - €${eventCost.toFixed(2)}` : 'Iscriviti Gratis')}
        </>
      )}
    </Button>

    <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completa il tuo profilo</DialogTitle>
          <DialogDescription>
            Per procedere al pagamento, completa i seguenti campi del profilo:
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 space-y-1">
          {missingFields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={() => setShowProfileModal(false)}>Chiudi</Button>
          <Button onClick={() => { setShowProfileModal(false); navigate('/profile'); }}>Vai al profilo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};