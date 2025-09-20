import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Star, Crown } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { activatePackage } from "@/lib/packages-api";
import { startCheckout } from "@/lib/payments-api";

interface SponsorPackage {
  id: string;
  name: string;
  price: number;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

const sponsorPackages: SponsorPackage[] = [
  {
    id: 'partner',
    name: 'Partner',
    price: 450,
    icon: <Star className="h-8 w-8" />,
    features: [
      'Logo sul sito web',
      'Menzione nei social media',
      'Visibilità durante gli eventi',
      'Report di performance'
    ]
  },
  {
    id: 'main-sponsor',
    name: 'Main Sponsor',
    price: 990,
    icon: <Crown className="h-8 w-8" />,
    popular: true,
    features: [
      'Logo prominente sul sito web',
      'Campagne dedicate sui social',
      'Massima visibilità durante gli eventi',
      'Report dettagliato di performance',
      'Spazio espositivo negli eventi',
      'Supporto marketing dedicato'
    ]
  }
];

const SponsorPackages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePaymentSuccess = useCallback(async (packageId: string) => {
    try {
      const packageData = sponsorPackages.find(pkg => pkg.id === packageId);
      if (!packageData) {
        throw new Error("Pacchetto non trovato");
      }

      console.log('Activating sponsor package after successful payment:', packageId);
      
      // Activate the sponsor package in the database (12 months duration for sponsor packages)
      await activatePackage('sponsor', packageId, packageData.name, 12);

      toast({
        title: "Pagamento completato!",
        description: `Il pacchetto di sponsorizzazione ${packageData.name} è stato attivato con successo!`,
      });

      // Clear URL parameters
      window.history.replaceState({}, '', '/sponsor-packages');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);

    } catch (error) {
      console.error('Error activating sponsor package:', error);
      toast({
        title: "Errore nell'attivazione",
        description: "Il pagamento è andato a buon fine, ma c'è stato un problema nell'attivazione del pacchetto. Contatta il supporto.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Check for payment success in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const packageId = urlParams.get('package');
    const canceled = urlParams.get('canceled');

    if (success === 'true' && packageId && user?.id) {
      handlePaymentSuccess(packageId);
    } else if (canceled === 'true') {
      toast({
        title: "Pagamento annullato",
        description: "Il pagamento è stato annullato. Puoi riprovare quando vuoi.",
        variant: "destructive"
      });
      // Clear URL parameters
      window.history.replaceState({}, '', '/sponsor-packages');
    }
  }, [user?.id, handlePaymentSuccess, toast]);

  const handleSelectPackage = async (packageData: SponsorPackage) => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per procedere",
        variant: "destructive"
      });
      return;
    }

    setLoading(packageData.id);

    try {
      const { url } = await startCheckout({
        kind: 'sponsor_package',
        id: packageData.id,
        title: `Sponsorizzazione ${packageData.name}`,
        amount: packageData.price,
      });
      window.location.href = url;
    } catch (error) {
      console.error('Errore:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore imprevisto",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/50 py-12">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <div className="mb-8">
          <BackButton fallbackPath="/dashboard" label="Torna alla Dashboard" />
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Pacchetti Sponsorizzazione
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Diventa partner di WeApnea e raggiungi migliaia di apneisti in tutta Italia
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {sponsorPackages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative transition-all duration-300 hover:shadow-lg ${
                pkg.popular 
                  ? 'border-primary shadow-primary/20' 
                  : 'border-border'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Più Popolare
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4 text-primary">
                  {pkg.icon}
                </div>
                <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                <CardDescription className="text-lg">
                  <span className="text-3xl font-bold text-foreground">€{pkg.price}</span>
                  <span className="text-muted-foreground">/anno</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPackage(pkg)}
                  disabled={loading === pkg.id}
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                >
                  {loading === pkg.id ? (
                    "Creazione checkout..."
                  ) : (
                    `Scegli ${pkg.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Hai domande sui nostri pacchetti sponsorizzazione?{" "}
            <a href="mailto:info@weapnea.com" className="text-primary hover:underline">
              Contattaci
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SponsorPackages;