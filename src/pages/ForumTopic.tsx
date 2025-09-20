
import Layout from "@/components/Layout";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Eye, Pin, Lock, ArrowLeft, Send, Trash2 } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getForumTopicById, getForumReplies, createForumReply, incrementTopicViews, deleteForumTopic, deleteForumReply } from "@/lib/forum-api";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import EditTopicDialog from "@/components/forum/EditTopicDialog";
import EditReplyDialog from "@/components/forum/EditReplyDialog";
import PageTopBar from "@/components/PageTopBar";
import { useLanguage } from "@/contexts/LanguageContext";

const ForumTopic = () => {
  const isMobile = useIsMobile();
  const { id } = useParams<{ id: string }>();
  const { session, user, profile } = useAuth();
  const [replyContent, setReplyContent] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin';
  const { t } = useLanguage();

  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ['forum-topic', id],
    queryFn: () => getForumTopicById(id!),
    enabled: !!id,
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['forum-replies', id],
    queryFn: () => getForumReplies(id!),
    enabled: !!id,
  });

  // Increment view count when topic loads
  useEffect(() => {
    if (topic && id) {
      incrementTopicViews(id);
    }
  }, [topic, id]);

  const deleteTopicMutation = useMutation({
    mutationFn: deleteForumTopic,
    onSuccess: () => {
      toast.success(t('forum.toasts.topic_deleted', 'Topic eliminato con successo!'));
      navigate('/forum');
    },
    onError: (error) => {
      toast.error(t('forum.toasts.topic_delete_error_prefix', 'Errore nell\'eliminazione del topic: ') + error.message);
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: deleteForumReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies', id] });
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success(t('forum.toasts.reply_deleted', 'Risposta eliminata con successo!'));
    },
    onError: (error) => {
      toast.error(t('forum.toasts.reply_delete_error_prefix', 'Errore nell\'eliminazione della risposta: ') + error.message);
    },
  });

  const replyMutation = useMutation({
    mutationFn: createForumReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies', id] });
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      setReplyContent('');
      toast.success(t('forum.toasts.reply_added', 'Risposta aggiunta con successo!'));
    },
    onError: (error) => {
      toast.error(t('forum.toasts.reply_add_error_prefix', 'Errore nell\'aggiunta della risposta: ') + error.message);
    },
  });

  const handleSubmitReply = () => {
    if (!replyContent.trim() || !user || !id) return;

    replyMutation.mutate({
      content: replyContent.trim(),
      topic_id: id,
      author_id: user.id,
    });
  };

  const handleDeleteTopic = () => {
    if (!id) return;
    deleteTopicMutation.mutate(id);
  };

  const handleDeleteReply = (replyId: string) => {
    deleteReplyMutation.mutate(replyId);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMM yyyy HH:mm', { locale: it });
    } catch {
      return dateString;
    }
  };

  const canEditTopic = user && topic && (user.id === topic.author_id || isAdmin);

  if (topicLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-8">
  <h2 className="text-xl font-semibold text-gray-600">{t('forum.topic_not_found', 'Topic non trovato')}</h2>
        <Button asChild className="mt-4">
          <Link to="/forum">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('forum.back_to_forum', 'Torna al Forum')}
          </Link>
        </Button>
      </div>
    );
  }

  const content = (
    <div className={`space-y-6`}>
  <PageTopBar fallbackPath="/forum" label={t('forum.back_to_forum', 'Torna al Forum')} />
      <div className="max-w-6xl mx-auto px-4 md:px-6">
      
      {/* Navigation */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
  <Link to="/forum" className="hover:text-blue-600">{t('forum.title', 'Forum')}</Link>
        <span>/</span>
        {topic.category && (
          <>
            <Link 
              to={`/forum?category=${topic.category_id}`}
              className="hover:text-blue-600"
            >
              {topic.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-900">{topic.title}</span>
      </div>

      {/* Modern Topic Header */}
      <Card className="modern-blur border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-500">
        <CardContent className="p-0">
          {/* Header with gradient background */}
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 p-6 rounded-t-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {topic.is_pinned && (
                    <div className="p-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                      <Pin className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {topic.is_locked && (
                    <div className="p-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                      <Lock className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <h1 className={`font-bold text-white leading-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                    {topic.title}
                  </h1>
                  {canEditTopic && (
                    <div className="ml-2">
                      <EditTopicDialog topic={topic} topicId={id!} />
                    </div>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 ml-1">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questo topic?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Questa azione non può essere annullata. Il topic e tutte le sue risposte verranno eliminati permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteTopic} className="bg-red-600 hover:bg-red-700">
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {(topic.author?.full_name || 'A')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{topic.author?.full_name || t('forum.anonymous', 'Anonimo')}</span>
                  </div>
                  <span className="text-white/60">•</span>
                  <span className={isMobile ? 'text-sm' : ''}>{formatDate(topic.created_at)}</span>
                  {topic.category && (
                    <>
                      <span className="text-white/60">•</span>
                      <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                        {topic.category.name}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-white/90 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
                  <Eye className="h-4 w-4" />
                  <span className={`${isMobile ? 'text-sm' : ''}`}>{topic.views_count || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-white bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className={`${isMobile ? 'text-sm' : ''}`}>{topic.replies_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="prose max-w-none prose-lg">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{topic.content}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      {repliesLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : replies.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <h2 className={`font-bold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>
              {t('forum.replies', 'Risposte')} ({replies.length})
            </h2>
          </div>
          {replies.map((reply, index) => {
            const canEditReply = user && (user.id === reply.author_id || isAdmin);
            const canDeleteReply = user && (user.id === reply.author_id || isAdmin);
            
            return (
              <Card key={reply.id} className="modern-blur border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-0">
                  {/* Reply Header */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {(reply.author?.full_name || 'A')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {reply.author?.full_name || t('forum.anonymous', 'Anonimo')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(reply.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                        #{index + 1}
                      </Badge>
                      {canEditReply && (
                        <EditReplyDialog reply={reply} topicId={id!} />
                      )}
                      {canDeleteReply && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('forum.delete_reply.title', 'Eliminare questa risposta?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('forum.delete_reply.description', 'Questa azione non può essere annullata. La risposta verrà eliminata permanentemente.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel', 'Annulla')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteReply(reply.id)} 
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t('common.delete', 'Elimina')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  
                  {/* Reply Content */}
                  <div className="p-6">
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{reply.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

  {/* Modern Reply Form */}
      {session ? (
        !topic.is_locked ? (
          <Card className="modern-blur border border-white/20 shadow-lg sticky bottom-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {(profile?.full_name || user?.email || 'A')[0].toUpperCase()}
                  </span>
                </div>
                <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-lg'}`}>
                  {t('forum.add_reply.title', 'Aggiungi una risposta')}
                </h3>
              </div>
              <div className="space-y-4">
                <Textarea
                  placeholder={t('forum.add_reply.placeholder', 'Scrivi la tua risposta...')}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className={`border-purple-200 focus:border-purple-400 focus:ring-purple-400/20 ${isMobile ? 'min-h-24' : 'min-h-32'}`}
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || replyMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {replyMutation.isPending ? t('forum.add_reply.sending', 'Invio...') : t('forum.add_reply.send', 'Invia Risposta')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="modern-blur border border-white/20 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="p-3 rounded-full bg-gray-100 w-fit mx-auto mb-4">
                <Lock className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">{t('forum.locked.title', 'Questo topic è bloccato')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('forum.locked.description', 'Non è possibile aggiungere nuove risposte.')}</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="modern-blur border border-white/20 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-400/20 to-blue-400/20 rounded-full blur-2xl"></div>
              </div>
              <div className="relative z-10">
                <div className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 w-fit mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h3 className={`font-bold text-gray-900 mb-2 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {t('forum.login_cta.title', 'Partecipa alla discussione!')}
                </h3>
                <p className="text-gray-600 mb-6">{t('forum.login_cta.description', 'Devi essere autenticato per rispondere a questo topic.')}</p>
                <Button asChild className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 rounded-full">
                  <Link to="/auth">{t('forum.login_cta.button', 'Accedi per rispondere')}</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );

  if (isMobile) {
    return <MobileLayout>{content}</MobileLayout>;
  }

  return <Layout>{content}</Layout>;
};

export default ForumTopic;
