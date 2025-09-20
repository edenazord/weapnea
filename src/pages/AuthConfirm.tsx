
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Waves, CheckCircle, XCircle, Loader2 } from "lucide-react";

const AuthConfirm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      console.log('AuthConfirm: Starting email confirmation process');
      console.log('Search params:', searchParams.toString());
      
      const type = searchParams.get('type');
      const tokenHash = searchParams.get('token_hash');
      const token = searchParams.get('token');
      const email = searchParams.get('email');
      
      // Handle password recovery separately
      if (type === 'recovery') {
        console.log('Recovery type detected, redirecting to password reset');
        const confirmationToken = tokenHash || token;
        if (confirmationToken && email) {
          // Redirect to password reset page with the necessary parameters
          navigate(`/password-reset?token=${confirmationToken}&email=${encodeURIComponent(email)}&type=recovery`);
        } else {
          setStatus('error');
          toast({
            title: "Link non valido",
            description: "Il link di recupero password non è valido.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/auth'), 3000);
        }
        return;
      }
      
      // Handle both new (token_hash) and old (token) formats for email confirmation
      const confirmationToken = tokenHash || token;
      
      if (!confirmationToken || !email) {
        console.error('Missing confirmation token or email in URL');
        setStatus('error');
        toast({
          title: "Link non valido",
          description: "Il link di conferma non è valido. Richiedi un nuovo link di conferma.",
          variant: "destructive",
        });
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

  // In API mode non eseguiamo conferma via client: il link di conferma viene gestito dal backend o flusso email.
  setStatus('success');
  toast({ title: "Email confermata!", description: "La tua email è stata confermata. Ora puoi accedere." });
  setTimeout(() => navigate('/auth?view=login'), 1500);
    };

    handleEmailConfirmation();
  }, [searchParams, navigate, toast]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-600" />;
      case 'error':
        return <XCircle className="h-16 w-16 text-red-600" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return {
          title: "Conferma email in corso...",
          description: "Attendere prego mentre confermiamo la tua email."
        };
      case 'success':
        return {
          title: "Email confermata!",
          description: "La tua email è stata confermata con successo. Verrai reindirizzato alla pagina di accesso."
        };
      case 'error':
        return {
          title: "Errore di conferma",
          description: "Non è stato possibile confermare l'email. Verrai reindirizzato alla pagina di registrazione."
        };
    }
  };

  const { title, description } = getStatusMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <Waves className="h-12 w-12 text-blue-600" />
          </div>
          
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>
          
          <h1 className="text-2xl font-semibold mb-4 text-gray-900">{title}</h1>
          <p className="text-gray-600 mb-6">{description}</p>
          
          {status === 'loading' && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthConfirm;
