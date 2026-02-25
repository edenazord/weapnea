
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBlogArticles } from "@/lib/blog-api";
import { Link } from "react-router-dom";
import { buildFriendlyBlogPath } from "@/lib/seo-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";
import PageHead from "@/components/PageHead";

const Blog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();
  const { t, currentLanguage } = useLanguage();

  const allowedLangs = ['it','en','es','fr','pl','ru'] as const;
  const langParam = (allowedLangs as readonly string[]).includes(currentLanguage) ? (currentLanguage as typeof allowedLangs[number]) : undefined;

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['blog-articles', langParam, searchTerm],
    queryFn: () => getBlogArticles(true, searchTerm, { column: 'created_at', direction: 'desc' }, langParam),
  });

  // Fallback: se per la lingua selezionata non ci sono articoli, mostra quelli in inglese
  const { data: enArticles = [], isLoading: isLoadingEn } = useQuery({
    queryKey: ['blog-articles', 'en', searchTerm],
    queryFn: () => getBlogArticles(true, searchTerm, { column: 'created_at', direction: 'desc' }, 'en'),
    enabled: langParam !== 'en',
  });

  const usingEnglishFallback = (langParam && langParam !== 'en' && !isLoading && articles.length === 0 && enArticles.length > 0);
  const displayArticles = usingEnglishFallback ? enArticles : articles;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const BlogContent = () => (
    <div className="">
      <PageHead title="Blog" description="Articoli, guide e approfondimenti sul mondo dell'apnea e del freediving." />
      {!isMobile && <PageTopBar />}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
      
  <PageHeader
        title={t('blog_page.title', 'Blog WeApnea')}
        subtitle={t('blog_page.subtitle', "Scopri le ultime novità dal mondo dell'apnea, tecniche, consigli e storie dalla nostra community")}
      />

  {/* Modern Search */}
  <div className="mb-12">
        <div className="relative max-w-xl mx-auto">
          <div className="gradient-border">
            <div className="gradient-border-inner rounded-lg shadow-md hover:shadow-lg overflow-hidden transition-all duration-200">
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 -mt-0.5 h-5 w-5 z-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 opacity-80" />
                <Input
                  placeholder={t('blog_page.search_placeholder', 'Cerca articoli...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-14 pr-6 border-0 bg-transparent text-base focus:ring-0 focus:outline-none placeholder:text-muted-foreground h-16"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="w-full">
  {isLoading || (usingEnglishFallback && isLoadingEn) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-48 bg-gradient-to-r from-gray-200 to-gray-300"></div>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-3"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
  ) : displayArticles.length > 0 ? (
    <div className="flex flex-col gap-6">
      {displayArticles.map((article, index) => (
        <Link
          key={article.id}
          to={buildFriendlyBlogPath(article.slug, article.created_at)}
          className="block group fade-in-animation"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <Card className="overflow-hidden border border-gray-200/60 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex flex-col md:flex-row">
              {/* Immagine */}
              <div className="relative md:w-72 lg:w-80 flex-shrink-0 overflow-hidden">
                <img
                  src={article.cover_image_url || '/placeholder.svg'}
                  alt={article.title}
                  className="w-full h-52 md:h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              {/* Contenuto */}
              <CardContent className="flex-1 p-5 md:p-7 flex flex-col justify-between">
                <div>
                  {/* Hashtag */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {article.hashtags?.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="bg-purple-50 text-purple-600 border-0 text-xs font-medium px-2.5 py-0.5">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  {/* Titolo */}
                  <h3 className="font-bold text-xl lg:text-2xl text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-700 transition-colors duration-200">
                    {article.title}
                  </h3>
                  {/* Sottotitolo */}
                  {article.subtitle && (
                    <p className="text-purple-600/80 font-medium text-sm mb-2">
                      {article.subtitle}
                    </p>
                  )}
                  {/* Estratto */}
                  {article.excerpt && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  )}
                </div>
                {/* Footer: autore + data + CTA */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                        <User className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium text-gray-600">{article.profiles?.full_name || t('blog_page.author_fallback', 'Autore')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(article.created_at)}</span>
                    </div>
                  </div>
                  <span className="text-purple-600 text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {t('blog_page.read_more', 'Leggi di più')} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </CardContent>
            </div>
          </Card>
        </Link>
      ))}
    </div>
      ) : (
        <div className="text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
            </div>
            <div className="relative z-10">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-600 mb-4">
                {searchTerm ? t('blog_page.no_results_title', 'Nessun articolo trovato') : t('blog_page.no_posts_title', 'Nessun articolo pubblicato')}
              </h3>
              <p className="text-gray-500 text-lg">
                {searchTerm ? t('blog_page.no_results_desc', 'Prova a modificare i termini di ricerca.') : t('blog_page.no_posts_desc', 'Torna presto per nuovi contenuti!')}
              </p>
            </div>
          </div>
        </div>
  )}
      </div>
      <div className="pb-20" />
  </div>
    </div>
  );

  return isMobile ? (
    <MobileLayout>
      <BlogContent />
    </MobileLayout>
  ) : (
    <Layout>
      <BlogContent />
    </Layout>
  );
};

export default Blog;
