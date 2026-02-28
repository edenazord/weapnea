
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, ArrowRight, Filter, X, Tag } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBlogArticles, getBlogTags } from "@/lib/blog-api";
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
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { t, currentLanguage } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allowedLangs = ['it','en','es','fr','pl','ru'] as const;
  const langParam = (allowedLangs as readonly string[]).includes(currentLanguage) ? (currentLanguage as typeof allowedLangs[number]) : undefined;

  // Load tags for current language
  const { data: tags = [] } = useQuery({
    queryKey: ['blog-tags', langParam],
    queryFn: () => getBlogTags(langParam),
  });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['blog-articles', langParam, searchTerm, selectedTag],
    queryFn: () => getBlogArticles(true, searchTerm, { column: 'created_at', direction: 'desc' }, langParam, undefined, selectedTag),
  });

  // Fallback: se per la lingua selezionata non ci sono articoli, mostra quelli in inglese
  const { data: enArticles = [], isLoading: isLoadingEn } = useQuery({
    queryKey: ['blog-articles', 'en', searchTerm, selectedTag],
    queryFn: () => getBlogArticles(true, searchTerm, { column: 'created_at', direction: 'desc' }, 'en', undefined, selectedTag),
    enabled: langParam !== 'en',
  });

  const usingEnglishFallback = (langParam && langParam !== 'en' && !isLoading && articles.length === 0 && enArticles.length > 0);
  const displayArticles = usingEnglishFallback ? enArticles : articles;

  const selectedTagName = tags.find(tag => tag.id === selectedTag)?.name;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const content = (
    <div className="">
      <PageHead title="Blog" description="Articoli, guide e approfondimenti sul mondo dell'apnea e del freediving." />
      {!isMobile && <PageTopBar />}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
      
  <PageHeader
        title={t('blog_page.title', 'Blog WeApnea')}
        subtitle={t('blog_page.subtitle', "Scopri le ultime novità dal mondo dell'apnea, tecniche, consigli e storie dalla nostra community")}
      />

  {/* Modern Search con dropdown tag stile eventi */}
  <div className="mb-12" ref={dropdownRef}>
        <div className="relative max-w-xl mx-auto">
          <div className="relative gradient-border hover:scale-[1.01] transition-all duration-200">
            <div className="gradient-border-inner rounded-lg shadow-md hover:shadow-lg overflow-hidden transition-all duration-200">
              <div className="flex items-center">
                <div className="flex-1 relative">
                  <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 z-10 text-primary/50" />
                  <Input
                    placeholder={t('blog_page.search_placeholder', 'Cerca articoli...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={() => setIsDropdownOpen(true)}
                    className={`pl-14 pr-6 border-0 bg-transparent text-base focus:ring-0 focus:outline-none cursor-pointer placeholder:text-muted-foreground ${isMobile ? 'h-14' : 'h-16'}`}
                  />
                </div>
                {selectedTag && (
                  <div className="px-4 flex items-center gap-2 text-purple-600">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium max-w-[100px] truncate">{selectedTagName}</span>
                    <button
                      onClick={() => { setSelectedTag(undefined); setIsDropdownOpen(false); }}
                      className="text-purple-400 hover:text-purple-700 hover:bg-purple-100 p-1 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dropdown pannello tag */}
          {isDropdownOpen && tags.length > 0 && (
            <Card className="absolute top-full left-0 right-0 mt-2 p-5 bg-white/95 backdrop-blur-sm shadow-xl border-0 z-50 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Tag className="h-4 w-4" />
                  <span className="text-sm font-semibold">{t('blog_page.filter_by_tag', 'Filtra per tag')}</span>
                </div>
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => { setSelectedTag(selectedTag === tag.id ? undefined : tag.id); setIsDropdownOpen(false); }}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      selectedTag === tag.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </Card>
          )}
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
                {/* Tag overlay in alto a destra */}
                {((article as any).tags?.length > 0 || article.hashtags?.length > 0) && (
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
                    {(article as any).tags?.slice(0, 3).map((tag: any) => (
                      <span
                        key={tag.id}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md leading-tight"
                      >
                        {tag.name}
                      </span>
                    ))}
                    {!((article as any).tags?.length) && article.hashtags?.slice(0, 2).map((tag, i) => (
                      <span
                        key={`h-${i}`}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md leading-tight"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Contenuto */}
              <CardContent className="flex-1 p-5 md:p-7 flex flex-col justify-between">
                <div>
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
      {content}
    </MobileLayout>
  ) : (
    <Layout>
      {content}
    </Layout>
  );
};

export default Blog;
