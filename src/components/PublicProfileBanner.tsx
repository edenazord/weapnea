import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

/**
 * Floating banner (bottom-left) that invites
 * logged-in users who haven't enabled their public profile to do so.
 * Dismissable via X button for the current session.
 */
export default function PublicProfileBanner() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Don't render while auth is loading
  if (loading) return null;
  // Only show for logged-in users
  if (!user) return null;
  // Don't show if the user already has public profile enabled
  if ((user as any).public_profile_enabled) return null;
  // Don't show if already on the profile page (avoid nagging)
  if (location.pathname === "/profile") return null;
  // Don't show if dismissed this session
  if (dismissed) return null;

  const handleCta = () => {
    navigate("/profile#visibility");
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[280px] w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-purple-500/20">
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="absolute -top-2 -right-2 z-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-md p-1 hover:opacity-80 transition-opacity"
          aria-label={t('common.close', 'Chiudi')}
        >
          <X className="h-3.5 w-3.5 text-black" />
        </button>
        <button
          onClick={handleCta}
          className="group w-full text-left rounded-2xl"
        >
          <div className="rounded-2xl bg-gradient-to-r from-blue-600/95 to-purple-600/95 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 rounded-full bg-white/20 p-2 group-hover:bg-white/30 transition-colors">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight truncate">
                  {t("public_profile_banner.title", "Rendi visibile il tuo profilo!")}
                </p>
                <p className="text-[11px] text-blue-100/80 leading-snug mt-0.5">
                  {t("public_profile_banner.message", "Attiva il profilo pubblico per farti trovare dalla community di apneisti.")}
                </p>
                <span className="inline-block mt-1.5 text-xs font-medium text-white/90 underline underline-offset-2 decoration-white/40 group-hover:decoration-white/80 transition-colors">
                  {t("public_profile_banner.cta", "Attiva ora")} →
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
