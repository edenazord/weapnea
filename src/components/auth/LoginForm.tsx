
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiSend } from "@/lib/apiClient";

const LoginForm = () => {
  const { t } = useLanguage();
  const formSchema = z.object({
    email: z.string().email({ message: t('auth.login.validation.email_invalid', 'Indirizzo email non valido.') }),
    password: z.string().min(1, { message: t('auth.login.validation.password_required', 'La password è obbligatoria.') }),
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { signIn, user } = useAuth();
  const hasRedirected = useRef(false);
  
  const redirectUrl = searchParams.get('redirect');
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Auto-redirect when user becomes available after login (only if redirect param exists)
  useEffect(() => {
    if (user && !isLoading && !hasRedirected.current) {
      hasRedirected.current = true;
      
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
        return;
      }
      
      // Check for pending co-organizer invites
      (async () => {
        try {
          const invites = await apiGet('/api/me/pending-co-organizer-invites');
          if (Array.isArray(invites) && invites.length > 0) {
            const first = invites[0] as { invite_token?: string };
            if (first.invite_token) {
              navigate(`/co-organizer-invite/${first.invite_token}`, { replace: true });
              return;
            }
          }
        } catch (_) { /* ignore */ }
        navigate('/', { replace: true });
      })();
    }
  }, [user, isLoading, redirectUrl, navigate]);
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isLoading) return;
    
    // Reset redirect guard for this login attempt
    hasRedirected.current = false;
    setIsLoading(true);
    
    try {
      const result = await signIn(values.email, values.password);

      if (result.success) {
        setVerificationNeeded(null);
        toast({
          title: t('auth.login.success_title', 'Accesso effettuato'),
          description: t('auth.login.success_desc', 'Bentornato su WeApnea!'),
        });
        // Redirect handled by useEffect only if ?redirect=...
      } else if ((result as any).needsVerification) {
        setVerificationNeeded(values.email);
        toast({
          title: t('auth.login.unverified_title', 'Account non verificato'),
          description: t('auth.login.unverified_desc', "Controlla la tua email per il link di conferma. Puoi richiedere un nuovo link qui sotto."),
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: t('auth.login.error_title', 'Errore di accesso'),
          description: result.error || t('auth.login.error_invalid', 'Credenziali non valide. Riprova.'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: t('auth.login.error_title', 'Errore di accesso'),
        description: t('auth.login.error_generic', 'Si è verificato un errore. Riprova.'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.login.form.email_label', 'Email')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('auth.login.form.email_placeholder', 'tua@email.com')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.login.form.password_label', 'Password')}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('auth.login.form.submitting', 'Accesso in corso...') : t('common.login', 'Accedi')}
          </Button>
          
          <div className="text-center">
            <Link to="/password-reset" className="text-sm text-gray-600 hover:text-blue-600">
              {t('auth.login.form.forgot_password', 'Password dimenticata?')}
            </Link>
          </div>

          {verificationNeeded && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-center space-y-2">
              <p className="text-sm text-amber-800">
                {t('auth.login.unverified_hint', "Non hai ricevuto l'email di conferma?")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resending}
                onClick={async () => {
                  setResending(true);
                  try {
                    await apiSend('/api/auth/resend-verification', 'POST', { email: verificationNeeded });
                    toast({
                      title: t('auth.login.resend_success_title', 'Email inviata'),
                      description: t('auth.login.resend_success_desc', 'Controlla la tua casella di posta per il link di conferma.'),
                    });
                    setVerificationNeeded(null);
                  } catch {
                    toast({
                      title: t('common.error', 'Errore'),
                      description: t('auth.login.resend_error', "Impossibile inviare l'email. Riprova più tardi."),
                      variant: "destructive",
                    });
                  }
                  setResending(false);
                }}
              >
                {resending ? t('auth.login.resending', 'Invio in corso...') : t('auth.login.resend_btn', 'Reinvia email di conferma')}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default LoginForm;
