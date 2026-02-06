
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Globe, Instagram, Award, Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { useScrollToTop } from "@/hooks/useScrollToTop";

interface InstructorProfile {
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
}

const InstructorProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <Card>
          <CardContent className="p-6 text-center">
            <Skeleton className="w-32 h-32 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

const InstructorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  useScrollToTop();

  const { data: instructor, isLoading, error } = useQuery<InstructorProfile>({
    queryKey: ['instructor-profile', id],
    queryFn: async () => {
      if (!id) throw new Error('ID istruttore mancante');
      const res = await apiGet(`/api/instructors/${id}`);
      if (!res) throw new Error('Profilo non trovato');
      return res as InstructorProfile;
    },
    enabled: !!id,
  });

  if (isLoading) {
    const skeletonContent = <InstructorProfileSkeleton />;
    return isMobile ? <MobileLayout><div className="p-4">{skeletonContent}</div></MobileLayout> : <Layout>{skeletonContent}</Layout>;
  }

  if (error || !instructor) {
    const errorContent = (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('profile.not_found', 'Profilo non trovato')}</h1>
        <p className="text-gray-600 mb-6">{t('profile.not_found_desc', 'Il profilo che stai cercando non esiste o non è pubblico.')}</p>
        <Button asChild>
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> {t('not_found.back_home', 'Torna alla Home')}</Link>
        </Button>
      </div>
    );
    return isMobile ? <MobileLayout><div className="p-4">{errorContent}</div></MobileLayout> : <Layout>{errorContent}</Layout>;
  }

  const content = (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" asChild className="mb-6 -ml-4">
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> {t('events.back_to_all', 'Torna agli eventi')}</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar con info principali */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <Avatar className="w-32 h-32 mx-auto mb-4">
                <AvatarImage src={instructor.avatar_url || ""} alt={instructor.full_name || "Profilo"} />
                <AvatarFallback className="text-2xl">
                  {instructor.full_name ? instructor.full_name.charAt(0).toUpperCase() : <User className="w-12 h-12" />}
                </AvatarFallback>
              </Avatar>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {instructor.full_name || "Nome non specificato"}
              </h1>
              
              {instructor.company_name && (
                <p className="text-lg text-blue-600 mb-2">{instructor.company_name}</p>
              )}
              
              <p className="text-sm text-gray-500 capitalize">
                {instructor.role === 'instructor' ? 'Istruttore' : 'Azienda'}
              </p>

              {instructor.instagram_contact && (
                <div className="mt-4">
                  <Button 
                    size="sm" 
                    asChild
                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-0 hover:from-purple-600 hover:via-pink-600 hover:to-orange-500 shadow-md hover:shadow-lg transition-all"
                  >
                    <a href={`https://instagram.com/${instructor.instagram_contact.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                      <Instagram className="w-4 h-4 mr-2" />
                      Instagram
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informazioni aziendali */}
          {instructor.role === 'company' && (instructor.company_address || instructor.vat_number) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Informazioni Aziendali
                </CardTitle>
              </CardHeader>
              <CardContent>
                {instructor.company_address && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-600">Indirizzo</p>
                    <p className="text-gray-800">{instructor.company_address}</p>
                  </div>
                )}
                {instructor.vat_number && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600">Partita IVA</p>
                    <p className="text-gray-800">{instructor.vat_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contenuto principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Biografia */}
          {instructor.bio && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Chi sono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {instructor.bio}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certificazioni e Brevetti */}
          {(instructor.brevetto || instructor.assicurazione) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  Certificazioni
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {instructor.brevetto && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Award className="w-4 h-4 mr-2 text-blue-600" />
                      <p className="font-semibold text-gray-800">Brevetto</p>
                    </div>
                    <p className="text-gray-600 ml-6">{instructor.brevetto}</p>
                    {instructor.scadenza_brevetto && (
                      <p className="text-sm text-gray-500 ml-6">
                        Scadenza: {new Date(instructor.scadenza_brevetto).toLocaleDateString('it-IT')}
                      </p>
                    )}
                  </div>
                )}
                
                {instructor.assicurazione && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Shield className="w-4 h-4 mr-2 text-green-600" />
                      <p className="font-semibold text-gray-800">Assicurazione</p>
                    </div>
                    <p className="text-gray-600 ml-6">{instructor.assicurazione}</p>
                    {instructor.scadenza_assicurazione && (
                      <p className="text-sm text-gray-500 ml-6">
                        Scadenza: {new Date(instructor.scadenza_assicurazione).toLocaleDateString('it-IT')}
                      </p>
                    )}
                  </div>
                )}

                {instructor.scadenza_certificato_medico && (
                  <div>
                    <div className="flex items-center mb-2">
                      <Calendar className="w-4 h-4 mr-2 text-red-600" />
                      <p className="font-semibold text-gray-800">Certificato Medico</p>
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      Scadenza: {new Date(instructor.scadenza_certificato_medico).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return <MobileLayout><div className="p-4">{content}</div></MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default InstructorProfile;
