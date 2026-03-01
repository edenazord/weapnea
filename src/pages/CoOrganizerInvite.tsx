import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiGet, apiSend } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Check, X, Loader2, UserPlus, AlertTriangle } from 'lucide-react';

interface InviteData {
  id: string;
  event_id: string;
  email: string;
  status: string;
  user_id: string | null;
  event_title: string;
  event_slug: string;
  organizer_name: string;
}

export default function CoOrganizerInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await apiGet(`/api/co-organizer-invite/${token}`);
        setInvite(data as InviteData);
      } catch (e: any) {
        setError(t('co_organizer_invite_page.not_found', 'Invito non trovato o scaduto.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      navigate(`/auth?redirect=/co-organizer-invite/${token}`);
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiSend(`/api/co-organizer-invite/${token}/accept`, 'POST') as any;
      if (res.ok) {
        setResult('accepted');
      }
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('email_mismatch')) {
        setError(t('co_organizer_invite_page.email_mismatch', "L'email del tuo account non corrisponde all'invito ({email}). Accedi con l'account corretto.").replace('{email}', invite?.email || ''));
      } else {
        setError(t('co_organizer_invite_page.accept_error', "Errore nell'accettazione dell'invito. Riprova."));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await apiSend(`/api/co-organizer-invite/${token}/decline`, 'POST');
      setResult('declined');
    } catch {
      setError(t('co_organizer_invite_page.decline_error', "Errore nel rifiuto dell'invito. Riprova."));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-gray-700">{error}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              {t('co_organizer_invite_page.back_home', 'Torna alla home')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('co_organizer_invite_page.accepted_title', 'Invito accettato!')}</h2>
            <p className="text-gray-600">
              {t('co_organizer_invite_page.accepted_desc', "Ora comparirai come co-organizzatore dell'evento {event}.").replace('{event}', invite?.event_title || '')}
            </p>
            <Button onClick={() => navigate(invite?.event_slug ? `/${invite.event_slug}` : '/')}>
              {t('co_organizer_invite_page.go_to_event', "Vai all'evento")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
              <X className="h-8 w-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('co_organizer_invite_page.declined_title', 'Invito rifiutato')}</h2>
            <p className="text-gray-600">
              {t('co_organizer_invite_page.declined_desc', "Hai rifiutato l'invito a co-organizzare {event}.").replace('{event}', invite?.event_title || '')}
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              {t('co_organizer_invite_page.back_home', 'Torna alla home')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite?.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Check className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">{t('co_organizer_invite_page.already_accepted_title', 'Invito già accettato')}</h2>
            <p className="text-gray-600">
              {t('co_organizer_invite_page.already_accepted_desc', "Sei già co-organizzatore dell'evento {event}.").replace('{event}', invite.event_title)}
            </p>
            <Button onClick={() => navigate(invite.event_slug ? `/${invite.event_slug}` : '/')}>
              {t('co_organizer_invite_page.go_to_event', "Vai all'evento")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl">{t('co_organizer_invite_page.invite_title', 'Invito Co-Organizzatore')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-700">
            <strong>{invite?.organizer_name}</strong> {t('co_organizer_invite_page.invite_desc', "{organizer} ti ha invitato come co-organizzatore per l'evento:").replace(/\{organizer\}\s*/, '')}
          </p>
          <p className="text-lg font-semibold text-blue-800">{invite?.event_title}</p>
          
          {!user && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              {t('co_organizer_invite_page.login_required', "Devi accedere o registrarti con l'email {email} per accettare l'invito.").replace('{email}', invite?.email || '')}
            </div>
          )}

          {user && profile?.email?.toLowerCase() !== invite?.email?.toLowerCase() && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {t('co_organizer_invite_page.wrong_account', "Sei connesso come {current}. L'invito è per {expected}. Per accettare, accedi con l'account corretto.")
                .replace('{current}', profile?.email || '')
                .replace('{expected}', invite?.email || '')}
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={handleAccept} disabled={actionLoading} className="flex-1">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {t('co_organizer_invite_page.accept_btn', 'Accetta')}
            </Button>
            <Button variant="outline" onClick={handleDecline} disabled={actionLoading} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              {t('co_organizer_invite_page.decline_btn', 'Rifiuta')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
