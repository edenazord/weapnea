
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves, MessageSquare, Sparkles } from "lucide-react";
import { ReactNode } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Footer from "@/components/Footer";

const Layout = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();
    const { t, currentLanguage } = useLanguage();
    
    console.log('🎨 Layout rendering with language:', currentLanguage);
    
    // Auto scroll to top on route change
    useScrollToTop();
    
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            <header className="sticky top-0 z-50 modern-blur border-b border-white/20 shadow-lg">
                <div className="px-6 py-4 w-full max-w-none">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center space-x-3 group">
                            <div className="relative">
                                <Waves className="h-8 w-8 text-blue-600 group-hover:text-purple-600 transition-colors duration-300" />
                                <div className="absolute -top-1 -right-1">
                                    <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
                                </div>
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 via-purple-700 to-blue-900 bg-clip-text text-transparent">
                                WeApnea
                            </span>
                        </Link>
                        
                        <nav className="hidden md:flex items-center space-x-8">
                            <Link 
                                to="/" 
                                className="relative text-gray-700 hover:text-blue-600 transition-all duration-300 font-medium group"
                            >
                                <span className="relative z-10">{t('nav.events', 'Eventi')}</span>
                                <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                            </Link>
                            <Link 
                                to="/chi-siamo" 
                                className="relative text-gray-700 hover:text-blue-600 transition-all duration-300 font-medium group"
                            >
                                <span className="relative z-10">{t('nav.about', 'Chi Siamo')}</span>
                                <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                            </Link>
                            <Link 
                                to="/blog" 
                                className="relative text-gray-700 hover:text-blue-600 transition-all duration-300 font-medium group"
                            >
                                <span className="relative z-10">{t('nav.blog', 'Blog')}</span>
                                <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                            </Link>
                            <Link 
                                to="/forum" 
                                className="flex items-center gap-2 relative text-gray-700 hover:text-purple-600 transition-all duration-300 font-medium group"
                            >
                                <MessageSquare className="h-4 w-4 group-hover:text-purple-600 transition-colors duration-300" />
                                <span className="relative z-10">{t('nav.forum', 'Forum')}</span>
                                <div className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                            </Link>
                        </nav>
                        
                        <div className="flex items-center space-x-3">
                            <LanguageSwitcher />
                            {loading ? (
                                <div className="flex items-center space-x-3">
                                    <Skeleton className="h-9 w-20 rounded-full" />
                                    <Skeleton className="h-9 w-24 rounded-full" />
                                </div>
                            ) : user ? (
                                <UserNav />
                            ) : (
                                <>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        asChild
                                        className="rounded-full border-purple-200 hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-300"
                                    >
                                      <Link to="/auth">{t('common.login', 'Accedi')}</Link>
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        asChild
                                        className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300"
                                    >
                                      <Link to="/auth?view=register">{t('common.register', 'Registrati')}</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-none">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
