
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { backendConfig as cfg } from '@/lib/backendConfig';
import { toast } from 'sonner';
import { Upload, X, Image } from 'lucide-react';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
  onImageRemoved: () => void;
}

export function ImageUpload({ onImageUploaded, currentImageUrl, onImageRemoved }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Il file è troppo grande. La dimensione massima è 5MB.');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato file non supportato. Usa JPEG, PNG o WebP.');
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
      setPreviewUrl(data.url);
      onImageUploaded(data.url);
      toast.success('Immagine caricata con successo!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Errore durante il caricamento dell\'immagine. Riprova.');
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
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-32 h-32 object-cover rounded-lg border"
            onError={(e) => {
              console.error('Error loading image:', previewUrl);
              // If image fails to load, show broken image state
              e.currentTarget.style.display = 'none';
            }}
          />
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
                  {uploading ? 'Caricamento...' : 'Carica Immagine'}
                </span>
              </Button>
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <p className="text-xs text-gray-500">
              JPEG, PNG o WebP (max 5MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
