import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink, Calendar, Euro, Phone } from "lucide-react";
import { getEventParticipants, EventParticipant } from "@/lib/payments-api";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";

interface EventParticipantsModalProps {
  eventId: string;
  eventTitle: string;
  participantCount?: number;
}

export const EventParticipantsModal = ({ 
  eventId, 
  eventTitle, 
  participantCount = 0 
}: EventParticipantsModalProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: participants, isLoading, error } = useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: () => getEventParticipants(eventId),
    enabled: isOpen, // Solo carica quando il modal è aperto
  });

  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string') return '?';
    try {
      return name
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';
    } catch {
      return '?';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-blue-50"
          title={`Vedi partecipanti: ${participantCount} iscritti`}
        >
          <Users className="h-4 w-4 text-blue-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Partecipanti
          </DialogTitle>
          <p className="text-sm text-gray-600">
            {eventTitle}
          </p>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm">Errore nel caricamento</p>
            </div>
          ) : !participants || participants.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nessun partecipante</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participants.map((participant: EventParticipant) => (
                <div 
                  key={participant.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={participant.avatar_url} />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {getInitials(participant.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">
                        {participant.full_name}
                      </h4>
                      {participant.role === 'instructor' && participant.public_profile_enabled && participant.public_slug ? (
                        <Link 
                          to={`/instructor/${participant.public_slug}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Vedi profilo pubblico"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                    
                    {participant.company_name && (
                      <p className="text-xs text-gray-500 truncate">
                        {participant.company_name}
                      </p>
                    )}

                    {participant.phone && (
                      <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {participant.phone}
                      </p>
                    )}
                    
                    {participant.amount ? (
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          <Euro className="h-3 w-3 mr-1" />
                          €{Number(participant.amount || 0).toFixed(2)}
                        </Badge>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {participant.paid_at ? format(new Date(participant.paid_at), "dd MMM yy", { locale: it }) : ''}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {participants && participants.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Totale partecipanti:</span>
              <span className="font-medium">{participants.length}</span>
            </div>
            {participants.some(p => p.amount) && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Ricavo totale:</span>
                <span className="font-medium text-green-600">
                  €{participants.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};