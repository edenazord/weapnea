import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserNav } from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileBottomNav from "@/components/MobileBottomNav";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Footer from "@/components/Footer";

interface AppMobileLayoutProps {
  children: ReactNode;
  navVariant?: "default" | "dashboard" | "profile";
}

const AppMobileLayout = ({ children, navVariant = "default" }: AppMobileLayoutProps) => {
  const { session, loading } = useAuth();
  const { t } = useLanguage();
  
  // Auto scroll to top on route change
  useScrollToTop();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header compatto per mobile */}
      <header className="sticky top-0 z-50 modern-blur border-b border-white/20 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <Waves className="h-6 w-6 text-blue-600 group-hover:text-purple-600 transition-colors duration-300" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
              WeApnea
            </span>
          </Link>
          <div className="flex items-center space-x-2">
            <LanguageSwitcher />
            {loading ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : session ? (
              <UserNav />
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                asChild
                className="rounded-full border-purple-200 hover:border-purple-400"
              >
                <Link to="/auth">{t('common.login', 'Accedi')}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content with proper spacing for bottom nav */}
      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Footer with margin to avoid overlap with bottom nav */}
      <div className="mb-20">
        <Footer />
      </div>

      {/* Bottom Navigation per mobile */}
      <MobileBottomNav variant={navVariant} />
    </div>
  );
};

export default AppMobileLayout;