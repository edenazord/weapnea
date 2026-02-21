
import Layout from "@/components/Layout";
import MobileLayout from "@/components/MobileLayout";
import PageTopBar from "@/components/PageTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, ArrowLeft, Share2, Sparkles } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBlogArticleBySlug } from "@/lib/blog-api";
import { parseFriendlyBlogSlug } from "@/lib/seo-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import DOMPurify from 'dompurify';
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/useIsMobile";

const BlogDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // Supporta slug SEO-friendly "/blog/DD-mese-YYYY-titolo" estraendo solo lo slug del titolo
  const effectiveSlug = slug ? (parseFriendlyBlogSlug(slug)?.titleSlug ?? slug) : undefined;

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['blog-article', effectiveSlug],
    queryFn: () => getBlogArticleBySlug(effectiveSlug!),
    enabled: !!effectiveSlug,
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: article?.title,
        text: article?.excerpt || article?.title,
        url: window.location.href,
      });
    } catch (err) {
      // Fallback to copying URL to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: t('blog_page.share_copied_title', 'Link copiato!'),
        description: t("blog_page.share_copied_desc", "Il link dell'articolo è stato copiato negli appunti."),
      });
    }
  };

  const Wrapper = isMobile ? MobileLayout : Layout;

  if (isLoading) {
    return (
      <Wrapper>
        {!isMobile && <PageTopBar />}
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="animate-pulse">
            <div className="h-64 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-8"></div>
            <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded mb-4"></div>
            <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded mb-2 w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  if (error || !article) {
    return (
      <Wrapper>
        {!isMobile && <PageTopBar />}
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center py-16">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
            </div>
            <div className="relative z-10">
              <div className="p-4 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 w-fit mx-auto mb-6">
                <User className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('blog_page.not_found_title', 'Articolo non trovato')}</h1>
              <p className="text-gray-600 mb-8 text-lg">{t('blog_page.not_found_desc', "L'articolo che stai cercando non esiste o è stato rimosso.")}</p>
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full">
                <Link to="/blog">{t('blog_page.back_to_blog', 'Torna al Blog')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
  {!isMobile && <PageTopBar fallbackPath="/blog" label={t('blog_page.back_to_blog', 'Torna al Blog')} />}
      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* Cover Image */}
        {article.cover_image_url && (
          <div className="relative mb-10 overflow-hidden rounded-2xl shadow-2xl">
            <img 
              src={article.cover_image_url} 
              alt={article.title}
              className="w-full h-64 md:h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
          </div>
        )}

        {/* Article Header */}
        <div className="mb-10">
          {/* Hashtags */}
          {article.hashtags && article.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              {article.hashtags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700 border-0 px-3 py-1 text-sm">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent leading-normal pb-3">
            {article.title}
          </h1>

          {/* Subtitle */}
          {article.subtitle && (
            <div className="mb-8">
              <p className="text-2xl md:text-3xl font-semibold text-purple-600 leading-snug">
                {article.subtitle}
              </p>
            </div>
          )}

          {/* Excerpt */}
          {article.excerpt && (
            <div className="relative mb-8">
              <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
              <p className="text-xl md:text-2xl text-gray-600 leading-relaxed pl-6 italic">
                {article.excerpt}
              </p>
            </div>
          )}

          {/* Meta info */}
          <div className="modern-blur border border-white/20 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-6 text-gray-600">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{article.profiles?.full_name || t('blog_page.author_fallback', 'Autore')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(article.created_at)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleShare} className="border-purple-200 hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-300 rounded-full">
                <Share2 className="h-4 w-4 mr-2" />
                {t('blog_page.share_button', 'Condividi')}
              </Button>
            </div>
          </div>
        </div>

        {/* Article Content */}
        <div className="mb-16">
          <div className="modern-blur border border-white/20 rounded-2xl p-8 shadow-lg">
            <div 
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
              className="prose prose-blue prose-lg max-w-none
                [&>*]:mb-6 
                [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:bg-gradient-to-r [&>h1]:from-blue-900 [&>h1]:to-purple-900 [&>h1]:bg-clip-text [&>h1]:text-transparent [&>h1]:mt-8 [&>h1]:mb-4
                [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:bg-gradient-to-r [&>h2]:from-blue-800 [&>h2]:to-purple-800 [&>h2]:bg-clip-text [&>h2]:text-transparent [&>h2]:mt-6 [&>h2]:mb-3
                [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-gray-900 [&>h3]:mt-4 [&>h3]:mb-2
                [&>p]:text-gray-700 [&>p]:leading-relaxed [&>p]:mb-4
                [&>a]:text-blue-600 [&>a]:underline [&>a]:hover:text-purple-600 [&>a]:cursor-pointer [&>a]:transition-colors [&>a]:duration-300
                [&>strong]:font-bold [&>strong]:text-gray-900
                [&>em]:italic [&>em]:text-gray-700
                [&>u]:underline
                [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4
                [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4
                [&>li]:mb-2 [&>li]:text-gray-700
                [&>blockquote]:border-l-4 [&>blockquote]:border-gradient-to-b [&>blockquote]:from-blue-500 [&>blockquote]:to-purple-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-600 [&>blockquote]:my-6 [&>blockquote]:bg-gradient-to-r [&>blockquote]:from-blue-50 [&>blockquote]:to-purple-50 [&>blockquote]:py-3 [&>blockquote]:rounded-r-lg
                [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:mb-4 [&>pre]:border [&>pre]:border-gray-200
                [&>code]:bg-gradient-to-r [&>code]:from-blue-100 [&>code]:to-purple-100 [&>code]:px-2 [&>code]:py-1 [&>code]:rounded [&>code]:text-sm [&>code]:text-purple-800
                [&>img]:rounded-lg [&>img]:mb-4 [&>img]:max-w-full [&>img]:h-auto [&>img]:shadow-lg"
            />
          </div>
        </div>

        {/* Gallery */}
        {article.gallery_images && article.gallery_images.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <div className="p-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
      <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-purple-900 bg-clip-text text-transparent">{t('blog_page.gallery_title', 'Galleria')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {article.gallery_images.map((image, index) => (
                <div key={index} className="group overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500">
                  <img 
                    src={image} 
        alt={`${t('blog_page.gallery_title', 'Galleria')} ${index + 1}`}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to Blog */}
  <div className="text-center py-12 border-t border-gray-200">
          <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full">
            <Link to="/blog">{t('blog_page.back_to_blog', 'Torna al Blog')}</Link>
          </Button>
        </div>
      </div>
    </Wrapper>
  );
};

export default BlogDetail;
