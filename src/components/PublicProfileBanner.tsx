import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useLocation } from "react-router-dom";
import { X, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "public_profile_banner_dismissed";

/**
 * Floating banner (bottom-right, above chat FAB) that invites
 * logged-in users who haven't enabled their public profile to do so.
 * Dismissible per session (stored in sessionStorage).
 */
export default function PublicProfileBanner() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true); // hide by default until we know

  useEffect(() => {
    // If already dismissed this session, stay hidden
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }
    setDismissed(false);
  }, []);

  // Don't render while auth is loading
  if (loading) return null;
  // Only show for logged-in users
  if (!user) return null;
  // Don't show if the user already has public profile enabled
  if ((user as any).public_profile_enabled) return null;
  // Don't show if already on the profile page (avoid nagging)
  if (location.pathname === "/profile") return null;
  // Don't show if dismissed
  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handleCta = () => {
    handleDismiss();
    navigate("/profile#visibility");
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-xs w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="relative rounded-xl border bg-background shadow-lg p-4 pr-10">
        {/* close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label={t("public_profile_banner.dismiss", "Not now")}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 rounded-full bg-primary/10 p-2">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold leading-tight">
              {t("public_profile_banner.title", "Rendi visibile il tuo profilo!")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("public_profile_banner.message", "Attiva il profilo pubblico per farti trovare dalla community di apneisti.")}
            </p>
            <Button size="sm" className="mt-2" onClick={handleCta}>
              {t("public_profile_banner.cta", "Attiva ora")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
