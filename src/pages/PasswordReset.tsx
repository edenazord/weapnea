
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { Waves, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiSend } from "@/lib/apiClient";
import { useLanguage } from "@/contexts/LanguageContext";

const PasswordResetPage = () => {
  const { t } = useLanguage();

  const resetPasswordSchema = z.object({
    email: z.string().email({ message: t('password_reset.errors.email_invalid', 'Indirizzo email non valido.') }),
  });

  const newPasswordSchema = z.object({
    password: z.string().min(6, { message: t('password_reset.errors.password_min', 'La password deve contenere almeno 6 caratteri.') }),
    confirmPassword: z.string().min(6, { message: t('password_reset.errors.confirm_required', 'Conferma la password.') }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('password_reset.errors.password_mismatch', 'Le password non corrispondono'),
    path: ["confirmPassword"],
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const { resetPassword } = useAuth();
  
  // Check for recovery token parameters
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const type = searchParams.get('type');
  
  useEffect(() => {
    // If we have a recovery token, show the new password form
    if (token && email && type === 'recovery') {
      console.log('Recovery token found, showing password reset form');
      setIsSettingNewPassword(true);
    }
  }, [token, email, type]);

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const newPasswordForm = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onChange"
  });

  // Force clear form when component mounts for password reset
  useEffect(() => {
    if (isSettingNewPassword) {
      console.log('Password reset form mounted, clearing form values');
      newPasswordForm.reset({
        password: "",
        confirmPassword: "",
      });
    }
  }, [isSettingNewPassword, newPasswordForm]);

  async function onRequestReset(values: z.infer<typeof resetPasswordSchema>) {
    setIsLoading(true);
    
    try {
      const result = await resetPassword(values.email);

      if (result.success) {
        setEmailSent(true);
        toast({
          title: t('password_reset.email_sent_title', 'Email inviata'),
          description: t('password_reset.email_sent_desc', 'Controlla la tua casella di posta per le istruzioni di recupero password.'),
        });
      } else {
        toast({
          title: t('common.error', 'Errore'),
          description: result.error || t('password_reset.errors.send_failed', "Si è verificato un errore durante l'invio dell'email di recupero."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      toast({
        title: t('common.unexpected_error', 'Errore imprevisto'),
        description: t('password_reset.errors.send_failed', "Si è verificato un errore durante l'invio dell'email di recupero."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onSetNewPassword(values: z.infer<typeof newPasswordSchema>) {
    setIsLoading(true);
    
    try {
      const token = searchParams.get('token');
      const email = searchParams.get('email');
      
      if (!token || !email) {
        toast({
          title: t('common.error', 'Errore'),
          description: t('password_reset.errors.invalid_link', 'Link di recupero non valido. Richiedi un nuovo link di recupero.'),
          variant: "destructive",
        });
        navigate('/password-reset');
        return;
      }
      const res = await apiSend('/api/auth/reset-password', 'POST', { token, password: values.password });
      if (res?.ok || res?.success || res === null) {
        toast({
          title: t('password_reset.updated_title', 'Password aggiornata'),
          description: t('password_reset.updated_desc', 'La tua password è stata aggiornata con successo. Ora puoi accedere con la nuova password.'),
        });
        setTimeout(() => navigate('/auth?view=login'), 1500);
      } else {
        toast({ title: t('common.error', 'Errore'), description: t('password_reset.errors.invalid_token', 'Token non valido o scaduto.'), variant: 'destructive' });
        navigate('/password-reset');
      }
      
    } catch (error) {
      console.error('Password update error:', error);
      toast({
        title: t('common.unexpected_error', 'Errore imprevisto'),
        description: t('password_reset.errors.update_failed', "Si è verificato un errore durante l'aggiornamento della password."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (emailSent && !isSettingNewPassword) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 p-4">
        <Link to="/" className="flex items-center space-x-2 mb-8 no-underline">
          <Waves className="h-10 w-10 text-blue-600" />
          <span className="text-4xl font-bold text-blue-900">WeApnea</span>
        </Link>
        
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">{t('password_reset.email_sent_heading', 'Email Inviata!')}</CardTitle>
            <CardDescription>
              {t('password_reset.email_sent_help', 'Abbiamo inviato le istruzioni per reimpostare la password alla tua email.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              {t('password_reset.email_sent_follow', 'Controlla la tua casella di posta e segui le istruzioni per reimpostare la password.')}
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">{t('password_reset.back_to_login', 'Torna al Login')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 p-4">
      <Link to="/" className="flex items-center space-x-2 mb-8 no-underline">
        <Waves className="h-10 w-10 text-blue-600" />
        <span className="text-4xl font-bold text-blue-900">WeApnea</span>
      </Link>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isSettingNewPassword ? t('password_reset.set_new_title', 'Imposta Nuova Password') : t('password_reset.request_title', 'Recupera Password')}
          </CardTitle>
          <CardDescription>
            {isSettingNewPassword 
              ? t('password_reset.set_new_subtitle', 'Inserisci la tua nuova password.') 
              : t('password_reset.request_subtitle', 'Inserisci il tuo indirizzo email e ti invieremo le istruzioni per reimpostare la password.')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSettingNewPassword ? (
            <Form {...newPasswordForm}>
              <form onSubmit={newPasswordForm.handleSubmit(onSetNewPassword)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('password_reset.new_password_label', 'Nuova Password')}
                  </label>
                  <input
                    type="password"
                    placeholder={t('password_reset.new_password_placeholder', 'Inserisci nuova password')}
                    className="w-full p-2 border rounded"
                    value={newPasswordForm.watch("password") || ""}
                    onChange={(e) => newPasswordForm.setValue("password", e.target.value)}
                  />
                  {newPasswordForm.formState.errors.password && (
                    <p className="text-sm text-red-500">{newPasswordForm.formState.errors.password.message}</p>
                  )}
                </div>
                <FormField
                  control={newPasswordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('password_reset.confirm_password_label', 'Conferma Password')}</FormLabel>
                      <FormControl>
                        <Input 
                          key="confirm-password-input"
                          type="password" 
                          placeholder="••••••••" 
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          name="confirm-password-field"
                          id="confirm-password-field"
                          data-lpignore="true"
                          data-form-type="password"
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? t('password_reset.updating', 'Aggiornamento...') : t('password_reset.update_button', 'Aggiorna Password')}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onRequestReset)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('password_reset.email_label', 'Email')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('password_reset.email_placeholder', 'tua@email.com')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? t('password_reset.sending', 'Invio...') : t('password_reset.send_button', 'Invia Email di Recupero')}
                </Button>
              </form>
            </Form>
          )}
          
          <div className="mt-4 text-center">
            <Button variant="link" asChild>
              <Link to="/auth">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('password_reset.back_to_login', 'Torna al Login')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordResetPage;
