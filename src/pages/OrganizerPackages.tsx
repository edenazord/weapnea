import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { backendConfig } from "@/lib/backendConfig";
import { apiSend } from "@/lib/apiClient";
import { startCheckout } from "@/lib/payments-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Users, Zap, Trophy } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useLanguage } from "@/contexts/LanguageContext";

interface OrganizerPackage {
  id: string;
  name: string;
  price: number;
  duration: number; // months
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

const buildOrganizerPackages = (t: (key: string, fallback: string) => string): OrganizerPackage[] => [
  {
    id: 'entry',
    name: 'Entry',
    price: 0,
    duration: 12,
    icon: <Users className="h-8 w-8" />,
    features: [
      t('organizer_packages_page.features.basic_events', 'Creazione eventi base'),
      t('organizer_packages_page.features.limited_participants', 'Gestione partecipanti limitata (50)'),
      t('organizer_packages_page.features.email_support', 'Supporto email'),
      t('organizer_packages_page.features.basic_dashboard', 'Dashboard base')
    ]
  },
  {
    id: 'startup',
    name: 'Startup',
    price: 290,
    duration: 6,
    icon: <Zap className="h-8 w-8" />,
    popular: true,
    features: [
      t('organizer_packages_page.features.unlimited_events', 'Creazione eventi illimitata'),
      t('organizer_packages_page.features.extended_participants', 'Gestione partecipanti estesa (500)'),
      t('organizer_packages_page.features.advanced_marketing', 'Strumenti marketing avanzati'),
      t('organizer_packages_page.features.detailed_analytics', 'Analytics dettagliato'),
      t('organizer_packages_page.features.priority_support', 'Supporto prioritario'),
      t('organizer_packages_page.features.payment_integration', 'Integrazione pagamenti')
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 990,
    duration: 9,
    icon: <Trophy className="h-8 w-8" />,
    features: [
      t('organizer_packages_page.features.everything_startup', 'Tutto dello Startup'),
      t('organizer_packages_page.features.unlimited_participants', 'Gestione partecipanti illimitata'),
      t('organizer_packages_page.features.white_label', 'White-label completo'),
      t('organizer_packages_page.features.custom_api', 'API personalizzate'),
      t('organizer_packages_page.features.dedicated_manager', 'Account manager dedicato'),
      t('organizer_packages_page.features.one_to_one_training', 'Formazione 1-to-1'),
      t('organizer_packages_page.features.support_24_7', 'Supporto 24/7')
    ]
  }
];

// Tipi di risposta dalle Edge Functions
type OrganizerSubscriptionResult = {
  hasActiveSubscription?: boolean;
  organizerPackage?: { packageName: string };
};

type OrganizerCheckoutResponse = {
  url?: string;
  free?: boolean;
};

const OrganizerPackages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const organizerPackages = buildOrganizerPackages(t);
  const [loading, setLoading] = useState<string | null>(null);

  const checkActiveSubscription = async () => {
    try {
      toast({
        title: t('organizer_packages_page.checking', 'Verifica in corso'),
        description: t('organizer_packages_page.checking_desc', 'Se il pagamento è andato a buon fine, il pacchetto sarà attivo entro pochi minuti.'),
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handlePaymentSuccess = useCallback(async (packageId: string) => {
    try {
      const packageData = organizerPackages.find(pkg => pkg.id === packageId);
      if (!packageData) {
        throw new Error("Pacchetto non trovato");
      }

      console.log('Checking and activating package after successful payment:', packageId);
      
      // Handle free entry package differently
      if (packageId === 'entry') {
        toast({
          title: t('organizer_packages_page.entry_package', 'Pacchetto Entry'),
          description: t('organizer_packages_page.entry_free_desc', 'Il pacchetto Entry è gratuito. Contattaci per attivarlo sul tuo account.'),
        });
        
        // Clear URL parameters
        window.history.replaceState({}, '', '/organizer-packages');
        return;
      }
      
      // Use the check-organizer-subscription function for paid packages
      // This function will automatically activate the package if it finds an active subscription
      // API-only: per ora mostriamo conferma e rimandiamo alla dashboard
      toast({
        title: t('organizer_packages_page.payment_completed', 'Pagamento completato!'),
        description: t('organizer_packages_page.payment_completed_desc', 'Se il pagamento è confermato, il pacchetto sarà attivo entro pochi minuti.'),
      });

      // Clear URL parameters
      window.history.replaceState({}, '', '/organizer-packages');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 3000);
    } catch (error) {
      console.error('Error handling payment success:', error);
      toast({
        title: t('organizer_packages_page.activation_error', "Errore nell'attivazione"),
        description: error instanceof Error ? error.message : t('organizer_packages_page.activation_error_desc', 'Si è verificato un errore. Contatta il supporto se il problema persiste.'),
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

    console.log('OrganizerPackages URL check:', { 
      currentURL: window.location.href,
      success, 
      packageId, 
      canceled,
      userLoggedIn: !!user?.id 
    });

    if (success === 'true' && packageId) {
      console.log('Triggering handlePaymentSuccess for package:', packageId);
      // Wait a bit for auth to be ready, then handle payment success
      setTimeout(() => {
        if (user?.id) {
          handlePaymentSuccess(packageId);
        } else {
          // If user is not logged in, wait a bit more and retry
          setTimeout(() => {
            if (user?.id) {
              handlePaymentSuccess(packageId);
            } else {
              console.error('User not authenticated after payment success');
              toast({
                title: t('organizer_packages_page.login_required', 'Login necessario'),
                description: t('organizer_packages_page.login_required_desc', "Per completare l'attivazione del pacchetto, effettua il login."),
                variant: "destructive"
              });
              // Redirect to login page with return URL
              window.location.href = `/auth?redirect=${encodeURIComponent(window.location.href)}`;
            }
          }, 2000);
        }
      }, 1000);
    } else if (canceled === 'true') {
      toast({
        title: t('organizer_packages_page.payment_cancelled', 'Pagamento annullato'),
        description: t('organizer_packages_page.payment_cancelled_desc', 'Il pagamento è stato annullato. Puoi riprovare quando vuoi.'),
        variant: "destructive"
      });
      // Clear URL parameters
      window.history.replaceState({}, '', '/organizer-packages');
    }
  }, [user?.id, toast, handlePaymentSuccess]);

  const handleSelectPackage = async (packageData: OrganizerPackage) => {
    if (!user?.id) {
      toast({
        title: "Errore",
        description: t('organizer_packages_page.auth_required', 'Devi essere autenticato per procedere'),
        variant: "destructive"
      });
      return;
    }

    // Entry package is free - handle differently
    if (packageData.id === 'entry') {
      toast({
        title: t('organizer_packages_page.entry_package', 'Pacchetto Entry'),
        description: t('organizer_packages_page.entry_free_desc', 'Il pacchetto Entry è gratuito. Contattaci per attivarlo sul tuo account.'),
      });
      return;
    }

    setLoading(packageData.id);

    try {
      console.log('Sending request with data:', { 
        packageId: packageData.id,
        packageName: packageData.name,
        durationMonths: packageData.duration
      });

      if (backendConfig.mode === 'api') {
        const { url } = await startCheckout({
          kind: 'organizer_package',
          id: packageData.id,
          title: `Pacchetto ${packageData.name}`,
          amount: packageData.price,
        });
        window.location.href = url;
      } else {
        const { url } = await startCheckout({
          kind: 'organizer_package',
          id: packageData.id,
          title: `Pacchetto ${packageData.name}`,
          amount: packageData.price,
        });
        window.location.href = url;
      }
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
          <BackButton fallbackPath="/dashboard" label={t('organizer_packages_page.back_to_dashboard', 'Torna alla Dashboard')} />
        </div>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t('organizer_packages_page.title', 'Pacchetti Organizzatore')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('organizer_packages_page.subtitle', 'Organizza eventi di apnea professionali con i nostri strumenti avanzati')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {organizerPackages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative transition-all duration-300 hover:shadow-lg ${
                pkg.popular 
                  ? 'border-primary shadow-primary/20 scale-105' 
                  : 'border-border'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    {t('organizer_packages_page.recommended', 'Consigliato')}
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4 text-primary">
                  {pkg.icon}
                </div>
                <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                <CardDescription className="text-lg">
                  {pkg.price === 0 ? (
                    <span className="text-3xl font-bold text-foreground">{t('organizer_packages_page.free', 'Gratuito')}</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">€{pkg.price}</span>
                      <span className="text-muted-foreground">/{pkg.duration} mesi</span>
                    </>
                  )}
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
                  variant={pkg.popular ? "default" : pkg.price === 0 ? "outline" : "outline"}
                >
                  {loading === pkg.id ? (
                    t('organizer_packages_page.creating_checkout', 'Creazione checkout...')
                  ) : pkg.price === 0 ? (
                    t('organizer_packages_page.start_free', 'Inizia Gratis')
                  ) : (
                    t('organizer_packages_page.choose_package', 'Scegli {name}').replace('{name}', pkg.name)
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button 
            onClick={checkActiveSubscription}
            variant="outline"
            className="mb-4"
          >
            {t('organizer_packages_page.verify_payment', 'Verifica Stato Pagamento')}
          </Button>
        </div>

        <div className="text-center mt-4">
          <p className="text-muted-foreground">
            {t('organizer_packages_page.questions', 'Hai domande sui nostri pacchetti organizzatore?')}{" "}
            <a href="mailto:info@weapnea.com" className="text-primary hover:underline">
              {t('organizer_packages_page.contact_us', 'Contattaci')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizerPackages;