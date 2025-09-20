import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Heart, MapPin, Users, Clock, Edit, Trash2, Eye } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Link } from "react-router-dom";
import { apiGet, apiSend } from "@/lib/apiClient";
import { toast } from "sonner";

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

interface WishlistItem {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  events: Event;
}

// mock rimossi

const MyEvents = () => {
  const { user } = useAuth();
  const [participations, setParticipations] = useState<EventParticipation[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [ownedEvents, setOwnedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const isOrganizer = user?.role === 'company' || user?.role === 'instructor';
  const isAdmin = user?.role === 'admin';

  const fetchUserEvents = useCallback(async () => {
    try {
      setLoading(true);
      // Participations
      const participationsData = await apiGet('/api/me/participations');
      setParticipations(Array.isArray(participationsData) ? participationsData : []);

      // Wishlist
      const wishlistData = await apiGet('/api/me/wishlist');
      setWishlist(Array.isArray(wishlistData) ? wishlistData : []);

      // Owned/Admin events
      if (isAdmin) {
        const eventsData = await apiGet('/api/me/events?all=true');
        setOwnedEvents(Array.isArray(eventsData) ? eventsData : []);
      } else if (isOrganizer && user?.id) {
        const eventsData = await apiGet('/api/me/events');
        setOwnedEvents(Array.isArray(eventsData) ? eventsData : []);
      }
    } catch (error) {
      console.error('Error fetching user events:', error);
      toast.error('Errore nel caricamento degli eventi');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isOrganizer, user?.id]);

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
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton fallbackPath="/profile" label="Torna al Profilo" />
        </div>

        <div className="flex items-center gap-4 mb-8">
          <Calendar className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">I Miei Eventi</h1>
            <p className="text-gray-600">Gestisci i tuoi eventi e la tua wishlist</p>
          </div>
        </div>

        <Tabs defaultValue="participations" className="space-y-6">
          <TabsList className={`grid w-full ${isOrganizer || isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="participations">
              <Users className="h-4 w-4 mr-2" />
              Eventi Partecipati
            </TabsTrigger>
            <TabsTrigger value="wishlist">
              <Heart className="h-4 w-4 mr-2" />
              Wishlist
            </TabsTrigger>
            {(isOrganizer || isAdmin) && (
              <TabsTrigger value="owned">
                <Calendar className="h-4 w-4 mr-2" />
                {isAdmin ? 'Tutti gli Eventi' : 'I Miei Eventi'}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="participations">
            <Card>
              <CardHeader>
                <CardTitle>Eventi a cui hai partecipato</CardTitle>
                <CardDescription>
                  Cronologia completa delle tue partecipazioni agli eventi
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
                              {participation.events.date}
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
                          <Badge variant={participation.status === 'confirmed' ? 'default' : 'secondary'}>
                            {participation.status}
                          </Badge>
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
                      Nessun evento partecipato
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Non hai ancora partecipato a nessun evento.
                    </p>
                    <Button asChild>
                      <Link to="/">Scopri gli eventi</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist">
            <Card>
              <CardHeader>
                <CardTitle>La tua Wishlist</CardTitle>
                <CardDescription>
                  Eventi che hai salvato per partecipare in futuro
                </CardDescription>
              </CardHeader>
              <CardContent>
                {wishlist.length > 0 ? (
                  <div className="grid gap-4">
                    {wishlist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {item.events.image_url && (
                            <img 
                              src={item.events.image_url} 
                              alt={item.events.title}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          )}
                          <div>
                            <h3 className="font-semibold">{item.events.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-4 w-4" />
                              {item.events.date}
                              {item.events.location && (
                                <>
                                  <MapPin className="h-4 w-4 ml-2" />
                                  {item.events.location}
                                </>
                              )}
                            </div>
                            {item.events.cost && (
                              <div className="text-sm font-medium text-primary mt-1">
                                €{item.events.cost}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/events/${item.events.slug}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizza
                            </Link>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                await apiSend(`/api/me/wishlist/${item.id}`, 'DELETE');
                                toast.success('Evento rimosso dalla wishlist');
                                fetchUserEvents();
                              } catch (e) {
                                toast.error('Errore durante la rimozione dalla wishlist');
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      La tua wishlist è vuota
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Non hai ancora salvato nessun evento nella tua wishlist.
                    </p>
                    <Button asChild>
                      <Link to="/">Scopri gli eventi</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {(isOrganizer || isAdmin) && (
            <TabsContent value="owned">
              <Card>
                <CardHeader>
                  <CardTitle>{isAdmin ? 'Tutti gli Eventi' : 'I Miei Eventi'}</CardTitle>
                  <CardDescription>
                    {isAdmin ? 'Gestisci tutti gli eventi della piattaforma' : 'Gestisci i tuoi eventi organizzati'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ownedEvents.length > 0 ? (
                    <div className="grid gap-4">
                      {ownedEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            {event.image_url && (
                              <img 
                                src={event.image_url} 
                                alt={event.title}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            )}
                            <div>
                              <h3 className="font-semibold">{event.title}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Calendar className="h-4 w-4" />
                                {event.date}
                                {event.location && (
                                  <>
                                    <MapPin className="h-4 w-4 ml-2" />
                                    {event.location}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                {event.cost && (
                                  <div className="text-sm font-medium text-primary">
                                    €{event.cost}
                                  </div>
                                )}
                                {event.participants && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    {event.participants} partecipanti
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* azioni evento */}
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/events/${event.slug}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Visualizza
                              </Link>
                            </Button>
                            <>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">
                        {isAdmin ? 'Nessun evento presente' : 'Non hai ancora creato eventi'}
                      </h3>
                      <p className="text-gray-500 mb-6">
                        {isAdmin ? 'Non ci sono eventi sulla piattaforma.' : 'Inizia a creare i tuoi primi eventi per i partecipanti.'}
                      </p>
                      {!isAdmin && (
                        <Button asChild>
                          <Link to="/dashboard">Crea Evento</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default MyEvents;
