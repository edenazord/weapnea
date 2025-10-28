
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Euro, Image as ImageIcon, Target } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventWithCategory } from "@/lib/api";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { buildFriendlyEventPath } from "@/lib/seo-utils";
import { localizeCategoryName } from "@/lib/i18n-utils";
import { getPublicConfig } from "@/lib/publicConfig";

interface EventCardProps {
  event: EventWithCategory;
  variant?: "compact" | "full";
  formatDate?: (dateString: string) => string;
}

const EventCard = ({ event, variant = "full", formatDate }: EventCardProps) => {
  const [imageError, setImageError] = useState(false);
  // null = sconosciuto (evita lampeggio del prezzo prima di caricare la config)
  const [eventsFree, setEventsFree] = useState<boolean | null>(null);
  const { t } = useLanguage();
  
  const handleImageError = () => {
    console.log('Image failed to load for event:', event.title, 'URL:', event.image_url);
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  const imageUrl = ensureAbsoluteUrl(event.image_url);
  const showImage = imageUrl && !imageError;

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
  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200 bg-white/90 backdrop-blur-sm border-0 shadow-md min-h-event-card h-full flex flex-col">
      {showImage && (
        <div className="relative h-32 overflow-hidden flex-shrink-0">
          <img
            src={imageUrl}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          {/* Badge 'Gratuito' rimosso in free mode */}
        </div>
      )}
      
      {!showImage && (
        <div className="h-32 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
          <ImageIcon className="h-12 w-12 text-gray-400" />
        </div>
      )}

      <CardHeader className="pb-2 flex-shrink-0">
        <div className="space-y-2">
      {event.categories && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full w-fit">
        {localizeCategoryName(event.categories.name, t)}
            </Badge>
          )}
          <CardTitle className="text-base font-semibold text-gray-900 leading-tight line-clamp-2">
            {event.title}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 space-y-2 flex-1 flex flex-col">
        {event.description && variant === "full" && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        <div className="space-y-1 flex-1">
          {event.date && (
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
            {event.participants && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span>{event.participants} {t('events.participants', 'partecipanti')}</span>
              </div>
            )}

            {eventsFree === false && event.cost && event.cost > 0 && (
              <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                <Euro className="h-4 w-4 flex-shrink-0" />
                <span>{event.cost}</span>
              </div>
            )}
          </div>
        </div>

  <Link to={buildFriendlyEventPath(event.slug)} className="block mt-2">
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
