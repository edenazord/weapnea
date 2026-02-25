import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Upload, Trash2, Loader2, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ensureAbsoluteUrl } from '@/lib/utils';

const API = backendConfig.apiBaseUrl;
const getToken = () => localStorage.getItem('api_token') || '';

interface MediaItem {
  id: string;
  event_id: string;
  uploader_id: string;
  url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  uploader_name?: string;
  uploader_avatar?: string;
}

interface EventMediaGalleryProps {
  eventId: string;
  isParticipant?: boolean;
  isOwner?: boolean;
}

export default function EventMediaGallery({ eventId, isParticipant, isOwner }: EventMediaGalleryProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 10;

  // Lightbox navigation helpers
  const goPrev = () => {
    if (media.length === 0) return;
    setLightboxIndex((i) => (i - 1 + media.length) % media.length);
  };
  const goNext = () => {
    if (media.length === 0) return;
    setLightboxIndex((i) => (i + 1) % media.length);
  };
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, media.length]);

  const canUpload = user && (isParticipant || isOwner || user.role === 'admin' || user.role === 'creator');

  const fetchMedia = async () => {
    try {
      const res = await fetch(`${API}/api/events/${eventId}/media`);
      if (res.ok) setMedia(await res.json());
    } catch (e) {
      console.error('Failed to fetch event media', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMedia(); }, [eventId]);

  const handleUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of fileArray) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('media_type', file.type.startsWith('video/') ? 'video' : 'image');
        const res = await fetch(`${API}/api/events/${eventId}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: fd,
        });
        if (res.ok) {
          const item = await res.json();
          setMedia((prev) => [item, ...prev]);
          successCount++;
        } else {
          const err = await res.json();
          toast.error(err.error || `Errore upload: ${file.name}`);
          failCount++;
        }
      } catch (e) {
        toast.error(`Errore di rete: ${file.name}`);
        failCount++;
      }
    }
    if (successCount > 0) {
      toast.success(successCount === 1
        ? t('media.uploaded', 'File caricato!')
        : t('media.uploaded_multi', `${successCount} file caricati!`));
    }
    setUploading(false);
  };

  const handleDelete = async (mediaId: string) => {
    try {
      const res = await fetch(`${API}/api/events/${eventId}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== mediaId));
        toast.success(t('media.deleted', 'File eliminato'));
      }
    } catch (e) {
      toast.error('Errore');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (media.length === 0 && !canUpload) return null;

  return (
    <Card className="shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-blue-900">
            {t('media.community_gallery', 'Foto & Video della Community')}
            {media.length > 0 && <span className="text-gray-400 font-normal text-sm ml-1">({media.length})</span>}
          </h2>
        </div>
        {canUpload && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ImagePlus className="w-4 h-4 mr-1" />}
              {t('media.upload', 'Carica')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) handleUpload(files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {media.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{t('media.empty', 'Nessuna foto ancora. Condividi la tua esperienza!')}</p>
          <p className="text-xs text-gray-300 mt-1">Dimensioni raccomandate: 1200×800 px. Video max 100 MB.</p>
          {canUpload && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 text-blue-600"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" />
              {t('media.upload_first', 'Carica la prima foto')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {media.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((item, idx) => {
              const url = ensureAbsoluteUrl(item.url);
              const realIndex = (page - 1) * ITEMS_PER_PAGE + idx;
              return (
                <div key={item.id} className="group relative overflow-hidden rounded-lg border border-gray-200">
                  {item.media_type === 'video' ? (
                    <video
                      src={url}
                      className="w-full h-24 object-cover cursor-pointer"
                      onClick={() => { setLightboxIndex(realIndex); setLightboxOpen(true); }}
                    />
                  ) : (
                    <img
                      src={url}
                      alt={item.caption || 'Event photo'}
                      className="w-full h-24 object-cover cursor-zoom-in"
                      onClick={() => { setLightboxIndex(realIndex); setLightboxOpen(true); }}
                    />
                  )}
                  {/* Overlay with uploader info + delete */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={item.uploader_avatar || undefined} />
                          <AvatarFallback className="text-[8px]">{item.uploader_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-white text-[10px] truncate max-w-[80px]">{item.uploader_name}</span>
                      </div>
                      {user && (user.id === item.uploader_id || isOwner || user.role === 'admin') && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 rounded-full bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {media.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center gap-1 mt-4">
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.ceil(media.length / ITEMS_PER_PAGE) }, (_, i) => (
                <Button
                  key={i + 1}
                  size="sm"
                  variant={page === i + 1 ? 'default' : 'ghost'}
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page === Math.ceil(media.length / ITEMS_PER_PAGE)} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Lightbox with navigation */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="w-screen max-w-[95vw] p-0 bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">{t('media.community_gallery', 'Foto & Video della Community')}</DialogTitle>
          <div className="relative w-screen h-screen flex items-center justify-center">
            {media[lightboxIndex] && (
              media[lightboxIndex].media_type === 'video' ? (
                <video
                  src={ensureAbsoluteUrl(media[lightboxIndex].url)}
                  controls
                  autoPlay
                  className="max-h-[90vh] max-w-[95vw] object-contain drop-shadow-2xl"
                />
              ) : (
                <img
                  src={ensureAbsoluteUrl(media[lightboxIndex].url)}
                  alt={media[lightboxIndex].caption || `Foto ${lightboxIndex + 1}`}
                  className="max-h-[90vh] max-w-[95vw] object-contain drop-shadow-2xl"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                />
              )
            )}
            {/* Bottom controls: prev | counter | next */}
            {media.length > 0 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 text-white">
                {media.length > 1 && (
                  <button
                    type="button"
                    aria-label="Precedente"
                    className="p-2 rounded-full bg-black/40 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    onClick={goPrev}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div className="bg-black/40 px-3 py-1 rounded-full text-sm text-white/90 tabular-nums">
                  {lightboxIndex + 1} / {media.length}
                </div>
                {media.length > 1 && (
                  <button
                    type="button"
                    aria-label="Successiva"
                    className="p-2 rounded-full bg-black/40 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                    onClick={goNext}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
