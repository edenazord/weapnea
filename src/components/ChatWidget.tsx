import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { backendConfig } from '@/lib/backendConfig';

const API_BASE = backendConfig.apiBaseUrl;

// Helper to get token from localStorage
const getToken = () => localStorage.getItem('api_token') || import.meta.env.VITE_API_TOKEN;

// Helper to convert URLs in text to clickable links
const linkifyText = (text: string): (string | JSX.Element)[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Favicon notification helpers
const ORIGINAL_FAVICON = '/favicon.svg';
const NOTIFICATION_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="%231e40af"/>
  <circle cx="75" cy="25" r="20" fill="%23ef4444"/>
</svg>
`);

const setFavicon = (hasNotification: boolean) => {
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (link) {
    link.href = hasNotification ? NOTIFICATION_FAVICON : ORIGINAL_FAVICON;
  }
};

interface Conversation {
  id: string;
  event_id: string | null;
  last_message_at: string;
  created_at: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_user_slug: string | null;
  event_title: string | null;
  event_slug: string | null;
  last_message: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  read_at: string | null;
  created_at: string;
}

interface ChatWidgetProps {
  // Optionally pre-open chat with specific user/event
  openWithUserId?: string;
  openWithEventId?: string;
  onClose?: () => void;
}

export function ChatWidget({ openWithUserId, openWithEventId, onClose }: ChatWidgetProps) {
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dateLocale = currentLanguage === 'it' ? it : enUS;

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        const count = data.reduce((sum: number, c: Conversation) => sum + (c.unread_count || 0), 0);
        setUnreadTotal(count);
        setFavicon(count > 0);
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.count || 0;
        setUnreadTotal(count);
        setFavicon(count > 0);
      }
    } catch (e) {
      // silent
    }
  }, []);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // After reading messages, update unread count (messages are marked read server-side)
        fetchUnreadCount();
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  }, [fetchUnreadCount]);

  // Open/create conversation with user
  const openConversationWith = useCallback(async (otherUserId: string, eventId?: string) => {
    const token = getToken();
    if (!token) {
      console.warn('[ChatWidget] No auth token, cannot open conversation');
      return;
    }
    console.log('[ChatWidget] Opening conversation with:', otherUserId, 'event:', eventId);
    console.log('[ChatWidget] Setting isOpen to true');
    setLoading(true);
    setIsOpen(true); // Open widget immediately
    try {
      console.log('[ChatWidget] Calling API:', `${API_BASE}/api/conversations`);
      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ otherUserId, eventId: eventId || null })
      });
      console.log('[ChatWidget] API response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[ChatWidget] Conversation created/fetched:', data);
        // Create a placeholder conversation object from response
        const conv: Conversation = {
          id: data.id,
          other_user_id: otherUserId,
          other_user_name: data.other_user_name || '',
          other_user_avatar: data.other_user_avatar || null,
          event_id: eventId || null,
          event_title: data.event_title || null,
          event_slug: data.event_slug || null,
          last_message: null,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          unread_count: 0
        };
        setActiveConversation(conv);
        await fetchMessages(data.id);
        fetchConversations(); // Update list in background
      } else {
        const errText = await res.text();
        console.error('[ChatWidget] Failed to create conversation:', res.status, errText);
      }
    } catch (e) {
      console.error('[ChatWidget] Failed to open conversation:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchConversations, fetchMessages]);

  // Send message
  const sendMessage = async () => {
    const token = getToken();
    if (!newMessage.trim() || !activeConversation || !token || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newMessage.trim() })
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, { ...msg, sender_name: user?.full_name || '', sender_avatar: user?.avatar_url || null }]);
        setNewMessage('');
        // Update conversation list
        fetchConversations();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConversation) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConversation]);

  // Initial load and polling
  useEffect(() => {
    const token = getToken();
    if (user && token) {
      // Only fetch conversation list if widget is open via button (not via external request)
      // External requests handle their own conversation loading
      if (!openWithUserId) {
        fetchConversations();
      }
      fetchUnreadCount();
      
      // Poll for new messages every 10 seconds when open
      pollIntervalRef.current = setInterval(() => {
        if (isOpen && activeConversation) {
          fetchMessages(activeConversation.id);
        }
        fetchUnreadCount();
      }, 10000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, fetchConversations, fetchMessages, fetchUnreadCount, openWithUserId]);

  // Handle external open request - inline logic to avoid stale closure
  const lastProcessedRef = useRef<string | null>(null);
  
  useEffect(() => {
    console.log('[ChatWidget] useEffect triggered - openWithUserId:', openWithUserId, 'user:', !!user);
    const requestKey = openWithUserId ? `${openWithUserId}-${openWithEventId || 'no-event'}` : null;
    console.log('[ChatWidget] requestKey:', requestKey, 'lastProcessedRef:', lastProcessedRef.current);
    
    if (!openWithUserId) {
      console.log('[ChatWidget] Skipping: no openWithUserId');
      return;
    }
    if (!user) {
      console.log('[ChatWidget] Skipping: no user');
      return;
    }
    if (requestKey === lastProcessedRef.current) {
      console.log('[ChatWidget] Skipping: already processed this request');
      return;
    }
    
    console.log('[ChatWidget] External open request for user:', openWithUserId, 'event:', openWithEventId);
    lastProcessedRef.current = requestKey;
    
    // Inline the open logic to avoid stale closure issues
    const token = getToken();
    console.log('[ChatWidget] Token present:', !!token, 'Token value:', token ? token.substring(0, 20) + '...' : 'NULL');
    if (!token) {
      console.warn('[ChatWidget] No auth token, cannot open conversation');
      return;
    }
    
    console.log('[ChatWidget] Opening widget and creating conversation...');
    setLoading(true);
    setIsOpen(true);
    
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ otherUserId: openWithUserId, eventId: openWithEventId || null })
        });
        console.log('[ChatWidget] API response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('[ChatWidget] Conversation created/fetched:', data);
          const conv: Conversation = {
            id: data.id,
            other_user_id: openWithUserId,
            other_user_name: data.other_user_name || '',
            other_user_avatar: data.other_user_avatar || null,
            other_user_slug: data.other_user_slug || null,
            event_id: openWithEventId || null,
            event_title: data.event_title || null,
            event_slug: data.event_slug || null,
            last_message: null,
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            unread_count: 0
          };
          setActiveConversation(conv);
          // Fetch messages
          const msgRes = await fetch(`${API_BASE}/api/conversations/${data.id}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setMessages(msgData);
          }
        } else {
          console.error('[ChatWidget] Failed to create conversation:', res.status);
        }
      } catch (e) {
        console.error('[ChatWidget] Error opening conversation:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [openWithUserId, openWithEventId, user]);

  // Don't render if not logged in
  if (!user) return null;

  const handleOpen = () => {
    setIsOpen(true);
    fetchConversations();
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveConversation(null);
    lastProcessedRef.current = null; // Reset so next external open works
    onClose?.();
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    fetchMessages(conv.id);
  };

  const handleBack = () => {
    setActiveConversation(null);
    lastProcessedRef.current = null; // Reset for next external open
    fetchConversations();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Debug: log render state
  console.log('[ChatWidget] Render - isOpen:', isOpen, 'user:', !!user, 'activeConversation:', !!activeConversation, 'loading:', loading);

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
          aria-label={t('chat.open', 'Apri messaggi')}
        >
          <MessageCircle className="w-6 h-6" />
          {unreadTotal > 0 && (
            <Badge className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </Badge>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] h-[500px] max-h-[80vh] bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            {activeConversation ? (
              <>
                <button onClick={handleBack} className="p-1 hover:bg-muted rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {activeConversation.other_user_slug ? (
                  <a 
                    href={`/profile/${activeConversation.other_user_slug}`}
                    className="flex items-center gap-2 flex-1 min-w-0 ml-2 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={activeConversation.other_user_avatar || undefined} />
                      <AvatarFallback>{activeConversation.other_user_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate hover:underline">{activeConversation.other_user_name || t('chat.unknown_user', 'Utente')}</p>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0 ml-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={activeConversation.other_user_avatar || undefined} />
                      <AvatarFallback>{activeConversation.other_user_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{activeConversation.other_user_name || t('chat.unknown_user', 'Utente')}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <h3 className="font-semibold">{t('chat.title', 'Messaggi')}</h3>
            )}
            <button onClick={handleClose} className="p-1 hover:bg-muted rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {activeConversation ? (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4 [&_[data-radix-scroll-area-viewport]]:!overflow-y-scroll [&_[data-radix-scroll-area-scrollbar]]:!opacity-100 [&_[data-radix-scroll-area-thumb]]:!bg-gray-400">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    {t('chat.no_messages', 'Nessun messaggio. Inizia la conversazione!')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'max-w-[80%] px-3 py-2 rounded-lg text-sm',
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-none'
                              : 'bg-muted rounded-bl-none'
                          )}>
                            <p className="whitespace-pre-wrap break-words">{linkifyText(msg.content)}</p>
                            <p className={cn(
                              'text-[10px] mt-1',
                              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: dateLocale })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.type_message', 'Scrivi un messaggio...')}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    size="icon"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Conversation list */
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8 px-4">
                  {t('chat.no_conversations', 'Nessuna conversazione. Contatta un organizzatore da un evento!')}
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className="w-full px-4 py-3 hover:bg-muted/50 flex items-start gap-3 text-left transition-colors"
                    >
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={conv.other_user_avatar || undefined} />
                        <AvatarFallback>{conv.other_user_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">{conv.other_user_name || t('chat.unknown_user', 'Utente')}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: dateLocale })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.last_message || t('chat.no_messages_yet', 'Nessun messaggio')}
                          </p>
                          {conv.unread_count > 0 && (
                            <Badge className="shrink-0 bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] h-[18px]">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      )}
    </>
  );
}

export default ChatWidget;
