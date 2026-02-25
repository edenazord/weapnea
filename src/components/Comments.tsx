import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { backendConfig } from '@/lib/backendConfig';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Trash2, Reply, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

const API = backendConfig.apiBaseUrl;
const getToken = () => localStorage.getItem('api_token') || '';

interface Comment {
  id: string;
  blog_id?: string;
  event_id?: string;
  author_id: string;
  parent_id?: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
}

interface CommentsProps {
  blogId?: string;
  eventId?: string;
  /** If false, the user cannot post (e.g. not a participant). Defaults to true for blog. */
  canComment?: boolean;
}

export default function Comments({ blogId, eventId, canComment }: CommentsProps) {
  const { user } = useAuth();
  // Blog comments are open to all logged-in users; event comments require explicit permission
  const effectiveCanComment = canComment !== undefined ? canComment : (blogId ? !!user : false);
  const { t, currentLanguage } = useLanguage();
  const dateLocale = currentLanguage === 'it' ? it : enUS;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchComments = async () => {
    try {
      const param = blogId ? `blog_id=${blogId}` : `event_id=${eventId}`;
      const res = await fetch(`${API}/api/comments?${param}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      console.error('Failed to fetch comments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [blogId, eventId]);

  const postComment = async (body: string, parentId?: string) => {
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          blog_id: blogId || undefined,
          event_id: eventId || undefined,
          parent_id: parentId || undefined,
          body,
        }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setNewComment('');
        setReplyTo(null);
        setReplyText('');
        toast.success(t('comments.posted', 'Commento pubblicato!'));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Errore');
      }
    } catch (e) {
      toast.error('Errore di rete');
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/comments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
        toast.success(t('comments.deleted', 'Commento eliminato'));
      }
    } catch (e) {
      toast.error('Errore');
    }
  };

  // Build thread tree: top-level + replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);

  const getReplies = (parentId: string) => replies.filter((r) => r.parent_id === parentId);

  const CommentCard = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`flex gap-3 ${isReply ? 'ml-10 mt-2' : 'mt-4'}`}>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={comment.author_avatar || undefined} />
        <AvatarFallback>{comment.author_name?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-white/80 dark:bg-neutral-800/80 rounded-xl px-4 py-3 shadow-sm border border-gray-100 dark:border-neutral-700">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{comment.author_name || 'Utente'}</span>
            <span className="text-[11px] text-gray-400">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: dateLocale })}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.body}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          {user && effectiveCanComment && !isReply && (
            <button
              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Reply className="w-3.5 h-3.5" />
              {t('comments.reply', 'Rispondi')}
            </button>
          )}
          {user && (user.id === comment.author_id || user.role === 'admin' || user.role === 'creator') && (
            <button
              onClick={() => deleteComment(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Reply input */}
        {replyTo === comment.id && (
          <div className="flex gap-2 mt-2 ml-1">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('comments.write_reply', 'Scrivi una risposta...')}
              className="flex-1 min-h-[60px] text-sm resize-none"
            />
            <Button
              size="sm"
              disabled={!replyText.trim() || posting}
              onClick={() => postComment(replyText, comment.id)}
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        )}
        {/* Replies */}
        {getReplies(comment.id).map((reply) => (
          <CommentCard key={reply.id} comment={reply} isReply />
        ))}
      </div>
    </div>
  );

  // Hide entire section if no comments and user can't comment
  if (!loading && topLevel.length === 0 && !effectiveCanComment) return null;

  return (
    <div className="mt-8 md:mt-12">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t('comments.title', 'Commenti')} {comments.length > 0 && <span className="text-gray-400 font-normal text-sm">({comments.length})</span>}
        </h3>
      </div>

      {/* New comment input */}
      {user && effectiveCanComment ? (
        <div className="flex gap-3 mb-4">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback>{user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.write', 'Scrivi un commento...')}
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                disabled={!newComment.trim() || posting}
                onClick={() => postComment(newComment)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-4"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                {t('comments.publish', 'Pubblica')}
              </Button>
            </div>
          </div>
        </div>
      ) : user && !effectiveCanComment ? (
        <p className="text-sm text-gray-500 mb-4 italic">
          {t('comments.participants_only', 'Solo i partecipanti iscritti possono commentare.')}
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-4 italic">
          {t('comments.login_required', 'Accedi per lasciare un commento.')}
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : topLevel.length === 0 ? (
        effectiveCanComment ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {t('comments.empty', 'Nessun commento ancora. Sii il primo!')}
          </p>
        ) : null
      ) : (
        <div className="space-y-1">
          {topLevel.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
