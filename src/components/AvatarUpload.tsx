
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiSend } from "@/lib/apiClient";
import { useToast } from "@/components/ui/use-toast";
import { Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { backendConfig } from "@/lib/backendConfig";

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarUpdate: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, onAvatarUpdate }: AvatarUploadProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Devi selezionare un\'immagine da caricare.');
      }

      const file = event.target.files[0];
      
      // API mode: carica file e aggiorna profilo
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;
      const res = await fetch(`${backendConfig.apiBaseUrl || ''}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed ${res.status}`);
      const data = await res.json();
      const avatarUrl = data.url as string;
      await apiSend('/api/profile', 'PUT', { avatar_url: avatarUrl });
      onAvatarUpdate(avatarUrl);
      await refreshProfile();
      
      toast({
        title: "Avatar aggiornato",
        description: "La tua immagine del profilo è stata aggiornata con successo.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare l'immagine. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploading(true);

      console.log('Removing avatar for user:', user?.id);
  await apiSend('/api/profile', 'PUT', { avatar_url: null });
  onAvatarUpdate('');
  await refreshProfile();
      
      toast({
        title: "Avatar rimosso",
        description: "La tua immagine del profilo è stata rimossa.",
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere l'immagine. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={currentAvatarUrl} />
        <AvatarFallback className="text-2xl">
          {user?.email?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative">
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Button variant="outline" size="sm" disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Caricando..." : "Carica Foto"}
          </Button>
        </div>
        
        {currentAvatarUrl && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={removeAvatar}
            disabled={uploading}
          >
            <X className="h-4 w-4 mr-2" />
            Rimuovi
          </Button>
        )}
      </div>
      
      <p className="text-xs text-gray-500 text-center">
        Formati supportati: JPG, PNG. Dimensione massima: 2MB
      </p>
      <p className="text-xs text-gray-400 text-center">
        Dimensioni raccomandate: 400×400 px (quadrata)
      </p>
    </div>
  );
}
