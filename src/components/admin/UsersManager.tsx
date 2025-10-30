
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Key, Info, Package } from "lucide-react";
import { toast } from "sonner";
import UserDetailsModal from "./UserDetailsModal";
import AssignPackageModal from "./AssignPackageModal";
import UserStatusDropdown from "./UserStatusDropdown";
import { CreateUserForm } from "./CreateUserForm";
import {
  getAllUsers,
  updateUserRole,
  toggleUserActive,
  generatePasswordResetToken,
  updateUserProfile,
  deleteUser,
  type UserRole,
  type AdminUser
} from "@/lib/admin-users-api";

const UsersManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAllUsers,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success("Ruolo utente aggiornato con successo");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleUserActive(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success("Stato utente aggiornato con successo");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success("Utente eliminato con successo");
    },
    onError: (error) => {
      toast.error(`Errore durante l'eliminazione: ${error.message}`);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ userId, profileData }: { userId: string; profileData: Partial<AdminUser['profile']> }) =>
      updateUserProfile(userId, profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success("Profilo utente aggiornato con successo");
      setIsModalOpen(false);
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: generatePasswordResetToken,
    onSuccess: (token) => {
      navigator.clipboard.writeText(token);
      toast.success("Token di reset password generato e copiato negli appunti");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.profile?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleUserInfoClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleAssignPackageClick = (user: AdminUser) => {
    setSelectedUser(user);
    setIsPackageModalOpen(true);
  };

  const handleProfileSave = (userId: string, profileData: Partial<AdminUser['profile']>) => {
    updateProfileMutation.mutate({ userId, profileData });
  };

  const handleToggleActive = (userId: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ userId, isActive });
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Amministratore';
      case 'blogger': return 'Blogger';
      case 'instructor': return 'Istruttore';
      case 'company': return 'Azienda';
      case 'final_user': return 'Utente Finale';
      default: return role;
    }
  };

  if (isLoading) {
    return <div>Caricamento utenti...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestione Utenti</h2>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Lista Utenti</TabsTrigger>
          <TabsTrigger value="create">Crea Utente</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Filtri */}
          <Card>
            <CardHeader>
              <CardTitle>Filtri Utenti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cerca per nome o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filtra per ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i ruoli</SelectItem>
                    <SelectItem value="admin">Amministratori</SelectItem>
                    <SelectItem value="blogger">Blogger</SelectItem>
                    <SelectItem value="instructor">Istruttori</SelectItem>
                    <SelectItem value="company">Aziende</SelectItem>
                    <SelectItem value="final_user">Utenti Finali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Statistiche */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-sm text-gray-600">Utenti Totali</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.profile?.is_active !== false).length}
                </div>
                <p className="text-sm text-gray-600">Utenti Attivi</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">
                  {users.filter(u => u.profile?.is_active === false).length}
                </div>
                <p className="text-sm text-gray-600">Utenti Disattivati</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.profile?.role === 'admin').length}
                </div>
                <p className="text-sm text-gray-600">Amministratori</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabella Utenti */}
          <Card>
            <CardHeader>
              <CardTitle>Gestione Utenti ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Iscrizione</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Azienda</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.profile?.avatar_url || ''} />
                              <AvatarFallback>
                                {user.profile?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {user.profile?.full_name || 'Nome non disponibile'}
                              </div>
                              <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-700">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.profile?.role || 'final_user'}
                            onValueChange={(role: UserRole) =>
                              updateRoleMutation.mutate({ userId: user.id, role })
                            }
                          >
                            <SelectTrigger className="w-[150px]">
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
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.profile?.is_active !== false ? "default" : "secondary"}
                            className={user.profile?.is_active !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                          >
                            {user.profile?.is_active !== false ? "Attivo" : "Disattivato"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {user.profile?.company_name || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUserInfoClick(user)}
                              title="Visualizza dettagli utente"
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignPackageClick(user)}
                              title="Assegna pacchetto"
                              className="text-purple-600 hover:text-purple-700"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateTokenMutation.mutate(user.id)}
                              title="Genera token reset password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <UserStatusDropdown
                              user={user}
                              onToggleActive={handleToggleActive}
                              onDeleteUser={handleDeleteUser}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <CreateUserForm />
        </TabsContent>
      </Tabs>

      <UserDetailsModal
        user={selectedUser}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleProfileSave}
      />

      <AssignPackageModal
        user={selectedUser}
        open={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
      />
    </div>
  );
};

export default UsersManager;
