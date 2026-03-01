
import Layout from "@/components/Layout";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getForumCategories, createForumTopic } from "@/lib/forum-api";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const NewForumTopic = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: getForumCategories,
  });

  const topicMutation = useMutation({
    mutationFn: createForumTopic,
    onSuccess: () => {
      toast.success(t('new_forum_topic_page.success', 'Topic creato con successo!'));
      navigate('/forum');
    },
    onError: (error) => {
      toast.error(t('new_forum_topic_page.error_prefix', 'Errore nella creazione del topic: ') + error.message);
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!session) {
      navigate('/auth');
    }
  }, [session, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim() || !categoryId || !user) {
      toast.error(t('new_forum_topic_page.fill_required', 'Compila tutti i campi richiesti'));
      return;
    }

    topicMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      category_id: categoryId,
      author_id: user.id,
    });
  };

  if (!session) {
    return null;
  }

  const content_jsx = (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="text-center mb-12 relative">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-purple-400/20 rounded-full blur-3xl floating-animation"></div>
          <div className="absolute top-10 right-1/3 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl floating-animation" style={{ animationDelay: '-1s' }}></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <div className="p-3 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg">
                <Send className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-900 via-blue-700 to-purple-900 bg-clip-text text-transparent leading-tight">
            {t('new_forum_topic_page.title', 'Crea un nuovo topic')}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {t('new_forum_topic_page.subtitle', 'Condividi le tue idee e discussioni con la community')}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link to="/forum" className="hover:text-purple-600 transition-colors duration-300">{t('new_forum_topic_page.breadcrumb_forum', 'Forum')}</Link>
        <span>/</span>
        <span className="text-gray-900">{t('new_forum_topic_page.breadcrumb_new', 'Nuovo Topic')}</span>
      </div>

      {/* Back Button */}
      <Button variant="outline" asChild className="border-purple-200 hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-300 rounded-full">
        <Link to="/forum">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('new_forum_topic_page.back_to_forum', 'Torna al Forum')}
        </Link>
      </Button>

      {/* Form */}
      <Card className="modern-blur border border-white/20 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl bg-gradient-to-r from-purple-900 to-blue-900 bg-clip-text text-transparent">
            {t('new_forum_topic_page.form_title', 'Nuovo Topic di Discussione')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="category" className="text-lg font-semibold text-gray-700">{t('new_forum_topic_page.category_label', 'Categoria *')}</Label>
              <div className="gradient-border">
                <div className="gradient-border-inner">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="border-0 focus:ring-2 focus:ring-purple-500">
                      <SelectValue placeholder={t('new_forum_topic_page.category_placeholder', 'Seleziona una categoria')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="title" className="text-lg font-semibold text-gray-700">{t('new_forum_topic_page.title_label', 'Titolo *')}</Label>
              <div className="gradient-border">
                <div className="gradient-border-inner">
                  <Input
                    id="title"
                    type="text"
                    placeholder={t('new_forum_topic_page.title_placeholder', 'Inserisci il titolo del topic')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    className="border-0 focus:ring-2 focus:ring-purple-500 text-lg py-3"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="content" className="text-lg font-semibold text-gray-700">{t('new_forum_topic_page.content_label', 'Contenuto *')}</Label>
              <div className="gradient-border">
                <div className="gradient-border-inner">
                  <Textarea
                    id="content"
                    placeholder={t('new_forum_topic_page.content_placeholder', 'Descrivi la tua discussione...')}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-48 border-0 focus:ring-2 focus:ring-purple-500 text-base leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6">
              <Button type="button" variant="outline" asChild className="border-gray-300 hover:border-gray-400 rounded-full">
                <Link to="/forum">{t('new_forum_topic_page.cancel', 'Annulla')}</Link>
              </Button>
              <Button 
                type="submit" 
                disabled={!title.trim() || !content.trim() || !categoryId || topicMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full px-8"
              >
                <Send className="mr-2 h-4 w-4" />
                {topicMutation.isPending ? t('new_forum_topic_page.creating', 'Creazione...') : t('new_forum_topic_page.create', 'Crea Topic')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return <MobileLayout><div className="p-4">{content_jsx}</div></MobileLayout>;
  }

  return <Layout>{content_jsx}</Layout>;
};

export default NewForumTopic;
