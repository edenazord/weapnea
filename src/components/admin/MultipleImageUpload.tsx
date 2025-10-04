
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Upload, Plus } from "lucide-react";
import { toast } from "sonner";
import { backendConfig as cfg } from '@/lib/backendConfig';

interface MultipleImageUploadProps {
  onImagesChanged: (urls: string[]) => void;
  currentImages: string[];
}

export function MultipleImageUpload({ onImagesChanged, currentImages }: MultipleImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadInput, setUploadInput] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} non è un'immagine valida`);
          continue;
        }
        if (cfg.mode === 'api') {
          const form = new FormData();
          form.append('file', file);
          const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
          const res = await fetch(`${cfg.apiBaseUrl || ''}/api/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,
          });
          if (!res.ok) {
            toast.error(`Upload fallito (${res.status}) per ${file.name}`);
            continue;
          }
          const data = await res.json();
          newUrls.push(data.url);
        } else {
          // fallback placeholder
          const url = URL.createObjectURL(file);
          newUrls.push(url);
        }
      }

  // Normalizza eventuali URL relativi restituiti dall'API (es. /public/uploads/..)
  const apiBase = cfg.apiBaseUrl || '';
  const normalized = newUrls.map(u => (u.startsWith('/') ? `${apiBase}${u}` : u));
  const updatedImages = [...currentImages, ...normalized];
      onImagesChanged(updatedImages);
      toast.success(`${newUrls.length} immagini aggiunte con successo!`);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Errore durante il caricamento delle immagini");
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleUrlAdd = () => {
    if (!uploadInput.trim()) return;
    
    if (!uploadInput.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)) {
      toast.error("URL non valido. Deve essere un link diretto a un'immagine (jpg, png, gif, webp)");
      return;
    }

  const apiBase = cfg.apiBaseUrl || '';
  const u = uploadInput.trim();
  const updatedImages = [...currentImages, (u.startsWith('/') ? `${apiBase}${u}` : u)];
    onImagesChanged(updatedImages);
    setUploadInput("");
    toast.success("Immagine aggiunta tramite URL!");
  };

  const removeImage = (index: number) => {
    const updatedImages = currentImages.filter((_, i) => i !== index);
    onImagesChanged(updatedImages);
    toast.success("Immagine rimossa");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <div className="flex space-x-2">
          <Input
            type="url"
            placeholder="Inserisci URL immagine..."
            value={uploadInput}
            onChange={(e) => setUploadInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd()}
          />
          <Button 
            type="button" 
            onClick={handleUrlAdd}
            disabled={!uploadInput.trim()}
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative">
          <Input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentImages.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url.startsWith('/') ? `${cfg.apiBaseUrl || ''}${url}` : url}
                alt={`Galleria ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/placeholder.svg";
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {currentImages.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Nessuna immagine nella galleria
          </p>
          <p className="text-xs text-gray-500">
            Carica file o inserisci URL per aggiungere immagini
          </p>
        </div>
      )}
    </div>
  );
}
