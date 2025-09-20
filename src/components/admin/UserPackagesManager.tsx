
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { getAllUserPackages, cancelPackage, type UserPackage } from "@/lib/packages-api";

const UserPackagesManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: userPackages = [], isLoading } = useQuery({
    queryKey: ['admin-user-packages'],
    queryFn: getAllUserPackages,
  });

  const cancelPackageMutation = useMutation({
    mutationFn: cancelPackage,
    onSuccess: () => {
      toast.success("Pacchetto cancellato con successo");
      queryClient.invalidateQueries({ queryKey: ['admin-user-packages'] });
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const filteredPackages = userPackages.filter(pkg => {
    const userName = pkg.user_profile?.full_name || pkg.user_id;
    const matchesSearch = pkg.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || pkg.status === statusFilter;
    const matchesType = typeFilter === "all" || pkg.package_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'expired': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Attivo';
      case 'expired': return 'Scaduto';
      case 'cancelled': return 'Cancellato';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'organizer': return 'Organizzatore';
      case 'sponsor': return 'Sponsor';
      default: return type;
    }
  };

  if (isLoading) {
    return <div>Caricamento pacchetti utenti...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri Pacchetti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca per nome pacchetto o ID utente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtra per stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attivo</SelectItem>
                <SelectItem value="expired">Scaduto</SelectItem>
                <SelectItem value="cancelled">Cancellato</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtra per tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="organizer">Organizzatore</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{userPackages.length}</div>
            <p className="text-sm text-gray-600">Pacchetti Totali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {userPackages.filter(pkg => pkg.status === 'active').length}
            </div>
            <p className="text-sm text-gray-600">Pacchetti Attivi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {userPackages.filter(pkg => pkg.package_type === 'organizer').length}
            </div>
            <p className="text-sm text-gray-600">Organizzatori</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {userPackages.filter(pkg => pkg.package_type === 'sponsor').length}
            </div>
            <p className="text-sm text-gray-600">Sponsor</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella Pacchetti */}
      <Card>
        <CardHeader>
          <CardTitle>Gestione Pacchetti Utenti ({filteredPackages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utente</TableHead>
                  <TableHead>Pacchetto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data Inizio</TableHead>
                  <TableHead>Data Scadenza</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div className="font-medium">
                        {pkg.user_profile?.full_name || `${pkg.user_id.slice(0, 8)}...`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{pkg.package_name}</span>
                      </div>
                      <div className="text-sm text-gray-500">ID: {pkg.package_id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(pkg.package_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(pkg.status)}>
                        {getStatusLabel(pkg.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">
                          {new Date(pkg.starts_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pkg.expires_at ? (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">
                            {new Date(pkg.expires_at).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Nessuna scadenza</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        {pkg.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelPackageMutation.mutate(pkg.id)}
                            disabled={cancelPackageMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserPackagesManager;
