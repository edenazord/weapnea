
// API-only: usa utente salvato da AuthContext in localStorage

// Input validation and sanitization functions
export const validateAndSanitizeInput = {
  title: (title: string): string => {
    if (!title || title.trim().length === 0) {
      throw new Error('Il titolo è obbligatorio');
    }
    if (title.length > 200) {
      throw new Error('Il titolo non può superare i 200 caratteri');
    }
  return title.trim().replace(/[<>"']/g, '');
  },

  content: (content: string): string => {
    if (!content || content.trim().length === 0) {
      throw new Error('Il contenuto è obbligatorio');
    }
    if (content.length > 50000) {
      throw new Error('Il contenuto non può superare i 50000 caratteri');
    }
    return content.trim();
  },

  uuid: (id: string): string => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new Error('ID non valido');
    }
    return id;
  }
};

// Check if user has admin role
export const checkAdminRole = async (): Promise<boolean> => {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return false;
    const u = JSON.parse(raw) as { id: string; role?: string };
    return u?.role === 'admin';
  } catch {
    return false;
  }
};

// Check if user can edit/delete content
export const checkContentOwnership = async (authorId: string): Promise<boolean> => {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return false;
    const me = JSON.parse(raw) as { id: string; role?: string };
    if (!me?.id) return false;
    const isAdmin = me.role === 'admin';
    return me.id === authorId || isAdmin;
  } catch {
    return false;
  }
};

// Rate limiting helper (basic client-side implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (action: string, maxRequests: number = 10, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const key = `${action}`;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
};
