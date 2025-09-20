import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiSend } from '@/lib/apiClient';
import { UserRole } from '@/lib/admin-users-api';

interface CreateUserFormData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  companyName?: string;
  vatNumber?: string;
  companyAddress?: string;
}

export const CreateUserForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateUserFormData>({
    email: '',
    password: '',
    fullName: '',
    role: 'final_user',
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1) Registra l'utente via API locale (admin deve essere autenticato con token API/JWT)
      const registerRes = await apiSend('/api/auth/register', 'POST', {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        role: formData.role,
      });

      const newUser = registerRes?.user as { id: string; email: string } | undefined;
      if (!newUser?.id) throw new Error('Registrazione fallita');

      // 2) Se ruolo company, aggiorna i dati aziendali sul profilo
      if (formData.role === 'company') {
        await apiSend(`/api/admin/users/${encodeURIComponent(newUser.id)}/profile`, 'PUT', {
          company_name: formData.companyName || null,
          vat_number: formData.vatNumber || null,
          company_address: formData.companyAddress || null,
        });
      }
      
      toast({
        title: "Utente creato con successo",
        description: `L'utente ${newUser.email} è stato creato con il ruolo ${formData.role}`,
      });

      // Reset form
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'final_user',
        companyName: '',
        vatNumber: '',
        companyAddress: '',
      });

    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Errore",
  description: error instanceof Error ? error.message : 'Errore durante la creazione dell\'utente',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Manual User Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Crea Nuovo Utente</CardTitle>
          <CardDescription>
            Crea manualmente un nuovo utente con ruolo specifico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Ruolo</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final_user">Utente Finale</SelectItem>
                    <SelectItem value="company">Azienda</SelectItem>
                    <SelectItem value="instructor">Istruttore</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="blogger">Blogger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.role === 'company' && (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome Azienda</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">Partita IVA</Label>
                    <Input
                      id="vatNumber"
                      value={formData.vatNumber || ''}
                      onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Indirizzo Azienda</Label>
                    <Input
                      id="companyAddress"
                      value={formData.companyAddress || ''}
                      onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creazione in corso...' : 'Crea Utente'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};