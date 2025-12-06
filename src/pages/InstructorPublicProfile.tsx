import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Instagram, Award, Shield, User, Calendar, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import EventCard from "@/components/EventCard";

type PublicInstructor = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  instagram_contact: string | null;
  role: string;
  brevetto: string | null;
  scadenza_brevetto: string | null;
  assicurazione: string | null;
  scadenza_assicurazione: string | null;
  scadenza_certificato_medico: string | null;
  company_address: string | null;
  vat_number: string | null;
  public_profile_enabled?: boolean;
  public_slug?: string | null;
  public_show_bio?: boolean;
  public_show_instagram?: boolean;
  public_show_company_info?: boolean;
  public_show_certifications?: boolean;
  public_show_events?: boolean;
  public_show_records?: boolean;
  public_show_personal?: boolean;
  personal_best?: Record<string, string> | null;
};

export default function InstructorPublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const publicCertVisible = (d: PublicInstructor) => {
    if (d.public_show_certifications === false) return false;
    return Boolean(d.brevetto || d.assicurazione || d.scadenza_certificato_medico);
  };

  const { data, isLoading, error } = useQuery<PublicInstructor>({
    queryKey: ['public-instructor', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug mancante');
      const res = await apiGet(`/api/instructors/slug/${encodeURIComponent(slug)}`);
      return res as PublicInstructor;
    },
    enabled: !!slug,
  });

  const { data: events, isLoading: loadingEvents } = useQuery<any[]>({
    queryKey: ['public-instructor-events', slug],
    queryFn: async () => {
      if (!slug) return [];
      const res = await apiGet(`/api/instructors/slug/${encodeURIComponent(slug)}/events`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!slug,
  });

  // Set canonical URL dynamically when data is available
  useEffect(() => {
    if (!data?.public_slug) return;
    const canonicalHref = `${window.location.origin}/instructor/${data.public_slug}`;
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalHref);
    return () => {
      // opzionale: non rimuoviamo il canonical, lasciamo l'ultimo valore settato
    };
  }, [data?.public_slug]);

  // Meta description dinamica basata su full_name/bio
  useEffect(() => {
    if (!data) return;
    const title = data.full_name || data.company_name || 'Istruttore/Organizzatore di apnea';
    const bio = (data.bio || '').replace(/\s+/g, ' ').trim();
    const descriptor = bio ? `${bio.slice(0, 160)}` : `Profilo di ${title} su WeApnea: informazioni, contatti e attività.`;
    let meta: HTMLMetaElement | null = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', descriptor);
  }, [data]);

  const content = isLoading ? (
    <div className="min-h-[50vh] flex items-center justify-center text-gray-500">{t('common.loading', 'Caricamento...')}</div>
  ) : error || !data ? (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-bold mb-3">{t('profile.not_found', 'Profilo non trovato')}</h1>
      <Button asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>{t('not_found.back_home', 'Torna alla Home')}</Link></Button>
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" asChild className="mb-6 -ml-4">
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>{t('events.back_to_all', 'Torna agli eventi')}</Link>
      </Button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <Avatar className="w-32 h-32 mx-auto mb-4">
                <AvatarImage src={data.avatar_url || ''} alt={data.full_name || 'Profilo'} />
                <AvatarFallback className="text-2xl">{data.full_name ? data.full_name.charAt(0).toUpperCase() : <User className="w-12 h-12"/>}</AvatarFallback>
              </Avatar>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.full_name || 'Nome non specificato'}</h1>
              {data.company_name && <p className="text-lg text-blue-600 mb-2">{data.company_name}</p>}
              {data.public_show_personal !== false && data.instagram_contact && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://instagram.com/${data.instagram_contact.replace('@','')}`} target="_blank" rel="noopener noreferrer">
                      <Instagram className="w-4 h-4 mr-2"/>Instagram
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {data.public_show_personal !== false && data.role === 'company' && (data.company_address || data.vat_number) && (
            <Card className="mt-6">
              <CardHeader><CardTitle className="text-lg flex items-center"><MapPin className="w-5 h-5 mr-2"/>Informazioni Aziendali</CardTitle></CardHeader>
              <CardContent>
                {data.company_address && (<div className="mb-3"><p className="text-sm font-semibold text-gray-600">Indirizzo</p><p className="text-gray-800">{data.company_address}</p></div>)}
                {data.vat_number && (<div><p className="text-sm font-semibold text-gray-600">Partita IVA</p><p className="text-gray-800">{data.vat_number}</p></div>)}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="lg:col-span-2 space-y-6">
          {data.public_show_personal !== false && data.public_show_bio !== false && (
            <Card>
              <CardHeader><CardTitle className="text-xl">Chi sono</CardTitle></CardHeader>
              <CardContent>
                {data.bio ? (
                  <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">{data.bio}</div>
                ) : (
                  <div className="text-gray-500">Bio non disponibile</div>
                )}
              </CardContent>
            </Card>
          )}
          {data.public_show_personal !== false && data.public_show_certifications !== false && (
            <Card>
              <CardHeader><CardTitle className="text-xl">Certificazioni</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.brevetto && (
                  <div>
                    <div className="flex items-center mb-2"><Award className="w-4 h-4 mr-2 text-blue-600"/><p className="font-semibold text-gray-800">Brevetto</p></div>
                    <p className="text-gray-600 ml-6">{data.brevetto}</p>
                  </div>
                )}
                {data.assicurazione && (
                  <div>
                    <div className="flex items-center mb-2"><Shield className="w-4 h-4 mr-2 text-green-600"/><p className="font-semibold text-gray-800">Assicurazione</p></div>
                    <p className="text-gray-600 ml-6">{data.assicurazione}</p>
                  </div>
                )}
                {!data.brevetto && !data.assicurazione && (
                  <div className="text-gray-500">Nessuna certificazione disponibile</div>
                )}
              </CardContent>
            </Card>
          )}

          {data.public_show_events !== false && (
            <Card>
              <CardHeader><CardTitle className="text-xl flex items-center"><Calendar className="w-5 h-5 mr-2"/>Eventi</CardTitle></CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="py-4 text-gray-500">Caricamento eventi...</div>
                ) : (events && events.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-gray-500">Nessun evento pubblicato</div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.public_show_records !== false && (
            <Card>
              <CardHeader><CardTitle className="text-xl flex items-center"><Target className="w-5 h-5 mr-2"/>Record</CardTitle></CardHeader>
              <CardContent>
                {data.personal_best && Object.keys(data.personal_best).length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {Object.entries(data.personal_best).map(([disc, val]) => (
                      <li key={disc}><span className="font-semibold mr-1">{disc.toUpperCase()}:</span> {String(val)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-gray-500">Nessun record disponibile</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) return <MobileLayout><div className="p-4">{content}</div></MobileLayout>;
  return <Layout>{content}</Layout>;
}