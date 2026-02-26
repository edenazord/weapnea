import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Waves, CheckCircle2, XCircle, Loader2, MailOpen } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/apiClient';
import { useLanguage } from '@/contexts/LanguageContext';

type VerifyState = 'loading' | 'success' | 'already' | 'expired' | 'error';

const VerifyEmail = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'error');
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (!token) { setState('error'); return; }
    let cancelled = false;
    apiGet(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (cancelled) return;
        if (data?.alreadyVerified) setState('already');
        else setState('success');
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = String(err?.message || '');
        if (msg.includes('expired')) setState('expired');
        else setState('error');
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleResend = async () => {
    // Try to extract email from token payload (base64 decode middle part)
    let email = '';
    try {
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        email = payload.email || '';
      }
    } catch { /* ignore */ }
    if (!email) return;
    setResending(true);
    try {
      await apiSend('/api/auth/resend-verification', 'POST', { email });
      setResendDone(true);
    } catch { /* ignore */ }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-sky-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <Waves className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">
            {state === 'loading' && t('verify_email.loading_title', 'Verifica in corso...')}
            {state === 'success' && t('verify_email.success_title', 'Email confermata!')}
            {state === 'already' && t('verify_email.already_title', 'Account già verificato')}
            {state === 'expired' && t('verify_email.expired_title', 'Link scaduto')}
            {state === 'error' && t('verify_email.error_title', 'Errore di verifica')}
          </CardTitle>
          <CardDescription>
            {state === 'loading' && t('verify_email.loading_desc', 'Stiamo verificando il tuo indirizzo email...')}
            {state === 'success' && t('verify_email.success_desc', 'Il tuo account è stato attivato con successo. Ora puoi accedere.')}
            {state === 'already' && t('verify_email.already_desc', 'Il tuo account è già stato verificato. Puoi effettuare il login.')}
            {state === 'expired' && t('verify_email.expired_desc', 'Il link di verifica è scaduto. Puoi richiederne uno nuovo.')}
            {state === 'error' && t('verify_email.error_desc', 'Il link di verifica non è valido. Assicurati di aver copiato il link correttamente.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === 'loading' && (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <Button asChild className="w-full mt-4">
                <Link to="/auth">{t('verify_email.go_login', 'Accedi al tuo account')}</Link>
              </Button>
            </>
          )}

          {state === 'already' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-blue-500 mx-auto" />
              <Button asChild className="w-full mt-4">
                <Link to="/auth">{t('verify_email.go_login', 'Accedi al tuo account')}</Link>
              </Button>
            </>
          )}

          {state === 'expired' && (
            <>
              <MailOpen className="h-16 w-16 text-amber-500 mx-auto" />
              {resendDone ? (
                <p className="text-green-600 font-medium">{t('verify_email.resend_done', 'Email inviata! Controlla la tua casella di posta.')}</p>
              ) : (
                <Button onClick={handleResend} disabled={resending} className="w-full">
                  {resending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('verify_email.resend_btn', 'Invia nuovo link di verifica')}
                </Button>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">{t('verify_email.back_login', 'Torna al login')}</Link>
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto" />
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">{t('verify_email.back_login', 'Torna al login')}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
