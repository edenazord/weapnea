
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
      const target = redirectUrl || '/';
      navigate(target, { replace: true });
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
        toast({
          title: t('auth.login.success_title', 'Accesso effettuato'),
          description: t('auth.login.success_desc', 'Bentornato su WeApnea!'),
        });
        // Redirect handled by useEffect only if ?redirect=...
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
        </form>
      </Form>
    </div>
  );
};

export default LoginForm;
