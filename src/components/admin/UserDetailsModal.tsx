
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";
import { AdminUser, UserRole } from "@/lib/admin-users-api";

type UserDetailsModalProps = {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSave: (userId: string, profileData: Partial<AdminUser['profile']>) => void;
};

const UserDetailsModal = ({ user, open, onClose, onSave }: UserDetailsModalProps) => {
  const [editedProfile, setEditedProfile] = useState<Partial<AdminUser['profile']>>({});
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    if (user?.profile) {
      setEditedProfile(user.profile);
      setIsEditing(false);
    }
  }, [user]);

  const handleSave = () => {
    if (user?.id) {
      onSave(user.id, editedProfile);
      setIsEditing(false);
    }
  };

  const handleFieldChange = (field: keyof AdminUser['profile'], value: any) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Dettagli Utente
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Salva
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Annulla
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)} size="sm">
                  Modifica
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar e Info Base */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profile?.avatar_url || ''} />
              <AvatarFallback className="text-lg">
                {user.profile?.full_name?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                {user.profile?.full_name || 'Nome non disponibile'}
              </h3>
              <p className="text-gray-600">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={user.profile?.is_active !== false ? "default" : "secondary"}>
                  {user.profile?.is_active !== false ? "Attivo" : "Disattivato"}
                </Badge>
                <Badge variant="outline">
                  {user.profile?.role === 'admin' ? 'Amministratore' :
                   user.profile?.role === 'blogger' ? 'Blogger' :
                   user.profile?.role === 'instructor' ? 'Istruttore' :
                   user.profile?.role === 'company' ? 'Azienda' : 'Utente Finale'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Informazioni Account */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">ID Utente</Label>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">{user.id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Email</Label>
              <p className="text-sm">{user.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Data Registrazione</Label>
              <p className="text-sm">{new Date(user.created_at).toLocaleDateString('it-IT')}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Ultimo Accesso</Label>
              <p className="text-sm">
                {user.last_sign_in_at 
                  ? new Date(user.last_sign_in_at).toLocaleDateString('it-IT')
                  : 'Mai'
                }
              </p>
            </div>
          </div>

          {/* Informazioni Profilo Modificabili */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold border-b pb-2">Informazioni Profilo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Nome Completo</Label>
                {isEditing ? (
                  <Input
                    id="full_name"
                    value={editedProfile.full_name || ''}
                    onChange={(e) => handleFieldChange('full_name', e.target.value)}
                  />
                ) : (
                  <p className="text-sm p-2 bg-gray-50 rounded">
                    {user.profile?.full_name || 'Non specificato'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="role">Ruolo</Label>
                {isEditing ? (
                  <Select
                    value={editedProfile.role || 'final_user'}
                    onValueChange={(value: UserRole) => handleFieldChange('role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final_user">Utente Finale</SelectItem>
                      <SelectItem value="instructor">Istruttore</SelectItem>
                      <SelectItem value="company">Azienda</SelectItem>
                      <SelectItem value="blogger">Blogger</SelectItem>
                      <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm p-2 bg-gray-50 rounded">
                    {user.profile?.role === 'admin' ? 'Amministratore' :
                     user.profile?.role === 'blogger' ? 'Blogger' :
                     user.profile?.role === 'instructor' ? 'Istruttore' :
                     user.profile?.role === 'company' ? 'Azienda' : 'Utente Finale'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="company_name">Nome Azienda</Label>
                {isEditing ? (
                  <Input
                    id="company_name"
                    value={editedProfile.company_name || ''}
                    onChange={(e) => handleFieldChange('company_name', e.target.value)}
                  />
                ) : (
                  <p className="text-sm p-2 bg-gray-50 rounded">
                    {user.profile?.company_name || 'Non specificato'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="vat_number">Partita IVA</Label>
                {isEditing ? (
                  <Input
                    id="vat_number"
                    value={editedProfile.vat_number || ''}
                    onChange={(e) => handleFieldChange('vat_number', e.target.value)}
                  />
                ) : (
                  <p className="text-sm p-2 bg-gray-50 rounded">
                    {user.profile?.vat_number || 'Non specificato'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="company_address">Indirizzo Azienda</Label>
              {isEditing ? (
                <Input
                  id="company_address"
                  value={editedProfile.company_address || ''}
                  onChange={(e) => handleFieldChange('company_address', e.target.value)}
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">
                  {user.profile?.company_address || 'Non specificato'}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="avatar_url">URL Avatar</Label>
              {isEditing ? (
                <Input
                  id="avatar_url"
                  value={editedProfile.avatar_url || ''}
                  onChange={(e) => handleFieldChange('avatar_url', e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              ) : (
                <p className="text-sm p-2 bg-gray-50 rounded">
                  {user.profile?.avatar_url || 'Non specificato'}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;
