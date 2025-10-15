import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Eye } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link } from "react-router-dom";
import { apiGet } from "@/lib/apiClient";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import Layout from "@/components/Layout";

interface Event {
  id: string;
  title: string;
  description?: string;
  date?: string;
  end_date?: string;
  location?: string;
  image_url?: string;
  cost?: number;
  participants?: number;
  slug: string;
  created_by?: string;
  category_id?: string;
}

interface EventParticipation {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  registered_at: string;
  events: Event;
}

// mock rimossi

const MyEvents = () => {
  const { user } = useAuth();
  const [participations, setParticipations] = useState<EventParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserEvents = useCallback(async () => {
    try {
      setLoading(true);
      // Participations
      const participationsData = await apiGet('/api/me/participations');
      setParticipations(Array.isArray(participationsData) ? participationsData : []);
    } catch (error) {
      console.error('Error fetching user events:', error);
      toast.error('Errore nel caricamento degli eventi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserEvents();
    }
  }, [user, fetchUserEvents]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Devi essere autenticato per visualizzare i tuoi eventi.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Layout>
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton fallbackPath="/profile" label="Torna al Profilo" />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <Calendar className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Eventi a cui sei iscritto</h1>
            <p className="text-gray-600">La lista delle tue iscrizioni agli eventi</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Eventi a cui sei iscritto</CardTitle>
            <CardDescription>
              Cronologia delle tue iscrizioni agli eventi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {participations.length > 0 ? (
              <div className="grid gap-4">
                {participations.map((participation) => (
                  <div key={participation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {participation.events.image_url && (
                        <img 
                          src={participation.events.image_url} 
                          alt={participation.events.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{participation.events.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Calendar className="h-4 w-4" />
                          {formatEventDate(participation.events.date, participation.events.end_date)}
                          {participation.events.location && (
                            <>
                              <MapPin className="h-4 w-4 ml-2" />
                              {participation.events.location}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/events/${participation.events.slug}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Visualizza
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Nessun evento iscritto
                </h3>
                <p className="text-gray-500 mb-6">
                  Non hai ancora effettuato iscrizioni.
                </p>
                <Button asChild>
                  <Link to="/">Scopri gli eventi</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </Layout>
  );
};

function formatEventDate(dateStr?: string, endStr?: string): string {
  if (!dateStr) return '';
  const d = parseISO(String(dateStr));
  const fmt = (dt: Date) => format(dt, 'dd/MM/yyyy', { locale: itLocale });
  if (!isValid(d)) {
    // fallback semplice: primi 10 caratteri o stringa intera
    const base = String(dateStr);
    const a = base.length >= 10 ? base.slice(0, 10) : base;
    if (endStr) {
      const e = String(endStr);
      const b = e.length >= 10 ? e.slice(0, 10) : e;
      return `${a} – ${b}`;
    }
    return a;
  }

  if (endStr) {
    const e = parseISO(String(endStr));
    if (isValid(e)) {
      // range date
      const a = fmt(d);
      const b = fmt(e);
      if (a !== b) return `${a} – ${b}`;
      return a;
    }
  }
  return fmt(d);
}

export default MyEvents;
