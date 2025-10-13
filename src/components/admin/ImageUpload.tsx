
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { backendConfig as cfg } from '@/lib/backendConfig';
import { ensureAbsoluteUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Upload, X, Image } from 'lucide-react';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  onImageRemoved: () => void;
  supportVideo?: boolean;
  maxImageSizeMB?: number;
  maxVideoSizeMB?: number;
}

export function ImageUpload({ onImageUploaded, currentImageUrl, onImageRemoved, supportVideo = false, maxImageSizeMB = 5, maxVideoSizeMB = 100 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

  const isVideoUrl = (url?: string | null) => {
    if (!url) return false;
    return /\.(mp4|webm|mov)$/i.test(url.split('?')[0] || '');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = supportVideo && file.type.startsWith('video/') ? maxVideoSizeMB : maxImageSizeMB;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Il file è troppo grande. Massimo ${maxSize}MB.`);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'].concat(
      supportVideo ? ['video/mp4', 'video/webm', 'video/quicktime'] : []
    );
    if (!allowedTypes.includes(file.type)) {
      toast.error(supportVideo
        ? 'Formato non supportato. Immagini: JPEG, PNG, WebP. Video: MP4, WebM, MOV.'
        : 'Formato file non supportato. Usa JPEG, PNG o WebP.'
      );
      return;
    }

    setUploading(true);

    try {
      // Upload to local API endpoint
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
      const res = await fetch(`${cfg.apiBaseUrl || ''}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed ${res.status}`);
  const data = await res.json();
  const abs = ensureAbsoluteUrl(data.url, cfg.apiBaseUrl) || data.url;
  setPreviewUrl(abs);
  onImageUploaded(abs);
  toast.success('File caricato con successo!');
    } catch (error) {
      console.error('Error uploading image:', error);
  toast.error('Errore durante il caricamento del file. Riprova.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
  // In API mode non eseguiamo delete remota; lasciamo orphan cleanup lato server se necessario
    setPreviewUrl(null);
    onImageRemoved();
  };

  return (
    <div className="space-y-4">
      
      {previewUrl ? (
        <div className="relative inline-block">
          {isVideoUrl(previewUrl) ? (
            <video
              src={ensureAbsoluteUrl(previewUrl, cfg.apiBaseUrl) || ''}
              className="w-48 h-32 object-cover rounded-lg border"
              controls
            />
          ) : (
            <img 
              src={ensureAbsoluteUrl(previewUrl, cfg.apiBaseUrl) || ''} 
              alt="Preview" 
              className="w-32 h-32 object-cover rounded-lg border"
              onError={(e) => {
                console.error('Error loading image:', previewUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="space-y-2">
            <Label htmlFor="image-upload" className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Caricamento...' : (supportVideo ? 'Carica Immagine o Video' : 'Carica Immagine')}
                </span>
              </Button>
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept={supportVideo ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"}
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <p className="text-xs text-gray-500">
              {supportVideo
                ? `Immagini: JPEG, PNG, WebP (max ${maxImageSizeMB}MB). Video: MP4, WebM, MOV (max ${maxVideoSizeMB}MB).`
                : `JPEG, PNG o WebP (max ${maxImageSizeMB}MB)`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
