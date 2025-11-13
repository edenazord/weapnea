
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Euro, Image as ImageIcon, Target, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventWithCategory } from "@/lib/api";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { buildFriendlyEventPath } from "@/lib/seo-utils";
import { localizeCategoryName } from "@/lib/i18n-utils";
import { getPublicConfig } from "@/lib/publicConfig";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/apiClient";
import { toast } from "sonner";

interface EventCardProps {
  event: EventWithCategory;
  variant?: "compact" | "full";
  formatDate?: (dateString: string) => string;
  showCategoryBadge?: boolean;
}

const EventCard = ({ event, variant = "full", formatDate, showCategoryBadge = true }: EventCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  // null = sconosciuto (evita lampeggio del prezzo prima di caricare la config)
  const [eventsFree, setEventsFree] = useState<boolean | null>(null);
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const handleImageError = () => {
    console.log('Image failed to load for event:', event.title, 'URL:', event.image_url);
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  // Usa immagine principale, altrimenti prima della galleria
  const primary = event.image_url && event.image_url.trim() !== ''
    ? event.image_url
    : (Array.isArray(event.gallery_images) && event.gallery_images.length > 0 ? event.gallery_images[0] : undefined);
  const imageUrl = ensureAbsoluteUrl(primary);
  const showImage = imageUrl && !imageError;

  const eligibleForActions = (() => {
    if (!user) return false;
    const isEmpty = (v?: string | null) => !v || String(v).trim() === '';
    const today = new Date();
    const sa = user.scadenza_assicurazione ? new Date(user.scadenza_assicurazione) : null;
    const sc = user.scadenza_certificato_medico ? new Date(user.scadenza_certificato_medico) : null;
    const tipo = (user as any).certificato_medico_tipo as string | null | undefined;
    const tipoOk = tipo === 'agonistico' || tipo === 'non_agonistico';
    return !isEmpty(user.phone)
      && !isEmpty(user.assicurazione)
      && !!sa && !isNaN(sa.getTime()) && sa >= today
      && !!sc && !isNaN(sc.getTime()) && sc >= today
      && tipoOk;
  })();

  const handleWhatsapp = async () => {
    if (!eligibleForActions) {
      toast.info(t('events.complete_profile_first', 'Per contattare l\'organizzatore completa prima il profilo.'));
      return;
    }
    setContactLoading(true);
    try {
      const res = await apiGet(`/api/events/${encodeURIComponent(event.id)}/organizer-contact`);
      const phone = (res && typeof res === 'object' && 'phone' in res) ? (res as any).phone as string : '';
      if (!phone) {
        toast.error(t('events.organizer_no_phone', 'Contatto organizzatore non disponibile'));
        return;
      }
      const digits = String(phone).replace(/\D+/g, '');
      if (!digits) {
        toast.error(t('events.organizer_no_phone', 'Contatto organizzatore non disponibile'));
        return;
      }
      const text = encodeURIComponent(`Ciao, sono interessato all'evento "${event.title}" su WeApnea.`);
      const url = `https://wa.me/${digits}?text=${text}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(t('events.organizer_contact_error', 'Impossibile recuperare il contatto dell\'organizzatore'));
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    getPublicConfig()
      .then(cfg => { if (mounted) setEventsFree(Boolean(cfg.eventsFreeMode)); })
      .catch(() => { if (mounted) setEventsFree(null); });
    return () => { mounted = false; };
  }, []);

  const formatDiscipline = (discipline: string | null) => {
    if (!discipline) return null;
    switch (discipline) {
      case 'indoor':
        return t('search.disciplines.indoor', 'Indoor');
      case 'outdoor':
        return t('search.disciplines.outdoor', 'Outdoor');
      case 'indoor&outdoor':
        return t('search.disciplines.indoor_outdoor', 'Indoor & Outdoor');
      default:
        return discipline;
    }
  };

  return (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 bg-white/90 backdrop-blur-sm border-0 shadow-md h-[400px] md:h-[440px] flex flex-col">
      {showImage && (
        <div className="relative overflow-hidden flex-shrink-0 aspect-[16/9]">
          <img
            src={imageUrl}
            alt={event.title}
            className="w-full h-full object-cover object-center md:object-[50%_35%] transition-transform duration-200 hover:scale-105"
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          {/* Badge 'Gratuito' rimosso in free mode */}
          {eligibleForActions && (
            <button
              type="button"
              onClick={handleWhatsapp}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-600/90 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Richiedi informazioni su WhatsApp"
              title="Richiedi informazioni"
              disabled={contactLoading}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">{t('events.request_info', 'Richiedi info')}</span>
            </button>
          )}
        </div>
      )}
      
      {!showImage && (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="h-12 w-12 text-gray-400" />
          {/* Overlay WhatsApp anche quando non c'è immagine */}
          {eligibleForActions && (
            <button
              type="button"
              onClick={handleWhatsapp}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-600/90 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Richiedi informazioni su WhatsApp"
              title="Richiedi informazioni"
              disabled={contactLoading}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">{t('events.request_info', 'Richiedi info')}</span>
            </button>
          )}
        </div>
      )}

      <CardHeader className="pb-2 flex-shrink-0">
        <div className="space-y-2">
      {event.categories && showCategoryBadge && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full w-fit">
        {localizeCategoryName(event.categories.name, t)}
            </Badge>
          )}
          <CardTitle className="text-base font-semibold text-gray-900 leading-tight line-clamp-2">
            {event.title}
          </CardTitle>
        </div>
      </CardHeader>

  <CardContent className="pt-0 pb-4 space-y-2 flex-1 flex flex-col overflow-hidden">
        {event.description && variant === "full" && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        <div className="space-y-1 flex-1">
          {/* Se appuntamento ricorrente, mostra la ricorrenza al posto della data */}
          {event.fixed_appointment === true ? (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span>
                {(event.fixed_appointment_text && event.fixed_appointment_text.trim()) || t('events.recurring_label', 'Appuntamento ricorrente')}
              </span>
            </div>
          ) : (
            event.date && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>
                  {formatDate ? formatDate(event.date) : event.date}
                  {event.end_date && event.end_date !== event.date && (
                    <>
                      {" - "}
                      {formatDate ? formatDate(event.end_date) : event.end_date}
                    </>
                  )}
                </span>
              </div>
            )
          )}

          {event.location && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {event.discipline && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Target className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span>{formatDiscipline(event.discipline)}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Partecipanti: mostra x/y dove possibile */}
            {(typeof event.participants === 'number' && event.participants > 0) || (typeof event.participants_paid_count === 'number') ? (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                {typeof event.participants === 'number' && event.participants > 0 && typeof event.participants_paid_count === 'number' ? (
                  <span>
                    {t('events.enrolled_label', 'Iscritti')} {Math.max(0, event.participants_paid_count)} / {event.participants}
                  </span>
                ) : typeof event.participants === 'number' && event.participants > 0 ? (
                  <span>
                    {event.participants} {t('events.participants', 'partecipanti')}
                  </span>
                ) : (
                  <span>
                    {Math.max(0, Number(event.participants_paid_count || 0))} {t('events.enrolled', 'iscritti')}
                  </span>
                )}
              </div>
            ) : null}

            {event.cost != null && Number(event.cost) > 0 && (
              <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                <Euro className="h-4 w-4 flex-shrink-0" />
                <span>€{Number(event.cost).toFixed(2)}</span>
              </div>
            )}
          </div>
    </div>

  <Link to={buildFriendlyEventPath(event.slug)} className="block mt-auto">
          <Button 
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs"
            size="sm"
          >
            {t('events.details', 'Dettagli')}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};

export default EventCard;
