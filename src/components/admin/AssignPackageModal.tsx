
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { assignPackageAsAdmin, type PackageType } from "@/lib/packages-api";
import type { AdminUser } from "@/lib/admin-users-api";

interface AssignPackageModalProps {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
}

const organizerPackages = [
  { id: 'entry', name: 'Entry Package', duration: 1 },
  { id: 'startup', name: 'Startup Package', duration: 3 },
  { id: 'premium', name: 'Premium Package', duration: 12 },
];

const sponsorPackages = [
  { id: 'partner', name: 'Partner Sponsor', duration: 6 },
  { id: 'main-sponsor', name: 'Main Sponsor', duration: 12 },
];

const AssignPackageModal = ({ user, open, onClose }: AssignPackageModalProps) => {
  const [packageType, setPackageType] = useState<PackageType>('organizer');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const queryClient = useQueryClient();

  const assignPackageMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPackage) {
        throw new Error('Dati mancanti per l\'assegnazione del pacchetto');
      }

      const packages = packageType === 'organizer' ? organizerPackages : sponsorPackages;
      const packageData = packages.find(p => p.id === selectedPackage);
      
      if (!packageData) {
        throw new Error('Pacchetto non trovato');
      }

      const duration = customDuration ? parseInt(customDuration) : packageData.duration;
      
      return await assignPackageAsAdmin(
        user.id,
        packageType,
        packageData.id,
        packageData.name,
        duration
      );
    },
    onSuccess: () => {
      toast.success("Pacchetto assegnato con successo");
      queryClient.invalidateQueries({ queryKey: ['admin-user-packages'] });
      queryClient.invalidateQueries({ queryKey: ['user-packages'] });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const resetForm = () => {
    setPackageType('organizer');
    setSelectedPackage('');
    setCustomDuration('');
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const currentPackages = packageType === 'organizer' ? organizerPackages : sponsorPackages;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Assegna Pacchetto a {user?.profile?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="package-type">Tipo Pacchetto</Label>
            <Select value={packageType} onValueChange={(value: PackageType) => {
              setPackageType(value);
              setSelectedPackage('');
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organizer">Organizzatore</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="package">Pacchetto</Label>
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un pacchetto" />
              </SelectTrigger>
              <SelectContent>
                {currentPackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} ({pkg.duration} mesi)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">Durata Personalizzata (mesi)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="Lascia vuoto per durata standard"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              min="1"
              max="24"
            />
            <p className="text-sm text-gray-500">
              Lascia vuoto per usare la durata standard del pacchetto
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annulla
          </Button>
          <Button 
            onClick={() => assignPackageMutation.mutate()}
            disabled={!selectedPackage || assignPackageMutation.isPending}
          >
            {assignPackageMutation.isPending ? 'Assegnazione...' : 'Assegna Pacchetto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignPackageModal;
