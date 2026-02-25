import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Trash2, Loader2, ImagePlus, Video, X } from 'lucide-react';
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (file: File) => {
    setUploading(true);
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
        toast.success(t('media.uploaded', 'File caricato!'));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Errore upload');
      }
    } catch (e) {
      toast.error('Errore di rete');
    } finally {
      setUploading(false);
    }
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
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((item) => {
            const url = ensureAbsoluteUrl(item.url);
            return (
              <div key={item.id} className="group relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all">
                {item.media_type === 'video' ? (
                  <video src={url} className="w-full h-32 md:h-40 object-cover" controls />
                ) : (
                  <img
                    src={url}
                    alt={item.caption || 'Event photo'}
                    className="w-full h-32 md:h-40 object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                    onClick={() => setLightboxUrl(url)}
                  />
                )}
                {/* Overlay with uploader info + delete */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={item.uploader_avatar || undefined} />
                        <AvatarFallback className="text-[8px]">{item.uploader_name?.charAt(0) || '?'}</AvatarFallback>
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
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl bg-black/95 border-none p-2">
          <DialogTitle className="sr-only">Foto</DialogTitle>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-3 right-3 text-white/70 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Full size" className="max-h-[85vh] max-w-full mx-auto object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
