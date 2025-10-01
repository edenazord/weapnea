
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, Eye, Sparkles, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBlogArticles } from "@/lib/blog-api";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import PageTopBar from "@/components/PageTopBar";
import PageHeader from "@/components/PageHeader";

const Blog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['blog-articles', searchTerm],
    queryFn: () => getBlogArticles(true, searchTerm),
  });

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
      <PageTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6">
      
  <PageHeader
        title={t('blog_page.title', 'Blog WeApnea')}
        subtitle={t('blog_page.subtitle', "Scopri le ultime novità dal mondo dell'apnea, tecniche, consigli e storie dalla nostra community")}
      />

  {/* Modern Search */}
  <div className="mb-12">
        <div className="relative max-w-xl mx-auto">
          <div className="gradient-border">
            <div className="gradient-border-inner">
              <div className="relative">
                <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                <Input
                  placeholder={t('blog_page.search_placeholder', 'Cerca articoli...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 text-lg border-0 focus:ring-2 focus:ring-purple-500 rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
  {isLoading ? (
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
  ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article, index) => (
            <Card key={article.id} className="group overflow-hidden modern-blur border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-500 card-hover-lift fade-in-animation" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="relative overflow-hidden">
                <img 
                  src={article.cover_image_url || '/placeholder.svg'} 
                  alt={article.title}
                  className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <CardContent className="p-6 relative">
                <div className="flex flex-wrap gap-2 mb-4">
                  {article.hashtags?.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700 border-0 hover:from-purple-100 hover:to-blue-100 transition-all duration-300">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                
                <h3 className="font-bold text-xl text-gray-900 mb-3 line-clamp-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                  <Link to={`/blog/${article.slug}`}>
                    {article.title}
                  </Link>
                </h3>
                
                {article.excerpt && (
                  <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium">{article.profiles?.full_name || t('blog_page.author_fallback', 'Autore')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(article.created_at)}</span>
                  </div>
                </div>
                
                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full">
                  <Link to={`/blog/${article.slug}`}>{t('blog_page.read_more', 'Leggi di più')}</Link>
                </Button>
              </CardContent>
            </Card>
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
