
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserNav } from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves, Home, User, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Footer from "@/components/Footer";

const MobileLayout = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    
    // Auto scroll to top on route change
    useScrollToTop();

    const navItems = [
        { icon: Home, label: t('nav.home', 'Home'), path: "/" },
        { icon: FileText, label: t('nav.blog', 'Blog'), path: "/blog" },
        { icon: User, label: t('nav.profile', 'Profilo'), path: user ? "/profile" : "/auth" },
    ];

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
                        ) : user ? (
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

            {/* Bottom Navigation per mobile - always visible */}
            <nav className="fixed bottom-0 left-0 right-0 modern-blur border-t border-white/20 px-2 py-2 z-50 safe-area-inset-bottom shadow-lg">
                <div className="flex items-center justify-around">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center space-y-1 p-1 rounded-lg transition-all duration-300 ${
                                    isActive 
                                        ? "text-white bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105" 
                                        : "text-gray-600 hover:text-purple-600 hover:bg-white/50"
                                }`}
                            >
                                <item.icon className="h-4 w-4" />
                                <span className="text-xs font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default MobileLayout;
