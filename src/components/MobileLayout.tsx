
import { ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, User, FileText, Menu, X, Calendar, Users, Mail, Shield, BookOpen, MessageSquare, MessageCircle, LogOut, Bot } from "lucide-react";
import { useChatStore } from "@/hooks/useChatStore";
import { useAIAgentStore } from "@/hooks/useAIAgentStore";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";

const MobileLayout = ({ children }: { children: ReactNode }) => {
    const { user, loading, logout } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const { isOpen: chatOpen, openList: openChatList } = useChatStore();
    const { visible: aiVisible, toggle: toggleAI } = useAIAgentStore();
    
    // Auto scroll to top on route change
    useScrollToTop();

    // Bottom nav: 5 icon-only items
    const bottomItems = [
        { icon: Calendar, label: t('nav.events', 'Eventi'), path: "/" },
        { icon: User, label: t('nav.profile', 'Profilo'), path: user ? "/profile" : "/auth" },
        { icon: BookOpen, label: t('nav.blog', 'Blog'), path: "/blog" },
        { icon: MessageCircle, label: "Chat", path: "__chat__" },
        { icon: Bot, label: "AI", path: "__ai__" },
    ];

    // Full menu items for the slide-out panel
    const menuItems = [
        { icon: Home, label: t('nav.home', 'Home'), path: "/" },
        { icon: Calendar, label: t('nav.events', 'Eventi'), path: "/eventi-imminenti" },
        { icon: Users, label: t('nav.about', 'Chi Siamo'), path: "/chi-siamo" },
        { icon: Mail, label: t('nav.contact', 'Contattaci'), path: "/contattaci" },
        { icon: BookOpen, label: t('nav.blog', 'Blog'), path: "/blog" },
        { icon: MessageSquare, label: t('nav.forum', 'Forum'), path: "/forum" },
        { icon: Shield, label: t('footer.privacy_policy', 'Privacy Policy'), path: "/privacy-policy" },
        { icon: FileText, label: t('footer.cookie_policy', 'Cookie Policy'), path: "/cookie-policy" },
    ];

    const isActive = (path: string) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            {/* Header compatto */}
            <header className="sticky top-0 z-50 modern-blur border-b border-white/20 px-4 py-3 shadow-lg">
                <div className="flex items-center justify-between">
                    <Logo imgClassName="h-7 origin-left scale-110" showText textClassName="text-base" />
                    <div className="flex items-center space-x-2">
                        <LanguageSwitcher />
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="p-2 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors"
                            aria-label={t('nav.menu', 'Menu')}
                        >
                            <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 pb-20">
                {children}
            </main>

            {/* Footer compatto mobile */}
            <div className="pb-16">
                <Footer />
            </div>

            {/* Slide-out menu overlay */}
            {menuOpen && (
                <div className="fixed inset-0 z-[60]">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMenuOpen(false)}
                    />
                    {/* Panel from right */}
                    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-neutral-900 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        {/* Menu header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Menu
                            </span>
                            <button
                                onClick={() => setMenuOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>

                        {/* Menu items */}
                        <nav className="flex-1 overflow-y-auto py-2">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMenuOpen(false)}
                                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                                        isActive(item.path)
                                            ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 dark:from-blue-900/30 dark:to-purple-900/30 dark:text-blue-300 border-r-2 border-blue-600"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                    }`}
                                >
                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                    <span className="text-sm font-medium">{item.label}</span>
                                </Link>
                            ))}
                        </nav>

                        {/* Auth section at bottom */}
                        {user ? (
                            <div className="p-4 border-t border-gray-100 dark:border-neutral-800">
                                <button
                                    onClick={async () => { setMenuOpen(false); await logout(); navigate('/'); }}
                                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <LogOut className="h-5 w-5 flex-shrink-0" />
                                    <span className="text-sm font-medium">Logout</span>
                                </button>
                            </div>
                        ) : !loading && (
                            <div className="p-4 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                                <Button asChild className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                                    <Link to="/auth" onClick={() => setMenuOpen(false)}>{t('common.login', 'Accedi')}</Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full rounded-full">
                                    <Link to="/auth?view=register" onClick={() => setMenuOpen(false)}>{t('common.register', 'Registrati')}</Link>
                                </Button>
                            </div>
                        )}

                        {/* Contact info */}
                        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800">
                            <p className="text-xs text-gray-400">weapnea@gmail.com</p>
                            <p className="text-xs text-gray-400 mt-1">© {new Date().getFullYear()} WeApnea</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation - 5 icon-only tabs */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-neutral-700 z-50 safe-area-inset-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-around h-14 px-1">
                    {bottomItems.map((item) => {
                        const isCurrent = item.path === "__chat__" 
                                ? chatOpen 
                                : item.path === "__ai__"
                                ? aiVisible
                                : isActive(item.path);
                        const handleClick = item.path === "__chat__"
                                ? (e: React.MouseEvent) => { e.preventDefault(); openChatList(); }
                                : item.path === "__ai__"
                                ? (e: React.MouseEvent) => { e.preventDefault(); toggleAI(); }
                                : undefined;
                        
                        const content = (
                            <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                                <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                                    isCurrent 
                                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md" 
                                        : "text-gray-500 dark:text-gray-400"
                                }`}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <span className={`text-[10px] font-medium leading-none ${
                                    isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                        );

                        if (item.path === "__chat__" || item.path === "__ai__") {
                            return (
                                <button
                                    key={item.path}
                                    onClick={handleClick}
                                    className="flex-1 flex items-center justify-center py-1"
                                >
                                    {content}
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="flex-1 flex items-center justify-center py-1"
                            >
                                {content}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default MobileLayout;
