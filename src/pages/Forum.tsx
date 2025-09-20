
import Layout from "@/components/Layout";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, Eye, Plus, Pin, Lock, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getForumCategories, getForumTopics } from "@/lib/forum-api";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";

const Forum = () => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category');
  const { session } = useAuth();
  const { t } = useLanguage();

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: getForumCategories,
    staleTime: 0, // Force fresh data
    refetchOnMount: true,
  });

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['forum-topics', selectedCategory],
    queryFn: () => getForumTopics(selectedCategory || undefined),
  });

  const selectedCategoryData = selectedCategory 
    ? categories.find(cat => cat.id === selectedCategory)
    : null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, isMobile ? 'dd/MM/yy' : 'dd MMM yyyy HH:mm', { locale: it });
    } catch {
      return dateString;
    }
  };

  console.log('Categories state:', { categories, categoriesLoading, count: categories.length });

  const content = (
    <div className={`space-y-6`}>
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6">
      
  <PageHeader
        title={selectedCategoryData ? selectedCategoryData.name : t('forum.title', 'Forum')}
        subtitle={selectedCategoryData ? selectedCategoryData.description : t('forum.subtitle', 'Discuti con la community di appassionati di apnea')}
        actions={
          session ? (
            <Button asChild size={isMobile ? "sm" : "default"} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/forum/new-topic">
                <Plus className="mr-2 h-4 w-4" />
                {t('forum.new_topic', 'Nuovo Topic')}
              </Link>
            </Button>
          ) : (
            <Button asChild size={isMobile ? "sm" : "default"} variant="outline" className="border-purple-200 hover:border-purple-400">
              <Link to="/auth">{t('forum.login_to_create_topic', 'Accedi per creare un topic')}</Link>
            </Button>
          )
        }
      />

  {/* Simple Categories Filter */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={!selectedCategory ? 'default' : 'ghost'} 
            size="sm"
            asChild
            className={`transition-all duration-200 ${!selectedCategory 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Link to="/forum">{t('forum.filter.all', 'Tutte')}</Link>
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'ghost'}
              size="sm"
              asChild
              className={`transition-all duration-200 ${selectedCategory === category.id 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <Link to={`/forum?category=${category.id}`}>
                {isMobile ? category.name.split(' ')[0] : category.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>

  {/* Clean Topics List */}
  {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : topics.length > 0 ? (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="bg-white rounded-lg border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all duration-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    {topic.is_pinned && (
                      <Pin className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    )}
                    {topic.is_locked && (
                      <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <Link 
                      to={`/forum/topic/${topic.id}`}
                      className={`font-semibold text-gray-900 hover:text-purple-600 transition-colors line-clamp-2 ${
                        isMobile ? 'text-sm' : 'text-base'
                      }`}
                    >
                      {topic.title}
                    </Link>
                  </div>
                  
                  <div className={`flex flex-wrap items-center gap-3 text-gray-500 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <span className="font-medium">{topic.author?.full_name || t('forum.anonymous', 'Anonimo')}</span>
                    <span className="text-gray-300">•</span>
                    <span>{formatDate(topic.created_at)}</span>
                    {!selectedCategoryData && topic.category && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-purple-600 font-medium">{topic.category.name}</span>
                      </>
                    )}
                  </div>

                  {topic.last_reply_at && !isMobile && (
                    <div className="text-xs text-gray-400 mt-2">
                      {t('forum.last_reply', 'Ultima risposta:')} <span className="font-medium">{topic.last_reply_author?.full_name || t('forum.anonymous', 'Anonimo')}</span>
                      {' '}{formatDate(topic.last_reply_at)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`flex items-center gap-1 text-gray-500 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <Eye className="h-3 w-3" />
                    <span className={isMobile ? 'hidden sm:inline' : ''}>{topic.views_count || 0}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-purple-600 bg-purple-50 rounded-full px-2 py-1 ${
                    isMobile ? 'text-xs' : 'text-sm'
                  }`}>
                    <MessageSquare className="h-3 w-3" />
                    <span className="font-medium">{topic.replies_count || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 p-8 text-center">
          <div className="p-4 rounded-full bg-purple-100 w-fit mx-auto mb-4">
            <MessageSquare className={`text-purple-600 ${isMobile ? 'h-8 w-8' : 'h-12 w-12'}`} />
          </div>
          <h3 className={`font-semibold text-gray-900 mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
            {t('forum.no_topics.title', 'Nessun topic trovato')}
          </h3>
          <p className={`text-gray-500 mb-6 ${isMobile ? 'text-sm' : 'text-base'}`}>
            {selectedCategoryData 
              ? `${t('forum.no_topics.in_category_prefix', 'Non ci sono ancora discussioni in')} ${selectedCategoryData.name}.`
              : t('forum.no_topics.generic', 'Non ci sono ancora discussioni nel forum.')
            }
          </p>
          {session ? (
            <Button asChild className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600">
              <Link to="/forum/new-topic">
                <Plus className="mr-2 h-4 w-4" />
                {t('forum.create_first_topic', 'Crea il primo topic')}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="border-purple-200 hover:border-purple-400">
              <Link to="/auth">{t('forum.login_to_create_first_topic', 'Accedi per creare il primo topic')}</Link>
            </Button>
          )}
        </div>
  )}
  </div>
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default Forum;
